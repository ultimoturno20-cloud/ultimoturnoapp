export async function retireLegacyStockWorker() {
  if (!("serviceWorker" in navigator)) return;
  const rootScope = `${window.location.origin}/`;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const worker = registration.active || registration.waiting || registration.installing;
    if (registration.scope === rootScope && worker && new URL(worker.scriptURL).pathname === "/sw.js") await registration.unregister();
  }
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith("ultimoturno-pwa-")).map(key => caches.delete(key)));
}
