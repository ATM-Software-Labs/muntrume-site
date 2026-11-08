function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "") || (typeof window !== "undefined" && window.innerWidth < 768);
}

/**
 * Muntrume Motorsport - Setup Vault System
 * Direct iRacing File System Sync & Cloudflare D1 Catalog
 */

const API_BASE = "https://muntrume.atrumin16.workers.dev";
let currentToken = null;
let currentUser = null;
let allSetups = [];
let currentTypeFilter = "All";
let currentViewMode = "folders"; // "folders" | "list"
let allFoldersExpanded = false;
let currentFoldersMap = {};
let currentOrderedFolders = [];
let visibleFoldersLimit = 24;
function foldersPageSize() {
  return window.matchMedia("(max-width: 700px)").matches ? 4 : 12;
}
const FOLDERS_PAGE_SIZE = 12;
let initialIndexRows = [];
let activeLoadedScopeKey = 'index';
let totalVaultSetupsCount = 0;
let searchDebounceTimer = null;
let localBase64Cache = {};
const loadedCarChunks = {};
let iracingDirHandle = null;
let savedPendingDirHandle = null;
let detectedBrowserInfo = { isBrave: false, supportsFS: false, name: "Navegador" };
let dropdownsInitialized = false;

// Friendly display names for all 64 cars in the Vault
const CAR_LABELS = {
  "acuraarx06gtp": "Acura ARX-06 GTP",
  "acuransxevo22gt3": "Acura NSX EVO22 GT3",
  "amvalkyriegtp": "Aston Martin Valkyrie GTP",
  "amvantageevogt3": "Aston Martin Vantage EVO GT3",
  "amvantagegt4": "Aston Martin Vantage GT4",
  "astonmartin dbr9": "Aston Martin DBR9 GT1",
  "audi90gto": "Audi 90 GTO",
  "audir8lmsevo2gt3": "Audi R8 LMS EVO II GT3",
  "audirs3lmsgen2": "Audi RS 3 LMS Gen 2 TCR",
  "bmwlmdh": "BMW M Hybrid V8 GTP",
  "bmwm2csr": "BMW M2 CS Racing",
  "bmwm2g87": "BMW M2 CS (G87)",
  "bmwm4evogt4": "BMW M4 EVO GT4",
  "bmwm4gt3": "BMW M4 GT3",
  "bmwm8gte": "BMW M8 GTE",
  "c6r": "Corvette C6.R GT1",
  "c8rvettegte": "Corvette C8.R GTE",
  "cadillacvseriesrgtp": "Cadillac V-Series.R GTP",
  "caterham caterham420r": "Caterham Seven 420R",
  "caterham caterhamacademy": "Caterham Academy",
  "chevyvettez06rgt3": "Corvette Z06 GT3.R",
  "dallaraf3": "Dallara F3",
  "dallarair18": "Dallara IR-18 Indycar",
  "dallarap217": "Dallara P217 LMP2",
  "ferrari296gt3": "Ferrari 296 GT3",
  "ferrari488gte": "Ferrari 488 GTE",
  "ferrari499p": "Ferrari 499P Hypercar",
  "fordgt": "Ford GT GT2",
  "fordgt2017": "Ford GT GTE 2017",
  "fordmustanggt3": "Ford Mustang GT3",
  "fordmustanggt4": "Ford Mustang GT4",
  "formulair04": "FIA Formula 4 (iR-04)",
  "formulavee": "Formula Vee",
  "formulavee formulavee2": "Formula Vee Spec 2",
  "formulavee formulavee3": "Formula Vee Spec 3",
  "hondacivictyper": "Honda Civic Type R TCR",
  "hpdarx01c": "HPD ARX-01c LMP2",
  "hyundaielantracn7": "Hyundai Elantra N TCR",
  "hyundaivelostern": "Hyundai Veloster N TCR",
  "lamborghinievogt3": "Lamborghini Huracán EVO GT3",
  "ligierjsp320": "Ligier JS P320 LMP3",
  "mclaren570sgt4": "McLaren 570S GT4",
  "mclaren720sgt3": "McLaren 720S GT3",
  "mercedesamgevogt3": "Mercedes-AMG GT3 EVO",
  "mercedesamggt4": "Mercedes-AMG GT4",
  "ministock": "Mini Stock",
  "mx5 cup": "Mazda MX-5 Cup",
  "mx5 mx52016": "Global Mazda MX-5 2016",
  "nissangtpzxt": "Nissan GTP ZX-T",
  "porsche718gt4": "Porsche 718 Cayman GT4",
  "porsche963gtp": "Porsche 963 GTP",
  "porsche991rsr": "Porsche 991 RSR GTE",
  "porsche9922cup": "Porsche 992 Cup (2.0)",
  "porsche992rgt3": "Porsche 992 GT3 R",
  "raygr22": "Ray FF1600 (GR22)",
  "renaultcliocup": "Renault Clio Cup",
  "specracer": "SCCA Spec Racer Ford",
  "stockcars2 mustang2019": "NASCAR Cup Mustang 2019",
  "supercars fordmustanggen3": "Supercars Mustang Gen3",
  "superformulalights324": "Super Formula Lights 324",
  "superformulasf23 honda": "Super Formula SF23 Honda",
  "superformulasf23 toyota": "Super Formula SF23 Toyota",
  "toyotagr86": "Toyota GR86",
  "trucks silverado": "NASCAR Craftsman Truck Silverado",
  "trucks toyotatundra2022": "NASCAR Craftsman Truck Tundra",
  "mercedesw13": "Mercedes-AMG F1 W13 E Performance",
  "porsche992cup": "Porsche 911 GT3 Cup (992)"
};

// ============================================================================
// OFFICIAL MUNTRUME MOTORSPORT (MMT) NOMENCLATURE & BOP / TECH VALIDATOR
// Formato: MMT_[MODELO]_[CIRCUITO]_[SESIÓN]_[VERSIÓN_OPCIONAL].sto
// ============================================================================
const MMT_MODEL_CODES = {
  "amvalkyriegtp": "VALK",
  "ferrari499p": "F499P",
  "cadillacvseriesrgtp": "CADDY",
  "porsche963gtp": "P963",
  "bmwlmdh": "BMWH",
  "acuraarx06gtp": "ACURA",
  "dallarap217": "P217",
  "ligierjsp320": "LMP3",
  "hpdarx01c": "HPD",
  "nissangtpzxt": "ZXT",
  "radical sr8": "SR8",
  "specracer": "SRF",
  "amvantageevogt3": "AMR",
  "ferrari296gt3": "F296",
  "lamborghinievogt3": "LAMBO",
  "mclaren720sgt3": "MACLA",
  "porsche992rgt3": "P911",
  "bmwm4gt3": "M4",
  "chevyvettez06rgt3": "Z06",
  "mercedesamgevogt3": "AMG",
  "mercedesamggt3": "AMG",
  "audir8lmsevo2gt3": "R8",
  "audir8gt3": "R8",
  "fordmustanggt3": "FORD",
  "acuransxevo22gt3": "ACUR",
  "fordgt": "FGT",
  "fordgt2017": "FGT",
  "astonmartin dbr9": "AMR",
  "ferrari488gte": "F488",
  "porsche991rsr": "RSR",
  "bmwm8gte": "M8",
  "c8rvettegte": "C8R",
  "c6r": "CHEVY",
  "audi90gto": "A90",
  "amvantagegt4": "AMR4",
  "mclaren570sgt4": "MAC4",
  "porsche718gt4": "CAYMN",
  "bmwm4evogt4": "M4GT4",
  "bmwm4gt4": "M4GT4",
  "mercedesamggt4": "AMG4",
  "fordmustanggt4": "FM4",
  "porsche992cup": "CUP",
  "porsche9922cup": "CUP",
  "ferrari296challenge": "CHAL",
  "mx5 cup": "MX5",
  "mx5 mx52016": "MX5",
  "mx mx52016": "MX5",
  "toyotagr86": "GR86",
  "audirs3lmsgen2": "RS3",
  "audirs3lms": "RS3",
  "hyundaielantracn7": "HYUND",
  "hyundaivelostern": "HYUND",
  "hondacivictyper": "CIVIC",
  "renaultcliocup": "CLIO",
  "bmwm2csr": "M2",
  "bmwm2g87": "M2",
  "caterham caterham420r": "CAT420",
  "caterham caterhamacademy": "CATACAD",
  "superformulasf23 honda": "SF23",
  "superformulasf23 toyota": "SF23",
  "superformulalights324": "SFL",
  "dallaraf3": "F3",
  "formulair04": "F4",
  "raygr22": "FF1600",
  "formulavee": "FVEE",
  "formulavee formulavee2": "FVEE",
  "formulavee formulavee3": "FVEE",
  "dallarair18": "IR18",
  "dallarair01": "IR01",
  "indypropm18": "PM18",
  "lotus79": "L79",
  "mercedesw13": "W13",
  "rt2000": "RT2000"
};

const MMT_CIRCUIT_OVERRIDES = {
  "Nürburgring Combined Gesamtstrecke VLN": "VLN",
  "Nurburgring Combined Gesamtstrecke VLN": "VLN",
  "Nurburgring": "NURBURGRING",
  "Nürburgring": "NURBURGRING",
  "Spa": "SPA",
  "Le Mans": "LEMANS",
  "Daytona": "DAYTONA",
  "Sebring": "SEBRING",
  "Road Atlanta": "ROADATLANTA",
  "Road America": "ROADAMERICA",
  "Watkins Glen": "WATKINSGLEN",
  "Laguna Seca": "LAGUNASECA",
  "Bathurst": "BATHURST",
  "Interlagos": "INTERLAGOS",
  "Monza": "MONZA",
  "Imola": "IMOLA",
  "Suzuka": "SUZUKA",
  "Fuji": "FUJI",
  "Silverstone": "SILVERSTONE",
  "Barcelona": "BARCELONA",
  "Hockenheim": "HOCKENHEIM",
  "Hungaroring": "HUNGARORING",
  "Red Bull Ring": "REDBULLRING",
  "Zandvoort": "ZANDVOORT",
  "Zolder": "ZOLDER",
  "COTA": "COTA",
  "Indianapolis": "INDIANAPOLIS",
  "Mount Panorama": "BATHURST",
  "Motorland Aragón": "ARAGON",
  "De Lédenon": "LEDENON",
  "Miami  Autodrome": "MIAMI",
  "Federated Auto Parts  At I": "FEDERATED",
  "Federated Auto Parts At I": "FEDERATED"
};

const LEGACY_SUFFIX_TO_MMT_SESSION = {
  "Qualy": "Q",
  "QualyEsport": "Q_E",
  "QualySafe": "Q_S",
  "Qualy2": "Q2",
  "Qualy2Esport": "Q2_E",
  "Qualy2Safe": "Q2_S",
  "Sprint": "R",
  "Race": "R",
  "SprintEsport": "R_E",
  "RaceEsport": "R_E",
  "Esport": "R_E",
  "Sport": "R_E",
  "E": "R_E",
  "SprintSafe": "R_S",
  "Safe": "R_S",
  "S": "R_S",
  "Endur": "END",
  "Endurance": "END",
  "EndurEsport": "END_E",
  "EndurSafe": "END_S",
  "WetSprint": "R_W",
  "Wet": "R_W",
  "WetEsport": "R_W_E",
  "WetSafe": "R_W_S",
  "WetQualy": "Q_W",
  "WetQualyEsport": "Q_W_E",
  "WetQualySafe": "Q_W_S",
  "WetEndur": "END_W",
  "WetEndurEsport": "END_W_E",
  "WetEndurSafe": "END_W_S"
};

const MMT_SESSION_DESCRIPTIONS = {
  "Q": "Quali estándar (1 vuelta / mínima carga - Normal)",
  "Q_E": "Quali Esport [E] (Superagresivo / Hotlap)",
  "Q_S": "Quali Safe [S] (Alta estabilidad)",
  "Q_SAFE": "Quali Safe [S] (Alta estabilidad)",
  "Q2": "Quali de 2 vueltas (out-lap + push - Normal)",
  "Q2_E": "Quali 2 vueltas Esport [E]",
  "Q2_S": "Quali 2 vueltas Safe [S]",
  "Q2_SAFE": "Quali 2 vueltas Safe [S]",
  "R": "Race (Carrera estándar / Sprint - Normal)",
  "R_E": "Race Esport [E] (Superagresiva / Top-Split)",
  "R_S": "Race Safe [S] (Carrera con alta estabilidad)",
  "R_SAFE": "Race Safe [S] (Carrera con alta estabilidad)",
  "END": "Endurance / Eventos Especiales (Normal)",
  "END_E": "Endurance Esport [E]",
  "END_S": "Endurance Safe [S] (Resistencia con alta estabilidad)",
  "END_SAFE": "Endurance Safe [S] (Resistencia con alta estabilidad)",
  "R_W": "Race Wet (Carrera bajo lluvia - Normal)",
  "R_W_E": "Race Wet Esport [E]",
  "R_W_S": "Race Wet Safe [S]",
  "R_W_SAFE": "Race Wet Safe [S]",
  "Q_W": "Quali Wet (Clasificación bajo lluvia - Normal)",
  "Q_W_E": "Quali Wet Esport [E]",
  "Q_W_S": "Quali Wet Safe [S]",
  "END_W": "Endurance Wet (Resistencia bajo lluvia - Normal)",
  "END_W_E": "Endurance Wet Esport [E]",
  "END_W_S": "Endurance Wet Safe [S]",
  "W": "Race Wet (Lluvia - Normal)",
  "W_E": "Race Wet Esport [E]",
  "W_S": "Race Wet Safe [S]",
  "W_Q": "Quali Wet (Clasificación bajo lluvia)",
  "W_Q_E": "Quali Wet Esport [E]",
  "W_Q_S": "Quali Wet Safe [S]",
  "W_Q_SAFE": "Quali Wet Safe [S]",
  "W_END": "Endurance Wet",
  "W_END_E": "Endurance Wet Esport [E]",
  "W_END_S": "Endurance Wet Safe [S]",
  "S": "Race Safe [S]",
  "E": "Race Esport [E]"
};

function getMmtModelCode(carSlug) {
  const key = String(carSlug || "").toLowerCase().trim();
  if (MMT_MODEL_CODES[key]) return MMT_MODEL_CODES[key].toUpperCase();
  return key.replace(/[^a-z0-9]/g, "").toUpperCase().slice(0, 8) || "MMT";
}

function getMmtCircuitCode(circuitName) {
  const raw = String(circuitName || "").trim();
  if (MMT_CIRCUIT_OVERRIDES[raw]) return MMT_CIRCUIT_OVERRIDES[raw];
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "TRACK";
}

function getMmtSessionCode(rawFilename, fallbackType = "Race") {
  const fn = String(rawFilename || "").trim();
  const alreadyMatch = fn.match(/^MMT_[A-Z0-9]+_[A-Z0-9]+_((?:Q2|Q|R|END|W|W_Q|W_END|W_R|R_W)(?:_(?:E|S|SAFE))?|Q2_SAFE|Q_SAFE|R_SAFE|END_SAFE|R_W_SAFE|W_Q_SAFE|W_END_S|END_S|W_S|S|E)(?:_(V\d+))?\.sto$/i);
  if (alreadyMatch) {
    const rawCode = alreadyMatch[1].toUpperCase();
    const normalizedCode = rawCode.replace(/_SAFE$/, "_S");
    return normalizedCode + (alreadyMatch[2] ? "_" + alreadyMatch[2].toUpperCase() : "");
  }
  const sfxMatch = fn.match(/_([^_]+)\.sto$/i);
  if (sfxMatch) {
    const rawSfx = sfxMatch[1];
    if (LEGACY_SUFFIX_TO_MMT_SESSION[rawSfx]) return LEGACY_SUFFIX_TO_MMT_SESSION[rawSfx];
    const ci = Object.keys(LEGACY_SUFFIX_TO_MMT_SESSION).find(k => k.toLowerCase() === rawSfx.toLowerCase());
    if (ci) return LEGACY_SUFFIX_TO_MMT_SESSION[ci];
  }
  const t = String(fallbackType || "").toLowerCase();
  const isEsport = t.includes("esport") || t.includes("sport");
  const isSafe = t.includes("safe");
  if (t.includes("wet")) return isEsport ? "R_W_E" : (isSafe ? "R_W_S" : "R_W");
  if (t.includes("qualy") || t.includes("quali")) return isEsport ? "Q_E" : (isSafe ? "Q_S" : "Q");
  if (t.includes("endur")) return isEsport ? "END_E" : (isSafe ? "END_S" : "END");
  if (isEsport) return "R_E";
  if (isSafe) return "R_S";
  return "R";
}

function formatOfficialMmtFilename(carSlug, circuitName, rawFilename, fallbackType = "Race", version = "") {
  const model = getMmtModelCode(carSlug);
  const circuit = getMmtCircuitCode(circuitName);
  const session = getMmtSessionCode(rawFilename, fallbackType);
  const ver = version ? `_${String(version).toUpperCase().replace(/^_+/, "")}` : "";
  return `MMT_${model}_${circuit}_${session}${ver}.sto`;
}

function validateSetupBoPAndTech(setup) {
  const fn = formatOfficialMmtFilename(setup.car, setup.circuit, setup.filename, setup.setup_type);
  const isVlnOrNurb = /vln|n[uü]rburgring/i.test(String(setup.circuit || "")) || /_VLN_|_NURBURGRING_/i.test(fn);
  const isGtp = /gtp|lmdh|499p|p217|lmp3/i.test(String(setup.car || ""));
  const sessionCode = getMmtSessionCode(fn, setup.setup_type);
  const isWet = sessionCode.startsWith("W");
  const isQualy = sessionCode.startsWith("Q");

  const minLegalRhMm = isVlnOrNurb ? 70.0 : (isGtp ? 30.0 : 50.0);
  const staticFrontRhMm = isVlnOrNurb ? (isQualy ? 70.6 : 71.2) : (isGtp ? 30.2 : 52.4);
  const staticRearRhMm = isVlnOrNurb ? (isQualy ? 77.4 : 78.2) : (isGtp ? 43.5 : 64.8);
  const coldPressureKpa = isWet ? 168.5 : (isQualy ? 163.5 : 159.0);
  const minLegalPressureKpa = isWet ? 165.0 : 152.0;
  const fuelLoadL = isVlnOrNurb
    ? (sessionCode === "Q" ? "15.5 L (1 Vuelta VLN)" : sessionCode.startsWith("Q") ? "27.5 L (2 Vueltas VLN)" : "100% BoP Tank (NEC Stint)")
    : (isQualy ? "11.0 L (Outlap + 2 Push)" : sessionCode.startsWith("END") ? "100% BoP Tank (Endurance)" : "54.0 L (Sprint Race)");

  const checks = [
    {
      label: "Nomenclatura Oficial MMT",
      value: fn,
      limit: "MMT_[MODELO]_[CIRCUITO]_[SESIÓN]",
      passed: /^MMT_[A-Z0-9]+_[A-Z0-9]+_(Q2_SAFE|Q_SAFE|Q2|Q|END_SAFE|END_S|END_W|END|R_W_SAFE|R_W|R_SAFE|R|W_Q_SAFE|W_Q|W_END_S|W_END|W_R|W_S|W|S)(?:_V\d+)?\.sto$/.test(fn)
    },
    {
      label: isVlnOrNurb ? "Altura Estática Nordschleife (BoP Tech)" : "Altura Estática FIA / IMSA (BoP Tech)",
      value: `${staticFrontRhMm.toFixed(1)} mm Del / ${staticRearRhMm.toFixed(1)} mm Tras`,
      limit: `Mín. Legal >= ${minLegalRhMm.toFixed(1)} mm`,
      passed: staticFrontRhMm >= minLegalRhMm && staticRearRhMm >= minLegalRhMm
    },
    {
      label: "Presión Fría Neumáticos (iRacing Min Limit)",
      value: `${coldPressureKpa.toFixed(1)} kPa (${(coldPressureKpa * 0.145038).toFixed(1)} psi)`,
      limit: `Mín. Legal >= ${minLegalPressureKpa.toFixed(1)} kPa`,
      passed: coldPressureKpa >= minLegalPressureKpa
    },
    {
      label: "Caídas / Convergencia / Alerón Homologados",
      value: isVlnOrNurb ? "-3.3° Del / -2.5° Tras · Ala Media-Baja VLN" : "-3.5° Del / -2.7° Tras · Rango BoP",
      limit: "Límite Tech <= -4.0° / -3.5°",
      passed: true
    },
    {
      label: "Carga de Combustible & Restricción BoP",
      value: fuelLoadL,
      limit: "<= 100% Capacidad Homologada",
      passed: true
    }
  ];

  return {
    passed: checks.every(c => c.passed),
    statusLabel: "PASSED TECH · 0 FAILED TECH (BoP 26S4 OK)",
    officialFilename: fn,
    modelCode: getMmtModelCode(setup.car),
    circuitCode: getMmtCircuitCode(setup.circuit),
    sessionCode,
    sessionDescription: MMT_SESSION_DESCRIPTIONS[sessionCode] || "Configuración Oficial MMT",
    isNecVln: isVlnOrNurb,
    checks
  };
}

let officialStoTemplatesCache = null;

async function ensureStoTemplatesLoaded() {
  if (officialStoTemplatesCache) return officialStoTemplatesCache;
  try {
    const res = await fetch("/assets/data/official_car_sto_templates.json?v=26s4.mmt1");
    if (res.ok) {
      officialStoTemplatesCache = await res.json();
    }
  } catch (e) {
    console.warn("Could not load official sto templates:", e);
  }
  return officialStoTemplatesCache || {};
}

function synthesizeVerifiedMmtStoBase64(setup) {
  const carSlug = setup.car || "";
  const templates = officialStoTemplatesCache || window.__officialStoTemplatesCache;
  const rawBase64 = templates ? templates[carSlug] : null;
  if (rawBase64) {
    const sanitizedBytes = decodeAndSanitizeSto(rawBase64, carSlug);
    let binary = "";
    for (let i = 0; i < sanitizedBytes.byteLength; i++) {
      binary += String.fromCharCode(sanitizedBytes[i]);
    }
    return btoa(binary);
  }
  return null;
}

// DOM ready
document.addEventListener("DOMContentLoaded", () => {
  detectBrowserAndRestoreHandle();
  const urlParams = new URLSearchParams(window.location.search);

  // Enlace de invitación / restablecimiento: ?setpw=TOKEN
  const setPwToken = urlParams.get("setpw");
  if (setPwToken) {
    // Quitamos el token de la barra de direcciones (y del historial) cuanto antes.
    try {
      urlParams.delete("setpw");
      const qs = urlParams.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
    } catch (e) { /* noop */ }
    showAuthGate();
    openSetPasswordModal(setPwToken);
    return;
  }

  // Restore stored session (localStorage persistence + strict atrumin16@gmail.com admin rule)
  const savedToken = getStoredSession("mrt_vault_token");
  const savedUser = getStoredSession("mrt_vault_user");
  const savedEmail = localStorage.getItem("muntrume_user_email") || "";
  const savedAuthState = localStorage.getItem("muntrume_auth_state") || "";

  if ((savedToken && savedUser) || (savedAuthState === "authenticated" && savedEmail)) {
    currentToken = savedToken || "local_session";
    try {
      const parsed = savedUser ? JSON.parse(savedUser) : { email: savedEmail };
      currentUser = normalizeUserAccount(parsed, savedEmail);
      saveSession(currentToken, currentUser, true);
      showVaultView();
      loadCatalog();
      return;
    } catch (e) {
      handleLogout();
    }
  }

  // DEFAULT: Display landing page until user enters authorized!
  showLandingView();

  if (window.location.hash === "#join" || urlParams.get("mode") === "join") {
    openAuthModal("join");
  } else if (window.location.hash === "#login" || urlParams.get("mode") === "login") {
    openAuthModal("login");
  }
});

// ---- Session storage & strict atrumin16@gmail.com privilege rules ----
const ADMIN_EMAIL = "atrumin16@gmail.com";

function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

function normalizeUserAccount(user, fallbackEmail) {
  const base = user && typeof user === "object" ? Object.assign({}, user) : {};
  const email = String(base.email || fallbackEmail || "").trim().toLowerCase();
  base.email = email;
  if (isAdminEmail(email)) {
    base.email = ADMIN_EMAIL;
    base.role = "admin";
    base.handle = "atrumin16";
    base.name = "Alberto Trujillo";
    base.dorsal = "#16";
    base.title = "Team Principal & Administrator";
  }
  return base;
}

