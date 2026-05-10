import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  base: "./",
  plugins: [solid()],
  server: {
    port: 1421,
    strictPort: true,
  },
  build: {
    target: "es2020",
  },
});
