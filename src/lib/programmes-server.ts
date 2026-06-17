import "server-only";
import { adminDb } from "./firebase-admin";
import { slugify } from "./exercices-server";
import type { BlocModele, ExerciceModele, ProgrammeModele, EffortType } from "./types";

/**
 * Bibliothèque de programmes partagés (Firestore `programmes`).
 * Tous les coachs connectés peuvent créer et lancer ; édition/suppression
 * réservées à l'auteur.
 */
const COLLECTION = "programmes";
const EFFORTS: EffortType[] = ["reps", "amrap", "temps", "distance", "calories"];

function nowMs(): number {
  return Date.now();
}

function num(v: unknown, def = 0): number {
  return typeof v === "number" && isFinite(v) ? v : def;
}
function str(v: unknown, def = ""): string {
  return typeof v === "string" ? v : def;
}

function sanitizeExercice(e: any): ExerciceModele {
  return {
    nom: str(e?.nom).trim() || "Exercice",
    video_id: typeof e?.video_id === "string" && e.video_id ? e.video_id : null,
    effort: EFFORTS.includes(e?.effort) ? e.effort : "reps",
    valeur: num(e?.valeur, 0),
    charge_h: typeof e?.charge_h === "number" ? e.charge_h : null,
    charge_f: typeof e?.charge_f === "number" ? e.charge_f : null,
    repos_s: num(e?.repos_s, 0),
    consignes: str(e?.consignes),
  };
}

function sanitizeBloc(b: any): BlocModele {
  return {
    nom: str(b?.nom).trim() || "Bloc",
    rounds: Math.max(1, num(b?.rounds, 1)),
    repos_entre_rounds_s: num(b?.repos_entre_rounds_s, 0),
    exercices: Array.isArray(b?.exercices) ? b.exercices.map(sanitizeExercice) : [],
  };
}

export interface ProgrammeInput {
  nom: string;
  description?: string;
  type?: ProgrammeModele["type"];
  mode?: ProgrammeModele["mode"];
  niveau?: ProgrammeModele["niveau"];
  blocs?: any[];
}

function sanitizeInput(input: ProgrammeInput) {
  return {
    nom: str(input.nom).trim() || "Programme sans nom",
    description: str(input.description),
    type: (["hyrox", "crossfit", "hiit", "endurance", "force"].includes(input.type as string)
      ? input.type
      : "crossfit") as ProgrammeModele["type"],
    mode: (input.mode === "groupe" ? "groupe" : "solo") as ProgrammeModele["mode"],
    niveau: (["debutant", "intermediaire", "avance"].includes(input.niveau as string)
      ? input.niveau
      : "intermediaire") as ProgrammeModele["niveau"],
    blocs: Array.isArray(input.blocs) ? input.blocs.map(sanitizeBloc) : [],
  };
}

function toModele(id: string, data: FirebaseFirestore.DocumentData): ProgrammeModele {
  return {
    id,
    nom: str(data.nom, id),
    description: str(data.description),
    type: data.type || "crossfit",
    mode: data.mode === "groupe" ? "groupe" : "solo",
    niveau: data.niveau || "intermediaire",
    blocs: Array.isArray(data.blocs) ? data.blocs.map(sanitizeBloc) : [],
    author_email: str(data.author_email),
    author_name: typeof data.author_name === "string" ? data.author_name : null,
    created_at: num(data.created_at),
    updated_at: num(data.updated_at),
  };
}

export async function listProgrammes(): Promise<ProgrammeModele[]> {
  const snap = await adminDb().collection(COLLECTION).get();
  return snap.docs
    .map((d) => toModele(d.id, d.data()))
    .sort((a, b) => b.updated_at - a.updated_at);
}

export async function getProgramme(id: string): Promise<ProgrammeModele | null> {
  const doc = await adminDb().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toModele(doc.id, doc.data()!);
}

export async function createProgramme(
  input: ProgrammeInput,
  author: { email: string; name: string | null }
): Promise<ProgrammeModele> {
  const data = sanitizeInput(input);
  const ts = nowMs();
  const id = `${slugify(data.nom) || "prog"}-${ts.toString(36)}`;
  const modele: ProgrammeModele = {
    id,
    ...data,
    author_email: author.email,
    author_name: author.name,
    created_at: ts,
    updated_at: ts,
  };
  await adminDb().collection(COLLECTION).doc(id).set(modele);
  return modele;
}

export async function updateProgramme(
  id: string,
  input: ProgrammeInput,
  authorEmail: string
): Promise<ProgrammeModele> {
  const ref = adminDb().collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("NOT_FOUND");
  if (str(doc.data()?.author_email) !== authorEmail) throw new Error("FORBIDDEN");
  const data = sanitizeInput(input);
  await ref.update({ ...data, updated_at: nowMs() });
  const updated = await ref.get();
  return toModele(updated.id, updated.data()!);
}

export async function deleteProgramme(id: string, authorEmail: string): Promise<void> {
  const ref = adminDb().collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return;
  if (str(doc.data()?.author_email) !== authorEmail) throw new Error("FORBIDDEN");
  await ref.delete();
}
