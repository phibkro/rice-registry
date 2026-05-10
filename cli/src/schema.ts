import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const schemasDir = resolve(here, "../../schemas");

let cached: { item: ValidateFunction; registry: ValidateFunction } | null = null;

export async function loadValidators() {
  if (cached) return cached;

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const itemSchema = JSON.parse(
    await readFile(resolve(schemasDir, "registry-item.schema.json"), "utf-8")
  );
  const registrySchema = JSON.parse(
    await readFile(resolve(schemasDir, "registry.schema.json"), "utf-8")
  );

  ajv.addSchema(itemSchema);
  ajv.addSchema(registrySchema);

  cached = {
    item: ajv.compile(itemSchema),
    registry: ajv.compile(registrySchema),
  };
  return cached;
}

export type RegistryItem = {
  $schema?: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  version?: string;
  registryDependencies?: string[];
  nixpkgsDependencies?: string[];
  files?: Array<{
    path: string;
    type: string;
    target?: string;
    content?: string;
  }>;
  cssVars?: {
    theme?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  compatibility?: Record<string, string>;
  slots?: {
    provides?: string[];
    consumes?: string[];
    conflicts?: string[];
  };
  previews?: { static?: string[]; live?: string[] };
  categories?: string[];
  targets?: string[];
  meta?: Record<string, unknown>;
};

export type RegistryIndex = {
  $schema?: string;
  name: string;
  homepage?: string;
  description?: string;
  items: Array<{
    name: string;
    type: string;
    title?: string;
    description?: string;
    author?: string;
    categories?: string[];
    targets?: string[];
    slots?: RegistryItem["slots"];
    previews?: RegistryItem["previews"];
    url?: string;
  }>;
};
