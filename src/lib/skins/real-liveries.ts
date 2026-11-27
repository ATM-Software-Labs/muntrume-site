/**
 * Real-world & historic motorsport liveries mapped per car/brand/category.
 * Powers the dynamic per-car livery selector and 1-click Auto-Livery cycling in skins.muntru.me.
 */

import type { FinishType, PatternStyle } from "./types";

export interface RealLiveryPreset {
  id: string;
  label: string;
  era: string;
  primary: string;
  secondary: string;
  accent: string;
  detail: string;
  pattern: PatternStyle;
  finish: FinishType;
}

const BRAND_LIVERIES: Array<{ match: RegExp; presets: RealLiveryPreset[] }> = [
  {
    match: /porsche|992|963|718|991/,
    presets: [
      { id: "manthey-grello", label: "Manthey 'Grello' #911", era: "NLS / N24", primary: "#bef264", secondary: "#16a34a", accent: "#090b0f", detail: "#ffffff", pattern: "solid-factory", finish: "gloss" },
      { id: "ao-rexy", label: "AO Racing 'Rexy' #77", era: "IMSA GTD Pro", primary: "#22c55e", secondary: "#14532d", accent: "#f8fafc", detail: "#ef4444", pattern: "stealth-camo", finish: "gloss" },
      { id: "penske-wec", label: "Porsche Penske #6", era: "WEC / IMSA", primary: "#f8fafc", secondary: "#dc2626", accent: "#0f172a", detail: "#facc15", pattern: "solid-factory", finish: "gloss" },
      { id: "rothmans-82", label: "Rothmans Le Mans 1982", era: "Histórica", primary: "#f8fafc", secondary: "#1e3a8a", accent: "#ca8a04", detail: "#dc2626", pattern: "pearl-shift", finish: "gloss" },
      { id: "pink-pig", label: "Pink Pig 'Sau' #92", era: "Le Mans 1971/2018", primary: "#f472b6", secondary: "#db2777", accent: "#be123c", detail: "#ffffff", pattern: "solid-factory", finish: "satin" },
      { id: "martini-911", label: "Martini Racing", era: "Histórica", primary: "#f8fafc", secondary: "#1d4ed8", accent: "#dc2626", detail: "#38bdf8", pattern: "solid-factory", finish: "gloss" },
    ],
  },
  {
    match: /ferrari|296|499p|488/,
    presets: [
      { id: "af-corse-51", label: "AF Corse Le Mans #51", era: "WEC / GTWC", primary: "#b91c1c", secondary: "#7f1d1d", accent: "#facc15", detail: "#ffffff", pattern: "pearl-shift", finish: "gloss" },
      { id: "modena-83", label: "AF Corse Giallo #83", era: "WEC 2024", primary: "#facc15", secondary: "#b91c1c", accent: "#090b0f", detail: "#ffffff", pattern: "solid-factory", finish: "gloss" },
      { id: "risi-62", label: "Risi Competizione #62", era: "IMSA", primary: "#dc2626", secondary: "#0f172a", accent: "#ffffff", detail: "#facc15", pattern: "solid-factory", finish: "gloss" },
      { id: "nart-historic", label: "Scuderia NART", era: "Le Mans 1965", primary: "#b91c1c", secondary: "#1d4ed8", accent: "#ffffff", detail: "#facc15", pattern: "solid-factory", finish: "gloss" },
      { id: "cetilar-47", label: "Cetilar Racing #47", era: "IMSA / WEC", primary: "#1e3a8a", secondary: "#0f172a", accent: "#38bdf8", detail: "#ffffff", pattern: "pearl-shift", finish: "metallic" },
      { id: "fxx-carbon", label: "Corsa Clienti Carbon", era: "Track", primary: "#111827", secondary: "#b91c1c", accent: "#facc15", detail: "#ffffff", pattern: "carbon-exposed", finish: "satin" },
    ],
  },
  {
    match: /bmw|m4|m8|m2|lmdh|hybridv8|z4/,
    presets: [
      { id: "bmw-m-works", label: "BMW M Motorsport Works", era: "IMSA / WEC", primary: "#f8fafc", secondary: "#0f172a", accent: "#2563eb", detail: "#ef4444", pattern: "solid-factory", finish: "gloss" },
      { id: "wrt-46-rossi", label: "Team WRT #46 (Rossi)", era: "GTWC / WEC", primary: "#0f172a", secondary: "#1d4ed8", accent: "#facc15", detail: "#ffffff", pattern: "pearl-shift", finish: "satin" },
      { id: "rowe-998", label: "ROWE Racing #998", era: "Spa 24h / N24", primary: "#facc15", secondary: "#090b0f", accent: "#dc2626", detail: "#ffffff", pattern: "solid-factory", finish: "gloss" },
      { id: "paul-miller-1", label: "Paul Miller Racing #1", era: "IMSA GTD Pro", primary: "#1d4ed8", secondary: "#090b0f", accent: "#38bdf8", detail: "#ffffff", pattern: "pearl-shift", finish: "gloss" },
      { id: "warsteiner-dtm", label: "Warsteiner DTM 1992", era: "Histórica M3", primary: "#f8fafc", secondary: "#1e3a8a", accent: "#ef4444", detail: "#ca8a04", pattern: "solid-factory", finish: "gloss" },
      { id: "jagermeister-bmw", label: "Jägermeister Classic", era: "Histórica", primary: "#ea580c", secondary: "#090b0f", accent: "#ffffff", detail: "#22c55e", pattern: "solid-factory", finish: "gloss" },
    ],
  },
  {
    match: /audi|r8|rs3|r18|90_gto/,
    presets: [
      { id: "audi-sport-wrt", label: "Audi Sport WRT #32", era: "GTWC", primary: "#e2e8f0", secondary: "#0f172a", accent: "#dc2626", detail: "#ffffff", pattern: "solid-factory", finish: "satin" },
      { id: "abt-dtm", label: "ABT Sportsline #7", era: "DTM", primary: "#1e3a8a", secondary: "#dc2626", accent: "#facc15", detail: "#ffffff", pattern: "pearl-shift", finish: "gloss" },
      { id: "quattro-84", label: "Audi Quattro 1984", era: "Histórica", primary: "#f8fafc", secondary: "#475569", accent: "#dc2626", detail: "#ca8a04", pattern: "solid-factory", finish: "gloss" },
      { id: "sainteloc-25", label: "Saintéloc Racing #25", era: "Spa 24h", primary: "#0f172a", secondary: "#dc2626", accent: "#38bdf8", detail: "#ffffff", pattern: "forged-carbon", finish: "satin" },
      { id: "joest-silver", label: "Joest Le Mans Silver", era: "Histórica", primary: "#cbd5e1", secondary: "#0f172a", accent: "#dc2626", detail: "#ffffff", pattern: "brushed-metal", finish: "metallic" },
    ],
  },
  {
    match: /mercedes|amg|w12|w13/,
    presets: [
      { id: "amg-petronas", label: "Mercedes-AMG Petronas", era: "F1 / GT3", primary: "#475569", secondary: "#0f172a", accent: "#00d2be", detail: "#ffffff", pattern: "brushed-metal", finish: "metallic" },
      { id: "mamba-mann", label: "Mann-Filter 'Mamba' #48", era: "DTM / GTWC", primary: "#facc15", secondary: "#16a34a", accent: "#090b0f", detail: "#ffffff", pattern: "hex-stealth", finish: "gloss" },
      { id: "winward-57", label: "Winward Racing #57", era: "IMSA / DTM", primary: "#0f172a", secondary: "#0284c7", accent: "#38bdf8", detail: "#ffffff", pattern: "pearl-shift", finish: "gloss" },
      { id: "sunenergy1-75", label: "SunEnergy1 #75", era: "Bathurst 12h", primary: "#090b0f", secondary: "#1e293b", accent: "#f97316", detail: "#38bdf8", pattern: "carbon-exposed", finish: "chrome" },
      { id: "sauber-c9", label: "Silver Arrow C9 1989", era: "Histórica", primary: "#94a3b8", secondary: "#1e293b", accent: "#ffffff", detail: "#ef4444", pattern: "brushed-metal", finish: "metallic" },
    ],
  },
  {
    match: /mclaren|720s|570s|mp4/,
    presets: [
      { id: "mclaren-papaya", label: "McLaren Papaya Works", era: "F1 / GT3", primary: "#ea580c", secondary: "#0f172a", accent: "#38bdf8", detail: "#ffffff", pattern: "solid-factory", finish: "satin" },
      { id: "gulf-mclaren", label: "Gulf Racing Heritage", era: "Le Mans / Monaco", primary: "#38bdf8", secondary: "#0284c7", accent: "#f97316", detail: "#0f172a", pattern: "solid-factory", finish: "gloss" },
      { id: "marlboro-mp4", label: "Classic Red & White 1988", era: "Histórica", primary: "#f8fafc", secondary: "#dc2626", accent: "#090b0f", detail: "#ffffff", pattern: "solid-factory", finish: "gloss" },
      { id: "garage-59", label: "Garage 59 #159", era: "GTWC", primary: "#0f172a", secondary: "#1e293b", accent: "#f97316", detail: "#ffffff", pattern: "forged-carbon", finish: "satin" },
      { id: "pfaff-plaid", label: "Pfaff Motorsport #9", era: "IMSA GTD Pro", primary: "#dc2626", secondary: "#090b0f", accent: "#ffffff", detail: "#facc15", pattern: "hex-stealth", finish: "gloss" },
    ],
  },
  {
    match: /aston|vantage|valkyrie|dbr9/,
    presets: [
      { id: "amr-works", label: "AMR British Green & Lime", era: "WEC / GTWC", primary: "#065f46", secondary: "#022c22", accent: "#a3e635", detail: "#ffffff", pattern: "pearl-shift", finish: "gloss" },
      { id: "heart-of-racing", label: "Heart of Racing #23", era: "IMSA / WEC", primary: "#0284c7", secondary: "#0f172a", accent: "#a3e635", detail: "#ffffff", pattern: "solid-factory", finish: "gloss" },
      { id: "gulf-dbr9", label: "Gulf DBR9 #009", era: "Le Mans 2008", primary: "#38bdf8", secondary: "#0284c7", accent: "#f97316", detail: "#0f172a", pattern: "solid-factory", finish: "gloss" },
      { id: "comtoyou-007", label: "Comtoyou Racing #007", era: "Spa 24h Winner", primary: "#064e3b", secondary: "#090b0f", accent: "#bef264", detail: "#ffffff", pattern: "pearl-shift", finish: "metallic" },
    ],
  },
  {
    match: /ford|mustang/,
    presets: [
      { id: "multimatic-64", label: "Ford Multimatic #64", era: "IMSA GTD Pro", primary: "#1d4ed8", secondary: "#0f172a", accent: "#38bdf8", detail: "#ffffff", pattern: "pearl-shift", finish: "gloss" },
      { id: "proton-77", label: "Proton Competition #77", era: "WEC / Le Mans", primary: "#090b0f", secondary: "#1e293b", accent: "#facc15", detail: "#ffffff", pattern: "carbon-exposed", finish: "satin" },
      { id: "gulf-gt40", label: "Gulf GT40 Le Mans 1968", era: "Histórica", primary: "#38bdf8", secondary: "#0284c7", accent: "#f97316", detail: "#0f172a", pattern: "solid-factory", finish: "gloss" },
      { id: "motorcraft-heritage", label: "Motorcraft IMSA 1985", era: "Histórica", primary: "#f8fafc", secondary: "#dc2626", accent: "#1d4ed8", detail: "#090b0f", pattern: "solid-factory", finish: "gloss" },
    ],
  },
  {
    match: /corvette|chevy|camaro|silverado|cadillac|vseries/,
    presets: [
      { id: "corvette-pratt-3", label: "Corvette Racing #3", era: "IMSA / WEC", primary: "#facc15", secondary: "#090b0f", accent: "#ef4444", detail: "#ffffff", pattern: "solid-factory", finish: "gloss" },
      { id: "cadillac-whelen-31", label: "Cadillac Whelen #31", era: "IMSA GTP", primary: "#dc2626", secondary: "#090b0f", accent: "#f8fafc", detail: "#facc15", pattern: "pearl-shift", finish: "gloss" },
      { id: "cadillac-01-gold", label: "Cadillac Racing #01", era: "IMSA / Le Mans", primary: "#facc15", secondary: "#1d4ed8", accent: "#090b0f", detail: "#ffffff", pattern: "pearl-shift", finish: "metallic" },
      { id: "goodwrench-3", label: "Intimidator #3 Black", era: "NASCAR Histórica", primary: "#090b0f", secondary: "#1e293b", accent: "#f8fafc", detail: "#dc2626", pattern: "solid-factory", finish: "gloss" },
    ],
  },
  {
    match: /lamborghini|huracan/,
    presets: [
      { id: "iron-lynx-63", label: "Iron Lynx #63", era: "IMSA / WEC", primary: "#16a34a", secondary: "#090b0f", accent: "#facc15", detail: "#ffffff", pattern: "forged-carbon", finish: "satin" },
      { id: "iron-dames-85", label: "Iron Dames #85", era: "WEC / IMSA", primary: "#ec4899", secondary: "#090b0f", accent: "#ffffff", detail: "#f472b6", pattern: "pearl-shift", finish: "gloss" },
      { id: "grasser-19", label: "Grasser Racing Team #19", era: "GTWC / DTM", primary: "#84cc16", secondary: "#090b0f", accent: "#ffffff", detail: "#facc15", pattern: "solid-factory", finish: "gloss" },
      { id: "kpax-6", label: "K-PAX Racing #6", era: "GT World Challenge", primary: "#ea580c", secondary: "#090b0f", accent: "#ffffff", detail: "#facc15", pattern: "stealth-camo", finish: "satin" },
    ],
  },
  {
    match: /acura|arx06|nsx|honda|hpd/,
    presets: [
      { id: "wtr-10", label: "Wayne Taylor Racing #10", era: "IMSA GTP", primary: "#0284c7", secondary: "#090b0f", accent: "#38bdf8", detail: "#ffffff", pattern: "pearl-shift", finish: "gloss" },
      { id: "msr-60", label: "Meyer Shank Racing #60", era: "Daytona 24h", primary: "#ec4899", secondary: "#090b0f", accent: "#ffffff", detail: "#38bdf8", pattern: "solid-factory", finish: "gloss" },
      { id: "hrc-tricolor", label: "Honda Racing HRC", era: "Super GT / TCR", primary: "#f8fafc", secondary: "#dc2626", accent: "#1d4ed8", detail: "#0f172a", pattern: "solid-factory", finish: "gloss" },
      { id: "castrol-mugen", label: "Castrol Mugen NSX", era: "JGTC Histórica", primary: "#f8fafc", secondary: "#16a34a", accent: "#dc2626", detail: "#090b0f", pattern: "solid-factory", finish: "gloss" },
    ],
  },
  {
    match: /formula|f1|f3|f4|f312|indy|ir18|sf23|sfl|dallara|ray|vee|lotus|skip|mazda|tatuus/,
    presets: [
      { id: "lotus-jps", label: "Lotus JPS Black & Gold", era: "F1 Histórica", primary: "#090b0f", secondary: "#1e293b", accent: "#ca8a04", detail: "#facc15", pattern: "solid-factory", finish: "gloss" },
      { id: "mp4-classic", label: "Classic Red & White #12", era: "F1 1988", primary: "#f8fafc", secondary: "#dc2626", accent: "#090b0f", detail: "#ffffff", pattern: "solid-factory", finish: "gloss" },
      { id: "brawn-gp", label: "Brawn GP Fluo #22", era: "F1 2009", primary: "#f8fafc", secondary: "#090b0f", accent: "#bef264", detail: "#090b0f", pattern: "solid-factory", finish: "gloss" },
      { id: "williams-canon", label: "Williams Blue & Yellow", era: "F1 1992", primary: "#1d4ed8", secondary: "#f8fafc", accent: "#facc15", detail: "#dc2626", pattern: "solid-factory", finish: "gloss" },
      { id: "gulf-open", label: "Gulf Heritage Open-Wheel", era: "Histórica", primary: "#38bdf8", secondary: "#0284c7", accent: "#f97316", detail: "#0f172a", pattern: "solid-factory", finish: "gloss" },
      { id: "mmt-formula", label: "Muntrume Works Emerald", era: "MMT", primary: "#0f1722", secondary: "#1a2c3a", accent: "#00e699", detail: "#ffffff", pattern: "pearl-shift", finish: "satin" },
    ],
  },
];

