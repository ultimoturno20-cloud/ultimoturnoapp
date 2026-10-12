// Retire the former root-scoped admin worker; the replacement only controls /admin.
self.addEventListener("install", event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("ultimoturno-pwa-")).map(key => caches.delete(key)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
