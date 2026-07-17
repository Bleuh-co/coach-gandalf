import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import {
  SESSION_COOKIE,
  createSessionCookie,
  resolveRole,
  getSession,
  sessionCookieOptions,
  isEmailAllowed,
} from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  return NextResponse.json({ user: s });
}

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "idToken manquant" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch (e: any) {
    console.error("[session POST] verifyIdToken failed:", e?.code);
    return NextResponse.json(
      { error: "Token invalide", detail: e?.message, code: e?.code },
      { status: 401 }
    );
  }

  if (!(await isEmailAllowed(decoded.email))) {
    return NextResponse.json(
      { error: `Domaine email non autorisé: ${decoded.email}` },
      { status: 403 }
    );
  }

  // Résoudre le rôle AVANT de poser le cookie : un compte « blocked » ne doit
  // JAMAIS recevoir de cookie de session (sinon boucle de login).
  const email = decoded.email!;
  let role;
  try {
    role = await resolveRole(email);
  } catch (e: any) {
    console.error("[session POST] resolveRole failed:", e?.code);
    return NextResponse.json(
      { error: "Impossible de résoudre le rôle", detail: e?.message, code: e?.code },
      { status: 500 }
    );
  }
  if (role === "blocked") {
    // Contrat recette : le 403 porte { blocked, email } pour la carte de refus.
    return NextResponse.json(
      { error: "Accès non autorisé", blocked: true, email },
      { status: 403 }
    );
  }

  let cookie: string;
  try {
    cookie = await createSessionCookie(idToken);
  } catch (e: any) {
    console.error("[session POST] createSessionCookie failed:", e?.code);
    return NextResponse.json(
      { error: "Impossible de créer le cookie de session", detail: e?.message, code: e?.code },
      { status: 500 }
    );
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set({ ...sessionCookieOptions(), value: cookie });
  } catch (e: any) {
    console.error("[session POST] cookie set failed");
    return NextResponse.json({ error: "Cookie set failed", detail: e?.message }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      uid: decoded.uid,
      email,
      displayName: (decoded.name as string) || null,
      photoURL: (decoded.picture as string) || null,
      role,
    },
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
