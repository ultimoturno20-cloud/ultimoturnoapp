import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
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
