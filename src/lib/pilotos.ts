/**
 * Official Roster & Time-Based Sports Car Telemetry + EA Sports F1 25 Asymptotic Rating Engine.
 * Source data: src/data/pilotos.json.
 * Strict rules:
 *  1. Exclusive Sports Car category filtering (GT3, GT4, Porsche Cup, Touring Endurance). Zero GTP/Hypercar/Formula/Oval/Dirt noise.
 *  2. Weighted Hours on Track calculation based on circuit length and average lap time.
 *  3. Dynamic role & specialty read directly from each driver's configuration object.
 *  4. EA Sports F1 25 Rating Engine (1-98, strictly < 99):
 *     Asymptotic logarithmic curve calibrated at 1,500 iRating = 40 and 12,000 iRating = 97, hard-capped via Math.min(98, ...).
 */
import data from "../data/pilotos.json";

export interface Socials {
  twitch: string;
  youtube: string;
  instagram: string;
  x: string;
}

export interface LapStat {
  name: string;
  laps: number;
  hours: number;
  lapSeconds?: number;
  timeOnTrack?: string;
  incidentsPerLap?: number;
}

export interface F1DriverStats {
  overall: number;
  pace: number;
  awareness: number;
  racecraft: number;
  experience: number;
}

export interface Piloto {
  slug: string;
  cust_id: number | null;
  dorsal: string;
  name: string;
  fullName: string;
  role: string;
  specialty: string;
  badge: "FOUNDER" | "DRIVER";
  country: string;
  flag: string;
  flag_code: string;
  helmet_url: string | null;
  bio: string;
  favouriteCars: string[];
  favouriteSeries: string[];
  achievements: string[];
  socials: Socials;
  memberSince: string;
  club: string;
  favoriteTrack: string;
  topTracks: LapStat[];
  topCars: LapStat[];
  totalTrackHours: number;
  totalCarHours: number;
  initials?: string;
}

const EMPTY_SOCIALS: Socials = { twitch: "", youtube: "", instagram: "", x: "" };

/**
 * Asymptotic / logarithmic iRating -> EA Sports F1 25 Rating (1 to 98, strictly < 99).
 * Mathematical calibration:
 *  - Baseline: 1,500 iRating === 40
 *  - Reference ceiling: 12,000 iRating === 97
 *  - Strict upper cap: Math.min(98, ...) so it NEVER reaches or exceeds 99.
 */
export function computeAsymptoticRating(irating: number): number {
  const safeIr = Math.max(100, Number(irating) || 1500);
  const raw =
    safeIr >= 1500
      ? 40 + 57 * (Math.log(safeIr / 1500) / Math.log(12000 / 1500))
      : Math.max(1, 40 * (safeIr / 1500));
  return Math.min(98, Math.max(1, Math.round(raw)));
}

/**
 * Computes the 5 EA Sports F1 25 attributes (PACE, AWARENESS, RACECRAFT, EXPERIENCE, OVERALL RATING),
 * each strictly bounded to [1, 98] via Math.min(98, ...).
 */
export function computeF1DriverStats(
  irating: number,
  sr = 3.0,
  trackHours = 100,
  peakIrating?: number
): F1DriverStats {
  const overall = computeAsymptoticRating(irating);
  const peakBase = computeAsymptoticRating(Math.max(irating, peakIrating || irating));
  const safeSr = Math.min(4.99, Math.max(1.0, Number(sr) || 3.0));
  const srNorm = (safeSr - 1.0) / 3.99; // 0..1
  const expBoost = Math.min(18, Math.log1p(Math.max(0, trackHours)) * 2.8);

  const pace = Math.min(98, Math.max(1, Math.round(peakBase + 2)));
  const awareness = Math.min(98, Math.max(1, Math.round(overall * 0.72 + srNorm * 26)));
  const racecraft = Math.min(98, Math.max(1, Math.round(overall * 0.86 + srNorm * 12)));
  const experience = Math.min(98, Math.max(1, Math.round(overall * 0.78 + expBoost)));

  return {
    overall: Math.min(98, overall),
    pace,
    awareness,
    racecraft,
    experience,
  };
}

/**
 * Strict Sports Car circuit filter: excludes any track classified as Oval, Speedway, Roval or Dirt,
 * keeping only Road, street and combined endurance circuits (including Daytona Road Course).
 */
