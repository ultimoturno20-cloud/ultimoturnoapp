import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { adminViewPaths, adminViewFromUrl, isAdminPath, isResellerPortalPath } from "../src/admin-routing.js";

const root = new URL("../../../", import.meta.url);
const config = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));

test("every admin section resolves below /admin, including the renamed settings page", () => {
  for (const [view, path] of Object.entries(adminViewPaths)) {
    assert.equal(isAdminPath(path), true);
    assert.equal(adminViewFromUrl(new URL(`${path}/?source=bookmark`, "https://ultimoturno.app")), view);
    assert.ok(config.rewrites.some((route: { source: string; destination: string }) => route.destination === "/admin.html" && (route.source === path || (route.source.endsWith("/:path*") && path.startsWith(route.source.slice(0, -"/:path*".length) + "/")))), path);
  }
  assert.equal(adminViewPaths.dashboard, "/admin");
  assert.equal(adminViewPaths.admin, "/admin/configuracion");
});

test("public and reseller paths cannot be treated as admin by prefix or legacy flags", () => {
  for (const path of ["/", "/tienda", "/administrator", "/admin-fake", "/torneos", "/portal-revendedor"]) assert.equal(isAdminPath(path), false);
  assert.equal(isResellerPortalPath("/portal-revendedor"), true);
  assert.equal(isResellerPortalPath("/portal-revendedor/stock"), true);
  assert.equal(isResellerPortalPath("/portal-revendedor-fake"), false);
  assert.equal(adminViewFromUrl(new URL("https://ultimoturno.app/?mobile=1#mobile")), "dashboard");
  assert.equal(adminViewFromUrl(new URL("https://ultimoturno.app/admin?mobile=1")), "mobile-intake");
  assert.equal(adminViewFromUrl(new URL("https://ultimoturno.app/admin#mobile")), "mobile-intake");
});

test("legacy bookmarks redirect without making the public root an admin document", () => {
  for (const legacy of ["/inicio", "/inventario", "/ordenes", "/caja", "/claims", "/compras", "/calidad", "/movimientos", "/importar", "/carga-movil", "/revendedores"]) {
    assert.ok(config.redirects.some((route: { source: string; destination: string }) => route.source === legacy && isAdminPath(route.destination)));
    assert.equal(config.rewrites.some((route: { source: string; destination: string }) => route.source === legacy), false);
  }
  assert.equal(config.rewrites.some((route: { source: string; destination: string }) => route.destination === "/index.html"), false);
  assert.equal(config.redirects.some((route: { source: string }) => route.source === "/"), false);
  const publicHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(publicHtml.includes('/src/storefront.ts'));
  assert.equal(publicHtml.includes('/src/main.tsx'), false);
  assert.equal(publicHtml.includes('rel="manifest"'), false);
  const adminHtml = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
  assert.ok(adminHtml.includes('/src/main.tsx'));
  assert.ok(adminHtml.includes('noindex, nofollow'));
});

test("the installed app keeps its identity but starts and navigates inside admin", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/admin/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.id, "/inicio");
  assert.equal(manifest.scope, "/admin");
  assert.equal(isAdminPath(new URL(manifest.start_url, "https://ultimoturno.app").pathname), true);
  for (const shortcut of manifest.shortcuts) assert.equal(isAdminPath(new URL(shortcut.url, "https://ultimoturno.app").pathname), true);
  assert.ok(config.headers.some((rule: { source: string; headers: Array<{ key: string; value: string }> }) => rule.source === "/admin/sw.js" && rule.headers.some(header => header.key === "Service-Worker-Allowed" && header.value === "/admin")));
});

test("admin offline shell never handles the shop, portal, tournaments or private API", () => {
  const listeners = new Map<string, (event: unknown) => void>();
  let responded = false;
  runInNewContext(readFileSync(new URL("../public/admin/sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: "https://ultimoturno.app" }, addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler) }, URL,
    fetch: () => Promise.resolve({ ok: false }), caches: { match: () => Promise.resolve(undefined) }, Response
  });
  for (const pathname of ["/", "/tienda", "/torneos", "/portal-revendedor", "/administrator", "/api/stock", "/pricecharting-images/test"]) {
    responded = false;
    listeners.get("fetch")!({ request: { method: "GET", mode: "navigate", url: `https://ultimoturno.app${pathname}` }, respondWith: () => { responded = true; } });
    assert.equal(responded, false, pathname);
  }
  listeners.get("fetch")!({ request: { method: "GET", mode: "navigate", url: "https://ultimoturno.app/admin/ordenes" }, respondWith: () => { responded = true; } });
  assert.equal(responded, true);
});

test("the former root worker unregisters and only removes its own obsolete cache", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const deleted: string[] = []; let unregistered = false;
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self: { addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler), clients: { claim: async () => {} }, registration: { unregister: async () => { unregistered = true; } } },
    caches: { keys: async () => ["ultimoturno-pwa-shell-old", "ultimoturno-admin-pwa-shell-new", "other-app"], delete: async (key: string) => { deleted.push(key); } }
  });
  let completion: Promise<unknown> = Promise.resolve();
  listeners.get("activate")!({ waitUntil: (promise: Promise<unknown>) => { completion = promise; } });
  await completion;
  assert.equal(unregistered, true);
  assert.deepEqual(deleted, ["ultimoturno-pwa-shell-old"]);
  assert.equal(listeners.has("fetch"), false);
});
