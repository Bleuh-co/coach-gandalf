import { NextResponse } from "next/server";
import { guardSuperadmin } from "@/lib/api-admin";
import { seedCatalogue } from "@/lib/exercices-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — importe les exercices de seed manquants dans Firestore. */
export async function POST() {
  const guard = await guardSuperadmin();
  if (guard.error) return guard.error;

  try {
    const created = await seedCatalogue();
    return NextResponse.json({ ok: true, created, count: created.length });
  } catch (e) {
    console.error("[admin/seed] failed", e);
    return NextResponse.json({ error: "Seeding impossible." }, { status: 500 });
  }
}
