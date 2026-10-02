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
      includeAssets: ["pwa-icon.svg"],
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
            src: "pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{css,html,js,json,svg,webmanifest}"],
        globIgnores: ["samples/**"],
      },
    }),
  ],
});
