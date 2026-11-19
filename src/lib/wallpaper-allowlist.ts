/**
 * Un wallpaper entra solo si su URL está en el manifiesto local
 * o en un prefijo de media oficial de iRacing. No se adivina por palabras sueltas.
 */

export const ALLOWED_REMOTE_PREFIXES = [
  "https://s100.iracing.com/wp-content/uploads/",
  "https://www.iracing.com/wp-content/uploads/",
  "https://ir-core-sites.iracing.com/members/member_images/cars/",
] as const;

/** Segmentos de ruta que nunca pueden ser un wallpaper público. */
export const BLOCKED_PATH_SEGMENTS = ["internal", "admin", "brand", "working", "garage", "setup"] as const;

export interface RemoteWallpaperMeta {
  isOfficialPress?: boolean;
  sourceType?: string;
}

export function pathnameOf(urlOrPath: string): string {
  const raw = String(urlOrPath || "").trim();
  if (!raw) return "";
  try {
    if (raw.startsWith("/")) return new URL(raw, "https://muntru.me").pathname;
    return new URL(raw).pathname;
  } catch {
    return raw.split("?")[0].split("#")[0];
  }
}

export function pathSegments(urlOrPath: string): string[] {
  return pathnameOf(urlOrPath)
    .split("/")
    .filter(Boolean)
    .map((part) => part.toLowerCase());
}

export function hasBlockedPathSegment(urlOrPath: string): boolean {
  const blocked = new Set<string>(BLOCKED_PATH_SEGMENTS);
  return pathSegments(urlOrPath).some((part) => blocked.has(part));
}

export function isAllowedRemoteWallpaper(url: string, meta: RemoteWallpaperMeta): boolean {
  const clean = String(url || "").trim();
  if (!clean || hasBlockedPathSegment(clean)) return false;
  if (meta.isOfficialPress !== true) return false;
  if (meta.sourceType !== "official_press") return false;
  return ALLOWED_REMOTE_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

export function isAllowedManifestPath(urlOrPath: string, manifestPaths: ReadonlySet<string>): boolean {
  const path = pathnameOf(urlOrPath);
  if (!path.startsWith("/assets/img/")) return false;
  if (path.startsWith("/assets/img/series/")) return false;
  if (hasBlockedPathSegment(path)) return false;
  return manifestPaths.has(path);
}
