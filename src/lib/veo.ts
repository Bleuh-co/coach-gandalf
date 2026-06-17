import "server-only";
import { randomUUID } from "crypto";
import { adminStorageBucket, storageBucketName } from "./firebase-admin";
import type { Exercice } from "./types";

/**
 * Génération de vidéos d'exercices via Veo 3 (Google Gemini API).
 *
 * L'API Veo est ASYNCHRONE (long-running operation) : une génération prend
 * plusieurs minutes. Le flux est donc « démarrer → sonder → finaliser », chaque
 * étape étant une requête HTTP courte (compatible limite Cloud Run ~60s) :
 *   1. startVeoGeneration() lance l'opération et renvoie son nom.
 *   2. pollVeoOperation() interroge l'état de l'opération.
 *   3. finalizeVideo() télécharge le clip généré et l'upload dans Cloud Storage.
 *
 * ⚠️ L'id de modèle et le schéma de requête/réponse Veo peuvent évoluer ;
 * vérifier la doc Google Gemini si l'appel échoue.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  return key;
}

function veoModel(): string {
  return process.env.VEO_MODEL || "veo-3.1-generate-preview";
}

/** Construit le prompt final : template de style partagé + description de l'exercice. */
export function buildVeoPrompt(styleTemplate: string, exercice: Pick<Exercice, "nom" | "description_prompt">): string {
  return `${styleTemplate.trim()}

Exercice : ${exercice.nom}.
${exercice.description_prompt.trim()}`;
}

/**
 * Démarre une génération Veo. Renvoie le nom de l'opération à sonder.
 */
export async function startVeoGeneration(prompt: string): Promise<string> {
  const url = `${API_BASE}/models/${veoModel()}:predictLongRunning?key=${apiKey()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        aspectRatio: "16:9",
        resolution: "720p",
        personGeneration: "allow_adult",
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[veo] start error", res.status, txt);
    throw new Error(`VEO_START_FAILED_${res.status}`);
  }
  const data = await res.json();
  const name = data?.name;
  if (typeof name !== "string") throw new Error("VEO_NO_OPERATION_NAME");
  return name;
}

export interface VeoPollResult {
  done: boolean;
  fileUri: string | null; // URI du clip généré (à télécharger avec la clé API)
  error: string | null;
}

/** Extrait l'URI du fichier vidéo d'une réponse d'opération Veo (formes possibles). */
function extractFileUri(response: any): string | null {
  if (!response) return null;
  const candidates = [
    // Veo 3.1 (Gemini API) — forme documentée
    response?.generatedVideos?.[0]?.video?.uri,
    response?.generatedVideos?.[0]?.video?.fileUri,
    // Formes alternatives / antérieures (défensif)
    response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
    response?.generateVideoResponse?.generatedSamples?.[0]?.video?.fileUri,
    response?.generatedSamples?.[0]?.video?.uri,
    response?.predictions?.[0]?.video?.uri,
    response?.predictions?.[0]?.videoUri,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c) return c;
  }
  return null;
}

/** Sonde une opération Veo. */
export async function pollVeoOperation(opName: string): Promise<VeoPollResult> {
  const url = `${API_BASE}/${opName}?key=${apiKey()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[veo] poll error", res.status, txt);
    throw new Error(`VEO_POLL_FAILED_${res.status}`);
  }
  const data = await res.json();
  if (!data?.done) return { done: false, fileUri: null, error: null };
  if (data?.error) {
    return { done: true, fileUri: null, error: data.error?.message || "Veo a échoué." };
  }
  const fileUri = extractFileUri(data?.response);
  if (!fileUri) {
    console.error("[veo] no file uri in response", JSON.stringify(data?.response)?.slice(0, 500));
    return { done: true, fileUri: null, error: "Vidéo générée introuvable dans la réponse Veo." };
  }
  return { done: true, fileUri, error: null };
}

/** Télécharge les octets de la vidéo générée par Veo. */
async function downloadVeoVideo(fileUri: string): Promise<Buffer> {
  // Le fichier Veo requiert la clé API. Selon la forme de l'URI on l'ajoute en query.
  const sep = fileUri.includes("?") ? "&" : "?";
  const url = fileUri.startsWith("http") ? `${fileUri}${sep}key=${apiKey()}` : `${API_BASE}/${fileUri}:download?key=${apiKey()}`;
  const res = await fetch(url, { headers: { "x-goog-api-key": apiKey() } });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[veo] download error", res.status, txt.slice(0, 300));
    throw new Error(`VEO_DOWNLOAD_FAILED_${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export interface FinalizeResult {
  videoUrl: string;
  gsPath: string;
}

/**
 * Télécharge le clip Veo et l'upload dans Cloud Storage sous videos/{videoId}.mp4.
 * Renvoie une URL de téléchargement Firebase permanente (token).
 */
export async function finalizeVideo(videoId: string, fileUri: string): Promise<FinalizeResult> {
  const buffer = await downloadVeoVideo(fileUri);
  const bucket = adminStorageBucket();
  const objectPath = `videos/${videoId}.mp4`;
  const token = randomUUID();
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    resumable: false,
    contentType: "video/mp4",
    metadata: {
      contentType: "video/mp4",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const bucketName = storageBucketName() || bucket.name;
  const videoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;
  return { videoUrl, gsPath: `gs://${bucketName}/${objectPath}` };
}
