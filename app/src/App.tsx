import { createEffect, createResource, createSignal, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { Mode, RegistryIndex, RegistryItem } from "@rice-registry/shared";
import { isInstallable } from "@rice-registry/shared";
import { FakeDesktop } from "@rice-registry/shared/components/FakeDesktop";
import { FilterBar } from "@rice-registry/shared/components/FilterBar";
import { ItemList } from "@rice-registry/shared/components/ItemList";

type CliResult = { stdout: string; stderr: string; exit_code: number | null };
type CliKind = "apply" | "explain";

/** True when running inside the Tauri WebView. False when this same JS is
 * accessed via a regular browser hitting localhost:1420. */
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function fetchRegistry(): Promise<RegistryIndex> {
  if (isTauri) {
    const json = await invoke<string>("read_registry");
    return JSON.parse(json) as RegistryIndex;
  }
  const res = await fetch("/registry.json");
  if (!res.ok) throw new Error(`registry.json: HTTP ${res.status}`);
  return (await res.json()) as RegistryIndex;
}

async function fetchItem(name: string): Promise<RegistryItem> {
  if (isTauri) {
    const json = await invoke<string>("read_item", { name });
    return JSON.parse(json) as RegistryItem;
  }
  const res = await fetch(`/r/${name}.json`);
  if (!res.ok) throw new Error(`r/${name}.json: HTTP ${res.status}`);
  return (await res.json()) as RegistryItem;
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

  createEffect(() => {
    selectedName();
    setCliResult(null);
  });

  const runCli = async (kind: CliKind, name: string) => {
    if (!isTauri) {
      setCliResult({
        kind,
        result: {
          stdout: "",
          stderr:
            "Apply / Preview-plan only work inside the Tauri app — they shell out to the local CLI.",
          exit_code: null,
        },
      });
      return;
    }
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
    <div class="grid grid-rows-[auto_1fr_auto] h-screen text-page-fg bg-page-bg">
      {/* ───── Header ───── */}
      <header class="flex items-center gap-4 px-4 py-2 border-b border-page-border bg-page-surface">
        <strong class="font-semibold tracking-tight flex-1">rice-registry</strong>
        <Show when={!isTauri}>
          <span class="text-xs text-page-faint">
            (browser preview — apply/preview-plan disabled)
          </span>
        </Show>
        <div class="flex gap-0.5 bg-page-muted rounded p-0.5">
          <button
            type="button"
            class="px-2.5 py-0.5 text-xs rounded cursor-pointer transition-colors"
            classList={{
              "bg-page-primary text-page-primary-fg": mode() === "light",
              "text-page-fg hover:bg-page-surface": mode() !== "light",
            }}
            onClick={() => setMode("light")}
          >
            light
          </button>
          <button
            type="button"
            class="px-2.5 py-0.5 text-xs rounded cursor-pointer transition-colors"
            classList={{
              "bg-page-primary text-page-primary-fg": mode() === "dark",
              "text-page-fg hover:bg-page-surface": mode() !== "dark",
            }}
            onClick={() => setMode("dark")}
          >
            dark
          </button>
        </div>
      </header>

      {/* ───── Main: sidebar + preview ───── */}
      <main class="grid grid-cols-[320px_1fr] overflow-hidden min-h-0">
        <aside class="flex flex-col bg-page-surface border-r border-page-border overflow-hidden min-h-0">
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
          <div class="flex-1 overflow-y-auto min-h-0">
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
          </div>
        </aside>

        <section class="flex flex-col bg-[#2a2f33] overflow-hidden min-h-0">
          <FakeDesktop
            activeTheme={activeTheme()}
            selected={selectedItem() ?? null}
            mode={mode()}
          />
        </section>
      </main>

      {/* ───── Footer ───── */}
      <footer class="bg-page-surface border-t border-page-border px-4 py-3 max-h-[40vh] overflow-y-auto flex flex-col gap-2">
        <Show
          when={selectedItem()}
          fallback={<p class="italic text-page-faint">select an item from the catalog</p>}
        >
          {(item) => {
            const installable = () => isInstallable(item().targets, machineTargets());
            return (
              <>
                <div class="flex flex-col gap-1">
                  <div class="flex items-baseline flex-wrap gap-2">
                    <strong class="text-base">{item().title ?? item().name}</strong>
                    <span class="font-mono text-xs text-page-faint">{item().type}</span>
                    <Show when={item().author}>
                      <span class="text-xs text-page-faint">by {item().author}</span>
                    </Show>
                  </div>
                  <Show when={item().description}>
                    <p class="text-sm text-page-fg/80 m-0">{item().description}</p>
                  </Show>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
                    <span>
                      <span class="text-page-faint font-sans">targets:</span>{" "}
                      {(item().targets ?? ["any"]).join(", ")}
                    </span>
                    <Show when={item().slots?.provides?.length}>
                      <span>
                        <span class="text-page-faint font-sans">provides:</span>{" "}
                        {item().slots?.provides?.join(", ")}
                      </span>
                    </Show>
                    <Show when={item().slots?.consumes?.length}>
                      <span>
                        <span class="text-page-faint font-sans">consumes:</span>{" "}
                        {item().slots?.consumes?.join(", ")}
                      </span>
                    </Show>
                    <Show when={item().registryDependencies?.length}>
                      <span>
                        <span class="text-page-faint font-sans">deps:</span>{" "}
                        {item().registryDependencies?.join(", ")}
                      </span>
                    </Show>
                  </div>
                </div>

                <div class="flex gap-2 items-center">
                  <button
                    type="button"
                    class="bg-page-muted text-page-fg border-0 px-3.5 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-[filter] disabled:opacity-55 disabled:cursor-not-allowed hover:not-disabled:brightness-110"
                    disabled={running() !== null || !isTauri}
                    onClick={() => runCli("explain", item().name)}
                    title={!isTauri ? "Open inside the Tauri app to use" : undefined}
                  >
                    {running() === "explain" ? "running…" : "Preview plan"}
                  </button>
                  <button
                    type="button"
                    class="bg-page-primary text-page-primary-fg border-0 px-3.5 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-[filter] disabled:opacity-55 disabled:cursor-not-allowed hover:not-disabled:brightness-110"
                    disabled={!installable() || running() !== null || !isTauri}
                    onClick={() => runCli("apply", item().name)}
                    title={
                      !isTauri
                        ? "Open inside the Tauri app to use"
                        : !installable()
                          ? "Add machine targets to enable apply"
                          : undefined
                    }
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
                    const success = () => out().result.exit_code === 0;
                    return (
                      <div
                        class="rounded-md overflow-hidden border"
                        classList={{
                          "border-page-success": success(),
                          "border-page-danger": !success(),
                        }}
                      >
                        <div
                          class="flex items-center gap-2 px-3 py-1.5 text-sm"
                          classList={{
                            "bg-page-success/15 text-page-success": success(),
                            "bg-page-danger/15 text-page-danger": !success(),
                          }}
                        >
                          <span class="font-semibold">
                            {success() ? "✓" : "✗"} {out().kind} {success() ? "ok" : "failed"}
                          </span>
                          <span class="ml-auto font-mono text-xs opacity-85">
                            exit {out().result.exit_code ?? "?"}
                          </span>
                        </div>
                        <Show when={out().result.stdout}>
                          <pre class="bg-[#0c1014] text-[#dde4ea] px-3 py-2 m-0 font-mono text-xs whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                            {out().result.stdout}
                          </pre>
                        </Show>
                        <Show when={out().result.stderr}>
                          <div class="bg-[#2a2024] text-[#f4a4a0] px-3 py-1 text-[0.7rem] font-mono uppercase tracking-wider">
                            stderr
                          </div>
                          <pre class="bg-[#0c1014] text-[#dde4ea] px-3 py-2 m-0 font-mono text-xs whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                            {out().result.stderr}
                          </pre>
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
    </div>
  );
}
