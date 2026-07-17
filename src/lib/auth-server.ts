import "server-only";
import { adminAuth, adminDb } from "./firebase-admin";
import { isEmailDomainAllowed } from "./utils";
import type { Role } from "./types";

const SESSION_COOKIE = "__session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5; // 5 jours

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  };
}

export interface SessionContext {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
}

const BOOTSTRAP_ADMINS = ["t.matteucci@chanv.com", "mathieu@lafeuilleverte.ca"];

function mapStandardRole(grade: string): Role {
  switch (grade) {
    case "Super Administrateur":
      return "superadmin";
    case "Administrateur":
      return "admin";
    case "Gestionnaire":
    case "Consulter":
      return "membre";
    case "Non visible":
      return "blocked";
    default:
      return "blocked";
  }
}

function mapLegacyToStandard(oldRole: string): string {
  switch (oldRole) {
    case "SuperAdmin":
      return "Super Administrateur";
    case "Admin":
      return "Administrateur";
    case "Gestionnaire":
      return "Gestionnaire";
    case "Employe":
      return "Consulter";
    default:
      // Deny-by-default : un rôle Hub inconnu (ex. « Invite ») ne donne PAS
      // « Consulter » — il tombe sur « Non visible » → blocked. Sinon un
      // whitelisté sans rôle app (doc users {invited:true} sans champ role)
      // tomberait à l'étape legacy_global et entrerait en Consulter/membre.
      return "Non visible";
  }
}

/**
 * Résout l'ID Firestore de l'app Coach Gandalf dans la collection `apps`.
 *
 * Priorité 1 : variable d'env COACHGANDA_APP_ID (direct, zéro ambiguïté).
 * Priorité 2 : matcher par nom dans la collection apps (fallback dev).
 */
async function resolveCoachGandaAppId(
  db: FirebaseFirestore.Firestore
): Promise<{ appId: string; appName: string | null }> {
  const override = process.env.COACHGANDA_APP_ID;
  if (override) {
    let appName: string | null = null;
    try {
      const snap = await db.collection("apps").doc(override).get();
      appName = (snap.data()?.name as string) || null;
    } catch {
      /* ignore */
    }
    return { appId: override, appName };
  }
  const appsSnap = await db.collection("apps").get();
  const match = appsSnap.docs.find((d) => {
    const name = (d.data().name || "").toLowerCase().replace(/\s+/g, "");
    return name.includes("coachgandalf") || (name.includes("coach") && name.includes("gandalf"));
  });
  return { appId: match?.id || "", appName: (match?.data().name as string) || null };
}

export interface RoleResolution {
  email: string;
  isBootstrap: boolean;
  appId: string;
  appName: string | null;
  userAppRoleGrade: string | null;
  legacyGlobalRole: string | null;
  source: "bootstrap" | "user_app_roles" | "legacy_global" | "default";
  role: Role;
}

/**
 * Variante "verbose" — retourne le détail de la résolution. Sert au
 * endpoint de diagnostic /api/whoami et à resolveRole().
 */
