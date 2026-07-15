import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import GandalfClient from "./GandalfClient";

// Séance IA (génération de programme via LLM) = builder = Administrateur+
// (décision recette). Les Coachs (Consulter/Gestionnaire) lancent les
// programmes existants via /programmes ; s'ils tentent l'URL directe ici, ils
// sont redirigés vers la bibliothèque. Les routes /api/generer sont déjà gardées.
export default async function GandalfPage() {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "superadmin")) {
    redirect("/programmes");
  }
  return <GandalfClient />;
}
