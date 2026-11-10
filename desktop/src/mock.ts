import type { Backend, LibraryItem, Pilot, Settings, Snapshot, StagedFile, SyncReport } from "./types";

const DEMO_PILOT: Pilot = { slug: "albertot", name: "Alberto Trujillo" };

const LIBRARY: LibraryItem[] = [
  item("f1", "Ferrari 296 GT3", "ferrari296gt3", "Spa-Francorchamps", "26S4", "Race", "spa_race.sto", 48211, "al_dia"),
  item("f2", "Ferrari 296 GT3", "ferrari296gt3", "Spa-Francorchamps", "26S4", "Qualy", "spa_qualy.sto", 47102, "actualizado"),
  item("f3", "Ferrari 296 GT3", "ferrari296gt3", "Barcelona", "26S4", "Wet", "barcelona_wet.sto", 51044, "nuevo"),
  item("p1", "Porsche 992 GT3 R", "porsche992rgt3", "Monza", "26S4", "Race", "monza_race.sto", 49880, "nuevo"),
  item("p2", "Porsche 992 GT3 R", "porsche992rgt3", "Spa-Francorchamps", "26S4", "Qualy", "spa_qualy.sto", 46330, "al_dia"),
  item("b1", "BMW M4 GT3", "bmwm4gt3", "Imola", "26S4", "Race", "imola_race.sto", 45512, "al_dia"),
];

function item(
  id: string,
  car: string,
  carFolder: string,
  track: string,
  season: string,
  kind: string,
  filename: string,
  size: number,
  state: LibraryItem["state"],
): LibraryItem {
  return {
    id,
    car,
    carFolder,
    track,
    season,
    kind,
    filename,
    size,
    updatedAt: "2026-11-10T09:15:00Z",
    state,
  };
}

