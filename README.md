# rice-registry

A Nix-native registry for ricing components — bars, palettes, fonts, layouts,
and complete rices — modelled after [shadcn/ui's registry][shadcn] but for
Hyprland + Quickshell + Stylix on NixOS.

This is a **prototype**. The schema, `build` / `validate` / `query` /
`explain` paths are real and verified end-to-end. `add` resolves
transitive deps and reports slot conflicts but stops short of mutating
the user's flake — see `docs/OUTSTANDING.md`.

[shadcn]: https://ui.shadcn.com/docs/registry

## What's here

```
schemas/                     JSON Schemas — the contract
  registry-item.schema.json    one item: theme, component, base, font, ...
  registry.schema.json         the index that lists items

examples/                    source items
  themes/mountain-mist/        registry:theme — cool palette (any)
  themes/sunset-amber/         registry:theme — warm palette (any)
  components/minimal-bar/      registry:component — Quickshell (hyprland)
  components/niri-default-bar/ registry:component — Waybar (niri)
  bases/mountain-default/      registry:base — composes the Hyprland set

cli/                         nix-rice CLI (TypeScript + Bun)
  src/build.ts                 examples/** → registry.json + r/*.json
  src/validate.ts              schema-check a single rice.json
  src/query.ts                 filter index by machine targets / type
  src/resolve.ts               transitive deps + conflict detection
  src/explain.ts               read-only preview of an install plan
  src/add.ts                   resolve + check, then [stub] apply

packages/shared/             shared types + Solid components
  src/types.ts                 RegistryIndex, RegistryItem, CssVars, Mode
  src/filter.ts                isInstallable
  src/components/              FakeDesktop, FilterBar, ItemList, ItemDetail
  src/styles/                  shell.css, fake-desktop.css

web/                         Static showcase (Solid + Vite)
  src/App.tsx                  page composition + fetchers
  scripts/copy-registry.ts     pre-build: copies registry.json + r/ to public/

app/                         Tauri 2 desktop app (Solid + Vite)
  src/App.tsx                  page composition + Tauri invokes
  src-tauri/src/lib.rs         Rust: read_registry / read_item / apply_item

docs/
  DESIGN.md                    pinned decisions: shape, slot semantics, apply path
  OUTSTANDING.md               punch list of what's deferred
  GOTCHAS.md                   known landmines + fixes
  RICE_COOKER_COMPARISON.md    notes on amarsbar/rice-cooker manifest shape
```

Workspace is bun-managed (`workspaces` in root package.json). One install
at the root populates all sub-packages: `bun install` from the repo root.

## Demo loop

```sh
nix develop                              # bun + node + jq + rust + webkit
bun install                              # workspace install (root)
bun cli/src/index.ts build               # compile sources

cat registry.json | jq '.items[] | {name, type}'
bun cli/src/index.ts validate examples/themes/mountain-mist/rice.json

# filter by your machine's substrate tags
bun cli/src/index.ts query --target hyprland --target quickshell

# preview a candidate install (transitive deps + slot conflicts)
bun cli/src/index.ts explain mountain-default
bun cli/src/index.ts explain mountain-default --installed niri-default-bar  # conflict on `bar`

# stub apply — resolves + checks, then prints
bun cli/src/index.ts add r/mountain-default.json
```

Hosting the output is a static file drop — `registry.json` + `r/*.json`
to GitHub Pages, S3, or any CDN.

## Web showcase

Static showcase site at `web/`. Deployable to any static host — the
build emits a self-contained `dist/` with `index.html`, `registry.json`,
and `r/*.json`. CI deploys to GitHub Pages on every push to main.

```sh
cd web && bun run dev      # vite dev server on localhost:1421
bun run build              # → web/dist/
```

Same Solid components as the local app (lifted into `packages/shared`):
filter bar, item list, item detail, **fake-desktop preview pane**. The
preview re-skins itself when you select a `registry:theme` by injecting
that item's `cssVars` onto the preview's root. Light/dark mode toggle.
Components reference semantic tokens (`var(--background)`,
`var(--primary)`, …) so any theme works without code changes — the
killer demo of the cssVars decoupling.

## Desktop app

Tauri 2 shell over the registry at `app/`. Reads `registry.json` +
`r/<name>.json` from disk via `#[tauri::command]`s, lets you filter by
machine substrate tags, and shells out to the bun CLI for `apply`.

```sh
cd app && bun run tauri dev    # first build is slow — Cargo fetches Tauri deps
```

Frontend is Solid + Vite, sharing components with the web showcase via
`packages/shared`. The Rust backend exposes three commands:
`read_registry`, `read_item`, and `apply_item` (the last shells out to
`bun cli/src/index.ts add r/<name>.json`).

## Lint + format

[oxlint](https://oxc.rs/docs/guide/usage/linter) +
[oxfmt](https://oxc.rs/docs/guide/usage/formatter) (both from the
[oxc](https://oxc.rs) project, ~50–100× faster than ESLint / ~30× faster
than Prettier).

```sh
bun run check        # oxlint + oxfmt --check
bun run lint         # oxlint
bun run lint:fix     # oxlint --fix
bun run fmt          # oxfmt (write)
bun run fmt:check    # oxfmt --check
```

Configs at `.oxlintrc.json` + `.oxfmtrc.json`. Pre-commit hook at
`.githooks/pre-commit` blocks commits on lint or format failure;
activate with `git config core.hooksPath .githooks` (already set in
this clone). PostToolUse hook in `.claude/settings.json` runs both on
every Edit/MultiEdit/Write so AI-edited files arrive formatted.

The unified [Vite+ (`vp`)](https://viteplus.dev/) wraps these plus
Vite/Vitest/Rolldown behind one CLI; it's optional and not currently
in the dev shell. Underlying tools are what actually run.

## Design highlights

- **Two-file static architecture** — `registry.json` is a slim index
  (name, type, title, slots) with a `url` to the per-item file at
  `r/<name>.json`. Item payloads can be arbitrarily large without
  bloating the index.
- **shadcn-shaped schema, Nix-native extensions** — type taxonomy
  (`registry:base` / `:component` / `:theme` / `:font` / …), `cssVars`
  with `theme`/`light`/`dark` scopes, plus `nixpkgsDependencies`,
  `compatibility`, `targets`, `slots`.
- **Slots over ad-hoc** — every item declares `slots.provides` /
  `consumes` / `conflicts`. The resolver surfaces conflicts visibly
  instead of relying on Nix module merge's silent last-write-wins.
- **Multi-tech via `targets`** — items declare substrate tags
  (`hyprland`, `quickshell`, `gtk4`, `kde`, …); the user has a machine
  profile; `every` matches required.
- **Code vs data** — the registry distributes code; user data
  (wallpapers, sounds, history thumbnails) stays out, syncs separately.

See `docs/DESIGN.md` for the pinned decisions and `docs/OUTSTANDING.md`
for the punch list.

## Why not just use shadcn directly?

shadcn copies files into your project. Nix needs _modules_ that
home-manager imports — installable as flake inputs, atomic via
generations, rollbackable. The schema is shadcn-shaped; the apply
mechanism is Nix-native.
