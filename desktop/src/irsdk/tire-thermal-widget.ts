/**
 * MMT Sync — TireThermalWidget (Prompt 35)
 * Real-time IMO (Inner/Middle/Outer) tire temperatures, camber delta, and cold vs. hot pressure tracking.
 */

import { finiteOr } from "../core/math-guards";

export type TireCorner = "LF" | "RF" | "LR" | "RR";

export interface TireCornerInput {
  innerC: number;
  middleC: number;
  outerC: number;
  pressureKpa: number;
}

export interface TireThermalEnv {
  trackTempC?: number;
  windSpeedKmh?: number;
  windDirDeg?: number;
  trackWetnessPct?: number;
}

export interface TireThermalInput {
  onPitRoad: boolean;
  LF: TireCornerInput;
  RF: TireCornerInput;
  LR: TireCornerInput;
  RR: TireCornerInput;
  env?: TireThermalEnv;
}

export type ThermalZoneState = "cold" | "optimal" | "warm" | "hot";

export interface TireCornerComputed {
  corner: TireCorner;
  innerC: number;
  middleC: number;
  outerC: number;
  avgC: number;
  camberDeltaC: number;
  camberHint: string;
  innerState: ThermalZoneState;
  middleState: ThermalZoneState;
  outerState: ThermalZoneState;
  coldKpa: number;
  hotKpa: number;
  deltaKpa: number;
  deltaPsi: number;
}

export interface TireThermalSnapshot {
  corners: Record<TireCorner, TireCornerComputed>;
  optimalWindowC: [number, number];
  env: {
    trackTempC: number;
    windSpeedKmh: number;
    windDirDeg: number;
    trackWetnessPct: number;
  };
}

const KPA_TO_PSI = 0.1450377;

export class TireThermalEngine {
  private coldBaseline: Partial<Record<TireCorner, number>> = {};
  private wasOnPitRoad = true;
  private optimalMinC = 75;
  private optimalMaxC = 92;

  public setOptimalWindow(minC: number, maxC: number): void {
    this.optimalMinC = finiteOr(minC, 75);
    this.optimalMaxC = Math.max(this.optimalMinC + 5, finiteOr(maxC, 92));
  }

  public resetColdBaseline(): void {
    this.coldBaseline = {};
  }

  public classifyTemp(tempC: number): ThermalZoneState {
    if (tempC < 70) return "cold";
    if (tempC > 98) return "hot";
    if (tempC > this.optimalMaxC || tempC < this.optimalMinC) return "warm";
    return "optimal";
  }

  public colorForState(state: ThermalZoneState): string {
    if (state === "cold") return "#38bdf8";
    if (state === "hot") return "#ef4444";
    if (state === "warm") return "#f59e0b";
    return "#34d399";
  }

