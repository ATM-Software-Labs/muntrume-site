import type { LibraryItem } from "./types";
import { formatCarName } from "./main";

export interface SetupProfile {
  title: string;
  category: string;
  carName: string;
  purpose: string;
  downforce: string;
  downforceLevel: number; // 1-5
  stability: "SAFE" | "BALANCED" | "AGGRESSIVE" | "WET";
  fuelTarget: string;
  tirePressureTarget: string;
  brakeBiasEst: string;
  diffPreloadEst: string;
  drivingTips: string[];
}

export interface LapTimeEstimate {
  iRating: number;
  iRatingBracket: string;
  qualyTime: string;
  qualySec: number;
  racePace: string;
  raceSec: number;
  deltaVsAlien: string;
  safeSetup: {
    consistencyPct: number;
    avgPace: string;
    incidentRiskPct: number;
    recommendation: string;
  };
  aggressiveSetup: {
    consistencyPct: number;
    avgPace: string;
    incidentRiskPct: number;
    recommendation: string;
  };
  verdict: string;
}

// Track Base Benchmarks (GT3 Alien Baseline in seconds)
const TRACK_BENCHMARKS: Record<string, number> = {
  spa: 135.2, // 2:15.200
  monza: 104.5, // 1:44.500
  sebring: 118.8, // 1:58.800
  nurburgring: 478.0, // 7:58.000 VLN
  watkins: 102.8, // 1:42.800
  indianapolis: 81.5, // 1:21.500
  lemans: 232.0, // 3:52.000
  fuji: 95.8, // 1:35.800
  suzuka: 119.5, // 1:59.500
  silverstone: 117.2, // 1:57.200
  barcelona: 102.5, // 1:42.500
  catalunya: 102.5,
  redbullring: 87.5, // 1:27.500
  austria: 87.5,
  longbeach: 78.4, // 1:18.400
  cota: 124.0, // 2:04.000
  misano: 92.5, // 1:32.500
  bathurst: 120.2, // 2:00.200
  mountpanorama: 120.2,
  roadamerica: 121.5, // 2:01.500
  roadatlanta: 76.5, // 1:16.500
  zolder: 87.8, // 1:27.800
  hockenheim: 98.2, // 1:38.200
  imola: 100.5, // 1:40.500
};

