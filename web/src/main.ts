import {
  renderFakeDesktop,
  setMode,
  applyCssVars,
  highlightSlot,
  type Mode,
  type CssVars,
} from "./fake-desktop.ts";

type IndexItem = {
  name: string;
  type: string;
  title?: string;
  description?: string;
  author?: string;
  categories?: string[];
  targets?: string[];
  slots?: { provides?: string[]; consumes?: string[]; conflicts?: string[] };
  url?: string;
};

type RegistryIndex = {
  name: string;
  homepage?: string;
  description?: string;
  items: IndexItem[];
};

type RegistryItem = IndexItem & {
  registryDependencies?: string[];
  nixpkgsDependencies?: string[];
  cssVars?: CssVars;
  files?: Array<{ path: string; type: string; target?: string; content?: string }>;
  compatibility?: Record<string, string>;
};

const $ = <T extends Element = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;

const machineTargets = new Set<string>();
let typeFilter = "";
let registry: RegistryIndex | null = null;
let activeTheme: RegistryItem | null = null;
let selected: string | null = null;
let mode: Mode = "dark";

function isInstallable(targets: string[] | undefined): boolean {
  if (!targets || targets.length === 0) return true;
  if (targets.includes("any")) return true;
  return targets.every((t) => machineTargets.has(t));
}

