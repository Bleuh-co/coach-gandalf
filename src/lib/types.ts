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

export interface ProgrammeExercice {
  ordre: number;
  nom: string;
  video_id: string;
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
