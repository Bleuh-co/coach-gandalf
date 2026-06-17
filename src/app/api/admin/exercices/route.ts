import { NextRequest, NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { getCatalogue, createExercice } from "@/lib/exercices-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — liste complète du catalogue. */
export async function GET() {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const exercices = await getCatalogue();
  return NextResponse.json({ exercices });
}

/** POST — crée un exercice. Body : { nom, equipement?, description_prompt?, video_id? } */
export async function POST(req: NextRequest) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;

  let body: { nom?: string; equipement?: string; description_prompt?: string; video_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (!body?.nom?.trim()) {
    return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });
  }

  try {
    const exercice = await createExercice({
      nom: body.nom!,
      equipement: body.equipement,
      description_prompt: body.description_prompt,
      video_id: body.video_id,
    });
    return NextResponse.json({ exercice }, { status: 201 });
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "ALREADY_EXISTS") {
      return NextResponse.json({ error: "Un exercice avec cet identifiant existe déjà." }, { status: 409 });
    }
    if (msg === "INVALID_ID") {
      return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    console.error("[admin/exercices] create failed", e);
    return NextResponse.json({ error: "Création impossible." }, { status: 500 });
  }
}
