import {
  CAR_CATEGORY_ORDER,
  CAR_PROFILES,
  DRIVER_PROFILES,
  SKIN_PRESETS,
  cloneZones,
  createInitialDesign,
  getCarById,
  getDriverById,
} from "./catalog";
import {
  renderPatternThumbnail,
  renderSkinToCanvas,
  renderSpecMapToCanvas,
  sampleSurroundingPaintColor,
  setImportedBaseSkin,
  setKitCarMandatoryCanvas,
  type ReservedGuideBox,
} from "./compositor";
import { renderShowroomCarView, type ShowroomAngle } from "./car-showroom-view";
import { BRAND_DECALS, SERIES_DECALS, TEAM_DECALS, type LibraryDecalItem } from "./decals-library";
import {
  MMT_TEAM_PRESETS,
  QUICK_SLOT_ASSETS,
  SLOT_DECAL_PREFIX,
  TEAM_SLOT_META,
  TEAM_SLOT_ORDER,
  buildDecalsForSlot,
  deleteFleetPreset,
  extractCurrentSlotsFromDecals,
  getSlotAssetById,
  loadSavedFleetPresets,
  makeSlotDecalId,
  resolveTeamLayoutForCar,
  saveFleetPreset,
  type PortableTeamPreset,
  type SlotAssignment,
  type TeamSlotId,
} from "./team-presets";
import { buildChampionshipKitLayers, getCarSeriesProfile } from "./series-kits";
import { DEFAULT_STAMPS } from "./stamps-library";
import {
  exportDirectToIracingFolder,
  exportIracingZipBundle,
  exportPresetJson,
  exportSingleCustomNumberTga,
  exportSingleDiffusePng,
  exportSingleDiffuseTga,
  exportSingleSpecPng,
  exportSingleSpecTga,
  sanitizeCustomerId,
} from "./exporter";
import { buildDefaultPhotoGuide, contrastRatio } from "./photo-guide";
import { getRealLiveriesForCar, type RealLiveryPreset } from "./real-liveries";
import { WebGLPreviewEngine, mapCategoryStringToBody, type LightingPreset, type UvMappingMode } from "./preview-3d";
import { deleteCarModel, loadCarModel, saveCarModel } from "../model-store";
import { getLocalUvMap } from "./uv-maps-loader";
import { analyzeTemplateZones, loadTemplateFile, type LoadedTemplate } from "./template-analyzer";
import { getArchetypeZones, lazyLoadCarUv, saveLocalCalibration } from "./uv-archetypes";
import carsIndexData from "../../data/cars-index.json";
import {
  SkinsApiError,
  clearVaultSession,
  fetchWorkerAiAssist,
  fetchWorkerCars,
  fetchWorkerUvMap,
  getCachedVaultUserLabel,
  getVaultToken,
  loginWithVaultCredentials,
  mapWorkerPhotoGuideToShots,
  mapWorkerUvToZones,
  setVaultToken,
  type WorkerUvResponse,
} from "./vault-client";
import type {
  DecalLayer,
  FinishType,
  NumberPlateMode,
  PatternStyle,
  PhotoGuideShot,
  ResolutionMode,
  SkinDesignState,
  SurfaceTexture,
  ZoneKey,
} from "./types";

const STATE_STORAGE_KEY = "mmt-skins-active-design-v2";
const LIBRARY_STORAGE_KEY = "mmt-skins-saved-presets-v1";

type ViewMode = "showroom" | "uv" | "3d" | "spec";
type RightTab = "design" | "decals" | "finish" | "team" | "export" | "gemini";

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function finishDefaults(finish: FinishType): { metallic: number; roughness: number; clearcoat: number; carbonAccent: boolean } {
  switch (finish) {
    case "gloss":
      return { metallic: 12, roughness: 14, clearcoat: 92, carbonAccent: false };
    case "satin":
      return { metallic: 26, roughness: 36, clearcoat: 70, carbonAccent: false };
    case "matte":
      return { metallic: 8, roughness: 82, clearcoat: 15, carbonAccent: false };
    case "metallic":
      return { metallic: 74, roughness: 24, clearcoat: 88, carbonAccent: false };
    case "chrome":
      return { metallic: 96, roughness: 10, clearcoat: 98, carbonAccent: false };
    case "carbon":
      return { metallic: 42, roughness: 48, clearcoat: 55, carbonAccent: true };
  }
}

