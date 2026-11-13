import { OFFICIAL_BRAND_PATHS } from "./brand-icons";

export type CarClass = "GTP" | "LMP2" | "LMP3" | "GT3" | "GT4" | "GTE" | "Formula" | "Touring" | "Oval" | "Dirt" | "Prototype";
export type CarCategory = "Sports Car" | "Formula Car" | "Oval" | "Dirt";

export interface CarMetadata {
  readonly carFolder: string;
  readonly brand: string;
  readonly model: string;
  readonly carClass: CarClass;
  readonly category: CarCategory;
  readonly svgLogoId: string;
  readonly accentColor: string;
  readonly specs: string;
  readonly manualUrl: string;
  readonly forumUrl: string;
  readonly previewImg?: string;
}

const PREVIEW_IMG_BY_KEY: Record<string, string> = {
  porsche963gtp: "/assets/cars/porsche963gtp.webp",
  porsche963: "/assets/cars/porsche963.webp",
  ferrari499p: "/assets/cars/ferrari499p.webp",
  bmwmhybridv8: "/assets/cars/bmwmhybridv8.webp",
  bmwlmdh: "/assets/cars/bmwlmdh.webp",
  acuraarx06gtp: "/assets/cars/acuraarx06gtp.webp",
  cadillacvseriesrgtp: "/assets/cars/cadillacvseriesrgtp.webp",
  amvalkyriegtp: "/assets/cars/amvalkyriegtp.webp",
  dallarap217: "/assets/cars/dallarap217.webp",
  hpdarx01c: "/assets/cars/hpdarx01c.webp",
  ligierjsp320: "/assets/cars/ligierjsp320.webp",
  ferrari296gt3: "/assets/cars/ferrari296gt3.webp",
  porsche992rgt3: "/assets/cars/porsche992rgt3.webp",
  bmwm4gt3: "/assets/cars/bmwm4gt3.webp",
  mercedesamggt3: "/assets/cars/mercedesamggt3.webp",
  mercedesamgevogt3: "/assets/cars/mercedesamgevogt3.webp",
  audir8gt3: "/assets/cars/audir8gt3.webp",
  audir8lmsevo2gt3: "/assets/cars/audir8lmsevo2gt3.webp",
  mclaren720sgt3: "/assets/cars/mclaren720sgt3.webp",
  chevyvettez06rgt3: "/assets/cars/chevyvettez06rgt3.webp",
  fordmustanggt3: "/assets/cars/fordmustanggt3.webp",
  lamborghinievogt3: "/assets/cars/lamborghinievogt3.webp",
  acuransxevo22gt3: "/assets/cars/acuransxevo22gt3.webp",
  amvantageevogt3: "/assets/cars/amvantageevogt3.webp",
  porsche992cup: "/assets/cars/porsche992cup.webp",
  porsche9922cup: "/assets/cars/porsche9922cup.webp",
  amvantagegt4: "/assets/cars/amvantagegt4.webp",
  bmwm4gt4: "/assets/cars/bmwm4gt4.webp",
  bmwm4evogt4: "/assets/cars/bmwm4evogt4.webp",
  fordmustanggt4: "/assets/cars/fordmustanggt4.webp",
  mclaren570sgt4: "/assets/cars/mclaren570sgt4.webp",
  mercedesamggt4: "/assets/cars/mercedesamggt4.webp",
  porsche718gt4: "/assets/cars/porsche718gt4.webp",
  ferrari488gte: "/assets/cars/ferrari488gte.webp",
  bmwm8gte: "/assets/cars/bmwm8gte.webp",
  c8rvettegte: "/assets/cars/c8rvettegte.webp",
  c6r: "/assets/cars/c6r.webp",
  porsche991rsr: "/assets/cars/porsche991rsr.webp",
  fordgt2017: "/assets/cars/fordgt2017.webp",
  fordgt: "/assets/cars/fordgt.webp",
  astonmartindbr9: "/assets/cars/astonmartindbr9.webp",
  bmwm2csr: "/assets/cars/bmwm2csr.webp",
  bmwm2g87: "/assets/cars/bmwm2g87.webp",
  toyotagr86: "/assets/cars/toyotagr86.webp",
  mx5cup: "/assets/cars/mx5cup.webp",
  mx5mx52016: "/assets/cars/mx5mx52016.webp",
  mxmx52016: "/assets/cars/mxmx52016.webp",
  renaultcliocup: "/assets/cars/renaultcliocup.webp",
  hondacivictyper: "/assets/cars/hondacivictyper.webp",
  hyundaielantracn7: "/assets/cars/hyundaielantracn7.webp",
  hyundaivelostern: "/assets/cars/hyundaivelostern.webp",
  audirs3lms: "/assets/cars/audirs3lms.webp",
  audirs3lmsgen2: "/assets/cars/audirs3lmsgen2.webp",
  audi90gto: "/assets/cars/audi90gto.webp",
  caterham420r: "/assets/cars/caterham420r.webp",
  caterhamcaterham420r: "/assets/cars/caterhamcaterham420r.webp",
  caterhamcaterhamacademy: "/assets/cars/caterhamcaterhamacademy.webp",
  supercarsfordmustanggen3: "/assets/cars/supercarsfordmustanggen3.webp",
  supercarschevycamarogen3: "/assets/cars/supercarschevycamarogen3.webp",
  v8supercarsholden2019: "/assets/cars/v8supercarsholden2019.webp",
  superformulalights324: "/assets/cars/superformulalights324.webp",
  superformulasf23honda: "/assets/cars/superformulasf23honda.webp",
  superformulasf23toyota: "/assets/cars/superformulasf23toyota.webp",
  dallaraf3: "/assets/cars/dallaraf3.webp",
  dallarair18: "/assets/cars/dallarair18.webp",
  dallarair01: "/assets/cars/dallarair01.webp",
  indypropm18: "/assets/cars/indypropm18.webp",
  mercedesw13: "/assets/cars/mercedesw13.webp",
  formulair04: "/assets/cars/formulair04.webp",
  raygr22: "/assets/cars/raygr22.webp",
  formulavee: "/assets/cars/formulavee.webp",
  formulaveeformulavee2: "/assets/cars/formulaveeformulavee2.webp",
  formulaveeformulavee3: "/assets/cars/formulaveeformulavee3.webp",
  rt2000: "/assets/cars/rt2000.webp",
  lotus79: "/assets/cars/lotus79.webp",
  radicalsr8: "/assets/cars/radicalsr8.webp",
  specracer: "/assets/cars/specracer.webp",
  nissangtpzxt: "/assets/cars/nissangtpzxt.webp",
  stockcarsfordmustang2022: "/assets/cars/stockcarsfordmustang2022.webp",
  stockcarschevycamarozl12022: "/assets/cars/stockcarschevycamarozl12022.webp",
  stockcarstoyotacamry2022: "/assets/cars/stockcarstoyotacamry2022.webp",
  stockcarsfordfusion: "/assets/cars/stockcarsfordfusion.webp",
  stockcars2mustang2019: "/assets/cars/stockcars2mustang2019.webp",
  stockcars2camaro2019: "/assets/cars/stockcars2camaro2019.webp",
  stockcars2supra2019: "/assets/cars/stockcars2supra2019.webp",
  trucksfordf150: "/assets/cars/trucksfordf150.webp",
  truckssilverado: "/assets/cars/truckssilverado.webp",
  truckssilverado2019: "/assets/cars/truckssilverado2019.webp",
  truckstoyotatundra2022: "/assets/cars/truckstoyotatundra2022.webp",
  stockcarsbuicklesabre87: "/assets/cars/stockcarsbuicklesabre87.webp",
  stockcarschevymontecarlo87: "/assets/cars/stockcarschevymontecarlo87.webp",
  stockcarsfordthunderbird87: "/assets/cars/stockcarsfordthunderbird87.webp",
  stockcarspontiacgrandprix87: "/assets/cars/stockcarspontiacgrandprix87.webp",
  legendsford34c: "/assets/cars/legendsford34c.webp",
  latemodel2023: "/assets/cars/latemodel2023.webp",
  superlatemodel: "/assets/cars/superlatemodel.webp",
  skmodified: "/assets/cars/skmodified.webp",
  skmodifiedtour: "/assets/cars/skmodifiedtour.webp",
  ministock: "/assets/cars/ministock.webp",
  euronascar: "/assets/cars/euronascar.webp",
  dirtlatemodel358: "/assets/cars/dirtlatemodel358.webp",
  dirtlatemodel438: "/assets/cars/dirtlatemodel438.webp",
  dirtmicrosprintnonwinged: "/assets/cars/dirtmicrosprintnonwinged.webp",
  dirtmicrosprintwinged: "/assets/cars/dirtmicrosprintwinged.webp",
  dirtmodifiedbigblock: "/assets/cars/dirtmodifiedbigblock.webp",
  dirtsprintwinged360: "/assets/cars/dirtsprintwinged360.webp",
  dirtsprintwinged410: "/assets/cars/dirtsprintwinged410.webp",
  dirtumpmod: "/assets/cars/dirtumpmod.webp",
};