  public evaluate(input: TireThermalInput): TireThermalSnapshot {
    // Capture fresh cold baseline when exiting pit road
    if (this.wasOnPitRoad && !input.onPitRoad) {
      this.coldBaseline = {};
    }
    this.wasOnPitRoad = input.onPitRoad;

    const cornersList: TireCorner[] = ["LF", "RF", "LR", "RR"];
    const computed = {} as Record<TireCorner, TireCornerComputed>;

    for (const corner of cornersList) {
      const c = input[corner];
      const innerC = finiteOr(c.innerC, 25);
      const middleC = finiteOr(c.middleC, 25);
      const outerC = finiteOr(c.outerC, 25);
      const hotKpa = finiteOr(c.pressureKpa, 150);

      if (this.coldBaseline[corner] === undefined && hotKpa > 40) {
        this.coldBaseline[corner] = hotKpa;
      }
      const coldKpa = this.coldBaseline[corner] ?? hotKpa;
      const deltaKpa = hotKpa - coldKpa;
      const deltaPsi = deltaKpa * KPA_TO_PSI;
      const camberDeltaC = innerC - outerC;

      let camberHint = "Caída equilibrada";
      if (camberDeltaC > 14) {
        camberHint = "Exceso de caída negativa (interior muy caliente)";
      } else if (camberDeltaC < -2) {
        camberHint = "Falta caída negativa (exterior más caliente)";
      }

      computed[corner] = {
        corner,
        innerC: Number(innerC.toFixed(1)),
        middleC: Number(middleC.toFixed(1)),
        outerC: Number(outerC.toFixed(1)),
        avgC: Number(((innerC + middleC + outerC) / 3).toFixed(1)),
        camberDeltaC: Number(camberDeltaC.toFixed(1)),
        camberHint,
        innerState: this.classifyTemp(innerC),
        middleState: this.classifyTemp(middleC),
        outerState: this.classifyTemp(outerC),
        coldKpa: Number(coldKpa.toFixed(1)),
        hotKpa: Number(hotKpa.toFixed(1)),
        deltaKpa: Number(deltaKpa.toFixed(1)),
        deltaPsi: Number(deltaPsi.toFixed(2)),
      };
    }

    return {
      corners: computed,
      optimalWindowC: [this.optimalMinC, this.optimalMaxC],
      env: {
        trackTempC: Number(finiteOr(input.env?.trackTempC, 28.4).toFixed(1)),
        windSpeedKmh: Number(finiteOr(input.env?.windSpeedKmh, 14.0).toFixed(0)),
        windDirDeg: Math.round(finiteOr(input.env?.windDirDeg, 45)),
        trackWetnessPct: Math.round(finiteOr(input.env?.trackWetnessPct, 0)),
      },
    };
  }
}

export function renderTireThermalWidget(container: HTMLElement, snap: TireThermalSnapshot | null, engine = new TireThermalEngine()): void {
  if (!snap) {
    container.innerHTML = `<div class="p-3 text-xs font-mono text-white/50">Esperando sensores térmicos IMO de iRacing...</div>`;
    return;
  }

  const labelMap: Record<TireCorner, string> = { LF: "FL", RF: "FR", LR: "RL", RR: "RR" };
  const order: TireCorner[] = ["LF", "RF", "LR", "RR"];
  const cards = order
    .map((key) => {
      const t = snap.corners[key];
      const avgState = engine.classifyTemp(t.avgC);
      const avgColor = engine.colorForState(avgState);
      const hotPsi = (t.hotKpa * KPA_TO_PSI).toFixed(1);

      return `
        <div class="p-1.5 rounded bg-black/55 border border-white/10 space-y-1">
          <div class="flex items-center justify-between text-[10px]">
            <span class="font-bold text-white">${labelMap[key]}</span>
            <span class="font-extrabold tabular-nums" style="color:${avgColor}">${t.avgC.toFixed(0)}°C</span>
          </div>
          <div class="flex items-center justify-between text-[9.5px] text-white/75 tabular-nums">
            <span>${t.hotKpa.toFixed(0)} kPa</span>
            <span class="text-white/55">${hotPsi} PSI</span>
          </div>
        </div>
      `;
    })
    .join("");

  const dirArrowStyle = `display:inline-block;transform:rotate(${snap.env.windDirDeg}deg);`;

  container.innerHTML = `
    <div class="space-y-1.5 font-mono">
      <div class="flex items-center justify-between text-[9.5px] border-b border-white/10 pb-1">
        <span class="uppercase tracking-wider text-white/75 font-bold">Tire &amp; Track Monitor</span>
        <span class="text-emerald-300 font-bold">${snap.optimalWindowC[0]}–${snap.optimalWindowC[1]}°C</span>
      </div>
      <div class="grid grid-cols-2 gap-1.5">${cards}</div>
      <div class="flex items-center justify-between text-[9.5px] text-white/80 pt-0.5 border-t border-white/10 tabular-nums">
        <span>Pista <strong class="text-amber-300">${snap.env.trackTempC.toFixed(1)}°C</strong></span>
        <span>Viento <strong class="text-white">${snap.env.windSpeedKmh} km/h</strong> <span style="${dirArrowStyle}">↑</span></span>
        <span>Lluvia <strong class="text-sky-300">${snap.env.trackWetnessPct}%</strong></span>
      </div>
    </div>
  `;
}
