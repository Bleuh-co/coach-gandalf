import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getCatalogue, setVideoState, importFromExerciseDb } from "@/lib/exercices-server";
import { importExerciseDbVideo, getExerciseDbVideoUrl, fetchAllExerciseDb } from "@/lib/exercisedb";
import type { Exercice, GenerationParams, Programme, ProgrammeExercice } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

// Équipement « fonctionnel » pertinent pour Hyrox / CrossFit / HIIT / force.
// Sert à réduire le catalogue (potentiellement 1000+ exercices) à un sous-ensemble
// raisonnable injecté dans le prompt.
const FUNCTIONAL_EQUIPMENT = new Set([
  "body weight", "bodyweight", "aucun", "kettlebell", "dumbbell", "barbell",
  "olympic barbell", "ez barbell", "trap bar", "medicine ball", "medecine_ball",
  "power sled", "sled machine", "sled", "sandbag", "battling rope", "rope", "corde",
  "resistance band", "band", "suspension", "box", "weighted", "skierg", "rameur",
]);
const PROMPT_CATALOGUE_CAP = 90;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Restreint le catalogue aux exercices fonctionnels, mélange pour varier les
 * séances, puis plafonne pour garder le prompt maîtrisé.
 */
function catalogueForPrompt(catalogue: Exercice[]): Exercice[] {
  const fonctionnels = catalogue.filter((e) =>
    FUNCTIONAL_EQUIPMENT.has((e.equipement || "").toLowerCase())
  );
  const base = fonctionnels.length >= 10 ? fonctionnels : catalogue;
  return shuffle(base).slice(0, PROMPT_CATALOGUE_CAP);
}

/**
 * Catalogue de génération = exercices ExerciseDB uniquement (avec source_ref).
 * Si vide, import automatique depuis ExerciseDB (une fois ; ensuite servi
 * depuis Firestore). Le seed historique est volontairement exclu.
 */
async function getEdbCatalogue(): Promise<Exercice[]> {
  let edb = (await getCatalogue()).filter((e) => e.source_ref);
  if (edb.length < 30) {
    const items = await fetchAllExerciseDb();
    await importFromExerciseDb(
      items.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.name,
        equipments: e.equipments,
        imageUrl: e.imageUrl,
      }))
    );
    edb = (await getCatalogue()).filter((e) => e.source_ref);
  }
  return edb;
}

/**
 * Ré-héberge à la demande les vidéos des exercices sélectionnés qui n'en ont pas
 * encore (catalogue ExerciseDB importé en métadonnées). Met en cache dans Firestore.
 * Repli sur l'URL CDN ExerciseDB si le ré-hébergement échoue.
 */
async function hostMissingVideos(programme: Programme, catalogue: Exercice[]): Promise<void> {
  const byId = new Map(catalogue.map((c) => [c.video_id, c]));
  await Promise.all(
    programme.exercices.map(async (ex) => {
      if (ex.video_url) return;
      const cat = byId.get(ex.video_id);
      if (cat?.video_url) {
        ex.video_url = cat.video_url;
        return;
      }
      if (!cat?.source_ref) return;
      try {
        const { videoUrl, gsPath } = await importExerciseDbVideo(ex.video_id, cat.source_ref);
        await setVideoState(ex.video_id, {
          video_status: "ready",
          video_url: videoUrl,
          video_gs_path: gsPath,
          video_source: "exercisedb",
          source_ref: cat.source_ref,
          video_error: null,
        });
        ex.video_url = videoUrl;
      } catch (e) {
        console.warn("[generer] host video failed, fallback CDN", ex.video_id, (e as Error)?.message);
        try {
          ex.video_url = await getExerciseDbVideoUrl(cat.source_ref);
        } catch {
          /* laissera le fallback emoji côté UI */
        }
      }
    })
  );
}

