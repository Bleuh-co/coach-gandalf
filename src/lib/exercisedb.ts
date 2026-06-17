import "server-only";
import { storeExerciceVideo, type StoredVideo } from "./video-storage";

/**
 * Intégration ExerciseDB (AscendAPI via RapidAPI).
 *
 * Usage : afficher les démonstrations (avatar 3D, look cohérent) dans l'app.
 * La recherche est peu fiable → curation manuelle (l'admin choisit l'exerciseId).
 * À la sélection, on re-héberge le MP4 dans notre Storage (usage in-app autorisé
 * par la licence sur plan payant ; pas de redistribution en tant que base brute).
 */

const DEFAULT_HOST = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";

function host(): string {
  return process.env.EXERCISEDB_API_HOST || DEFAULT_HOST;
}

function apiKey(): string {
  const k = process.env.EXERCISEDB_API_KEY;
  if (!k) throw new Error("EXERCISEDB_API_KEY_MISSING");
  return k;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-rapidapi-host": host(),
    "x-rapidapi-key": apiKey(),
  };
}

export interface EdbCandidate {
  exerciseId: string;
  name: string;
  imageUrl: string | null;
}

export interface EdbExercise extends EdbCandidate {
  equipments: string[];
  bodyParts: string[];
  exerciseType: string | null;
}

function toEdbExercise(e: any): EdbExercise | null {
  if (!e || typeof e.exerciseId !== "string") return null;
  return {
    exerciseId: e.exerciseId,
    name: typeof e.name === "string" ? e.name.trim() : e.exerciseId,
    imageUrl: typeof e.imageUrl === "string" ? e.imageUrl : null,
    equipments: Array.isArray(e.equipments) ? e.equipments : [],
    bodyParts: Array.isArray(e.bodyParts) ? e.bodyParts : [],
    exerciseType: typeof e.exerciseType === "string" ? e.exerciseType : null,
  };
}

interface EdbPage {
  items: EdbExercise[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

/** Une page du catalogue (pagination par curseur). */
async function listExerciseDbPage(cursor: string | null, limit = 100): Promise<EdbPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const url = `https://${host()}/api/v1/exercises?${params.toString()}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[edb] list error", res.status, txt.slice(0, 200));
    throw new Error(`EDB_LIST_FAILED_${res.status}`);
  }
  const data = await res.json();
  const arr = Array.isArray(data?.data) ? data.data : [];
  const meta = data?.meta || {};
  return {
    items: arr.map(toEdbExercise).filter(Boolean) as EdbExercise[],
    nextCursor: typeof meta.nextCursor === "string" ? meta.nextCursor : null,
    hasNextPage: !!meta.hasNextPage,
  };
}

/**
 * Récupère tout le catalogue ExerciseDB par pages successives.
 * `maxItems` borne le nombre total par sécurité.
 */
export async function fetchAllExerciseDb(maxItems = 2000): Promise<EdbExercise[]> {
  const all: EdbExercise[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 100; guard++) {
    const page: EdbPage = await listExerciseDbPage(cursor, 100);
    all.push(...page.items);
    if (all.length >= maxItems || !page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all.slice(0, maxItems);
}

/** Recherche d'exercices (renvoie les candidats à curer). */
export async function searchExerciseDb(query: string): Promise<EdbCandidate[]> {
  const url = `https://${host()}/api/v1/exercises/search?search=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[edb] search error", res.status, txt.slice(0, 200));
    throw new Error(`EDB_SEARCH_FAILED_${res.status}`);
  }
  const data = await res.json();
  const arr = Array.isArray(data?.data) ? data.data : [];
  return arr
    .filter((e: any) => e && typeof e.exerciseId === "string")
    .map((e: any) => ({
      exerciseId: e.exerciseId,
      name: typeof e.name === "string" ? e.name.trim() : e.exerciseId,
      imageUrl: typeof e.imageUrl === "string" ? e.imageUrl : null,
    }));
}

/** Détail d'un exercice — on en extrait l'URL vidéo (CDN ExerciseDB). */
export async function getExerciseDbVideoUrl(exerciseId: string): Promise<string | null> {
  const url = `https://${host()}/api/v1/exercises/${encodeURIComponent(exerciseId)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[edb] detail error", res.status, txt.slice(0, 200));
    throw new Error(`EDB_DETAIL_FAILED_${res.status}`);
  }
  const data = await res.json();
  const v = data?.data?.videoUrl;
  return typeof v === "string" && v ? v : null;
}

/**
 * Importe la vidéo d'un exercice ExerciseDB et la re-héberge dans notre Storage
 * sous videos/{localVideoId}.mp4.
 */
export async function importExerciseDbVideo(
  localVideoId: string,
  exerciseId: string
): Promise<StoredVideo> {
  const videoUrl = await getExerciseDbVideoUrl(exerciseId);
  if (!videoUrl) throw new Error("EDB_NO_VIDEO");
  const res = await fetch(videoUrl);
  if (!res.ok) {
    console.error("[edb] download error", res.status);
    throw new Error(`EDB_DOWNLOAD_FAILED_${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return storeExerciceVideo(localVideoId, buffer);
}
