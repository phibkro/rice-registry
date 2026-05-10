import { For, Show, createMemo, type JSX } from "solid-js";
import type { RegistryItem } from "../types.ts";
import { isInstallable } from "../filter.ts";

type Props = {
  item: RegistryItem | null;
  machineTargets: ReadonlySet<string>;
  /** Action area — caller decides what to render (Apply button, install
   * command, deep link, etc). */
  action?: (item: RegistryItem) => JSX.Element;
};

export function ItemDetail(props: Props) {
  return (
    <Show when={props.item} fallback={<p class="italic text-page-faint">select an item</p>}>
      {(item) => {
        const installable = createMemo(() => isInstallable(item().targets, props.machineTargets));

        return (
          <div class="flex flex-col gap-3">
            <div>
              <h2 class="text-lg font-semibold m-0">{item().title ?? item().name}</h2>
              <div class="flex gap-3 text-page-faint text-sm mt-1">
                <span class="font-mono">{item().type}</span>
                <Show when={item().author}>
                  <span>by {item().author}</span>
                </Show>
              </div>
            </div>

            <Show when={item().description}>
              <p class="text-page-fg/80 m-0">{item().description}</p>
            </Show>

            <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt class="text-page-faint">name</dt>
              <dd class="m-0">
                <code class="font-mono bg-page-muted px-1 rounded">{item().name}</code>
              </dd>

              <dt class="text-page-faint">targets</dt>
              <dd class="m-0">
                {(item().targets ?? ["any"]).join(", ")}{" "}
                <Show
                  when={installable()}
                  fallback={
                    <span class="text-page-danger">(not installable on current filter)</span>
                  }
                >
                  <span class="text-page-faint">(installable)</span>
                </Show>
              </dd>

              <Show when={item().registryDependencies?.length}>
                <dt class="text-page-faint">registryDependencies</dt>
                <dd class="m-0">
                  <For each={item().registryDependencies}>
                    {(d, i) => (
                      <>
                        <code class="font-mono bg-page-muted px-1 rounded">{d}</code>
                        <Show when={i() < (item().registryDependencies?.length ?? 0) - 1}>, </Show>
                      </>
                    )}
                  </For>
                </dd>
              </Show>

              <Show when={item().nixpkgsDependencies?.length}>
                <dt class="text-page-faint">nixpkgsDependencies</dt>
                <dd class="m-0">
                  <For each={item().nixpkgsDependencies}>
                    {(d, i) => (
                      <>
                        <code class="font-mono bg-page-muted px-1 rounded">{d}</code>
                        <Show when={i() < (item().nixpkgsDependencies?.length ?? 0) - 1}>, </Show>
                      </>
                    )}
                  </For>
                </dd>
              </Show>

              <Show when={item().slots?.provides?.length}>
                <dt class="text-page-faint">provides</dt>
                <dd class="m-0">{item().slots?.provides?.join(", ")}</dd>
              </Show>

              <Show when={item().slots?.consumes?.length}>
                <dt class="text-page-faint">consumes</dt>
                <dd class="m-0">{item().slots?.consumes?.join(", ")}</dd>
              </Show>

              <Show when={item().slots?.conflicts?.length}>
                <dt class="text-page-faint">conflicts</dt>
                <dd class="m-0">{item().slots?.conflicts?.join(", ")}</dd>
              </Show>

              <Show when={item().files?.length}>
                <dt class="text-page-faint">files</dt>
                <dd class="m-0">{item().files?.length} file(s)</dd>
              </Show>

              <Show when={item().compatibility}>
                <dt class="text-page-faint">compatibility</dt>
                <dd class="m-0 flex flex-wrap gap-2">
                  <For each={Object.entries(item().compatibility ?? {})}>
                    {([k, v]) => (
                      <code class="font-mono bg-page-muted px-1 rounded">
                        {k} {v}
                      </code>
                    )}
                  </For>
                </dd>
              </Show>
            </dl>

            <Show when={item().cssVars}>
              <details class="border border-page-border rounded p-2">
                <summary class="cursor-pointer font-medium">cssVars</summary>
                <pre class="bg-page-muted p-2 rounded text-xs mt-2 overflow-x-auto">
                  {JSON.stringify(item().cssVars, null, 2)}
                </pre>
              </details>
            </Show>

            <Show when={props.action}>{props.action!(item())}</Show>
          </div>
        );
      }}
    </Show>
  );
}
