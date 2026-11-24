import fs from "node:fs";
import path from "node:path";
import { TRACK_GALLERY_PHOTOS, PADDOCK_ALBUMS } from "../data/paddock-gallery";

export const MEDIA_API_BASE = "https://api.muntru.me";

export const CANONICAL_ALBUM_MAP: Record<string, { slug: string; car: string }> = {
  "chevrolet-corvette-z06-gt3r": { slug: "chevrolet-corvette-z06-gt3-r", car: "Chevrolet Corvette Z06 GT3.R" },
  "chevrolet-corvette-z06-gt3-r": { slug: "chevrolet-corvette-z06-gt3-r", car: "Chevrolet Corvette Z06 GT3.R" },
  "chevyvettez06rgt3": { slug: "chevrolet-corvette-z06-gt3-r", car: "Chevrolet Corvette Z06 GT3.R" },
  "super-formula-sf23": { slug: "super-formula-sf23", car: "Super Formula SF23" },
  "super-formula-sf23-toyota": { slug: "super-formula-sf23", car: "Super Formula SF23" },
  "porsche-911-cup-992-1": { slug: "porsche-911-cup-992-1", car: "Porsche 911 GT3 Cup (992.1)" },
  "porsche-911-gt3-cup": { slug: "porsche-911-cup-992-1", car: "Porsche 911 GT3 Cup (992.1)" },
  "porsche-911-gt3-cup-992": { slug: "porsche-911-cup-992-1", car: "Porsche 911 GT3 Cup (992.1)" },
  "porsche992cup": { slug: "porsche-911-cup-992-1", car: "Porsche 911 GT3 Cup (992.1)" },
  "porsche992rgt3": { slug: "porsche-911-gt3-r-992", car: "Porsche 911 GT3 R (992)" },
  "dirt-micro-sprint": { slug: "dirt-micro-sprint", car: "Dirt Outlaw Micro Sprint (Winged)" },
  "dirt-outlaw-micro-sprint-winged": { slug: "dirt-micro-sprint", car: "Dirt Outlaw Micro Sprint (Winged)" },
  "dirt-micro-sprint-non-winged": { slug: "dirt-micro-sprint-non-winged", car: "Dirt Outlaw Micro Sprint (Non-Winged)" },
  "dirt-outlaw-micro-sprint-non-winged": { slug: "dirt-micro-sprint-non-winged", car: "Dirt Outlaw Micro Sprint (Non-Winged)" },
};

export interface MediaCatalogItem {
  id: string;
  slugId: string;
  brand: string;
  model: string;
  carSlug: string;
  carClass: string;
  categoryKey: string;
  rawCategory: string;
  album: string;
  folder: string;
  title: string;
  filename: string;
  circuit: string;
  img: string;
  cleanFileBase: string;
  accentColor: string;
  width: number;
  height: number;
  aspectRatio: string;
}

export interface MediaAlbumPack {
  slug: string;
  title: string;
  carClass: string;
  count: number;
  cover: string;
  items: MediaCatalogItem[];
}

export interface MediaCatalogAudit {
  rawTotal: number;
  filteredStudioInteriorCount: number;
  afterFilterTotal: number;
}

const STUDIO_OR_BANNER_RE = /(series[-_]?banner|brand[-_]?logo|\/logo[._-]|thumb|main\.(webp|jpg|png)|badge|og-|preview|studio)/i;
const INTERIOR_RE = /(cockpit|interior|onboard|dash|wheel|volante|salpicadero|cabina|habitaculo|retrovisor|mirror)/i;

export function isExcludedPreviewOrInterior(src: string, metaText = ""): boolean {
  const lower = src.toLowerCase();
  if (lower.startsWith("/assets/cars/")) return true;
  if (STUDIO_OR_BANNER_RE.test(lower)) return true;
  if (INTERIOR_RE.test(`${lower} ${metaText.toLowerCase()}`)) return true;
  return false;
}

