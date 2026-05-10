import { For, createSignal } from "solid-js";

type Props = {
  targets: ReadonlySet<string>;
  type: string;
  onAddTarget: (tag: string) => void;
  onRemoveTarget: (tag: string) => void;
  onTypeChange: (type: string) => void;
};

const TYPES = [
  "registry:base",
  "registry:component",
  "registry:theme",
  "registry:font",
  "registry:layout",
  "registry:style",
];

export function FilterBar(props: Props) {
  const [inputValue, setInputValue] = createSignal("");

  const addTag = () => {
    const tag = inputValue().trim().toLowerCase();
    if (!tag) return;
    props.onAddTarget(tag);
    setInputValue("");
  };

  return (
    <div class="flex flex-col gap-2 px-4 py-3 border-b border-page-border bg-page-bg/60">
      <span class="text-xs text-page-faint">filter by your stack</span>

      <div class="flex flex-wrap gap-1">
        <For each={[...props.targets]}>
          {(t) => (
            <button
              type="button"
              class="bg-page-primary text-page-primary-fg rounded-full px-2 py-0.5 text-xs cursor-pointer select-none flex items-center gap-1 hover:brightness-105"
              onClick={() => props.onRemoveTarget(t)}
            >
              {t}
              <span class="opacity-70">×</span>
            </button>
          )}
        </For>
      </div>

      <input
        class="border border-page-border rounded-md px-2 py-1 bg-page-bg/40 text-page-fg text-sm placeholder:text-page-faint/70 focus:outline-none focus:border-page-primary"
        placeholder="add tag (e.g. hyprland) ↵"
        autocomplete="off"
        spellcheck={false}
        value={inputValue()}
        onInput={(e) => setInputValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        }}
      />

      <select
        class="border border-page-border rounded-md px-2 py-1 bg-page-bg/40 text-page-fg text-sm focus:outline-none focus:border-page-primary"
        value={props.type}
        onChange={(e) => props.onTypeChange(e.currentTarget.value)}
      >
        <option value="">all types</option>
        <For each={TYPES}>{(t) => <option value={t}>{t}</option>}</For>
      </select>
    </div>
  );
}
