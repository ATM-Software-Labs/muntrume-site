import catalog from "../../public/assets/data/catalog_index.json";

export type SetupKind = "race" | "qualy" | "wet" | "endurance";

export interface CatalogSetup {
  id: number;
  file: string;
  kind: SetupKind;
  typeLabel: string;
  car: string;
  carLabel: string;
  track: string;
  season: string;
  week: string;
  sizeKb: number;
}

export interface CatalogGroup {
  key: string;
  track: string;
  car: string;
  carLabel: string;
  season: string;
  week: string;
  setups: CatalogSetup[];
  counts: Record<SetupKind, number>;
}

/** Nombres ya usados en el catálogo del vault. Si falta uno, se muestra el id real. */
const CAR_LABELS: Record<string, string> = {
  acuraarx06gtp: "Acura ARX-06 GTP",
  acuransxevo22gt3: "Acura NSX EVO22 GT3",
  amvalkyriegtp: "Aston Martin Valkyrie GTP",
  amvantageevogt3: "Aston Martin Vantage EVO GT3",
  amvantagegt4: "Aston Martin Vantage GT4",
  "astonmartin dbr9": "Aston Martin DBR9 GT1",
  audi90gto: "Audi 90 GTO",
  audir8gt3: "Audi R8 LMS GT3",
  audir8lmsevo2gt3: "Audi R8 LMS EVO II GT3",
  audirs3lms: "Audi RS 3 LMS TCR",
  audirs3lmsgen2: "Audi RS 3 LMS Gen 2 TCR",
  bmwlmdh: "BMW M Hybrid V8 GTP",
  bmwm2csr: "BMW M2 CS Racing",
  bmwm2g87: "BMW M2 CS (G87)",
  bmwm4evogt4: "BMW M4 EVO GT4",
  bmwm4gt3: "BMW M4 GT3",
  bmwm4gt4: "BMW M4 GT4",
  bmwm8gte: "BMW M8 GTE",
  c6r: "Corvette C6.R GT1",
  c8rvettegte: "Corvette C8.R GTE",
  cadillacvseriesrgtp: "Cadillac V-Series.R GTP",
  "caterham caterham420r": "Caterham Seven 420R",
  "caterham caterhamacademy": "Caterham Academy",
  chevyvettez06rgt3: "Corvette Z06 GT3.R",
  dallaraf3: "Dallara F3",
  dallarair01: "Dallara IR-01",
  dallarair18: "Dallara IR-18 Indycar",
  dallarap217: "Dallara P217 LMP2",
  ferrari296gt3: "Ferrari 296 GT3",
  ferrari488gte: "Ferrari 488 GTE",
  ferrari499p: "Ferrari 499P Hypercar",
  fordgt: "Ford GT GT2",
  fordgt2017: "Ford GT GTE 2017",
  fordmustanggt3: "Ford Mustang GT3",
  fordmustanggt4: "Ford Mustang GT4",
  formulair04: "FIA Formula 4 (iR-04)",
  formulavee: "Formula Vee",
  hondacivictyper: "Honda Civic Type R TCR",
  hpdarx01c: "HPD ARX-01c LMP2",
  hyundaielantracn7: "Hyundai Elantra N TCR",
  hyundaivelostern: "Hyundai Veloster N TCR",
  lamborghinievogt3: "Lamborghini Huracán EVO GT3",
  ligierjsp320: "Ligier JS P320 LMP3",
  mclaren570sgt4: "McLaren 570S GT4",
  mclaren720sgt3: "McLaren 720S GT3",
  mercedesamgevogt3: "Mercedes-AMG GT3 EVO",
  mercedesamggt3: "Mercedes-AMG GT3",
  mercedesamggt4: "Mercedes-AMG GT4",
  "mx5 cup": "Mazda MX-5 Cup",
  nissangtpzxt: "Nissan GTP ZX-T",
  porsche718gt4: "Porsche 718 Cayman GT4",
  porsche963gtp: "Porsche 963 GTP",
  porsche991rsr: "Porsche 991 RSR GTE",
  porsche9922cup: "Porsche 992 Cup (2.0)",
  porsche992cup: "Porsche 911 GT3 Cup (992)",
  porsche992rgt3: "Porsche 992 GT3 R",
  toyotagr86: "Toyota GR86",
};

type CatalogRow = [number, string, string, string, string, string, string, number];

function kindOf(type: string, file: string): SetupKind {
  const t = String(type || "").toLowerCase();
  if (t === "qualy") return "qualy";
  if (t === "wet") return "wet";
  if (/end/i.test(file)) return "endurance";
  return "race";
}

function emptyCounts(): Record<SetupKind, number> {
  return { race: 0, qualy: 0, wet: 0, endurance: 0 };
}

export function catalogGroups(): CatalogGroup[] {
  const rows = (catalog.initial_rows || []) as CatalogRow[];
  const map = new Map<string, CatalogGroup>();
  for (const row of rows) {
    const [id, car, season, week, track, file, type, bytes] = row;
    if (!file || !car || !track) continue;
    const kind = kindOf(String(type), String(file));
    const carLabel = CAR_LABELS[car] || car;
    const key = `${track}|${car}|${season}|${week}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        track,
        car,
        carLabel,
        season,
        week,
        setups: [],
        counts: emptyCounts(),
      };
      map.set(key, group);
    }
    const sizeBytes = Number(bytes);
    group.setups.push({
      id: Number(id),
      file: String(file),
      kind,
      typeLabel: String(type || ""),
      car: String(car),
      carLabel,
      track: String(track),
      season: String(season),
      week: String(week),
      sizeKb: Number.isFinite(sizeBytes) ? Math.round((sizeBytes / 1024) * 10) / 10 : 0,
    });
    group.counts[kind] += 1;
  }
  return Array.from(map.values());
}

export const CATALOG_TOTAL = Number(catalog.total_setups) || 0;