export function mapCategoryKey(rawCat: string, carName = "", title = ""): { key: string; label: string; accent: string } {
  const s = `${rawCat} ${carName} ${title}`.toLowerCase();
  if (/296\s*challenge|ferrari.*challenge/i.test(s)) return { key: "ferrari_challenge", label: "Challenge", accent: "#ef4444" };
  if (/nascar|stock|oval|camaro|silverado|tundra|arca|late\s*model|gen\s*4|taurus|pontiac\s*grand\s*prix/i.test(s)) return { key: "oval", label: "Oval", accent: "#fbbf24" };
  if (/bmw\s*m2|m2\s*cs|m2\s*racing|mx-?5|miata|gr86|clio|production/i.test(s)) return { key: "rookie", label: "PCC", accent: "#38bdf8" };
  if (/porsche/i.test(s) && /(911\s*gt3\s*cup|992(\.?[12])?\s*cup|991\s*cup|\bpcup\b)/i.test(s) && !/(gt3\s*r|gt4|963|rsr|cayman|mission\s*r)/i.test(s)) {
    return { key: "pcup", label: "PCup", accent: "#e2e8f0" };
  }
  if (/\bgtp\b|hypercar|lmdh|lmh|499p|963|v-series|arx-06|hybrid\s*v8|valkyrie/i.test(s)) return { key: "gtp", label: "GTP", accent: "#facc15" };
  if (/\blmp2\b|p217/i.test(s)) return { key: "lmp2", label: "LMP2", accent: "#38bdf8" };
  if (/\blmp3\b|ligier|jsp320|js\s*p320/i.test(s)) return { key: "lmp3", label: "LMP3", accent: "#06b6d4" };
  if (/\bgte\b|c8\.r|488\s*gte|911\s*rsr|m8\s*gte/i.test(s)) return { key: "gte", label: "GTE", accent: "#ef4444" };
  if (/\bgt4\b|570s|718\s*cayman/i.test(s)) return { key: "gt4", label: "GT4", accent: "#fb923c" };
  if (/\btcr\b|touring|rs\s*3|rs3|elantra|veloster|civic/i.test(s)) return { key: "tcr", label: "TCR", accent: "#22c55e" };
  if (/formula|sf23|\bsfl\b|ir18|ir04|\bf4\b|\bf3\b|ff1600|super\s*formula|vee|dallara\s*ir-?01/i.test(s)) return { key: "formulas", label: "Formula", accent: "#10b981" };
  if (/mission\s*r/i.test(s)) return { key: "electric", label: "Track", accent: "#38bdf8" };
  if (/dirt/i.test(s)) return { key: "dirt", label: "Dirt", accent: "#f59e0b" };
  if (/\bgt3\b/i.test(s)) return { key: "gt3", label: "GT3", accent: "#a855f7" };
  return { key: "track", label: "Track", accent: "#10b981" };
}

