/**
 * MMT Sync — AeroSuspensionAnalyzer (Prompt 36)
 * Ride Height, Dynamic Rake vs Speed, and Bottoming Out detector for .mmt-lap / telemetry traces.
 */

import { finiteOr } from "../core/math-guards";
import type { TelemetrySample } from "./types";

export interface AeroTelemetrySample extends TelemetrySample {
  lfRideHeightMm?: number;
  rfRideHeightMm?: number;
  lrRideHeightMm?: number;
  rrRideHeightMm?: number;
  lfShockDeflMm?: number;
  rfShockDeflMm?: number;
  lrShockDeflMm?: number;
  rrShockDeflMm?: number;
}

export type BottomingPhase = "braking" | "high_speed_compression" | "mid_corner";

export interface BottomingEvent {
  distM: number;
  speedKmh: number;
  frontMm: number;
  rearMm: number;
  maxShockMm: number;
  phase: BottomingPhase;
  x?: number;
  y?: number;
}

export interface AeroPoint {
  distM: number;
  speedKmh: number;
  frontMm: number;
  rearMm: number;
  rakeMm: number;
  bottoming: boolean;
}

export interface AeroAnalysisReport {
  points: AeroPoint[];
  bottomingEvents: BottomingEvent[];
  staticRakeMm: number;
  highSpeedRakeMm: number;
  aeroCompressionMm: number;
  minFrontMm: number;
  minRearMm: number;
}

export class AeroSuspensionAnalyzer {
  public analyze(samples: AeroTelemetrySample[], shockBumpstopMm = 55): AeroAnalysisReport {
    if (!samples || samples.length === 0) {
      return {
        points: [],
        bottomingEvents: [],
        staticRakeMm: 0,
        highSpeedRakeMm: 0,
        aeroCompressionMm: 0,
        minFrontMm: 0,
        minRearMm: 0,
      };
    }

    const points: AeroPoint[] = [];
    const bottomingEvents: BottomingEvent[] = [];
    let minFrontMm = Infinity;
    let minRearMm = Infinity;
    let lowSpeedRakeSum = 0;
    let lowSpeedCount = 0;
    let highSpeedRakeSum = 0;
    let highSpeedCount = 0;

    for (const s of samples) {
      const speedKmh = finiteOr(s.speedKmh, 0);
      const lf = finiteOr(s.lfRideHeightMm, 42);
      const rf = finiteOr(s.rfRideHeightMm, 42);
      const lr = finiteOr(s.lrRideHeightMm, 58);
      const rr = finiteOr(s.rrRideHeightMm, 58);
      const frontMm = (lf + rf) / 2;
      const rearMm = (lr + rr) / 2;
      const rakeMm = rearMm - frontMm;

      const maxShockMm = Math.max(
        finiteOr(s.lfShockDeflMm, 0),
        finiteOr(s.rfShockDeflMm, 0),
        finiteOr(s.lrShockDeflMm, 0),
        finiteOr(s.rrShockDeflMm, 0),
      );

      const bottoming = lf <= 0.5 || rf <= 0.5 || lr <= 0.5 || rr <= 0.5 || maxShockMm >= shockBumpstopMm;

      if (frontMm < minFrontMm) minFrontMm = frontMm;
      if (rearMm < minRearMm) minRearMm = rearMm;

      if (speedKmh > 10 && speedKmh < 100) {
        lowSpeedRakeSum += rakeMm;
        lowSpeedCount += 1;
      } else if (speedKmh >= 200) {
        highSpeedRakeSum += rakeMm;
        highSpeedCount += 1;
      }

      points.push({
        distM: finiteOr(s.distM, 0),
        speedKmh,
        frontMm: Number(frontMm.toFixed(1)),
        rearMm: Number(rearMm.toFixed(1)),
        rakeMm: Number(rakeMm.toFixed(1)),
        bottoming,
      });

      if (bottoming) {
        const phase: BottomingPhase =
          finiteOr(s.brake, 0) > 0.15
            ? "braking"
            : speedKmh >= 160
            ? "high_speed_compression"
            : "mid_corner";

        bottomingEvents.push({
          distM: Number(finiteOr(s.distM, 0).toFixed(1)),
          speedKmh: Number(speedKmh.toFixed(1)),
          frontMm: Number(frontMm.toFixed(1)),
          rearMm: Number(rearMm.toFixed(1)),
          maxShockMm: Number(maxShockMm.toFixed(1)),
          phase,
          x: s.x,
          y: s.y,
        });
      }
    }

    const staticRakeMm = lowSpeedCount > 0 ? lowSpeedRakeSum / lowSpeedCount : (points[0]?.rakeMm ?? 0);
    const highSpeedRakeMm = highSpeedCount > 0 ? highSpeedRakeSum / highSpeedCount : staticRakeMm;
    const aeroCompressionMm = staticRakeMm - highSpeedRakeMm;

    return {
      points,
      bottomingEvents,
      staticRakeMm: Number(staticRakeMm.toFixed(1)),
      highSpeedRakeMm: Number(highSpeedRakeMm.toFixed(1)),
      aeroCompressionMm: Number(aeroCompressionMm.toFixed(1)),
      minFrontMm: Number((Number.isFinite(minFrontMm) ? minFrontMm : 0).toFixed(1)),
      minRearMm: Number((Number.isFinite(minRearMm) ? minRearMm : 0).toFixed(1)),
    };
  }

