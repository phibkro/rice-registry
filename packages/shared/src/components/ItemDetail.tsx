import { For, Show, createMemo, type JSX } from "solid-js";
import type { RegistryItem } from "../types.ts";
import { isInstallable } from "../filter.ts";

type Props = {
  item: RegistryItem | null;
  machineTargets: ReadonlySet<string>;
  /** Action area — caller decides what to render (Apply button, install
   * command, deep link, etc). Receives the current item so the slot can
   * react to which item is shown. */
  action?: (item: RegistryItem) => JSX.Element;
};

export function ItemDetail(props: Props) {
  return (
    <Show
      when={props.item}
      fallback={<p class="hint">select an item</p>}
    >
      {(item) => {
        const installable = createMemo(() =>
          isInstallable(item().targets, props.machineTargets)
        );

        return (
          <div class="detail-body">
            <h2>{item().title ?? item().name}</h2>
            <div class="meta">
              <span class="type">{item().type}</span>
              <Show when={item().author}>
                <span class="author">by {item().author}</span>
              </Show>
            </div>
            <Show when={item().description}>
              <p class="desc">{item().description}</p>
            </Show>

            <dl class="kv">
              <dt>name</dt>
              <dd>
                <code>{item().name}</code>
              </dd>
              <dt>targets</dt>
              <dd>
                {(item().targets ?? ["any"]).join(", ")}{" "}
                <Show
                  when={installable()}
                  fallback={
                    <span class="not-installable">
                      (not installable on current filter)
                    </span>
                  }
                >
                  <span class="muted">(installable)</span>
                </Show>
              </dd>
              <Show when={item().registryDependencies?.length}>
                <dt>registryDependencies</dt>
                <dd>
                  <For each={item().registryDependencies}>
                    {(d, i) => (
                      <>
                        <code>{d}</code>
                        <Show when={i() < (item().registryDependencies?.length ?? 0) - 1}>
                          ,{" "}
                        </Show>
                      </>
                    )}
                  </For>
                </dd>
              </Show>
              <Show when={item().nixpkgsDependencies?.length}>
                <dt>nixpkgsDependencies</dt>
                <dd>
                  <For each={item().nixpkgsDependencies}>
                    {(d, i) => (
                      <>
                        <code>{d}</code>
                        <Show when={i() < (item().nixpkgsDependencies?.length ?? 0) - 1}>
                          ,{" "}
                        </Show>
                      </>
                    )}
                  </For>
                </dd>
              </Show>
              <Show when={item().slots?.provides?.length}>
                <dt>provides</dt>
                <dd>{item().slots?.provides?.join(", ")}</dd>
              </Show>
              <Show when={item().slots?.consumes?.length}>
                <dt>consumes</dt>
                <dd>{item().slots?.consumes?.join(", ")}</dd>
              </Show>
              <Show when={item().slots?.conflicts?.length}>
                <dt>conflicts</dt>
                <dd>{item().slots?.conflicts?.join(", ")}</dd>
              </Show>
              <Show when={item().files?.length}>
                <dt>files</dt>
                <dd>{item().files?.length} file(s)</dd>
              </Show>
              <Show when={item().compatibility}>
                <dt>compatibility</dt>
                <dd>
                  <For each={Object.entries(item().compatibility ?? {})}>
                    {([k, v], i) => (
                      <>
                        <code>
                          {k} {v}
                        </code>
                        <Show when={i() < Object.keys(item().compatibility ?? {}).length - 1}>
                          {" "}· {" "}
                        </Show>
                      </>
                    )}
                  </For>
                </dd>
              </Show>
            </dl>

            <Show when={item().cssVars}>
              <details>
                <summary>cssVars</summary>
                <pre>{JSON.stringify(item().cssVars, null, 2)}</pre>
              </details>
            </Show>

            <Show when={props.action}>{props.action!(item())}</Show>
          </div>
        );
      }}
    </Show>
  );
}
