/**
 * Identidad y motor de métricas en pista (Time-Based Road Telemetry) de la plantilla.
 * El archivo fuente es src/data/pilotos.json.
 * Reglas estrictas:
 *  1. Exclusión total de trazados Oval, Speedway y Roval (solo circuitos Road, urbanos y combinados de resistencia).
 *  2. Cálculo ponderado de horas reales en pista (Hours on track) según longitud y tiempo medio por vuelta de cada circuito.
 *  3. Roles y especialidades leídos dinámicamente del objeto de configuración de cada piloto.
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
 * Filtro estricto Road: excluye cualquier trazado clasificado como Oval, Speedway o Roval,
 * conservando únicamente trazados Road, urbanos y combinados de resistencia (incluyendo Daytona Road Course / Indy Road Course).
 */
export function isRoadTrack(name: string, category?: string): boolean {
  const clean = String(name || "").trim();
  if (!clean || clean === "..." || clean === "…") return false;
  if (category && /oval|dirt/i.test(category) && !/road/i.test(category)) return false;

  // Excluir cualquier variante explícita de Oval o Roval (incluso dentro de Daytona/Charlotte/Homestead)
  if (/\b(oval|roval|superspeedway|tri-oval|short\s*track|dirt\s*oval|legends\s*oval)\b/i.test(clean)) {
    return false;
  }

  // Si menciona Speedway pero NO especifica Road Course, excluir
  if (/\bspeedway\b/i.test(clean) && !/\broad(\s*course)?\b/i.test(clean)) {
    return false;
  }

  // Excluir óvalos puros de NASCAR / ARCA / Indy Oval por nombre propio
  if (/\b(talladega|martinsville|bristol|darlington|richmond|pocono|michigan|dover|phoenix|las\s*vegas\s*motor|kansas\s*speedway|texas\s*motor|atlanta\s*motor|chicagoland|kentucky|gateway|nashville\s*superspeedway|new\s*hampshire|north\s*wilkesboro|rockingham|usa\s*international|lanier|langley|oxford\s*plains|stafford|thompson|south\s*boston|irwindale|iowa|lucas\s*oil|auto\s*club|eldora|knoxville|volusia)\b/i.test(clean) && !/\broad(\s*course)?\b/i.test(clean)) {
    return false;
  }

  return true;
}

/**
 * Tiempo medio por vuelta estimado en segundos (referencia GT3 / Endurance Road) para ponderar horas reales en pista.
 * Garantiza que circuitos largos como Nürburgring Combined (~8m25s) o Le Mans (~3m52s) reflejen su peso real frente a trazados cortos.
 */
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
  return 105; // Promedio estándar en circuito Road GP (~1m45s)
}

export function estimateCarLapFactor(carName: string): number {
  const clean = String(carName || "").trim();
  if (/\b(gtp|lmdh|hypercar|499p|valkyrie|963|arx-06|v-series|m\s*hybrid|lmp2|p217)\b/i.test(clean)) {
    return 0.9; // Prototipos completan vuelta en menor tiempo pero en stints largos de resistencia
  }
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
  if (explicitSpecialty && explicitSpecialty.trim()) return explicitSpecialty.trim();
  const carNames = cars.map((c) => c.name).join(" ");
  const hasGtp = /499p|gtp|valkyrie|963/i.test(carNames);
  const hasGt3 = /gt3/i.test(carNames);
  const hasGt4 = /gt4/i.test(carNames);
  if (hasGtp && hasGt3) return "GT3 & GTP Endurance";
  if (hasGt3 && hasGt4) return "Endurance Multiclase GT3 / GT4";
  if (hasGt3) return "Sprint & Endurance GT3";
  return role || "Sports Car Road";
}

export const LICENCE_UPDATED = data.updated;
export const LICENCE_UPDATED_LABEL = data.updatedLabel;

export const PILOTOS: Piloto[] = data.drivers.map((d) => {
  // 1. Filtrado estricto Road + cálculo de horas reales en pista por circuito
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
        timeOnTrack: `${hours.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`,
      };
    })
    .filter((t) => t.hours >= 0.5)
    .sort((a, b) => b.hours - a.hours);

  const totalTrackLaps = roadTracks.reduce((acc, t) => acc + t.laps, 0) || 1;
  const totalTrackSeconds = roadTracks.reduce((acc, t) => acc + t.laps * (t.lapSeconds || 105), 0);
  const weightedAvgLapSec = totalTrackSeconds > 0 ? totalTrackSeconds / totalTrackLaps : 108;

  // 2. Filtrado y cálculo de horas reales en pista por coche
  const roadCars: LapStat[] = (d.topCars || [])
    .filter((c) => c && c.name && !/\b(nascar|stock\s*car|truck|sprint\s*car|midg|late\s*model)\b/i.test(c.name) && Number(c.laps) > 0)
    .map((c) => {
      const cleanName = cleanTrackDisplayName(c.name);
      const hours = computeCarHours(cleanName, c.laps, weightedAvgLapSec);
      return {
        name: cleanName,
        laps: c.laps,
        hours,
        timeOnTrack: `${hours.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`,
      };
    })
    .filter((c) => c.hours >= 0.5)
    .sort((a, b) => b.hours - a.hours);

  const totalTrackHours = Math.round(roadTracks.reduce((acc, t) => acc + t.hours, 0) * 10) / 10;
  const totalCarHours = Math.round(roadCars.reduce((acc, c) => acc + c.hours, 0) * 10) / 10;
  const dynamicRole = (d.role || "").trim() || deriveDynamicSpecialty("", (d as any).specialty, roadCars);
  const dynamicSpecialty = deriveDynamicSpecialty(dynamicRole, (d as any).specialty, roadCars);

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
    favouriteCars: d.favouriteCars || [],
    favouriteSeries: d.favouriteSeries || [],
    achievements: d.achievements || [],
    socials: { ...EMPTY_SOCIALS, ...(d.socials || {}) },
    memberSince: d.memberSince || "",
    club: d.club || "",
    favoriteTrack: d.favoriteTrack || "",
    topTracks: roadTracks,
    topCars: roadCars,
    totalTrackHours,
    totalCarHours,
  };
});