  /**
   * Enriches base .mmt-lap samples with physically plausible ride-height & shock channels
   * when the source lap lacks dedicated aero sensors, preserving deterministic replayability.
   */
  public deriveSamplesFromLap(samples: TelemetrySample[]): AeroTelemetrySample[] {
    return samples.map((s) => {
      const existing = s as AeroTelemetrySample;
      if (existing.lfRideHeightMm !== undefined) return existing;
      const speedNorm = Math.min(1.2, Math.max(0, finiteOr(s.speedKmh, 0) / 260));
      const downforceDropFront = speedNorm * speedNorm * 18;
      const downforceDropRear = speedNorm * speedNorm * 22;
      const brakePitchFront = finiteOr(s.brake, 0) * 14;
      const brakeLiftRear = finiteOr(s.brake, 0) * 8;
      const front = Math.max(0, 34 - downforceDropFront - brakePitchFront);
      const rear = Math.max(0, 56 - downforceDropRear + brakeLiftRear);
      const shockFront = Math.max(0, 58 - front);

      return {
        ...s,
        lfRideHeightMm: front,
        rfRideHeightMm: front,
        lrRideHeightMm: rear,
        rrRideHeightMm: rear,
        lfShockDeflMm: shockFront,
        rfShockDeflMm: shockFront,
        lrShockDeflMm: Math.max(0, 56 - rear),
        rrShockDeflMm: Math.max(0, 56 - rear),
      };
    });
  }
}

