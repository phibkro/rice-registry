import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegistryItem } from "./schema.ts";
import { plan } from "./resolve.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export type ExplainOpts = {
  target: string;
  installed: string[];
};

export async function explain(opts: ExplainOpts): Promise<number> {
  // Load the root item — accept a name (resolved against ./r/) or a path.
  let root: RegistryItem;
  try {
    if (opts.target.startsWith("http://") || opts.target.startsWith("https://")) {
      const res = await fetch(opts.target);
      if (!res.ok) throw new Error(`fetch ${opts.target}: HTTP ${res.status}`);
      root = (await res.json()) as RegistryItem;
    } else if (opts.target.includes("/") || opts.target.endsWith(".json")) {
      const raw = await readFile(opts.target, "utf-8");
      root = JSON.parse(raw) as RegistryItem;
    } else {
      const raw = await readFile(resolve(repoRoot, "r", `${opts.target}.json`), "utf-8");
      root = JSON.parse(raw) as RegistryItem;
    }
  } catch (e) {
    console.error(`explain: cannot load ${opts.target}: ${(e as Error).message}`);
    return 1;
  }

  const { resolved, conflicts } = await plan(root, opts.installed);

  console.log(`Plan for ${root.name} (${root.type}):`);
  console.log("");
  console.log(`  Resolution order (deps first, root last):`);
  for (const it of resolved.items) {
    const provides = it.slots?.provides?.length
      ? ` provides=[${it.slots.provides.join(", ")}]`
      : "";
    console.log(`    ${it.name.padEnd(24)} ${it.type.padEnd(20)}${provides}`);
  }

  if (opts.installed.length > 0) {
    console.log("");
    console.log(`  Already installed: ${opts.installed.join(", ")}`);
  }

  console.log("");
  if (conflicts.ok) {
    console.log("  ✓ no conflicts");
    return 0;
  }

  if (conflicts.slotConflicts.length > 0) {
    console.log("  ✗ slot conflicts:");
    for (const c of conflicts.slotConflicts) {
      console.log(`      slot ${c.slot}: ${c.items.join(", ")}`);
    }
  }
  if (conflicts.unmetConsumes.length > 0) {
    console.log("  ✗ unmet consumes:");
    for (const u of conflicts.unmetConsumes) {
      console.log(`      ${u.item} consumes ${u.slot} which is not provided`);
    }
  }
  if (conflicts.unsatisfied.length > 0) {
    console.log("  ✗ unresolved dependencies:");
    for (const u of conflicts.unsatisfied) {
      console.log(`      ${u}`);
    }
  }
  return 1;
}
