/**
 * MMT Sync 2.0 — Flat Track Map (iOverlay Pro-Free)
 * Horizontal linear track progress bar (0% -> 100%) with Start/Finish marker,
 * sector dividers, class-colored driver bubbles, and highlighted player marker.
 */
import type { IrsdkComputedState } from "./types";

export function renderFlatTrackMapCanvas(
  canvas: HTMLCanvasElement,
  state: IrsdkComputedState | null,
  opts?: { centerOnPlayer?: boolean },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const padX = 18;
  const trackW = Math.max(40, w - padX * 2);
  const midY = Math.round(h * 0.54);

  // Base pill background
  ctx.save();
  ctx.fillStyle = "rgba(9, 11, 15, 0.88)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, 10);
  ctx.fill();
  ctx.stroke();

  // Horizontal track rail
  ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(padX, midY);
  ctx.lineTo(padX + trackW, midY);
  ctx.stroke();

  // Sector dividers (S1 / S2 / S3)
  const sectors = state?.session.sectors;
  const sectorPcts = sectors && sectors.length > 1 ? sectors.slice(1).map((s) => s.startPct) : [0.333, 0.666];
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 1.2;
  for (const sp of sectorPcts) {
    if (sp <= 0.02 || sp >= 0.98) continue;
    const sx = padX + sp * trackW;
    ctx.beginPath();
    ctx.moveTo(sx, midY - 7);
    ctx.lineTo(sx, midY + 7);
    ctx.stroke();
  }

  // Start / Finish marker
  const drawSF = (x: number) => {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, midY - 10);
    ctx.lineTo(x, midY + 10);
    ctx.stroke();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, midY - 9);
    ctx.lineTo(x, midY + 9);
    ctx.stroke();
  };
  drawSF(padX);
  drawSF(padX + trackW);
  ctx.restore();

  if (!state) return;

  const myIdx = state.camCarIdx ?? 0;
  const drivers = state.session.driverInfo?.drivers || {};
  const pcts = state.frame.carIdxLapDistPct || [];
  const onPit = state.frame.carIdxOnPitRoad || [];
  const myPct = pcts[myIdx] ?? 0;
  const centerMode = Boolean(opts?.centerOnPlayer);

  const mapPctToX = (pct: number): number => {
    const norm = ((pct % 1) + 1) % 1;
    if (!centerMode) return padX + norm * trackW;
    let rel = norm - myPct + 0.5;
    rel = ((rel % 1) + 1) % 1;
    return padX + rel * trackW;
  };

  // Rival bubbles
  for (let i = 0; i < pcts.length; i++) {
    if (i === myIdx) continue;
    const pct = pcts[i];
    if (pct === undefined || pct < 0 || pct > 1) continue;
    const drv = drivers[i];
    if (!drv || drv.isSpectator || drv.isPaceCar) continue;
    const x = mapPctToX(pct);
    const cls = (drv.carClassShortName || "").toUpperCase();
    const dotColor =
      drv.carClassColor ||
      (cls.includes("GTP") ? "#facc15" : cls.includes("LMP2") ? "#38bdf8" : cls.includes("GT3") ? "#a855f7" : "#ef4444");

    ctx.save();
    ctx.globalAlpha = onPit[i] ? 0.35 : 0.94;
    ctx.fillStyle = dotColor;
    ctx.strokeStyle = "#090b0f";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, midY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = cls.includes("GTP") ? "#090b0f" : "#ffffff";
    ctx.font = "800 6.5px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(drv.carNumber || i), x, midY + 0.4);
    ctx.restore();
  }

  // Player bubble (always on top with MMT emerald ring)
  if (myPct >= 0 && myPct <= 1) {
    const px = mapPctToX(myPct);
    const myDrv = drivers[myIdx];
    ctx.save();
    ctx.fillStyle = "#10b981";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, midY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#04140d";
    ctx.font = "900 7.5px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(myDrv?.carNumber || myIdx), px, midY + 0.4);
    ctx.restore();
  }
}
