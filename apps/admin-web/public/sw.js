const CACHE_PREFIX = "ultimoturno-pwa";
const CACHE_VERSION = "2026-10-03";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`;
const APP_SHELL = "/inicio";
const PRECACHE_URLS = [
  "/",
  APP_SHELL,
  "/manifest.webmanifest",
  "/brand/ultimo-turno-logo.jpeg",
  "/icons/app-192.png",
  "/icons/app-512.png",
  "/icons/app-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(PRECACHE_URLS);
    const shell = await cache.match(APP_SHELL);
    if (shell) {
      const html = await shell.text();
      const builtAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map((match) => match[1]);
      if (builtAssets.length) await cache.addAll([...new Set(builtAssets)]);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, ASSET_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/pricecharting-images/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(APP_SHELL, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(APP_SHELL)) || Response.error())
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(ASSET_CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      }))
    );
  }
});
