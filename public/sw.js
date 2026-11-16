// Muntrume Motorsport — Ultra-Lightweight PWA Service Worker (Prompt 79)
// Shell-only cache + strict Network-First for HTML/API; never caches telemetry, .sto, .ibt, or localhost bridge.

const CACHE_NAME = "mmt-shell-v1";
const SHELL_ASSETS = [
  "/favicon.svg",
  "/manifest.webmanifest",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept local MMT Sync bridge, external APIs, telemetry, or setup files
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".sto") ||
    url.pathname.endsWith(".ibt") ||
    url.pathname.endsWith(".json")
  ) {
    return;
  }

  // Network-First for all HTML pages and static assets so content is never stale
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (
          res.ok &&
          (url.pathname.startsWith("/assets/css/") ||
            url.pathname.startsWith("/assets/fonts/") ||
            SHELL_ASSETS.includes(url.pathname))
        ) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
