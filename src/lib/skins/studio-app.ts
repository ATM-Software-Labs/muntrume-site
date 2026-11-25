import {
  BUILTIN_DECALS,
  CAR_CATEGORY_ORDER,
  CAR_PROFILES,
  DRIVER_PROFILES,
  SKIN_PRESETS,
  cloneZones,
  createInitialDesign,
  getCarById,
  getDriverById,
} from "./catalog";
import { renderSkinToCanvas, renderSpecMapToCanvas } from "./compositor";
import { renderShowroomCarView, type ShowroomAngle } from "./car-showroom-view";
import {
  exportIracingZipBundle,
  exportPresetJson,
  exportSingleDiffuseTga,
  exportSingleSpecTga,
  sanitizeCustomerId,
} from "./exporter";
import {
  getSavedGeminiKey,
  requestGeminiDesignReview,
  requestGeminiPhotoAdaptation,
  saveGeminiKey,
} from "./gemini-copilot";
import { buildDefaultPhotoGuide, contrastRatio } from "./photo-guide";
import { WebGLPreviewEngine } from "./preview-3d";
import { analyzeTemplateZones, loadTemplateFile, type LoadedTemplate } from "./template-analyzer";
import {
  SkinsApiError,
  fetchWorkerAiAssist,
  fetchWorkerCars,
  fetchWorkerUvMap,
  getVaultToken,
  mapWorkerPhotoGuideToShots,
  mapWorkerUvToZones,
  setVaultToken,
} from "./vault-client";
import type {
  DecalLayer,
  FinishType,
  PhotoGuideShot,
  ResolutionMode,
  SkinDesignState,
  ZoneKey,
} from "./types";