export async function resolveRoleVerbose(email: string): Promise<RoleResolution> {
  const emailKey = email.toLowerCase();
  const base: RoleResolution = {
    email: emailKey,
    isBootstrap: false,
    appId: "",
    appName: null,
    userAppRoleGrade: null,
    legacyGlobalRole: null,
    source: "default",
    role: "blocked",
  };

  // 1. Bootstrap
  if (BOOTSTRAP_ADMINS.includes(emailKey)) {
    return { ...base, isBootstrap: true, source: "bootstrap", role: "superadmin" };
  }

  const db = adminDb();

  // 2. user_app_roles via l'app ID (env override OU matcher par nom)
  try {
    const { appId, appName } = await resolveCoachGandaAppId(db);
    base.appId = appId;
    base.appName = appName;
    if (appId) {
      const roleDoc = await db.collection("user_app_roles").doc(`${emailKey}__${appId}`).get();
      if (roleDoc.exists) {
        const grade = (roleDoc.data()?.role || "") as string;
        base.userAppRoleGrade = grade;
        return { ...base, source: "user_app_roles", role: mapStandardRole(grade) };
      }
    }
  } catch (e) {
    console.warn("[auth] user_app_roles lookup failed", e);
  }

  // 3. users.role legacy (rôle global Hub) — fallback
  try {
    const userDoc = await db.collection("users").doc(emailKey).get();
    if (userDoc.exists) {
      const data = userDoc.data() || {};
      const hubRole = (data.role as string) || "Invite";
      base.legacyGlobalRole = hubRole;
      if (
        hubRole === "Super Administrateur" ||
        hubRole === "Administrateur" ||
        hubRole === "Gestionnaire" ||
        hubRole === "Consulter" ||
        hubRole === "Non visible"
      ) {
        return { ...base, source: "legacy_global", role: mapStandardRole(hubRole) };
      }
      return {
        ...base,
        source: "legacy_global",
        role: mapStandardRole(mapLegacyToStandard(hubRole)),
      };
    }
  } catch (e) {
    console.warn("[auth] users lookup failed", e);
  }

  // 4. Deny-by-default (décision recette) : sans rôle explicite (bootstrap,
  //    user_app_roles, rôle Hub reconnu) l'utilisateur est refusé à l'auth gate.
  //    AVANT : « membre » (Coach) ouvert à tout le domaine.
  return { ...base, source: "default", role: "blocked" };
}

/**
 * Résout le rôle pour un email donné. Priorité :
 *   1. Bootstrap admins → superadmin
 *   2. user_app_roles (clé `${email}__${appId}`) → mapping
 *   3. users.role legacy global → mapping (fallback)
 *   4. Default → membre
 */
export async function resolveRole(email: string): Promise<Role> {
  const r = await resolveRoleVerbose(email);
  return r.role;
}

// --- Whitelist (utilisateurs invites hors-domaine) ---------------------------
// Un email hors domaine (gmail, etc.) est autorise au gate SEULEMENT s'il a ete
// invite via le hub : users/{email}.invited === true. isEmailAllowed = domaine
// autorise OU whiteliste. Le ROLE decide ensuite (deny-by-default inchange).
export async function isWhitelisted(email: string | null | undefined): Promise<boolean> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return false;
  try {
    const doc = await adminDb().collection("users").doc(e).get();
    return doc.exists && doc.data()?.invited === true;
  } catch { return false; }
}
export async function isEmailAllowed(email: string | null | undefined): Promise<boolean> {
  if (isEmailDomainAllowed(email)) return true;
  return isWhitelisted(email);
}

export async function getSession(): Promise<SessionContext | null> {
  // Garde d'accès via le SDK Gandalf : cookie __session de l'app OU cookie de
  // session partagé du hub (__gandalf_session) OU Bearer, check d'audience,
  // deny-by-default. La résolution de rôle reste celle de l'app (domaine
  // autorisé + resolveRole) via coachGandalfRoleMapper — zéro régression.
  // Import dynamique pour éviter le cycle auth-server ↔ gandalf.
  const { verifySso, GandalfDenied } = await import("@bleuh-co/gandalf-sdk-next/server");
  const { gandalfAdmin, coachGandalfRoleMapper } = await import("./gandalf");
  try {
    const s = await verifySso(gandalfAdmin, {
      cookieName: SESSION_COOKIE,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      noAccessRoles: ["blocked"],
      roleMapper: coachGandalfRoleMapper,
    });
    return {
      uid: s.user.uid,
      email: s.user.email,
      displayName: s.user.name,
      photoURL: s.user.picture,
      role: s.role as Role,
    };
  } catch (e) {
    if (e instanceof GandalfDenied) return null;
    console.warn("[auth] getSession error", e);
    return null;
  }
}

export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}

/**
 * Exige `admin` ou `superadmin`.
 */
export async function requireAdmin(): Promise<SessionContext> {
  const s = await requireSession();
  if (s.role !== "admin" && s.role !== "superadmin") throw new Error("FORBIDDEN");
  return s;
}

/**
 * Exige `superadmin` (accès au backend d'administration des exercices/vidéos).
 */
export async function requireSuperadmin(): Promise<SessionContext> {
  const s = await requireSession();
  if (s.role !== "superadmin") throw new Error("FORBIDDEN");
  return s;
}

export { SESSION_COOKIE };
