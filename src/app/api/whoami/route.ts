import { NextResponse } from "next/server";
import { getSession, resolveRoleVerbose } from "@/lib/auth-server";

export const runtime = "nodejs";

/**
 * Endpoint de diagnostic : montre EXACTEMENT comment l'app résout le
 * rôle de l'utilisateur connecté. Utile pour déboguer les soucis de
 * propagation des accès depuis le gestionnaire Gandalf.
 *
 * Passe par getSession() (SDK Gandalf) : accepte le cookie __session de
 * l'app, le cookie hub partagé __gandalf_session ET le Bearer — mêmes
 * garanties (audience, deny-by-default) que le reste de l'app.
 */
export async function GET() {
  const s = await getSession();
  if (!s) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const resolution = await resolveRoleVerbose(s.email);
  return NextResponse.json({ ...resolution, sessionRole: s.role });
}
