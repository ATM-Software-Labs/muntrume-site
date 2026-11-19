import type { LicenceCategory } from "./licencias";

/** Order of the category control. Sports Car stays first: it is the series the chart opens on. */
export const RATING_CATEGORY_ORDER: LicenceCategory[] = [
  "sports_car",
  "formula",
  "oval",
  "dirt_oval",
  "dirt_road",
];

export const RATING_CATEGORY_LABELS: Record<LicenceCategory, string> = {
  sports_car: "Sports Car",
  formula: "Formula",
  oval: "Oval",
  dirt_oval: "Dirt Oval",
  dirt_road: "Dirt Road",
};

export interface RatingPoint {
  date: string;
  label: string;
  irating: number;
  sr: number;
  /** Set only by the daily iRacing fetch. Older published points have no source. */
  source?: "iracing";
  classLabel?: string;
}

/**
 * A category is offered as a control when its series exists and the iRating is real:
 * the member licence shows a number (not «----» / null), or a fetched point is tagged
 * `source: "iracing"`. A flat 1,350 placeholder with a null licence iRating stays in
 * the file but is not a button.
 */
export function selectableCategories(
  history: Partial<Record<string, Pick<RatingPoint, "irating" | "source">[]>> | undefined,
  licenses: { category: string; irating: number | null }[],
): LicenceCategory[] {
  const row = history || {};
  return RATING_CATEGORY_ORDER.filter((cat) => {
    const series = row[cat];
    if (!Array.isArray(series) || series.length === 0) return false;
    const lic = licenses.find((item) => item.category === cat);
    if (lic && typeof lic.irating === "number" && lic.irating > 0) return true;
    return series.some((point) => point.source === "iracing" && typeof point.irating === "number" && point.irating > 0);
  });
}
