import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" : on n'impose jamais un rechargement en pleine partie,
      // le joueur choisit quand mettre à jour (voir UpdatePrompt).
      registerType: "prompt",
      includeAssets: ["icons/icon.svg", "icons/apple-touch-icon.png", "icons/favicon-64.png"],
      manifest: {
        name: "NIO FAR — Jeux pour couples",
        short_name: "NIO FAR",
        description: "Jouez. Découvrez-vous. Rapprochez-vous. Jeux en temps réel pour couples, chacun sur son téléphone.",
        lang: "fr",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#070113",
        theme_color: "#070113",
        categories: ["games", "entertainment", "lifestyle"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
        shortcuts: [
          { name: "Action ou Vérité", short_name: "Action/Vérité", url: "/?jeu=TRUTH_OR_DARE", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Questions de couple", short_name: "Questions", url: "/?jeu=COUPLE_QUESTIONS", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // image de partage (réseaux sociaux) : inutile hors ligne
        globIgnores: ["brand/**", "**/*-{cyrillic,cyrillic-ext,greek,greek-ext,hebrew,vietnamese,math,symbols}-*.woff2"],
        navigateFallback: "/index.html",
        // l'API et le WebSocket ne doivent jamais passer par le cache
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: process.env.VITE_SERVER_URL ?? "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
