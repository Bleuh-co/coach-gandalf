import { redirect } from "next/navigation";
import { ProgrammeBuilder } from "@/components/builder/ProgrammeBuilder";
import { getProgramme } from "@/lib/programmes-server";
import { getSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function BuilderPage({ params }: { params: Promise<{ id?: string[] }> }) {
  // Builder (création/édition de programmes) = Administrateur+ (décision recette).
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "superadmin")) {
    redirect("/programmes");
  }
  const { id } = await params;
  const programmeId = id?.[0];
  const initial = programmeId ? await getProgramme(programmeId) : null;
  return <ProgrammeBuilder initial={initial} />;
}
