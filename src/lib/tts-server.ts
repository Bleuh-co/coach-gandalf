import "server-only";
import { createHash } from "crypto";
import { adminDb } from "./firebase-admin";
import { storeFile } from "./video-storage";

/**
 * Synthèse vocale via ElevenLabs (voix multilingue) pour les annonces.
 *
 * Les noms d'exercices étant en anglais, une voix multilingue les prononce
 * correctement dans une phrase française. L'audio est mis en cache dans
 * Storage (clé = hash du texte+voix+modèle) pour ne pas re-facturer les
 * phrases répétées ; l'URL est mémorisée dans Firestore (tts_cache).
 */

const ELEVEN_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// Voix premade ElevenLabs « Rachel » par défaut (dispo pour tous les comptes) ;
// le modèle multilingue gère FR + noms EN. Surcharge possible via env.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL = "eleven_multilingual_v2";

function apiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY_MISSING");
  return k;
}
function voiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
}
function modelId(): string {
  return process.env.ELEVENLABS_MODEL || DEFAULT_MODEL;
}

function cacheKey(text: string): string {
  return createHash("sha256").update(`${voiceId()}|${modelId()}|${text}`).digest("hex");
}

/** Renvoie l'URL d'un MP3 d'annonce (génère via ElevenLabs si absent du cache). */
export async function synthesize(text: string): Promise<string> {
  const clean = text.trim().slice(0, 500);
  if (!clean) throw new Error("EMPTY_TEXT");

  const hash = cacheKey(clean);
  const cacheRef = adminDb().doc(`tts_cache/${hash}`);
  const snap = await cacheRef.get();
  const cached = snap.exists ? (snap.data()?.url as string) : null;
  if (typeof cached === "string" && cached) return cached;

  const res = await fetch(`${ELEVEN_URL}/${voiceId()}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: clean,
      model_id: modelId(),
      voice_settings: { stability: 0.4, similarity_boost: 0.8 },
    }),
  });
  if (!res.ok) {
    console.error("[tts] elevenlabs error", res.status, (await res.text()).slice(0, 200));
    throw new Error(`TTS_FAILED_${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const { url } = await storeFile(`tts/${hash}.mp3`, buffer, "audio/mpeg");
  await cacheRef.set({ url, text: clean, created_at: Date.now() });
  return url;
}
