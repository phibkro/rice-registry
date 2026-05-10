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
    <div class="filter">
      <span class="filter-label">filter by your stack</span>
      <div class="tags">
        <For each={[...props.targets]}>
          {(t) => (
            <span class="pill" onClick={() => props.onRemoveTarget(t)}>
              {t}
              <span class="x">×</span>
            </span>
          )}
        </For>
      </div>
      <input
        class="target-input"
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
        class="type-filter"
        value={props.type}
        onChange={(e) => props.onTypeChange(e.currentTarget.value)}
      >
        <option value="">all types</option>
        <For each={TYPES}>{(t) => <option value={t}>{t}</option>}</For>
      </select>
    </div>
  );
}
