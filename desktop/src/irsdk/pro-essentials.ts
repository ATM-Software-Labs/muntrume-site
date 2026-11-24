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

function fmtLap(sec: number | undefined): string {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0 || sec > 3600) return "--:--.---";
  const m = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${m}:${rem < 10 ? "0" : ""}${rem.toFixed(3)}`;
}

/**
 * 5) Flag Matrix LED (Yellow / Blue / Green / White / Checkered / Meatball)
 */
export function renderFlagMatrixWidget(container: HTMLElement, state: IrsdkComputedState | null, isPreview = false): void {
  const flags = state?.frame?.sessionFlags ?? 0;
  let label = "GREEN FLAG";
  let color = "#10b981";
  let bg = "rgba(16, 185, 129, 0.16)";
  let active = false;

  if (flags & 0x00100000) { // repair / meatball
    label = "MEATBALL · PIT";
    color = "#f97316";
    bg = "rgba(249, 115, 22, 0.24)";
    active = true;
  } else if ((flags & 0x00000008) || (flags & 0x00004000)) { // yellow / caution
    label = "YELLOW FLAG";
    color = "#facc15";
    bg = "rgba(250, 204, 21, 0.22)";
    active = true;
  } else if (flags & 0x00000020) { // blue
    label = "BLUE FLAG";
    color = "#38bdf8";
    bg = "rgba(56, 189, 248, 0.24)";
    active = true;
  } else if (flags & 0x00000001) { // checkered
    label = "CHECKERED";
    color = "#f8fafc";
    bg = "rgba(248, 250, 252, 0.18)";
    active = true;
  } else if (flags & 0x00000002) { // white
    label = "FINAL LAP";
    color = "#e2e8f0";
    bg = "rgba(226, 232, 240, 0.18)";
    active = true;
  } else if (flags & 0x00000004) { // green
    label = "GREEN FLAG";
    color = "#10b981";
    bg = "rgba(16, 185, 129, 0.18)";
    active = true;
  }

  if (!active && !isPreview) {
    patchHtml(container, "");
    return;
  }

  const dots = Array.from({ length: 15 })
    .map(() => `<span class="w-1.5 h-1.5 rounded-full" style="background:${color};box-shadow:0 0 6px ${color};"></span>`)
    .join("");

  const html = `
    <div class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[4px] border font-mono text-[10px] font-black tracking-widest uppercase" style="background:${bg};border-color:${color}88;color:${color};">
      <div class="grid grid-cols-5 gap-0.5 shrink-0">${dots}</div>
      <span>${label}</span>
    </div>
  `;
  patchHtml(container, html);
}

/**
 * 6) Tachometer Shift Lights + FFB Clipping Meter
 */
export function renderTachometerWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const f = state?.frame;
  const rpm = typeof f?.rpm === "number" && Number.isFinite(f.rpm) ? f.rpm : 7150;
  const redline = 8200;
  const ratio = Math.max(0, Math.min(1, rpm / redline));
  const speed = typeof f?.speedKmh === "number" && Number.isFinite(f.speedKmh) ? Math.round(f.speedKmh) : 214;
  const gearRaw = typeof f?.gear === "number" ? f.gear : 4;
  const gearStr = gearRaw === -1 ? "R" : gearRaw === 0 ? "N" : String(gearRaw);

  // Estimate FFB load from steering torque or lateral load (0-100%)
  const torque = Math.abs(Number((f as any)?.steeringWheelTorque ?? 0));
  const ffbPct = torque > 0 ? Math.min(100, Math.round((torque / 16) * 100)) : Math.min(100, Math.round(ratio * 72));
  const isClip = ffbPct >= 92;

  const leds = Array.from({ length: 14 })
    .map((_, i) => {
      const thresh = (i + 1) / 14;
      const lit = ratio >= thresh - 0.04;
      const col = i >= 10 ? "#ef4444" : i >= 6 ? "#f59e0b" : "#10b981";
      return `<span class="h-2 flex-1 rounded-[2px] transition-all" style="background:${lit ? col : "rgba(255,255,255,0.08)"};${lit ? `box-shadow:0 0 6px ${col}aa;` : ""}"></span>`;
    })
    .join("");

  const html = `
    <div class="w-[244px] px-2.5 py-1.5 font-mono tabular-nums space-y-1.5">
      <div class="flex items-center gap-0.5">${leds}</div>
      <div class="flex items-center justify-between gap-2 text-[10.5px]">
        <div class="flex items-baseline gap-1.5">
          <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs leading-none">${gearStr}</span>
          <strong class="text-white text-sm leading-none">${speed}</strong>
          <span class="text-[9px] text-white/45">KM/H</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] ${isClip ? "text-rose-400 font-black" : "text-white/50"}">FFB</span>
          <div class="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full rounded-full ${isClip ? "bg-rose-500" : "bg-sky-400"}" style="width:${ffbPct}%"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  patchHtml(container, html);
}

/**
 * 7) Lap Timer & Sector Delta
 */
export function renderLapTimerWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const f = state?.frame;
  const cur = fmtLap((f as any)?.lapCurrentLapTime ?? 68.412);
  const last = fmtLap((f as any)?.lapLastLapTime ?? 108.934);
  const best = fmtLap((f as any)?.lapBestLapTime ?? 108.412);
  const rawDelta = (f as any)?.lapDeltaToBestLap ?? (f as any)?.deltaBestSec;
  const delta = typeof rawDelta === "number" && Number.isFinite(rawDelta) ? rawDelta : -0.18;
  const deltaCls = delta <= 0 ? "text-emerald-400" : "text-rose-400";
  const deltaStr = `${delta <= 0 ? "" : "+"}${delta.toFixed(2)}s`;

  const html = `
    <div class="w-[236px] px-2.5 py-1.5 font-mono text-[10px] tabular-nums space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-white/50 text-[9px] font-bold">LAP TIMER</span>
        <strong class="${deltaCls} font-black">${deltaStr}</strong>
      </div>
      <div class="grid grid-cols-3 gap-1 text-center">
        <div class="px-1 py-0.5 rounded bg-white/[0.04]">
          <span class="block text-[8px] text-white/45">CUR</span>
          <strong class="text-white">${cur}</strong>
        </div>
        <div class="px-1 py-0.5 rounded bg-white/[0.04]">
          <span class="block text-[8px] text-white/45">BEST</span>
          <strong class="text-purple-300">${best}</strong>
        </div>
        <div class="px-1 py-0.5 rounded bg-white/[0.04]">
          <span class="block text-[8px] text-white/45">LAST</span>
          <strong class="text-white/80">${last}</strong>
        </div>
      </div>
    </div>
  `;
  patchHtml(container, html);
}