export function initSkinsStudio(): void {
  const root = byId<HTMLElement>("mmtSkinsStudio");
  if (!root) return;

  let state: SkinDesignState = loadActiveDesign();
  let viewMode: ViewMode = "uv";
  let showroomAngle: ShowroomAngle = "side";
  let rightTab: RightTab = "design";
  let loadedTemplate: LoadedTemplate | null = null;
  let workerWireframeCanvas: HTMLCanvasElement | null = null;
  let kitWireframeCanvas: HTMLCanvasElement | null = null;
  let kitWireframeSlug = "";
  let workerSponsorBlocks: Array<{ id: string; cx: number; cy: number; nw: number; nh: number }> = [];
  let workerRestrictedPlates: ReservedGuideBox[] = [];
  let workerSeriesSlots: ReservedGuideBox[] = [];
  let workerCarsCatalog: Array<{ car_slug: string; name: string; brand: string; category?: string; iracing_folder: string; uv_status: string }> = [];
  let showTemplateOverlay = true;
  let templateOpacity = 0.96;
  let showZonesOverlay = true;
  let selectedZone: ZoneKey | null = "hood";
  let selectedDecalId: string | null = state.decals[0]?.id ?? null;
  let customPhotoShots: PhotoGuideShot[] | null = null;
  let vaultAuthenticated = false;

  const authGate = byId<HTMLElement>("skAuthGate");
  const authErrorBox = byId<HTMLElement>("skAuthError");
  const authTokenInput = byId<HTMLInputElement>("skAuthTokenInput");
  const studioShell = byId<HTMLElement>("skStudioShell");

  function lockStudio(reason: string): void {
    vaultAuthenticated = false;
    authGate?.classList.remove("sk-hidden");
    studioShell?.classList.add("sk-hidden");
    if (authErrorBox) authErrorBox.textContent = reason;
  }

  function unlockStudio(): void {
    vaultAuthenticated = true;
    authGate?.classList.add("sk-hidden");
    studioShell?.classList.remove("sk-hidden");
    const tk = getVaultToken();
    if (tk) setVaultToken(tk);
    const pill = byId<HTMLElement>("skSessionUserPill");
    const userLabel = getCachedVaultUserLabel();
    if (pill) pill.textContent = userLabel ? `${userLabel} ✓` : "Piloto MMT ✓";
    if (Object.keys(officialKits).length === 0) {
      void fetchOfficialKitsAuthenticated();
    }
  }

  function renderSvgStringToCanvas(svgMarkup: string): Promise<HTMLCanvasElement | null> {
    if (!svgMarkup || !svgMarkup.trim().startsWith("<svg")) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = 1024;
        c.height = 1024;
        const ctx = c.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, 1024, 1024);
        resolve(c);
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
    });
  }

  const CURATED_MODERN_ROSTER: Array<{
    car_slug: string;
    name: string;
    brand: string;
    category: string;
    iracing_folder: string;
    uv_status: string;
  }> = [
    // GT3 Actuales iRacing (11)
    { car_slug: "porsche992rgt3", name: "Porsche 911 GT3 R (992)", brand: "Porsche", category: "GT3", iracing_folder: "porsche992rgt3", uv_status: "extracted" },
    { car_slug: "ferrari296gt3", name: "Ferrari 296 GT3", brand: "Ferrari", category: "GT3", iracing_folder: "ferrari296gt3", uv_status: "extracted" },
    { car_slug: "bmwm4gt3", name: "BMW M4 GT3 EVO", brand: "BMW", category: "GT3", iracing_folder: "bmwm4gt3", uv_status: "extracted" },
    { car_slug: "mercedesamgevogt3", name: "Mercedes-AMG GT3 2020", brand: "Mercedes-AMG", category: "GT3", iracing_folder: "mercedesamgevogt3", uv_status: "extracted" },
    { car_slug: "lamborghinievogt3", name: "Lamborghini Huracán GT3 EVO", brand: "Lamborghini", category: "GT3", iracing_folder: "lamborghinievogt3", uv_status: "extracted" },
    { car_slug: "mclaren720sgt3", name: "McLaren 720S GT3 EVO", brand: "McLaren", category: "GT3", iracing_folder: "mclaren720sgt3", uv_status: "extracted" },
    { car_slug: "fordmustanggt3", name: "Ford Mustang GT3", brand: "Ford", category: "GT3", iracing_folder: "fordmustanggt3", uv_status: "extracted" },
    { car_slug: "chevyvettez06rgt3", name: "Chevrolet Corvette Z06 GT3.R", brand: "Chevrolet", category: "GT3", iracing_folder: "chevyvettez06rgt3", uv_status: "extracted" },
    { car_slug: "audir8lmsevo2gt3", name: "Audi R8 LMS EVO II GT3", brand: "Audi", category: "GT3", iracing_folder: "audir8lmsevo2gt3", uv_status: "extracted" },
    { car_slug: "amvantageevogt3", name: "Aston Martin Vantage GT3 EVO", brand: "Aston Martin", category: "GT3", iracing_folder: "amvantageevogt3", uv_status: "extracted" },
    { car_slug: "acuransxevo22gt3", name: "Acura NSX GT3 EVO 22", brand: "Acura", category: "GT3", iracing_folder: "acuransxevo22gt3", uv_status: "extracted" },
    // GTP / Hypercar Actuales iRacing (6)
    { car_slug: "porsche963gtp", name: "Porsche 963 GTP", brand: "Porsche", category: "GTP / Hypercar", iracing_folder: "porsche963gtp", uv_status: "extracted" },
    { car_slug: "ferrari499p", name: "Ferrari 499P", brand: "Ferrari", category: "GTP / Hypercar", iracing_folder: "ferrari499p", uv_status: "extracted" },
    { car_slug: "bmwlmdh", name: "BMW M Hybrid V8", brand: "BMW", category: "GTP / Hypercar", iracing_folder: "bmwlmdh", uv_status: "extracted" },
    { car_slug: "cadillacvseriesrgtp", name: "Cadillac V-Series.R GTP", brand: "Cadillac", category: "GTP / Hypercar", iracing_folder: "cadillacvseriesrgtp", uv_status: "extracted" },
    { car_slug: "acuraarx06gtp", name: "Acura ARX-06 GTP", brand: "Acura", category: "GTP / Hypercar", iracing_folder: "acuraarx06gtp", uv_status: "extracted" },
    { car_slug: "amvalkyriegtp", name: "Aston Martin Valkyrie GTP", brand: "Aston Martin", category: "GTP / Hypercar", iracing_folder: "amvalkyriegtp", uv_status: "extracted" },
    // LMP2 / LMP3 (2)
    { car_slug: "dallarap217", name: "Dallara P217 LMP2", brand: "Dallara", category: "LMP2 / LMP3", iracing_folder: "dallarap217", uv_status: "extracted" },
    { car_slug: "ligierjsp320", name: "Ligier JS P320 LMP3", brand: "Ligier", category: "LMP2 / LMP3", iracing_folder: "ligierjsp320", uv_status: "extracted" },
    // GT4 & Cup Actuales (8)
    { car_slug: "porsche992cup", name: "Porsche 911 GT3 Cup (992)", brand: "Porsche", category: "GT4 & Cup", iracing_folder: "porsche992cup", uv_status: "extracted" },
    { car_slug: "ferrari296challenge", name: "Ferrari 296 Challenge", brand: "Ferrari", category: "GT4 & Cup", iracing_folder: "ferrari296challenge", uv_status: "extracted" },
    { car_slug: "bmwm4g82gt4", name: "BMW M4 G82 GT4 EVO", brand: "BMW", category: "GT4 & Cup", iracing_folder: "bmwm4g82gt4", uv_status: "extracted" },
    { car_slug: "porsche718gt4", name: "Porsche 718 Cayman GT4", brand: "Porsche", category: "GT4 & Cup", iracing_folder: "porsche718gt4", uv_status: "extracted" },
    { car_slug: "mercedesamggt4", name: "Mercedes-AMG GT4", brand: "Mercedes-AMG", category: "GT4 & Cup", iracing_folder: "mercedesamggt4", uv_status: "extracted" },
    { car_slug: "amvantagegt4", name: "Aston Martin Vantage GT4", brand: "Aston Martin", category: "GT4 & Cup", iracing_folder: "amvantagegt4", uv_status: "extracted" },
    { car_slug: "mclaren570sgt4", name: "McLaren 570S GT4", brand: "McLaren", category: "GT4 & Cup", iracing_folder: "mclaren570sgt4", uv_status: "extracted" },
    { car_slug: "fordmustanggt4", name: "Ford Mustang GT4", brand: "Ford", category: "GT4 & Cup", iracing_folder: "fordmustanggt4", uv_status: "extracted" },
    // Fórmula Actuales (6)
    { car_slug: "formulair04", name: "FIA F4 (iR-04)", brand: "FIA", category: "Fórmula", iracing_folder: "formulair04", uv_status: "extracted" },
    { car_slug: "superformulalights324", name: "Super Formula Lights 324", brand: "Dallara", category: "Fórmula", iracing_folder: "superformulalights324", uv_status: "extracted" },
    { car_slug: "superformulasf23", name: "Super Formula SF23", brand: "Dallara", category: "Fórmula", iracing_folder: "superformulasf23", uv_status: "extracted" },
    { car_slug: "dallaraf3", name: "Dallara F3", brand: "Dallara", category: "Fórmula", iracing_folder: "dallaraf3", uv_status: "extracted" },
    { car_slug: "raygr22", name: "Ray FF1600", brand: "Ray", category: "Fórmula", iracing_folder: "raygr22", uv_status: "extracted" },
    { car_slug: "formulavee", name: "Formula Vee", brand: "Formula Vee", category: "Fórmula", iracing_folder: "formulavee", uv_status: "extracted" },
    // TCR & Producción Actuales (6)
    { car_slug: "mx5", name: "Global Mazda MX-5 Cup", brand: "Mazda", category: "TCR & Producción", iracing_folder: "mx5", uv_status: "extracted" },
    { car_slug: "toyotagr86", name: "Toyota GR86", brand: "Toyota", category: "TCR & Producción", iracing_folder: "toyotagr86", uv_status: "extracted" },
    { car_slug: "bmwm2g87", name: "BMW M2 CS Racing (G87)", brand: "BMW", category: "TCR & Producción", iracing_folder: "bmwm2g87", uv_status: "extracted" },
    { car_slug: "hyundaielantrantc", name: "Hyundai Elantra N TCR", brand: "Hyundai", category: "TCR & Producción", iracing_folder: "hyundaielantrantc", uv_status: "extracted" },
    { car_slug: "audirs3lmsgen2", name: "Audi RS 3 LMS Gen 2 TCR", brand: "Audi", category: "TCR & Producción", iracing_folder: "audirs3lmsgen2", uv_status: "extracted" },
    { car_slug: "hondacivictyper", name: "Honda Civic Type R TCR", brand: "Honda", category: "TCR & Producción", iracing_folder: "hondacivictyper", uv_status: "extracted" },
  ];

  function populateCarSelectorFromWorker(): void {
    const sel = byId<HTMLSelectElement>("skCarSelect");
    if (!sel) return;
    const order = [
      "GT3",
      "GTP / Hypercar",
      "LMP2 / LMP3",
      "GT4 & Cup",
      "Fórmula",
      "TCR & Producción",
      "NASCAR / Oval",
      "Piloto (Casco y Mono)",
    ];
    const searchQ = (byId<HTMLInputElement>("skCarSearch")?.value || "").trim().toLowerCase();
    const mergedMap = new Map<
      string,
      { car_slug: string; name: string; brand: string; category: string; iracing_folder: string; uv_status: string }
    >();
    // Always start with the clean, zero-duplicate curated roster of the 39 current most-used iRacing cars
    for (const c of CURATED_MODERN_ROSTER) {
      mergedMap.set(c.car_slug, c);
    }
    // Only include legacy/extra cars from cars-index/worker when the user actively searches for them
    if (searchQ.length >= 2) {
      for (const c of (carsIndexData?.cars || []) as Array<{
        car_slug: string;
        name: string;
        brand?: string;
        category?: string;
        uv_status?: string;
      }>) {
        if (!mergedMap.has(c.car_slug)) {
          mergedMap.set(c.car_slug, {
            car_slug: c.car_slug,
            name: c.name,
            brand: c.brand || "iRacing",
            category: c.category || "TCR & Producción",
            iracing_folder: c.car_slug,
            uv_status: c.uv_status || "archetype",
          });
        }
      }
      for (const w of workerCarsCatalog) {
        if (!mergedMap.has(w.car_slug)) {
          mergedMap.set(w.car_slug, {
            ...w,
            category: w.category || "TCR & Producción",
          });
        }
      }
    }
    const items = Array.from(mergedMap.values()).filter((item) => {
      if (!searchQ) return true;
      return `${item.name} ${item.car_slug} ${item.brand} ${item.category}`.toLowerCase().includes(searchQ);
    });

    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const cat =
        item.car_slug === "helmet" || item.car_slug === "suit"
          ? "Piloto (Casco y Mono)"
          : item.category || "TCR / Turismo / Dirt";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }

    const orderedCats = [...order.filter((c) => groups.has(c)), ...Array.from(groups.keys()).filter((c) => !order.includes(c))];
    sel.innerHTML = orderedCats
      .map((cat) => {
        const list = (groups.get(cat) || []).slice().sort((a, b) => a.name.localeCompare(b.name));
        const opts = list
          .map((c) => `<option value="${escapeHtml(c.car_slug)}">${escapeHtml(c.name)}${c.uv_status === "extracted" ? " ✓" : ""}</option>`)
          .join("");
        return `<optgroup label="${escapeHtml(cat)} (${list.length})">${opts}</optgroup>`;
      })
      .join("");
    if (items.some((i) => i.car_slug === state.carId)) {
      sel.value = state.carId;
    }
  }

  function applyUvResponseToState(carSlug: string, uv: WorkerUvResponse): void {
    const car = getCarById(carSlug);
    state.zones = mapWorkerUvToZones(uv, car.defaultZones);
    const rawZones = uv.zones as Record<string, unknown>;
    const rawSponsors = Array.isArray(rawZones?.sponsor_blocks) ? rawZones.sponsor_blocks : [];
    workerSponsorBlocks = rawSponsors.map((b: Record<string, unknown>, i: number) => {
      if (typeof b.cx === "number" && typeof b.cy === "number") {
        return { id: String(b.id || `sp_${i}`), cx: b.cx, cy: b.cy, nw: Number(b.nw || 0.12), nh: Number(b.nh || 0.08) };
      }
      const x = Number(b.x || 0);
      const y = Number(b.y || 0);
      const w = Number(b.width || b.w || 160);
      const h = Number(b.height || b.h || 100);
      const nw = w > 1 ? w / 2048 : w;
      const nh = h > 1 ? h / 2048 : h;
      const nx = x > 1 ? x / 2048 : x;
      const ny = y > 1 ? y / 2048 : y;
      return { id: String(b.id || `sp_${i}`), cx: nx + nw * 0.5, cy: ny + nh * 0.5, nw, nh };
    });
    const rawPlates = Array.isArray(uv.restricted_number_plates) ? uv.restricted_number_plates : [];
    workerRestrictedPlates = rawPlates.map((p, i) => ({
      x: (p.x > 1 ? p.x / 2048 : p.x),
      y: (p.y > 1 ? p.y / 2048 : p.y),
      w: (p.width > 1 ? p.width / 2048 : p.width),
      h: (p.height > 1 ? p.height / 2048 : p.height),
      label: p.label || `DORSAL #${i + 1} (iRacing)`,
    }));

    // Coordenadas verificadas para Acura NSX GT3 EVO 22 (placas IMSA/GTD + dorsales oficiales)
    if (carSlug === "acuransxevo22gt3" && workerRestrictedPlates.length === 0) {
      workerRestrictedPlates = [
        { x: 0.325, y: 0.31, w: 0.075, h: 0.095, label: "DORSAL IZQ. (iRacing)" },
        { x: 0.295, y: 0.59, w: 0.06, h: 0.09, label: "DORSAL CAPÓ (iRacing)" },
        { x: 0.325, y: 0.87, w: 0.075, h: 0.095, label: "DORSAL DER. (iRacing)" },
      ];
      workerSeriesSlots = [
        { x: 0.23, y: 0.165, w: 0.09, h: 0.04, label: "SERIE / IMSA FRONTAL" },
        { x: 0.625, y: 0.33, w: 0.075, h: 0.045, label: "CATEGORÍA / GTD IZQ." },
        { x: 0.625, y: 0.855, w: 0.075, h: 0.045, label: "CATEGORÍA / GTD DER." },
      ];
    } else {
      workerSeriesSlots = workerSponsorBlocks.slice(0, 4).map((b, i) => ({
        x: Math.max(0.01, b.cx - b.nw / 2),
        y: Math.max(0.01, b.cy - b.nh / 2),
        w: b.nw,
        h: b.nh,
        label: i === 0 ? "SERIE / SPONSOR PRINCIPAL" : `DECAL SERIE / CATEGORÍA #${i + 1}`,
      }));
    }
  }

  async function restoreSaved3dModelForCar(carSlug: string): Promise<void> {
    const car = getCarById(carSlug);
    const indexed = (carsIndexData?.cars || []).find((c) => c.car_slug === carSlug);
    const effectiveCategory = indexed?.category || car.category;
    try {
      const saved = await loadCarModel(carSlug);
      if (state.carId !== carSlug) return;
      if (saved && saved.buffer.byteLength > 0) {
        await glEngine.loadGltfBuffer(saved.buffer, saved.filename, true);
        glEngine.updateZones(state.zones);
        scheduleRender();
        return;
      }
    } catch {
      // IndexedDB unavailable or corrupted entry; fall back to clean parametric bodywork
    }
    if (state.carId !== carSlug) return;
    await glEngine.tryLoadCategoryBaseModel(mapCategoryStringToBody(effectiveCategory), carSlug);
    glEngine.updateZones(state.zones);
    scheduleRender();
  }

  function resolveCarMeta(carSlug: string): { name: string; category: string; iracingFolder: string } {
    const fallback = getCarById(carSlug);
    const indexed = (carsIndexData?.cars || []).find((c) => c.car_slug.toLowerCase() === carSlug.toLowerCase());
    const fromWorker = workerCarsCatalog.find((c) => c.car_slug.toLowerCase() === carSlug.toLowerCase());
    return {
      name: fromWorker?.name || indexed?.name || (fallback.id === carSlug ? fallback.name : carSlug),
      category: fromWorker?.category || indexed?.category || fallback.category,
      iracingFolder: fromWorker?.iracing_folder || carSlug,
    };
  }

  async function syncCarUvFromWorker(carSlug: string): Promise<void> {
    const meta = resolveCarMeta(carSlug);
    const infoEl = byId<HTMLElement>("skTemplateSummary");
    const notesEl = byId<HTMLElement>("skCarNotes");

    // 1. Always resolve immediately from localStorage / bundled src/data/uv-maps/ / clean category archetype
    const localUv = getLocalUvMap(carSlug);
    if (localUv) {
      applyUvResponseToState(carSlug, localUv);
      if (infoEl) {
        infoEl.textContent = `Plantilla UV limpia cargada automáticamente (${localUv.car_name} · ${localUv.native_resolution}). Cambia colores, patrón y sponsors encima.`;
      }
      if (notesEl) {
        notesEl.textContent = `Carpeta iRacing: paint/${localUv.iracing_folder}/ · Mapa UV calibrado local ✓`;
      }
      renderZoneList();
      glEngine.setCategory(mapCategoryStringToBody(meta.category));
      glEngine.updateZones(state.zones);
      scheduleRender();
      setStatus(`Plantilla UV lista (${localUv.car_name})`, "ok");
    } else {
      const resolved = await lazyLoadCarUv(carSlug, meta.category);
      if (state.carId !== carSlug) return;
      state.zones = resolved.zones;
      workerWireframeCanvas = null;
      workerSponsorBlocks = [];
      workerRestrictedPlates = [];
      workerSeriesSlots = [];
      const archLabels: Record<string, string> = {
        open_wheel: "Fórmula / Open-Wheel",
        gt3_gt4: "GT3 / GT4",
        prototype_gtp: "GTP / Prototipo",
        stock_nascar: "Oval / Stock Car",
        tcr_touring: "Touring / Producción",
      };
      const archLabel = archLabels[resolved.archetype] || resolved.archetype;
      if (infoEl) {
        infoEl.textContent = `Plantilla UV limpia cargada automáticamente (${meta.name} · Arquetipo ${archLabel} · ${state.resolution}×${state.resolution}). Cambia colores, patrón y sponsors encima.`;
      }
      if (notesEl) {
        notesEl.textContent = `Carpeta iRacing: paint/${meta.iracingFolder}/ · Arquetipo ${archLabel} listo ✓`;
      }
      renderZoneList();
      glEngine.setCategory(mapCategoryStringToBody(meta.category));
      glEngine.updateZones(state.zones);
      scheduleRender();
      setStatus(`Plantilla UV lista (${meta.name})`, "ok");
    }

    // 2. Optionally enrich with Worker wireframe SVG & official plates if available in D1 (never overwrite calibrated horizontal localUv zones!)
    if (!vaultAuthenticated) return;
    try {
      const uv = await fetchWorkerUvMap(carSlug);
      if (state.carId !== carSlug) return;
      if (localUv) {
        // Keep our pixel-calibrated horizontal localUv zones; only take wireframe SVG & official plates from Worker
        const rawPlates = Array.isArray(uv.restricted_number_plates) ? uv.restricted_number_plates : [];
        if (rawPlates.length > 0) {
          workerRestrictedPlates = rawPlates.map((p, i) => ({
            x: p.x > 1 ? p.x / 2048 : p.x,
            y: p.y > 1 ? p.y / 2048 : p.y,
            w: p.width > 1 ? p.width / 2048 : p.width,
            h: p.height > 1 ? p.height / 2048 : p.height,
            label: p.label || `DORSAL #${i + 1} (iRacing)`,
          }));
        }
      } else {
        // Only take Worker plates/wireframe; preserve horizontal archetype zones so boxes never revert to vertical
        const rawPlates = Array.isArray(uv.restricted_number_plates) ? uv.restricted_number_plates : [];
        if (rawPlates.length > 0) {
          workerRestrictedPlates = rawPlates.map((p, i) => ({
            x: p.x > 1 ? p.x / 2048 : p.x,
            y: p.y > 1 ? p.y / 2048 : p.y,
            w: p.width > 1 ? p.width / 2048 : p.width,
            h: p.height > 1 ? p.height / 2048 : p.height,
            label: p.label || `DORSAL #${i + 1} (iRacing)`,
          }));
        }
      }
      workerWireframeCanvas = await renderSvgStringToCanvas(uv.wireframe_svg || "");
      if (infoEl) {
        infoEl.textContent = `Plantilla UV limpia cargada automáticamente (${uv.car_name} · ${uv.native_resolution}). Cambia colores, patrón y sponsors encima.`;
      }
      if (notesEl) {
        notesEl.textContent = `Carpeta iRacing: paint/${uv.iracing_folder}/ · Zonas horizontales iRacing calibradas ✓`;
      }
      renderZoneList();
      glEngine.setCategory(mapCategoryStringToBody(meta.category));
      glEngine.updateZones(state.zones);
      scheduleRender();
      setStatus(`Plantilla UV lista (${uv.car_name})`, "ok");
    } catch (err) {
      if (err instanceof SkinsApiError && err.status === 401) {
        lockStudio(err.message);
        return;
      }
      // Keep the clean local UV map / archetype active without showing a red error
      setStatus(`Plantilla UV lista (${localUv?.car_name || meta.name})`, "ok");
    }
  }

  async function verifyVaultSession(): Promise<void> {
    const currentTk = getVaultToken();
    if (!currentTk) {
      lockStudio("Acceso restringido a pilotos autorizados de muntru.me. Inicia sesión para abrir el estudio.");
      return;
    }
    if (authErrorBox) authErrorBox.textContent = "Verificando tu sesión activa de muntru.me...";
    try {
      const cars = await fetchWorkerCars();
      workerCarsCatalog = cars;
      unlockStudio();
      populateCarSelectorFromWorker();
      syncControlsFromState();
      renderSavedLibrary();
      updateViewModeUI();
      updateRightTabUI();
      setStatus(`Sesión Vault verificada · ${cars.length} plantillas UV disponibles`, "ok");
      await syncCarUvFromWorker(state.carId);
      void restoreSaved3dModelForCar(state.carId);
    } catch (err) {
      if (err instanceof SkinsApiError) {
        lockStudio(err.message);
      } else {
        lockStudio(err instanceof Error ? err.message : "Error desconocido verificando sesión de muntru.me.");
      }
    }
  }

  if (authTokenInput) authTokenInput.value = getVaultToken();
  byId<HTMLButtonElement>("skAuthVerifyBtn")?.addEventListener("click", async () => {
    const val = authTokenInput?.value.trim() || "";
    if (val) setVaultToken(val);
    await verifyVaultSession();
  });

  // Inline synchronized login form on skins.muntru.me
  const inlineLoginForm = byId<HTMLFormElement>("skInlineLoginForm");
  inlineLoginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailEl = byId<HTMLInputElement>("skLoginEmail");
    const passEl = byId<HTMLInputElement>("skLoginPass");
    const btn = byId<HTMLButtonElement>("skInlineLoginBtn");
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";
    if (!email || !password) return;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Verificando acceso...";
    }
    if (authErrorBox) authErrorBox.textContent = "Iniciando sesión en muntru.me...";
    try {
      await loginWithVaultCredentials(email, password);
      if (passEl) passEl.value = "";
      await verifyVaultSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Credenciales no válidas.";
      if (authErrorBox) authErrorBox.textContent = msg;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Entrar al Estudio →";
      }
    }
  });

  // Synchronized logout (clears localStorage + .muntru.me SSO cookie)
  byId<HTMLButtonElement>("skLogoutBtn")?.addEventListener("click", () => {
    clearVaultSession();
    lockStudio("Sesión cerrada correctamente. Vuelve a iniciar sesión para abrir el estudio.");
  });

  // Cross-tab & SSO auto-sync: if user logs in/out on muntru.me in another tab, sync automatically
  window.addEventListener("storage", (ev) => {
    if (ev.key === "mrt_vault_token" || ev.key === "mm_token") {
      if (!ev.newValue) {
        lockStudio("Tu sesión de muntru.me se cerró en otra pestaña.");
      } else if (!vaultAuthenticated) {
        void verifyVaultSession();
      }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !vaultAuthenticated && getVaultToken()) {
      void verifyVaultSession();
    }
  });

  // UV Pan/Zoom state
  let uvZoom = 1;
  let uvPanX = 0;
  let uvPanY = 0;

  const showroomCanvas = byId<HTMLCanvasElement>("skShowroomCanvas")!;
  const uvCanvas = byId<HTMLCanvasElement>("skUvCanvas")!;
  const glCanvas = byId<HTMLCanvasElement>("skGlCanvas")!;
  const offscreenTexture = document.createElement("canvas");
  offscreenTexture.width = 2048;
  offscreenTexture.height = 2048;

  const glEngine = new WebGLPreviewEngine(glCanvas);
  const statusPill = byId<HTMLElement>("skStatusPill");

  function setStatus(msg: string, tone: "neutral" | "ok" | "err" = "neutral"): void {
    if (!statusPill) return;
    statusPill.textContent = msg;
    statusPill.classList.remove("is-ok", "is-err");
    if (tone === "ok") statusPill.classList.add("is-ok");
    if (tone === "err") statusPill.classList.add("is-err");
  }

  function persistState(): void {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }

  function loadActiveDesign(): SkinDesignState {
    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SkinDesignState;
        if (parsed && parsed.carId && parsed.palette && parsed.zones) {
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh design
    }
    return createInitialDesign();
  }

  function loadSavedLibrary(): SkinDesignState[] {
    try {
      const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as SkinDesignState[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveToLibrary(design: SkinDesignState): void {
    const lib = loadSavedLibrary();
    const copy: SkinDesignState = JSON.parse(JSON.stringify(design));
    copy.updatedAt = new Date().toISOString();
    const existingIdx = lib.findIndex((item) => item.name === copy.name);
    if (existingIdx >= 0) lib[existingIdx] = copy;
    else lib.unshift(copy);
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(lib.slice(0, 16)));
    } catch {
      // Ignore quota
    }
    renderSavedLibrary();
  }

  function getActivePsdPatternCanvas(): HTMLCanvasElement | null {
    if (!state.psdPatternName || !loadedTemplate?.carPatterns?.length) return null;
    return loadedTemplate.carPatterns.find((p) => p.name === state.psdPatternName)?.canvas ?? null;
  }

  let renderPending = false;
  function scheduleRender(): void {
    persistState();
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(async () => {
      renderPending = false;
      try {
        const psdPatCanvas = getActivePsdPatternCanvas();
        if (viewMode === "showroom") {
          await renderShowroomCarView(showroomCanvas, state, showroomAngle);
        } else if (viewMode === "uv") {
          const uvRenderSize = state.resolution === 4096 ? 2048 : 1536;
          await renderSkinToCanvas(uvCanvas, state, {
            size: uvRenderSize,
            templateCanvas: loadedTemplate?.wireframeCanvas ?? loadedTemplate?.canvas ?? kitWireframeCanvas ?? workerWireframeCanvas,
            partsOverlayCanvas: loadedTemplate?.partsOverlayCanvas ?? null,
            psdPatternCanvas: psdPatCanvas,
            restrictedPlates: workerRestrictedPlates,
            seriesSlots: workerSeriesSlots,
            showTemplateOverlay,
            templateOpacity,
            showZonesOverlay,
            selectedZone,
            selectedDecalId,
            forExport: false,
          });
          applyUvTransform();
        } else if (viewMode === "spec") {
          renderSpecMapToCanvas(uvCanvas, state, 1024);
          applyUvTransform();
        } else if (viewMode === "3d") {
          const glTexSize = state.resolution === 4096 ? 4096 : 2048;
          await renderSkinToCanvas(offscreenTexture, state, {
            size: glTexSize,
            partsOverlayCanvas: null,
            psdPatternCanvas: psdPatCanvas,
            forExport: true,
            for3dPreview: true,
          });
          const offscreenSpec = document.createElement("canvas");
          offscreenSpec.width = 1024;
          offscreenSpec.height = 1024;
          renderSpecMapToCanvas(offscreenSpec, state, 1024);
          glEngine.updateTexture(
            offscreenTexture,
            state.spec.metallic,
            state.spec.roughness,
            offscreenSpec,
            state.spec.clearcoat,
            state.spec.carbonAccent || state.spec.finish === "carbon",
          );
          const notice = byId<HTMLElement>("skGlNotice");
          if (notice) notice.textContent = glEngine.getMeshLabel();
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Error al renderizar lienzo", "err");
      }
    });
  }

  function applyUvTransform(): void {
    const wrap = byId<HTMLElement>("skCanvasWrap");
    if (!wrap) return;
    const minSide = Math.max(320, Math.min(wrap.clientWidth - 36, wrap.clientHeight - 36));
    uvCanvas.style.width = `${Math.round(minSide * uvZoom)}px`;
    uvCanvas.style.height = `${Math.round(minSide * uvZoom)}px`;
    uvCanvas.style.transform = `translate(${Math.round(uvPanX)}px, ${Math.round(uvPanY)}px)`;
    const zoomLabel = byId<HTMLElement>("skZoomLabel");
    if (zoomLabel) zoomLabel.textContent = `${Math.round(uvZoom * 100)}%`;
  }

  function updateViewModeUI(): void {
    document.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.viewMode === viewMode);
    });
    const isShowroom = viewMode === "showroom";
    const isGl = viewMode === "3d";
    const isUvOrSpec = viewMode === "uv" || viewMode === "spec";
    showroomCanvas.classList.toggle("sk-hidden", !isShowroom);
    uvCanvas.classList.toggle("sk-hidden", !isUvOrSpec);
    glCanvas.classList.toggle("sk-hidden", !isGl);
    byId<HTMLElement>("skShowroomControls")?.classList.toggle("sk-hidden", !isShowroom);
    byId<HTMLElement>("skGlOverlay")?.classList.toggle("sk-hidden", !isGl);
    byId<HTMLElement>("skUvControls")?.classList.toggle("sk-hidden", !isUvOrSpec);
    if (isGl) {
      requestAnimationFrame(() => glEngine.render());
    }
    scheduleRender();
  }

  function updateRightTabUI(): void {
    document.querySelectorAll<HTMLButtonElement>("[data-right-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.rightTab === rightTab);
    });
    (["design", "decals", "finish", "team", "export", "gemini"] as RightTab[]).forEach((t) => {
      byId<HTMLElement>(`skTab-${t}`)?.classList.toggle("sk-hidden", rightTab !== t);
    });
    if (rightTab === "export") {
      renderPhotoGuide();
      updateExportValidation();
    }
  }

  function syncControlsFromState(): void {
    const carSel = byId<HTMLSelectElement>("skCarSelect");
    if (carSel) carSel.value = state.carId;
    const car = getCarById(state.carId);
    const carNotes = byId<HTMLElement>("skCarNotes");
    if (carNotes) carNotes.textContent = `${car.notes} · Carpeta iRacing: paint/${car.iracingFolder}/`;

    const drvSel = byId<HTMLSelectElement>("skDriverSelect");
    if (drvSel) drvSel.value = state.driverId;
    const numIn = byId<HTMLInputElement>("skDriverNumber");
    if (numIn) numIn.value = state.customNumber;
    const cidIn = byId<HTMLInputElement>("skCustomerId");
    if (cidIn) cidIn.value = state.customerId;
    const drvNameIn = byId<HTMLInputElement>("skDriverName");
    if (drvNameIn) drvNameIn.value = state.customDriverName;
    const nameIn = byId<HTMLInputElement>("skDesignName");
    if (nameIn) nameIn.value = state.name;

    const activeNumMode: NumberPlateMode = state.numberMode || "sim-stamped";
    document.querySelectorAll<HTMLButtonElement>("[data-number-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.numberMode === activeNumMode);
    });
    const numModeHelp = byId<HTMLElement>("skNumberModeHelp");
    if (numModeHelp) {
      numModeHelp.textContent =
        activeNumMode === "custom-number"
          ? `Estampa el dorsal #${state.customNumber || "16"} en placas laterales, techo y capó (car_num_${sanitizeCustomerId(state.customerId)}.tga) + base limpia car_${sanitizeCustomerId(state.customerId)}.tga.`
          : "Protege las placas laterales reglamentarias (zona reservada por iRacing) para que el número oficial nunca se solape.";
    }

    const setVal = (id: string, val: string) => {
      const el = byId<HTMLInputElement | HTMLSelectElement>(id);
      if (el) el.value = val;
    };
    setVal("skColorPrimary", state.palette.primary);
    setVal("skColorSecondary", state.palette.secondary);
    setVal("skColorAccent", state.palette.accent);
    setVal("skColorDetail", state.palette.detail);
    setVal("skColorNum", state.palette.numberColor);
    setVal("skColorNumBg", state.palette.numberBg);
    setVal("skPatternSelect", state.pattern);
    setVal("skSurfaceTexture", state.surfaceTexture || "none");
    setVal("skFontSelect", state.fontStyle);
    setVal("skFinishSelect", state.spec.finish);
    setVal("skSpecMetallic", String(state.spec.metallic));
    setVal("skSpecRoughness", String(state.spec.roughness));
    setVal("skSpecClearcoat", String(state.spec.clearcoat));

    const showNum = byId<HTMLInputElement>("skShowNumber");
    if (showNum) showNum.checked = state.showNumberOnCar;
    const carbonChk = byId<HTMLInputElement>("skCarbonWeave");
    if (carbonChk) carbonChk.checked = state.spec.carbonAccent;

    document.querySelectorAll<HTMLButtonElement>("[data-res-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.resMode) === state.resolution);
    });

    renderPatternGallery();
    renderPsdPatternSelector();
    renderZoneList();
    renderDecalList();
    renderDecalEditor();
    renderPhotoGuide();
    updateExportValidation();
  }

  const GALLERY_PATTERNS: Array<{ id: PatternStyle; label: string }> = [
    { id: "solid-factory", label: "Fábrica" },
    { id: "pearl-shift", label: "Perlado" },
    { id: "carbon-exposed", label: "Carbono 2×2" },
    { id: "forged-carbon", label: "Forjado" },
    { id: "stealth-camo", label: "Proto Camo" },
    { id: "hex-stealth", label: "Hex Tonal" },
    { id: "topo-flow", label: "Topo Flow" },
    { id: "halftone-pro", label: "Halftone" },
    { id: "brushed-metal", label: "Titanio" },
    { id: "racing-stripes", label: "Franjas GT" },
    { id: "tricolor-works", label: "Tricolor" },
    { id: "checkered-flag", label: "Cuadros GT" },
    { id: "apex-shards", label: "Apex Shards" },
    { id: "speed-gradient", label: "Aero Fade" },
    { id: "grid-circuit", label: "Circuito" },
    { id: "martini-heritage", label: "Martini GT" },
    { id: "gulf-classic", label: "Gulf Le Mans" },
    { id: "jps-pinstripe", label: "JPS Gold" },
    { id: "dazzle-test", label: "Dazzle Test" },
    { id: "chevron-works", label: "Chevron Pro" },
    { id: "endurance-split", label: "24H Split" },
  ];

  function renderPatternGallery(): void {
    const host = byId<HTMLElement>("skPatternGallery");
    if (!host) return;
    if (host.childElementCount === 0) {
      host.innerHTML = GALLERY_PATTERNS.map(
        (p) =>
          `<button type="button" class="sk-pattern-card" data-gallery-pattern="${p.id}" title="${escapeHtml(p.label)}"><canvas width="80" height="48"></canvas><span>${escapeHtml(p.label)}</span></button>`,
      ).join("");
      host.querySelectorAll<HTMLButtonElement>("[data-gallery-pattern]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const pat = btn.dataset.galleryPattern as PatternStyle;
          if (!pat) return;
          state.pattern = pat;
          state.psdPatternName = null;
          const sel = byId<HTMLSelectElement>("skPatternSelect");
          if (sel) sel.value = pat;
          renderPatternGallery();
          renderPsdPatternSelector();
          scheduleRender();
          setStatus(`Patrón aplicado: ${btn.title}`, "ok");
        });
      });
    }
    const usingPsdPattern = Boolean(getActivePsdPatternCanvas());
    host.querySelectorAll<HTMLButtonElement>("[data-gallery-pattern]").forEach((btn) => {
      const pat = btn.dataset.galleryPattern as PatternStyle;
      btn.classList.toggle("is-active", !usingPsdPattern && state.pattern === pat);
      const c = btn.querySelector("canvas");
      if (c) renderPatternThumbnail(c, pat, state.palette, state.surfaceTexture);
    });
  }

  function renderPsdPatternSelector(): void {
    const box = byId<HTMLElement>("skPsdPatternsBox");
    const sel = byId<HTMLSelectElement>("skPsdPatternSelect");
    if (!box || !sel) return;
    const patterns = loadedTemplate?.carPatterns;
    if (!patterns || patterns.length === 0) {
      box.classList.add("sk-hidden");
      return;
    }
    box.classList.remove("sk-hidden");
    const opts = [
      `<option value="">— Usar patrones MMT (${state.pattern}) —</option>`,
      ...patterns.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.label)}</option>`),
    ];
    sel.innerHTML = opts.join("");
    sel.value = state.psdPatternName || "";
  }

  const ZONE_DOT_COLORS: Record<ZoneKey, string> = {
    hood: "#38bdf8",
    roof: "#818cf8",
    leftSide: "#10b981",
    rightSide: "#10b981",
    rearWing: "#c084fc",
    frontBumper: "#fb923c",
    rearBumper: "#f472b6",
    mirrors: "#fbbf24",
    numberPlateLeft: "#ef4444",
    numberPlateRight: "#ef4444",
  };

  function syncZonePaintBox(): void {
    const box = byId<HTMLElement>("skZonePaintBox");
    const title = byId<HTMLElement>("skZonePaintTitle");
    const colIn = byId<HTMLInputElement>("skZonePaintColor");
    const finSel = byId<HTMLSelectElement>("skZonePaintFinish");
    const mirrorBtn = byId<HTMLButtonElement>("skZoneMirrorBtn");
    if (!box || !title || !colIn || !finSel) return;

    const zk = selectedZone && !state.zones[selectedZone]?.restricted ? selectedZone : "hood";
    const z = state.zones[zk];
    if (!z) return;
    const ov = state.zoneOverrides?.[zk];
    title.textContent = `Pieza: ${z.label}`;
    colIn.value = ov?.color || state.palette.primary;
    finSel.value = ov?.finish || "";
    if (mirrorBtn) {
      mirrorBtn.classList.toggle("sk-hidden", zk !== "leftSide" && zk !== "rightSide");
    }
  }

  function renderZoneList(): void {
    const host = byId<HTMLElement>("skZoneList");
    if (!host) return;
    host.innerHTML = Object.values(state.zones)
      .map((z) => {
        const active = selectedZone === z.key ? " is-active" : "";
        const rest = z.restricted ? " is-restricted" : "";
        const dotCol = ZONE_DOT_COLORS[z.key] || "#38bdf8";
        const ov = state.zoneOverrides?.[z.key];
        const swatch = ov?.color
          ? `<span style="width:11px;height:11px;border-radius:3px;background:${ov.color};border:1px solid rgba(255,255,255,0.45);display:inline-block;"></span>`
          : "";
        const badge = z.restricted
          ? `<span class="sk-tag sk-tag-warn">Fija</span>`
          : ov?.finish
            ? `<span class="sk-tag sk-tag-ok">${ov.finish}</span>`
            : z.detectedConfidence
              ? `<span class="sk-tag sk-tag-ok">${Math.round(z.detectedConfidence * 100)}%</span>`
              : `<span class="sk-tag">${Math.round(z.w * 100)}×${Math.round(z.h * 100)}</span>`;
        return `<div class="sk-list-item${active}${rest}" data-select-zone="${z.key}"><span style="display:inline-flex;align-items:center;gap:6px;"><i style="width:8px;height:8px;border-radius:99px;background:${dotCol};display:inline-block;flex-shrink:0;"></i>${escapeHtml(z.label)}</span><span style="display:inline-flex;align-items:center;gap:5px;">${swatch}${badge}</span></div>`;
      })
      .join("");

    host.querySelectorAll<HTMLElement>("[data-select-zone]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedZone = el.dataset.selectZone as ZoneKey;
        selectedDecalId = null;
        renderZoneList();
        syncZonePaintBox();
        renderDecalList();
        scheduleRender();
      });
    });
    syncZonePaintBox();
  }

  function renderDecalList(): void {
    const host = byId<HTMLElement>("skDecalList");
    if (!host) return;
    if (state.decals.length === 0) {
      host.innerHTML = `<p class="sk-help">No hay capas activas. Añade un Default Stamp, capa oficial iRacing o logo.</p>`;
      return;
    }
    host.innerHTML = state.decals
      .map((d, idx) => {
        const active = selectedDecalId === d.id ? " is-active" : "";
        const hidden = d.opacity <= 0.001;
        const sym = d.mirrorX ? `<span class="sk-tag sk-tag-ok">L↔R</span>` : `<span class="sk-tag">1×</span>`;
        return `<div class="sk-list-item${active}" data-select-decal="${d.id}" style="gap:6px;${hidden ? "opacity:0.48;" : ""}">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(d.name)}</span>
          <span style="display:inline-flex;align-items:center;gap:3px;flex-shrink:0;">
            ${sym}
            <button type="button" class="sk-btn sk-btn-sm" data-decal-eye="${d.id}" title="${hidden ? "Mostrar capa" : "Ocultar capa"}" style="padding:1px 5px;font-size:11px;">${hidden ? "🙈" : "👁"}</button>
            <button type="button" class="sk-btn sk-btn-sm" data-decal-up="${idx}" title="Subir capa" style="padding:1px 4px;font-size:10px;" ${idx === state.decals.length - 1 ? "disabled" : ""}>▲</button>
            <button type="button" class="sk-btn sk-btn-sm" data-decal-dn="${idx}" title="Bajar capa" style="padding:1px 4px;font-size:10px;" ${idx === 0 ? "disabled" : ""}>▼</button>
          </span>
        </div>`;
      })
      .join("");

    host.querySelectorAll<HTMLElement>("[data-select-decal]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        if ((ev.target as HTMLElement | null)?.closest("button")) return;
        selectedDecalId = el.dataset.selectDecal || null;
        selectedZone = null;
        renderZoneList();
        renderDecalList();
        renderDecalEditor();
        scheduleRender();
      });
    });

    host.querySelectorAll<HTMLButtonElement>("[data-decal-eye]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const d = state.decals.find((item) => item.id === btn.dataset.decalEye);
        if (!d) return;
        d.opacity = d.opacity <= 0.001 ? 1 : 0;
        renderDecalList();
        renderDecalEditor();
        scheduleRender();
      });
    });

    host.querySelectorAll<HTMLButtonElement>("[data-decal-up]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const idx = Number(btn.dataset.decalUp);
        if (idx >= 0 && idx < state.decals.length - 1) {
          const tmp = state.decals[idx];
          state.decals[idx] = state.decals[idx + 1];
          state.decals[idx + 1] = tmp;
          renderDecalList();
          scheduleRender();
        }
      });
    });

    host.querySelectorAll<HTMLButtonElement>("[data-decal-dn]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const idx = Number(btn.dataset.decalDn);
        if (idx > 0 && idx < state.decals.length) {
          const tmp = state.decals[idx];
          state.decals[idx] = state.decals[idx - 1];
          state.decals[idx - 1] = tmp;
          renderDecalList();
          scheduleRender();
        }
      });
    });
  }

  function renderDecalEditor(): void {
    const box = byId<HTMLElement>("skDecalEditor");
    if (!box) return;
    const decal = state.decals.find((d) => d.id === selectedDecalId);
    if (!decal) {
      box.innerHTML = `<p class="sk-help">Selecciona un logo de la lista (o haz clic sobre él en el mapa UV) para ajustar posición, escala, rotación y simetría.</p>`;
      return;
    }

    box.innerHTML = `
      <div class="sk-grid-2">
        <label class="sk-label">X (${Math.round(decal.x * 100)}%)<input id="skDecX" type="range" min="2" max="98" value="${Math.round(decal.x * 100)}" /></label>
        <label class="sk-label">Y (${Math.round(decal.y * 100)}%)<input id="skDecY" type="range" min="2" max="98" value="${Math.round(decal.y * 100)}" /></label>
        <label class="sk-label">Escala (${Math.round(decal.scale * 100)}%)<input id="skDecScale" type="range" min="4" max="55" value="${Math.round(decal.scale * 100)}" /></label>
        <label class="sk-label">Rotación (${Math.round(decal.rotation)}°)<input id="skDecRot" type="range" min="-180" max="180" value="${Math.round(decal.rotation)}" /></label>
      </div>
      <div class="sk-row">
        <label class="sk-color-item" style="flex:1;"><span>Color</span><input id="skDecColor" type="color" value="${decal.color}" /></label>
        <label class="sk-row" style="font-size:11.5px;cursor:pointer;"><input id="skDecMirror" type="checkbox" ${decal.mirrorX ? "checked" : ""} /> Simetría L/R</label>
      </div>
      <div class="sk-row">
        <button type="button" id="skDecDup" class="sk-btn sk-btn-sm" style="flex:1;">Clonar capa</button>
        <button type="button" id="skDecDel" class="sk-btn sk-btn-sm sk-btn-danger" style="flex:1;">Eliminar</button>
      </div>
    `;

    byId<HTMLInputElement>("skDecX")?.addEventListener("input", (e) => {
      decal.x = Number((e.target as HTMLInputElement).value) / 100;
      scheduleRender();
    });
    byId<HTMLInputElement>("skDecY")?.addEventListener("input", (e) => {
      decal.y = Number((e.target as HTMLInputElement).value) / 100;
      scheduleRender();
    });
    byId<HTMLInputElement>("skDecScale")?.addEventListener("input", (e) => {
      decal.scale = Number((e.target as HTMLInputElement).value) / 100;
      scheduleRender();
    });
    byId<HTMLInputElement>("skDecRot")?.addEventListener("input", (e) => {
      decal.rotation = Number((e.target as HTMLInputElement).value);
      scheduleRender();
    });
    byId<HTMLInputElement>("skDecColor")?.addEventListener("input", (e) => {
      decal.color = (e.target as HTMLInputElement).value;
      scheduleRender();
    });
    byId<HTMLInputElement>("skDecMirror")?.addEventListener("change", (e) => {
      decal.mirrorX = (e.target as HTMLInputElement).checked;
      renderDecalList();
      scheduleRender();
    });
    byId<HTMLButtonElement>("skDecDup")?.addEventListener("click", () => {
      const clone: DecalLayer = {
        ...decal,
        id: `decal-${Date.now()}`,
        name: `${decal.name} (copia)`,
        y: Math.min(0.92, decal.y + 0.05),
      };
      state.decals.push(clone);
      selectedDecalId = clone.id;
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
    });
    byId<HTMLButtonElement>("skDecDel")?.addEventListener("click", () => {
      state.decals = state.decals.filter((d) => d.id !== decal.id);
      selectedDecalId = state.decals[0]?.id ?? null;
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
    });
  }

  function renderSavedLibrary(): void {
    const host = byId<HTMLElement>("skSavedLibrary");
    if (!host) return;
    const lib = loadSavedLibrary();
    if (lib.length === 0) {
      host.innerHTML = `<p class="sk-help">Guarda tu diseño actual para reutilizarlo o adaptarlo a otros coches.</p>`;
      return;
    }
    host.innerHTML = lib
      .map(
        (item, idx) => `
        <div class="sk-list-item">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.name)}</span>
          <div class="sk-row">
            <button type="button" class="sk-btn sk-btn-sm" data-load-lib="${idx}">Cargar</button>
            <button type="button" class="sk-btn sk-btn-sm sk-btn-danger" data-del-lib="${idx}">×</button>
          </div>
        </div>`,
      )
      .join("");

    host.querySelectorAll<HTMLButtonElement>("[data-load-lib]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.loadLib);
        const target = lib[idx];
        if (!target) return;
        state = JSON.parse(JSON.stringify(target));
        selectedDecalId = state.decals[0]?.id ?? null;
        customPhotoShots = null;
        syncControlsFromState();
        scheduleRender();
        setStatus(`Diseño cargado: ${state.name}`, "ok");
      });
    });

    host.querySelectorAll<HTMLButtonElement>("[data-del-lib]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.delLib);
        lib.splice(idx, 1);
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(lib));
        renderSavedLibrary();
      });
    });
  }

  function renderPhotoGuide(): void {
    const host = byId<HTMLElement>("skPhotoGuideList");
    if (!host) return;
    const car = getCarById(state.carId);
    const shots = customPhotoShots ?? buildDefaultPhotoGuide(car, state);
    host.innerHTML = shots
      .map(
        (s) => `
        <div class="sk-shot-card">
          <strong>${escapeHtml(s.title)}</strong>
          <div>Archivo: <code>${escapeHtml(s.filename)}</code></div>
          <div><span style="color:var(--sk-muted)">Circuito:</span> ${escapeHtml(s.circuit)}</div>
          <div><span style="color:var(--sk-muted)">Luz/Clima:</span> ${escapeHtml(s.timeAndWeather)}</div>
          <div><span style="color:var(--sk-muted)">Cámara:</span> ${escapeHtml(s.cameraSetup)}</div>
          <ul>${s.checklist.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
        </div>`,
      )
      .join("");
  }

  function updateExportValidation(): void {
    const box = byId<HTMLElement>("skExportValidation");
    const car = getCarById(state.carId);
    const cid = sanitizeCustomerId(state.customerId);
    const isCustomNum = (state.numberMode || "sim-stamped") === "custom-number";

    const diffName = byId<HTMLElement>("skExportDiffuseName");
    if (diffName) diffName.textContent = `car_${cid}.tga`;
    const customNumName = byId<HTMLElement>("skExportCustomNumName");
    if (customNumName) customNumName.textContent = `car_num_${cid}.tga`;
    const specName = byId<HTMLElement>("skExportSpecName");
    if (specName) specName.textContent = `car_spec_${cid}.tga`;

    const customNumCard = byId<HTMLElement>("skExportCustomNumCard");
    if (customNumCard) customNumCard.classList.toggle("sk-hidden", !isCustomNum);

    const zipBtn = byId<HTMLButtonElement>("skExportZipBtn");
    if (zipBtn) {
      zipBtn.textContent = isCustomNum
        ? `Descargar Pack .ZIP (car_${cid} + car_num_${cid} + car_spec_${cid})`
        : `Descargar Pack .ZIP (car_${cid} + car_spec_${cid} + Carpeta iRacing)`;
    }

    const tpGuide = byId<HTMLElement>("skTradingPaintsGuide");
    if (tpGuide) {
      tpGuide.innerHTML = isCustomNum
        ? `
          <strong>Trading Paints · Dónde subir cada archivo (Modo Custom Number)</strong>
          <ul>
            <li>1. <strong>Sim-Stamped Number Paint:</strong> sube <code>car_${escapeHtml(cid)}.tga</code> (base limpia sin solapes).</li>
            <li>2. <strong>Custom Number Paint:</strong> sube <code>car_num_${escapeHtml(cid)}.tga</code> (con dorsal <strong>#${escapeHtml(state.customNumber)}</strong> estampado) y marca <em>"Hide car numbers"</em> en Trading Paints Downloader.</li>
            <li>3. <strong>Add spec map or decal layer:</strong> copia <code>car_spec_${escapeHtml(cid)}.tga</code> en <code>Documents\\iRacing\\paint\\${escapeHtml(car.iracingFolder)}\\</code>, abre el coche en iRacing y sube el <code>car_spec_${escapeHtml(cid)}.mip</code> generado.</li>
          </ul>
        `
        : `
          <strong>Trading Paints · Dónde subir cada archivo (Modo Oficial Sim-Stamped)</strong>
          <ul>
            <li>1. <strong>Sim-Stamped Number Paint:</strong> sube <code>car_${escapeHtml(cid)}.tga</code> en <a href="https://www.tradingpaints.com/my-paints" target="_blank" rel="noopener noreferrer" style="color:var(--sk-accent);">Trading Paints → Upload a paint</a> (placas laterales libres para iRacing).</li>
            <li>2. <strong>Add spec map or decal layer:</strong> copia <code>car_spec_${escapeHtml(cid)}.tga</code> en <code>Documents\\iRacing\\paint\\${escapeHtml(car.iracingFolder)}\\</code>, abre el coche en iRacing para generar <code>car_spec_${escapeHtml(cid)}.mip</code> y sube ese <code>.mip</code>.</li>
          </ul>
        `;
    }

    // Render live export previews so the user sees EXACTLY what Trading Paints will receive
    const diffPrev = byId<HTMLCanvasElement>("skExportDiffusePreview");
    if (diffPrev) {
      void renderSkinToCanvas(diffPrev, state, {
        size: 128,
        partsOverlayCanvas: loadedTemplate?.partsOverlayCanvas ?? null,
        psdPatternCanvas: getActivePsdPatternCanvas(),
        forExport: true,
        numberModeOverride: "sim-stamped",
      });
    }
    const customNumPrev = byId<HTMLCanvasElement>("skExportCustomNumPreview");
    if (customNumPrev && isCustomNum) {
      void renderSkinToCanvas(customNumPrev, state, {
        size: 128,
        partsOverlayCanvas: loadedTemplate?.partsOverlayCanvas ?? null,
        psdPatternCanvas: getActivePsdPatternCanvas(),
        forExport: true,
        numberModeOverride: "custom-number",
      });
    }
    const specPrev = byId<HTMLCanvasElement>("skExportSpecPreview");
    if (specPrev) {
      renderSpecMapToCanvas(specPrev, state, 128);
    }

    if (!box) return;
    const mbEstimate = state.resolution === 4096 ? "~48 MB por TGA (4K)" : "~12 MB por TGA (2K)";
    const cAccent = contrastRatio(state.palette.accent, state.palette.primary);
    const isSolidOnly =
      state.pattern === "freeform" &&
      state.decals.length === 0 &&
      (!state.strokes || state.strokes.length === 0);
    box.innerHTML = `
      <div>Ruta iRacing: <code style="color:var(--sk-accent)">Documents\\iRacing\\paint\\${escapeHtml(car.iracingFolder)}\\</code></div>
      <div>Resolución: <strong>${state.resolution}×${state.resolution}px</strong> (${mbEstimate}) · Contraste: <strong style="color:${cAccent >= 3 ? "#00e699" : "#fbbf24"}">${cAccent}:1</strong></div>
      ${isSolidOnly ? `<div style="margin-top:6px;padding:6px 8px;border-radius:6px;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.4);color:#fcd34d;">Aviso: el lienzo está en color sólido sin patrón ni decals. Elige un patrón en <strong>Diseño</strong> o pulsa <strong>Muntrume AI</strong> para pintar el coche completo antes de subirlo.</div>` : ""}
    `;
  }

  // Interactive UV canvas drag for selected zone / decal / pan / freeform brush
  let brushMode = false;
  let brushColor = "#00e699";
  let brushSize = 0.022;
  let brushMirror = true;
  let activeStroke: { color: string; size: number; mirrorX: boolean; points: Array<{ x: number; y: number }> } | null = null;

  let dragMode: "none" | "pan" | "zone-move" | "zone-resize" | "decal-move" | "decal-resize" | "brush" | "patch" = "none";
  let patchMode = false;
  let activePatchDecal: DecalLayer | null = null;
  let patchStartU = 0;
  let patchStartV = 0;
  let lastPatchCenter: { x: number; y: number } | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let origPanX = 0;
  let origPanY = 0;
  let origRect = { x: 0, y: 0, w: 0, h: 0 };

  function canvasUvCoords(e: PointerEvent): { u: number; v: number } {
    const rect = uvCanvas.getBoundingClientRect();
    return {
      u: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      v: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  uvCanvas.addEventListener("pointerdown", (e) => {
    if (viewMode !== "uv") return;
    const { u, v } = canvasUvCoords(e);
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    origPanX = uvPanX;
    origPanY = uvPanY;

    // 0a. Smart Logo Cover-Up Patch mode (drag a box over an old logo/text to cover it with sampled paint color)
    if (patchMode) {
      patchStartU = u;
      patchStartV = v;
      const sampleColor = sampleSurroundingPaintColor(u, v, 0.05, 0.04, state.palette.primary);
      activePatchDecal = {
        id: `patch-${Date.now()}`,
        name: "Parche tapa-logo",
        kind: "patch",
        color: sampleColor,
        x: u,
        y: v,
        scale: 0.04,
        patchH: 0.03,
        rotation: 0,
        opacity: 1,
        mirrorX: false,
      };
      state.decals.push(activePatchDecal);
      selectedDecalId = activePatchDecal.id;
      dragMode = "patch";
      uvCanvas.setPointerCapture(e.pointerId);
      scheduleRender();
      return;
    }

    // 0. Freeform Brush mode
    if (brushMode) {
      if (!Array.isArray(state.strokes)) state.strokes = [];
      activeStroke = { color: brushColor, size: brushSize, mirrorX: brushMirror, points: [{ x: u, y: v }] };
      state.strokes.push(activeStroke);
      dragMode = "brush";
      uvCanvas.setPointerCapture(e.pointerId);
      scheduleRender();
      return;
    }

    // 1. Check resize handle of selected decal first (so resizing never gets stolen by zone/pan)
    if (selectedDecalId) {
      const selD = state.decals.find((item) => item.id === selectedDecalId);
      if (selD && selD.scale < 0.95) {
        const halfW = selD.scale * 0.5;
        const halfH = Math.max(0.035, selD.scale * 0.35);
        const rad = (selD.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const hx = selD.x + halfW * cos - halfH * sin;
        const hy = selD.y + halfW * sin + halfH * cos;
        if (Math.hypot(u - hx, v - hy) < 0.038) {
          dragMode = "decal-resize" as typeof dragMode;
          origRect = { x: selD.x, y: selD.y, w: selD.scale, h: selD.scale };
          uvCanvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // 1b. Check resize handle of selected zone
    if (showZonesOverlay && selectedZone) {
      const z = state.zones[selectedZone];
      if (Math.hypot(u - (z.x + z.w), v - (z.y + z.h)) < 0.03) {
        dragMode = "zone-resize";
        origRect = { x: z.x, y: z.y, w: z.w, h: z.h };
        uvCanvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Check decal hit (supports rotation, mirrorX copy, and generous clickable box for small logos)
    for (let i = state.decals.length - 1; i >= 0; i--) {
      const d = state.decals[i];
      if (d.scale >= 0.95) continue; // Full-UV official overlay layers stay locked in place
      const halfW = Math.max(0.045, d.scale * 0.55);
      const halfH = Math.max(0.045, d.scale * 0.55);
      const candidates = d.mirrorX
        ? [
            { x: d.x, y: d.y, rot: d.rotation, mirrored: false },
            { x: 1 - d.x, y: d.y, rot: -d.rotation, mirrored: true },
          ]
        : [{ x: d.x, y: d.y, rot: d.rotation, mirrored: false }];
      let hit = false;
      for (const c of candidates) {
        const rad = (-c.rot * Math.PI) / 180;
        const dx = u - c.x;
        const dy = v - c.y;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
        if (Math.abs(lx) <= halfW && Math.abs(ly) <= halfH) {
          hit = true;
          break;
        }
      }
      if (hit) {
        selectedDecalId = d.id;
        selectedZone = null;
        dragMode = "decal-move";
        origRect = { x: d.x, y: d.y, w: d.scale, h: 0 };
        renderZoneList();
        renderDecalList();
        renderDecalEditor();
        uvCanvas.setPointerCapture(e.pointerId);
        scheduleRender();
        return;
      }
    }

    // 3. Check zone hit
    if (showZonesOverlay) {
      for (const z of Object.values(state.zones)) {
        if (u >= z.x && u <= z.x + z.w && v >= z.y && v <= z.y + z.h) {
          selectedZone = z.key;
          selectedDecalId = null;
          dragMode = "zone-move";
          origRect = { x: z.x, y: z.y, w: z.w, h: z.h };
          renderZoneList();
          renderDecalList();
          renderDecalEditor();
          uvCanvas.setPointerCapture(e.pointerId);
          scheduleRender();
          return;
        }
      }
    }

    dragMode = "pan";
    uvCanvas.setPointerCapture(e.pointerId);
  });

  uvCanvas.addEventListener("pointermove", (e) => {
    if (dragMode === "none") return;
    const rect = uvCanvas.getBoundingClientRect();
    const du = (e.clientX - dragStartX) / rect.width;
    const dv = (e.clientY - dragStartY) / rect.height;

    if (dragMode === "patch" && activePatchDecal) {
      const { u, v } = canvasUvCoords(e);
      const pw = Math.max(0.025, Math.abs(u - patchStartU));
      const ph = Math.max(0.02, Math.abs(v - patchStartV));
      activePatchDecal.x = (u + patchStartU) / 2;
      activePatchDecal.y = (v + patchStartV) / 2;
      activePatchDecal.scale = Math.min(0.85, pw);
      activePatchDecal.patchH = Math.min(0.85, ph);
      activePatchDecal.color = sampleSurroundingPaintColor(activePatchDecal.x, activePatchDecal.y, pw, ph, state.palette.primary);
      lastPatchCenter = { x: activePatchDecal.x, y: activePatchDecal.y };
      scheduleRender();
    } else if (dragMode === "brush" && activeStroke) {
      const { u, v } = canvasUvCoords(e);
      activeStroke.points.push({ x: u, y: v });
      scheduleRender();
    } else if (dragMode === "pan") {
      uvPanX = origPanX + (e.clientX - dragStartX);
      uvPanY = origPanY + (e.clientY - dragStartY);
      applyUvTransform();
    } else if (dragMode === "zone-move" && selectedZone) {
      const z = state.zones[selectedZone];
      z.x = Math.max(0, Math.min(1 - z.w, origRect.x + du));
      z.y = Math.max(0, Math.min(1 - z.h, origRect.y + dv));
      scheduleRender();
    } else if (dragMode === "zone-resize" && selectedZone) {
      const z = state.zones[selectedZone];
      z.w = Math.max(0.05, Math.min(1 - z.x, origRect.w + du));
      z.h = Math.max(0.04, Math.min(1 - z.y, origRect.h + dv));
      scheduleRender();
    } else if (dragMode === "decal-move" && selectedDecalId) {
      const d = state.decals.find((item) => item.id === selectedDecalId);
      if (d) {
        d.x = Math.max(0.02, Math.min(0.98, origRect.x + du));
        d.y = Math.max(0.02, Math.min(0.98, origRect.y + dv));
        scheduleRender();
      }
    } else if (dragMode === "decal-resize" && selectedDecalId) {
      const d = state.decals.find((item) => item.id === selectedDecalId);
      if (d) {
        const delta = Math.max(du, dv) * 1.8;
        d.scale = Math.max(0.04, Math.min(0.85, origRect.w + delta));
        scheduleRender();
      }
    }
  });

  // Anti-overlap collision check so logos/decals NEVER stack on top of each other or official iRacing number plates
  function doesDecalCollide(x: number, y: number, scale: number, excludeId?: string): boolean {
    const hw = Math.max(0.028, scale * 0.38);
    const hh = Math.max(0.022, scale * 0.28);
    for (const other of state.decals) {
      if (other.id === excludeId || other.scale >= 0.95 || other.kind === "patch") continue;
      const ohw = Math.max(0.028, other.scale * 0.38);
      const ohh = Math.max(0.022, other.scale * 0.28);
      if (Math.abs(x - other.x) < hw + ohw && Math.abs(y - other.y) < hh + ohh) return true;
    }
    for (const plate of workerRestrictedPlates) {
      const pcx = plate.x + plate.w * 0.5;
      const pcy = plate.y + plate.h * 0.5;
      if (Math.abs(x - pcx) < hw + plate.w * 0.45 && Math.abs(y - pcy) < hh + plate.h * 0.45) return true;
    }
    return false;
  }

  function findFreeDecalSpot(
    baseX: number,
    baseY: number,
    scale: number,
    rect?: { x: number; y: number; w: number; h: number },
    excludeId?: string,
  ): { x: number; y: number; shifted: boolean } {
    if (!doesDecalCollide(baseX, baseY, scale, excludeId)) {
      return { x: Number(baseX.toFixed(3)), y: Number(baseY.toFixed(3)), shifted: false };
    }
    const minX = rect ? rect.x + 0.02 : 0.04;
    const maxX = rect ? rect.x + rect.w - 0.02 : 0.96;
    const minY = rect ? rect.y + 0.02 : 0.04;
    const maxY = rect ? rect.y + rect.h - 0.02 : 0.96;
    const step = Math.max(0.035, scale * 0.45);
    const offsets: Array<[number, number]> = [
      [step, 0], [-step, 0], [0, step], [0, -step],
      [step, step], [-step, step], [step, -step], [-step, -step],
      [step * 2, 0], [-step * 2, 0], [0, step * 2], [0, -step * 2],
    ];
    for (const [dx, dy] of offsets) {
      const cx = Math.max(minX, Math.min(maxX, baseX + dx));
      const cy = Math.max(minY, Math.min(maxY, baseY + dy));
      if (!doesDecalCollide(cx, cy, scale, excludeId)) {
        return { x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)), shifted: true };
      }
    }
    return { x: Number(baseX.toFixed(3)), y: Number(baseY.toFixed(3)), shifted: true };
  }

  const endUvDrag = () => {
    if (dragMode === "zone-move" || dragMode === "zone-resize") renderZoneList();
    if (dragMode === "decal-move" && selectedDecalId) {
      const d = state.decals.find((item) => item.id === selectedDecalId);
      if (d && d.scale < 0.95 && doesDecalCollide(d.x, d.y, d.scale, d.id)) {
        const free = findFreeDecalSpot(d.x, d.y, d.scale, undefined, d.id);
        if (!doesDecalCollide(free.x, free.y, d.scale, d.id)) {
          d.x = free.x;
          d.y = free.y;
        } else {
          d.x = origRect.x;
          d.y = origRect.y;
        }
        scheduleRender();
        setStatus("Anti-solapamiento: no se permite tapar otro logo ni la placa de dorsal.", "neutral");
      }
      renderDecalEditor();
    } else if (dragMode === "decal-resize") {
      renderDecalEditor();
    } else if (dragMode === "patch" && activePatchDecal) {
      activePatchDecal = null;
      patchMode = false;
      const pmBtn = byId<HTMLButtonElement>("skPatchModeBtn");
      if (pmBtn) {
        pmBtn.classList.remove("is-active");
        pmBtn.textContent = "🩹 Tapar logo / texto";
      }
      uvCanvas.style.cursor = "";
      renderDecalList();
      renderDecalEditor();
      setStatus("Parche tapa-logo creado · Ahora puedes colocar un logo o texto nuevo encima (o ajustar su color a la derecha)", "ok");
    }
    activeStroke = null;
    dragMode = "none";
  };
  uvCanvas.addEventListener("pointerup", endUvDrag);
  uvCanvas.addEventListener("pointercancel", endUvDrag);

  // Precision keyboard nudge for selected decal (Arrows + Shift, Delete to remove)
  window.addEventListener("keydown", (e) => {
    if (!selectedDecalId) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const d = state.decals.find((item) => item.id === selectedDecalId);
    if (!d || d.scale >= 0.95) return;
    const step = e.shiftKey ? 0.02 : 0.005;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      d.x = Math.max(0.02, d.x - step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      d.x = Math.min(0.98, d.x + step);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      d.y = Math.max(0.02, d.y - step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      d.y = Math.min(0.98, d.y + step);
    } else if (e.key === "Delete") {
      e.preventDefault();
      state.decals = state.decals.filter((item) => item.id !== d.id);
      selectedDecalId = null;
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
      return;
    } else {
      return;
    }
    renderDecalEditor();
    scheduleRender();
  });

  byId<HTMLElement>("skCanvasWrap")?.addEventListener(
    "wheel",
    (e) => {
      if (viewMode === "3d") return;
      e.preventDefault();
      uvZoom = Math.max(0.5, Math.min(3.0, uvZoom * (e.deltaY < 0 ? 1.1 : 0.91)));
      applyUvTransform();
    },
    { passive: false },
  );

  // Bind Top & Stage Controls
  document.querySelectorAll<HTMLButtonElement>("[data-view-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = (btn.dataset.viewMode as ViewMode) || "showroom";
      updateViewModeUI();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-showroom-angle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showroomAngle = (btn.dataset.showroomAngle as ShowroomAngle) || "side";
      document.querySelectorAll<HTMLButtonElement>("[data-showroom-angle]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.showroomAngle === showroomAngle);
      });
      scheduleRender();
    });
  });

  // 1-Click GT-style sponsor placement onto exact horizontal iRacing car zones (correct rotation for hood/roof/both doors)
  document.querySelectorAll<HTMLButtonElement>("[data-quick-zone]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const zk = btn.dataset.quickZone as ZoneKey;
      const rect = state.zones[zk];
      if (!rect) return;
      const isSide = zk === "leftSide" || zk === "rightSide";
      const now = Date.now();
      if (isSide) {
        // Real iRacing horizontal layout: Left Side (bottom door, 0°) + Right Side (top door, 180° inverted)
        const leftRect = state.zones.leftSide;
        const rightRect = state.zones.rightSide;
        const sideScale = Number(Math.min(0.24, Math.max(0.11, leftRect.w * 0.42)).toFixed(3));
        const posL = findFreeDecalSpot(leftRect.x + leftRect.w * 0.56, leftRect.y + leftRect.h * 0.52, sideScale, leftRect);
        const posR = findFreeDecalSpot(rightRect.x + rightRect.w * 0.56, rightRect.y + rightRect.h * 0.48, sideScale, rightRect);
        const leftLayer: DecalLayer = {
          id: `decal-q-l-${now}`,
          name: `MUNTRUME (${leftRect.label})`,
          kind: "builtin",
          assetId: "mmt-wordmark",
          color: "#ffffff",
          x: posL.x,
          y: posL.y,
          scale: sideScale,
          rotation: 0,
          opacity: 1,
          mirrorX: false,
          zoneHint: "leftSide",
        };
        const rightLayer: DecalLayer = {
          id: `decal-q-r-${now + 1}`,
          name: `MUNTRUME (${rightRect.label})`,
          kind: "builtin",
          assetId: "mmt-wordmark",
          color: "#ffffff",
          x: posR.x,
          y: posR.y,
          scale: sideScale,
          rotation: 180,
          opacity: 1,
          mirrorX: false,
          zoneHint: "rightSide",
        };
        state.decals.push(leftLayer, rightLayer);
        selectedDecalId = leftLayer.id;
      } else {
        const isTopPanel = zk === "hood" || zk === "roof" || zk === "rearBumper";
        const isWebZone = zk === "rearWing" || zk === "frontBumper" || zk === "rearBumper";
        const sc = Number(Math.min(0.24, Math.max(0.08, Math.min(rect.w, rect.h) * 0.62)).toFixed(3));
        const spot = findFreeDecalSpot(rect.x + rect.w * 0.5, rect.y + rect.h * 0.5, sc, rect);
        const layer: DecalLayer = {
          id: `decal-q-${now}`,
          name: `${isWebZone ? "MUNTRU.ME" : "MUNTRUME"} (${rect.label})`,
          kind: "builtin",
          assetId: zk === "hood" || zk === "mirrors" ? "mmt-crest" : isWebZone ? "muntru-url" : "mmt-wordmark",
          color: zk === "rearWing" ? "#090b0f" : "#ffffff",
          x: spot.x,
          y: spot.y,
          scale: sc,
          rotation: isTopPanel ? 90 : 0,
          opacity: 1,
          mirrorX: false,
          zoneHint: zk,
        };
        state.decals.push(layer);
        selectedDecalId = layer.id;
      }
      rightTab = "decals";
      if (zk === "hood" || zk === "roof") showroomAngle = "top";
      else if (zk === "rearWing" || zk === "rearBumper") showroomAngle = "rear";
      else if (zk === "frontBumper") showroomAngle = "front";
      else showroomAngle = "side";
      document.querySelectorAll<HTMLButtonElement>("[data-showroom-angle]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.showroomAngle === showroomAngle);
      });
      updateRightTabUI();
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
      setStatus(`Colocado en ${rect.label} sin solapamientos${isSide ? " (0° izq. y 180° der.)" : ""}.`, "ok");
    });
  });

  // 1-Click Complete Muntrume Team + Website Kit (zero overlaps across all key zones)
  byId<HTMLButtonElement>("skApplyTeamKitBtn")?.addEventListener("click", () => {
    const now = Date.now();
    const z = state.zones;
    const addSafe = (
      name: string,
      assetId: DecalLayer["assetId"],
      color: string,
      rect: { x: number; y: number; w: number; h: number },
      rx: number,
      ry: number,
      scale: number,
      rotation: number,
      zoneHint: ZoneKey,
    ) => {
      const spot = findFreeDecalSpot(rect.x + rect.w * rx, rect.y + rect.h * ry, scale, rect);
      if (doesDecalCollide(spot.x, spot.y, scale)) return;
      state.decals.push({
        id: `kit-${zoneHint}-${now}-${Math.floor(Math.random() * 999)}`,
        name,
        kind: "builtin",
        assetId,
        color,
        x: spot.x,
        y: spot.y,
        scale,
        rotation,
        opacity: 1,
        mirrorX: false,
        zoneHint,
      });
    };
    addSafe("Escudo MMT (Capó)", "mmt-crest", "#ffffff", z.hood, 0.5, 0.5, 0.14, 90, "hood");
    addSafe("MUNTRUME (Lateral Izq.)", "mmt-wordmark", "#ffffff", z.leftSide, 0.58, 0.52, 0.20, 0, "leftSide");
    addSafe("MUNTRUME (Lateral Der.)", "mmt-wordmark", "#ffffff", z.rightSide, 0.58, 0.48, 0.20, 180, "rightSide");
    addSafe("MUNTRU.ME (Alerón)", "muntru-url", "#ffffff", z.rearWing, 0.5, 0.5, 0.18, 0, "rearWing");
    addSafe("MUNTRU.ME (Frontal)", "muntru-url", "#ffffff", z.frontBumper, 0.5, 0.5, 0.14, 0, "frontBumper");
    addSafe("MUNTRU.ME (Trasera)", "muntru-url", "#ffffff", z.rearBumper, 0.5, 0.5, 0.12, 90, "rearBumper");
    selectedDecalId = state.decals[state.decals.length - 1]?.id ?? null;
    renderDecalList();
    renderDecalEditor();
    scheduleRender();
    setStatus("★ Kit completo MUNTRUME + MUNTRU.ME aplicado sin solapamientos en capó, puertas, alerón y parachoques.", "ok");
  });

  document.querySelectorAll<HTMLButtonElement>("[data-right-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      rightTab = (btn.dataset.rightTab as RightTab) || "design";
      updateRightTabUI();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-res-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.resolution = (Number(btn.dataset.resMode) === 4096 ? 4096 : 2048) as ResolutionMode;
      syncControlsFromState();
      setStatus(
        state.resolution === 4096
          ? "Modo 4096×4096px activado (exportación Ultra HD — usa más memoria al exportar)"
          : "Modo estándar 2048×2048px (rápido y óptimo para iRacing)",
        "ok",
      );
    });
  });

  byId<HTMLButtonElement>("skZoomIn")?.addEventListener("click", () => {
    uvZoom = Math.min(3.0, uvZoom + 0.2);
    applyUvTransform();
  });
  byId<HTMLButtonElement>("skZoomOut")?.addEventListener("click", () => {
    uvZoom = Math.max(0.5, uvZoom - 0.2);
    applyUvTransform();
  });
  byId<HTMLButtonElement>("skZoomReset")?.addEventListener("click", () => {
    uvZoom = 1;
    uvPanX = 0;
    uvPanY = 0;
    applyUvTransform();
  });

  byId<HTMLInputElement>("skToggleZones")?.addEventListener("change", (e) => {
    showZonesOverlay = (e.target as HTMLInputElement).checked;
    scheduleRender();
  });
  byId<HTMLInputElement>("skToggleWireframe")?.addEventListener("change", (e) => {
    showTemplateOverlay = (e.target as HTMLInputElement).checked;
    scheduleRender();
  });
  byId<HTMLInputElement>("skWireOpacity")?.addEventListener("input", (e) => {
    templateOpacity = Number((e.target as HTMLInputElement).value) / 100;
    scheduleRender();
  });

  // 3D camera presets, lighting presets, UV mapping mode & local .GLB/.GLTF/.OBJ loader (with IndexedDB persistence)
  document.querySelectorAll<HTMLButtonElement>("[data-gl-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      glEngine.setCameraPreset(btn.dataset.glCam as "front34" | "side" | "rear34" | "top");
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-gl-light]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = (btn.dataset.glLight || "noon") as LightingPreset;
      glEngine.setLightingPreset(preset);
      document.querySelectorAll<HTMLButtonElement>("[data-gl-light]").forEach((b) =>
        b.classList.toggle("is-active", b === btn),
      );
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-gl-uv]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = (btn.dataset.glUv === "native" ? "native" : "autofit") as UvMappingMode;
      glEngine.setUvMappingMode(mode);
      document.querySelectorAll<HTMLButtonElement>("[data-gl-uv]").forEach((b) =>
        b.classList.toggle("is-active", b === btn),
      );
      setStatus(
        mode === "autofit"
          ? "Proyección 3D: Auto-Fit Zonas iRacing (capó, techo, laterales, paragolpes y alerón calibrados)."
          : "Proyección 3D: UV Nativo del modelo .GLB.",
        "ok",
      );
    });
  });
  byId<HTMLSelectElement>("skGlModelSelect")?.addEventListener("change", async (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val === "auto") {
      await restoreSaved3dModelForCar(state.carId);
      setStatus("Modelo 3D sincronizado automáticamente con el coche seleccionado.", "ok");
      return;
    }
    setStatus("Cargando modelo 3D seleccionado...");
    const ok = await glEngine.loadGlbFromUrl(val);
    if (ok) {
      glEngine.updateZones(state.zones);
      scheduleRender();
      setStatus(`Modelo 3D cargado: ${(e.target as HTMLSelectElement).selectedOptions[0]?.textContent || val}`, "ok");
    } else {
      setStatus("No se pudo cargar ese modelo 3D. Intenta recargar con Ctrl+F5.", "err");
    }
  });
  byId<HTMLInputElement>("skObjInput")?.addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
        await glEngine.loadGltfFile(file);
        glEngine.updateZones(state.zones);
        try {
          await saveCarModel(state.carId, file);
        } catch {
          // Non-fatal if IndexedDB quota is full
        }
        viewMode = "3d";
        updateViewModeUI();
        scheduleRender();
        setStatus(`Modelo 3D guardado en caché local (${state.carId}): ${file.name} · Auto-cargará al volver.`, "ok");
      } else {
        const text = await file.text();
        glEngine.loadObjMesh(text, file.name);
        glEngine.updateZones(state.zones);
        viewMode = "3d";
        updateViewModeUI();
        scheduleRender();
        setStatus(`Modelo .OBJ local cargado: ${file.name} (solo en tu navegador)`, "ok");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error cargando modelo 3D (.GLB / .GLTF / .OBJ)", "err");
    } finally {
      input.value = "";
    }
  });
  byId<HTMLButtonElement>("skGlResetMesh")?.addEventListener("click", async () => {
    try {
      await deleteCarModel(state.carId);
    } catch {
      // Ignore IndexedDB error
    }
    const car = getCarById(state.carId);
    glEngine.resetToProofingBuck();
    glEngine.setCategory(mapCategoryStringToBody(car.category));
    glEngine.updateZones(state.zones);
    scheduleRender();
    setStatus(`Modelo cacheado eliminado para ${state.carId}. Restaurada muestra Speedform de estudio.`, "neutral");
  });

  // Populate Car select grouped cleanly by class (GT3 > GTP > LMP2/LMP3 > GT4 & Cup > Fórmula > TCR)
  const carSelect = byId<HTMLSelectElement>("skCarSelect");
  const carSearchInput = byId<HTMLInputElement>("skCarSearch");
  carSearchInput?.addEventListener("input", () => {
    populateCarSelectorFromWorker();
  });
  byId<HTMLButtonElement>("skSaveCalibLocalBtn")?.addEventListener("click", () => {
    saveLocalCalibration(state.carId, state.zones);
    setStatus(`Calibración UV guardada en localStorage para ${state.carId}`, "ok");
  });
  if (carSelect) {
    populateCarSelectorFromWorker();
    carSelect.addEventListener("change", () => {
      const nextSlug = carSelect.value;
      const nextCar = getCarById(nextSlug);
      const indexed = (carsIndexData?.cars || []).find((c) => c.car_slug === nextSlug);
      const effectiveCategory = indexed?.category || nextCar.category;
      const effectiveName = indexed?.name || nextCar.name;
      state.carId = nextSlug;
      if (!state.name || state.name.startsWith("MMT ")) {
        state.name = `MMT · ${effectiveName} #${state.customNumber}`;
      }
      // Limpiar capas oficiales UV del coche anterior y actualizar automáticamente los logos de marca al coche nuevo
      const hadBrandUvLayer = state.decals.some((d) => /^official-uv-.*-brand_decals$/.test(d.id));
      state.decals = state.decals.filter((d) => !d.id.startsWith("official-uv-") || d.id.startsWith(`official-uv-${nextSlug}-`));
      const nextBrandDecal = BRAND_DECALS.find(
        (b) =>
          b.label.toLowerCase().includes(nextCar.brand.toLowerCase()) ||
          nextCar.brand.toLowerCase().includes(b.label.toLowerCase()),
      );
      if (nextBrandDecal) {
        for (const d of state.decals) {
          if (d.dataUrl && (d.dataUrl.includes("/assets/brand/logos/") || d.dataUrl.includes("/assets/skins/brands/"))) {
            d.dataUrl = nextBrandDecal.src;
            d.name = `Logo ${nextBrandDecal.label}`;
          }
        }
      }
      const localUv = getLocalUvMap(nextSlug);
      workerWireframeCanvas = null;
      workerSponsorBlocks = [];
      workerRestrictedPlates = [];
      workerSeriesSlots = [];
      if (localUv) {
        applyUvResponseToState(nextSlug, localUv);
      } else {
        state.zones = getArchetypeZones(effectiveCategory, nextSlug);
      }
      loadKitWireframeForCar(nextSlug);
      if (hadBrandUvLayer || !state.decals.some((d) => d.id.startsWith(`official-uv-${nextSlug}-`))) {
        ensureCarOfficialBrandDecals(nextSlug);
      }
      syncOfficialKitUiForCar(nextSlug);
      renderSeriesDecalsForActiveCar();
      renderBrandDecalsForActiveCar();
      loadedTemplate = null;
      customPhotoShots = null;
      const bodyCat = mapCategoryStringToBody(effectiveCategory);
      glEngine.setCategory(bodyCat);
      glEngine.updateZones(state.zones);
      const glSel = byId<HTMLSelectElement>("skGlModelSelect");
      if (glSel) glSel.value = "auto";
      syncControlsFromState();
      scheduleRender();

      // Auto-restore cached .GLB / .GLTF for this car_slug from IndexedDB (or brand/category real .GLB)
      void restoreSaved3dModelForCar(nextSlug);
      void syncCarUvFromWorker(nextSlug);
    });
  }

  const DRIVER_PREFS_KEY = "mmt_skins_driver_prefs_v1";
  type SavedDriverPref = { customerId: string; number: string; name: string };
  function loadDriverPrefs(): Record<string, SavedDriverPref> {
    try {
      const raw = localStorage.getItem(DRIVER_PREFS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, SavedDriverPref>) : {};
    } catch {
      return {};
    }
  }
  function saveCurrentDriverPref(): void {
    try {
      const prefs = loadDriverPrefs();
      prefs[state.driverId] = {
        customerId: state.customerId,
        number: state.customNumber,
        name: state.customDriverName,
      };
      localStorage.setItem(DRIVER_PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }

  const drvSelect = byId<HTMLSelectElement>("skDriverSelect");
  if (drvSelect) {
    drvSelect.innerHTML = DRIVER_PROFILES.map(
      (d) => `<option value="${d.id}">#${escapeHtml(d.number)} · ${escapeHtml(d.name)}</option>`,
    ).join("");
    drvSelect.addEventListener("change", () => {
      const drv = getDriverById(drvSelect.value);
      const saved = loadDriverPrefs()[drv.id];
      state.driverId = drv.id;
      state.customDriverName = saved?.name || drv.name;
      state.customNumber = saved?.number || drv.number;
      state.customerId = saved?.customerId || drv.customerId;
      customPhotoShots = null;
      syncControlsFromState();
      scheduleRender();
    });
  }

  byId<HTMLInputElement>("skDriverNumber")?.addEventListener("input", (e) => {
    state.customNumber = (e.target as HTMLInputElement).value.slice(0, 4);
    saveCurrentDriverPref();
    updateExportValidation();
    scheduleRender();
  });
  byId<HTMLInputElement>("skDriverName")?.addEventListener("input", (e) => {
    state.customDriverName = (e.target as HTMLInputElement).value.slice(0, 28);
    saveCurrentDriverPref();
    scheduleRender();
  });
  byId<HTMLInputElement>("skCustomerId")?.addEventListener("input", (e) => {
    state.customerId = (e.target as HTMLInputElement).value;
    saveCurrentDriverPref();
    updateExportValidation();
    persistState();
  });
  byId<HTMLInputElement>("skDesignName")?.addEventListener("input", (e) => {
    state.name = (e.target as HTMLInputElement).value;
    persistState();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-number-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = (btn.dataset.numberMode === "custom-number" ? "custom-number" : "sim-stamped") as NumberPlateMode;
      state.numberMode = mode;
      syncControlsFromState();
      scheduleRender();
      setStatus(
        mode === "custom-number"
          ? `Modo Dorsal Fijo activo: se exportarán car_${sanitizeCustomerId(state.customerId)}.tga y car_num_${sanitizeCustomerId(state.customerId)}.tga`
          : "Modo Oficial Sim-Stamped activo: placas laterales protegidas para iRacing.",
        "ok",
      );
    });
  });

  // Template Upload & Assisted Zone Detection
  byId<HTMLInputElement>("skTemplateInput")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setStatus(`Analizando plantilla ${file.name}...`);
    try {
      loadedTemplate = await loadTemplateFile(file);
      const car = getCarById(state.carId);
      const analysis = analyzeTemplateZones(loadedTemplate, car.defaultZones);
      for (const [key, rect] of Object.entries(analysis.detectedZones)) {
        if (rect) state.zones[key as ZoneKey] = rect;
      }
      showTemplateOverlay = true;
      showZonesOverlay = true;
      const wfChk = byId<HTMLInputElement>("skToggleWireframe");
      if (wfChk) wfChk.checked = true;
      const zChk = byId<HTMLInputElement>("skToggleZones");
      if (zChk) zChk.checked = true;
      const infoEl = byId<HTMLElement>("skTemplateSummary");
      if (infoEl) {
        const patInfo = loadedTemplate.carPatterns?.length
          ? ` + ${loadedTemplate.carPatterns.length} Car Patterns RGB listos en Diseño`
          : "";
        const extra = loadedTemplate.format === "PSD"
          ? ` · PSD nativo (${loadedTemplate.layerCount ?? 0} capas; ${loadedTemplate.partsOverlayCanvas ? "piezas/stickers oficiales preservados" : "guía wireframe lista"}${patInfo})`
          : "";
        infoEl.textContent = analysis.summary + extra;
      }
      state.psdPatternName = null;
      renderPsdPatternSelector();
      viewMode = "uv";
      updateViewModeUI();
      renderZoneList();
      glEngine.setCategory(mapCategoryStringToBody(car.category));
      glEngine.updateZones(state.zones);
      scheduleRender();
      setStatus(`Plantilla real de iRacing cargada (${analysis.width}×${analysis.height} ${analysis.format})`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error cargando plantilla", "err");
    }
  });

  byId<HTMLButtonElement>("skResetZones")?.addEventListener("click", () => {
    const car = getCarById(state.carId);
    state.zones = cloneZones(car.defaultZones);
    state.zoneOverrides = {};
    renderZoneList();
    scheduleRender();
    setStatus("Zonas y colores por pieza restaurados al mapa base del coche.", "ok");
  });

  // Modo "Ajustar cajas de zona" + Exportar JSON calibrado UV del coche actual
  let zoneEditMode = false;
  const editZonesBtn = byId<HTMLButtonElement>("skEditZonesBtn");
  editZonesBtn?.addEventListener("click", () => {
    zoneEditMode = !zoneEditMode;
    showZonesOverlay = true;
    const zChk = byId<HTMLInputElement>("skToggleZones");
    if (zChk) zChk.checked = true;
    if (zoneEditMode) {
      brushMode = false;
      const bBtn = byId<HTMLButtonElement>("skBrushToggle");
      if (bBtn) {
        bBtn.textContent = "Pincel libre: OFF";
        bBtn.classList.remove("sk-btn-primary");
      }
      if (viewMode !== "uv") {
        viewMode = "uv";
        updateViewModeUI();
      }
    }
    editZonesBtn.classList.toggle("sk-btn-primary", zoneEditMode);
    editZonesBtn.textContent = zoneEditMode ? "Ajustando cajas: ON" : "Ajustar cajas de zona";
    scheduleRender();
    setStatus(
      zoneEditMode
        ? "Modo ajuste activo: arrastra cualquier pieza o su esquina inferior derecha para calibrarla sobre el wireframe."
        : "Modo ajuste de cajas desactivado.",
      "ok",
    );
  });

  byId<HTMLButtonElement>("skExportCalibratedUvBtn")?.addEventListener("click", () => {
    const car = getCarById(state.carId);
    const toPx = (z: { x: number; y: number; w: number; h: number }) => ({
      x: Math.round(z.x * 2048),
      y: Math.round(z.y * 2048),
      width: Math.round(z.w * 2048),
      height: Math.round(z.h * 2048),
    });
    const payload = {
      car_slug: state.carId,
      car_name: car.name,
      native_resolution: "2048x2048",
      exported_at: new Date().toISOString(),
      zones: {
        hood: toPx(state.zones.hood),
        roof: toPx(state.zones.roof),
        left_side: { ...toPx(state.zones.leftSide), mirror_x: false },
        right_side: { ...toPx(state.zones.rightSide), mirror_x: true },
        rear_wing: { top_plane: toPx(state.zones.rearWing) },
        front_bumper: toPx(state.zones.frontBumper),
        rear_bumper: toPx(state.zones.rearBumper),
        mirrors: toPx(state.zones.mirrors),
      },
      restricted_number_plates: [
        { id: "left_plate", label: "Placa Dorsal Izq.", ...toPx(state.zones.numberPlateLeft) },
        { id: "right_plate", label: "Placa Dorsal Der.", ...toPx(state.zones.numberPlateRight) },
      ],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uv_${state.carId}_calibrated.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`JSON UV calibrado descargado: uv_${state.carId}_calibrated.json`, "ok");
  });

  // Per-part car paint & Spec Map override bindings
  byId<HTMLInputElement>("skZonePaintColor")?.addEventListener("input", (e) => {
    const zk = selectedZone && !state.zones[selectedZone]?.restricted ? selectedZone : "hood";
    if (!state.zoneOverrides) state.zoneOverrides = {};
    state.zoneOverrides[zk] = { ...(state.zoneOverrides[zk] || {}), color: (e.target as HTMLInputElement).value };
    renderZoneList();
    scheduleRender();
  });
  byId<HTMLSelectElement>("skZonePaintFinish")?.addEventListener("change", (e) => {
    const zk = selectedZone && !state.zones[selectedZone]?.restricted ? selectedZone : "hood";
    const val = (e.target as HTMLSelectElement).value as FinishType | "";
    if (!state.zoneOverrides) state.zoneOverrides = {};
    state.zoneOverrides[zk] = { ...(state.zoneOverrides[zk] || {}), finish: val || undefined };
    renderZoneList();
    scheduleRender();
  });
  byId<HTMLButtonElement>("skZoneMirrorBtn")?.addEventListener("click", () => {
    if (selectedZone !== "leftSide" && selectedZone !== "rightSide") return;
    const other: ZoneKey = selectedZone === "leftSide" ? "rightSide" : "leftSide";
    const src = state.zoneOverrides?.[selectedZone];
    if (!state.zoneOverrides) state.zoneOverrides = {};
    state.zoneOverrides[other] = src ? { ...src } : undefined;
    renderZoneList();
    scheduleRender();
    setStatus("Color y acabado copiados al lateral simétrico (L ↔ R).", "ok");
  });
  byId<HTMLButtonElement>("skZonePaintReset")?.addEventListener("click", () => {
    const zk = selectedZone && !state.zones[selectedZone]?.restricted ? selectedZone : "hood";
    if (state.zoneOverrides) delete state.zoneOverrides[zk];
    renderZoneList();
    scheduleRender();
    setStatus(`Pieza ${state.zones[zk]?.label || zk} restaurada al color base.`, "neutral");
  });

  // Presets & Save/Load JSON
  const presetHost = byId<HTMLElement>("skPresetList");
  if (presetHost) {
    presetHost.innerHTML = SKIN_PRESETS.map(
      (p) => `
      <div class="sk-list-item" data-apply-preset="${p.id}">
        <div>
          <strong style="display:block;font-size:11.5px;">${escapeHtml(p.name)}</strong>
          <span style="font-size:10px;color:var(--sk-muted);">${escapeHtml(p.tagline)}</span>
        </div>
        <span style="width:14px;height:14px;border-radius:3px;background:${p.palette.accent};border:1px solid rgba(255,255,255,0.25);flex-shrink:0;"></span>
      </div>`,
    ).join("");
    presetHost.querySelectorAll<HTMLElement>("[data-apply-preset]").forEach((el) => {
      el.addEventListener("click", () => {
        const preset = SKIN_PRESETS.find((p) => p.id === el.dataset.applyPreset);
        if (!preset) return;
        state.pattern = preset.id;
        state.palette = { ...preset.palette };
        state.spec = { ...preset.spec };
        state.fontStyle = preset.fontStyle;
        customPhotoShots = null;
        syncControlsFromState();
        scheduleRender();
        setStatus(`Preset aplicado: ${preset.name}`, "ok");
      });
    });
  }

  byId<HTMLButtonElement>("skCleanCanvasBtn")?.addEventListener("click", () => {
    state.pattern = "freeform";
    state.surfaceTexture = "none";
    state.psdPatternName = null;
    state.zoneOverrides = {};
    state.decals = [];
    state.strokes = [];
    selectedDecalId = null;
    syncControlsFromState();
    scheduleRender();
    setStatus("Lienzo limpio en modo Diseño Libre listo para pintar o usar Muntrume AI.", "ok");
  });

  byId<HTMLButtonElement>("skSaveLocalBtn")?.addEventListener("click", () => {
    saveToLibrary(state);
    setStatus(`Guardado en biblioteca local: ${state.name}`, "ok");
  });

  byId<HTMLButtonElement>("skExportJsonBtn")?.addEventListener("click", () => {
    const fn = exportPresetJson(state);
    setStatus(`Preset exportado: ${fn}`, "ok");
  });

  byId<HTMLInputElement>("skImportJsonInput")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as SkinDesignState;
      if (!parsed.carId || !parsed.palette || !parsed.zones) {
        throw new Error("El archivo JSON no corresponde a un preset válido de skins.muntru.me.");
      }
      state = parsed;
      selectedDecalId = state.decals[0]?.id ?? null;
      syncControlsFromState();
      scheduleRender();
      setStatus(`Preset importado: ${state.name}`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error importando JSON", "err");
    }
  });

  // Design Tab Bindings
  const bindColor = (id: string, key: keyof SkinDesignState["palette"]) => {
    byId<HTMLInputElement>(id)?.addEventListener("input", (e) => {
      state.palette[key] = (e.target as HTMLInputElement).value;
      renderPatternGallery();
      updateExportValidation();
      scheduleRender();
    });
  };
  bindColor("skColorPrimary", "primary");
  bindColor("skColorSecondary", "secondary");
  bindColor("skColorAccent", "accent");
  bindColor("skColorDetail", "detail");
  bindColor("skColorNum", "numberColor");
  bindColor("skColorNumBg", "numberBg");

  byId<HTMLButtonElement>("skMonoColorBtn")?.addEventListener("click", () => {
    state.palette.secondary = state.palette.primary;
    syncControlsFromState();
    scheduleRender();
    setStatus("Base monocolor activada (Secundario = Primario con contraste tonal automático).", "ok");
  });

  byId<HTMLButtonElement>("skClearAllDecalsBtn")?.addEventListener("click", () => {
    state.decals = [];
    selectedDecalId = null;
    renderDecalList();
    renderDecalEditor();
    scheduleRender();
    setStatus("Todos los logos/decals eliminados del coche.", "ok");
  });

  byId<HTMLSelectElement>("skPatternSelect")?.addEventListener("change", (e) => {
    state.pattern = (e.target as HTMLSelectElement).value as SkinDesignState["pattern"];
    state.psdPatternName = null;
    renderPatternGallery();
    renderPsdPatternSelector();
    scheduleRender();
  });
  byId<HTMLSelectElement>("skSurfaceTexture")?.addEventListener("change", (e) => {
    state.surfaceTexture = (e.target as HTMLSelectElement).value as SurfaceTexture;
    renderPatternGallery();
    scheduleRender();
  });
  byId<HTMLSelectElement>("skPsdPatternSelect")?.addEventListener("change", (e) => {
    const val = (e.target as HTMLSelectElement).value;
    state.psdPatternName = val || null;
    renderPatternGallery();
    scheduleRender();
    if (val) setStatus(`Patrón oficial del .PSD activado (${val}) — recoloreado con tu paleta`, "ok");
  });
  byId<HTMLButtonElement>("skPsdPatternClear")?.addEventListener("click", () => {
    state.psdPatternName = null;
    renderPsdPatternSelector();
    renderPatternGallery();
    scheduleRender();
    setStatus("Volviendo a los patrones MMT del estudio.", "neutral");
  });
  document.querySelectorAll<HTMLButtonElement>("[data-quick-pal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parts = (btn.dataset.quickPal || "").split(",");
      if (parts.length < 5) return;
      state.palette.primary = parts[0];
      state.palette.secondary = parts[1];
      state.palette.accent = parts[2];
      state.palette.detail = parts[3];
      state.pattern = parts[4] as PatternStyle;
      state.psdPatternName = null;
      syncControlsFromState();
      scheduleRender();
      setStatus(`Paleta aplicada: ${btn.textContent?.trim() || "Pro"}`, "ok");
    });
  });
  byId<HTMLSelectElement>("skFontSelect")?.addEventListener("change", (e) => {
    state.fontStyle = (e.target as HTMLSelectElement).value as SkinDesignState["fontStyle"];
    scheduleRender();
  });
  byId<HTMLInputElement>("skShowNumber")?.addEventListener("change", (e) => {
    state.showNumberOnCar = (e.target as HTMLInputElement).checked;
    scheduleRender();
  });
  byId<HTMLSelectElement>("skFinishSelect")?.addEventListener("change", (e) => {
    const finish = (e.target as HTMLSelectElement).value as FinishType;
    const defs = finishDefaults(finish);
    state.spec = { finish, ...defs };
    syncControlsFromState();
    scheduleRender();
  });
  byId<HTMLInputElement>("skSpecMetallic")?.addEventListener("input", (e) => {
    state.spec.metallic = Number((e.target as HTMLInputElement).value);
    scheduleRender();
  });
  byId<HTMLInputElement>("skSpecRoughness")?.addEventListener("input", (e) => {
    state.spec.roughness = Number((e.target as HTMLInputElement).value);
    scheduleRender();
  });
  byId<HTMLInputElement>("skSpecClearcoat")?.addEventListener("input", (e) => {
    state.spec.clearcoat = Number((e.target as HTMLInputElement).value);
    scheduleRender();
  });
  byId<HTMLInputElement>("skCarbonWeave")?.addEventListener("change", (e) => {
    state.spec.carbonAccent = (e.target as HTMLInputElement).checked;
    scheduleRender();
  });

  // Freeform Brush & Shape Controls
  const brushToggleBtn = byId<HTMLButtonElement>("skBrushToggle");
  brushToggleBtn?.addEventListener("click", () => {
    brushMode = !brushMode;
    brushToggleBtn.textContent = brushMode ? "Pincel libre: ON (dibuja en el mapa)" : "Pincel libre: OFF";
    brushToggleBtn.classList.toggle("sk-btn-primary", brushMode);
    uvCanvas.style.cursor = brushMode ? "crosshair" : "grab";
    if (brushMode && viewMode !== "uv") {
      viewMode = "uv";
      updateViewModeUI();
    }
  });
  byId<HTMLInputElement>("skBrushColor")?.addEventListener("input", (e) => {
    brushColor = (e.target as HTMLInputElement).value;
  });
  byId<HTMLInputElement>("skBrushSize")?.addEventListener("input", (e) => {
    brushSize = Number((e.target as HTMLInputElement).value) * 0.007;
  });
  byId<HTMLInputElement>("skBrushMirror")?.addEventListener("change", (e) => {
    brushMirror = (e.target as HTMLInputElement).checked;
  });
  byId<HTMLButtonElement>("skBrushUndo")?.addEventListener("click", () => {
    if (Array.isArray(state.strokes) && state.strokes.length > 0) {
      state.strokes.pop();
      scheduleRender();
    }
  });
  byId<HTMLButtonElement>("skBrushClear")?.addEventListener("click", () => {
    state.strokes = [];
    scheduleRender();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-add-shape]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const shapeType = (btn.dataset.addShape as "stripe" | "triangle" | "circle") || "stripe";
      const label = shapeType === "stripe" ? "Franja libre" : shapeType === "triangle" ? "Triángulo" : "Círculo";
      const layer: DecalLayer = {
        id: `shape-${Date.now()}`,
        name: label,
        kind: "shape",
        shapeType,
        color: state.palette.accent,
        x: 0.5,
        y: 0.5,
        scale: shapeType === "stripe" ? 0.34 : 0.16,
        rotation: 0,
        opacity: 1,
        mirrorX: false,
      };
      state.decals.push(layer);
      selectedDecalId = layer.id;
      rightTab = "decals";
      updateRightTabUI();
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
      setStatus(`${label} añadida: arrástrala y rótala libremente sobre el mapa UV.`, "ok");
    });
  });

  // Decals Tab Bindings (Escudería MMT + Series iRacing + Marcas)
  const mountLibraryDecals = (containerId: string, items: LibraryDecalItem[], defaultMirror = false) => {
    const host = byId<HTMLElement>(containerId);
    if (!host) return;
    host.innerHTML = items
      .map(
        (item) =>
          `<button type="button" class="sk-btn sk-btn-sm" data-lib-decal="${item.id}" style="gap:5px;"><img src="${item.src}" alt="" width="14" height="14" style="object-fit:contain;" /><span>${escapeHtml(item.label)}</span></button>`,
      )
      .join("");
    host.querySelectorAll<HTMLButtonElement>("[data-lib-decal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = items.find((i) => i.id === btn.dataset.libDecal);
        if (!item) return;
        // Encajar automáticamente el logo en los Sponsor Blocks REALES de la plantilla iRacing de este coche
        const targetZoneKey: ZoneKey =
          selectedZone ??
          (item.group === "series" ? "leftSide" : item.group === "brand" ? "hood" : "hood");
        const z = state.zones[targetZoneKey] || state.zones.hood;
        const realSlot =
          workerSponsorBlocks.length > 0
            ? workerSponsorBlocks[state.decals.length % workerSponsorBlocks.length]
            : null;
        const autoMirror = false;
        const autoX = realSlot
          ? Math.max(0.05, Math.min(0.95, realSlot.cx))
          : Math.max(0.06, Math.min(0.94, z.x + z.w * 0.5));
        const autoY = realSlot
          ? Math.max(0.05, Math.min(0.95, realSlot.cy))
          : Math.max(
              0.06,
              Math.min(0.94, z.y + z.h * (item.group === "brand" && targetZoneKey === "hood" ? 0.28 : 0.5)),
            );
        const zoneCap = Math.max(0.042, Math.min(0.095, Math.min(z.w, z.h) * (item.group === "brand" ? 0.28 : 0.36)));
        const finalScale = Math.min(item.defaultScale ?? 0.065, zoneCap);
        const freeSpot = findFreeDecalSpot(autoX, autoY, finalScale, z);
        const panelRotation =
          targetZoneKey === "hood" || targetZoneKey === "roof" || targetZoneKey === "rearBumper"
            ? 90
            : targetZoneKey === "rightSide"
              ? 180
              : 0;
        const layer: DecalLayer = {
          id: `decal-lib-${Date.now()}`,
          name: item.label,
          kind: "custom",
          dataUrl: item.src,
          color: "#ffffff",
          x: freeSpot.x,
          y: freeSpot.y,
          scale: finalScale,
          rotation: panelRotation,
          opacity: 1,
          mirrorX: autoMirror,
          zoneHint: targetZoneKey,
        };
        state.decals.push(layer);
        selectedDecalId = layer.id;
        if (viewMode === "showroom") {
          viewMode = "uv";
          updateViewModeUI();
        }
        renderDecalList();
        renderDecalEditor();
        scheduleRender();
        setStatus(`Logo "${item.label}" añadido en ${targetZoneKey} · Arrástralo en el lienzo UV o usa las flechas`, "ok");
      });
    });
  };

  mountLibraryDecals("skTeamDecals", TEAM_DECALS, false);

  function renderSeriesDecalsForActiveCar(): void {
    const meta = resolveCarMeta(state.carId);
    const profile = getCarSeriesProfile(state.carId, meta.category);
    mountLibraryDecals("skSeriesDecals", profile.seriesDecals.length > 0 ? profile.seriesDecals : SERIES_DECALS, true);
  }
  renderSeriesDecalsForActiveCar();

  function renderBrandDecalsForActiveCar(): void {
    const car = getCarById(state.carId);
    const brandLow = (car.brand || "").toLowerCase();
    const sorted = [...BRAND_DECALS].sort((a, b) => {
      const aMatch = brandLow && (a.label.toLowerCase().includes(brandLow) || brandLow.includes(a.label.toLowerCase())) ? 0 : 1;
      const bMatch = brandLow && (b.label.toLowerCase().includes(brandLow) || brandLow.includes(b.label.toLowerCase())) ? 0 : 1;
      return aMatch - bMatch;
    });
    mountLibraryDecals("skBrandDecals", sorted, false);
    const firstBtn = byId<HTMLElement>("skBrandDecals")?.querySelector<HTMLButtonElement>("button");
    if (firstBtn && brandLow && (sorted[0]?.label.toLowerCase().includes(brandLow) || brandLow.includes(sorted[0]?.label.toLowerCase() || ""))) {
      firstBtn.classList.add("sk-btn-primary");
    }
  }
  renderBrandDecalsForActiveCar();

  // Official iRacing 1-click UV layers (brand decals, championship kit, series plates, wireframe)
  type OfficialKitEntry = { sourceSlug: string; layers: Record<string, string> };
  type OfficialKitManifest = Record<string, OfficialKitEntry>;
  let officialKits: OfficialKitManifest = {};

  function syncOfficialKitUiForCar(carSlug: string): void {
    const slug = (carSlug || "").toLowerCase();
    const kit = officialKits[slug];
    const layers = kit?.layers || {};
    const car = getCarById(carSlug);
    const meta = resolveCarMeta(carSlug);
    const profile = getCarSeriesProfile(carSlug, meta.category);

    const btnBrand = byId<HTMLButtonElement>("skKitAddBrand");
    const btnImsa = byId<HTMLButtonElement>("skKitAddImsa");
    const btnSeries = byId<HTMLButtonElement>("skKitAddSeries");
    const btnWire = byId<HTMLButtonElement>("skKitAddWire");
    const statusEl = byId<HTMLElement>("skOfficialKitStatus");

    const hasActive = (key: string) => state.decals.some((d) => d.id === `official-uv-${carSlug}-${key}`);

    if (btnBrand) {
      btnBrand.textContent = `${hasActive("brand_decals") ? "✓" : "+"} Logos ${car.brand} (UV)`;
      btnBrand.classList.toggle("sk-btn-primary", hasActive("brand_decals"));
    }
    if (btnImsa) {
      btnImsa.classList.remove("sk-hidden");
      btnImsa.textContent = `${hasActive("imsa_decals") ? "✓" : "+"} ${profile.kitButtonLabel}`;
      btnImsa.classList.toggle("sk-btn-primary", hasActive("imsa_decals"));
    }
    if (btnSeries) {
      btnSeries.classList.remove("sk-hidden");
      btnSeries.textContent = `${hasActive("series_blocks") ? "✓" : "+"} ${profile.platesButtonLabel}`;
      btnSeries.classList.toggle("sk-btn-primary", hasActive("series_blocks"));
    }
    if (btnWire) {
      btnWire.classList.toggle("sk-hidden", !layers.wireframe);
      btnWire.textContent = `${hasActive("wireframe") ? "✓" : "+"} Cascarón UV`;
      btnWire.classList.toggle("sk-btn-primary", hasActive("wireframe"));
    }
    if (statusEl) {
      const available: string[] = [profile.championshipName];
      if (layers.brand_decals) available.push(`Logos ${car.brand}`);
      if (layers.imsa_decals && profile.useImsaOfficialLayer) available.push("IMSA oficial");
      if (layers.series_blocks) available.push("Placas UV");
      if (layers.car_mandatory) available.push("Partes 2K auto");
      statusEl.textContent = `${meta.name} · ${available.join(" · ")} ✓`;
    }
  }

  function ensureCarOfficialBrandDecals(carSlug: string): void {
    const slug = (carSlug || "").toLowerCase();
    const url = officialKits[slug]?.layers?.brand_decals;
    if (!url) return;
    const layerId = `official-uv-${carSlug}-brand_decals`;
    if (state.decals.some((d) => d.id === layerId)) return;
    const car = getCarById(carSlug);
    state.decals.push({
      id: layerId,
      name: `Logos ${car.brand} (${car.name})`,
      kind: "custom",
      dataUrl: url,
      color: "#ffffff",
      x: 0.5,
      y: 0.5,
      scale: 1.0,
      rotation: 0,
      opacity: 1,
      mirrorX: false,
    });
    renderDecalList();
    renderDecalEditor();
    scheduleRender();
  }

  function fetchOfficialKitsAuthenticated(): Promise<void> {
    const tk = getVaultToken();
    const headers: Record<string, string> = {};
    if (tk) headers.Authorization = `Bearer ${tk}`;
    return fetch("/assets/skins/kits/manifest.json", { credentials: "include", headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: OfficialKitManifest) => {
        const indexed: OfficialKitManifest = { ...(data || {}) };
        for (const entry of Object.values(data || {})) {
          if (entry?.sourceSlug && !indexed[entry.sourceSlug]) {
            indexed[entry.sourceSlug] = entry;
          }
        }
        if (indexed.astonmartinvantagegt3 && !indexed.amvantageevogt3) {
          indexed.amvantageevogt3 = indexed.astonmartinvantagegt3;
        }
        if (indexed.mercedesamggt3 && !indexed.mercedesamgevogt3) {
          indexed.mercedesamgevogt3 = indexed.mercedesamggt3;
        }
        officialKits = indexed;
        void loadKitWireframeForCar(state.carId);
        if (!state.decals.some((d) => d.id.startsWith("official-uv-"))) {
          ensureCarOfficialBrandDecals(state.carId);
        }
        syncOfficialKitUiForCar(state.carId);
      })
      .catch(() => {});
  }
  if (getVaultToken()) {
    void fetchOfficialKitsAuthenticated();
  }

  const loadKitWireframeForCar = (carSlug: string): void => {
    const slug = (carSlug || "").toLowerCase();
    const layers = officialKits[slug]?.layers;
    const wireUrl = layers?.wireframe;
    const mandatoryUrl = layers?.car_mandatory;

    if (!wireUrl) {
      kitWireframeCanvas = null;
      kitWireframeSlug = "";
    } else if (kitWireframeSlug !== slug || !kitWireframeCanvas) {
      kitWireframeSlug = slug;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (kitWireframeSlug !== slug) return;
        const c = document.createElement("canvas");
        c.width = 2048;
        c.height = 2048;
        const cx = c.getContext("2d");
        if (cx) {
          cx.imageSmoothingEnabled = true;
          cx.imageSmoothingQuality = "high";
          cx.drawImage(img, 0, 0, 2048, 2048);
          kitWireframeCanvas = c;
          scheduleRender();
        }
      };
      img.onerror = () => {
        if (kitWireframeSlug === slug) kitWireframeCanvas = null;
      };
      img.src = wireUrl;
    }

    // Automatically load official iRacing Car_Mandatory layer (lights, grilles, vents, trim)
    // so both live preview and exported PNG/TGA look crisp, detailed & panel-separated!
    if (!mandatoryUrl) {
      setKitCarMandatoryCanvas(null);
    } else {
      const mImg = new Image();
      mImg.crossOrigin = "anonymous";
      mImg.onload = () => {
        if ((state.carId || "").toLowerCase() !== slug) return;
        const c = document.createElement("canvas");
        c.width = 2048;
        c.height = 2048;
        const cx = c.getContext("2d");
        if (cx) {
          cx.imageSmoothingEnabled = true;
          cx.imageSmoothingQuality = "high";
          cx.drawImage(mImg, 0, 0, 2048, 2048);
          setKitCarMandatoryCanvas(c);
          scheduleRender();
        }
      };
      mImg.onerror = () => setKitCarMandatoryCanvas(null);
      mImg.src = mandatoryUrl;
    }
  };

  const toggleOfficialUvLayer = (layerKey: "brand_decals" | "imsa_decals" | "series_blocks" | "wireframe", label: string) => {
    const kit = officialKits[state.carId];
    const url = kit?.layers?.[layerKey];
    const layerId = `official-uv-${state.carId}-${layerKey}`;
    const existingIdx = state.decals.findIndex((d) => d.id === layerId);
    if (existingIdx !== -1) {
      state.decals = state.decals.filter((d) => d.id !== layerId && !d.id.startsWith(`${layerId}-`));
      if (selectedDecalId === layerId || selectedDecalId?.startsWith(`${layerId}-`)) selectedDecalId = null;
      renderDecalList();
      renderDecalEditor();
      syncOfficialKitUiForCar(state.carId);
      scheduleRender();
      setStatus(`Capa oficial "${label}" quitada`, "ok");
      return;
    }
    const meta = resolveCarMeta(state.carId);
    const seriesProfile = getCarSeriesProfile(state.carId, meta.category);
    const effectiveUrl = layerKey === "imsa_decals" && !seriesProfile.useImsaOfficialLayer ? undefined : url;
    if (!effectiveUrl) {
      // Championship-specific clean transparent vector plates & front badge tailored to this car's series
      // (IMSA GTP / GTD Pro / Porsche Cup / Ferrari Challenge / GT4 / FIA F4 / F3 / SF23 / TCR / MX-5 / GR86)
      if (layerKey === "imsa_decals" || layerKey === "series_blocks") {
        const car = getCarById(state.carId);
        const kitLayers = buildChampionshipKitLayers(seriesProfile, car.name, state.zones, layerId);
        state.decals.push(...kitLayers);
        selectedDecalId = kitLayers[0]?.id ?? null;
        renderDecalList();
        renderDecalEditor();
        syncOfficialKitUiForCar(state.carId);
        scheduleRender();
        setStatus(`Kit ${seriesProfile.championshipName} aplicado limpiamente sobre ${car.name}`, "ok");
        return;
      }
      if (layerKey === "brand_decals") {
        const car = getCarById(state.carId);
        const brandItem = BRAND_DECALS.find(
          (b) =>
            b.label.toLowerCase().includes(car.brand.toLowerCase()) ||
            car.brand.toLowerCase().includes(b.label.toLowerCase()),
        );
        if (brandItem) {
          const hood = state.zones.hood || { x: 0.14, y: 0.48, w: 0.28, h: 0.22 };
          const rearB = state.zones.rearBumper || { x: 0.80, y: 0.48, w: 0.14, h: 0.22 };
          const noseLogo: DecalLayer = {
            id: layerId,
            name: `Emblema ${brandItem.label} Capó (${car.name})`,
            kind: "custom",
            dataUrl: brandItem.src,
            color: "#ffffff",
            x: hood.x + hood.w * 0.22,
            y: hood.y + hood.h * 0.5,
            scale: 0.065,
            rotation: 90,
            opacity: 1,
            mirrorX: false,
            zoneHint: "hood",
          };
          const rearLogo: DecalLayer = {
            id: `${layerId}-rear`,
            name: `Emblema ${brandItem.label} Trasero (${car.name})`,
            kind: "custom",
            dataUrl: brandItem.src,
            color: "#ffffff",
            x: rearB.x + rearB.w * 0.5,
            y: rearB.y + rearB.h * 0.5,
            scale: 0.055,
            rotation: 90,
            opacity: 1,
            mirrorX: false,
            zoneHint: "rearBumper",
          };
          state.decals.push(noseLogo, rearLogo);
          selectedDecalId = noseLogo.id;
          renderDecalList();
          renderDecalEditor();
          syncOfficialKitUiForCar(state.carId);
          scheduleRender();
          setStatus(`Logos oficiales ${brandItem.label} aplicados en morro y trasera de ${car.name}`, "ok");
          return;
        }
      }
      setStatus(`Este coche (${state.carId}) no tiene capa oficial "${label}" en su plantilla iRacing`, "neutral");
      return;
    }
    const layer: DecalLayer = {
      id: layerId,
      name: `${label} (${getCarById(state.carId).name})`,
      kind: "custom",
      dataUrl: url,
      color: "#ffffff",
      x: 0.5,
      y: 0.5,
      scale: 1.0,
      rotation: 0,
      opacity: layerKey === "wireframe" ? 0.55 : 1,
      mirrorX: false,
    };
    state.decals.push(layer);
    selectedDecalId = layer.id;
    renderDecalList();
    renderDecalEditor();
    syncOfficialKitUiForCar(state.carId);
    scheduleRender();
    setStatus(`Capa oficial "${label}" aplicada al píxel exacto sobre ${getCarById(state.carId).name}`, "ok");
  };

  byId<HTMLButtonElement>("skKitAddBrand")?.addEventListener("click", () => toggleOfficialUvLayer("brand_decals", "Logos Marca iRacing"));
  byId<HTMLButtonElement>("skKitAddImsa")?.addEventListener("click", () => toggleOfficialUvLayer("imsa_decals", "Etiquetas IMSA"));
  byId<HTMLButtonElement>("skKitAddSeries")?.addEventListener("click", () => toggleOfficialUvLayer("series_blocks", "Placas GT3 / Dorsales"));
  byId<HTMLButtonElement>("skKitAddWire")?.addEventListener("click", () => toggleOfficialUvLayer("wireframe", "Cascarón UV Wireframe"));

  // Imported Finished Skin Editor (.TGA / .PNG / .PSD) — edit existing skins, cover/replace logos & add IMSA/brand decals
  const importSkinInput = byId<HTMLInputElement>("skImportSkinInput");
  const importSkinStatus = byId<HTMLElement>("skImportedSkinStatus");
  const importSkinTools = byId<HTMLElement>("skImportedSkinTools");
  const importClearBtn = byId<HTMLButtonElement>("skImpClearBtn");
  const patchModeBtn = byId<HTMLButtonElement>("skPatchModeBtn");

  const setPatchMode = (active: boolean) => {
    patchMode = active;
    if (active) brushMode = false;
    if (patchModeBtn) {
      patchModeBtn.classList.toggle("is-active", active);
      patchModeBtn.textContent = active ? "✓ Arrastra sobre el logo a tapar" : "🩹 Tapar logo / texto";
    }
    uvCanvas.style.cursor = active ? "crosshair" : "";
    if (active) {
      if (viewMode !== "uv") {
        viewMode = "uv";
        updateViewModeUI();
      }
      setStatus("Modo Tapar Logo activo: arrastra un recuadro sobre cualquier logo o texto viejo en el Mapa UV 2D", "ok");
    }
  };

  byId<HTMLButtonElement>("skQuickImportSkinBtn")?.addEventListener("click", () => {
    importSkinInput?.click();
  });

  importSkinInput?.addEventListener("change", async () => {
    const file = importSkinInput.files?.[0];
    if (!file) return;
    setStatus(`Importando skin "${file.name}"...`, "neutral");
    try {
      const loaded = await loadTemplateFile(file);
      setImportedBaseSkin(loaded.canvas, file.name);
      state.importedSkinFilter = { hue: 0, sat: 100, bright: 100 };
      if (importSkinStatus) {
        importSkinStatus.textContent = `✓ Skin cargada: ${file.name} (${loaded.width}×${loaded.height}). Usa "Tapar logo", añade nuevos logos/textos o aplica decals IMSA/Marca.`;
      }
      importSkinTools?.classList.remove("sk-hidden");
      importClearBtn?.classList.remove("sk-hidden");
      const hueEl = byId<HTMLInputElement>("skImpHue");
      const satEl = byId<HTMLInputElement>("skImpSat");
      const briEl = byId<HTMLInputElement>("skImpBright");
      if (hueEl) hueEl.value = "0";
      if (satEl) satEl.value = "100";
      if (briEl) briEl.value = "100";
      const hv = byId<HTMLElement>("skImpHueVal"); if (hv) hv.textContent = "0°";
      const sv = byId<HTMLElement>("skImpSatVal"); if (sv) sv.textContent = "100%";
      const bv = byId<HTMLElement>("skImpBrightVal"); if (bv) bv.textContent = "100%";
      scheduleRender();
      setStatus(`Skin "${file.name}" lista para editar en 2D y 3D · Exporta en .TGA / .PNG cuando acabes`, "ok");
    } catch (err) {
      setStatus(`Error importando skin: ${err instanceof Error ? err.message : "formato no soportado"}`, "err");
    } finally {
      importSkinInput.value = "";
    }
  });

  patchModeBtn?.addEventListener("click", () => setPatchMode(!patchMode));

  byId<HTMLButtonElement>("skImportReplaceTextBtn")?.addEventListener("click", () => {
    const raw = window.prompt("Texto, patrocinador o web a colocar sobre la skin:", "MUNTRU.ME");
    if (!raw || !raw.trim()) return;
    setPatchMode(false);
    const z = state.zones[selectedZone || "hood"] || state.zones.hood;
    const tx = lastPatchCenter ? lastPatchCenter.x : z.x + z.w * 0.5;
    const ty = lastPatchCenter ? lastPatchCenter.y : z.y + z.h * 0.5;
    const textLayer: DecalLayer = {
      id: `imp-txt-${Date.now()}`,
      name: raw.trim(),
      kind: "text",
      text: raw.trim(),
      color: "#ffffff",
      x: tx,
      y: ty,
      scale: 0.16,
      rotation: 0,
      opacity: 1,
      mirrorX: false,
      zoneHint: selectedZone || "hood",
    };
    state.decals.push(textLayer);
    selectedDecalId = textLayer.id;
    renderDecalList();
    renderDecalEditor();
    scheduleRender();
    setStatus(`Texto "${raw.trim()}" añadido · Muévelo o gíralo en el Mapa UV 2D`, "ok");
  });

  byId<HTMLButtonElement>("skImportAddBrandBtn")?.addEventListener("click", () => toggleOfficialUvLayer("brand_decals", "Logos Marca iRacing"));
  byId<HTMLButtonElement>("skImportAddImsaBtn")?.addEventListener("click", () => toggleOfficialUvLayer("imsa_decals", "Etiquetas IMSA"));
  byId<HTMLButtonElement>("skImportAddSeriesBtn")?.addEventListener("click", () => toggleOfficialUvLayer("series_blocks", "Placas GT3 / Dorsales"));

  const syncImportedFilter = () => {
    const hue = Number(byId<HTMLInputElement>("skImpHue")?.value || 0);
    const sat = Number(byId<HTMLInputElement>("skImpSat")?.value || 100);
    const bright = Number(byId<HTMLInputElement>("skImpBright")?.value || 100);
    state.importedSkinFilter = { hue, sat, bright };
    const hv = byId<HTMLElement>("skImpHueVal"); if (hv) hv.textContent = `${hue}°`;
    const sv = byId<HTMLElement>("skImpSatVal"); if (sv) sv.textContent = `${sat}%`;
    const bv = byId<HTMLElement>("skImpBrightVal"); if (bv) bv.textContent = `${bright}%`;
    scheduleRender();
  };
  byId<HTMLInputElement>("skImpHue")?.addEventListener("input", syncImportedFilter);
  byId<HTMLInputElement>("skImpSat")?.addEventListener("input", syncImportedFilter);
  byId<HTMLInputElement>("skImpBright")?.addEventListener("input", syncImportedFilter);
  byId<HTMLButtonElement>("skImpResetFilterBtn")?.addEventListener("click", () => {
    const h = byId<HTMLInputElement>("skImpHue"); if (h) h.value = "0";
    const s = byId<HTMLInputElement>("skImpSat"); if (s) s.value = "100";
    const b = byId<HTMLInputElement>("skImpBright"); if (b) b.value = "100";
    syncImportedFilter();
  });

  importClearBtn?.addEventListener("click", () => {
    setImportedBaseSkin(null);
    setPatchMode(false);
    state.importedSkinFilter = undefined;
    importSkinTools?.classList.add("sk-hidden");
    importClearBtn.classList.add("sk-hidden");
    if (importSkinStatus) {
      importSkinStatus.textContent = "Sube cualquier skin de Trading Paints o iRacing para tapar/reemplazar logos, cambiar letras y poner decals IMSA o de marca.";
    }
    scheduleRender();
    setStatus("Skin importada quitada · Volviendo al modo de diseño de estudio", "ok");
  });

  // Default Stamps Gallery (Trading Paints Paint Builder Pro style)
  const renderDefaultStamps = () => {
    const grid = byId<HTMLElement>("skDefaultStampsGrid");
    if (!grid) return;
    const query = (byId<HTMLInputElement>("skStampSearch")?.value || "").trim().toLowerCase();
    const color = byId<HTMLInputElement>("skStampColor")?.value || state.palette.accent || "#00e699";
    const list = query
      ? DEFAULT_STAMPS.filter((s) => s.label.toLowerCase().includes(query) || s.category.includes(query))
      : DEFAULT_STAMPS;
    grid.innerHTML = list
      .map((s) => {
        const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg(color))}`;
        return `<button type="button" class="sk-btn sk-btn-sm" data-add-stamp="${s.id}" title="${escapeHtml(s.label)}" style="flex-direction:column;gap:4px;padding:6px 4px;height:auto;">
          <img src="${dataUri}" alt="" width="34" height="34" style="object-fit:contain;pointer-events:none;" />
          <span style="font-size:10px;line-height:1.1;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.label)}</span>
        </button>`;
      })
      .join("");

    grid.querySelectorAll<HTMLButtonElement>("[data-add-stamp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stamp = DEFAULT_STAMPS.find((s) => s.id === btn.dataset.addStamp);
        if (!stamp) return;
        pushUndoSnapshot();
        const chosenColor = byId<HTMLInputElement>("skStampColor")?.value || state.palette.accent || "#00e699";
        const z = state.zones[selectedZone || "hood"] || state.zones.hood;
        const layer: DecalLayer = {
          id: `stamp-${Date.now()}`,
          name: `Stamp: ${stamp.label}`,
          kind: "builtin",
          assetId: stamp.id,
          color: chosenColor,
          x: Math.max(0.08, Math.min(0.92, z.x + z.w * 0.5)),
          y: Math.max(0.08, Math.min(0.92, z.y + z.h * 0.5)),
          scale: stamp.defaultScale,
          rotation: 0,
          opacity: 1,
          mirrorX: stamp.category === "stripes" || stamp.category === "racing",
          zoneHint: selectedZone || "hood",
        };
        state.decals.push(layer);
        selectedDecalId = layer.id;
        if (viewMode === "showroom") {
          viewMode = "uv";
          updateViewModeUI();
        }
        renderDecalList();
        renderDecalEditor();
        scheduleRender();
        setStatus(`Stamp "${stamp.label}" añadido · Arrástralo, escala desde la esquina verde o cambia su color`, "ok");
      });
    });
  };

  byId<HTMLInputElement>("skStampSearch")?.addEventListener("input", renderDefaultStamps);
  byId<HTMLInputElement>("skStampColor")?.addEventListener("input", renderDefaultStamps);
  renderDefaultStamps();

  // Undo / Redo stack (Ctrl+Z / Ctrl+Y)
  const undoStack: string[] = [];
  const redoStack: string[] = [];
  const pushUndoSnapshot = () => {
    try {
      undoStack.push(JSON.stringify({ decals: state.decals, palette: state.palette }));
      if (undoStack.length > 35) undoStack.shift();
      redoStack.length = 0;
    } catch {}
  };
  const applySnapshot = (raw: string) => {
    try {
      const snap = JSON.parse(raw) as { decals: DecalLayer[]; palette: SkinDesignState["palette"] };
      state.decals = snap.decals;
      state.palette = snap.palette;
      if (selectedDecalId && !state.decals.some((d) => d.id === selectedDecalId)) selectedDecalId = null;
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
    } catch {}
  };
  const doUndo = () => {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify({ decals: state.decals, palette: state.palette }));
    const prev = undoStack.pop();
    if (prev) applySnapshot(prev);
  };
  const doRedo = () => {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify({ decals: state.decals, palette: state.palette }));
    const next = redoStack.pop();
    if (next) applySnapshot(next);
  };
  byId<HTMLButtonElement>("skUndoBtn")?.addEventListener("click", doUndo);
  byId<HTMLButtonElement>("skRedoBtn")?.addEventListener("click", doRedo);
  window.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      doUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      doRedo();
    }
  });

  byId<HTMLButtonElement>("skAddTextDecal")?.addEventListener("click", () => {
    const txtInput = byId<HTMLInputElement>("skCustomTextInput");
    const txt = txtInput?.value.trim() || "MUNTRUME";
    const layer: DecalLayer = {
      id: `decal-txt-${Date.now()}`,
      name: `Texto: ${txt}`,
      kind: "text",
      text: txt,
      color: state.palette.detail,
      x: 0.5,
      y: 0.44,
      scale: 0.22,
      rotation: 0,
      opacity: 1,
      mirrorX: false,
    };
    state.decals.push(layer);
    selectedDecalId = layer.id;
    renderDecalList();
    renderDecalEditor();
    scheduleRender();
  });

  byId<HTMLInputElement>("skUploadLogoInput")?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const layer: DecalLayer = {
        id: `decal-img-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, ""),
        kind: "custom",
        dataUrl: String(reader.result || ""),
        color: "#ffffff",
        x: 0.165,
        y: 0.58,
        scale: 0.18,
        rotation: 0,
        opacity: 1,
        mirrorX: true,
      };
      state.decals.push(layer);
      selectedDecalId = layer.id;
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
      setStatus(`Logo añadido: ${file.name}`, "ok");
    };
    reader.readAsDataURL(file);
  });

  // 1-Click Pro Motorsport Palettes (inspired by dataset_manifest.json 4,483 iRacing skins)
  document.querySelectorAll<HTMLButtonElement>("[data-quick-pal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parts = String(btn.dataset.quickPal || "").split(",");
      if (parts.length < 5) return;
      state.palette.primary = parts[0];
      state.palette.secondary = parts[1];
      state.palette.accent = parts[2];
      state.palette.detail = parts[3];
      state.pattern = parts[4] as SkinDesignState["pattern"];
      syncControlsFromState();
      scheduleRender();
      setStatus(`Paleta aplicada: ${btn.textContent?.trim() || "Motorsport"}`, "ok");
    });
  });

  // Muntrume AI Full-Auto Designer (1-click complete design for non-experts)
  document.querySelectorAll<HTMLButtonElement>("[data-ai-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const promptEl = byId<HTMLTextAreaElement>("skGeminiPrompt");
      if (promptEl && btn.dataset.aiQuick) {
        promptEl.value = btn.dataset.aiQuick;
      }
      byId<HTMLButtonElement>("skGeminiDesignBtn")?.click();
    });
  });

  function resolveAiDecalAsset(hint: string | undefined, kind: string | undefined, carBrand: string): { kind: DecalLayer["kind"]; dataUrl?: string; shapeType?: "stripe" | "triangle" | "circle"; label: string } {
    const h = String(hint || "").toLowerCase();
    if (kind === "shape" || h === "stripe" || h === "triangle" || h === "circle") {
      const st = h === "triangle" ? "triangle" : h === "circle" ? "circle" : "stripe";
      return { kind: "shape", shapeType: st, label: st === "stripe" ? "Franja Muntrume AI" : st === "triangle" ? "Acento Triangular" : "Círculo" };
    }
    const allLib = [...TEAM_DECALS, ...SERIES_DECALS, ...BRAND_DECALS];
    const exact = allLib.find((i) => i.id === h);
    if (exact) return { kind: "custom", dataUrl: exact.src, label: exact.label };
    if (kind === "brand") {
      const bMatch = BRAND_DECALS.find((b) => b.label.toLowerCase().includes(carBrand.toLowerCase()) || carBrand.toLowerCase().includes(b.label.toLowerCase()));
      if (bMatch) return { kind: "custom", dataUrl: bMatch.src, label: bMatch.label };
    }
    if (kind === "series") {
      return { kind: "custom", dataUrl: SERIES_DECALS[0].src, label: SERIES_DECALS[0].label };
    }
    return { kind: "custom", dataUrl: TEAM_DECALS[0].src, label: TEAM_DECALS[0].label };
  }

  let previousStateBeforeAi: SkinDesignState | null = null;

  byId<HTMLButtonElement>("skGeminiDesignBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skGeminiDesignBtn")!;
    const out = byId<HTMLElement>("skGeminiOutput")!;
    const promptText = byId<HTMLTextAreaElement>("skGeminiPrompt")?.value || "";
    const seriesVal = byId<HTMLSelectElement>("skAiSeriesSelect")?.value || "IMSA Endurance";
    btn.disabled = true;
    setStatus("Muntrume AI diseñando tu coche completo...");
    try {
      const aiRes = await fetchWorkerAiAssist({
        car_slug: state.carId,
        series: seriesVal,
        style: promptText || "MMT Endurance agresivo y limpio",
        driver_number: state.customNumber,
        finish: state.spec.finish,
        zones: state.zones,
        colors: {
          primary: state.palette.primary,
          secondary: state.palette.secondary,
          accent: state.palette.accent,
        },
      });
      const plan = aiRes.design_plan;
      const car = getCarById(state.carId);

      // Guardar instantánea previa para poder deshacer en 1 clic
      previousStateBeforeAi = JSON.parse(JSON.stringify(state)) as SkinDesignState;

      // AUTO-APLICAR TODO LIMPIO (aplica el patrón real de pintura + paleta + acabado + logos en Sponsor Blocks)
      state.name = `${plan.title} · #${state.customNumber}`;
      const allowedPatterns = new Set([
        "solid-factory",
        "pearl-shift",
        "carbon-exposed",
        "forged-carbon",
        "stealth-camo",
        "hex-stealth",
        "topo-flow",
        "halftone-pro",
        "brushed-metal",
        "freeform",
        "endurance",
        "sprint",
        "carbon-stealth",
        "tricolor",
        "clean-minimal",
        "geo-camo",
        "hex-tech",
        "apex-fade",
        "heritage-gulf",
        "factory-chevron",
        "lightning-drift",
      ]);
      const keepColors = Boolean(byId<HTMLInputElement>("skAiKeepColors")?.checked);
      const includeLogos = Boolean(byId<HTMLInputElement>("skAiIncludeLogos")?.checked);

      state.pattern = (allowedPatterns.has(plan.pattern) ? plan.pattern : "pearl-shift") as SkinDesignState["pattern"];
      state.psdPatternName = null;
      state.strokes = [];
      if (!keepColors) {
        state.palette = {
          ...state.palette,
          primary: plan.palette.primary || state.palette.primary,
          secondary: plan.palette.secondary || state.palette.secondary,
          accent: plan.palette.accent || state.palette.accent,
          detail: plan.palette.detail || state.palette.detail,
        };
      }
      state.spec = { finish: plan.finish || "satin", ...finishDefaults(plan.finish || "satin") };

      const newDecals: DecalLayer[] = [];
      if (includeLogos) {
        // Nunca inyectar logos sueltos de fabricante (kind === "brand") porque iRacing ya los incluye en el modelo 3D
        const rawLayers = (Array.isArray(plan.layers) ? plan.layers : [])
          .filter((l) => l && l.kind !== "brand" && String(l.asset_hint || "").toLowerCase() !== "brand")
          .slice(0, 6);
        for (let i = 0; i < rawLayers.length; i++) {
          const l = rawLayers[i];
          const nx = l.x > 1 ? l.x / 2048 : l.x;
          const ny = l.y > 1 ? l.y / 2048 : l.y;
          const asset = resolveAiDecalAsset(l.asset_hint, l.kind, car.brand);
          newDecals.push({
            id: `ai-layer-${Date.now()}-${i}`,
            name: l.element || asset.label,
            kind: asset.kind,
            dataUrl: asset.dataUrl,
            shapeType: asset.shapeType,
            color: l.color || state.palette.accent,
            x: Math.max(0.06, Math.min(0.94, Number.isFinite(nx) ? nx : 0.5)),
            y: Math.max(0.06, Math.min(0.94, Number.isFinite(ny) ? ny : 0.5)),
            scale: Math.max(0.06, Math.min(0.38, Number.isFinite(l.scale) ? l.scale : 0.14)),
            rotation: Number.isFinite(l.rotation) ? l.rotation : 0,
            opacity: 1,
            mirrorX: Boolean(l.mirror_x),
          });
        }
      }

      // Si Muntrume AI no devolvió capas, colocar un kit limpio MMT + Marca + Serie automáticamente
      if (newDecals.length === 0) {
        const brandMatch = BRAND_DECALS.find((b) => car.brand.toLowerCase().includes(b.label.toLowerCase()));
        const seriesMatch = SERIES_DECALS.find((s) => s.label.toLowerCase().includes(seriesVal.toLowerCase().split(" ")[0])) || SERIES_DECALS[0];
        newDecals.push(
          { id: `ai-def-1-${Date.now()}`, name: "Escudo MMT", kind: "custom", dataUrl: TEAM_DECALS[0].src, color: "#ffffff", x: 0.5, y: 0.18, scale: 0.14, rotation: 0, opacity: 1, mirrorX: false },
          { id: `ai-def-2-${Date.now()}`, name: "Muntrume Lateral", kind: "custom", dataUrl: TEAM_DECALS[1].src, color: "#ffffff", x: 0.22, y: 0.56, scale: 0.22, rotation: 0, opacity: 1, mirrorX: true },
          { id: `ai-def-3-${Date.now()}`, name: seriesMatch.label, kind: "custom", dataUrl: seriesMatch.src, color: "#ffffff", x: 0.22, y: 0.42, scale: 0.13, rotation: 0, opacity: 1, mirrorX: true },
        );
        if (brandMatch) {
          newDecals.push({ id: `ai-def-4-${Date.now()}`, name: brandMatch.label, kind: "custom", dataUrl: brandMatch.src, color: "#ffffff", x: 0.5, y: 0.09, scale: 0.08, rotation: 0, opacity: 1, mirrorX: false });
        }
      }

      state.decals = newDecals;
      selectedDecalId = newDecals[0]?.id ?? null;
      customPhotoShots = mapWorkerPhotoGuideToShots(state.carId, state.customNumber, aiRes.photo_guide, state.customerId);
      syncControlsFromState();
      renderPhotoGuide();
      scheduleRender();

      out.innerHTML = `
        <div class="sk-shot-card">
          <strong>✓ Aplicado automáticamente: ${escapeHtml(plan.title)}</strong>
          <p class="sk-help">${escapeHtml(plan.rationale)}</p>
          <div class="sk-row">
            ${Object.values(plan.palette)
              .slice(0, 4)
              .map((hex) => `<span style="width:20px;height:20px;border-radius:4px;background:${hex};border:1px solid rgba(255,255,255,0.2);"></span>`)
              .join("")}
            <span class="sk-tag">${escapeHtml(plan.finish)} · ${newDecals.length} capas</span>
          </div>
          <div class="sk-row" style="margin-top:8px;">
            <button type="button" id="skAiUndoBtn" class="sk-btn sk-btn-sm">↩ Deshacer diseño IA</button>
          </div>
          <p class="sk-help" style="color:var(--sk-accent);margin-top:6px;">Ya está listo en el lienzo. Ve a <strong>Exportar</strong> para descargar tu <code>car_&lt;id&gt;.tga</code> y ver la guía de fotos Trading Paints.</p>
        </div>
      `;
      byId<HTMLButtonElement>("skAiUndoBtn")?.addEventListener("click", () => {
        if (!previousStateBeforeAi) return;
        state = JSON.parse(JSON.stringify(previousStateBeforeAi)) as SkinDesignState;
        previousStateBeforeAi = null;
        selectedDecalId = state.decals[0]?.id ?? null;
        syncControlsFromState();
        renderPhotoGuide();
        scheduleRender();
        out.innerHTML = `<p class="sk-help" style="color:var(--sk-muted);">↩ Cambios de Muntrume AI deshechos. Se restauró tu diseño anterior.</p>`;
        setStatus("Diseño anterior restaurado.", "neutral");
      });
      setStatus(`Muntrume AI aplicó "${plan.title}" (${newDecals.length} capas limpias).`, "ok");
    } catch (err) {
      if (err instanceof SkinsApiError && err.status === 401) {
        lockStudio(err.message);
        return;
      }
      // Resiliencia total ante 429 / límite temporal: aplicar motor local inteligente en lugar de bloquear al usuario
      const pLower = (promptText || "").toLowerCase();
      previousStateBeforeAi = JSON.parse(JSON.stringify(state)) as SkinDesignState;
      const keepColors = Boolean(byId<HTMLInputElement>("skAiKeepColors")?.checked);
      const localPat: PatternStyle = /forjad/.test(pLower)
        ? "forged-carbon"
        : /titanio|cepillad|metal/.test(pLower)
          ? "brushed-metal"
          : /camo|camuflaj|dtm/.test(pLower)
            ? "stealth-camo"
            : /hex|cyber/.test(pLower)
              ? "hex-stealth"
              : /topo|onda|curva/.test(pLower)
                ? "topo-flow"
                : /halftone|punto/.test(pLower)
                  ? "halftone-pro"
                  : /carbon/.test(pLower)
                    ? "carbon-exposed"
                    : /liso|solido|sólido|minimal|fabrica|fábrica/.test(pLower)
                      ? "solid-factory"
                      : "pearl-shift";
      const localFin: FinishType = /mate|matte/.test(pLower)
        ? "matte"
        : /crom|chrome/.test(pLower)
          ? "chrome"
          : /metal/.test(pLower)
            ? "metallic"
            : /carbon/.test(pLower)
              ? "carbon"
              : /brill|gloss/.test(pLower)
                ? "gloss"
                : "satin";
      state.pattern = localPat;
      state.psdPatternName = null;
      state.spec = { finish: localFin, ...finishDefaults(localFin) };
      if (!keepColors) {
        if (/rojo|ferrari|rosso/.test(pLower)) {
          state.palette = { ...state.palette, primary: "#b91c1c", secondary: "#7f1d1d", accent: "#facc15", detail: "#ffffff" };
        } else if (/blanco|white|sprint/.test(pLower)) {
          state.palette = { ...state.palette, primary: "#f1f5f9", secondary: "#cbd5e1", accent: "#00e699", detail: "#0f172a" };
        } else if (/azul|blue|gulf|shark/.test(pLower)) {
          state.palette = { ...state.palette, primary: "#0284c7", secondary: "#0f172a", accent: "#f97316", detail: "#ffffff" };
        } else if (/naranja|papaya|mclaren/.test(pLower)) {
          state.palette = { ...state.palette, primary: "#ea580c", secondary: "#0f172a", accent: "#38bdf8", detail: "#ffffff" };
        } else {
          state.palette = { ...state.palette, primary: "#0f1722", secondary: "#1a2c3a", accent: "#00e699", detail: "#f8fafc" };
        }
      }
      syncControlsFromState();
      scheduleRender();
      out.innerHTML = `<div class="sk-shot-card"><strong>✓ Diseño aplicado (motor rápido local)</strong><p class="sk-help">Límite temporal de API alcanzado; se aplicó <code>${localPat}</code> (${localFin}) al instante sin bloquear tu flujo.</p></div>`;
      setStatus(`Diseño aplicado en modo rápido local (${localPat} · ${localFin}).`, "ok");
    } finally {
      btn.disabled = false;
    }
  });

  // Guía de circuito, luz y ángulos Trading Paints generada con Muntrume AI desde Exportar
  byId<HTMLButtonElement>("skAiPhotoGuideBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skAiPhotoGuideBtn")!;
    btn.disabled = true;
    setStatus("Muntrume AI generando guía de circuito, luz y ángulos Ctrl+F12...");
    try {
      const seriesVal = byId<HTMLSelectElement>("skAiSeriesSelect")?.value || "IMSA Endurance";
      const aiRes = await fetchWorkerAiAssist({
        car_slug: state.carId,
        series: seriesVal,
        style: `Guía de fotografía Trading Paints para acabado ${state.spec.finish}, patrón ${state.pattern} y paleta actual`,
        driver_number: state.customNumber,
        finish: state.spec.finish,
        zones: state.zones,
        colors: {
          primary: state.palette.primary,
          secondary: state.palette.secondary,
          accent: state.palette.accent,
        },
      });
      customPhotoShots = mapWorkerPhotoGuideToShots(state.carId, state.customNumber, aiRes.photo_guide, state.customerId);
      renderPhotoGuide();
      setStatus(`Guía de fotos actualizada (${aiRes.photo_guide.circuit})`, "ok");
    } catch (err) {
      if (err instanceof SkinsApiError && err.status === 401) {
        lockStudio(err.message);
        return;
      }
      setStatus(err instanceof Error ? err.message : "Error generando guía de fotos con IA", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // Export Bindings
  byId<HTMLButtonElement>("skExportTgaBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skExportTgaBtn")!;
    btn.disabled = true;
    try {
      const fn = await exportSingleDiffuseTga(state, (m) => setStatus(m), loadedTemplate?.partsOverlayCanvas, getActivePsdPatternCanvas());
      setStatus(`Exportado ${fn} (${state.resolution}px · base Sim-Stamped)`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error exportando TGA", "err");
    } finally {
      btn.disabled = false;
    }
  });

  byId<HTMLButtonElement>("skExportCustomNumBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skExportCustomNumBtn")!;
    btn.disabled = true;
    try {
      const fn = await exportSingleCustomNumberTga(state, (m) => setStatus(m), loadedTemplate?.partsOverlayCanvas, getActivePsdPatternCanvas());
      setStatus(`Exportado ${fn} (${state.resolution}px · dorsal #${state.customNumber})`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error exportando car_num TGA", "err");
    } finally {
      btn.disabled = false;
    }
  });

  byId<HTMLButtonElement>("skExportSpecBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skExportSpecBtn")!;
    btn.disabled = true;
    try {
      const fn = await exportSingleSpecTga(state, (m) => setStatus(m));
      setStatus(`Exportado ${fn} (${state.resolution}px)`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error exportando Spec Map", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // PNG Export (Diffuse + Spec Map) & Quick Beginner Actions
  const runExportDiffusePng = async (btn?: HTMLButtonElement | null) => {
    if (btn) btn.disabled = true;
    try {
      const fn = await exportSingleDiffusePng(state, (m) => setStatus(m), loadedTemplate?.partsOverlayCanvas, getActivePsdPatternCanvas());
      setStatus(`Exportado ${fn} (${state.resolution}px · PNG listo)`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error exportando PNG", "err");
    } finally {
      if (btn) btn.disabled = false;
    }
  };
  byId<HTMLButtonElement>("skExportPngBtn")?.addEventListener("click", () => {
    void runExportDiffusePng(byId<HTMLButtonElement>("skExportPngBtn"));
  });
  byId<HTMLButtonElement>("skQuickExportPngBtn")?.addEventListener("click", () => {
    void runExportDiffusePng(byId<HTMLButtonElement>("skQuickExportPngBtn"));
  });
  byId<HTMLButtonElement>("skExportSpecPngBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skExportSpecPngBtn")!;
    btn.disabled = true;
    try {
      const fn = await exportSingleSpecPng(state, (m) => setStatus(m));
      setStatus(`Exportado ${fn} (${state.resolution}px · Spec PNG)`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error exportando Spec PNG", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // 1-Click Fullscreen / Expanded 3D & UV Stage
  const workspaceEl = byId<HTMLElement>("skWorkspace");
  const expandBtn = byId<HTMLButtonElement>("skExpandStageBtn");
  const setStageExpanded = (expanded: boolean) => {
    workspaceEl?.classList.toggle("is-expanded", expanded);
    if (expandBtn) {
      expandBtn.classList.toggle("is-active", expanded);
      expandBtn.textContent = expanded ? "↙ Volver a normal" : "⛶ Visor grande";
    }
    requestAnimationFrame(() => {
      if (viewMode === "3d") glEngine.render();
      else applyUvTransform();
    });
  };
  expandBtn?.addEventListener("click", () => {
    setStageExpanded(!workspaceEl?.classList.contains("is-expanded"));
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && workspaceEl?.classList.contains("is-expanded")) {
      setStageExpanded(false);
    }
  });

  // 3D Showroom Auto-Rotate & 1-Click 3D PNG Screenshot
  let glAutoRotate = false;
  byId<HTMLButtonElement>("skGlAutoRotateBtn")?.addEventListener("click", (e) => {
    glAutoRotate = !glAutoRotate;
    glEngine.setAutoRotate(glAutoRotate);
    (e.currentTarget as HTMLButtonElement).classList.toggle("is-active", glAutoRotate);
  });
  byId<HTMLButtonElement>("skGlScreenshotBtn")?.addEventListener("click", () => {
    const car = getCarById(state.carId);
    const fn = `MMT_${car.iracingFolder}_3D_${sanitizeCustomerId(state.customerId)}.png`;
    glEngine.captureScreenshotPng(fn);
    setStatus(`Foto 3D guardada: ${fn}`, "ok");
  });

  // 1-2-3 Beginner Guide Strip Actions
  byId<HTMLButtonElement>("skQuickAutoDesignBtn")?.addEventListener("click", () => {
    byId<HTMLButtonElement>("skAutoRealLiveryBtn")?.click();
  });
  byId<HTMLButtonElement>("skCloseGuideBtn")?.addEventListener("click", () => {
    byId<HTMLElement>("skGuideStrip")?.classList.add("sk-hidden");
  });

  byId<HTMLButtonElement>("skExportZipBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skExportZipBtn")!;
    btn.disabled = true;
    try {
      const car = getCarById(state.carId);
      const shots = customPhotoShots ?? buildDefaultPhotoGuide(car, state);
      const fn = await exportIracingZipBundle(car, state, shots, (m) => setStatus(m), loadedTemplate?.partsOverlayCanvas, getActivePsdPatternCanvas());
      setStatus(`Paquete listo: ${fn}`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error generando ZIP", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // Dynamic per-car real-world & historic motorsport liveries (WEC · IMSA · GTWC · Le Mans · DTM · F1)
  let realLiveryCycleIdx = 0;
  function applyRealLiveryPreset(preset: RealLiveryPreset, carName: string): void {
    state.palette.primary = preset.primary;
    state.palette.secondary = preset.secondary;
    state.palette.accent = preset.accent;
    state.palette.detail = preset.detail;
    state.pattern = preset.pattern;
    state.spec = { finish: preset.finish, ...finishDefaults(preset.finish) };
    state.name = `${preset.label} · ${carName} #${state.customNumber}`;
    ensureCarOfficialBrandDecals(state.carId);
    syncOfficialKitUiForCar(state.carId);
    syncControlsFromState();
    scheduleRender();
    setStatus(`Livery real aplicada (${carName}): ${preset.label} · ${preset.era}`, "ok");
  }

  function renderRealLiveriesForActiveCar(): void {
    const grid = byId<HTMLElement>("skCarRealLiveriesGrid");
    if (!grid) return;
    const car = getCarById(state.carId);
    const list = getRealLiveriesForCar(car.id, car.brand, car.name, car.category);
    grid.innerHTML = list
      .map(
        (p, idx) =>
          `<button type="button" class="sk-pal-chip" data-car-real-idx="${idx}" title="${escapeHtml(p.label)} (${escapeHtml(p.era)} · ${escapeHtml(p.finish)})"><span class="sk-pal-dots"><i style="background:${p.primary}"></i><i style="background:${p.accent}"></i></span>${escapeHtml(p.label)}</button>`,
      )
      .join("");
    grid.querySelectorAll<HTMLButtonElement>("[data-car-real-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.carRealIdx || 0);
        const preset = list[idx];
        if (!preset) return;
        realLiveryCycleIdx = (idx + 1) % list.length;
        applyRealLiveryPreset(preset, car.name);
      });
    });
  }

  byId<HTMLButtonElement>("skAutoRealLiveryBtn")?.addEventListener("click", () => {
    const car = getCarById(state.carId);
    const list = getRealLiveriesForCar(car.id, car.brand, car.name, car.category);
    const preset = list[realLiveryCycleIdx % list.length];
    realLiveryCycleIdx = (realLiveryCycleIdx + 1) % list.length;
    if (preset) applyRealLiveryPreset(preset, car.name);
  });
  renderRealLiveriesForActiveCar();
  carSelect?.addEventListener("change", () => {
    realLiveryCycleIdx = 0;
    renderRealLiveriesForActiveCar();
  });

  // Direct Live Bridge to Documents\iRacing\paint\<car>\ for instant Ctrl+R 3D preview in iRacing
  let iracingPaintDirHandle: any = null;
  const linkDirBtn = byId<HTMLButtonElement>("skLinkIracingDirBtn");
  const sendLiveBtn = byId<HTMLButtonElement>("skSendLiveIracingBtn");
  const dirStatusEl = byId<HTMLElement>("skIracingDirStatus");

  linkDirBtn?.addEventListener("click", async () => {
    const picker = (window as any).showDirectoryPicker;
    if (typeof picker !== "function") {
      setStatus("Tu navegador no soporta File System Access API (usa Chrome o Edge).", "err");
      return;
    }
    try {
      iracingPaintDirHandle = await picker({ mode: "readwrite" });
      if (sendLiveBtn) sendLiveBtn.disabled = false;
      if (dirStatusEl) {
        dirStatusEl.innerHTML = `Carpeta vinculada: <strong style="color:#34d399">${escapeHtml(iracingPaintDirHandle.name)}</strong> · Pulsa <strong>Enviar a iRacing</strong> y luego <strong>Ctrl+R</strong> en el simulador.`;
      }
      setStatus(`Carpeta vinculada (${iracingPaintDirHandle.name}). Listo para Ctrl+R en vivo.`, "ok");
    } catch {}
  });

  sendLiveBtn?.addEventListener("click", async () => {
    if (!iracingPaintDirHandle) {
      setStatus("Vincula primero tu carpeta Documents\\iRacing\\paint\\.", "err");
      return;
    }
    sendLiveBtn.disabled = true;
    try {
      const car = getCarById(state.carId);
      const written = await exportDirectToIracingFolder(
        iracingPaintDirHandle,
        car,
        state,
        (m) => setStatus(m),
        loadedTemplate?.partsOverlayCanvas,
        getActivePsdPatternCanvas(),
      );
      setStatus(`Guardados ${written.join(", ")} en paint\\${car.iracingFolder}\\ — ¡Pulsa Ctrl+R en iRacing!`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error escribiendo en carpeta iRacing", "err");
    } finally {
      sendLiveBtn.disabled = false;
    }
  });

  // ─── Muntrume Motorsport (MMT) Team Presets, Click-to-Slot Sponsors & Fleet JSON ───
  let activeTeamSlot: TeamSlotId = "hood_main";

  function applySlotAsset(slotId: TeamSlotId, assetId: string | null, colorOverride?: string, silent = false): void {
    const mainId = makeSlotDecalId(slotId, "main");
    const pairId = makeSlotDecalId(slotId, "pair");
    state.decals = state.decals.filter((d) => d.id !== mainId && d.id !== pairId);

    if (assetId) {
      const asset = getSlotAssetById(assetId);
      if (asset) {
        const layout = resolveTeamLayoutForCar(state.carId, state.zones);
        const created = buildDecalsForSlot(slotId, asset, layout, colorOverride);
        state.decals.push(...created);
        selectedDecalId = created[0]?.id ?? null;
        if (!silent) {
          setStatus(
            `Slot "${TEAM_SLOT_META[slotId].label}" → ${asset.label}${created.length > 1 ? " (Izq 0° + Der 180°)" : ""}.`,
            "ok",
          );
        }
      }
    } else if (!silent) {
      setStatus(`Slot "${TEAM_SLOT_META[slotId].label}" vaciado.`, "ok");
    }

    if (!silent) {
      renderSmartSlotsUI();
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
    }
  }

  function remapActiveSlotsToCurrentCar(): void {
    const currentSlots = extractCurrentSlotsFromDecals(state.decals);
    const slotIds = Object.keys(currentSlots) as TeamSlotId[];
    if (slotIds.length === 0) return;
    for (const slotId of slotIds) {
      const assignment = currentSlots[slotId];
      if (assignment) {
        applySlotAsset(slotId, assignment.assetId, assignment.color, true);
      }
    }
  }

  function applyTeamPresetConfig(
    cfg: {
      name: string;
      pattern: PatternStyle;
      palette: SkinDesignState["palette"];
      spec: SkinDesignState["spec"];
      fontStyle: SkinDesignState["fontStyle"];
      showNumberOnCar: boolean;
      slots: Partial<Record<TeamSlotId, SlotAssignment>>;
    },
    keepBasePaint = false,
  ): void {
    const car = getCarById(state.carId);
    if (!keepBasePaint) {
      state.pattern = cfg.pattern;
      state.psdPatternName = null;
      state.palette = { ...cfg.palette };
      state.spec = { ...cfg.spec };
      state.fontStyle = cfg.fontStyle;
      state.showNumberOnCar = cfg.showNumberOnCar;
      state.name = `${cfg.name} · ${car.name} #${state.customNumber}`;
    }

    // Replace only slot-managed layers (preserve user's custom uploaded decals & official UV kits)
    state.decals = state.decals.filter((d) => !d.id.startsWith(SLOT_DECAL_PREFIX));
    for (const slotId of TEAM_SLOT_ORDER) {
      const assignment = cfg.slots[slotId];
      if (assignment) {
        applySlotAsset(slotId, assignment.assetId, assignment.color, true);
      }
    }

    syncControlsFromState();
    renderSmartSlotsUI();
    renderDecalList();
    renderDecalEditor();
    scheduleRender();
    setStatus(
      `★ ${cfg.name} aplicada a ${car.name} (#${state.customNumber} ${state.customDriverName}) con slots MMT calibrados.`,
      "ok",
    );
  }

  function renderQuickDriverPills(): void {
    const host = byId<HTMLElement>("skQuickDriverBar");
    if (!host) return;
    host.innerHTML = DRIVER_PROFILES.map((d) => {
      const active = state.driverId === d.id;
      const first = d.id === "custom" ? "Custom" : d.name.split(" ")[0];
      return `<button type="button" class="sk-btn sk-btn-sm ${active ? "sk-btn-primary" : ""}" data-quick-drv="${escapeHtml(d.id)}" style="font-size:10.5px;padding:3px 7px;">#${escapeHtml(d.number)} ${escapeHtml(first)}</button>`;
    }).join("");

    host.querySelectorAll<HTMLButtonElement>("[data-quick-drv]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const drv = getDriverById(btn.dataset.quickDrv || "albertot");
        const saved = loadDriverPrefs()[drv.id];
        state.driverId = drv.id;
        state.customDriverName = saved?.name || drv.name;
        state.customNumber = saved?.number || drv.number;
        state.customerId = saved?.customerId || drv.customerId;
        customPhotoShots = null;
        syncControlsFromState();
        renderQuickDriverPills();
        scheduleRender();
        setStatus(`Piloto activo: #${state.customNumber} ${state.customDriverName} (ID iRacing: ${state.customerId}).`, "ok");
      });
    });
  }

  function renderSmartSlotsUI(): void {
    const slotsGrid = byId<HTMLElement>("skSmartSlotsGrid");
    const header = byId<HTMLElement>("skSlotPickerHeader");
    const assetGrid = byId<HTMLElement>("skSlotAssetGrid");
    const colorInput = byId<HTMLInputElement>("skSlotColorInput");
    if (!slotsGrid || !assetGrid) return;

    const assigned = extractCurrentSlotsFromDecals(state.decals);
    slotsGrid.innerHTML = TEAM_SLOT_ORDER.map((slotId) => {
      const meta = TEAM_SLOT_META[slotId];
      const current = assigned[slotId];
      const asset = current ? getSlotAssetById(current.assetId) : null;
      const isSelected = slotId === activeTeamSlot;
      return `
        <button type="button" class="sk-btn sk-btn-sm" data-team-slot="${slotId}" style="flex-direction:column;align-items:flex-start;gap:2px;padding:6px 8px;text-align:left;${
          isSelected
            ? "border-color:rgba(0,230,153,0.75);background:rgba(0,230,153,0.16);color:#ecfdf5;"
            : "border-color:rgba(255,255,255,0.12);"
        }">
          <span style="font-size:10.5px;font-weight:800;">${escapeHtml(meta.shortLabel)}</span>
          <span style="font-size:9.5px;opacity:0.78;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${
            asset ? escapeHtml(asset.shortLabel) : "Vacío"
          }</span>
        </button>`;
    }).join("");

    slotsGrid.querySelectorAll<HTMLButtonElement>("[data-team-slot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTeamSlot = (btn.dataset.teamSlot as TeamSlotId) || "hood_main";
        const cur = assigned[activeTeamSlot];
        if (colorInput && cur?.color) colorInput.value = cur.color;
        renderSmartSlotsUI();
      });
    });

    const activeMeta = TEAM_SLOT_META[activeTeamSlot];
    if (header) header.textContent = `Slot activo: ${activeMeta.label}`;
    const activeAssigned = assigned[activeTeamSlot];
    if (colorInput && activeAssigned?.color) colorInput.value = activeAssigned.color;

    assetGrid.innerHTML = QUICK_SLOT_ASSETS.map((a) => {
      const isActiveAsset = activeAssigned?.assetId === a.id;
      const badgeColor = a.category === "mmt" ? "#00e699" : a.category === "web" ? "#38bdf8" : "#f59e0b";
      return `
        <button type="button" class="sk-btn sk-btn-sm" data-slot-asset="${escapeHtml(a.id)}" title="${escapeHtml(a.label)}" style="flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 4px;min-height:46px;${
          isActiveAsset
            ? "border-color:rgba(0,230,153,0.85);background:rgba(0,230,153,0.2);"
            : ""
        }">
          <span style="width:100%;height:3px;border-radius:99px;background:${badgeColor};opacity:0.75;"></span>
          <span style="font-size:9.5px;font-weight:700;line-height:1.15;text-align:center;">${escapeHtml(a.shortLabel)}</span>
        </button>`;
    }).join("");

    assetGrid.querySelectorAll<HTMLButtonElement>("[data-slot-asset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const assetId = btn.dataset.slotAsset;
        if (!assetId) return;
        const asset = getSlotAssetById(assetId);
        if (!asset) return;
        const chosenColor = asset.kind === "builtin" && colorInput ? colorInput.value || asset.defaultColor : asset.defaultColor;
        applySlotAsset(activeTeamSlot, assetId, chosenColor);
      });
    });
  }

  function renderFleetPresetList(): void {
    const host = byId<HTMLElement>("skFleetPresetList");
    if (!host) return;
    const list = loadSavedFleetPresets();
    if (list.length === 0) {
      host.innerHTML = `<p class="sk-help" style="margin:0;">Guarda tu base de colores + sponsors para aplicarla a cualquier GT3/GTP en 1 clic.</p>`;
      return;
    }
    host.innerHTML = list
      .map(
        (p) => `
        <div class="sk-list-item">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;" title="Origen: ${escapeHtml(p.sourceCarId)}">${escapeHtml(p.name)}</span>
          <div class="sk-row" style="gap:4px;">
            <button type="button" class="sk-btn sk-btn-sm sk-btn-primary" data-apply-fleet="${escapeHtml(p.id)}">Aplicar</button>
            <button type="button" class="sk-btn sk-btn-sm sk-btn-danger" data-del-fleet="${escapeHtml(p.id)}">×</button>
          </div>
        </div>`,
      )
      .join("");

    host.querySelectorAll<HTMLButtonElement>("[data-apply-fleet]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = list.find((item) => item.id === btn.dataset.applyFleet);
        if (!target) return;
        applyTeamPresetConfig(target, false);
      });
    });

    host.querySelectorAll<HTMLButtonElement>("[data-del-fleet]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.delFleet;
        if (!id) return;
        deleteFleetPreset(id);
        renderFleetPresetList();
      });
    });
  }

  // Wire Official MMT Team Preset selector + 1-click Apply button
  const teamPresetSel = byId<HTMLSelectElement>("skTeamPresetSelect");
  const teamPresetDesc = byId<HTMLElement>("skTeamPresetDesc");
  if (teamPresetSel) {
    teamPresetSel.innerHTML = MMT_TEAM_PRESETS.map(
      (p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`,
    ).join("");
    const updatePresetDesc = () => {
      const found = MMT_TEAM_PRESETS.find((p) => p.id === teamPresetSel.value) ?? MMT_TEAM_PRESETS[0];
      if (teamPresetDesc && found) teamPresetDesc.textContent = found.tagline;
    };
    updatePresetDesc();
    teamPresetSel.addEventListener("change", updatePresetDesc);
  }

  byId<HTMLButtonElement>("skApplyMmtBaseBtn")?.addEventListener("click", () => {
    const id = teamPresetSel?.value || MMT_TEAM_PRESETS[0].id;
    const preset = MMT_TEAM_PRESETS.find((p) => p.id === id) ?? MMT_TEAM_PRESETS[0];
    applyTeamPresetConfig(preset, false);
  });

  byId<HTMLButtonElement>("skClearActiveSlotBtn")?.addEventListener("click", () => {
    applySlotAsset(activeTeamSlot, null);
  });

  byId<HTMLInputElement>("skSlotColorInput")?.addEventListener("input", (e) => {
    const nextColor = (e.target as HTMLInputElement).value;
    const assigned = extractCurrentSlotsFromDecals(state.decals)[activeTeamSlot];
    if (assigned) {
      applySlotAsset(activeTeamSlot, assigned.assetId, nextColor);
    }
  });

  const buildCurrentFleetPreset = (): PortableTeamPreset => ({
    kind: "mmt-team-preset-v1",
    id: `fleet-${Date.now()}`,
    name: (state.name || `MMT Flota ${new Date().toLocaleDateString("es-ES")}`).trim(),
    createdAt: new Date().toISOString(),
    sourceCarId: state.carId,
    pattern: state.pattern,
    palette: { ...state.palette },
    spec: { ...state.spec },
    fontStyle: state.fontStyle,
    showNumberOnCar: state.showNumberOnCar,
    slots: extractCurrentSlotsFromDecals(state.decals),
  });

  byId<HTMLButtonElement>("skSaveFleetPresetBtn")?.addEventListener("click", () => {
    const preset = buildCurrentFleetPreset();
    saveFleetPreset(preset);
    renderFleetPresetList();
    setStatus(`Preset de flota guardado: "${preset.name}" (listo para aplicar a cualquier coche).`, "ok");
  });

  byId<HTMLButtonElement>("skExportFleetJsonBtn")?.addEventListener("click", () => {
    const preset = buildCurrentFleetPreset();
    const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mmt-team-preset";
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.mmt-preset.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus(`Preset de flota exportado: ${slug}.mmt-preset.json`, "ok");
  });

  byId<HTMLInputElement>("skImportFleetJsonInput")?.addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as PortableTeamPreset | SkinDesignState;
      if ((parsed as PortableTeamPreset).kind === "mmt-team-preset-v1") {
        const fleet = parsed as PortableTeamPreset;
        saveFleetPreset(fleet);
        renderFleetPresetList();
        applyTeamPresetConfig(fleet, false);
      } else if ((parsed as SkinDesignState).palette && (parsed as SkinDesignState).zones) {
        // Also gracefully accept standard skins.muntru.me JSON and remap its slots onto the current car
        const full = parsed as SkinDesignState;
        const converted: PortableTeamPreset = {
          kind: "mmt-team-preset-v1",
          id: `fleet-imp-${Date.now()}`,
          name: full.name || file.name.replace(/\.json$/i, ""),
          createdAt: new Date().toISOString(),
          sourceCarId: full.carId || state.carId,
          pattern: full.pattern,
          palette: { ...full.palette },
          spec: { ...full.spec },
          fontStyle: full.fontStyle,
          showNumberOnCar: full.showNumberOnCar,
          slots: extractCurrentSlotsFromDecals(full.decals || []),
        };
        saveFleetPreset(converted);
        renderFleetPresetList();
        applyTeamPresetConfig(converted, false);
      } else {
        throw new Error("El archivo JSON no es un preset de equipo válido.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error importando preset de equipo JSON", "err");
    } finally {
      input.value = "";
    }
  });

  // Automatically remap active MMT slots when switching cars and sync pilot pills on driver change
  carSelect?.addEventListener("change", () => {
    remapActiveSlotsToCurrentCar();
    renderSmartSlotsUI();
    renderDecalList();
    scheduleRender();
  });
  drvSelect?.addEventListener("change", () => {
    renderQuickDriverPills();
  });

  renderQuickDriverPills();
  renderSmartSlotsUI();
  renderFleetPresetList();

  // ─── Compact 100dvh Symmetrical UI Bindings ───
  // Left block switcher: Plantilla UV vs Editar .TGA
  document.querySelectorAll<HTMLButtonElement>("[data-left-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.leftTab || "template";
      document.querySelectorAll<HTMLButtonElement>("[data-left-tab]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.leftTab === target);
      });
      byId<HTMLElement>("skLeftPanel-template")?.classList.toggle("sk-hidden", target !== "template");
      byId<HTMLElement>("skLeftPanel-import")?.classList.toggle("sk-hidden", target !== "import");
    });
  });

  // Topbar quick Exportar .TGA + Reset view + Muntrume AI switcher
  byId<HTMLButtonElement>("skHeaderExportTgaBtn")?.addEventListener("click", () => {
    byId<HTMLButtonElement>("skExportTgaBtn")?.click();
  });
  byId<HTMLButtonElement>("skTopResetCamBtn")?.addEventListener("click", () => {
    if (viewMode === "3d") {
      glEngine.setCameraPreset("front34");
    } else {
      byId<HTMLButtonElement>("skZoomReset")?.click();
    }
  });
  byId<HTMLButtonElement>("skOpenAiTabBtn")?.addEventListener("click", () => {
    rightTab = "gemini";
    updateRightTabUI();
  });

  // Compact Reference Livery Dropdown (replaces long open chip grid)
  function syncRealLiveryDropdown(): void {
    const sel = byId<HTMLSelectElement>("skRealLiverySelect");
    if (!sel) return;
    const car = getCarById(state.carId);
    const list = getRealLiveriesForCar(car.id, car.brand, car.name, car.category);
    sel.innerHTML = [
      `<option value="">— Seleccionar livery de referencia (${list.length}) —</option>`,
      ...list.map((p, idx) => `<option value="${idx}">${escapeHtml(p.label)} (${escapeHtml(p.era)})</option>`),
    ].join("");
  }
  byId<HTMLSelectElement>("skRealLiverySelect")?.addEventListener("change", (e) => {
    const val = (e.target as HTMLSelectElement).value;
    if (val === "") return;
    const idx = Number(val);
    const car = getCarById(state.carId);
    const list = getRealLiveriesForCar(car.id, car.brand, car.name, car.category);
    const preset = list[idx];
    if (preset) applyRealLiveryPreset(preset, car.name);
  });
  syncRealLiveryDropdown();
  carSelect?.addEventListener("change", () => syncRealLiveryDropdown());

  // 2x3 Symmetrical Finish Preset Buttons in Acabado tab
  const syncFinishPresetButtons = () => {
    document.querySelectorAll<HTMLButtonElement>("[data-finish-preset]").forEach((btn) => {
      btn.classList.toggle("sk-btn-primary", btn.dataset.finishPreset === state.spec.finish);
    });
  };
  document.querySelectorAll<HTMLButtonElement>("[data-finish-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = (btn.dataset.finishPreset || "gloss") as FinishType;
      const finSel = byId<HTMLSelectElement>("skFinishSelect");
      if (finSel) {
        finSel.value = f;
        finSel.dispatchEvent(new Event("change"));
      }
      syncFinishPresetButtons();
    });
  });
  syncFinishPresetButtons();

  // Quick Layer Action Row in Capas tab (+ Logo MMT, + muntru.me)
  byId<HTMLButtonElement>("skQuickAddMmtLogoBtn")?.addEventListener("click", () => {
    applySlotAsset("hood_main", "slot-mmt-escudo", "#ffffff");
  });
  byId<HTMLButtonElement>("skQuickAddWebBtn")?.addEventListener("click", () => {
    applySlotAsset("rear_bumper", "slot-muntru-url-white", "#ffffff");
  });

  // Init: verify active muntru.me Vault session before unlocking studio
  void verifyVaultSession();
  window.addEventListener("resize", () => {
    if (!vaultAuthenticated) return;
    if (viewMode === "3d") glEngine.render();
    else applyUvTransform();
  });
}
