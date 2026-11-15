/**
 * MMT Sync — DigiFlag Session Flags Engine (Bloque 2)
 * High-framerate digital flag matrix decoding iRacing SDK SessionFlags bitmask.
 * Displays high-contrast animated flags (Green, Yellow Local, FCY/Safety Car, Blue,
 * White, Checkered, Meatball / Black Flag, DQ) with priority-based sorting.
 */

export type FlagType =
  | "clear"
  | "green"
  | "yellow_local"
  | "safety_car"
  | "blue"
  | "white"
  | "checkered"
  | "red"
  | "meatball"
  | "black"
  | "disqualify";

export interface FlagDescriptor {
  type: FlagType;
  label: string;
  subLabel?: string;
  bgColor: string;
  fgColor: string;
  borderColor: string;
  pulse: boolean;
  priority: number; // Higher number = higher priority
}

export class DigiFlagEngine {
  /**
   * Decodes iRacing SessionFlags integer bitmask into active flags sorted by priority
   */
  public decodeFlags(sessionFlags: number): FlagDescriptor[] {
    const active: FlagDescriptor[] = [];

    // Black flag (irsdk_black = 0x00010000), Disqualified (irsdk_disqualify = 0x00020000),
    // Meatball / Mandatory repair (irsdk_repair = 0x00200000)
    // Note: 0x00040000 is irsdk_servicible (in pits/eligible for service), NOT meatball!
    if (sessionFlags & 0x00020000) {
      active.push({
        type: "disqualify",
        label: "DESCALIFICADO",
        subLabel: "DIRÍGETE AL PITLANE",
        bgColor: "#000000",
        fgColor: "#ef4444",
        borderColor: "#ef4444",
        pulse: true,
        priority: 100,
      });
    }

    if (sessionFlags & 0x00200000) {
      active.push({
        type: "meatball",
        label: "BANDERA NEGRA / DISCO NARANJA",
        subLabel: "REPARACIÓN OBLIGATORIA",
        bgColor: "#171717",
        fgColor: "#f97316",
        borderColor: "#f97316",
        pulse: true,
        priority: 95,
      });
    }

    if (sessionFlags & 0x00010000) {
      active.push({
        type: "black",
        label: "BANDERA NEGRA",
        subLabel: "SANCIÓN DE DIRECCIÓN DE CARRERA",
        bgColor: "#000000",
        fgColor: "#ffffff",
        borderColor: "#e5e5e5",
        pulse: true,
        priority: 90,
      });
    }

    if (sessionFlags & 0x00000010) {
      active.push({
        type: "red",
        label: "BANDERA ROJA",
        subLabel: "SESIÓN DETENIDA",
        bgColor: "#dc2626",
        fgColor: "#ffffff",
        borderColor: "#ef4444",
        pulse: true,
        priority: 85,
      });
    }

    // Full Course Yellow / Caution / Safety Car
    if ((sessionFlags & 0x00004000) || (sessionFlags & 0x00000100)) {
      active.push({
        type: "safety_car",
        label: "SAFETY CAR / CAUTION",
        subLabel: "FULL COURSE YELLOW",
        bgColor: "#ca8a04",
        fgColor: "#000000",
        borderColor: "#facc15",
        pulse: true,
        priority: 80,
      });
    }

    // Yellow local / sector
    if (sessionFlags & 0x00000008) {
      active.push({
        type: "yellow_local",
        label: "BANDERA AMARILLA",
        subLabel: "INCIDENTE EN SECTOR · NO ADELANTAR",
        bgColor: "#eab308",
        fgColor: "#000000",
        borderColor: "#fde047",
        pulse: true,
        priority: 70,
      });
    }

    // Blue flag (faster car approaching)
    if (sessionFlags & 0x00000020) {
      active.push({
        type: "blue",
        label: "BANDERA AZUL",
        subLabel: "DEJA PASAR AL COCHE QUE TE DOBLA",
        bgColor: "#2563eb",
        fgColor: "#ffffff",
        borderColor: "#60a5fa",
        pulse: false,
        priority: 60,
      });
    }

    // Checkered flag (finish)
    if (sessionFlags & 0x00000001) {
      active.push({
        type: "checkered",
        label: "META · BANDERA A CUADROS",
        subLabel: "FIN DE CARRERA",
        bgColor: "#171717",
        fgColor: "#ffffff",
        borderColor: "#ffffff",
        pulse: false,
        priority: 50,
      });
    }

    // White flag (last lap)
    if (sessionFlags & 0x00000002) {
      active.push({
        type: "white",
        label: "ÚLTIMA VUELTA",
        subLabel: "FINAL LAP",
        bgColor: "#f8fafc",
        fgColor: "#0f172a",
        borderColor: "#ffffff",
        pulse: false,
        priority: 40,
      });
    }

    // Green flag
    if (sessionFlags & 0x00000004) {
      active.push({
        type: "green",
        label: "BANDERA VERDE",
        subLabel: "PISTA LIBRE",
        bgColor: "#16a34a",
        fgColor: "#ffffff",
        borderColor: "#22c55e",
        pulse: false,
        priority: 30,
      });
    }

    if (active.length === 0) {
      active.push({
        type: "clear",
        label: "PISTA VERDE",
        subLabel: "ALL CLEAR",
        bgColor: "rgba(22, 163, 74, 0.15)",
        fgColor: "#4ade80",
        borderColor: "rgba(34, 197, 94, 0.3)",
        pulse: false,
        priority: 0,
      });
    }

    return active.sort((a, b) => b.priority - a.priority);
  }

  public getPrimaryFlag(sessionFlags: number): FlagDescriptor {
    return this.decodeFlags(sessionFlags)[0];
  }

  public render(container: HTMLElement, sessionFlags: number): void {
    const primary = this.getPrimaryFlag(sessionFlags);
    const isClear = primary.type === "clear";
    const isAlertFlag =
      primary.type === "disqualify" ||
      primary.type === "meatball" ||
      primary.type === "black" ||
      primary.type === "red" ||
      primary.type === "safety_car" ||
      primary.type === "yellow_local" ||
      primary.type === "blue" ||
      primary.type === "checkered" ||
      primary.type === "white";

    if (isClear || !isAlertFlag) {
      container.style.display = "none";
      if (container.innerHTML !== "") container.innerHTML = "";
      return;
    }

    container.style.display = "";
    const pulseClass = primary.pulse ? "animate-pulse shadow-lg" : "";

    container.innerHTML = `
      <div class="px-2.5 py-1 rounded-lg border flex items-center justify-between gap-2 font-mono select-none ${pulseClass}"
        style="background-color: ${primary.bgColor}; color: ${primary.fgColor}; border-color: ${primary.borderColor};">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full border border-white/40 flex items-center justify-center"
            style="background-color: ${primary.borderColor};">
            <div class="w-1 h-1 rounded-full bg-white"></div>
          </div>
          <div>
            <div class="text-[10px] font-black tracking-wider uppercase leading-none">${primary.label}</div>
            ${primary.subLabel ? `<div class="text-[8px] font-medium opacity-85 leading-tight mt-0.5">${primary.subLabel}</div>` : ""}
          </div>
        </div>
      </div>
    `;
  }
}
