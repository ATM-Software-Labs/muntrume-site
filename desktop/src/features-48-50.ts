import type { Backend, LibraryItem, Snapshot } from "./types";
import { IrsdkClient } from "./irsdk/irsdk-client";
import {
  applyOnboardingVisuals,
  demoOverlaySimulator,
  isFirstRun,
  loadOnboardingPrefs,
  markFirstRunDone,
  saveOnboardingPrefs,
  type HudVisualTheme,
  type MonitorType,
} from "./onboarding/first-run-wizard";
import {
  applyProfileSnapshot,
  collectLocalProfileSnapshot,
  encryptProfileSnapshot,
  loadTrackWalkNotes,
  MAX_PROFILE_BYTES,
  saveTrackWalkNote,
  UserProfileSyncClient,
  type UserProfileSnapshot,
} from "./sync/user-profile-sync";
import { activeTrackCoach } from "./telemetry/active-track-coach";
import type { SignalSample } from "./telemetry/signal-cleaner";

let wired = false;
const profileSyncClient = new UserProfileSyncClient("https://muntru.me");
let pendingCloudSnapshot: UserProfileSnapshot | null = null;

function setBadge(el: HTMLElement | null, ok: boolean, okText = "OK", missingText = "No encontrada"): void {
  if (!el) return;
  el.textContent = ok ? okText : missingText;
  el.className = ok
    ? "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
    : "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30";
}

async function refreshWizardPaths(backend: Backend): Promise<void> {
  const baseEl = document.getElementById("wizPathBase");
  const setupsEl = document.getElementById("wizPathSetups");
  const telEl = document.getElementById("wizPathTelemetry");
  const baseBadge = document.getElementById("wizBadgeBase");
  const setupsBadge = document.getElementById("wizBadgeSetups");
  const telBadge = document.getElementById("wizBadgeTelemetry");

  if (backend.detectIracingPaths) {
    try {
      const status = await backend.detectIracingPaths();
      if (baseEl) baseEl.textContent = status.basePath || "Documents\\iRacing";
      if (setupsEl) setupsEl.textContent = status.setupsPath || "Documents\\iRacing\\setups";
      if (telEl) telEl.textContent = status.telemetryPath || "Documents\\iRacing\\telemetry";
      setBadge(baseBadge, status.baseExists, "Detectada");
      setBadge(setupsBadge, status.setupsExists, "Detectada");
      setBadge(telBadge, status.telemetryExists, "Detectada");
      return;
    } catch {
      // fallback below
    }
  }

  if (baseEl) baseEl.textContent = "Documents\\iRacing";
  if (setupsEl) setupsEl.textContent = "Documents\\iRacing\\setups";
  if (telEl) telEl.textContent = "Documents\\iRacing\\telemetry";
  setBadge(baseBadge, true, "Simulado");
  setBadge(setupsBadge, true, "Simulado");
  setBadge(telBadge, true, "Simulado");
}

function openFirstRunWizard(backend: Backend): void {
  const modal = document.getElementById("firstRunWizardModal");
  if (!modal) return;
  const prefs = loadOnboardingPrefs();
  const monSel = document.getElementById("wizMonitorType") as HTMLSelectElement | null;
  const hudSel = document.getElementById("wizHudTheme") as HTMLSelectElement | null;
  const spotterChk = document.getElementById("wizSpotterToggle") as HTMLInputElement | null;
  const demoChk = document.getElementById("wizDemoModeToggle") as HTMLInputElement | null;

  if (monSel) monSel.value = prefs.monitorType;
  if (hudSel) hudSel.value = prefs.hudTheme;
  if (spotterChk) spotterChk.checked = prefs.spotterEnabled;
  if (demoChk) demoChk.checked = demoOverlaySimulator.isRunning();

  void refreshWizardPaths(backend);
  modal.hidden = false;
}

async function updateProfileSizeBadge(secret: string): Promise<void> {
  const badge = document.getElementById("cloudProfileSizeBadge");
  if (!badge) return;
  try {
    const snap = collectLocalProfileSnapshot();
    const env = await encryptProfileSnapshot(snap, secret);
    const kb = (env.bytes / 1024).toFixed(1);
    const maxKb = (MAX_PROFILE_BYTES / 1024).toFixed(0);
    badge.textContent = `${kb} KB / ${maxKb} KB`;
  } catch {
    badge.textContent = "< 50 KB";
  }
}

export function setActiveCoachReference(samples: SignalSample[]): void {
  activeTrackCoach.setReferenceSamples(samples);
  const pill = document.getElementById("coachLivePill");
  if (pill) {
    const count = activeTrackCoach.getCorners().length;
    pill.textContent = count > 0 ? `Activo · ${count} curvas ref` : "Sin curvas ref";
  }
}

