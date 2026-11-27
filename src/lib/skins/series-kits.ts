/**
 * Championship-specific decal kits, vector number plates, and series badges
 * tailored to each iRacing car class:
 *  - IMSA GTP / WEC Hypercar
 *  - IMSA LMP2 / VP Racing LMP3
 *  - IMSA GTD Pro / GT3 Sprint / GTWC
 *  - Porsche Carrera Cup / PESC
 *  - Ferrari Challenge Trofeo Pirelli
 *  - IMSA Michelin Pilot Challenge (GT4 / GS)
 *  - FIA Formula 4 / Dallara F3 / Super Formula & SFL / Formula Ford & Vee
 *  - TCR World Tour / IMSA TCR
 *  - Global MX-5 Cup / Toyota GR Cup / Production Car Challenge
 */

import type { LibraryDecalItem } from "./decals-library";
import type { DecalLayer, ZoneKey, ZoneRect } from "./types";

export type SeriesProfileId =
  | "gtp_imsa"
  | "lmp2_imsa"
  | "lmp3_imsa"
  | "gt3_imsa"
  | "pcup"
  | "ferrari_challenge"
  | "gt4_imsa"
  | "formula_f4"
  | "formula_f3"
  | "formula_sf"
  | "formula_club"
  | "tcr"
  | "production";

export interface CarSeriesProfile {
  id: SeriesProfileId;
  championshipName: string;
  kitButtonLabel: string;
  platesButtonLabel: string;
  useImsaOfficialLayer: boolean;
  seriesDecals: LibraryDecalItem[];
  plateHeader: string;
  plateFooter: string;
  plateHeaderColor: string;
  plateAccentColor: string;
  frontBadgeText: string;
  frontBadgeColor: string;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function makeBannerBadgeSvg(text: string, sub: string, bg: string, accent: string, textColor = "#ffffff"): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 96">` +
      `<polygon points="14,6 314,6 302,90 4,90" fill="${bg}" stroke="${accent}" stroke-width="5"/>` +
      `<rect x="18" y="14" width="12" height="68" fill="${accent}"/>` +
      `<text x="170" y="48" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-style="italic" font-weight="900" font-size="28" fill="${textColor}" letter-spacing="1.5">${text}</text>` +
      `<text x="170" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="15" fill="${accent}" letter-spacing="2.5">${sub}</text>` +
      `</svg>`,
  );
}

function makeDoorPlateSvg(header: string, footer: string, headerBg: string, accent: string): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 210">` +
      `<rect x="4" y="4" width="272" height="202" rx="10" fill="#ffffff" stroke="#111827" stroke-width="6"/>` +
      `<rect x="4" y="4" width="272" height="46" rx="8" fill="${headerBg}"/>` +
      `<text x="140" y="34" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-weight="900" font-size="20" fill="#ffffff" letter-spacing="1.5">${header}</text>` +
      `<rect x="18" y="160" width="244" height="34" rx="4" fill="#111827"/>` +
      `<text x="140" y="183" text-anchor="middle" font-family="Arial Black,sans-serif" font-weight="900" font-size="16" fill="${accent}" letter-spacing="2.5">${footer}</text>` +
      `</svg>`,
  );
}

function makeCompactBadgeSvg(text: string, bg: string, textColor = "#ffffff"): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 54">` +
      `<polygon points="10,4 236,4 226,50 4,50" fill="${bg}" stroke="#ffffff" stroke-width="4"/>` +
      `<text x="120" y="35" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-style="italic" font-weight="900" font-size="22" fill="${textColor}" letter-spacing="2">${text}</text>` +
      `</svg>`,
  );
}

