import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getProgramme, updateProgramme, deleteProgramme } from "@/lib/programmes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const programme = await getProgramme(id);
  if (!programme) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ programme });
}

/** PATCH — édition (auteur uniquement). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const programme = await updateProgramme(id, body, session.email);
    return NextResponse.json({ programme });
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Seul l'auteur peut modifier ce programme." }, { status: 403 });
    console.error("[programmes] update failed", e);
    return NextResponse.json({ error: "Mise à jour impossible." }, { status: 500 });
  }
}

/** DELETE — suppression (auteur uniquement). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  try {
    await deleteProgramme(id, session.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as Error)?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Seul l'auteur peut supprimer ce programme." }, { status: 403 });
    }
    return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
  }
}
