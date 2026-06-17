import "server-only";
import { NextResponse } from "next/server";
import { requireSuperadmin, type SessionContext } from "./auth-server";

/**
 * Garde-fou commun aux routes /api/admin : exige une session `superadmin`.
 * Renvoie soit la session, soit une NextResponse d'erreur prête à retourner.
 */
export async function guardSuperadmin(): Promise<
  { session: SessionContext; error?: never } | { session?: never; error: NextResponse }
> {
  try {
    const session = await requireSuperadmin();
    return { session };
  } catch (e) {
    const msg = (e as Error)?.message;
    if (msg === "UNAUTHORIZED") {
      return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
    }
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
}
