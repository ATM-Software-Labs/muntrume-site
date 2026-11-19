/**
 * MMT Sync — Studio Controls, Zero-Scroll Snap/Grid, Inspector Persistence,
 * Click-Through, JSON Profile Import/Export & Global Shortcuts (P, R, Alt+H).
 */

const OPTS_KEY = "mmt_studio_inspector_opts_v1";
const SNAP_KEY = "mmt_studio_snap_grid_8px";
const CLICK_THROUGH_KEY = "mmt_studio_click_through";

interface InspectorOpts {
  snap8px: boolean;
  clickThrough: boolean;
  onTrack: boolean;
  inPit: boolean;
  replay: boolean;
  abs: boolean;
  ghost: boolean;
}

const DEFAULT_OPTS: InspectorOpts = {
  snap8px: true,
  clickThrough: true,
  onTrack: true,
  inPit: true,
  replay: true,
  abs: true,
  ghost: false,
};

function loadOpts(): InspectorOpts {
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    return raw ? { ...DEFAULT_OPTS, ...(JSON.parse(raw) as Partial<InspectorOpts>) } : { ...DEFAULT_OPTS };
  } catch {
    return { ...DEFAULT_OPTS };
  }
}

function saveOpts(opts: InspectorOpts): void {
  try {
    localStorage.setItem(OPTS_KEY, JSON.stringify(opts));
    localStorage.setItem(SNAP_KEY, opts.snap8px ? "1" : "0");
    localStorage.setItem(CLICK_THROUGH_KEY, opts.clickThrough ? "1" : "0");
    localStorage.setItem("mmt-ghost-compare", opts.ghost ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}

export function initStudioControls(): void {
  const opts = loadOpts();
  let selectedMod = "standings";
  let radarSimActive = false;
  let radarSimTimer: number | null = null;

  const stage = document.getElementById("overlayStage");
  const sceneBg = document.getElementById("mmtStudioSceneBg");
  const snapBtn = document.getElementById("btnShellSnapGrid");
  const clickBtn = document.getElementById("btnShellClickThrough");
  const exportBtn = document.getElementById("btnShellExportJson");
  const importBtn = document.getElementById("btnShellImportJson");
  const importInput = document.getElementById("inpImportHudPreset") as HTMLInputElement | null;
  const simRadarBtn = document.getElementById("btnSimHaloRadar");
  const inspScale = document.getElementById("mmtInspScale") as HTMLInputElement | null;
  const inspScaleVal = document.getElementById("mmtInspScaleVal");
  const inspOpacity = document.getElementById("mmtInspOpacity") as HTMLInputElement | null;
  const inspOpacityVal = document.getElementById("mmtInspOpacityVal");
  const inspX = document.getElementById("mmtInspX");
  const inspY = document.getElementById("mmtInspY");
  const inspCenterX = document.getElementById("mmtInspCenterX");

  const getSelectedWidgetEl = (): HTMLElement | null => {
    if (!stage) return null;
    return stage.querySelector<HTMLElement>(`[data-widget="${selectedMod}"]`) ||
      (selectedMod === "inputs" ? document.getElementById("widgetCluster") : null);
  };

  const syncInspectorFromWidget = (): void => {
    const el = getSelectedWidgetEl();
    if (!el) return;
    const x = Math.round(el.offsetLeft);
    const y = Math.round(el.offsetTop);
    if (inspX) inspX.textContent = `${x}px`;
    if (inspY) inspY.textContent = `${y}px`;
    const curOpacity = Math.round((parseFloat(el.style.opacity || "0.88") || 0.88) * 100);
    if (inspOpacity) inspOpacity.value = String(curOpacity);
    if (inspOpacityVal) inspOpacityVal.textContent = `${curOpacity}%`;
  };

  const paintSnapBtn = (): void => {
    if (!snapBtn) return;
    snapBtn.setAttribute("aria-pressed", String(opts.snap8px));
    snapBtn.className = opts.snap8px
      ? "px-1.5 py-0.5 rounded-[3px] border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-bold cursor-pointer whitespace-nowrap"
      : "px-1.5 py-0.5 rounded-[3px] border border-white/10 bg-[#090b0f] text-white/60 hover:text-white font-bold cursor-pointer whitespace-nowrap";
    if (sceneBg) {
      sceneBg.style.backgroundSize = opts.snap8px
        ? "100% 100%, 8px 8px, 8px 8px"
        : "100% 100%, 28px 28px, 28px 28px";
    }
  };

  const paintClickThroughBtn = (): void => {
    if (!clickBtn) return;
    clickBtn.setAttribute("aria-pressed", String(opts.clickThrough));
    clickBtn.textContent = opts.clickThrough ? "Click-Through: ON" : "Click-Through: OFF";
    clickBtn.className = opts.clickThrough
      ? "px-1.5 py-0.5 rounded-[3px] border border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-bold cursor-pointer whitespace-nowrap"
      : "px-1.5 py-0.5 rounded-[3px] border border-amber-500/45 bg-amber-500/15 text-amber-300 font-bold cursor-pointer whitespace-nowrap";
  };

  paintSnapBtn();
  paintClickThroughBtn();
  syncInspectorFromWidget();

  snapBtn?.addEventListener("click", () => {
    opts.snap8px = !opts.snap8px;
    saveOpts(opts);
    paintSnapBtn();
  });

  clickBtn?.addEventListener("click", () => {
    opts.clickThrough = !opts.clickThrough;
    saveOpts(opts);
    paintClickThroughBtn();
    const lockBtn = document.getElementById("btnEditFloatingHud");
    if (lockBtn) lockBtn.click();
  });

  // Track widget selection in compact list
  document.getElementById("mmtCompactWidgetList")?.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    const row = target?.closest<HTMLElement>("[data-compact-mod]");
    if (row?.dataset.compactMod) {
      selectedMod = row.dataset.compactMod;
      syncInspectorFromWidget();
    }
  });

  // Inspector live scale, opacity & center X
  inspScale?.addEventListener("input", () => {
    const val = Number(inspScale.value) || 100;
    if (inspScaleVal) inspScaleVal.textContent = `${val}%`;
    const el = getSelectedWidgetEl();
    if (el) el.style.transform = `scale(${(val / 100).toFixed(2)})`;
  });

  inspOpacity?.addEventListener("input", () => {
    const val = Number(inspOpacity.value) || 88;
    if (inspOpacityVal) inspOpacityVal.textContent = `${val}%`;
    const el = getSelectedWidgetEl();
    if (el) el.style.opacity = String((val / 100).toFixed(2));
  });

  inspCenterX?.addEventListener("click", () => {
    const el = getSelectedWidgetEl();
    if (!el || !stage) return;
    const centerLeft = Math.max(8, Math.round((stage.clientWidth - el.offsetWidth) / 2));
    const snapped = opts.snap8px ? Math.round(centerLeft / 8) * 8 : centerLeft;
    el.style.right = "auto";
    el.style.left = `${snapped}px`;
    el.style.transform = el.style.transform.replace(/translateX\([^)]*\)/g, "").trim();
    syncInspectorFromWidget();
  });

  // Inspector checkboxes persistence
  const chkTrack = document.getElementById("mmtInspOnTrack") as HTMLInputElement | null;
  const chkPit = document.getElementById("mmtInspInPit") as HTMLInputElement | null;
  const chkReplay = document.getElementById("mmtInspReplay") as HTMLInputElement | null;
  const chkAbs = document.querySelector<HTMLInputElement>('[data-insp-opt="abs"]');
  const chkGhost = document.querySelector<HTMLInputElement>('[data-insp-opt="ghost"]');
  if (chkTrack) { chkTrack.checked = opts.onTrack; chkTrack.addEventListener("change", () => { opts.onTrack = chkTrack.checked; saveOpts(opts); }); }
  if (chkPit) { chkPit.checked = opts.inPit; chkPit.addEventListener("change", () => { opts.inPit = chkPit.checked; saveOpts(opts); }); }
  if (chkReplay) { chkReplay.checked = opts.replay; chkReplay.addEventListener("change", () => { opts.replay = chkReplay.checked; saveOpts(opts); }); }
  if (chkAbs) { chkAbs.checked = opts.abs; chkAbs.addEventListener("change", () => { opts.abs = chkAbs.checked; saveOpts(opts); }); }
  if (chkGhost) { chkGhost.checked = opts.ghost; chkGhost.addEventListener("change", () => { opts.ghost = chkGhost.checked; saveOpts(opts); }); }

  // Live Radar simulation (CAR LEFT / CAR RIGHT)
  simRadarBtn?.addEventListener("click", () => {
    radarSimActive = !radarSimActive;
    simRadarBtn.textContent = radarSimActive ? "Simular Radar: ON" : "Simular Radar: Off";
    const radarBox = document.getElementById("ovRadar");
    const halo = document.getElementById("mmtStageHaloBar");
    const haloL = document.getElementById("haloLedLeft") || document.getElementById("stageHaloLeft");
    const haloR = document.getElementById("haloLedRight") || document.getElementById("stageHaloRight");

    if (radarSimTimer !== null) {
      window.clearInterval(radarSimTimer);
      radarSimTimer = null;
    }
    if (!radarSimActive) {
      if (halo) halo.style.opacity = "0";
      if (radarBox) radarBox.innerHTML = "";
      return;
    }

    let phase = 0;
    const paintSim = () => {
      phase = (phase + 1) % 3;
      const label = phase === 0 ? "⚠ CAR LEFT" : phase === 1 ? "⚠ CAR RIGHT" : "⚠ 3-WIDE";
      const bg = phase === 2 ? "rgba(239,68,68,0.28)" : "rgba(245,158,11,0.28)";
      const border = phase === 2 ? "#ef4444" : "#f59e0b";
      if (halo) halo.style.opacity = "1";
      if (haloL) haloL.style.background = phase === 0 || phase === 2 ? border : "transparent";
      if (haloR) haloR.style.background = phase === 1 || phase === 2 ? border : "transparent";
      if (radarBox) {
        radarBox.innerHTML = `<div class="px-3 py-1 rounded font-mono text-[11px] font-black tracking-wider text-white border shadow-lg" style="background:${bg};border-color:${border};">${label}</div>`;
      }
    };
    paintSim();
    radarSimTimer = window.setInterval(paintSim, 1400);
  });

  // Export / Import Profile (.json)
  exportBtn?.addEventListener("click", () => {
    const profile = {
      version: "0.6.5",
      exportedAt: new Date().toISOString(),
      inspector: opts,
      disabledWidgets: localStorage.getItem("mmt_disabled_widgets_v1"),
      hudLayout: localStorage.getItem("mmt_hud_positions_v2"),
    };
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mmt-hud-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn?.addEventListener("click", () => {
    importInput?.click();
  });

  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (typeof parsed.disabledWidgets === "string") {
        localStorage.setItem("mmt_disabled_widgets_v1", parsed.disabledWidgets);
      }
      if (typeof parsed.hudLayout === "string") {
        localStorage.setItem("mmt_hud_positions_v2", parsed.hudLayout);
      }
      if (parsed.inspector && typeof parsed.inspector === "object") {
        Object.assign(opts, parsed.inspector);
        saveOpts(opts);
        paintSnapBtn();
        paintClickThroughBtn();
      }
      window.dispatchEvent(new CustomEvent("mmt-studio-refresh"));
    } catch {
      // ignore invalid JSON
    } finally {
      importInput.value = "";
    }
  });

  // Global keyboard shortcuts: P (Pista), R (Replay), Alt+H (Show/Hide HUD)
  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.altKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      document.getElementById("btnTopLaunchHud")?.click();
      return;
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key.toLowerCase() === "p") {
        document.getElementById("btnShellTrackMode")?.click();
      } else if (e.key.toLowerCase() === "r") {
        document.getElementById("btnShellReplayMode")?.click();
      }
    }
  });
}