export function getCarSeriesProfile(carSlug: string, category?: string): CarSeriesProfile {
  const s = (carSlug || "").toLowerCase();
  const c = (category || "").toLowerCase();

  // 1. Porsche Carrera Cup / PESC
  if (/porsche992cup|992.*cup|911.*cup/.test(s)) {
    return {
      id: "pcup",
      championshipName: "Porsche Carrera Cup / PESC",
      kitButtonLabel: "Kit Porsche Cup",
      platesButtonLabel: "Placas Carrera Cup",
      useImsaOfficialLayer: false,
      plateHeader: "CARRERA CUP",
      plateFooter: "PORSCHE · MICHELIN",
      plateHeaderColor: "#111827",
      plateAccentColor: "#ef4444",
      frontBadgeText: "PORSCHE CUP",
      frontBadgeColor: "#dc2626",
      seriesDecals: [
        { id: "ser-pcup-main", label: "Porsche Carrera Cup", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("CARRERA CUP", "PORSCHE MOTORSPORT", "#0f172a", "#dc2626") },
        { id: "ser-pcup-pesc", label: "Porsche TAG Heuer PESC", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("PORSCHE PESC", "ESPORTS SUPERCUP", "#111827", "#f8fafc") },
        { id: "ser-pcup-mobil", label: "Mobil 1 Supercup", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("SUPERCUP", "MOBIL 1 · MICHELIN", "#1e3a8a", "#ef4444") },
      ],
    };
  }

  // 2. Ferrari Challenge
  if (/296challenge|challenge/.test(s)) {
    return {
      id: "ferrari_challenge",
      championshipName: "Ferrari Challenge Trofeo Pirelli",
      kitButtonLabel: "Kit Ferrari Challenge",
      platesButtonLabel: "Placas Trofeo Pirelli",
      useImsaOfficialLayer: false,
      plateHeader: "FERRARI CHALLENGE",
      plateFooter: "TROFEO PIRELLI",
      plateHeaderColor: "#b91c1c",
      plateAccentColor: "#facc15",
      frontBadgeText: "TROFEO PIRELLI",
      frontBadgeColor: "#b91c1c",
      seriesDecals: [
        { id: "ser-fc-main", label: "Ferrari Challenge", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("CHALLENGE", "TROFEO PIRELLI", "#b91c1c", "#facc15") },
        { id: "ser-fc-coppa", label: "Coppa Shell", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("COPPA SHELL", "FERRARI CORSE CLIENTI", "#0f172a", "#facc15") },
      ],
    };
  }

  // 3. GTP / Hypercar (IMSA WeatherTech GTP + WEC Hypercar)
  if (/963|499p|bmwlmdh|cadillac.*gtp|vseries|arx06|valkyrie/.test(s) || c.includes("gtp") || c.includes("hypercar")) {
    return {
      id: "gtp_imsa",
      championshipName: "IMSA WeatherTech GTP / WEC Hypercar",
      kitButtonLabel: "Etiquetas IMSA GTP",
      platesButtonLabel: "Placas GTP / Dorsales",
      useImsaOfficialLayer: true,
      plateHeader: "WeatherTech",
      plateFooter: "IMSA · GTP",
      plateHeaderColor: "#111827",
      plateAccentColor: "#ef4444",
      frontBadgeText: "IMSA GTP",
      frontBadgeColor: "#111827",
      seriesDecals: [
        { id: "ser-gtp-imsa", label: "IMSA WeatherTech GTP", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("IMSA GTP", "WEATHERTECH ENDURANCE", "#111827", "#dc2626") },
        { id: "ser-gtp-wec", label: "FIA WEC Hypercar", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("HYPERCAR", "FIA WEC · LE MANS", "#0f172a", "#ef4444") },
        { id: "ser-gtp-mich", label: "Michelin Endurance Cup", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("MICHELIN", "ENDURANCE CUP", "#1e3a8a", "#facc15") },
      ],
    };
  }

  // 4. LMP2 / LMP3
  if (/p217|lmp2/.test(s)) {
    return {
      id: "lmp2_imsa",
      championshipName: "IMSA LMP2 / Le Mans Series",
      kitButtonLabel: "Etiquetas IMSA LMP2",
      platesButtonLabel: "Placas LMP2 / Dorsales",
      useImsaOfficialLayer: true,
      plateHeader: "WeatherTech",
      plateFooter: "IMSA · LMP2",
      plateHeaderColor: "#1d4ed8",
      plateAccentColor: "#38bdf8",
      frontBadgeText: "LMP2",
      frontBadgeColor: "#1d4ed8",
      seriesDecals: [
        { id: "ser-lmp2-imsa", label: "IMSA LMP2", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("IMSA LMP2", "WEATHERTECH SERIES", "#1e3a8a", "#38bdf8") },
        { id: "ser-lmp2-elms", label: "European Le Mans LMP2", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("ELMS LMP2", "24H LE MANS SERIES", "#0f172a", "#38bdf8") },
      ],
    };
  }
  if (/jsp320|lmp3/.test(s)) {
    return {
      id: "lmp3_imsa",
      championshipName: "IMSA VP Racing LMP3 / Falken",
      kitButtonLabel: "Etiquetas IMSA LMP3",
      platesButtonLabel: "Placas LMP3 / Dorsales",
      useImsaOfficialLayer: true,
      plateHeader: "VP RACING",
      plateFooter: "IMSA · LMP3",
      plateHeaderColor: "#7e22ce",
      plateAccentColor: "#f97316",
      frontBadgeText: "LMP3",
      frontBadgeColor: "#7e22ce",
      seriesDecals: [
        { id: "ser-lmp3-vp", label: "IMSA VP Racing LMP3", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("IMSA LMP3", "VP RACING SPORTSCAR", "#581c87", "#f97316") },
        { id: "ser-lmp3-falken", label: "Falken Tyre Sports Car", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("FALKEN LMP3", "SPORTSCAR CHALLENGE", "#0c4a6e", "#38bdf8") },
      ],
    };
  }

  // 5. GT4 (IMSA Michelin Pilot Challenge GS)
  if (/gt4/.test(s)) {
    return {
      id: "gt4_imsa",
      championshipName: "IMSA Michelin Pilot Challenge (GT4)",
      kitButtonLabel: "Kit GT4 Pilot Challenge",
      platesButtonLabel: "Placas GT4 / GS",
      useImsaOfficialLayer: true,
      plateHeader: "MICHELIN PILOT",
      plateFooter: "IMSA · GT4 GS",
      plateHeaderColor: "#1e3a8a",
      plateAccentColor: "#facc15",
      frontBadgeText: "GT4 · GS",
      frontBadgeColor: "#1e3a8a",
      seriesDecals: [
        { id: "ser-gt4-mpc", label: "IMSA Michelin Pilot GT4", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("PILOT GT4", "IMSA GS CHALLENGE", "#1e3a8a", "#facc15") },
        { id: "ser-gt4-falken", label: "Falken Tyre GT4", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("GT4 CHALLENGE", "FALKEN TYRE SERIES", "#0f172a", "#00e699") },
        { id: "ser-gt4-euro", label: "GT4 European Series", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("GT4 EURO", "SRO MOTORSPORTS", "#111827", "#ef4444") },
      ],
    };
  }

  // 6. Formula cars (F4 / F3 / Super Formula / FF1600 & Vee)
  if (/formulair04|ir04/.test(s)) {
    return {
      id: "formula_f4",
      championshipName: "FIA Formula 4 Championship",
      kitButtonLabel: "Kit FIA F4",
      platesButtonLabel: "Placas FIA F4",
      useImsaOfficialLayer: false,
      plateHeader: "FIA FORMULA 4",
      plateFooter: "IRACING · F4",
      plateHeaderColor: "#1e3a8a",
      plateAccentColor: "#ef4444",
      frontBadgeText: "FIA F4",
      frontBadgeColor: "#1e3a8a",
      seriesDecals: [
        { id: "ser-f4-fia", label: "FIA Formula 4", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("FIA F4", "FORMULA 4 CERTIFIED", "#1e3a8a", "#ef4444") },
        { id: "ser-f4-pirelli", label: "F4 Regional Challenge", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("F4 REGIONAL", "SINGLE SEATER CUP", "#0f172a", "#facc15") },
      ],
    };
  }
  if (/dallaraf3|f312/.test(s)) {
    return {
      id: "formula_f3",
      championshipName: "Dallara F3 Championship",
      kitButtonLabel: "Kit Dallara F3",
      platesButtonLabel: "Placas F3 / Dorsales",
      useImsaOfficialLayer: false,
      plateHeader: "DALLARA F3",
      plateFooter: "FORMULA 3 SERIES",
      plateHeaderColor: "#dc2626",
      plateAccentColor: "#f8fafc",
      frontBadgeText: "FORMULA 3",
      frontBadgeColor: "#dc2626",
      seriesDecals: [
        { id: "ser-f3-main", label: "Dallara F3 Championship", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("DALLARA F3", "FORMULA 3 CHAMPIONSHIP", "#b91c1c", "#f8fafc") },
        { id: "ser-f3-euro", label: "Euro Formula 3", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("EURO F3", "OPEN WHEEL SERIES", "#0f172a", "#38bdf8") },
      ],
    };
  }
  if (/superformula|sf23|lights324/.test(s)) {
    const isLights = /lights324|sfl/.test(s);
    return {
      id: "formula_sf",
      championshipName: isLights ? "Super Formula Lights 324" : "Super Formula SF23",
      kitButtonLabel: isLights ? "Kit Super Formula Lights" : "Kit Super Formula",
      platesButtonLabel: isLights ? "Placas SFL 324" : "Placas SF23",
      useImsaOfficialLayer: false,
      plateHeader: isLights ? "SF LIGHTS" : "SUPER FORMULA",
      plateFooter: isLights ? "DALLARA 324" : "SF23 · YOKOHAMA",
      plateHeaderColor: "#dc2626",
      plateAccentColor: "#f8fafc",
      frontBadgeText: isLights ? "SFL 324" : "SF23",
      frontBadgeColor: "#dc2626",
      seriesDecals: [
        { id: "ser-sf-main", label: isLights ? "Super Formula Lights" : "Super Formula SF23", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg(isLights ? "SF LIGHTS" : "SUPER FORMULA", isLights ? "DALLARA 324" : "JAPAN CHAMPIONSHIP", "#b91c1c", "#ffffff") },
        { id: "ser-sf-yoko", label: "Yokohama Advan Formula", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("ADVAN SF", "YOKOHAMA RACING", "#0f172a", "#ef4444") },
      ],
    };
  }
  if (/raygr|formulavee|formula|indy|ir18|lotus/.test(s) || c.includes("fórmula") || c.includes("formula")) {
    const isVee = /vee/.test(s);
    const label = isVee ? "FORMULA VEE" : "FF1600";
    return {
      id: "formula_club",
      championshipName: isVee ? "Formula Vee Club Series" : "Ray FF1600 Trophy",
      kitButtonLabel: isVee ? "Kit Formula Vee" : "Kit FF1600 Trophy",
      platesButtonLabel: "Placas Fórmula Club",
      useImsaOfficialLayer: false,
      plateHeader: label,
      plateFooter: "CLUB OPEN-WHEEL",
      plateHeaderColor: "#065f46",
      plateAccentColor: "#bef264",
      frontBadgeText: label,
      frontBadgeColor: "#065f46",
      seriesDecals: [
        { id: "ser-fclub-main", label: isVee ? "Formula Vee Series" : "FF1600 Trophy", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg(label, "IRACING CLUB FORMULA", "#064e3b", "#bef264") },
        { id: "ser-fclub-rookie", label: "Open-Wheel Heritage", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("CLUB FORMULA", "CLASSIC RACING", "#0f172a", "#facc15") },
      ],
    };
  }

  // 7. TCR Touring Cars
  if (/elantra|rs3lms|civictyper|tcr|veloster/.test(s)) {
    return {
      id: "tcr",
      championshipName: "IMSA Pilot Challenge TCR / TCR World Tour",
      kitButtonLabel: "Kit TCR Touring",
      platesButtonLabel: "Placas TCR / Dorsales",
      useImsaOfficialLayer: false,
      plateHeader: "TCR SERIES",
      plateFooter: "IMSA · TOURING CAR",
      plateHeaderColor: "#ea580c",
      plateAccentColor: "#f8fafc",
      frontBadgeText: "TCR",
      frontBadgeColor: "#ea580c",
      seriesDecals: [
        { id: "ser-tcr-imsa", label: "IMSA Pilot Challenge TCR", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("IMSA TCR", "MICHELIN PILOT CHALLENGE", "#ea580c", "#ffffff") },
        { id: "ser-tcr-wt", label: "TCR World Tour", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("TCR WORLD", "TOURING CAR SERIES", "#0f172a", "#f97316") },
      ],
    };
  }

  // 8. Production Cup (MX-5, GR86, BMW M2)
  if (/mx5|gr86|bmwm2/.test(s) || c.includes("producción") || c.includes("tcr")) {
    const isMx5 = /mx5/.test(s);
    const isGr86 = /gr86/.test(s);
    const title = isMx5 ? "MX-5 CUP" : isGr86 ? "GR86 CUP" : "M2 CS CUP";
    return {
      id: "production",
      championshipName: isMx5 ? "Global Mazda MX-5 Cup" : isGr86 ? "Toyota GR86 Cup / PCC" : "BMW M2 Cup / PCC",
      kitButtonLabel: `Kit ${title}`,
      platesButtonLabel: "Placas Production Cup",
      useImsaOfficialLayer: false,
      plateHeader: title,
      plateFooter: "PRODUCTION CHALLENGE",
      plateHeaderColor: "#dc2626",
      plateAccentColor: "#f8fafc",
      frontBadgeText: title,
      frontBadgeColor: "#dc2626",
      seriesDecals: [
        { id: "ser-prod-main", label: title, group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg(title, "GLOBAL SPEC SERIES", "#b91c1c", "#ffffff") },
        { id: "ser-prod-pcc", label: "Production Car Challenge", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("PCC SERIES", "PRODUCTION CHALLENGE", "#0f172a", "#00e699") },
      ],
    };
  }

  // 9. Default: GT3 (IMSA GTD Pro + GTWC / GT3 Sprint)
  return {
    id: "gt3_imsa",
    championshipName: "IMSA GTD Pro / GT3 Sprint & GTWC",
    kitButtonLabel: "Etiquetas IMSA / GT3",
    platesButtonLabel: "Placas GT3 / Dorsales",
    useImsaOfficialLayer: true,
    plateHeader: "WeatherTech",
    plateFooter: "IMSA · GTD PRO",
    plateHeaderColor: "#dc2626",
    plateAccentColor: "#00e699",
    frontBadgeText: "GTD PRO",
    frontBadgeColor: "#dc2626",
    seriesDecals: [
      { id: "ser-gt3-imsa", label: "IMSA GTD Pro", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("IMSA GTD PRO", "WEATHERTECH SERIES", "#b91c1c", "#ffffff") },
      { id: "ser-gt3-gtwc", label: "GT World Challenge", group: "series", defaultScale: 0.14, src: makeBannerBadgeSvg("GT3 SPRINT", "GT WORLD CHALLENGE", "#0f172a", "#ef4444") },
      { id: "ser-gt3-enduro", label: "GT Endurance 24H", group: "series", defaultScale: 0.13, src: makeBannerBadgeSvg("GT3 24H", "ENDURANCE SERIES", "#1e3a8a", "#00e699") },
    ],
  };
}

