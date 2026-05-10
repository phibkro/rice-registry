import { rm, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ITEMS_DIR, exists, readInstalled, writeInstalled } from "./state.ts";
import { regenerateManagedModule } from "./apply.ts";
import type { RegistryItem } from "./schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export type RemoveOpts = {
  name: string;
  cascade: boolean;
};

/** Find all installed items that depend on `name` via their
 * registryDependencies. Loads each from r/<n>.json. */
async function findDependents(name: string, installedNames: string[]): Promise<string[]> {
  const dependents: string[] = [];
  for (const n of installedNames) {
    if (n === name) continue;
    const path = resolve(repoRoot, "r", `${n}.json`);
    try {
      const item = JSON.parse(await readFile(path, "utf-8")) as RegistryItem;
      if (item.registryDependencies?.includes(name)) {
        dependents.push(n);
      }
    } catch {
      // best-effort — items not in the local registry are skipped
    }
  }
  return dependents;
}

export async function remove(opts: RemoveOpts): Promise<number> {
  const state = await readInstalled();
  const target = state.installed.find((e) => e.name === opts.name);
  if (!target) {
    console.error(`remove: ${opts.name} is not installed`);
    return 1;
  }

  const installedNames = state.installed.map((e) => e.name);
  const dependents = await findDependents(opts.name, installedNames);

  let toRemove: string[];
  if (dependents.length === 0) {
    toRemove = [opts.name];
  } else if (!opts.cascade) {
    console.error(`remove: ${opts.name} is depended on by other installed item(s):`);
    for (const d of dependents) console.error(`    ${d}`);
    console.error("");
    console.error("re-run with --cascade to remove them too, or remove those first.");
    return 1;
  } else {
    // With --cascade, remove the named item AND every dependent. Note this
    // doesn't recurse — dependents-of-dependents need their own pass.
    toRemove = [opts.name, ...dependents];
  }

  // Drop from state.
  state.installed = state.installed.filter((e) => !toRemove.includes(e.name));
  await writeInstalled(state);

  // Drop items/<n>/ dirs.
  for (const n of toRemove) {
    const itemDir = resolve(ITEMS_DIR, n);
    if (await exists(itemDir)) {
      await rm(itemDir, { recursive: true, force: true });
    }
  }

  await regenerateManagedModule();

  console.log(`✓ removed ${toRemove.length} item(s):`);
  for (const n of toRemove) console.log(`    ${n}`);
  console.log("");
  console.log("  Next: review the diff and apply via home-manager:");
  console.log("    nh home switch");
  return 0;
}
