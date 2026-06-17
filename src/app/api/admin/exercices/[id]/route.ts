import { NextRequest, NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { getExercice, updateExercice, deleteExercice } from "@/lib/exercices-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — un exercice. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const { id } = await params;
  const exercice = await getExercice(id);
  if (!exercice) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ exercice });
}

/** PATCH — édite nom / equipement / description_prompt. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const { id } = await params;

  let body: { nom?: string; equipement?: string; description_prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const exercice = await updateExercice(id, body);
    return NextResponse.json({ exercice });
  } catch (e) {
    if ((e as Error)?.message === "NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/exercices] update failed", e);
    return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 });
  }
}

/** DELETE — supprime un exercice. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const { id } = await params;
  await deleteExercice(id);
  return NextResponse.json({ ok: true });
}
