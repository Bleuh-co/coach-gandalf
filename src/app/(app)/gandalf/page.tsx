"use client";

import { useState } from "react";
import { NavBar } from "@/components/NavBar";
import { EcranSelection } from "@/components/EcranSelection";
import { TableauBord } from "@/components/TableauBord";
import type { GenerationParams, Programme } from "@/lib/types";

type Etape = "selection" | "execution";

export default function GandalfPage() {
  const [etape, setEtape] = useState<Etape>("selection");
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generer = async (params: GenerationParams) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la génération.");
        return;
      }
      setProgramme(data.programme);
      setEtape("execution");
    } catch {
      setError("Impossible de joindre le serveur de génération.");
    } finally {
      setLoading(false);
    }
  };

  const quitter = () => {
    setProgramme(null);
    setEtape("selection");
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {etape === "selection" || !programme ? (
          <EcranSelection onGenerer={generer} loading={loading} error={error} />
        ) : (
          <TableauBord programme={programme} onQuitter={quitter} />
        )}
      </main>
    </div>
  );
}
