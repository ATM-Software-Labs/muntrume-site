import type { IrsdkComputedState } from "./types";

export interface ProximityStatus {
  leftActive: boolean;
  leftDouble: boolean;
  rightActive: boolean;
  rightDouble: boolean;
  isThreeWide: boolean;
  amberCount: number;
  nearestRearMeters: number | null;
}

/**
 * Computes lateral & longitudinal car proximity from iRacing's CarLeftRight SDK enum
 * (0=Clear, 1=Left, 2=Right, 3=3-Wide, 4=2 Left, 5=2 Right) and CarIdxLapDistPct * trackLengthMeters.
 */
export function computeProximityStatus(state: IrsdkComputedState | null): ProximityStatus {
  if (!state) {
    return {
      leftActive: false,
      leftDouble: false,
      rightActive: false,
      rightDouble: false,
      isThreeWide: false,
      amberCount: 0,
      nearestRearMeters: null,
    };
  }

  const clr = state.frame.carLeftRight ?? 0;
  const leftActive = clr === 1 || clr === 3 || clr === 4;
  const rightActive = clr === 2 || clr === 3 || clr === 5;
  const leftDouble = clr === 4;
  const rightDouble = clr === 5;
  const isThreeWide = clr === 3;

  const trackLenM = Math.max(1000, state.session.weekendInfo?.trackLengthM || 4500);
  let amberCount = 0;
  let nearestRearMeters: number | null = null;
  const myPct = state.frame.carIdxLapDistPct[state.camCarIdx] ?? -1;
  if (myPct >= 0) {
    for (let i = 0; i < state.frame.carIdxLapDistPct.length; i++) {
      if (i === state.camCarIdx) continue;
      const other = state.frame.carIdxLapDistPct[i];
      if (other < 0 || state.frame.carIdxOnPitRoad[i]) continue;
      let signedDiff = other - myPct;
      if (signedDiff > 0.5) signedDiff -= 1;
      if (signedDiff < -0.5) signedDiff += 1;
      const distMeters = signedDiff * trackLenM;
      if (Math.abs(distMeters) <= 8.0) {
        amberCount++;
        if (distMeters < 0 && (nearestRearMeters === null || Math.abs(distMeters) < nearestRearMeters)) {
          nearestRearMeters = Math.abs(distMeters);
        }
      }
    }
  }

  return { leftActive, leftDouble, rightActive, rightDouble, isThreeWide, amberCount, nearestRearMeters };
}

function drawWingCanvas(
  canvas: HTMLCanvasElement,
  side: "left" | "right",
  active: boolean,
  doubleCar: boolean,
  amberNear: boolean,
  nearestRearMeters: number | null,
  nowMs: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const isRed = active;
  const isAmber = !isRed && amberNear;
  const pulse = isRed ? 0.65 + 0.35 * Math.sin(nowMs * 0.012) : 1;

  // Translucent housing
  ctx.fillStyle = isRed
    ? `rgba(127, 29, 29, ${(0.62 * pulse).toFixed(2)})`
    : isAmber
    ? "rgba(120, 53, 15, 0.52)"
    : "rgba(10, 12, 16, 0.45)";
  ctx.strokeStyle = isRed
    ? "rgba(244, 63, 94, 0.85)"
    : isAmber
    ? "rgba(251, 191, 36, 0.75)"
    : "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, 6);
  ctx.fill();
  ctx.stroke();

  // Dynamic proximity bar
  const barW = doubleCar ? 10 : 14;
  const barX = side === "left" ? w - barW - 10 : 10;
  const ratio = isRed
    ? 1
    : isAmber && nearestRearMeters !== null
    ? Math.max(0.25, Math.min(1, 1 - nearestRearMeters / 8.0))
    : isAmber
    ? 0.6
    : 0.15;
  const maxBarH = h - 38;
  const barH = Math.round(maxBarH * ratio);
  const barY = 20 + (maxBarH - barH);

  ctx.fillStyle = isRed ? "#f43f5e" : isAmber ? "#fbbf24" : "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.fill();

  if (doubleCar) {
    const secondX = side === "left" ? barX - barW - 5 : barX + barW + 5;
    ctx.beginPath();
    ctx.roundRect(secondX, barY + 6, barW, Math.max(12, barH - 12), 3);
    ctx.fill();
  }

  // Labels
  ctx.fillStyle = isRed ? "#fecdd3" : isAmber ? "#fde68a" : "rgba(255,255,255,0.4)";
  ctx.font = "bold 9px Consolas, monospace";
  ctx.textAlign = "center";
  const topLabel = isRed ? (doubleCar ? "2x COCHE" : side === "left" ? "◀ IZQ" : "DER ▶") : isAmber ? "CERCA" : "LIBRE";
  ctx.fillText(topLabel, w / 2, 13);

  const botLabel = isRed
    ? "PARALELO"
    : isAmber && nearestRearMeters !== null
    ? `${nearestRearMeters.toFixed(1)}m`
    : isAmber
    ? "< 8m"
    : "OK";
  ctx.fillText(botLabel, w / 2, h - 6);
}

