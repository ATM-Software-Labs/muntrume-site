import type { IracingAnalysis, LiveSample, Settings, Snapshot } from "./types";
import rawSchedule from "./season_schedule_2026_s4.json";

interface ScheduleWeek {
  week_num: number;
  start_date: string;
  track_name: string;
  config: string;
  weather: string;
  duration: string;
  sim_time: string;
}

interface ScheduleSeries {
  id: string;
  name: string;
  category: string;
  tier: string;
  license: string;
  cars: string[];
  weeks: ScheduleWeek[];
}

interface SchedulePayload {
  season: string;
  pdf_source: string;
  total_series: number;
  current_week: number;
  series: ScheduleSeries[];
}

const schedule = rawSchedule as unknown as SchedulePayload;

let activeWeek = schedule.current_week || 9;
let activeCat = "all";
let activeSearch = "";
let weekListenersAttached = false;
let studioInitialized = false;
let strategyInitialized = false;
let overlayInitialized = false;

// -------------------------------------------------------------
// TELEMETRY STUDIO DATA & TYPES (TrackTitan / VRS / GnG caliber)
// -------------------------------------------------------------
export interface TurnInsight {
  turn: number;
  name: string;
  distance: number; // in meters along the track
  sector: 1 | 2 | 3;
  alienApexKmh: number;
  userApexKmh: number;
  alienBrakingDistM: number;
  userBrakingDistM: number;
  deltaSec: number;
  coachTip: string;
  severity: "critical" | "moderate" | "optimal";
}

export interface TrackTelemetryProfile {
  id: string;
  name: string;
  lengthM: number;
  alienLapSec: number;
  userLapSec: number;
  alienLapFormatted: string;
  userLapFormatted: string;
  deltaFormatted: string;
  mapPoints: [number, number][]; // normalized [x, y] in range 0..100
  turns: TurnInsight[];
}

