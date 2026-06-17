"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipForward, RotateCcw, Zap, Heart, Flame, Activity } from "lucide-react";
import type { Programme, ProgrammeExercice } from "@/lib/types";
import { ExerciceVideo } from "./ExerciceVideo";
import { SpotifyWidget, type SpotifyHandle } from "./SpotifyWidget";
import { CountdownOverlay } from "./CountdownOverlay";
import { playCue, announce, unlockAudio } from "@/lib/audio-cues";

const PREP_S = 10; // compte à rebours « placez-vous » au démarrage

type Phase = "travail" | "repos" | "transition";
const TRANSITION_S = 10;

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function dureeTravail(ex: ProgrammeExercice): number {
  if (ex.duree_travail_s && ex.duree_travail_s > 0) return ex.duree_travail_s;
  if (ex.type_mesure === "temps") return ex.valeur;
  // estimation par défaut pour reps/distance/calories
  return 45;
}

interface Props {
  programme: Programme;
  onQuitter: () => void;
}

export function TableauBord({ programme, onQuitter }: Props) {
  const exercices = programme.exercices;
  const totalRounds = programme.rounds;

  const [auto, setAuto] = useState(true);
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(1);
  const [idx, setIdx] = useState(0); // index exercice dans le round
  const [phase, setPhase] = useState<Phase>("travail");
  const [restant, setRestant] = useState(() => dureeTravail(exercices[0]));
  const [ecoule, setEcoule] = useState(0);
  const [termine, setTermine] = useState(false);
  const [prep, setPrep] = useState<number | null>(null); // compte à rebours de départ

  // Métriques simulées (MVP)
  const [calories, setCalories] = useState(0);
  const [fc, setFc] = useState(120);
  const [rpe, setRpe] = useState(6);

  const spotifyRef = useRef<SpotifyHandle>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const exCourant = exercices[idx];
  const exSuivant = exercices[idx + 1] || (round < totalRounds ? exercices[0] : null);

  // Pendant le repos / la transition, on affiche le PROCHAIN exercice pour
  // que le groupe prépare son équipement.
  const enPreparation = phase === "repos" || phase === "transition";
  const exAffiche = enPreparation && exSuivant ? exSuivant : exCourant;

  // En pause ou en transition, on affiche la PROCHAINE consigne (préparation).
  const enPause = !running && !termine && ecoule > 0 && prep === null;
  const montrerProchaine = !!exSuivant && (enPreparation || enPause);
  const exConsigne = montrerProchaine && exSuivant ? exSuivant : exCourant;

  const totalEtapes = totalRounds * exercices.length;
  const etapeCourante = (round - 1) * exercices.length + idx + 1;
  const progression = Math.min(100, Math.round(((etapeCourante - 1) / totalEtapes) * 100));

  const duck = useCallback(() => spotifyRef.current?.duck(1500), []);

  // Avance vers la prochaine phase / exercice
  const avancer = useCallback(() => {
    setPhase((ph) => {
      if (ph === "travail") {
        playCue("fin_travail");
        duck();
        const repos = exCourant.duree_repos_s;
        if (repos && repos > 0) {
          setRestant(repos);
          return "repos";
        }
        // pas de repos → transition
        setRestant(TRANSITION_S);
        return "transition";
      }
      if (ph === "repos") {
        setRestant(TRANSITION_S);
        playCue("prochain");
        if (exSuivant) { duck(); announce(`Prochain exercice : ${exSuivant.nom}`); }
        return "transition";
      }
      // transition terminée → exercice/round suivant
      const nextIdx = idx + 1;
      if (nextIdx < exercices.length) {
        setIdx(nextIdx);
        setRestant(dureeTravail(exercices[nextIdx]));
        playCue("countdown");
        return "travail";
      }
      // fin du round
      if (round < totalRounds) {
        setRound((r) => r + 1);
        setIdx(0);
        setRestant(dureeTravail(exercices[0]));
        playCue("countdown");
        return "travail";
      }
      // fin de séance
      setRunning(false);
      setTermine(true);
      playCue("fin_seance");
      announce("Séance terminée. Bon travail !");
      return ph;
    });
  }, [exCourant, exSuivant, idx, round, totalRounds, exercices, duck]);

  // Compte à rebours « placez-vous » avant le démarrage réel
  useEffect(() => {
    if (prep === null || !running || termine) return;
    const id = setInterval(() => {
      setPrep((p) => {
        if (p === null) return null;
        const next = p - 1;
        if (next <= 0) {
          playCue("countdown");
          announce(`C'est parti ! ${exCourant.nom}`);
          return null;
        }
        if (next <= 3) playCue("countdown");
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [prep, running, termine, exCourant]);

  // Tick du chrono
  useEffect(() => {
    if (!running || termine || prep !== null) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    // Exercice « manuel » (reps/distance/cal) en phase travail : pas d'auto-avance.
    const manuelTravail = phase === "travail" && !!exCourant?.manuel;
    tickRef.current = setInterval(() => {
      setEcoule((e) => e + 1);
      // métriques simulées
      setCalories((c) => c + 0.18);
      setFc(() => 120 + Math.round(Math.sin(Date.now() / 4000) * 25 + Math.random() * 8));
      if (auto && !manuelTravail) {
        setRestant((r) => {
          if (r <= 1) {
            // déclenche l'avancement au prochain frame
            queueMicrotask(avancer);
            return 0;
          }
          if (r <= 4) playCue("countdown");
          return r - 1;
        });
      }
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running, termine, auto, avancer, prep, phase, exCourant]);

  const demarrer = () => {
    unlockAudio();
    setRunning(true);
    if (ecoule === 0) {
      // Premier départ : compte à rebours « placez-vous ».
      setPrep(PREP_S);
      announce("Placez-vous ! Départ dans 10 secondes.");
    }
  };

  const reset = () => {
    setRunning(false);
    setTermine(false);
    setPrep(null);
    setRound(1);
    setIdx(0);
    setPhase("travail");
    setRestant(dureeTravail(exercices[0]));
    setEcoule(0);
    setCalories(0);
    setRpe(6);
  };

  const phaseLabel = phase === "travail" ? "TRAVAIL" : phase === "repos" ? "REPOS" : "TRANSITION";
  const phaseColor =
    phase === "travail" ? "badge-accent" : phase === "repos" ? "badge-neutral" : "badge-neutral";

  return (
    <div className="flex flex-col gap-4">
      {prep !== null && <CountdownOverlay value={prep} />}
      {/* En-tête séance */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-chanv-terre uppercase tracking-tight">{programme.nom}</h2>
          <p className="text-sm text-chanv-terre/60 uppercase tracking-widest">
            {programme.type} · {programme.format.replace("_", " ")} · {programme.niveau}
          </p>
        </div>
        <button className="btn-secondary" onClick={onQuitter}>← Nouvelle séance</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vidéo centrale */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className={phaseColor}>{phaseLabel}</span>
            <span className="text-lg font-bold text-chanv-terre">
              Round {round}/{totalRounds}
            </span>
          </div>

          <ExerciceVideo
            videoUrl={exAffiche.video_url}
            preloadVideoUrl={exSuivant?.video_url}
            label={exAffiche.nom}
            upcoming={enPreparation && !!exSuivant}
          />

          {/* Chrono géant (ou cible si exercice manuel) */}
          <div className="card flex flex-col items-center justify-center py-6">
            {phase === "travail" && exCourant.manuel ? (
              <>
                <span className="text-7xl font-black tabular-nums text-chanv-terre">
                  {exCourant.valeur} <span className="text-4xl">{exCourant.unite}</span>
                </span>
                <span className="text-sm text-chanv-terre/60 uppercase tracking-widest mt-1">
                  Appuyez sur « Suivant » une fois terminé
                </span>
              </>
            ) : (
              <span className="text-8xl font-black tabular-nums text-chanv-terre">{fmt(restant)}</span>
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
            <button className="btn-secondary !text-lg !px-6 !py-4" onClick={avancer} title="Avancer manuellement">
              <SkipForward className="inline mr-2" size={22} /> Suivant
            </button>
            <button className="btn-secondary !text-lg !px-6 !py-4" onClick={reset}>
              <RotateCcw className="inline mr-2" size={22} /> Reset
            </button>
            <button
              className={auto ? "badge-accent !text-sm !px-4 !py-3" : "badge-neutral !text-sm !px-4 !py-3"}
              onClick={() => setAuto((a) => !a)}
              title="Basculer auto / manuel"
            >
              {auto ? "Mode AUTO" : "Mode MANUEL"}
            </button>
          </div>
        </div>

        {/* Colonne droite : prochain, infos, spotify */}
        <div className="flex flex-col gap-4">
          {/* Prochain exercice */}
          <div className="section-card">
            <span className="label">Prochain exercice</span>
            {exSuivant ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎯</span>
                <div>
                  <div className="text-xl font-bold text-chanv-terre">{exSuivant.nom}</div>
                  <div className="text-sm text-chanv-terre/60">
                    {exSuivant.valeur} {exSuivant.unite}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-chanv-terre/60 font-semibold">Dernier exercice du round 🏁</div>
            )}
          </div>

          {/* Détail consigne (courante, ou prochaine en pause/transition) */}
          <div className={`section-card ${montrerProchaine ? "!border-chanv-beige" : ""}`}>
            <span className="label">{montrerProchaine ? "Prochaine consigne" : "Consigne actuelle"}</span>
            <div className="text-lg font-bold text-chanv-terre">
              {montrerProchaine && <span className="text-chanv-terre/60">{exConsigne.nom} · </span>}
              {exConsigne.valeur} {exConsigne.unite}
            </div>
            {(exConsigne.charge_h || exConsigne.charge_f) && (
              <div className="flex gap-2 mt-2">
                {exConsigne.charge_h != null && (
                  <span className="badge-neutral">♂ {exConsigne.charge_h} lbs</span>
                )}
                {exConsigne.charge_f != null && (
                  <span className="badge-neutral">♀ {exConsigne.charge_f} lbs</span>
                )}
              </div>
            )}
            {exConsigne.consignes && (
              <p className="text-sm text-chanv-terre/70 mt-2">{exConsigne.consignes}</p>
            )}
          </div>

          {/* Spotify */}
          <SpotifyWidget ref={spotifyRef} />
        </div>
      </div>

      {/* Barre de progression */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="label !mb-0">Progression de la séance</span>
          <span className="font-bold text-chanv-terre">{progression}% · {fmt(ecoule)} écoulé</span>
        </div>
        <div className="w-full h-4 rounded-full bg-chanv-terre/10 overflow-hidden">
          <div
            className="h-full bg-chanv-beige transition-all duration-500"
            style={{ width: `${progression}%` }}
          />
        </div>
      </div>

      {/* Métriques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile icon={<Flame size={28} />} label="Calories" value={Math.round(calories).toString()} />
        <MetricTile icon={<Heart size={28} />} label="Fréq. card." value={`${fc} bpm`} />
        <MetricTile icon={<Activity size={28} />} label="Rounds" value={`${round}/${totalRounds}`} />
        <MetricTile
          icon={<Zap size={28} />}
          label="RPE moyen"
          value={
            <input
              type="number"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="input !w-20 !py-1 text-center"
            />
          }
        />
      </div>

      {termine && (
        <div className="card text-center py-8">
          <div className="text-5xl mb-2">🏁</div>
          <h3 className="text-2xl font-black text-chanv-terre">Séance terminée !</h3>
          <p className="text-chanv-terre/70 mt-1">
            {Math.round(calories)} cal · {totalRounds} rounds · RPE {rpe}
          </p>
          <button className="btn-primary mt-4" onClick={onQuitter}>Nouvelle séance</button>
        </div>
      )}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="section-card !p-4 flex items-center gap-3">
      <div className="text-chanv-terre">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-chanv-terre/60">{label}</div>
        <div className="text-2xl font-black text-chanv-terre leading-tight">{value}</div>
      </div>
    </div>
  );
}
