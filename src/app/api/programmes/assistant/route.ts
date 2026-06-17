import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getCatalogue } from "@/lib/exercices-server";
import { COACHING_PRINCIPLES } from "@/lib/coaching";
import type { Exercice } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const FUNCTIONAL = new Set([
  "body weight", "bodyweight", "aucun", "kettlebell", "dumbbell", "barbell", "olympic barbell",
  "ez barbell", "trap bar", "medicine ball", "power sled", "sled machine", "battling rope", "rope",
  "resistance band", "band", "suspension", "box",
]);

function stripFences(t: string): string {
  let s = t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return s.trim();
}

/** POST — produit un BROUILLON de programme (ProgrammeModele non sauvegardé) via l'IA. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurée." }, { status: 503 });

  let p: { type?: string; mode?: string; niveau?: string; duree_min?: number; objectif?: string };
  try { p = await req.json(); } catch { return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 }); }

  const type = p.type || "crossfit";
  const mode = p.mode === "groupe" ? "groupe" : "solo";
  const niveau = p.niveau || "intermediaire";
  const duree = p.duree_min || 45;

  const catalogue = (await getCatalogue()).filter((e) => e.source_ref);
  const pool = catalogue.filter((e) => FUNCTIONAL.has((e.equipement || "").toLowerCase())).slice(0, 90);
  const byId = new Map(catalogue.map((c) => [c.video_id, c]));
  const catList = (pool.length >= 10 ? pool : catalogue.slice(0, 90))
    .map((e) => `- ${e.nom} (video_id: "${e.video_id}", équipement: ${e.equipement})`).join("\n");

  const prompt = `Tu es un coach expert. Conçois un BROUILLON de programme structuré.

${COACHING_PRINCIPLES}

PARAMÈTRES : type=${type} ; mode=${mode} ; niveau=${niveau} ; durée≈${duree} min ; objectif=${p.objectif || "—"}.

CATALOGUE (utilise UNIQUEMENT ces video_id exacts) :
${catList}

Réponds UNIQUEMENT en JSON :
{
  "nom": "string accrocheur",
  "description": "1-2 phrases sur l'intention et la logique scientifique",
  "blocs": [
    {
      "nom": "string",
      "rounds": number,
      "repos_entre_rounds_s": number,
      "exercices": [
        { "nom": "doit correspondre au catalogue", "video_id": "video_id EXACT", "effort": "reps|amrap|temps|distance|calories", "valeur": number, "charge_h": number|null, "charge_f": number|null, "repos_s": number, "consignes": "courte" }
      ]
    }
  ]
}
Contraintes : ${mode === "groupe" ? "mode groupe → UN bloc de stations, effort='temps' identique pour toutes, rounds=tours." : "2 à 4 blocs cohérents (échauffement léger → travail principal → finisher)."} Budget temps ≈ ${duree} min. Pas de markdown.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("[assistant] anthropic", res.status, await res.text());
      return NextResponse.json({ error: "Service IA indisponible." }, { status: 502 });
    }
    const data = await res.json();
    const raw = JSON.parse(stripFences(data?.content?.[0]?.text || "{}"));

    const efforts = ["reps", "amrap", "temps", "distance", "calories"];
    const blocs = (Array.isArray(raw?.blocs) ? raw.blocs : []).map((b: any) => ({
      nom: typeof b?.nom === "string" ? b.nom : "Bloc",
      rounds: Math.max(1, typeof b?.rounds === "number" ? b.rounds : 1),
      repos_entre_rounds_s: typeof b?.repos_entre_rounds_s === "number" ? b.repos_entre_rounds_s : 60,
      exercices: (Array.isArray(b?.exercices) ? b.exercices : [])
        .map((e: any) => {
          const cat: Exercice | undefined = byId.get(e?.video_id);
          return {
            nom: cat?.nom || (typeof e?.nom === "string" ? e.nom : "Exercice"),
            video_id: cat ? cat.video_id : null,
            effort: efforts.includes(e?.effort) ? e.effort : "reps",
            valeur: typeof e?.valeur === "number" ? e.valeur : 10,
            charge_h: typeof e?.charge_h === "number" ? e.charge_h : null,
            charge_f: typeof e?.charge_f === "number" ? e.charge_f : null,
            repos_s: typeof e?.repos_s === "number" ? e.repos_s : 30,
            consignes: typeof e?.consignes === "string" ? e.consignes : "",
          };
        }),
    })).filter((b: any) => b.exercices.length > 0);

    if (blocs.length === 0) return NextResponse.json({ error: "Brouillon vide, réessaie." }, { status: 502 });

    return NextResponse.json({
      draft: {
        nom: typeof raw?.nom === "string" ? raw.nom : "Programme IA",
        description: typeof raw?.description === "string" ? raw.description : "",
        type, mode, niveau, blocs,
      },
    });
  } catch (e) {
    console.error("[assistant] failed", e);
    return NextResponse.json({ error: "Génération du brouillon impossible." }, { status: 500 });
  }
}