const FALLBACK_LIVERIES: RealLiveryPreset[] = [
  { id: "mmt-works", label: "Muntrume Factory Works", era: "MMT", primary: "#0f1722", secondary: "#1a2c3a", accent: "#00e699", detail: "#f8fafc", pattern: "pearl-shift", finish: "satin" },
  { id: "gulf-classic", label: "Gulf Racing Heritage", era: "Le Mans", primary: "#38bdf8", secondary: "#0284c7", accent: "#f97316", detail: "#0f172a", pattern: "solid-factory", finish: "gloss" },
  { id: "martini-classic", label: "Martini Racing", era: "Histórica", primary: "#f8fafc", secondary: "#1d4ed8", accent: "#dc2626", detail: "#38bdf8", pattern: "solid-factory", finish: "gloss" },
  { id: "jps-gold", label: "Black & Gold Classic", era: "Histórica", primary: "#090b0f", secondary: "#1e293b", accent: "#ca8a04", detail: "#facc15", pattern: "solid-factory", finish: "gloss" },
  { id: "castrol-classic", label: "Castrol Rally / GT", era: "Histórica", primary: "#f8fafc", secondary: "#16a34a", accent: "#dc2626", detail: "#090b0f", pattern: "solid-factory", finish: "gloss" },
  { id: "stealth-carbon", label: "Pre-Season Stealth Carbon", era: "Test", primary: "#090b0f", secondary: "#1e293b", accent: "#00e699", detail: "#e2e8f0", pattern: "forged-carbon", finish: "matte" },
];

export function getRealLiveriesForCar(carSlug: string, brand: string, name: string, category?: string): RealLiveryPreset[] {
  const key = `${carSlug} ${brand} ${name} ${category || ""}`.toLowerCase();
  const hit = BRAND_LIVERIES.find((b) => b.match.test(key));
  return hit ? hit.presets : FALLBACK_LIVERIES;
}
