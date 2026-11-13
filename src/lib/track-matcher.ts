import fs from "node:fs";
import path from "node:path";
import tracksData from "../data/iracing-tracks.json";
import catalogIndex from "../../public/assets/data/catalog_index.json";
import schedule from "../../desktop/src/season_schedule_2026_s4.json";
import { CAR_CATALOG_LIST } from "../../desktop/src/cars/catalog";

export interface IracingTrack {
  slug: string;
  name: string;
  url: string;
  img: string;
  thumb: string;
  categories: string[];
  history: string;
}

export const IRACING_TRACKS = tracksData as IracingTrack[];

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const SLUG_TO_CATALOG_KEYS: Record<string, string[]> = {
  "motorland-aragon": ["aragon", "motorland aragon"],
  "barber-motorsports-park": ["barber", "barber s park"],
  "mount-panorama-circuit": ["bathurst"],
  "circuit-of-the-americas": ["cota"],
  "circuit-de-ledenon": ["de ledenon"],
  "atlanta-motor-speedway": ["echopark"],
  "federated-auto-parts-raceway-at-i-55": ["federated auto parts at i"],
  "husets-speedway": ["huset s"],
  "autodromo-enzo-e-dino-ferrari": ["imola"],
  "autodromo-jose-carlos-pace": ["interlagos"],
  "kern-raceway": ["kern", "kern county"],
  "circuit-de-la-sarthe": ["le mans"],
  "autodromo-hermanos-rodriguez": ["mexico"],
  "miami-international-autodrome": ["miami", "miami autodrome"],
  "circuit-gilles-villeneuve": ["montreal"],
  "nurburgring-nordschleife": ["nurburgring", "nurburgring combined gesamtstrecke vln"],
  "nurburgring-grand-prix-strecke": ["nurburgring"],
  "portland-international-raceway": ["portland"],
  "qualcomm-circuit-naval-base-coronado": ["qualcomm"],
  "circuit-de-spa-francorchamps": ["spa"],
  "st-petersburg-grand-prix": ["st petersburg"],
  "the-bend-motorsports-park": ["the bend"],
  "las-vegas-motor-speedway": ["las vegas", "the bullring"],
  "virginia-international-raceway": ["virginia"],
  "winton-motor-raceway": ["winton", "winton motor"],
};

const SLUG_TO_GARAGE_QUERY: Record<string, string> = {
  "motorland-aragon": "Aragon",
  "barber-motorsports-park": "Barber",
  "mount-panorama-circuit": "Bathurst",
  "circuit-of-the-americas": "COTA",
  "circuit-de-ledenon": "Ledenon",
  "atlanta-motor-speedway": "Echopark",
  "federated-auto-parts-raceway-at-i-55": "Federated Auto Parts",
  "autodromo-enzo-e-dino-ferrari": "Imola",
  "autodromo-jose-carlos-pace": "Interlagos",
  "kern-raceway": "Kern",
  "circuit-de-la-sarthe": "Le Mans",
  "autodromo-hermanos-rodriguez": "Mexico",
  "miami-international-autodrome": "Miami",
  "circuit-gilles-villeneuve": "Montreal",
  "nurburgring-nordschleife": "Nurburgring",
  "nurburgring-grand-prix-strecke": "Nurburgring",
  "qualcomm-circuit-naval-base-coronado": "Qualcomm",
  "circuit-de-spa-francorchamps": "Spa",
  "st-petersburg-grand-prix": "St. Petersburg",
  "the-bend-motorsports-park": "The Bend",
  "virginia-international-raceway": "Virginia",
  "winton-motor-raceway": "Winton",
};

const CATALOG_CIRCUITS_NORM = (catalogIndex.circuits as string[]).map((raw) => ({
  raw,
  n: norm(raw),
}));

export function matchCatalogCircuits(track: IracingTrack): { matched: string[]; garageQuery: string } {
  const nt = norm(track.name);
  const aliasKeys = SLUG_TO_CATALOG_KEYS[track.slug] || [];
  const matched = CATALOG_CIRCUITS_NORM.filter((c) => {
    if (aliasKeys.includes(c.n)) return true;
    return c.n === nt || nt.includes(c.n) || (nt.length >= 5 && c.n.includes(nt));
  }).map((c) => c.raw);

  const garageQuery = SLUG_TO_GARAGE_QUERY[track.slug] || matched[0] || track.name;
  return { matched, garageQuery };
}

export interface TrackSeasonEntry {
  seriesId: string;
  seriesName: string;
  category: string;
  tier: string;
  weekNum: number;
  config: string;
}

export function getTrackScheduleInfo(track: IracingTrack): { configs: string[]; entries: TrackSeasonEntry[] } {
  const nt = norm(track.name);
  const { garageQuery } = matchCatalogCircuits(track);
  const nq = norm(garageQuery);

  const configs = new Set<string>();
  const entries: TrackSeasonEntry[] = [];

  for (const s of schedule.series) {
    for (const w of s.weeks || []) {
      const wn = norm(w.track_name);
      const isMatch =
        wn === nt ||
        nt.includes(wn) ||
        wn.includes(nt) ||
        (nq.length >= 3 && (wn.includes(nq) || nq.includes(wn)));
      if (!isMatch) continue;
      const cfg = (w.config || "").trim();
      if (cfg) configs.add(cfg);
      entries.push({
        seriesId: s.id,
        seriesName: s.name.replace(/\s*-?\s*2026 Season.*$/i, "").trim(),
        category: s.category || "SPORTS CAR",
        tier: s.tier || "DClass",
        weekNum: w.week_num,
        config: cfg,
      });
    }
  }

  return { configs: Array.from(configs), entries };
}

const carLabelMap = new Map<string, string>(
  CAR_CATALOG_LIST.map((c) => [c.carFolder.toLowerCase(), `${c.brand} ${c.model}`])
);

const slugId = (id: string) => String(id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

let cachedByTrack: Map<string, Map<string, number>> | null = null;

function buildTrackCarIndex(): Map<string, Map<string, number>> {
  if (cachedByTrack) return cachedByTrack;
  const map = new Map<string, Map<string, number>>();
  const dir = path.resolve(process.cwd(), "public/assets/data/catalog_by_car");
  for (const carId of catalogIndex.cars as string[]) {
    const file = path.join(dir, `${slugId(carId)}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const rows = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[][];
      for (const r of rows) {
        const trk = String(r[4] || "").trim();
        if (!trk) continue;
        let carCounts = map.get(trk);
        if (!carCounts) {
          carCounts = new Map<string, number>();
          map.set(trk, carCounts);
        }
        carCounts.set(carId, (carCounts.get(carId) || 0) + 1);
      }
    } catch {}
  }
  cachedByTrack = map;
  return map;
}

export function getTrackGarageInfo(track: IracingTrack): {
  setupCount: number;
  garageQuery: string;
  cars: Array<{ id: string; label: string; count: number }>;
} {
  const { matched, garageQuery } = matchCatalogCircuits(track);
  const index = buildTrackCarIndex();
  const carCounts = new Map<string, number>();

  for (const catTrack of matched) {
    const hits = index.get(catTrack);
    if (!hits) continue;
    for (const [carId, cnt] of hits.entries()) {
      carCounts.set(carId, (carCounts.get(carId) || 0) + cnt);
    }
  }

  let setupCount = 0;
  const cars = Array.from(carCounts.entries())
    .map(([id, count]) => {
      setupCount += count;
      return {
        id,
        label: carLabelMap.get(id.toLowerCase()) || id,
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { setupCount, garageQuery, cars };
}
