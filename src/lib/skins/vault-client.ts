import type { FinishType, PatternStyle, PhotoGuideShot, ZoneKey, ZoneRect } from "./types";

const API_BASE = "https://api.muntru.me";
const VAULT_TOKEN_KEY = "mrt_vault_token";

export class SkinsApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly isNetworkError: boolean;

  constructor(message: string, status: number, code?: string, isNetworkError = false) {
    super(message);
    this.name = "SkinsApiError";
    this.status = status;
    this.code = code;
    this.isNetworkError = isNetworkError;
  }
}

function readCookie(name: string): string {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

export function hydrateSsoFromHashOrCookie(): string {
  try {
    if (window.location.hash && window.location.hash.includes("mm_auth=")) {
      const hp = new URLSearchParams(window.location.hash.slice(1));
      const tk = (hp.get("mm_auth") || "").trim();
      const uRaw = hp.get("mm_user");
      if (tk) {
        localStorage.setItem(VAULT_TOKEN_KEY, tk);
        localStorage.setItem("mm_token", tk);
      }
      if (uRaw) {
        try {
          localStorage.setItem("mrt_vault_user", decodeURIComponent(escape(atob(uRaw))));
        } catch {
          // Ignore malformed user payload
        }
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (tk) return tk;
    }
    const cookieTk = readCookie("mm_sso_tk").trim();
    if (cookieTk) {
      if (!localStorage.getItem(VAULT_TOKEN_KEY)) {
        localStorage.setItem(VAULT_TOKEN_KEY, cookieTk);
        localStorage.setItem("mm_token", cookieTk);
      }
      return cookieTk;
    }
  } catch {
    // Ignore storage/cookie errors
  }
  return "";
}

export function getVaultToken(): string {
  try {
    const sso = hydrateSsoFromHashOrCookie();
    return (
      localStorage.getItem(VAULT_TOKEN_KEY) ||
      localStorage.getItem("mm_token") ||
      sessionStorage.getItem(VAULT_TOKEN_KEY) ||
      sso ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

export function setVaultToken(token: string): void {
  try {
    const clean = token.trim();
    if (!clean) {
      localStorage.removeItem(VAULT_TOKEN_KEY);
      sessionStorage.removeItem(VAULT_TOKEN_KEY);
    } else {
      localStorage.setItem(VAULT_TOKEN_KEY, clean);
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getVaultToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Failed to fetch";
    throw new SkinsApiError(
      `Error de red al conectar con ${API_BASE}${path} (${detail}). Verifica conexión o bloqueadores CORS.`,
      0,
      "network_error",
      true,
    );
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const serverMsg = typeof payload?.error === "string" ? payload.error : "";
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    if (res.status === 401) {
      throw new SkinsApiError(serverMsg || "HTTP 401: Sesión de muntru.me ausente o caducada.", 401, code || "vault_auth_required");
    }
    if (res.status === 403) {
      throw new SkinsApiError(serverMsg || "HTTP 403: Acceso denegado por origen o permisos.", 403, code);
    }
    if (res.status === 404) {
      throw new SkinsApiError(serverMsg || `HTTP 404: Recurso no encontrado (${path}).`, 404, code);
    }
    if (res.status === 429) {
      throw new SkinsApiError(serverMsg || "HTTP 429: Límite de peticiones alcanzado. Espera un minuto.", 429, code);
    }
    throw new SkinsApiError(
      serverMsg ? `HTTP ${res.status}: ${serverMsg}` : `HTTP ${res.status}: Error en el servidor (${path}).`,
      res.status,
      code,
    );
  }

  return (payload ?? {}) as T;
}

export interface WorkerCarSummary {
  car_slug: string;
  name: string;
  brand: string;
  category?: string;
  iracing_folder: string;
  native_resolution: string;
  uv_status: string;
}

export interface WorkerUvRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  mirror_x?: boolean;
  flip_horizontal_logo?: boolean;
}

export interface WorkerUvResponse {
  success: boolean;
  car_slug: string;
  car_name: string;
  brand: string;
  iracing_folder: string;
  native_resolution: string;
  uv_status: string;
  zones: {
    hood?: WorkerUvRect;
    roof?: WorkerUvRect;
    left_side?: WorkerUvRect;
    right_side?: WorkerUvRect;
    rear_wing?: { top_plane?: WorkerUvRect; endplate_left?: WorkerUvRect; endplate_right?: WorkerUvRect };
    front_bumper?: WorkerUvRect;
    rear_bumper?: WorkerUvRect;
    mirrors?: WorkerUvRect;
    sunstrip?: WorkerUvRect;
  };
  restricted_number_plates: Array<WorkerUvRect & { id?: string; label?: string }>;
  wireframe_svg: string;
}

export interface WorkerAiAssistResponse {
  success: boolean;
  car_slug: string;
  uv_status: string;
  design_plan: {
    title: string;
    rationale: string;
    pattern: PatternStyle;
    finish: FinishType;
    palette: { primary: string; secondary: string; accent: string; detail: string };
    layers: Array<{
      zone: string;
      kind?: "team" | "brand" | "series" | "shape";
      asset_hint?: string;
      element: string;
      x: number;
      y: number;
      scale: number;
      rotation: number;
      color?: string;
      mirror_x: boolean;
    }>;
  };
  photo_guide: {
    circuit: string;
    lighting_and_weather: string;
    shots: Array<{
      angle: string;
      camera_ctrl_f12: string;
      focus_check: string;
    }>;
  };
}

export async function fetchWorkerCars(): Promise<WorkerCarSummary[]> {
  const res = await apiFetch<{ success: boolean; cars: WorkerCarSummary[] }>("/api/skins/cars", { method: "GET" });
  return Array.isArray(res.cars) ? res.cars : [];
}

export async function fetchWorkerUvMap(carSlug: string): Promise<WorkerUvResponse> {
  return apiFetch<WorkerUvResponse>(`/api/skins/uv/${encodeURIComponent(carSlug)}`, { method: "GET" });
}

export async function fetchWorkerAiAssist(params: {
  car_slug: string;
  style: string;
  series?: string;
  driver_number: string;
  finish?: FinishType;
  zones?: Record<ZoneKey, ZoneRect>;
  colors: { primary: string; secondary: string; accent: string };
}): Promise<WorkerAiAssistResponse> {
  return apiFetch<WorkerAiAssistResponse>("/api/skins/ai-assist", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function mapWorkerUvToZones(
  uv: WorkerUvResponse,
  fallback: Record<ZoneKey, ZoneRect>,
): Record<ZoneKey, ZoneRect> {
  const [wStr, hStr] = (uv.native_resolution || "2048x2048").split("x");
  const W = Number(wStr) || 2048;
  const H = Number(hStr) || 2048;
  const norm = (r: WorkerUvRect | undefined, base: ZoneRect, minW = 0.06, minH = 0.05): ZoneRect => {
    if (!r || !r.width || !r.height) return { ...base };
    const isAlreadyNorm = r.x <= 1.05 && r.y <= 1.05 && r.width <= 1.05 && r.height <= 1.05;
    const nx = isAlreadyNorm ? r.x : r.x / W;
    const ny = isAlreadyNorm ? r.y : r.y / H;
    const nw = isAlreadyNorm ? r.width : r.width / W;
    const nh = isAlreadyNorm ? r.height : r.height / H;
    // Reject corrupted full-canvas boxes (> 82%) or tiny/out-of-bounds boxes
    if (
      !Number.isFinite(nx) ||
      !Number.isFinite(ny) ||
      !Number.isFinite(nw) ||
      !Number.isFinite(nh) ||
      (nw > 0.82 && nh > 0.82) ||
      nw < minW ||
      nh < minH ||
      nx < 0 ||
      ny < 0 ||
      nx + nw > 1.02 ||
      ny + nh > 1.02
    ) {
      return { ...base };
    }
    return {
      ...base,
      x: Number(nx.toFixed(4)),
      y: Number(ny.toFixed(4)),
      w: Number(nw.toFixed(4)),
      h: Number(nh.toFixed(4)),
    };
  };

  const out: Record<ZoneKey, ZoneRect> = {
    hood: norm(uv.zones.hood, fallback.hood, 0.10, 0.08),
    roof: norm(uv.zones.roof, fallback.roof, 0.10, 0.08),
    leftSide: norm(uv.zones.left_side, fallback.leftSide, 0.10, 0.07),
    rightSide: norm(uv.zones.right_side, fallback.rightSide, 0.10, 0.07),
    rearWing: norm(uv.zones.rear_wing?.top_plane, fallback.rearWing, 0.08, 0.05),
    mirrors: norm(uv.zones.mirrors, fallback.mirrors, 0.05, 0.04),
    frontBumper: norm(uv.zones.front_bumper, fallback.frontBumper, 0.05, 0.05),
    rearBumper: norm(uv.zones.rear_bumper, fallback.rearBumper, 0.05, 0.05),
    numberPlateLeft: norm(uv.restricted_number_plates?.[0], fallback.numberPlateLeft, 0.04, 0.04),
    numberPlateRight: norm(uv.restricted_number_plates?.[1], fallback.numberPlateRight, 0.04, 0.04),
  };
  return out;
}

export function mapWorkerPhotoGuideToShots(
  carSlug: string,
  driverNumber: string,
  guide: WorkerAiAssistResponse["photo_guide"],
  customerId?: string,
): PhotoGuideShot[] {
  const num = (driverNumber || "16").replace(/[^0-9A-Za-z]/g, "") || "16";
  const cid = (customerId || "").replace(/[^0-9]/g, "") || "000000";
  const defaults = [
    { angle: "Frontal 3/4", camera_ctrl_f12: "Ctrl+F12 · Chase/Rear Chase, FOV 38°, altura 1.05m, ángulo 35°", focus_check: "Comprobar logo frontal, capó y encaje de franjas." },
    { angle: "Perfil Lateral Completo", camera_ctrl_f12: "Ctrl+F12 · Plano lateral ortogonal, FOV 30°, altura 1.10m", focus_check: "Verificar que el dorsal lateral no queda tapado y los logos están rectos." },
    { angle: "Trasera 3/4", camera_ctrl_f12: "Ctrl+F12 · Altura 1.10m, FOV 38°, enfoque en alerón y difusor", focus_check: "Revisar alerón trasero, endplates y contraste del difusor." },
    { angle: "Detalle Superior / Dorsal", camera_ctrl_f12: "Ctrl+F12 · Cenital 65°, FOV 34°, centrado en techo y capó", focus_check: "Comprobar legibilidad del dorsal superior y simetría izquierda/derecha." },
  ];
  const raw = Array.isArray(guide.shots) && guide.shots.length > 0 ? guide.shots : defaults;
  const merged = [...raw];
  while (merged.length < 4) {
    merged.push(defaults[merged.length]);
  }
  return merged.slice(0, 4).map((s, idx) => ({
    id: `ai-shot-${idx}`,
    title: `${idx + 1}. ${s.angle}`,
    filename: `mmt_${carSlug}_${num}_0${idx + 1}.png · (subir car_${cid}.tga + car_spec_${cid}.mip)`,
    circuit: guide.circuit || "Circuit de Spa-Francorchamps",
    timeAndWeather: guide.lighting_and_weather || "16:30 · Partly Cloudy",
    cameraSetup: s.camera_ctrl_f12 || defaults[idx].camera_ctrl_f12,
    checklist: [
      s.focus_check || defaults[idx].focus_check,
      idx === 0
        ? `Archivo principal Trading Paints: car_${cid}.tga`
        : `Spec Map (compilado en iRacing): car_spec_${cid}.mip`,
    ],
  }));
}
