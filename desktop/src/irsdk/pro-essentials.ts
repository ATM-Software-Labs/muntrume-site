/**
 * MMT Sync — Open-Source Baseline Pro-Free Overlays (v0.6.7)
 * 4 essential widgets inspired by open-source iRacing HUD standards (irdashies / iOverlay):
 *   1. Tempest Weather & Track Conditions (Track/Air °C, Wetness, Rain %, Wind)
 *   2. Blind Spot / Spotter Bars (Left / Right / 3-Wide visual proximity bars)
 *   3. Session Info & Incident Counter Bar (Session, Time/Laps, SOF, Inc x/Limit)
 *   4. In-Car Electronics / Black Box (Brake Bias, TC, ABS, Fuel Map)
 */

import type { IrsdkComputedState } from "./types";
import { estimateLiveIRating } from "./irating-calc";

const lastHtml = new WeakMap<HTMLElement, string>();
function patchHtml(el: HTMLElement, html: string): void {
  if (lastHtml.get(el) === html) return;
  lastHtml.set(el, html);
  el.innerHTML = html;
}

const WETNESS_LABELS: Record<number, { text: string; cls: string }> = {
  0: { text: "DRY", cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/35" },
  1: { text: "DRY", cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/35" },
  2: { text: "MOSTLY DRY", cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/35" },
  3: { text: "LIGHT DAMP", cls: "text-sky-300 bg-sky-500/15 border-sky-500/35" },
  4: { text: "DAMP", cls: "text-sky-300 bg-sky-500/20 border-sky-400/45" },
  5: { text: "MOD WET", cls: "text-blue-300 bg-blue-500/20 border-blue-400/45" },
  6: { text: "WET", cls: "text-blue-200 bg-blue-600/30 border-blue-400/55" },
  7: { text: "HEAVY WET", cls: "text-indigo-200 bg-indigo-600/35 border-indigo-400/60" },
};

function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0 || sec > 86400 * 7) return "--:--";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 1) Tempest Weather & Track Conditions
 */
export function renderWeatherWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const f = state?.frame;
  const trackC = typeof f?.trackTempC === "number" && Number.isFinite(f.trackTempC) ? f.trackTempC : 31.4;
  const airC = typeof f?.airTempC === "number" && Number.isFinite(f.airTempC) ? f.airTempC : 22.8;
  const wind = typeof f?.windKmh === "number" && Number.isFinite(f.windKmh) ? f.windKmh : 9;
  const rainPct = typeof f?.precipitationPct === "number" && Number.isFinite(f.precipitationPct)
    ? Math.round(f.precipitationPct <= 1 ? f.precipitationPct * 100 : f.precipitationPct)
    : 0;
  const wetIdx = typeof f?.trackWetness === "number" ? Math.max(0, Math.min(7, Math.round(f.trackWetness))) : 1;
  const wet = WETNESS_LABELS[wetIdx] || WETNESS_LABELS[1];

  const html = `
    <div class="flex items-center gap-2 px-2.5 py-1.5 font-mono text-[10.5px] tabular-nums whitespace-nowrap">
      <span class="px-1.5 py-0.5 rounded-[3px] border text-[9px] font-black tracking-wider ${wet.cls}">${wet.text}</span>
      <span class="text-white/60">TRK <strong class="text-amber-300">${trackC.toFixed(1)}°C</strong></span>
      <span class="text-white/25">|</span>
      <span class="text-white/60">AIR <strong class="text-white">${airC.toFixed(1)}°C</strong></span>
      <span class="text-white/25">|</span>
      <span class="text-white/60">RAIN <strong class="${rainPct > 0 ? "text-sky-300" : "text-white/80"}">${rainPct}%</strong></span>
      <span class="text-white/25">|</span>
      <span class="text-white/60">WIND <strong class="text-white/85">${Math.round(wind)} km/h</strong></span>
    </div>
  `;
  patchHtml(container, html);
}

/**
 * 2) Blind Spot / Spotter Bars (carLeftRight: 2=Left, 3=Right, 4=3-Wide, 5=2 Left, 6=2 Right)
 */
export function renderSpotterWidget(container: HTMLElement, state: IrsdkComputedState | null, isPreview = false): void {
  const clr = state?.frame?.carLeftRight ?? 0;
  const leftOn = clr === 2 || clr === 4 || clr === 5;
  const rightOn = clr === 3 || clr === 4 || clr === 6;
  const threeWide = clr === 4;

  const show = leftOn || rightOn || isPreview;
  if (!show) {
    patchHtml(container, "");
    return;
  }

  const label = threeWide
    ? "3-WIDE"
    : clr === 5
      ? "2 LEFT"
      : clr === 6
        ? "2 RIGHT"
        : leftOn
          ? "CAR LEFT"
          : rightOn
            ? "CAR RIGHT"
            : "SPOTTER OK";

  const leftCls = leftOn
    ? (threeWide ? "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.85)]" : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]")
    : "bg-white/10";
  const rightCls = rightOn
    ? (threeWide ? "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.85)]" : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]")
    : "bg-white/10";
  const textCls = threeWide
    ? "text-rose-300"
    : (leftOn || rightOn)
      ? "text-amber-300"
      : "text-white/50";

  const html = `
    <div class="flex items-center justify-between gap-3 px-2 py-1 rounded-[4px] border border-white/10 bg-[#090b0f]/80 font-mono text-[10px] font-black tracking-widest uppercase w-[240px]">
      <span class="w-2.5 h-8 rounded-full transition-all ${leftCls}"></span>
      <span class="${textCls}">${label}</span>
      <span class="w-2.5 h-8 rounded-full transition-all ${rightCls}"></span>
    </div>
  `;
  patchHtml(container, html);
}

