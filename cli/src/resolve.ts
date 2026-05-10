import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegistryItem } from "./schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export type ResolvedSet = {
  /** Items in topological order — dependencies precede dependents. */
  items: RegistryItem[];
  /** Names that appeared in registryDependencies but couldn't be loaded. */
  unsatisfied: string[];
};

export type SlotConflict = {
  slot: string;
  items: string[];
};

export type UnmetConsume = {
  item: string;
  slot: string;
};

export type ConflictReport = {
  ok: boolean;
  /** Two or more items providing the same slot. */
  slotConflicts: SlotConflict[];
  /** An item consumes a slot that no other item provides. */
  unmetConsumes: UnmetConsume[];
  /** registryDependencies that couldn't be resolved. */
  unsatisfied: string[];
};

/** Read a registry item from a local r/<name>.json file. URL fetching is
 * deferred — see add.ts for the http path. */
async function loadFromName(name: string): Promise<RegistryItem | null> {
  if (name.includes("/") || name.includes("..")) return null;
  const path = resolve(repoRoot, "r", `${name}.json`);
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as RegistryItem;
  } catch {
    return null;
  }
}

/** Walk registryDependencies transitively; return items in a stable
 * dependency-first order. The root is included as the last entry.
 *
 * Cycle detection: simple — visited-while-resolving set; throws on
 * re-entry. The local registry has no cycles today. */
export async function resolveTransitive(root: RegistryItem): Promise<ResolvedSet> {
  const out: RegistryItem[] = [];
  const seen = new Set<string>();
  const stack = new Set<string>();
  const unsatisfied: string[] = [];

  async function visit(name: string): Promise<RegistryItem | null> {
    if (seen.has(name)) {
      return out.find((it) => it.name === name) ?? null;
    }
    if (stack.has(name)) {
      throw new Error(`cycle detected involving ${name}`);
    }
    stack.add(name);
    const item = await loadFromName(name);
    if (!item) {
      unsatisfied.push(name);
      stack.delete(name);
      return null;
    }
    for (const dep of item.registryDependencies ?? []) {
      await visit(dep);
    }
    seen.add(name);
    stack.delete(name);
    out.push(item);
    return item;
  }

  for (const dep of root.registryDependencies ?? []) {
    await visit(dep);
  }
  // The root itself goes at the end. We don't recursively visit it
  // (that would double-count), but we mark it seen so future references
  // don't refetch.
  if (!seen.has(root.name)) {
    seen.add(root.name);
    out.push(root);
  }

  return { items: out, unsatisfied };
}

/** Build a conflict report over the union of `installed` and `pending`.
 *
 * Pinned semantics (docs/DESIGN.md § "Slot semantics"):
 *   - Two items with overlapping `provides` ⇒ slotConflict, abort.
 *   - An item with a `consumes` slot that no item in the union provides
 *     ⇒ unmetConsume, abort.
 *   - The check operates on the union, not just the new transitive closure.
 */
export function detectConflicts(
  installed: RegistryItem[],
  pending: RegistryItem[]
): ConflictReport {
  const all = [...installed, ...pending];

  // Slot → items that provide it.
  const provides = new Map<string, string[]>();
  for (const it of all) {
    for (const slot of [...(it.slots?.provides ?? []), ...(it.slots?.conflicts ?? [])]) {
      const cur = provides.get(slot) ?? [];
      if (!cur.includes(it.name)) cur.push(it.name);
      provides.set(slot, cur);
    }
  }

  const slotConflicts: SlotConflict[] = [];
  for (const [slot, items] of provides) {
    if (items.length >= 2) slotConflicts.push({ slot, items });
  }

  const unmetConsumes: UnmetConsume[] = [];
  for (const it of all) {
    for (const slot of it.slots?.consumes ?? []) {
      if (!provides.has(slot)) {
        unmetConsumes.push({ item: it.name, slot });
      }
    }
  }

  return {
    ok: slotConflicts.length === 0 && unmetConsumes.length === 0,
    slotConflicts,
    unmetConsumes,
    unsatisfied: [],
  };
}

/** Top-level: resolve a root item's transitive deps + check conflicts
 * against an already-installed set. */
export async function plan(
  root: RegistryItem,
  installedNames: string[]
): Promise<{ resolved: ResolvedSet; conflicts: ConflictReport }> {
  const resolved = await resolveTransitive(root);

  const installed: RegistryItem[] = [];
  const installUnsatisfied: string[] = [];
  for (const n of installedNames) {
    const it = await loadFromName(n);
    if (it) installed.push(it);
    else installUnsatisfied.push(n);
  }

  const conflicts = detectConflicts(installed, resolved.items);
  conflicts.unsatisfied = [...resolved.unsatisfied, ...installUnsatisfied];
  if (conflicts.unsatisfied.length > 0) conflicts.ok = false;

  return { resolved, conflicts };
}