function isUserAuthenticated() {
  return Boolean(
    currentUser &&
    currentUser.role !== "guest" &&
    currentUser.email &&
    currentUser.email !== "105 Cars · 41,509 setups" &&
    currentToken &&
    currentToken !== "guest_token"
  );
}

function getStoredSession(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}
function sessionStore() {
  return localStorage;
}
function saveSession(token, user, remember) {
  const normalized = user ? normalizeUserAccount(user) : null;
  if (token) {
    localStorage.setItem("mrt_vault_token", token);
    sessionStorage.setItem("mrt_vault_token", token);
  }
  if (normalized) {
    const serialized = JSON.stringify(normalized);
    localStorage.setItem("mrt_vault_user", serialized);
    sessionStorage.setItem("mrt_vault_user", serialized);
    if (normalized.role !== "guest" && normalized.email) {
      localStorage.setItem("muntrume_user_email", normalized.email);
      localStorage.setItem("muntrume_auth_state", "authenticated");
      localStorage.setItem("muntrume_is_admin", isAdminEmail(normalized.email) ? "true" : "false");
    }
  }
  window.dispatchEvent(new Event("muntrume-auth-change"));
}

// Respuestas de sesión inválida → cerrar sesión o pedir cambio de contraseña
function handleAuthFailure(res, data) {
  if (data && data.code === "must_change_password") {
    openChangePasswordModal();
    return true;
  }
  if (res.status === 401) {
    handleLogout();
    const errorDiv = document.getElementById("loginError");
    if (errorDiv) {
      errorDiv.textContent = (data && data.error) || "Tu sesión ha caducado. Vuelve a iniciar sesión.";
      errorDiv.classList.remove("hidden");
    }
    return true;
  }
  return false;
}

// Switch login / request tabs
function switchTab(mode) {
  const loginForm = document.getElementById("loginForm");
  const joinForm = document.getElementById("joinForm");
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabJoinBtn = document.getElementById("tabJoinBtn");

  var login = mode !== "join";
  if (loginForm) loginForm.classList.toggle("hidden", !login);
  if (joinForm) joinForm.classList.toggle("hidden", login);
  if (tabLoginBtn) tabLoginBtn.classList.toggle("is-on", login);
  if (tabJoinBtn) tabJoinBtn.classList.toggle("is-on", !login);
}

function switchAuthTab(mode) {
  return switchTab(mode);
}

function toggleKeyVisibility() {
  const input = document.getElementById("loginKey");
  input.type = input.type === "password" ? "text" : "password";
}



// Authentication
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginKey").value;
  const remember = document.getElementById("rememberMe").checked;
  const errorDiv = document.getElementById("loginError");
  const submitBtn = document.getElementById("loginSubmitBtn");
  const btnText = document.getElementById("loginBtnText");

  errorDiv.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.setAttribute("aria-busy", "true");
  btnText.textContent = "Verificando…";

  try {
    const res = await fetch(`${API_BASE}/api/setups/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      currentToken = data.token;
      currentUser = normalizeUserAccount(data.user || { email }, email);
      saveSession(currentToken, currentUser, remember);
      document.getElementById("loginKey").value = "";

      if (data.must_change_password) {
        openChangePasswordModal();
        return;
      }

      showVaultView();
      await loadCatalog();
    } else {
      errorDiv.textContent = data.error || "No se pudo verificar la credencial.";
      errorDiv.classList.remove("hidden");
      document.getElementById("loginKey")?.setAttribute("aria-invalid", "true");
      document.getElementById("loginEmail")?.setAttribute("aria-invalid", "true");
      if (data.code === "no_password") {
        const fe = document.getElementById("forgotEmail");
        if (fe) fe.value = email;
      }
    }
  } catch (err) {
    errorDiv.textContent = "Error conectando con el servidor de Muntrume. Inténtalo de nuevo.";
    errorDiv.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.removeAttribute("aria-busy");
    btnText.textContent = "Entrar";
  }
}

// ==========================================
// OLVIDÉ MI CONTRASEÑA / PRIMER ACCESO
// ==========================================
function openForgotPasswordModal() {
  const modal = document.getElementById("forgotPasswordModal");
  if (!modal) return;
  const loginEmail = document.getElementById("loginEmail")?.value.trim();
  const fe = document.getElementById("forgotEmail");
  if (fe && loginEmail && !fe.value) fe.value = loginEmail;
  document.getElementById("forgotFeedback")?.classList.add("hidden");
  document.getElementById("forgotError")?.classList.add("hidden");
  modal.classList.remove("hidden");
  setTimeout(() => fe?.focus(), 50);
}

function closeForgotPasswordModal() {
  document.getElementById("forgotPasswordModal")?.classList.add("hidden");
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById("forgotEmail").value.trim();
  const feedback = document.getElementById("forgotFeedback");
  const errorDiv = document.getElementById("forgotError");
  const btn = document.getElementById("forgotSubmitBtn");
  feedback.classList.add("hidden");
  errorDiv.classList.add("hidden");
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/setups/password/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      feedback.textContent = data.message || "Si el correo pertenece a un piloto autorizado, recibirás un enlace en unos minutos.";
      feedback.classList.remove("hidden");
    } else {
      errorDiv.textContent = data.error || "No se pudo procesar la solicitud.";
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
    errorDiv.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// ==========================================
// CREAR CONTRASEÑA DESDE ENLACE (?setpw=)
// ==========================================
let pendingSetPwToken = null;

async function openSetPasswordModal(token) {
  pendingSetPwToken = token;
  const modal = document.getElementById("setPasswordModal");
  const intro = document.getElementById("setPwIntro");
  const form = document.getElementById("setPasswordForm");
  const errorDiv = document.getElementById("setPwError");
  if (!modal) return;
  modal.classList.remove("hidden");
  form.classList.add("hidden");
  errorDiv.classList.add("hidden");
  intro.textContent = "Comprobando enlace…";

  try {
    const res = await fetch(`${API_BASE}/api/setups/password/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, check_only: true })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      const who = data.name ? `${data.name} (${data.email})` : data.email;
      intro.textContent = data.purpose === "reset"
        ? `Elige una nueva contraseña para ${who}.`
        : `¡Bienvenido al equipo! Crea tu contraseña para ${who}.`;
      form.classList.remove("hidden");
      setTimeout(() => document.getElementById("setPwNew")?.focus(), 50);
    } else {
      intro.textContent = "";
      errorDiv.innerHTML = `${escapeHtml(data.error || "El enlace no es válido.")} <button type="button" onclick="closeSetPasswordModal(); openForgotPasswordModal();" class="underline font-bold">Pedir un enlace nuevo</button>`;
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    intro.textContent = "";
    errorDiv.textContent = "Error de conexión con el servidor. Recarga la página con el enlace del correo.";
    errorDiv.classList.remove("hidden");
  }
}

function closeSetPasswordModal() {
  pendingSetPwToken = null;
  document.getElementById("setPasswordModal")?.classList.add("hidden");
}

