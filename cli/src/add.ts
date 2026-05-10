import { readFile } from "node:fs/promises";
import { loadValidators, type RegistryItem } from "./schema.ts";
import { plan } from "./resolve.ts";
import { readInstalled, exists, INSTALLED_PATH, MANAGED_MODULE_PATH } from "./state.ts";
import { applyResolved } from "./apply.ts";

async function fetchItem(target: string): Promise<RegistryItem> {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    const res = await fetch(target);
    if (!res.ok) throw new Error(`fetch ${target}: HTTP ${res.status}`);
    return (await res.json()) as RegistryItem;
  }
  const raw = await readFile(target, "utf-8");
  return JSON.parse(raw) as RegistryItem;
}

export async function add(target: string): Promise<void> {
  const { item: validate } = await loadValidators();
  const root = await fetchItem(target);

  if (!validate(root)) {
    console.error(`add: ${target} fails registry-item schema:`);
    for (const err of validate.errors ?? []) {
      console.error(`  ${err.instancePath || "/"} ${err.message}`);
    }
    process.exit(1);
  }

  console.log(`Resolving: ${root.name} (${root.type})`);

  let installed: string[] = [];
  let machine = undefined;
  if (await exists(INSTALLED_PATH)) {
    const state = await readInstalled();
    installed = state.installed.map((e) => e.name);
    machine = state.machine;
  }
  const { resolved, conflicts } = await plan(root, installed, machine);

  if (resolved.items.length > 1) {
    console.log(`  transitive closure (${resolved.items.length}):`);
    for (const it of resolved.items) {
      const provides = it.slots?.provides?.length
        ? ` provides=[${it.slots.provides.join(", ")}]`
        : "";
      const status = installed.includes(it.name) ? " [already installed]" : "";
      console.log(`    ${it.name.padEnd(24)} ${it.type.padEnd(20)}${provides}${status}`);
    }
  }

  if (!conflicts.ok) {
    console.error("\n  ✗ apply blocked by conflicts:");
    for (const c of conflicts.slotConflicts) {
      console.error(`    slot ${c.slot}: ${c.items.join(", ")}`);
    }
    for (const u of conflicts.unmetConsumes) {
      console.error(`    ${u.item} consumes ${u.slot} which is not provided`);
    }
    for (const u of conflicts.unsatisfied) {
      console.error(`    unresolved: ${u}`);
    }
    for (const m of conflicts.compatMisses) {
      console.error(`    ${m.item}: requires ${m.key} ${m.required}; machine has ${m.actual}`);
    }
    process.exit(1);
  }

  if (!(await exists(MANAGED_MODULE_PATH))) {
    console.error(
      "\n  ✗ rice-registry state not initialized.\n" +
        "    run `nix-rice init` first to create ~/.config/rice-registry/."
    );
    process.exit(1);
  }

  const result = await applyResolved(resolved.items);

  console.log("");
  if (result.newItems.length === 0) {
    console.log(`  ✓ all items already installed (${result.alreadyInstalled.length}); no changes`);
    return;
  }
  console.log(`  ✓ installed ${result.newItems.length} item(s):`);
  for (const n of result.newItems) console.log(`      ${n}`);
  if (result.alreadyInstalled.length > 0) {
    console.log(
      `  (${result.alreadyInstalled.length} already installed: ${result.alreadyInstalled.join(", ")})`
    );
  }
  console.log(`  ✓ wrote ${result.filesWritten} file(s) under ~/.config/rice-registry/items/`);
  console.log(`  ✓ regenerated ${MANAGED_MODULE_PATH}`);
  console.log("");
  console.log("  Next: review the diff and apply via home-manager:");
  console.log("    nh home switch       # or: home-manager switch");
}
