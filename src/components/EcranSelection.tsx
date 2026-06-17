"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type {
  GenerationParams,
  WorkoutType,
  WorkoutFormat,
  WorkoutNiveau,
  WorkoutMode,
} from "@/lib/types";

const STATIONS = [4, 6, 8, 10, 12];

const TYPES: { value: WorkoutType; label: string; emoji: string }[] = [
  { value: "hyrox", label: "Hyrox", emoji: "🏃" },
  { value: "crossfit", label: "CrossFit", emoji: "🏋️" },
  { value: "hiit", label: "HIIT métabolique", emoji: "🔥" },
  { value: "endurance", label: "Endurance", emoji: "🚴" },
  { value: "force", label: "Force", emoji: "💪" },
];

const DUREES = [20, 30, 45, 60];

const FORMATS: { value: WorkoutFormat; label: string }[] = [
  { value: "for_time", label: "For Time" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "circuit", label: "Circuit" },
  { value: "tabata", label: "Tabata" },
];

const NIVEAUX: { value: WorkoutNiveau; label: string }[] = [
  { value: "debutant", label: "Débutant" },
  { value: "intermediaire", label: "Intermédiaire" },
  { value: "avance", label: "Avancé" },
];

interface Props {
  onGenerer: (params: GenerationParams) => void;
  loading: boolean;
  error: string | null;
}

export function EcranSelection({ onGenerer, loading, error }: Props) {
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
          Nouvelle séance
        </h2>
        <p className="text-chanv-terre/60 uppercase tracking-widest text-sm mt-1">
          Sélectionnez le type et la durée
        </p>
      </div>

      {/* Choix Solo / Groupe */}
      <div>
        <span className="label">Mode de séance</span>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("solo")}
            className={`card !p-6 flex flex-col items-center gap-2 transition-all ${
              mode === "solo" ? "ring-4 ring-chanv-terre scale-[1.02]" : "opacity-80 hover:opacity-100"
            }`}
          >
            <span className="text-5xl">🏃</span>
            <span className="font-bold text-chanv-terre uppercase tracking-wide text-sm">Seul</span>
            <span className="text-xs text-chanv-terre/60 text-center">Tout le monde fait le même exercice, en séquence</span>
          </button>
          <button
            onClick={() => setMode("groupe")}
            className={`card !p-6 flex flex-col items-center gap-2 transition-all ${
              mode === "groupe" ? "ring-4 ring-chanv-terre scale-[1.02]" : "opacity-80 hover:opacity-100"
            }`}
          >
            <span className="text-5xl">🔄</span>
            <span className="font-bold text-chanv-terre uppercase tracking-wide text-sm">En groupe</span>
            <span className="text-xs text-chanv-terre/60 text-center">Circuit à stations, rotation dans le sens horaire</span>
          </button>
        </div>
      </div>

      {/* Nombre de stations (mode groupe) */}
      {mode === "groupe" && (
        <div>
          <span className="label">Nombre de stations</span>
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
                <span className="text-xs uppercase tracking-widest text-chanv-terre/60">stations</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-chanv-terre/60 mt-2">
            Une station = un exercice. Chacun démarre à une station et tourne au signal. Indépendant du nombre de participants.
          </p>
        </div>
      )}

      {/* Tuiles type */}
      <div>
        <span className="label">Type d&apos;entraînement / compétition</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`card !p-6 flex flex-col items-center gap-2 transition-all ${
                type === t.value
                  ? "ring-4 ring-chanv-terre scale-[1.02]"
                  : "opacity-80 hover:opacity-100"
              }`}
            >
              <span className="text-5xl">{t.emoji}</span>
              <span className="font-bold text-chanv-terre uppercase tracking-wide text-sm text-center">
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Durée */}
      <div>
        <span className="label">Durée de la séance</span>
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
              <span className="text-xs uppercase tracking-widest text-chanv-terre/60">min</span>
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
          <span className="label !mb-0">Options avancées</span>
          <ChevronDown
            size={20}
            className={`text-chanv-terre/60 transition-transform ${optionsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {optionsOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <span className="label">Niveau</span>
              <div className="flex gap-2 flex-wrap">
                {NIVEAUX.map((n) => (
                  <button
                    key={n.value}
                    onClick={() => setNiveau(n.value)}
                    className={niveau === n.value ? "badge-accent" : "badge-neutral"}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Format</span>
              <div className="flex gap-2 flex-wrap">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={format === f.value ? "badge-accent" : "badge-neutral"}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Nombre de participants</span>
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
              <span className="label">Compétition cible (optionnel)</span>
              <input
                type="text"
                placeholder="Ex : Hyrox Montréal 2025"
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
            Génération de la séance par l&apos;IA…
          </>
        ) : (
          "🚀 Générer la séance"
        )}
      </button>
    </div>
  );
}
