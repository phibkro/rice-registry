import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, dirname, join } from "node:path";
import { loadValidators, type RegistryItem, type RegistryIndex } from "./schema.ts";

async function findManifests(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        // skip generated + tooling dirs
        if (["node_modules", ".git", "r", "cli"].includes(e.name)) continue;
        await walk(full);
      } else if (e.isFile() && e.name === "rice.json") {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

async function inlineFileContents(item: RegistryItem, manifestDir: string): Promise<void> {
  if (!item.files) return;
  for (const f of item.files) {
    if (f.content !== undefined) continue;
    const filePath = resolve(manifestDir, f.path);
    f.content = await readFile(filePath, "utf-8");
  }
}

export async function build(opts: { root: string; out: string }): Promise<void> {
  const root = resolve(opts.root);
  const out = resolve(opts.out);
  const rDir = join(out, "r");
  await mkdir(rDir, { recursive: true });

  const { item: validateItem, registry: validateRegistry } = await loadValidators();

  const manifests = await findManifests(root);
  if (manifests.length === 0) {
    console.error(`build: no rice.json files found under ${root}`);
    process.exit(1);
  }

  const index: RegistryIndex = {
    $schema: "https://rice-registry.dev/schema/registry.json",
    name: "rice-registry-example",
    homepage: "https://rice-registry.dev",
    description: "Example rice registry built from ./examples.",
    items: [],
  };

  const seen = new Set<string>();
  let failures = 0;

  for (const manifest of manifests) {
    const rel = relative(root, manifest);
    const raw = await readFile(manifest, "utf-8");
    let data: RegistryItem;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error(`${rel}: invalid JSON — ${(e as Error).message}`);
      failures++;
      continue;
    }

    if (!validateItem(data)) {
      console.error(`${rel}: schema violations:`);
      for (const err of validateItem.errors ?? []) {
        console.error(`  ${err.instancePath || "/"} ${err.message}`);
      }
      failures++;
      continue;
    }

    if (seen.has(data.name)) {
      console.error(`${rel}: duplicate name '${data.name}'`);
      failures++;
      continue;
    }
    seen.add(data.name);

    // strip the local $schema (only meaningful in the source tree)
    delete data.$schema;

    await inlineFileContents(data, dirname(manifest));

    const itemPath = join(rDir, `${data.name}.json`);
    await writeFile(itemPath, JSON.stringify(data, null, 2) + "\n", "utf-8");

    index.items.push({
      name: data.name,
      type: data.type,
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.author && { author: data.author }),
      ...(data.categories && { categories: data.categories }),
      ...(data.targets && { targets: data.targets }),
      ...(data.slots && { slots: data.slots }),
      ...(data.previews && { previews: data.previews }),
      url: `/r/${data.name}.json`,
    });

    console.log(`build: ${rel} -> r/${data.name}.json`);
  }

  if (failures > 0) {
    console.error(`\nbuild: ${failures} item(s) failed validation; aborting.`);
    process.exit(1);
  }

  // Sort items deterministically (by name) so the index is reproducible.
  index.items.sort((a, b) => a.name.localeCompare(b.name));

  if (!validateRegistry(index)) {
    console.error("build: generated registry.json fails its own schema:");
    for (const err of validateRegistry.errors ?? []) {
      console.error(`  ${err.instancePath || "/"} ${err.message}`);
    }
    process.exit(1);
  }

  await writeFile(
    join(out, "registry.json"),
    JSON.stringify(index, null, 2) + "\n",
    "utf-8"
  );

  console.log(`\nbuild: wrote registry.json + ${index.items.length} item(s) to ${out}`);
}