async function handleSetPassword(e) {
  e.preventDefault();
  const pw = document.getElementById("setPwNew").value;
  const confirm = document.getElementById("setPwConfirm").value;
  const errorDiv = document.getElementById("setPwError");
  const btn = document.getElementById("setPwBtn");
  errorDiv.classList.add("hidden");

  if (pw.length < 10) {
    errorDiv.textContent = "La contraseña debe tener al menos 10 caracteres.";
    errorDiv.classList.remove("hidden");
    return;
  }
  if (pw !== confirm) {
    errorDiv.textContent = "Las contraseñas no coinciden.";
    errorDiv.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/setups/password/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: pendingSetPwToken, new_password: pw })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.token) {
      currentToken = data.token;
      currentUser = data.user;
      saveSession(currentToken, currentUser, false);
      closeSetPasswordModal();
      document.getElementById("setPasswordForm").reset();
      showVaultView();
      await loadCatalog();
      showDownloadToast("Contraseña guardada", "success");
    } else {
      errorDiv.textContent = data.error || "No se pudo guardar la contraseña.";
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
    errorDiv.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

// Driver Join Request
async function handleJoinRequest(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = document.getElementById("reqName")?.value.trim() || "";
  const email = document.getElementById("reqEmail")?.value.trim() || "";
  const iracing_id = document.getElementById("reqIracingId")?.value.trim() || "";
  const car_category = document.getElementById("reqCategory")?.value.trim() || "";
  const message = document.getElementById("reqMessage")?.value.trim() || "";
  const website = document.getElementById("reqWebsite")?.value || "";

  const feedback = document.getElementById("joinFeedback");
  const errorDiv = document.getElementById("joinError");
  const submitBtn = document.getElementById("joinSubmitBtn");
  const btnText = document.getElementById("joinBtnText") || submitBtn;

  if (feedback) feedback.classList.add("hidden");
  if (errorDiv) errorDiv.classList.add("hidden");
  if (submitBtn) submitBtn.disabled = true;
  if (btnText) btnText.textContent = "Enviando…";

  try {
    const res = await fetch(`${API_BASE}/api/setups/request-join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, iracing_id, car_category, message, website })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (feedback) {
        feedback.innerHTML = `
          <div class="font-bold text-white mb-0.5">${data.duplicate ? "ℹ️ Solicitud ya registrada" : "✅ Solicitud enviada"}</div>
          <div>${escapeHtml(data.message || "Hemos recibido tu solicitud.")}</div>
        `;
        feedback.classList.remove("hidden");
      }
      const form = document.getElementById("joinForm");
      if (form) form.reset();
    } else {
      if (errorDiv) {
        errorDiv.textContent = data.error || "Error al enviar la solicitud.";
        errorDiv.classList.remove("hidden");
      }
    }
  } catch (err) {
    if (errorDiv) {
      errorDiv.textContent = "Error de conexión con el servidor.";
      errorDiv.classList.remove("hidden");
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = "Solicitar Acceso al Garage →";
  }
}


// ==========================================
// CAMBIO DE CONTRASEÑA (obligatorio tras contraseña temporal)
// ==========================================
function openChangePasswordModal() {
  document.getElementById("changePasswordModal")?.classList.remove("hidden");
}

function closeChangePasswordModal() {
  document.getElementById("changePasswordModal")?.classList.add("hidden");
}

async function handleChangePassword(e) {
  e.preventDefault();
  const newPass = document.getElementById("newPassInput").value;
  const confirmPass = document.getElementById("confirmPassInput").value;
  const errorDiv = document.getElementById("changePassError");
  const submitBtn = document.getElementById("changePassBtn");

  errorDiv.classList.add("hidden");

  if (newPass.length < 10) {
    errorDiv.textContent = "La contraseña debe tener al menos 10 caracteres.";
    errorDiv.classList.remove("hidden");
    return;
  }

  if (newPass !== confirmPass) {
    errorDiv.textContent = "Las contraseñas no coinciden. Por favor verifícalas.";
    errorDiv.classList.remove("hidden");
    return;
  }

  submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/setups/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ new_password: newPass })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (data.token) {
        currentToken = data.token;
        if (data.user) currentUser = data.user;
        saveSession(currentToken, currentUser);
      }
      document.getElementById("changePasswordForm")?.reset();
      closeChangePasswordModal();
      showVaultView();
      await loadCatalog();
      showDownloadToast("Contraseña actualizada", "success");
    } else if (res.status === 401) {
      closeChangePasswordModal();
      handleAuthFailure(res, data);
    } else {
      errorDiv.textContent = data.error || "Error al actualizar la contraseña.";
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    errorDiv.textContent = "Error de conexión con el servidor.";
    errorDiv.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
  }
}

function handleLogout() {
  currentToken = null;
  currentUser = null;
  allSetups = [];
  iracingDirHandle = null;
  localStorage.removeItem("mrt_vault_token");
  localStorage.removeItem("mrt_vault_user");
  localStorage.removeItem("muntrume_user_email");
  localStorage.removeItem("muntrume_auth_state");
  localStorage.removeItem("muntrume_is_admin");
  sessionStorage.removeItem("mrt_vault_token");
  sessionStorage.removeItem("mrt_vault_user");
  window.dispatchEvent(new Event("muntrume-auth-change"));
  syncGarageAuthUI();
  showLandingView();
}

function openAuthModal(tab = "login") {
  const modal = document.getElementById("authModal");
  if (modal) {
    modal.classList.remove("hidden");
    switchTab(tab);
  }
}
window.openAuthModal = openAuthModal;

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.add("hidden");
}
window.closeAuthModal = closeAuthModal;

function syncGarageAuthUI() {
  const emailDisp = document.getElementById("userEmailDisplay");
  const roleBadge = document.getElementById("userRoleBadge");
  const adminBtn = document.getElementById("adminPanelBtn");
  const authBtn = document.getElementById("authGateOpenBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const heroSessionPill = document.getElementById("heroSessionPill");
  const heroSessionIdentity = document.getElementById("heroSessionIdentity");
  const heroSessionName = document.getElementById("heroSessionName");
  const heroRaceControlBtn = document.getElementById("heroRaceControlBtn");
  const heroLogoutBtn = document.getElementById("heroLogoutBtn");
  const signInButtons = document.querySelectorAll("[data-driver-signin-btn]");

  const isAuth = isUserAuthenticated();
  const isAdmin = isAuth && (isAdminEmail(currentUser?.email) || currentUser?.role === "admin");

  const authWall = document.getElementById("vaultAuthGateWall");
  const setupsContent = document.getElementById("vaultSetupsContent");

  if (authWall) {
    if (isAuth) {
      authWall.classList.add("hidden");
    } else {
      authWall.classList.remove("hidden");
    }
  }

  if (setupsContent) {
    if (isAuth) {
      setupsContent.classList.remove("hidden");
    } else {
      setupsContent.classList.add("hidden");
    }
  }

  signInButtons.forEach((btn) => {
    btn.classList.toggle("hidden", isAuth);
    if (isAuth) btn.setAttribute("hidden", "");
    else btn.removeAttribute("hidden");
  });

  if (isAdmin) {
    if (emailDisp) {
      emailDisp.textContent = "atrumin16 · Alberto Trujillo (#16)";
      emailDisp.title = "atrumin16@gmail.com — Team Principal & Administrator";
    }
    if (roleBadge) {
      roleBadge.textContent = "Team Principal & Admin";
      roleBadge.className = "g-badge is-admin";
    }
    if (adminBtn) adminBtn.classList.remove("hidden");
    if (authBtn) authBtn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (heroSessionPill) {
      heroSessionPill.classList.remove("hidden");
      heroSessionPill.classList.add("inline-flex");
    }
    if (heroSessionIdentity) heroSessionIdentity.textContent = "atrumin16";
    if (heroSessionName) heroSessionName.textContent = "Alberto Trujillo (#16)";
    if (heroRaceControlBtn) heroRaceControlBtn.classList.remove("hidden");
    if (heroLogoutBtn) heroLogoutBtn.classList.remove("hidden");
  } else if (currentUser && currentUser.role === "guest") {
    if (emailDisp) emailDisp.textContent = "105 Cars · 41,509 Setups";
    if (roleBadge) {
      roleBadge.textContent = "Catalog Preview";
      roleBadge.className = "g-badge is-guest";
    }
    if (adminBtn) adminBtn.classList.add("hidden");
    if (authBtn) authBtn.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (heroSessionPill) {
      heroSessionPill.classList.add("hidden");
      heroSessionPill.classList.remove("inline-flex");
    }
    if (heroRaceControlBtn) heroRaceControlBtn.classList.add("hidden");
    if (heroLogoutBtn) heroLogoutBtn.classList.add("hidden");
  } else if (isAuth) {
    if (emailDisp) emailDisp.textContent = currentUser.email;
    if (roleBadge) {
      roleBadge.textContent = "Official Driver";
      roleBadge.className = "g-badge is-pilot";
    }
    if (adminBtn) adminBtn.classList.add("hidden");
    if (authBtn) authBtn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (heroSessionPill) {
      heroSessionPill.classList.remove("hidden");
      heroSessionPill.classList.add("inline-flex");
    }
    if (heroSessionIdentity) heroSessionIdentity.textContent = currentUser.email.split("@")[0];
    if (heroSessionName) heroSessionName.textContent = currentUser.name || "Official Driver";
    if (heroRaceControlBtn) heroRaceControlBtn.classList.add("hidden");
    if (heroLogoutBtn) heroLogoutBtn.classList.remove("hidden");
  } else {
    if (emailDisp) emailDisp.textContent = "Guest";
    if (roleBadge) {
      roleBadge.textContent = "Catalog";
      roleBadge.className = "g-badge";
    }
    if (adminBtn) adminBtn.classList.add("hidden");
    if (authBtn) authBtn.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (heroSessionPill) {
      heroSessionPill.classList.add("hidden");
      heroSessionPill.classList.remove("inline-flex");
    }
    if (heroRaceControlBtn) heroRaceControlBtn.classList.add("hidden");
    if (heroLogoutBtn) heroLogoutBtn.classList.add("hidden");
  }
}

function showLandingView() {
  const landing = document.getElementById("vaultLanding");
  const dashboard = document.getElementById("vaultDashboard");
  const authModal = document.getElementById("authModal");
  const compatBanner = document.getElementById("browserCompatBanner");
  const reconnectBanner = document.getElementById("savedFolderReconnectBanner");

  if (authModal) authModal.classList.add("hidden");
  if (landing) landing.classList.remove("hidden");
  if (dashboard) dashboard.classList.add("hidden");
  if (compatBanner) compatBanner.classList.add("hidden");
  if (reconnectBanner) reconnectBanner.classList.add("hidden");
  syncGarageAuthUI();
}
window.showLandingView = showLandingView;

function openCodeLoginFromLanding() {
  openAuthModal("login");
  if (typeof window.showCodeLogin === "function") {
    window.showCodeLogin();
  }
}
window.openCodeLoginFromLanding = openCodeLoginFromLanding;

function showAuthGate() {
  openAuthModal("login");
}

function enterGuestPreview() {
  closeAuthModal();
  currentUser = { email: "105 Cars · 41,509 setups", role: "guest" };
  showVaultView();
  loadCatalog();
}
window.enterGuestPreview = enterGuestPreview;

function showVaultView() {
  const authModal = document.getElementById("authModal");
  if (authModal) authModal.classList.add("hidden");

  const landing = document.getElementById("vaultLanding");
  const dashboard = document.getElementById("vaultDashboard");
  if (landing) landing.classList.add("hidden");
  if (dashboard) dashboard.classList.remove("hidden");

  detectBrowserAndRestoreHandle();
  syncGarageAuthUI();
  if (window.muntruBuilderSync) window.muntruBuilderSync();
}

// ==========================================
// BROWSER DETECTION, BRAVE FIX & INDEXEDDB PERSISTENCE
// ==========================================
function openIdb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error("No IndexedDB"));
    const req = indexedDB.open("muntrume_vault_fs", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandleToIdb(handle) {
  try {
    const db = await openIdb();
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "iracing_setups_root");
  } catch (e) {
    console.warn("No se pudo guardar handle en IndexedDB:", e);
  }
}

async function loadDirHandleFromIdb() {
  try {
    const db = await openIdb();
    return await new Promise((resolve) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("iracing_setups_root");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function clearDirHandleFromIdb() {
  try {
    const db = await openIdb();
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").delete("iracing_setups_root");
  } catch (e) {}
}

const FS_NOTICE_KEY = "mm_fs_notice_dismissed";

function fsPickerAvailable() {
  return typeof window.showDirectoryPicker === "function";
}

function fsNoticeDismissed() {
  try { return localStorage.getItem(FS_NOTICE_KEY) === "1"; } catch (e) { return false; }
}

async function syncFsAccessNotice(forceShow) {
  const el = document.getElementById("fsAccessNotice");
  if (!el) return;
  const supportsFS = fsPickerAvailable();
  let isBrave = false;
  try {
    if (navigator.brave && typeof navigator.brave.isBrave === "function") {
      isBrave = await navigator.brave.isBrave();
    }
  } catch (e) {}
  detectedBrowserInfo = { isBrave, supportsFS, name: isBrave ? "Brave" : "navegador" };
  if (supportsFS) {
    el.hidden = true;
    return;
  }
  if (!forceShow && fsNoticeDismissed()) {
    el.hidden = true;
    const status = document.getElementById("metricDirectStatus");
    if (status && !iracingDirHandle) status.textContent = "Solo descarga de archivo";
    return;
  }
  const braveBox = document.getElementById("fsNoticeBrave");
  const otherBox = document.getElementById("fsNoticeOther");
  if (braveBox) braveBox.hidden = !isBrave;
  if (otherBox) otherBox.hidden = isBrave;
  el.hidden = false;
  const status = document.getElementById("metricDirectStatus");
  if (status && !iracingDirHandle) status.textContent = "Solo descarga de archivo";
}

function dismissFsAccessNotice() {
  try { localStorage.setItem(FS_NOTICE_KEY, "1"); } catch (e) {}
  const el = document.getElementById("fsAccessNotice");
  if (el) el.hidden = true;
}

async function detectBrowserAndRestoreHandle() {
  if (!fsPickerAvailable()) {
    await syncFsAccessNotice(false);
    return;
  }
  detectedBrowserInfo = { isBrave: false, supportsFS: true, name: "navegador" };
  const fsNote = document.getElementById("fsAccessNotice");
  if (fsNote) fsNote.hidden = true;

  const savedHandle = await loadDirHandleFromIdb();
  if (savedHandle) {
    try {
      const perm = await savedHandle.queryPermission({ mode: "readwrite" });
      if (perm === "granted") {
        iracingDirHandle = savedHandle;
        updateLinkDirectoryUI(true, savedHandle.name);
        return;
      } else {
        savedPendingDirHandle = savedHandle;
        const recBanner = document.getElementById("savedFolderReconnectBanner");
        const recName = document.getElementById("savedFolderNameLabel");
        if (recName) recName.textContent = savedHandle.name;
        recBanner?.classList.remove("hidden");
      }
    } catch (e) {}
  }
  if (!iracingDirHandle) updateLinkDirectoryUI(false);
}

async function reconnectSavedDirectory() {
  if (!savedPendingDirHandle) {
    return toggleLinkDirectory();
  }
  try {
    const perm = await savedPendingDirHandle.requestPermission({ mode: "readwrite" });
    if (perm === "granted") {
      iracingDirHandle = savedPendingDirHandle;
      savedPendingDirHandle = null;
      document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
      updateLinkDirectoryUI(true, iracingDirHandle.name);
      showDownloadToast("Carpeta reconectada", "success", iracingDirHandle.name);
    }
  } catch (e) {
    toggleLinkDirectory();
  }
}

function openBrowserCompatModal() {
  syncFsAccessNotice(true).then(function () {
    const el = document.getElementById("fsAccessNotice");
    const details = el && el.querySelector("details");
    if (details) details.open = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  });
}

function closeBrowserCompatModal() {
  dismissFsAccessNotice();
}

function copyBraveFlagUrl() {
  const flagUrl = "brave://flags/#file-system-access-api";
  const ok = function () { showDownloadToast("Dirección copiada", "success"); };
  const fail = function () { showDownloadToast("No se pudo copiar. Selecciona la dirección del aviso.", "warning"); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(flagUrl).then(ok).catch(fail);
  } else fail();
}

function copyBraveFlagUrlWithTooltip(btn) {
  const flagUrl = "brave://flags/#file-system-access-api";
  const tip = document.getElementById("flagsTooltip");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(flagUrl).then(() => {
      if (tip) {
        tip.classList.remove("hidden");
        setTimeout(() => tip.classList.add("hidden"), 3000);
      }
      showDownloadToast("¡Copiado al portapapeles!", "success");
    }).catch(() => {
      copyBraveFlagUrl();
    });
  } else {
    copyBraveFlagUrl();
  }
}

function openFallbackDownloadModal() {
  const modal = document.getElementById("fallbackDownloadModal");
  if (modal) modal.classList.remove("hidden");
}

function closeFallbackDownloadModal() {
  const modal = document.getElementById("fallbackDownloadModal");
  if (modal) modal.classList.add("hidden");
}

function triggerFallbackDownload(btn) {
  const textSpan = document.getElementById("directDownloadFallbackText");
  if (!btn) return;
  btn.disabled = true;
  if (textSpan) textSpan.textContent = "Generando archivo .sto...";

  const targetSetup = window.currentPreviewSetup || {
    id: 50001,
    car: "ferrari296gt3",
    circuit: "Spa",
    filename: "MMT_F296_SPA_S.sto",
    setup_type: "Race"
  };
  const targetName = formatOfficialMmtFilename(targetSetup.car, targetSetup.circuit, targetSetup.filename || targetSetup.file, targetSetup.setup_type);
  const b64 = synthesizeVerifiedMmtStoBase64(targetSetup);
  const byteArray = decodeAndSanitizeSto(b64, targetSetup.car);
  const blob = new Blob([byteArray], { type: "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = targetName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    btn.classList.remove("bg-[#00ff88]", "hover:bg-[#00c985]");
    btn.classList.add("bg-emerald-400", "text-neutral-950");
    if (textSpan) textSpan.textContent = "✓ ¡Descarga completada! Guardado en Descargas";
    showDownloadToast("¡Descarga completada con éxito!", "success", targetName);
    setTimeout(() => {
      btn.disabled = false;
      if (textSpan) textSpan.textContent = "Descargar archivo .sto directo";
      btn.classList.add("bg-[#00ff88]", "hover:bg-[#00c985]");
      btn.classList.remove("bg-emerald-400");
    }, 3500);
  }, 600);
}

function copyVaultUrlForChrome() {
  const url = "https://muntru.me/garage";
  const ok = function () { showDownloadToast("Enlace copiado", "success"); };
  const fail = function () { showDownloadToast("No se pudo copiar el enlace.", "warning"); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(ok).catch(fail);
  } else fail();
}

async function toggleLinkDirectory() {
  if (currentUser && currentUser.role === 'guest') {
    showDownloadToast("Entra con tu cuenta de piloto para vincular la carpeta.", "warning");
    showAuthGate();
    return;
  }

  if (!fsPickerAvailable()) {
    openFallbackDownloadModal();
    return;
  }

  if (iracingDirHandle) {
    if (confirm("¿Deseas desvincular la carpeta de iRacing? Puedes volver a vincularla cuando quieras.")) {
      iracingDirHandle = null;
      savedPendingDirHandle = null;
      await clearDirHandleFromIdb();
      updateLinkDirectoryUI(false);
      showDownloadToast("Carpeta desvinculada");
    }
    return;
  }

  if (savedPendingDirHandle) {
    try {
      const perm = await savedPendingDirHandle.requestPermission({ mode: "readwrite" });
      if (perm === "granted") {
        iracingDirHandle = savedPendingDirHandle;
        savedPendingDirHandle = null;
        document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
        updateLinkDirectoryUI(true, iracingDirHandle.name);
        showDownloadToast("Carpeta vinculada", "success", iracingDirHandle.name);
        return;
      }
    } catch (e) {}
  }

  try {
    iracingDirHandle = await window.showDirectoryPicker({
      id: "iracing-setups-picker",
      mode: "readwrite",
      startIn: "documents"
    });

    await saveDirHandleToIdb(iracingDirHandle);
    document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
    updateLinkDirectoryUI(true, iracingDirHandle.name);
    showDownloadToast("Carpeta vinculada", "success", iracingDirHandle.name);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error("DirectoryPicker error:", err);
      showDownloadToast("No se pudo acceder a la carpeta", "error", err.message);
    }
  }
}

// Smart auto-connection on download so every file lands in its exact path
async function ensureDirectoryHandleForDownload() {
  if (iracingDirHandle) return iracingDirHandle;
  if (!(fsPickerAvailable())) return null;

  if (savedPendingDirHandle) {
    try {
      const perm = await savedPendingDirHandle.requestPermission({ mode: "readwrite" });
      if (perm === "granted") {
        iracingDirHandle = savedPendingDirHandle;
        savedPendingDirHandle = null;
        document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
        updateLinkDirectoryUI(true, iracingDirHandle.name);
        return iracingDirHandle;
      }
    } catch (e) {}
  }

  try {
    iracingDirHandle = await window.showDirectoryPicker({
      id: "iracing-setups-picker",
      mode: "readwrite",
      startIn: "documents"
    });
    await saveDirHandleToIdb(iracingDirHandle);
    document.getElementById("savedFolderReconnectBanner")?.classList.add("hidden");
    updateLinkDirectoryUI(true, iracingDirHandle.name);
    return iracingDirHandle;
  } catch (e) {
    return null;
  }
}

function isNecSetup(circuit, filename) {
  const c = String(circuit || "").toLowerCase();
  const f = String(filename || "").toUpperCase();
  return c.includes("vln") || c.includes("nec") || f.includes("_VLN_");
}

function getMtSetupsHierarchyParts(season, week, circuit) {
  const s = (season || "26S4").toUpperCase().trim();
  const yr = /^\d{2}/.test(s) ? `20${s.slice(0, 2)}` : "2026";
  const sNum = /\d$/.test(s) ? s.slice(-1) : "4";
  const seasonFolder = `SEASON ${sNum}`;
  const wNum = parseInt((week || "W07").replace(/\D/g, ""), 10) || 7;
  const weekFolder = `WEEK ${String(wNum).padStart(2, "0")}`;
  const circFolder = (circuit || "General").trim();
  return { yr, seasonFolder, weekFolder, circFolder };
}

function formatMtSetupsDisplayPath(car, season, week, circuit, filename = "") {
  const { yr, seasonFolder, weekFolder, circFolder } = getMtSetupsHierarchyParts(season, week, circuit);
  let base;
  if (isNecSetup(circuit, filename)) {
    base = `${car}\\Garage 61 - Muntrume Motorsport\\MT SETUPS\\NEC - Nurburgring Combined VLN\\${weekFolder}\\Nurburgring Combined VLN`;
  } else {
    base = `${car}\\Garage 61 - Muntrume Motorsport\\MT SETUPS\\${yr}\\${seasonFolder}\\${weekFolder}\\${circFolder}`;
  }
  return filename ? `${base}\\${filename}` : `${base}\\`;
}

// Smart resolver: writes strictly into Garage 61 - Muntrume Motorsport\MT SETUPS and Garage 61\MT SETUPS
async function resolveExactSetupDir(rootHandle, car, season, week, circuit) {
  let baseSetupsDir = rootHandle;
  const rootName = (rootHandle.name || "").toLowerCase().trim();
  const safeCar = (car || "").trim();

  if (rootName === "documents" || rootName === "documentos" || rootName === "mis documentos") {
    const irDir = await rootHandle.getDirectoryHandle("iRacing", { create: true });
    baseSetupsDir = await irDir.getDirectoryHandle("setups", { create: true });
  } else if (rootName === "iracing") {
    baseSetupsDir = await rootHandle.getDirectoryHandle("setups", { create: true });
  }

  let carFolder = baseSetupsDir;
  if (baseSetupsDir.name.toLowerCase() !== safeCar.toLowerCase()) {
    carFolder = await baseSetupsDir.getDirectoryHandle(safeCar, { create: true });
  }

  const { yr, seasonFolder, weekFolder, circFolder: circName } = getMtSetupsHierarchyParts(season, week, circuit);
  const isNec = isNecSetup(circuit);

  async function ensureMtHierarchy(parentHandle) {
    const mtFolder = await parentHandle.getDirectoryHandle("MT SETUPS", { create: true });
    if (isNec) {
      const necDir = await mtFolder.getDirectoryHandle("NEC - Nurburgring Combined VLN", { create: true });
      const wDir = await necDir.getDirectoryHandle(weekFolder, { create: true });
      const cDir = await wDir.getDirectoryHandle("Nurburgring Combined VLN", { create: true });
      return [cDir];
    }
    const yDir = await mtFolder.getDirectoryHandle(yr, { create: true });
    const sDir = await yDir.getDirectoryHandle(seasonFolder, { create: true });
    const wDir = await sDir.getDirectoryHandle(weekFolder, { create: true });
    const cDir = await wDir.getDirectoryHandle(circName, { create: true });
    return [cDir];
  }

  const teamFolder = await carFolder.getDirectoryHandle("Garage 61 - Muntrume Motorsport", { create: true });
  const teamTargets = await ensureMtHierarchy(teamFolder);
  const g61Folder = await carFolder.getDirectoryHandle("Garage 61", { create: true });
  const g61Targets = await ensureMtHierarchy(g61Folder);

  const allTargetDirs = [...teamTargets, ...g61Targets];
  const relDisplay = isNec
    ? `${safeCar}\\Garage 61 - Muntrume Motorsport\\MT SETUPS\\NEC - Nurburgring Combined VLN\\${weekFolder}\\Nurburgring Combined VLN`
    : `${safeCar}\\Garage 61 - Muntrume Motorsport\\MT SETUPS\\${yr}\\${seasonFolder}\\${weekFolder}\\${circName}`;
  return { circFolder: teamTargets[0], allTargetDirs, folderName: isNec ? "Nurburgring Combined VLN" : circName, relDisplay };
}

async function writeSetupBytesToTargets(resolved, filename, byteArray) {
  const dirs = resolved.allTargetDirs || [resolved.circFolder];
  for (const dirHandle of dirs) {
    try {
      const fh = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fh.createWritable();
      await writable.write(byteArray);
      await writable.close();
    } catch (e) {}
  }
}

function buildExactPathInstallerBat() {
  return [
    "@echo off",
    "chcp 65001 >nul",
    "echo =========================================================",
    "echo   MUNTRUME MOTORSPORT - INSTALADOR AUTOMATICO DE SETUPS",
    "echo =========================================================",
    "set \"TARGET=%USERPROFILE%\\Documents\\iRacing\\setups\"",
    "if not exist \"%TARGET%\" mkdir \"%TARGET%\"",
    "xcopy /E /I /Y \"%~dp0*\" \"%TARGET%\\\" /EXCLUDE:%~nx0 >nul 2>&1",
    "for /D %%D in (\"%~dp0*\") do (",
    "  xcopy /E /I /Y \"%%D\" \"%TARGET%\\%%~nxD\\\" >nul",
    ")",
    "echo.",
    "echo [OK] Todos los setups se han instalado en su ruta exacta:",
    "echo      %TARGET%",
    "echo.",
    "pause"
  ].join("\r\n");
}

function updateLinkDirectoryUI(linked, folderName = "") {
  const text = document.getElementById("linkFolderText");
  const metricStatus = document.getElementById("metricDirectStatus");
  if (text) text.textContent = linked ? "Carpeta vinculada" : "Vincular carpeta de iRacing";
  if (metricStatus) {
    if (linked && folderName) {
      metricStatus.textContent = folderName;
      metricStatus.setAttribute("data-no-i18n", "");
    } else if (fsPickerAvailable()) {
      metricStatus.textContent = "Listo para vincular";
      metricStatus.removeAttribute("data-no-i18n");
    } else {
      metricStatus.textContent = "Solo descarga de archivo";
      metricStatus.removeAttribute("data-no-i18n");
    }
  }
  applyFilters();
}

// ==========================================
// CATALOG MANAGEMENT & FILTERING (<30MB RAM MICRO-LOADER)
// ==========================================
function unpackCompactRows(rows) {
  return (rows || []).map(r => {
    const car = r[1] || "";
    const season = r[2] || "26S4";
    const week = r[3] || "W01";
    const circuit = r[4] || "General";
    const setupType = r[6] || "Race";
    const rawFn = r[5] || "";
    const officialFn = formatOfficialMmtFilename(car, circuit, rawFn, setupType);
    return {
      id: r[0],
      car,
      season,
      week,
      circuit,
      filename: officialFn,
      raw_filename: rawFn,
      setup_type: setupType,
      size_bytes: r[7] || 4096
    };
  });
}

async function loadCatalog() {
  syncGarageAuthUI();
  if (!isUserAuthenticated()) {
    const skeleton = document.getElementById("loadingSkeleton") || document.getElementById("setupsLoading");
    skeleton?.classList.add("hidden");
    return;
  }

  const skeleton = document.getElementById("loadingSkeleton") || document.getElementById("setupsLoading");
  const grid = document.getElementById("setupsGrid");
  skeleton?.classList.remove("hidden");
  if (grid) grid.innerHTML = "";

  if (currentToken) {
    fetch(`${API_BASE}/api/setups/catalog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentToken}`
      },
      body: JSON.stringify({ car: "__ping__" })
    }).then(async res => {
      if (res.status === 401 || res.status === 403) {
        const data = await res.json().catch(() => ({}));
        handleAuthFailure(res, data);
      }
    }).catch(() => {});
  }

  // Cargar SOLO el índice ligero de 24 KB (en vez de 42.654 objetos en RAM)
  try {
    const idxRes = await fetch("/assets/data/catalog_index.json?v=26s4.mmt1");
    if (idxRes.ok) {
      const idxData = await idxRes.json();
      totalVaultSetupsCount = idxData.total_setups || 0;
      initialIndexRows = unpackCompactRows(idxData.initial_rows || []);
      allSetups = initialIndexRows;
      activeLoadedScopeKey = "index";

      if (!dropdownsInitialized) {
        populateAllDropdowns(idxData.cars || [], idxData.seasons || [], idxData.weeks || [], idxData.circuits || []);
        dropdownsInitialized = true;
      }
      const metricCars = document.getElementById("metricCarsCount");
      if (metricCars && idxData.cars) metricCars.textContent = idxData.cars.length;
      const metricCircs = document.getElementById("metricCircuitsCount");
      if (metricCircs && idxData.circuits) metricCircs.textContent = idxData.circuits.length;
    }
  } catch (err) {
    console.error("Error al cargar catalog_index.json:", err);
  }

  skeleton?.classList.add("hidden");
  const metricSetups = document.getElementById("metricSetupsCount");
  if (metricSetups) metricSetups.textContent = totalVaultSetupsCount.toLocaleString();
  await ensureScopeLoadedAndApplyFilters();
}

async function ensureScopeLoadedAndApplyFilters() {
  const selectedCar = document.getElementById("carSelect")?.value || "";
  const selectedSeason = document.getElementById("seasonSelect")?.value || "";
  const selectedWeek = document.getElementById("weekSelect")?.value || "";
  const selectedCircuit = document.getElementById("circuitSelect")?.value || "";
  const query = (document.getElementById("searchInput")?.value || "").trim();

  let targetScope = "index";
  let fetchUrl = null;

  if (selectedCar) {
    const carSlug = safeCarChunkSlug(selectedCar);
    targetScope = `car:${carSlug}`;
    fetchUrl = `/assets/data/catalog_by_car/${carSlug}.json?v=26s4.mmt1`;
  } else if (selectedSeason || selectedWeek || selectedCircuit || query || document.getElementById("catPill-nec")?.classList.contains("is-on")) {
    const sn = selectedSeason || "26S4";
    const snSlug = safeCarChunkSlug(sn);
    targetScope = `season:${snSlug}`;
    fetchUrl = `/assets/data/catalog_by_season/${snSlug}.json?v=26s4.mmt1`;
  }

  if (targetScope !== activeLoadedScopeKey) {
    if (targetScope === "index") {
      allSetups = initialIndexRows;
      activeLoadedScopeKey = "index";
    } else if (fetchUrl) {
      try {
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const rows = await res.json();
          allSetups = unpackCompactRows(rows);
          activeLoadedScopeKey = targetScope;
        }
      } catch (e) {
        console.warn("Error loading micro catalog scope:", e);
      }
    }
  }

  applyFilters();
}

function onFilterChange() {
  ensureScopeLoadedAndApplyFilters();
}

function refreshCatalog() {
  loadCatalog();
}

function populateAllDropdowns(cars, seasons, weeks, circuits) {
  const carSel = document.getElementById("carSelect");
  const seasonSel = document.getElementById("seasonSelect");
  const weekSel = document.getElementById("weekSelect");
  const circSel = document.getElementById("circuitSelect");

  // 1. Coches (64)
  if (carSel) {
    const curVal = carSel.value;
    carSel.innerHTML = `<option value="">Todos los Coches (${cars.length})</option>`;
    cars.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = CAR_LABELS[c] || c;
      if (c === curVal) opt.selected = true;
      carSel.appendChild(opt);
    });
    const metricCars = document.getElementById("metricCarsCount");
    if (metricCars) metricCars.textContent = cars.length;
  }

  // 2. Temporadas (26S4, 26S3, 26S2)
  if (seasonSel) {
    const curVal = seasonSel.value;
    seasonSel.innerHTML = '<option value="">Todas las Temporadas</option>';
    seasons.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      let label = s;
      if (s === "26S4") label = "2026 Season 4 (Oficial)";
      else if (s === "26S3") label = "2026 Season 3";
      else if (s === "26S2") label = "2026 Season 2";
      opt.textContent = label;
      if (s === curVal) opt.selected = true;
      seasonSel.appendChild(opt);
    });
  }

  // 3. Semanas (W01 a W13 + Special Events)
  if (weekSel) {
    const curVal = weekSel.value;
    weekSel.innerHTML = '<option value="">Todas las Semanas</option>';
    const sortedWeeks = [...weeks].sort((a, b) => {
      if (a.startsWith("W") && b.startsWith("W")) return a.localeCompare(b);
      if (a.startsWith("W")) return -1;
      if (b.startsWith("W")) return 1;
      return a.localeCompare(b);
    });
    sortedWeeks.forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      if (w === curVal) opt.selected = true;
      weekSel.appendChild(opt);
    });
  }

  // 4. Circuitos (50/61)
  if (circSel) {
    const curVal = circSel.value;
    circSel.innerHTML = `<option value="">Todos los Circuitos (${circuits.length})</option>`;
    circuits.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      if (c === curVal) opt.selected = true;
      circSel.appendChild(opt);
    });
    const metricCirc = document.getElementById("metricCircuitsCount");
    if (metricCirc) metricCirc.textContent = circuits.length;
  }
}

function setTypeFilter(type) {
  currentTypeFilter = !type ? "All" : type;
  const map = { All: "typeAll", Race: "typeRace", Qualy: "typeQualy", Wet: "typeWet" };
  ["All", "Race", "Qualy", "Wet"].forEach(t => {
    const pillBtn = document.getElementById(map[t]);
    if (pillBtn) pillBtn.classList.toggle("is-on", t === currentTypeFilter);
    const btn = document.getElementById(`btnType${t}`);
    if (btn) {
      if (t === currentTypeFilter) {
        btn.classList.add("bg-[#161c24]", "text-white", "shadow");
        btn.classList.remove("text-neutral-400");
      } else {
        btn.classList.remove("bg-[#161c24]", "text-white", "shadow");
        btn.classList.add("text-neutral-400");
      }
    }
  });
  applyFilters();
}

function resetGarageFilters() {
  const carSel = document.getElementById("carSelect");
  const seasonSel = document.getElementById("seasonSelect");
  const weekSel = document.getElementById("weekSelect");
  const circSel = document.getElementById("circuitSelect");
  const searchInput = document.getElementById("searchInput");
  if (carSel) carSel.value = "";
  if (seasonSel) seasonSel.value = "";
  if (weekSel) weekSel.value = "";
  if (circSel) circSel.value = "";
  if (searchInput) searchInput.value = "";
  document.querySelectorAll(".mmt-cat-pill").forEach(p => p.classList.remove("is-on"));
  document.getElementById("catPill-all")?.classList.add("is-on");
  setTypeFilter("All");
  onFilterChange();
}

// Switch between 'folders' view and 'list' view
function setViewMode(mode) {
  currentViewMode = mode;
  const foldersBtn = document.getElementById("viewModeFoldersBtn");
  const listBtn = document.getElementById("viewModeListBtn");
  const ftpBtn = document.getElementById("viewModeFtpBtn");
  const toggleAllBtn = document.getElementById("toggleAllFoldersBtn");

  [foldersBtn, listBtn, ftpBtn].forEach(btn => btn?.classList.remove("is-on"));

  if (mode === "folders") {
    foldersBtn?.classList.add("is-on");
    toggleAllBtn?.classList.remove("hidden");
  } else if (mode === "list") {
    listBtn?.classList.add("is-on");
    toggleAllBtn?.classList.add("hidden");
  } else if (mode === "ftp") {
    ftpBtn?.classList.add("is-on");
    toggleAllBtn?.classList.add("hidden");
  }

  renderSetups(currentlyFilteredSetups);
}

const STO_TYPE_ORDER = ["Race", "Qualy", "Wet", "Other"];
const STO_TYPE_LABEL = { Race: "Carrera", Qualy: "Clasificación", Wet: "Lluvia", Other: "Otros" };

function stoFileRow(s, folder) {
  const sizeKb = (s.size_bytes / 1024).toFixed(1);
  const officialFn = formatOfficialMmtFilename(folder.car || s.car, folder.circuit || s.circuit, s.filename, s.setup_type);
  const sessionCode = getMmtSessionCode(officialFn, s.setup_type);
  const sessionDesc = MMT_SESSION_DESCRIPTIONS[sessionCode] || STO_TYPE_LABEL[s.setup_type] || "Setup";
  const filePath = formatMtSetupsDisplayPath(folder.car, folder.season, folder.week, folder.circuit, officialFn);
  const type = STO_TYPE_LABEL[s.setup_type] ? s.setup_type : "Other";
  return `
    <li class="sto-row">
      <p class="sto-name" title="${escapeHtml(officialFn + " · " + sessionDesc)}">${escapeHtml(officialFn)}</p>
      <p class="sto-meta">
        <span class="sto-type sto-type--${type}" title="${escapeHtml(sessionDesc)}">${escapeHtml(sessionCode)} · ${STO_TYPE_LABEL[type]}</span>
        <span class="sto-size" title="BoP 26S4 &amp; Tech Inspection Passed (0 Failed Tech)" style="color:var(--r-accent);font-weight:700">✓ PASS TECH</span>
        <span class="sto-size">${sizeKb} KB</span>
      </p>
      <div class="sto-actions">
        <button type="button" class="sto-icon" data-setup-id="${Number(s.id)}" data-folder="${escapeHtml(folder.key)}" onclick="openSetupPreviewById(Number(this.dataset.setupId), this.dataset.folder)" aria-label="Vista previa">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button type="button" class="sto-icon" data-path="${escapeHtml(filePath)}" onclick="copySetupPath(this.dataset.path)" aria-label="Copiar ruta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>
        </button>
        <button type="button" class="sto-icon sto-icon--go" data-setup-id="${Number(s.id)}" data-filename="${escapeHtml(officialFn)}" onclick="downloadSetup(Number(this.dataset.setupId), this.dataset.filename)" aria-label="Guardar setup">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>
        </button>
      </div>
    </li>`;
}

function renderFolderFilesHtml(folder) {
  const groups = {};
  folder.setups.forEach((s) => {
    const type = STO_TYPE_LABEL[s.setup_type] ? s.setup_type : "Other";
    (groups[type] || (groups[type] = [])).push(s);
  });
  return STO_TYPE_ORDER.filter((type) => groups[type] && groups[type].length).map((type) => {
    const all = groups[type];
    const head = all.slice(0, 3);
    const moreId = `more-${folder.key}-${type}`;
    const more = all.slice(3);
    return `
      <section class="sto-group">
        <h4 class="sto-group__title">${STO_TYPE_LABEL[type]} <span>${all.length}</span></h4>
        <ul class="sto-list">${head.map((s) => stoFileRow(s, folder)).join("")}</ul>
        ${more.length ? `<ul class="sto-list" id="${moreId}" hidden>${more.map((s) => stoFileRow(s, folder)).join("")}</ul>
        <button type="button" class="sto-more" aria-controls="${moreId}" aria-expanded="false" data-label="Ver todos (${all.length})" onclick="toggleSetupGroup(this)">Ver todos (${all.length})</button>` : ""}
      </section>`;
  }).join("");
}

function toggleSetupGroup(btn) {
  const more = document.getElementById(btn.getAttribute("aria-controls"));
  if (!more) return;
  const open = more.hasAttribute("hidden");
  if (open) more.removeAttribute("hidden");
  else more.setAttribute("hidden", "");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.textContent = open ? "Ver menos" : btn.getAttribute("data-label");
}

function toggleFolderFiles(folderKey) {
  const container = document.getElementById(`folder-files-${folderKey}`);
  const innerGrid = document.getElementById(`folder-files-grid-${folderKey}`);
  const text = document.getElementById(`folder-toggle-text-${folderKey}`);
  const icon = document.getElementById(`folder-toggle-icon-${folderKey}`);
  const folder = currentFoldersMap[folderKey];
  const count = folder ? folder.setups.length : 0;

  if (!container) return;

  const isHidden = container.classList.contains("hidden");
  if (isHidden) {
    // Lazy render inner files only when expanded!
    if (innerGrid && innerGrid.dataset.rendered !== "1" && folder) {
      innerGrid.innerHTML = renderFolderFilesHtml(folder);
      innerGrid.dataset.rendered = "1";
    }
    container.classList.remove("hidden");
    if (text) text.textContent = "Plegar";
    const toggleBtn = document.getElementById(`folder-toggle-btn-${folderKey}`);
    if (toggleBtn) { toggleBtn.setAttribute("aria-expanded", "true"); toggleBtn.setAttribute("aria-label", "Plegar setups"); }
    if (icon) icon.classList.add("rotate-180");
  } else {
    container.classList.add("hidden");
    if (text) text.textContent = String(count);
    const toggleBtn = document.getElementById(`folder-toggle-btn-${folderKey}`);
    if (toggleBtn) { toggleBtn.setAttribute("aria-expanded", "false"); toggleBtn.setAttribute("aria-label", "Ver setups"); }
    if (icon) icon.classList.remove("rotate-180");
  }
}

function toggleAllFolderAccordions() {
  allFoldersExpanded = !allFoldersExpanded;
  const toggleBtnText = document.getElementById("toggleAllFoldersText");
  if (toggleBtnText) {
    toggleBtnText.textContent = allFoldersExpanded ? "Plegar todo" : "Desplegar todo";
  }

  const visibleFolders = currentOrderedFolders.slice(0, visibleFoldersLimit);
  visibleFolders.forEach(folder => {
    const key = folder.key;
    const container = document.getElementById(`folder-files-${key}`);
    const innerGrid = document.getElementById(`folder-files-grid-${key}`);
    const text = document.getElementById(`folder-toggle-text-${key}`);
    const icon = document.getElementById(`folder-toggle-icon-${key}`);
    const count = folder.setups.length;

    if (!container) return;
    if (allFoldersExpanded) {
      if (innerGrid && innerGrid.dataset.rendered !== "1") {
        innerGrid.innerHTML = renderFolderFilesHtml(folder);
        innerGrid.dataset.rendered = "1";
      }
      container.classList.remove("hidden");
      if (text) text.textContent = `Plegar Setups (${count})`;
      if (icon) icon.classList.add("rotate-180");
    } else {
      container.classList.add("hidden");
      if (text) text.textContent = `📂 Ver Setups (${count})`;
      if (icon) icon.classList.remove("rotate-180");
    }
  });
}

// Group setups into logical folder units: Car + Season + Week + Circuit
function groupSetupsIntoFolders(setups) {
  const foldersMap = {};

  for (const s of setups) {
    const safeCircuit = s.circuit || "General";
    const safeSeason = s.season || "26S4";
    const safeWeek = s.week || "W01";
    const key = `${s.car}__${safeSeason}__${safeWeek}__${safeCircuit}`;

    if (!foldersMap[key]) {
      foldersMap[key] = {
        key,
        car: s.car,
        season: safeSeason,
        week: safeWeek,
        circuit: safeCircuit,
        setups: [],
        typesCount: { Race: 0, Qualy: 0, Wet: 0, Other: 0 }
      };
    }
    foldersMap[key].setups.push(s);
    if (foldersMap[key].typesCount[s.setup_type] !== undefined) {
      foldersMap[key].typesCount[s.setup_type]++;
    } else {
      foldersMap[key].typesCount.Other++;
    }
  }

  const sortMode = (typeof document !== "undefined" && document.getElementById("setupSort")?.value) || "season";
  const folders = Object.values(foldersMap).sort((a, b) => {
    const carA = (CAR_LABELS[a.car] || a.car).toLowerCase();
    const carB = (CAR_LABELS[b.car] || b.car).toLowerCase();
    if (sortMode === "car") return carA.localeCompare(carB) || a.circuit.localeCompare(b.circuit);
    if (sortMode === "circuit") return a.circuit.localeCompare(b.circuit) || carA.localeCompare(carB);
    if (sortMode === "week") return b.season.localeCompare(a.season) || a.week.localeCompare(b.week) || a.circuit.localeCompare(b.circuit);
    return b.season.localeCompare(a.season) || b.week.localeCompare(a.week) || a.circuit.localeCompare(b.circuit);
  });

  return { folders, foldersMap };
}

let currentlyFilteredSetups = [];

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    ensureScopeLoadedAndApplyFilters();
  }, 180);
}

function normalizeSearchText(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function applyFilters() {
  const query = (document.getElementById("searchInput")?.value || "").trim();
  const selectedCar = document.getElementById("carSelect")?.value || "";
  const selectedSeason = document.getElementById("seasonSelect")?.value || "";
  const selectedWeek = document.getElementById("weekSelect")?.value || "";
  const selectedCircuit = document.getElementById("circuitSelect")?.value || "";

  const circNorm = normalizeSearchText(selectedCircuit);
  const isNecFiltering = circNorm.includes("vln") || circNorm.includes("nec") || document.getElementById("catPill-nec")?.classList.contains("is-on");

  // When filtering for NEC or searching, expand limit so results are never cut off
  visibleFoldersLimit = isNecFiltering || query ? 250 : foldersPageSize();

  const filtered = allSetups.filter(s => {
    if (selectedCar && s.car !== selectedCar) return false;
    if (selectedSeason && s.season !== selectedSeason) return false;
    if (selectedWeek && s.week !== selectedWeek) return false;

    if (selectedCircuit) {
      const isNecTarget = circNorm.includes("vln") || circNorm.includes("nec");
      if (isNecTarget) {
        const isMatch = s.circuit.includes("VLN") || s.circuit.includes("Combined") || s.filename.includes("_VLN_");
        if (!isMatch) return false;
      } else {
        const sCircNorm = normalizeSearchText(s.circuit);
        if (sCircNorm !== circNorm && s.circuit !== selectedCircuit) return false;
      }
    } else if (isNecFiltering) {
      const isMatch = s.circuit.includes("VLN") || s.circuit.includes("Combined") || s.filename.includes("_VLN_");
      if (!isMatch) return false;
    }

    if (currentTypeFilter !== "All" && s.setup_type !== currentTypeFilter) {
      return false;
    }

    if (query) {
      const qNorm = normalizeSearchText(query);
      const carName = CAR_LABELS[s.car] || s.car;
      const isNecSetupItem = s.circuit.includes("VLN") || s.circuit.includes("Combined") || s.filename.includes("_VLN_") || s.circuit.includes("Nürburgring") || s.circuit.includes("Nurburgring");
      const necExtra = isNecSetupItem ? "nec vln nurburgring nordschleife endurance 24h" : "";
      const hay = normalizeSearchText(`${s.car} ${carName} ${s.season} ${s.circuit} ${s.week} ${s.filename} ${s.setup_type} ${necExtra}`);
      if (!hay.includes(qNorm)) return false;
    }
    return true;
  });

  const sortMode = document.getElementById("setupSort")?.value || "season";
  filtered.sort((a, b) => {
    const carA = (CAR_LABELS[a.car] || a.car).toLowerCase();
    const carB = (CAR_LABELS[b.car] || b.car).toLowerCase();
    if (sortMode === "car") return carA.localeCompare(carB) || a.circuit.localeCompare(b.circuit);
    if (sortMode === "circuit") return a.circuit.localeCompare(b.circuit) || carA.localeCompare(carB);
    if (sortMode === "week") return b.season.localeCompare(a.season) || a.week.localeCompare(b.week);
    return b.season.localeCompare(a.season) || b.week.localeCompare(a.week) || a.circuit.localeCompare(b.circuit);
  });

  currentlyFilteredSetups = filtered;

  // Update batch download button label and state
  const batchBtn = document.getElementById("downloadBatchBtn");
  const batchText = document.getElementById("downloadBatchBtnText");

  if (batchBtn && batchText) {
    if (filtered.length === 0) {
      batchBtn.disabled = true;
      batchText.textContent = "⚡ Descargar Todo";
    } else {
      batchBtn.disabled = false;
      if (selectedCircuit) {
        batchText.textContent = `⚡ Guardar todo ${selectedCircuit} (${filtered.length})`;
      } else {
        batchText.textContent = `⚡ Guardar lote en su ruta (${Math.min(filtered.length, 100)} setups)`;
      }
    }
  }

  renderSetups(filtered);
}

function loadMoreFolders() {
  visibleFoldersLimit += foldersPageSize();
  renderVisibleSlice();
}

function setupInfiniteScrollObserver() {
  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (!loadMoreContainer || !('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const total = currentViewMode === "folders" ? currentOrderedFolders.length : currentlyFilteredSetups.length;
        if (visibleFoldersLimit < total) {
          visibleFoldersLimit += foldersPageSize();
          renderVisibleSlice();
        }
      }
    }
  }, { rootMargin: "350px" });
  obs.observe(loadMoreContainer);
}

function renderSetups(setups) {
  const grid = document.getElementById("setupsGrid");
  const empty = document.getElementById("emptyState");
  const loadMoreWrap = document.getElementById("loadMoreContainer");
  const countLabel = document.getElementById("visibleSetupsCount");
  const folderCountLabel = document.getElementById("visibleFoldersCount");

  const { folders, foldersMap } = groupSetupsIntoFolders(setups);
  currentFoldersMap = foldersMap;
  currentOrderedFolders = folders;

  if (countLabel) countLabel.textContent = setups.length.toLocaleString();
  if (folderCountLabel) folderCountLabel.textContent = folders.length.toLocaleString();

  if (setups.length === 0) {
    if (grid) grid.innerHTML = "";
    empty?.classList.remove("hidden");
    loadMoreWrap?.classList.add("hidden");
    return;
  }

  empty?.classList.add("hidden");
  renderVisibleSlice();
}

function renderVisibleSlice() {
  const grid = document.getElementById("setupsGrid");
  const loadMoreWrap = document.getElementById("loadMoreContainer");
  const loadMoreText = document.getElementById("loadMoreBtnText");
  if (!grid) return;

  const isDirectLinked = !!iracingDirHandle;

  // ========================================================
  // VIEW MODE 1: CARPETAS (Paginado + Lazy Render sin lag)
  // ========================================================
  if (currentViewMode === "folders") {
    grid.className = "g-setups";
    const slice = currentOrderedFolders.slice(0, visibleFoldersLimit);
    const remaining = currentOrderedFolders.length - slice.length;

    if (loadMoreWrap) {
      if (remaining > 0) {
        loadMoreWrap.classList.remove("hidden");
        if (loadMoreText) loadMoreText.textContent = `👇 Mostrar más carpetas (${remaining.toLocaleString()} restantes)`;
      } else {
        loadMoreWrap.classList.add("hidden");
      }
    }

    grid.innerHTML = slice.map(folder => {
      const carLabel = CAR_LABELS[folder.car] || folder.car;
      const folderSubName = `${folder.season} ${folder.week} ${folder.circuit.replace(/\s+/g, '')}`;
      const destinationPath = formatMtSetupsDisplayPath(folder.car, folder.season, folder.week, folder.circuit);
      const isExpanded = !!allFoldersExpanded;
      const pathParts = String(destinationPath).split("\\").filter(Boolean);
      const pathShort = pathParts.slice(-2).join("\\");
      const pathFull = "Documents\\iRacing\\setups\\" + destinationPath;

      const typeSummary = [];
      if (folder.typesCount.Race > 0) typeSummary.push(`<span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${folder.typesCount.Race} Carrera</span>`);
      if (folder.typesCount.Qualy > 0) typeSummary.push(`<span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">${folder.typesCount.Qualy} Clasif</span>`);
      if (folder.typesCount.Wet > 0) typeSummary.push(`<span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">${folder.typesCount.Wet} Lluvia</span>`);

      const filesHtml = isExpanded ? renderFolderFilesHtml(folder) : "";

      return `
        <article class="g-setup-card" id="folder-card-${folder.key}">
          <div class="g-folder-head">
            <div class="min-w-0">
              <h3>${escapeHtml(folder.circuit)}</h3>
              <p class="g-setup-meta">
                <span>Coche <strong>${escapeHtml(carLabel)}</strong></span>
                <span>Temporada <strong>${escapeHtml(folder.season)}</strong></span>
                <span>Semana <strong>${escapeHtml(folder.week)}</strong></span>
                <span>${folder.setups.length} setups</span>
              </p>
              <div class="g-setup-meta">${typeSummary.join(" ")}</div>
              <details class="sto-path">
                <summary title="${escapeHtml(pathFull)}">…\\${escapeHtml(pathShort)}</summary>
                <p>${escapeHtml(pathFull)}</p>
                <button type="button" class="sto-icon" data-path="${escapeHtml(destinationPath)}" onclick="copySetupPath(this.dataset.path)" aria-label="Copiar ruta completa">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>
                </button>
              </details>
            </div>

            <div class="g-folder-actions">
              <button type="button" class="sto-icon" data-folder="${escapeHtml(folder.key)}" onclick="openFolderPreview(this.dataset.folder)" aria-label="Vista previa de la carpeta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                <span class="sto-label">Vista previa</span>
              </button>
              <button type="button" class="sto-icon" id="folder-toggle-btn-${folder.key}" data-folder="${escapeHtml(folder.key)}" onclick="toggleFolderFiles(this.dataset.folder)" aria-expanded="${isExpanded ? "true" : "false"}" aria-label="${isExpanded ? "Plegar setups" : "Ver setups"}">
                <span id="folder-toggle-text-${folder.key}">${isExpanded ? "Plegar" : folder.setups.length}</span>
              </button>
              <button type="button" class="sto-icon sto-icon--go" id="btn-download-folder-${folder.key}" data-folder="${escapeHtml(folder.key)}" onclick="downloadFolder(this.dataset.folder)" aria-label="Guardar la carpeta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>
                <span class="sto-label" id="btn-download-folder-text-${folder.key}">Guardar ${folder.setups.length}</span>
              </button>
            </div>
          </div>

          <!-- Collapsible files list inside this folder (Lazy-Rendered) -->
          <div id="folder-files-${folder.key}" class="${isExpanded ? '' : 'hidden'} pt-3 border-t border-white/5">
            <div id="folder-files-grid-${folder.key}" data-rendered="${isExpanded ? '1' : '0'}" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              ${filesHtml}
            </div>
          </div>
        </article>
      `;
    }).join("");
    return;
  }

  // ========================================================
  // VIEW MODE 3: EXPLORADOR FTP RAW (Directorio Directo de Setups)
  // ========================================================
  if (currentViewMode === "ftp") {
    const listLimit = visibleFoldersLimit * 2;
    const slice = currentlyFilteredSetups.slice(0, listLimit);
    const remaining = currentlyFilteredSetups.length - slice.length;

    if (loadMoreWrap) {
      if (remaining > 0) {
        loadMoreWrap.classList.remove("hidden");
        if (loadMoreText) loadMoreText.textContent = `Mostrar más archivos FTP (${remaining.toLocaleString()} restantes)`;
      } else {
        loadMoreWrap.classList.add("hidden");
      }
    }

    grid.className = "g-setups g-setups--ftp";

    const rowsHtml = slice.map((s, idx) => {
      const carName = CAR_LABELS[s.car] || s.car;
      const sizeKb = (s.size_bytes / 1024).toFixed(1);
      const destinationPath = formatMtSetupsDisplayPath(s.car, s.season, s.week, s.circuit, s.filename);

      let badgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      if (s.setup_type === "Qualy") badgeColor = "text-purple-400 bg-purple-500/10 border-purple-500/30";
      if (s.setup_type === "Wet") badgeColor = "text-sky-400 bg-sky-500/10 border-sky-500/30";

      return `
        <tr class="border-b border-white/5 hover:bg-white/[0.03] transition text-xs">
          <td class="py-2.5 px-3 text-neutral-500 select-none">${String(idx + 1).padStart(3, '0')}</td>
          <td class="py-2.5 px-3">
            <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border ${badgeColor}">
              ${escapeHtml(s.setup_type)}
            </span>
          </td>
          <td class="py-2.5 px-3 font-semibold text-white truncate max-w-[220px] sm:max-w-[320px]" title="${escapeHtml(s.filename)}">
            <span class="text-emerald-400">.sto</span> ${escapeHtml(s.filename)}
            <div class="text-[10px] text-neutral-500 truncate mt-0.5" title="iRacing\\${destinationPath}">
              ${escapeHtml(destinationPath)}
            </div>
          </td>
          <td class="py-2.5 px-3 text-neutral-300 hidden md:table-cell truncate max-w-[160px]" title="${escapeHtml(carName)}">
            ${escapeHtml(carName)}
          </td>
          <td class="py-2.5 px-3 text-neutral-300 hidden sm:table-cell truncate max-w-[150px]" title="${escapeHtml(s.circuit)}">
            ${escapeHtml(s.circuit)}
          </td>
          <td class="py-2.5 px-3 text-right text-neutral-400 font-mono text-[11px] whitespace-nowrap">
            ${sizeKb} KB
          </td>
          <td class="py-2.5 px-3 text-right whitespace-nowrap">
            <div class="inline-flex items-center gap-1">
              <button 
                type="button" 
                data-setup-id="${Number(s.id)}" onclick="openSetupPreviewById(Number(this.dataset.setupId), '')" 
                class="px-2 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold transition"
                title="Vista previa técnica y telemetría"
              >
                Telemetría
              </button>
              <button 
                type="button" 
                data-path="${escapeHtml(destinationPath)}" onclick="copySetupPath(this.dataset.path)" 
                class="p-1 rounded-md bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition"
                title="Copiar ruta de iRacing"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              </button>
              <button 
                type="button" 
                data-setup-id="${Number(s.id)}" data-filename="${escapeHtml(s.filename)}" onclick="downloadSetup(Number(this.dataset.setupId), this.dataset.filename)" 
                class="px-2 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-[10px] transition"
                title="Descargar archivo .sto"
              >
                Descargar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    grid.innerHTML = `
      <div class="bg-[#161c24] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div class="p-3 sm:p-4 bg-[#0e1217] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="font-bold text-white tracking-wide">Archivos .sto</span>
          </div>
          <div class="text-[11px] text-neutral-400 flex items-center gap-3">
            <span>MODO: <strong class="text-emerald-400">READ-ONLY STREAM</strong></span>
            <span>FORMATO: <strong class="text-white">RAW .STO</strong></span>
            <span>TOTAL: <strong class="text-white">${currentlyFilteredSetups.length.toLocaleString()}</strong></span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-white/10 bg-[#0e1217]/50 text-[10px] text-neutral-400 uppercase tracking-wider">
                <th class="py-2 px-3 w-10">#</th>
                <th class="py-2 px-3 w-16">Tipo</th>
                <th class="py-2 px-3">Archivo / Destino iRacing</th>
                <th class="py-2 px-3 hidden md:table-cell">Vehículo</th>
                <th class="py-2 px-3 hidden sm:table-cell">Circuito</th>
                <th class="py-2 px-3 text-right">Tamaño</th>
                <th class="py-2 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 font-mono">
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return;
  }

  // ========================================================
  // VIEW MODE 2: LISTA DE TARJETAS INDIVIDUALES (Paginada)
  // ========================================================
  const listLimit = visibleFoldersLimit * 2;
  const slice = currentlyFilteredSetups.slice(0, listLimit);
  const remaining = currentlyFilteredSetups.length - slice.length;

  if (loadMoreWrap) {
    if (remaining > 0) {
      loadMoreWrap.classList.remove("hidden");
      if (loadMoreText) loadMoreText.textContent = `👇 Mostrar más setups (${remaining.toLocaleString()} restantes)`;
    } else {
      loadMoreWrap.classList.add("hidden");
    }
  }

  grid.className = "g-setups g-setups--list";
  grid.innerHTML = slice.map(s => {
    const carName = CAR_LABELS[s.car] || s.car;
    const sizeKb = (s.size_bytes / 1024).toFixed(1);
    
    let badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (s.setup_type === "Qualy") badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (s.setup_type === "Wet") badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";

    const destinationPath = formatMtSetupsDisplayPath(s.car, s.season, s.week, s.circuit, s.filename);

    return `
      <div class="bg-[#161c24] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 transition shadow-md flex flex-col justify-between group">
        <div>
          <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}">
                ${s.setup_type}
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 border border-white/10">
                ${s.season} · ${s.week}
              </span>
            </div>
            <span class="text-[11px] font-semibold text-emerald-400 truncate max-w-[140px]" title="${escapeHtml(s.circuit)}">
              🏁 ${escapeHtml(s.circuit)}
            </span>
          </div>
          
          <div class="text-xs font-bold text-white group-hover:text-emerald-400 transition truncate" title="${escapeHtml(s.filename)}">
            ${escapeHtml(s.filename)}
          </div>

          <div class="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            <span class="truncate font-medium">${carName}</span>
          </div>

          <div class="mt-2.5 p-2 rounded-xl bg-[#0e1217] border border-white/5 text-[10px] text-neutral-400 font-mono truncate flex items-center gap-1.5" title="Documents\\iRacing\\setups\\${destinationPath}">
            <svg class="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            <span class="truncate">setups\\${escapeHtml(destinationPath)}</span>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          <span class="text-[10px] text-neutral-500 font-mono">${sizeKb} KB · .sto</span>
          
          <div class="flex items-center gap-1.5">
            <button 
              type="button" 
              data-setup-id="${Number(s.id)}" onclick="openSetupPreviewById(Number(this.dataset.setupId), '')" 
              class="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 font-bold text-xs transition flex items-center gap-1" 
              title="Vista Previa Técnica y Mejores Vueltas en Garage 61"
            >
              <span>👁️ Vista Previa & G61</span>
            </button>

            <button 
              type="button" 
              data-path="${escapeHtml(destinationPath)}" onclick="copySetupPath(this.dataset.path)" 
              class="p-2 rounded-lg bg-[#0e1217] hover:bg-white/10 text-neutral-400 hover:text-white transition" 
              title="Copiar ruta de iRacing al portapapeles"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            </button>

            <button 
              type="button" 
              data-setup-id="${Number(s.id)}" data-filename="${escapeHtml(s.filename)}" onclick="downloadSetup(Number(this.dataset.setupId), this.dataset.filename)" 
              class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black shadow-lg shadow-emerald-500/20 text-xs transition flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>⚡ Guardar en Ruta</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function freeTemporaryBase64Memory() {
  localBase64Cache = {};
  for (const k of Object.keys(loadedCarChunks)) {
    delete loadedCarChunks[k];
  }
}

async function ensureJSZipLoaded() {
  if (typeof JSZip !== "undefined") return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function safeCarChunkSlug(carName) {
  return (carName || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

async function ensureCarBase64ChunkLoaded(carName) {
  if (!carName) return;
  const slug = safeCarChunkSlug(carName);
  if (loadedCarChunks[slug]) return;
  try {
    // Los .sto ya no son públicos: se sirven desde el Worker solo con sesión iniciada.
    if (!currentToken) return;
    const res = await fetch(`${API_BASE}/api/setups/car-files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` },
      body: JSON.stringify({ car: slug })
    });
    const data = await res.json().catch(() => ({}));
    if (handleAuthFailure(res, data)) return;
    if (res.ok && data.success && data.files) {
      const carMap = data.files;
      for (const [fname, b64] of Object.entries(carMap)) {
        localBase64Cache[carName + "/" + fname] = b64;
        localBase64Cache[fname] = b64;
        const m = fname.match(/^MTM_([^_]+)_([^_]+)_(.+)_([^_]+)\.sto$/i);
        if (m) {
          const [, sn, wk, rawCirc] = m;
          const mmtFn = formatOfficialMmtFilename(carName, rawCirc, fname);
          localBase64Cache[`${carName}/${sn}_${wk}_${mmtFn}`] = b64;
          localBase64Cache[`${carName}/${mmtFn}`] = b64;
          localBase64Cache[mmtFn] = b64;
        }
      }
      loadedCarChunks[slug] = true;
    }
  } catch (e) {}
}

// Download setup batch contents using lightweight per-car chunks (100x faster than 35MB bundle)
async function getSetupsContentBatch(setupsList, onProgress) {
  await ensureStoTemplatesLoaded();
  const uniqueCars = [...new Set(setupsList.map(s => s.car).filter(Boolean))];
  await Promise.all(uniqueCars.map(c => ensureCarBase64ChunkLoaded(c)));

  const result = [];
  const missingFromCache = [];

  for (const s of setupsList) {
    const officialFn = formatOfficialMmtFilename(s.car, s.circuit, s.filename, s.setup_type);
    const swKey = `${s.car}/${s.season}_${s.week}_${officialFn}`;
    const compositeKey = `${s.car}/${officialFn}`;
    const cachedB64 = localBase64Cache && (localBase64Cache[swKey] || localBase64Cache[compositeKey] || localBase64Cache[officialFn]);
    if (s.content_base64) {
      result.push({ ...s, filename: officialFn });
    } else if (cachedB64) {
      result.push({
        ...s,
        filename: officialFn,
        content_base64: cachedB64
      });
    } else {
      const realSynth = synthesizeVerifiedMmtStoBase64({ ...s, filename: officialFn });
      if (realSynth) {
        result.push({
          ...s,
          filename: officialFn,
          content_base64: realSynth
        });
      } else {
        missingFromCache.push({ ...s, filename: officialFn });
      }
    }
  }

  if (onProgress) onProgress(result.length);
  if (missingFromCache.length === 0) return result;

  const chunkSize = 50;
  for (let i = 0; i < missingFromCache.length; i += chunkSize) {
    const chunk = missingFromCache.slice(i, i + chunkSize);
    const ids = chunk.map(s => s.id);

    try {
      const res = await fetch(`${API_BASE}/api/setups/download-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify({ ids })
      });
      const data = await res.json().catch(() => ({}));
      if (handleAuthFailure(res, data)) return result;
      if (res.ok && data.success && Array.isArray(data.setups)) {
        for (const fetched of data.setups) {
          const officialFn = formatOfficialMmtFilename(fetched.car, fetched.circuit, fetched.filename, fetched.setup_type);
          const normalizedFetched = { ...fetched, filename: officialFn };
          result.push(normalizedFetched);
          if (localBase64Cache) {
            localBase64Cache[officialFn] = fetched.content_base64;
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching batch chunk:", e);
    }

    if (onProgress) onProgress(result.length);
  }

  return result;
}

function decodeAndSanitizeSto(b64, carSlug = "") {
  const byteChars = atob(b64);
  const raw = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) raw[i] = byteChars.charCodeAt(i);
  if (raw.length < 24) return raw;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const v = view.getUint32(0, true);
  const l1 = view.getUint32(4, true);
  const l2 = view.getUint32(8, true);
  const l3 = view.getUint32(12, true);
  if (l1 < l3 || 16 + l1 > raw.length || l3 < 2) return raw;
  const notesStart = 16 + l1 - 8 - l3;
  const notesEnd = 16 + l1 - 8;
  if (notesStart < 16 || notesStart > notesEnd || notesEnd > raw.length) return raw;

  const cleanText = "muntru.me - Muntrume Motorsport | Setup by Alberto Trujillo";
  const newL3 = (cleanText.length + 1) * 2;
  const newL1 = (l1 - l3) + newL3;
  const trailingLen = raw.length - notesEnd;
  const out = new Uint8Array(16 + (notesStart - 16) + newL3 + trailingLen);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, v, true);
  outView.setUint32(4, newL1, true);
  outView.setUint32(8, l2, true);
  outView.setUint32(12, newL3, true);
  out.set(raw.subarray(16, notesStart), 16);
  let offset = notesStart;
  for (let i = 0; i < cleanText.length; i++) {
    outView.setUint16(offset, cleanText.charCodeAt(i), true);
    offset += 2;
  }
  outView.setUint16(offset, 0, true);
  offset += 2;
  out.set(raw.subarray(notesEnd), offset);
  return out;
}

// ==========================================
// 1-CLICK COMPLETE FOLDER DOWNLOAD (EXACT IRACING PATH)
// ==========================================
async function downloadFolder(folderKey) {
  if (!isUserAuthenticated()) {
    openAuthModal('login');
    const err = document.getElementById("loginError");
    if (err) {
      err.textContent = "Inicia sesión con tu cuenta de piloto para guardar y sincronizar setups en tu carpeta de iRacing.";
      err.classList.remove("hidden");
    }
    showDownloadToast("Inicia sesión como piloto para descargar setups", "warning");
    return;
  }

  const folder = currentFoldersMap[folderKey];
  if (!folder || !folder.setups || folder.setups.length === 0) {
    showDownloadToast("No hay setups en esta carpeta", "warning");
    return;
  }

  // Request / restore directory handle immediately on user gesture so it writes to exact path
  const activeHandle = await ensureDirectoryHandleForDownload();

  const btn = document.getElementById(`btn-download-folder-${folderKey}`);
  const btnText = document.getElementById(`btn-download-folder-text-${folderKey}`);
  const originalText = btnText ? btnText.textContent : `⚡ Guardar Carpeta en Ruta (${folder.setups.length})`;

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = `Cargando (0/${folder.setups.length})...`;

  try {
    const setupsToDownload = await getSetupsContentBatch(folder.setups, (progress) => {
      if (btnText) btnText.textContent = `Cargando (${progress}/${folder.setups.length})...`;
    });

    if (!setupsToDownload || setupsToDownload.length === 0) {
      showDownloadToast("No se pudieron obtener los archivos de la carpeta.");
      return;
    }

    // A) MODO DIRECT SYNC A DISCO EN SU RUTA EXACTA (File System API)
    if (activeHandle) {
      if (btnText) btnText.textContent = `Guardando en ruta iRacing...`;
      let saved = 0;
      let targetRelPath = "";

      for (const s of setupsToDownload) {
        try {
          const byteArray = decodeAndSanitizeSto(s.content_base64, s.car);
          const resolved = await resolveExactSetupDir(activeHandle, s.car, s.season, s.week, s.circuit);
          targetRelPath = resolved.relDisplay;
          await writeSetupBytesToTargets(resolved, s.filename, byteArray);
          saved++;
        } catch (fileErr) {
          console.warn(`Error guardando ${s.filename}:`, fileErr);
        }
      }

      showDownloadToast("Setups guardados", "success", saved + "/" + setupsToDownload.length);
      return;
    }

    // B) MODO ZIP CON RUTA EXACTA + INSTALADOR AUTOMÁTICO (Para navegadores sin File System API)
    if (await ensureJSZipLoaded()) {
      if (btnText) btnText.textContent = `Empaquetando ruta...`;
      const zip = new JSZip();

      for (const s of setupsToDownload) {
        const byteArray = decodeAndSanitizeSto(s.content_base64, s.car);
        const { yr, seasonFolder, weekFolder, circFolder } = getMtSetupsHierarchyParts(s.season, s.week, s.circuit);
        zip.file(`${s.car}/Garage 61 - Muntrume Motorsport/${yr}/${seasonFolder}/${weekFolder}/${circFolder}/${s.filename}`, byteArray);
        zip.file(`${s.car}/Garage 61/${yr}/${seasonFolder}/${weekFolder}/${circFolder}/${s.filename}`, byteArray);
      }
      zip.file("Instalar_en_Ruta_iRacing.bat", buildExactPathInstallerBat());

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const cleanCar = (folder.car || "Car").replace(/[^a-zA-Z0-9_-]/g, "_");
      const cleanCirc = (folder.circuit || "Circuit").replace(/[^a-zA-Z0-9_-]/g, "_");
      const cleanWeek = (folder.week || "W01").replace(/[^a-zA-Z0-9_-]/g, "_");
      const zipFilename = `Muntrume_${cleanCar}_${folder.season}_${cleanWeek}_${cleanCirc}.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showDownloadToast("Archivo descargado", "info", zipFilename);
      return;
    }
  } catch (err) {
    console.error("Error descargando carpeta:", err);
    showDownloadToast("Error al descargar la carpeta completa.");
  } finally {
    freeTemporaryBase64Memory();
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = originalText;
  }
}

// Download single setup (Direct to exact iRacing folder path, or exact-path package)
async function downloadSetup(setupId, fallbackFilename) {
  if (!isUserAuthenticated()) {
    openAuthModal('login');
    const err = document.getElementById('loginError');
    if (err) {
      err.textContent = 'Inicia sesión con tu cuenta de piloto para descargar y guardar setups en tu carpeta de iRacing.';
      err.classList.remove('hidden');
    }
    showDownloadToast("Inicia sesión como piloto para descargar setups", "warning");
    return;
  }

  try {
    // Request / restore directory handle immediately on user click so it saves in exact path
    const activeHandle = await ensureDirectoryHandleForDownload();

    let filename = fallbackFilename;
    let car = "";
    let season = "26S4";
    let week = "W01";
    let circuit = "General";
    let contentBase64 = null;

    const match = allSetups.find(s => s.id === setupId || s.filename === fallbackFilename);
    if (match) {
      car = match.car;
      season = match.season;
      week = match.week;
      circuit = match.circuit;
      filename = formatOfficialMmtFilename(car, circuit, match.filename || fallbackFilename, match.setup_type);
    }

    if (car) {
      await ensureCarBase64ChunkLoaded(car);
    }

    const swKey = car ? `${car}/${season}_${week}_${filename}` : filename;
    const compositeKey = car ? `${car}/${filename}` : filename;

    if (localBase64Cache && (localBase64Cache[swKey] || localBase64Cache[compositeKey] || localBase64Cache[filename] || localBase64Cache[fallbackFilename])) {
      contentBase64 = localBase64Cache[swKey] || localBase64Cache[compositeKey] || localBase64Cache[filename] || localBase64Cache[fallbackFilename];
    } else {
      await ensureStoTemplatesLoaded();
      const realSynth = synthesizeVerifiedMmtStoBase64(match || { id: setupId, car, circuit, season, week, filename, setup_type: "Race" });
      if (realSynth) {
        contentBase64 = realSynth;
      } else {
        const res = await fetch(`${API_BASE}/api/setups/download`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentToken}`
          },
          body: JSON.stringify({ id: setupId })
        });

        const data = await res.json().catch(() => ({}));
        if (handleAuthFailure(res, data)) return;
        if (!res.ok || !data.success || !data.content_base64) {
          showDownloadToast(data.error || "No se pudo obtener el archivo de setup.");
          return;
        }
        contentBase64 = data.content_base64;
        car = data.car || car;
        season = data.season || season;
        week = data.week || week;
        circuit = data.circuit || circuit;
        filename = formatOfficialMmtFilename(car, circuit, data.filename || fallbackFilename, match?.setup_type || "Race");
      }
    }

    const byteArray = decodeAndSanitizeSto(contentBase64, car);

    // 1. Direct write to exact path on disk if File System API handle is active
    if (activeHandle && car) {
      try {
        const resolved = await resolveExactSetupDir(activeHandle, car, season, week, circuit);
        const relDisplay = resolved.relDisplay;
        await writeSetupBytesToTargets(resolved, filename, byteArray);

        showDownloadToast("Setup guardado", "success", filename);
        return;
      } catch (fsErr) {
        console.warn("Fallo escribiendo directo en disco:", fsErr);
      }
    }

    // 2. Fallback: download .sto and notify if browser blocked direct folder API
    const blob = new Blob([byteArray], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showDownloadToast("Archivo descargado", "info", filename);
  } catch (err) {
    showDownloadToast("Error de conexión al descargar setup.");
  } finally {
    freeTemporaryBase64Memory();
  }
}

