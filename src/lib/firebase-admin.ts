import "server-only";
import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth as AdminAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore as AdminFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

declare global {
  // eslint-disable-next-line no-var
  var __coachGandaAdminApp: App | undefined;
  // eslint-disable-next-line no-var
  var __coachGandaAdminDb: AdminFirestore | undefined;
  // eslint-disable-next-line no-var
  var __coachGandaFirestoreSettingsApplied: boolean | undefined;
}

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (e) {
    console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON", e);
    return null;
  }
}

export function firebaseAdmin(): App {
  if (globalThis.__coachGandaAdminApp) return globalThis.__coachGandaAdminApp;
  const existing = getApps()[0];
  if (existing) {
    globalThis.__coachGandaAdminApp = existing;
    return existing;
  }
  const sa = getServiceAccount();
  const app = sa
    ? initializeApp({ credential: cert(sa), projectId: sa.project_id })
    : initializeApp({ credential: applicationDefault() });
  globalThis.__coachGandaAdminApp = app;
  return app;
}

export function adminAuth(): AdminAuth {
  return getAuth(firebaseAdmin());
}

export function adminDb(): AdminFirestore {
  if (globalThis.__coachGandaAdminDb) return globalThis.__coachGandaAdminDb;
  const db = getFirestore(firebaseAdmin());
  if (!globalThis.__coachGandaFirestoreSettingsApplied) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (e: any) {
      console.warn("[firebase-admin] settings() ignoré:", e?.message);
    }
    globalThis.__coachGandaFirestoreSettingsApplied = true;
  }
  globalThis.__coachGandaAdminDb = db;
  return db;
}

export function getServiceAccountForGoogle() {
  return getServiceAccount();
}

/**
 * Nom du bucket Cloud Storage. On réutilise NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * (déjà défini pour le SDK client). Variable serveur STORAGE_BUCKET prioritaire
 * si fournie séparément.
 */
export function storageBucketName(): string | undefined {
  return (
    process.env.STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    undefined
  );
}

/** Bucket Cloud Storage par défaut de l'app admin. */
export function adminStorageBucket() {
  return getStorage(firebaseAdmin()).bucket(storageBucketName());
}