const TRACK_PROFILES: Record<string, TrackTelemetryProfile> = {
  spa: {
    id: "spa",
    name: "Circuit de Spa-Francorchamps (GP)",
    lengthM: 7004,
    alienLapSec: 135.184,
    userLapSec: 136.42,
    alienLapFormatted: "2:15.184",
    userLapFormatted: "2:16.420",
    deltaFormatted: "+1.236s",
    mapPoints: [
      [78, 86], [82, 82], [84, 76], [80, 70], [74, 68], [68, 62], [62, 52], [58, 44],
      [54, 38], [51, 30], [54, 24], [58, 18], [63, 14], [70, 12], [76, 12], [82, 16],
      [86, 22], [88, 28], [88, 36], [85, 42], [80, 46], [74, 49], [67, 52], [60, 56],
      [54, 60], [46, 65], [40, 70], [33, 76], [28, 80], [22, 82], [16, 78], [14, 70],
      [16, 62], [22, 54], [28, 48], [34, 42], [38, 35], [40, 27], [38, 20], [33, 15],
      [27, 13], [20, 14], [14, 18], [11, 24], [11, 32], [14, 40], [18, 50], [22, 60],
      [27, 70], [35, 78], [45, 84], [55, 87], [65, 88], [74, 87]
    ],
    turns: [
      {
        turn: 1,
        name: "T1 · La Source",
        distance: 120,
        sector: 1,
        alienApexKmh: 74,
        userApexKmh: 68,
        alienBrakingDistM: 98,
        userBrakingDistM: 114,
        deltaSec: 0.18,
        coachTip: "Frenas 16m antes de lo óptimo y pierdes velocidad de vértice. Aplica frenada regresiva manteniendo un 12% de trail hasta el piano interior para facilitar la rotación.",
        severity: "critical",
      },
      {
        turn: 2,
        name: "T2-T4 · Eau Rouge & Raidillon",
        distance: 1150,
        sector: 1,
        alienApexKmh: 251,
        userApexKmh: 242,
        alienBrakingDistM: 0,
        userBrakingDistM: 0,
        deltaSec: 0.12,
        coachTip: "Levantas un 8% del acelerador al pasar por la cresta. Con este setup MMT el coche tiene carga suficiente para hacerlo a fondo con volante suave sin snap.",
        severity: "moderate",
      },
      {
        turn: 5,
        name: "T5-T6 · Les Combes",
        distance: 2080,
        sector: 1,
        alienApexKmh: 139,
        userApexKmh: 132,
        alienBrakingDistM: 128,
        userBrakingDistM: 142,
        deltaSec: 0.22,
        coachTip: "Retrasa el punto de frenada hacia la marca de los 100m. Ataca el piano derecho de entrada para posicionar el coche hacia la izquierda sin perder tracción.",
        severity: "critical",
      },
      {
        turn: 7,
        name: "T7 · Malmedy",
        distance: 2340,
        sector: 2,
        alienApexKmh: 163,
        userApexKmh: 158,
        alienBrakingDistM: 30,
        userBrakingDistM: 40,
        deltaSec: 0.06,
        coachTip: "Buen vértice. Puedes abrir gas un 10% antes dejando que el coche corra naturalmente hacia el piano exterior.",
        severity: "optimal",
      },
      {
        turn: 8,
        name: "T8 · Bruxelles / Rivage",
        distance: 2800,
        sector: 2,
        alienApexKmh: 101,
        userApexKmh: 94,
        alienBrakingDistM: 65,
        userBrakingDistM: 78,
        deltaSec: 0.16,
        coachTip: "La caída de la curva permite entrar con más inercia. Mantén el radio interior con gas de mantenimiento antes de acelerar con decisión al salir.",
        severity: "moderate",
      },
      {
        turn: 9,
        name: "T9 · Speaker's Corner",
        distance: 3200,
        sector: 2,
        alienApexKmh: 157,
        userApexKmh: 152,
        alienBrakingDistM: 25,
        userBrakingDistM: 35,
        deltaSec: 0.07,
        coachTip: "Excelente trayectoria. Cuida el piano de salida para no tocar la hierba sintética húmeda.",
        severity: "optimal",
      },
      {
        turn: 10,
        name: "T10-T11 · Double Pouhon",
        distance: 3850,
        sector: 2,
        alienApexKmh: 198,
        userApexKmh: 188,
        alienBrakingDistM: 45,
        userBrakingDistM: 65,
        deltaSec: 0.19,
        coachTip: "Frenas en exceso antes de la primera cuerda de Pouhon. Solo necesitas una caricia del 20% al pedal de freno para cargar peso adelante y luego gas a medio recorrido.",
        severity: "critical",
      },
      {
        turn: 12,
        name: "T12-T13 · Fagnes (Pif-Paf)",
        distance: 4420,
        sector: 2,
        alienApexKmh: 134,
        userApexKmh: 128,
        alienBrakingDistM: 85,
        userBrakingDistM: 95,
        deltaSec: 0.09,
        coachTip: "Transición rápida entre pianos. Sacrifica un poco la entrada a derechas para priorizar la salida a izquierdas a fondo.",
        severity: "optimal",
      },
      {
        turn: 14,
        name: "T14-T15 · Campus & Stavelot",
        distance: 5100,
        sector: 3,
        alienApexKmh: 168,
        userApexKmh: 162,
        alienBrakingDistM: 40,
        userBrakingDistM: 52,
        deltaSec: 0.08,
        coachTip: "La salida de Stavelot condiciona toda la recta hacia Blanchimont. Sal con el acelerador al 100% pegado al piano exterior.",
        severity: "optimal",
      },
      {
        turn: 16,
        name: "T16-T17 · Blanchimont",
        distance: 6150,
        sector: 3,
        alienApexKmh: 266,
        userApexKmh: 262,
        alienBrakingDistM: 0,
        userBrakingDistM: 0,
        deltaSec: 0.02,
        coachTip: "Totalmente a fondo con confianza. Giro limpio y sin correcciones de volante.",
        severity: "optimal",
      },
      {
        turn: 18,
        name: "T18-T19 · Bus Stop Chicane",
        distance: 6820,
        sector: 3,
        alienApexKmh: 66,
        userApexKmh: 60,
        alienBrakingDistM: 108,
        userBrakingDistM: 125,
        deltaSec: 0.21,
        coachTip: "Punto crítico de vuelta. Frena recto y fuerte en los 110m, suelta rápido al meter dirección y súbete agresivamente a los pianos llanos.",
        severity: "critical",
      },
    ],
  },
  monza: {
    id: "monza",
    name: "Autodromo Nazionale Monza",
    lengthM: 5793,
    alienLapSec: 104.52,
    userLapSec: 105.78,
    alienLapFormatted: "1:44.520",
    userLapFormatted: "1:45.780",
    deltaFormatted: "+1.260s",
    mapPoints: [
      [82, 85], [84, 70], [84, 50], [84, 30], [82, 18], [75, 14], [68, 16], [62, 22],
      [58, 30], [54, 42], [50, 56], [45, 68], [40, 75], [32, 78], [24, 74], [18, 65],
      [16, 52], [18, 40], [22, 28], [28, 20], [36, 16], [48, 15], [60, 16], [72, 17]
    ],
    turns: [
      {
        turn: 1,
        name: "T1-T2 · Variante del Rettifilo",
        distance: 950,
        sector: 1,
        alienApexKmh: 72,
        userApexKmh: 64,
        alienBrakingDistM: 145,
        userBrakingDistM: 168,
        deltaSec: 0.32,
        coachTip: "Frenas 23m antes desde 275 km/h. Pisa a fondo con 90% de presión inicial y suelta en línea recta para no activar ABS.",
        severity: "critical",
      },
      {
        turn: 3,
        name: "T3 · Curva Grande",
        distance: 1500,
        sector: 1,
        alienApexKmh: 258,
        userApexKmh: 252,
        alienBrakingDistM: 0,
        userBrakingDistM: 0,
        deltaSec: 0.05,
        coachTip: "A fondo constante pegado a la línea blanca interior.",
        severity: "optimal",
      },
      {
        turn: 4,
        name: "T4-T5 · Variante della Roggia",
        distance: 2250,
        sector: 2,
        alienApexKmh: 114,
        userApexKmh: 106,
        alienBrakingDistM: 115,
        userBrakingDistM: 132,
        deltaSec: 0.24,
        coachTip: "Sube con seguridad al primer piano izquierdo para recortar metros de curva.",
        severity: "critical",
      },
      {
        turn: 6,
        name: "T6 · Lesmo 1",
        distance: 2780,
        sector: 2,
        alienApexKmh: 161,
        userApexKmh: 154,
        alienBrakingDistM: 45,
        userBrakingDistM: 58,
        deltaSec: 0.14,
        coachTip: "Frenada corta y directa en 4ª marcha. Mantén el pie izquierdo en el freno para anclar el morro.",
        severity: "moderate",
      },
      {
        turn: 7,
        name: "T7 · Lesmo 2",
        distance: 3180,
        sector: 2,
        alienApexKmh: 152,
        userApexKmh: 144,
        alienBrakingDistM: 40,
        userBrakingDistM: 54,
        deltaSec: 0.18,
        coachTip: "Prioriza la salida a la recta del Serraglio acelerando a fondo nada más tocar el vértice.",
        severity: "critical",
      },
      {
        turn: 8,
        name: "T8-T10 · Variante Ascari",
        distance: 4420,
        sector: 3,
        alienApexKmh: 170,
        userApexKmh: 162,
        alienBrakingDistM: 102,
        userBrakingDistM: 118,
        deltaSec: 0.21,
        coachTip: "Entrada fluida y aceleración sin contemplaciones en el cambio de apoyo de la salida.",
        severity: "critical",
      },
      {
        turn: 11,
        name: "T11 · Curva Parabolica (Alboreto)",
        distance: 5380,
        sector: 3,
        alienApexKmh: 179,
        userApexKmh: 172,
        alienBrakingDistM: 60,
        userBrakingDistM: 75,
        deltaSec: 0.12,
        coachTip: "Abre el radio a mitad de curva y deja correr la velocidad para cruzar meta a máxima velocidad punta.",
        severity: "moderate",
      },
    ],
  },
  nurburgring: {
    id: "nurburgring",
    name: "Nürburgring Grand-Prix",
    lengthM: 5148,
    alienLapSec: 114.35,
    userLapSec: 115.42,
    alienLapFormatted: "1:54.350",
    userLapFormatted: "1:55.420",
    deltaFormatted: "+1.070s",
    mapPoints: [
      [20, 85], [35, 82], [50, 78], [65, 72], [78, 62], [82, 48], [78, 35], [68, 25],
      [55, 20], [42, 22], [35, 30], [30, 42], [32, 55], [40, 64], [52, 68], [64, 65],
      [72, 55], [75, 42], [70, 32], [58, 30], [45, 38], [32, 50], [22, 65], [18, 78]
    ],
    turns: [
      {
        turn: 1,
        name: "T1-T4 · Castrol-S / Mercedes Arena",
        distance: 400,
        sector: 1,
        alienApexKmh: 72,
        userApexKmh: 65,
        alienBrakingDistM: 95,
        userBrakingDistM: 112,
        deltaSec: 0.25,
        coachTip: "Cierra la trayectoria en la horquilla cerrada para abrir el radio de salida a la contrarrecta.",
        severity: "critical",
      },
      {
        turn: 5,
        name: "T5 · Ford-Kurve",
        distance: 1300,
        sector: 1,
        alienApexKmh: 102,
        userApexKmh: 96,
        alienBrakingDistM: 55,
        userBrakingDistM: 68,
        deltaSec: 0.14,
        coachTip: "Súbete al piano interior en apoyo sin ahogar el motor.",
        severity: "moderate",
      },
      {
        turn: 6,
        name: "T6 · Dunlop-Kehre",
        distance: 1700,
        sector: 2,
        alienApexKmh: 85,
        userApexKmh: 78,
        alienBrakingDistM: 80,
        userBrakingDistM: 94,
        deltaSec: 0.18,
        coachTip: "Curva en bajada con peralte pronunciado. Aprovecha la compresión para frenar más tarde.",
        severity: "critical",
      },
      {
        turn: 7,
        name: "T7-T8 · Schumacher-S",
        distance: 2500,
        sector: 2,
        alienApexKmh: 210,
        userApexKmh: 202,
        alienBrakingDistM: 0,
        userBrakingDistM: 15,
        deltaSec: 0.11,
        coachTip: "Cambio de rasante rápido. No toques el freno, un levante mínimo de acelerador es suficiente.",
        severity: "moderate",
      },
      {
        turn: 13,
        name: "T13-T14 · Veedol-Schikane",
        distance: 4700,
        sector: 3,
        alienApexKmh: 78,
        userApexKmh: 70,
        alienBrakingDistM: 110,
        userBrakingDistM: 126,
        deltaSec: 0.22,
        coachTip: "Pasa por encima de los pianos amarillos sin tocar los sensores de track limits.",
        severity: "critical",
      },
    ],
  },
  silverstone: {
    id: "silverstone",
    name: "Silverstone Circuit",
    lengthM: 5891,
    alienLapSec: 117.2,
    userLapSec: 118.35,
    alienLapFormatted: "1:57.200",
    userLapFormatted: "1:58.350",
    deltaFormatted: "+1.150s",
    mapPoints: [
      [30, 85], [45, 82], [60, 75], [75, 68], [85, 55], [88, 40], [80, 28], [68, 20],
      [55, 18], [42, 22], [32, 30], [24, 42], [20, 58], [22, 72], [25, 82]
    ],
    turns: [
      {
        turn: 1,
        name: "T1 · Abbey",
        distance: 450,
        sector: 1,
        alienApexKmh: 230,
        userApexKmh: 222,
        alienBrakingDistM: 0,
        userBrakingDistM: 10,
        deltaSec: 0.08,
        coachTip: "Giro a fondo con determinación. El alerón del setup aguanta la carga aerodinámica.",
        severity: "optimal",
      },
      {
        turn: 3,
        name: "T3-T4 · Village & The Loop",
        distance: 1050,
        sector: 1,
        alienApexKmh: 68,
        userApexKmh: 61,
        alienBrakingDistM: 95,
        userBrakingDistM: 112,
        deltaSec: 0.26,
        coachTip: "Horquilla muy lenta. Sacrifica la entrada para tener tracción limpia hacia la recta Wellington.",
        severity: "critical",
      },
      {
        turn: 9,
        name: "T9 · Copse",
        distance: 3200,
        sector: 2,
        alienApexKmh: 220,
        userApexKmh: 211,
        alienBrakingDistM: 20,
        userBrakingDistM: 35,
        deltaSec: 0.16,
        coachTip: "Un toque mínimo de freno a la entrada y compromiso total de acelerador en el ápice.",
        severity: "critical",
      },
      {
        turn: 10,
        name: "T10-T14 · Maggotts, Becketts & Chapel",
        distance: 3700,
        sector: 2,
        alienApexKmh: 185,
        userApexKmh: 176,
        alienBrakingDistM: 35,
        userBrakingDistM: 52,
        deltaSec: 0.35,
        coachTip: "El sector más técnico del automovilismo. Fluidez pura, no frenes de golpe o desestabilizarás la aerodinámica.",
        severity: "critical",
      },
      {
        turn: 15,
        name: "T15 · Stowe",
        distance: 4800,
        sector: 3,
        alienApexKmh: 170,
        userApexKmh: 162,
        alienBrakingDistM: 88,
        userBrakingDistM: 104,
        deltaSec: 0.18,
        coachTip: "Aprovecha el piano de salida hasta el milímetro sin soltar gas.",
        severity: "critical",
      },
    ],
  },
  suzuka: {
    id: "suzuka",
    name: "Suzuka International Racing Course",
    lengthM: 5807,
    alienLapSec: 119.5,
    userLapSec: 120.65,
    alienLapFormatted: "1:59.500",
    userLapFormatted: "2:00.650",
    deltaFormatted: "+1.150s",
    mapPoints: [
      [25, 85], [40, 80], [55, 70], [70, 58], [82, 45], [85, 30], [75, 18], [60, 15],
      [45, 20], [35, 32], [30, 48], [35, 62], [48, 70], [62, 65], [74, 52], [68, 38],
      [52, 35], [38, 45], [26, 60], [20, 75]
    ],
    turns: [
      {
        turn: 1,
        name: "T1-T2 · First Curve",
        distance: 700,
        sector: 1,
        alienApexKmh: 165,
        userApexKmh: 156,
        alienBrakingDistM: 60,
        userBrakingDistM: 78,
        deltaSec: 0.22,
        coachTip: "Entrada doble con frenada en apoyo. Mantén 3ª marcha alta para estabilizar el diferencial.",
        severity: "critical",
      },
      {
        turn: 3,
        name: "T3-T6 · S-Curves",
        distance: 1300,
        sector: 1,
        alienApexKmh: 175,
        userApexKmh: 166,
        alienBrakingDistM: 25,
        userBrakingDistM: 40,
        deltaSec: 0.32,
        coachTip: "Ritmo y cadencia constante de balance de masas. No toques pianos altos o rebotarás.",
        severity: "critical",
      },
      {
        turn: 11,
        name: "T11 · Hairpin",
        distance: 3300,
        sector: 2,
        alienApexKmh: 62,
        userApexKmh: 56,
        alienBrakingDistM: 85,
        userBrakingDistM: 102,
        deltaSec: 0.18,
        coachTip: "Frenada profunda y rotación tardía para salir disparado cuesta abajo.",
        severity: "critical",
      },
      {
        turn: 15,
        name: "T15 · 130R",
        distance: 5050,
        sector: 3,
        alienApexKmh: 260,
        userApexKmh: 254,
        alienBrakingDistM: 0,
        userBrakingDistM: 0,
        deltaSec: 0.05,
        coachTip: "Curva legendaria a fondo en 6ª. Confía en el efecto suelo del splitter delantero.",
        severity: "optimal",
      },
    ],
  },
  sebring: {
    id: "sebring",
    name: "Sebring International Raceway",
    lengthM: 6019,
    alienLapSec: 118.8,
    userLapSec: 120.05,
    alienLapFormatted: "1:58.800",
    userLapFormatted: "2:00.050",
    deltaFormatted: "+1.250s",
    mapPoints: [
      [15, 80], [30, 82], [50, 84], [70, 84], [85, 78], [88, 62], [82, 48], [70, 38],
      [55, 35], [42, 38], [32, 46], [25, 58], [22, 70]
    ],
    turns: [
      {
        turn: 1,
        name: "T1 · Turn 1",
        distance: 600,
        sector: 1,
        alienApexKmh: 175,
        userApexKmh: 167,
        alienBrakingDistM: 70,
        userBrakingDistM: 88,
        deltaSec: 0.22,
        coachTip: "Baches extremos de hormigón. Frena con volante recto antes de meter dirección.",
        severity: "critical",
      },
      {
        turn: 7,
        name: "T7 · Hairpin",
        distance: 2400,
        sector: 2,
        alienApexKmh: 58,
        userApexKmh: 52,
        alienBrakingDistM: 105,
        userBrakingDistM: 122,
        deltaSec: 0.28,
        coachTip: "La horquilla de Sebring premia la paciencia en tracción para la recta de Fangio.",
        severity: "critical",
      },
      {
        turn: 17,
        name: "T17 · Sunset Bend",
        distance: 5700,
        sector: 3,
        alienApexKmh: 155,
        userApexKmh: 147,
        alienBrakingDistM: 85,
        userBrakingDistM: 102,
        deltaSec: 0.35,
        coachTip: "Curva icónica de hormigón irregular. Mantén el pie en el acelerador para no descargar el alerón trasero.",
        severity: "critical",
      },
    ],
  },
  redbullring: {
    id: "redbullring",
    name: "Red Bull Ring Spielberg",
    lengthM: 4318,
    alienLapSec: 87.5,
    userLapSec: 88.42,
    alienLapFormatted: "1:27.500",
    userLapFormatted: "1:28.420",
    deltaFormatted: "+0.920s",
    mapPoints: [
      [20, 85], [40, 82], [65, 78], [85, 70], [88, 50], [80, 32], [65, 22], [48, 20],
      [32, 28], [24, 42], [20, 60], [18, 75]
    ],
    turns: [
      {
        turn: 1,
        name: "T1 · Niki Lauda Curve",
        distance: 500,
        sector: 1,
        alienApexKmh: 120,
        userApexKmh: 114,
        alienBrakingDistM: 85,
        userBrakingDistM: 98,
        deltaSec: 0.21,
        coachTip: "Súbete al piano interior en subida para proyectar el coche a la recta larga.",
        severity: "critical",
      },
      {
        turn: 3,
        name: "T3 · Remus",
        distance: 1600,
        sector: 1,
        alienApexKmh: 65,
        userApexKmh: 58,
        alienBrakingDistM: 110,
        userBrakingDistM: 128,
        deltaSec: 0.32,
        coachTip: "Frenada brutal cuesta arriba. Puedes frenar mucho más tarde de lo que parece gracias a la pendiente positiva.",
        severity: "critical",
      },
      {
        turn: 4,
        name: "T4 · Schlossgold",
        distance: 2400,
        sector: 2,
        alienApexKmh: 115,
        userApexKmh: 108,
        alienBrakingDistM: 78,
        userBrakingDistM: 92,
        deltaSec: 0.24,
        coachTip: "Curva en bajada con tendencia al sobreviraje. Modula el freno suavemente.",
        severity: "critical",
      },
    ],
  },
};

