"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, Search, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { BlocModele, ExerciceModele, EffortType, ProgrammeModele, WorkoutType, WorkoutMode, WorkoutNiveau } from "@/lib/types";

const TYPES: WorkoutType[] = ["hyrox", "crossfit", "hiit", "endurance", "force"];
const NIVEAUX: { v: WorkoutNiveau; l: string }[] = [
  { v: "debutant", l: "prog.niveau.debutant" }, { v: "intermediaire", l: "prog.niveau.intermediaire" }, { v: "avance", l: "prog.niveau.avance" },
];
const EFFORTS: { v: EffortType; l: string; unite: string }[] = [
  { v: "reps", l: "prog.effort.reps", unite: "reps" },
  { v: "amrap", l: "prog.effort.amrap", unite: "s" },
  { v: "temps", l: "prog.effort.temps", unite: "s" },
  { v: "distance", l: "prog.effort.distance", unite: "m" },
  { v: "calories", l: "prog.effort.calories", unite: "cal" },
];

interface SearchResult { video_id: string; nom: string; equipement: string; image: string | null; }

function emptyExercice(nom = "", video_id: string | null = null): ExerciceModele {
  return { nom, video_id, effort: "reps", valeur: 10, charge_h: null, charge_f: null, repos_s: 30, consignes: "" };
}
function emptyBloc(): BlocModele {
  return { nom: "Bloc", rounds: 3, repos_entre_rounds_s: 60, exercices: [] };
}

