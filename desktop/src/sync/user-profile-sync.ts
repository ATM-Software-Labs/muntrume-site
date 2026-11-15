export const MAX_PROFILE_BYTES = 51200; // 50 KB limit

const PROFILE_META_KEY = "mmt_profile_sync_meta";
const TRACK_WALK_KEY = "mmt_track_walk_notes";
const OVERLAY_LAYOUTS_KEY = "mmt_overlay_layouts";
const VISIBILITY_RULES_KEY = "mmt_visibility_rules";
const DRIVER_TAGS_KEY = "mmt_driver_tags";
const CLOUD_MIRROR_KEY = "mmt_cloud_profile_mirror";

export interface UserProfileSnapshot {
  version: 1;
  updatedAt: number;
  deviceLabel: string;
  overlayLayouts: Record<string, unknown>;
  visibilityRules: Record<string, unknown>;
  driverTags: unknown[];
  trackWalkNotes: Record<string, string>;
  preferences: Record<string, unknown>;
}

export interface EncryptedProfileEnvelope {
  v: 1;
  alg: "AES-GCM";
  iv: string;
  ciphertext: string;
  updatedAt: number;
  bytes: number;
}

export type ProfileConflictStatus = "in_sync" | "cloud_newer" | "local_newer";

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getLocalProfileUpdatedAt(): number {
  const meta = safeParseJson<{ updatedAt?: number }>(localStorage.getItem(PROFILE_META_KEY), {});
  return typeof meta.updatedAt === "number" ? meta.updatedAt : 0;
}

export function touchLocalProfileUpdatedAt(ts = Date.now()): number {
  const meta = safeParseJson<Record<string, unknown>>(localStorage.getItem(PROFILE_META_KEY), {});
  meta.updatedAt = ts;
  localStorage.setItem(PROFILE_META_KEY, JSON.stringify(meta));
  return ts;
}

export function collectLocalProfileSnapshot(deviceLabel = "Windows Desktop"): UserProfileSnapshot {
  const updatedAt = getLocalProfileUpdatedAt() || Date.now();
  return {
    version: 1,
    updatedAt,
    deviceLabel,
    overlayLayouts: safeParseJson<Record<string, unknown>>(localStorage.getItem(OVERLAY_LAYOUTS_KEY), {}),
    visibilityRules: safeParseJson<Record<string, unknown>>(localStorage.getItem(VISIBILITY_RULES_KEY), {}),
    driverTags: safeParseJson<unknown[]>(localStorage.getItem(DRIVER_TAGS_KEY), []),
    trackWalkNotes: safeParseJson<Record<string, string>>(localStorage.getItem(TRACK_WALK_KEY), {}),
    preferences: safeParseJson<Record<string, unknown>>(localStorage.getItem("mmt_onboarding_prefs"), {}),
  };
}

export function applyProfileSnapshot(snapshot: UserProfileSnapshot): void {
  localStorage.setItem(OVERLAY_LAYOUTS_KEY, JSON.stringify(snapshot.overlayLayouts ?? {}));
  localStorage.setItem(VISIBILITY_RULES_KEY, JSON.stringify(snapshot.visibilityRules ?? {}));
  localStorage.setItem(DRIVER_TAGS_KEY, JSON.stringify(snapshot.driverTags ?? []));
  localStorage.setItem(TRACK_WALK_KEY, JSON.stringify(snapshot.trackWalkNotes ?? {}));
  if (snapshot.preferences && Object.keys(snapshot.preferences).length > 0) {
    localStorage.setItem("mmt_onboarding_prefs", JSON.stringify(snapshot.preferences));
  }
  touchLocalProfileUpdatedAt(snapshot.updatedAt);
}

export function saveTrackWalkNote(trackKey: string, note: string): void {
  const notes = safeParseJson<Record<string, string>>(localStorage.getItem(TRACK_WALK_KEY), {});
  const trimmed = note.trim();
  if (trimmed) {
    notes[trackKey] = trimmed;
  } else {
    delete notes[trackKey];
  }
  localStorage.setItem(TRACK_WALK_KEY, JSON.stringify(notes));
  touchLocalProfileUpdatedAt();
}

