import fs from "node:fs";
import path from "node:path";
import { CAR_CATALOG_LIST, type CarMetadata } from "../../desktop/src/cars/catalog";
import schedule from "../../desktop/src/season_schedule_2026_s4.json";
import manifestData from "../data/wallpaper-manifest.json";
import { getCarOfficialSeries } from "./car-series";
import {
  hasBlockedPathSegment,
  isAllowedManifestPath,
  isAllowedRemoteWallpaper,
  pathnameOf,
} from "./wallpaper-allowlist";

const API_BASE = "https://muntrume.atrumin16.workers.dev";

export interface WallpaperItem {
  id: string;
  brand: string;
  model: string;
  carSlug: string;
  carClass: string;
  categoryKey: string;
  circuit: string;
  img: string;
  cleanFileBase: string;
  accentColor: string;
  title: string;
  alt: string;
  seriesId: string;
  seriesSlug: string;
  seriesName: string;
  seriesKind: "series" | "category";
  seriesOrder: number;
  shotIndex: number;
}

export interface WallpaperSeries {
  id: string;
  slug: string;
  name: string;
  kind: "series" | "category";
  order: number;
  accent: string;
  items: WallpaperItem[];
}

export interface WallpaperAlbum {
  slug: string;
  title: string;
  carClass: string;
  count: number;
  cover: string;
  items: WallpaperItem[];
  seriesOrder: number;
}

export interface RejectedWallpaper {
  img: string;
  id: string;
  reason: string;
}

export interface WallpaperCatalog {
  items: WallpaperItem[];
  series: WallpaperSeries[];
  albums: WallpaperAlbum[];
  rejected: RejectedWallpaper[];
}

interface ManifestEntry {
  id: string;
  img: string;
  title: string;
  car: string;
  circuit: string;
  category: string;
}

interface GalleryPhoto {
  id?: string;
  title?: string;
  car?: string;
  category?: string;
  track?: string;
  carSlug?: string;
  imageUrl?: string;
  url?: string;
  isOfficialPress?: boolean;
  sourceType?: string;
}

interface ScheduleSeries {
  id: string;
  name: string;
  cars?: string[];
}

/**
 * Imágenes de muntru.me que la página pública mezclaba con los wallpapers
 * (galería estática de paddock y gráficos de serie). No son wallpapers.
 */
export const REMOVED_PUBLIC_LEAKS: readonly RejectedWallpaper[] = [
  {
    img: "/assets/img/hero-bg.webp",
    id: "paddock-telemetry-pit",
    reason: "Asset de paddock/telemetría (hero-bg), no es un wallpaper.",
  },
  {
    img: "/assets/img/series/imsa.jpg",
    id: "gtp-lemans-dusk",
    reason: "Gráfico de la serie IMSA, no es una foto de wallpaper.",
  },
  {
    img: "/assets/img/series/gt-sprint.jpg",
    id: "gt3-sprint-grid",
    reason: "Gráfico de la serie GT Sprint, no es una foto de wallpaper.",
  },
  {
    img: "/assets/img/series/porsche-cup.jpg",
    id: "night-cup-endurance",
    reason: "Gráfico de la serie Porsche Cup, no es una foto de wallpaper.",
  },
];

const SERIES_ORDER = new Map<string, number>(
  ((schedule as { series?: ScheduleSeries[] }).series ?? []).map((series, index) => [series.id, index]),
);

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function findCatalogCar(name: string): CarMetadata | undefined {
  const n = norm(name);
  if (!n) return undefined;
  let best: { car: CarMetadata; score: number } | undefined;
  for (const car of CAR_CATALOG_LIST) {
    const full = norm(`${car.brand} ${car.model}`);
    const model = norm(car.model);
    let score = 0;
    if (n === full) score = 1000 + full.length;
    else if (model.length >= 6 && n === model) score = 800 + model.length;
    else if (full.length >= 8 && n.includes(full)) score = 700 + full.length;
    else if (model.length >= 8 && n.includes(model)) score = 500 + model.length;
    else if (n.length >= 10 && full.startsWith(n)) score = 650 + n.length;
    if (score > 0 && (!best || score > best.score)) best = { car, score };
  }
  return best?.car;
}