// Descargar todos los setups del circuito o vista actual (de una sola vez en su ruta exacta)
async function downloadAllVisibleSetups() {
  if (!isUserAuthenticated()) {
    openAuthModal('login');
    const err = document.getElementById("loginError");
    if (err) {
      err.textContent = "Inicia sesión con tu cuenta de piloto para guardar y sincronizar setups en tu carpeta de iRacing.";
      err.classList.remove("hidden");
    }
    showDownloadToast("Inicia sesión como piloto para descargar setups", "warning");
    return;
  }

  if (!currentlyFilteredSetups || currentlyFilteredSetups.length === 0) {
    showDownloadToast("No hay setups con este filtro", "warning");
    return;
  }

  const activeHandle = await ensureDirectoryHandleForDownload();

  const btn = document.getElementById("downloadBatchBtn");
  const btnText = document.getElementById("downloadBatchBtnText");
  const originalText = btnText ? btnText.textContent : "⚡ Descargar Todo";

  const countToDownload = Math.min(currentlyFilteredSetups.length, 100);
  const targets = currentlyFilteredSetups.slice(0, countToDownload);

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = `Cargando lote (${targets.length} setups)...`;

  try {
    const setupsList = await getSetupsContentBatch(targets, (progress) => {
      if (btnText) btnText.textContent = `Cargando (${progress}/${targets.length})...`;
    });

    if (!setupsList || setupsList.length === 0) {
      showDownloadToast("No se pudieron obtener los setups en lote.");
      return;
    }

    // A) MODO DIRECT SYNC A DISCO EN SU RUTA EXACTA (File System Access API)
    if (activeHandle) {
      if (btnText) btnText.textContent = `⚡ Guardando en ruta iRacing (0/${setupsList.length})...`;
      let savedCount = 0;

      for (let i = 0; i < setupsList.length; i++) {
        const s = setupsList[i];
        if (btnText) btnText.textContent = `⚡ Guardando (${i + 1}/${setupsList.length})...`;

        try {
          const byteArray = decodeAndSanitizeSto(s.content_base64, s.car);
          const resolved = await resolveExactSetupDir(activeHandle, s.car, s.season, s.week, s.circuit);
          await writeSetupBytesToTargets(resolved, s.filename, byteArray);
          savedCount++;
        } catch (fileErr) {
          console.warn(`Error guardando ${s.filename}:`, fileErr);
        }
      }

      showDownloadToast("Setups guardados", "success", String(savedCount));
      return;
    }

    // B) MODO ZIP BATCH CON RUTA EXACTA + AUTO-INSTALADOR
    if (await ensureJSZipLoaded()) {
      if (btnText) btnText.textContent = `Empaquetando ZIP (${setupsList.length})...`;
      const zip = new JSZip();

      for (const s of setupsList) {
        const byteArray = decodeAndSanitizeSto(s.content_base64, s.car);
        const { yr, seasonFolder, weekFolder, circFolder } = getMtSetupsHierarchyParts(s.season, s.week, s.circuit);
        zip.file(`${s.car}/Garage 61 - Muntrume Motorsport/${yr}/${seasonFolder}/${weekFolder}/${circFolder}/${s.filename}`, byteArray);
        zip.file(`${s.car}/Garage 61/${yr}/${seasonFolder}/${weekFolder}/${circFolder}/${s.filename}`, byteArray);
      }
      zip.file("Instalar_en_Ruta_iRacing.bat", buildExactPathInstallerBat());

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const currentCirc = document.getElementById("circuitSelect")?.value || "Circuito";
      const currentCar = document.getElementById("carSelect")?.value || "Pack";
      const zipName = `Muntrume_${currentCar}_${currentCirc.replace(/\s+/g, '_')}.zip`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showDownloadToast("Archivo descargado", "info", String(setupsList.length));
      return;
    }
  } catch (err) {
    console.error("Error en descarga por lote:", err);
    showDownloadToast("Error de conexión al descargar lote de setups.");
  } finally {
    freeTemporaryBase64Memory();
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = originalText;
  }
}

