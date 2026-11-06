// Minifica el JS público ya copiado a _site (quita comentarios internos; sin source maps).
import { readdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "terser";
const dir = fileURLToPath(new URL("../_site/assets/js/", import.meta.url));
let before = 0, after = 0;
for (const f of await readdir(dir)) {
  const p = join(dir, f);
  if (f.endsWith(".map")) { await rm(p); continue; }
  if (!f.endsWith(".js") || f.endsWith(".min.js")) continue;
  const src = await readFile(p, "utf8");
  const out = await minify(src, { compress: true, mangle: true, format: { comments: false }, sourceMap: false });
  before += src.length; after += out.code.length;
  await writeFile(p, out.code);
}
console.log(`[minify-assets] ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`);
