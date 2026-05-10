import { readFile } from "node:fs/promises";
import { loadValidators } from "./schema.ts";

export async function validatePath(path: string): Promise<boolean> {
  const { item } = await loadValidators();
  const raw = await readFile(path, "utf-8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`${path}: invalid JSON — ${(e as Error).message}`);
    return false;
  }
  const ok = item(data);
  if (!ok) {
    console.error(`${path}: schema violations:`);
    for (const err of item.errors ?? []) {
      console.error(`  ${err.instancePath || "/"} ${err.message}`);
    }
    return false;
  }
  console.log(`${path}: ok`);
  return true;
}
