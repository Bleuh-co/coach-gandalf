import "server-only";
import { randomUUID } from "crypto";
import { adminStorageBucket, storageBucketName } from "./firebase-admin";

export interface StoredFile {
  url: string;
  gsPath: string;
}

export interface StoredVideo {
  videoUrl: string;
  gsPath: string;
}

/**
 * Upload un buffer dans Cloud Storage et renvoie une URL de téléchargement
 * Firebase permanente (token). Helper générique (vidéos, audio TTS…).
 */
export async function storeFile(
  objectPath: string,
  buffer: Buffer,
  contentType: string
): Promise<StoredFile> {
  const bucket = adminStorageBucket();
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
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;
  return { url, gsPath: `gs://${bucketName}/${objectPath}` };
}

/**
 * Upload un buffer vidéo dans Cloud Storage sous videos/{videoId}.mp4.
 * Helper partagé par la génération Veo et l'import ExerciseDB.
 */
export async function storeExerciceVideo(
  videoId: string,
  buffer: Buffer,
  contentType = "video/mp4"
): Promise<StoredVideo> {
  const { url, gsPath } = await storeFile(`videos/${videoId}.mp4`, buffer, contentType);
  return { videoUrl: url, gsPath };
}
