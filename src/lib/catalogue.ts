import type { CatalogueExercice } from "./types";

/**
 * Catalogue d'exercices disponibles — chaque exercice possède un video_id
 * stable correspondant à un clip Veo pré-généré (boucle).
 *
 * ⚠️ Le LLM ne doit choisir QUE des exercices présents dans ce catalogue.
 * Pour ajouter un exercice : générer le clip Veo, le placer dans
 * public/videos/{video_id}.mp4, puis ajouter une entrée ici.
 */
export const CATALOGUE: CatalogueExercice[] = [
  { video_id: "skierg_loop", nom: "SkiErg", equipement: "skierg" },
  { video_id: "sled_push_loop", nom: "Sled Push", equipement: "sled" },
  { video_id: "sled_pull_loop", nom: "Sled Pull", equipement: "sled" },
  { video_id: "burpee_bj_loop", nom: "Burpee Broad Jump", equipement: "aucun" },
  { video_id: "rameur_loop", nom: "Rameur", equipement: "rameur" },
  { video_id: "lunges_sac_loop", nom: "Lunges avec sac", equipement: "sandbag" },
  { video_id: "wall_ball_loop", nom: "Wall Ball", equipement: "medecine_ball" },
  { video_id: "kb_swing_loop", nom: "Kettlebell Swing", equipement: "kettlebell" },
  { video_id: "box_jump_loop", nom: "Box Jump", equipement: "box" },
  { video_id: "thruster_loop", nom: "Thruster", equipement: "barbell" },
  { video_id: "double_under_loop", nom: "Double Under", equipement: "corde" },
  { video_id: "farmers_carry_loop", nom: "Farmer's Carry", equipement: "dumbbell" },
  { video_id: "air_squat_loop", nom: "Air Squat", equipement: "aucun" },
  { video_id: "push_up_loop", nom: "Push-Up", equipement: "aucun" },
  { video_id: "mountain_climber_loop", nom: "Mountain Climber", equipement: "aucun" },
];

export const CATALOGUE_IDS = new Set(CATALOGUE.map((e) => e.video_id));

export function isValidVideoId(id: string): boolean {
  return CATALOGUE_IDS.has(id);
}

/** Retourne le chemin vidéo pour un video_id, ou null si invalide. */
export function videoPath(videoId: string): string | null {
  if (!isValidVideoId(videoId)) return null;
  return `/videos/${videoId}.mp4`;
}
