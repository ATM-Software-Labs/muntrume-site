/**
 * Muntrume Motorsport — GitHub-Style Achievements & Trophies Catalog (108 Achievements).
 * Each achievement has its own static subpage at /logros/[slug]/, custom GitHub-inspired hexagonal
 * gradient badge SVG, XP points, tier, unlock criteria, and live progress evaluation per driver.
 */

import { computeAsymptoticRating, type Piloto } from "./pilotos";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "mythic";

export type AchievementCategory =
  | "horas"
  | "velocidad"
  | "seguridad"
  | "circuitos"
  | "coches"
  | "resistencia"
  | "multisim"
  | "comunidad"
  | "leyenda";

export interface AchievementCategoryMeta {
  id: AchievementCategory;
  label: string;
  accent: string;
}

export const ACHIEVEMENT_CATEGORIES: AchievementCategoryMeta[] = [
  { id: "horas", label: "Horas en Pista", accent: "#10B981" },
  { id: "velocidad", label: "Velocidad & iRating", accent: "#3B82F6" },
  { id: "seguridad", label: "Licencias & Seguridad", accent: "#06B6D4" },
  { id: "circuitos", label: "Circuitos Legendarios", accent: "#F59E0B" },
  { id: "coches", label: "Coches & Clases", accent: "#EF4444" },
  { id: "resistencia", label: "Resistencia & Eventos", accent: "#8B5CF6" },
  { id: "multisim", label: "Multi-Sim & Staff", accent: "#EC4899" },
  { id: "comunidad", label: "Comunidad & Ingeniería", accent: "#14B8A6" },
  { id: "leyenda", label: "OVR, Vueltas & Hitos", accent: "#EAB308" },
];

export const TIER_META: Record<
  AchievementTier,
  { label: string; ring: string; bgA: string; bgB: string; text: string; stars: number }
> = {
  bronze: { label: "Bronce", ring: "#D97706", bgA: "#451A03", bgB: "#92400E", text: "#F59E0B", stars: 1 },
  silver: { label: "Plata", ring: "#CBD5E1", bgA: "#1E293B", bgB: "#475569", text: "#E2E8F0", stars: 2 },
  gold: { label: "Oro", ring: "#FBBF24", bgA: "#422006", bgB: "#B45309", text: "#FDE047", stars: 3 },
  platinum: { label: "Platino", ring: "#38BDF8", bgA: "#082F49", bgB: "#0284C7", text: "#7DD3FC", stars: 4 },
  mythic: { label: "Mítico", ring: "#00E699", bgA: "#022C22", bgB: "#059669", text: "#6EE7B7", stars: 5 },
};

export interface DriverMetrics {
  driver: Piloto;
  irating: number;
  sr: number;
  classLabel: string;
  hours: number;
  laps: number;
  ovr: number;
  sims: string[];
  trackNames: string[];
  carNames: string[];
  gt3Count: number;
  uniqueTracks: number;
  uniqueCars: number;
}

export interface AchievementDef {
  slug: string;
  title: string;
  desc: string;
  howTo: string;
  category: AchievementCategory;
  tier: AchievementTier;
  points: number;
  icon: IconKey;
  eval: (m: DriverMetrics) => { unlocked: boolean; pct: number; label: string };
}

export interface EvaluatedAchievement {
  slug: string;
  title: string;
  desc: string;
  howTo: string;
  category: AchievementCategory;
  tier: AchievementTier;
  tierLabel: string;
  points: number;
  icon: IconKey;
  unlocked: boolean;
  progressPct: number;
  progressLabel: string;
}

export type IconKey =
  | "clock"
  | "bolt"
  | "shield"
  | "flag"
  | "car"
  | "trophy"
  | "globe"
  | "wrench"
  | "crown"
  | "star"
  | "flame"
  | "gauge"
  | "compass"
  | "layers"
  | "chat"
  | "award";

const ICON_PATHS: Record<IconKey, string> = {
  clock: `<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v4.8l3.2 1.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  bolt: `<path d="M13 2.5L4.5 13.5h6.5l-1 8 9.5-11h-6.5l0-8z" fill="currentColor"/>`,
  shield: `<path d="M12 3l7 3.5v5.5c0 4.6-3.1 7.9-7 9.5-3.9-1.6-7-4.9-7-9.5V6.5L12 3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4.2-4.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  flag: `<path d="M6 20V4h11l-2.2 4.5L17 13H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  car: `<path d="M5 14l1.5-4.5A2 2 0 0 1 8.4 8h7.2a2 2 0 0 1 1.9 1.5L19 14M4 14h16v3.5a1 1 0 0 1-1 1h-1.5v-1.5h-11v1.5H5a1 1 0 0 1-1-1V14z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="7.5" cy="14" r="1" fill="currentColor"/><circle cx="16.5" cy="14" r="1" fill="currentColor"/>`,
  trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4.5a2 2 0 0 0 0 4H7M17 6h2.5a2 2 0 0 1 0 4H17M12 14v5M8.5 19h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  globe: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  wrench: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.8-2.8a5 5 0 0 1-6.8 6.8l-6.3 6.3a1.8 1.8 0 0 1-2.6-2.6l6.3-6.3a5 5 0 0 1 6.8-6.8l-3.2 3.4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>`,
  crown: `<path d="M4 17l2-9 6 4 6-4 2 9H4z" fill="currentColor"/><circle cx="12" cy="5.5" r="1.5" fill="currentColor"/>`,
  star: `<path d="M12 3l2.6 5.4 6 .8-4.3 4.2 1 5.9L12 16.5 6.7 19.3l1-5.9-4.3-4.2 6-.8L12 3z" fill="currentColor"/>`,
  flame: `<path d="M12 3c.6 4-2.4 5.8-2.4 9a4.4 4.4 0 0 0 8.8 0c0-3.2-2.2-5.2-3.4-9-1 2.2-2 3-3 0z" fill="currentColor"/>`,
  gauge: `<path d="M4.5 16.5a8 8 0 1 1 15 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 13l4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="13" r="1.6" fill="currentColor"/>`,
  compass: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.9"/><polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" fill="currentColor"/>`,
  layers: `<polygon points="12,4 20,8.5 12,13 4,8.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><polyline points="4,12.5 12,17 20,12.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><polyline points="4,16.5 12,21 20,16.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>`,
  chat: `<path d="M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  award: `<circle cx="12" cy="9" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 13.5L8 21l4-2.2L16 21l-1.5-7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
};

/**
 * Generates a vibrant GitHub-style hexagonal achievement medallion SVG.
 */
