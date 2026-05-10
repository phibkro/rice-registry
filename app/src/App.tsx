import { createMemo, createResource, createSignal, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { Mode, RegistryIndex, RegistryItem } from "@rice-registry/shared";
import { isInstallable } from "@rice-registry/shared";
import { FakeDesktop } from "@rice-registry/shared/components/FakeDesktop";
import { FilterBar } from "@rice-registry/shared/components/FilterBar";
import { ItemList } from "@rice-registry/shared/components/ItemList";
import { ItemDetail } from "@rice-registry/shared/components/ItemDetail";

type CliResult = { stdout: string; stderr: string; exit_code: number | null };

async function fetchRegistry(): Promise<RegistryIndex> {
  const json = await invoke<string>("read_registry");
  return JSON.parse(json) as RegistryIndex;
}

async function fetchItem(name: string): Promise<RegistryItem> {
  const json = await invoke<string>("read_item", { name });
  return JSON.parse(json) as RegistryItem;
}

export function App() {
  const [machineTargets, setMachineTargets] = createSignal<ReadonlySet<string>>(new Set());
  const [typeFilter, setTypeFilter] = createSignal("");
  const [selectedName, setSelectedName] = createSignal<string | null>(null);
  const [activeTheme, setActiveTheme] = createSignal<RegistryItem | null>(null);
  const [mode, setMode] = createSignal<Mode>("dark");
  const [applyResult, setApplyResult] = createSignal<CliResult | null>(null);
  const [applying, setApplying] = createSignal(false);

  const [registry] = createResource(fetchRegistry);

  const [selectedItem] = createResource(selectedName, async (name) => {
    if (!name) return null;
    const item = await fetchItem(name);
    if (item.type === "registry:theme") setActiveTheme(item);
    setApplyResult(null); // clear apply output when switching items
    return item;
  });

  // Default-select the first registry:theme on load.
  createMemo(() => {
    const reg = registry();
    if (!reg || selectedName()) return;
    const firstTheme = reg.items.find((it) => it.type === "registry:theme");
    if (firstTheme) setSelectedName(firstTheme.name);
  });

  const apply = async (name: string) => {
    setApplying(true);
    setApplyResult(null);
    try {
      const result = await invoke<CliResult>("apply_item", { name });
      setApplyResult(result);
    } catch (e) {
      setApplyResult({ stdout: "", stderr: String(e), exit_code: null });
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <header class="page-header">
        <div class="brand">
          <strong>rice-registry</strong>
        </div>
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
      </header>

      <main class="page-main">
        <section class="preview-pane">
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
          <Show when={!registry.error} fallback={<div class="error">{String(registry.error)}</div>}>
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
            action={(item) => {
              const installable = isInstallable(item.targets, machineTargets());
              return (
                <div class="apply-section">
                  <button
                    class="apply-button"
                    disabled={!installable || applying()}
                    onClick={() => apply(item.name)}
                  >
                    {applying()
                      ? "running…"
                      : installable
                        ? "Apply (stub)"
                        : "Not installable on this machine"}
                  </button>
                  <Show when={applyResult()}>
                    {(result) => (
                      <pre class="apply-output">
                        {`[exit ${result().exit_code ?? "?"}]\n${result().stdout}${
                          result().stderr ? `\n--- stderr ---\n${result().stderr}` : ""
                        }`}
                      </pre>
                    )}
                  </Show>
                </div>
              );
            }}
          />
        </aside>
      </main>
    </>
  );
}
