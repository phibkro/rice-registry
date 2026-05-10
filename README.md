# rice-registry

A Nix-native registry for ricing components — bars, palettes, fonts, layouts,
and complete rices — modelled after [shadcn/ui's registry][shadcn] but for
Hyprland + Quickshell + Stylix on NixOS.

This is a **prototype**. The schema and `build` / `validate` paths are real
and verified end-to-end; `add` is a stub that resolves and prints a dependency
graph but doesn't apply.

[shadcn]: https://ui.shadcn.com/docs/registry

## What's here

```
schemas/                     JSON Schemas — the contract
  registry-item.schema.json    one item: theme, component, base, font, ...
  registry.schema.json         the index that lists items

examples/                    source items
  themes/mountain-mist/        registry:theme — palette only (targets: any)
  components/minimal-bar/      registry:component — Quickshell bar (targets: hyprland)
  components/niri-default-bar/ registry:component — Waybar (targets: niri)
  bases/mountain-default/      registry:base — composes the Hyprland set

cli/                         nix-rice CLI (TypeScript + Bun)
  src/build.ts                 examples/** → registry.json + r/*.json
  src/validate.ts              schema-check a single rice.json
  src/query.ts                 filter index by machine targets / type
  src/add.ts                   [stub] resolve + print dep graph

app/                         Tauri 2 desktop app (vanilla TS + Vite)
  src/                         frontend (HTML + TS + CSS)
  src-tauri/                   Rust backend
    src/lib.rs                   read_registry / read_item / apply_item

web/                         Static showcase (vanilla TS + Vite)
  src/main.ts                  filter + selection logic (mirrors app/)
  src/fake-desktop.ts          mocked Hyprland session that re-skins via cssVars
  scripts/copy-registry.ts     pre-build: copies registry.json + r/ to public/

docs/
  DESIGN.md                    pinned decisions: shape, slot semantics, apply path
  OUTSTANDING.md               punch list of what's deferred
  RICE_COOKER_COMPARISON.md    notes on amarsbar/rice-cooker manifest shape

registry.json                generated index (committed for static hosting)
r/                           generated per-item JSON (committed)
flake.nix                    dev shell
```

## Demo loop

```sh
nix develop                              # bun + node + jq
cd cli && bun install
cd ..
bun cli/src/index.ts build               # compile sources

cat registry.json | jq '.items[] | {name, type}'
cat r/mountain-default.json | jq '.registryDependencies'

bun cli/src/index.ts validate examples/themes/mountain-mist/rice.json
bun cli/src/index.ts add r/mountain-default.json

# filter by machine substrate tags
bun cli/src/index.ts query --target hyprland --target quickshell --target wayland
bun cli/src/index.ts query --target niri --target waybar --target wayland
bun cli/src/index.ts query --target gnome --target gtk4
bun cli/src/index.ts query --type registry:theme
```

Hosting the output is a static file drop — `registry.json` + `r/*.json` to
GitHub Pages, S3, or any CDN.

## Desktop app

A minimal Tauri 2 shell over the registry lives at `app/`. It reads
`registry.json` + `r/<name>.json` from disk via `#[tauri::command]`s, lets
you filter by machine substrate tags, and shells out to the bun CLI for
`apply` (currently the stub).

```sh
nix develop                              # rust + webkit + bun + node
cd app && bun install
bun run tauri dev                        # first build is slow — Cargo fetches Tauri deps
```

The frontend is plain HTML + vanilla TS + CSS; no React/Svelte/Vue. The
Rust backend exposes three commands: `read_registry`, `read_item`, and
`apply_item` (the last shells out to `bun cli/src/index.ts add r/<name>.json`).

## Web showcase

Static showcase site at `web/`. Deployable to GitHub Pages or any static
host — the build emits a self-contained `dist/` with `index.html`,
`registry.json`, and `r/*.json`.

```sh
nix develop
cd web && bun install
bun run dev      # vite dev server on localhost:1421
bun run build    # → web/dist/ (deployable)
```

The showcase mirrors the local app's filter UI and adds a **fake-desktop
preview pane** — a `<div>`-mocked Hyprland session that re-skins itself
when you select a `registry:theme` by injecting that item's `cssVars`
onto the preview's root. Light/dark mode toggle. Components reference
semantic tokens (`var(--background)`, `var(--primary)`, …) so any theme
works without code changes — the killer demo of the cssVars decoupling.

For non-theme items, the active theme is preserved and a slot badge
shows which region the item would replace ("replaces: bar"). The detail
pane shows an `nix-rice add <url>` install command for the local app to
consume.

## Design

### Two-file static architecture

`registry.json` is a slim index (name, type, title, slots, preview pointers)
with a `url` to the per-item file at `r/<name>.json`. Item payloads can be
arbitrarily large (palettes, inlined QML, base manifests with many deps)
without bloating the index. Pure static hosting; no backend required.

### Type taxonomy

Mirrors shadcn's `registry:*` namespace, extended for the desktop domain:

| Type                  | Use                                                |
|-----------------------|----------------------------------------------------|
| `registry:base`       | A complete rice — bundles everything else          |
| `registry:component`  | A composed unit (bar, launcher, sidebar)           |
| `registry:ui`         | An atomic primitive (workspace pill, clock widget) |
| `registry:layout`     | Bar arrangement, panel positions                   |
| `registry:theme`      | Palette values (cssVars)                           |
| `registry:style`      | "Skin" — radius / density / glass-vs-flat          |
| `registry:font`       | A typeface bundle                                  |
| `registry:wallpaper`  | A single image (or content-addressed pack)         |
| `registry:soundpack`  | Audio cues (alerts, login chimes)                  |
| `registry:animation`  | Hyprland animation set                             |
| `registry:lib`        | Helper modules (matugen wrapper, screenshot util)  |
| `registry:file`       | Misc                                               |

### Decoupled theming via cssVars

A `registry:component` references *semantic tokens* (`var(--primary)`,
`var(--background)`); a `registry:theme` sets values for those tokens at
three scopes (`theme` shared, `light` overrides, `dark` overrides). Swap
the theme, swap the values — components don't change. This is the
"bar from rice A + palette from rice B" mechanism.

### Multi-tech via `targets`

Each item declares `targets: [...]` — substrate tags it requires. Vocabulary:

- compositors: `hyprland`, `sway`, `niri`, `river`, `kwin`, `mutter`, `gnome-shell`
- bars: `waybar`, `quickshell`, `eww`, `ags`, `gbar`, `polybar`
- toolkits: `gtk3`, `gtk4`, `qt5`, `qt6`
- DEs: `gnome`, `kde`, `xfce`, `cinnamon`, `cosmic`, `lxqt`, `mate`, `budgie`
- session: `wayland`, `x11`
- universal: `any`

The user has a machine profile (declared on NixOS, probed on other distros via
`$XDG_CURRENT_DESKTOP` / `$XDG_SESSION_TYPE` / `pgrep -x`). An item is
installable iff every `targets` tag is satisfied by the machine, OR `targets`
contains `any`. The `query` command demonstrates the filter against the local
index. Rendering on a Hyprland machine: bar component matches, niri bar is
filtered out, palette (any) is universal.

### Slots

Each item declares `slots.provides` / `consumes` / `conflicts`. The resolver
uses these to surface conflicts visibly instead of relying on Nix module
merge's silent last-write-wins. Two `provides: ["bar"]` items installed
together is an error, not a coin flip.

### Dependencies kept on three axes

- `registryDependencies` — other registry items (composition graph)
- `nixpkgsDependencies` — derivation names from nixpkgs (runtime libs)
- `compatibility` — minimum versions of substrate (hyprland, quickshell, …)

### Code vs data

The registry distributes **code** (in NixOS terms): palettes, modules,
QML, Hyprland keybinds. **Data** — your wallpapers, sounds, screenshots,
history thumbnails — lives outside the registry on the user's
btrfs/restic-managed paths. Wallpaper *packs* small enough to ship as Nix
fetches can be `registry:wallpaper`; personal wallpapers are user data.

## What's not built yet

- `add` apply path: resolve transitively → write to user's flake imports →
  run `nh home switch` → capture screenshot for the generation timeline.
- Conflict resolver beyond simple slot overlap.
- Web showcase / browse UI.
- Local app (Tauri) for click-to-install + history timeline.
- Preview daemon (nested Hyprland) for try-without-commit.
- Snapshot-current-config-as-rice publish flow.

## Wire format vs authoring

The registry distributes JSON because the wire is shared across consumers
that aren't NixOS — web showcase (browsers don't eval Nix), rice-cooker on
Arch, third-party crawlers, search indexes. Static-hostable, schema-validated,
cross-language.

That doesn't lock authoring to JSON. A future `rice.nix` path is mechanical:
publishers write their item as a Nix expression, `nix eval --json --file
rice.nix` produces the canonical `r/<name>.json`. Consumer-side projection
into a home-manager option set is also straightforward via `builtins.fromJSON`.
JSON for distribution; Nix as an authoring escape hatch for power users.

## Why not just use shadcn directly?

shadcn copies files into your project. Nix needs *modules* that
home-manager imports — installable as flake inputs, atomic via
generations, rollbackable. The schema is shadcn-shaped; the apply
mechanism is Nix-native.
