/**
 * car-series.ts
 * Empareja cada coche del catálogo con las series oficiales de iRacing
 * definidas en season_schedule_2026_s4.json.
 */

import type { CarMetadata } from '../../desktop/src/cars/catalog';
import schedule from '../../desktop/src/season_schedule_2026_s4.json';

export interface CarOfficialSeries {
  id: string;
  name: string;
  category: string;
  tier: string;
  license: string;
  currentTrack?: string;
}

interface ScheduleWeek {
  week_num: number;
  track_name: string;
}

interface ScheduleSeries {
  id: string;
  name: string;
  category: string;
  tier: string;
  license: string;
  cars?: string[];
  weeks?: ScheduleWeek[];
}

function normalizeCarToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesScheduleCar(car: CarMetadata, scheduleCarName: string): boolean {
  const fullNorm = normalizeCarToken(`${car.brand} ${car.model}`);
  const modelNorm = normalizeCarToken(car.model);
  const schedNorm = normalizeCarToken(scheduleCarName);

  if (schedNorm.length < 7) return false;
  if (!fullNorm.includes('legacy') && schedNorm.includes('legacy')) return false;

  if (schedNorm === fullNorm) return true;
  if (modelNorm.length >= 8 && schedNorm === modelNorm) return true;

  if (
    schedNorm.length >= 10 &&
    fullNorm.length >= 10 &&
    (schedNorm.includes(fullNorm) || fullNorm.includes(schedNorm))
  ) {
    return true;
  }

  return false;
}

/**
 * Devuelve las series oficiales de la temporada actual en las que participa el coche.
 */
export function getCarOfficialSeries(car: CarMetadata): CarOfficialSeries[] {
  const currentWeekNum = (schedule as { current_week?: number }).current_week ?? 1;
  const allSeries = ((schedule as { series?: ScheduleSeries[] }).series ?? []);

  const matched: CarOfficialSeries[] = [];
  for (const sr of allSeries) {
    const cars = sr.cars ?? [];
    if (!cars.some((sc) => matchesScheduleCar(car, sc))) continue;

    const week = (sr.weeks ?? []).find((w) => w.week_num === currentWeekNum);
    matched.push({
      id: sr.id,
      name: sr.name.replace(/\s*-\s*2026 Season \d+$/i, '').trim(),
      category: sr.category,
      tier: sr.tier,
      license: sr.license,
      currentTrack: week?.track_name,
    });
  }

  return matched;
}