export function loadTrackWalkNotes(): Record<string, string> {
  return safeParseJson<Record<string, string>>(localStorage.getItem(TRACK_WALK_KEY), {});
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret || "mmt-local-sync-fallback-key");
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptProfileSnapshot(
  snapshot: UserProfileSnapshot,
  secret: string,
): Promise<EncryptedProfileEnvelope> {
  const json = JSON.stringify(snapshot);
  const plainBytes = new TextEncoder().encode(json);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);
  const cipherBytes = new Uint8Array(cipherBuffer);

  const envelope: EncryptedProfileEnvelope = {
    v: 1,
    alg: "AES-GCM",
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBytes),
    updatedAt: snapshot.updatedAt,
    bytes: 0,
  };
  const serialized = JSON.stringify(envelope);
  const totalBytes = new TextEncoder().encode(serialized).byteLength;
  if (totalBytes > MAX_PROFILE_BYTES) {
    throw new Error(`El perfil cifrado (${totalBytes} B) supera el límite de 50 KB (${MAX_PROFILE_BYTES} B).`);
  }
  envelope.bytes = totalBytes;
  return envelope;
}

export async function decryptProfileEnvelope(
  envelope: EncryptedProfileEnvelope,
  secret: string,
): Promise<UserProfileSnapshot> {
  const key = await deriveAesKey(secret);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  const json = new TextDecoder().decode(plainBuffer);
  return JSON.parse(json) as UserProfileSnapshot;
}

export function detectProfileConflict(localUpdatedAt: number, cloudUpdatedAt: number): ProfileConflictStatus {
  if (!cloudUpdatedAt || Math.abs(localUpdatedAt - cloudUpdatedAt) <= 1000) {
    return "in_sync";
  }
  return cloudUpdatedAt > localUpdatedAt ? "cloud_newer" : "local_newer";
}

export interface ProfileSyncResult {
  status: "pushed" | "restored" | "conflict" | "in_sync" | "offline_cached";
  bytes: number;
  updatedAt: number;
  cloudSnapshot?: UserProfileSnapshot;
}

export class UserProfileSyncClient {
  constructor(private readonly baseUrl = "https://muntru.me") {}

  async fetchCloudEnvelope(token?: string): Promise<EncryptedProfileEnvelope | null> {
    if (token) {
      try {
        const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/api/desktop/profile-sync`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          return (await res.json()) as EncryptedProfileEnvelope;
        }
      } catch {
        // fallback to local cloud mirror cache
      }
    }
    return safeParseJson<EncryptedProfileEnvelope | null>(localStorage.getItem(CLOUD_MIRROR_KEY), null);
  }

  async pushProfile(secret: string, token?: string): Promise<ProfileSyncResult> {
    const snapshot = collectLocalProfileSnapshot();
    const envelope = await encryptProfileSnapshot(snapshot, secret);
    localStorage.setItem(CLOUD_MIRROR_KEY, JSON.stringify(envelope));

    if (token) {
      try {
        const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/api/desktop/profile-sync`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(envelope),
        });
        if (res.ok) {
          return { status: "pushed", bytes: envelope.bytes, updatedAt: envelope.updatedAt };
        }
      } catch {
        // offline fallback
      }
    }

    return { status: "offline_cached", bytes: envelope.bytes, updatedAt: envelope.updatedAt };
  }

  async checkAndSync(secret: string, token?: string): Promise<ProfileSyncResult> {
    const localTs = getLocalProfileUpdatedAt();
    const cloudEnv = await this.fetchCloudEnvelope(token);

    if (!cloudEnv) {
      return this.pushProfile(secret, token);
    }

    const conflict = detectProfileConflict(localTs, cloudEnv.updatedAt);
    if (conflict === "cloud_newer") {
      try {
        const cloudSnapshot = await decryptProfileEnvelope(cloudEnv, secret);
        return {
          status: "conflict",
          bytes: cloudEnv.bytes,
          updatedAt: cloudEnv.updatedAt,
          cloudSnapshot,
        };
      } catch {
        // Could not decrypt with current secret, keep local
        return this.pushProfile(secret, token);
      }
    }

    if (conflict === "local_newer") {
      return this.pushProfile(secret, token);
    }

    return { status: "in_sync", bytes: cloudEnv.bytes, updatedAt: cloudEnv.updatedAt };
  }
}
