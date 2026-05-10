// Copies registry.json + r/*.json from the repo root into web/public/ so
// Vite serves them as static assets (both in dev and after build).

import { readdirSync, copyFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const publicDir = resolve(here, "..", "public");

const srcRegistry = resolve(repoRoot, "registry.json");
const srcRDir = resolve(repoRoot, "r");

if (!existsSync(srcRegistry) || !existsSync(srcRDir)) {
  console.error(
    "copy-registry: registry.json or r/ missing at repo root.\n" +
      "  run `bun cli/src/index.ts build` from the repo root first."
  );
  process.exit(1);
}

mkdirSync(publicDir, { recursive: true });

const dstRDir = resolve(publicDir, "r");
if (existsSync(dstRDir)) rmSync(dstRDir, { recursive: true });
mkdirSync(dstRDir);

copyFileSync(srcRegistry, resolve(publicDir, "registry.json"));

let count = 0;
for (const f of readdirSync(srcRDir)) {
  if (!f.endsWith(".json")) continue;
  copyFileSync(resolve(srcRDir, f), resolve(dstRDir, f));
  count++;
}

console.log(`copy-registry: registry.json + ${count} item(s) -> web/public/`);
