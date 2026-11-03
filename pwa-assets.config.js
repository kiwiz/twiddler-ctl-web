import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: {
      ...minimal2023Preset.apple,
      // The source SVG already fills its square artwork; don't shrink it further.
      padding: 0,
    },
  },
  images: ["public/pwa-icon.svg"],
});
