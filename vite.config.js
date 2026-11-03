import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const pagesBasePath = process.env.VITE_BASE_PATH?.trim();
const base = pagesBasePath
  ? `/${pagesBasePath.replace(/^\/+|\/+$/g, "")}/`
  : "/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg", "favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "twiddler-ctl",
        short_name: "twiddler-ctl",
        description: "Edit and sync Twiddler configuration files.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1f6feb",
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{css,html,ico,js,json,png,svg,webmanifest}"],
        globIgnores: ["samples/**"],
      },
    }),
  ],
});
