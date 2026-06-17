"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipForward, RotateCcw, RotateCw, ArrowRight, ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
import type { Programme, ProgrammeExercice } from "@/lib/types";
import { SpotifyWidget, type SpotifyHandle } from "./SpotifyWidget";
import { playCue, announce, unlockAudio } from "@/lib/audio-cues";

const DEFAULT_TRAVAIL = 45;
const DEFAULT_TRANSITION = 15;

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

interface Props {
  programme: Programme;
  onQuitter: () => void;
}

export function TableauBordGroupe({ programme, onQuitter }: Props) {
  const stations = programme.exercices;
  const N = stations.length;
  const totalRounds = Math.max(1, programme.rounds);
  const travail = stations[0]?.duree_travail_s || stations[0]?.valeur || DEFAULT_TRAVAIL;
  const repos = stations[0]?.duree_repos_s || DEFAULT_TRANSITION;
  const totalIntervals = N * totalRounds;

  const [auto, setAuto] = useState(true);
  const [running, setRunning] = useState(false);
  const [intervalIdx, setIntervalIdx] = useState(0); // 0..totalIntervals-1
  const [phase, setPhase] = useState<"travail" | "transition">("travail");
  const [restant, setRestant] = useState(travail);
  const [ecoule, setEcoule] = useState(0);
  const [termine, setTermine] = useState(false);

  const spotifyRef = useRef<SpotifyHandle>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const duck = useCallback(() => spotifyRef.current?.duck(1500), []);

  const round = Math.floor(intervalIdx / N) + 1;
  const rotation = (intervalIdx % N) + 1; // position dans le tour (1..N)
  const progression = Math.min(100, Math.round((intervalIdx / totalIntervals) * 100));

  const avancer = useCallback(() => {
    setPhase((ph) => {
      if (ph === "travail") {
        playCue("fin_travail");
        if (intervalIdx + 1 >= totalIntervals) {
          setRunning(false);
          setTermine(true);
          playCue("fin_seance");
          announce("Séance terminée. Bravo à tous !");
          return ph;
        }
        setRestant(repos);
        duck();
        announce("Tournez d'une station, dans le sens horaire.");
        playCue("prochain");
        return "transition";
      }
      // transition terminée → rotation suivante
      setIntervalIdx((n) => n + 1);
      setRestant(travail);
      playCue("countdown");
      return "travail";
    });
  }, [intervalIdx, totalIntervals, repos, travail, duck]);

  useEffect(() => {
    if (!running || termine) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setEcoule((e) => e + 1);
      if (auto) {
        setRestant((r) => {
          if (r <= 1) {
            queueMicrotask(avancer);
            return 0;
          }
          if (r <= 4) playCue("countdown");
          return r - 1;
        });
      }
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running, termine, auto, avancer]);

  const demarrer = () => {
    unlockAudio();
    setRunning(true);
    if (ecoule === 0) {
      playCue("countdown");
      announce("Chacun à une station. C'est parti !");
    }
  };

  const reset = () => {
    setRunning(false);
    setTermine(false);
    setIntervalIdx(0);
    setPhase("travail");
    setRestant(travail);
    setEcoule(0);
  };

  // Disposition en boucle : haut = ceil(N/2) (gauche→droite, stations 1..top),
  // bas = reste affiché droite→gauche (stations top+1..N) → lecture horaire.
  const top = Math.ceil(N / 2);
  const topStations = stations.slice(0, top);
  const bottomStations = stations.slice(top).reverse();

  const enTransition = phase === "transition";

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-chanv-terre uppercase tracking-tight">{programme.nom}</h2>
          <p className="text-sm text-chanv-terre/60 uppercase tracking-widest">
            Groupe · {N} stations · {programme.type}
          </p>
        </div>
        <button className="btn-secondary" onClick={onQuitter}>← Nouvelle séance</button>
      </div>

      {/* Bandeau chrono + état */}
      <div className={`card flex items-center justify-between gap-4 py-4 px-6 ${enTransition ? "!bg-chanv-beige" : ""}`}>
        <div className="flex items-center gap-3">
          <RotateCw size={28} className={`text-chanv-terre ${enTransition ? "animate-spin" : ""}`} />
          <div>
            <div className="text-xs uppercase tracking-widest text-chanv-terre/60">
              {enTransition ? "Tournez dans le sens horaire !" : "Travail"}
            </div>
            <div className="text-lg font-bold text-chanv-terre">
              Rotation {rotation}/{N} · Tour {round}/{totalRounds}
            </div>
          </div>
        </div>
        <span className="text-6xl font-black tabular-nums text-chanv-terre">{fmt(restant)}</span>
      </div>

      {/* Grille des stations en boucle */}
      <div className="card p-4 flex flex-col gap-2">
        {/* Rangée du haut : gauche → droite */}
        <div className="flex items-stretch gap-2">
          {topStations.map((s, i) => (
            <div key={s.video_id + i} className="flex items-stretch gap-2 flex-1">
              <StationCard station={s} number={i + 1} />
              {i < topStations.length - 1 && <Sep dir="right" />}
            </div>
          ))}
          {bottomStations.length > 0 && (
            <div className="flex items-center"><ArrowDown className="text-chanv-terre/60" /></div>
          )}
        </div>

        {/* Repère central */}
        <div className="flex items-center justify-center py-1">
          <span className={`badge-accent !text-sm inline-flex items-center gap-2 ${enTransition ? "animate-pulse" : ""}`}>
            <RotateCw size={16} /> Sens horaire
          </span>
        </div>

        {/* Rangée du bas : droite → gauche (numéros top+1..N) */}
        {bottomStations.length > 0 && (
          <div className="flex items-stretch gap-2">
            <div className="flex items-center"><ArrowUp className="text-chanv-terre/60" /></div>
            {bottomStations.map((s, i) => {
              const realNumber = N - i; // bottomStations[0] = station N
              return (
                <div key={s.video_id + i} className="flex items-stretch gap-2 flex-1">
                  {i > 0 && <Sep dir="left" />}
                  <StationCard station={s} number={realNumber} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {!running ? (
          <button className="btn-primary !text-lg !px-8 !py-4" onClick={demarrer}>
            <Play className="inline mr-2" size={22} /> {ecoule === 0 ? "Démarrer" : "Reprendre"}
          </button>
        ) : (
          <button className="btn-primary !text-lg !px-8 !py-4" onClick={() => setRunning(false)}>
            <Pause className="inline mr-2" size={22} /> Pause
          </button>
        )}
        <button className="btn-secondary !text-lg !px-6 !py-4" onClick={avancer} title="Forcer la rotation">
          <SkipForward className="inline mr-2" size={22} /> Rotation
        </button>
        <button className="btn-secondary !text-lg !px-6 !py-4" onClick={reset}>
          <RotateCcw className="inline mr-2" size={22} /> Reset
        </button>
        <button
          className={auto ? "badge-accent !text-sm !px-4 !py-3" : "badge-neutral !text-sm !px-4 !py-3"}
          onClick={() => setAuto((a) => !a)}
        >
          {auto ? "Mode AUTO" : "Mode MANUEL"}
        </button>
      </div>

      {/* Progression */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="label !mb-0">Progression du circuit</span>
          <span className="font-bold text-chanv-terre">{progression}% · {fmt(ecoule)} écoulé</span>
        </div>
        <div className="w-full h-4 rounded-full bg-chanv-terre/10 overflow-hidden">
          <div className="h-full bg-chanv-beige transition-all duration-500" style={{ width: `${progression}%` }} />
        </div>
      </div>

      {/* Spotify */}
      <SpotifyWidget ref={spotifyRef} />

      {termine && (
        <div className="card text-center py-8">
          <div className="text-5xl mb-2">🏁</div>
          <h3 className="text-2xl font-black text-chanv-terre">Circuit terminé !</h3>
          <p className="text-chanv-terre/70 mt-1">{totalRounds} tours · {N} stations</p>
          <button className="btn-primary mt-4" onClick={onQuitter}>Nouvelle séance</button>
        </div>
      )}
    </div>
  );
}

function Sep({ dir }: { dir: "right" | "left" }) {
  return (
    <div className="flex items-center text-chanv-terre/40">
      {dir === "right" ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
    </div>
  );
}

function StationCard({ station, number }: { station: ProgrammeExercice; number: number }) {
  return (
    <div className="relative flex-1 min-w-0 rounded-chanv overflow-hidden bg-chanv-terre flex flex-col">
      <div className="relative w-full aspect-video bg-chanv-terre flex items-center justify-center">
        {station.video_url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={station.video_url} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="auto" />
        ) : (
          <span className="text-4xl">🏋️</span>
        )}
        <span className="absolute top-1 left-1 w-7 h-7 rounded-full bg-chanv-beige text-chanv-terre font-black text-sm flex items-center justify-center shadow">
          {number}
        </span>
      </div>
      <div className="p-2 bg-white">
        <div className="font-bold text-chanv-terre text-sm leading-tight truncate" title={station.nom}>{station.nom}</div>
        <div className="text-xs text-chanv-terre/60">
          {station.valeur} {station.unite}
          {station.charge_h != null && ` · ♂${station.charge_h}`}
          {station.charge_f != null && ` ♀${station.charge_f}`}
        </div>
      </div>
    </div>
  );
}
