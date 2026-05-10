import { mkdir, writeFile } from "node:fs/promises";
import {
  EMPTY_MANAGED_MODULE,
  INSTALLED_PATH,
  ITEMS_DIR,
  MANAGED_MODULE_PATH,
  STATE_DIR,
  exists,
  writeInstalled,
} from "./state.ts";

export type InitOpts = {
  force: boolean;
};

export async function init(opts: InitOpts): Promise<number> {
  const already = (await exists(INSTALLED_PATH)) || (await exists(MANAGED_MODULE_PATH));
  if (already && !opts.force) {
    console.error(
      `init: ${STATE_DIR} already has rice-registry state. ` + `re-run with --force to overwrite.`
    );
    return 1;
  }

  await mkdir(STATE_DIR, { recursive: true });
  await mkdir(ITEMS_DIR, { recursive: true });
  await writeInstalled({ version: 1, installed: [] });
  await writeFile(MANAGED_MODULE_PATH, EMPTY_MANAGED_MODULE, "utf-8");

  console.log(`Initialized rice-registry state at ${STATE_DIR}`);
  console.log("");
  console.log("  installed.json     state file (currently empty)");
  console.log("  rice-registry.nix  managed home-manager module (currently empty)");
  console.log("  items/             component file payloads (currently empty)");
  console.log("");
  console.log("Next: import the managed module from your home-manager config.");
  console.log("Add this line to ~/.config/home-manager/home.nix (or equivalent):");
  console.log("");
  console.log(`  imports = [ ${MANAGED_MODULE_PATH} ];`);
  console.log("");
  console.log("Then run `nix-rice add <name>` to install rices.");
  return 0;
}
