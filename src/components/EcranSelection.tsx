"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type {
  GenerationParams,
  WorkoutType,
  WorkoutFormat,
  WorkoutNiveau,
  WorkoutMode,
} from "@/lib/types";

const STATIONS = [4, 6, 8, 10, 12];

const TYPES: { value: WorkoutType; labelKey: string; emoji: string }[] = [
  { value: "hyrox", labelKey: "sel.type.hyrox", emoji: "🏃" },
  { value: "crossfit", labelKey: "sel.type.crossfit", emoji: "🏋️" },
  { value: "hiit", labelKey: "sel.type.hiit", emoji: "🔥" },
  { value: "endurance", labelKey: "sel.type.endurance", emoji: "🚴" },
  { value: "force", labelKey: "sel.type.force", emoji: "💪" },
];

const DUREES = [20, 30, 45, 60];

const FORMATS: { value: WorkoutFormat; labelKey: string }[] = [
  { value: "for_time", labelKey: "sel.format.for_time" },
  { value: "amrap", labelKey: "sel.format.amrap" },
  { value: "emom", labelKey: "sel.format.emom" },
  { value: "circuit", labelKey: "sel.format.circuit" },
  { value: "tabata", labelKey: "sel.format.tabata" },
];

const NIVEAUX: { value: WorkoutNiveau; labelKey: string }[] = [
  { value: "debutant", labelKey: "sel.niveau.debutant" },
  { value: "intermediaire", labelKey: "sel.niveau.intermediaire" },
  { value: "avance", labelKey: "sel.niveau.avance" },
];

interface Props {
  onGenerer: (params: GenerationParams) => void;
  loading: boolean;
  error: string | null;
}

export function EcranSelection({ onGenerer, loading, error }: Props) {
  const t = useT();
  const [mode, setMode] = useState<WorkoutMode>("solo");
  const [stations, setStations] = useState(8);
  const [type, setType] = useState<WorkoutType>("hyrox");
  const [duree, setDuree] = useState(45);
  const [niveau, setNiveau] = useState<WorkoutNiveau>("intermediaire");
  const [format, setFormat] = useState<WorkoutFormat>("circuit");
  const [participants, setParticipants] = useState(8);
  const [competition, setCompetition] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);

  const submit = () => {
    onGenerer({
      type,
      mode,
      stations: mode === "groupe" ? stations : undefined,
      competition: competition.trim() || null,
      duree_min: duree,
      niveau,
      format: mode === "groupe" ? "circuit" : format,
      participants,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-4xl font-black text-chanv-terre uppercase tracking-tight">
          {t("sel.titre")}
        </h2>
        <p className="text-chanv-terre/60 uppercase tracking-widest text-sm mt-1">
          {t("sel.sousTitre")}
        </p>
      </div>

      {/* Choix Solo / Groupe */}
      <div>
        <span className="label">{t("sel.mode.label")}</span>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("solo")}
            className={`card !p-6 flex flex-col items-center gap-2 transition-all ${
              mode === "solo" ? "ring-4 ring-chanv-terre scale-[1.02]" : "opacity-80 hover:opacity-100"
            }`}
          >
            <span className="text-5xl">🏃</span>
            <span className="font-bold text-chanv-terre uppercase tracking-wide text-sm">{t("sel.mode.solo")}</span>
            <span className="text-xs text-chanv-terre/60 text-center">{t("sel.mode.soloDesc")}</span>
          </button>
          <button
            onClick={() => setMode("groupe")}
            className={`card !p-6 flex flex-col items-center gap-2 transition-all ${
              mode === "groupe" ? "ring-4 ring-chanv-terre scale-[1.02]" : "opacity-80 hover:opacity-100"
            }`}
          >
            <span className="text-5xl">🔄</span>
            <span className="font-bold text-chanv-terre uppercase tracking-wide text-sm">{t("sel.mode.groupe")}</span>
            <span className="text-xs text-chanv-terre/60 text-center">{t("sel.mode.groupeDesc")}</span>
          </button>
        </div>
      </div>

      {/* Nombre de stations (mode groupe) */}
      {mode === "groupe" && (
        <div>
          <span className="label">{t("sel.stations.label")}</span>
          <div className="grid grid-cols-5 gap-3">
            {STATIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStations(s)}
                className={`card !py-6 flex flex-col items-center transition-all ${
                  stations === s ? "ring-4 ring-chanv-terre scale-[1.02]" : "opacity-80 hover:opacity-100"
                }`}
              >
                <span className="text-4xl font-black text-chanv-terre tabular-nums">{s}</span>
                <span className="text-xs uppercase tracking-widest text-chanv-terre/60">{t("sel.stations.unite")}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-chanv-terre/60 mt-2">
            {t("sel.stations.aide")}
          </p>
        </div>
      )}

      {/* Tuiles type */}
      <div>
        <span className="label">{t("sel.type.label")}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TYPES.map((ty) => (
            <button
              key={ty.value}
              onClick={() => setType(ty.value)}
              className={`card !p-6 flex flex-col items-center gap-2 transition-all ${
                type === ty.value
                  ? "ring-4 ring-chanv-terre scale-[1.02]"
                  : "opacity-80 hover:opacity-100"
              }`}
            >
              <span className="text-5xl">{ty.emoji}</span>
              <span className="font-bold text-chanv-terre uppercase tracking-wide text-sm text-center">
                {t(ty.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Durée */}
      <div>
        <span className="label">{t("sel.duree.label")}</span>
        <div className="grid grid-cols-4 gap-3">
          {DUREES.map((d) => (
            <button
              key={d}
              onClick={() => setDuree(d)}
              className={`card !py-6 flex flex-col items-center transition-all ${
                duree === d ? "ring-4 ring-chanv-terre scale-[1.02]" : "opacity-80 hover:opacity-100"
              }`}
            >
              <span className="text-4xl font-black text-chanv-terre tabular-nums">{d}</span>
              <span className="text-xs uppercase tracking-widest text-chanv-terre/60">{t("sel.duree.min")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Options secondaires repliables */}
      <div className="card p-6">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setOptionsOpen((o) => !o)}
        >
          <span className="label !mb-0">{t("sel.options")}</span>
          <ChevronDown
            size={20}
            className={`text-chanv-terre/60 transition-transform ${optionsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {optionsOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <span className="label">{t("sel.niveau.label")}</span>
              <div className="flex gap-2 flex-wrap">
                {NIVEAUX.map((n) => (
                  <button
                    key={n.value}
                    onClick={() => setNiveau(n.value)}
                    className={niveau === n.value ? "badge-accent" : "badge-neutral"}
                  >
                    {t(n.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">{t("sel.format.label")}</span>
              <div className="flex gap-2 flex-wrap">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={format === f.value ? "badge-accent" : "badge-neutral"}
                  >
                    {t(f.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">{t("sel.participants")}</span>
              <input
                type="number"
                min={1}
                max={50}
                value={participants}
                onChange={(e) => setParticipants(Number(e.target.value))}
                className="input"
              />
            </div>

            <div>
              <span className="label">{t("sel.competition")}</span>
              <input
                type="text"
                placeholder={t("sel.competitionPlaceholder")}
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="input"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="section-card !p-4 !border-red-300 text-red-700 text-sm font-semibold">
          ⚠️ {error}
        </div>
      )}

      <button className="btn-primary !text-xl !py-5" onClick={submit} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="inline mr-2 animate-spin" size={24} />
            {t("sel.generation")}
          </>
        ) : (
          t("sel.generer")
        )}
      </button>
    </div>
  );
}