export function renderAchievementBadgeSvg(
  slug: string,
  tier: AchievementTier,
  icon: IconKey,
  size = 56,
  locked = false,
): string {
  const tm = TIER_META[tier];
  const uid = `g-${slug.replace(/[^a-z0-9]/gi, "")}-${size}`;
  const stars = Array.from({ length: tm.stars })
    .map((_, i) => {
      const totalW = (tm.stars - 1) * 9;
      const cx = 40 - totalW / 2 + i * 9;
      return `<circle cx="${cx}" cy="64" r="2.2" fill="${locked ? "#64748B" : tm.ring}"/>`;
    })
    .join("");

  const bgA = locked ? "#0F172A" : tm.bgA;
  const bgB = locked ? "#1E293B" : tm.bgB;
  const ring = locked ? "#475569" : tm.ring;
  const icoColor = locked ? "#64748B" : "#FFFFFF";

  return `<svg viewBox="0 0 80 80" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}" x1="12" y1="6" x2="68" y2="74" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${bgB}"/>
        <stop offset="100%" stop-color="${bgA}"/>
      </linearGradient>
      <linearGradient id="${uid}-shine" x1="40" y1="8" x2="40" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${locked ? "0.06" : "0.28"}"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M40 4L71 21.5V58.5L40 76L9 58.5V21.5L40 4Z" fill="url(#${uid})" stroke="${ring}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 9L66.5 24V56L40 71L13.5 56V24L40 9Z" fill="none" stroke="${ring}" stroke-opacity="0.32" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M40 6L68 22V38C58 43 22 43 12 38V22L40 6Z" fill="url(#${uid}-shine)"/>
    <g transform="translate(24,20) scale(1.33)" color="${icoColor}">
      ${ICON_PATHS[icon] || ICON_PATHS.trophy}
    </g>
    ${stars}
  </svg>`;
}

/* Helper builders to keep 108 definitions super crisp and zero-duplication */
const pct = (cur: number, target: number) => Math.min(100, Math.max(0, Math.round((cur / target) * 100)));
const hasTrack = (m: DriverMetrics, re: RegExp) => m.trackNames.some((t) => re.test(t));
const hasCar = (m: DriverMetrics, re: RegExp) => m.carNames.some((c) => re.test(c));
const hasAch = (m: DriverMetrics, re: RegExp) =>
  (m.driver.achievements || []).some((a) => re.test(a)) || (m.driver.favouriteSeries || []).some((s) => re.test(s));

const HOURS_TIERS: Array<[string, string, number, AchievementTier, number]> = [
  ["horas-10", "Primeras 10 Horas", 10, "bronze", 15],
  ["horas-25", "Calentando Neumáticos", 25, "bronze", 20],
  ["horas-50", "Piloto Habitual", 50, "bronze", 30],
  ["horas-100", "Centurión de Pista", 100, "silver", 50],
  ["horas-250", "Cuarto de Millar", 250, "silver", 75],
  ["horas-500", "Veterano 500h", 500, "gold", 110],
  ["horas-750", "Maratoniano del Asfalto", 750, "gold", 140],
  ["horas-1000", "Leyenda 1000h", 1000, "platinum", 200],
  ["horas-1500", "Incansable 1500h", 1500, "platinum", 250],
  ["horas-2000", "Doble Milenio", 2000, "platinum", 320],
  ["horas-3000", "Señor del Volante 3000h", 3000, "mythic", 450],
  ["horas-5000", "Inmortal 5000h", 5000, "mythic", 700],
];

const IRATING_TIERS: Array<[string, string, number, AchievementTier, number]> = [
  ["ir-1500", "Nivel Competitivo 1.5K", 1500, "bronze", 20],
  ["ir-1800", "Ritmo Sólido 1.8K", 1800, "bronze", 30],
  ["ir-2000", "Barrera de los 2K", 2000, "silver", 45],
  ["ir-2500", "Split Alto 2.5K", 2500, "silver", 65],
  ["ir-3000", "Top Split 3K+", 3000, "gold", 100],
  ["ir-3500", "Velocidad Pura 3.5K", 3500, "gold", 130],
  ["ir-4000", "Élite 4K", 4000, "platinum", 180],
  ["ir-4500", "Cazador de Podios 4.5K", 4500, "platinum", 220],
  ["ir-5000", "Club de los 5K", 5000, "platinum", 280],
  ["ir-6000", "Súper Split 6K", 6000, "mythic", 380],
  ["ir-7000", "Pro Pace 7K", 7000, "mythic", 500],
  ["ir-8000", "Alien 8K+", 8000, "mythic", 750],
];

const TRACK_BADGES: Array<[string, string, RegExp, string, AchievementTier, number]> = [
  ["circuito-daytona", "Domador de Daytona", /daytona/i, "Daytona International Speedway", "gold", 80],
  ["circuito-lemans", "Espíritu de Le Mans", /le mans|sarthe/i, "Circuit des 24 Heures du Mans", "platinum", 110],
  ["circuito-spa", "Rey de Eau Rouge", /spa/i, "Circuit de Spa-Francorchamps", "gold", 85],
  ["circuito-sebring", "Superviviente de Sebring", /sebring/i, "Sebring International Raceway", "gold", 80],
  ["circuito-nordschleife", "Infierno Verde", /nürburgring|nurburgring|nordschleife/i, "Nürburgring Combined", "platinum", 120],
  ["circuito-watkins", "Clásico de Watkins Glen", /watkins/i, "Watkins Glen International", "silver", 60],
  ["circuito-monza", "Templo de la Velocidad", /monza/i, "Autodromo Nazionale Monza", "silver", 60],
  ["circuito-suzuka", "Técnico de Suzuka", /suzuka/i, "Suzuka International Racing Course", "gold", 85],
  ["circuito-road-atlanta", "Coraje en Road Atlanta", /road atlanta/i, "Road Atlanta", "silver", 65],
  ["circuito-road-america", "Velocista de Road America", /road america/i, "Road America", "silver", 65],
  ["circuito-imola", "Curvas de Imola", /imola|enzo/i, "Autodromo Enzo e Dino Ferrari", "silver", 65],
  ["circuito-interlagos", "Magia en Interlagos", /interlagos|carlos pace/i, "Autódromo José Carlos Pace", "silver", 65],
];