interface RawCarEntry {
  readonly carFolder: string;
  readonly brand: string;
  readonly model: string;
  readonly carClass: CarClass;
  readonly svgLogoId: string;
  readonly accentColor: string;
  readonly specs?: string;
}

function categoryFromClass(carClass: CarClass): CarCategory {
  if (carClass === "Formula") return "Formula Car";
  if (carClass === "Oval") return "Oval";
  if (carClass === "Dirt") return "Dirt";
  return "Sports Car";
}

function defaultSpecsForClass(carClass: CarClass): string {
  switch (carClass) {
    case "GTP": return "Hybrid Prototype · IMSA / WEC";
    case "LMP2": return "Carbon Monocoque · Endurance P2";
    case "LMP3": return "V8 Prototype · Multi-Class";
    case "GT3": return "FIA GT3 · ABS & TC";
    case "GT4": return "Production GT4 · Endurance";
    case "GTE": return "LMGTE Spec · No ABS";
    case "Formula": return "Open-Wheel · High Downforce";
    case "Touring": return "Production / TCR / Supercars";
    case "Oval": return "Stock / Short Track Oval";
    case "Dirt": return "Dirt Oval / Off-Road";
    case "Prototype": return "Lightweight Track Prototype";
  }
}

const MANUAL_PDF_BY_KEY: Record<string, string> = {
  acuraarx06gtp: "https://s100.iracing.com/wp-content/uploads/2025/01/Acura-ARX-06-GTP-V2.pdf",
  acuransxevo22gt3: "https://s100.iracing.com/wp-content/uploads/2024/12/Acura-GT3_Manual_V2.pdf",
  amvantageevogt3: "https://s100.iracing.com/wp-content/uploads/2026/01/Aston-Martin-GT3-Evo-V1.pdf",
  amvantagegt4: "https://s100.iracing.com/wp-content/uploads/2025/03/Aston-Vantage-GT4-Manual_V4.pdf",
  audir8gt3: "https://s100.iracing.com/wp-content/uploads/2023/10/UM-Audi-R8-LMS-GT3-Manual.pdf",
  audir8lmsevo2gt3: "https://s100.iracing.com/wp-content/uploads/2024/07/Audi-R8-LMS-EVO-II-GT3_Manual.pdf",
  audirs3lms: "https://s100.iracing.com/wp-content/uploads/2025/03/Audi_RS3_LMS_TCR_V2.pdf",
  audirs3lmsgen2: "https://s100.iracing.com/wp-content/uploads/2025/03/Audi_RS3_LMS_TCR_V2.pdf",
  bmwlmdh: "https://s100.iracing.com/wp-content/uploads/2025/01/BMW-M-Hybrid-V8-V2.pdf",
  bmwmhybridv8: "https://s100.iracing.com/wp-content/uploads/2025/01/BMW-M-Hybrid-V8-V2.pdf",
  bmwm2csr: "https://s100.iracing.com/wp-content/uploads/2024/12/BMW-M2-CSR-Manual_V2.pdf",
  bmwm4gt3: "https://s100.iracing.com/wp-content/uploads/2024/07/BMW-M4-GT3-Manual_V3.pdf",
  bmwm4gt4: "https://s100.iracing.com/wp-content/uploads/2024/07/BMW-M4-GT4-V2.pdf",
  bmwm4evogt4: "https://s100.iracing.com/wp-content/uploads/2024/12/BMW-M4-G82-GT4-Manual-V2.pdf",
  bmwm8gte: "https://s100.iracing.com/wp-content/uploads/2024/09/BMW-M8-GTE_Manual_V2.pdf",
  cadillacvseriesrgtp: "https://s100.iracing.com/wp-content/uploads/2025/01/Cadillac-V-Series.R-GTP-V2.pdf",
  chevyvettez06rgt3: "https://s100.iracing.com/wp-content/uploads/2024/06/Chevrolet-Corvette-Z06-GT3_manual_V2.pdf",
  dallarair01: "https://s100.iracing.com/wp-content/uploads/2023/10/UM-Dallara-iR01-Manual.pdf",
  dallarair18: "https://s100.iracing.com/wp-content/uploads/2026/01/Dallara-IR18-V3.pdf",
  dallarap217: "https://s100.iracing.com/wp-content/uploads/2025/03/UM-Dallara-P217-LMP2-V2.pdf",
  dirtmicrosprintnonwinged: "https://s100.iracing.com/wp-content/uploads/2024/03/Dirt_Micro-Sprint_Manual.pdf",
  dirtmicrosprintwinged: "https://s100.iracing.com/wp-content/uploads/2024/03/Dirt_Micro-Sprint_Manual.pdf",
  dirtmodifiedbigblock: "https://s100.iracing.com/wp-content/uploads/2023/10/UM-Big-Block-Modified-V2.pdf",
  ferrari296gt3: "https://s100.iracing.com/wp-content/uploads/2024/06/Ferrari-296-GT3-V4.pdf",
  ferrari296challenge: "https://s100.iracing.com/wp-content/uploads/2025/06/Ferrari-296-Challenge.pdf",
  ferrari488gte: "https://s100.iracing.com/wp-content/uploads/2023/10/Ferrari-488-GT3-EVO-2020.pdf",
  fiacrosscar: "https://s100.iracing.com/wp-content/uploads/2026/01/FIA-Cross-Car-V1.pdf",
  fordgt: "https://s100.iracing.com/wp-content/uploads/2024/01/UM-Ford-GT-GT3-V2.pdf",
  fordmustanggt3: "https://s100.iracing.com/wp-content/uploads/2024/06/Mustang-GT3_Manual_V2.pdf",
  formulair04: "https://s100.iracing.com/wp-content/uploads/2024/04/FIA-F4-Manual-V3.pdf",
  formulavee: "https://s100.iracing.com/wp-content/uploads/2023/10/Formula-Vee-Manual.pdf",
  formulaveeformulavee2: "https://s100.iracing.com/wp-content/uploads/2023/10/Formula-Vee-Manual.pdf",
  formulaveeformulavee3: "https://s100.iracing.com/wp-content/uploads/2023/10/Formula-Vee-Manual.pdf",
  hondacivictyper: "https://s100.iracing.com/wp-content/uploads/2025/03/Honda-Civic-Type-R_TCR.pdf",
  hyundaielantracn7: "https://s100.iracing.com/wp-content/uploads/2025/03/Hyundai-Elantra-N-TCR_V3.pdf",
  hyundaivelostern: "https://s100.iracing.com/wp-content/uploads/2025/03/Hyundai-Veloster-N-TC-Manual-V4.pdf",
  lamborghinievogt3: "https://s100.iracing.com/wp-content/uploads/2024/07/UM-Lamborghini-Huracan-GT3-Evo-V3.pdf",
  latemodel2023: "https://s100.iracing.com/wp-content/uploads/2024/09/Late-Model-Stock-Manual_V6.pdf",
  legendsford34c: "https://s100.iracing.com/wp-content/uploads/2025/03/Legends-Ford-Coupe_Manual_V1.pdf",
  ligierjsp320: "https://s100.iracing.com/wp-content/uploads/2025/03/Ligier-JS-P320-V2.pdf",
  mclaren570sgt4: "https://s100.iracing.com/wp-content/uploads/2024/07/McLaren-570S-GT4-Manual-V2.pdf",
  mclaren720sgt3: "https://s100.iracing.com/wp-content/uploads/2024/09/Mclaren-720S-GT3_V2.pdf",
  mercedesamgevogt3: "https://s100.iracing.com/wp-content/uploads/2026/09/Mercedes-AMG-GT3-2020-Manual_V10.pdf",
  mercedesamggt3: "https://s100.iracing.com/wp-content/uploads/2023/10/UM-Mercedes-AMG-GT3-Manual-V2.pdf",
  mercedesamggt4: "https://s100.iracing.com/wp-content/uploads/2024/07/Mercedes-AMG-GT4-Manual_V2.pdf",
  ministock: "https://s100.iracing.com/wp-content/uploads/2024/09/Mini_Stock_Manual-V1.pdf",
  mx5cup: "https://s100.iracing.com/wp-content/uploads/2025/02/Global-Mazda-MX5_Manual_V2.pdf",
  mx5mx52016: "https://s100.iracing.com/wp-content/uploads/2025/02/Global-Mazda-MX5_Manual_V2.pdf",
  mxmx52016: "https://s100.iracing.com/wp-content/uploads/2025/02/Global-Mazda-MX5_Manual_V2.pdf",
  porsche718gt4: "https://s100.iracing.com/wp-content/uploads/2024/07/Porsche-718-Cayman-GT4-Manual-V5.pdf",
  porsche963: "https://s100.iracing.com/wp-content/uploads/2025/03/Porsche-963-GTP-V2.pdf",
  porsche963gtp: "https://s100.iracing.com/wp-content/uploads/2025/03/Porsche-963-GTP-V2.pdf",
  porsche9922cup: "https://s100.iracing.com/wp-content/uploads/2026/01/Porsche-Cup-992.2-V1.pdf",
  porsche992cup: "https://s100.iracing.com/wp-content/uploads/2024/07/Porsche-911-GT3-Cup-992_Manual.pdf",
  porsche992rgt3: "https://s100.iracing.com/wp-content/uploads/2024/09/Porsche-911-GT3-R-992_V2.pdf",
  stockcarsfordmustang2022: "https://s100.iracing.com/wp-content/uploads/2024/03/NASCAR-NextGen-Cars-Manual-V2.pdf",
  stockcarschevycamarozl12022: "https://s100.iracing.com/wp-content/uploads/2024/03/NASCAR-NextGen-Cars-Manual-V2.pdf",
  stockcarstoyotacamry2022: "https://s100.iracing.com/wp-content/uploads/2024/03/NASCAR-NextGen-Cars-Manual-V2.pdf",
  stockcarsfordfusion: "https://s100.iracing.com/wp-content/uploads/2025/06/NASCAR-Gen4-Cup-Cars.pdf",
  stockcarsbuicklesabre87: "https://s100.iracing.com/wp-content/uploads/2025/06/NASCAR-Gen4-Cup-Cars.pdf",
  stockcarschevymontecarlo87: "https://s100.iracing.com/wp-content/uploads/2025/06/NASCAR-Gen4-Cup-Cars.pdf",
  stockcarsfordthunderbird87: "https://s100.iracing.com/wp-content/uploads/2025/06/NASCAR-Gen4-Cup-Cars.pdf",
  stockcarspontiacgrandprix87: "https://s100.iracing.com/wp-content/uploads/2025/06/NASCAR-Gen4-Cup-Cars.pdf",
  stockcars2camaro2019: "https://s100.iracing.com/wp-content/uploads/2026/03/UM-NASCAR-Oreilly_Manual_V1.pdf",
  stockcars2mustang2019: "https://s100.iracing.com/wp-content/uploads/2026/03/UM-NASCAR-Oreilly_Manual_V1.pdf",
  stockcars2supra2019: "https://s100.iracing.com/wp-content/uploads/2026/03/UM-NASCAR-Oreilly_Manual_V1.pdf",
  supercarschevycamarogen3: "https://s100.iracing.com/wp-content/uploads/2025/06/Gen-3-Supercars-Manual_V5.pdf",
  supercarsfordmustanggen3: "https://s100.iracing.com/wp-content/uploads/2025/06/Gen-3-Supercars-Manual_V5.pdf",
  superformulalights324: "https://s100.iracing.com/wp-content/uploads/2024/03/Super-Formula-Lights_Manual_V1.pdf",
  superformulasf23honda: "https://s100.iracing.com/wp-content/uploads/2024/04/Super-Formula-SF23_V4.pdf",
  superformulasf23toyota: "https://s100.iracing.com/wp-content/uploads/2024/04/Super-Formula-SF23_V4.pdf",
  toyotagr86: "https://s100.iracing.com/wp-content/uploads/2024/09/Toyota_GR86_Manual_V2.pdf",
  trucksfordf150: "https://s100.iracing.com/wp-content/uploads/2024/05/NASCAR-Trucks-Manual-V6.pdf",
  truckssilverado: "https://s100.iracing.com/wp-content/uploads/2024/05/NASCAR-Trucks-Manual-V6.pdf",
  truckssilverado2019: "https://s100.iracing.com/wp-content/uploads/2024/05/NASCAR-Trucks-Manual-V6.pdf",
  truckstoyotatundra2022: "https://s100.iracing.com/wp-content/uploads/2024/05/NASCAR-Trucks-Manual-V6.pdf",
};

