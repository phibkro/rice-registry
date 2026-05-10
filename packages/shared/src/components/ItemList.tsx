import { For, Show, createMemo } from "solid-js";
import type { IndexItem, RegistryIndex } from "../types.ts";
import { isInstallable } from "../filter.ts";

type Props = {
  registry: RegistryIndex | null;
  selectedName: string | null;
  machineTargets: ReadonlySet<string>;
  typeFilter: string;
  onSelect: (name: string) => void;
};

export function ItemList(props: Props) {
  const filtered = createMemo<IndexItem[]>(() => {
    if (!props.registry) return [];
    return props.registry.items.filter((it) =>
      props.typeFilter ? it.type === props.typeFilter : true
    );
  });

  const matchedCount = createMemo(
    () => filtered().filter((it) => isInstallable(it.targets, props.machineTargets)).length
  );

  return (
    <div class="items">
      <Show when={props.registry}>
        <div class="summary">
          {matchedCount()}/{filtered().length} installable{" "}
          {props.machineTargets.size > 0
            ? `[${[...props.machineTargets].join(", ")}]`
            : "(no machine filter)"}
        </div>
      </Show>
      <For each={filtered()}>
        {(it) => {
          const installable = createMemo(() => isInstallable(it.targets, props.machineTargets));
          return (
            <div
              class="item"
              classList={{
                "no-match": !installable(),
                selected: props.selectedName === it.name,
              }}
              onClick={() => props.onSelect(it.name)}
            >
              <div class="row">
                <strong>{it.name}</strong>
                <span class="type">{it.type}</span>
              </div>
              <Show when={it.title}>
                <div class="title">{it.title}</div>
              </Show>
              <Show when={it.description}>
                <div class="desc">{it.description}</div>
              </Show>
              <div class="targets">{(it.targets ?? ["any"]).join(" · ")}</div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
