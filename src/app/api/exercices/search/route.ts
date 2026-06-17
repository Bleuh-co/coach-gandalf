import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getCatalogue } from "@/lib/exercices-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q= — recherche dans le catalogue Firestore (pour le sélecteur du builder). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const catalogue = await getCatalogue();
  const matched = (q ? catalogue.filter((e) => e.nom.toLowerCase().includes(q)) : catalogue).slice(0, 40);
  return NextResponse.json({
    results: matched.map((e) => ({
      video_id: e.video_id,
      nom: e.nom,
      equipement: e.equipement,
      image: e.edb_image_url,
    })),
  });
}