export function renderMirrorProximityWings(container: HTMLElement, state: IrsdkComputedState | null): void {
  const prox = computeProximityStatus(state);
  const activeAny = prox.leftActive || prox.rightActive || prox.amberCount > 0;
  const isEditing = document.documentElement.classList.contains("overlay-editing");
  container.style.opacity = activeAny || isEditing ? "1" : "0.15";

  if (container.dataset.canvasMounted !== "1") {
    container.dataset.canvasMounted = "1";
    container.innerHTML = `
      <div class="flex flex-col items-center gap-1">
        <div id="ovRadarThreeWideBadge" style="visibility:hidden" class="px-3 py-0.5 rounded-full bg-rose-600/95 border border-rose-300 text-white font-mono text-[10px] font-black tracking-widest uppercase animate-pulse shadow-lg">⚠ 3-WIDE ⚠</div>
        <div class="flex items-start justify-between w-[720px] max-w-[96vw]">
          <canvas id="ovRadarLeftCanvas" width="90" height="130"></canvas>
          <div class="w-[540px] shrink-0 pointer-events-none"></div>
          <canvas id="ovRadarRightCanvas" width="90" height="130"></canvas>
        </div>
      </div>
    `;
  }

  const badge = container.querySelector<HTMLElement>("#ovRadarThreeWideBadge");
  if (badge) {
    badge.style.visibility = prox.isThreeWide ? "visible" : "hidden";
  }
  const leftCanvas = container.querySelector<HTMLCanvasElement>("#ovRadarLeftCanvas");
  const rightCanvas = container.querySelector<HTMLCanvasElement>("#ovRadarRightCanvas");
  const nowMs = performance.now();
  if (leftCanvas) {
    drawWingCanvas(leftCanvas, "left", prox.leftActive, prox.leftDouble, prox.amberCount > 0, prox.nearestRearMeters, nowMs);
  }
  if (rightCanvas) {
    drawWingCanvas(rightCanvas, "right", prox.rightActive, prox.rightDouble, prox.amberCount > 0, prox.nearestRearMeters, nowMs);
  }
}

/**
 * Renders the clean 2D <canvas> Track Map with Class Dots and Ghost PIT Exit marker (Prompt 74).
 */
export function renderLiveTrackMapCanvas(canvas: HTMLCanvasElement, state: IrsdkComputedState | null): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.39;
  const ry = h * 0.36;

  const pointAtPct = (pct: number): { x: number; y: number } => {
    const a = pct * Math.PI * 2 - Math.PI / 2;
    const x = cx + rx * Math.cos(a) + 6 * Math.sin(a * 3);
    const y = cy + ry * Math.sin(a) + 4 * Math.cos(a * 2);
    return { x, y };
  };

  // Track circuit outline in translucent gray
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const p = pointAtPct(i / 64);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();

  // Start/Finish tick
  const sf = pointAtPct(0);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(sf.x - 1, sf.y - 4, 2, 8);

  if (!state) return;

  const myIdx = state.camCarIdx;
  const myPct = state.frame.carIdxLapDistPct[myIdx] ?? 0;
  const myLap = state.frame.carIdxLap[myIdx] ?? 0;
  const leaderIdx = state.leaderboard[0]?.carIdx ?? -1;

  // Ghost PIT Exit Marker (~24s pit loss on a ~90s lap)
  if (myPct >= 0) {
    const estLapSec = Math.max(45, state.session.driverInfo?.driverCarEstLapTime || 90);
    const pitExitPct = (((myPct - 24 / estLapSec) % 1) + 1) % 1;
    const pitPt = pointAtPct(pitExitPct);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
    ctx.fillStyle = "rgba(10, 12, 16, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pitPt.x, pitPt.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 8px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText("PIT", pitPt.x, pitPt.y - 7);
  }

  // Other cars
  for (let i = 0; i < state.frame.carIdxLapDistPct.length; i++) {
    if (i === myIdx) continue;
    const pct = state.frame.carIdxLapDistPct[i];
    if (pct < 0 || state.frame.carIdxOnPitRoad[i]) continue;
    const p = pointAtPct(pct);
    const isLeader = i === leaderIdx;
    const otherLap = state.frame.carIdxLap[i] ?? myLap;
    const isLapped = otherLap < myLap;
    ctx.fillStyle = isLeader ? "#f59e0b" : isLapped ? "#38bdf8" : "rgba(255, 255, 255, 0.65)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, isLeader ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player car (bright emerald #10b981 + halo)
  if (myPct >= 0) {
    const me = pointAtPct(myPct);
    ctx.fillStyle = "rgba(16, 185, 129, 0.28)";
    ctx.beginPath();
    ctx.arc(me.x, me.y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(me.x, me.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
