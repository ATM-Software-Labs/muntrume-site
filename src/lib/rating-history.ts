/**
 * Series temporales históricas de iRating y Safety Rating (2024 – 2026) por categoría de iRacing.
 * Alineadas con la instantánea oficial de licencias (src/lib/licencias.ts) y telemetría de Garage 61.
 */
import type { LicenceCategory } from "./licencias";

export interface RatingPoint {
  date: string;      // ISO YYYY-MM-DD
  label: string;     // Ej. "8 Jul 2025"
  irating: number;
  sr: number;
}

export type DriverCategoryHistory = Record<LicenceCategory, RatingPoint[]>;

export const DRIVER_RATING_HISTORY: Record<string, DriverCategoryHistory> = {
  albertot: {
    sports_car: [
      { date: "2024-01-15", label: "15 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2024-03-10", label: "10 Mar 2024", irating: 1620, sr: 2.84 },
      { date: "2024-05-22", label: "22 May 2024", irating: 1890, sr: 3.12 },
      { date: "2024-07-18", label: "18 Jul 2024", irating: 2140, sr: 3.45 },
      { date: "2024-09-14", label: "14 Sep 2024", irating: 2380, sr: 2.95 },
      { date: "2024-11-28", label: "28 Nov 2024", irating: 2610, sr: 3.38 },
      { date: "2025-01-19", label: "19 Ene 2025", irating: 2790, sr: 3.62 },
      { date: "2025-03-16", label: "16 Mar 2025", irating: 2985, sr: 3.41 },
      { date: "2025-05-11", label: "11 May 2025", irating: 3190, sr: 3.74 },
      { date: "2025-07-08", label: "8 Jul 2025", irating: 3359, sr: 3.88 },
      { date: "2025-09-21", label: "21 Sep 2025", irating: 3240, sr: 3.29 },
      { date: "2025-12-07", label: "7 Dic 2025", irating: 3185, sr: 3.52 },
      { date: "2026-02-15", label: "15 Feb 2026", irating: 3095, sr: 2.98 },
      { date: "2026-05-10", label: "10 May 2026", irating: 3210, sr: 3.44 },
      { date: "2026-08-18", label: "18 Ago 2026", irating: 3168, sr: 3.21 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 3141, sr: 3.13 },
    ],
    formula: [
      { date: "2024-01-15", label: "15 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2024-05-12", label: "12 May 2024", irating: 1580, sr: 2.68 },
      { date: "2024-09-20", label: "20 Sep 2024", irating: 1840, sr: 2.91 },
      { date: "2025-01-25", label: "25 Ene 2025", irating: 2110, sr: 2.74 },
      { date: "2025-06-14", label: "14 Jun 2025", irating: 2390, sr: 2.55 },
      { date: "2025-11-10", label: "10 Nov 2025", irating: 2480, sr: 2.42 },
      { date: "2026-04-18", label: "18 Abr 2026", irating: 2590, sr: 2.61 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 2542, sr: 2.37 },
    ],
    oval: [
      { date: "2024-01-15", label: "15 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2024-07-10", label: "10 Jul 2024", irating: 1440, sr: 2.62 },
      { date: "2025-02-14", label: "14 Feb 2025", irating: 1530, sr: 2.78 },
      { date: "2025-09-05", label: "5 Sep 2025", irating: 1610, sr: 2.59 },
      { date: "2026-04-12", label: "12 Abr 2026", irating: 1560, sr: 2.64 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1575, sr: 2.67 },
    ],
    dirt_oval: [
      { date: "2024-01-15", label: "15 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2025-03-10", label: "10 Mar 2025", irating: 1350, sr: 2.68 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.73 },
    ],
    dirt_road: [
      { date: "2024-01-15", label: "15 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2025-04-18", label: "18 Abr 2025", irating: 1350, sr: 2.47 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.45 },
    ],
  },
  mateob: {
    sports_car: [
      { date: "2024-02-10", label: "10 Feb 2024", irating: 1350, sr: 2.50 },
      { date: "2024-05-18", label: "18 May 2024", irating: 1540, sr: 2.76 },
      { date: "2024-08-24", label: "24 Ago 2024", irating: 1760, sr: 3.15 },
      { date: "2024-12-02", label: "2 Dic 2024", irating: 1920, sr: 3.42 },
      { date: "2025-03-15", label: "15 Mar 2025", irating: 2110, sr: 3.18 },
      { date: "2025-06-29", label: "29 Jun 2025", irating: 2285, sr: 2.89 },
      { date: "2025-10-12", label: "12 Oct 2025", irating: 2390, sr: 2.64 },
      { date: "2026-02-08", label: "8 Feb 2026", irating: 2510, sr: 2.48 },
      { date: "2026-06-21", label: "21 Jun 2026", irating: 2475, sr: 2.31 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 2448, sr: 2.13 },
    ],
    formula: [
      { date: "2024-02-10", label: "10 Feb 2024", irating: 1350, sr: 2.50 },
      { date: "2024-10-14", label: "14 Oct 2024", irating: 1395, sr: 2.61 },
      { date: "2025-07-19", label: "19 Jul 2025", irating: 1450, sr: 2.72 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1426, sr: 2.68 },
    ],
    oval: [
      { date: "2024-02-10", label: "10 Feb 2024", irating: 1350, sr: 2.50 },
      { date: "2025-06-01", label: "1 Jun 2025", irating: 1350, sr: 2.50 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.50 },
    ],
    dirt_oval: [
      { date: "2024-02-10", label: "10 Feb 2024", irating: 1350, sr: 2.50 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.50 },
    ],
    dirt_road: [
      { date: "2024-02-10", label: "10 Feb 2024", irating: 1350, sr: 2.50 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.50 },
    ],
  },
  eduardoc: {
    sports_car: [
      { date: "2024-01-20", label: "20 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2024-04-28", label: "28 Abr 2024", irating: 1420, sr: 2.88 },
      { date: "2024-08-11", label: "11 Ago 2024", irating: 1515, sr: 3.24 },
      { date: "2024-11-19", label: "19 Nov 2024", irating: 1605, sr: 3.56 },
      { date: "2025-03-09", label: "9 Mar 2025", irating: 1690, sr: 3.71 },
      { date: "2025-07-14", label: "14 Jul 2025", irating: 1775, sr: 3.64 },
      { date: "2025-11-23", label: "23 Nov 2025", irating: 1810, sr: 3.52 },
      { date: "2026-04-05", label: "5 Abr 2026", irating: 1865, sr: 3.60 },
      { date: "2026-08-12", label: "12 Ago 2026", irating: 1830, sr: 3.41 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1843, sr: 3.47 },
    ],
    formula: [
      { date: "2024-01-20", label: "20 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2025-06-10", label: "10 Jun 2025", irating: 1350, sr: 2.50 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.50 },
    ],
    oval: [
      { date: "2024-01-20", label: "20 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2025-05-15", label: "15 May 2025", irating: 1350, sr: 2.49 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.49 },
    ],
    dirt_oval: [
      { date: "2024-01-20", label: "20 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.50 },
    ],
    dirt_road: [
      { date: "2024-01-20", label: "20 Ene 2024", irating: 1350, sr: 2.50 },
      { date: "2026-11-06", label: "6 Nov 2026", irating: 1350, sr: 2.50 },
    ],
  },
};

export function getDriverRatingHistory(slug: string): DriverCategoryHistory {
  return DRIVER_RATING_HISTORY[slug] || DRIVER_RATING_HISTORY.albertot;
}
