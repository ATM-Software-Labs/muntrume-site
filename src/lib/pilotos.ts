/**
 * Identidad de la plantilla. El archivo editable es src/data/pilotos.json.
 * Las cifras de licencia no van aquí: viven en licencias.ts o llegan de /api/drivers.
 * Un campo vacío no se pinta.
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
  initials?: string;
}

const EMPTY_SOCIALS: Socials = { twitch: "", youtube: "", instagram: "", x: "" };

export const LICENCE_UPDATED = data.updated;
export const LICENCE_UPDATED_LABEL = data.updatedLabel;

export const PILOTOS: Piloto[] = data.drivers.map((d) => ({
  slug: d.slug,
  cust_id: d.custId,
  dorsal: d.number,
  name: d.shortName,
  fullName: d.fullName,
  role: d.role,
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
  topTracks: d.topTracks || [],
  topCars: d.topCars || [],
}));