/**
 * 3) Session Info & Incident Counter Bar
 */
export function renderSessionBarWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const f = state?.frame;
  const s = state?.session;
  const sessionType = (s?.sessionType || "RACE").toUpperCase();
  const trackName = s?.weekendInfo?.trackName || "Circuit de Spa-Francorchamps";
  const timeRem = fmtClock(f?.sessionTimeRemain ?? 2580);
  const lapsRem = typeof f?.sessionLapsRemainEx === "number" && f.sessionLapsRemainEx > 0 && f.sessionLapsRemainEx < 30000
    ? `${Math.ceil(f.sessionLapsRemainEx)}L`
    : "";
  const inc = f?.playerCarMyIncidentCount ?? 0;
  const incLim = s?.weekendInfo?.incidentLimit && s.weekendInfo.incidentLimit > 0 ? s.weekendInfo.incidentLimit : 17;
  const incRatio = inc / incLim;
  const incCls = incRatio >= 0.75 ? "text-rose-400 font-black" : incRatio >= 0.45 ? "text-amber-300 font-bold" : "text-emerald-400 font-bold";

  let sof = 0;
  let irDelta: number | null = null;
  try {
    const est = estimateLiveIRating(state);
    if (est) {
      sof = est.sof;
      irDelta = est.delta;
    }
  } catch {
    sof = 0;
  }
  const sofLabel = sof > 0 ? `${(sof / 1000).toFixed(1)}k` : "2.8k";
  const irDeltaHtml = irDelta !== null
    ? `<span class="text-white/25">|</span><span class="${irDelta >= 0 ? "text-emerald-400" : "text-rose-400"} font-bold">${irDelta >= 0 ? "+" : ""}${Math.round(irDelta)} iR</span>`
    : "";

  const html = `
    <div class="flex items-center gap-2 px-2.5 py-1.5 font-mono text-[10.5px] tabular-nums whitespace-nowrap">
      <span class="px-1.5 py-0.5 rounded-[3px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black tracking-wider">${sessionType}</span>
      <span class="text-white font-bold max-w-[160px] truncate">${trackName}</span>
      <span class="text-white/25">|</span>
      <span class="text-white/85">${timeRem}${lapsRem ? ` (${lapsRem})` : ""}</span>
      <span class="text-white/25">|</span>
      <span class="text-white/60">SOF <strong class="text-sky-300">${sofLabel}</strong></span>
      ${irDeltaHtml}
      <span class="text-white/25">|</span>
      <span class="text-white/60">INC <span class="${incCls}">${inc}x/${incLim}x</span></span>
    </div>
  `;
  patchHtml(container, html);
}

/**
 * 4) In-Car Electronics / Black Box (BB / TC / ABS / MAP)
 */
export function renderElectronicsWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const f = state?.frame;
  const bb = typeof f?.dcBrakeBias === "number" && f.dcBrakeBias > 0 ? `${f.dcBrakeBias.toFixed(1)}%` : "54.2%";
  const tc = typeof f?.dcTractionControl === "number" ? String(Math.round(f.dcTractionControl)) : "4";
  const abs = typeof f?.dcABS === "number" ? String(Math.round(f.dcABS)) : "3";
  const map = typeof f?.dcFuelMixture === "number" ? String(Math.round(f.dcFuelMixture)) : "1";

  const html = `
    <div class="grid grid-cols-4 gap-1 px-1.5 py-1 font-mono text-[10px] tabular-nums">
      <div class="px-1.5 py-1 rounded-[3px] bg-white/[0.04] border border-white/[0.07] text-center">
        <span class="block text-[8px] text-white/50">BB</span>
        <strong class="text-rose-300">${bb}</strong>
      </div>
      <div class="px-1.5 py-1 rounded-[3px] bg-white/[0.04] border border-white/[0.07] text-center">
        <span class="block text-[8px] text-white/50">TC</span>
        <strong class="text-amber-300">${tc}</strong>
      </div>
      <div class="px-1.5 py-1 rounded-[3px] bg-white/[0.04] border border-white/[0.07] text-center">
        <span class="block text-[8px] text-white/50">ABS</span>
        <strong class="text-sky-300">${abs}</strong>
      </div>
      <div class="px-1.5 py-1 rounded-[3px] bg-white/[0.04] border border-white/[0.07] text-center">
        <span class="block text-[8px] text-white/50">MAP</span>
        <strong class="text-emerald-300">${map}</strong>
      </div>
    </div>
  `;
  patchHtml(container, html);
}
