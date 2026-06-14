import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.tsx"),
      name: "EcoCheck",
      formats: ["iife"],
      fileName: () => "ecocheck.iife.js",
    },
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: "ecocheck.[ext]",
        inlineDynamicImports: true,
      },
    },
    outDir: "../ecocheck-dist",
    emptyOutDir: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
