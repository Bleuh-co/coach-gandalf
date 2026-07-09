export type Lang = "fr" | "en" | "es";

/** Fragment de dictionnaire : clés à plat `section.element`, ×3 langues. */
export type LangMessages = Record<Lang, Record<string, string>>;