let currentTrackId = "spa";
let activeHoverDist: number | null = null;
let coachLossFilter = false;

export function paintExtras(data: Snapshot): void {
  paintWeek(data);
  paintAnalysis();
  paintReference(data.settings);
  paintChecklist(data.settings);
  paintOverlays();
  paintTeam(data.settings);
  paintFlags(data.settings);
  paintStrategy();
}

// -------------------------------------------------------------
// 1. WEEK SCHEDULE
// -------------------------------------------------------------
function paintWeek(data: Snapshot): void {
  const note = document.getElementById("weekNote");
  const list = document.getElementById("weekList");
  const weekSelect = document.getElementById("weekSelect") as HTMLSelectElement | null;
  const weekSearch = document.getElementById("weekSearch") as HTMLInputElement | null;
  const catFilters = document.getElementById("weekCatFilters");
  if (!note || !list) return;

  if (weekSelect && weekSelect.options.length === 0) {
    const weekDates: Record<number, string> = {
      1: "15 sep", 2: "22 sep", 3: "29 sep", 4: "06 oct",
      5: "13 oct", 6: "20 oct", 7: "27 oct", 8: "03 nov",
      9: "10 nov", 10: "17 nov", 11: "24 nov", 12: "01 dic",
    };
    for (let w = 1; w <= 12; w++) {
      const opt = document.createElement("option");
      opt.value = String(w);
      const isCurrent = w === (schedule.current_week || 9);
      opt.textContent = `Semana ${w} (${weekDates[w] ?? ""})${isCurrent ? " · ACTUAL" : ""}`;
      weekSelect.append(opt);
    }
    weekSelect.value = String(activeWeek);
  }

  if (!weekListenersAttached) {
    weekListenersAttached = true;
    if (weekSelect) {
      weekSelect.addEventListener("change", () => {
        activeWeek = Number(weekSelect.value);
        renderWeekItems(data);
      });
    }
    if (weekSearch) {
      weekSearch.addEventListener("input", () => {
        activeSearch = weekSearch.value.trim().toLowerCase();
        renderWeekItems(data);
      });
    }
    if (catFilters) {
      catFilters.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn || !btn.dataset.cat) return;
        activeCat = btn.dataset.cat;
        for (const b of catFilters.querySelectorAll("button")) {
          const isSelected = b.dataset.cat === activeCat;
          b.className = isSelected
            ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold"
            : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        }
        renderWeekItems(data);
      });
    }
  }

  renderWeekItems(data);
}

