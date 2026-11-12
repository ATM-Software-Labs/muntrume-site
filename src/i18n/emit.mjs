import { writeFileSync } from "node:fs";
import { dict } from "./dict.mjs";

const langs = ["en", "ca", "fr"];
for (const lang of langs) {
  const out = {};
  for (const [key, value] of Object.entries(dict)) {
    if (!value || typeof value[lang] !== "string" || !value[lang]) {
      throw new Error(`Missing ${lang} for ${key}`);
    }
    out[key] = value[lang];
  }
  writeFileSync(new URL(`../../public/assets/i18n/${lang}.json`, import.meta.url), JSON.stringify(out));
}
writeFileSync(new URL("../../public/assets/i18n/es.json", import.meta.url), "{}\n");
console.log(`[i18n] ${Object.keys(dict).length} keys → en, ca, fr`);
