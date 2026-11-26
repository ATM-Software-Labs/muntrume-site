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
import { renderPatternThumbnail, renderSkinToCanvas, renderSpecMapToCanvas, type ReservedGuideBox } from "./compositor";
import { renderShowroomCarView, type ShowroomAngle } from "./car-showroom-view";
import { BRAND_DECALS, SERIES_DECALS, TEAM_DECALS, type LibraryDecalItem } from "./decals-library";
import { DEFAULT_STAMPS } from "./stamps-library";
import {
  exportIracingZipBundle,
  exportPresetJson,
  exportSingleCustomNumberTga,
  exportSingleDiffuseTga,
  exportSingleSpecTga,
  sanitizeCustomerId,
} from "./exporter";
import { buildDefaultPhotoGuide, contrastRatio } from "./photo-guide";
import { WebGLPreviewEngine, mapCategoryStringToBody, type LightingPreset, type UvMappingMode } from "./preview-3d";
import { deleteCarModel, loadCarModel, saveCarModel } from "../model-store";
import { getLocalUvMap } from "./uv-maps-loader";
import { analyzeTemplateZones, loadTemplateFile, type LoadedTemplate } from "./template-analyzer";
import { getArchetypeZones, lazyLoadCarUv, saveLocalCalibration } from "./uv-archetypes";
import carsIndexData from "../../data/cars-index.json";
import {
  SkinsApiError,
  fetchWorkerAiAssist,
  fetchWorkerCars,
  fetchWorkerUvMap,
  getVaultToken,
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
type RightTab = "design" | "decals" | "gemini" | "export";

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

  function populateCarSelectorFromWorker(): void {
    const sel = byId<HTMLSelectElement>("skCarSelect");
    if (!sel) return;
    const order = [
      "GT3",
      "GTP / Hypercar",
      "LMP2 / LMP3",
      "LMP2 / Prototipos",
      "GT4 & Cup",
      "Fórmula",
      "NASCAR / Oval",
      "Stock Cars & Oval",
      "TCR & Producción",
      "Dirt / Rallycross",
      "TCR / Turismo / Dirt",
      "Piloto (Casco y Mono)",
    ];
    const searchQ = (byId<HTMLInputElement>("skCarSearch")?.value || "").trim().toLowerCase();
    const mergedMap = new Map<
      string,
      { car_slug: string; name: string; brand: string; category: string; iracing_folder: string; uv_status: string }
    >();
    for (const c of (carsIndexData?.cars || []) as Array<{
      car_slug: string;
      name: string;
      brand?: string;
      category?: string;
      uv_status?: string;
    }>) {
      mergedMap.set(c.car_slug, {
        car_slug: c.car_slug,
        name: c.name,
        brand: c.brand || "iRacing",
        category: c.category || "TCR & Producción",
        iracing_folder: c.car_slug,
        uv_status: c.uv_status || "archetype",
      });
    }
    for (const c of CAR_PROFILES) {
      mergedMap.set(c.id, {
        car_slug: c.id,
        name: c.name,
        brand: c.brand,
        category: c.category,
        iracing_folder: c.iracingFolder,
        uv_status: mergedMap.get(c.id)?.uv_status || "baseline",
      });
    }
    for (const w of workerCarsCatalog) {
      mergedMap.set(w.car_slug, {
        ...w,
        category: w.category || "TCR & Producción",
      });
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
    workerSponsorBlocks = Array.isArray(rawZones?.sponsor_blocks)
      ? (rawZones.sponsor_blocks as Array<{ id: string; cx: number; cy: number; nw: number; nh: number }>)
      : [];
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
    glEngine.resetToProofingBuck();
    glEngine.setCategory(mapCategoryStringToBody(effectiveCategory));
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

    // 2. Optionally enrich with Worker wireframe SVG & official plates if available in D1 (never fail UI on 404)
    if (!vaultAuthenticated) return;
    try {
      const uv = await fetchWorkerUvMap(carSlug);
      if (state.carId !== carSlug) return;
      applyUvResponseToState(carSlug, uv);
      workerWireframeCanvas = await renderSvgStringToCanvas(uv.wireframe_svg || "");
      if (infoEl) {
        infoEl.textContent = `Plantilla UV limpia cargada automáticamente (${uv.car_name} · ${uv.native_resolution}). Cambia colores, patrón y sponsors encima.`;
      }
      if (notesEl) {
        notesEl.textContent = `Carpeta iRacing: paint/${uv.iracing_folder}/ · Estado UV: ${uv.uv_status === "extracted" ? "Plantilla vectorial calibrada ✓" : "Base calibrada ✓"}`;
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

  // UV Pan/Zoom state
  let uvZoom = 1;
  let uvPanX = 0;
  let uvPanY = 0;

  const showroomCanvas = byId<HTMLCanvasElement>("skShowroomCanvas")!;
  const uvCanvas = byId<HTMLCanvasElement>("skUvCanvas")!;
  const glCanvas = byId<HTMLCanvasElement>("skGlCanvas")!;
  const offscreenTexture = document.createElement("canvas");
  offscreenTexture.width = 1024;
  offscreenTexture.height = 1024;

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
          await renderSkinToCanvas(uvCanvas, state, {
            size: 1024,
            templateCanvas: loadedTemplate?.wireframeCanvas ?? loadedTemplate?.canvas ?? workerWireframeCanvas,
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
          await renderSkinToCanvas(offscreenTexture, state, {
            size: 1024,
            partsOverlayCanvas: loadedTemplate?.partsOverlayCanvas ?? null,
            psdPatternCanvas: psdPatCanvas,
            forExport: true,
          });
          const offscreenSpec = document.createElement("canvas");
          offscreenSpec.width = 256;
          offscreenSpec.height = 256;
          renderSpecMapToCanvas(offscreenSpec, state, 256);
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
    (["design", "decals", "gemini", "export"] as RightTab[]).forEach((t) => {
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

  let dragMode: "none" | "pan" | "zone-move" | "zone-resize" | "decal-move" | "decal-resize" | "brush" = "none";
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

    if (dragMode === "brush" && activeStroke) {
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

  const endUvDrag = () => {
    if (dragMode === "zone-move" || dragMode === "zone-resize") renderZoneList();
    if (dragMode === "decal-move" || dragMode === "decal-resize") renderDecalEditor();
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

  // 1-Click GT-style sponsor placement onto exact car zones
  document.querySelectorAll<HTMLButtonElement>("[data-quick-zone]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const zk = btn.dataset.quickZone as ZoneKey;
      const rect = state.zones[zk];
      if (!rect) return;
      const isSide = zk === "leftSide" || zk === "rightSide";
      const layer: DecalLayer = {
        id: `decal-q-${Date.now()}`,
        name: `MUNTRUME (${rect.label})`,
        kind: "builtin",
        assetId: zk === "hood" ? "mmt-crest" : zk === "rearWing" ? "muntru-url" : "mmt-wordmark",
        color: zk === "rearWing" ? "#090b0f" : "#ffffff",
        x: Number((rect.x + rect.w * 0.5).toFixed(3)),
        y: Number((rect.y + rect.h * 0.55).toFixed(3)),
        scale: zk === "hood" ? 0.14 : zk === "rearWing" ? 0.28 : 0.20,
        rotation: 0,
        opacity: 1,
        mirrorX: isSide,
        zoneHint: zk,
      };
      state.decals.push(layer);
      selectedDecalId = layer.id;
      rightTab = "decals";
      if (zk === "hood" || zk === "roof") showroomAngle = "top";
      else if (zk === "rearWing") showroomAngle = "rear";
      else if (zk === "frontBumper") showroomAngle = "front";
      else showroomAngle = "side";
      document.querySelectorAll<HTMLButtonElement>("[data-showroom-angle]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.showroomAngle === showroomAngle);
      });
      updateRightTabUI();
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
      setStatus(`Sponsor colocado en ${rect.label}${isSide ? " (con simetría L↔R)" : ""}.`, "ok");
    });
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
    setStatus(`Modelo cacheado eliminado para ${state.carId}. Restaurada carrocería paramétrica.`, "neutral");
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
      // Actualizar automáticamente el logo de marca si había uno del coche anterior
      const nextBrandDecal = BRAND_DECALS.find(
        (b) =>
          b.label.toLowerCase().includes(nextCar.brand.toLowerCase()) ||
          nextCar.brand.toLowerCase().includes(b.label.toLowerCase()),
      );
      if (nextBrandDecal) {
        for (const d of state.decals) {
          if (d.dataUrl && d.dataUrl.includes("/assets/brand/logos/")) {
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
      loadedTemplate = null;
      customPhotoShots = null;
      glEngine.setCategory(mapCategoryStringToBody(effectiveCategory));
      glEngine.updateZones(state.zones);
      syncControlsFromState();
      scheduleRender();

      // Auto-restore cached .GLB / .GLTF for this car_slug from IndexedDB (or sculpted category bodywork)
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
        const autoMirror =
          realSlot ? false : defaultMirror || targetZoneKey === "leftSide" || targetZoneKey === "rightSide";
        const autoX = realSlot
          ? Math.max(0.05, Math.min(0.95, realSlot.cx))
          : Math.max(0.06, Math.min(0.94, z.x + z.w * 0.5));
        const autoY = realSlot
          ? Math.max(0.05, Math.min(0.95, realSlot.cy))
          : Math.max(
              0.06,
              Math.min(0.94, z.y + z.h * (item.group === "brand" && targetZoneKey === "hood" ? 0.28 : 0.5)),
            );
        const autoScale = realSlot
          ? Math.max(0.06, Math.min(0.24, Math.max(realSlot.nw, realSlot.nh) * 0.8))
          : Math.max(
              0.08,
              Math.min(0.32, Math.min(z.w, z.h) * (item.group === "brand" ? 0.48 : 0.65)),
            );
        const layer: DecalLayer = {
          id: `decal-lib-${Date.now()}`,
          name: item.label,
          kind: "custom",
          dataUrl: item.src,
          color: "#ffffff",
          x: autoX,
          y: autoY,
          scale: autoScale || (item.defaultScale ?? 0.16),
          rotation: 0,
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
  mountLibraryDecals("skSeriesDecals", SERIES_DECALS, true);
  mountLibraryDecals("skBrandDecals", BRAND_DECALS, false);

  // Official iRacing 1-click UV layers (brand decals, IMSA, GT3 plates, wireframe)
  type OfficialKitManifest = Record<string, { sourceSlug: string; layers: Record<string, string> }>;
  let officialKits: OfficialKitManifest = {};
  fetch("/assets/skins/kits/manifest.json")
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: OfficialKitManifest) => {
      officialKits = data || {};
    })
    .catch(() => {});

  const toggleOfficialUvLayer = (layerKey: "brand_decals" | "imsa_decals" | "series_blocks" | "wireframe", label: string) => {
    const kit = officialKits[state.carId];
    const url = kit?.layers?.[layerKey];
    if (!url) {
      setStatus(`Este coche (${state.carId}) no tiene capa oficial "${label}" en su plantilla iRacing`, "neutral");
      return;
    }
    const layerId = `official-uv-${state.carId}-${layerKey}`;
    const existingIdx = state.decals.findIndex((d) => d.id === layerId);
    if (existingIdx !== -1) {
      state.decals.splice(existingIdx, 1);
      if (selectedDecalId === layerId) selectedDecalId = null;
      renderDecalList();
      renderDecalEditor();
      scheduleRender();
      setStatus(`Capa oficial "${label}" quitada`, "ok");
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
    scheduleRender();
    setStatus(`Capa oficial "${label}" aplicada al píxel exacto sobre ${getCarById(state.carId).name}`, "ok");
  };

  byId<HTMLButtonElement>("skKitAddBrand")?.addEventListener("click", () => toggleOfficialUvLayer("brand_decals", "Logos Marca iRacing"));
  byId<HTMLButtonElement>("skKitAddImsa")?.addEventListener("click", () => toggleOfficialUvLayer("imsa_decals", "Etiquetas IMSA"));
  byId<HTMLButtonElement>("skKitAddSeries")?.addEventListener("click", () => toggleOfficialUvLayer("series_blocks", "Placas GT3 / Dorsales"));
  byId<HTMLButtonElement>("skKitAddWire")?.addEventListener("click", () => toggleOfficialUvLayer("wireframe", "Cascarón UV Wireframe"));

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

  // Init: verify active muntru.me Vault session before unlocking studio
  void verifyVaultSession();
  window.addEventListener("resize", () => {
    if (!vaultAuthenticated) return;
    if (viewMode === "3d") glEngine.render();
    else applyUvTransform();
  });
}
