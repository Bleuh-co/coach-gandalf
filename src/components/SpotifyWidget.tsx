"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { Music, Play, Pause, SkipForward } from "lucide-react";
import { toast } from "sonner";

/**
 * Widget Spotify (Web Playback SDK) — modèle « compte gym persistant ».
 *
 * Le compte Spotify (Premium) est connecté une fois via OAuth ; l'access token
 * est obtenu/rafraîchi côté serveur (/api/spotify/token). Le widget gère :
 *  - connexion (bouton → /api/spotify/login)
 *  - lecteur Web Playback (device "Coach Gandalf")
 *  - sélection de playlist + démarrage (+ playlist par défaut)
 *  - play / pause / skip
 *  - ducking exposé via ref.duck() — baisse le volume ~20% pendant ~1,5s
 */

export interface SpotifyHandle {
  duck: (durationMs?: number) => void;
}

interface TrackInfo {
  name: string;
  artist: string;
  cover: string;
}

interface Playlist {
  id: string;
  name: string;
  uri: string;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: any;
  }
}

const API = "https://api.spotify.com/v1";

export const SpotifyWidget = forwardRef<SpotifyHandle>(function SpotifyWidget(_props, ref) {
  const [phase, setPhase] = useState<"loading" | "disconnected" | "connected">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const playerRef = useRef<any>(null);
  const deviceIdRef = useRef<string>("");
  const tokenRef = useRef<{ value: string; exp: number } | null>(null);
  const defaultPlaylistRef = useRef<string | null>(null);
  const startedRef = useRef(false);
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

  /** Access token frais (mis en cache jusqu'à expiration). */
  const fetchAccessToken = useCallback(async (): Promise<string | null> => {
    const now = Date.now();
    if (tokenRef.current && tokenRef.current.exp > now + 5000) return tokenRef.current.value;
    const r = await fetch("/api/spotify/token", { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    tokenRef.current = { value: d.access_token, exp: now + d.expires_in * 1000 };
    return d.access_token;
  }, []);

  const loadPlaylists = useCallback(async () => {
    const t = await fetchAccessToken();
    if (!t) return;
    try {
      const r = await fetch(`${API}/me/playlists?limit=50`, { headers: { authorization: `Bearer ${t}` } });
      if (!r.ok) return;
      const d = await r.json();
      setPlaylists(
        (d.items || []).map((p: any) => ({ id: p.id, name: p.name, uri: p.uri }))
      );
    } catch {}
  }, [fetchAccessToken]);

  const startPlaylist = useCallback(async (contextUri: string) => {
    const t = await fetchAccessToken();
    const deviceId = deviceIdRef.current;
    if (!t || !deviceId) return;
    try {
      await fetch(`${API}/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
        body: JSON.stringify({ context_uri: contextUri }),
      });
    } catch {}
  }, [fetchAccessToken]);

  // État de connexion au montage + gestion du retour OAuth (?spotify=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sp = params.get("spotify");
    if (sp) {
      if (sp === "connected") toast.success("Spotify connecté.");
      else if (sp === "denied") toast.error("Connexion Spotify refusée.");
      else if (sp) toast.error("Échec de la connexion Spotify.");
      params.delete("spotify");
      const q = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    }
    (async () => {
      try {
        const r = await fetch("/api/spotify/status", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          defaultPlaylistRef.current = d.defaultPlaylist || null;
          setEmail(d.email || null);
          setPhase(d.connected ? "connected" : "disconnected");
          return;
        }
      } catch {}
      setPhase("disconnected");
    })();
  }, []);

  // Charge le SDK + initialise le lecteur une fois connecté
  useEffect(() => {
    if (phase !== "connected") return;

    const init = () => {
      const Spotify = window.Spotify;
      if (!Spotify) return;
      const player = new Spotify.Player({
        name: "Coach Gandalf",
        getOAuthToken: async (cb: (t: string) => void) => {
          const t = await fetchAccessToken();
          if (t) cb(t);
        },
        volume: baseVolumeRef.current,
      });

      player.addListener("ready", async ({ device_id }: { device_id: string }) => {
        deviceIdRef.current = device_id;
        setReady(true);
        await loadPlaylists();
        if (defaultPlaylistRef.current && !startedRef.current) {
          startedRef.current = true;
          startPlaylist(defaultPlaylistRef.current);
        }
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
      player.addListener("authentication_error", () => {
        tokenRef.current = null;
        toast.error("Session Spotify expirée — reconnecte le compte.");
        setPhase("disconnected");
      });
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
  }, [phase, fetchAccessToken, loadPlaylists, startPlaylist]);

  const toggle = () => playerRef.current?.togglePlay().catch(() => {});
  const skip = () => playerRef.current?.nextTrack().catch(() => {});

  // --- Rendu --------------------------------------------------------------
  if (phase === "loading") {
    return (
      <div className="section-card flex items-center gap-2 text-chanv-terre/60">
        <Music size={18} /> <span className="text-sm">Chargement Spotify…</span>
      </div>
    );
  }

  if (phase === "disconnected") {
    return (
      <div className="section-card flex flex-col gap-2">
        <div className="flex items-center gap-2 text-chanv-terre/70">
          <Music size={18} />
          <span className="label !mb-0">Musique (Spotify Premium)</span>
        </div>
        <a className="btn-secondary text-sm text-center" href="/api/spotify/login">
          Se connecter à Spotify
        </a>
      </div>
    );
  }

  return (
    <div className="section-card flex flex-col gap-3">
      <div className="flex items-center gap-3">
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
            {track?.name || (ready ? "Prêt à jouer" : "Connexion au lecteur…")}
          </div>
          <div className="text-xs text-chanv-terre/60 truncate">{track?.artist || email || "Spotify"}</div>
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

      {ready && playlists.length > 0 && (
        <select
          className="input !py-2 text-sm"
          defaultValue=""
          onChange={(e) => e.target.value && startPlaylist(e.target.value)}
        >
          <option value="" disabled>Choisir une playlist…</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.uri}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  );
});
