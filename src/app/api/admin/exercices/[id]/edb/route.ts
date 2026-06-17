import { NextRequest, NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { getExercice, setVideoState } from "@/lib/exercices-server";
import { importExerciseDbVideo } from "@/lib/exercisedb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — importe la vidéo d'un exercice ExerciseDB et la re-héberge dans Storage.
 * Body : { exerciseId }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const { id } = await params;

  const exercice = await getExercice(id);
  if (!exercice) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let body: { exerciseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  const exerciseId = body?.exerciseId?.trim();
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId requis." }, { status: 400 });
  }

  try {
    const { videoUrl, gsPath } = await importExerciseDbVideo(id, exerciseId);
    await setVideoState(id, {
      video_status: "ready",
      video_url: videoUrl,
      video_gs_path: gsPath,
      veo_operation: null,
      video_error: null,
      video_source: "exercisedb",
      source_ref: exerciseId,
    });
    return NextResponse.json({ status: "ready", video_url: videoUrl });
  } catch (e) {
    const msg = (e as Error)?.message || "Erreur inconnue";
    console.error("[admin/edb] import failed", e);
    if (msg === "EXERCISEDB_API_KEY_MISSING") {
      return NextResponse.json({ error: "EXERCISEDB_API_KEY non configurée sur le serveur." }, { status: 503 });
    }
    if (msg === "EDB_NO_VIDEO") {
      return NextResponse.json({ error: "Cet exercice ExerciseDB n'a pas de vidéo." }, { status: 422 });
    }
    await setVideoState(id, { video_status: "error", video_error: msg });
    return NextResponse.json({ error: "Import de la vidéo ExerciseDB impossible." }, { status: 502 });
  }
}