export function getSetupProfile(item: LibraryItem): SetupProfile {
  const fn = item.filename.toLowerCase();
  const track = item.track.toLowerCase();
  const carName = formatCarName(item.carFolder || item.car);

  let stability: SetupProfile["stability"] = "BALANCED";
  let purpose = "Carrera Sprint (20-30 min)";
  let fuelTarget = "48 Litros (Consumo: ~3.1 L/vuelta)";
  let tirePressureTarget = "160 kPa (23.2 psi objetivo en caliente)";
  let downforce = "Media-Alta (Alerón P4/P5)";
  let downforceLevel = 4;
  let brakeBiasEst = "53.5%";
  let diffPreloadEst = "60 Nm";

  if (fn.includes("wet") || fn.includes("_w.") || fn.includes("_w_")) {
    stability = "WET";
    purpose = "Condiciones de Lluvia / Asfalto Mojado";
    fuelTarget = "55 Litros (Ritmo de lluvia)";
    tirePressureTarget = "175 kPa (25.4 psi para evacuar agua)";
    downforce = "Máxima Carga (Alerón P6/P8 + Barras blandas)";
    downforceLevel = 5;
    brakeBiasEst = "55.0% (Reparto adelantado para evitar bloqueos traseros)";
    diffPreloadEst = "90 Nm (Tracción progresiva en agua)";
  } else if (fn.includes("safe")) {
    stability = "SAFE";
    purpose = "Carrera Principal / Máxima Consistencia";
    fuelTarget = "60 Litros (45 min con margen)";
    tirePressureTarget = "160 kPa (23.2 psi estable)";
    downforce = "Alta Estabilidad (Alerón P5 + Cero snap oversteer)";
    downforceLevel = 4;
    brakeBiasEst = "54.0% (Frenada estable en apoyo)";
    diffPreloadEst = "75 Nm (Control de tracción suave)";
  } else if (fn.includes("endu") || fn.includes("end")) {
    stability = "SAFE";
    purpose = "Resistencia / Stint Completo (60+ min)";
    fuelTarget = "Depósito Lleno (104 - 110 L)";
    tirePressureTarget = "158 - 162 kPa (Control de degradación)";
    downforce = "Balance Óptimo Aero/Drag (Stints largos)";
    downforceLevel = 3;
    brakeBiasEst = "53.8%";
    diffPreloadEst = "70 Nm";
  } else if (fn.includes("q_") || fn.includes("_q.") || fn.includes("qualy") || fn.includes("quali")) {
    stability = "AGGRESSIVE";
    purpose = "Clasificación (Vuelta Rápida Aislada)";
    fuelTarget = "12 - 15 Litros (3 vueltas de ataque)";
    tirePressureTarget = "162 kPa (Pico de agarre en vuelta 2)";
    downforce = "Low Drag / Rotación Agresiva (Alerón P2/P3)";
    downforceLevel = 2;
    brakeBiasEst = "52.0% (Rotación máxima en vértice)";
    diffPreloadEst = "45 Nm (Entrada rápida)";
  }

  // Adjust for high-speed tracks
  if (track.includes("monza") || track.includes("lemans") || track.includes("daytona")) {
    downforce = "Low Drag / Alta Velocidad Punta (Alerón P1/P2)";
    downforceLevel = 1;
  }

  const drivingTips: string[] = [];
  if (stability === "SAFE") {
    drivingTips.push("Ataca los pianos interiores con confianza; las barras están calibradas para absorber bordillos sin desestabilizar.");
    drivingTips.push("Permite pisar el acelerador con decisión a la salida de curvas lentas sin temor a latigazos de par.");
  } else if (stability === "AGGRESSIVE") {
    drivingTips.push("Aprovecha el trail-braking profundo; el reparto retrasado gira el morro directamente hacia el ápice.");
    drivingTips.push("Gestiona el pedal de acelerador con suavidad en primera y segunda marcha para no sobrecalentar el tren trasero.");
  } else if (stability === "WET") {
    drivingTips.push("Evita la trazada engomada tradicional en frenada; busca asfalto rugoso por el exterior.");
    drivingTips.push("Suaviza las reducciones de marcha y activa el mapa de motor para asfalto mojado.");
  } else {
    drivingTips.push("Excelente equilibrio entre velocidad punta y agarre en curva media.");
    drivingTips.push("Vigila la presión delantera derecha en stints superiores a 25 vueltas.");
  }

  return {
    title: item.filename,
    category: item.season,
    carName,
    purpose,
    downforce,
    downforceLevel,
    stability,
    fuelTarget,
    tirePressureTarget,
    brakeBiasEst,
    diffPreloadEst,
    drivingTips,
  };
}

