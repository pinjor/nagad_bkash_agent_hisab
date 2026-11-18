// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: { plugins: [VitePWA({
    strategies: "generateSW", filename: "sw.js", registerType: "autoUpdate", injectRegister: null,
    // Nitro snapshots the Vite `public/` dir into `.output/public`. Default `dist/`
    // is not served, so the worker 404s in Docker.
    outDir: "public",
    devOptions: { enabled: false },
    manifest: { name: "আমার হিসাব", short_name: "আমার হিসাব", lang: "bn", start_url: "/", scope: "/", display: "standalone", theme_color: "#14532d", background_color: "#f7f9f7", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }] },
    workbox: { globPatterns: ["**/*.{js,css,woff,woff2,png,ico}"], navigateFallback: null, navigationPreload: true,
      runtimeCaching: [
        { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"), handler: "NetworkFirst", options: { cacheName: "hisab-pages", networkTimeoutSeconds: 4, cacheableResponse: { statuses: [200] } } },
        { urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[a-zA-Z0-9_-]{8,}\.(js|css|woff2?|png)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: "hisab-assets", cacheableResponse: { statuses: [200] } } },
      ] },
  })] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Lovable sandbox still forces cloudflare-module. Local and Docker builds
  // need a Node server so `npm run docker:up` can run the output.
  nitro: { preset: "node-server" },
});
