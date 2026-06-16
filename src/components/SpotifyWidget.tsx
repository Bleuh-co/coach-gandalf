"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Music, Play, Pause, SkipForward } from "lucide-react";

/**
 * Widget Spotify (Web Playback SDK).
 *
 * Requiert un compte Premium + OAuth. Pour le MVP, le widget gère :
 *  - connexion via token OAuth (saisi ou via flux implicite)
 *  - play / pause / skip
 *  - ducking exposé via ref.duck() — baisse le volume ~20% pendant ~1,5s
 *
 * Si aucun token n'est fourni, le widget affiche un état "non connecté"
 * mais l'app reste pleinement fonctionnelle (cues sonores indépendants).
 */

export interface SpotifyHandle {
  /** Baisse le volume à ~20% pendant durationMs puis remonte en fondu. */
  duck: (durationMs?: number) => void;
}

interface TrackInfo {
  name: string;
  artist: string;
  cover: string;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

export const SpotifyWidget = forwardRef<SpotifyHandle>(function SpotifyWidget(_props, ref) {
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const playerRef = useRef<any>(null);
  const deviceIdRef = useRef<string>("");
  const baseVolumeRef = useRef<number>(0.7);
  const duckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    duck: (durationMs = 1500) => {
      const p = playerRef.current;
      if (!p) return;
      try {
        p.setVolume(baseVolumeRef.current * 0.2);
        if (duckTimer.current) clearTimeout(duckTimer.current);
        duckTimer.current = setTimeout(() => {
          // fondu de remontée
          const steps = 6;
          let i = 0;
          const target = baseVolumeRef.current;
          const start = target * 0.2;
          const iv = setInterval(() => {
            i++;
            const v = start + ((target - start) * i) / steps;
            try { p.setVolume(v); } catch {}
            if (i >= steps) clearInterval(iv);
          }, 80);
        }, durationMs);
      } catch {}
    },
  }));

  // Charge le SDK Spotify quand un token est fourni
  useEffect(() => {
    if (!token) return;

    const init = () => {
      const Spotify = window.Spotify;
      if (!Spotify) return;
      const player = new Spotify.Player({
        name: "Coach Gandalf",
        getOAuthToken: (cb: (t: string) => void) => cb(token),
        volume: baseVolumeRef.current,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id;
        setReady(true);
      });
      player.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setPlaying(!state.paused);
        const t = state.track_window?.current_track;
        if (t) {
          setTrack({
            name: t.name,
            artist: (t.artists || []).map((a: any) => a.name).join(", "),
            cover: t.album?.images?.[0]?.url || "",
          });
        }
      });
      player.addListener("authentication_error", () => setReady(false));
      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.getElementById("spotify-sdk")) {
        const s = document.createElement("script");
        s.id = "spotify-sdk";
        s.src = "https://sdk.scdn.co/spotify-player.js";
        s.async = true;
        document.body.appendChild(s);
      }
    }

    return () => {
      try { playerRef.current?.disconnect(); } catch {}
    };
  }, [token]);

  const toggle = () => playerRef.current?.togglePlay().catch(() => {});
  const skip = () => playerRef.current?.nextTrack().catch(() => {});

  if (!token) {
    return (
      <div className="section-card flex flex-col gap-2">
        <div className="flex items-center gap-2 text-chanv-terre/70">
          <Music size={18} />
          <span className="label !mb-0">Musique (Spotify Premium)</span>
        </div>
        <input
          className="input text-sm"
          placeholder="Coller un token OAuth Spotify…"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
        />
        <button
          className="btn-secondary text-sm"
          onClick={() => setToken(tokenInput.trim())}
          disabled={!tokenInput.trim()}
        >
          Connecter Spotify
        </button>
      </div>
    );
  }

  return (
    <div className="section-card flex items-center gap-3">
      {track?.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.cover} alt="" className="w-14 h-14 rounded-lg object-cover" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-chanv-terre/10 flex items-center justify-center">
          <Music size={22} className="text-chanv-terre/50" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-chanv-terre truncate">
          {track?.name || (ready ? "Prêt à jouer" : "Connexion…")}
        </div>
        <div className="text-xs text-chanv-terre/60 truncate">{track?.artist || "Spotify"}</div>
      </div>
      <div className="flex items-center gap-1">
        <button className="btn-secondary !px-3 !py-2" onClick={toggle} title={playing ? "Pause" : "Lecture"}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="btn-secondary !px-3 !py-2" onClick={skip} title="Suivant">
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
});