const CAR_BADGES: Array<[string, string, RegExp, string, AchievementTier, number]> = [
  ["coche-mustang-gt3", "Pony Power Mustang GT3", /mustang/i, "Ford Mustang GT3", "silver", 55],
  ["coche-ferrari", "Tifoso del Cavallino", /ferrari/i, "Ferrari GT3 / Challenge", "silver", 55],
  ["coche-mclaren", "Precisión Woking", /mclaren/i, "McLaren 720S GT3 EVO", "silver", 55],
  ["coche-porsche", "ADN Stuttgart", /porsche/i, "Porsche 911 GT3 / Cup / 963", "silver", 60],
  ["coche-bmw", "Fuerza M Motorsport", /bmw/i, "BMW M4 GT3 / M Hybrid V8", "silver", 55],
  ["coche-lamborghini", "Toro de Sant'Agata", /lamborghini|hurac/i, "Lamborghini Huracán GT3 EVO2", "silver", 55],
  ["coche-mercedes", "Flecha de Plata AMG", /mercedes|amg/i, "Mercedes-AMG GT3", "silver", 55],
  ["coche-prototipo", "Piloto de Prototipos", /gtp|lmp2|499p|963|cadillac|dallara p217/i, "GTP / Hypercar / LMP2", "gold", 90],
  ["coche-formula", "Especialista Open-Wheel", /formula|f4|f3|super formula|indy/i, "Monoplazas Fórmula", "silver", 60],
];

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  // 1. HORAS EN PISTA (12)
  ...HOURS_TIERS.map(([slug, title, target, tier, points]) => ({
    slug,
    title,
    desc: `Acumula al menos ${target.toLocaleString("es-ES")} horas verificadas en pista en telemetría.`,
    howTo: `Registra ${target.toLocaleString("es-ES")} h en pista con Garage 61 conectado al equipo Muntrume Motorsport.`,
    category: "horas" as const,
    tier,
    points,
    icon: "clock" as const,
    eval: (m: DriverMetrics) => ({
      unlocked: m.hours >= target,
      pct: pct(m.hours, target),
      label: `${Math.round(m.hours)} / ${target} h`,
    }),
  })),

  // 2. VELOCIDAD & IRATING (12)
  ...IRATING_TIERS.map(([slug, title, target, tier, points]) => ({
    slug,
    title,
    desc: `Alcanza ${(target / 1000).toFixed(1)}k de iRating oficial en competición Sports Car.`,
    howTo: `Compite en sesiones oficiales y sube tu iRating por encima de ${target.toLocaleString("es-ES")}.`,
    category: "velocidad" as const,
    tier,
    points,
    icon: "bolt" as const,
    eval: (m: DriverMetrics) => ({
      unlocked: m.irating >= target,
      pct: pct(m.irating, target),
      label: `${m.irating} / ${target} iR`,
    }),
  })),

  // 3. LICENCIAS & SEGURIDAD (12)
  {
    slug: "licencia-rookie",
    title: "Bautismo en Pista",
    desc: "Licencia activa oficial en iRacing vinculada al roster de Muntrume.",
    howTo: "Vincula tu cuenta de iRacing al perfil del equipo.",
    category: "seguridad",
    tier: "bronze",
    points: 15,
    icon: "shield",
    eval: (m) => ({ unlocked: Boolean(m.classLabel || m.driver.cust_id), pct: m.classLabel ? 100 : 0, label: m.classLabel || "Sin licencia" }),
  },
  {
    slug: "licencia-d",
    title: "Licencia Clase D",
    desc: "Supera la etapa Rookie y obtén licencia Sports Car Clase D o superior.",
    howTo: "Completa carreras limpias y asciende a Class D.",
    category: "seguridad",
    tier: "bronze",
    points: 25,
    icon: "shield",
    eval: (m) => {
      const ok = /class\s*[dcba]|pro/i.test(m.classLabel);
      return { unlocked: ok, pct: ok ? 100 : 25, label: m.classLabel || "Rookie" };
    },
  },
  {
    slug: "licencia-c",
    title: "Licencia Clase C",
    desc: "Acceso a campeonatos de resistencia y GT4/Porsche Cup.",
    howTo: "Asciende a licencia Class C en Sports Car.",
    category: "seguridad",
    tier: "silver",
    points: 45,
    icon: "shield",
    eval: (m) => {
      const ok = /class\s*[cba]|pro/i.test(m.classLabel);
      return { unlocked: ok, pct: ok ? 100 : 40, label: m.classLabel || "Sin clase C" };
    },
  },
  {
    slug: "licencia-b",
    title: "Licencia Clase B",
    desc: "Acreditado para GT Sprint, GT3 Challenge y campeonatos de alto nivel.",
    howTo: "Asciende a licencia Class B en Sports Car.",
    category: "seguridad",
    tier: "gold",
    points: 75,
    icon: "shield",
    eval: (m) => {
      const ok = /class\s*[ba]|pro/i.test(m.classLabel);
      return { unlocked: ok, pct: ok ? 100 : 60, label: m.classLabel || "Sin clase B" };
    },
  },
  {
    slug: "licencia-a",
    title: "Licencia Clase A",
    desc: "Máxima categoría amateur: acceso completo a IMSA Multiclase y Special Events.",
    howTo: "Alcanza licencia Class A manteniendo un Safety Rating constante.",
    category: "seguridad",
    tier: "platinum",
    points: 120,
    icon: "shield",
    eval: (m) => {
      const ok = /class\s*a|pro/i.test(m.classLabel);
      return { unlocked: ok, pct: ok ? 100 : 75, label: m.classLabel || "Sin clase A" };
    },
  },
  {
    slug: "licencia-pro",
    title: "Licencia Pro / WC",
    desc: "Élite profesional de eSports en campeonatos mundiales oficiales.",
    howTo: "Clasifícate para la licencia Pro / World Championship.",
    category: "seguridad",
    tier: "mythic",
    points: 500,
    icon: "crown",
    eval: (m) => {
      const ok = /pro|wc/i.test(m.classLabel);
      return { unlocked: ok, pct: ok ? 100 : 20, label: m.classLabel || "Objetivo Pro" };
    },
  },
  {
    slug: "sr-25",
    title: "Conducción Segura 2.5+",
    desc: "Mantén un Safety Rating superior a 2.50 en competición oficial.",
    howTo: "Minimiza off-tracks y contactos hasta alcanzar SR 2.50.",
    category: "seguridad",
    tier: "bronze",
    points: 20,
    icon: "shield",
    eval: (m) => ({ unlocked: m.sr >= 2.5, pct: pct(m.sr, 2.5), label: `SR ${m.sr.toFixed(2)} / 2.50` }),
  },
  {
    slug: "sr-30",
    title: "Piloto Limpio 3.0+",
    desc: "Safety Rating consolidado por encima de 3.00.",
    howTo: "Mantén tu Safety Rating en 3.00 o superior.",
    category: "seguridad",
    tier: "silver",
    points: 50,
    icon: "shield",
    eval: (m) => ({ unlocked: m.sr >= 3.0, pct: pct(m.sr, 3.0), label: `SR ${m.sr.toFixed(2)} / 3.00` }),
  },
  {
    slug: "sr-35",
    title: "Guante Blanco 3.5+",
    desc: "Conducción quirúrgica por encima de 3.50 de Safety Rating.",
    howTo: "Encadena carreras limpias hasta alcanzar SR 3.50.",
    category: "seguridad",
    tier: "gold",
    points: 85,
    icon: "shield",
    eval: (m) => ({ unlocked: m.sr >= 3.5, pct: pct(m.sr, 3.5), label: `SR ${m.sr.toFixed(2)} / 3.50` }),
  },
  {
    slug: "sr-40",
    title: "Intocable 4.0+",
    desc: "Safety Rating de élite superior a 4.00: referencia de limpieza en pista.",
    howTo: "Supera 4.00 de Safety Rating en Sports Car.",
    category: "seguridad",
    tier: "platinum",
    points: 140,
    icon: "shield",
    eval: (m) => ({ unlocked: m.sr >= 4.0, pct: pct(m.sr, 4.0), label: `SR ${m.sr.toFixed(2)} / 4.00` }),
  },
  {
    slug: "sr-45",
    title: "Maestro del Respeto 4.5+",
    desc: "Precisión milimétrica en tráfico multiclase por encima de SR 4.50.",
    howTo: "Supera 4.50 de Safety Rating.",
    category: "seguridad",
    tier: "platinum",
    points: 200,
    icon: "shield",
    eval: (m) => ({ unlocked: m.sr >= 4.5, pct: pct(m.sr, 4.5), label: `SR ${m.sr.toFixed(2)} / 4.50` }),
  },
  {
    slug: "sr-499",
    title: "Perfección 4.99",
    desc: "El techo máximo de Safety Rating posible en el simulador.",
    howTo: "Alcanza el legendario 4.99 de Safety Rating.",
    category: "seguridad",
    tier: "mythic",
    points: 400,
    icon: "star",
    eval: (m) => ({ unlocked: m.sr >= 4.95, pct: pct(m.sr, 4.99), label: `SR ${m.sr.toFixed(2)} / 4.99` }),
  },

  // 4. CIRCUITOS LEGENDARIOS (12)
  ...TRACK_BADGES.map(([slug, title, re, trackLabel, tier, points]) => ({
    slug,
    title,
    desc: `Telemetría verificada rodando en ${trackLabel}.`,
    howTo: `Completa tandas registradas en ${trackLabel} con Garage 61.`,
    category: "circuitos" as const,
    tier,
    points,
    icon: "compass" as const,
    eval: (m: DriverMetrics) => {
      const ok = hasTrack(m, re);
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Verificado" : "Pendiente" };
    },
  })),

  // 5. COCHES & CLASES (12)
  ...CAR_BADGES.map(([slug, title, re, carLabel, tier, points]) => ({
    slug,
    title,
    desc: `Experiencia verificada al volante de ${carLabel}.`,
    howTo: `Registra tandas oficiales o de entrenamiento con ${carLabel}.`,
    category: "coches" as const,
    tier,
    points,
    icon: "car" as const,
    eval: (m: DriverMetrics) => {
      const ok = hasCar(m, re);
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Dominado" : "Sin tandas" };
    },
  })),
  {
    slug: "maestro-gt3",
    title: "Maestro GT3",
    desc: "Domina al menos 3 modelos GT3 distintos con más de 300 vueltas cada uno.",
    howTo: "Rueda 300+ vueltas en 3 GT3 diferentes (Mustang, 720S, Ferrari, BMW, Porsche...).",
    category: "coches",
    tier: "gold",
    points: 110,
    icon: "car",
    eval: (m) => ({ unlocked: m.gt3Count >= 3, pct: pct(m.gt3Count, 3), label: `${m.gt3Count} / 3 GT3` }),
  },
  {
    slug: "coleccionista-5-coches",
    title: "Garaje Versátil (5+)",
    desc: "Pilota al menos 5 coches diferentes en telemetría del equipo.",
    howTo: "Registra tandas verificadas en 5 modelos distintos.",
    category: "coches",
    tier: "silver",
    points: 60,
    icon: "layers",
    eval: (m) => ({ unlocked: m.uniqueCars >= 5, pct: pct(m.uniqueCars, 5), label: `${m.uniqueCars} / 5 coches` }),
  },
  {
    slug: "coleccionista-10-coches",
    title: "Polivalente Total (10+)",
    desc: "Adapta tu estilo de conducción a 10 o más vehículos distintos.",
    howTo: "Registra telemetría oficial en 10 coches diferentes.",
    category: "coches",
    tier: "gold",
    points: 130,
    icon: "layers",
    eval: (m) => ({ unlocked: m.uniqueCars >= 10, pct: pct(m.uniqueCars, 10), label: `${m.uniqueCars} / 10 coches` }),
  },

  // 6. RESISTENCIA & SPECIAL EVENTS (12)
  {
    slug: "endurance-24h-daytona",
    title: "24h de Daytona",
    desc: "Preparación o participación en la mítica cita de resistencia de Florida.",
    howTo: "Rueda tandas largas de preparación o disputa las 24h de Daytona con MMT.",
    category: "resistencia",
    tier: "gold",
    points: 120,
    icon: "flag",
    eval: (m) => {
      const ok = hasTrack(m, /daytona/i) && m.hours >= 100;
      return { unlocked: ok, pct: ok ? 100 : hasTrack(m, /daytona/i) ? 50 : 0, label: ok ? "Completado" : "En preparación" };
    },
  },
  {
    slug: "endurance-12h-sebring",
    title: "12h de Sebring",
    desc: "Resiste los baches de hormigón de Sebring en formato endurance.",
    howTo: "Prepara o compite en las 12h de Sebring con el equipo.",
    category: "resistencia",
    tier: "gold",
    points: 120,
    icon: "flag",
    eval: (m) => {
      const ok = hasTrack(m, /sebring/i) && m.hours >= 100;
      return { unlocked: ok, pct: ok ? 100 : hasTrack(m, /sebring/i) ? 50 : 0, label: ok ? "Completado" : "En preparación" };
    },
  },
  {
    slug: "endurance-24h-spa",
    title: "24h de Spa-Francorchamps",
    desc: "Superviviente del mayor clásico GT3 de 24 horas en las Ardenas.",
    howTo: "Rueda tandas de resistencia o disputa las 24h de Spa con Muntrume.",
    category: "resistencia",
    tier: "platinum",
    points: 160,
    icon: "flag",
    eval: (m) => {
      const ok = hasTrack(m, /spa/i) && m.hours >= 150;
      return { unlocked: ok, pct: ok ? 100 : hasTrack(m, /spa/i) ? 50 : 0, label: ok ? "Completado" : "En preparación" };
    },
  },
  {
    slug: "endurance-24h-lemans",
    title: "24 Heures du Mans",
    desc: "La joya de la corona: resistencia en el Circuit de la Sarthe.",
    howTo: "Entrena o compite en Le Mans (iRacing o Le Mans Ultimate).",
    category: "resistencia",
    tier: "platinum",
    points: 180,
    icon: "trophy",
    eval: (m) => {
      const ok = hasTrack(m, /le mans|sarthe/i) || m.sims.includes("lmu");
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Acreditado" : "Pendiente" };
    },
  },
  {
    slug: "endurance-24h-nurburgring",
    title: "24h de Nürburgring",
    desc: "Domina los 25 km del Nordschleife entre tráfico y noche cerrada.",
    howTo: "Rueda en Nürburgring Combined con telemetría verificada.",
    category: "resistencia",
    tier: "platinum",
    points: 180,
    icon: "flame",
    eval: (m) => {
      const ok = hasTrack(m, /nürburgring|nurburgring/i) && m.hours >= 200;
      return { unlocked: ok, pct: ok ? 100 : hasTrack(m, /nürburgring|nurburgring/i) ? 50 : 0, label: ok ? "Completado" : "Pendiente" };
    },
  },
  {
    slug: "endurance-6h-watkins",
    title: "6h of The Glen",
    desc: "Resistencia a alta velocidad por el estado de Nueva York.",
    howTo: "Registra tandas largas en Watkins Glen Boot.",
    category: "resistencia",
    tier: "silver",
    points: 85,
    icon: "flag",
    eval: (m) => {
      const ok = hasTrack(m, /watkins/i) && m.hours >= 80;
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Completado" : "Pendiente" };
    },
  },
  {
    slug: "endurance-petit-lemans",
    title: "Petit Le Mans 10h",
    desc: "Cierre de temporada IMSA en las colinas de Road Atlanta.",
    howTo: "Rueda en Road Atlanta Full Course en formato resistencia.",
    category: "resistencia",
    tier: "gold",
    points: 110,
    icon: "flag",
    eval: (m) => {
      const ok = hasTrack(m, /road atlanta/i) && m.hours >= 100;
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Completado" : "Pendiente" };
    },
  },
  {
    slug: "endurance-bathurst-12h",
    title: "12h de Mount Panorama",
    desc: "Valiente entre los muros de Bathurst en Australia.",
    howTo: "Registra tandas en Bathurst / Mount Panorama.",
    category: "resistencia",
    tier: "gold",
    points: 130,
    icon: "flame",
    eval: (m) => {
      const ok = hasTrack(m, /bathurst|panorama/i);
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Completado" : "Pendiente" };
    },
  },
  {
    slug: "endurance-suzuka-1000",
    title: "Suzuka 1000km",
    desc: "Precisión japonesa durante 1000 kilómetros de competición.",
    howTo: "Rueda tandas de resistencia en Suzuka.",
    category: "resistencia",
    tier: "gold",
    points: 120,
    icon: "flag",
    eval: (m) => {
      const ok = hasTrack(m, /suzuka/i);
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Completado" : "Pendiente" };
    },
  },
  {
    slug: "endurance-triple-corona",
    title: "Triple Corona Endurance",
    desc: "Telemetría verificada en Daytona, Spa y Le Mans.",
    howTo: "Acumula experiencia en los tres grandes templos: Daytona, Spa y Le Mans.",
    category: "resistencia",
    tier: "mythic",
    points: 300,
    icon: "crown",
    eval: (m) => {
      const count = [hasTrack(m, /daytona/i), hasTrack(m, /spa/i), hasTrack(m, /le mans|sarthe/i)].filter(Boolean).length;
      return { unlocked: count === 3, pct: pct(count, 3), label: `${count} / 3 templos` };
    },
  },
  {
    slug: "endurance-stint-nocturno",
    title: "Especialista Nocturno",
    desc: "Piloto de confianza para los stints de madrugada en carreras de 24 horas.",
    howTo: "Supera las 300h en pista y mantén SR >= 3.0.",
    category: "resistencia",
    tier: "gold",
    points: 110,
    icon: "star",
    eval: (m) => {
      const ok = m.hours >= 300 && m.sr >= 3.0;
      return { unlocked: ok, pct: pct(m.hours, 300), label: ok ? "Acreditado" : `${Math.round(m.hours)} / 300 h` };
    },
  },
  {
    slug: "endurance-capitan",
    title: "Capitán de Resistencia",
    desc: "Lidera estrategias, relevos y combustible en eventos especiales MMT.",
    howTo: "Participa en la planificación estratégica y resistencia oficial del equipo.",
    category: "resistencia",
    tier: "platinum",
    points: 160,
    icon: "award",
    eval: (m) => {
      const ok = m.driver.badge === "FOUNDER" || hasAch(m, /resistencia|endurance|imsa/i);
      return { unlocked: ok, pct: ok ? 100 : 30, label: ok ? "Capitán" : "En curso" };
    },
  },

  // 7. MULTI-SIM & STAFF (12)
  {
    slug: "sim-iracing",
    title: "Piloto iRacing",
    desc: "Compite oficialmente bajo los colores de Muntrume en iRacing.",
    howTo: "Activa iRacing en tu perfil oficial de piloto.",
    category: "multisim",
    tier: "bronze",
    points: 25,
    icon: "globe",
    eval: (m) => ({ unlocked: m.sims.includes("iracing"), pct: m.sims.includes("iracing") ? 100 : 0, label: m.sims.includes("iracing") ? "Activo" : "Inactivo" }),
  },
  {
    slug: "sim-lmu",
    title: "Piloto Le Mans Ultimate",
    desc: "Representa a Muntrume en el campeonato oficial WEC de Le Mans Ultimate.",
    howTo: "Añade Le Mans Ultimate (lmu) a tus plataformas en el roster.",
    category: "multisim",
    tier: "silver",
    points: 45,
    icon: "globe",
    eval: (m) => ({ unlocked: m.sims.includes("lmu"), pct: m.sims.includes("lmu") ? 100 : 0, label: m.sims.includes("lmu") ? "Activo" : "Inactivo" }),
  },
  {
    slug: "sim-ac-evo",
    title: "Pionero Assetto Corsa EVO",
    desc: "Entre los primeros pilotos del equipo en rodar en Assetto Corsa EVO.",
    howTo: "Añade Assetto Corsa EVO (ac_evo) a tu ficha oficial.",
    category: "multisim",
    tier: "silver",
    points: 50,
    icon: "flame",
    eval: (m) => ({ unlocked: m.sims.includes("ac_evo"), pct: m.sims.includes("ac_evo") ? 100 : 0, label: m.sims.includes("ac_evo") ? "Activo" : "Inactivo" }),
  },
  {
    slug: "sim-acc",
    title: "Especialista ACC",
    desc: "Compite en GT World Challenge en Assetto Corsa Competizione.",
    howTo: "Activa ACC (acc) en tu perfil de piloto.",
    category: "multisim",
    tier: "silver",
    points: 40,
    icon: "car",
    eval: (m) => ({ unlocked: m.sims.includes("acc"), pct: m.sims.includes("acc") ? 100 : 0, label: m.sims.includes("acc") ? "Activo" : "Inactivo" }),
  },
  {
    slug: "sim-rf2",
    title: "Veterano rFactor 2",
    desc: "Experiencia en físicas y resistencia clásica en rFactor 2.",
    howTo: "Activa rFactor 2 (rf2) en tu perfil.",
    category: "multisim",
    tier: "silver",
    points: 45,
    icon: "globe",
    eval: (m) => ({ unlocked: m.sims.includes("rf2"), pct: m.sims.includes("rf2") ? 100 : 0, label: m.sims.includes("rf2") ? "Activo" : "Inactivo" }),
  },
  {
    slug: "sim-ams2",
    title: "Explorador Automobilista 2",
    desc: "Pilota históricos, GT y prototipos en Automobilista 2.",
    howTo: "Activa AMS2 (ams2) en tu perfil.",
    category: "multisim",
    tier: "bronze",
    points: 35,
    icon: "compass",
    eval: (m) => ({ unlocked: m.sims.includes("ams2"), pct: m.sims.includes("ams2") ? 100 : 0, label: m.sims.includes("ams2") ? "Activo" : "Inactivo" }),
  },
  {
    slug: "sim-f1",
    title: "Piloto F1",
    desc: "Velocidad al límite en monoplazas de Fórmula 1.",
    howTo: "Activa F1 (f1) en tu ficha de Muntrume.",
    category: "multisim",
    tier: "bronze",
    points: 35,
    icon: "bolt",
    eval: (m) => ({ unlocked: m.sims.includes("f1"), pct: m.sims.includes("f1") ? 100 : 0, label: m.sims.includes("f1") ? "Activo" : "Inactivo" }),
  },
  {
    slug: "multisim-doble",
    title: "Doble Simulador",
    desc: "Compite activamente en al menos 2 simuladores distintos.",
    howTo: "Registra 2 simuladores activos en tu perfil del equipo.",
    category: "multisim",
    tier: "silver",
    points: 60,
    icon: "layers",
    eval: (m) => {
      const c = m.sims.filter((s) => s !== "staff").length;
      return { unlocked: c >= 2, pct: pct(c, 2), label: `${c} / 2 sims` };
    },
  },
  {
    slug: "multisim-triple",
    title: "Tri-Simulador",
    desc: "Domina 3 plataformas de sim racing diferentes bajo los colores de MMT.",
    howTo: "Compite en 3 simuladores distintos (ej. iRacing + LMU + AC EVO).",
    category: "multisim",
    tier: "gold",
    points: 110,
    icon: "layers",
    eval: (m) => {
      const c = m.sims.filter((s) => s !== "staff").length;
      return { unlocked: c >= 3, pct: pct(c, 3), label: `${c} / 3 sims` };
    },
  },
  {
    slug: "multisim-penta",
    title: "Pentatlón Sim Racing",
    desc: "Un todoterreno absoluto activo en 5 o más simuladores.",
    howTo: "Participa en 5 simuladores diferentes del catálogo Muntrume.",
    category: "multisim",
    tier: "platinum",
    points: 200,
    icon: "globe",
    eval: (m) => {
      const c = m.sims.filter((s) => s !== "staff").length;
      return { unlocked: c >= 5, pct: pct(c, 5), label: `${c} / 5 sims` };
    },
  },
  {
    slug: "staff-ingenieria",
    title: "Staff & Ingeniería MMT",
    desc: "Miembro oficial del equipo de ingeniería, telemetría, media o gestión.",
    howTo: "Forma parte del staff técnico u operativo de Muntrume Motorsport.",
    category: "multisim",
    tier: "gold",
    points: 120,
    icon: "wrench",
    eval: (m) => {
      const ok = m.sims.includes("staff") || m.driver.memberType === "staff" || m.driver.badge === "FOUNDER";
      return { unlocked: ok, pct: ok ? 100 : 0, label: ok ? "Staff Oficial" : "Solo Staff" };
    },
  },
  {
    slug: "embajador-internacional",
    title: "Embajador Internacional",
    desc: "Representa a Muntrume Motorsport desde fuera de España o en clubes globales.",
    howTo: "Forma parte del equipo compitiendo internacionalmente.",
    category: "multisim",
    tier: "silver",
    points: 70,
    icon: "globe",
    eval: (m) => {
      const ok = !/spain|españa/i.test(m.driver.country || "");
      return { unlocked: ok, pct: ok ? 100 : 0, label: m.driver.country || "Global" };
    },
  },

  // 8. COMUNIDAD, TELEMETRÍA & FORO (12)
  {
    slug: "comunidad-piloto-oficial",
    title: "Piloto Oficial MMT",
    desc: "Integrante verificado de la plantilla oficial de Muntrume Motorsport.",
    howTo: "Únete al roster oficial de Muntrume Motorsport.",
    category: "comunidad",
    tier: "silver",
    points: 50,
    icon: "award",
    eval: () => ({ unlocked: true, pct: 100, label: "Miembro Oficial" }),
  },
  {
    slug: "comunidad-fundador",
    title: "Fundador Muntrume",
    desc: "Creador, director de equipo y arquitecto del ecosistema Muntrume Motorsport.",
    howTo: "Insignia exclusiva otorgada al fundador del equipo.",
    category: "comunidad",
    tier: "mythic",
    points: 500,
    icon: "crown",
    eval: (m) => ({ unlocked: m.driver.badge === "FOUNDER", pct: m.driver.badge === "FOUNDER" ? 100 : 0, label: m.driver.badge === "FOUNDER" ? "Fundador" : "Exclusivo" }),
  },
  {
    slug: "comunidad-garage61",
    title: "Telemetría Garage 61",
    desc: "Cuenta sincronizada con telemetría real verificada en Garage 61.",
    howTo: "Conecta tu cuenta al equipo Muntrume Motorsport en Garage 61.",
    category: "comunidad",
    tier: "bronze",
    points: 30,
    icon: "gauge",
    eval: (m) => ({ unlocked: m.hours > 0, pct: m.hours > 0 ? 100 : 0, label: m.hours > 0 ? "Sincronizado" : "Pendiente" }),
  },
  {
    slug: "comunidad-mmt-sync",
    title: "Usuario MMT Sync",
    desc: "Utiliza la app de escritorio MMT Sync para setups .sto y overlays HUD.",
    howTo: "Instala y vincula MMT Sync Desktop con tu cuenta de piloto.",
    category: "comunidad",
    tier: "silver",
    points: 55,
    icon: "wrench",
    eval: (m) => ({ unlocked: m.hours >= 50 || m.driver.badge === "FOUNDER", pct: m.hours >= 50 ? 100 : pct(m.hours, 50), label: m.hours >= 50 ? "Activo" : "Pendiente" }),
  },
  {
    slug: "comunidad-arquitecto-setups",
    title: "Arquitecto de Setups",
    desc: "Desarrolla y comparte setups .sto competitivos con la escudería.",
    howTo: "Contribuye al desarrollo de setups del equipo o telemetría avanzada.",
    category: "comunidad",
    tier: "gold",
    points: 120,
    icon: "wrench",
    eval: (m) => {
      const ok = m.driver.badge === "FOUNDER" || /telemetr|setup|ingenier/i.test(m.driver.role + " " + m.driver.bio);
      return { unlocked: ok, pct: ok ? 100 : 20, label: ok ? "Ingeniero" : "En progreso" };
    },
  },
  {
    slug: "comunidad-analista-foro",
    title: "Analista del Foro",
    desc: "Publica análisis de carrera, debriefs o guías en forum.muntru.me.",
    howTo: "Publica un hilo técnico en https://forum.muntru.me/.",
    category: "comunidad",
    tier: "silver",
    points: 65,
    icon: "chat",
    eval: (m) => {
      const ok = m.driver.badge === "FOUNDER" || m.hours >= 200;
      return { unlocked: ok, pct: ok ? 100 : 40, label: ok ? "Contribuidor" : "Publica en el foro" };
    },
  },
  {
    slug: "comunidad-veterano-2024",
    title: "Veterano 2024",
    desc: "En Muntrume Motorsport desde los orígenes del proyecto en 2024.",
    howTo: "Miembro oficial desde el año fundacional 2024.",
    category: "comunidad",
    tier: "gold",
    points: 100,
    icon: "star",
    eval: (m) => {
      const ok = Number(m.driver.memberSince) <= 2024;
      return { unlocked: ok, pct: ok ? 100 : 0, label: `Desde ${m.driver.memberSince || "2026"}` };
    },
  },
  {
    slug: "comunidad-veterano-2025",
    title: "Generación 2025",
    desc: "Consolidando la escudería durante la expansión de 2025.",
    howTo: "Miembro oficial desde 2025 o antes.",
    category: "comunidad",
    tier: "silver",
    points: 60,
    icon: "star",
    eval: (m) => {
      const ok = Number(m.driver.memberSince) <= 2025;
      return { unlocked: ok, pct: ok ? 100 : 0, label: `Desde ${m.driver.memberSince || "2026"}` };
    },
  },
  {
    slug: "comunidad-creador-overlays",
    title: "Creador de Overlays",
    desc: "Contribuye al diseño o testing de los 15 módulos open-source de MMT Sync.",
    howTo: "Participa en el desarrollo o feedback de MMT Sync Overlays.",
    category: "comunidad",
    tier: "platinum",
    points: 150,
    icon: "layers",
    eval: (m) => ({ unlocked: m.driver.badge === "FOUNDER", pct: m.driver.badge === "FOUNDER" ? 100 : 15, label: m.driver.badge === "FOUNDER" ? "Core Dev" : "Open Source" }),
  },
  {
    slug: "comunidad-mentor",
    title: "Mentor de Paddock",
    desc: "Ayuda a nuevos pilotos con trazadas, frenada y lectura de telemetría.",
    howTo: "Comparte coaching o análisis en Discord y forum.muntru.me.",
    category: "comunidad",
    tier: "gold",
    points: 110,
    icon: "chat",
    eval: (m) => {
      const ok = m.hours >= 500 || m.driver.badge === "FOUNDER";
      return { unlocked: ok, pct: pct(m.hours, 500), label: ok ? "Mentor" : `${Math.round(m.hours)} / 500 h` };
    },
  },
  {
    slug: "comunidad-fotografo",
    title: "Fotógrafo de Pista",
    desc: "Aporta capturas y wallpapers a la galería oficial de muntru.me.",
    howTo: "Sube capturas verificadas a la galería o álbumes de Muntrume.",
    category: "comunidad",
    tier: "bronze",
    points: 40,
    icon: "star",
    eval: (m) => ({ unlocked: m.driver.badge === "FOUNDER", pct: m.driver.badge === "FOUNDER" ? 100 : 20, label: m.driver.badge === "FOUNDER" ? "Publicado" : "Sube una foto" }),
  },
  {
    slug: "comunidad-trotamundos",
    title: "Trotamundos (10+ Circuitos)",
    desc: "Telemetría verificada en al menos 10 circuitos oficiales distintos.",
    howTo: "Registra tandas en 10 circuitos diferentes en Garage 61.",
    category: "comunidad",
    tier: "gold",
    points: 95,
    icon: "compass",
    eval: (m) => ({ unlocked: m.uniqueTracks >= 10, pct: pct(m.uniqueTracks, 10), label: `${m.uniqueTracks} / 10 circuitos` }),
  },

  // 9. OVR, VUELTAS & HITOS LEYENDA (12)
  {
    slug: "ovr-55",
    title: "MTI Rating 55+",
    desc: "Supera 55 puntos en el Muntrume Telemetry Index (OVR).",
    howTo: "Combina iRating, Safety Rating y horas en pista para subir tu OVR.",
    category: "leyenda",
    tier: "bronze",
    points: 25,
    icon: "gauge",
    eval: (m) => ({ unlocked: m.ovr >= 55, pct: pct(m.ovr, 55), label: `OVR ${m.ovr} / 55` }),
  },
  {
    slug: "ovr-65",
    title: "MTI Rating 65+",
    desc: "Piloto consolidado por encima de 65 OVR en el índice Muntrume.",
    howTo: "Alcanza 65 puntos OVR combinando ritmo, limpieza y experiencia.",
    category: "leyenda",
    tier: "silver",
    points: 55,
    icon: "gauge",
    eval: (m) => ({ unlocked: m.ovr >= 65, pct: pct(m.ovr, 65), label: `OVR ${m.ovr} / 65` }),
  },
  {
    slug: "ovr-70",
    title: "MTI Rating 70+",
    desc: "Nivel competitivo superior: barrera de los 70 puntos OVR.",
    howTo: "Alcanza 70 puntos OVR en tu ficha de piloto.",
    category: "leyenda",
    tier: "gold",
    points: 95,
    icon: "gauge",
    eval: (m) => ({ unlocked: m.ovr >= 70, pct: pct(m.ovr, 70), label: `OVR ${m.ovr} / 70` }),
  },
  {
    slug: "ovr-75",
    title: "MTI Rating 75+",
    desc: "Referente de equipo por encima de 75 puntos OVR.",
    howTo: "Alcanza 75 puntos OVR con alto iRating y Safety Rating.",
    category: "leyenda",
    tier: "platinum",
    points: 150,
    icon: "gauge",
    eval: (m) => ({ unlocked: m.ovr >= 75, pct: pct(m.ovr, 75), label: `OVR ${m.ovr} / 75` }),
  },
  {
    slug: "ovr-80",
    title: "MTI Rating 80+",
    desc: "Élite absoluta de Muntrume Motorsport (OVR 80+).",
    howTo: "Supera 80 puntos en el Muntrume Telemetry Index.",
    category: "leyenda",
    tier: "platinum",
    points: 220,
    icon: "crown",
    eval: (m) => ({ unlocked: m.ovr >= 80, pct: pct(m.ovr, 80), label: `OVR ${m.ovr} / 80` }),
  },
  {
    slug: "ovr-85",
    title: "MTI Rating 85+",
    desc: "Nivel Alien verificado por telemetría (OVR 85+).",
    howTo: "Supera 85 puntos en el Muntrume Telemetry Index.",
    category: "leyenda",
    tier: "mythic",
    points: 350,
    icon: "crown",
    eval: (m) => ({ unlocked: m.ovr >= 85, pct: pct(m.ovr, 85), label: `OVR ${m.ovr} / 85` }),
  },
  {
    slug: "vueltas-1000",
    title: "1.000 Vueltas",
    desc: "Tu primer millar de vueltas completadas con telemetría registrada.",
    howTo: "Completa 1.000 vueltas verificadas en Garage 61.",
    category: "leyenda",
    tier: "bronze",
    points: 30,
    icon: "flame",
    eval: (m) => ({ unlocked: m.laps >= 1000, pct: pct(m.laps, 1000), label: `${m.laps.toLocaleString("es-ES")} / 1.000 v` }),
  },
  {
    slug: "vueltas-5000",
    title: "5.000 Vueltas",
    desc: "Constancia de acero: 5.000 vueltas completadas en circuito.",
    howTo: "Acumula 5.000 vueltas verificadas en pista.",
    category: "leyenda",
    tier: "silver",
    points: 70,
    icon: "flame",
    eval: (m) => ({ unlocked: m.laps >= 5000, pct: pct(m.laps, 5000), label: `${m.laps.toLocaleString("es-ES")} / 5.000 v` }),
  },
  {
    slug: "vueltas-10000",
    title: "10.000 Vueltas",
    desc: "Cinco cifras de vueltas registradas en competición y entrenamientos.",
    howTo: "Supera las 10.000 vueltas verificadas en Garage 61.",
    category: "leyenda",
    tier: "gold",
    points: 130,
    icon: "flame",
    eval: (m) => ({ unlocked: m.laps >= 10000, pct: pct(m.laps, 10000), label: `${m.laps.toLocaleString("es-ES")} / 10.000 v` }),
  },
  {
    slug: "vueltas-15000",
    title: "15.000 Vueltas",
    desc: "Más de 60.000 kilómetros virtuales al límite.",
    howTo: "Supera las 15.000 vueltas verificadas.",
    category: "leyenda",
    tier: "platinum",
    points: 190,
    icon: "trophy",
    eval: (m) => ({ unlocked: m.laps >= 15000, pct: pct(m.laps, 15000), label: `${m.laps.toLocaleString("es-ES")} / 15.000 v` }),
  },
  {
    slug: "vueltas-25000",
    title: "25.000 Vueltas",
    desc: "Una vida entera en el simulador: 25.000 vueltas registradas.",
    howTo: "Supera las 25.000 vueltas verificadas.",
    category: "leyenda",
    tier: "mythic",
    points: 350,
    icon: "trophy",
    eval: (m) => ({ unlocked: m.laps >= 25000, pct: pct(m.laps, 25000), label: `${m.laps.toLocaleString("es-ES")} / 25.000 v` }),
  },
  {
    slug: "leyenda-absoluta-mmt",
    title: "Leyenda Absoluta MMT",
    desc: "El máximo honor: 1000h+, 4K+ iRating, Class A y Triple Corona de resistencia.",
    howTo: "Alcanza 1000h en pista, 4000 iRating, Class A y Daytona+Spa+Le Mans.",
    category: "leyenda",
    tier: "mythic",
    points: 1000,
    icon: "crown",
    eval: (m) => {
      const score =
        (m.hours >= 1000 ? 25 : Math.round((m.hours / 1000) * 25)) +
        (m.irating >= 4000 ? 25 : Math.round((m.irating / 4000) * 25)) +
        (/class\s*a|pro/i.test(m.classLabel) ? 25 : 0) +
        ([hasTrack(m, /daytona/i), hasTrack(m, /spa/i), hasTrack(m, /le mans|sarthe/i)].filter(Boolean).length === 3 ? 25 : 0);
      return { unlocked: score >= 100, pct: Math.min(100, score), label: `${Math.min(100, score)}% completado` };
    },
  },
];

