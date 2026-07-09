/**
 * Dictionnaire trilingue FR/EN/ES de Coach Gandalf (chrome UI uniquement).
 *
 * IMPORTANT : le CONTENU généré (programmes IA, consignes de coaching,
 * annonces vocales TTS — données Firestore/LLM) n'est PAS traduit ici ;
 * seul le chrome l'est. Modèle elearning / xero_photo_achat.
 *
 * Module « plat » sans directive : importable côté client (src/lib/i18n.ts,
 * hook useT) comme côté serveur (src/lib/i18n-server.ts, getServerT).
 * Repli : fr, puis la clé elle-même. Interpolation {var} optionnelle.
 * ES : tutoiement (« tú »), comme le reste du parc.
 *
 * Le dictionnaire est assemblé depuis des fragments par domaine
 * (src/lib/i18n/*.ts) — parité stricte ×3 vérifiée par `npm run check:i18n`.
 */

import type { Lang, LangMessages } from "./i18n/types";
import { chromeMessages } from "./i18n/chrome";
import { selectionMessages } from "./i18n/selection";
import { seanceMessages } from "./i18n/seance";
import { programmesMessages } from "./i18n/programmes";
import { adminMessages } from "./i18n/admin";

export type { Lang };
export type Vars = Record<string, string | number>;

/** Locale de formatage (dates, nombres) par langue. */
export const LANG_LOCALES: Record<Lang, string> = {
  fr: "fr-CA",
  en: "en-CA",
  es: "es",
};

const FRAGMENTS: LangMessages[] = [
  chromeMessages,
  selectionMessages,
  seanceMessages,
  programmesMessages,
  adminMessages,
];

function merge(lang: Lang): Record<string, string> {
  return Object.assign({}, ...FRAGMENTS.map((f) => f[lang]));
}

export const MESSAGES: Record<Lang, Record<string, string>> = {
  fr: merge("fr"),
  en: merge("en"),
  es: merge("es"),
};

export function format(s: string, vars?: Vars): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** Traducteur autonome pour une langue donnée (sans contexte React). */
export function translator(lang: Lang) {
  return (key: string, vars?: Vars): string =>
    format(MESSAGES[lang]?.[key] ?? MESSAGES.fr[key] ?? key, vars);
}

export function normalizeLang(v: string | undefined | null): Lang {
  if (v === "en" || v === "es" || v === "fr") return v;
  return "fr";
}
