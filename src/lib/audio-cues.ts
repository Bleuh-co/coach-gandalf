"use client";

/**
 * Gestion des cues sonores via Web Audio API — canal SÉPARÉ de Spotify.
 *
 * - Les bips sont générés par oscillateur (aucun asset requis).
 * - Le "ducking" est délégué via un callback (onDuck) fourni par le widget
 *   Spotify, car on ne peut pas injecter de son dans le flux Spotify.
 * - L'annonce vocale TTS utilise la Web Speech API.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Joue un bip simple. freq en Hz, duree en secondes. */
function beep(freq: number, duree: number, gain = 0.25) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.02);
  g.gain.linearRampToValueAtTime(0, c.currentTime + duree);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duree + 0.05);
}

export type CueType = "fin_travail" | "debut_repos" | "prochain" | "countdown" | "fin_seance";

/** Doit être appelé une fois au premier geste utilisateur (clic) pour débloquer l'audio. */
export function unlockAudio() {
  getCtx();
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // pré-chauffe le TTS
      const u = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(u);
    }
  } catch {}
}

export function playCue(type: CueType) {
  switch (type) {
    case "fin_travail":
      beep(880, 0.15);
      setTimeout(() => beep(660, 0.2), 160);
      break;
    case "debut_repos":
      beep(440, 0.3);
      break;
    case "prochain":
      beep(740, 0.12);
      setTimeout(() => beep(988, 0.18), 130);
      break;
    case "countdown":
      beep(600, 0.1);
      break;
    case "fin_seance":
      beep(880, 0.2);
      setTimeout(() => beep(1046, 0.2), 200);
      setTimeout(() => beep(1318, 0.4), 400);
      break;
  }
}

/** Annonce vocale TTS (Web Speech API). */
export function announce(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-CA";
    u.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}
