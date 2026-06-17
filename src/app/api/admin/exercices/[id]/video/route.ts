import { NextRequest, NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { getExercice, getStyleTemplate, setVideoState } from "@/lib/exercices-server";
import { startVeoGeneration, pollVeoOperation, finalizeVideo, buildVeoPrompt } from "@/lib/veo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — démarre la génération de la vidéo (opération Veo asynchrone).
 * Stocke le nom de l'opération et passe le statut à `generating`.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const { id } = await params;

  const exercice = await getExercice(id);
  if (!exercice) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!exercice.description_prompt.trim()) {
    return NextResponse.json(
      { error: "Ajoute une description avant de générer la vidéo." },
      { status: 400 }
    );
  }

  try {
    const style = await getStyleTemplate();
    const prompt = buildVeoPrompt(style, exercice);
    const opName = await startVeoGeneration(prompt);
    await setVideoState(id, {
      video_status: "generating",
      veo_operation: opName,
      video_error: null,
    });
    return NextResponse.json({ status: "generating" });
  } catch (e) {
    const msg = (e as Error)?.message || "Erreur inconnue";
    console.error("[admin/video] start failed", e);
    await setVideoState(id, { video_status: "error", video_error: msg, veo_operation: null });
    if (msg === "GEMINI_API_KEY_MISSING") {
      return NextResponse.json({ error: "GEMINI_API_KEY non configurée sur le serveur." }, { status: 503 });
    }
    return NextResponse.json({ error: "Démarrage de la génération impossible." }, { status: 502 });
  }
}

/**
 * GET — sonde l'opération Veo et la finalise si terminée (upload Storage + maj doc).
 * Renvoie { status, video_url }.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const { id } = await params;

  const exercice = await getExercice(id);
  if (!exercice) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Rien à sonder si pas de génération en cours.
  if (exercice.video_status !== "generating" || !exercice.veo_operation) {
    return NextResponse.json({
      status: exercice.video_status,
      video_url: exercice.video_url,
      video_error: exercice.video_error,
    });
  }

  try {
    const result = await pollVeoOperation(exercice.veo_operation);
    if (!result.done) {
      return NextResponse.json({ status: "generating" });
    }
    if (result.error || !result.fileUri) {
      await setVideoState(id, {
        video_status: "error",
        video_error: result.error || "Génération échouée.",
        veo_operation: null,
      });
      return NextResponse.json({ status: "error", video_error: result.error });
    }
    // Opération terminée → télécharge + upload dans Storage.
    const { videoUrl, gsPath } = await finalizeVideo(id, result.fileUri);
    await setVideoState(id, {
      video_status: "ready",
      video_url: videoUrl,
      video_gs_path: gsPath,
      veo_operation: null,
      video_error: null,
      video_source: "veo",
    });
    return NextResponse.json({ status: "ready", video_url: videoUrl });
  } catch (e) {
    const msg = (e as Error)?.message || "Erreur inconnue";
    console.error("[admin/video] poll/finalize failed", e);
    await setVideoState(id, { video_status: "error", video_error: msg, veo_operation: null });
    return NextResponse.json({ status: "error", video_error: msg }, { status: 502 });
  }
}
