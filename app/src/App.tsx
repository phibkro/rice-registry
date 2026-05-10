import { createEffect, createResource, createSignal, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { Mode, RegistryIndex, RegistryItem } from "@rice-registry/shared";
import { isInstallable } from "@rice-registry/shared";
import { FakeDesktop } from "@rice-registry/shared/components/FakeDesktop";
import { FilterBar } from "@rice-registry/shared/components/FilterBar";
import { ItemList } from "@rice-registry/shared/components/ItemList";

type CliResult = { stdout: string; stderr: string; exit_code: number | null };
type CliKind = "apply" | "explain";

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
  const [cliResult, setCliResult] = createSignal<{ kind: CliKind; result: CliResult } | null>(null);
  const [running, setRunning] = createSignal<CliKind | null>(null);

  const [registry] = createResource(fetchRegistry);
  const [selectedItem] = createResource(selectedName, fetchItem);

  // Default-select the first registry:theme on load.
  createEffect(() => {
    const reg = registry();
    if (!reg || selectedName()) return;
    const firstTheme = reg.items.find((it) => it.type === "registry:theme");
    if (firstTheme) setSelectedName(firstTheme.name);
  });

  // Keep activeTheme in sync — whenever the selected item resolves and is a
  // theme, swap the preview palette.
  createEffect(() => {
    const item = selectedItem();
    if (item && item.type === "registry:theme") {
      setActiveTheme(item);
    }
  });

  // Clear last CLI output when the selection changes.
  createEffect(() => {
    selectedName();
    setCliResult(null);
  });

  const runCli = async (kind: CliKind, name: string) => {
    setRunning(kind);
    setCliResult(null);
    try {
      const command = kind === "apply" ? "apply_item" : "explain_item";
      const result = await invoke<CliResult>(command, { name });
      setCliResult({ kind, result });
    } catch (e) {
      setCliResult({ kind, result: { stdout: "", stderr: String(e), exit_code: null } });
    } finally {
      setRunning(null);
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
        <aside class="sidebar">
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
        </aside>

        <section class="preview-pane">
          <FakeDesktop
            activeTheme={activeTheme()}
            selected={selectedItem() ?? null}
            mode={mode()}
          />
        </section>
      </main>

      <footer class="page-footer">
        <Show when={selectedItem()} fallback={<p class="hint">select an item from the catalog</p>}>
          {(item) => {
            const installable = () => isInstallable(item().targets, machineTargets());
            return (
              <>
                <div class="footer-info">
                  <div class="footer-title">
                    <strong>{item().title ?? item().name}</strong>
                    <span class="type">{item().type}</span>
                    <Show when={item().author}>
                      <span class="muted">by {item().author}</span>
                    </Show>
                  </div>
                  <Show when={item().description}>
                    <p class="footer-desc">{item().description}</p>
                  </Show>
                  <div class="footer-meta">
                    <span>
                      <span class="muted">targets:</span> {(item().targets ?? ["any"]).join(", ")}
                    </span>
                    <Show when={item().slots?.provides?.length}>
                      <span>
                        <span class="muted">provides:</span> {item().slots?.provides?.join(", ")}
                      </span>
                    </Show>
                    <Show when={item().slots?.consumes?.length}>
                      <span>
                        <span class="muted">consumes:</span> {item().slots?.consumes?.join(", ")}
                      </span>
                    </Show>
                    <Show when={item().registryDependencies?.length}>
                      <span>
                        <span class="muted">deps:</span> {item().registryDependencies?.join(", ")}
                      </span>
                    </Show>
                  </div>
                </div>

                <div class="footer-actions">
                  <button
                    class="btn-secondary"
                    disabled={running() !== null}
                    onClick={() => runCli("explain", item().name)}
                  >
                    {running() === "explain" ? "running…" : "Preview plan"}
                  </button>
                  <button
                    class="btn-primary"
                    disabled={!installable() || running() !== null}
                    onClick={() => runCli("apply", item().name)}
                    title={!installable() ? "Add machine targets to enable apply" : undefined}
                  >
                    {running() === "apply"
                      ? "running…"
                      : installable()
                        ? "Apply"
                        : "Not installable"}
                  </button>
                </div>

                <Show when={cliResult()}>
                  {(out) => {
                    const success = out().result.exit_code === 0;
                    return (
                      <div class="cli-output" classList={{ success, failure: !success }}>
                        <div class="cli-header">
                          <span class="cli-badge">
                            {success ? "✓" : "✗"} {out().kind} {success ? "ok" : "failed"}
                          </span>
                          <span class="cli-exit">exit {out().result.exit_code ?? "?"}</span>
                        </div>
                        <Show when={out().result.stdout}>
                          <pre class="cli-stdout">{out().result.stdout}</pre>
                        </Show>
                        <Show when={out().result.stderr}>
                          <div class="cli-stderr-label">stderr</div>
                          <pre class="cli-stderr">{out().result.stderr}</pre>
                        </Show>
                      </div>
                    );
                  }}
                </Show>
              </>
            );
          }}
        </Show>
      </footer>
    </>
  );
}