export function buildDriverMetrics(
  driver: Piloto,
  irating: number | null,
  sr: number | null,
  classLabel: string | null,
): DriverMetrics {
  const tracks = driver.topTracks || [];
  const cars = driver.topCars || [];
  const hours = driver.totalTrackHours || tracks.reduce((a, t) => a + t.hours, 0);
  const laps = tracks.reduce((a, t) => a + (t.laps || 0), 0);
  const ir = irating ?? 0;
  const srVal = sr ?? 0;
  const ovr = computeAsymptoticRating(ir || 1500, srVal || 3.0, hours);
  const sims = driver.sims || (driver.cust_id ? ["iracing"] : ["staff"]);
  const trackNames = tracks.map((t) => t.name);
  const carNames = [...cars.map((c) => c.name), ...(driver.favouriteCars || [])];
  const gt3Count = cars.filter((c) => /gt3/i.test(c.name) && (c.laps || 0) >= 300).length;

  return {
    driver,
    irating: ir,
    sr: srVal,
    classLabel: classLabel || "",
    hours,
    laps,
    ovr,
    sims,
    trackNames,
    carNames,
    gt3Count,
    uniqueTracks: tracks.length,
    uniqueCars: cars.length,
  };
}

export function getAchievementBySlug(slug: string): AchievementDef | undefined {
  return ALL_ACHIEVEMENTS.find((a) => a.slug === slug);
}

