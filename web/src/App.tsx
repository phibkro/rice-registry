import { createEffect, createResource, createSignal, Show } from "solid-js";
import type { Mode, RegistryIndex, RegistryItem } from "@rice-registry/shared";
import { FakeDesktop } from "@rice-registry/shared/components/FakeDesktop";
import { FilterBar } from "@rice-registry/shared/components/FilterBar";
import { ItemList } from "@rice-registry/shared/components/ItemList";
import { ItemDetail } from "@rice-registry/shared/components/ItemDetail";

async function fetchRegistry(): Promise<RegistryIndex> {
  const res = await fetch("./registry.json");
  if (!res.ok) throw new Error(`registry.json: HTTP ${res.status}`);
  return (await res.json()) as RegistryIndex;
}

async function fetchItem(name: string): Promise<RegistryItem> {
  const res = await fetch(`./r/${name}.json`);
  if (!res.ok) throw new Error(`r/${name}.json: HTTP ${res.status}`);
  return (await res.json()) as RegistryItem;
}

export function App() {
  const [machineTargets, setMachineTargets] = createSignal<ReadonlySet<string>>(new Set());
  const [typeFilter, setTypeFilter] = createSignal("");
  const [selectedName, setSelectedName] = createSignal<string | null>(null);
  const [activeTheme, setActiveTheme] = createSignal<RegistryItem | null>(null);
  const [mode, setMode] = createSignal<Mode>("dark");

  const [registry] = createResource(fetchRegistry);
  const [selectedItem] = createResource(selectedName, fetchItem);

  createEffect(() => {
    const reg = registry();
    if (!reg || selectedName()) return;
    const firstTheme = reg.items.find((it) => it.type === "registry:theme");
    if (firstTheme) setSelectedName(firstTheme.name);
  });

  createEffect(() => {
    const item = selectedItem();
    if (item && item.type === "registry:theme") {
      setActiveTheme(item);
    }
  });

  const installCmd = (item: RegistryItem) => {
    const itemUrl =
      location.protocol === "file:"
        ? `r/${item.name}.json`
        : new URL(`./r/${item.name}.json`, location.href).href;
    return `nix-rice add ${itemUrl}`;
  };

  return (
    <div class="grid grid-rows-[auto_1fr] h-screen text-page-fg bg-page-bg">
      <header class="flex items-center gap-4 px-5 py-3 border-b border-page-border bg-page-bg/60">
        <div class="flex gap-2 items-baseline flex-1">
          <strong class="font-semibold tracking-tight">rice-registry</strong>
          <span class="text-page-faint text-sm">declarative ricing, MySpace-feel</span>
        </div>
        <a
          class="text-page-faint text-sm no-underline hover:text-page-primary"
          href="https://github.com/phibkro/rice-registry"
          target="_blank"
          rel="noreferrer"
        >
          github
        </a>
      </header>

      <main class="grid grid-cols-[1fr_minmax(280px,1fr)_minmax(280px,1fr)] overflow-hidden min-h-0 max-[1100px]:grid-cols-[1fr_1fr] max-[1100px]:grid-rows-[50%_50%] max-[700px]:grid-cols-[1fr] max-[700px]:grid-rows-[auto_auto_auto]">
        <section class="flex flex-col bg-[#2a2f33] overflow-hidden min-h-0 max-[1100px]:col-span-full max-[700px]:aspect-[16/10]">
          <div class="flex items-center gap-3 px-3 py-2 bg-[#1f2429] text-[#c4ccd2] text-sm border-b border-[#0c1014]">
            <span class="font-medium">live preview</span>
            <div class="flex gap-0.5 bg-[#0c1014] rounded p-0.5">
              <button
                type="button"
                class="px-2 py-0.5 text-xs rounded cursor-pointer transition-colors"
                classList={{
                  "bg-page-primary text-white": mode() === "light",
                  "bg-transparent text-[#c4ccd2]": mode() !== "light",
                }}
                onClick={() => setMode("light")}
              >
                light
              </button>
              <button
                type="button"
                class="px-2 py-0.5 text-xs rounded cursor-pointer transition-colors"
                classList={{
                  "bg-page-primary text-white": mode() === "dark",
                  "bg-transparent text-[#c4ccd2]": mode() !== "dark",
                }}
                onClick={() => setMode("dark")}
              >
                dark
              </button>
            </div>
            <span class="ml-auto text-page-faint">click an item to apply</span>
          </div>
          <FakeDesktop
            activeTheme={activeTheme()}
            selected={selectedItem() ?? null}
            mode={mode()}
          />
        </section>

        <section class="flex flex-col overflow-y-auto bg-page-bg/30 border-l border-page-border max-[700px]:border-l-0 max-[700px]:border-t">
          <div class="sticky top-0 z-10">
            <FilterBar
              targets={machineTargets()}
              type={typeFilter()}
              onAddTarget={(t) => setMachineTargets(new Set([...machineTargets(), t]))}
              onRemoveTarget={(t) => {
                const next = new Set(machineTargets());
                next.delete(t);
                setMachineTargets(next);
              }}
              onTypeChange={setTypeFilter}
            />
          </div>
          <Show
            when={!registry.error}
            fallback={<div class="p-4 text-page-danger italic">{String(registry.error)}</div>}
          >
            <ItemList
              registry={registry() ?? null}
              selectedName={selectedName()}
              machineTargets={machineTargets()}
              typeFilter={typeFilter()}
              onSelect={setSelectedName}
            />
          </Show>
        </section>

        <aside class="overflow-y-auto bg-page-bg/30 border-l border-page-border p-4 max-[700px]:border-l-0 max-[700px]:border-t">
          <ItemDetail
            item={selectedItem() ?? null}
            machineTargets={machineTargets()}
            action={(item) => (
              <div class="mt-4">
                <p class="mb-2 text-xs text-page-faint">install via the local app:</p>
                <div class="bg-[#0c1014] text-[#dde4ea] px-3 py-2.5 rounded-md font-mono text-sm overflow-x-auto select-all before:content-['$_'] before:text-page-faint">
                  {installCmd(item)}
                </div>
              </div>
            )}
          />
        </aside>
      </main>
    </div>
  );
}
