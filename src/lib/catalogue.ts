import type { CatalogueExercice } from "./types";

/**
 * Données de SEED du catalogue d'exercices.
 *
 * ⚠️ La source de vérité en production est désormais la collection Firestore
 * `exercices` (voir src/lib/exercices-server.ts). Ce fichier sert :
 *   1. au seeding initial (POST /api/admin/seed) ;
 *   2. de fallback si Firestore est indisponible.
 *
 * Chaque entrée possède un `video_id` stable et une `description_prompt`
 * injectée dans le prompt Veo pour générer un clip cohérent.
 */
export interface SeedExercice extends CatalogueExercice {
  description_prompt: string;
}

/**
 * Template de style PAR DÉFAUT partagé par toutes les vidéos.
 * Stocké dans Firestore (config/video_style) et éditable depuis /admin.
 * On y injecte ensuite la `description_prompt` propre à chaque exercice
 * afin de garantir un rendu visuel homogène d'un clip à l'autre.
 */
export const DEFAULT_STYLE_TEMPLATE = `Vidéo de démonstration d'un exercice de fitness, en boucle parfaite (seamless loop), durée courte.
Un seul athlète athlétique, tenue de sport neutre, exécutant le mouvement avec une technique impeccable.
Studio épuré, fond uni gris clair, éclairage doux et homogène, caméra fixe à hauteur de poitrine, plan large montrant tout le corps.
Style réaliste, cohérent, sans texte ni logo, sans transition. Mouvement répété de façon régulière et propre.`;

export const CATALOGUE_SEED: SeedExercice[] = [
  { video_id: "skierg_loop", nom: "SkiErg", equipement: "skierg", description_prompt: "Athlète sur un SkiErg, debout, tirant les deux poignées du haut vers le bas le long du corps en pliant légèrement les hanches, mouvement de ski de fond." },
  { video_id: "sled_push_loop", nom: "Sled Push", equipement: "sled", description_prompt: "Athlète poussant un traîneau lesté (sled) devant lui, corps incliné vers l'avant, bras tendus sur les poignées, progression au sol." },
  { video_id: "sled_pull_loop", nom: "Sled Pull", equipement: "sled", description_prompt: "Athlète tirant un traîneau lesté (sled) à l'aide d'une corde, en reculant, dos droit, bras qui tirent la corde vers le corps." },
  { video_id: "burpee_bj_loop", nom: "Burpee Broad Jump", equipement: "aucun", description_prompt: "Athlète enchaînant un burpee complet (planche, pompe) puis un saut horizontal vers l'avant (broad jump), au poids du corps." },
  { video_id: "rameur_loop", nom: "Rameur", equipement: "rameur", description_prompt: "Athlète sur un rameur (rowing machine), enchaînant la phase de poussée des jambes puis la traction de la poignée vers le sternum." },
  { video_id: "lunges_sac_loop", nom: "Lunges avec sac", equipement: "sandbag", description_prompt: "Athlète réalisant des fentes marchées (walking lunges) avec un sac lesté (sandbag) sur les épaules, dos droit." },
  { video_id: "wall_ball_loop", nom: "Wall Ball", equipement: "medecine_ball", description_prompt: "Athlète tenant une medecine ball, descendant en squat puis lançant la balle vers une cible haute sur un mur, et la rattrapant." },
  { video_id: "kb_swing_loop", nom: "Kettlebell Swing", equipement: "kettlebell", description_prompt: "Athlète réalisant un kettlebell swing : balancier de la kettlebell entre les jambes puis jusqu'à hauteur des épaules par extension des hanches." },
  { video_id: "box_jump_loop", nom: "Box Jump", equipement: "box", description_prompt: "Athlète sautant à deux pieds sur une box (plyo box), réception en flexion puis redescente contrôlée." },
  { video_id: "thruster_loop", nom: "Thruster", equipement: "barbell", description_prompt: "Athlète enchaînant un front squat avec une barre puis un push press au-dessus de la tête, en un seul mouvement fluide." },
  { video_id: "double_under_loop", nom: "Double Under", equipement: "corde", description_prompt: "Athlète sautant à la corde en double under : la corde passe deux fois sous les pieds à chaque saut, rythme rapide." },
  { video_id: "farmers_carry_loop", nom: "Farmer's Carry", equipement: "dumbbell", description_prompt: "Athlète marchant en portant un haltère lourd dans chaque main le long du corps, posture droite et gainée (farmer's carry)." },
  { video_id: "air_squat_loop", nom: "Air Squat", equipement: "aucun", description_prompt: "Athlète réalisant des air squats au poids du corps, descente hanches sous les genoux, bras tendus vers l'avant pour l'équilibre." },
  { video_id: "push_up_loop", nom: "Push-Up", equipement: "aucun", description_prompt: "Athlète réalisant des pompes (push-ups) au sol, corps gainé et aligné, descente de la poitrine près du sol puis poussée." },
  { video_id: "mountain_climber_loop", nom: "Mountain Climber", equipement: "aucun", description_prompt: "Athlète en position de planche ramenant alternativement les genoux vers la poitrine à rythme soutenu (mountain climbers)." },
];

/** Catalogue minimal (fallback) — sans les champs de génération vidéo. */
export const CATALOGUE: CatalogueExercice[] = CATALOGUE_SEED.map(
  ({ video_id, nom, equipement }) => ({ video_id, nom, equipement })
);

export const CATALOGUE_IDS = new Set(CATALOGUE.map((e) => e.video_id));

export function isValidVideoId(id: string): boolean {
  return CATALOGUE_IDS.has(id);
}
