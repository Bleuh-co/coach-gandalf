import "server-only";
import type { AdminLike } from "@bleuh-co/gandalf-sdk-next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import { resolveRole, isEmailAllowed } from "./auth-server";

/**
 * Adaptateur firebase-admin → contrat AdminLike du SDK Gandalf.
 * L'app expose adminAuth()/adminDb() ; le SDK attend admin.auth()/admin.firestore().
 */
export const gandalfAdmin: AdminLike = {
  auth: () => adminAuth() as any,
  firestore: () => adminDb() as any,
};

/**
 * roleMapper : branche la résolution de rôle propre à Coach Gandalf dans le
 * SDK — règles EXACTES de l'ancien getSession, zéro régression :
 *   1. filtre de domaine (isEmailDomainAllowed) → sinon "blocked",
 *   2. resolveRole (bootstrap admins → user_app_roles `${email}__{COACHGANDA_APP_ID}`
 *      → users.role legacy → défaut "membre" pour les domaines autorisés).
 * "blocked" est listé dans noAccessRoles → refus (deny-by-default).
 */
export const coachGandalfRoleMapper = async (email: string): Promise<string> => {
  if (!(await isEmailAllowed(email))) return "blocked";
  return resolveRole(email);
};
