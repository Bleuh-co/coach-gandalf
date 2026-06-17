import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { CATALOGUE, CATALOGUE_IDS } from "@/lib/catalogue";
import type { GenerationParams, Programme, ProgrammeExercice } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

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

function buildPrompt(p: GenerationParams): string {
  const cat = CATALOGUE.map((e) => `- ${e.nom} (video_id: "${e.video_id}", équipement: ${e.equipement})`).join("\n");
  return `Tu es un coach expert en entraînement fonctionnel (Hyrox, CrossFit, HIIT). Génère un programme d'entraînement de groupe.

PARAMÈTRES DEMANDÉS :
- Type : ${p.type}
- Compétition cible : ${p.competition || "aucune"}
- Durée totale : ${p.duree_min} minutes
- Niveau : ${p.niveau}
- Format : ${p.format}
- Nombre de participants : ${p.participants || "non précisé"}

CATALOGUE D'EXERCICES DISPONIBLES (tu DOIS choisir UNIQUEMENT parmi ces exercices, en utilisant leur video_id EXACT) :
${cat}

CONTRAINTES CRITIQUES :
1. Utilise UNIQUEMENT les exercices du catalogue ci-dessus avec leur video_id EXACT. N'invente JAMAIS un exercice ou un video_id.
2. Respecte le budget temps : la somme (travail + repos + transitions ~10s) × rounds doit ≈ ${p.duree_min} minutes (±10%).
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
function validateProgramme(raw: any, p: GenerationParams): Programme {
  const exercicesRaw = Array.isArray(raw?.exercices) ? raw.exercices : [];
  const exercices: ProgrammeExercice[] = exercicesRaw
    .filter((e: any) => e && CATALOGUE_IDS.has(e.video_id))
    .map((e: any, i: number) => {
      const cat = CATALOGUE.find((c) => c.video_id === e.video_id)!;
      return {
        ordre: typeof e.ordre === "number" ? e.ordre : i + 1,
        nom: cat.nom,
        video_id: e.video_id,
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

  return {
    id: typeof raw?.id === "string" ? raw.id : `seance-${Date.now()}`,
    nom: typeof raw?.nom === "string" ? raw.nom : "Séance générée",
    type: p.type,
    competition: p.competition || null,
    duree_min: p.duree_min,
    format: p.format,
    niveau: p.niveau,
    rounds: typeof raw?.rounds === "number" && raw.rounds > 0 ? raw.rounds : 1,
    exercices,
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000); // 50s max (Cloud Run limit: 60s)

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
        messages: [{ role: "user", content: buildPrompt(params) }],
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
    const programme = validateProgramme(parsed, params);
    return NextResponse.json({ programme });
  } catch (e: any) {
    console.error("[generer] failed", e);
    return NextResponse.json(
      { error: "Impossible de générer un programme valide. Réessayez." },
      { status: 500 }
    );
  }
}
