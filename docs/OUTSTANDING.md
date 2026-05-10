# Outstanding

Punch list of what's deferred. Order is rough priority, not blocker chain.
When something lands, delete it from this file (don't strikethrough — the
git log is the history).

## Apply path (the big one)

The whole reason the project exists. See `docs/DESIGN.md` § "Apply path"
for the planned sequence. Steps to land:

- [ ] User flake mutation strategy decided (we own a module vs we mutate
      a user-imported file). Lean toward `nix-rice init` writing
      `~/.config/home-manager/rice-registry.nix` once, the user adds one
      import line, we own that file thereafter.
- [ ] State file at `~/.config/rice-registry/installed.json` — what's
      currently installed, transitively. Drives conflict detection on
      future installs.
- [ ] Transitive resolver in `cli/src/resolve.ts` — walks
      `registryDependencies`, builds DAG, detects cycles.
- [ ] Conflict check — overlapping `provides`, unmet `consumes`, failed
      `compatibility` constraints. Surface visibly; never silent.
- [ ] Flake mutation — add input(s) + imports. Idempotent. Failed install
      reverts the mutation.
- [ ] Build + switch — `nh home build` for preview, `nh home switch` for
      commit. Use `nh` not `home-manager` directly (better diff output).
- [ ] Screenshot on switch — `grim` capture into
      `~/.local/share/rice-history/<gen>/preview.png`. Async; don't block
      the switch.
- [ ] Surface output — applied items list, rollback command for the user.
- [ ] Rust port? `apply_item` in the Tauri app shells out to `bun cli/...`,
      which requires bun on PATH. Either bundle bun, or port the apply
      logic to Rust. Lean toward Rust port once the path stabilizes;
      keep bun shell-out for the prototype.

## Slot conflict resolver

Pinned semantics in `docs/DESIGN.md` § "Slot semantics". Implementation:

- [ ] `cli/src/resolve.ts` (or similar) — given a list of items + the
      user's installed set, compute the conflict graph and surface any
      overlap.
- [ ] CLI flag `--explain` that prints the resolution for a candidate
      install without actually applying.

## Schema + tooling

- [ ] Decide schema `$id` URLs. Either register `rice-registry.dev` or
      change to GitHub-raw URLs. Currently the URLs don't resolve.
- [ ] Single source of truth for the targets vocabulary. Currently in
      both `schemas/registry-item.schema.json` description AND
      `docs/DESIGN.md` § "Canonical targets vocabulary". Generate one from
      the other.
- [ ] `nix-rice catalog-import` — read rice-cooker's `catalog.toml`,
      emit our format. See `docs/RICE_COOKER_COMPARISON.md` § 1. Useful
      for bootstrapping content into the web showcase.
- [ ] `rice.nix` authoring path. `nix eval --json --file rice.nix`
      → canonical `r/<name>.json`. Sketched in `docs/DESIGN.md`; not
      implemented.
- [ ] Wallpaper-as-content-addressed-fetch (`registry:wallpaper`). Schema
      already has the type; no example yet. Need a `source: { type: "fetch",
      url, hash }` field for items that ship binary content via Nix
      fetches rather than inlined.

## Hosting

- [ ] Decide hosting. GitHub Pages is the obvious choice — push the
      generated `registry.json` + `r/*.json` to a `gh-pages` branch (or
      use GitHub Actions to publish). Static, free, CDN-fronted.
- [ ] CI — `nix flake check` on push, run `nix-rice build`, validate, fail
      build on any item violating schema.
- [ ] Optional: a `nix-rice publish` CLI step that pushes to the registry's
      backing repo (for federated registries that aren't this one).

## Web showcase

- [ ] Static site (Astro? plain HTML?) listing items with screenshots.
- [ ] Fake-DE preview pane — a `<div>` mocked up to look like a Hyprland
      session that re-skins itself when you select an item by injecting
      that item's `cssVars`. r/unixporn-meets-install.
- [ ] One-click install button that hands off to the local app via deep
      link (`riceregistry://add?name=mountain-default`).
- [ ] Search + filter (matches the local app's filter exactly — share
      the rendering logic if reasonable).

## Tauri app

- [ ] `CARGO_MANIFEST_DIR`-based path resolution in
      `app/src-tauri/src/lib.rs` is dev-only. For a built/distributed app,
      take a config file path or env var (`RICE_REGISTRY_DIR`) at startup.
- [ ] History timeline UI — list home-manager generations, show
      screenshot thumbnails, click to revert. The killer feature
      rice-cooker can't match without rebuilding their state model.
- [ ] Preview daemon hookup — when the apply path gains a preview-without-
      commit mode, expose it from the app as "Try" vs "Apply".
- [ ] Slot conflict UI — when a candidate install conflicts, show which
      installed item conflicts with which new item.
- [ ] Network registry support — currently reads from the local repo
      only. Eventually fetch from a remote registry URL.
- [ ] Bundle / package — first run is `nix develop && cd app && bun
      install && bun run tauri dev`. For end users we want a NixOS
      package + AppImage / .deb / .rpm.

## Snapshot-current-config-as-rice

The "publish your current desktop as a rice" workflow. Mechanical only if
the user composed from registry components; if they have hand-written Nix,
we'd need to either inline it or refuse.

- [ ] CLI: `nix-rice snapshot` — read the user's installed.json + cssVars
      overrides, emit a `registry:base` item.
- [ ] App: same as a button.

## Curation + community

Far from blocking but worth thinking about:

- [ ] Two-tier: verified (PR-gated, signed) + community (self-publish,
      caveat emptor) with visible labels in the UI.
- [ ] Submission flow — initially PR to this repo; eventually federation.
- [ ] Trust model for community-tier items — what does verification check
      beyond the schema? Probably: published from a stable URL, items
      build clean, no shell-exec in module activation hooks.

## Cross-substrate items

Items that target multiple substrates (e.g. a palette that ships both GTK
+ Qt + Hyprland adapters). Stylix's `stylix.targets.<X>` is the working
pattern.

- [ ] Schema: `variants` map from substrate-tag → file-set / module-path.
- [ ] Authoring example: a single palette item with variants for gtk,
      qt, and hyprland.
- [ ] Rule-of-three guard — wait until we have three concrete cross-
      substrate items before extracting the abstraction.

## Lints

Multi-language registry items are exposed to drift between languages.

- [ ] Verify QML files compile (qmllint or similar in CI).
- [ ] Verify Nix files evaluate (`nix-instantiate --parse` or
      `nix eval --raw` in CI).
- [ ] Verify JSON Schema example coverage — every `type` in the enum
      should have at least one example item.

## Documentation

- [ ] Single canonical targets list (currently duplicated; see
      "Schema + tooling" above).
- [ ] Per-type authoring guide — what does a `registry:component` need at
      minimum? `registry:theme`? Examples are the implicit guide today;
      explicit prose helps once we have outside contributors.
- [ ] Apply path runbook — once implemented, document how to recover from
      a partial-apply failure (manual flake rollback, etc.).