export function isRoadTrack(name: string, category?: string): boolean {
  const clean = String(name || "").trim();
  if (!clean || clean === "..." || clean === "…") return false;
  if (category && /oval|dirt|formula/i.test(category) && !/sports\s*car|road/i.test(category)) return false;

  if (/\b(oval|roval|superspeedway|tri-oval|short\s*track|dirt\s*oval|legends\s*oval|rallycross|dirt)\b/i.test(clean)) {
    return false;
  }

  if (/\bspeedway\b/i.test(clean) && !/\broad(\s*course)?\b/i.test(clean)) {
    return false;
  }

  if (
    /\b(talladega|martinsville|bristol|darlington|richmond|pocono|michigan|dover|phoenix|las\s*vegas\s*motor|kansas\s*speedway|texas\s*motor|atlanta\s*motor|chicagoland|kentucky|gateway|nashville\s*superspeedway|new\s*hampshire|north\s*wilkesboro|rockingham|usa\s*international|lanier|langley|oxford\s*plains|stafford|thompson|south\s*boston|irwindale|iowa|lucas\s*oil|auto\s*club|eldora|knoxville|volusia)\b/i.test(clean) &&
    !/\broad(\s*course)?\b/i.test(clean)
  ) {
    return false;
  }

  return true;
}

/**
 * Strict Sports Car vehicle filter: keeps exclusively GT3, GT4, Porsche Cup, GTE and Touring Endurance cars.
 * Explicitly excludes GTP/Hypercar/LMDh/LMP prototypes, Formula/Single-seaters, Oval/NASCAR and Dirt vehicles.
 */
export function isSportsCarVehicle(carName: string): boolean {
  const clean = String(carName || "").trim();
  if (!clean || clean === "..." || clean === "…") return false;

  // Exclude GTP / Hypercar / LMDh / LMP prototypes
  if (/\b(gtp|lmdh|hypercar|499p|valkyrie|963|arx-06|v-series|m\s*hybrid|lmp1|lmp2|lmp3|p217|js\s*p320|sr10|radical)\b/i.test(clean)) {
    return false;
  }

  // Exclude Formula / Single-seaters
  if (/\b(formula|f1|f2|f3|f4|super\s*formula|sf23|indycar|ir18|dallara\s*f|w12|w13|skip\s*barber|ff1600|formula\s*vee|usf2000|indy\s*pro)\b/i.test(clean)) {
    return false;
  }

  // Exclude Oval / NASCAR / Dirt / Rallycross
  if (/\b(nascar|stock\s*car|truck|sprint\s*car|midget|late\s*model|legends|modified|rallycross|beetle|pro\s*2|pro\s*4)\b/i.test(clean)) {
    return false;
  }

  return true;
}

const TRACK_LAP_SECONDS_RULES: Array<[RegExp, number]> = [
  [/n[uü]rburgring\s*combined|nordschleife|24h\s*n[uü]rburgring/i, 505],
  [/le\s*mans|sarthe/i, 232],
  [/spa-francorchamps|spa\b/i, 138],
  [/road\s*america/i, 125],
  [/mount\s*panorama|bathurst/i, 123],
  [/circuit\s*of\s*the\s*americas|\bcota\b/i, 124],
  [/suzuka/i, 119],
  [/sebring/i, 118],
  [/silverstone/i, 118],
  [/monza/i, 108],
  [/daytona.*road/i, 106],
  [/mugello/i, 106],
  [/virginia|\bvir\b/i, 106],
  [/watkins\s*glen/i, 105],
  [/algarve|portim[aã]o/i, 104],
  [/catalunya|barcelona/i, 104],
  [/hungaroring/i, 104],
  [/imola/i, 102],
  [/fuji/i, 98],
  [/hockenheim/i, 98],
  [/zandvoort/i, 95],
  [/oulton\s*park/i, 94],
  [/interlagos|s[aã]o\s*paulo/i, 92],
  [/red\s*bull\s*ring|spielberg/i, 89],
  [/donington/i, 88],
  [/indianapolis.*road/i, 86],
  [/brands\s*hatch/i, 84],
  [/laguna\s*seca/i, 83],
  [/road\s*atlanta/i, 78],
  [/long\s*beach/i, 78],
  [/canadian\s*tire|mosport/i, 76],
];

export function estimateTrackLapSeconds(trackName: string): number {
  const clean = String(trackName || "").trim();
  for (const [pattern, secs] of TRACK_LAP_SECONDS_RULES) {
    if (pattern.test(clean)) return secs;
  }
  return 105;
}

export function estimateCarLapFactor(carName: string): number {
  const clean = String(carName || "").trim();
  if (/\b(gt4|tcr|gr86|mx-5|clio)\b/i.test(clean)) {
    return 1.08;
  }
  return 1.0; // GT3 / Cup baseline
}

export function cleanTrackDisplayName(name: string): string {
  return String(name || "")
    .replace(/\s*\(2008\)/g, "")
    .replace(/\s*\.{2,}$/g, "")
    .trim();
}