function renderWeekItems(data: Snapshot): void {
  const note = document.getElementById("weekNote");
  const list = document.getElementById("weekList");
  if (!note || !list) return;

  const filtered = schedule.series.filter((s) => {
    if (activeCat !== "all" && s.category.toLowerCase() !== activeCat.toLowerCase()) return false;
    if (activeSearch) {
      const q = activeSearch;
      const matchName = s.name.toLowerCase().includes(q);
      const matchCars = s.cars.some((c) => c.toLowerCase().includes(q));
      const weekItem = s.weeks.find((w) => w.week_num === activeWeek);
      const matchTrack = weekItem ? weekItem.track_name.toLowerCase().includes(q) : false;
      if (!matchName && !matchCars && !matchTrack) return false;
    }
    return true;
  });

  note.textContent = `${schedule.season} · Semana ${activeWeek} de 12 · Mostrando ${filtered.length} de ${schedule.total_series} series oficiales`;
  list.replaceChildren();

  const userCars = (data.lastCars || []).map((c) => c.toLowerCase());

  for (const s of filtered) {
    const weekItem = s.weeks.find((w) => w.week_num === activeWeek);
    const hasUserCar = userCars.length > 0 && s.cars.some((c) => userCars.some((uc) => c.toLowerCase().includes(uc) || uc.includes(c.toLowerCase())));
    const matchCount = data.library.filter((lib) => s.cars.some((c) => c.toLowerCase().includes(lib.carFolder.toLowerCase()) || lib.carFolder.toLowerCase().includes(c.toLowerCase()))).length;

    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-line-2";
    if (hasUserCar) {
      card.className += " ring-1 ring-r-accent/40";
    }

    const top = document.createElement("div");
    top.className = "flex flex-wrap items-center justify-between gap-2";

    const badges = document.createElement("div");
    badges.className = "flex flex-wrap items-center gap-1.5 font-mono text-[11px]";

    const catBadge = document.createElement("span");
    catBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-bg text-r-muted";
    catBadge.textContent = s.category;

    const tierBadge = document.createElement("span");
    tierBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-bg text-r-accent";
    tierBadge.textContent = s.tier.replace("Class", " Class");

    badges.append(catBadge, tierBadge);

    if (matchCount > 0) {
      const setupBadge = document.createElement("span");
      setupBadge.className = "px-2.5 py-0.5 rounded bg-r-accent/15 text-r-accent font-mono text-[11px] font-bold";
      setupBadge.textContent = `${matchCount} setups MMT listos`;
      top.append(badges, setupBadge);
    } else {
      top.append(badges);
    }

    const title = document.createElement("h2");
    title.className = "mt-2.5 text-lg font-bold text-r-text";
    title.textContent = s.name;

    card.append(top, title);

    if (weekItem) {
      const trackBox = document.createElement("div");
      trackBox.className = "mt-3.5 rounded-xl border border-r-line/60 bg-r-bg/50 p-3.5";

      const trackHeader = document.createElement("div");
      trackHeader.className = "flex flex-wrap items-baseline justify-between gap-2";

      const trackName = document.createElement("strong");
      trackName.className = "text-base text-r-accent";
      trackName.textContent = weekItem.track_name;

      const trackConfig = document.createElement("span");
      trackConfig.className = "font-mono text-xs text-r-muted";
      trackConfig.textContent = weekItem.config;

      trackHeader.append(trackName, trackConfig);

      const trackMeta = document.createElement("div");
      trackMeta.className = "mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-r-muted";

      if (weekItem.duration) {
        const d = document.createElement("span");
        d.textContent = `Duración: ${weekItem.duration}`;
        trackMeta.append(d);
      }
      if (weekItem.weather) {
        const w = document.createElement("span");
        w.textContent = `Clima: ${weekItem.weather}`;
        trackMeta.append(w);
      }
      if (weekItem.sim_time) {
        const st = document.createElement("span");
        st.textContent = `Sim: ${weekItem.sim_time}`;
        trackMeta.append(st);
      }

      trackBox.append(trackHeader, trackMeta);
      card.append(trackBox);
    }

    if (s.cars && s.cars.length > 0) {
      const carsRow = document.createElement("p");
      carsRow.className = "mt-3 text-xs text-r-muted line-clamp-2";
      const carLabel = document.createElement("strong");
      carLabel.className = "text-r-text font-normal";
      carLabel.textContent = "Coches: ";
      carsRow.append(carLabel, document.createTextNode(s.cars.slice(0, 6).join(", ") + (s.cars.length > 6 ? ` (+${s.cars.length - 6} más)` : "")));
      card.append(carsRow);
    }

    list.append(card);
  }
}

// -------------------------------------------------------------
// 2. TELEMETRY & COACHING STUDIO (TrackTitan / VRS / GnG caliber)
// -------------------------------------------------------------
function paintAnalysis(): void {
  const trackSel = document.getElementById("telemetryTrack") as HTMLSelectElement | null;
  const carSel = document.getElementById("telemetryCar") as HTMLSelectElement | null;
  const filterAll = document.getElementById("coachFilterAll");
  const filterLoss = document.getElementById("coachFilterLoss");
  const traceCanvas = document.getElementById("traceCanvas") as HTMLCanvasElement | null;

  if (trackSel && !studioInitialized) {
    studioInitialized = true;
    trackSel.addEventListener("change", () => {
      currentTrackId = trackSel.value;
      activeHoverDist = null;
      renderTelemetryStudio();
    });

    if (carSel) {
      carSel.addEventListener("change", () => {
        renderTelemetryStudio();
      });
    }

    if (filterAll && filterLoss) {
      filterAll.addEventListener("click", () => {
        coachLossFilter = false;
        filterAll.className = "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/10 text-r-accent font-mono text-xs font-bold";
        filterLoss.className = "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        renderCoachingCards();
      });
      filterLoss.addEventListener("click", () => {
        coachLossFilter = true;
        filterLoss.className = "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/10 text-r-accent font-mono text-xs font-bold";
        filterAll.className = "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        renderCoachingCards();
      });
    }

    if (traceCanvas) {
      traceCanvas.addEventListener("mousemove", (e) => {
        const rect = traceCanvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const prof = TRACK_PROFILES[currentTrackId] || TRACK_PROFILES.spa;
        activeHoverDist = normX * prof.lengthM;
        drawTraceStudio(prof, activeHoverDist);
        drawMapStudio(prof, activeHoverDist);
        updateCursorReadout(prof, activeHoverDist);
      });

      traceCanvas.addEventListener("mouseleave", () => {
        activeHoverDist = null;
        const prof = TRACK_PROFILES[currentTrackId] || TRACK_PROFILES.spa;
        drawTraceStudio(prof, null);
        drawMapStudio(prof, null);
        updateCursorReadout(prof, null);
      });
    }
  }

  renderTelemetryStudio();
}

function renderTelemetryStudio(): void {
  const prof = TRACK_PROFILES[currentTrackId] || TRACK_PROFILES.spa;

  const alienTimeNode = document.getElementById("lapAlienTime");
  const userTimeNode = document.getElementById("lapUserTime");
  const deltaSummaryNode = document.getElementById("lapDeltaSummary");
  const trackLengthBadge = document.getElementById("trackLengthBadge");

  if (alienTimeNode) alienTimeNode.textContent = prof.alienLapFormatted;
  if (userTimeNode) userTimeNode.textContent = prof.userLapFormatted;
  if (deltaSummaryNode) deltaSummaryNode.textContent = prof.deltaFormatted;
  if (trackLengthBadge) trackLengthBadge.textContent = `${(prof.lengthM / 1000).toFixed(3)} km · ${prof.turns.length} giros`;

  drawTraceStudio(prof, activeHoverDist);
  drawMapStudio(prof, activeHoverDist);
  updateCursorReadout(prof, activeHoverDist);
  renderCoachingCards();
}

// Generate realistic synthetic telemetry curve based on real track corners
function getTelemetrySampleAt(prof: TrackTelemetryProfile, dist: number): {
  speedAlien: number;
  speedUser: number;
  throttle: number;
  brake: number;
  gear: number;
  delta: number;
  cornerName: string;
} {
  const normDist = ((dist % prof.lengthM) + prof.lengthM) % prof.lengthM;

  // Find nearest turn
  let nearestTurn = prof.turns[0];
  let minTurnDist = 999999;
  for (const t of prof.turns) {
    const d = Math.abs(t.distance - normDist);
    if (d < minTurnDist) {
      minTurnDist = d;
      nearestTurn = t;
    }
  }

  // Corner apex window is within +/- 60m of turn.distance
  const distFromApex = normDist - nearestTurn.distance;
  const inBrakingZone = distFromApex >= -nearestTurn.userBrakingDistM && distFromApex < -10;
  const inApex = Math.abs(distFromApex) <= 30;
  const inExit = distFromApex > 30 && distFromApex < 120;

  let speedAlien: number;
  let speedUser: number;
  let throttle = 1.0;
  let brake = 0.0;
  let gear = 5;

  if (inBrakingZone) {
    const brakeProgress = (distFromApex + nearestTurn.userBrakingDistM) / Math.max(1, nearestTurn.userBrakingDistM);
    brake = Math.max(0, 1 - brakeProgress * 0.7); // Progressive trail braking decay
    throttle = 0;
    speedUser = nearestTurn.userApexKmh + (240 - nearestTurn.userApexKmh) * (1 - brakeProgress);
    speedAlien = nearestTurn.alienApexKmh + (250 - nearestTurn.alienApexKmh) * (1 - brakeProgress);
    gear = nearestTurn.alienApexKmh < 90 ? 2 : nearestTurn.alienApexKmh < 150 ? 3 : 4;
  } else if (inApex) {
    speedUser = nearestTurn.userApexKmh;
    speedAlien = nearestTurn.alienApexKmh;
    brake = 0.08; // Trail touch
    throttle = 0.35;
    gear = nearestTurn.alienApexKmh < 90 ? 2 : nearestTurn.alienApexKmh < 150 ? 3 : 4;
  } else if (inExit) {
    const exitProgress = (distFromApex - 30) / 90;
    throttle = Math.min(1.0, 0.4 + exitProgress * 0.6);
    brake = 0;
    speedUser = nearestTurn.userApexKmh + exitProgress * 55;
    speedAlien = nearestTurn.alienApexKmh + exitProgress * 62;
    gear = speedUser > 180 ? 5 : speedUser > 130 ? 4 : 3;
  } else {
    // High speed straight
    speedAlien = 255;
    speedUser = 248;
    throttle = 1.0;
    brake = 0;
    gear = 6;
  }

  // Progressive lap delta along the lap
  const delta = (normDist / prof.lengthM) * (prof.userLapSec - prof.alienLapSec);
  const cornerName = Math.abs(distFromApex) < 150 ? nearestTurn.name : "Recta";

  return { speedAlien, speedUser, throttle, brake, gear, delta, cornerName };
}

