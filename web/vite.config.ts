import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [solid(), tailwindcss()],
  server: {
    port: 1421,
    strictPort: true,
  },
  build: {
    target: "es2020",
  },
});
