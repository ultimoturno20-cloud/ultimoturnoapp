import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const routes = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
function matchRoute(pathname, source) {
  if (!source.endsWith("/:path*")) return pathname === source ? "" : null;
  const prefix = source.slice(0, -"/:path*".length);
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length + 1) : null;
}
function configurePageRoutes(server) {
  server.middlewares.use((req, res, next) => {
    if (!req.url) return next();
    const url = new URL(req.url, "http://localhost");
    for (const rule of routes.headers) {
      if (matchRoute(url.pathname, rule.source) !== null) for (const header of rule.headers) res.setHeader(header.key, header.value);
    }
    for (const redirect of routes.redirects) {
      const tail = matchRoute(url.pathname, redirect.source);
      if (tail === null) continue;
      res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination.replace(":path*", tail) + url.search });
      res.end(); return;
    }
    const rewrite = routes.rewrites.find(route => ["/admin.html", "/torneos.html"].includes(route.destination) && matchRoute(url.pathname, route.source) !== null);
    if (rewrite) req.url = rewrite.destination + url.search;
    next();
  });
}

export default defineConfig({
  base: "/",
  plugins: [react(), { name: "ultimoturno-page-routes", configureServer: configurePageRoutes, configurePreviewServer: configurePageRoutes }],
  build: {rollupOptions: {input: {storefront: "index.html", stock: "admin.html", tournaments: "torneos.html"}}},
  server: {
    port: Number(process.env.ADMIN_WEB_PORT || 5173),
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app"],
    proxy: {
      "/api": {
        target: process.env.ULTIMOTURNO_API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, "")
      },
      "/pricecharting-images": {
        target: process.env.ULTIMOTURNO_API_PROXY_TARGET || "http://localhost:4000",
        changeOrigin: true
      }
    }
  }
});
