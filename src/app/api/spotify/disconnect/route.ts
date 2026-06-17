import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { clearSpotifyConnection } from "@/lib/spotify-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — déconnecte le compte Spotify du gym. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  await clearSpotifyConnection();
  return NextResponse.json({ ok: true });
}
