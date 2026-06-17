import { NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { fetchAllExerciseDb } from "@/lib/exercisedb";
import { importFromExerciseDb } from "@/lib/exercices-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST — importe TOUT le catalogue ExerciseDB (métadonnées) dans Firestore.
 * Les vidéos ne sont PAS téléchargées ici : elles sont ré-hébergées à la demande
 * lors de la génération d'une séance.
 */
export async function POST() {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;

  try {
    const items = await fetchAllExerciseDb();
    const count = await importFromExerciseDb(
      items.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.name,
        equipments: e.equipments,
        imageUrl: e.imageUrl,
      }))
    );
    return NextResponse.json({ ok: true, fetched: items.length, imported: count });
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "EXERCISEDB_API_KEY_MISSING") {
      return NextResponse.json({ error: "EXERCISEDB_API_KEY non configurée sur le serveur." }, { status: 503 });
    }
    console.error("[admin/exercisedb] import-all failed", e);
    return NextResponse.json({ error: "Import du catalogue ExerciseDB impossible." }, { status: 502 });
  }
}
