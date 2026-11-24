/**
 * Muntrume Motorsport — Multi-Sim & Staff Platform Badges with Official Game Logos.
 * Supports iRacing, Le Mans Ultimate, Assetto Corsa EVO, ACC, rFactor 2, Automobilista 2, F1, and Staff/Engineering.
 */

export type SimId =
  | "iracing"
  | "lmu"
  | "ac"
  | "ac_evo"
  | "acc"
  | "rf2"
  | "ams2"
  | "f1"
  | "staff";

export interface SimBadgeMeta {
  id: SimId;
  name: string;
  short: string;
  community: string;
  color: string;
  logoUrl: string;
  svg: string;
}

export const SIM_BADGES: Record<SimId, SimBadgeMeta> = {
  iracing: {
    id: "iracing",
    name: "iRacing",
    short: "iR",
    community: "m/iRacing",
    color: "#2563EB",
    logoUrl: "/assets/img/sims/iracing.png",
    svg: `<img src="/assets/img/sims/iracing.png" alt="iRacing" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  lmu: {
    id: "lmu",
    name: "Le Mans Ultimate",
    short: "LMU",
    community: "m/LeMansUltimate",
    color: "#E11D48",
    logoUrl: "/assets/img/sims/lmu.png",
    svg: `<img src="/assets/img/sims/lmu.png" alt="Le Mans Ultimate" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  ac: {
    id: "ac",
    name: "Assetto Corsa",
    short: "AC",
    community: "m/AssettoCorsa",
    color: "#E11D48",
    logoUrl: "/assets/img/sims/ac.png",
    svg: `<img src="/assets/img/sims/ac.png" alt="Assetto Corsa" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  ac_evo: {
    id: "ac_evo",
    name: "Assetto Corsa EVO",
    short: "AC EVO",
    community: "m/AssettoCorsaEVO",
    color: "#DC2626",
    logoUrl: "/assets/img/sims/ac_evo.png",
    svg: `<img src="/assets/img/sims/ac_evo.png" alt="Assetto Corsa EVO" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  acc: {
    id: "acc",
    name: "Assetto Corsa Competizione",
    short: "ACC",
    community: "m/ACC",
    color: "#EF4444",
    logoUrl: "/assets/img/sims/acc.png",
    svg: `<img src="/assets/img/sims/acc.png" alt="Assetto Corsa Competizione" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  rf2: {
    id: "rf2",
    name: "rFactor 2",
    short: "rF2",
    community: "m/rFactor2",
    color: "#0EA5E9",
    logoUrl: "/assets/img/sims/rf2.png",
    svg: `<img src="/assets/img/sims/rf2.png" alt="rFactor 2" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  ams2: {
    id: "ams2",
    name: "Automobilista 2",
    short: "AMS2",
    community: "m/AMS2",
    color: "#F59E0B",
    logoUrl: "/assets/img/sims/ams2.png",
    svg: `<img src="/assets/img/sims/ams2.png" alt="Automobilista 2" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  f1: {
    id: "f1",
    name: "F1",
    short: "F1",
    community: "m/F1",
    color: "#E10600",
    logoUrl: "/assets/img/sims/f1.png",
    svg: `<img src="/assets/img/sims/f1.png" alt="F1" class="sim-real-logo" loading="lazy" decoding="async" />`,
  },
  staff: {
    id: "staff",
    name: "Staff & Ingeniería",
    short: "STAFF",
    community: "m/Ingenieria",
    color: "#10B981",
    logoUrl: "/assets/img/logo-64.webp",
    svg: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true"><path d="M4 13a8 8 0 0 1 16 0" stroke="#34D399" stroke-width="2" stroke-linecap="round"/><rect x="2.5" y="12.5" width="3.8" height="6" rx="1.6" fill="#10B981"/><rect x="17.7" y="12.5" width="3.8" height="6" rx="1.6" fill="#10B981"/><path d="M18 18.5c0 1.8-1.4 3-3.5 3H12" stroke="#34D399" stroke-width="1.8" stroke-linecap="round"/><circle cx="11.5" cy="21.5" r="1.3" fill="#FFFFFF"/></svg>`,
  },
};

export function resolveSimBadges(sims?: string[], memberType?: "driver" | "staff", hasIracing?: boolean): SimBadgeMeta[] {
  const list = Array.isArray(sims) && sims.length > 0
    ? sims
    : (memberType === "staff" ? ["staff"] : hasIracing ? ["iracing"] : ["staff"]);
  return list
    .map((id) => SIM_BADGES[id as SimId])
    .filter((b): b is SimBadgeMeta => Boolean(b));
}