/** Retire d'éventuelles balises markdown ```json autour du JSON. */
function stripFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "");
  t = t.replace(/\s*```$/i, "");
  // Extraire le premier objet { ... } équilibré si du texte parasite subsiste
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t.trim();
}

function buildPrompt(p: GenerationParams, catalogue: Exercice[]): string {
  const cat = catalogue.map((e) => `- ${e.nom} (video_id: "${e.video_id}", équipement: ${e.equipement})`).join("\n");
  const groupe = p.mode === "groupe";
  const n = Math.min(12, Math.max(4, p.stations || 8));

  const contrainteStructure = groupe
    ? `2. MODE GROUPE — CIRCUIT À STATIONS : génère EXACTEMENT ${n} exercices (= ${n} stations). Les participants tournent d'une station à l'autre en même temps, donc TOUTES les stations DOIVENT avoir la MÊME "duree_travail_s" (ex. 45) et le MÊME "duree_repos_s" (transition, ex. 15). "type_mesure" = "temps" pour chaque station. "rounds" = nombre de tours complets du circuit. Budget temps : ${n} × (duree_travail_s + duree_repos_s) × rounds ≈ ${p.duree_min} minutes (±10%).`
    : `2. Respecte le budget temps : la somme (travail + repos + transitions ~10s) × rounds doit ≈ ${p.duree_min} minutes (±10%).`;

  return `Tu es un coach expert en entraînement fonctionnel (Hyrox, CrossFit, HIIT). Génère un programme d'entraînement.

PARAMÈTRES DEMANDÉS :
- Type : ${p.type}
- Mode : ${groupe ? `groupe (circuit de ${n} stations, rotation synchronisée)` : "solo (séquentiel)"}
- Compétition cible : ${p.competition || "aucune"}
- Durée totale : ${p.duree_min} minutes
- Niveau : ${p.niveau}
- Format : ${p.format}
- Nombre de participants : ${p.participants || "non précisé"}

CATALOGUE D'EXERCICES DISPONIBLES (tu DOIS choisir UNIQUEMENT parmi ces exercices, en utilisant leur video_id EXACT) :
${cat}

CONTRAINTES CRITIQUES :
1. Utilise UNIQUEMENT les exercices du catalogue ci-dessus avec leur video_id EXACT. N'invente JAMAIS un exercice ou un video_id.
${contrainteStructure}
3. Adapte les charges (charge_h pour hommes, charge_f pour femmes, en lbs) au niveau "${p.niveau}". Mets null si l'exercice ne nécessite pas de charge.
4. Réponds UNIQUEMENT avec un objet JSON valide conforme au schéma. AUCUN texte, AUCUN markdown, AUCUNE explication.

SCHÉMA JSON ATTENDU :
{
  "id": "string (slug court)",
  "nom": "string (nom accrocheur de la séance)",
  "type": "${p.type}",
  "competition": ${p.competition ? `"${p.competition}"` : "null"},
  "duree_min": ${p.duree_min},
  "format": "${p.format}",
  "niveau": "${p.niveau}",
  "rounds": number,
  "exercices": [
    {
      "ordre": 1,
      "nom": "string (doit correspondre à un nom du catalogue)",
      "video_id": "string (video_id EXACT du catalogue)",
      "type_mesure": "distance | reps | temps | calories",
      "valeur": number,
      "unite": "m | reps | s | cal | lbs",
      "charge_h": number | null,
      "charge_f": number | null,
      "duree_travail_s": number | null,
      "duree_repos_s": number | null,
      "consignes": "string (consigne courte d'exécution)"
    }
  ]
}`;
}

/** Validation défensive + nettoyage : ne garde que les exercices du catalogue. */
function validateProgramme(raw: any, p: GenerationParams, catalogue: Exercice[]): Programme {
  const byId = new Map(catalogue.map((c) => [c.video_id, c]));
  const exercicesRaw = Array.isArray(raw?.exercices) ? raw.exercices : [];
  const exercices: ProgrammeExercice[] = exercicesRaw
    .filter((e: any) => e && byId.has(e.video_id))
    .map((e: any, i: number) => {
      const cat = byId.get(e.video_id)!;
      return {
        ordre: typeof e.ordre === "number" ? e.ordre : i + 1,
        nom: cat.nom,
        video_id: e.video_id,
        video_url: cat.video_url,
        type_mesure: ["distance", "reps", "temps", "calories"].includes(e.type_mesure) ? e.type_mesure : "reps",
        valeur: typeof e.valeur === "number" ? e.valeur : 0,
        unite: ["m", "reps", "s", "cal", "lbs"].includes(e.unite) ? e.unite : "reps",
        charge_h: typeof e.charge_h === "number" ? e.charge_h : null,
        charge_f: typeof e.charge_f === "number" ? e.charge_f : null,
        duree_travail_s: typeof e.duree_travail_s === "number" ? e.duree_travail_s : null,
        duree_repos_s: typeof e.duree_repos_s === "number" ? e.duree_repos_s : null,
        consignes: typeof e.consignes === "string" ? e.consignes : "",
      };
    })
    .sort((a: ProgrammeExercice, b: ProgrammeExercice) => a.ordre - b.ordre)
    .map((e: ProgrammeExercice, i: number) => ({ ...e, ordre: i + 1 }));

  if (exercices.length === 0) {
    throw new Error("Aucun exercice valide généré (hors catalogue).");
  }

  let finalExercices = exercices;

  // Mode groupe : garantir EXACTEMENT N stations + durée de travail/repos uniforme.
  if (p.mode === "groupe") {
    const n = Math.min(12, Math.max(4, p.stations || 8));

    if (finalExercices.length > n) {
      finalExercices = finalExercices.slice(0, n);
    } else if (finalExercices.length < n) {
      // Complète avec des exercices du catalogue non déjà utilisés.
      const used = new Set(finalExercices.map((e) => e.video_id));
      for (const cat of catalogue) {
        if (finalExercices.length >= n) break;
        if (used.has(cat.video_id)) continue;
        used.add(cat.video_id);
        finalExercices.push({
          ordre: finalExercices.length + 1,
          nom: cat.nom,
          video_id: cat.video_id,
          video_url: cat.video_url,
          type_mesure: "temps",
          valeur: 0,
          unite: "s",
          charge_h: null,
          charge_f: null,
          duree_travail_s: null,
          duree_repos_s: null,
          consignes: "",
        });
      }
    }

    // Durée uniforme (rotation synchrone) : 1re valeur valide, sinon défauts.
    const travail = finalExercices.find((e) => e.duree_travail_s && e.duree_travail_s > 0)?.duree_travail_s || 45;
    const repos = finalExercices.find((e) => e.duree_repos_s && e.duree_repos_s > 0)?.duree_repos_s || 15;
    finalExercices = finalExercices.map((e, i) => ({
      ...e,
      ordre: i + 1,
      type_mesure: "temps",
      valeur: travail,
      unite: "s",
      duree_travail_s: travail,
      duree_repos_s: repos,
    }));
  }

  return {
    id: typeof raw?.id === "string" ? raw.id : `seance-${Date.now()}`,
    nom: typeof raw?.nom === "string" ? raw.nom : "Séance générée",
    type: p.type,
    mode: p.mode,
    competition: p.competition || null,
    duree_min: p.duree_min,
    format: p.format,
    niveau: p.niveau,
    rounds: typeof raw?.rounds === "number" && raw.rounds > 0 ? raw.rounds : 1,
    exercices: finalExercices,
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let params: GenerationParams;
  try {
    params = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  if (!params?.type || !params?.duree_min) {
    return NextResponse.json({ error: "Paramètres type et duree_min requis" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée sur le serveur." },
      { status: 503 }
    );
  }

  let catalogue: Exercice[];
  try {
    catalogue = await getEdbCatalogue();
  } catch (e) {
    console.error("[generer] EDB catalogue indisponible", e);
    return NextResponse.json(
      { error: "Catalogue ExerciseDB indisponible. Vérifie EXERCISEDB_API_KEY." },
      { status: 503 }
    );
  }
  if (catalogue.length === 0) {
    return NextResponse.json(
      { error: "Aucun exercice ExerciseDB disponible." },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000); // 40s : laisse ~20s pour l'hébergement des vidéos (limite Cloud Run ~60s)

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: buildPrompt(params, catalogueForPrompt(catalogue)) }],
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const txt = await res.text();
      console.error("[generer] Anthropic error", res.status, txt);
      return NextResponse.json({ error: "Erreur du service de génération IA." }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    const parsed = JSON.parse(stripFences(text));
    const programme = validateProgramme(parsed, params, catalogue);
    await hostMissingVideos(programme, catalogue);
    return NextResponse.json({ programme });
  } catch (e: any) {
    console.error("[generer] failed", e);
    return NextResponse.json(
      { error: "Impossible de générer un programme valide. Réessayez." },
      { status: 500 }
    );
  }
}
