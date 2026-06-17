import "server-only";
import { adminDb } from "./firebase-admin";

/**
 * Intégration Spotify — modèle « compte gym persistant ».
 *
 * Le compte Spotify du gym est connecté UNE fois via OAuth (Authorization Code).
 * Le refresh_token est stocké côté serveur (Firestore: config/spotify) ; l'écran
 * obtient ensuite des access tokens frais via /api/spotify/token sans re-login.
 *
 * Requiert un compte Spotify Premium (Web Playback SDK).
 */

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_DOC = "config/spotify";

export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

export function spotifyClientId(): string {
  const id = process.env.SPOTIFY_CLIENT_ID;
  if (!id) throw new Error("SPOTIFY_CLIENT_ID_MISSING");
  return id;
}

function clientSecret(): string {
  const s = process.env.SPOTIFY_CLIENT_SECRET;
  if (!s) throw new Error("SPOTIFY_CLIENT_SECRET_MISSING");
  return s;
}

export function redirectUri(): string {
  if (process.env.SPOTIFY_REDIRECT_URI) return process.env.SPOTIFY_REDIRECT_URI;
  const base = (process.env.APP_PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}/api/spotify/callback`;
}

/** Playlist lancée par défaut quand l'écran est prêt (URI ou ID, optionnel). */
export function defaultPlaylistUri(): string | null {
  const v = process.env.SPOTIFY_DEFAULT_PLAYLIST;
  if (!v) return null;
  if (v.startsWith("spotify:")) return v;
  // accepte un ID brut ou une URL
  const m = v.match(/playlist[/:]([a-zA-Z0-9]+)/);
  const id = m ? m[1] : v;
  return `spotify:playlist:${id}`;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: spotifyClientId(),
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "true",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${spotifyClientId()}:${clientSecret()}`).toString("base64");
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

/** Échange le code d'autorisation contre access + refresh tokens. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: basicAuthHeader() },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) {
    console.error("[spotify] exchange error", res.status, await res.text());
    throw new Error(`SPOTIFY_EXCHANGE_FAILED_${res.status}`);
  }
  return res.json();
}

/** Renouvelle un access token à partir du refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: basicAuthHeader() },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) {
    console.error("[spotify] refresh error", res.status, await res.text());
    throw new Error(`SPOTIFY_REFRESH_FAILED_${res.status}`);
  }
  return res.json();
}

// ----------------------------------------------------------------------
// Persistance Firestore (compte gym unique)
// ----------------------------------------------------------------------

export interface SpotifyConnection {
  refresh_token: string;
  scope: string | null;
  connected_email: string | null;
  connected_at: number;
}

export async function storeSpotifyConnection(conn: SpotifyConnection): Promise<void> {
  await adminDb().doc(SPOTIFY_DOC).set(conn, { merge: true });
}

export async function getSpotifyRefreshToken(): Promise<string | null> {
  const doc = await adminDb().doc(SPOTIFY_DOC).get();
  const rt = doc.exists ? (doc.data()?.refresh_token as string) : null;
  return typeof rt === "string" && rt ? rt : null;
}

export async function getSpotifyConnectionInfo(): Promise<{ connected: boolean; email: string | null }> {
  const doc = await adminDb().doc(SPOTIFY_DOC).get();
  if (!doc.exists || !doc.data()?.refresh_token) return { connected: false, email: null };
  return { connected: true, email: (doc.data()?.connected_email as string) || null };
}

export async function clearSpotifyConnection(): Promise<void> {
  await adminDb().doc(SPOTIFY_DOC).delete();
}
