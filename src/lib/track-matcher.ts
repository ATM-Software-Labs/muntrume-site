import fs from "node:fs";
import path from "node:path";
import tracksData from "../data/iracing-tracks.json";
import catalogIndex from "../../public/assets/data/catalog_index.json";
import schedule from "../../desktop/src/season_schedule_2026_s4.json";
import { CAR_CATALOG_LIST } from "../../desktop/src/cars/catalog";
import { OFFICIAL_BRAND_PATHS } from "../../desktop/src/cars/brand-icons";

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

const TRACK_VARIANTS: Record<string, string[]> = {
  "circuit-de-spa-francorchamps": ["Grand Prix Pits", "Endurance", "Classic Pits"],
  "daytona": ["Road Course", "Oval", "Rallycross Long", "Rallycross Short", "Moto"],
  "charlotte-motor-speedway": ["Oval", "Roval", "Roval 2025", "Legends Oval", "Rallycross"],
  "watkins-glen-international": ["Boot", "Classic Boot", "Cup", "Classic"],
  "nurburgring-grand-prix-strecke": ["Grand Prix", "Sprint", "BES/WEC", "Müllenbachschleife"],
  "nurburgring-nordschleife": ["Industriefahrten", "Touristenfahrten", "Combined Gesamtstrecke 24h", "Combined Gesamtstrecke VLN"],
  "silverstone-circuit": ["Grand Prix", "International", "National", "Historic Grand Prix"],
  "autodromo-nazionale-monza": ["Grand Prix", "Combined", "GP without chicanes", "Junior"],
  "sebring-international-raceway": ["International", "Club", "Modified"],
  "road-atlanta": ["Full Course", "Short", "Club"],
  "suzuka-international-racing-course": ["Grand Prix", "East", "West", "West w/chicane"],
  "autodromo-jose-carlos-pace": ["Grand Prix", "Moto"],
  "circuit-of-the-americas": ["Grand Prix", "East", "West"],
  "autodromo-enzo-e-dino-ferrari": ["Grand Prix", "Moto"],
  "circuit-de-la-sarthe": ["24 Heures du Mans", "24 Heures du Mans - No Chicane"],
  "okayama-international-circuit": ["Full Course", "Short"],
  "oulton-park-circuit": ["International", "Fosters", "Island"],
  "summit-point-raceway": ["Summit Point Raceway", "Jefferson Circuit", "Short"],
  "virginia-international-raceway": ["Full Course", "North Course", "South Course", "Patriot", "Grand Course"],
  "brands-hatch-circuit": ["Grand Prix", "Indy"],
  "donington-park-racing-circuit": ["Grand Prix", "National"],
  "hockenheimring-baden-wurttemberg": ["Grand Prix", "National", "Short A", "Short B", "Outer"],
  "circuit-park-zandvoort": ["Grand Prix", "Oostelijk", "Chicane", "Club"],
  "circuit-de-barcelona-catalunya": ["Grand Prix", "Historic", "National", "Club", "Moto"],
  "fuji-international-speedway": ["Grand Prix", "No Chicane"],
  "oran-park-raceway": ["Grand Prix", "North", "South", "Moto"],
  "tsukuba-circuit": ["2000 Full", "2000 Moto", "1000 Full"],
  "lime-rock-park": ["Grand Prix", "Chicane", "West Bend Chicane", "Classic"],
  "indianapolis-motor-speedway": ["Oval", "Road Course"],
  "miami-international-autodrome": ["Grand Prix", "Extended Marina", "MIA Loop", "Marina Loop"],
  "mount-panorama-circuit": ["Mount Panorama"],
  "weathertech-raceway-laguna-seca": ["Full Course"],
  "road-america": ["Full Course", "Bend"],
};

