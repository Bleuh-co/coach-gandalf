"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Play, Pencil, Trash2, Users, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { TableauBord } from "@/components/TableauBord";
import { TableauBordGroupe } from "@/components/TableauBordGroupe";
import type { ProgrammeModele, Programme } from "@/lib/types";

export default function ProgrammesPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [list, setList] = useState<ProgrammeModele[]>([]);
  const [loading, setLoading] = useState(true);
  const [programme, setProgramme] = useState<Programme | null>(null);
  const [preparing, setPreparing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/programmes", { cache: "no-store" });
      if (res.ok) setList((await res.json()).programmes || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lancer = useCallback(async (id: string) => {
    setPreparing(id);
    try {
      const res = await fetch(`/api/programmes/${id}/preparer`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Préparation impossible."); return; }
      setProgramme(data.programme);
    } finally {
      setPreparing(null);
    }
  }, []);

  const supprimer = useCallback(async (id: string, nom: string) => {
    if (!confirm(`Supprimer « ${nom} » ?`)) return;
    const res = await fetch(`/api/programmes/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Suppression impossible (réservée à l'auteur)."); return; }
    toast.success("Programme supprimé.");
    setList((l) => l.filter((p) => p.id !== id));
  }, []);

  // Exécution d'un programme lancé
  if (programme) {
    const Quitter = () => setProgramme(null);
    return programme.mode === "groupe"
      ? <TableauBordGroupe programme={programme} onQuitter={Quitter} />
      : <TableauBord programme={programme} onQuitter={Quitter} />;
  }

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-chanv-terre uppercase tracking-tight">Programmes</h2>
          <p className="text-sm text-chanv-terre/60 uppercase tracking-widest">Bibliothèque partagée</p>
        </div>
        <button className="btn-primary" onClick={() => router.push("/programmes/builder")}>
          <Plus className="inline mr-2" size={18} /> Nouveau programme
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-chanv-terre/60"><Loader2 className="animate-spin mr-2" /> Chargement…</div>
      ) : list.length === 0 ? (
        <div className="section-card text-chanv-terre/60">Aucun programme. Crée le premier !</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => {
            const mien = session?.email === p.author_email;
            const nbExos = p.blocs.reduce((acc, b) => acc + b.exercices.length, 0);
            return (
              <div key={p.id} className="card p-5 flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {p.mode === "groupe" ? <Users size={16} className="text-chanv-terre/60" /> : <User size={16} className="text-chanv-terre/60" />}
                    <h3 className="text-lg font-black text-chanv-terre leading-tight">{p.nom}</h3>
                  </div>
                  <p className="text-xs text-chanv-terre/60 uppercase tracking-widest mt-1">
                    {p.type} · {p.niveau} · {p.blocs.length} bloc(s) · {nbExos} exo(s)
                  </p>
                  {p.description && <p className="text-sm text-chanv-terre/70 mt-2 line-clamp-2">{p.description}</p>}
                  <p className="text-[11px] text-chanv-terre/40 mt-2">par {p.author_name || p.author_email}</p>
                </div>
                <div className="flex gap-2 mt-auto flex-wrap">
                  <button className="btn-primary !py-2 !px-4 !text-sm" onClick={() => lancer(p.id)} disabled={preparing === p.id}>
                    {preparing === p.id ? <Loader2 className="inline mr-1 animate-spin" size={16} /> : <Play className="inline mr-1" size={16} />}
                    Lancer
                  </button>
                  {mien && (
                    <>
                      <button className="btn-secondary !py-2 !px-3 !text-sm" onClick={() => router.push(`/programmes/builder/${p.id}`)}>
                        <Pencil className="inline" size={16} />
                      </button>
                      <button className="badge-neutral !bg-red-50 !text-red-700 !px-3 !py-2" onClick={() => supprimer(p.id, p.nom)}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
