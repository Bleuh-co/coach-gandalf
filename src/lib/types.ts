// Rôle interne Coach Gandalf (mappé depuis le rôle standardisé Chanv)
// - superadmin : accès total
// - admin      : gestion + animation des séances
// - membre     : coach (animation des séances)
// - blocked    : pas d'accès
export type Role = "superadmin" | "admin" | "membre" | "blocked";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  membre: "Coach",
  blocked: "Bloqué",
};

// ======================================================================
// Types métier — Coach Gandalf (entraînements de groupe)
// ======================================================================

export type WorkoutType = "hyrox" | "crossfit" | "hiit" | "endurance" | "force";
export type WorkoutFormat = "for_time" | "amrap" | "emom" | "circuit" | "tabata";
export type WorkoutNiveau = "debutant" | "intermediaire" | "avance";
export type TypeMesure = "distance" | "reps" | "temps" | "calories";
export type Unite = "m" | "reps" | "s" | "cal" | "lbs";

export interface CatalogueExercice {
  video_id: string;
  nom: string;
  equipement: string;
}

// Statut de génération de la vidéo d'un exercice
export type VideoStatus = "none" | "generating" | "ready" | "error";

/**
 * Exercice complet stocké dans Firestore (collection `exercices`).
 * Étend le catalogue de base avec la description pour Veo et l'état vidéo.
 */
export interface Exercice extends CatalogueExercice {
  description_prompt: string; // description de l'exercice injectée dans le prompt Veo
  video_url: string | null; // URL Storage de la vidéo (null tant que non générée)
  video_status: VideoStatus;
  video_gs_path: string | null; // chemin gs:// dans le bucket
  veo_operation: string | null; // nom de l'opération Veo en cours
  video_error: string | null; // dernier message d'erreur de génération
  video_source: string | null; // origine de la vidéo : "veo" | "exercisedb" | "upload"
  source_ref: string | null; // référence externe (ex. exerciseId ExerciseDB)
  created_at: number;
  updated_at: number;
}

export interface ProgrammeExercice {
  ordre: number;
  nom: string;
  video_id: string;
  video_url: string | null;
  type_mesure: TypeMesure;
  valeur: number;
  unite: Unite;
  charge_h: number | null;
  charge_f: number | null;
  duree_travail_s: number | null;
  duree_repos_s: number | null;
  consignes: string;
}

export interface Programme {
  id: string;
  nom: string;
  type: WorkoutType;
  competition: string | null;
  duree_min: number;
  format: WorkoutFormat;
  niveau: WorkoutNiveau;
  rounds: number;
  exercices: ProgrammeExercice[];
}

export interface GenerationParams {
  type: WorkoutType;
  competition?: string | null;
  duree_min: number;
  niveau: WorkoutNiveau;
  format: WorkoutFormat;
  participants?: number;
}
