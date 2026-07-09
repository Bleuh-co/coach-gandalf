import "server-only";
import { cookies, headers } from "next/headers";
import { normalizeLang, translator, type Lang, type Vars } from "./i18n-dict";

/**
 * Langue active côté serveur (Server Components) — modèle champs-numerique.
 * Pont Gandalf : en mode embarqué (x-gandalf-embedded=1, posé par le
 * middleware du SDK), le hub pilote la langue via x-gandalf-lang.
 * En standalone, le cookie `gandalf_lang` (posé par le middleware) fait foi.
 */
export async function getServerLang(): Promise<Lang> {
  const h = await headers();
  const fromHeader = h.get("x-gandalf-lang");
  if (fromHeader) return normalizeLang(fromHeader);
  return normalizeLang((await cookies()).get("gandalf_lang")?.value);
}

/** Helper de traduction côté serveur : const t = await getServerT(). */
export async function getServerT(): Promise<(key: string, vars?: Vars) => string> {
  const lang = await getServerLang();
  return translator(lang);
}
