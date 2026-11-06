/**
 * Instantánea de las licencias de miembro de iRacing.
 * Fuente: capturas del titular, 2026-11-06. irating null = la licencia muestra «----».
 * La API en vivo (/api/drivers) sustituye estos valores cuando trae datos reales.
 * No incluye últimas carreras ni coche favorito: eso solo sale de la API.
 */
export const LICENCE_CAPTURED = "2026-11-06";
export const LICENCE_UPDATED_LABEL = "6 nov 2026";
export const LICENCE_SOURCE = "Licencias de miembro de iRacing";

export type LicenceCategory = "oval" | "sports_car" | "formula" | "dirt_oval" | "dirt_road";

export interface Licence {
  category: LicenceCategory;
  label: string;
  classLabel: string;
  sr: string;
  irating: number | null;
  ttRating: number;
  color: string;
}

const CATS: Record<LicenceCategory, { label: string; color: string }> = {
  oval: { label: "Oval", color: "#1F7A45" },
  sports_car: { label: "Sports Car", color: "#1E4F93" },
  formula: { label: "Formula", color: "#A6842A" },
  dirt_oval: { label: "Dirt Oval", color: "#8E3B32" },
  dirt_road: { label: "Dirt Road", color: "#6E3038" },
};

function row(category: LicenceCategory, classLabel: string, sr: string, irating: number | null, ttRating: number): Licence {
  return { category, label: CATS[category].label, classLabel, sr, irating, ttRating, color: CATS[category].color };
}

export const LICENCIAS: Record<string, Licence[]> = {
  mateob: [
    row("oval", "Rookie", "2.50", null, 1350),
    row("sports_car", "Class A", "2.13", 2448, 1093),
    row("formula", "Class D", "2.68", 1426, 1350),
    row("dirt_oval", "Rookie", "2.50", null, 1350),
    row("dirt_road", "Rookie", "2.50", null, 1350),
  ],
  albertot: [
    row("oval", "Class B", "2.67", 1575, 1275),
    row("sports_car", "Class A", "3.13", 3141, 1419),
    row("formula", "Class C", "2.37", 2542, 1348),
    row("dirt_oval", "Rookie", "2.73", null, 1350),
    row("dirt_road", "Rookie", "2.45", null, 1350),
  ],
  eduardoc: [
    row("oval", "Rookie", "2.49", null, 1350),
    row("sports_car", "Class A", "3.47", 1843, 1256),
    row("formula", "Rookie", "2.50", null, 1350),
    row("dirt_oval", "Rookie", "2.50", null, 1350),
    row("dirt_road", "Rookie", "2.50", null, 1350),
  ],
};

export function licenciasDe(slug: string): Licence[] {
  return LICENCIAS[slug] || [];
}

export function licenciaPrincipal(slug: string): Licence | undefined {
  return licenciasDe(slug).find((l) => l.category === "sports_car");
}

export function formatoIr(n: number | null): string {
  return n == null ? "Sin iRating" : n.toLocaleString("es-ES");
}
