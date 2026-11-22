/**
 * Historical iRacing Track ROI & Special Events catalog (2026 S3 + 2026 S4 + 2026 Special Events).
 * Used by /calendar/ to provide evergreen purchase recommendations even after all
 * tracks in a user's currently selected S4 series are already owned.
 */

export interface TrackHistoricalMeta {
  /** Exact track name as it appears in 2026 S4 schedule JSON (or canonical name). */
  track: string;
  /** Number of series using this track in 2026 Season 4. */
  s4Series: number;
  /** Number of series using this track in 2026 Season 3 (from official 2026 S3 PDF). */
  s3Series: number;
  /** Disciplines where this track is used across S3/S4. */
  cats: string[];
  /** Official 2026 Special Events hosted at this track. */
  specialEvents: string[];
  /** Whether the track is included free in the iRacing base subscription. */
  isFree: boolean;
}

/** Normalized matchers for tracks included in the base iRacing subscription (plus Legacy free tracks). */
const FREE_TRACK_PATTERNS: RegExp[] = [
  /^\[legacy\]/i,
  /summit point/i,
  /lime rock/i,
  /laguna seca/i,
  /okayama/i,
  /oulton park/i,
  /tsukuba/i,
  /charlotte motor speedway/i,
  /rudskogen/i,
  /virginia international/i,
  /oschersleben/i,
  /navarra/i,
  /oran park/i,
  /winton motor/i,
  /snetterton/i,
  /l[eé]denon/i,
  /lanier national/i,
  /usa international/i,
  /limaland/i,
  /thompson speedway/i,
  /langley speedway/i,
  /south boston/i,
  /southern national/i,
  /concord speedway/i,
  /oxford plains/i,
  /wild west motorsports/i,
  /centripetal/i,
  /phoenix raceway.*2008/i,
  /daytona.*2007/i,
  /michigan.*2009/i,
  /pocono.*2009/i,
  /texas.*2009/i,
  /silverstone.*2008/i,
  /kentucky.*2011/i,
  /lime rock/i,
];

export function isFreeBaseTrack(trackName: string): boolean {
  const clean = (trackName || "").trim();
  if (!clean) return true;
  return FREE_TRACK_PATTERNS.some((rx) => rx.test(clean));
}

function normTrackKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface HistoricalEntry {
  match: RegExp;
  canonical: string;
  s3Series: number;
  cats: string[];
  specialEvents?: string[];
}

/**
 * Multi-season recurrence from official 2026 Season 3 Schedule PDF + 2026 Special Events Calendar.
 * Combined dynamically with 2026 Season 4 JSON counts at build time.
 */