export function formatSecondsToLap(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const wholeSec = Math.floor(secs);
  const ms = Math.floor((secs - wholeSec) * 1000);
  return `${mins}:${wholeSec.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export function estimateLapTimeAndConsistency(track: string, car: string, iRating: number): LapTimeEstimate {
  // Find matching baseline track
  const tClean = track.toLowerCase().replace(/[^a-z]/g, "");
  let baseSec = 118.0; // fallback default
  for (const [k, sec] of Object.entries(TRACK_BENCHMARKS)) {
    if (tClean.includes(k) || k.includes(tClean)) {
      baseSec = sec;
      break;
    }
  }

  // Multiply based on car class
  const cClean = car.toLowerCase();
  let carFactor = 1.0;
  if (cClean.includes("gtp") || cClean.includes("lmdh")) carFactor = 0.88; // GTP is ~12% faster than GT3
  else if (cClean.includes("p217") || cClean.includes("lmp2")) carFactor = 0.92;
  else if (cClean.includes("gt4")) carFactor = 1.07;
  else if (cClean.includes("tcr")) carFactor = 1.11;
  else if (cClean.includes("mx5")) carFactor = 1.18;
  else if (cClean.includes("formula") || cClean.includes("sf23") || cClean.includes("f3")) carFactor = 0.86;

  const alienQualySec = baseSec * carFactor;

  // Driver skill delta based on iRating
  // 6000+ iR: +0.2s - +0.5s
  // 3500 iR: +1.2s - +1.8s
  // 2000 iR: +2.8s - +3.5s
  // 1200 iR: +5.0s - +6.5s
  let deltaSec = 0;
  let bracket = "";
  if (iRating >= 5000) {
    deltaSec = 0.35;
    bracket = "Alien / Esports (Top Split)";
  } else if (iRating >= 3500) {
    deltaSec = 1.45;
    bracket = "Pro / Avanzado (Split 1)";
  } else if (iRating >= 2500) {
    deltaSec = 2.40;
    bracket = "Competitivo (Split 1 / 2)";
  } else if (iRating >= 1600) {
    deltaSec = 3.60;
    bracket = "Club Driver (Split 2 / 3)";
  } else {
    deltaSec = 5.80;
    bracket = "Rookie / Amateur (Split 3+)";
  }

  const driverQualySec = alienQualySec + deltaSec;
  const driverRaceSec = driverQualySec + (baseSec > 150 ? 1.6 : 0.85);

  // Consistency & Risk modeling
  let safeCons = 96.8;
  let aggCons = 86.4;
  let safeRisk = 3;
  let aggRisk = 26;

  if (iRating >= 4000) {
    safeCons = 98.4;
    aggCons = 94.2;
    safeRisk = 1;
    aggRisk = 9;
  } else if (iRating < 1600) {
    safeCons = 94.0;
    aggCons = 76.5;
    safeRisk = 7;
    aggRisk = 48;
  }

  const safeAvgPaceSec = driverRaceSec + 0.15;
  // Aggressive pace in theory is faster on peak, but in traffic with mistakes it degrades
  const aggAvgPaceSec = iRating >= 3500 ? driverRaceSec - 0.18 : driverRaceSec + 0.45;

  let verdict = "";
  if (iRating < 3000) {
    verdict = `Para tu nivel de iRating (${iRating.toLocaleString()} iR), te recomendamos competir con el setup SAFE. Ganarás un promedio de +0.42s por vuelta en tandas largas gracias al control de tracción y consistencia del 96%, minimizando incidentes (0x/1x) y maximizando tu ganancia neta de iRating (+35 a +65 iR por carrera).`;
  } else {
    verdict = `Con tu nivel de iRating (${iRating.toLocaleString()} iR), tienes el control para extraer las 2 décimas extra del setup AGRESIVO en clasificación. Para la carrera, evalúa el setup SAFE si la degradación de pista o la temperatura de asfalto supera los 38°C.`;
  }

  return {
    iRating,
    iRatingBracket: bracket,
    qualyTime: formatSecondsToLap(driverQualySec),
    qualySec: driverQualySec,
    racePace: formatSecondsToLap(driverRaceSec),
    raceSec: driverRaceSec,
    deltaVsAlien: `+${deltaSec.toFixed(2)}s`,
    safeSetup: {
      consistencyPct: safeCons,
      avgPace: formatSecondsToLap(safeAvgPaceSec),
      incidentRiskPct: safeRisk,
      recommendation: "Máxima ganancia de iRating en carrera",
    },
    aggressiveSetup: {
      consistencyPct: aggCons,
      avgPace: formatSecondsToLap(aggAvgPaceSec),
      incidentRiskPct: aggRisk,
      recommendation: iRating >= 3500 ? "Recomendado para Qualy y Top Split" : "Alto riesgo de trompo/salida",
    },
    verdict,
  };
}
