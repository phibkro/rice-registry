import { createMemo, createResource, createSignal, Show } from "solid-js";
import type {
  Mode,
  RegistryIndex,
  RegistryItem,
} from "@rice-registry/shared";
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

  const [selectedItem] = createResource(selectedName, async (name) => {
    if (!name) return null;
    const item = await fetchItem(name);
    if (item.type === "registry:theme") setActiveTheme(item);
    return item;
  });

  // On first load, default-select the first registry:theme so the preview
  // pane lands on something intentional rather than the CSS fallback.
  createMemo(() => {
    const reg = registry();
    if (!reg || selectedName()) return;
    const firstTheme = reg.items.find((it) => it.type === "registry:theme");
    if (firstTheme) setSelectedName(firstTheme.name);
  });

  const installCmd = (item: RegistryItem) => {
    const itemUrl =
      location.protocol === "file:"
        ? `r/${item.name}.json`
        : new URL(`./r/${item.name}.json`, location.href).href;
    return `nix-rice add ${itemUrl}`;
  };

  return (
    <>
      <header class="page-header">
        <div class="brand">
          <strong>rice-registry</strong>
          <span class="tagline">declarative ricing, MySpace-feel</span>
        </div>
        <a class="repo" href="https://github.com/phibkro/rice-registry" target="_blank" rel="noreferrer">
          github
        </a>
      </header>

      <main class="page-main">
        <section class="preview-pane">
          <div class="preview-toolbar">
            <span class="preview-label">live preview</span>
            <div class="mode-toggle">
              <button
                class="mode-button"
                classList={{ active: mode() === "light" }}
                onClick={() => setMode("light")}
              >
                light
              </button>
              <button
                class="mode-button"
                classList={{ active: mode() === "dark" }}
                onClick={() => setMode("dark")}
              >
                dark
              </button>
            </div>
            <span class="preview-hint">click an item below to apply</span>
          </div>
          <FakeDesktop
            activeTheme={activeTheme()}
            selected={selectedItem() ?? null}
            mode={mode()}
          />
        </section>

        <section class="catalog">
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
          <Show
            when={!registry.error}
            fallback={<div class="error">{String(registry.error)}</div>}
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

        <aside class="detail">
          <ItemDetail
            item={selectedItem() ?? null}
            machineTargets={machineTargets()}
            action={(item) => (
              <div class="install-section">
                <p class="install-label">install via the local app:</p>
                <div class="install-cmd">{installCmd(item)}</div>
              </div>
            )}
          />
        </aside>
      </main>
    </>
  );
}