export function createMock(screen: string | null): Backend {
  let pilot: Pilot | null = screen && screen !== "login" ? DEMO_PILOT : null;
  let pending = screen === "login";
  let polls = 0;
  let library = LIBRARY.map((entry) => ({ ...entry }));
  let staged: StagedFile | null = screen === "upload" ? { filename: "spa_race_pilot.sto", size: 48211 } : null;
  let settings: Settings = {
    setupsDir: "C:\\Users\\Piloto\\OneDrive\\Documents\\iRacing\\setups",
    intervalMinutes: 30,
    autoSync: true,
    deleteRetired: false,
    startWithWindows: false,
    theme: document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
    disabledCars: [],
    favourites: [],
    modules: {
      overlays: true,
      analysis: true,
      referenceLaps: false,
      weekly: true,
      strategy: true,
      team: false,
      reviewAlerts: false,
    },
    checklist: [
      { label: "Revisar el setup de MMT instalado", done: false },
      { label: "Anotar combustible y presiones", done: false },
      { label: "Repasar el mapa antes de salir", done: true },
    ],
  };
  let lastSync: string | null = "2026-11-10T09:15:00Z";
  let lastDownloaded = 0;
  let lastCars: string[] = [];
  const refreshers = new Set<() => void>();
  const notices = new Set<(message: string) => void>();
  const stagedListeners = new Set<(file: StagedFile) => void>();
  const updates = new Set<(version: string) => void>();

  const snap = (): Snapshot => ({
    mock: true,
    offline: false,
    pilot,
    settings: { ...settings },
    library: library.map((entry) => ({ ...entry })),
    lastSyncRfc3339: lastSync,
    lastDownloaded,
    lastCars: [...lastCars],
    staged: staged ? { ...staged } : null,
    updateVersion: null,
    folderExists: settings.setupsDir.length > 0,
  });

  const backend: Backend = {
    async snapshot() {
      return snap();
    },
    async authStart() {
      pending = true;
      polls = 0;
      return {
        userCode: "MMT-7K2Q",
        verifyUrl: "https://muntru.me/app/vincular/?code=MMT-7K2Q",
        interval: 2,
        expiresIn: 600,
      };
    },
    async authCancel() {
      pending = false;
    },
    async authPoll() {
      if (!pending) return { status: "expired" };
      polls += 1;
      if (polls < 2) return { status: "pending" };
      pending = false;
      pilot = DEMO_PILOT;
      return { status: "ready", pilot };
    },
    async openVerify() {
      window.open("https://muntru.me/app/vincular/?code=MMT-7K2Q", "_blank", "noopener");
    },
    async logout() {
      pilot = null;
      pending = false;
    },
    async syncNow() {
      const changed = library.filter((entry) => entry.state !== "al_dia");
      library = library.map((entry) => ({ ...entry, state: "al_dia" }));
      lastDownloaded = changed.length;
      lastCars = [...new Set(changed.map((entry) => entry.car))];
      lastSync = new Date().toISOString();
      const report: SyncReport = {
        downloaded: changed.length,
        unchanged: library.length - changed.length,
        deleted: settings.deleteRetired ? 1 : 0,
        keptRetired: settings.deleteRetired ? 0 : 1,
        rejected: 0,
        notModified: false,
        cars: lastCars,
        errors: [],
        message:
          changed.length === 0
            ? settings.deleteRetired
              ? "Todo al día."
              : "Todo al día. 1 setup retirado sigue en el disco."
            : changed.length === 1
              ? `1 setup sincronizado: ${lastCars.join(", ")}`
              : `${changed.length} setups sincronizados: ${lastCars.join(", ")}`,
        at: lastSync,
      };
      return report;
    },
    async saveSettings(patch) {
      settings = {
        ...settings,
        ...patch,
        modules: patch.modules ?? settings.modules,
        disabledCars: patch.disabledCars ?? settings.disabledCars,
        favourites: patch.favourites ?? settings.favourites,
        checklist: patch.checklist ?? settings.checklist,
      };
      return { ...settings, modules: { ...settings.modules }, checklist: settings.checklist.map((item) => ({ ...item })) };
    },
    async pickFolder() {
      settings = { ...settings, setupsDir: "D:\\iRacing\\setups" };
      return { ...settings };
    },
    async detectFolder() {
      settings = {
        ...settings,
        setupsDir: "C:\\Users\\Piloto\\OneDrive\\Documents\\iRacing\\setups",
      };
      return { ...settings };
    },
    async pickSto() {
      staged = { filename: "spa_race_pilot.sto", size: 48211 };
      return { ...staged };
    },
    async clearStaged() {
      staged = null;
    },
    async upload(input) {
      if (!staged) throw new Error("Elige un archivo .sto.");
      if (!input.carFolder.trim() || !input.track.trim()) throw new Error("Completa coche y circuito.");
      if (input.notes.length > 280) throw new Error("Las notas pueden tener como máximo 280 caracteres.");
      staged = null;
      return "Enviado a revisión en la Sala de ingenieros";
    },
    async installUpdate() {
      notices.forEach((cb) => cb("En Windows, la actualización se descarga desde GitHub Releases."));
    },
    async inspectConfig() {
      return {
        found: true,
        iracingDir: "C:\\Users\\Piloto\\Documents\\iRacing",
        score: 92,
        optimalCount: 6,
        recommendedCount: 2,
        warningCount: 0,
        items: [
          {
            key: "enableFFB360HzInterpolated",
            section: "Force Feedback (app.ini)",
            currentValue: "1 (Activo)",
            recommendedValue: "1",
            status: "optimal",
            title: "Interpolación FFB a 360 Hz",
            explanation: "FFB de alta frecuencia activo para volantes modernos.",
            category: "ffb",
          },
          {
            key: "displayLinearInNm",
            section: "Force Feedback (app.ini)",
            currentValue: "1 (Activo)",
            recommendedValue: "1",
            status: "optimal",
            title: "Fuerza FFB Lineal en Nm",
            explanation: "Muestra Newtons-metro reales en la telemetría.",
            category: "ffb",
          },
          {
            key: "MotionBlurDrivingCams",
            section: "Gráficos (rendererDX11*.ini)",
            currentValue: "0 (Desactivado)",
            recommendedValue: "0",
            status: "optimal",
            title: "Desenfoque de Movimiento en Carrera",
            explanation: "Desenfoque desactivado para máxima nitidez en referencias de frenada.",
            category: "graphics",
          },
          {
            key: "SSAO",
            section: "Gráficos (rendererDX11*.ini)",
            currentValue: "0 (Desactivado)",
            recommendedValue: "0",
            status: "optimal",
            title: "Oclusión Ambiental (SSAO)",
            explanation: "Ahorra valiosos ms de GPU en parrillas densas de carrera.",
            category: "graphics",
          },
          {
            key: "Sharpening",
            section: "Gráficos (rendererDX11*.ini)",
            currentValue: "1 (Activo)",
            recommendedValue: "1",
            status: "optimal",
            title: "Nitidez Adaptativa (FidelityFX CAS)",
            explanation: "Filtro de contraste activo para visibilidad de referencias lejanas.",
            category: "graphics",
          },
          {
            key: "VirtualMirrors",
            section: "Visibilidad (rendererDX11*.ini)",
            currentValue: "1 (Activo)",
            recommendedValue: "1",
            status: "optimal",
            title: "Retrovisor Virtual Panorámico",
            explanation: "Retrovisor virtual activado para visión de tráfico y seguridad.",
            category: "visibility",
          },
        ],
      };
    },
    async checkIracing() {
      return "closed";
    },
    async quit() {
      notices.forEach((cb) => cb("En la aplicación de Windows, Salir cierra la bandeja."));
    },
    onRefresh(cb) {
      refreshers.add(cb);
      return () => refreshers.delete(cb);
    },
    onStaged(cb) {
      stagedListeners.add(cb);
      return () => stagedListeners.delete(cb);
    },
    onNotice(cb) {
      notices.add(cb);
      return () => notices.delete(cb);
    },
    onUpdate(cb) {
      updates.add(cb);
      return () => updates.delete(cb);
    },
    onLive() {
      return () => {};
    },
    onIracingStatus() {
      return () => {};
    },
  };
  return backend;
}
