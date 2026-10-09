import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

function productionHtmlPlugin() {
  return {
    name: "production-html-routing",
    apply: "build" as const,
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, "dist");
      const spaHtml = path.join(distDir, "index.html");
      const appHtml = path.join(distDir, "app.html");
      const landingHtml = path.join(distDir, "landing.html");

      if (fs.existsSync(spaHtml) && fs.existsSync(landingHtml)) {
        // Copy the SPA entry to dist/app.html
        fs.copyFileSync(spaHtml, appHtml);
        // Replace dist/index.html with the optimized static landing page
        fs.copyFileSync(landingHtml, spaHtml);
      }
    },
  };
}

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    productionHtmlPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-charts": ["recharts"],
          "vendor-map": ["leaflet", "react-leaflet"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: {
    port: Number(process.env.PORT ?? "3000"),
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: false,
    },
  },
  preview: {
    port: Number(process.env.PORT ?? "3000"),
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