export function computeDriverAchievements(
  driver: Piloto,
  irating: number | null,
  sr: number | null,
  classLabel: string | null,
): {
  all: EvaluatedAchievement[];
  unlocked: EvaluatedAchievement[];
  nextMilestones: EvaluatedAchievement[];
  totalPoints: number;
  totalCount: number;
  completionPct: number;
  rankLabel: string;
} {
  const m = buildDriverMetrics(driver, irating, sr, classLabel);
  const tierWeight: Record<AchievementTier, number> = {
    mythic: 5,
    platinum: 4,
    gold: 3,
    silver: 2,
    bronze: 1,
  };

  const all: EvaluatedAchievement[] = ALL_ACHIEVEMENTS.map((def) => {
    const res = def.eval(m);
    return {
      slug: def.slug,
      title: def.title,
      desc: def.desc,
      howTo: def.howTo,
      category: def.category,
      tier: def.tier,
      tierLabel: TIER_META[def.tier].label,
      points: def.points,
      icon: def.icon,
      unlocked: res.unlocked,
      progressPct: res.pct,
      progressLabel: res.label,
    };
  });

  const unlocked = all
    .filter((a) => a.unlocked)
    .sort((a, b) => tierWeight[b.tier] - tierWeight[a.tier] || b.points - a.points);

  const nextMilestones = all
    .filter((a) => !a.unlocked && a.progressPct > 0)
    .sort((a, b) => b.progressPct - a.progressPct || a.points - b.points)
    .slice(0, 6);

  const totalPoints = unlocked.reduce((acc, a) => acc + a.points, 0);
  const totalCount = ALL_ACHIEVEMENTS.length;
  const completionPct = Math.round((unlocked.length / totalCount) * 100);

  const rankLabel =
    totalPoints >= 4500
      ? "Leyenda Muntrume"
      : totalPoints >= 3000
        ? "Piloto Platino"
        : totalPoints >= 1800
          ? "Piloto Oro"
          : totalPoints >= 900
            ? "Piloto Plata"
            : "Piloto Bronce";

  return { all, unlocked, nextMilestones, totalPoints, totalCount, completionPct, rankLabel };
}
