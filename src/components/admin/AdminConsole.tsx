"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Video, Save, Sparkles, Download, Search } from "lucide-react";
import type { Exercice, VideoStatus } from "@/lib/types";

const STATUS_LABEL: Record<VideoStatus, string> = {
  none: "Aucune vidéo",
  generating: "Génération en cours…",
  ready: "Vidéo prête",
  error: "Erreur",
};

const STATUS_CLASS: Record<VideoStatus, string> = {
  none: "badge-neutral",
  generating: "badge-neutral",
  ready: "badge-accent",
  error: "badge-neutral !bg-red-100 !text-red-700",
};

const POLL_INTERVAL_MS = 10_000;

interface EdbCandidate {
  exerciseId: string;
  name: string;
  imageUrl: string | null;
}

export function AdminConsole() {
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [style, setStyle] = useState("");
  const [styleDirty, setStyleDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingStyle, setSavingStyle] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const pollers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // --- Chargement initial -------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exRes, stRes] = await Promise.all([
        fetch("/api/admin/exercices", { cache: "no-store" }),
        fetch("/api/admin/style", { cache: "no-store" }),
      ]);
      if (exRes.ok) setExercices((await exRes.json()).exercices || []);
      if (stRes.ok) setStyle((await stRes.json()).style_template || "");
    } catch {
      toast.error("Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- Mise à jour locale d'un exercice ----------------------------------
  const patchLocal = useCallback((id: string, patch: Partial<Exercice>) => {
    setExercices((list) => list.map((e) => (e.video_id === id ? { ...e, ...patch } : e)));
  }, []);

  // --- Sondage de la génération vidéo ------------------------------------
  const stopPolling = useCallback((id: string) => {
    const t = pollers.current[id];
    if (t) {
      clearInterval(t);
      delete pollers.current[id];
    }
  }, []);

  const pollOnce = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/exercices/${id}/video`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (data.status && data.status !== "generating") {
          patchLocal(id, {
            video_status: data.status,
            video_url: data.video_url ?? null,
            video_error: data.video_error ?? null,
          });
          stopPolling(id);
          if (data.status === "ready") toast.success("Vidéo générée !");
          else if (data.status === "error") toast.error(`Génération échouée : ${data.video_error || ""}`);
        }
      } catch {
        /* on retentera au prochain tick */
      }
    },
    [patchLocal, stopPolling]
  );

  const startPolling = useCallback(
    (id: string) => {
      if (pollers.current[id]) return;
      pollers.current[id] = setInterval(() => pollOnce(id), POLL_INTERVAL_MS);
    },
    [pollOnce]
  );

  // Reprend le sondage pour les exercices déjà en génération (ex. après reload).
  useEffect(() => {
    for (const e of exercices) {
      if (e.video_status === "generating") startPolling(e.video_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercices.length]);

  useEffect(() => {
    const current = pollers.current;
    return () => {
      Object.values(current).forEach(clearInterval);
    };
  }, []);

  // --- Actions ------------------------------------------------------------
  const generate = useCallback(
    async (id: string) => {
      patchLocal(id, { video_status: "generating", video_error: null });
      try {
        const res = await fetch(`/api/admin/exercices/${id}/video`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          patchLocal(id, { video_status: "error", video_error: data.error || null });
          toast.error(data.error || "Démarrage impossible.");
          return;
        }
        toast.message("Génération lancée — cela peut prendre quelques minutes.");
        startPolling(id);
      } catch {
        patchLocal(id, { video_status: "error" });
        toast.error("Démarrage impossible.");
      }
    },
    [patchLocal, startPolling]
  );

  const searchEdb = useCallback(async (query: string): Promise<EdbCandidate[]> => {
    const res = await fetch(`/api/admin/exercisedb/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Recherche ExerciseDB impossible.");
      return [];
    }
    return data.results || [];
  }, []);

  const importEdb = useCallback(
    async (id: string, exerciseId: string): Promise<boolean> => {
      patchLocal(id, { video_status: "generating", video_error: null });
      const res = await fetch(`/api/admin/exercices/${id}/edb`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        patchLocal(id, { video_status: "error", video_error: data.error || null });
        toast.error(data.error || "Import impossible.");
        return false;
      }
      patchLocal(id, { video_status: "ready", video_url: data.video_url, video_source: "exercisedb" });
      toast.success("Vidéo importée depuis ExerciseDB.");
      return true;
    },
    [patchLocal]
  );

  const saveExercice = useCallback(async (id: string, patch: { nom: string; equipement: string; description_prompt: string }) => {
    const res = await fetch(`/api/admin/exercices/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Mise à jour impossible.");
      return;
    }
    toast.success("Exercice enregistré.");
    setExercices((list) => list.map((e) => (e.video_id === id ? { ...e, ...patch } : e)));
  }, []);

  const removeExercice = useCallback(
    async (id: string, nom: string) => {
      if (!confirm(`Supprimer « ${nom} » ?`)) return;
      const res = await fetch(`/api/admin/exercices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Suppression impossible.");
        return;
      }
      stopPolling(id);
      setExercices((list) => list.filter((e) => e.video_id !== id));
      toast.success("Exercice supprimé.");
    },
    [stopPolling]
  );

  const saveStyle = useCallback(async () => {
    setSavingStyle(true);
    try {
      const res = await fetch("/api/admin/style", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style_template: style }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Enregistrement impossible.");
        return;
      }
      setStyleDirty(false);
      toast.success("Template de style enregistré.");
    } finally {
      setSavingStyle(false);
    }
  }, [style]);

  const runSeed = useCallback(async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Seeding impossible.");
        return;
      }
      toast.success(`${data.count} exercice(s) importé(s).`);
      await load();
    } finally {
      setSeeding(false);
    }
  }, [load]);

  const addExercice = useCallback(async (input: { nom: string; equipement: string; description_prompt: string }) => {
    const res = await fetch("/api/admin/exercices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Création impossible.");
      return false;
    }
    setExercices((list) => [...list, data.exercice].sort((a, b) => a.nom.localeCompare(b.nom)));
    toast.success("Exercice créé.");
    return true;
  }, []);

  // --- Rendu --------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-chanv-terre/60">
        <Loader2 className="animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-chanv-terre uppercase tracking-tight">
            Administration des exercices
          </h2>
          <p className="text-sm text-chanv-terre/60 uppercase tracking-widest">
            Catalogue & génération vidéo (Veo)
          </p>
        </div>
        <button className="btn-secondary" onClick={runSeed} disabled={seeding}>
          {seeding ? <Loader2 className="inline mr-2 animate-spin" size={18} /> : <Download className="inline mr-2" size={18} />}
          Importer le catalogue de base
        </button>
      </div>

      {/* Template de style partagé */}
      <div className="card p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="label !mb-0">Template de style partagé (préfixe Veo)</span>
          <button className="btn-primary !py-2 !px-4 !text-sm" onClick={saveStyle} disabled={savingStyle || !styleDirty}>
            {savingStyle ? <Loader2 className="inline mr-2 animate-spin" size={16} /> : <Save className="inline mr-2" size={16} />}
            Enregistrer
          </button>
        </div>
        <p className="text-xs text-chanv-terre/60">
          Ce texte précède la description de chaque exercice pour garantir un look homogène entre toutes les vidéos.
        </p>
        <textarea
          className="input !h-40 font-mono text-sm"
          value={style}
          onChange={(e) => {
            setStyle(e.target.value);
            setStyleDirty(true);
          }}
        />
      </div>

      {/* Ajout d'exercice */}
      <NouvelExercice onAdd={addExercice} />

      {/* Liste */}
      <div className="flex flex-col gap-4">
        <span className="label !mb-0">{exercices.length} exercice(s)</span>
        {exercices.length === 0 && (
          <div className="section-card text-chanv-terre/60">
            Aucun exercice. Importe le catalogue de base ou ajoute-en un.
          </div>
        )}
        {exercices.map((ex) => (
          <ExerciceCard
            key={ex.video_id}
            exercice={ex}
            onSave={saveExercice}
            onDelete={removeExercice}
            onGenerate={generate}
            onSearchEdb={searchEdb}
            onImportEdb={importEdb}
          />
        ))}
      </div>
    </div>
  );
}

