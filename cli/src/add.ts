import { readFile } from "node:fs/promises";
import { loadValidators, type RegistryItem } from "./schema.ts";
import { plan } from "./resolve.ts";

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

  console.log(`Resolved: ${root.name} (${root.type})`);

  // Resolve transitive deps + check conflicts (against an empty
  // already-installed set for the prototype — no state file yet).
  const { resolved, conflicts } = await plan(root, []);

  if (resolved.items.length > 1) {
    console.log(`  transitive closure (${resolved.items.length}):`);
    for (const it of resolved.items) {
      const provides = it.slots?.provides?.length
        ? ` provides=[${it.slots.provides.join(", ")}]`
        : "";
      console.log(`    ${it.name.padEnd(24)} ${it.type.padEnd(20)}${provides}`);
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
    process.exit(1);
  }

  console.log(
    "\n[stub] add: resolved + conflict-checked.\n" +
      "       Real apply path (mutate user flake → nh home build → switch →\n" +
      "       screenshot generation thumbnail) not implemented yet — see\n" +
      "       docs/OUTSTANDING.md § Apply path."
  );
}
