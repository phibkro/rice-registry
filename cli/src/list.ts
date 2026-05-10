import { readInstalled, exists, INSTALLED_PATH } from "./state.ts";

export async function list(): Promise<number> {
  if (!(await exists(INSTALLED_PATH))) {
    console.log("No rice-registry state. Run `nix-rice init` to set up.");
    return 0;
  }

  const state = await readInstalled();
  if (state.installed.length === 0) {
    console.log("No items installed.");
    return 0;
  }

  console.log(`Installed (${state.installed.length}):`);
  for (const it of state.installed) {
    const ts = it.addedAt.slice(0, 10); // YYYY-MM-DD
    console.log(`  ${it.name.padEnd(28)} ${it.type.padEnd(20)} added ${ts}`);
  }
  return 0;
}
