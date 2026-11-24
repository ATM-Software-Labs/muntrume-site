/**
 * Muntrume Motorsport — GitHub-Style Driver & Staff Achievements System.
 * Automatically unlocks tiered hexagonal/medal badges from verified telemetry, roster role, and multi-sim activity.
 */

import type { Piloto } from "./pilotos";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface DriverAchievement {
  id: string;
  title: string;
  desc: string;
  tier: AchievementTier;
  tierLabel: string;
  iconSvg: string;
  unlocked: boolean;
  progressPct?: number;
  progressLabel?: string;
}

const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: "Bronce",
  silver: "Plata",
  gold: "Oro",
  platinum: "Platino",
};

export function computeDriverAchievements(
  driver: Piloto,
  irating: number | null,
  sr: number | null,
  classLabel: string | null,
): { unlocked: DriverAchievement[]; nextMilestones: DriverAchievement[] } {
  const hours = driver.totalTrackHours || (driver.topTracks || []).reduce((a, t) => a + t.hours, 0);
  const cars = driver.topCars || [];
  const tracks = driver.topTracks || [];
  const sims = driver.sims || (driver.cust_id ? ["iracing"] : ["staff"]);
  const hasEnduranceTracks = tracks.some((t) => /le mans|daytona|spa|nürburgring|nurburgring|sebring/i.test(t.name));
  const gt3Count = cars.filter((c) => /gt3/i.test(c.name) && c.laps >= 300).length;

  const all: DriverAchievement[] = [];

  // 1. Founder / Staff / Official Roster
  if (driver.badge === "FOUNDER") {
    all.push({
      id: "founder",
      title: "Fundador MMT",
      desc: "Creador y arquitecto de Muntrume Motorsport & MMT Sync.",
      tier: "platinum",
      tierLabel: TIER_LABELS.platinum,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M4 17l2-9 6 4 6-4 2 9H4z" fill="currentColor" opacity=".92"/><circle cx="12" cy="5.5" r="1.7" fill="currentColor"/></svg>`,
    });
  } else if (driver.memberType === "staff") {
    all.push({
      id: "staff-core",
      title: "Staff & Ingeniería",
      desc: "Miembro oficial del equipo técnico, media o gestión de Muntrume.",
      tier: "gold",
      tierLabel: TIER_LABELS.gold,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    });
  } else {
    all.push({
      id: "official-driver",
      title: "Piloto Oficial MMT",
      desc: `Integrante de la plantilla oficial desde ${driver.memberSince || "2024"}.`,
      tier: "silver",
      tierLabel: TIER_LABELS.silver,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
    });
  }

  // 2. Track Hours Tier (100h / 500h / 1000h)
  if (hours >= 1000) {
    all.push({
      id: "hours-1000",
      title: "Leyenda 1000h",
      desc: `${Math.round(hours)} h acumuladas en pista verificadas en Garage 61.`,
      tier: "platinum",
      tierLabel: TIER_LABELS.platinum,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
    });
  } else if (hours >= 400) {
    all.push({
      id: "hours-500",
      title: "Veterano Resistencia",
      desc: `${Math.round(hours)} h en pista en eventos Sports Car.`,
      tier: "gold",
      tierLabel: TIER_LABELS.gold,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
    });
  } else if (hours >= 100) {
    all.push({
      id: "hours-100",
      title: "Centurión de Pista",
      desc: `${Math.round(hours)} h de telemetría registrada.`,
      tier: "silver",
      tierLabel: TIER_LABELS.silver,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
    });
  }

  // 3. Clean Racer (SR >= 3.0 or Class A)
  if ((sr !== null && sr >= 3.0) || (classLabel && /class\s*a/i.test(classLabel))) {
    all.push({
      id: "clean-racer",
      title: "Piloto Limpio",
      desc: `Licencia ${classLabel || "A"} con Safety Rating ${sr ? sr.toFixed(1) : "3.0+"} en carrera.`,
      tier: sr !== null && sr >= 4.0 ? "platinum" : "gold",
      tierLabel: sr !== null && sr >= 4.0 ? TIER_LABELS.platinum : TIER_LABELS.gold,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 15.5l-5.2 2.7 1-5.8-4.3-4.2 5.9-.9L12 2z"/></svg>`,
    });
  }

  // 4. Top Split Pace (iRating >= 2500 / 3000)
  if (irating !== null && irating >= 2500) {
    all.push({
      id: "top-split",
      title: irating >= 3000 ? "Top Split 3K+" : "Ritmo Split Alto",
      desc: `Nivel competitivo de ${(irating / 1000).toFixed(1)}k iRating en Sports Car.`,
      tier: irating >= 4000 ? "platinum" : irating >= 3000 ? "gold" : "silver",
      tierLabel: irating >= 4000 ? TIER_LABELS.platinum : irating >= 3000 ? TIER_LABELS.gold : TIER_LABELS.silver,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>`,
    });
  }

  // 5. GT3 Master (3+ GT3s with >= 300 laps)
  if (gt3Count >= 3) {
    all.push({
      id: "gt3-master",
      title: "Maestro GT3",
      desc: `Dominio verificado en ${gt3Count} chasis GT3 distintos.`,
      tier: gt3Count >= 5 ? "gold" : "silver",
      tierLabel: gt3Count >= 5 ? TIER_LABELS.gold : TIER_LABELS.silver,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14l1-5-3-4H7l-3 4 1 5z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/></svg>`,
    });
  }

  // 6. 24H Endurance Specialist
  if (hasEnduranceTracks) {
    all.push({
      id: "endurance-24h",
      title: "Especialista 24H",
      desc: "Experiencia acumulada en Le Mans, Daytona, Spa o Nürburgring.",
      tier: "gold",
      tierLabel: TIER_LABELS.gold,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4a2 2 0 0 1 0-4h2m12 4h2a2 2 0 0 0 0-4h-2M6 4h12v6a6 6 0 0 1-12 0V4zM9 21h6m-3-5v5"/></svg>`,
    });
  }

  // 7. Multi-Sim Driver
  if (sims.length >= 2) {
    all.push({
      id: "multi-sim",
      title: "Piloto Multi-Sim",
      desc: `Activo en ${sims.length} plataformas de simulación.`,
      tier: sims.length >= 3 ? "gold" : "silver",
      tierLabel: sims.length >= 3 ? TIER_LABELS.gold : TIER_LABELS.silver,
      unlocked: true,
      iconSvg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
    });
  }

  // Next locked milestones to motivate drivers!
  const nextMilestones: DriverAchievement[] = [];
  if (hours > 0 && hours < 1000) {
    const target = hours < 100 ? 100 : hours < 500 ? 500 : 1000;
    nextMilestones.push({
      id: `next-hours-${target}`,
      title: target === 1000 ? "Leyenda 1000h" : target === 500 ? "Veterano 500h" : "Centurión 100h",
      desc: `Alcanza ${target} h en pista verificadas.`,
      tier: target === 1000 ? "platinum" : "gold",
      tierLabel: target === 1000 ? TIER_LABELS.platinum : TIER_LABELS.gold,
      unlocked: false,
      progressPct: Math.min(99, Math.round((hours / target) * 100)),
      progressLabel: `${Math.round(hours)} / ${target} h`,
      iconSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`,
    });
  }
  if (irating !== null && irating < 4000) {
    const target = irating < 2000 ? 2000 : irating < 3000 ? 3000 : 4000;
    nextMilestones.push({
      id: `next-ir-${target}`,
      title: `Élite ${(target / 1000).toFixed(0)}K iRating`,
      desc: `Supera los ${target.toLocaleString("es-ES")} iRating en Sports Car.`,
      tier: target >= 4000 ? "platinum" : "gold",
      tierLabel: target >= 4000 ? TIER_LABELS.platinum : TIER_LABELS.gold,
      unlocked: false,
      progressPct: Math.min(99, Math.round((irating / target) * 100)),
      progressLabel: `${irating.toLocaleString("es-ES")} / ${target.toLocaleString("es-ES")} iR`,
      iconSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>`,
    });
  }
  if (sims.length < 2) {
    nextMilestones.push({
      id: "next-multisim",
      title: "Piloto Multi-Sim",
      desc: "Compite en 2+ simuladores (iRacing, Le Mans Ultimate, AC EVO…).",
      tier: "silver",
      tierLabel: TIER_LABELS.silver,
      unlocked: false,
      progressPct: 50,
      progressLabel: "1 / 2 sims",
      iconSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
    });
  }

  return { unlocked: all, nextMilestones: nextMilestones.slice(0, 3) };
}