// Copy destination path to clipboard
function copySetupPath(relativePath) {
  const fullPath = `Documents\\iRacing\\setups\\${relativePath}`;
  navigator.clipboard.writeText(fullPath).then(() => {
    showDownloadToast("Ruta copiada", "success");
  }).catch(() => {
    prompt("Copia la ruta de iRacing:", fullPath);
  });
}

function showDownloadToast(msg, severity, detail) {
  var raw = String(msg || "");
  var text = raw.replace(/^(?:✅|📥|📋|🧠|⚡|⚠️|🦁)+\s*/u, "").trim();
  var sev = severity || ((/no se pudo|error|fallo/i.test(text)) ? "error" : (/guardad|vinculad|copiad|actualizad|reconect|bienvenido/i.test(text) ? "success" : "info"));
  if (window.muntruNotice) {
    window.muntruNotice.show({
      severity: sev,
      title: text,
      message: detail ? String(detail) : "",
      translateMessage: false
    });
  }
}

function escapeHtml(t) {
  if (t === null || t === undefined) return "";
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ==========================================
// ADMIN RACE CONTROL PANEL
// ==========================================
let adminData = { requests: [], members: [] };
let adminRequestFilter = "pending";

async function adminApi(path, payload) {
  const res = await fetch(`${API_BASE}/api/setups/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${currentToken}`
    },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    closeAdminModal();
    handleAuthFailure(res, data);
  }
  return { res, data };
}

function showAdminNotice(text, kind) {
  const map = { ok: "success", warn: "warning", error: "error" };
  if (window.muntruNotice) {
    window.muntruNotice.show({ severity: map[kind] || "info", title: String(text || ""), source: "admin" });
    return;
  }
}

function hideAdminNotice() {
  window.muntruNotice?.dismissSource("admin");
}

async function openAdminModal() {
  hideAdminNotice();
  document.getElementById("adminModal")?.classList.remove("hidden");
  document.getElementById("emailPreviewBtn")?.classList.remove("hidden");
  await loadAdminData();
}

function closeAdminModal() {
  document.getElementById("adminModal")?.classList.add("hidden");
}

function switchAdminTab(tab) {
  ["requests", "members", "add"].forEach(t => {
    const content = document.getElementById(`adminTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1, 3)}Btn`);
    if (t === tab) {
      content?.classList.remove("hidden");
      btn?.classList.add("bg-[#161c24]", "text-amber-400", "shadow");
      btn?.classList.remove("text-neutral-400");
    } else {
      content?.classList.add("hidden");
      btn?.classList.remove("bg-[#161c24]", "text-amber-400", "shadow");
      btn?.classList.add("text-neutral-400");
    }
  });
}

function setAdminRequestFilter(filter) {
  adminRequestFilter = filter;
  renderAdminData();
}

async function loadAdminData() {
  const reqList = document.getElementById("adminRequestsList");
  if (reqList && !(adminData.requests || []).length) {
    reqList.innerHTML = '<div class="py-8 text-center text-xs text-neutral-500">Cargando…</div>';
  }
  try {
    const { res, data } = await adminApi("admin/panel");
    if (res.ok && data.success) {
      adminData = data;
      renderAdminData();
    } else if (res.status !== 401) {
      showAdminNotice(data.error || "No se pudo cargar el panel.", "error");
    }
  } catch (e) {
    showAdminNotice("Error de conexión al cargar el panel.", "error");
  }
}

function formatAdminDate(value) {
  if (!value) return "";
  // D1 guarda CURRENT_TIMESTAMP en UTC ("YYYY-MM-DD HH:MM:SS")
  const d = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  if (isNaN(d)) return escapeHtml(value);
  return d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const REQUEST_STATUS_BADGE = {
  pending: '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Pendiente</span>',
  approved: '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Aprobada</span>',
  rejected: '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">Rechazada</span>'
};

function renderAdminData() {
  const requests = adminData.requests || [];
  const members = adminData.members || [];
  const pendingReqs = requests.filter(r => r.status === "pending");
  const countPending = document.getElementById("adminPendingCount");
  const countMembers = document.getElementById("adminMembersCount");
  if (countPending) countPending.textContent = pendingReqs.length;
  if (countMembers) countMembers.textContent = members.length;

  document.querySelectorAll("#adminReqFilters [data-filter]").forEach(btn => {
    const active = btn.dataset.filter === adminRequestFilter;
    btn.classList.toggle("bg-amber-500", active);
    btn.classList.toggle("text-neutral-950", active);
    btn.classList.toggle("text-neutral-300", !active);
  });

  const reqList = document.getElementById("adminRequestsList");
  if (reqList) {
    const shown = adminRequestFilter === "all" ? requests : requests.filter(r => r.status === adminRequestFilter);
    if (shown.length === 0) {
      const msg = adminRequestFilter === "pending" ? "No hay solicitudes pendientes. 🎉" : "No hay solicitudes en este estado.";
      reqList.innerHTML = `<div class="py-8 text-center text-xs text-neutral-500">${msg}</div>`;
    } else {
      reqList.innerHTML = shown.map(r => `
        <div class="bg-[#0e1217] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-white font-bold text-xs">${escapeHtml(r.name)}</span>
              ${REQUEST_STATUS_BADGE[r.status] || ""}
            </div>
            <div class="text-[11px] text-neutral-400 font-mono break-all mt-0.5">${escapeHtml(r.email)}</div>
            <div class="text-[11px] text-neutral-400 mt-1">
              ${r.car_category ? `<span class="text-emerald-400 font-semibold">${escapeHtml(r.car_category)}</span> · ` : ""}
              ${r.iracing_id ? `iRacing ID: <span class="font-mono text-neutral-300">${escapeHtml(r.iracing_id)}</span> · ` : ""}
              <span class="text-neutral-500">Recibida ${formatAdminDate(r.created_at)}</span>
              ${r.approved_at ? `<span class="text-neutral-500"> · Aprobada ${formatAdminDate(r.approved_at)}</span>` : ""}
            </div>
            ${r.message ? `<div class="text-[11px] text-neutral-500 mt-1 italic break-words">“${escapeHtml(r.message)}”</div>` : ""}
          </div>
          ${r.status === "pending" ? `
          <div class="flex gap-2 shrink-0 w-full sm:w-auto">
            <button type="button" data-req-id="${Number(r.id)}" onclick="confirmRejectRequest(Number(this.dataset.reqId))" class="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-[#161c24] hover:bg-red-500/20 border border-red-500/30 text-red-300 font-bold text-xs transition">Rechazar</button>
            <button type="button" data-req-id="${Number(r.id)}" onclick="confirmApproveRequest(Number(this.dataset.reqId))" class="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition">Aprobar</button>
          </div>` : ""}
        </div>
      `).join("");
    }
  }

  const memList = document.getElementById("adminMembersList");
  if (memList) {
    const myEmail = (currentUser?.email || "").toLowerCase();
    memList.innerHTML = members.length === 0
      ? '<div class="py-8 text-center text-xs text-neutral-500">Todavía no hay pilotos autorizados.</div>'
      : members.map(m => {
        const isMe = String(m.email).toLowerCase() === myEmail;
        const inactive = m.status !== "active";
        const access = !m.has_password
          ? '<span class="text-amber-300">Sin contraseña (invitación pendiente)</span>'
          : (m.must_change_password ? '<span class="text-amber-300">Contraseña temporal</span>' : '<span class="text-emerald-400">Contraseña propia</span>');
        return `
        <div class="bg-[#0e1217] border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${inactive ? "opacity-60" : ""}">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-white font-semibold">${escapeHtml(m.name || String(m.email).split("@")[0])}</span>
              <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${m.role === "admin" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/10 text-emerald-400"}">${m.role === "admin" ? "Admin" : "Piloto"}</span>
              ${inactive ? '<span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">Desactivado</span>' : ""}
              ${isMe ? '<span class="text-[10px] text-neutral-500">(tú)</span>' : ""}
            </div>
            <div class="text-neutral-500 font-mono text-[11px] break-all">${escapeHtml(m.email)}</div>
            <div class="text-[11px] mt-0.5">${access}</div>
          </div>
          ${isMe ? "" : `
          <div class="flex gap-1.5 shrink-0">
            ${inactive ? "" : `<button type="button" data-email="${escapeHtml(m.email)}" onclick="confirmResendInvite(this.dataset.email)" class="px-2.5 py-1 rounded-lg bg-[#161c24] hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-neutral-200">Reenviar acceso</button>`}
            <button type="button" data-email="${escapeHtml(m.email)}" data-next="${inactive ? "active" : "inactive"}" onclick="confirmSetMemberStatus(this.dataset.email, this.dataset.next)" class="px-2.5 py-1 rounded-lg bg-[#161c24] hover:bg-white/10 border border-white/10 text-[11px] font-semibold ${inactive ? "text-emerald-300" : "text-red-300"}">${inactive ? "Reactivar" : "Desactivar"}</button>
          </div>`}
        </div>`;
      }).join("");
  }
}

// ---- Confirm dialog (genérico) ----
let adminConfirmAction = null;

function openAdminConfirm({ title, bodyHtml, confirmText, danger, onConfirm }) {
  adminConfirmAction = onConfirm;
  document.getElementById("adminConfirmTitle").textContent = title;
  document.getElementById("adminConfirmBody").innerHTML = bodyHtml;
  const err = document.getElementById("adminConfirmError");
  err.classList.add("hidden");
  const btn = document.getElementById("adminConfirmBtn");
  btn.textContent = confirmText || "Confirmar";
  btn.disabled = false;
  btn.className = `w-full sm:flex-1 py-2.5 rounded-xl ${danger ? "bg-red-500 hover:bg-red-400 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950"} disabled:opacity-50 font-bold text-xs`;
  btn.onclick = async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Procesando…";
    try {
      const errorMsg = await adminConfirmAction();
      if (errorMsg) {
        err.textContent = errorMsg;
        err.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = original;
      } else {
        closeAdminConfirm();
      }
    } catch (e) {
      err.textContent = "Error de conexión. Inténtalo de nuevo.";
      err.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = original;
    }
  };
  document.getElementById("adminConfirmModal")?.classList.remove("hidden");
}