// =====================================================================

function NouvelExercice({
  onAdd,
}: {
  onAdd: (input: { nom: string; equipement: string; description_prompt: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [equipement, setEquipement] = useState("aucun");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!nom.trim()) {
      toast.error("Le nom est requis.");
      return;
    }
    setBusy(true);
    const ok = await onAdd({ nom: nom.trim(), equipement: equipement.trim(), description_prompt: description.trim() });
    setBusy(false);
    if (ok) {
      setNom("");
      setEquipement("aucun");
      setDescription("");
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button className="btn-secondary self-start" onClick={() => setOpen(true)}>
        <Plus className="inline mr-2" size={18} /> Ajouter un exercice
      </button>
    );
  }

  return (
    <div className="card p-6 flex flex-col gap-3">
      <span className="label !mb-0">Nouvel exercice</span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className="label">Nom</span>
          <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Wall Ball" />
        </div>
        <div>
          <span className="label">Équipement</span>
          <input className="input" value={equipement} onChange={(e) => setEquipement(e.target.value)} placeholder="Ex : medecine_ball" />
        </div>
      </div>
      <div>
        <span className="label">Description (prompt Veo)</span>
        <textarea
          className="input !h-24"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Décris précisément le mouvement à filmer…"
        />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary !py-2 !px-4 !text-sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="inline mr-2 animate-spin" size={16} /> : null}
          Créer
        </button>
        <button className="btn-secondary !py-2 !px-4 !text-sm" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </div>
  );
}

