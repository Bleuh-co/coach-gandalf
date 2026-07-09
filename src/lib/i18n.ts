"use client";

/**
 * Mini-système i18n trilingue (FR/EN/ES), piloté par le hub Gandalf.
 *
 * - La langue vient de useGandalf().lang (headers au SSR, postMessage en live).
 * - Clés à plat `section.element` ; repli : fr, puis la clé elle-même.
 * - Interpolation optionnelle : t("dash.hello", { name: "Léa" }).
 *
 * Le dictionnaire vit dans i18n-dict.ts (module plat, partagé avec le
 * helper serveur getServerT de i18n-server.ts). Modèle xero_photo_achat.
 */

import { useCallback } from "react";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";
import { LANG_LOCALES, MESSAGES, format, type Lang, type Vars } from "./i18n-dict";

export type { Lang, Vars };
export { LANG_LOCALES, MESSAGES };

/**
 * Hook client : t(key) → traduction dans la langue live du hub Gandalf.
 * Repli : fr, puis la clé elle-même. Interpolation {var} optionnelle.
 */
export function useT(): (key: string, vars?: Vars) => string {
  const { lang } = useGandalf();
  return useCallback(
    (key: string, vars?: Vars) =>
      format(MESSAGES[lang]?.[key] ?? MESSAGES.fr[key] ?? key, vars),
    [lang],
  );
}

/** Locale de formatage courante (dates), alignée sur la langue du hub. */
export function useLocale(): string {
  const { lang } = useGandalf();
  return LANG_LOCALES[lang] ?? LANG_LOCALES.fr;
}
