#!/usr/bin/env node
/**
 * Muntrume Motorsport — Official Sketchfab CC0 / CC-BY 3D Model Fetcher
 *
 * Downloads real, car-specific .GLB models with open Creative Commons licenses
 * (CC0 / CC-BY) from the official Sketchfab Data API v3 for every car in
 * src/data/cars-index.json so ALL users of skins.muntru.me get real 3D models
 * automatically (zero local imports required).
 *
 * Usage:
 *   SKETCHFAB_TOKEN=<your_free_api_token> node scripts/fetch-sketchfab-models.mjs
 *   SKETCHFAB_TOKEN=... node scripts/fetch-sketchfab-models.mjs --category=GT3 --limit=20
 *   SKETCHFAB_TOKEN=... node scripts/fetch-sketchfab-models.mjs --slugs=porsche992rgt3,ferrari296gt3
 *
 * Outputs:
 *   - public/assets/models/<car_slug>.glb (or custom --out-dir for Cloudflare R2 upload)
 *   - src/data/models-manifest.json (consumed by src/lib/skins/preview-3d.ts)
 *   - src/data/models-credits.json (automatic CC-BY attribution list)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CARS_INDEX_PATH = path.join(ROOT, "src", "data", "cars-index.json");
const MANIFEST_PATH = path.join(ROOT, "src", "data", "models-manifest.json");
const CREDITS_PATH = path.join(ROOT, "src", "data", "models-credits.json");

const ALLOWED_LICENSES = new Set(["cc0", "by", "by-sa", "by-nc", "by-nc-sa"]);
const MAX_GLB_BYTES = 18 * 1024 * 1024; // 18 MB cap for fast WebGL loading

function parseArgs() {
  const args = {
    category: "",
    slugs: [],
    limit: 0,
    outDir: path.join(ROOT, "public", "assets", "models"),
    baseUrl: process.env.MODELS_CDN_BASE_URL || "/assets/models",
    overwrite: false,
  };
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith("--category=")) args.category = raw.slice(11).toLowerCase();
    else if (raw.startsWith("--slugs=")) args.slugs = raw.slice(8).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (raw.startsWith("--limit=")) args.limit = Math.max(0, Number(raw.slice(8)) || 0);
    else if (raw.startsWith("--out-dir=")) args.outDir = path.resolve(ROOT, raw.slice(10));
    else if (raw.startsWith("--base-url=")) args.baseUrl = raw.slice(11).replace(/\/+$/, "");
    else if (raw === "--overwrite") args.overwrite = true;
  }
  return args;
}

async function searchSketchfab(query, token) {
  const params = new URLSearchParams({
    type: "models",
    q: query,
    downloadable: "true",
    sort_by: "-likeCount",
    count: "12",
  });
  const res = await fetch(`https://api.sketchfab.com/v3/search?${params.toString()}`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) throw new Error(`Sketchfab search HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}

function pickBestCandidate(results) {
  for (const item of results) {
    const licSlug = String(item?.license?.slug || "").toLowerCase();
    if (!ALLOWED_LICENSES.has(licSlug)) continue;
    const faceCount = Number(item?.faceCount || 0);
    if (faceCount > 450_000) continue; // Keep WebGL frame rate smooth
    return item;
  }
  return null;
}

async function downloadGlb(uid, token, outPath) {
  const res = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) throw new Error(`Download API HTTP ${res.status}`);
  const payload = await res.json();
  const glbInfo = payload?.glb;
  if (!glbInfo?.url) throw new Error("Model has no .glb download URL");
  if (glbInfo.size && glbInfo.size > MAX_GLB_BYTES) {
    throw new Error(`GLB too large (${(glbInfo.size / 1048576).toFixed(1)} MB > ${MAX_GLB_BYTES / 1048576} MB)`);
  }

  const binRes = await fetch(glbInfo.url);
  if (!binRes.ok) throw new Error(`GLB binary HTTP ${binRes.status}`);
  const buf = Buffer.from(await binRes.arrayBuffer());
  if (buf.length < 4 || buf.toString("ascii", 0, 4) !== "glTF") {
    throw new Error("Downloaded file is not a valid binary glTF (.glb)");
  }
  if (buf.length > MAX_GLB_BYTES) {
    throw new Error(`GLB exceeds size cap (${(buf.length / 1048576).toFixed(1)} MB)`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const token = (process.env.SKETCHFAB_TOKEN || "").trim();
  if (!token) {
    console.error("[fetch-models] Missing SKETCHFAB_TOKEN environment variable.");
    console.error("  Get a free API token at: https://sketchfab.com/settings/password");
    console.error("  Run: $env:SKETCHFAB_TOKEN='your_token'; node scripts/fetch-sketchfab-models.mjs --category=GT3");
    process.exit(1);
  }

  const args = parseArgs();
  const carsIndex = loadJson(CARS_INDEX_PATH, { cars: [] });
  let targets = Array.isArray(carsIndex.cars) ? carsIndex.cars : [];

  if (args.slugs.length > 0) {
    const wanted = new Set(args.slugs);
    targets = targets.filter((c) => wanted.has(c.car_slug.toLowerCase()));
  } else if (args.category) {
    targets = targets.filter((c) => String(c.category || "").toLowerCase().includes(args.category));
  }
  if (args.limit > 0) targets = targets.slice(0, args.limit);

  const manifest = loadJson(MANIFEST_PATH, {
    base_url: args.baseUrl,
    updated_at: new Date().toISOString(),
    models: {},
  });
  manifest.base_url = args.baseUrl;

  const credits = loadJson(CREDITS_PATH, { updated_at: new Date().toISOString(), credits: {} });

  console.log(`[fetch-models] Searching Sketchfab (CC0/CC-BY .glb) for ${targets.length} car(s)...`);

  let downloaded = 0;
  for (const car of targets) {
    const slug = car.car_slug;
    const outPath = path.join(args.outDir, `${slug}.glb`);
    if (!args.overwrite && fs.existsSync(outPath)) {
      manifest.models[slug] = `${args.baseUrl}/${slug}.glb`;
      console.log(`  • ${slug}: already exists, skipping`);
      continue;
    }

    try {
      const results = await searchSketchfab(car.name, token);
      const best = pickBestCandidate(results);
      if (!best) {
        console.log(`  - ${slug} (${car.name}): no CC0/CC-BY .glb match under 450k faces`);
        continue;
      }
      const bytes = await downloadGlb(best.uid, token, outPath);
      manifest.models[slug] = `${args.baseUrl}/${slug}.glb`;
      credits.credits[slug] = {
        car_name: car.name,
        model_title: best.name,
        author: best.user?.displayName || best.user?.username || "Sketchfab Author",
        license: best.license?.label || best.license?.slug || "CC",
        source_url: best.viewerUrl || `https://sketchfab.com/3d-models/${best.uid}`,
        bytes,
      };
      downloaded++;
      console.log(
        `  ✓ ${slug} -> ${(bytes / 1048576).toFixed(2)} MB (${best.license?.slug}, "${best.name}" by ${credits.credits[slug].author})`
      );
      // Respect Sketchfab rate limit politely
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.warn(`  ✗ ${slug}: ${err.message}`);
    }
  }

  manifest.updated_at = new Date().toISOString();
  credits.updated_at = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  fs.writeFileSync(CREDITS_PATH, JSON.stringify(credits, null, 2) + "\n", "utf8");
  console.log(`[fetch-models] Done. Downloaded ${downloaded} new .glb file(s). Updated models-manifest.json & models-credits.json.`);
}

main().catch((err) => {
  console.error("[fetch-models] Fatal:", err);
  process.exit(1);
});
