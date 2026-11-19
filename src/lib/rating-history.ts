/**
 * Series temporales de iRating y Safety Rating por categoría de iRacing.
 * El histórico publicado está en src/data/rating-history.json.
 * scripts/refresh-ratings.mjs añade un punto por día de Madrid solo cuando la
 * iRacing Data API devuelve iRating y Safety Rating medidos. Si la petición
 * falla, el archivo no se reescribe.
 */
import raw from "../data/rating-history.json";
import type { LicenceCategory } from "./licencias";
import type { RatingPoint } from "./rating-series";

export type { RatingPoint };
export { selectableCategories, RATING_CATEGORY_LABELS, RATING_CATEGORY_ORDER } from "./rating-series";

export type DriverCategoryHistory = Record<LicenceCategory, RatingPoint[]>;

export const DRIVER_RATING_HISTORY = raw as Record<string, DriverCategoryHistory>;

const EMPTY_HISTORY = (): DriverCategoryHistory => ({
  oval: [],
  sports_car: [],
  formula: [],
  dirt_oval: [],
  dirt_road: [],
});

export function getDriverRatingHistory(slug: string): DriverCategoryHistory {
  const row = DRIVER_RATING_HISTORY[slug];
  if (!row) return EMPTY_HISTORY();
  return {
    oval: row.oval ?? [],
    sports_car: row.sports_car ?? [],
    formula: row.formula ?? [],
    dirt_oval: row.dirt_oval ?? [],
    dirt_road: row.dirt_road ?? [],
  };
}
