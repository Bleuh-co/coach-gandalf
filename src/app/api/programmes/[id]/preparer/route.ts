import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getProgramme } from "@/lib/programmes-server";
import { compileToProgramme } from "@/lib/programme-compile";
import { getCatalogue } from "@/lib/exercices-server";
import { hostMissingVideos } from "@/lib/video-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** POST — compile le programme et héberge les vidéos → Programme runtime jouable. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;

  const modele = await getProgramme(id);
  if (!modele) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const programme = compileToProgramme(modele);
  try {
    const catalogue = await getCatalogue();
    await hostMissingVideos(programme, catalogue);
  } catch (e) {
    console.warn("[programmes/preparer] host videos failed (fallback emoji)", (e as Error)?.message);
  }
  return NextResponse.json({ programme });
}
