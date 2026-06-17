import type {
  ProgrammeModele,
  ExerciceModele,
  Programme,
  ProgrammeExercice,
  TypeMesure,
  Unite,
} from "./types";

/**
 * Compile un ProgrammeModele (éditeur) vers la forme runtime `Programme`
 * jouée par les tableaux de bord.
 *
 * - Solo : on aplatit blocs × rounds en une séquence d'exercices ; le repos
 *   inter-rounds est replié sur le dernier exercice de chaque round.
 * - Groupe : les exercices deviennent des stations à durée uniforme (rotation
 *   synchronisée), rounds = nombre de tours.
 */

function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "exo";
}

interface Mapped {
  type_mesure: TypeMesure;
  unite: Unite;
  valeur: number;
  duree_travail_s: number | null;
  manuel: boolean;
  consignePrefix: string;
}

function mapEffort(e: ExerciceModele): Mapped {
  switch (e.effort) {
    case "temps":
      return { type_mesure: "temps", unite: "s", valeur: e.valeur, duree_travail_s: e.valeur, manuel: false, consignePrefix: "" };
    case "amrap":
      return { type_mesure: "temps", unite: "s", valeur: e.valeur, duree_travail_s: e.valeur, manuel: false, consignePrefix: "AMRAP — max de répétitions/tours : " };
    case "distance":
      return { type_mesure: "distance", unite: "m", valeur: e.valeur, duree_travail_s: null, manuel: true, consignePrefix: "" };
    case "calories":
      return { type_mesure: "calories", unite: "cal", valeur: e.valeur, duree_travail_s: null, manuel: true, consignePrefix: "" };
    case "reps":
    default:
      return { type_mesure: "reps", unite: "reps", valeur: e.valeur, duree_travail_s: null, manuel: true, consignePrefix: "" };
  }
}

function videoIdFor(e: ExerciceModele, idx: number): string {
  // Catalogue → video_id réel (résolu en vidéo plus tard). Custom → id synthétique (pas de vidéo).
  return e.video_id || `custom_${slug(e.nom)}_${idx}`;
}

function toProgrammeExercice(e: ExerciceModele, ordre: number, reposExtra = 0): ProgrammeExercice {
  const m = mapEffort(e);
  return {
    ordre,
    nom: e.nom,
    video_id: videoIdFor(e, ordre),
    video_url: null,
    type_mesure: m.type_mesure,
    valeur: m.valeur,
    unite: m.unite,
    charge_h: e.charge_h,
    charge_f: e.charge_f,
    duree_travail_s: m.duree_travail_s,
    duree_repos_s: (e.repos_s || 0) + reposExtra,
    consignes: m.consignePrefix + (e.consignes || ""),
    manuel: m.manuel,
  };
}

function estimerDureeMin(exercices: ProgrammeExercice[]): number {
  const sec = exercices.reduce(
    (acc, e) => acc + (e.duree_travail_s || 40) + (e.duree_repos_s || 0) + 5,
    0
  );
  return Math.max(1, Math.round(sec / 60));
}

export function compileToProgramme(m: ProgrammeModele): Programme {
  const exercices: ProgrammeExercice[] = [];

  if (m.mode === "groupe") {
    // Stations à durée uniforme ; rounds = tours du premier bloc.
    const stations = m.blocs.flatMap((b) => b.exercices);
    const rounds = Math.max(1, m.blocs[0]?.rounds || 1);
    const travail = stations.find((s) => s.effort === "temps" && s.valeur > 0)?.valeur || 45;
    const repos = stations.find((s) => (s.repos_s || 0) > 0)?.repos_s || 15;
    stations.forEach((s, i) => {
      exercices.push({
        ordre: i + 1,
        nom: s.nom,
        video_id: videoIdFor(s, i + 1),
        video_url: null,
        type_mesure: "temps",
        valeur: travail,
        unite: "s",
        charge_h: s.charge_h,
        charge_f: s.charge_f,
        duree_travail_s: travail,
        duree_repos_s: repos,
        consignes: s.consignes || "",
        manuel: false,
      });
    });
    return {
      id: m.id,
      nom: m.nom,
      type: m.type,
      mode: "groupe",
      competition: null,
      duree_min: estimerDureeMin(exercices) * rounds,
      format: "circuit",
      niveau: m.niveau,
      rounds,
      exercices,
    };
  }

  // Solo : aplatir blocs × rounds.
  let ordre = 1;
  for (const bloc of m.blocs) {
    const rounds = Math.max(1, bloc.rounds);
    for (let r = 0; r < rounds; r++) {
      bloc.exercices.forEach((e, i) => {
        const dernierDuRound = i === bloc.exercices.length - 1;
        const reposExtra = dernierDuRound && r < rounds - 1 ? bloc.repos_entre_rounds_s || 0 : 0;
        exercices.push(toProgrammeExercice(e, ordre++, reposExtra));
      });
    }
  }

  return {
    id: m.id,
    nom: m.nom,
    type: m.type,
    mode: "solo",
    competition: null,
    duree_min: estimerDureeMin(exercices),
    format: "circuit",
    niveau: m.niveau,
    rounds: 1,
    exercices,
  };
}