const HISTORICAL_ENTRIES: HistoricalEntry[] = [
  // Road & Formula Evergreen Staples
  { match: /spa-francorchamps/i, canonical: "Circuit de Spa-Francorchamps", s3Series: 30, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Spa 24"] },
  { match: /road america/i, canonical: "Road America", s3Series: 28, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Road America 500", "6h Road America", "iRacing Runoffs"] },
  { match: /watkins glen/i, canonical: "Watkins Glen International", s3Series: 26, cats: ["SPORTS CAR", "FORMULA CAR", "OVAL"], specialEvents: ["Watkins Glen 6h"] },
  { match: /daytona international/i, canonical: "Daytona International Speedway", s3Series: 24, cats: ["SPORTS CAR", "OVAL"], specialEvents: ["Roar", "Daytona 24", "Daytona 500"] },
  { match: /n[uü]rburgring.*(nordschleife|combined|gesamt|grand-prix|gp)/i, canonical: "Nürburgring Nordschleife", s3Series: 24, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Nürburgring 24h"] },
  { match: /suzuka/i, canonical: "Suzuka International Racing Course", s3Series: 23, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Suzuka 1000km"] },
  { match: /monza/i, canonical: "Autodromo Nazionale Monza", s3Series: 21, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /red bull ring/i, canonical: "Red Bull Ring", s3Series: 18, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /road atlanta/i, canonical: "Road Atlanta", s3Series: 17, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Petit Le Mans"] },
  { match: /indianapolis motor speedway/i, canonical: "Indianapolis Motor Speedway", s3Series: 17, cats: ["SPORTS CAR", "FORMULA CAR", "OVAL"], specialEvents: ["Indy 500", "Brickyard 400", "Indy 8h"] },
  { match: /fuji international/i, canonical: "Fuji International Speedway", s3Series: 17, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /st\.?\s*petersburg/i, canonical: "St. Petersburg Grand Prix", s3Series: 17, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /mount panorama|bathurst/i, canonical: "Mount Panorama Circuit", s3Series: 16, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Bathurst 12", "Bathurst 1000", "SFL Mountain Showdown"] },
  { match: /24 heures du mans|le mans/i, canonical: "Circuit des 24 Heures du Mans", s3Series: 16, cats: ["SPORTS CAR"] },
  { match: /barcelona-catalunya/i, canonical: "Circuit de Barcelona-Catalunya", s3Series: 16, cats: ["SPORTS CAR", "FORMULA CAR", "DIRT ROAD"] },
  { match: /canadian tire|mosport/i, canonical: "Canadian Tire Motorsports Park", s3Series: 16, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /adelaide/i, canonical: "Adelaide Street Circuit", s3Series: 16, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /jos[eé] carlos pace|interlagos/i, canonical: "Autódromo José Carlos Pace", s3Series: 15, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /silverstone/i, canonical: "Silverstone Circuit", s3Series: 14, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Britcar 24"] },
  { match: /imola|enzo e dino ferrari/i, canonical: "Autodromo Internazionale Enzo e Dino Ferrari", s3Series: 14, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /hockenheimring/i, canonical: "Hockenheimring Baden-Württemberg", s3Series: 14, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /mugello/i, canonical: "Autodromo Internazionale del Mugello", s3Series: 14, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /gilles villeneuve|montreal/i, canonical: "Circuit Gilles Villeneuve", s3Series: 14, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /zandvoort/i, canonical: "Circuit Zandvoort", s3Series: 13, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /long beach/i, canonical: "Long Beach Street Circuit", s3Series: 13, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /brands hatch/i, canonical: "Brands Hatch Circuit", s3Series: 13, cats: ["SPORTS CAR", "FORMULA CAR", "DIRT ROAD"], specialEvents: ["FF1600 Festival"] },
  { match: /motegi/i, canonical: "Mobility Resort Motegi", s3Series: 11, cats: ["SPORTS CAR", "FORMULA CAR", "OVAL"] },
  { match: /algarve|portim/i, canonical: "Algarve International Circuit", s3Series: 10, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Portimão 1000km"] },
  { match: /hungaroring/i, canonical: "Hungaroring", s3Series: 8, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /sebring/i, canonical: "Sebring International Raceway", s3Series: 8, cats: ["SPORTS CAR", "FORMULA CAR"], specialEvents: ["Sebring 12"] },
  { match: /circuit of the americas|cota/i, canonical: "Circuit of the Americas", s3Series: 9, cats: ["SPORTS CAR", "FORMULA CAR", "OVAL"] },
  { match: /hermanos rodr[ií]guez/i, canonical: "Autódromo Hermanos Rodríguez", s3Series: 9, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /donington/i, canonical: "Donington Park Racing Circuit", s3Series: 8, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /zolder/i, canonical: "Circuit Zolder", s3Series: 7, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /misano/i, canonical: "Misano World Circuit Marco Simoncelli", s3Series: 7, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /magny-cours/i, canonical: "Circuit de Nevers Magny-Cours", s3Series: 7, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /phillip island/i, canonical: "Phillip Island Circuit", s3Series: 7, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /mid-ohio/i, canonical: "Mid-Ohio Sports Car Course", s3Series: 8, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /barber motorsports/i, canonical: "Barber Motorsports Park", s3Series: 6, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /sonoma/i, canonical: "Sonoma Raceway", s3Series: 8, cats: ["SPORTS CAR", "OVAL", "DIRT ROAD"] },
  { match: /jerez/i, canonical: "Circuito de Jerez - Ángel Nieto", s3Series: 6, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /motorland arag/i, canonical: "MotorLand Aragón", s3Series: 6, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /thruxton/i, canonical: "Thruxton Circuit", s3Series: 5, cats: ["SPORTS CAR"], specialEvents: ["4h Thruxton"] },
  { match: /sachs|sachsenring/i, canonical: "Sachsenring", s3Series: 5, cats: ["SPORTS CAR", "FORMULA CAR"] },
  { match: /the bend/i, canonical: "Shell V-Power Motorsport Park at The Bend", s3Series: 6, cats: ["SPORTS CAR", "FORMULA CAR"] },

  // Oval Staples
  { match: /talladega/i, canonical: "Talladega Superspeedway", s3Series: 18, cats: ["OVAL"] },
  { match: /bristol motor/i, canonical: "Bristol Motor Speedway", s3Series: 16, cats: ["OVAL", "DIRT OVAL"] },
  { match: /martinsville/i, canonical: "Martinsville Speedway", s3Series: 15, cats: ["OVAL"] },
  { match: /darlington/i, canonical: "Darlington Raceway", s3Series: 14, cats: ["OVAL"], specialEvents: ["Southern 500"] },
  { match: /richmond raceway/i, canonical: "Richmond Raceway", s3Series: 14, cats: ["OVAL"] },
  { match: /iowa speedway/i, canonical: "Iowa Speedway", s3Series: 14, cats: ["OVAL", "FORMULA CAR"], specialEvents: ["Dale Jr Charity"] },
  { match: /homestead miami/i, canonical: "Homestead Miami Speedway", s3Series: 13, cats: ["OVAL"], specialEvents: ["Homestead Championship"] },
  { match: /north wilkesboro/i, canonical: "North Wilkesboro Speedway", s3Series: 12, cats: ["OVAL"] },
  { match: /new hampshire/i, canonical: "New Hampshire Motor Speedway", s3Series: 12, cats: ["OVAL"] },
  { match: /las vegas motor/i, canonical: "Las Vegas Motor Speedway", s3Series: 12, cats: ["OVAL"] },
  { match: /kansas speedway/i, canonical: "Kansas Speedway", s3Series: 11, cats: ["OVAL"] },
  { match: /pocono/i, canonical: "Pocono Raceway", s3Series: 11, cats: ["OVAL"] },
  { match: /dover motor/i, canonical: "Dover Motor Speedway", s3Series: 10, cats: ["OVAL"] },
  { match: /michigan international/i, canonical: "Michigan International Speedway", s3Series: 10, cats: ["OVAL"] },
  { match: /echopark|atlanta motor/i, canonical: "EchoPark Speedway (Atlanta)", s3Series: 12, cats: ["OVAL"] },
  { match: /five flags/i, canonical: "Five Flags Speedway", s3Series: 10, cats: ["OVAL"], specialEvents: ["Winter Derby"] },
  { match: /nashville superspeedway/i, canonical: "Nashville Superspeedway", s3Series: 10, cats: ["OVAL"] },
  { match: /phoenix raceway(?!.*2008)/i, canonical: "Phoenix Raceway", s3Series: 11, cats: ["OVAL"] },
  { match: /lucas oil indianapolis/i, canonical: "Lucas Oil Indianapolis Raceway Park", s3Series: 11, cats: ["OVAL", "DIRT ROAD"] },
  { match: /oswego speedway/i, canonical: "Oswego Speedway", s3Series: 10, cats: ["OVAL", "DIRT OVAL"] },
  { match: /kern raceway/i, canonical: "Kevin Harvick's Kern Raceway", s3Series: 10, cats: ["OVAL"] },

  // Dirt Oval Staples
  { match: /eldora/i, canonical: "Eldora Speedway", s3Series: 22, cats: ["DIRT OVAL"] },
  { match: /knoxville/i, canonical: "Knoxville Raceway", s3Series: 20, cats: ["DIRT OVAL"], specialEvents: ["Knoxville Nationals"] },
  { match: /volusia/i, canonical: "Volusia Speedway Park", s3Series: 18, cats: ["DIRT OVAL"] },
  { match: /lernerville/i, canonical: "Lernerville Speedway", s3Series: 16, cats: ["DIRT OVAL"] },
  { match: /dirt track at charlotte/i, canonical: "The Dirt Track at Charlotte", s3Series: 16, cats: ["DIRT OVAL"] },
  { match: /federated auto parts/i, canonical: "Federated Auto Parts Raceway at I-55", s3Series: 15, cats: ["DIRT OVAL"] },
  { match: /lucas oil speedway/i, canonical: "Lucas Oil Speedway", s3Series: 16, cats: ["DIRT OVAL", "DIRT ROAD"] },
  { match: /cedar lake/i, canonical: "Cedar Lake Speedway", s3Series: 14, cats: ["DIRT OVAL"] },
  { match: /fairbury/i, canonical: "Fairbury Speedway", s3Series: 13, cats: ["DIRT OVAL"] },
  { match: /huset/i, canonical: "Huset's Speedway", s3Series: 13, cats: ["DIRT OVAL"] },
  { match: /williams grove/i, canonical: "Williams Grove Speedway", s3Series: 13, cats: ["DIRT OVAL"] },
  { match: /port royal/i, canonical: "Port Royal Speedway", s3Series: 12, cats: ["DIRT OVAL"] },
  { match: /chili bowl/i, canonical: "Chili Bowl", s3Series: 8, cats: ["DIRT OVAL"], specialEvents: ["Chili Bowl"] },

  // Dirt Road Staples
  { match: /crandon/i, canonical: "Crandon International Raceway", s3Series: 10, cats: ["DIRT ROAD"], specialEvents: ["Crandon Championship"] },
  { match: /bark river/i, canonical: "Bark River International Raceway", s3Series: 8, cats: ["DIRT ROAD"] },
  { match: /hell rx|l[aå]nkebanen/i, canonical: "Lånkebanen (Hell RX)", s3Series: 7, cats: ["DIRT ROAD"] },
  { match: /knockhill/i, canonical: "Knockhill Racing Circuit", s3Series: 7, cats: ["SPORTS CAR", "DIRT ROAD"] },
];

export interface SimpleSeriesInput {
  category: string;
  weeks: Array<{ track: string }>;
}

/**
 * Builds the complete historical + current-season track catalog for the /calendar/ recommender.
 * Combines 2026 S4 live schedule counts with 2026 S3 historical counts and 2026 Special Events.
 */
export function buildTrackHistoricalCatalog(seriesList: SimpleSeriesInput[]): TrackHistoricalMeta[] {
  const map = new Map<string, {
    track: string;
    s4SeriesSet: Set<number>;
    s3Series: number;
    cats: Set<string>;
    specialEvents: Set<string>;
    isFree: boolean;
  }>();

  const findHist = (name: string) => HISTORICAL_ENTRIES.find((h) => h.match.test(name));

  // 1. Aggregate 2026 S4 schedule appearances
  seriesList.forEach((s, sIdx) => {
    const cat = s.category || "SPORTS CAR";
    for (const w of s.weeks) {
      const raw = (w.track || "").trim();
      if (!raw) continue;
      const key = normTrackKey(raw);
      let entry = map.get(key);
      if (!entry) {
        const hist = findHist(raw);
        entry = {
          track: raw,
          s4SeriesSet: new Set<number>(),
          s3Series: hist?.s3Series ?? 0,
          cats: new Set<string>(hist?.cats ?? []),
          specialEvents: new Set<string>(hist?.specialEvents ?? []),
          isFree: isFreeBaseTrack(raw),
        };
        map.set(key, entry);
      }
      entry.s4SeriesSet.add(sIdx);
      entry.cats.add(cat);
    }
  });

  // 2. Ensure iconic historical tracks from 2026 S3 / Special Events exist even if absent in S4
  for (const hist of HISTORICAL_ENTRIES) {
    const alreadyExists = Array.from(map.values()).some((v) => hist.match.test(v.track));
    if (!alreadyExists) {
      const key = normTrackKey(hist.canonical);
      map.set(key, {
        track: hist.canonical,
        s4SeriesSet: new Set<number>(),
        s3Series: hist.s3Series,
        cats: new Set<string>(hist.cats),
        specialEvents: new Set<string>(hist.specialEvents ?? []),
        isFree: isFreeBaseTrack(hist.canonical),
      });
    }
  }

  return Array.from(map.values())
    .map((v) => ({
      track: v.track,
      s4Series: v.s4SeriesSet.size,
      s3Series: v.s3Series,
      cats: Array.from(v.cats),
      specialEvents: Array.from(v.specialEvents),
      isFree: v.isFree,
    }))
    .sort((a, b) => {
      const scoreA = a.s4Series + a.s3Series + a.specialEvents.length * 6;
      const scoreB = b.s4Series + b.s3Series + b.specialEvents.length * 6;
      return scoreB - scoreA || a.track.localeCompare(b.track);
    });
}
