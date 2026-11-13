import type { Disposable } from "../core/disposable";
import { clamp, safeDiv } from "../core/math-guards";
import type { AlignedTelemetryPoint } from "./types";

/**
 * High-FPS HTML5 Canvas telemetry renderer with DPR scaling and deterministic teardown.
 */
export class TelemetryCanvasRenderer implements Disposable {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private points: readonly AlignedTelemetryPoint[] = [];
  private rafId: number | null = null;
  private width = 0;
  private height = 0;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("No se pudo inicializar el contexto 2D del Canvas");
    this.ctx = ctx;

    this.observer = new ResizeObserver(() => this.syncSize());
    this.observer.observe(canvas);
    this.syncSize();
  }

  setPoints(points: readonly AlignedTelemetryPoint[]): void {
    this.points = points;
    this.scheduleDraw();
  }

  private syncSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scheduleDraw();
  }

  private scheduleDraw(): void {
    if (this.disposed || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.draw();
    });
  }

  private draw(): void {
    const { ctx, width, height, points } = this;
    ctx.fillStyle = "#0b0f14";
    ctx.fillRect(0, 0, width, height);

    if (points.length < 2) return;

    const minDist = points[0].distM;
    const spanDist = Math.max(1, points[points.length - 1].distM - minDist);

    this.drawTrace(points, minDist, spanDist, (p) => p.refSpeedKmh / 340, "#64748b", 1.5);
    this.drawTrace(points, minDist, spanDist, (p) => p.userSpeedKmh / 340, "#10b981", 2.0);
  }

  private drawTrace(
    points: readonly AlignedTelemetryPoint[],
    minDist: number,
    spanDist: number,
    normY: (p: AlignedTelemetryPoint) => number,
    color: string,
    lineWidth: number,
  ): void {
    const { ctx, width, height } = this;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = safeDiv(p.distM - minDist, spanDist, 0) * width;
      const y = height - clamp(normY(p), 0, 1) * (height - 16) - 8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.observer.disconnect();
    this.points = [];
  }
}