export async function loadOfficialMediaCatalog(publicDir: string): Promise<{
  items: MediaCatalogItem[];
  albums: MediaAlbumPack[];
  audit: MediaCatalogAudit;
}> {
  const seenImgs = new Set<string>();
  const items: MediaCatalogItem[] = [];
  const usedSlugs = new Set<string>();
  const slugCounter = new Map<string, number>();

  let rawTotal = 0;
  let filteredStudioInteriorCount = 0;

  function registerPhoto(raw: {
    id: string;
    brand: string;
    model: string;
    carSlug: string;
    rawCategory: string;
    album: string;
    title: string;
    circuit: string;
    img: string;
  }) {
    if (!raw.img) return;
    rawTotal++;
    const metaText = `${raw.album} ${raw.rawCategory} ${raw.model} ${raw.title} ${raw.circuit}`;
    if (isExcludedPreviewOrInterior(raw.img, metaText)) {
      filteredStudioInteriorCount++;
      return;
    }
    if (seenImgs.has(raw.img)) return;
    if (raw.img.startsWith("/") && !fs.existsSync(path.join(publicDir, raw.img))) return;
    seenImgs.add(raw.img);

    const mapped = mapCategoryKey(raw.rawCategory, raw.model, `${raw.title} ${raw.album}`);
    const parts = raw.img.split("/").filter(Boolean);
    const filename = parts[parts.length - 1] || raw.id;
    const folder = parts.length > 1 ? parts[parts.length - 2] : "";

    const cleanFileBase = `${raw.brand}_${raw.model}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const baseClass = mapped.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "track";
    const baseModel = raw.model
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 3)
      .join("-") || "car";
    const prefix = `mmt-${baseClass}-${baseModel}`;
    let seq = (slugCounter.get(prefix) || 0) + 1;
    let slugId = `${prefix}-${String(seq).padStart(2, "0")}`;
    while (usedSlugs.has(slugId)) {
      seq++;
      slugId = `${prefix}-${String(seq).padStart(2, "0")}`;
    }
    slugCounter.set(prefix, seq);
    usedSlugs.add(slugId);

    items.push({
      id: raw.id,
      slugId,
      brand: raw.brand,
      model: raw.model,
      carSlug: raw.carSlug,
      carClass: mapped.label,
      categoryKey: mapped.key,
      rawCategory: raw.rawCategory,
      album: raw.album,
      folder,
      title: raw.title,
      filename,
      circuit: raw.circuit,
      img: raw.img,
      cleanFileBase: cleanFileBase || raw.id,
      accentColor: mapped.accent,
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
    });
  }

  // 1. Fetch ALL published official photos from live /api/gallery (same source as gallery.astro)
  for (let offset = 0; offset <= 4000; offset += 200) {
    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/gallery?status=published&sort=popular&limit=200&offset=${offset}`);
      if (!res.ok) break;
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.photos) ? data.photos : [];
      if (!list.length) break;
      for (const p of list) {
        const st = String(p.sourceType || "").toLowerCase();
        const sp = String(p.sourcePlatform || "").toLowerCase();
        if (st === "community" || sp.includes("comunidad") || sp === "user_upload") continue;
        const url = String(p.imageUrl || p.url || "");
        const carName = String(p.car || p.title || "iRacing").trim();
        const rawSlug = String(p.carSlug || carName.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        const canon = CANONICAL_ALBUM_MAP[rawSlug.toLowerCase()];
        const finalCar = canon ? canon.car : carName;
        const finalSlug = canon ? canon.slug : rawSlug;
        const brand = finalCar.split(" ")[0] || "Muntrume";
        registerPhoto({
          id: String(p.id || `gal_${items.length}`),
          brand,
          model: finalCar,
          carSlug: finalSlug,
          rawCategory: String(p.category || ""),
          album: String(p.album || finalCar),
          title: String(p.title || finalCar),
          circuit: String(p.track || p.authorName || "Circuito Oficial iRacing"),
          img: url,
        });
      }
      if (list.length < 200) break;
    } catch {
      break;
    }
  }

  // 2. Fetch live albums from /v1/albums (same source as albums.astro)
  const albums: MediaAlbumPack[] = [];
  try {
    const res = await fetch(`${MEDIA_API_BASE}/v1/albums`);
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data?.albums) ? data.albums : [];
      const merged = new Map<string, { slug: string; car: string; category: string; cover: string }>();
      for (const raw of list) {
        const rawSlug = String(raw.slug || "").toLowerCase();
        const canon = CANONICAL_ALBUM_MAP[rawSlug];
        const key = canon ? `canon:${canon.slug}` : String(raw.car || rawSlug).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!merged.has(key)) {
          merged.set(key, {
            slug: canon ? canon.slug : String(raw.slug || ""),
            car: canon ? canon.car : String(raw.car || raw.slug || "Álbum"),
            category: String(raw.category || ""),
            cover: String(raw.cover || ""),
          });
        }
      }
      for (const a of merged.values()) {
        const mapped = mapCategoryKey(a.category, a.car, "");
        const matching = items.filter((w) => w.carSlug === a.slug || w.model.toLowerCase() === a.car.toLowerCase());
        if (matching.length > 0) {
          albums.push({
            slug: a.slug,
            title: a.car,
            carClass: mapped.label,
            count: matching.length,
            cover: a.cover || matching[0].img,
            items: matching,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Include local curated TRACK_GALLERY_PHOTOS & PADDOCK_ALBUMS
  for (const p of TRACK_GALLERY_PHOTOS) {
    registerPhoto({
      id: p.id,
      brand: p.title.split(" ")[0] || "Muntrume",
      model: p.title.replace(/·/g, "-"),
      carSlug: p.id,
      rawCategory: p.category,
      album: p.category,
      title: p.title,
      circuit: p.circuit,
      img: p.img,
    });
  }
  for (const album of PADDOCK_ALBUMS) {
    for (const ph of album.photos) {
      registerPhoto({
        id: ph.id,
        brand: album.brand,
        model: album.title,
        carSlug: album.slug,
        rawCategory: album.carClass,
        album: album.title,
        title: ph.subtitle || album.title,
        circuit: ph.subtitle || "Circuito Oficial iRacing",
        img: ph.img,
      });
    }
  }

  return {
    items,
    albums,
    audit: {
      rawTotal,
      filteredStudioInteriorCount,
      afterFilterTotal: items.length,
    },
  };
}
