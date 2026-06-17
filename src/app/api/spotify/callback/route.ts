import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { exchangeCode, storeSpotifyConnection } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = () => process.env.APP_PUBLIC_URL || "http://localhost:3000";

/** GET — retour OAuth Spotify : échange le code et stocke le refresh token. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", APP_URL()));

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = req.cookies.get("spotify_oauth_state")?.value;

  const back = (status: string) => {
    const r = NextResponse.redirect(new URL(`/gandalf?spotify=${status}`, APP_URL()));
    r.cookies.delete("spotify_oauth_state");
    return r;
  };

  if (error) return back("denied");
  if (!code || !state || !cookieState || state !== cookieState) return back("invalid_state");

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back("no_refresh");

    // Récupère l'email du compte connecté (info, non bloquant).
    let email: string | null = null;
    try {
      const me = await fetch("https://api.spotify.com/v1/me", {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      if (me.ok) email = (await me.json())?.email || null;
    } catch {
      /* ignore */
    }

    await storeSpotifyConnection({
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || null,
      connected_email: email,
      connected_at: Date.now(),
    });
    return back("connected");
  } catch (e) {
    console.error("[spotify] callback failed", e);
    return back("error");
  }
}
