// Mocked Hyprland session in a <div>. Re-skins itself when a theme item's
// cssVars are injected onto its root element. Slot-aware: when an item
// `provides` a known slot, surface a badge on the affected region.

export type Mode = "light" | "dark";

export type CssVars = {
  theme?: Record<string, string>;
  light?: Record<string, string>;
  dark?: Record<string, string>;
};

export function renderFakeDesktop(root: HTMLElement, mode: Mode): void {
  root.innerHTML = `
    <div class="fd-bar" data-slot="bar">
      <div class="fd-workspaces">
        <span class="fd-ws has-windows">1</span>
        <span class="fd-ws active has-windows">2</span>
        <span class="fd-ws">3</span>
        <span class="fd-ws">4</span>
        <span class="fd-ws">5</span>
      </div>
      <div class="fd-clock">${currentClock()}</div>
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
            <span class="dot r"></span>
            <span class="dot y"></span>
            <span class="dot g"></span>
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
              <p style="margin: 8px 0 0; opacity: 0.85;">
                cool, minimal hyprland rice. drop in and go.
              </p>
            </div>
            <div class="fd-card">
              <div class="fd-card-title">mountain-mist</div>
              <p style="margin: 4px 0 0; opacity: 0.85;">
                cool blue-grey palette derived from a foggy alpine wallpaper.
              </p>
            </div>
          </div>
        </div>
        <div class="fd-win">
          <div class="fd-win-titlebar">
            <span class="dot r"></span>
            <span class="dot y"></span>
            <span class="dot g"></span>
            <span class="title">terminal</span>
          </div>
          <div class="fd-win-body">
            <div><span class="fd-prompt">$</span> nix-rice query --target hyprland</div>
            <div style="opacity: 0.7;">3/4 item(s) match</div>
            <div style="opacity: 0.7;">  minimal-bar      registry:component</div>
            <div style="opacity: 0.7;">  mountain-default registry:base</div>
            <div style="opacity: 0.7;">  mountain-mist    registry:theme</div>
            <div><span class="fd-prompt">$</span> <span class="fd-blink">█</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="fd-slot-badge" id="fd-slot-badge"></div>
  `;
  setMode(root, mode);
}

export function setMode(root: HTMLElement, mode: Mode): void {
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("light", mode === "light");
}

/** Apply an item's cssVars to the fake-desktop. Theme items override; non-theme
 * items inherit whatever's currently applied. */
export function applyCssVars(
  root: HTMLElement,
  cssVars: CssVars | undefined,
  mode: Mode
): void {
  if (!cssVars) return;

  // Clear previously-applied inline vars so re-application is idempotent.
  for (const prop of Array.from(root.style)) {
    if (prop.startsWith("--")) root.style.removeProperty(prop);
  }

  const theme = cssVars.theme ?? {};
  const modeVars = (mode === "dark" ? cssVars.dark : cssVars.light) ?? {};

  for (const [k, v] of Object.entries(theme)) {
    root.style.setProperty(`--${k}`, v);
  }
  for (const [k, v] of Object.entries(modeVars)) {
    root.style.setProperty(`--${k}`, v);
  }
}

/** Surface which slot the selected item would replace. Pass an empty string
 * to hide. */
export function highlightSlot(root: HTMLElement, slot: string): void {
  const badge = root.querySelector<HTMLElement>("#fd-slot-badge");
  if (!badge) return;
  if (!slot) {
    badge.classList.remove("show");
    return;
  }
  badge.textContent = `replaces: ${slot}`;
  badge.classList.add("show");
}

function currentClock(): string {
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${days[now.getDay()]} ${hh}:${mm}`;
}