export function initPrompts48To50(backend: Backend, data: Snapshot): void {
  const prefs = loadOnboardingPrefs();
  applyOnboardingVisuals(prefs);
  const pilotSecret = data.pilot?.slug || "mmt-pilot-default";

  if (!wired) {
    wired = true;

    // --- Prompt 48: FirstRunWizard ---
    const modal = document.getElementById("firstRunWizardModal");
    const closeWizard = () => {
      if (modal) modal.hidden = true;
    };

    document.getElementById("btnOpenOnboardingWizard")?.addEventListener("click", () => {
      openFirstRunWizard(backend);
    });
    document.getElementById("wizardCloseBtn")?.addEventListener("click", () => {
      markFirstRunDone();
      closeWizard();
    });
    document.getElementById("wizardPickFolderBtn")?.addEventListener("click", async () => {
      await backend.pickFolder();
      await refreshWizardPaths(backend);
    });
    document.getElementById("wizDemoModeToggle")?.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (checked) {
        demoOverlaySimulator.start();
      } else {
        demoOverlaySimulator.stop();
      }
    });
    document.getElementById("wizardFinishBtn")?.addEventListener("click", () => {
      const monSel = document.getElementById("wizMonitorType") as HTMLSelectElement | null;
      const hudSel = document.getElementById("wizHudTheme") as HTMLSelectElement | null;
      const spotterChk = document.getElementById("wizSpotterToggle") as HTMLInputElement | null;

      saveOnboardingPrefs({
        monitorType: (monSel?.value as MonitorType) || "single",
        hudTheme: (hudSel?.value as HudVisualTheme) || "dark-carbon",
        spotterEnabled: spotterChk?.checked ?? true,
      });
      markFirstRunDone();
      closeWizard();
      void updateProfileSizeBadge(pilotSecret);
    });

    // --- Prompt 49: UserProfileSync ---
    const syncStatusEl = document.getElementById("cloudProfileSyncStatus");
    const conflictModal = document.getElementById("profileConflictModal");
    const conflictMsg = document.getElementById("profileConflictMsg");

    document.getElementById("btnSaveTrackWalkNote")?.addEventListener("click", () => {
      const trackInput = document.getElementById("trackWalkNoteTrack") as HTMLInputElement | null;
      const textInput = document.getElementById("trackWalkNoteText") as HTMLInputElement | null;
      const track = trackInput?.value.trim() || "general";
      const note = textInput?.value ?? "";
      saveTrackWalkNote(track, note);
      if (syncStatusEl) {
        syncStatusEl.textContent = `Nota guardada para ${track}. Listo para sincronizar.`;
      }
      void updateProfileSizeBadge(pilotSecret);
    });

    document.getElementById("btnSyncProfileNow")?.addEventListener("click", async () => {
      if (syncStatusEl) syncStatusEl.textContent = "Cifrando y comprobando nube…";
      try {
        const res = await profileSyncClient.checkAndSync(pilotSecret);
        if (res.status === "conflict" && res.cloudSnapshot) {
          pendingCloudSnapshot = res.cloudSnapshot;
          if (conflictMsg) {
            const cloudDate = new Date(res.updatedAt).toLocaleString();
            conflictMsg.textContent = `Perfil en la nube (${cloudDate}, ${(res.bytes / 1024).toFixed(1)} KB) más reciente que el local.`;
          }
          if (conflictModal) conflictModal.hidden = false;
          return;
        }
        if (syncStatusEl) {
          syncStatusEl.textContent = `Sincronizado (${(res.bytes / 1024).toFixed(1)} KB · ${new Date(res.updatedAt).toLocaleTimeString()})`;
        }
        void updateProfileSizeBadge(pilotSecret);
      } catch (err) {
        if (syncStatusEl) {
          syncStatusEl.textContent = err instanceof Error ? err.message : "Error al sincronizar perfil";
        }
      }
    });

    document.getElementById("btnRestoreCloudProfile")?.addEventListener("click", () => {
      if (pendingCloudSnapshot) {
        applyProfileSnapshot(pendingCloudSnapshot);
        pendingCloudSnapshot = null;
        if (syncStatusEl) syncStatusEl.textContent = "Perfil restaurado desde la nube.";
        void updateProfileSizeBadge(pilotSecret);
      }
      if (conflictModal) conflictModal.hidden = true;
    });

    document.getElementById("btnKeepLocalProfile")?.addEventListener("click", async () => {
      pendingCloudSnapshot = null;
      if (conflictModal) conflictModal.hidden = true;
      const res = await profileSyncClient.pushProfile(pilotSecret);
      if (syncStatusEl) {
        syncStatusEl.textContent = `Perfil local mantenido (${(res.bytes / 1024).toFixed(1)} KB).`;
      }
    });

    // Populate first Track Walk note if present
    const notes = loadTrackWalkNotes();
    const firstKey = Object.keys(notes)[0];
    if (firstKey) {
      const trackInput = document.getElementById("trackWalkNoteTrack") as HTMLInputElement | null;
      const textInput = document.getElementById("trackWalkNoteText") as HTMLInputElement | null;
      if (trackInput) trackInput.value = firstKey;
      if (textInput) textInput.value = notes[firstKey];
    }

    // --- Prompt 50: ActiveTrackCoach ---
    const coachToggle = document.getElementById("coachEnabledToggle") as HTMLInputElement | null;
    const coachVol = document.getElementById("coachVolumeSlider") as HTMLInputElement | null;
    const coachPill = document.getElementById("coachLivePill");
    const coachSettings = activeTrackCoach.getSettings();

    if (coachToggle) {
      coachToggle.checked = coachSettings.enabled;
      coachToggle.addEventListener("change", () => {
        activeTrackCoach.updateSettings({ enabled: coachToggle.checked });
        if (coachPill) coachPill.textContent = coachToggle.checked ? "Activo (Practice)" : "Desactivado";
      });
    }
    if (coachVol) {
      coachVol.value = String(Math.round(coachSettings.volume * 100));
      coachVol.addEventListener("input", () => {
        activeTrackCoach.updateSettings({ volume: Number(coachVol.value) / 100 });
      });
    }

    // Hook ActiveTrackCoach to live IRSDK frames
    const irsdk = IrsdkClient.getInstance();
    irsdk.subscribe((state) => {
      const sessionType = state.session?.sessionType || "Practice";
      const trackLen = state.session?.weekendInfo?.trackLengthM || 4563;
      const frame = state.frame;
      const pct = frame.carIdxLapDistPct[frame.playerCarIdx] ?? 0;
      if (pct < 0) return;

      const alert = activeTrackCoach.evaluateLiveTick({
        sessionType,
        distM: pct * trackLen,
        speedKmh: frame.speedKmh,
        brakePct: frame.brake * 100,
      });

      if (alert && coachPill) {
        coachPill.textContent = alert.message;
        coachPill.className =
          alert.type === "late_brake"
            ? "px-2.5 py-0.5 rounded-full border border-amber-400/50 bg-amber-500/15 font-mono text-[11px] text-amber-300"
            : "px-2.5 py-0.5 rounded-full border border-sky-400/50 bg-sky-500/15 font-mono text-[11px] text-sky-300";
      }
    });
  }

  void updateProfileSizeBadge(pilotSecret);

  // Auto-open FirstRunWizard on true first launch when signed in
  if (data.pilot && isFirstRun()) {
    openFirstRunWizard(backend);
  }
}

