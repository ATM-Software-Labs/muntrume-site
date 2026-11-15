/**
 * car-series.ts
 * Empareja cada coche del catálogo con sus series oficiales principales de iRacing
 * definidas en season_schedule_2026_s4.json, incluyendo la foto representativa de la serie.
 */

import type { CarMetadata } from '../../desktop/src/cars/catalog';
import schedule from '../../desktop/src/season_schedule_2026_s4.json';
import seriesLogosData from '../data/iracing-series-logos.json';

export interface CarOfficialSeries {
  id: string;
  name: string;
  category: string;
  tier: string;
  license: string;
  currentTrack?: string;
  image: string;
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

const MAX_MAIN_SERIES = 4;

const CAR_SCHEDULE_ALIASES: Record<string, readonly string[]> = {
  ferrari296challenge: ['ferrari 296 challenge'],
  porsche992cup: ['porsche 911 cup', 'porsche 911 gt3 cup 992'],
  porsche9922cup: ['porsche 911 cup', 'porsche 911 gt3 cup 992'],
  fordgt2017: ['ford gte'],
  fordgt: ['ford gt gt2'],
  bmwm2csr: ['bmw m2 racing', 'm2'],
  bmwm2g87: ['bmw m2 racing', 'm2'],
  mx5cup: ['global mazda mx 5'],
  mx5mx52016: ['global mazda mx 5'],
  mxmx52016: ['global mazda mx 5'],
  audirs3lms: ['audi rs3 lms'],
  audirs3lmsgen2: ['audi rs3 lms'],
  caterham420r: ['caterham 420r', 'caterham academy'],
  caterhamcaterham420r: ['caterham 420r', 'caterham academy'],
  caterhamcaterhamacademy: ['caterham academy', 'caterham 420r'],
  supercarsfordmustanggen3: ['supercars ford mustang gen3'],
  supercarschevycamarogen3: ['supercars chevrolet camaro gen3'],
  superformulasf23honda: ['super formula sf23 honda'],
  superformulasf23toyota: ['super formula sf23 toyota'],
  formulair04: ['fia f4'],
  formulavee: ['formula vee'],
  formulaveeformulavee2: ['formula vee'],
  formulaveeformulavee3: ['formula vee'],
  lotus79: ['lotus 79'],
  stockcars2nextgenfordmustang: ['next gen ford mustang'],
  stockcarsfordmustang2022: ['next gen ford mustang'],
  stockcars2nextgenchevycamaro: ['next gen chevrolet camaro'],
  stockcars2nextgentoyotacamry: ['next gen toyota'],
  stockcarstoyotacamry2022: ['next gen toyota'],
  stockcarsxfinityfordmustang: ['nascar o reilly ford mustang'],
  stockcars2mustang2019: ['nascar o reilly ford mustang'],
  stockcarsxfinitychevycamaro: ['nascar o reilly chevrolet camaro'],
  stockcarsxfinitytoyotasupra: ['nascar o reilly toyota supra'],
  stockcars2supra2019: ['nascar o reilly toyota supra'],
  trucksfordf150: ['nascar truck ford f150'],
  truckssilverado: ['nascar truck chevrolet silverado'],
  truckssilverado2019: ['nascar truck chevrolet silverado'],
  truckstundra: ['nascar truck toyota tundra'],
  truckstoyotatundra2022: ['nascar truck toyota tundra'],
  stockcarsbuicklesabre87: ['nascar legends buick lesabre'],
  stockcarschevymontecarlo87: ['nascar legends chevrolet monte carlo'],
  stockcarsfordthunderbird87: ['nascar legends ford', 'thunderbird 1987'],
  stockcarspontiacgrandprix87: ['nascar legends pontiac grand prix'],
  skmodified: ['modified sk'],
  skmodifiedtour: ['modified nascar whelen tour'],
  tourmodified: ['modified nascar whelen tour'],
  euronascar: ['euro nascar'],
  dirtlatemodel358: ['dirt late model'],
  dirtmicrosprintnonwinged: ['dirt micro sprint car non winged'],
  dirtmicrosprintwinged: ['dirt micro sprint car winged'],
  dirtbigblock: ['dirt big block modified'],
  dirtmodifiedbigblock: ['dirt big block modified'],
};

function normalizeCarToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\brs\s+3\b/g, 'rs3')
    .replace(/\bgen\s+3\b/g, 'gen3')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesScheduleCar(car: CarMetadata, scheduleCarName: string): boolean {
  const fullNorm = normalizeCarToken(`${car.brand} ${car.model}`);
  const modelNorm = normalizeCarToken(car.model);
  const schedNorm = normalizeCarToken(scheduleCarName);

  if (schedNorm.length < 2) return false;
  if (!fullNorm.includes('legacy') && schedNorm.includes('legacy')) return false;

  const carKey = (car.carFolder || '').toLowerCase();
  const aliases = CAR_SCHEDULE_ALIASES[carKey];
  if (aliases && aliases.some((a) => schedNorm === a || schedNorm.includes(a))) {
    return true;
  }

  if (schedNorm === fullNorm) return true;
  if (modelNorm.length >= 6 && schedNorm === modelNorm) return true;

  if (
    schedNorm.length >= 8 &&
    fullNorm.length >= 8 &&
    (schedNorm.includes(fullNorm) || fullNorm.includes(schedNorm))
  ) {
    return true;
  }

  return false;
}