const STATE_STORAGE_KEY = "mmt-skins-active-design-v1";
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
  let viewMode: ViewMode = "showroom";
  let showroomAngle: ShowroomAngle = "side";
  let rightTab: RightTab = "design";
  let loadedTemplate: LoadedTemplate | null = null;
  let showTemplateOverlay = true;
  let templateOpacity = 0.45;
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

  async function syncCarUvFromWorker(carSlug: string): Promise<void> {
    if (!vaultAuthenticated) return;
    try {
      const uv = await fetchWorkerUvMap(carSlug);
      const car = getCarById(carSlug);
      state.zones = mapWorkerUvToZones(uv, car.defaultZones);
      renderZoneList();
      scheduleRender();
      setStatus(`UV cargado desde Worker (${uv.car_slug} · ${uv.uv_status})`, "ok");
    } catch (err) {
      if (err instanceof SkinsApiError && err.status === 401) {
        lockStudio(err.message);
        return;
      }
      setStatus(err instanceof Error ? err.message : "No se pudo sincronizar UV del Worker", "err");
    }
  }

  async function verifyVaultSession(): Promise<void> {
    if (authErrorBox) authErrorBox.textContent = "Verificando sesión activa de muntru.me...";
    const currentTk = getVaultToken();
    const qs = new URLSearchParams(window.location.search);
    if (!currentTk && window.location.hostname === "skins.muntru.me" && qs.get("sso") !== "1") {
      window.location.replace("https://muntru.me/login/?next=" + encodeURIComponent("https://skins.muntru.me/?sso=1"));
      return;
    }
    try {
      const cars = await fetchWorkerCars();
      unlockStudio();
      syncControlsFromState();
      renderSavedLibrary();
      updateViewModeUI();
      updateRightTabUI();
      setStatus(`Sesión Vault verificada · ${cars.length} coches UV disponibles`, "ok");
      await syncCarUvFromWorker(state.carId);
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

  let renderPending = false;
  function scheduleRender(): void {
    persistState();
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(async () => {
      renderPending = false;
      try {
        if (viewMode === "showroom") {
          await renderShowroomCarView(showroomCanvas, state, showroomAngle);
        } else if (viewMode === "uv") {
          await renderSkinToCanvas(uvCanvas, state, {
            size: 1024,
            templateCanvas: loadedTemplate?.canvas ?? null,
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
          await renderSkinToCanvas(offscreenTexture, state, { size: 1024, forExport: true });
          glEngine.updateTexture(offscreenTexture, state.spec.metallic, state.spec.roughness);
          const meshStatus = glEngine.getMeshStatus();
          const notice = byId<HTMLElement>("skGlNotice");
          if (notice) notice.textContent = meshStatus.label;
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
    const nameIn = byId<HTMLInputElement>("skDesignName");
    if (nameIn) nameIn.value = state.name;

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

    renderZoneList();
    renderDecalList();
    renderDecalEditor();
    renderPhotoGuide();
    updateExportValidation();
  }

  function renderZoneList(): void {
    const host = byId<HTMLElement>("skZoneList");
    if (!host) return;
    host.innerHTML = Object.values(state.zones)
      .map((z) => {
        const active = selectedZone === z.key ? " is-active" : "";
        const rest = z.restricted ? " is-restricted" : "";
        const badge = z.restricted
          ? `<span class="sk-tag sk-tag-warn">Fija</span>`
          : z.detectedConfidence
            ? `<span class="sk-tag sk-tag-ok">${Math.round(z.detectedConfidence * 100)}%</span>`
            : `<span class="sk-tag">${Math.round(z.w * 100)}×${Math.round(z.h * 100)}</span>`;
        return `<div class="sk-list-item${active}${rest}" data-select-zone="${z.key}"><span>${escapeHtml(z.label)}</span>${badge}</div>`;
      })
      .join("");

    host.querySelectorAll<HTMLElement>("[data-select-zone]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedZone = el.dataset.selectZone as ZoneKey;
        selectedDecalId = null;
        renderZoneList();
        renderDecalList();
        scheduleRender();
      });
    });
  }

  function renderDecalList(): void {
    const host = byId<HTMLElement>("skDecalList");
    if (!host) return;
    if (state.decals.length === 0) {
      host.innerHTML = `<p class="sk-help">No hay logos activos. Añade un logo MMT o sube un PNG/SVG.</p>`;
      return;
    }
    host.innerHTML = state.decals
      .map((d) => {
        const active = selectedDecalId === d.id ? " is-active" : "";
        const sym = d.mirrorX ? `<span class="sk-tag sk-tag-ok">L↔R</span>` : `<span class="sk-tag">1×</span>`;
        return `<div class="sk-list-item${active}" data-select-decal="${d.id}"><span>${escapeHtml(d.name)}</span>${sym}</div>`;
      })
      .join("");

    host.querySelectorAll<HTMLElement>("[data-select-decal]").forEach((el) => {
      el.addEventListener("click", () => {
        selectedDecalId = el.dataset.selectDecal || null;
        selectedZone = null;
        renderZoneList();
        renderDecalList();
        renderDecalEditor();
        scheduleRender();
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
    if (!box) return;
    const car = getCarById(state.carId);
    const cid = sanitizeCustomerId(state.customerId);
    const mbEstimate = state.resolution === 4096 ? "~48 MB por TGA (4K)" : "~12 MB por TGA (2K)";
    const cAccent = contrastRatio(state.palette.accent, state.palette.primary);
    box.innerHTML = `
      <div>Ruta iRacing: <code style="color:var(--sk-accent)">Documents\\iRacing\\paint\\${escapeHtml(car.iracingFolder)}\\</code></div>
      <div>Archivos: <code>car_${cid}.tga</code> + <code>car_spec_${cid}.tga</code> (${state.resolution}×${state.resolution}px · ${mbEstimate})</div>
      <div>Contraste Acento/Base: <strong style="color:${cAccent >= 3 ? "#00e699" : "#fbbf24"}">${cAccent}:1</strong> ${cAccent < 3 ? "(recomendado subir contraste)" : "(óptimo para pista)"}</div>
    `;
  }

  // Interactive UV canvas drag for selected zone / decal / pan
  let dragMode: "none" | "pan" | "zone-move" | "zone-resize" | "decal-move" = "none";
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

    // 1. Check resize handle of selected zone
    if (showZonesOverlay && selectedZone) {
      const z = state.zones[selectedZone];
      if (Math.hypot(u - (z.x + z.w), v - (z.y + z.h)) < 0.03) {
        dragMode = "zone-resize";
        origRect = { x: z.x, y: z.y, w: z.w, h: z.h };
        uvCanvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Check decal hit
    for (let i = state.decals.length - 1; i >= 0; i--) {
      const d = state.decals[i];
      if (Math.abs(u - d.x) < d.scale * 0.5 && Math.abs(v - d.y) < d.scale * 0.35) {
        selectedDecalId = d.id;
        selectedZone = null;
        dragMode = "decal-move";
        origRect = { x: d.x, y: d.y, w: 0, h: 0 };
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

    if (dragMode === "pan") {
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
    }
  });

  const endUvDrag = () => {
    if (dragMode === "zone-move" || dragMode === "zone-resize") renderZoneList();
    if (dragMode === "decal-move") renderDecalEditor();
    dragMode = "none";
  };
  uvCanvas.addEventListener("pointerup", endUvDrag);
  uvCanvas.addEventListener("pointercancel", endUvDrag);

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

  // 3D camera presets & OBJ loader
  document.querySelectorAll<HTMLButtonElement>("[data-gl-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      glEngine.setCameraPreset(btn.dataset.glCam as "front34" | "side" | "rear34" | "top");
    });
  });
  byId<HTMLInputElement>("skObjInput")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      glEngine.loadObjMesh(text, file.name);
      viewMode = "3d";
      updateViewModeUI();
      setStatus(`Malla 3D cargada: ${file.name}`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error cargando archivo .OBJ", "err");
    }
  });
  byId<HTMLButtonElement>("skGlResetMesh")?.addEventListener("click", () => {
    glEngine.resetToProofingBuck();
    scheduleRender();
    setStatus("Restaurada superficie de pruebas UV.", "neutral");
  });

  // Populate Car select grouped cleanly by class (GT3 > GTP > LMP2/LMP3 > GT4 & Cup > Fórmula > TCR)
  const carSelect = byId<HTMLSelectElement>("skCarSelect");
  if (carSelect) {
    carSelect.innerHTML = CAR_CATEGORY_ORDER.map((cat) => {
      const groupCars = CAR_PROFILES.filter((c) => c.category === cat).sort((a, b) => a.name.localeCompare(b.name));
      if (groupCars.length === 0) return "";
      const opts = groupCars
        .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
        .join("");
      return `<optgroup label="${escapeHtml(cat)}">${opts}</optgroup>`;
    }).join("");
    carSelect.addEventListener("change", () => {
      const nextCar = getCarById(carSelect.value);
      state.carId = nextCar.id;
      state.zones = cloneZones(nextCar.defaultZones);
      customPhotoShots = null;
      syncControlsFromState();
      scheduleRender();
      setStatus(`Diseño adaptado a ${nextCar.name}`, "ok");
      void syncCarUvFromWorker(nextCar.id);
    });
  }

  const drvSelect = byId<HTMLSelectElement>("skDriverSelect");
  if (drvSelect) {
    drvSelect.innerHTML = DRIVER_PROFILES.map(
      (d) => `<option value="${d.id}">#${escapeHtml(d.number)} · ${escapeHtml(d.name)}</option>`,
    ).join("");
    drvSelect.addEventListener("change", () => {
      const drv = getDriverById(drvSelect.value);
      state.driverId = drv.id;
      state.customDriverName = drv.name;
      state.customNumber = drv.number;
      state.customerId = drv.customerId;
      customPhotoShots = null;
      syncControlsFromState();
      scheduleRender();
    });
  }

  byId<HTMLInputElement>("skDriverNumber")?.addEventListener("input", (e) => {
    state.customNumber = (e.target as HTMLInputElement).value.slice(0, 4);
    scheduleRender();
  });
  byId<HTMLInputElement>("skCustomerId")?.addEventListener("input", (e) => {
    state.customerId = (e.target as HTMLInputElement).value;
    updateExportValidation();
    persistState();
  });
  byId<HTMLInputElement>("skDesignName")?.addEventListener("input", (e) => {
    state.name = (e.target as HTMLInputElement).value;
    persistState();
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
      if (infoEl) infoEl.textContent = analysis.summary;
      renderZoneList();
      scheduleRender();
      setStatus(`Plantilla cargada (${analysis.width}×${analysis.height} ${analysis.format})`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error cargando plantilla", "err");
    }
  });

  byId<HTMLButtonElement>("skResetZones")?.addEventListener("click", () => {
    const car = getCarById(state.carId);
    state.zones = cloneZones(car.defaultZones);
    renderZoneList();
    scheduleRender();
    setStatus("Zonas restauradas al mapa base del coche.", "ok");
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

  byId<HTMLSelectElement>("skPatternSelect")?.addEventListener("change", (e) => {
    state.pattern = (e.target as HTMLSelectElement).value as SkinDesignState["pattern"];
    scheduleRender();
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

  // Decals Tab Bindings
  const builtinHost = byId<HTMLElement>("skBuiltinDecals");
  if (builtinHost) {
    builtinHost.innerHTML = BUILTIN_DECALS.map(
      (b) => `<button type="button" class="sk-btn sk-btn-sm" data-add-builtin="${b.id}">+ ${escapeHtml(b.label)}</button>`,
    ).join("");
    builtinHost.querySelectorAll<HTMLButtonElement>("[data-add-builtin]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const asset = BUILTIN_DECALS.find((b) => b.id === btn.dataset.addBuiltin);
        if (!asset) return;
        const layer: DecalLayer = {
          id: `decal-${Date.now()}`,
          name: asset.label,
          kind: "builtin",
          assetId: asset.id,
          color: "#ffffff",
          x: 0.5,
          y: 0.20,
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
    });
  }

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

  // Gemini Copilot Bindings
  const keyInput = byId<HTMLInputElement>("skGeminiKey");
  if (keyInput) keyInput.value = getSavedGeminiKey();

  byId<HTMLButtonElement>("skSaveGeminiKey")?.addEventListener("click", () => {
    saveGeminiKey(keyInput?.value || "");
    setStatus(keyInput?.value.trim() ? "API key de Gemini guardada solo en tu navegador." : "API key de Gemini eliminada.", "ok");
  });

  byId<HTMLButtonElement>("skGeminiDesignBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skGeminiDesignBtn")!;
    const out = byId<HTMLElement>("skGeminiOutput")!;
    const promptText = byId<HTMLTextAreaElement>("skGeminiPrompt")?.value || "";
    btn.disabled = true;
    setStatus("Consultando Worker privado (POST /api/skins/ai-assist)...");
    try {
      const aiRes = await fetchWorkerAiAssist({
        car_slug: state.carId,
        style: promptText || "MMT Endurance agresivo y legible",
        driver_number: state.customNumber,
        colors: {
          primary: state.palette.primary,
          secondary: state.palette.secondary,
          accent: state.palette.accent,
        },
      });
      const plan = aiRes.design_plan;
      customPhotoShots = mapWorkerPhotoGuideToShots(state.carId, state.customNumber, aiRes.photo_guide);
      renderPhotoGuide();

      out.innerHTML = `
        <div class="sk-shot-card">
          <strong>${escapeHtml(plan.title)}</strong>
          <p class="sk-help">${escapeHtml(plan.rationale)}</p>
          <div class="sk-row">
            ${Object.values(plan.palette)
              .slice(0, 4)
              .map((hex) => `<span style="width:20px;height:20px;border-radius:4px;background:${hex};border:1px solid rgba(255,255,255,0.2);"></span>`)
              .join("")}
            <span class="sk-tag">${escapeHtml(plan.pattern)} · ${escapeHtml(plan.finish)}</span>
          </div>
          <ul>${(plan.layers || []).slice(0, 4).map((l) => `<li><strong>${escapeHtml(l.zone)}:</strong> ${escapeHtml(l.element)} (${l.x}, ${l.y})</li>`).join("")}</ul>
          <p class="sk-help" style="color:var(--sk-accent);">Guía de fotos Trading Paints actualizada (${escapeHtml(aiRes.photo_guide.circuit)}).</p>
          <button type="button" id="skApplyGeminiBtn" class="sk-btn sk-btn-primary sk-btn-sm">Aplicar propuesta al editor</button>
        </div>
      `;
      byId<HTMLButtonElement>("skApplyGeminiBtn")?.addEventListener("click", () => {
        state.pattern = plan.pattern;
        state.palette = {
          ...state.palette,
          primary: plan.palette.primary || state.palette.primary,
          secondary: plan.palette.secondary || state.palette.secondary,
          accent: plan.palette.accent || state.palette.accent,
          detail: plan.palette.detail || state.palette.detail,
        };
        state.spec = { finish: plan.finish, ...finishDefaults(plan.finish) };
        syncControlsFromState();
        scheduleRender();
        setStatus(`Propuesta IA aplicada: ${plan.title}`, "ok");
      });
      setStatus("Plan UV + Guía de fotos generados por Worker IA.", "ok");
    } catch (err) {
      if (err instanceof SkinsApiError && err.status === 401) {
        lockStudio(err.message);
        return;
      }
      out.innerHTML = `<p class="sk-help" style="color:#fca5a5;">${escapeHtml(err instanceof Error ? err.message : "Error al consultar Worker IA")}</p>`;
      setStatus(err instanceof Error ? err.message : "Error en Worker IA", "err");
    } finally {
      btn.disabled = false;
    }
  });

  byId<HTMLButtonElement>("skGeminiReviewBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skGeminiReviewBtn")!;
    const out = byId<HTMLElement>("skGeminiOutput")!;
    btn.disabled = true;
    setStatus("Auditando contraste y legibilidad con Gemini...");
    try {
      const car = getCarById(state.carId);
      const review = await requestGeminiDesignReview(keyInput?.value || getSavedGeminiKey(), car, state);
      out.innerHTML = `
        <div class="sk-shot-card">
          <strong>Auditoría Pre-Exportación · ${review.score}/100</strong>
          <p class="sk-help">${escapeHtml(review.verdict)}</p>
          <ul>
            ${review.contrastNotes.map((n) => `<li><strong>Contraste:</strong> ${escapeHtml(n)}</li>`).join("")}
            ${review.legibilityNotes.map((n) => `<li><strong>Legibilidad:</strong> ${escapeHtml(n)}</li>`).join("")}
            ${review.exportChecklist.map((n) => `<li><strong>Export:</strong> ${escapeHtml(n)}</li>`).join("")}
          </ul>
        </div>
      `;
      setStatus(`Revisión completada (${review.score}/100)`, "ok");
    } catch (err) {
      out.innerHTML = `<p class="sk-help" style="color:#fca5a5;">${escapeHtml(err instanceof Error ? err.message : "Error de Gemini")}</p>`;
      setStatus("Error en auditoría Gemini", "err");
    } finally {
      btn.disabled = false;
    }
  });

  byId<HTMLButtonElement>("skGeminiPhotoBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skGeminiPhotoBtn")!;
    const out = byId<HTMLElement>("skGeminiOutput")!;
    btn.disabled = true;
    setStatus("Adaptando circuito e iluminación para Trading Paints con Gemini...");
    try {
      const car = getCarById(state.carId);
      const base = buildDefaultPhotoGuide(car, state);
      const adapted = await requestGeminiPhotoAdaptation(keyInput?.value || getSavedGeminiKey(), car, state, base);
      customPhotoShots = adapted.shots;
      renderPhotoGuide();
      out.innerHTML = `
        <div class="sk-shot-card">
          <strong>Guía de Fotos Adaptada (${escapeHtml(adapted.recommendedCircuit)})</strong>
          <p class="sk-help">${escapeHtml(adapted.summary)} · ${escapeHtml(adapted.lightingNote)}</p>
          <p class="sk-help" style="color:var(--sk-accent);">Actualizada en la pestaña "Exportar & Fotos".</p>
        </div>
      `;
      setStatus("Guía de fotos adaptada por Gemini.", "ok");
    } catch (err) {
      out.innerHTML = `<p class="sk-help" style="color:#fca5a5;">${escapeHtml(err instanceof Error ? err.message : "Error de Gemini")}</p>`;
      setStatus("Error adaptando guía de fotos", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // Export Bindings
  byId<HTMLButtonElement>("skExportTgaBtn")?.addEventListener("click", async () => {
    const btn = byId<HTMLButtonElement>("skExportTgaBtn")!;
    btn.disabled = true;
    try {
      const fn = await exportSingleDiffuseTga(state, (m) => setStatus(m));
      setStatus(`Exportado ${fn} (${state.resolution}px)`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error exportando TGA", "err");
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
      const fn = await exportIracingZipBundle(car, state, shots, (m) => setStatus(m));
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
