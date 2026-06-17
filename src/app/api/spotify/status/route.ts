import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getSpotifyConnectionInfo, defaultPlaylistUri } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — état de la connexion Spotify + playlist par défaut. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const info = await getSpotifyConnectionInfo();
  return NextResponse.json({ ...info, defaultPlaylist: defaultPlaylistUri() });
}