export function buildChampionshipKitLayers(
  profile: CarSeriesProfile,
  carName: string,
  zones: Record<ZoneKey, ZoneRect>,
  layerId: string,
): DecalLayer[] {
  const sideL = zones.leftSide || { x: 0.25, y: 0.72, w: 0.5, h: 0.16 };
  const sideR = zones.rightSide || { x: 0.25, y: 0.24, w: 0.5, h: 0.16 };
  const frontB = zones.frontBumper || { x: 0.04, y: 0.03, w: 0.44, h: 0.16 };

  const plateUrl = makeDoorPlateSvg(
    profile.plateHeader,
    profile.plateFooter,
    profile.plateHeaderColor,
    profile.plateAccentColor,
  );
  const badgeUrl = makeCompactBadgeSvg(profile.frontBadgeText, profile.frontBadgeColor);

  return [
    {
      id: layerId,
      name: `Placa ${profile.plateHeader} Lateral Izq. (${carName})`,
      kind: "custom",
      dataUrl: plateUrl,
      color: "#ffffff",
      x: sideL.x + sideL.w * 0.48,
      y: sideL.y + sideL.h * 0.52,
      scale: 0.082,
      rotation: 0,
      opacity: 1,
      mirrorX: false,
      zoneHint: "leftSide",
    },
    {
      id: `${layerId}-right`,
      name: `Placa ${profile.plateHeader} Lateral Der. (${carName})`,
      kind: "custom",
      dataUrl: plateUrl,
      color: "#ffffff",
      x: sideR.x + sideR.w * 0.48,
      y: sideR.y + sideR.h * 0.48,
      scale: 0.082,
      rotation: 180,
      opacity: 1,
      mirrorX: false,
      zoneHint: "rightSide",
    },
    {
      id: `${layerId}-bumper`,
      name: `Insignia ${profile.frontBadgeText} Frontal (${carName})`,
      kind: "custom",
      dataUrl: badgeUrl,
      color: "#ffffff",
      x: frontB.x + frontB.w * 0.5,
      y: frontB.y + frontB.h * 0.52,
      scale: 0.062,
      rotation: 0,
      opacity: 1,
      mirrorX: false,
      zoneHint: "frontBumper",
    },
  ];
}
