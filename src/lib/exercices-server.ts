import "server-only";
import { adminDb } from "./firebase-admin";
import { CATALOGUE_SEED, DEFAULT_STYLE_TEMPLATE } from "./catalogue";
import type { Exercice, VideoStatus } from "./types";

/**
 * Couche d'accès au catalogue d'exercices (source de vérité : Firestore).
 *
 * Collection `exercices` — doc ID = video_id (slug).
 * Doc `config/video_style` — { style_template } partagé par toutes les vidéos.
 */

const COLLECTION = "exercices";
const STYLE_DOC = "config/video_style";

function nowMs(): number {
  return Date.now();
}

/** Slugifie un nom d'exercice en video_id stable. */
export function slugify(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Normalise un document Firestore en Exercice (valeurs par défaut sûres). */
function toExercice(id: string, data: FirebaseFirestore.DocumentData): Exercice {
  return {
    video_id: id,
    nom: typeof data.nom === "string" ? data.nom : id,
    equipement: typeof data.equipement === "string" ? data.equipement : "aucun",
    description_prompt: typeof data.description_prompt === "string" ? data.description_prompt : "",
    video_url: typeof data.video_url === "string" ? data.video_url : null,
    video_status: (["none", "generating", "ready", "error"].includes(data.video_status)
      ? data.video_status
      : "none") as VideoStatus,
    video_gs_path: typeof data.video_gs_path === "string" ? data.video_gs_path : null,
    veo_operation: typeof data.veo_operation === "string" ? data.veo_operation : null,
    video_error: typeof data.video_error === "string" ? data.video_error : null,
    video_source: typeof data.video_source === "string" ? data.video_source : null,
    source_ref: typeof data.source_ref === "string" ? data.source_ref : null,
    edb_image_url: typeof data.edb_image_url === "string" ? data.edb_image_url : null,
    created_at: typeof data.created_at === "number" ? data.created_at : 0,
    updated_at: typeof data.updated_at === "number" ? data.updated_at : 0,
  };
}

/** Retourne tout le catalogue, trié par nom. */
export async function getCatalogue(): Promise<Exercice[]> {
  const snap = await adminDb().collection(COLLECTION).get();
  return snap.docs
    .map((d) => toExercice(d.id, d.data()))
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

/** Ensemble des video_id valides (pour la validation de la génération). */
export async function getCatalogueIds(): Promise<Set<string>> {
  const snap = await adminDb().collection(COLLECTION).select().get();
  return new Set(snap.docs.map((d) => d.id));
}

export async function getExercice(videoId: string): Promise<Exercice | null> {
  const doc = await adminDb().collection(COLLECTION).doc(videoId).get();
  if (!doc.exists) return null;
  return toExercice(doc.id, doc.data()!);
}

export interface CreateExerciceInput {
  nom: string;
  equipement?: string;
  description_prompt?: string;
  video_id?: string; // optionnel : sinon dérivé du nom
}

/** Crée un exercice. Échoue si le video_id existe déjà. */
export async function createExercice(input: CreateExerciceInput): Promise<Exercice> {
  const video_id = (input.video_id?.trim() || slugify(input.nom));
  if (!video_id) throw new Error("INVALID_ID");
  const ref = adminDb().collection(COLLECTION).doc(video_id);
  const existing = await ref.get();
  if (existing.exists) throw new Error("ALREADY_EXISTS");
  const ts = nowMs();
  const exercice: Exercice = {
    video_id,
    nom: input.nom.trim(),
    equipement: (input.equipement || "aucun").trim(),
    description_prompt: (input.description_prompt || "").trim(),
    video_url: null,
    video_status: "none",
    video_gs_path: null,
    veo_operation: null,
    video_error: null,
    video_source: null,
    source_ref: null,
    edb_image_url: null,
    created_at: ts,
    updated_at: ts,
  };
  await ref.set(exercice);
  return exercice;
}

export interface UpdateExerciceInput {
  nom?: string;
  equipement?: string;
  description_prompt?: string;
}

/** Met à jour les champs éditables d'un exercice. */
export async function updateExercice(
  videoId: string,
  patch: UpdateExerciceInput
): Promise<Exercice> {
  const ref = adminDb().collection(COLLECTION).doc(videoId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("NOT_FOUND");
  const data: Record<string, unknown> = { updated_at: nowMs() };
  if (typeof patch.nom === "string") data.nom = patch.nom.trim();
  if (typeof patch.equipement === "string") data.equipement = patch.equipement.trim();
  if (typeof patch.description_prompt === "string")
    data.description_prompt = patch.description_prompt.trim();
  await ref.update(data);
  const updated = await ref.get();
  return toExercice(updated.id, updated.data()!);
}

export async function deleteExercice(videoId: string): Promise<void> {
  await adminDb().collection(COLLECTION).doc(videoId).delete();
}

/** Met à jour l'état vidéo d'un exercice (utilisé par le flux Veo). */
export async function setVideoState(
  videoId: string,
  state: Partial<
    Pick<
      Exercice,
      | "video_url"
      | "video_status"
      | "video_gs_path"
      | "veo_operation"
      | "video_error"
      | "video_source"
      | "source_ref"
    >
  >
): Promise<void> {
  await adminDb()
    .collection(COLLECTION)
    .doc(videoId)
    .update({ ...state, updated_at: nowMs() });
}

// ----------------------------------------------------------------------
// Template de style partagé
// ----------------------------------------------------------------------

export async function getStyleTemplate(): Promise<string> {
  const doc = await adminDb().doc(STYLE_DOC).get();
  const tpl = doc.exists ? (doc.data()?.style_template as string) : null;
  return typeof tpl === "string" && tpl.trim() ? tpl : DEFAULT_STYLE_TEMPLATE;
}

export async function setStyleTemplate(template: string): Promise<void> {
  await adminDb()
    .doc(STYLE_DOC)
    .set({ style_template: template, updated_at: nowMs() }, { merge: true });
}

// ----------------------------------------------------------------------
// Import du catalogue ExerciseDB (métadonnées uniquement, vidéo à la demande)
// ----------------------------------------------------------------------

export interface EdbImportItem {
  exerciseId: string;
  name: string;
  equipments: string[];
  imageUrl: string | null;
}

/**
 * Upsert des exercices ExerciseDB (doc id = exerciseId). N'écrase PAS l'état
 * vidéo déjà hébergé d'un exercice existant (préserve video_url/status), met
 * seulement à jour les métadonnées. Renvoie le nombre d'exercices traités.
 */
export async function importFromExerciseDb(items: EdbImportItem[]): Promise<number> {
  const db = adminDb();
  const ts = nowMs();
  let count = 0;
  // Firestore : 500 écritures max par batch.
  for (let i = 0; i < items.length; i += 400) {
    const chunk = items.slice(i, i + 400);
    const refs = chunk.map((it) => db.collection(COLLECTION).doc(it.exerciseId));
    const snaps = await db.getAll(...refs);
    const batch = db.batch();
    chunk.forEach((it, j) => {
      const exists = snaps[j].exists;
      const meta: Record<string, unknown> = {
        nom: it.name,
        equipement: (it.equipments[0] || "aucun").toLowerCase(),
        edb_image_url: it.imageUrl,
        source_ref: it.exerciseId,
        updated_at: ts,
      };
      if (exists) {
        // préserve la vidéo déjà hébergée
        batch.set(refs[j], meta, { merge: true });
      } else {
        batch.set(refs[j], {
          video_id: it.exerciseId,
          description_prompt: "",
          video_url: null,
          video_status: "none",
          video_gs_path: null,
          veo_operation: null,
          video_error: null,
          video_source: null,
          created_at: ts,
          ...meta,
        });
      }
      count++;
    });
    await batch.commit();
  }
  return count;
}

// ----------------------------------------------------------------------
// Seeding initial depuis catalogue.ts
// ----------------------------------------------------------------------

/**
 * Importe les exercices de seed manquants. N'écrase JAMAIS un exercice existant.
 * Retourne la liste des video_id créés.
 */
export async function seedCatalogue(): Promise<string[]> {
  const db = adminDb();
  const created: string[] = [];
  const ts = nowMs();
  const batch = db.batch();
  for (const s of CATALOGUE_SEED) {
    const ref = db.collection(COLLECTION).doc(s.video_id);
    const existing = await ref.get();
    if (existing.exists) continue;
    const exercice: Exercice = {
      video_id: s.video_id,
      nom: s.nom,
      equipement: s.equipement,
      description_prompt: s.description_prompt,
      video_url: null,
      video_status: "none",
      video_gs_path: null,
      veo_operation: null,
      video_error: null,
      video_source: null,
      source_ref: null,
      edb_image_url: null,
      created_at: ts,
      updated_at: ts,
    };
    batch.set(ref, exercice);
    created.push(s.video_id);
  }
  // Initialise le template de style si absent.
  const styleRef = db.doc(STYLE_DOC);
  const styleSnap = await styleRef.get();
  if (!styleSnap.exists) {
    batch.set(styleRef, { style_template: DEFAULT_STYLE_TEMPLATE, updated_at: ts });
  }
  await batch.commit();
  return created;
}
