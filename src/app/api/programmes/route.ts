import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { listProgrammes, createProgramme } from "@/lib/programmes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — liste des programmes partagés. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const programmes = await listProgrammes();
  return NextResponse.json({ programmes });
}

/** POST — crée un programme (auteur = session). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  if (!body?.nom?.trim()) return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });

  const programme = await createProgramme(body, {
    email: session.email,
    name: session.displayName,
  });
  return NextResponse.json({ programme }, { status: 201 });
}
