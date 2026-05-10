import { Show, createMemo, createEffect, onCleanup } from "solid-js";
import { createSignal } from "solid-js";
import type { CssVars, Mode, RegistryItem } from "../types.ts";

type Props = {
  /** The item providing the active palette. Falls back to default vars. */
  activeTheme?: RegistryItem | null;
  /** The item currently in focus — used for slot highlighting. */
  selected?: RegistryItem | null;
  /** Display mode (light/dark). */
  mode: Mode;
};

export function FakeDesktop(props: Props) {
  const [now, setNow] = createSignal(currentClock());

  createEffect(() => {
    const id = setInterval(() => setNow(currentClock()), 30_000);
    onCleanup(() => clearInterval(id));
  });

  const themeStyle = createMemo(() => varsToStyle(props.activeTheme?.cssVars, props.mode));

  const slotHighlight = createMemo(() => {
    const item = props.selected;
    if (!item) return "";
    const provides = item.slots?.provides ?? [];
    if (provides.includes("bar")) return "bar";
    if (provides.includes("theme.palette") || item.type === "registry:theme") {
      return "theme.palette";
    }
    return provides[0] ?? "";
  });

  return (
    <div class="fd" classList={{ light: props.mode === "light" }} style={themeStyle()}>
      <div class="fd-bar" data-slot="bar">
        <div class="fd-workspaces">
          <span class="fd-ws has-windows">1</span>
          <span class="fd-ws active has-windows">2</span>
          <span class="fd-ws">3</span>
          <span class="fd-ws">4</span>
          <span class="fd-ws">5</span>
        </div>
        <div class="fd-clock">{now()}</div>
        <div class="fd-tray">
          <span title="volume">󰕾</span>
          <span title="battery">󰂄</span>
          <span title="network">󰖪</span>
        </div>
      </div>
      <div class="fd-wallpaper">
        <div class="fd-windows">
          <div class="fd-win browser focused">
            <div class="fd-win-titlebar">
              <span class="dot r" />
              <span class="dot y" />
              <span class="dot g" />
              <span class="title">browser — rice-registry.dev</span>
            </div>
            <div class="fd-win-body">
              <div class="fd-browser-bar">
                <div class="fd-url">rice-registry.dev/r/mountain-default</div>
              </div>
              <div class="fd-card">
                <div class="fd-card-title">mountain-default</div>
                <div>
                  <span class="fd-pill">registry:base</span>
                  <span class="fd-pill">hyprland</span>
                </div>
                <p class="fd-card-desc">cool, minimal hyprland rice. drop in and go.</p>
              </div>
              <div class="fd-card">
                <div class="fd-card-title">mountain-mist</div>
                <p class="fd-card-desc">
                  cool blue-grey palette derived from a foggy alpine wallpaper.
                </p>
              </div>
            </div>
          </div>
          <div class="fd-win">
            <div class="fd-win-titlebar">
              <span class="dot r" />
              <span class="dot y" />
              <span class="dot g" />
              <span class="title">terminal</span>
            </div>
            <div class="fd-win-body">
              <div>
                <span class="fd-prompt">$</span> nix-rice query --target hyprland
              </div>
              <div class="fd-dim">3/4 item(s) match</div>
              <div class="fd-dim"> minimal-bar registry:component</div>
              <div class="fd-dim"> mountain-default registry:base</div>
              <div class="fd-dim"> mountain-mist registry:theme</div>
              <div>
                <span class="fd-prompt">$</span> <span class="fd-blink">█</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Show when={slotHighlight()}>
        {(slot) => <div class="fd-slot-badge show">replaces: {slot()}</div>}
      </Show>
    </div>
  );
}

function varsToStyle(cssVars: CssVars | undefined, mode: Mode): Record<string, string> {
  if (!cssVars) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cssVars.theme ?? {})) {
    out[`--${k}`] = v;
  }
  const modeVars = (mode === "dark" ? cssVars.dark : cssVars.light) ?? {};
  for (const [k, v] of Object.entries(modeVars)) {
    out[`--${k}`] = v;
  }
  return out;
}

function currentClock(): string {
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${days[now.getDay()]} ${hh}:${mm}`;
}