export function computeTrackHours(trackName: string, laps: number): number {
  const validLaps = Math.max(0, Number(laps) || 0);
  const lapSec = estimateTrackLapSeconds(trackName);
  return Math.round(((validLaps * lapSec) / 3600) * 10) / 10;
}

export function computeCarHours(carName: string, laps: number, driverAvgLapSec = 108): number {
  const validLaps = Math.max(0, Number(laps) || 0);
  const effectiveSec = driverAvgLapSec * estimateCarLapFactor(carName);
  return Math.round(((validLaps * effectiveSec) / 3600) * 10) / 10;
}

function deriveDynamicSpecialty(role: string, explicitSpecialty: string | undefined, cars: Array<{ name: string }>): string {
  if (explicitSpecialty && explicitSpecialty.trim()) {
    return explicitSpecialty.replace(/\bGTP\s*&?\s*/gi, "").trim();
  }
  const carNames = cars.map((c) => c.name).join(" ");
  const hasGt3 = /gt3/i.test(carNames);
  const hasGt4 = /gt4/i.test(carNames);
  if (hasGt3 && hasGt4) return "GT3 & GT4 Endurance";
  if (hasGt3) return "GT3 Endurance & Sprint";
  return role || "Sports Car Endurance";
}

export const LICENCE_UPDATED = data.updated;
export const LICENCE_UPDATED_LABEL = data.updatedLabel;

export const PILOTOS: Piloto[] = data.drivers.map((d) => {
  // 1. Strict Sports Car Road tracks + weighted hours on track
  const roadTracks: LapStat[] = (d.topTracks || [])
    .filter((t) => isRoadTrack(t.name) && Number(t.laps) > 0)
    .map((t) => {
      const cleanName = cleanTrackDisplayName(t.name);
      const lapSeconds = estimateTrackLapSeconds(cleanName);
      const hours = computeTrackHours(cleanName, t.laps);
      return {
        name: cleanName,
        laps: t.laps,
        hours,
        lapSeconds,
        timeOnTrack: `${hours.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`,
      };
    })
    .filter((t) => t.hours >= 0.5)
    .sort((a, b) => b.hours - a.hours);

  const totalTrackLaps = roadTracks.reduce((acc, t) => acc + t.laps, 0) || 1;
  const totalTrackSeconds = roadTracks.reduce((acc, t) => acc + t.laps * (t.lapSeconds || 105), 0);
  const weightedAvgLapSec = totalTrackSeconds > 0 ? totalTrackSeconds / totalTrackLaps : 108;

  // 2. Strict Sports Car vehicles (GT3, GT4, Cup) — excludes GTP/Formula/Oval/Dirt
  const sportsCars: LapStat[] = (d.topCars || [])
    .filter((c) => c && c.name && isSportsCarVehicle(c.name) && Number(c.laps) > 0)
    .map((c) => {
      const cleanName = cleanTrackDisplayName(c.name);
      const hours = computeCarHours(cleanName, c.laps, weightedAvgLapSec);
      return {
        name: cleanName,
        laps: c.laps,
        hours,
        timeOnTrack: `${hours.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`,
      };
    })
    .filter((c) => c.hours >= 0.5)
    .sort((a, b) => b.hours - a.hours);

  const totalTrackHours = Math.round(roadTracks.reduce((acc, t) => acc + t.hours, 0) * 10) / 10;
  const totalCarHours = Math.round(sportsCars.reduce((acc, c) => acc + c.hours, 0) * 10) / 10;
  const dynamicRole = (d.role || "").trim() || deriveDynamicSpecialty("", (d as any).specialty, sportsCars);
  const dynamicSpecialty = deriveDynamicSpecialty(dynamicRole, (d as any).specialty, sportsCars);

  return {
    slug: d.slug,
    cust_id: d.custId,
    dorsal: d.number,
    name: d.shortName,
    fullName: d.fullName,
    role: dynamicRole,
    specialty: dynamicSpecialty,
    badge: d.badge === "FOUNDER" ? "FOUNDER" : "DRIVER",
    country: d.country,
    flag: d.flag,
    flag_code: d.countryCode,
    helmet_url: `/img/helmets/${d.slug}.webp`,
    bio: d.bio || "",
    favouriteCars: (d.favouriteCars || []).filter(isSportsCarVehicle),
    favouriteSeries: d.favouriteSeries || [],
    achievements: d.achievements || [],
    socials: { ...EMPTY_SOCIALS, ...(d.socials || {}) },
    memberSince: d.memberSince || "",
    club: d.club || "",
    favoriteTrack: d.favoriteTrack || "",
    topTracks: roadTracks,
    topCars: sportsCars,
    totalTrackHours,
    totalCarHours,
  };
});
