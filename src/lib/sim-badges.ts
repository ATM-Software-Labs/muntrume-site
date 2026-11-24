/**
 * Muntrume Motorsport — Multi-Sim & Staff Platform Badges (minimalist inline SVGs).
 * Supports iRacing, Le Mans Ultimate, Assetto Corsa EVO, ACC, rFactor 2, Automobilista 2, F1 25, and Staff/Engineering.
 */

export type SimId =
  | "iracing"
  | "lmu"
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
  color: string;
  svg: string;
}

export const SIM_BADGES: Record<SimId, SimBadgeMeta> = {
  iracing: {
    id: "iracing",
    name: "iRacing",
    short: "iR",
    color: "#2563EB",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#2563EB"/><circle cx="7.5" cy="7.2" r="1.5" fill="#EF4444"/><path d="M6.3 10.2h2.4v7.6H6.3zM10.8 7h4.8c2.2 0 3.6 1.2 3.6 3.2 0 1.4-.7 2.4-2 2.8l2.2 4.8h-2.6l-1.9-4.3h-1.7v4.3h-2.4V7zm2.4 2v2.7h2.1c1 0 1.5-.5 1.5-1.35S16.3 9 15.3 9h-2.1z" fill="#FFFFFF"/></svg>`,
  },
  lmu: {
    id: "lmu",
    name: "Le Mans Ultimate",
    short: "LMU",
    color: "#E11D48",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#0F172A" stroke="#E11D48" stroke-width="1.6"/><path d="M5.5 7.5h2.2v7.2h3.4v2H5.5V7.5zm6.8 0h2.4l1.5 4.2 1.5-4.2h2.4v9.2h-2v-5.7l-1.5 4h-.8l-1.5-4v5.7h-2V7.5z" fill="#FFFFFF"/><rect x="5.5" y="17.8" width="13" height="1.5" rx="0.7" fill="#E11D48"/></svg>`,
  },
  ac_evo: {
    id: "ac_evo",
    name: "Assetto Corsa EVO",
    short: "AC EVO",
    color: "#DC2626",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#DC2626"/><path d="M9.6 7L5 17h2.4l.9-2.2h3.4l.9 2.2H15L10.4 7h-.8zm-.6 5.9l1-2.6 1 2.6H9zM15.2 7h4.2v1.9h-2.1v2h1.9v1.8h-1.9v2.4h2.2V17h-4.3V7z" fill="#FFFFFF"/></svg>`,
  },
  acc: {
    id: "acc",
    name: "Assetto Corsa Competizione",
    short: "ACC",
    color: "#EF4444",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#18181B" stroke="#EF4444" stroke-width="1.6"/><path d="M7.8 7.5L4.4 16.5h2.1l.6-1.8h2.6l.6 1.8h2.1L9 7.5H7.8zm-.2 5.4l.8-2.4.8 2.4H7.6zm9.8-3.6c-1.8 0-3 1.1-3 2.7s1.2 2.7 3 2.7c.9 0 1.6-.3 2.1-.8v1.9c-.6.4-1.4.6-2.3.6-2.9 0-4.9-1.9-4.9-4.4s2-4.4 4.9-4.4c.9 0 1.7.2 2.3.6v1.9c-.5-.5-1.2-.8-2.1-.8z" fill="#FFFFFF"/></svg>`,
  },
  rf2: {
    id: "rf2",
    name: "rFactor 2",
    short: "rF2",
    color: "#0EA5E9",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#0284C7"/><path d="M5.5 16.5V9.5h2v1.2c.5-.8 1.2-1.3 2.2-1.3h.4v2h-.6c-1.2 0-1.9.7-1.9 1.9v3.2h-2.1zm6-9h5v1.9h-2.8v2h2.4v1.8h-2.4v3.3h-2.2V7.5z" fill="#FFFFFF"/></svg>`,
  },
  ams2: {
    id: "ams2",
    name: "Automobilista 2",
    short: "AMS2",
    color: "#F59E0B",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#0F172A" stroke="#F59E0B" stroke-width="1.6"/><path d="M12 5.5l6 12h-2.7l-1.1-2.4H9.8l-1.1 2.4H6l6-12zm0 4.3l-1.3 3.1h2.6L12 9.8z" fill="#F59E0B"/></svg>`,
  },
  f1: {
    id: "f1",
    name: "F1 25",
    short: "F1",
    color: "#E10600",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#E10600"/><path d="M5 15.5l3.8-7h6.7l-1.1 2.1H10l-.8 1.5h4.1l-1 1.9H8.2l-.8 1.5H5zm10.2 0l3.7-7h2.2l-3.7 7h-2.2z" fill="#FFFFFF"/></svg>`,
  },
  staff: {
    id: "staff",
    name: "Staff & Ingeniería",
    short: "STAFF",
    color: "#10B981",
    svg: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="#065F46" stroke="#10B981" stroke-width="1.5"/><path d="M12 6.5l1.7 3.4 3.8.6-2.7 2.6.6 3.8L12 15.1l-3.4 1.8.6-3.8-2.7-2.6 3.8-.6L12 6.5z" fill="#34D399"/></svg>`,
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
