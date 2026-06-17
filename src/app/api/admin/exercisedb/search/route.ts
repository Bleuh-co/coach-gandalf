import { NextRequest, NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { searchExerciseDb } from "@/lib/exercisedb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q=... — recherche d'exercices candidats sur ExerciseDB. */
export async function GET(req: NextRequest) {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Paramètre q requis." }, { status: 400 });

  try {
    const results = await searchExerciseDb(q);
    return NextResponse.json({ results });
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "EXERCISEDB_API_KEY_MISSING") {
      return NextResponse.json({ error: "EXERCISEDB_API_KEY non configurée sur le serveur." }, { status: 503 });
    }
    console.error("[admin/exercisedb] search failed", e);
    return NextResponse.json({ error: "Recherche ExerciseDB impossible." }, { status: 502 });
  }
}
