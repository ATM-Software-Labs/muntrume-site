import type { IrsdkComputedState } from "./types";
import { resolveTrackPolygon, samplePolygonAtPct } from "./track-paths";

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

const trackSectorState = {
  lastLap: -1,
  lastSector: -1,
  sectorStartMs: 0,
  currentLapColors: [] as string[],
  personalBestMs: [] as number[],
  sessionBestMs: [] as number[],
};

/**
 * Renders the clean 2D <canvas> Track Map with 3px sector-colored trace and 4px car dots (Prompt 110).
 */
export function renderLiveTrackMapCanvas(canvas: HTMLCanvasElement, state: IrsdkComputedState | null): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.4;
  const ry = h * 0.37;

  const trackName = state?.session.weekendInfo?.trackName || "";
  const poly = resolveTrackPolygon(trackName);

  // Muestreo base de 64 puntos y suavizado Catmull-Rom cerrado para eliminar esquinas poligonales
  const rawPts: Array<{ x: number; y: number }> = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const pct = i / N;
    if (poly) {
      rawPts.push(samplePolygonAtPct(poly, pct, w, h));
    } else {
      const a = pct * Math.PI * 2 - Math.PI / 2;
      rawPts.push({
        x: cx + rx * Math.cos(a) + 5 * Math.sin(a * 3),
        y: cy + ry * Math.sin(a) + 3 * Math.cos(a * 2),
      });
    }
  }

  const smoothPts: Array<{ x: number; y: number }> = [];
  const SUB = 6; // 64 * 6 = 384 puntos ultra suaves
  for (let i = 0; i < N; i++) {
    const p0 = rawPts[(i - 1 + N) % N];
    const p1 = rawPts[i];
    const p2 = rawPts[(i + 1) % N];
    const p3 = rawPts[(i + 2) % N];
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      smoothPts.push({ x, y });
    }
  }

  const totalSmooth = smoothPts.length;
  const pointAtPct = (pct: number): { x: number; y: number } => {
    const norm = ((pct % 1) + 1) % 1;
    const idx = Math.floor(norm * totalSmooth) % totalSmooth;
    return smoothPts[idx];
  };

  // 1. Borde exterior oscuro de alto contraste
  ctx.save();
  ctx.lineWidth = 6.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(8, 10, 15, 0.92)";
  ctx.beginPath();
  smoothPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();

  // 2. Asfalto principal gris neutro nitido
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = "rgba(203, 213, 225, 0.55)";
  ctx.stroke();
  ctx.restore();

  // 3. Linea de meta blanca/roja en pct = 0
  const sf0 = pointAtPct(0);
  const sf1 = pointAtPct(0.01);
  const ang = Math.atan2(sf1.y - sf0.y, sf1.x - sf0.x) + Math.PI / 2;
  ctx.save();
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(sf0.x - Math.cos(ang) * 6, sf0.y - Math.sin(ang) * 6);
  ctx.lineTo(sf0.x + Math.cos(ang) * 6, sf0.y + Math.sin(ang) * 6);
  ctx.stroke();
  ctx.restore();

  if (!state) return;

  const myIdx = state.camCarIdx ?? 0;
  const drivers = state.session.driverInfo?.drivers || {};
  const pcts = state.frame.carIdxLapDistPct || [];
  const onPit = state.frame.carIdxOnPitRoad || [];

  // 4. Dibujar rivales con circulo de color por clase y dorsal legible
  for (let i = 0; i < pcts.length; i++) {
    if (i === myIdx) continue;
    const pct = pcts[i];
    if (pct === undefined || pct < 0 || pct > 1) continue;
    const drv = drivers[i];
    if (!drv || drv.isSpectator || drv.carIsPaceCar) continue;
    const p = pointAtPct(pct);
    const cls = (drv.carClassShortName || "").toUpperCase();
    const dotColor =
      cls.includes("GTP") ? "#facc15" :
      cls.includes("LMP2") ? "#38bdf8" :
      cls.includes("GT3") ? "#ef4444" :
      "#a855f7";

    ctx.save();
    ctx.globalAlpha = onPit[i] ? 0.45 : 0.95;
    ctx.fillStyle = dotColor;
    ctx.strokeStyle = "#090b0f";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = cls.includes("GTP") ? "#090b0f" : "#ffffff";
    ctx.font = "bold 6.5px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(drv.carNumber || i), p.x, p.y + 0.3);
    ctx.restore();
  }

  // 5. Dibujar coche enfocado (CamCarIdx) encima de todos en verde esmeralda brillante
  const myPct = pcts[myIdx];
  if (myPct !== undefined && myPct >= 0 && myPct <= 1) {
    const p = pointAtPct(myPct);
    const myDrv = drivers[myIdx];
    ctx.save();
    ctx.fillStyle = "rgba(16, 185, 129, 0.3)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#052e16";
    ctx.font = "900 7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(myDrv?.carNumber || myIdx), p.x, p.y + 0.3);
    ctx.restore();
  }
}
