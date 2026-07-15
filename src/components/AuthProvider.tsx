"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";
import { isEmailDomainAllowed, allowedDomains } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Role } from "@/lib/types";
import { toast } from "sonner";

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
}

interface AuthContextValue {
  firebaseUser: User | null;
  session: SessionUser | null;
  loading: boolean;
  /** Email d'un compte authentifié mais refusé (rôle blocked) — carte de refus standard */
  deniedEmail: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);
  const t = useT();
  // Ref pour utiliser t() dans les callbacks sans re-créer les effets à
  // chaque changement de langue.
  const tRef = useRef(t);
  tRef.current = t;

  // Handoff SSO Gandalf (repli) : le hub colle #sso=<idToken Firebase> à
  // l'URL de l'iframe. On l'échange contre la session serveur (cookie
  // __session) — l'utilisateur connecté au hub entre sans écran de
  // connexion. Le hash est retiré immédiatement (jamais gardé en historique).
  // Le boot silencieux « cookie hub » (__gandalf_session), lui, passe par le
  // GET /api/session initial : getSession() côté serveur accepte ce cookie
  // via le SDK — aucun code client nécessaire.
  const ssoExchange = useRef<Promise<void> | null>(null);
  useEffect(() => {
    const m = window.location.hash.match(/#sso=([\w\-.]+)/);
    if (!m) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    ssoExchange.current = (async () => {
      try {
        await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken: m[1] }),
        });
      } catch {
        /* le login manuel reste disponible */
      }
    })();
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSession(data.user || null);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    const auth = firebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (!u) {
        // Attendre l'éventuel échange #sso en cours, puis tenter le boot
        // silencieux (cookie __session OU cookie hub __gandalf_session).
        if (ssoExchange.current) await ssoExchange.current;
        await refreshSession();
        setLoading(false);
        return;
      }
      if (!isEmailDomainAllowed(u.email)) {
        await fbSignOut(auth);
        toast.error(tRef.current("login.domainDenied", { domains: allowedDomains().join(", ") }));
        setSession(null);
        setLoading(false);
        return;
      }
      try {
        const idToken = await u.getIdToken(true);
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (res.ok) {
          const data = await res.json();
          setSession(data.user || null);
          setDeniedEmail(null);
        } else {
          const err = await res.json().catch(() => ({}));
          if (res.status === 403 && err.blocked) {
            // Carte de refus standard (contrat recette) — pas de toast en doublon.
            setDeniedEmail(err.email || u.email || "");
          } else {
            console.error("[AuthProvider] session POST failed:", res.status);
            toast.error(
              err.error
                ? `${err.error}${err.detail ? ` (${err.detail})` : ""}`
                : tRef.current("login.sessionRefused", { status: res.status })
            );
          }
          await fbSignOut(auth);
          setSession(null);
        }
      } catch (e) {
        console.error("[AuthProvider] unexpected error during session creation");
        setSession(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    const auth = firebaseAuth();
    setDeniedEmail(null);
    try {
      await signInWithPopup(auth, googleProvider());
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user") {
        toast.error(e?.message || tRef.current("login.failed"));
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" });
    // Le SDK accepte AUSSI le cookie hub __gandalf_session (.chanv.com) en repli :
    // sans le fermer côté hub, la session renaissait aussitôt et « Déconnexion »
    // ne faisait rien en standalone.
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com"}/api/sso/session`,
        { method: "DELETE", credentials: "include" }
      );
    } catch {
      /* hub injoignable — la session app est quand même fermée */
    }
    await fbSignOut(firebaseAuth());
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ firebaseUser, session, loading, deniedEmail, signInWithGoogle, signOut, refreshSession }),
    [firebaseUser, session, loading, deniedEmail, signInWithGoogle, signOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
