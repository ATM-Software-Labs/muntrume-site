/**
 * Muntrume Motorsport — Verified Official Knowledge Base (Single Source of Truth)
 * Used by Muntrume AI (/ai/) for 0-latency, 0-hallucination team & simracing responses.
 */

export interface KbPilot {
  dorsal: string;
  name: string;
  slug: string;
  role: string;
  categories: string[];
  email: string;
  profileUrl: string;
}

export interface KbTool {
  id: string;
  name: string;
  license: string;
  url: string;
  highlights: string[];
}

export const MUNTRUME_KB = {
  team: {
    name: "Muntrume Motorsport",
    shortName: "MMT",
    hq: "Sant Andreu, Barcelona (España)",
    simulator: "iRacing",
    license: "MIT (100 % Open Source)",
    githubUrl: "https://github.com/ATM-Software-Labs/muntrume-site",
    releasesUrl: "https://github.com/ATM-Software-Labs/muntrume-site/releases/latest",
    discordUrl: "https://discord.gg/ehX6B8JUtE",
    garage61Url: "https://garage61.net/app/teams/muntrume-motorsport",
    contacts: {
      admin: "admin@muntru.me",
      legal: "legal@muntru.me",
      alberto: "alberto@muntru.me",
      mateo: "mateo@muntru.me",
    },
  },
  pilots: [
    {
      dorsal: "#16",
      name: "Alberto Trujillo",
      slug: "albertot",
      role: "Fundador, Team Principal & Piloto",
      categories: ["GT3", "Endurance", "Multiclass"],
      email: "alberto@muntru.me",
      profileUrl: "/d/albertot/",
    },
    {
      dorsal: "#1",
      name: "Mateo Berbis",
      slug: "mateob",
      role: "Piloto Oficial",
      categories: ["GT3", "Porsche Cup"],
      email: "mateo@muntru.me",
      profileUrl: "/d/mateob/",
    },
    {
      dorsal: "#22",
      name: "Eduardo Chongkan",
      slug: "eduardoc",
      role: "Piloto Oficial · Endurance & Setup Engineering",
      categories: ["GT3", "GT4", "Endurance"],
      email: "admin@muntru.me",
      profileUrl: "/d/eduardoc/",
    },
  ] satisfies KbPilot[],
  tools: [
    {
      id: "overlay",
      name: "MMT Sync & Overlays",
      license: "MIT (Open Source)",
      url: "/overlay/",
      highlights: [
        "< 80 MB RAM y renderizado fluido a 60 FPS sin suscripciones",
        "Standings Multiclase, Relative, Track Map Catmull-Rom, Fuel Calc, Radar 360°",
        "Pit & Strategy Window (Pit Window, Est. Box, Rejoin Pos, BOX THIS LAP / FUEL SAVE)",
        "Tire & Track Temp Monitor (FL/FR/RL/RR en °C y kPa/PSI + Track Temp, viento y humedad)",
        "Presets 1-clic (Sprint GT3, Endurance, Minimalist Qualy) y bloqueo Lock HUD",
      ],
    },
    {
      id: "garage",
      name: "Setup Vault (.sto)",
      license: "Acceso equipo / público",
      url: "/garage/",
      highlights: [
        "Más de 42.654 setups .sto verificados organizados por categoría y circuito",
        "Variantes Safe, Endurance, Sprint, LDF, MDF y HDF",
        "Sincronización automática en Documents\\iRacing\\setups\\MMT vía MMT Sync",
      ],
    },
    {
      id: "wallpapers",
      name: "Wallpapers Oficiales en Pista",
      license: "Gratuito (.JPG HD)",
      url: "/wallpapers/",
      highlights: [
        "Capturas reales en pista 16:9 (Escritorio) y 9:16 4K (2160×3840 Móvil)",
        "URL directa compartible por captura (#mmt-...)",
        "Script Sincronizar_Monitores_20s.bat sin permisos de admin (HKCU) para 0 ms de desfase",
      ],
    },
    {
      id: "gallery",
      name: "Galería Paddock",
      license: "Muntrume Motorsport",
      url: "/gallery/",
      highlights: [
        "Capturas oficiales en pista curadas por categoría y circuito",
      ],
    },
  ] satisfies KbTool[],
  seriesAndCars: [
    {
      series: "IMSA iRacing Series",
      cars: ["Porsche 963 GTP", "Cadillac V-Series.R", "BMW M Hybrid V8", "Ferrari 499P", "Dallara P217 LMP2", "Ford Mustang GT3", "Porsche 911 GT3 R (992)", "Ferrari 296 GT3"],
    },
    {
      series: "GT Sprint / GT Endurance",
      cars: ["Ford Mustang GT3", "Porsche 911 GT3 R (992)", "McLaren 720S GT3 EVO", "Ferrari 296 GT3", "Audi R8 LMS Evo II", "BMW M4 GT3", "Mercedes-AMG GT3"],
    },
    {
      series: "Nürburgring Endurance Championship (NEC)",
      cars: ["GT3 activos", "Porsche 911 GT3 Cup (992)", "GT4", "TCR"],
    },
    {
      series: "Porsche Cup (PCup)",
      cars: ["Porsche 911 GT3 Cup (992)"],
    },
  ],
};
