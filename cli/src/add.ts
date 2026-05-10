import { readFile } from "node:fs/promises";
import { loadValidators, type RegistryItem } from "./schema.ts";

async function fetchItem(target: string): Promise<RegistryItem> {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    const res = await fetch(target);
    if (!res.ok) throw new Error(`fetch ${target}: HTTP ${res.status}`);
    return (await res.json()) as RegistryItem;
  }
  // Treat as a local path for now; real implementation would resolve against
  // a configured default-registry URL and fall back to multiple sources.
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
  if (root.registryDependencies?.length) {
    console.log(`  registryDependencies: ${root.registryDependencies.join(", ")}`);
  }
  if (root.nixpkgsDependencies?.length) {
    console.log(`  nixpkgsDependencies:  ${root.nixpkgsDependencies.join(", ")}`);
  }
  if (root.slots) {
    if (root.slots.provides?.length)  console.log(`  provides:  ${root.slots.provides.join(", ")}`);
    if (root.slots.consumes?.length)  console.log(`  consumes:  ${root.slots.consumes.join(", ")}`);
    if (root.slots.conflicts?.length) console.log(`  conflicts: ${root.slots.conflicts.join(", ")}`);
  }
  if (root.cssVars) {
    const tokens = new Set([
      ...Object.keys(root.cssVars.theme ?? {}),
      ...Object.keys(root.cssVars.light ?? {}),
      ...Object.keys(root.cssVars.dark ?? {}),
    ]);
    console.log(`  cssVars: ${tokens.size} token(s) [${[...tokens].slice(0, 6).join(", ")}${tokens.size > 6 ? ", ..." : ""}]`);
  }
  if (root.files?.length) {
    console.log(`  files: ${root.files.length}`);
  }

  console.log(
    "\n[stub] add: schema-validated, dependency graph printed.\n" +
      "       Real apply path (resolve transitively → write to user flake imports →\n" +
      "       'nh home switch' → screenshot generation thumbnail) not implemented yet."
  );
}
