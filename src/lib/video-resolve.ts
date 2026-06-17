import "server-only";
import { setVideoState } from "./exercices-server";
import { importExerciseDbVideo, getExerciseDbVideoUrl } from "./exercisedb";
import type { Exercice, Programme } from "./types";

/**
 * Ré-héberge à la demande les vidéos des exercices d'un programme qui n'en ont
 * pas encore (catalogue ExerciseDB importé en métadonnées). Met en cache dans
 * Firestore. Repli sur l'URL CDN ExerciseDB si le ré-hébergement échoue.
 * Les exercices custom (sans video_id / source_ref) restent sans vidéo.
 *
 * Partagé par la génération IA et la préparation des programmes de la bibliothèque.
 */
export async function hostMissingVideos(programme: Programme, catalogue: Exercice[]): Promise<void> {
  const byId = new Map(catalogue.map((c) => [c.video_id, c]));
  await Promise.all(
    programme.exercices.map(async (ex) => {
      if (ex.video_url) return;
      const cat = byId.get(ex.video_id);
      if (cat?.video_url) {
        ex.video_url = cat.video_url;
        return;
      }
      if (!cat?.source_ref) return; // exercice custom ou hors catalogue → pas de vidéo
      try {
        const { videoUrl, gsPath } = await importExerciseDbVideo(ex.video_id, cat.source_ref);
        await setVideoState(ex.video_id, {
          video_status: "ready",
          video_url: videoUrl,
          video_gs_path: gsPath,
          video_source: "exercisedb",
          source_ref: cat.source_ref,
          video_error: null,
        });
        ex.video_url = videoUrl;
      } catch (e) {
        console.warn("[video-resolve] host failed, fallback CDN", ex.video_id, (e as Error)?.message);
        try {
          ex.video_url = await getExerciseDbVideoUrl(cat.source_ref);
        } catch {
          /* laissera le fallback emoji côté UI */
        }
      }
    })
  );
}
