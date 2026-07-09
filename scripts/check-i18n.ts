/**
 * Vérification de parité i18n ×3 (fr/en/es) — `npm run check:i18n`.
 *
 * 1. Chaque fragment (src/lib/i18n/*.ts) doit exposer EXACTEMENT les mêmes
 *    clés en fr, en et es (parité stricte).
 * 2. Aucune clé dupliquée entre fragments (le merge écraserait en silence).
 * 3. Les placeholders {var} doivent être identiques dans les 3 langues.
 *
 * Sort avec un code ≠ 0 à la moindre violation (utilisable en CI).
 */
import { chromeMessages } from "../src/lib/i18n/chrome";
import { selectionMessages } from "../src/lib/i18n/selection";
import { seanceMessages } from "../src/lib/i18n/seance";
import { programmesMessages } from "../src/lib/i18n/programmes";
import { adminMessages } from "../src/lib/i18n/admin";
import type { Lang, LangMessages } from "../src/lib/i18n/types";

const FRAGMENTS: Record<string, LangMessages> = {
  chrome: chromeMessages,
  selection: selectionMessages,
  seance: seanceMessages,
  programmes: programmesMessages,
  admin: adminMessages,
};

const LANGS: Lang[] = ["fr", "en", "es"];
let errors = 0;
const seen = new Map<string, string>(); // clé → fragment

function placeholders(s: string): string {
  return (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(",");
}

for (const [name, frag] of Object.entries(FRAGMENTS)) {
  const ref = Object.keys(frag.fr).sort();
  for (const lang of LANGS.slice(1)) {
    const keys = Object.keys(frag[lang]).sort();
    const missing = ref.filter((k) => !(k in frag[lang]));
    const extra = keys.filter((k) => !(k in frag.fr));
    for (const k of missing) { console.error(`[${name}] clé manquante en ${lang}: ${k}`); errors++; }
    for (const k of extra) { console.error(`[${name}] clé orpheline en ${lang} (absente de fr): ${k}`); errors++; }
  }
  for (const k of ref) {
    const prev = seen.get(k);
    if (prev) { console.error(`[${name}] clé dupliquée avec le fragment "${prev}": ${k}`); errors++; }
    else seen.set(k, name);
    const ph = placeholders(frag.fr[k]);
    for (const lang of LANGS.slice(1)) {
      const v = frag[lang][k];
      if (v !== undefined && placeholders(v) !== ph) {
        console.error(`[${name}] placeholders divergents pour "${k}" en ${lang}: fr={${ph}} ${lang}={${placeholders(v)}}`);
        errors++;
      }
    }
  }
}

const total = seen.size;
if (errors) {
  console.error(`\ncheck:i18n — ÉCHEC : ${errors} violation(s) sur ${total} clés.`);
  process.exit(1);
}
console.log(`check:i18n — OK : ${total} clés, parité stricte fr/en/es.`);