/**
 * Prompt 50 helper: Computes installed content status & provides 1-click Ref + Setup action
 * for a series/track row in CALENDARIO.
 */
export function getCalendarContentStatus(
  trackName: string,
  libraryItems: LibraryItem[],
): { installed: boolean; matchingSetups: number; refTrackKey: string | null } {
  const norm = trackName.toLowerCase();
  const matching = libraryItems.filter(
    (item) =>
      norm.includes(item.track.toLowerCase()) ||
      item.track.toLowerCase().includes(norm.split(" - ")[0].trim()),
  );

  let refTrackKey: string | null = null;
  if (norm.includes("fuji")) refTrackKey = "fuji";
  else if (norm.includes("barcelona") || norm.includes("catalunya")) refTrackKey = "barcelona";
  else if (norm.includes("spa")) refTrackKey = "spa";
  else if (norm.includes("indianapolis")) refTrackKey = "indianapolis";
  else if (norm.includes("gilles villeneuve") || norm.includes("montreal")) refTrackKey = "montreal";
  else if (norm.includes("interlagos") || norm.includes("carlos pace")) refTrackKey = "interlagos";
  else if (norm.includes("road america")) refTrackKey = "roadamerica";
  else if (norm.includes("le mans") || norm.includes("24 heures")) refTrackKey = "lemans";
  else if (norm.includes("nürburgring") || norm.includes("nurburgring")) refTrackKey = "nurburgring";

  return {
    installed: matching.length > 0 || refTrackKey !== null,
    matchingSetups: matching.length,
    refTrackKey,
  };
}
