/**
 * MMT Sync — Live Delta Bar (<canvas> 220x24px, 30-60 FPS, Prompt 109)
 * Renders LapDeltaToSessionBestLap with bidirectional green/red bar and 2-decimal text.
 */

export function renderLiveDeltaCanvas(
  canvas: HTMLCanvasElement,
  deltaSeconds: number,
  isOk: boolean
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cssW = 240;
  const cssH = 22;
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  ctx.clearRect(0, 0, cssW, cssH);

  // Dark Kapps-style backdrop
  ctx.fillStyle = "rgba(9, 11, 15, 0.88)";
  ctx.fillRect(0, 0, cssW, cssH);

  const barX = 8;
  const barW = 160;
  const barY = 6;
  const barH = 10;
  const midX = barX + barW / 2;

  // Bar track
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(barX, barY, barW, barH);

  // Center zero tick
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(midX - 0.5, barY - 1, 1, barH + 2);

  const valid = isOk && Number.isFinite(deltaSeconds);
  const clamped = valid ? Math.max(-2.0, Math.min(2.0, deltaSeconds)) : 0;
  const isFaster = valid && clamped <= 0;

  if (valid && Math.abs(clamped) > 0.005) {
    const fillW = (Math.abs(clamped) / 2.0) * (barW / 2);
    ctx.fillStyle = isFaster ? "#22c55e" : "#ef4444";
    if (isFaster) {
      ctx.fillRect(midX, barY, fillW, barH);
    } else {
      ctx.fillRect(midX - fillW, barY, fillW, barH);
    }
  }

  // Delta numeric readout
  const label = valid
    ? `${clamped > 0 ? "+" : ""}${clamped.toFixed(2)}s`
    : "--.--s";
  ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = !valid
    ? "rgba(255, 255, 255, 0.5)"
    : isFaster
    ? "#22c55e"
    : "#ef4444";
  ctx.fillText(label, cssW - 8, cssH / 2 + 0.5);
}