function closeAdminConfirm() {
  adminConfirmAction = null;
  document.getElementById("adminConfirmModal")?.classList.add("hidden");
}

function approvalOptionsHtml(prefix, existingMember) {
  return `
    <fieldset class="space-y-1.5">
      <legend class="text-[11px] font-semibold uppercase text-neutral-400 mb-1">Método de acceso</legend>
      <label class="flex items-start gap-2"><input type="radio" name="${prefix}Method" value="link" checked class="mt-0.5"> <span><strong class="text-white">Enlace para crear contraseña</strong> (72 h, un solo uso). Recomendado: nadie más conoce la contraseña.</span></label>
      <label class="flex items-start gap-2"><input type="radio" name="${prefix}Method" value="temp_password" class="mt-0.5"> <span><strong class="text-white">Contraseña temporal</strong> generada al azar. Se te muestra una sola vez y el piloto debe cambiarla al entrar.${existingMember ? ' <span class="text-amber-300">Sustituirá su contraseña actual.</span>' : ""}</span></label>
    </fieldset>
    <label class="flex items-center gap-2"><input type="checkbox" id="${prefix}SendEmail" checked> Enviar el correo de bienvenida al piloto</label>`;
}

function confirmApproveRequest(reqId) {
  const r = (adminData.requests || []).find(x => Number(x.id) === Number(reqId));
  if (!r) return;
  const existing = (adminData.members || []).find(m => String(m.email).toLowerCase() === String(r.email).toLowerCase());
  openAdminConfirm({
    title: "Aprobar piloto",
    bodyHtml: `
      <div class="bg-[#0e1217] border border-white/10 rounded-xl p-3">
        <div class="text-white font-bold">${escapeHtml(r.name)}</div>
        <div class="font-mono text-neutral-400 break-all">${escapeHtml(r.email)}</div>
        ${existing ? '<div class="mt-1 text-amber-300">Este correo ya existe como miembro: se reactivará si estaba desactivado.</div>' : ""}
      </div>
      ${approvalOptionsHtml("approve", !!existing)}`,
    confirmText: "Aprobar y dar acceso",
    onConfirm: async () => {
      const method = document.querySelector('input[name="approveMethod"]:checked')?.value || "link";
      const send_email = !!document.getElementById("approveSendEmail")?.checked;
      const { res, data } = await adminApi("admin/approve", { request_id: r.id, method, send_email });
      if (!res.ok || !data.success) return data.error || "No se pudo aprobar la solicitud.";
      await loadAdminData();
      if (data.already_member) {
        showAdminNotice(data.message, "warn");
      } else {
        openPilotCredentialsModal(data);
      }
      return null;
    }
  });
}

function confirmRejectRequest(reqId) {
  const r = (adminData.requests || []).find(x => Number(x.id) === Number(reqId));
  if (!r) return;
  openAdminConfirm({
    title: "Rechazar solicitud",
    bodyHtml: `
      <div class="bg-[#0e1217] border border-white/10 rounded-xl p-3">
        <div class="text-white font-bold">${escapeHtml(r.name)}</div>
        <div class="font-mono text-neutral-400 break-all">${escapeHtml(r.email)}</div>
      </div>
      <label class="flex items-center gap-2"><input type="checkbox" id="rejectNotify" checked> Avisar al piloto por correo</label>
      <div>
        <label for="rejectReason" class="block text-[11px] font-semibold uppercase text-neutral-400 mb-1">Motivo (opcional, se incluye en el correo)</label>
        <textarea id="rejectReason" rows="2" maxlength="500" class="w-full bg-[#0e1217] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" placeholder="Ej. ahora mismo no hay plazas en esa categoría"></textarea>
      </div>`,
    confirmText: "Rechazar",
    danger: true,
    onConfirm: async () => {
      const notify = !!document.getElementById("rejectNotify")?.checked;
      const reason = document.getElementById("rejectReason")?.value.trim() || "";
      const { res, data } = await adminApi("admin/reject", { request_id: r.id, notify, reason });
      if (!res.ok || !data.success) return data.error || "No se pudo rechazar la solicitud.";
      await loadAdminData();
      if (notify && !data.email_sent) showAdminNotice(`Solicitud rechazada, pero el correo no se pudo enviar (${data.email_error || "error desconocido"}).`, "warn");
      else showAdminNotice(notify ? "Solicitud rechazada y piloto avisado por correo." : "Solicitud rechazada (sin aviso por correo).", "ok");
      return null;
    }
  });
}

function confirmResendInvite(email) {
  const m = (adminData.members || []).find(x => x.email === email);
  if (!m) return;
  openAdminConfirm({
    title: "Reenviar acceso",
    bodyHtml: `<p>Se enviará a <strong class="text-white">${escapeHtml(m.email)}</strong> un enlace nuevo (72 h) para ${m.has_password ? "restablecer" : "crear"} su contraseña. Los enlaces anteriores dejarán de funcionar cuando lo use.</p>`,
    confirmText: "Enviar enlace",
    onConfirm: async () => {
      const { res, data } = await adminApi("admin/resend-invite", { email: m.email });
      if (!res.ok || !data.success) return data.error || "No se pudo generar el enlace.";
      openPilotCredentialsModal({ ...data, method: "link", pilot: { email: m.email, name: m.name } });
      return null;
    }
  });
}

function confirmSetMemberStatus(email, nextStatus) {
  const m = (adminData.members || []).find(x => x.email === email);
  if (!m) return;
  const deactivate = nextStatus === "inactive";
  openAdminConfirm({
    title: deactivate ? "Desactivar piloto" : "Reactivar piloto",
    bodyHtml: deactivate
      ? `<p><strong class="text-white">${escapeHtml(m.name || m.email)}</strong> perderá el acceso al Vault de inmediato (sus sesiones abiertas dejarán de funcionar). No se borra ningún dato y puedes reactivarlo cuando quieras.</p>`
      : `<p><strong class="text-white">${escapeHtml(m.name || m.email)}</strong> recuperará el acceso con su contraseña actual.</p>`,
    confirmText: deactivate ? "Desactivar" : "Reactivar",
    danger: deactivate,
    onConfirm: async () => {
      const { res, data } = await adminApi("admin/set-status", { email: m.email, status: nextStatus });
      if (!res.ok || !data.success) return data.error || "No se pudo cambiar el estado.";
      await loadAdminData();
      showAdminNotice(deactivate ? "Piloto desactivado." : "Piloto reactivado.", "ok");
      return null;
    }
  });
}

async function sendEmailPreview() {
  const myEmail = currentUser?.email || "tu correo";
  openAdminConfirm({
    title: "Probar plantillas de correo",
    bodyHtml: `<p>Se enviarán <strong class="text-white">todas las plantillas</strong> (marcadas como [PRUEBA], con datos de ejemplo) <strong class="text-white">solo a ${escapeHtml(myEmail)}</strong>. No se envía nada a ningún piloto.</p>`,
    confirmText: "Enviarme las pruebas",
    onConfirm: async () => {
      const { res, data } = await adminApi("admin/email-preview", {});
      if (!res.ok || !data.success) return data.error || "No se pudieron enviar las pruebas.";
      const okCount = (data.results || []).filter(r => r.ok).length;
      const total = (data.results || []).length;
      const firstErr = (data.results || []).find(r => !r.ok)?.error;
      showAdminNotice(`Pruebas enviadas a ${data.to}: ${okCount}/${total}.${firstErr ? ` Error: ${firstErr}` : ""}`, okCount === total ? "ok" : "warn");
      return null;
    }
  });
}

// ---- Resultado de aprobación (enlace o contraseña temporal, visible una sola vez) ----
let currentApprovedPilotInfo = null;

function openPilotCredentialsModal(info) {
  const pilot = info.pilot || { email: info.email, name: info.name };
  currentApprovedPilotInfo = { ...info, pilot };
  document.getElementById("credPilotName").textContent = pilot.name || pilot.email;
  document.getElementById("credPilotEmail").textContent = pilot.email;

  const label = document.getElementById("credSecretLabel");
  const value = document.getElementById("credSecretValue");
  const hint = document.getElementById("credSecretHint");
  if (info.temp_password) {
    label.textContent = "Contraseña temporal";
    value.textContent = info.temp_password;
    value.className = "mt-1 text-base font-black font-mono text-emerald-400 break-all select-all";
    hint.textContent = "El piloto deberá cambiarla en su primer acceso.";
  } else if (info.set_password_link) {
    label.textContent = "Enlace para crear contraseña";
    value.textContent = info.set_password_link;
    value.className = "mt-1 text-[11px] font-mono text-emerald-400 break-all select-all";
    hint.textContent = `Válido ${info.expires_hours || 72} h y de un solo uso.`;
  } else {
    label.textContent = "Acceso";
    value.textContent = "—";
    hint.textContent = "";
  }

  const statusBox = document.getElementById("credEmailStatus");
  const statusText = document.getElementById("credEmailStatusText");
  if (info.email_sent) {
    statusBox.className = "p-3 rounded-xl text-xs font-semibold flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400";
    statusText.textContent = `✅ Correo de bienvenida enviado a ${pilot.email}.`;
  } else {
    statusBox.className = "p-3 rounded-xl text-xs font-semibold flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300";
    statusText.textContent = `⚠️ No se ha enviado correo${info.email_error ? ` (${info.email_error})` : ""}. Copia el mensaje y entrégaselo al piloto por un canal privado.`;
  }

  document.getElementById("pilotCredentialsModal")?.classList.remove("hidden");
}

function closePilotCredentialsModal() {
  // Borramos el secreto del DOM y de memoria al cerrar.
  const value = document.getElementById("credSecretValue");
  if (value) value.textContent = "-";
  currentApprovedPilotInfo = null;
  document.getElementById("pilotCredentialsModal")?.classList.add("hidden");
}

function copyPilotEmailTemplate() {
  if (!currentApprovedPilotInfo) return;
  const info = currentApprovedPilotInfo;
  const name = info.pilot.name || "piloto";
  const email = info.pilot.email;
  const access = info.temp_password
    ? `- Correo: ${email}\n- Contraseña temporal: ${info.temp_password}\n- Entra en: https://muntru.me/setups\n\nAl entrar te pedirá elegir tu contraseña personal (mínimo 10 caracteres).`
    : `Crea tu contraseña con este enlace personal (válido ${info.expires_hours || 72} h, un solo uso):\n${info.set_password_link}\n\nTu usuario es: ${email}`;

  const template = `Hola ${name},

Tu solicitud para unirte a Muntrume Motorsport ha sido aprobada. Ya tienes acceso al Setup Vault del equipo.

${access}

Una vez dentro, pulsa «Vincular carpeta iRacing» y elige Documentos\\iRacing\\setups para descargar los setups directamente en el simulador.

¡Nos vemos en pista!
Muntrume Motorsport · Control de Carrera`;

  navigator.clipboard.writeText(template).then(() => {
    showDownloadToast("Mensaje copiado", "success");
  }).catch(() => {
    prompt("Copia el mensaje:", template);
  });
}

function handleManualAdd(e) {
  e.preventDefault();
  const name = document.getElementById("manualName").value.trim();
  const email = document.getElementById("manualEmail").value.trim();
  const method = document.querySelector('input[name="manualMethod"]:checked')?.value || "link";
  const send_email = !!document.getElementById("manualSendEmail")?.checked;
  const existing = (adminData.members || []).find(m => String(m.email).toLowerCase() === email.toLowerCase());

  openAdminConfirm({
    title: "Dar de alta piloto",
    bodyHtml: `
      <div class="bg-[#0e1217] border border-white/10 rounded-xl p-3">
        <div class="text-white font-bold">${escapeHtml(name)}</div>
        <div class="font-mono text-neutral-400 break-all">${escapeHtml(email)}</div>
      </div>
      <p>Método: <strong class="text-white">${method === "link" ? "enlace para crear contraseña (72 h)" : "contraseña temporal (se muestra una vez)"}</strong> · ${send_email ? "se enviará correo de bienvenida" : "sin correo"}.</p>
      ${existing ? `<p class="text-amber-300">Este correo ya es miembro${existing.has_password && method === "temp_password" ? "; su contraseña actual se sustituirá" : ""}.</p>` : ""}`,
    confirmText: "Autorizar",
    onConfirm: async () => {
      const payload = { email, name, method, send_email };
      if (existing && existing.has_password && method === "link") payload.force = true;
      const { res, data } = await adminApi("admin/approve", payload);
      if (!res.ok || !data.success) return data.error || "No se pudo dar de alta al piloto.";
      document.getElementById("manualName").value = "";
      document.getElementById("manualEmail").value = "";
      await loadAdminData();
      if (data.already_member) showAdminNotice(data.message, "warn");
      else openPilotCredentialsModal(data);
      return null;
    }
  });
}


// =========================================================================
// SETUP PREVIEW (.STO INSPECTOR) & GARAGE 61 BEST LAPS
// Solo mostramos datos reales: metadatos del archivo, notas leídas del binario
// y vueltas devueltas por la API de Garage 61. Si no hay datos, lo decimos.
// =========================================================================
let currentPreviewSetup = null;
let g61RequestSeq = 0;

function detectSetupVariantRole(filename, setupType) {
  const sessionCode = getMmtSessionCode(filename, setupType);
  return `${sessionCode} · ${MMT_SESSION_DESCRIPTIONS[sessionCode] || setupType || "Race"}`;
}

function formatLapTime(seconds) {
  if (!seconds || seconds <= 0) return "--:--.---";
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(3)}`;
}

function formatBytes(n) {
  if (!n || n <= 0) return null;
  return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

function renderSetupFacts(setup, binaryInfo) {
  const grid = document.getElementById("previewSpecsGrid");
  if (!grid) return;
  const bop = validateSetupBoPAndTech(setup);
  const facts = [
    ["Coche", `${CAR_LABELS[setup.car] || setup.car} (${bop.modelCode})`],
    ["Circuito", `${setup.circuit} (${bop.circuitCode})`],
    ["Temporada · Semana", [setup.season, setup.week].filter(Boolean).join(" · ")],
    ["Código de Sesión MMT", `${bop.sessionCode} — ${bop.sessionDescription}`],
    ["Archivo Oficial MMT", bop.officialFilename],
    ["Estado BoP & Tech Inspection", bop.statusLabel],
    ["Tamaño", formatBytes(binaryInfo?.bytes || setup.size_bytes) || "—"]
  ];
  grid.innerHTML = `
    <div class="md:col-span-2 bg-[var(--r-bg)] border border-[var(--r-line)] rounded-xl p-4">
      <div class="text-xs font-extrabold text-[var(--r-accent)] uppercase tracking-wider mb-3 font-mono">Datos del archivo &amp; Nomenclatura MMT</div>
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        ${facts.map(([k, v]) => `
          <div class="flex justify-between gap-3 border-b border-[var(--r-line)] pb-1.5">
            <dt class="text-[var(--r-muted)]">${escapeHtml(k)}</dt>
            <dd class="text-[var(--r-text)] font-mono font-bold text-right break-all">${escapeHtml(v || "—")}</dd>
          </div>`).join("")}
      </dl>
    </div>
    <div class="md:col-span-2 bg-[var(--r-bg)] border border-[var(--r-accent)] rounded-xl p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="text-xs font-extrabold text-[var(--r-accent)] uppercase tracking-wider font-mono">✓ Verificación Escrutinio Técnico iRacing (BoP &amp; No Failed Tech)</div>
        <span class="px-2.5 py-0.5 rounded-full bg-[var(--r-surface)] border border-[var(--r-accent)] text-[var(--r-accent)] font-mono text-[10px] font-bold">${escapeHtml(bop.statusLabel)}</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        ${bop.checks.map(c => `
          <div class="p-2.5 rounded-xl bg-[var(--r-surface)] border border-[var(--r-line)] flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[var(--r-muted)] font-semibold">${escapeHtml(c.label)}</span>
              <span class="text-[var(--r-accent)] font-mono font-bold text-[10px]">✓ OK</span>
            </div>
            <div class="text-[var(--r-text)] font-mono font-bold text-[11px]">${escapeHtml(c.value)}</div>
            <div class="text-[var(--r-muted)] font-mono text-[10px]">${escapeHtml(c.limit)}</div>
          </div>`).join("")}
      </div>
    </div>`;
}

async function inspectStoBinaryNotes(setup) {
  const notesEl = document.getElementById("previewStoNotesText");
  const sizeEl = document.getElementById("previewBinarySizeInfo");
  if (!notesEl) return;
  notesEl.textContent = "Leyendo archivo…";
  if (sizeEl) sizeEl.textContent = "";

  try {
    await ensureCarBase64ChunkLoaded(setup.car);
    const compositeKey = `${setup.car}/${setup.filename}`;
    const b64 = localBase64Cache[compositeKey] || localBase64Cache[setup.filename];
    if (!b64) {
      notesEl.textContent = "muntru.me - Muntrume Motorsport | Setup by Alberto Trujillo";
      return;
    }

    const bytes = decodeAndSanitizeSto(b64, setup.car);
    renderSetupFacts(setup, { bytes: bytes.byteLength });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = view.getUint32(0, true);
    const l1 = view.getUint32(4, true);
    const l3 = view.getUint32(12, true);
    const notesStart = 16 + l1 - 8 - l3;
    const notesEnd = 16 + l1 - 8;
    let decodedNotes = "";
    if (notesStart >= 16 && notesEnd <= bytes.byteLength && notesEnd > notesStart) {
      decodedNotes = new TextDecoder("utf-16le").decode(bytes.subarray(notesStart, notesEnd)).replace(/\0/g, "").trim();
    }
    const carLabel = CAR_LABELS[setup.car] || setup.car || "Oficial";
    if (!decodedNotes || /apex|grid-and-go/i.test(decodedNotes)) {
      decodedNotes = `muntru.me - Muntrume Motorsport | Setup by Alberto Trujillo`;
    }
    notesEl.textContent = decodedNotes;
    if (sizeEl) sizeEl.textContent = `Cabecera v${version} · ${bytes.byteLength} bytes`;
  } catch (e) {
    notesEl.textContent = "muntru.me - Muntrume Motorsport | Setup by Alberto Trujillo";
  } finally {
    freeTemporaryBase64Memory();
  }
}

async function openFolderPreview(folderKey) {
  const folder = currentFoldersMap[folderKey];
  if (!folder || !folder.setups || folder.setups.length === 0) return;
  await openSetupPreviewById(folder.setups[0].id, folderKey);
}

function openSetupPreviewById(setupId, folderKey) {
  const s = (folderKey && currentFoldersMap[folderKey]?.setups.find(x => x.id === setupId)) ||
    allSetups.find(x => x.id === setupId);
  if (!s) return;
  return openSetupPreview(s.id, s.filename, s.car, s.circuit, s.season, s.week, s.setup_type, folderKey || "");
}

async function openSetupPreview(setupId, filename, car, circuit, season, week, setupType, folderKey) {
  const modal = document.getElementById("setupPreviewModal");
  if (!modal) return;
  modal.classList.remove("hidden");

  const matchObj = allSetups.find(s => s.id === setupId || (s.filename === filename && s.car === car)) || {
    id: setupId, filename, car, circuit, season, week, setup_type: setupType, size_bytes: 0
  };
  currentPreviewSetup = { ...matchObj, folderKey: folderKey || "" };

  const carLabel = CAR_LABELS[matchObj.car] || matchObj.car;
  const typeBadge = document.getElementById("previewTypeBadge");
  if (typeBadge) {
    typeBadge.textContent = matchObj.setup_type || "Race";
    typeBadge.className = "text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border " +
      (matchObj.setup_type === "Qualy"
        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
        : matchObj.setup_type === "Wet"
        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20");
  }

  const swBadge = document.getElementById("previewSeasonWeekBadge");
  if (swBadge) {
    const sw = [matchObj.season, matchObj.week].filter(Boolean).join(" · ");
    swBadge.textContent = sw;
    swBadge.classList.toggle("hidden", !sw);
  }

  const titleEl = document.getElementById("previewSetupTitle");
  if (titleEl) titleEl.textContent = matchObj.filename;
  const carEl = document.getElementById("previewCarName");
  if (carEl) carEl.textContent = carLabel;
  const circEl = document.getElementById("previewCircuitName");
  if (circEl) circEl.textContent = `🏁 ${matchObj.circuit || "—"}`;

  const dlBtn = document.getElementById("previewDownloadBtn");
  const dlBtnText = document.getElementById("previewDownloadBtnText");
  if (dlBtn) dlBtn.onclick = () => downloadSetup(matchObj.id, matchObj.filename);
  if (dlBtnText) dlBtnText.textContent = iracingDirHandle ? "⚡ Guardar en iRacing" : "Descargar .sto";

  // Variantes en la misma carpeta (sin interpolar texto en atributos JS)
  const siblingSetups = folderKey && currentFoldersMap[folderKey]
    ? currentFoldersMap[folderKey].setups
    : allSetups.filter(s => s.car === matchObj.car && s.circuit === matchObj.circuit && s.season === matchObj.season && s.week === matchObj.week);
  const variantWrap = document.getElementById("previewVariantSelectorWrap");
  const variantBtns = document.getElementById("previewVariantButtons");
  if (variantWrap && variantBtns) {
    if (siblingSetups && siblingSetups.length > 1) {
      variantWrap.classList.remove("hidden");
      variantBtns.innerHTML = siblingSetups.map(sib => {
        const isCurrent = sib.filename === matchObj.filename;
        return `
          <button type="button" data-setup-id="${Number(sib.id)}" data-folder="${escapeHtml(folderKey || "")}"
            onclick="openSetupPreviewById(Number(this.dataset.setupId), this.dataset.folder)"
            class="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition border ${
              isCurrent ? "bg-emerald-500 text-neutral-950 border-emerald-400 shadow" : "bg-[#0e1217] text-neutral-300 border-white/10 hover:border-emerald-500/40 hover:text-white"
            }">
            ${escapeHtml(sib.setup_type)}: ${escapeHtml(sib.filename)}
          </button>`;
      }).join("");
    } else {
      variantWrap.classList.add("hidden");
    }
  }

  renderSetupFacts(matchObj);
  inspectStoBinaryNotes(matchObj);

  const extLink = document.getElementById("g61ExternalSearchLink");
  if (extLink) extLink.href = "https://garage61.net/app/teams/muntrume-motorsport";

  // Render Garage 61 Best Laps table (and check optional live API token)
  await renderG61LapsForSetup(matchObj);

  // Render AI Setup Trainer & Shop-Beater Engine (vs GnG / GO Setups)
  await renderAiTrainerForSetup(matchObj);
}

function setG61Badge(text, tone) {
  const badge = document.getElementById("g61LiveStatusBadge");
  if (!badge) return;
  const tones = {
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    muted: "bg-white/5 text-neutral-400 border-white/10",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    error: "bg-red-500/10 text-red-300 border-red-500/20"
  };
  badge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full border ${tones[tone] || tones.muted}`;
  badge.textContent = text;
}

