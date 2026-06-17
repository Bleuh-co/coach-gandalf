import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth-server";
import { buildAuthorizeUrl } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — démarre le flux OAuth Spotify (redirige vers Spotify). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", process.env.APP_PUBLIC_URL || "http://localhost:3000"));

  try {
    const state = randomUUID();
    const res = NextResponse.redirect(buildAuthorizeUrl(state));
    res.cookies.set("spotify_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (e) {
    if ((e as Error)?.message === "SPOTIFY_CLIENT_ID_MISSING") {
      return NextResponse.json({ error: "SPOTIFY_CLIENT_ID non configurée." }, { status: 503 });
    }
    throw e;
  }
}