const SERIES_POPULARITY: Array<[RegExp, number]> = [
  [/^Global Mazda MX-5 Cup/i, 1],
  [/^GT3 Challenge Fixed/i, 2],
  [/^GT Sprint Series/i, 3],
  [/^IMSA iRacing Series by GO Fast/i, 4],
  [/^IMSA iRacing Series - Fixed/i, 5],
  [/^Ferrari 296 Challenge/i, 6],
  [/^Production Car Challenge/i, 7],
  [/^iRacing Porsche Cup by CONSPIT/i, 8],
  [/^iRacing Porsche Cup - Fixed/i, 9],
  [/^FIA F4/i, 10],
  [/^Formula C - Super Formula Lights by RSS/i, 11],
  [/^Formula C - Super Formula Lights - Fixed/i, 12],
  [/^GT4 Falken Tyre/i, 13],
  [/^Sports Car Challenge by Falken/i, 14],
  [/^BMW M2 Cup/i, 15],
  [/^Formula Vee/i, 16],
  [/^Formula 1600 Rookie/i, 17],
  [/^GT Endurance/i, 18],
  [/^IMSA Endurance/i, 19],
  [/^Ring Meister/i, 20],
  [/^NASCAR Cup Series|^NASCAR Class A/i, 21],
  [/^NASCAR Xfinity|^NASCAR Class B/i, 22],
  [/^NASCAR Craftsman|^NASCAR Class C/i, 23],
];

const SERIES_LOGOS: Array<[RegExp, string]> = [
  [/^IMSA/i, "/assets/img/series/imsa.jpg"],
  [/^GT Sprint|^GT3|^GT Endurance/i, "/assets/img/series/gt-sprint.jpg"],
  [/Porsche Cup/i, "/assets/img/series/porsche-cup.jpg"],
  [/Production Car/i, "/assets/img/series/pcc.jpg"],
  [/Super Formula Lights/i, "/assets/img/series/sfl.jpg"],
];

function seriesPopularity(name: string, tier: string): number {
  for (const [rx, score] of SERIES_POPULARITY) {
    if (rx.test(name)) return score;
  }
  const tierOrder: Record<string, number> = { RClass: 1, DClass: 2, CClass: 3, BClass: 4, AClass: 5 };
  return 100 + (tierOrder[tier] ?? 9);
}

function seriesLogoFor(name: string): string {
  for (const [rx, src] of SERIES_LOGOS) {
    if (rx.test(name)) return src;
  }
  return "";
}

export interface TrackSeasonEntry {
  seriesId: string;
  seriesName: string;
  category: string;
  tier: string;
  weekNum: number;
  config: string;
  logo: string;
  pop: number;
}

export function getTrackScheduleInfo(track: IracingTrack): { configs: string[]; entries: TrackSeasonEntry[] } {
  const nt = norm(track.name);
  const { garageQuery } = matchCatalogCircuits(track);
  const nq = norm(garageQuery);

  const configs = new Set<string>(TRACK_VARIANTS[track.slug] || []);
  const bySeries = new Map<string, TrackSeasonEntry>();

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
      if (!bySeries.has(s.id)) {
        const cleanName = s.name.replace(/\s*-?\s*2026 Season.*$/i, "").trim();
        const tier = s.tier || "DClass";
        bySeries.set(s.id, {
          seriesId: s.id,
          seriesName: cleanName,
          category: s.category || "SPORTS CAR",
          tier,
          weekNum: w.week_num,
          config: cfg,
          logo: seriesLogoFor(cleanName),
          pop: seriesPopularity(cleanName, tier),
        });
      }
    }
  }

  const entries = Array.from(bySeries.values()).sort((a, b) => a.pop - b.pop || a.seriesName.localeCompare(b.seriesName));
  return { configs: Array.from(configs), entries };
}

const carLabelMap = new Map<string, string>(
  CAR_CATALOG_LIST.map((c) => [c.carFolder.toLowerCase(), `${c.brand} ${c.model}`])
);
const carBrandMap = new Map<string, { path: string; color: string }>(
  CAR_CATALOG_LIST.map((c) => [
    c.carFolder.toLowerCase(),
    {
      path: OFFICIAL_BRAND_PATHS[c.svgLogoId] || "",
      color: c.svgLogoId === "logo-aston" ? "#2dd4bf" : c.accentColor,
    },
  ])
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
  cars: Array<{ id: string; label: string; count: number; brandPath: string; brandColor: string }>;
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
      const b = carBrandMap.get(id.toLowerCase());
      return {
        id,
        label: carLabelMap.get(id.toLowerCase()) || id,
        count,
        brandPath: b?.path || "",
        brandColor: b?.color || "#00e699",
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { setupCount, garageQuery, cars };
}
