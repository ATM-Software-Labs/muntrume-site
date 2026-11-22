/**
 * MMT Sync 2.0 — Multiclass Traffic Indicator (iOverlay Pro-Free)
 * Warns the driver when a faster-class car is rapidly closing from behind.
 */
import type { IrsdkComputedState } from "./types";

export interface ApproachingTraffic {
  carIdx: number;
  carNumber: string;
  driverName: string;
  classShort: string;
  classColor: string;
  gapSeconds: number;
  urgent: boolean;
}

export function detectFasterTraffic(
  state: IrsdkComputedState | null,
  maxGapSeconds = 4.0,
): ApproachingTraffic | null {
  if (!state || !state.activeDriver) return null;
  const myEst = state.activeDriver.carClassEstLapTime || 0;
  const myClassId = state.activeDriver.carClassId;
  const drivers = state.session.driverInfo?.drivers || {};

  let closest: ApproachingTraffic | null = null;
  for (const entry of state.relative.entries) {
    if (entry.isActiveCam || entry.isAhead) continue;
    const gap = Math.abs(entry.deltaSeconds);
    if (!Number.isFinite(gap) || gap > maxGapSeconds) continue;
    const drv = drivers[entry.carIdx];
    if (!drv || drv.isPaceCar || drv.isSpectator) continue;
    if (drv.carClassId === myClassId) continue;
    // Faster class has a significantly lower estimated lap time (> 1.5s faster per lap)
    if (myEst > 0 && drv.carClassEstLapTime > 0 && drv.carClassEstLapTime >= myEst - 1.5) continue;

    if (!closest || gap < closest.gapSeconds) {
      closest = {
        carIdx: entry.carIdx,
        carNumber: entry.carNumber || String(entry.carIdx),
        driverName: entry.abbrevName || entry.driverName || "Rival",
        classShort: entry.carClassShortName || "FAST",
        classColor: entry.carClassColor || "#facc15",
        gapSeconds: gap,
        urgent: gap <= 1.5,
      };
    }
  }
  return closest;
}

export function renderTrafficIndicator(
  container: HTMLElement | null,
  state: IrsdkComputedState | null,
  editMode = false,
): void {
  if (!container) return;
  const hit = detectFasterTraffic(state);
  if (!hit) {
    if (editMode) {
      container.hidden = false;
      container.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;background:rgba(9,11,15,0.9);border:1px solid rgba(250,204,21,0.45);font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#f8fafc;">
        <span style="padding:2px 6px;border-radius:5px;background:#facc15;color:#090b0f;font-weight:900;">GTP</span>
        <span>▲ Tráfico rápido · 1.4s</span>
      </div>`;
    } else {
      container.hidden = true;
      container.innerHTML = "";
    }
    return;
  }

  container.hidden = false;
  const border = hit.urgent ? "#ef4444" : hit.classColor;
  const bg = hit.urgent ? "rgba(127, 29, 29, 0.92)" : "rgba(9, 11, 15, 0.92)";
  container.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;background:${bg};border:1.5px solid ${border};font-family:ui-monospace,Consolas,monospace;font-size:11px;font-weight:800;color:#f8fafc;box-shadow:0 4px 18px rgba(0,0,0,0.45);">
    <span style="padding:2px 6px;border-radius:5px;background:${hit.classColor};color:#090b0f;font-weight:900;">${hit.classShort}</span>
    <span>▲ #${hit.carNumber} ${hit.driverName}</span>
    <span style="color:${hit.urgent ? "#fca5a5" : "#facc15"};font-variant-numeric:tabular-nums;">-${hit.gapSeconds.toFixed(1)}s</span>
  </div>`;
}
