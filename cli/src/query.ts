import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RegistryIndex } from "./schema.ts";

export type QueryOpts = {
  registry: string;
  machineTags: string[];
  type?: string;
};

function isInstallable(itemTargets: string[] | undefined, machine: string[]): boolean {
  if (!itemTargets || itemTargets.length === 0) return true;
  if (itemTargets.includes("any")) return true;
  // Item is installable iff every required tag is satisfied by the machine.
  return itemTargets.every((t) => machine.includes(t));
}

export async function query(opts: QueryOpts): Promise<void> {
  const path = opts.registry.startsWith("http")
    ? null
    : resolve(opts.registry);

  let index: RegistryIndex;
  if (path) {
    index = JSON.parse(await readFile(path, "utf-8")) as RegistryIndex;
  } else {
    const res = await fetch(opts.registry);
    if (!res.ok) throw new Error(`fetch ${opts.registry}: HTTP ${res.status}`);
    index = (await res.json()) as RegistryIndex;
  }

  const filtered = index.items.filter((it) => {
    if (opts.type && it.type !== opts.type) return false;
    return isInstallable(it.targets, opts.machineTags);
  });

  console.log(
    `${filtered.length}/${index.items.length} item(s) match ` +
      `[machine: ${opts.machineTags.length ? opts.machineTags.join(",") : "any"}` +
      `${opts.type ? `, type: ${opts.type}` : ""}]`
  );
  for (const it of filtered) {
    const tgt = it.targets?.length ? `(${it.targets.join(",")})` : "(any)";
    console.log(`  ${it.name.padEnd(24)} ${it.type.padEnd(20)} ${tgt}`);
  }
}