async function loadRegistry(): Promise<void> {
  try {
    const res = await fetch("./registry.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    registry = (await res.json()) as RegistryIndex;
  } catch (e) {
    $("#items").innerHTML = `<div class="error">${String(e)}</div>`;
    return;
  }
  renderItems();

  // Apply the first theme item by default so the preview lands on something
  // intentional rather than the CSS fallback palette.
  const firstTheme = registry.items.find((it) => it.type === "registry:theme");
  if (firstTheme) await selectItem(firstTheme.name, /*silent=*/ true);
}

function renderItems(): void {
  if (!registry) return;
  const list = $("#items");
  list.innerHTML = "";

  const items = registry.items.filter((it) => {
    if (typeFilter && it.type !== typeFilter) return false;
    return true;
  });

  let matched = 0;
  for (const it of items) {
    const installable = isInstallable(it.targets);
    if (installable) matched++;

    const div = document.createElement("div");
    div.className =
      "item " +
      (installable ? "match" : "no-match") +
      (selected === it.name ? " selected" : "");
    div.innerHTML = `
      <div class="row">
        <strong>${it.name}</strong>
        <span class="type">${it.type}</span>
      </div>
      ${it.title ? `<div class="title">${escapeHtml(it.title)}</div>` : ""}
      ${it.description ? `<div class="desc">${escapeHtml(it.description)}</div>` : ""}
      <div class="targets">${(it.targets ?? ["any"]).join(" · ")}</div>
    `;
    div.addEventListener("click", () => selectItem(it.name));
    list.appendChild(div);
  }

  const summary = document.createElement("div");
  summary.className = "summary";
  const machineDesc = machineTargets.size
    ? `[${[...machineTargets].join(", ")}]`
    : "(no machine filter)";
  summary.textContent = `${matched}/${items.length} installable ${machineDesc}`;
  list.prepend(summary);
}

async function selectItem(name: string, silent = false): Promise<void> {
  selected = name;
  let item: RegistryItem;
  try {
    const res = await fetch(`./r/${name}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    item = (await res.json()) as RegistryItem;
  } catch (e) {
    $("#detail").innerHTML = `<div class="error">${String(e)}</div>`;
    return;
  }

  // Theme items become the active palette. Other items inherit whatever
  // the active theme is and only the slot-highlight changes.
  if (item.type === "registry:theme") {
    activeTheme = item;
  }

  applyTheme();
  highlightSelectedSlot(item);
  renderDetail(item);
  if (!silent) renderItems(); // refresh selected highlight
}

function applyTheme(): void {
  const root = $("#fake-desktop");
  applyCssVars(root, activeTheme?.cssVars, mode);
}

function highlightSelectedSlot(item: RegistryItem): void {
  const root = $("#fake-desktop");
  const provides = item.slots?.provides ?? [];
  // Pick the first known slot we can visualize. Today only "bar" is mocked
  // explicitly in the fake-desktop; theme.palette is implicit (whole pane).
  if (provides.includes("bar")) {
    highlightSlot(root, "bar");
  } else if (provides.includes("theme.palette") || item.type === "registry:theme") {
    highlightSlot(root, "theme.palette");
  } else if (provides.length > 0) {
    highlightSlot(root, provides[0]!);
  } else {
    highlightSlot(root, "");
  }
}

function renderDetail(item: RegistryItem): void {
  const detail = $("#detail");
  const installable = isInstallable(item.targets);

  // Install command uses an absolute URL so it works when copy-pasted to
  // a shell. Fall back to a relative path for local file:// previews.
  const itemUrl =
    location.protocol === "file:"
      ? `r/${item.name}.json`
      : new URL(`./r/${item.name}.json`, location.href).href;
  const installCmd = `nix-rice add ${itemUrl}`;

  detail.innerHTML = `
    <h2>${escapeHtml(item.title ?? item.name)}</h2>
    <div class="meta">
      <span class="type">${item.type}</span>
      ${item.author ? `<span class="author">by ${escapeHtml(item.author)}</span>` : ""}
    </div>
    ${item.description ? `<p class="desc">${escapeHtml(item.description)}</p>` : ""}

    <dl class="kv">
      <dt>name</dt><dd><code>${item.name}</code></dd>
      <dt>targets</dt><dd>${(item.targets ?? ["any"]).join(", ")} ${
        installable
          ? `<span style="color: var(--page-faint);">(installable)</span>`
          : `<span style="color: var(--page-danger);">(not installable on current filter)</span>`
      }</dd>
      ${item.registryDependencies?.length ? `<dt>registryDependencies</dt><dd>${item.registryDependencies.map((d) => `<code>${d}</code>`).join(", ")}</dd>` : ""}
      ${item.nixpkgsDependencies?.length ? `<dt>nixpkgsDependencies</dt><dd>${item.nixpkgsDependencies.map((d) => `<code>${d}</code>`).join(", ")}</dd>` : ""}
      ${item.slots?.provides?.length ? `<dt>provides</dt><dd>${item.slots.provides.join(", ")}</dd>` : ""}
      ${item.slots?.consumes?.length ? `<dt>consumes</dt><dd>${item.slots.consumes.join(", ")}</dd>` : ""}
      ${item.slots?.conflicts?.length ? `<dt>conflicts</dt><dd>${item.slots.conflicts.join(", ")}</dd>` : ""}
      ${item.files?.length ? `<dt>files</dt><dd>${item.files.length} file(s)</dd>` : ""}
      ${item.compatibility ? `<dt>compatibility</dt><dd>${Object.entries(item.compatibility).map(([k, v]) => `<code>${k} ${v}</code>`).join(" · ")}</dd>` : ""}
    </dl>

    ${item.cssVars ? `<details><summary>cssVars</summary><pre>${escapeHtml(JSON.stringify(item.cssVars, null, 2))}</pre></details>` : ""}

    <div class="install-section">
      <p style="margin-bottom: 0.5rem; font-size: 0.9em; color: var(--page-faint);">install via the local app:</p>
      <div class="install-cmd">${escapeHtml(installCmd)}</div>
    </div>
  `;
}

function renderTags(): void {
  const tags = $("#tags");
  tags.innerHTML = "";
  for (const t of machineTargets) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.innerHTML = `${escapeHtml(t)}<span class="x">×</span>`;
    pill.addEventListener("click", () => {
      machineTargets.delete(t);
      renderTags();
      renderItems();
    });
    tags.appendChild(pill);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

window.addEventListener("DOMContentLoaded", () => {
  const desktop = $("#fake-desktop");
  renderFakeDesktop(desktop, mode);

  $("#mode-light").addEventListener("click", () => {
    mode = "light";
    setMode(desktop, mode);
    applyTheme();
    $("#mode-light").classList.add("active");
    $("#mode-dark").classList.remove("active");
  });
  $("#mode-dark").addEventListener("click", () => {
    mode = "dark";
    setMode(desktop, mode);
    applyTheme();
    $("#mode-dark").classList.add("active");
    $("#mode-light").classList.remove("active");
  });

  const input = $<HTMLInputElement>("#target-input");
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const tag = input.value.trim().toLowerCase();
    if (!tag) return;
    machineTargets.add(tag);
    input.value = "";
    renderTags();
    renderItems();
  });

  $<HTMLSelectElement>("#type-filter").addEventListener("change", (e) => {
    typeFilter = (e.target as HTMLSelectElement).value;
    renderItems();
  });

  loadRegistry();
});
