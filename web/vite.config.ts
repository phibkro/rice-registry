import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 1421,
    strictPort: true,
  },
  build: {
    target: "es2020",
  },
});