function drawTraceStudio(prof: TrackTelemetryProfile, hoverDist: number | null): void {
  const canvas = document.getElementById("traceCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = "rgba(10, 15, 13, 0.85)";
  ctx.fillRect(0, 0, w, h);

  // Layout splits: Speed (0..200px), Delta (205..255px), Inputs (260..330px)
  const speedH = 180;
  const deltaY = 195;
  const deltaH = 55;
  const pedalY = 265;
  const pedalH = 65;

  // Grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let s = 50; s <= 250; s += 50) {
    const y = speedH - (s / 300) * speedH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "9px monospace";
    ctx.fillText(`${s} km/h`, 8, y - 3);
  }

  // Distance separators (every 1000m)
  for (let d = 1000; d < prof.lengthM; d += 1000) {
    const x = (d / prof.lengthM) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "9px monospace";
    ctx.fillText(`${d / 1000} km`, x + 4, speedH - 4);
  }

  // 1. CHANNEL: SPEED CURVE (Alien Green #00e699 vs User Sky #38bdf8)
  const steps = 180;
  const pointsAlien: [number, number][] = [];
  const pointsUser: [number, number][] = [];
  const pointsDelta: [number, number][] = [];
  const pointsThrottle: [number, number][] = [];
  const pointsBrake: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const dist = (i / steps) * prof.lengthM;
    const x = (i / steps) * w;
    const sample = getTelemetrySampleAt(prof, dist);

    const yAlien = speedH - (sample.speedAlien / 300) * speedH;
    const yUser = speedH - (sample.speedUser / 300) * speedH;
    pointsAlien.push([x, yAlien]);
    pointsUser.push([x, yUser]);

    // Delta centered around deltaY + deltaH/2
    const dMid = deltaY + deltaH / 2;
    const yDelta = dMid + Math.min(20, Math.max(-20, sample.delta * 12));
    pointsDelta.push([x, yDelta]);

    // Pedals
    const yThr = pedalY + pedalH - sample.throttle * pedalH;
    const yBrk = pedalY + pedalH - sample.brake * pedalH;
    pointsThrottle.push([x, yThr]);
    pointsBrake.push([x, yBrk]);
  }

  // Draw Alien Speed
  ctx.beginPath();
  ctx.strokeStyle = "#00e699";
  ctx.lineWidth = 2;
  for (let i = 0; i < pointsAlien.length; i++) {
    const [x, y] = pointsAlien[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw User Speed
  ctx.beginPath();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  for (let i = 0; i < pointsUser.length; i++) {
    const [x, y] = pointsUser[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 2. CHANNEL: DELTA CURVE
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(0, deltaY, w, deltaH);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.moveTo(0, deltaY + deltaH / 2);
  ctx.lineTo(w, deltaY + deltaH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < pointsDelta.length; i++) {
    const [x, y] = pointsDelta[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 3. CHANNEL: PEDALS (Throttle Green / Brake Red with trail fill)
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  ctx.fillRect(0, pedalY, w, pedalH);

  // Brake Fill
  ctx.beginPath();
  ctx.moveTo(0, pedalY + pedalH);
  for (const [x, y] of pointsBrake) ctx.lineTo(x, y);
  ctx.lineTo(w, pedalY + pedalH);
  ctx.closePath();
  ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < pointsBrake.length; i++) {
    const [x, y] = pointsBrake[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Throttle
  ctx.beginPath();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < pointsThrottle.length; i++) {
    const [x, y] = pointsThrottle[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Corner markers along the graph
  for (const turn of prof.turns) {
    const x = (turn.distance / prof.lengthM) * w;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = turn.severity === "critical" ? "#fb7185" : "#a3b0ac";
    ctx.font = "bold 9px monospace";
    ctx.fillText(`T${turn.turn}`, x + 3, 14);
  }

  // Hover Crosshair
  if (hoverDist !== null) {
    const x = (hoverDist / prof.lengthM) * w;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);

    const sample = getTelemetrySampleAt(prof, hoverDist);
    const yAlien = speedH - (sample.speedAlien / 300) * speedH;
    const yUser = speedH - (sample.speedUser / 300) * speedH;

    // Glowing pips
    ctx.fillStyle = "#00e699";
    ctx.beginPath();
    ctx.arc(x, yAlien, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(x, yUser, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMapStudio(prof: TrackTelemetryProfile, hoverDist: number | null): void {
  const canvas = document.getElementById("mapCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pts = prof.mapPoints;
  if (pts.length < 3) return;

  // Track loop path
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = (pts[i][0] / 100) * (w - 40) + 20;
    const py = (pts[i][1] / 100) * (h - 40) + 20;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = "#273833";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.strokeStyle = "#00e699";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Corner Turn Dots
  for (const t of prof.turns) {
    const norm = t.distance / prof.lengthM;
    const idx = Math.floor(norm * (pts.length - 1));
    const pt = pts[idx] || pts[0];
    const px = (pt[0] / 100) * (w - 40) + 20;
    const py = (pt[1] / 100) * (h - 40) + 20;

    ctx.fillStyle = t.severity === "critical" ? "#f43f5e" : "#00e699";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.fillText(`${t.turn}`, px + 6, py - 4);
  }

  // Hover vehicle marker
  if (hoverDist !== null) {
    const norm = hoverDist / prof.lengthM;
    const idx = Math.floor(norm * (pts.length - 1));
    const pt = pts[idx] || pts[0];
    const px = (pt[0] / 100) * (w - 40) + 20;
    const py = (pt[1] / 100) * (h - 40) + 20;

    // Outer glow
    ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright pip
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateCursorReadout(prof: TrackTelemetryProfile, hoverDist: number | null): void {
  const curDist = document.getElementById("curDist");
  const curSpeed = document.getElementById("curSpeed");
  const curDelta = document.getElementById("curDelta");
  const curCorner = document.getElementById("curCorner");
  if (!curDist || !curSpeed || !curDelta || !curCorner) return;

  if (hoverDist === null) {
    curDist.textContent = "0 m";
    curSpeed.textContent = "0 km/h";
    curDelta.textContent = prof.deltaFormatted;
    curCorner.textContent = "Pasa el ratón por la telemetría";
    return;
  }

  const sample = getTelemetrySampleAt(prof, hoverDist);
  const diffKmh = Math.round(sample.speedUser - sample.speedAlien);
  curDist.textContent = `${Math.round(hoverDist)} m`;
  curSpeed.textContent = `${Math.round(sample.speedUser)} km/h (${diffKmh >= 0 ? "+" : ""}${diffKmh})`;
  curDelta.textContent = `${sample.delta >= 0 ? "+" : ""}${sample.delta.toFixed(3)}s`;
  curCorner.textContent = sample.cornerName;
}

function renderCoachingCards(): void {
  const container = document.getElementById("cornerCoachingList");
  if (!container) return;
  const prof = TRACK_PROFILES[currentTrackId] || TRACK_PROFILES.spa;

  container.replaceChildren();

  const turnsToRender = coachLossFilter
    ? prof.turns.filter((t) => t.deltaSec >= 0.1 || t.severity === "critical")
    : prof.turns;

  for (const t of turnsToRender) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-accent/60 cursor-pointer";

    card.addEventListener("click", () => {
      activeHoverDist = t.distance;
      drawTraceStudio(prof, activeHoverDist);
      drawMapStudio(prof, activeHoverDist);
      updateCursorReadout(prof, activeHoverDist);
    });

    const top = document.createElement("div");
    top.className = "flex items-start justify-between gap-2";

    const titleDiv = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "font-display text-base uppercase text-r-text";
    h3.textContent = t.name;

    const sectorTag = document.createElement("span");
    sectorTag.className = "text-[11px] font-mono text-r-muted";
    sectorTag.textContent = `Sector ${t.sector} · Dist: ${t.distance}m`;
    titleDiv.append(h3, sectorTag);

    const deltaBadge = document.createElement("span");
    deltaBadge.className = "px-2 py-0.5 rounded font-mono text-xs font-bold ";
    if (t.severity === "critical") {
      deltaBadge.className += "bg-rose-500/15 text-rose-400 border border-rose-500/30";
      deltaBadge.textContent = `+${t.deltaSec.toFixed(2)}s`;
    } else if (t.severity === "moderate") {
      deltaBadge.className += "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      deltaBadge.textContent = `+${t.deltaSec.toFixed(2)}s`;
    } else {
      deltaBadge.className += "bg-r-accent/15 text-r-accent border border-r-accent/30";
      deltaBadge.textContent = `+${t.deltaSec.toFixed(2)}s`;
    }

    top.append(titleDiv, deltaBadge);

    const statsRow = document.createElement("div");
    statsRow.className = "mt-3 grid grid-cols-2 gap-2 text-xs font-mono bg-r-bg/60 p-2.5 rounded-xl border border-r-line/50";
    statsRow.innerHTML = `
      <div>
        <span class="text-r-muted block text-[10px]">VÉRTICE (KM/H)</span>
        <strong class="text-r-text">${t.userApexKmh}</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${t.alienApexKmh}</strong>
      </div>
      <div>
        <span class="text-r-muted block text-[10px]">FRENADA (M)</span>
        <strong class="text-r-text">${t.userBrakingDistM}m</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${t.alienBrakingDistM}m</strong>
      </div>
    `;

    const coachText = document.createElement("p");
    coachText.className = "mt-3 text-xs text-r-muted leading-relaxed font-sans";
    coachText.innerHTML = `<strong class="text-r-text font-medium">Coach MMT:</strong> ${t.coachTip}`;

    card.append(top, statsRow, coachText);
    container.append(card);
  }
}

// -------------------------------------------------------------
// 3. PIT STOP & FUEL STRATEGY (Coach Dave / GnG caliber)
// -------------------------------------------------------------
function paintStrategy(): void {
  const form = document.getElementById("fuelForm") as HTMLFormElement | null;
  const presetsBar = document.getElementById("stratPresetsBar");
  if (!form) return;

  if (!strategyInitialized) {
    strategyInitialized = true;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      recalculateStrategy();
    });

    const inputs = form.querySelectorAll("input");
    inputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        recalculateStrategy();
      });
    });

    if (presetsBar) {
      presetsBar.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn || !btn.dataset.preset) return;
        applyStrategyPreset(btn.dataset.preset);
        for (const b of presetsBar.querySelectorAll("button")) {
          const isSelected = b === btn;
          b.className = isSelected
            ? "strat-preset px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold"
            : "strat-preset px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        }
      });
    }
  }

  recalculateStrategy();
}

function applyStrategyPreset(preset: string): void {
  const raceMin = document.getElementById("raceMin") as HTMLInputElement | null;
  const lapSec = document.getElementById("lapSec") as HTMLInputElement | null;
  const fuelLap = document.getElementById("fuelLap") as HTMLInputElement | null;
  const tank = document.getElementById("tank") as HTMLInputElement | null;
  const fuelNow = document.getElementById("fuelNow") as HTMLInputElement | null;
  const pitLoss = document.getElementById("pitLoss") as HTMLInputElement | null;
  if (!raceMin || !lapSec || !fuelLap || !tank || !fuelNow || !pitLoss) return;

  switch (preset) {
    case "sprint20":
      raceMin.value = "20";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "35";
      pitLoss.value = "28";
      break;
    case "feature40":
      raceMin.value = "40";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "65";
      pitLoss.value = "32";
      break;
    case "imsa45":
      raceMin.value = "45";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "75";
      pitLoss.value = "35";
      break;
    case "vrs144":
      raceMin.value = "144";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "110";
      pitLoss.value = "40";
      break;
    case "endur360":
      raceMin.value = "360";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "110";
      pitLoss.value = "42";
      break;
    case "daytona24":
      raceMin.value = "1440";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "110";
      pitLoss.value = "45";
      break;
  }

  recalculateStrategy();
}

function recalculateStrategy(): void {
  const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
  const minutes = num("raceMin");
  const lapSeconds = num("lapSec");
  const perLap = num("fuelLap");
  const tank = num("tank");
  const now = num("fuelNow");
  const pitLoss = num("pitLoss");

  const fuelOut = document.getElementById("fuelOut");
  const metricsGrid = document.getElementById("stratMetricsGrid");
  const timelineCard = document.getElementById("stintVisualTimeline");

  if (minutes <= 0 || lapSeconds <= 0 || perLap <= 0 || tank <= 0 || now < 0) {
    if (fuelOut) fuelOut.textContent = "Revisa los números: tienen que ser mayores que cero.";
    return;
  }

  // Calculations
  const lapsExact = (minutes * 60) / lapSeconds;
  const totalLaps = Math.ceil(lapsExact) + 1; // +1 lap margin for race end
  const totalFuel = totalLaps * perLap;
  const stintLaps = Math.floor(tank / perLap);
  const lapsWithCurrentFuel = Math.floor(now / perLap);
  const deficit = Math.max(0, totalFuel - now);
  const stops = deficit <= 0 ? 0 : Math.ceil(deficit / tank);
  const fuelToAdd = Math.min(tank, Math.ceil(deficit * 10) / 10);
  const refuelTimeSec = fuelToAdd > 0 ? (fuelToAdd / 2.8).toFixed(1) : "0.0"; // 2.8 L/s iRacing GT3 standard
  const pitWindowStartLap = Math.max(1, lapsWithCurrentFuel - 2);
  const pitWindowEndLap = Math.max(1, lapsWithCurrentFuel);
  const pitWindowMinStart = ((pitWindowStartLap * lapSeconds) / 60).toFixed(1);

  if (fuelOut) {
    fuelOut.textContent = `${totalLaps} vueltas estimadas (con margen de meta). Total necesario: ${totalFuel.toFixed(1)} L. Depósito actual: ${lapsWithCurrentFuel} vueltas. Paradas requeridas: ${stops}. En la parada repostar: ${fuelToAdd} L (~${refuelTimeSec}s de manguera a 2.8 L/s). Pérdida de pit lane: ${pitLoss}s.`;
  }

  if (metricsGrid) {
    metricsGrid.innerHTML = `
      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Vueltas Totales</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-r-text">${totalLaps}</strong>
          <span class="text-xs text-r-muted font-mono">laps</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">+1 vuelta de margen de seguridad</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Combustible Total</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-r-accent">${totalFuel.toFixed(1)}</strong>
          <span class="text-xs text-r-muted font-mono">Litros</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">Consumo medio: ${perLap.toFixed(2)} L/vuelta</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Autonomía Depósito</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-sky-400">${stintLaps}</strong>
          <span class="text-xs text-r-muted font-mono">vueltas / tanque</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">Capacidad máxima: ${tank} Litros</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Paradas en Box</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black ${stops > 0 ? "text-amber-400" : "text-r-accent"}">${stops}</strong>
          <span class="text-xs text-r-muted font-mono">${stops === 1 ? "parada" : "paradas"}</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">${stops > 0 ? `Añadir ${fuelToAdd} L (~${refuelTimeSec}s)` : "Sin parada obligatoria"}</span>
      </div>
    `;
  }

  if (timelineCard) {
    if (stops === 0) {
      timelineCard.innerHTML = `
        <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
          <span class="px-2 py-0.5 rounded bg-r-accent/20 text-r-accent font-bold">STINT ÚNICO</span>
          <span class="text-r-text">Salida (Vuelta 1) → Meta (Vuelta ${totalLaps})</span>
          <span class="text-r-muted ml-auto">${minutes} min sin repostaje</span>
        </div>
      `;
    } else {
      timelineCard.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
            <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">STINT 1</span>
            <span class="text-r-text">Salida (V1) → Box (V${pitWindowStartLap} - V${pitWindowEndLap})</span>
            <span class="text-r-muted ml-auto">Ventana óptima: min ${pitWindowMinStart}</span>
          </div>
          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 font-mono text-xs text-amber-300">
            <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">PIT STOP</span>
            <span>Entrada a box: repostar ${fuelToAdd} L (${refuelTimeSec}s manguera) + ${pitLoss}s pit lane</span>
            <span class="ml-auto font-semibold">Tiempo total box: ${(Number(refuelTimeSec) + pitLoss).toFixed(0)}s</span>
          </div>
          <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">STINT 2</span>
            <span class="text-r-text">Salida de Pit (V${pitWindowEndLap + 1}) → Bandera a Cuadros (V${totalLaps})</span>
            <span class="text-r-muted ml-auto">${totalLaps - pitWindowEndLap} vueltas hasta el final</span>
          </div>
        </div>
      `;
    }
  }
}

// -------------------------------------------------------------
// 4. LIVE OVERLAYS & HUD (VRS / Garage 61 caliber)
// -------------------------------------------------------------
let isLiveFromSDK = false;
let demoAnimationTimer: number | null = null;
let demoTick = 0;

function paintOverlays(): void {
  const toggleBtn = document.getElementById("overlayModeToggle");
  const shiftLights = document.getElementById("ovShiftLights");
  const canvas = document.getElementById("ovInputs") as HTMLCanvasElement | null;

  if (shiftLights && shiftLights.children.length === 0) {
    // 16 Sequential LEDs (5 Green, 5 Yellow, 5 Red, 1 Blue)
    for (let i = 0; i < 16; i++) {
      const led = document.createElement("div");
      led.className = "w-3 h-5 rounded-sm bg-white/10 transition-colors duration-75";
      led.dataset.led = String(i);
      shiftLights.append(led);
    }
  }

  if (toggleBtn && !overlayInitialized) {
    overlayInitialized = true;
    toggleBtn.addEventListener("click", () => {
      isLiveFromSDK = !isLiveFromSDK;
      toggleBtn.textContent = isLiveFromSDK ? "Modo SDK Directo (Esperando iRacing)" : "Modo Demo Activo (Pruébalo)";
      toggleBtn.className = isLiveFromSDK
        ? "px-3.5 py-2 rounded-xl border border-sky-400 bg-sky-500/15 text-sky-300 font-mono text-xs font-bold"
        : "px-3.5 py-2 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold";
    });

    startDemoOverlayLoop();
  }

  if (canvas) {
    drawInputsCanvas(canvas, { t: 0, dist: 0, speed: 0, throttle: 0, brake: 0, gear: 0, steering: 0 });
  }
}

function startDemoOverlayLoop(): void {
  if (demoAnimationTimer) clearInterval(demoAnimationTimer);

  demoAnimationTimer = window.setInterval(() => {
    if (isLiveFromSDK) return; // Do not animate demo if user requested SDK mode or SDK is delivering

    demoTick += 0.05;
    // Synthetic lap progression
    const t = demoTick;
    const speed = 120 + Math.sin(t * 0.8) * 80;
    const gear = speed > 180 ? 5 : speed > 140 ? 4 : speed > 90 ? 3 : 2;
    const throttle = Math.sin(t * 0.8) > 0 ? Math.abs(Math.sin(t * 0.8)) : 0.1;
    const brake = Math.sin(t * 0.8) < -0.3 ? Math.abs(Math.sin(t * 0.8)) : 0;
    const steering = Math.sin(t * 0.4) * 0.8;

    updateHUDDisplay({
      t: demoTick,
      dist: (demoTick * 45) % 7004,
      speed: speed / 3.6,
      throttle,
      brake,
      gear,
      steering,
    });
  }, 50);
}

export function updateLiveOverlay(sample: LiveSample): void {
  isLiveFromSDK = true;
  updateHUDDisplay(sample);
}

function updateHUDDisplay(sample: LiveSample): void {
  const kmh = Math.round(sample.speed * 3.6);
  const gearStr = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);
  const rpmEst = Math.min(8500, Math.round(kmh * 38 + 2000));

  // Shift Lights
  const shiftLights = document.getElementById("ovShiftLights");
  if (shiftLights) {
    const leds = shiftLights.children;
    const rpmNorm = Math.max(0, Math.min(1, (rpmEst - 5000) / 3200));
    const activeCount = Math.floor(rpmNorm * 16);

    for (let i = 0; i < leds.length; i++) {
      const el = leds[i] as HTMLElement;
      if (i < activeCount) {
        if (i < 5) el.style.backgroundColor = "#10b981"; // Green
        else if (i < 10) el.style.backgroundColor = "#facc15"; // Yellow
        else if (i < 15) el.style.backgroundColor = "#ef4444"; // Red
        else el.style.backgroundColor = "#38bdf8"; // Blue rev flash
        el.style.boxShadow = "0 0 8px currentColor";
      } else {
        el.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
        el.style.boxShadow = "none";
      }
    }
  }

  // Central Cluster
  const ovGear = document.getElementById("ovGear");
  const ovSpeed = document.getElementById("ovSpeed");
  const ovRpm = document.getElementById("ovRpm");
  const ovDelta = document.getElementById("ovDelta");
  if (ovGear) ovGear.textContent = gearStr;
  if (ovSpeed) ovSpeed.textContent = String(kmh);
  if (ovRpm) ovRpm.textContent = `${rpmEst.toLocaleString()} RPM`;
  if (ovDelta) {
    const deltaVal = Math.sin(sample.t * 0.5) * 0.45;
    ovDelta.textContent = `${deltaVal >= 0 ? "+" : ""}${deltaVal.toFixed(2)}s · Sector 2`;
    if (deltaVal <= 0) {
      ovDelta.className = "mb-3 px-5 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/80 text-emerald-400 font-mono text-sm font-bold shadow-lg shadow-emerald-950/50";
    } else {
      ovDelta.className = "mb-3 px-5 py-1.5 rounded-full border border-rose-500/40 bg-rose-950/80 text-rose-400 font-mono text-sm font-bold shadow-lg shadow-rose-950/50";
    }
  }

  // Relative Radar (Garage 61 style)
  const rel = document.getElementById("ovRelative");
  if (rel) {
    rel.innerHTML = `
      <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Radar de Intervalos (Relativo)</div>
      <div class="space-y-1">
        <div class="flex items-center justify-between text-r-muted">
          <span>#911 · Porsche 992</span>
          <span class="text-amber-400 font-bold">-1.24s</span>
        </div>
        <div class="flex items-center justify-between bg-r-accent/20 text-r-accent px-1.5 py-0.5 rounded font-bold">
          <span>#16 · Tú (Alberto)</span>
          <span>P3 · PACE</span>
        </div>
        <div class="flex items-center justify-between text-r-muted">
          <span>#23 · Ferrari 296</span>
          <span class="text-sky-300 font-bold">+0.85s</span>
        </div>
      </div>
    `;
  }

  // Standings
  const standings = document.getElementById("ovStandings");
  if (standings) {
    standings.innerHTML = `
      <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Clasificación GT3</div>
      <div class="space-y-1 text-xs">
        <div class="flex justify-between"><span>P1 · Coche 8</span><span class="text-r-muted">LIDER</span></div>
        <div class="flex justify-between"><span>P2 · Coche 911</span><span class="text-r-muted">+3.2s</span></div>
        <div class="flex justify-between font-bold text-r-accent"><span>P3 · Tú (#16)</span><span>+4.4s</span></div>
        <div class="flex justify-between"><span>P4 · Coche 23</span><span class="text-r-muted">+5.2s</span></div>
      </div>
    `;
  }

  // Live Fuel Computer
  const fuel = document.getElementById("ovFuel");
  if (fuel) {
    const fuelRemainingL = 48.5;
    const lapsLeft = (fuelRemainingL / 3.15).toFixed(1);
    fuel.innerHTML = `
      <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Ordenador de Carrera & Consumo</div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div><span class="text-r-muted block text-[10px]">COMBUSTIBLE</span><strong class="text-white text-base">${fuelRemainingL} L</strong></div>
        <div><span class="text-r-muted block text-[10px]">VUELTAS RESTANTES</span><strong class="text-r-accent text-base">${lapsLeft}</strong></div>
        <div><span class="text-r-muted block text-[10px]">BURN RATE</span><strong class="text-white">3.15 L/v</strong></div>
        <div><span class="text-r-muted block text-[10px]">PARA META</span><strong class="text-amber-400">+12.5 L</strong></div>
      </div>
    `;
  }

  // Inputs Canvas
  const canvas = document.getElementById("ovInputs") as HTMLCanvasElement | null;
  if (canvas) {
    drawInputsCanvas(canvas, sample);
  }

  const tyres = document.getElementById("ovTyres");
  if (tyres) {
    const steerDeg = (sample.steering * 57.2958).toFixed(1);
    tyres.textContent = `Volante: ${steerDeg}° · Gas: ${Math.round(sample.throttle * 100)}% · Freno: ${Math.round(sample.brake * 100)}%`;
  }
}

function drawInputsCanvas(canvas: HTMLCanvasElement, sample: LiveSample): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = "rgba(10, 15, 13, 0.95)";
  ctx.fillRect(0, 0, w, h);

  const barH = 60;
  const barY = 12;

  // Throttle bar (Green)
  const thrH = Math.max(0, Math.min(1, sample.throttle)) * barH;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(16, barY, 20, barH);
  ctx.fillStyle = "#00e699";
  ctx.fillRect(16, barY + barH - thrH, 20, thrH);

  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "#a0aba6";
  ctx.textAlign = "center";
  ctx.fillText("GAS", 26, barY + barH + 15);

  // Brake bar (Crimson with trail indicator)
  const brkH = Math.max(0, Math.min(1, sample.brake)) * barH;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(44, barY, 20, barH);
  ctx.fillStyle = sample.brake > 0.85 ? "#ff2a44" : "#f43f5e";
  ctx.fillRect(44, barY + barH - brkH, 20, brkH);

  ctx.fillText("BRK", 54, barY + barH + 15);

  // ABS active indicator
  if (sample.brake > 0.8) {
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.arc(54, barY - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Steering gauge
  const stX = 85;
  const stW = 120;
  const stMid = stX + stW / 2;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(stX, barY + 24, stW, 8);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(stMid - 1, barY + 18, 2, 20);

  const steerDeg = sample.steering * 57.2958;
  const steerNorm = Math.max(-1, Math.min(1, steerDeg / 90));
  const pipX = stMid + steerNorm * (stW / 2 - 5);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(pipX - 3, barY + 18, 6, 20);

  ctx.fillText(`VOL ${steerDeg >= 0 ? "+" : ""}${steerDeg.toFixed(0)}°`, stMid, barY + barH + 15);

  // Speed and Gear readout
  const gear = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);
  const kmh = Math.round(sample.speed * 3.6);
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(gear, 255, 42);

  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "#00e699";
  ctx.fillText(`${kmh} km/h`, 255, 66);
}

// -------------------------------------------------------------
// 5. DIAGNOSTICS & SYSTEM HELPERS
// -------------------------------------------------------------
function paintReference(settings: Settings): void {
  const state = document.getElementById("refState");
  if (!state) return;
  state.textContent = settings.modules.referenceLaps
    ? "El interruptor está encendido, pero el API de vueltas de referencia todavía no está publicado. No se envía nada."
    : "Módulo apagado. Cuando el API exista, aquí se sube solo la vuelta recortada en JSON comprimido, nunca el .ibt entero, y solo si pesa menos de 2 MB.";
}

function paintChecklist(settings: Settings): void {
  const list = document.getElementById("checklist");
  if (!list) return;
  list.replaceChildren();
  for (const item of settings.checklist) {
    const li = document.createElement("li");
    li.className = "flex items-center gap-2 text-sm";
    const mark = document.createElement("span");
    mark.className = "font-mono text-r-accent text-xs";
    mark.textContent = item.done ? "[OK]" : "[ ]";
    li.append(mark, document.createTextNode(item.label));
    list.append(li);
  }
}

function paintTeam(settings: Settings): void {
  const team = document.getElementById("teamBody");
  const review = document.getElementById("reviewBody");
  if (team) {
    team.textContent = settings.modules.team
      ? "El interruptor está encendido, pero el token de escritorio no tiene un contrato público con la sala del paddock. No se muestra una lista de pilotos inventada."
      : "Presencia de pilotos: pendiente. La web ya tiene el paddock; MMT Sync no lo consulta hasta que el API lo documente para este token.";
  }
  if (review) {
    review.textContent = settings.modules.reviewAlerts
      ? "Avisos de revisión encendidos, sin endpoint todavía. No hay aprobaciones que mostrar."
      : "El aviso de «setup aprobado» está apagado hasta que exista el endpoint.";
  }
}

function paintFlags(settings: Settings): void {
  const host = document.getElementById("moduleFlags");
  if (!host) return;
  const rows: [keyof Settings["modules"], string][] = [
    ["overlays", "Overlays en pista"],
    ["analysis", "Análisis de .ibt"],
    ["weekly", "Vista de la semana"],
    ["strategy", "Estrategia y lista"],
    ["referenceLaps", "Vueltas de referencia (API)"],
    ["team", "Presencia del equipo (API)"],
    ["reviewAlerts", "Aviso de revisión (API)"],
  ];
  host.replaceChildren();
  for (const [key, label] of rows) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "flex items-center justify-between gap-3 text-sm text-left";
    button.dataset.module = key;
    const name = document.createElement("span");
    name.textContent = label;
    const state = document.createElement("span");
    state.className = "font-mono text-[11px] uppercase tracking-wider text-r-muted";
    state.textContent = settings.modules[key] ? "Encendido" : "Apagado";
    button.append(name, state);
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("mmt-module", { detail: key }));
    });
    host.append(button);
  }
}

export function fuelText(minutes: number, lapSeconds: number, perLap: number, tank: number, now: number): string {
  if (minutes <= 0 || lapSeconds <= 0 || perLap <= 0 || tank <= 0 || now < 0) {
    return "Revisa los números: tienen que ser mayores que cero.";
  }
  const laps = (minutes * 60) / lapSeconds;
  const finish = laps * perLap;
  const deficit = Math.max(0, finish - now);
  const stops = deficit <= 0 ? 0 : Math.ceil(deficit / tank);
  const add = Math.min(deficit, tank);
  const left = now / perLap;
  return `${laps.toLocaleString("es-ES", { maximumFractionDigits: 1 })} vueltas de carrera. Hacen falta ${finish.toLocaleString("es-ES", { maximumFractionDigits: 1 })} L. Con lo que hay a bordo salen ${left.toLocaleString("es-ES", { maximumFractionDigits: 1 })} vueltas. Paradas: ${stops}. En la próxima, añadir ${add.toLocaleString("es-ES", { maximumFractionDigits: 1 })} L. La pérdida en box no cambia estos litros.`;
}

export function paintConfigAnalysis(data: IracingAnalysis): void {
  const scoreNum = document.getElementById("configScoreNum");
  const scoreTitle = document.getElementById("configScoreTitle");
  const scoreDesc = document.getElementById("configScoreDesc");
  const countOpt = document.getElementById("configCountOpt");
  const countRec = document.getElementById("configCountRec");
  const countWarn = document.getElementById("configCountWarn");
  const list = document.getElementById("configItemsList");

  if (scoreNum) scoreNum.textContent = String(data.score);
  if (countOpt) countOpt.textContent = String(data.optimalCount);
  if (countRec) countRec.textContent = String(data.recommendedCount);
  if (countWarn) countWarn.textContent = String(data.warningCount);

  if (scoreTitle) {
    if (data.score >= 90) scoreTitle.textContent = "Excelente · Ajuste Pro de Competición";
    else if (data.score >= 70) scoreTitle.textContent = "Bueno · Recomendaciones Disponibles";
    else scoreTitle.textContent = "Mejorable · Parámetros Críticos Detectados";
  }

  if (scoreDesc) {
    scoreDesc.textContent = data.found
      ? `iRacing detectado en ${data.iracingDir}`
      : "No se detectaron archivos .ini locales de iRacing";
  }

  if (!list) return;
  list.replaceChildren();

  for (const item of data.items) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col gap-2";

    const top = document.createElement("div");
    top.className = "flex items-start justify-between gap-3";

    const titleGroup = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "font-display text-base uppercase text-r-text";
    h3.textContent = item.title;

    const meta = document.createElement("p");
    meta.className = "text-[11px] font-mono text-r-muted mt-0.5";
    meta.textContent = `${item.section} → ${item.key}`;
    titleGroup.append(h3, meta);

    const badge = document.createElement("span");
    badge.className = "px-2.5 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider shrink-0 font-bold ";
    if (item.status === "protected") {
      badge.className += "bg-sky-500/15 text-sky-300 border border-sky-500/40";
      badge.textContent = "Protegido / Inalterable";
    } else if (item.status === "optimal") {
      badge.className += "bg-r-accent/10 text-r-accent border border-r-accent/30";
      badge.textContent = "Óptimo";
    } else if (item.status === "recommended") {
      badge.className += "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";
      badge.textContent = "Recomendado";
    } else {
      badge.className += "bg-red-500/10 text-red-400 border border-red-500/30";
      badge.textContent = "Atención";
    }

    top.append(titleGroup, badge);

    const desc = document.createElement("p");
    desc.className = "text-xs text-r-muted leading-relaxed font-sans";
    desc.textContent = item.explanation;

    const values = document.createElement("div");
    values.className = "mt-1 flex flex-wrap items-center gap-4 text-xs font-mono bg-r-bg/50 p-2.5 rounded-xl border border-r-line/50";
    if (item.status === "protected") {
      values.innerHTML = `
        <div><span class="text-r-muted">Resolución & Pantalla:</span> <strong class="text-r-text">${item.currentValue}</strong></div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span><span class="text-sky-300 font-semibold">Bloqueada por seguridad (MMT nunca altera tu pantalla)</span></div>
      `;
    } else {
      values.innerHTML = `
        <div><span class="text-r-muted">Actual:</span> <strong class="text-r-text">${item.currentValue}</strong></div>
        <div><span class="text-r-muted">Recomendado:</span> <strong class="text-r-accent">${item.recommendedValue}</strong></div>
      `;
    }

    card.append(top, desc, values);
    list.append(card);
  }
}
