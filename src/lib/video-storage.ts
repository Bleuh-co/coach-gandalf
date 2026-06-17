import "server-only";
import { randomUUID } from "crypto";
import { adminStorageBucket, storageBucketName } from "./firebase-admin";

export interface StoredVideo {
  videoUrl: string;
  gsPath: string;
}

/**
 * Upload un buffer vidéo dans Cloud Storage sous videos/{videoId}.mp4 et
 * renvoie une URL de téléchargement Firebase permanente (token).
 * Helper partagé par la génération Veo et l'import ExerciseDB.
 */
export async function storeExerciceVideo(
  videoId: string,
  buffer: Buffer,
  contentType = "video/mp4"
): Promise<StoredVideo> {
  const bucket = adminStorageBucket();
  const objectPath = `videos/${videoId}.mp4`;
  const token = randomUUID();
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const bucketName = storageBucketName() || bucket.name;
  const videoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;
  return { videoUrl, gsPath: `gs://${bucketName}/${objectPath}` };
}
