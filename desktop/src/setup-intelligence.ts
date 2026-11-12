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
  let purpose = "Setup";
  const fuelTarget = "no se puede determinar";
  const tirePressureTarget = "no se puede determinar";
  const downforce = "no se puede determinar";
  const downforceLevel = 0;
  const brakeBiasEst = "no se puede determinar";
  const diffPreloadEst = "no se puede determinar";
  const drivingTips: string[] = [];
  void track;

  if (fn.includes("wet") || fn.includes("_w.") || fn.includes("_w_")) {
    stability = "WET";
    purpose = "Lluvia";
  } else if (fn.includes("safe")) {
    stability = "SAFE";
    purpose = "Carrera";
  } else if (fn.includes("endu") || fn.includes("end")) {
    stability = "SAFE";
    purpose = "Resistencia";
  } else if (fn.includes("q_") || fn.includes("_q.") || fn.includes("qualy") || fn.includes("quali")) {
    stability = "AGGRESSIVE";
    purpose = "Clasificación";
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
