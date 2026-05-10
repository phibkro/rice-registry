import { invoke } from "@tauri-apps/api/core";

type RegistryIndex = {
  name: string;
  homepage?: string;
  description?: string;
  items: IndexItem[];
};

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

type RegistryItem = IndexItem & {
  registryDependencies?: string[];
  nixpkgsDependencies?: string[];
  cssVars?: { theme?: Record<string, string>; light?: Record<string, string>; dark?: Record<string, string> };
  files?: Array<{ path: string; type: string; target?: string; content?: string }>;
  compatibility?: Record<string, string>;
};

type CliResult = { stdout: string; stderr: string; exit_code: number | null };

const machineTargets = new Set<string>();
let typeFilter = "";
let registry: RegistryIndex | null = null;

const $ = <T extends Element = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel)!;

function isInstallable(targets: string[] | undefined): boolean {
  if (!targets || targets.length === 0) return true;
  if (targets.includes("any")) return true;
  return targets.every((t) => machineTargets.has(t));
}

async function loadRegistry() {
  try {
    const json = await invoke<string>("read_registry");
    registry = JSON.parse(json) as RegistryIndex;
  } catch (e) {
    $("#items").innerHTML = `<div class="error">${String(e)}</div>`;
    return;
  }
  renderItems();
}

function renderItems() {
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
    div.className = "item " + (installable ? "match" : "no-match");
    div.innerHTML = `
      <div class="row">
        <strong>${it.name}</strong>
        <span class="type">${it.type}</span>
      </div>
      ${it.title ? `<div class="title">${it.title}</div>` : ""}
      ${it.description ? `<div class="desc">${it.description}</div>` : ""}
      <div class="targets">${(it.targets ?? ["any"]).join(" · ")}</div>
    `;
    div.onclick = () => loadDetail(it.name);
    list.appendChild(div);
  }

  const summary = document.createElement("div");
  summary.className = "summary";
  summary.textContent = `${matched}/${items.length} installable on this machine`;
  list.prepend(summary);
}

async function loadDetail(name: string) {
  try {
    const json = await invoke<string>("read_item", { name });
    const item = JSON.parse(json) as RegistryItem;
    renderDetail(item);
  } catch (e) {
    $("#detail").innerHTML = `<div class="error">${String(e)}</div>`;
  }
}

function renderDetail(item: RegistryItem) {
  const detail = $("#detail");
  const installable = isInstallable(item.targets);
  detail.innerHTML = `
    <h2>${item.title ?? item.name}</h2>
    <div class="meta">
      <span class="type">${item.type}</span>
      ${item.author ? `<span class="author">by ${item.author}</span>` : ""}
    </div>
    ${item.description ? `<p class="desc">${item.description}</p>` : ""}
    <dl class="kv">
      <dt>name</dt><dd><code>${item.name}</code></dd>
      <dt>targets</dt><dd>${(item.targets ?? ["any"]).join(", ")}</dd>
      ${item.registryDependencies?.length ? `<dt>registryDependencies</dt><dd>${item.registryDependencies.map((d) => `<code>${d}</code>`).join(", ")}</dd>` : ""}
      ${item.nixpkgsDependencies?.length ? `<dt>nixpkgsDependencies</dt><dd>${item.nixpkgsDependencies.map((d) => `<code>${d}</code>`).join(", ")}</dd>` : ""}
      ${item.slots?.provides?.length ? `<dt>provides</dt><dd>${item.slots.provides.join(", ")}</dd>` : ""}
      ${item.slots?.consumes?.length ? `<dt>consumes</dt><dd>${item.slots.consumes.join(", ")}</dd>` : ""}
      ${item.slots?.conflicts?.length ? `<dt>conflicts</dt><dd>${item.slots.conflicts.join(", ")}</dd>` : ""}
      ${item.files?.length ? `<dt>files</dt><dd>${item.files.length} file(s)</dd>` : ""}
    </dl>
    ${item.cssVars ? `<details><summary>cssVars</summary><pre>${JSON.stringify(item.cssVars, null, 2)}</pre></details>` : ""}
    <button id="apply" ${!installable ? "disabled" : ""}>${installable ? "Apply (stub)" : "Not installable on this machine"}</button>
    <pre id="apply-output" hidden></pre>
  `;
  if (installable) {
    $("#apply").addEventListener("click", () => apply(item.name));
  }
}

async function apply(name: string) {
  const out = $<HTMLPreElement>("#apply-output");
  const btn = $<HTMLButtonElement>("#apply");
  btn.disabled = true;
  btn.textContent = "running…";
  out.hidden = false;
  out.textContent = "";
  try {
    const result = await invoke<CliResult>("apply_item", { name });
    out.textContent =
      `[exit ${result.exit_code ?? "?"}]\n` +
      result.stdout +
      (result.stderr ? `\n--- stderr ---\n${result.stderr}` : "");
  } catch (e) {
    out.textContent = `error: ${String(e)}`;
  } finally {
    btn.textContent = "Apply (stub)";
    btn.disabled = false;
  }
}

function renderTags() {
  const tags = $("#tags");
  tags.innerHTML = "";
  for (const t of machineTargets) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.innerHTML = `${t}<span class="x">×</span>`;
    pill.addEventListener("click", () => {
      machineTargets.delete(t);
      renderTags();
      renderItems();
    });
    tags.appendChild(pill);
  }
}

window.addEventListener("DOMContentLoaded", () => {
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