function seriesPriorityScore(sr: ScheduleSeries): number {
  const n = sr.name.toLowerCase();
  let score = 0;

  if (!n.includes('fixed') && !n.includes('regional tour')) score += 25;

  if (
    n.includes('gt sprint') ||
    n.includes('gt endurance') ||
    n.includes('imsa iracing') ||
    n.includes('imsa endurance') ||
    n.includes('porsche cup') ||
    n.includes('super formula') ||
    n.includes('fia formula 4') ||
    n.includes('fia f4') ||
    n.includes('production car') ||
    n.includes('advanced mazda') ||
    n.includes('ferrari 296 challenge') ||
    n.includes('nascar cup') ||
    n.includes("nascar o'reilly") ||
    n.includes('nascar truck') ||
    n.includes('nascar legends') ||
    n.includes('supercars')
  ) {
    score += 100;
  } else if (
    n.includes('ring meister') ||
    n.includes('proto-gt') ||
    n.includes('gt4') ||
    n.includes('tcr') ||
    n.includes('lmp3') ||
    n.includes('formula vee') ||
    n.includes('m2') ||
    n.includes('gt3 challenge')
  ) {
    score += 60;
  }

  if (
    n.includes('regional tour') ||
    n.includes('rain master') ||
    n.includes('creventic') ||
    n.includes('track day') ||
    n.includes('draft master') ||
    n.includes('carburetor') ||
    n.includes('pickup cup')
  ) {
    score -= 40;
  }

  return score;
}

const normSeriesLogoName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(2026|season\s*\d+|fixed|by\s+[a-z0-9.-]+|presented\s+by\s+[a-z0-9.-]+|series|iracing)\b/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const SERIES_LOGO_INDEX = (seriesLogosData as Array<{ name: string; logo: string }>).map((entry) => ({
  logo: entry.logo,
  norm: normSeriesLogoName(entry.name),
  tokens: new Set(normSeriesLogoName(entry.name).split(/\s+/).filter((w) => w.length >= 3)),
}));

function lookupOfficialSeriesLogo(name: string): string {
  const sn = normSeriesLogoName(name);
  if (!sn) return '';
  const direct = SERIES_LOGO_INDEX.find(
    (item) => item.norm === sn || sn.includes(item.norm) || (item.norm.length >= 6 && item.norm.includes(sn))
  );
  if (direct) return direct.logo;
  const tokens = sn.split(/\s+/).filter((w) => w.length >= 3);
  let best = '';
  let bestOverlap = 0;
  for (const item of SERIES_LOGO_INDEX) {
    let overlap = 0;
    for (const t of tokens) {
      if (item.tokens.has(t)) overlap++;
    }
    if (overlap >= 2 && overlap > bestOverlap) {
      bestOverlap = overlap;
      best = item.logo;
    }
  }
  return best;
}

function getSeriesImage(sr: ScheduleSeries): string {
  const official = lookupOfficialSeriesLogo(sr.name);
  if (official) return official;

  const n = sr.name.toLowerCase();
  const c = (sr.category || '').toLowerCase();

  if (n.includes('imsa') || n.includes('proto-gt') || n.includes('global endurance') || n.includes('lmp')) {
    return '/assets/img/series/imsa.jpg';
  }
  if (n.includes('porsche cup') || n.includes('porsche esports')) {
    return '/assets/img/series/porsche-cup.jpg';
  }
  if (c.includes('formula') || n.includes('formula') || n.includes('indy') || n.includes('lotus') || n.includes('vee')) {
    return '/assets/img/series/sfl.jpg';
  }
  if (
    n.includes('production car') ||
    n.includes('mazda') ||
    n.includes('gr86') ||
    n.includes('clio') ||
    n.includes('tcr') ||
    n.includes('gt4') ||
    n.includes('m2') ||
    n.includes('touring')
  ) {
    return '/assets/img/series/pcc.jpg';
  }
  if (n.includes('gt sprint') || n.includes('gt endurance') || n.includes('gt3') || n.includes('ferrari') || n.includes('dtm') || n.includes('ring') || n.includes('nurburgring')) {
    return '/assets/img/series/gt-sprint.jpg';
  }
  return '/assets/img/race1.webp';
}

/**
 * Devuelve las series oficiales principales de la temporada actual en las que participa el coche.
 */
export function getCarOfficialSeries(car: CarMetadata): CarOfficialSeries[] {
  const currentWeekNum = (schedule as { current_week?: number }).current_week ?? 1;
  const allSeries = ((schedule as { series?: ScheduleSeries[] }).series ?? []);

  const matched: Array<{ item: CarOfficialSeries; score: number }> = [];
  for (const sr of allSeries) {
    const cars = sr.cars ?? [];
    if (!cars.some((sc) => matchesScheduleCar(car, sc))) continue;

    const week = (sr.weeks ?? []).find((w) => w.week_num === currentWeekNum);
    matched.push({
      score: seriesPriorityScore(sr),
      item: {
        id: sr.id,
        name: sr.name.replace(/\s*-\s*2026 Season \d+$/i, '').trim(),
        category: sr.category,
        tier: sr.tier,
        license: sr.license,
        currentTrack: week?.track_name,
        image: getSeriesImage(sr),
      },
    });
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, MAX_MAIN_SERIES).map((m) => m.item);
}
