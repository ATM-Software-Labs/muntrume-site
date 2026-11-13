export interface CloudManifestSetup {
  id: string;
  car_folder: string;
  track: string;
  type: string;
  version: string;
  checksum: string;
  file_size: number;
  updated_at: string;
}

export interface CloudManifestResponse {
  timestamp: number;
  total: number;
  setups: CloudManifestSetup[];
}

export type ManifestFetchResult =
  | { status: "not_modified"; etag: string }
  | { status: "updated"; etag: string | null; data: CloudManifestResponse };

export class UnauthorizedSyncError extends Error {
  constructor(message = "Desktop sync token is missing, invalid, or revoked") {
    super(message);
    this.name = "UnauthorizedSyncError";
  }
}

/**
 * Strictly typed Cloudflare Worker manifest client with ETag (304) and timeout support.
 */
export class CloudManifestClient {
  private lastEtag: string | null = null;

  constructor(private readonly baseUrl: string) {}

  async fetchManifest(
    token?: string,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<ManifestFetchResult> {
    const timeoutMs = options.timeoutMs ?? 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (this.lastEtag) {
        headers["If-None-Match"] = this.lastEtag;
      }

      const url = `${this.baseUrl.replace(/\/+$/, "")}/api/desktop/manifest`;
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedSyncError();
      }

      if (response.status === 304) {
        return { status: "not_modified", etag: this.lastEtag ?? "" };
      }

      if (!response.ok) {
        throw new Error(`Manifest request failed with HTTP ${response.status}`);
      }

      const etag = response.headers.get("ETag");
      if (etag) {
        this.lastEtag = etag;
      }

      const data = (await response.json()) as CloudManifestResponse;
      return { status: "updated", etag, data };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }
}
