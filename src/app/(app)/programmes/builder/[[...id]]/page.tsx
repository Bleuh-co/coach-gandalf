import { ProgrammeBuilder } from "@/components/builder/ProgrammeBuilder";
import { getProgramme } from "@/lib/programmes-server";

export const dynamic = "force-dynamic";

export default async function BuilderPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const { id } = await params;
  const programmeId = id?.[0];
  const initial = programmeId ? await getProgramme(programmeId) : null;
  return <ProgrammeBuilder initial={initial} />;
}
