import { NextRequest, NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { getStyleTemplate, setStyleTemplate } from "@/lib/exercices-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — template de style partagé. */
export async function GET() {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;
  const style_template = await getStyleTemplate();
  return NextResponse.json({ style_template });
}

/** PUT — met à jour le template de style partagé. */
export async function PUT(req: NextRequest) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;

  let body: { style_template?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (typeof body?.style_template !== "string" || !body.style_template.trim()) {
    return NextResponse.json({ error: "Le template de style ne peut pas être vide." }, { status: 400 });
  }

  await setStyleTemplate(body.style_template);
  return NextResponse.json({ ok: true, style_template: body.style_template });
}
