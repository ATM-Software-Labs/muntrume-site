export interface Pilot {
  slug: string;
  name: string;
}

export interface LibraryItem {
  id: string;
  car: string;
  carFolder: string;
  track: string;
  season: string;
  kind: string;
  filename: string;
  size: number;
  updatedAt: string;
  state: "nuevo" | "actualizado" | "al_dia";
}

export interface Settings {
  setupsDir: string;
  intervalMinutes: number;
  autoSync: boolean;
  deleteRetired: boolean;
  startWithWindows: boolean;
  theme: "dark" | "light";
  disabledCars: string[];
  favourites: string[];
  modules: Modules;
  checklist: CheckItem[];
}

export interface Modules {
  overlays: boolean;
  analysis: boolean;
  referenceLaps: boolean;
  weekly: boolean;
  strategy: boolean;
  team: boolean;
  reviewAlerts: boolean;
}

export interface CheckItem {
  label: string;
  done: boolean;
}

export interface SettingsPatch {
  intervalMinutes: number;
  autoSync: boolean;
  deleteRetired: boolean;
  startWithWindows: boolean;
  theme: "dark" | "light";
  disabledCars: string[];
  favourites: string[];
  modules: Modules;
  checklist: CheckItem[];
}

export interface StagedFile {
  filename: string;
  size: number;
}

export interface Snapshot {
  mock: boolean;
  offline: boolean;
  pilot: Pilot | null;
  settings: Settings;
  library: LibraryItem[];
  lastSyncRfc3339: string | null;
  lastDownloaded: number;
  lastCars: string[];
  staged: StagedFile | null;
  updateVersion: string | null;
  folderExists: boolean;
}

export interface AuthStart {
  userCode: string;
  verifyUrl: string;
  interval: number;
  expiresIn: number;
}

export interface PollResult {
  status: "pending" | "ready" | "expired";
  pilot?: Pilot;
}

export interface SyncReport {
  downloaded: number;
  unchanged: number;
  deleted: number;
  keptRetired: number;
  rejected: number;
  notModified: boolean;
  cars: string[];
  errors: string[];
  message: string;
  at: string;
}

export interface UploadInput {
  carFolder: string;
  track: string;
  kind: string;
  notes: string;
}

export interface LiveSample {
  t: number;
  dist: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  steering: number;
  lat?: number;
  lon?: number;
  vx?: number;
  vy?: number;
}

export interface ConfigItem {
  key: string;
  section: string;
  currentValue: string;
  recommendedValue: string;
  status: "optimal" | "recommended" | "warning" | "protected";
  title: string;
  explanation: string;
  category: "ffb" | "graphics" | "visibility" | "performance" | "display" | "latency" | "hardware";
}

export interface IracingAnalysis {
  found: boolean;
  iracingDir: string;
  score: number;
  optimalCount: number;
  recommendedCount: number;
  warningCount: number;
  items: ConfigItem[];
}

export interface Backend {
  snapshot(): Promise<Snapshot>;
  authStart(): Promise<AuthStart>;
  authCancel(): Promise<void>;
  authPoll(): Promise<PollResult>;
  openVerify(): Promise<void>;
  logout(): Promise<void>;
  syncNow(): Promise<SyncReport>;
  saveSettings(patch: SettingsPatch): Promise<Settings>;
  pickFolder(): Promise<Settings | null>;
  detectFolder(): Promise<Settings>;
  pickSto(): Promise<StagedFile | null>;
  clearStaged(): Promise<void>;
  upload(input: UploadInput): Promise<string>;
  installUpdate(): Promise<void>;
  inspectConfig(): Promise<IracingAnalysis>;
  checkIracing(): Promise<string>;
  toggleOverlay(show: boolean): Promise<boolean>;
  quit(): Promise<void>;
  onRefresh(cb: () => void): () => void;
  onStaged(cb: (file: StagedFile) => void): () => void;
  onNotice(cb: (message: string) => void): () => void;
  onUpdate(cb: (version: string) => void): () => void;
  onLive(cb: (sample: LiveSample) => void): () => void;
  onIracingStatus?(cb: (status: string) => void): () => void;
}
