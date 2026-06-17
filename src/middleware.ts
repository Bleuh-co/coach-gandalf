import { NextRequest, NextResponse } from "next/server";

/**
 * In-memory rate limiter for API routes.
 * 120 requests per minute per IP — prevents abuse and runaway read storms.
 *
 * NOTE: This is per-instance. On Cloud Run with maxScale=3,
 * effective limit is 120×3 = 360/min per IP (still safe).
 */
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120;

const hits = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of hits) {
    if (now > val.resetAt) hits.delete(key);
  }
}, 5 * 60_000);

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  // Only rate-limit API routes
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez dans une minute." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.headers.set("X-RateLimit-Remaining", String(MAX_REQUESTS - entry.count));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
