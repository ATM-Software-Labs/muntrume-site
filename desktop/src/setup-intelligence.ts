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
