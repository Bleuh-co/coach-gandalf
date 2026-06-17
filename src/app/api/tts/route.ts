import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { synthesize } from "@/lib/tts-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { text } — renvoie { url } d'un MP3 d'annonce (ElevenLabs + cache). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (!body?.text?.trim()) return NextResponse.json({ error: "text requis" }, { status: 400 });

  try {
    const url = await synthesize(body.text);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "ELEVENLABS_API_KEY_MISSING") {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY non configurée." }, { status: 503 });
    }
    console.error("[tts] synth failed", e);
    return NextResponse.json({ error: "Synthèse vocale impossible." }, { status: 502 });
  }
}