// =====================================================================

function ExerciceCard({
  exercice,
  onSave,
  onDelete,
  onGenerate,
  onSearchEdb,
  onImportEdb,
}: {
  exercice: Exercice;
  onSave: (id: string, patch: { nom: string; equipement: string; description_prompt: string }) => Promise<void>;
  onDelete: (id: string, nom: string) => Promise<void>;
  onGenerate: (id: string) => Promise<void>;
  onSearchEdb: (query: string) => Promise<EdbCandidate[]>;
  onImportEdb: (id: string, exerciseId: string) => Promise<boolean>;
}) {
  const [nom, setNom] = useState(exercice.nom);
  const [equipement, setEquipement] = useState(exercice.equipement);
  const [description, setDescription] = useState(exercice.description_prompt);
  const [saving, setSaving] = useState(false);

  // Panneau d'import ExerciseDB
  const [edbOpen, setEdbOpen] = useState(false);
  const [edbQuery, setEdbQuery] = useState(exercice.nom);
  const [edbResults, setEdbResults] = useState<EdbCandidate[]>([]);
  const [edbSearching, setEdbSearching] = useState(false);
  const [edbImporting, setEdbImporting] = useState<string | null>(null);

  const runEdbSearch = async () => {
    if (!edbQuery.trim()) return;
    setEdbSearching(true);
    setEdbResults(await onSearchEdb(edbQuery.trim()));
    setEdbSearching(false);
  };

  const chooseEdb = async (exerciseId: string) => {
    setEdbImporting(exerciseId);
    const ok = await onImportEdb(exercice.video_id, exerciseId);
    setEdbImporting(null);
    if (ok) setEdbOpen(false);
  };

  const dirty =
    nom !== exercice.nom ||
    equipement !== exercice.equipement ||
    description !== exercice.description_prompt;

  const generating = exercice.video_status === "generating";

  const save = async () => {
    setSaving(true);
    await onSave(exercice.video_id, { nom: nom.trim(), equipement: equipement.trim(), description_prompt: description.trim() });
    setSaving(false);
  };

  return (
    <div className="card p-5 flex flex-col lg:flex-row gap-5">
      {/* Aperçu vidéo */}
      <div className="lg:w-64 shrink-0">
        <div className="w-full aspect-video rounded-chanv overflow-hidden bg-chanv-terre flex items-center justify-center">
          {exercice.video_url ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={exercice.video_url} className="w-full h-full object-cover" controls loop muted playsInline />
          ) : (
            <span className="text-5xl opacity-70">{generating ? "⏳" : "🏋️"}</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className={STATUS_CLASS[exercice.video_status]}>{STATUS_LABEL[exercice.video_status]}</span>
          <code className="text-[10px] text-chanv-terre/50">{exercice.video_id}</code>
        </div>
        {exercice.video_status === "error" && exercice.video_error && (
          <p className="text-xs text-red-600 mt-1">{exercice.video_error}</p>
        )}
      </div>

      {/* Champs */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="label">Nom</span>
            <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div>
            <span className="label">Équipement</span>
            <input className="input" value={equipement} onChange={(e) => setEquipement(e.target.value)} />
          </div>
        </div>
        <div>
          <span className="label">Description (prompt Veo)</span>
          <textarea className="input !h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary !py-2 !px-4 !text-sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="inline mr-2 animate-spin" size={16} /> : <Save className="inline mr-2" size={16} />}
            Enregistrer
          </button>
          <button
            className="btn-secondary !py-2 !px-4 !text-sm"
            onClick={() => onGenerate(exercice.video_id)}
            disabled={generating}
            title={dirty ? "Enregistre d'abord tes modifications" : undefined}
          >
            {generating ? (
              <Loader2 className="inline mr-2 animate-spin" size={16} />
            ) : exercice.video_url ? (
              <Sparkles className="inline mr-2" size={16} />
            ) : (
              <Video className="inline mr-2" size={16} />
            )}
            {exercice.video_url ? "Régénérer la vidéo" : "Générer la vidéo"}
          </button>
          <button
            className="btn-secondary !py-2 !px-4 !text-sm"
            onClick={() => setEdbOpen((o) => !o)}
            disabled={generating}
          >
            <Search className="inline mr-2" size={16} /> ExerciseDB
          </button>
          <button
            className="badge-neutral !bg-red-50 !text-red-700 !text-sm !px-4 !py-2"
            onClick={() => onDelete(exercice.video_id, exercice.nom)}
          >
            <Trash2 className="inline mr-1" size={16} /> Supprimer
          </button>
        </div>

        {/* Panneau de curation ExerciseDB */}
        {edbOpen && (
          <div className="section-card !p-4 flex flex-col gap-3">
            <span className="label !mb-0">Importer depuis ExerciseDB</span>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={edbQuery}
                onChange={(e) => setEdbQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runEdbSearch()}
                placeholder="Rechercher un mouvement (ex : burpee)"
              />
              <button className="btn-primary !py-2 !px-4 !text-sm" onClick={runEdbSearch} disabled={edbSearching}>
                {edbSearching ? <Loader2 className="inline animate-spin" size={16} /> : <Search size={16} />}
              </button>
            </div>
            {edbResults.length === 0 && !edbSearching && (
              <p className="text-xs text-chanv-terre/50">
                ⚠️ La recherche est approximative — vérifie que le clip choisi correspond bien au mouvement.
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
              {edbResults.map((r) => (
                <button
                  key={r.exerciseId}
                  onClick={() => chooseEdb(r.exerciseId)}
                  disabled={edbImporting !== null}
                  className="card !p-2 flex flex-col items-center gap-1 text-center hover:ring-2 hover:ring-chanv-terre disabled:opacity-50"
                  title="Choisir et importer ce clip"
                >
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt={r.name} className="w-full aspect-square object-cover rounded" loading="lazy" />
                  ) : (
                    <span className="text-3xl">🏋️</span>
                  )}
                  <span className="text-[11px] font-semibold text-chanv-terre leading-tight">{r.name}</span>
                  {edbImporting === r.exerciseId && <Loader2 className="animate-spin" size={14} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
