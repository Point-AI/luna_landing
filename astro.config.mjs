import { defineConfig, sharpImageService } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  experimental: {
    assets: true,
  },
  integrations: [react(), tailwind(), sitemap()],
  image: {
    service: sharpImageService(),
  },
  base: "/",
  site: "https://pointai.tech",
});