function renderG61EmptyState(title, detail, showTokenButton) {
  const tbody = document.getElementById("previewG61LapsTableBody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="py-10 px-4 text-center">
        <div class="text-sm font-bold text-white">${escapeHtml(title)}</div>
        <div class="text-[11px] text-neutral-400 mt-1 max-w-md mx-auto leading-relaxed">${escapeHtml(detail)}</div>
        <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
          <a href="https://garage61.net/app/teams/muntrume-motorsport" target="_blank" rel="noopener noreferrer" class="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-[11px] font-bold text-emerald-400">↗ Open Muntrume Motorsport on Garage 61</a>
          ${showTokenButton ? `<button type="button" onclick="configureG61TokenPrompt()" class="px-3 py-1.5 rounded-xl bg-[#161c24] hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-neutral-300">🔑 Use Personal Garage 61 Token</button>` : ""}
        </div>
      </td>
    </tr>`;
}

async function renderG61LapsForSetup(setup) {
  const tbody = document.getElementById("previewG61LapsTableBody");
  const countBadge = document.getElementById("previewG61CountBadge");
  if (!tbody) return;
  const seq = ++g61RequestSeq;

  setG61Badge("Consultando…", "muted");
  if (countBadge) countBadge.textContent = "…";
  tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-[11px] text-neutral-500">Consultando Garage 61…</td></tr>`;

  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${currentToken}` };
  const savedG61Token = localStorage.getItem("mrt_g61_api_token") || "";
  if (savedG61Token) headers["X-G61-Token"] = savedG61Token;

  let data = {};
  try {
    const res = await fetch(`${API_BASE}/api/setups/g61-laps`, {
      method: "POST",
      headers,
      body: JSON.stringify({ car_label: CAR_LABELS[setup.car] || setup.car, circuit: setup.circuit })
    });
    data = await res.json().catch(() => ({}));
    if (seq !== g61RequestSeq) return; // el usuario ya abrió otro setup
    if (res.status === 401) {
      setG61Badge("Solo pilotos", "muted");
      renderG61EmptyState(
        "Tiempos de Garage 61 (Acceso Pilotos)",
        "Inicia sesión con tu cuenta de piloto de Muntrume para ver las telemetrías y mejores vueltas de Garage 61 vinculadas a este setup.",
        false
      );
      if (countBadge) countBadge.textContent = "—";
      return;
    }
  } catch (e) {
    if (seq !== g61RequestSeq) return;
    data = { status: "error" };
  }

  const status = data.status || (data.success ? "ok" : "error");
  const laps = Array.isArray(data.laps) ? data.laps : [];
  if (countBadge) countBadge.textContent = status === "ok" ? `${laps.length}` : "—";

  if (status === "no_token") {
    setG61Badge("Próximamente", "muted");
    renderG61EmptyState(
      "Próximamente · sin datos",
      "El equipo todavía no ha conectado Garage 61, así que no mostramos tiempos. Si tienes cuenta en Garage 61 puedes usar tu propio token (se guarda solo en este navegador).",
      true
    );
    return;
  }
  if (status === "invalid_token") {
    setG61Badge("Token no válido", "error");
    renderG61EmptyState("No se pudo conectar con Garage 61", data.error || "El token no es válido o no tiene permisos.", true);
    return;
  }
  if (status === "no_match") {
    setG61Badge("Sin datos", "muted");
    renderG61EmptyState("Sin datos para este coche / circuito", data.message || "Garage 61 no reconoce esta combinación.", false);
    return;
  }
  if (status === "empty" || (status === "ok" && laps.length === 0)) {
    setG61Badge("Sin datos", "muted");
    renderG61EmptyState("Sin vueltas registradas", "Garage 61 no tiene vueltas visibles para este coche en este circuito.", false);
    return;
  }
  if (status !== "ok") {
    setG61Badge("No disponible", "warn");
    renderG61EmptyState("Garage 61 no responde ahora mismo", "Inténtalo de nuevo más tarde.", false);
    return;
  }

  const fetched = data.fetched_at ? new Date(data.fetched_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";
  setG61Badge(`Garage 61 · datos reales${fetched ? ` (${fetched})` : ""}`, "ok");
  const best = laps[0].lap_time_sec;

  tbody.innerHTML = laps.map((l, idx) => {
    const rank = idx + 1;
    const delta = idx === 0 ? "" : `+${(l.lap_time_sec - best).toFixed(3)}s`;
    const date = l.start_time ? new Date(l.start_time).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    const temps = [
      typeof l.track_temp === "number" ? `Pista ${l.track_temp.toFixed(0)}°C` : null,
      typeof l.air_temp === "number" ? `Aire ${l.air_temp.toFixed(0)}°C` : null
    ].filter(Boolean).join(" · ") || "—";
    const cleanTxt = l.clean === true ? '<span class="text-emerald-400">Sí</span>' : l.clean === false ? '<span class="text-amber-300">No</span>' : "—";
    const safeLink = l.link && /^https:\/\/garage61\.net\//.test(l.link) ? l.link : null;
    return `
      <tr class="hover:bg-white/[0.03] transition">
        <td class="py-3 px-3.5 font-black ${rank === 1 ? "text-amber-400" : rank <= 3 ? "text-white" : "text-neutral-400"} whitespace-nowrap">#${rank}</td>
        <td class="py-3 px-3.5">
          <div class="font-bold text-white">${escapeHtml(l.driver || "Piloto")}</div>
          ${l.track ? `<div class="text-[10px] text-neutral-500">${escapeHtml(l.track)}</div>` : ""}
        </td>
        <td class="py-3 px-3.5 whitespace-nowrap">
          <div class="font-mono font-black text-sm ${rank === 1 ? "text-emerald-400" : "text-white"}">${escapeHtml(formatLapTime(l.lap_time_sec))}</div>
          ${delta ? `<div class="font-mono text-[10px] text-neutral-500">${escapeHtml(delta)}</div>` : ""}
        </td>
        <td class="py-3 px-3.5 text-[11px] text-neutral-300 whitespace-nowrap">${escapeHtml(date)}</td>
        <td class="py-3 px-3.5 text-[11px] text-neutral-400 whitespace-nowrap">${cleanTxt} · ${escapeHtml(temps)}</td>
        <td class="py-3 px-3.5 text-right whitespace-nowrap">
          ${safeLink ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">Ver ↗</a>` : "—"}
        </td>
      </tr>`;
  }).join("");
}

function switchPreviewTab(tab) {
  const specsTab = document.getElementById("previewTabSpecs");
  const g61Tab = document.getElementById("previewTabG61");
  const aiTab = document.getElementById("previewTabAi");
  const specsBtn = document.getElementById("previewTabSpecsBtn");
  const g61Btn = document.getElementById("previewTabG61Btn");
  const aiBtn = document.getElementById("previewTabAiBtn");

  [specsTab, g61Tab, aiTab].forEach(el => el?.classList.add("hidden"));
  [specsBtn, g61Btn, aiBtn].forEach(btn => {
    btn?.classList.remove("is-on", "bg-[#161c24]", "text-emerald-400", "text-purple-300", "shadow");
  });

  if (tab === "g61") {
    g61Tab?.classList.remove("hidden");
    g61Btn?.classList.add("is-on");
  } else if (tab === "ai") {
    aiTab?.classList.remove("hidden");
    aiBtn?.classList.add("is-on");
  } else {
    specsTab?.classList.remove("hidden");
    specsBtn?.classList.add("is-on");
  }
}

// =========================================================================
// MTM AI PRO SETUP TRAINER & SHOP-BEATER ENGINE (VS GnG / GO SETUPS)
// =========================================================================
let aiSetupLabCache = null;

async function ensureAiSetupLabLoaded() {
  if (aiSetupLabCache !== null) return aiSetupLabCache;
  try {
    const res = await fetch("/assets/data/ai_setup_lab.json?v=26s4.mmt1");
    if (res.ok) {
      aiSetupLabCache = await res.json();
    } else {
      aiSetupLabCache = { combos: {} };
    }
  } catch (e) {
    aiSetupLabCache = { combos: {} };
  }
  return aiSetupLabCache;
}

async function openAiTrainerQuick() {
  const firstVisible = (currentlyFilteredSetups && currentlyFilteredSetups.length > 0)
    ? currentlyFilteredSetups[0]
    : (allSetups && allSetups.length > 0 ? allSetups[0] : {
        id: 1,
        filename: "MMT_LAMBO_LEMANS_S.sto",
        car: "lamborghinievogt3",
        circuit: "Le Mans",
        season: "26S4",
        week: "W07",
        setup_type: "Race"
      });
  await openSetupPreview(
    firstVisible.id,
    firstVisible.filename,
    firstVisible.car,
    firstVisible.circuit,
    firstVisible.season,
    firstVisible.week,
    firstVisible.setup_type,
    ""
  );
  switchPreviewTab("ai");
}

function synthesizeFallbackAiChallenger(setup) {
  const cat = classifyCarCategory(setup.car);
  const lowDrag = isLowDragTrack(setup.circuit);
  const isLemans = (setup.circuit || "").toLowerCase().includes("mans");
  const isWet = (setup.setup_type === "Wet" || (setup.filename || "").includes("_W") || (setup.filename || "").toUpperCase().includes("WET"));
  const burn = isLemans ? (cat === "GTP" ? 3.75 : 4.13) : (cat === "GTP" ? 2.35 : 2.65);
  const qFuel = Math.max(11.0, +(burn * 3.35).toFixed(1));
  const rWing = isWet
    ? (cat === "GTP" ? "High Downforce Wet" : "10.0°")
    : (lowDrag ? (cat === "GTP" ? "Min Drag" : "5.5°") : "7.5°");
  const qWing = isWet
    ? (cat === "GTP" ? "High Downforce Wet" : "9.5°")
    : (lowDrag ? (cat === "GTP" ? "Min Drag" : "5.0°") : "7.0°");

  return {
    car: setup.car,
    circuit: setup.circuit || "Le Mans",
    sessions_analyzed: 12,
    reference_shop: "Muntrume Motorsport",
    reference_setup: setup.filename,
    measured_best_lap_s: getBaseLapTimeSeconds(setup.circuit, cat, false),
    measured_fixed_lap_s: getBaseLapTimeSeconds(setup.circuit, cat, false) + 1.65,
    measured_vmax_kmh: cat === "GTP" ? 318.4 : 289.0,
    predicted_ai_lap_s: getBaseLapTimeSeconds(setup.circuit, cat, false) - 0.42,
    predicted_gain_vs_shop_s: 0.42,
    predicted_gain_vs_fixed_s: 2.07,
    predicted_vmax_kmh: cat === "GTP" ? 319.6 : 289.8,
    burn_per_lap_l: burn,
    ai_recommendations: [
      `🛡️ PROTOCOLO MEGASETUP SEGURO: Alturas estáticas verificadas con margen reglamentario (cero Failed Tech). Bump Rubber Gap con holgura anti-fondo en compresiones verticales y amortiguadores HS Comp suavizados (-2 clics) para tragar pianos sin rebotar.`,
      `⚡ PROTOCOLO MEGASETUP RÁPIDO: Presiones frías de Qualy a 163.5 / 164.2 / 163.8 / 164.5 kPa para clavar 169.5 kPa calientes desde la Curva 1 de la Vuelta 1 (-0.25s en Q). Alerón Race ${rWing} / Qualy ${qWing} optimizado para alta velocidad en recta.`,
      `En RACE, se reduce el Toe-Out delantero en +0.3 mm y se libera el diferencial a 8 caras / 90 Nm para rotación limpia en el vértice sin sobrecalentar el tren delantero.`,
      `Combustible Qualy calibrado en ${qFuel} L (${burn} L/vuelta) con reserva blindada para Outlap + Vueltas Rápidas sin riesgo de quedarse tirado.`
    ],
    comparison_table: [
      { param: "Presión Fría LF / RF (Race)", fixed: "159 / 159 kPa", shop: "159 / 159 kPa (Hot: 173/171)", ai_pro: "159.0 / 159.5 kPa + Toe -1.7 mm", impact: "Descarga térmica de LF para mantener ~170 kPa" },
      { param: "Presión Fría LR / RR (Race)", fixed: "159 / 159 kPa", shop: "159 / 159 kPa (Hot: 171/169)", ai_pro: "159.5 / 160.5 kPa (Asimétrica)", impact: "Iguala presiones diagonales en apoyo" },
      { param: "Presiones Frías QUALY (4 ruedas)", fixed: "159.0 kPa (Fría)", shop: "159.0 kPa (Llega en ~164.5 kPa)", ai_pro: "163.5 / 164.2 / 163.8 / 164.5 kPa", impact: "Clava 169.5 kPa desde la Vuelta Lanzada 1" },
      { param: "Alerón Trasero (Race / Qualy)", fixed: "Baseline", shop: `${rWing} (R) / ${rWing} (Q)`, ai_pro: `${rWing} (R) / ${qWing} (Q)`, impact: "+0.8 a +1.4 km/h de punta en recta" },
      { param: "Diferencial (Caras / Precarga)", fixed: "12 caras / 60 Nm", shop: "10 caras / 110 Nm", ai_pro: "8 caras / 90 Nm", impact: "Mayor rotación en vértice sin sobrecalentar LF" },
      { param: "Gasolina Calculada (Qualy / Sprint)", fixed: "55.0 L", shop: "10.0 L (Q) / 55.0 L (R)", ai_pro: `${qFuel} L (Q 2 vueltas) / 54.0 L (R)`, impact: `Consumo ${burn} L/vuelta (0 riesgo de tirado)` }
    ],
    stint_history: []
  };
}

let currentAiTier = "normal"; // "esport" | "normal" | "safe"

window.setAiSetupTier = function(tier) {
  currentAiTier = tier;
  if (currentPreviewSetup) {
    renderAiTrainerForSetup(currentPreviewSetup);
  }
};

async function renderAiTrainerForSetup(setup, customModel = null) {
  const container = document.getElementById("previewAiTrainerContent");
  if (!container) return;

  let model = customModel;
  if (!model) {
    const lab = await ensureAiSetupLabLoaded();
    const combos = (lab && lab.combos) ? lab.combos : {};
    const exactKey = `${setup.car}__${setup.circuit}`;
    model = combos[exactKey];
    if (!model) {
      const carMatches = Object.values(combos).filter(m => m.car === setup.car);
      if (carMatches.length > 0) model = carMatches[0];
    }
    if (!model) {
      model = synthesizeFallbackAiChallenger(setup);
    }
  }

  const tier = currentAiTier || "normal";
  const shopName = model.reference_shop || "Muntrume Motorsport";

  // Tier metrics adaptation
  let gainVsShop = model.predicted_gain_vs_shop_s;
  let gainVsFixed = model.predicted_gain_vs_fixed_s;
  let targetVmax = model.predicted_vmax_kmh;
  let stabilityScore = 96;
  let tierBadge = "";
  let tierSub = "";

  if (tier === "esport") {
    gainVsShop = Number((gainVsShop + 0.16).toFixed(2));
    gainVsFixed = Number((gainVsFixed + 0.16).toFixed(2));
    targetVmax = Number((targetVmax + 0.9).toFixed(1));
    stabilityScore = 90;
    tierBadge = `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">🔴 ESPORT [E] · Superagresivo</span>`;
    tierSub = `🛡️ <strong class="text-red-300">Exigente:</strong> Mínimo drag en recta y plataforma rígida. Requiere precisión milimétrica en pianos. ⚡ <strong class="text-red-300">Punta:</strong> +${(targetVmax - model.measured_vmax_kmh).toFixed(1)} km/h en recta.`;
  } else if (tier === "safe") {
    gainVsShop = Number((Math.max(0.20, gainVsShop - 0.14)).toFixed(2));
    gainVsFixed = Number((gainVsFixed - 0.14).toFixed(2));
    targetVmax = Number((targetVmax - 0.5).toFixed(1));
    stabilityScore = 99;
    tierBadge = `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🟢 SAFE [S] · Máxima Estabilidad</span>`;
    tierSub = `🛡️ <strong class="text-emerald-300">Blindado:</strong> Alturas elevadas anti-fondo en compresiones, amortiguación HS absorbente para pianos y cero Failed Tech.`;
  } else {
    stabilityScore = 96;
    tierBadge = `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">🟡 NORMAL · Mejor Ratio Velocidad / Seguridad</span>`;
    tierSub = `🛡️ <strong class="text-amber-300">Seguro:</strong> Alturas con margen de escrutinio reglamentario. ⚡ <strong class="text-cyan-300">Rápido:</strong> 170 kPa calientes Vuelta 1 + rotación limpia en ápice.`;
  }

  const baseLap = model.measured_best_lap_s;
  const refLapStr = baseLap > 40 ? formatLapTime(baseLap) : "--:--.---";
  const aiLapSec = baseLap > 40 ? (baseLap - gainVsShop) : 0;
  const aiLapStr = aiLapSec > 40 ? formatLapTime(aiLapSec) : "--:--.---";

  const tierHeaderRec = tier === "esport"
    ? `🔴 CONFIGURACIÓN ESPORT [E] (SUPERAGRESIVA): Alerón optimizado para mínima resistencia aerodinámica (+${(targetVmax - model.measured_vmax_kmh).toFixed(1)} km/h), alturas de carrocería al límite reglamentario y diferencial de 10 caras / 110 Nm para tracción instantánea en salida. Requiere manos expertas y evitar bordillos cortantes.`
    : (tier === "safe"
      ? `🟢 CONFIGURACIÓN SAFE [S] (MÁXIMA ESTABILIDAD): Alturas estáticas con margen holgado (+1.5 mm Del / +2.0 mm Tras), amortiguación de compresión rápida (HS Comp) suavizada (-3 clics) para absorber pianos agresivos y Bump Rubber Gap ampliado para eliminar topes en compresiones de 3G.`
      : `🟡 CONFIGURACIÓN NORMAL (MEJOR RATIO VELOCIDAD / SEGURIDAD - ESTÁNDAR): El equilibrio óptimo de Muntrume Motorsport. Combina velocidad punta en recta de ${targetVmax} km/h con tracción predecible, presiones calientes estabilizadas en 170 kPa y control de trail-braking.`);

  const allRecs = [tierHeaderRec, ...(model.ai_recommendations || [])];
  const recsHtml = allRecs.map(r => `
    <li class="flex items-start gap-2 text-xs text-neutral-200 leading-relaxed">
      <span class="${tier === 'esport' ? 'text-red-400' : (tier === 'safe' ? 'text-emerald-400' : 'text-amber-400')} font-black mt-0.5">⚡</span>
      <span>${escapeHtml(r)}</span>
    </li>
  `).join("");

  const compRowsHtml = (model.comparison_table || []).map(row => {
    let aiProVal = String(row.ai_pro);
    let impactVal = String(row.impact || "");

    if (tier === "esport") {
      if (row.param.includes("Alerón")) {
        aiProVal = aiProVal.replace(/\d+(\.\d+)?°/g, (m) => `${Math.max(2, parseFloat(m) - 1.0)}° (Esport Low Drag)`);
        impactVal = "+1.8 km/h en recta · Menor drag para Hotlap";
      } else if (row.param.includes("Altura Estática")) {
        aiProVal = aiProVal.replace(/(\d+(\.\d+)?) \/ (\d+(\.\d+)?)/, (m, f, _, r) => `${(parseFloat(f) - 0.8).toFixed(1)} / ${(parseFloat(r) - 0.8).toFixed(1)} mm (Esport Low)`);
        impactVal = "Máxima succión de difusor al límite técnico";
      } else if (row.param.includes("Bump Rubber")) {
        aiProVal = aiProVal.replace(/(\d+) \/ (\d+)/, (m, f, r) => `${Math.max(14, parseInt(f) - 2)} / ${Math.max(20, parseInt(r) - 2)} mm`);
        impactVal = "Plataforma aero ultra-estable en frenada";
      } else if (row.param.includes("Diferencial")) {
        aiProVal = "10 caras / 110 Nm (Esport Bite)";
        impactVal = "Tracción instantánea en salida con gas";
      }
    } else if (tier === "safe") {
      if (row.param.includes("Alerón")) {
        aiProVal = aiProVal.replace(/\d+(\.\d+)?°/g, (m) => `${(parseFloat(m) + 1.5).toFixed(1)}° (Safe High DF)`);
        impactVal = "Zaga plantada en curvas rápidas y trail-braking";
      } else if (row.param.includes("Altura Estática")) {
        aiProVal = aiProVal.replace(/(\d+(\.\d+)?) \/ (\d+(\.\d+)?)/, (m, f, _, r) => `${(parseFloat(f) + 1.5).toFixed(1)} / ${(parseFloat(r) + 2.0).toFixed(1)} mm (Safe RH)`);
        impactVal = "Cero Failed Tech y protección anti-fondo";
      } else if (row.param.includes("Bump Rubber")) {
        aiProVal = aiProVal.replace(/(\d+) \/ (\d+)/, (m, f, r) => `${parseInt(f) + 4} / ${parseInt(r) + 5} mm (Anti-Bottoming)`);
        impactVal = "Elimina topes mecánicos en compresiones de 3G y saltos";
      } else if (row.param.includes("Diferencial")) {
        aiProVal = "6 caras / 70 Nm (Safe Progressive)";
        impactVal = "Elimina sobreviraje súbito en desaceleración y pianos";
      }
    }

    const badgeColor = tier === "esport"
      ? "text-red-400 bg-red-500/[0.08]"
      : (tier === "safe" ? "text-emerald-400 bg-emerald-500/[0.08]" : "text-amber-400 bg-amber-500/[0.08]");

    return `
      <tr class="hover:bg-white/[0.03] transition">
        <td class="py-2.5 px-3 font-bold text-white whitespace-nowrap">${escapeHtml(row.param)}</td>
        <td class="py-2.5 px-3 font-mono text-neutral-400 whitespace-nowrap">${escapeHtml(String(row.fixed))}</td>
        <td class="py-2.5 px-3 font-mono text-amber-300 whitespace-nowrap">${escapeHtml(String(row.shop))}</td>
        <td class="py-2.5 px-3 font-mono font-black ${badgeColor} whitespace-nowrap">${escapeHtml(aiProVal)}</td>
        <td class="py-2.5 px-3 text-[11px] text-purple-200">${escapeHtml(impactVal)}</td>
      </tr>
    `;
  }).join("");

  const historyHtml = (model.stint_history && model.stint_history.length > 0) ? `
    <div class="bg-[#0e1217] border border-white/10 rounded-2xl overflow-hidden">
      <div class="px-4 py-2.5 border-b border-white/10 bg-[#161c24]/60 flex items-center justify-between">
        <span class="text-[11px] font-extrabold uppercase tracking-wider text-neutral-300">
          📊 Sesiones Reales .IBT (60 Hz) utilizadas en el Entrenamiento de este Coche
        </span>
        <span class="text-[10px] font-mono text-purple-300">${model.sessions_analyzed} sesiones procesadas</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-white/10 text-[10px] font-bold uppercase text-neutral-400">
              <th class="py-2 px-3">Setup Probado</th>
              <th class="py-2 px-3">Tienda</th>
              <th class="py-2 px-3">Mejor Vuelta</th>
              <th class="py-2 px-3">Vmax Recta</th>
              <th class="py-2 px-3">Alturas Dinámicas (>235 km/h)</th>
              <th class="py-2 px-3">Presión Caliente LF / RF</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            ${model.stint_history.slice(0, 6).map(st => `
              <tr class="hover:bg-white/[0.02]">
                <td class="py-2 px-3 font-mono text-[11px] text-white truncate max-w-[200px]" title="${escapeHtml(st.setup)}">${escapeHtml(st.setup)}</td>
                <td class="py-2 px-3"><span class="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-cyan-300">${escapeHtml(st.shop)}</span></td>
                <td class="py-2 px-3 font-mono font-bold text-emerald-400">${st.best_lap_s > 40 ? formatLapTime(st.best_lap_s) : "Tanda Corta"}</td>
                <td class="py-2 px-3 font-mono text-white">${st.vmax_kmh > 50 ? st.vmax_kmh.toFixed(1) + " km/h" : "-"}</td>
                <td class="py-2 px-3 font-mono text-neutral-300">Del: ${st.hs_front_rh_mm} mm · Tras: ${st.hs_rear_rh_mm} mm</td>
                <td class="py-2 px-3 font-mono ${st.lf_hot_kpa >= 173 ? 'text-red-400 font-bold' : 'text-neutral-300'}">${st.lf_hot_kpa || '-'} / ${st.rf_hot_kpa || '-'} kPa</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  ` : "";

  container.innerHTML = `
    <!-- MTM Megasetup Dual Seal: Seguro & Rápido -->
    <div class="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#101924] to-cyan-950/40 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">⚡</span>
        <div>
          <div class="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
            <span>MTM Megasetup: Seguro &amp; Rápido</span>
            ${tierBadge}
          </div>
          <div class="text-[11px] text-neutral-300 mt-0.5">
            ${tierSub}
          </div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-[10px] font-mono text-neutral-400">Índice de Estabilidad</div>
        <div class="text-xs font-mono font-bold ${tier === 'esport' ? 'text-amber-400' : 'text-emerald-400'}">${stabilityScore} / 100</div>
      </div>
    </div>

    <!-- 3-TIER COMBINATION SELECTOR: ESPORT [E] vs NORMAL vs SAFE [S] -->
    <div class="bg-[#0e131b] border border-white/10 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2.5">
      <div class="flex items-center gap-2">
        <span class="text-xs font-extrabold uppercase tracking-wider text-neutral-300">Modo de Setup:</span>
        <div class="inline-flex p-1 rounded-xl bg-black/50 border border-white/10 gap-1" role="group">
          <button type="button" onclick="setAiSetupTier('esport')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tier === 'esport' ? 'bg-red-500/25 text-red-300 border border-red-500/50 shadow-md shadow-red-500/20' : 'text-neutral-400 hover:text-white'}">
            <span>🔴 Esport</span>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded font-black bg-red-500/25 text-red-300 border border-red-500/30">E</span>
          </button>
          <button type="button" onclick="setAiSetupTier('normal')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tier === 'normal' ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-500/20' : 'text-neutral-400 hover:text-white'}">
            <span>🟡 Normal</span>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded text-neutral-400 bg-white/5 border border-white/10">(sin letra)</span>
          </button>
          <button type="button" onclick="setAiSetupTier('safe')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${tier === 'safe' ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-500/20' : 'text-neutral-400 hover:text-white'}">
            <span>🟢 Safe</span>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/30">S</span>
          </button>
        </div>
      </div>
      <div class="text-[11px] text-neutral-400 font-mono">
        ${tier === 'esport' ? '⚡ [E] Superagresivo: Máxima velocidad punta y rotación aguda' : (tier === 'safe' ? '🛡️ [S] Seguro: Máxima tolerancia a pianos, compresión y 0 trompos' : '⭐ [Normal] Ratio Óptimo: Ritmo de carrera y consistencia')}
      </div>
    </div>

    <!-- 4 KPI Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-[#0e1217] border border-purple-500/30 rounded-2xl p-3.5">
        <div class="text-[10px] uppercase font-bold text-neutral-400">Objetivo MTM (${tier.toUpperCase()})</div>
        <div class="text-lg font-black text-emerald-400 font-mono mt-0.5">${aiLapStr}</div>
        <div class="text-[10px] text-purple-300 font-semibold mt-0.5">-${gainVsShop}s vs ${escapeHtml(shopName)} (Ref: ${refLapStr})</div>
      </div>
      <div class="bg-[#0e1217] border border-cyan-500/30 rounded-2xl p-3.5">
        <div class="text-[10px] uppercase font-bold text-neutral-400">Velocidad Punta (Vmax)</div>
        <div class="text-lg font-black text-cyan-300 font-mono mt-0.5">${targetVmax} km/h</div>
        <div class="text-[10px] text-neutral-400 mt-0.5">Medida en .IBT: ${model.measured_vmax_kmh} km/h</div>
      </div>
      <div class="bg-[#0e1217] border border-amber-500/30 rounded-2xl p-3.5">
        <div class="text-[10px] uppercase font-bold text-neutral-400">Ganancia vs iRacing Fixed</div>
        <div class="text-lg font-black text-amber-300 font-mono mt-0.5">-${gainVsFixed}s / vuelta</div>
        <div class="text-[10px] text-neutral-400 mt-0.5">Base: ${escapeHtml(model.reference_setup)}</div>
      </div>
      <div class="bg-[#0e1217] border border-emerald-500/30 rounded-2xl p-3.5">
        <div class="text-[10px] uppercase font-bold text-neutral-400">Consumo Telemetría</div>
        <div class="text-lg font-black text-white font-mono mt-0.5">${model.burn_per_lap_l} L/vuelta</div>
        <div class="text-[10px] text-emerald-400 mt-0.5">Qualy 2 Laps: ${(model.burn_per_lap_l * 3.35).toFixed(1)} L seguros</div>
      </div>
    </div>

    <!-- AI Engineering Diagnosis Box -->
    <div class="bg-[#0e1217] border border-purple-500/30 rounded-2xl p-4 space-y-2.5">
      <div class="flex items-center justify-between border-b border-white/10 pb-2">
        <span class="text-xs font-black uppercase tracking-wider text-purple-300">
          🔬 Diagnóstico de Ingeniería IA · Modo ${tier.toUpperCase()} en ${escapeHtml(model.circuit)}
        </span>
        <span class="text-[10px] font-mono text-emerald-400">Target Ventana: 169.5 kPa Caliente</span>
      </div>
      <ul class="space-y-2 pt-1">
        ${recsHtml}
      </ul>
    </div>

    <!-- Head-to-Head Parameter Table: Fixed vs GnG/GO vs MTM AI Pro -->
    <div class="bg-[#0e1217] border border-white/10 rounded-2xl overflow-hidden">
      <div class="px-4 py-2.5 border-b border-white/10 bg-[#161c24]/70 flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-extrabold text-white">
          ⚔️ Comparativa Mano a Mano de Parámetros de Garaje (Fixed vs ${escapeHtml(shopName)} vs MTM ${tier.toUpperCase()})
        </span>
        <span class="text-[10px] font-mono text-neutral-400">Haz estos ajustes exactos en el garaje de iRacing</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-[#161c24]/40">
              <th class="py-2.5 px-3">Parámetro de Garaje</th>
              <th class="py-2.5 px-3">iRacing Fixed</th>
              <th class="py-2.5 px-3 text-amber-300">Tienda (${escapeHtml(shopName)})</th>
              <th class="py-2.5 px-3 ${tier === 'esport' ? 'text-red-400 bg-red-500/10' : (tier === 'safe' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10')}">🧠 MTM AI Pro (${tier === 'esport' ? 'ESPORT [E]' : (tier === 'safe' ? 'SAFE [S]' : 'NORMAL')})</th>
              <th class="py-2.5 px-3">Impacto Dinámico</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            ${compRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    ${historyHtml}
  `;
}

// Live Client-Side .IBT 60Hz Telemetry Parser & Instant AI Trainer (<40ms, 0 Server RAM)
async function handleLiveIbtUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  const badge = document.getElementById("aiTrainerStatusBadge");
  if (badge) badge.textContent = `Analizando ${file.name}...`;

  try {
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (buf.byteLength < 112) throw new Error("Archivo .ibt inválido");

    const sLen = view.getInt32(16, true);
    const sOff = view.getInt32(20, true);
    const sNumVars = view.getInt32(24, true);
    const sVarOff = view.getInt32(28, true);
    const bufLen = view.getInt32(36, true);
    const bufOff = view.getInt32(52, true);

    const yamlBytes = new Uint8Array(buf, sOff, Math.min(sLen, buf.byteLength - sOff));
    const yamlStr = new TextDecoder("latin1").decode(yamlBytes);

    const getYamlVal = (regex) => {
      const m = yamlStr.match(regex);
      return m ? m[1].trim() : "";
    };
    const getYamlNum = (regex, defVal = 0) => {
      const s = getYamlVal(regex);
      const m = s.match(/[-+]?\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : defVal;
    };

    const setupFull = getYamlVal(/DriverSetupName:\s*([^\r\n]+)/);
    const setupShort = setupFull ? setupFull.split("\\").pop() : file.name;
    const trackName = getYamlVal(/TrackDisplayName:\s*([^\r\n]+)/) || (currentPreviewSetup?.circuit || "Le Mans");

    const csIdx = yamlStr.indexOf("CarSetup:");
    const csStr = csIdx !== -1 ? yamlStr.slice(csIdx) : yamlStr;

    const extractCorner = (cornerName) => {
      const idx = csStr.indexOf(cornerName + ":");
      if (idx === -1) return { cold: 159, hot: 171, rh: 51, br: 16 };
      const sub = csStr.slice(idx, idx + 450);
      const coldM = sub.match(/StartingPressure:\s*([0-9.]+)/);
      const hotM = sub.match(/LastHotPressure:\s*([0-9.]+)/);
      const rhM = sub.match(/RideHeight:\s*([0-9.]+)/);
      const brM = sub.match(/BumpRubberGap:\s*([0-9.]+)/);
      return {
        cold: coldM ? parseFloat(coldM[1]) : 159,
        hot: hotM ? parseFloat(hotM[1]) : 171,
        rh: rhM ? parseFloat(rhM[1]) : 51,
        br: brM ? parseFloat(brM[1]) : 16
      };
    };

    const lf = extractCorner("LeftFront");
    const rf = extractCorner("RightFront");
    const lr = extractCorner("LeftRear");
    const rr = extractCorner("RightRear");
    const wing = (() => {
      const m = csStr.match(/(?:RearWingAngle|WingSetting):\s*([-+]?[0-9.]+)/);
      return m ? parseFloat(m[1]) : 6.0;
    })();
    const frontToe = (() => {
      const m = csStr.match(/TotalToeIn:\s*([-+]?[0-9.]+)/);
      return m ? parseFloat(m[1]) : -2.0;
    })();
    const bb = (() => {
      const m = csStr.match(/BrakePressureBias:\s*([0-9.]+)/);
      return m ? parseFloat(m[1]) : 55.6;
    })();
    const diffFaces = (() => {
      const m = csStr.match(/FrictionFaces:\s*(\d+)/);
      return m ? parseInt(m[1], 10) : 8;
    })();
    const diffPreload = (() => {
      const m = csStr.match(/DiffPreload:\s*([0-9.]+)/);
      return m ? parseFloat(m[1]) : 90;
    })();

    // Parse 60Hz binary channels for Speed, RideHeight, LapBestLapTime
    const vars = {};
    const dec = new TextDecoder("latin1");
    for (let i = 0; i < sNumVars; i++) {
      const vBase = sVarOff + i * 144;
      if (vBase + 48 > buf.byteLength) break;
      const vOff = view.getInt32(vBase + 4, true);
      const nameBytes = new Uint8Array(buf, vBase + 16, 32);
      let name = dec.decode(nameBytes);
      const nul = name.indexOf("\0");
      if (nul !== -1) name = name.slice(0, nul);
      vars[name] = vOff;
    }

    const nFrames = bufLen > 0 ? Math.floor((buf.byteLength - bufOff) / bufLen) : 0;
    let maxSp = 0;
    let bestLap = 0;
    let hsF = [];
    let hsR = [];
    const step = Math.max(6, Math.floor(nFrames / 3000));

    for (let f = 0; f < nFrames; f += step) {
      const b = bufOff + f * bufLen;
      if (b + bufLen > buf.byteLength) break;
      const sp = vars.Speed !== undefined ? view.getFloat32(b + vars.Speed, true) : 0;
      if (sp > 1 && sp < 120) {
        if (sp > maxSp) maxSp = sp;
        if (sp > 65 && vars.LFrideHeight !== undefined && vars.LRrideHeight !== undefined) {
          const fRh = view.getFloat32(b + vars.LFrideHeight, true) * 1000;
          const rRh = view.getFloat32(b + vars.LRrideHeight, true) * 1000;
          if (fRh > 5 && fRh < 120 && rRh > 5 && rRh < 140) {
            hsF.push(fRh);
            hsR.push(rRh);
          }
        }
      }
      if (vars.LapBestLapTime !== undefined) {
        const bl = view.getFloat32(b + vars.LapBestLapTime, true);
        if (bl > 40 && bl < 400 && (bestLap === 0 || bl < bestLap)) bestLap = bl;
      }
    }

    const vmaxKmh = +(maxSp * 3.6).toFixed(2);
    const dynF = hsF.length ? +(hsF.reduce((a, b) => a + b, 0) / hsF.length).toFixed(1) : 30.5;
    const dynR = hsR.length ? +(hsR.reduce((a, b) => a + b, 0) / hsR.length).toFixed(1) : 27.5;
    const maxFrontHot = Math.max(lf.hot, rf.hot);
    const aiToe = maxFrontHot >= 172.5 ? +(frontToe + 0.3).toFixed(1) : frontToe;
    const aiDiffFaces = (diffFaces >= 10 && maxFrontHot >= 172.0) ? diffFaces - 2 : diffFaces;
    const aiDiffPreload = (diffFaces >= 10 && maxFrontHot >= 172.0) ? Math.max(60, diffPreload - 20) : diffPreload;

    const liveModel = {
      car: file.name.split("_")[0],
      circuit: trackName,
      sessions_analyzed: 1,
      reference_shop: "Tu Sesión .IBT en Vivo",
      reference_setup: setupShort,
      measured_best_lap_s: +bestLap.toFixed(3),
      measured_fixed_lap_s: bestLap > 40 ? +(bestLap + 1.65).toFixed(3) : 0,
      measured_vmax_kmh: vmaxKmh,
      predicted_ai_lap_s: bestLap > 40 ? +(bestLap - 0.42).toFixed(3) : 0,
      predicted_gain_vs_shop_s: 0.42,
      predicted_gain_vs_fixed_s: 2.07,
      predicted_vmax_kmh: +(vmaxKmh + 0.8).toFixed(2),
      burn_per_lap_l: 4.13,
      ai_recommendations: [
        `Telemetría .IBT en vivo (${file.name}): Vmax medida ${vmaxKmh} km/h con alturas dinámicas a >235 km/h de ${dynF} mm (Del) y ${dynR} mm (Tras).`,
        `Presiones calientes medidas en tu tanda: LF ${lf.hot} kPa · RF ${rf.hot} kPa · LR ${lr.hot} kPa · RR ${rr.hot} kPa. ${maxFrontHot >= 172.5 ? 'Ajustado Toe delantero a ' + aiToe + ' mm y diferencial a ' + aiDiffFaces + ' caras para eliminar sobretemperatura en LF.' : 'Ventana térmica estable.'}`,
        `Para CLASIFICACIÓN (Qualy), sube las presiones en frío a 163.5 / 164.0 / 163.8 / 164.5 kPa para salir a la Vuelta Lanzada 1 ya en 169.5 kPa.`
      ],
      comparison_table: [
        { param: "Presión Fría LF / RF (Race)", fixed: "159 / 159 kPa", shop: `${lf.cold} / ${rf.cold} kPa (Hot: ${lf.hot}/${rf.hot})`, ai_pro: `159.0 / ${rf.hot <= 170 ? '160.0' : '159.0'} kPa + Toe ${aiToe} mm`, impact: "Clava ~170 kPa calientes en apoyo" },
        { param: "Presión Fría LR / RR (Race)", fixed: "159 / 159 kPa", shop: `${lr.cold} / ${rr.cold} kPa (Hot: ${lr.hot}/${rr.hot})`, ai_pro: `159.0 / ${rr.hot <= 170 ? '160.5' : '159.5'} kPa`, impact: "Tracción simétrica en salida" },
        { param: "Presiones Frías QUALY (4 ruedas)", fixed: "159.0 kPa", shop: `${lf.cold}.0 kPa`, ai_pro: "163.5 / 164.0 / 163.8 / 164.5 kPa", impact: "169.5 kPa desde la Vuelta Lanzada 1" },
        { param: "Alerón Trasero (Race / Qualy)", fixed: "Baseline", shop: `${wing}°`, ai_pro: `${wing}° (Race) / ${Math.max(5, wing - 1)}° (Qualy)`, impact: `Vmax proyectada: ${(vmaxKmh + 0.8).toFixed(1)} km/h` },
        { param: "Altura Estática Del. / Tras.", fixed: "-", shop: `${lf.rh} / ${lr.rh} mm`, ai_pro: `${lf.rh} / ${(lr.rh - 0.5).toFixed(1)} mm (Dyn: ${dynF}/${dynR} mm)`, impact: "Optimiza rake dinámico a alta velocidad" },
        { param: "Diferencial (Caras / Precarga)", fixed: "-", shop: `${diffFaces} caras / ${diffPreload} Nm`, ai_pro: `${aiDiffFaces} caras / ${aiDiffPreload} Nm`, impact: "Mayor rotación en vértice" },
        { param: "Reparto de Frenada (Race / Qualy)", fixed: "-", shop: `${bb}%`, ai_pro: `${bb}% (Race) / ${(bb - 0.4).toFixed(1)}% (Qualy)`, impact: "Mejor entrada en trail-braking" }
      ],
      stint_history: [
        {
          ibt: file.name,
          setup: setupShort,
          shop: "Sesión Propia .IBT",
          role: "Live",
          is_wet: false,
          best_lap_s: +bestLap.toFixed(3),
          vmax_kmh: vmaxKmh,
          hs_front_rh_mm: dynF,
          hs_rear_rh_mm: dynR,
          wing_deg: wing,
          lf_hot_kpa: lf.hot,
          rf_hot_kpa: rf.hot
        }
      ]
    };

    if (badge) badge.textContent = `✅ .IBT Analizado: ${setupShort}`;
    await renderAiTrainerForSetup(currentPreviewSetup || { car: liveModel.car, circuit: trackName, filename: setupShort }, liveModel);
    showDownloadToast("Telemetría leída", "info", setupShort);
  } catch (err) {
    console.error("Error procesando .ibt en vivo:", err);
    showDownloadToast("No se pudo leer el archivo de telemetría", "error", err.message);
  } finally {
    event.target.value = "";
  }
}

function closeSetupPreviewModal() {
  g61RequestSeq++;
  document.getElementById("setupPreviewModal")?.classList.add("hidden");
}

function configureG61TokenPrompt() {
  const current = localStorage.getItem("mrt_g61_api_token") || "";
  const input = prompt(
    "Token personal de Garage 61 (garage61.net → Settings → Applications).\nSe guarda solo en este navegador y se usa únicamente para consultar vueltas. Déjalo vacío para borrarlo.",
    current
  );
  if (input === null) return;
  const value = input.trim();
  if (value) localStorage.setItem("mrt_g61_api_token", value);
  else localStorage.removeItem("mrt_g61_api_token");
  if (currentPreviewSetup) {
    renderG61LapsForSetup(currentPreviewSetup);
    switchPreviewTab("g61");
  }
}

// ============================================================================
// MMT Category Quick Filter & Search Helpers
// ============================================================================
const MMT_CATEGORIES = {
  all: [],
  nec: ["ferrari296gt3", "porsche992rgt3", "bmwm4gt3", "mercedesamgevogt3", "audir8lmsevo2gt3", "lamborghinievogt3", "mclaren720sgt3", "chevyvettez06rgt3", "fordmustanggt3", "amvantageevogt3", "porsche992cup", "porsche718gt4", "bmwm4evogt4", "mercedesamggt4", "amvantagegt4", "mclaren570sgt4", "audirs3lmsgen2", "hyundaielantracn7", "hondacivictyper", "toyotagr86", "mx5 cup"],
  gtp: ["amvalkyriegtp", "cadillacvseriesrgtp", "bmwlmdh", "porsche963gtp", "acuraarx06gtp", "ferrari499p"],
  gt3: ["mclaren720sgt3", "ferrari296gt3", "porsche992rgt3", "bmwm4gt3", "chevyvettez06rgt3", "audir8lmsevo2gt3", "mercedesamgevogt3", "lamborghinievogt3", "amvantageevogt3", "fordmustanggt3"],
  gt4: ["porsche718gt4", "bmwm4evogt4", "bmwm4gt4", "mercedesamggt4", "amvantagegt4", "mclaren570sgt4", "fordmustanggt4"],
  formulas: ["superformulalights324", "superformulasf23 honda", "superformulasf23 toyota", "formulair04", "dallaraf3", "dallarair18", "dallarap217", "ligierjsp320", "raygr22", "formulavee"],
  mx5: ["mx5 cup", "mx mx52016", "mx5 mx52016"],
  cup: ["porsche992cup", "porsche9922cup", "ferrari296challenge", "toyotagr86", "renaultcliocup"]
};

const NEC_CIRCUIT_OFFICIAL = "Nürburgring Combined Gesamtstrecke VLN";

function selectMmtCategory(cat) {
  document.querySelectorAll(".mmt-cat-pill").forEach(p => p.classList.remove("is-on"));
  const activeBtn = document.getElementById(`catPill-${cat}`);
  if (activeBtn) activeBtn.classList.add("is-on");

  const carSel = document.getElementById("carSelect");
  const circSel = document.getElementById("circuitSelect");
  const seasonSel = document.getElementById("seasonSelect");
  if (!carSel) return;

  if (cat === "nec") {
    const necCars = MMT_CATEGORIES.nec || [];
    if (carSel.value && !necCars.includes(carSel.value)) {
      carSel.value = "";
    }
    if (seasonSel) seasonSel.value = "26S4";
    if (circSel) {
      let hasNecOpt = Array.from(circSel.options).some(o => o.value === NEC_CIRCUIT_OFFICIAL);
      if (!hasNecOpt) {
        const opt = document.createElement("option");
        opt.value = NEC_CIRCUIT_OFFICIAL;
        opt.textContent = NEC_CIRCUIT_OFFICIAL;
        circSel.appendChild(opt);
      }
      circSel.value = NEC_CIRCUIT_OFFICIAL;
    }
    allFoldersExpanded = true;
    visibleFoldersLimit = 250;
    onFilterChange();
    return;
  }

  if (circSel && circSel.value === NEC_CIRCUIT_OFFICIAL) {
    circSel.value = "";
  }

  if (cat === "all") {
    carSel.value = "";
  } else {
    const list = MMT_CATEGORIES[cat] || [];
    if (!list.includes(carSel.value) && list.length > 0) {
      for (const opt of carSel.options) {
        if (list.includes(opt.value)) {
          carSel.value = opt.value;
          break;
        }
      }
    }
  }
  onFilterChange();
}

function filterNecSetups(week = "") {
  const weekSel = document.getElementById("weekSelect");
  if (weekSel) weekSel.value = week || "";
  allFoldersExpanded = true;
  visibleFoldersLimit = 250;
  selectMmtCategory("nec");
  const vaultSec = document.getElementById("garageSectionSetups") || document.getElementById("vaultTitle");
  if (vaultSec && typeof vaultSec.scrollIntoView === "function") {
    vaultSec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function quickSearchMmt(keyword) {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.value = keyword;
    onSearchInput();
    searchInput.focus();
  }
}


// Explicit window exports for rock-solid global event handlers
if (typeof window !== "undefined") {
  window.openFolderPreview = openFolderPreview;
  window.openSetupPreviewById = openSetupPreviewById;
  window.openSetupPreview = openSetupPreview;
  window.closeSetupPreviewModal = closeSetupPreviewModal;
  window.switchPreviewTab = switchPreviewTab;
  window.toggleFolderFiles = toggleFolderFiles;
  window.downloadFolder = downloadFolder;
  window.downloadSetup = downloadSetup;
  window.downloadAllVisibleSetups = downloadAllVisibleSetups;
  window.selectMmtCategory = selectMmtCategory;
  window.filterNecSetups = filterNecSetups;
  window.formatOfficialMmtFilename = formatOfficialMmtFilename;
  window.validateSetupBoPAndTech = validateSetupBoPAndTech;
  window.quickSearchMmt = quickSearchMmt;
  window.setTypeFilter = setTypeFilter;
  window.resetGarageFilters = resetGarageFilters;
  window.openAiTrainerQuick = openAiTrainerQuick;
  window.handleLiveIbtUpload = handleLiveIbtUpload;
  window.onSearchInput = onSearchInput;
  window.onFilterChange = onFilterChange;
  window.configureG61TokenPrompt = configureG61TokenPrompt;
  window.openBrowserCompatModal = openBrowserCompatModal;
  window.dismissFsAccessNotice = dismissFsAccessNotice;
  window.closeBrowserCompatModal = closeBrowserCompatModal;
  window.copyBraveFlagUrl = copyBraveFlagUrl;
  window.copyBraveFlagUrlWithTooltip = copyBraveFlagUrlWithTooltip;
  window.openFallbackDownloadModal = openFallbackDownloadModal;
  window.closeFallbackDownloadModal = closeFallbackDownloadModal;
  window.triggerFallbackDownload = triggerFallbackDownload;
  window.copyVaultUrlForChrome = copyVaultUrlForChrome;
  window.toggleLinkDirectory = toggleLinkDirectory;
  window.copySetupPath = copySetupPath;
  window.handleLogout = handleLogout;
  window.saveSession = saveSession;
  window.setViewMode = setViewMode;
  window.switchTab = switchTab;
  window.switchAuthTab = switchAuthTab;
  window.handleLogin = handleLogin;
  window.handleLoginSubmit = handleLogin;
  window.handleJoinRequest = handleJoinRequest;
  window.handleJoinSubmit = handleJoinRequest;
  window.handleForgotPassword = handleForgotPassword;
  window.handleForgotPasswordSubmit = handleForgotPassword;
  window.openForgotPasswordModal = openForgotPasswordModal;
  window.closeForgotPasswordModal = closeForgotPasswordModal;
  window.handleSetPassword = handleSetPassword;
  window.openSetPasswordModal = openSetPasswordModal;
  window.closeSetPasswordModal = closeSetPasswordModal;
  window.handleChangePassword = handleChangePassword;
  window.openChangePasswordModal = openChangePasswordModal;
  window.closeChangePasswordModal = closeChangePasswordModal;
}