export function renderAeroAnalysisPanel(container: HTMLElement, report: AeroAnalysisReport): void {
  if (!report.points.length) {
    container.innerHTML = `<div class="p-4 text-xs font-mono text-white/50">Carga una vuelta (.mmt-lap / .ibt) para analizar alturas al suelo, rake y bottoming out.</div>`;
    return;
  }

  const w = 640;
  const h = 170;
  const maxDist = Math.max(1, report.points[report.points.length - 1].distM);
  const maxRh = Math.max(70, ...report.points.map((p) => Math.max(p.frontMm, p.rearMm)));

  const toPath = (pick: (p: AeroPoint) => number) =>
    report.points
      .map((p, idx) => {
        const x = ((p.distM / maxDist) * w).toFixed(1);
        const y = (h - 14 - (pick(p) / maxRh) * (h - 28)).toFixed(1);
        return `${idx === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");

  const frontPath = toPath((p) => p.frontMm);
  const rearPath = toPath((p) => p.rearMm);
  const bottomDots = report.bottomingEvents
    .slice(0, 40)
    .map((e) => {
      const x = ((e.distM / maxDist) * w).toFixed(1);
      const y = (h - 14).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="#ef4444"><title>${e.distM}m · ${e.speedKmh} km/h (${e.phase})</title></circle>`;
    })
    .join("");

  const phaseLabel = (p: BottomingPhase) =>
    p === "braking" ? "Frenada" : p === "high_speed_compression" ? "Compresión alta vel." : "Paso por curva";

  const rows = report.bottomingEvents
    .slice(0, 8)
    .map(
      (e) => `
      <tr class="border-t border-white/10">
        <td class="py-1 px-2">${e.distM.toFixed(0)} m</td>
        <td class="py-1 px-2">${e.speedKmh.toFixed(0)} km/h</td>
        <td class="py-1 px-2 text-rose-400 font-bold">${e.frontMm.toFixed(1)} / ${e.rearMm.toFixed(1)} mm</td>
        <td class="py-1 px-2">${phaseLabel(e.phase)}</td>
      </tr>
    `,
    )
    .join("");

  container.innerHTML = `
    <div class="space-y-4 font-mono">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="p-3 rounded-lg bg-black/40 border border-white/10">
          <div class="text-[10px] text-white/50 uppercase">Rake Baja Vel.</div>
          <div class="text-lg font-bold text-white">${report.staticRakeMm.toFixed(1)} mm</div>
        </div>
        <div class="p-3 rounded-lg bg-black/40 border border-white/10">
          <div class="text-[10px] text-white/50 uppercase">Rake Alta Vel. (&gt;200)</div>
          <div class="text-lg font-bold text-emerald-400">${report.highSpeedRakeMm.toFixed(1)} mm</div>
        </div>
        <div class="p-3 rounded-lg bg-black/40 border border-white/10">
          <div class="text-[10px] text-white/50 uppercase">Compresión Aero</div>
          <div class="text-lg font-bold text-sky-400">${report.aeroCompressionMm.toFixed(1)} mm</div>
        </div>
        <div class="p-3 rounded-lg bg-black/40 border border-white/10">
          <div class="text-[10px] text-white/50 uppercase">Bottoming Out</div>
          <div class="text-lg font-bold ${report.bottomingEvents.length > 0 ? "text-rose-400" : "text-emerald-400"}">${report.bottomingEvents.length} pts</div>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-black/50 border border-white/10">
        <div class="flex items-center justify-between text-[10px] text-white/60 mb-2">
          <span>ALTURA AL SUELO (FRONTAL AZUL · TRASERA ÁMBAR · BOTTOMING ROJO)</span>
          <span>Mín. Del: ${report.minFrontMm.toFixed(1)} mm · Mín. Tras: ${report.minRearMm.toFixed(1)} mm</span>
        </div>
        <svg viewBox="0 0 ${w} ${h}" class="w-full h-40 overflow-visible">
          <line x1="0" y1="${h - 14}" x2="${w}" y2="${h - 14}" stroke="rgba(239,68,68,0.45)" stroke-dasharray="4 4" />
          <path d="${rearPath}" fill="none" stroke="#f59e0b" stroke-width="2" />
          <path d="${frontPath}" fill="none" stroke="#38bdf8" stroke-width="2" />
          ${bottomDots}
        </svg>
      </div>

      ${
        report.bottomingEvents.length > 0
          ? `<div class="rounded-xl border border-white/10 overflow-hidden bg-black/40">
              <table class="w-full text-left text-[11px]">
                <thead class="bg-white/5 text-white/60">
                  <tr><th class="py-1.5 px-2">Metro</th><th class="py-1.5 px-2">Velocidad</th><th class="py-1.5 px-2">RH Del / Tras</th><th class="py-1.5 px-2">Fase</th></tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`
          : `<div class="text-xs text-emerald-400">✓ Sin golpes contra el asfalto (0 mm) detectados en esta vuelta.</div>`
      }
    </div>
  `;
}
