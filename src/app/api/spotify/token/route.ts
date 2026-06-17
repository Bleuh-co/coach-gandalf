import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getSpotifyRefreshToken, refreshAccessToken } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — renvoie un access token Spotify frais (refresh côté serveur). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const refreshToken = await getSpotifyRefreshToken();
  if (!refreshToken) return NextResponse.json({ connected: false }, { status: 409 });

  try {
    const t = await refreshAccessToken(refreshToken);
    return NextResponse.json({ access_token: t.access_token, expires_in: t.expires_in });
  } catch (e) {
    console.error("[spotify] token refresh failed", e);
    return NextResponse.json({ error: "Rafraîchissement du token Spotify impossible." }, { status: 502 });
  }
}