export function ProgrammeBuilder({ initial }: { initial: ProgrammeModele | null }) {
  const router = useRouter();
  const t = useT();
  const [nom, setNom] = useState(initial?.nom || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [type, setType] = useState<WorkoutType>(initial?.type || "crossfit");
  const [mode, setMode] = useState<WorkoutMode>(initial?.mode || "solo");
  const [niveau, setNiveau] = useState<WorkoutNiveau>(initial?.niveau || "intermediaire");
  const [blocs, setBlocs] = useState<BlocModele[]>(initial?.blocs?.length ? initial.blocs : [emptyBloc()]);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  // --- helpers immuables ---
  const updateBloc = (bi: number, patch: Partial<BlocModele>) =>
    setBlocs((bs) => bs.map((b, i) => (i === bi ? { ...b, ...patch } : b)));
  const removeBloc = (bi: number) => setBlocs((bs) => bs.filter((_, i) => i !== bi));
  const moveBloc = (bi: number, dir: -1 | 1) =>
    setBlocs((bs) => {
      const j = bi + dir;
      if (j < 0 || j >= bs.length) return bs;
      const copy = [...bs];
      [copy[bi], copy[j]] = [copy[j], copy[bi]];
      return copy;
    });
  const updateExo = (bi: number, ei: number, patch: Partial<ExerciceModele>) =>
    setBlocs((bs) => bs.map((b, i) => i === bi ? { ...b, exercices: b.exercices.map((e, k) => k === ei ? { ...e, ...patch } : e) } : b));
  const addExo = (bi: number, exo: ExerciceModele) =>
    setBlocs((bs) => bs.map((b, i) => i === bi ? { ...b, exercices: [...b.exercices, exo] } : b));
  const removeExo = (bi: number, ei: number) =>
    setBlocs((bs) => bs.map((b, i) => i === bi ? { ...b, exercices: b.exercices.filter((_, k) => k !== ei) } : b));

  const save = useCallback(async () => {
    if (!nom.trim()) { toast.error(t("prog.nameRequired")); return; }
    if (blocs.every((b) => b.exercices.length === 0)) { toast.error(t("prog.exerciseRequired")); return; }
    setSaving(true);
    try {
      const payload = { nom, description, type, mode, niveau, blocs };
      const res = await fetch(initial?.id ? `/api/programmes/${initial.id}` : "/api/programmes", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || t("prog.saveError")); return; }
      toast.success(t("prog.saved"));
      router.push("/programmes");
    } finally {
      setSaving(false);
    }
  }, [nom, description, type, mode, niveau, blocs, initial, router, t]);

  const aiDraft = useCallback(async () => {
    setAiBusy(true);
    try {
      const res = await fetch("/api/programmes/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, mode, niveau, duree_min: 45, objectif: nom }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || t("prog.aiError")); return; }
      const d = data.draft;
      if (!nom) setNom(d.nom || "");
      setDescription(d.description || "");
      setBlocs(d.blocs?.length ? d.blocs : [emptyBloc()]);
      toast.success(t("prog.aiLoaded"));
    } finally {
      setAiBusy(false);
    }
  }, [type, mode, niveau, nom, t]);

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-3xl font-black text-chanv-terre uppercase tracking-tight">
          {initial?.id ? t("prog.editTitle") : t("prog.new")}
        </h2>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={aiDraft} disabled={aiBusy}>
            {aiBusy ? <Loader2 className="inline mr-2 animate-spin" size={18} /> : <Sparkles className="inline mr-2" size={18} />}
            {t("prog.aiDraft")}
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="inline mr-2 animate-spin" size={18} /> : <Save className="inline mr-2" size={18} />}
            {t("prog.save")}
          </button>
        </div>
      </div>

      {/* Méta */}
      <div className="card p-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="label">{t("prog.name")}</span>
            <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("prog.namePlaceholder")} />
          </div>
          <div>
            <span className="label">{t("prog.level")}</span>
            <div className="flex gap-2 flex-wrap">
              {NIVEAUX.map((n) => (
                <button key={n.v} onClick={() => setNiveau(n.v)} className={niveau === n.v ? "badge-accent" : "badge-neutral"}>{t(n.l)}</button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <span className="label">{t("prog.description")}</span>
          <textarea className="input !h-16" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("prog.descriptionPlaceholder")} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="label">{t("prog.type")}</span>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map((ty) => (
                <button key={ty} onClick={() => setType(ty)} className={type === ty ? "badge-accent" : "badge-neutral"}>{t(`prog.type.${ty}`)}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">{t("prog.mode")}</span>
            <div className="flex gap-2">
              <button onClick={() => setMode("solo")} className={mode === "solo" ? "badge-accent" : "badge-neutral"}>{t("prog.modeSolo")}</button>
              <button onClick={() => setMode("groupe")} className={mode === "groupe" ? "badge-accent" : "badge-neutral"}>{t("prog.modeGroupe")}</button>
            </div>
            {mode === "groupe" && (
              <p className="text-xs text-chanv-terre/60 mt-1">{t("prog.groupeNote")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Blocs */}
      {blocs.map((bloc, bi) => (
        <BlocEditor
          key={bi}
          bloc={bloc}
          index={bi}
          total={blocs.length}
          mode={mode}
          onChange={(patch) => updateBloc(bi, patch)}
          onRemove={() => removeBloc(bi)}
          onMove={(dir) => moveBloc(bi, dir)}
          onAddExo={(exo) => addExo(bi, exo)}
          onUpdateExo={(ei, patch) => updateExo(bi, ei, patch)}
          onRemoveExo={(ei) => removeExo(bi, ei)}
        />
      ))}

      <button className="btn-secondary self-start" onClick={() => setBlocs((bs) => [...bs, emptyBloc()])}>
        <Plus className="inline mr-2" size={18} /> {t("prog.addBloc")}
      </button>
    </div>
  );
}

function BlocEditor({
  bloc, index, total, mode, onChange, onRemove, onMove, onAddExo, onUpdateExo, onRemoveExo,
}: {
  bloc: BlocModele; index: number; total: number; mode: WorkoutMode;
  onChange: (p: Partial<BlocModele>) => void; onRemove: () => void; onMove: (d: -1 | 1) => void;
  onAddExo: (e: ExerciceModele) => void; onUpdateExo: (ei: number, p: Partial<ExerciceModele>) => void; onRemoveExo: (ei: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = useT();
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input !w-48 font-bold" value={bloc.nom} onChange={(e) => onChange({ nom: e.target.value })} />
        <label className="text-sm text-chanv-terre/70">{t("prog.rounds")}
          <input type="number" min={1} className="input !w-20 ml-1 inline-block" value={bloc.rounds} onChange={(e) => onChange({ rounds: Math.max(1, Number(e.target.value)) })} />
        </label>
        <label className="text-sm text-chanv-terre/70">{t("prog.restBetweenRounds")}
          <input type="number" min={0} className="input !w-24 ml-1 inline-block" value={bloc.repos_entre_rounds_s} onChange={(e) => onChange({ repos_entre_rounds_s: Math.max(0, Number(e.target.value)) })} />
        </label>
        <div className="ml-auto flex gap-1">
          <button className="badge-neutral !px-2 !py-1" onClick={() => onMove(-1)} disabled={index === 0}><ChevronUp size={16} /></button>
          <button className="badge-neutral !px-2 !py-1" onClick={() => onMove(1)} disabled={index === total - 1}><ChevronDown size={16} /></button>
          <button className="badge-neutral !bg-red-50 !text-red-700 !px-2 !py-1" onClick={onRemove}><Trash2 size={16} /></button>
        </div>
      </div>

      {bloc.exercices.map((exo, ei) => (
        <div key={ei} className="section-card !p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-chanv-beige text-chanv-terre font-bold text-xs flex items-center justify-center shrink-0">{ei + 1}</span>
            <input className="input flex-1 !py-1 font-semibold" value={exo.nom} onChange={(e) => onUpdateExo(ei, { nom: e.target.value })} />
            {!exo.video_id && <span className="badge-neutral !text-[10px]">{t("prog.customNoVideo")}</span>}
            <button className="badge-neutral !bg-red-50 !text-red-700 !px-2 !py-1" onClick={() => onRemoveExo(ei)}><Trash2 size={14} /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <select className="input !w-40 !py-1" value={exo.effort} onChange={(e) => onUpdateExo(ei, { effort: e.target.value as EffortType })} disabled={mode === "groupe"}>
              {EFFORTS.map((ef) => <option key={ef.v} value={ef.v}>{t(ef.l)}</option>)}
            </select>
            <label>{t("prog.value")}
              <input type="number" min={0} className="input !w-24 ml-1 inline-block !py-1" value={exo.valeur} onChange={(e) => onUpdateExo(ei, { valeur: Number(e.target.value) })} />
            </label>
            <label>{t("prog.rest")}
              <input type="number" min={0} className="input !w-20 ml-1 inline-block !py-1" value={exo.repos_s} onChange={(e) => onUpdateExo(ei, { repos_s: Number(e.target.value) })} />
            </label>
            <label>♂ lbs
              <input type="number" className="input !w-20 ml-1 inline-block !py-1" value={exo.charge_h ?? ""} onChange={(e) => onUpdateExo(ei, { charge_h: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
            <label>♀ lbs
              <input type="number" className="input !w-20 ml-1 inline-block !py-1" value={exo.charge_f ?? ""} onChange={(e) => onUpdateExo(ei, { charge_f: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>
          <input className="input !py-1 text-sm" placeholder={t("prog.instructionsPlaceholder")} value={exo.consignes} onChange={(e) => onUpdateExo(ei, { consignes: e.target.value })} />
        </div>
      ))}

      {mode === "groupe" && (
        <p className="text-xs text-chanv-terre/50">{t("prog.groupeBlocNote")}</p>
      )}

      {pickerOpen ? (
        <ExercicePicker
          onPick={(r) => { onAddExo(emptyExoFromCatalogue(r)); }}
          onCustom={() => { onAddExo(emptyExercice("Nouvel exercice", null)); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      ) : (
        <button className="btn-secondary self-start !py-2 !px-4 !text-sm" onClick={() => setPickerOpen(true)}>
          <Plus className="inline mr-1" size={16} /> {t("prog.addExercise")}
        </button>
      )}
    </div>
  );
}

function emptyExoFromCatalogue(r: SearchResult): ExerciceModele {
  return { ...emptyExercice(r.nom, r.video_id) };
}

function ExercicePicker({ onPick, onCustom, onClose }: { onPick: (r: SearchResult) => void; onCustom: () => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useT();

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exercices/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setResults(res.ok ? data.results || [] : []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-card !p-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <input className="input flex-1 !py-1" placeholder={t("prog.searchPlaceholder")} value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        <button className="btn-primary !py-1 !px-3 !text-sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="inline animate-spin" size={16} /> : <Search size={16} />}
        </button>
        <button className="btn-secondary !py-1 !px-3 !text-sm" onClick={onCustom}>{t("prog.customBtn")}</button>
        <button className="badge-neutral !px-3 !py-1 !text-sm" onClick={onClose}>{t("prog.close")}</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
        {results.map((r) => (
          <button key={r.video_id} onClick={() => onPick(r)} className="card !p-2 flex flex-col items-center gap-1 text-center hover:ring-2 hover:ring-chanv-terre">
            {r.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image} alt="" className="w-full aspect-square object-cover rounded" loading="lazy" />
            ) : <span className="text-2xl">🏋️</span>}
            <span className="text-[11px] font-semibold text-chanv-terre leading-tight">{r.nom}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
