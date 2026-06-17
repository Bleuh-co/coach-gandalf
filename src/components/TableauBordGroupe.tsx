"use client";

import { useEffect, useRef, useState, useCallback, Fragment } from "react";
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
    // Plein écran : on s'affranchit du conteneur max-w-5xl pour exploiter tout le 16:9.
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 sm:px-6">
      <div className="flex flex-col gap-3">
        {/* Bandeau compact : titre + état + chrono */}
        <div className={`card flex items-center justify-between gap-4 py-3 px-5 shrink-0 ${enTransition ? "!bg-chanv-beige" : ""}`}>
          <div className="flex items-center gap-3 min-w-0">
            <RotateCw size={32} className={`text-chanv-terre shrink-0 ${enTransition ? "animate-spin" : ""}`} />
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-black text-chanv-terre uppercase tracking-tight truncate">{programme.nom}</h2>
              <div className="text-sm font-bold text-chanv-terre/70">
                {enTransition ? "TOURNEZ — sens horaire !" : "Travail"} · Rotation {rotation}/{N} · Tour {round}/{totalRounds}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-6xl md:text-7xl font-black tabular-nums text-chanv-terre">{fmt(restant)}</span>
            <button className="btn-secondary !py-2 !px-4" onClick={onQuitter}>← Quitter</button>
          </div>
        </div>

        {/* Grille des stations */}
        <div className="flex flex-col gap-2">
          {/* Rangée du haut : gauche → droite */}
          <div className="flex items-stretch gap-2">
            {topStations.map((s, i) => (
              <Fragment key={s.video_id + "-" + i}>
                <StationCard station={s} number={i + 1} />
                {i < topStations.length - 1 && <Sep dir="right" />}
              </Fragment>
            ))}
            {bottomStations.length > 0 && (
              <div className="flex items-center"><ArrowDown className="text-chanv-terre/50" size={28} /></div>
            )}
          </div>

          {/* Repère central sens horaire */}
          <div className="flex items-center justify-center shrink-0">
            <span className={`badge-accent !text-sm inline-flex items-center gap-2 ${enTransition ? "animate-pulse" : ""}`}>
              <RotateCw size={16} /> Sens horaire
            </span>
          </div>

          {/* Rangée du bas : droite → gauche (numéros top+1..N) */}
          {bottomStations.length > 0 && (
            <div className="flex items-stretch gap-2">
              <div className="flex items-center"><ArrowUp className="text-chanv-terre/50" size={28} /></div>
              {bottomStations.map((s, i) => {
                const realNumber = N - i; // bottomStations[0] = station N
                return (
                  <Fragment key={s.video_id + "-" + i}>
                    {i > 0 && <Sep dir="left" />}
                    <StationCard station={s} number={realNumber} />
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Barre de contrôle compacte */}
        <div className="card flex items-center gap-3 py-3 px-5 shrink-0 flex-wrap">
          {!running ? (
            <button className="btn-primary !text-lg !px-8 !py-3" onClick={demarrer}>
              <Play className="inline mr-2" size={22} /> {ecoule === 0 ? "Démarrer" : "Reprendre"}
            </button>
          ) : (
            <button className="btn-primary !text-lg !px-8 !py-3" onClick={() => setRunning(false)}>
              <Pause className="inline mr-2" size={22} /> Pause
            </button>
          )}
          <button className="btn-secondary !px-5 !py-3" onClick={avancer} title="Forcer la rotation">
            <SkipForward className="inline mr-2" size={20} /> Rotation
          </button>
          <button className="btn-secondary !px-5 !py-3" onClick={reset}>
            <RotateCcw className="inline mr-2" size={20} /> Reset
          </button>
          <button
            className={auto ? "badge-accent !text-sm !px-4 !py-3" : "badge-neutral !text-sm !px-4 !py-3"}
            onClick={() => setAuto((a) => !a)}
          >
            {auto ? "Mode AUTO" : "Mode MANUEL"}
          </button>

          {/* Progression inline */}
          <div className="flex-1 min-w-[160px] flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-chanv-terre/10 overflow-hidden">
              <div className="h-full bg-chanv-beige transition-all duration-500" style={{ width: `${progression}%` }} />
            </div>
            <span className="text-sm font-bold text-chanv-terre whitespace-nowrap">{progression}% · {fmt(ecoule)}</span>
          </div>

          <div className="w-full md:w-auto md:min-w-[280px]">
            <SpotifyWidget ref={spotifyRef} />
          </div>
        </div>

        {termine && (
          <div className="card text-center py-8 shrink-0">
            <div className="text-5xl mb-2">🏁</div>
            <h3 className="text-2xl font-black text-chanv-terre">Circuit terminé !</h3>
            <p className="text-chanv-terre/70 mt-1">{totalRounds} tours · {N} stations</p>
            <button className="btn-primary mt-4" onClick={onQuitter}>Nouvelle séance</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Sep({ dir }: { dir: "right" | "left" }) {
  return (
    <div className="flex items-center text-chanv-terre/40 shrink-0">
      {dir === "right" ? <ArrowRight size={22} /> : <ArrowLeft size={22} />}
    </div>
  );
}

function StationCard({ station, number }: { station: ProgrammeExercice; number: number }) {
  return (
    <div className="relative flex-1 basis-0 min-w-0 h-[34vh] min-h-[200px] rounded-chanv overflow-hidden bg-chanv-terre">
      {station.video_url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={station.video_url} className="absolute inset-0 w-full h-full object-cover" autoPlay loop muted playsInline preload="auto" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-5xl">🏋️</div>
      )}

      {/* Numéro */}
      <span className="absolute top-2 left-2 w-9 h-9 rounded-full bg-chanv-beige text-chanv-terre font-black flex items-center justify-center shadow z-10">
        {number}
      </span>

      {/* Infos en surimpression bas */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
        <div className="font-black text-white leading-tight line-clamp-2" title={station.nom}>{station.nom}</div>
        <div className="text-xs text-white/80 mt-0.5">
          {station.valeur} {station.unite}
          {station.charge_h != null && ` · ♂ ${station.charge_h}`}
          {station.charge_f != null && ` ♀ ${station.charge_f}`}
        </div>
      </div>
    </div>
  );
}