function shotIndexOf(title: string, img: string): number {
  const fromTitle = /#(\d+)/.exec(title);
  if (fromTitle) return Number(fromTitle[1]);
  const file = img.split("/").pop() || "";
  const fromFile = /-(\d+)\.[a-z0-9]+$/i.exec(file);
  return fromFile ? Number(fromFile[1]) : 0;
}

function cleanFileBase(brand: string, model: string, id: string): string {
  const base = `${brand}_${model}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || id;
}

function cleanSeriesName(name: string): string {
  return name
    .replace(/\s*-\s*2026 Season(?:\s*\d+)?(?:\s*-?\s*Fixed)?\s*$/i, "")
    .replace(/\s+2026 Season(?:\s*\d+)?(?:\s*-?\s*Fixed)?\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function seriesListedInSchedule(carName: string): { id: string; name: string; order: number } | undefined {
  const n = norm(carName);
  if (n.length < 6) return undefined;
  const all = (schedule as { series?: ScheduleSeries[] }).series ?? [];
  for (let index = 0; index < all.length; index++) {
    const series = all[index];
    if ((series.cars ?? []).some((listed) => norm(listed) === n)) {
      return { id: series.id, name: cleanSeriesName(series.name), order: index };
    }
  }
  return undefined;
}

function categorySlug(category: string): string {
  const key = (category || "otros").toLowerCase().replace(/[^a-z0-9]+/g, "") || "otros";
  return `clase-${key}`;
}

function displayBrand(car: CarMetadata | undefined, carName: string): string {
  if (car && car.brand !== "Sin fabricante único") return car.brand;
  return carName.split(" ")[0] || "";
}

function displayModel(car: CarMetadata | undefined, carName: string): string {
  if (carName.trim()) return carName.trim();
  if (car && car.brand !== "Sin fabricante único") return `${car.brand} ${car.model}`;
  return car?.model || "";
}

function assignSeries(carName: string, category: string): {
  seriesId: string;
  seriesSlug: string;
  seriesName: string;
  seriesKind: "series" | "category";
  seriesOrder: number;
  accent: string;
  brand: string;
  model: string;
  carClass: string;
  carSlug: string;
} {
  const car = findCatalogCar(carName);
  const official = car ? getCarOfficialSeries(car)[0] : undefined;
  const listed = official ? undefined : seriesListedInSchedule(carName);
  if (listed) {
    return {
      seriesId: listed.id,
      seriesSlug: listed.id,
      seriesName: listed.name,
      seriesKind: "series",
      seriesOrder: listed.order,
      accent: car?.accentColor || "#C0C0C0",
      brand: displayBrand(car, carName),
      model: displayModel(car, carName),
      carClass: car?.carClass || category.toUpperCase(),
      carSlug: car?.carFolder || norm(carName),
    };
  }
  if (official) {
    return {
      seriesId: official.id,
      seriesSlug: official.id,
      seriesName: cleanSeriesName(official.name),
      seriesKind: "series",
      seriesOrder: SERIES_ORDER.get(official.id) ?? 9000,
      accent: car?.accentColor || "#C0C0C0",
      brand: displayBrand(car, carName),
      model: displayModel(car, carName),
      carClass: car?.carClass || category.toUpperCase(),
      carSlug: car?.carFolder || norm(carName),
    };
  }
  const key = (category || "otros").toLowerCase();
  return {
    seriesId: categorySlug(key),
    seriesSlug: categorySlug(key),
    seriesName: key.toUpperCase(),
    seriesKind: "category",
    seriesOrder: 10000 + key.charCodeAt(0),
    accent: car?.accentColor || "#C0C0C0",
    brand: displayBrand(car, carName),
    model: displayModel(car, carName) || key.toUpperCase(),
    carClass: car?.carClass || key.toUpperCase(),
    carSlug: car?.carFolder || norm(carName || key),
  };
}

function altText(title: string, model: string, circuit: string): string {
  const base = title.trim() || model.trim();
  if (!circuit.trim() || base.toLowerCase().includes(circuit.trim().toLowerCase())) return base;
  return `${base} · ${circuit.trim()}`;
}

function loadManifest(): ManifestEntry[] {
  const entries = manifestData as ManifestEntry[];
  const publicDir = path.join(process.cwd(), "public");
  const paths = new Set(entries.map((entry) => pathnameOf(entry.img)));
  for (const entry of entries) {
    const imgPath = pathnameOf(entry.img);
    if (!isAllowedManifestPath(imgPath, paths)) {
      throw new Error(`[wallpapers] El manifiesto incluye una ruta no permitida: ${entry.img}`);
    }
    if (hasBlockedPathSegment(imgPath)) {
      throw new Error(`[wallpapers] El manifiesto incluye un segmento bloqueado: ${entry.img}`);
    }
    if (!fs.existsSync(path.join(publicDir, imgPath))) {
      throw new Error(`[wallpapers] El manifiesto apunta a un archivo que no existe: ${entry.img}`);
    }
  }
  return entries;
}

async function fetchOfficialPhotos(): Promise<{ photos: GalleryPhoto[]; albums: Array<Record<string, unknown>> }> {
  const photos: GalleryPhoto[] = [];
  let albums: Array<Record<string, unknown>> = [];
  for (let offset = 0; offset < 5000; offset += 200) {
    const res = await fetch(`${API_BASE}/api/gallery?status=published&sort=popular&limit=200&offset=${offset}`);
    if (!res.ok) throw new Error(`[wallpapers] Galería oficial respondió ${res.status}`);
    const data = await res.json();
    if (offset === 0 && Array.isArray(data?.albums)) albums = data.albums;
    const list: GalleryPhoto[] = Array.isArray(data?.photos) ? data.photos : [];
    photos.push(...list);
    if (!list.length || !data?.hasMore) break;
  }
  return { photos, albums };
}

function compareItems(a: WallpaperItem, b: WallpaperItem): number {
  if (a.seriesOrder !== b.seriesOrder) return a.seriesOrder - b.seriesOrder;
  const byName = a.model.localeCompare(b.model, "es");
  if (byName !== 0) return byName;
  if (a.shotIndex !== b.shotIndex) return a.shotIndex - b.shotIndex;
  return a.id.localeCompare(b.id);
}

let catalogPromise: Promise<WallpaperCatalog> | null = null;

export function getWallpaperCatalog(): Promise<WallpaperCatalog> {
  if (!catalogPromise) catalogPromise = buildWallpaperCatalog();
  return catalogPromise;
}

async function buildWallpaperCatalog(): Promise<WallpaperCatalog> {
  const rejected: RejectedWallpaper[] = [...REMOVED_PUBLIC_LEAKS];
  const seen = new Set<string>();
  const items: WallpaperItem[] = [];

  const pushItem = (item: WallpaperItem) => {
    if (!item.img || seen.has(item.img) || seen.has(item.id)) return;
    if (hasBlockedPathSegment(item.img)) {
      rejected.push({ img: item.img, id: item.id, reason: "Segmento de ruta interno bloqueado." });
      return;
    }
    seen.add(item.img);
    seen.add(item.id);
    items.push(item);
  };

  const { photos, albums: rawAlbums } = await fetchOfficialPhotos();
  for (const photo of photos) {
    const img = String(photo.imageUrl || photo.url || "");
    const id = String(photo.id || img);
    if (!isAllowedRemoteWallpaper(img, photo)) {
      rejected.push({
        img: img || id,
        id,
        reason: "Fuera del prefijo de media oficial iRacing o sin sourceType official_press.",
      });
      continue;
    }
    const carName = String(photo.car || photo.title || "").trim();
    const category = String(photo.category || "");
    const placed = assignSeries(carName, category);
    const title = String(photo.title || placed.model).trim();
    const circuit = String(photo.track || "").trim();
    pushItem({
      id,
      brand: placed.brand,
      model: placed.model,
      carSlug: String(photo.carSlug || placed.carSlug),
      carClass: placed.carClass,
      categoryKey: category.toLowerCase() || placed.seriesSlug,
      circuit,
      img,
      cleanFileBase: cleanFileBase(placed.brand, placed.model, id),
      accentColor: placed.accent,
      title,
      alt: altText(title, placed.model, circuit),
      seriesId: placed.seriesId,
      seriesSlug: placed.seriesSlug,
      seriesName: placed.seriesName,
      seriesKind: placed.seriesKind,
      seriesOrder: placed.seriesOrder,
      shotIndex: shotIndexOf(title, img),
    });
  }

  for (const entry of loadManifest()) {
    const placed = assignSeries(entry.car || entry.title, entry.category);
    const circuit = entry.circuit.trim();
    pushItem({
      id: entry.id,
      brand: placed.brand,
      model: entry.car.trim() || placed.model,
      carSlug: placed.carSlug || entry.id,
      carClass: placed.carClass,
      categoryKey: entry.category,
      circuit,
      img: pathnameOf(entry.img),
      cleanFileBase: cleanFileBase(placed.brand, entry.car || entry.title, entry.id),
      accentColor: placed.accent,
      title: entry.title,
      alt: altText(entry.title, entry.car || placed.model, circuit),
      seriesId: placed.seriesId,
      seriesSlug: placed.seriesSlug,
      seriesName: placed.seriesName,
      seriesKind: placed.seriesKind,
      seriesOrder: placed.seriesOrder,
      shotIndex: shotIndexOf(entry.title, entry.img),
    });
  }

  items.sort(compareItems);

  const seriesMap = new Map<string, WallpaperSeries>();
  for (const item of items) {
    let group = seriesMap.get(item.seriesId);
    if (!group) {
      group = {
        id: item.seriesId,
        slug: item.seriesSlug,
        name: item.seriesName,
        kind: item.seriesKind,
        order: item.seriesOrder,
        accent: item.accentColor,
        items: [],
      };
      seriesMap.set(item.seriesId, group);
    }
    group.items.push(item);
  }
  const series = [...seriesMap.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));

  const byId = new Map(items.map((item) => [item.id, item]));
  const albums: WallpaperAlbum[] = [];
  for (const album of rawAlbums) {
    const photosInAlbum = Array.isArray(album.photos) ? album.photos as GalleryPhoto[] : [];
    const albumItems = photosInAlbum
      .map((photo) => byId.get(String(photo.id || "")))
      .filter((item): item is WallpaperItem => Boolean(item));
    if (!albumItems.length) continue;
    albumItems.sort(compareItems);
    const title = String(album.car || album.title || album.slug || "Álbum");
    albums.push({
      slug: String(album.slug || title),
      title,
      carClass: String(album.category || albumItems[0].carClass),
      count: albumItems.length,
      cover: albumItems[0].img,
      items: albumItems,
      seriesOrder: Math.min(...albumItems.map((item) => item.seriesOrder)),
    });
  }
  albums.sort((a, b) => a.seriesOrder - b.seriesOrder || a.title.localeCompare(b.title, "es"));

  const leaked = new Set(REMOVED_PUBLIC_LEAKS.map((entry) => entry.img));
  if (items.some((item) => leaked.has(pathnameOf(item.img)))) {
    throw new Error("[wallpapers] Una imagen interna sigue dentro del catálogo público.");
  }

  console.log(`[wallpapers] Públicos: ${items.length}. Series: ${series.length}. Rechazados: ${rejected.length}.`);
  for (const leak of REMOVED_PUBLIC_LEAKS) {
    console.log(`[wallpapers] Fuera del listado: ${leak.img} (${leak.id}) — ${leak.reason}`);
  }

  return { items, series, albums, rejected };
}

export function absoluteWallpaperUrl(img: string): string {
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return `https://muntru.me${img.startsWith("/") ? img : `/${img}`}`;
}