function enrichCar(entry: RawCarEntry): CarMetadata {
  const category = categoryFromClass(entry.carClass);
  const key = entry.carFolder.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    ...entry,
    category,
    specs: entry.specs ?? defaultSpecsForClass(entry.carClass),
    manualUrl: MANUAL_PDF_BY_KEY[key] ?? "https://www.iracing.com/resources/user-manuals/",
    forumUrl: "https://forums.iracing.com/categories/cars",
    previewImg: PREVIEW_IMG_BY_KEY[key],
  };
}

const RAW_CAR_CATALOG: readonly RawCarEntry[] = [
  // GTP
  { carFolder: "porsche963gtp", brand: "Porsche", model: "963 GTP", carClass: "GTP", svgLogoId: "logo-porsche", accentColor: "#d97706", specs: "4.6L Twin-Turbo V8 Hybrid · LMDh" },
  { carFolder: "porsche963", brand: "Porsche", model: "963 GTP", carClass: "GTP", svgLogoId: "logo-porsche", accentColor: "#d97706", specs: "4.6L Twin-Turbo V8 Hybrid · LMDh" },
  { carFolder: "ferrari499p", brand: "Ferrari", model: "499P", carClass: "GTP", svgLogoId: "logo-ferrari", accentColor: "#ef4444", specs: "3.0L Twin-Turbo V6 Hybrid · LMH" },
  { carFolder: "bmwmhybridv8", brand: "BMW", model: "M Hybrid V8", carClass: "GTP", svgLogoId: "logo-bmw", accentColor: "#38bdf8", specs: "4.0L Twin-Turbo V8 Hybrid · LMDh" },
  { carFolder: "bmwlmdh", brand: "BMW", model: "M Hybrid V8", carClass: "GTP", svgLogoId: "logo-bmw", accentColor: "#38bdf8", specs: "4.0L Twin-Turbo V8 Hybrid · LMDh" },
  { carFolder: "acuraarx06gtp", brand: "Acura", model: "ARX-06 GTP", carClass: "GTP", svgLogoId: "logo-acura", accentColor: "#e2e8f0", specs: "2.4L Twin-Turbo V6 Hybrid · LMDh" },
  { carFolder: "cadillacvseriesrgtp", brand: "Cadillac", model: "V-Series.R GTP", carClass: "GTP", svgLogoId: "logo-cadillac", accentColor: "#facc15", specs: "5.5L NA V8 Hybrid · LMDh" },
  { carFolder: "amvalkyriegtp", brand: "Aston Martin", model: "Valkyrie AMR-LMH", carClass: "GTP", svgLogoId: "logo-aston", accentColor: "#10b981", specs: "6.5L NA V12 · Le Mans Hypercar" },
  // LMP2 / LMP3
  { carFolder: "dallarap217", brand: "Dallara", model: "P217 LMP2", carClass: "LMP2", svgLogoId: "logo-dallara", accentColor: "#60a5fa", specs: "4.2L Gibson V8 · Carbon LMP2" },
  { carFolder: "hpdarx01c", brand: "Acura", model: "HPD ARX-01c", carClass: "LMP2", svgLogoId: "logo-acura", accentColor: "#e2e8f0", specs: "3.4L V8 · Classic LMP2" },
  { carFolder: "ligierjsp320", brand: "Ligier", model: "JS P320 LMP3", carClass: "LMP3", svgLogoId: "logo-ligier", accentColor: "#38bdf8", specs: "5.6L Nissan V8 · LMP3" },
  // GT3
  { carFolder: "ferrari296gt3", brand: "Ferrari", model: "296 GT3", carClass: "GT3", svgLogoId: "logo-ferrari", accentColor: "#ef4444", specs: "3.0L Twin-Turbo V6 · Mid-Engine GT3" },
  { carFolder: "porsche992rgt3", brand: "Porsche", model: "911 GT3 R (992)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#d97706", specs: "4.2L Flat-6 · Rear-Engine GT3" },
  { carFolder: "bmwm4gt3", brand: "BMW", model: "M4 GT3 EVO", carClass: "GT3", svgLogoId: "logo-bmw", accentColor: "#38bdf8", specs: "3.0L Twin-Turbo I6 · Front-Engine GT3" },
  { carFolder: "mercedesamggt3", brand: "Mercedes-AMG", model: "GT3", carClass: "GT3", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1", specs: "6.2L NA V8 · Front-Engine GT3" },
  { carFolder: "mercedesamgevogt3", brand: "Mercedes-AMG", model: "GT3 2020 EVO", carClass: "GT3", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1", specs: "6.2L NA V8 · Front-Engine GT3" },
  { carFolder: "audir8gt3", brand: "Audi", model: "R8 LMS GT3", carClass: "GT3", svgLogoId: "logo-audi", accentColor: "#f87171", specs: "5.2L NA V10 · Mid-Engine GT3" },
  { carFolder: "audir8lmsevo2gt3", brand: "Audi", model: "R8 LMS EVO II GT3", carClass: "GT3", svgLogoId: "logo-audi", accentColor: "#f87171", specs: "5.2L NA V10 · Mid-Engine GT3" },
  { carFolder: "mclaren720sgt3", brand: "McLaren", model: "720S GT3 EVO", carClass: "GT3", svgLogoId: "logo-mclaren", accentColor: "#fb923c", specs: "4.0L Twin-Turbo V8 · Carbon MonoCage" },
  { carFolder: "chevyvettez06rgt3", brand: "Chevrolet", model: "Corvette Z06 GT3.R", carClass: "GT3", svgLogoId: "logo-chevy", accentColor: "#fbbf24", specs: "5.5L Flat-Plane V8 · Mid-Engine GT3" },
  { carFolder: "fordmustanggt3", brand: "Ford", model: "Mustang GT3", carClass: "GT3", svgLogoId: "logo-ford", accentColor: "#3b82f6", specs: "5.4L Coyote V8 · Front-Engine GT3" },
  { carFolder: "lamborghinievogt3", brand: "Lamborghini", model: "Huracán GT3 EVO", carClass: "GT3", svgLogoId: "logo-lambo", accentColor: "#eab308", specs: "5.2L NA V10 · Mid-Engine GT3" },
  { carFolder: "acuransxevo22gt3", brand: "Acura", model: "NSX GT3 EVO 22", carClass: "GT3", svgLogoId: "logo-acura", accentColor: "#e2e8f0", specs: "3.5L Twin-Turbo V6 · Mid-Engine GT3" },
  { carFolder: "amvantageevogt3", brand: "Aston Martin", model: "Vantage GT3 EVO", carClass: "GT3", svgLogoId: "logo-aston", accentColor: "#10b981", specs: "4.0L Twin-Turbo V8 · Front-Engine GT3" },
  { carFolder: "porsche992cup", brand: "Porsche", model: "911 GT3 Cup (992)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#d97706", specs: "4.0L Flat-6 · Single-Make Cup" },
  { carFolder: "porsche9922cup", brand: "Porsche", model: "911 Cup (992.2)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#d97706", specs: "4.0L Flat-6 · Single-Make Cup" },
  // GT4 / GTE / GT1
  { carFolder: "amvantagegt4", brand: "Aston Martin", model: "Vantage GT4", carClass: "GT4", svgLogoId: "logo-aston", accentColor: "#10b981" },
  { carFolder: "bmwm4gt4", brand: "BMW", model: "M4 F82 GT4", carClass: "GT4", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "bmwm4evogt4", brand: "BMW", model: "M4 G82 GT4 EVO", carClass: "GT4", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "fordmustanggt4", brand: "Ford", model: "Mustang GT4", carClass: "GT4", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "mclaren570sgt4", brand: "McLaren", model: "570S GT4", carClass: "GT4", svgLogoId: "logo-mclaren", accentColor: "#fb923c" },
  { carFolder: "mercedesamggt4", brand: "Mercedes-AMG", model: "GT4", carClass: "GT4", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1" },
  { carFolder: "porsche718gt4", brand: "Porsche", model: "718 Cayman GT4", carClass: "GT4", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "ferrari488gte", brand: "Ferrari", model: "488 GTE", carClass: "GTE", svgLogoId: "logo-ferrari", accentColor: "#ef4444" },
  { carFolder: "bmwm8gte", brand: "BMW", model: "M8 GTE", carClass: "GTE", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "c8rvettegte", brand: "Chevrolet", model: "Corvette C8.R GTE", carClass: "GTE", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "c6r", brand: "Chevrolet", model: "Corvette C6.R GT1", carClass: "GTE", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "porsche991rsr", brand: "Porsche", model: "911 RSR", carClass: "GTE", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "fordgt2017", brand: "Ford", model: "GT Le Mans", carClass: "GTE", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "fordgt", brand: "Ford", model: "GT GT2", carClass: "GTE", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "astonmartindbr9", brand: "Aston Martin", model: "DBR9 GT1", carClass: "GTE", svgLogoId: "logo-aston", accentColor: "#10b981" },
  // Touring / Production / Supercars
  { carFolder: "bmwm2csr", brand: "BMW", model: "M2 CS Racing", carClass: "Touring", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "bmwm2g87", brand: "BMW", model: "M2 Racing (G87)", carClass: "Touring", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "toyotagr86", brand: "Toyota", model: "GR86", carClass: "Touring", svgLogoId: "logo-toyota", accentColor: "#ef4444" },
  { carFolder: "mx5cup", brand: "Mazda", model: "Global MX-5 Cup", carClass: "Touring", svgLogoId: "logo-mazda", accentColor: "#e2e8f0" },
  { carFolder: "mx5mx52016", brand: "Mazda", model: "MX-5 Cup (ND1)", carClass: "Touring", svgLogoId: "logo-mazda", accentColor: "#e2e8f0" },
  { carFolder: "mxmx52016", brand: "Mazda", model: "MX-5 Roadster", carClass: "Touring", svgLogoId: "logo-mazda", accentColor: "#e2e8f0" },
  { carFolder: "renaultcliocup", brand: "Renault", model: "Clio R.S. V", carClass: "Touring", svgLogoId: "logo-renault", accentColor: "#facc15" },
  { carFolder: "hondacivictyper", brand: "Honda", model: "Civic Type R TCR", carClass: "Touring", svgLogoId: "logo-honda", accentColor: "#ef4444" },
  { carFolder: "hyundaielantracn7", brand: "Hyundai", model: "Elantra N TCR", carClass: "Touring", svgLogoId: "logo-hyundai", accentColor: "#38bdf8" },
  { carFolder: "hyundaivelostern", brand: "Hyundai", model: "Veloster N TCR", carClass: "Touring", svgLogoId: "logo-hyundai", accentColor: "#38bdf8" },
  { carFolder: "audirs3lms", brand: "Audi", model: "RS 3 LMS TCR", carClass: "Touring", svgLogoId: "logo-audi", accentColor: "#f87171" },
  { carFolder: "audirs3lmsgen2", brand: "Audi", model: "RS 3 LMS Gen2", carClass: "Touring", svgLogoId: "logo-audi", accentColor: "#f87171" },
  { carFolder: "audi90gto", brand: "Audi", model: "90 GTO", carClass: "Touring", svgLogoId: "logo-audi", accentColor: "#f87171" },
  { carFolder: "caterham420r", brand: "Caterham", model: "Seven 420R", carClass: "Touring", svgLogoId: "logo-caterham", accentColor: "#10b981" },
  { carFolder: "caterhamcaterham420r", brand: "Caterham", model: "Seven 420R", carClass: "Touring", svgLogoId: "logo-caterham", accentColor: "#10b981" },
  { carFolder: "caterhamcaterhamacademy", brand: "Caterham", model: "Academy", carClass: "Touring", svgLogoId: "logo-caterham", accentColor: "#10b981" },
  { carFolder: "supercarsfordmustanggen3", brand: "Ford", model: "Mustang Gen3 Supercar", carClass: "Touring", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "supercarschevycamarogen3", brand: "Chevrolet", model: "Camaro Gen3 Supercar", carClass: "Touring", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "v8supercarsholden2019", brand: "Holden", model: "Commodore ZB", carClass: "Touring", svgLogoId: "logo-holden", accentColor: "#ef4444" },
  // Formula
  { carFolder: "superformulalights324", brand: "Dallara", model: "Super Formula Lights 324", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "superformulasf23honda", brand: "Honda", model: "Super Formula SF23", carClass: "Formula", svgLogoId: "logo-honda", accentColor: "#ef4444" },
  { carFolder: "superformulasf23toyota", brand: "Toyota", model: "Super Formula SF23", carClass: "Formula", svgLogoId: "logo-toyota", accentColor: "#ef4444" },
  { carFolder: "dallaraf3", brand: "Dallara", model: "F3", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "dallarair18", brand: "Dallara", model: "IR18 IndyCar", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "dallarair01", brand: "Dallara", model: "iR-01", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "indypropm18", brand: "Dallara", model: "Indy Pro 2000 PM-18", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "mercedesw13", brand: "Mercedes-AMG", model: "F1 W13 E Performance", carClass: "Formula", svgLogoId: "logo-mercedes", accentColor: "#00e5ff" },
  { carFolder: "formulair04", brand: "FIA", model: "Formula 4", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "raygr22", brand: "Ray", model: "FF1600", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "formulavee", brand: "Formula Vee", model: "FVee", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "formulaveeformulavee2", brand: "Formula Vee", model: "FVee (Spec 2)", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "formulaveeformulavee3", brand: "Formula Vee", model: "FVee (Spec 3)", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "rt2000", brand: "Skip Barber", model: "Formula 2000", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "lotus79", brand: "Lotus", model: "Type 79", carClass: "Formula", svgLogoId: "logo-lotus", accentColor: "#facc15" },
  // Prototype
  { carFolder: "radicalsr8", brand: "Radical", model: "SR8", carClass: "Prototype", svgLogoId: "logo-radical", accentColor: "#10b981" },
  { carFolder: "specracer", brand: "Ford", model: "SCCA Spec Racer Ford", carClass: "Prototype", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "nissangtpzxt", brand: "Nissan", model: "GTP ZX-T", carClass: "Prototype", svgLogoId: "logo-nissan", accentColor: "#ef4444" },
  // Oval
  { carFolder: "stockcarsfordmustang2022", brand: "Ford", model: "NASCAR Next Gen Mustang", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "stockcarschevycamarozl12022", brand: "Chevrolet", model: "NASCAR Next Gen Camaro ZL1", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "stockcarstoyotacamry2022", brand: "Toyota", model: "NASCAR Next Gen Camry", carClass: "Oval", svgLogoId: "logo-toyota", accentColor: "#ef4444" },
  { carFolder: "stockcarsfordfusion", brand: "Ford", model: "NASCAR Cup Ford Fusion", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "stockcars2mustang2019", brand: "Ford", model: "NASCAR Xfinity Mustang", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "stockcars2camaro2019", brand: "Chevrolet", model: "NASCAR Xfinity Camaro", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "stockcars2supra2019", brand: "Toyota", model: "NASCAR Xfinity Supra", carClass: "Oval", svgLogoId: "logo-toyota", accentColor: "#ef4444" },
  { carFolder: "trucksfordf150", brand: "Ford", model: "NASCAR Truck F-150", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "truckssilverado", brand: "Chevrolet", model: "NASCAR Truck Silverado", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "truckssilverado2019", brand: "Chevrolet", model: "NASCAR Truck Silverado 2019", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "truckstoyotatundra2022", brand: "Toyota", model: "NASCAR Truck Tundra", carClass: "Oval", svgLogoId: "logo-toyota", accentColor: "#ef4444" },
  { carFolder: "stockcarsbuicklesabre87", brand: "Buick", model: "1987 LeSabre Stock Car", carClass: "Oval", svgLogoId: "logo-buick", accentColor: "#94a3b8" },
  { carFolder: "stockcarschevymontecarlo87", brand: "Chevrolet", model: "1987 Monte Carlo Stock Car", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "stockcarsfordthunderbird87", brand: "Ford", model: "1987 Thunderbird Stock Car", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "stockcarspontiacgrandprix87", brand: "Pontiac", model: "1987 Grand Prix Stock Car", carClass: "Oval", svgLogoId: "logo-pontiac", accentColor: "#ef4444" },
  { carFolder: "legendsford34c", brand: "Ford", model: "Legends Ford '34 Coupe", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "latemodel2023", brand: "NASCAR", model: "Late Model Stock", carClass: "Oval", svgLogoId: "logo-oval", accentColor: "#f59e0b" },
  { carFolder: "superlatemodel", brand: "NASCAR", model: "Super Late Model", carClass: "Oval", svgLogoId: "logo-oval", accentColor: "#f59e0b" },
  { carFolder: "skmodified", brand: "NASCAR", model: "SK Modified", carClass: "Oval", svgLogoId: "logo-oval", accentColor: "#f59e0b" },
  { carFolder: "skmodifiedtour", brand: "NASCAR", model: "Whelen Tour Modified", carClass: "Oval", svgLogoId: "logo-oval", accentColor: "#f59e0b" },
  { carFolder: "ministock", brand: "Stock", model: "Mini Stock", carClass: "Oval", svgLogoId: "logo-oval", accentColor: "#f59e0b" },
  { carFolder: "euronascar", brand: "EuroNASCAR", model: "EuroNASCAR", carClass: "Oval", svgLogoId: "logo-oval", accentColor: "#f59e0b" },
  // Dirt
  { carFolder: "dirtlatemodel358", brand: "DIRTcar", model: "Dirt Late Model 358", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
  { carFolder: "dirtlatemodel438", brand: "DIRTcar", model: "Dirt Late Model Pro / 438", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
  { carFolder: "dirtmicrosprintnonwinged", brand: "DIRTcar", model: "Micro Sprint Non-Winged", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
  { carFolder: "dirtmicrosprintwinged", brand: "DIRTcar", model: "Micro Sprint Winged", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
  { carFolder: "dirtmodifiedbigblock", brand: "DIRTcar", model: "Big Block Modified", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
  { carFolder: "dirtsprintwinged360", brand: "DIRTcar", model: "360 Winged Sprint Car", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
  { carFolder: "dirtsprintwinged410", brand: "DIRTcar", model: "410 Winged Sprint Car", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
  { carFolder: "dirtumpmod", brand: "DIRTcar", model: "Dirt UMP Modified", carClass: "Dirt", svgLogoId: "logo-dirt", accentColor: "#fb923c" },
];

export const CAR_CATALOG_LIST: readonly CarMetadata[] = RAW_CAR_CATALOG.map(enrichCar);

const CAR_BY_FOLDER = new Map<string, CarMetadata>(
  CAR_CATALOG_LIST.map((car) => [car.carFolder.toLowerCase(), car]),
);

const BRAND_RULES: ReadonlyArray<{
  match: readonly string[];
  brand: string;
  svgLogoId: string;
  accentColor: string;
  defaultClass: CarClass;
}> = [
  { match: ["ferrari"], brand: "Ferrari", svgLogoId: "logo-ferrari", accentColor: "#ef4444", defaultClass: "GT3" },
  { match: ["bmw"], brand: "BMW", svgLogoId: "logo-bmw", accentColor: "#38bdf8", defaultClass: "GT3" },
  { match: ["porsche", "992", "963", "991", "718"], brand: "Porsche", svgLogoId: "logo-porsche", accentColor: "#d97706", defaultClass: "GT3" },
  { match: ["mercedes"], brand: "Mercedes-AMG", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1", defaultClass: "GT3" },
  { match: ["audi"], brand: "Audi", svgLogoId: "logo-audi", accentColor: "#f87171", defaultClass: "GT3" },
  { match: ["ford", "mustang", "f150", "fusion", "thunderbird", "specracer"], brand: "Ford", svgLogoId: "logo-ford", accentColor: "#3b82f6", defaultClass: "GT3" },
  { match: ["chevy", "chevrolet", "vette", "camaro", "silverado", "montecarlo", "c6r", "c8r"], brand: "Chevrolet", svgLogoId: "logo-chevy", accentColor: "#fbbf24", defaultClass: "GT3" },
  { match: ["lamborghini"], brand: "Lamborghini", svgLogoId: "logo-lambo", accentColor: "#eab308", defaultClass: "GT3" },
  { match: ["mclaren"], brand: "McLaren", svgLogoId: "logo-mclaren", accentColor: "#fb923c", defaultClass: "GT3" },
  { match: ["acura", "hpd"], brand: "Acura", svgLogoId: "logo-acura", accentColor: "#e2e8f0", defaultClass: "GTP" },
  { match: ["aston", "amvantage", "amvalkyrie"], brand: "Aston Martin", svgLogoId: "logo-aston", accentColor: "#10b981", defaultClass: "GT3" },
  { match: ["cadillac"], brand: "Cadillac", svgLogoId: "logo-cadillac", accentColor: "#facc15", defaultClass: "GTP" },
  { match: ["toyota", "supra", "tundra", "camry"], brand: "Toyota", svgLogoId: "logo-toyota", accentColor: "#ef4444", defaultClass: "Touring" },
  { match: ["honda"], brand: "Honda", svgLogoId: "logo-honda", accentColor: "#ef4444", defaultClass: "Touring" },
  { match: ["hyundai"], brand: "Hyundai", svgLogoId: "logo-hyundai", accentColor: "#38bdf8", defaultClass: "Touring" },
  { match: ["mx5", "mx"], brand: "Mazda", svgLogoId: "logo-mazda", accentColor: "#e2e8f0", defaultClass: "Touring" },
  { match: ["renault"], brand: "Renault", svgLogoId: "logo-renault", accentColor: "#facc15", defaultClass: "Touring" },
  { match: ["nissan"], brand: "Nissan", svgLogoId: "logo-nissan", accentColor: "#ef4444", defaultClass: "Prototype" },
  { match: ["holden"], brand: "Holden", svgLogoId: "logo-holden", accentColor: "#ef4444", defaultClass: "Touring" },
  { match: ["dallara"], brand: "Dallara", svgLogoId: "logo-dallara", accentColor: "#60a5fa", defaultClass: "Formula" },
  { match: ["ligier"], brand: "Ligier", svgLogoId: "logo-ligier", accentColor: "#38bdf8", defaultClass: "LMP3" },
  { match: ["caterham"], brand: "Caterham", svgLogoId: "logo-caterham", accentColor: "#10b981", defaultClass: "Touring" },
  { match: ["radical"], brand: "Radical", svgLogoId: "logo-radical", accentColor: "#10b981", defaultClass: "Prototype" },
  { match: ["lotus"], brand: "Lotus", svgLogoId: "logo-lotus", accentColor: "#facc15", defaultClass: "Formula" },
  { match: ["buick"], brand: "Buick", svgLogoId: "logo-buick", accentColor: "#94a3b8", defaultClass: "Oval" },
  { match: ["pontiac"], brand: "Pontiac", svgLogoId: "logo-pontiac", accentColor: "#ef4444", defaultClass: "Oval" },
];

const BRAND_SVG_INNER: Record<string, string> = {
  "logo-bmw": `<circle cx="12" cy="12" r="9.5" fill="#0b1220" stroke="#e2e8f0" stroke-width="1.4"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#94a3b8" stroke-width="0.6"/><path d="M12 5.5A6.5 6.5 0 0 1 18.5 12H12z" fill="#38bdf8"/><path d="M12 18.5A6.5 6.5 0 0 1 5.5 12H12z" fill="#38bdf8"/><path d="M12 5.5A6.5 6.5 0 0 0 5.5 12H12z" fill="#f8fafc"/><path d="M12 18.5A6.5 6.5 0 0 0 18.5 12H12z" fill="#f8fafc"/>`,
  "logo-audi": `<g fill="none" stroke="#f8fafc" stroke-width="1.5"><circle cx="5.2" cy="12" r="2.7"/><circle cx="9.7" cy="12" r="2.7"/><circle cx="14.3" cy="12" r="2.7"/><circle cx="18.8" cy="12" r="2.7"/></g>`,
  "logo-mercedes": `<circle cx="12" cy="12" r="9.5" fill="#0b1220" stroke="#e2e8f0" stroke-width="1.4"/><path d="M12 3.2 13.3 11.2 19.6 16.5 12 13.1 4.4 16.5 10.7 11.2Z" fill="#e2e8f0"/>`,
  "logo-ferrari": `<path d="M6.5 3.5H17.5V12.5C17.5 17 12 20.5 12 20.5S6.5 17 6.5 12.5Z" fill="#facc15" stroke="#eab308" stroke-width="1"/><path d="M6.5 3.5H10.1V5.6H6.5Z" fill="#16a34a"/><path d="M10.1 3.5H13.9V5.6H10.1Z" fill="#f8fafc"/><path d="M13.9 3.5H17.5V5.6H13.9Z" fill="#dc2626"/><path d="M12.5 8C10.5 9.5 10 12 11.5 14C10.3 15.2 10.8 17 12.2 17.5C13.8 16 14 13.5 13 11.5C13.8 10.5 14 9 12.5 8Z" fill="#090d12"/>`,
  "logo-porsche": `<path d="M6.5 3.5H17.5V12.5C17.5 17 12 20.5 12 20.5S6.5 17 6.5 12.5Z" fill="#eab308" stroke="#facc15" stroke-width="1"/><path d="M7.5 4.8H12V9.5H7.5ZM12 9.5H16.5V14.2H12Z" fill="#dc2626"/><path d="M7.5 9.5H16.5M12 4.8V18" stroke="#090d12" stroke-width="0.9"/>`,
  "logo-ford": `<ellipse cx="12" cy="12" rx="10" ry="5.4" fill="#1d4ed8" stroke="#e2e8f0" stroke-width="1.3"/><ellipse cx="12" cy="12" rx="8.4" ry="4" fill="none" stroke="#93c5fd" stroke-width="0.6"/><path d="M7.5 13.5L9 9.5H12.5M8.3 11.6H11M13 12C13 10.9 14.5 10.9 14.5 12C14.5 13.1 13 13.1 13 12ZM16.5 9.5V13.5" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  "logo-chevy": `<path d="M2.5 10.4H8V8.2H16V10.4H21.5L19.8 13.6H16V15.8H8V13.6H4.2Z" fill="#facc15" stroke="#fef08a" stroke-width="1" stroke-linejoin="round"/>`,
  "logo-aston": `<path d="M2 9.2L12 11.6L22 9.2L19.5 13.4L12 15L4.5 13.4Z" fill="#f8fafc" stroke="#10b981" stroke-width="0.9"/><path d="M4.5 11.2H19.5M6.5 12.6H17.5" stroke="#0f172a" stroke-width="0.8"/>`,
  "logo-lambo": `<path d="M6.5 4L12 2.8L17.5 4V12.8C17.5 16.8 12 20.5 12 20.5S6.5 16.8 6.5 12.8Z" fill="#090d12" stroke="#eab308" stroke-width="1.4"/><path d="M9 14.2C9.8 11.5 11.5 9.5 14.6 8.8C13.6 10.6 14 12.5 15.2 14.2C13.2 14 11.2 13.6 9 14.2Z" fill="#eab308"/>`,
  "logo-mclaren": `<path d="M3.5 15.8C7.5 10.2 14.2 7.8 20.8 9.6C16.8 11 13.2 13.6 11 16.8C12.2 14.2 11.2 12.6 3.5 15.8Z" fill="#fb923c"/>`,
  "logo-acura": `<path d="M12 3.5L5.2 18.8H8L12 9.6L16 18.8H18.8Z" fill="#f8fafc"/><path d="M8.5 14.5H15.5" stroke="#f8fafc" stroke-width="1.5"/>`,
  "logo-cadillac": `<path d="M4.5 5H19.5V13.5L12 19.5L4.5 13.5Z" fill="#090d12" stroke="#e2e8f0" stroke-width="1.3"/><path d="M6.8 7H12V10.8H6.8Z" fill="#dc2626"/><path d="M12 7H17.2V10.8H12Z" fill="#2563eb"/><path d="M6.8 10.8H17.2V13.2L12 17.2L6.8 13.2Z" fill="#facc15"/>`,
  "logo-toyota": `<ellipse cx="12" cy="12" rx="9.5" ry="6.2" fill="none" stroke="#ef4444" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="2.8" ry="6" fill="none" stroke="#ef4444" stroke-width="1.4"/><ellipse cx="12" cy="9.2" rx="6" ry="2.1" fill="none" stroke="#ef4444" stroke-width="1.3"/>`,
  "logo-honda": `<rect x="4" y="4.5" width="16" height="15" rx="3" fill="#0b1220" stroke="#ef4444" stroke-width="1.4"/><path d="M8.2 7.5V16.5M15.8 7.5V16.5M8.2 12H15.8" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>`,
  "logo-mazda": `<circle cx="12" cy="12" r="9" fill="#0b1220" stroke="#e2e8f0" stroke-width="1.4"/><path d="M5.5 9.5L12 14.5L18.5 9.5" fill="none" stroke="#f8fafc" stroke-width="1.7" stroke-linecap="round"/>`,
  "logo-hyundai": `<ellipse cx="12" cy="12" rx="9.5" ry="5.8" fill="#0b1220" stroke="#38bdf8" stroke-width="1.4"/><path d="M9.5 8L7.5 16M16.5 8L14.5 16M8.5 12.5L15.5 11.3" stroke="#f8fafc" stroke-width="1.6" stroke-linecap="round"/>`,
  "logo-renault": `<path d="M12 3L19 12L12 21L5 12Z" fill="none" stroke="#facc15" stroke-width="1.8"/><path d="M12 6.8L15.8 12L12 17.2L8.2 12Z" fill="none" stroke="#facc15" stroke-width="1.2"/>`,
  "logo-nissan": `<circle cx="12" cy="12" r="8" fill="#0b1220" stroke="#e2e8f0" stroke-width="1.5"/><rect x="3" y="9.8" width="18" height="4.4" rx="1" fill="#090d12" stroke="#ef4444" stroke-width="1.2"/>`,
  "logo-dallara": `<rect x="3" y="6" width="18" height="12" rx="3" fill="#0b1220" stroke="#60a5fa" stroke-width="1.4"/><path d="M7 15V9H11.5C13.5 9 14.5 10.2 14.5 12C14.5 13.8 13.5 15 11.5 15Z" fill="none" stroke="#60a5fa" stroke-width="1.6"/>`,
  "logo-fia": `<circle cx="12" cy="12" r="9.5" fill="#0b1220" stroke="#22d3ee" stroke-width="1.4"/><path d="M7 12H17M12 7V17" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="#0b1220" stroke="#f8fafc" stroke-width="1.2"/>`,
  "logo-oval": `<ellipse cx="12" cy="12" rx="9.5" ry="6" fill="#0b1220" stroke="#f59e0b" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="5.5" ry="2.8" fill="none" stroke="#fde68a" stroke-width="1"/>`,
  "logo-dirt": `<path d="M4 16L8 8H16L20 16Z" fill="#0b1220" stroke="#fb923c" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 13H17" stroke="#fdba74" stroke-width="1.4"/>`,
};

export function resolveCarMetadata(carFolder: string): CarMetadata | null {
  const raw = carFolder.trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exact = CAR_BY_FOLDER.get(key) ?? CAR_BY_FOLDER.get(raw.toLowerCase());
  if (exact) return exact;

  for (const rule of BRAND_RULES) {
    if (rule.match.some((m) => key.includes(m))) {
      return enrichCar({
        carFolder: raw,
        brand: rule.brand,
        model: raw,
        carClass: rule.defaultClass,
        svgLogoId: rule.svgLogoId,
        accentColor: rule.accentColor,
      });
    }
  }
  return null;
}

export function filterCarsByClass(carClass?: CarClass): readonly CarMetadata[] {
  if (!carClass) return CAR_CATALOG_LIST;
  return CAR_CATALOG_LIST.filter((c) => c.carClass === carClass);
}

/**
 * Returns raw inner SVG markup for a manufacturer logo, preferring official vector paths.
 */
export function brandSvgInner(meta: CarMetadata): string {
  const officialPath = OFFICIAL_BRAND_PATHS[meta.svgLogoId];
  if (officialPath) {
    return `<path d="${officialPath}" fill="${meta.accentColor}"/>`;
  }
  return (
    BRAND_SVG_INNER[meta.svgLogoId] ??
    `<rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="${meta.accentColor}" fill-opacity="0.16" stroke="${meta.accentColor}" stroke-width="1.5"/><text x="12" y="15.5" text-anchor="middle" fill="${meta.accentColor}" font-family="monospace" font-weight="800" font-size="9">${meta.brand.slice(0, 2).toUpperCase()}</text>`
  );
}

/**
 * Returns a complete standalone `<svg>` string for SSR / Astro rendering.
 */
export function getBrandSvgMarkup(meta: CarMetadata, size = 20): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" class="shrink-0">${brandSvgInner(meta)}</svg>`;
}

/**
 * Generates an inline SVG element for the car's manufacturer emblem.
 */
export function createBrandBadgeElement(meta: CarMetadata, size = 20): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("shrink-0");
  svg.innerHTML = brandSvgInner(meta);
  return svg;
}

/**
 * Generates a clean studio manufacturer banner when no track photo is available.
 */
export function getCarPreviewBannerSvg(meta: CarMetadata): string {
  return `<svg viewBox="0 0 356 168" class="w-full h-full block" aria-hidden="true">
    <defs>
      <radialGradient id="g-${meta.carFolder}" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="${meta.accentColor}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#090d12" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="356" height="168" fill="#090d12"/>
    <rect width="356" height="168" fill="url(#g-${meta.carFolder})"/>
    <svg x="146" y="46" width="64" height="64" viewBox="0 0 24 24">${brandSvgInner(meta)}</svg>
  </svg>`;
}
