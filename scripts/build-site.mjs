// Construye _site/ para GitHub Pages:
//  1) copia solo los archivos públicos (nada de worker/, functions/, scripts/, test/, .github/ ni notas internas);
//  2) genera /p/<alias>/ (no /pilotos/<alias>/: chocaría con pilotos.html en Pages) para cada perfil PÚBLICO (public_visible=1) leído de la API pública del Worker,
//     con <title>, OG y JSON-LD Person propios; si la API falla, no se genera nada y el sitio sigue funcionando
//     (el 404.html redirige /p/<alias> y /pilotos/<alias> a /pilotos?p=<alias>).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "_site");
const API = "https://muntrume.atrumin16.workers.dev/api/pilots";
const SITE = "https://muntru.me";
const EXCLUDE = new Set([".git", ".github", "_site", "worker", "functions", "scripts", "test", "node_modules",
  "wrangler.jsonc", ".env.example", ".gitignore", "AUDIT.md", "README.md", "SECURITY.md", "CODEOWNERS"]);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const name of fs.readdirSync(ROOT)) {
  if (EXCLUDE.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}
// Valores de setup de origen desconocido que ya no usa ningún código: no se publican (siguen en el repo hasta que Alberto decida).
fs.rmSync(path.join(OUT, "assets/data/setup_telemetry_previews.json"), { force: true });

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ldSafe = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

let pilots = [];
try {
  const r = await fetch(API, { headers: { "User-Agent": "muntrume-pages-build" } });
  const d = r.ok ? await r.json() : null;
  if (d && d.success && Array.isArray(d.pilots)) pilots = d.pilots.filter((p) => p && SLUG_RE.test(String(p.slug || "")));
  console.log(`perfiles públicos: ${pilots.length}`);
} catch (e) {
  console.warn("API de pilotos no disponible; se omiten las páginas de piloto:", e.message);
}

const tpl = fs.readFileSync(path.join(ROOT, "pilotos.html"), "utf8");
const sitemapUrls = [];
for (const p of pilots) {
  const url = `${SITE}/p/${p.slug}/`;
  const title = `${p.name} · Muntrume Motorsport`;
  const desc = [p.name, p.team, p.car_class].filter(Boolean).join(" · ") + (p.bio ? ` — ${p.bio}` : " — Muntrume Motorsport");
  const person = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "ProfilePage", url, name: title, mainEntity: { "@id": `${url}#person` } },
      {
        "@type": "Person", "@id": `${url}#person`, name: p.name, url,
        ...(p.photo ? { image: p.photo } : {}),
        ...(p.bio ? { description: p.bio } : {}),
        memberOf: { "@type": "SportsTeam", name: "Muntrume Motorsport", url: `${SITE}/` },
        ...((p.links || []).length ? { sameAs: p.links.map((l) => l.url) } : {}),
      },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Pilots", item: `${SITE}/pilotos` },
        { "@type": "ListItem", position: 3, name: p.name, item: url },
      ] },
    ],
  };
  let html = tpl
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1profile$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/<script type="application\/ld\+json" data-seo>[\s\S]*?<\/script>/, `<script type="application/ld+json" data-seo data-person>${ldSafe(person)}</script>`)
    .replace(/(<link rel="alternate" hreflang="(es|en|ca|fr)" href=")https:\/\/muntru\.me\/pilotos\?lang=/g, `$1${url}?lang=`)
    .replace(/(<link rel="alternate" hreflang="x-default" href=")https:\/\/muntru\.me\/pilotos(")/, `$1${url}$2`)
    .replace('<script src="/assets/js/pilots.js', `<script>window.MM_PILOT_SLUG=${JSON.stringify(p.slug)};</script>\n  <script src="/assets/js/pilots.js`)
    .replace('<section id="pilotList">', '<section id="pilotList" hidden>')
    .replace('<article id="pilotDetail" class="pl-detail" hidden></article>',
      `<article id="pilotDetail" class="pl-detail"><a class="pl-back" href="/pilotos"><span aria-hidden="true">←</span> <span>All pilots</span></a><div class="pl-hero"><h1>${esc(p.name)}</h1>${p.bio ? `<p class="pl-bio">${esc(p.bio)}</p>` : ""}</div></article>`);
  const dir = path.join(OUT, "p", p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  sitemapUrls.push(url);
}

if (sitemapUrls.length) {
  const sm = path.join(OUT, "sitemap.xml");
  const today = new Date().toISOString().slice(0, 10);
  const extra = sitemapUrls.map((u) => `    <url>\n        <loc>${u}</loc>\n        <lastmod>${today}</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>0.5</priority>\n    </url>`).join("\n");
  fs.writeFileSync(sm, fs.readFileSync(sm, "utf8").replace("</urlset>", `${extra}\n</urlset>`));
}
console.log(`listo: ${sitemapUrls.length} página(s) de piloto`);
