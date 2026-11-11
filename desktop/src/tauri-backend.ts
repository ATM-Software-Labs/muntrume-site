import { inTauri } from "./env";
import type { Backend, LiveSample, Settings, SettingsPatch, StagedFile, UploadInput } from "./types";

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: call } = await import("@tauri-apps/api/core");
  return call<T>(command, args);
}

export function createTauriBackend(): Backend {
  const refreshers = new Set<() => void>();
  const stagedListeners = new Set<(file: StagedFile) => void>();
  const notices = new Set<(message: string) => void>();
  const updates = new Set<(version: string) => void>();
  const liveListeners = new Set<(sample: LiveSample) => void>();
  const iracingStatusListeners = new Set<(status: string) => void>();
  let wired = false;

  async function wire(): Promise<void> {
    if (wired || !inTauri()) return;
    wired = true;
    const { listen } = await import("@tauri-apps/api/event");
    await listen("mmt-refresh", () => refreshers.forEach((cb) => cb()));
    await listen<StagedFile>("mmt-staged", (event) => stagedListeners.forEach((cb) => cb(event.payload)));
    await listen<string>("mmt-notice", (event) => notices.forEach((cb) => cb(event.payload)));
    await listen<string>("mmt-update", (event) => updates.forEach((cb) => cb(event.payload)));
    await listen<LiveSample>("mmt-live", (event) => liveListeners.forEach((cb) => cb(event.payload)));
    await listen<string>("mmt-iracing-status", (event) => iracingStatusListeners.forEach((cb) => cb(event.payload)));
  }

  return {
    snapshot: () => invoke("snapshot"),
    authStart: () => invoke("auth_start"),
    authCancel: () => invoke("auth_cancel"),
    authPoll: () => invoke("auth_poll"),
    openVerify: () => invoke("open_verify"),
    logout: () => invoke("logout"),
    syncNow: () => invoke("sync_now"),
    saveSettings: (patch: SettingsPatch) => invoke<Settings>("save_settings", { patch }),
    pickFolder: () => invoke("pick_folder"),
    detectFolder: () => invoke("detect_folder"),
    pickSto: () => invoke("pick_sto"),
    clearStaged: () => invoke("clear_staged"),
    upload: (input: UploadInput) =>
      invoke("upload_staged", {
        carFolder: input.carFolder,
        track: input.track,
        kind: input.kind,
        notes: input.notes,
      }),
    installUpdate: () => invoke("install_update"),
    inspectConfig: () => invoke("inspect_config"),
    checkIracing: () => invoke<string>("check_iracing_status"),
    toggleOverlay: (show: boolean) => invoke<boolean>("toggle_overlay", { show }),
    quit: () => invoke("quit"),
    onRefresh(cb) {
      void wire();
      refreshers.add(cb);
      return () => refreshers.delete(cb);
    },
    onStaged(cb) {
      void wire();
      stagedListeners.add(cb);
      return () => stagedListeners.delete(cb);
    },
    onNotice(cb) {
      void wire();
      notices.add(cb);
      return () => notices.delete(cb);
    },
    onUpdate(cb) {
      void wire();
      updates.add(cb);
      return () => updates.delete(cb);
    },
    onLive(cb) {
      void wire();
      liveListeners.add(cb);
      return () => liveListeners.delete(cb);
    },
    onIracingStatus(cb) {
      void wire();
      iracingStatusListeners.add(cb);
      return () => iracingStatusListeners.delete(cb);
    },
  };
}
