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
    <div class="px-4 pb-4 pt-2">
      <Show when={props.registry}>
        <div class="text-xs text-page-faint pb-2 border-b border-page-muted/60 mb-2">
          {matchedCount()}/{filtered().length} installable{" "}
          {props.machineTargets.size > 0
            ? `[${[...props.machineTargets].join(", ")}]`
            : "(no machine filter)"}
        </div>
      </Show>

      <For each={filtered()}>
        {(it) => {
          const installable = createMemo(() => isInstallable(it.targets, props.machineTargets));
          const selected = () => props.selectedName === it.name;
          return (
            <button
              type="button"
              class="w-full text-left p-3 rounded-md cursor-pointer border mb-1 transition-colors"
              classList={{
                "opacity-45": !installable(),
                "bg-page-muted border-page-primary": selected(),
                "border-transparent hover:bg-page-muted": !selected(),
              }}
              onClick={() => props.onSelect(it.name)}
            >
              <div class="flex justify-between gap-2 items-baseline">
                <strong class="text-sm">{it.name}</strong>
                <span class="text-xs text-page-faint font-mono">{it.type}</span>
              </div>
              <Show when={it.title}>
                <div class="font-medium mt-1 text-sm">{it.title}</div>
              </Show>
              <Show when={it.description}>
                <div class="text-xs text-page-fg/70 mt-1 line-clamp-2">{it.description}</div>
              </Show>
              <div class="text-xs text-page-faint font-mono mt-2">
                {(it.targets ?? ["any"]).join(" · ")}
              </div>
            </button>
          );
        }}
      </For>
    </div>
  );
}
