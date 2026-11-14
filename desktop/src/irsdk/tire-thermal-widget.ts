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

export interface TireThermalInput {
  onPitRoad: boolean;
  LF: TireCornerInput;
  RF: TireCornerInput;
  LR: TireCornerInput;
  RR: TireCornerInput;
}

export type ThermalZoneState = "cold" | "optimal" | "hot";

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
}

const KPA_TO_PSI = 0.1450377;

export class TireThermalEngine {
  private coldBaseline: Partial<Record<TireCorner, number>> = {};
  private wasOnPitRoad = true;
  private optimalMinC = 60;
  private optimalMaxC = 95;

  public setOptimalWindow(minC: number, maxC: number): void {
    this.optimalMinC = finiteOr(minC, 60);
    this.optimalMaxC = Math.max(this.optimalMinC + 5, finiteOr(maxC, 95));
  }

  public resetColdBaseline(): void {
    this.coldBaseline = {};
  }

  public classifyTemp(tempC: number): ThermalZoneState {
    if (tempC < this.optimalMinC) return "cold";
    if (tempC > this.optimalMaxC) return "hot";
    return "optimal";
  }

  public colorForState(state: ThermalZoneState): string {
    if (state === "cold") return "#38bdf8";
    if (state === "hot") return "#f87171";
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
    };
  }
}

export function renderTireThermalWidget(container: HTMLElement, snap: TireThermalSnapshot | null, engine = new TireThermalEngine()): void {
  if (!snap) {
    container.innerHTML = `<div class="p-3 text-xs font-mono text-white/50">Esperando sensores térmicos IMO de iRacing...</div>`;
    return;
  }

  const order: TireCorner[] = ["LF", "RF", "LR", "RR"];
  const cards = order
    .map((key) => {
      const t = snap.corners[key];
      const isLeft = key.startsWith("L");
      const zones = isLeft
        ? [
            { label: "O", temp: t.outerC, state: t.outerState },
            { label: "M", temp: t.middleC, state: t.middleState },
            { label: "I", temp: t.innerC, state: t.innerState },
          ]
        : [
            { label: "I", temp: t.innerC, state: t.innerState },
            { label: "M", temp: t.middleC, state: t.middleState },
            { label: "O", temp: t.outerC, state: t.outerState },
          ];

      const bars = zones
        .map((z) => {
          const col = engine.colorForState(z.state);
          return `
            <div class="flex-1 rounded p-1 text-center border border-white/10" style="background:${col}22;border-color:${col}66">
              <div class="text-[8px] text-white/60">${z.label}</div>
              <div class="text-[11px] font-bold" style="color:${col}">${z.temp.toFixed(0)}°</div>
            </div>
          `;
        })
        .join("");

      const signKpa = t.deltaKpa >= 0 ? "+" : "";
      const signPsi = t.deltaPsi >= 0 ? "+" : "";
      const signCamber = t.camberDeltaC >= 0 ? "+" : "";

      return `
        <div class="p-2.5 rounded-lg bg-black/50 border border-white/10 space-y-1.5">
          <div class="flex items-center justify-between text-[10px]">
            <span class="font-bold text-white">${key}</span>
            <span class="text-white/60">ΔCamber ${signCamber}${t.camberDeltaC.toFixed(1)}°C</span>
          </div>
          <div class="flex gap-1">${bars}</div>
          <div class="flex items-center justify-between text-[10px] pt-0.5">
            <span class="text-white/75">${t.hotKpa.toFixed(1)} kPa <span class="text-white/40">(frío ${t.coldKpa.toFixed(0)})</span></span>
            <span class="font-bold text-amber-300">${signKpa}${t.deltaKpa.toFixed(1)} kPa / ${signPsi}${t.deltaPsi.toFixed(2)} PSI</span>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="space-y-2 font-mono">
      <div class="flex items-center justify-between text-[10px] border-b border-white/10 pb-1.5">
        <span class="uppercase tracking-wider text-white/60">Térmico IMO &amp; Presiones</span>
        <span class="text-emerald-300">Ventana ${snap.optimalWindowC[0]}–${snap.optimalWindowC[1]}°C</span>
      </div>
      <div class="grid grid-cols-2 gap-2">${cards}</div>
    </div>
  `;
}
