# Outstanding

Punch list of what's deferred. Order is rough priority, not blocker chain.
When something lands, delete it from this file (don't strikethrough — the
git log is the history).

## Apply path (the big one)

`nix-rice add` now validates schema, resolves transitive deps, checks
slot conflicts against `installed.json`, and **materializes files +
regenerates the managed module + persists state**. What's left:

- [ ] **`nix-rice machine`** command — set/get the machine profile in
      installed.json. Today users edit installed.json directly to
      declare their `hyprland`, `quickshell`, etc. versions for compat
      checks. CLI sugar is overdue.
- [ ] **`registryDependencies` over the wire** — `add <url>` only loads
      one item; transitive deps are resolved against the local `r/`
      directory. For external registries, the resolver needs to fetch
      each dep by its `url` field. Adds HTTP fetching + caching.
- [ ] **Build + switch** — `nh home build` for preview, `nh home switch`
      for commit. Use `nh` not `home-manager` directly (better diff
      output). Optional `--apply` flag default OFF — explicit opt-in to
      run the actual switch.
- [ ] **Screenshot on switch** — `grim` capture into
      `~/.local/share/rice-history/<gen>/preview.png`. Async; don't block
      the switch. Drives the history-timeline UI.
- [ ] **Surface output** — applied items list, rollback command for the
      user (`home-manager generations` + `--rollback`).
- [ ] **Rust port?** — `apply_item` in the Tauri app shells out to
      `bun cli/...`, which requires bun on PATH at runtime. For a packaged
      build, either bundle bun or port the apply logic to Rust. Lean
      toward Rust port once the path stabilizes; keep bun shell-out for
      the prototype.

## Schema + tooling

- [ ] Decide schema `$id` URLs. Currently
      `https://rice-registry.dev/schema/...` doesn't resolve. Options:
      register the domain, or change `$id` to GitHub-raw URLs once the
      repo's stable.
- [ ] Single source of truth for the **targets vocabulary**. Currently in
      both `schemas/registry-item.schema.json` description AND
      `docs/DESIGN.md` § "Canonical targets vocabulary". Generate one
      from the other (probably emit the JSON Schema description from the
      doc at build time).
- [ ] **`nix-rice catalog-import`** — read rice-cooker's `catalog.toml`,
      emit our format. See `docs/RICE_COOKER_COMPARISON.md` § 1. Useful
      for bootstrapping content into the showcase.
- [ ] **`rice.nix` authoring path** — `nix eval --json --file rice.nix`
      → canonical `r/<name>.json`. Sketched in `docs/DESIGN.md`; not
      implemented.
- [ ] **Wallpaper-as-content-addressed-fetch** (`registry:wallpaper`).
      Schema already has the type; no example yet. Need a
      `source: { type: "fetch", url, hash }` field for items shipping
      binary content via Nix fetches rather than inlined.

## Tauri app

- [ ] **`CARGO_MANIFEST_DIR`-based path resolution** in
      `app/src-tauri/src/lib.rs` is dev-only. For a packaged build, take
      a config file path or env var (`RICE_REGISTRY_DIR`) at startup.
- [ ] **History timeline UI** — list home-manager generations, show
      screenshot thumbnails, click to revert. Killer feature rice-cooker
      can't match without rebuilding their state model. Depends on the
      apply-path screenshot work.
- [ ] **Preview daemon hookup** — when the apply path gains a
      preview-without-commit mode (nested compositor), expose it from
      the app as "Try" vs "Apply".
- [ ] **Slot conflict modal** — apply already surfaces conflicts in
      stderr, but a dedicated UI showing which installed item conflicts
      with which new item is much clearer. Could parse the structured
      output of `nix-rice explain`.
- [ ] **Network registry support** — currently reads from the local repo
      only. Eventually fetch from a remote registry URL. Needs a
      `RICE_REGISTRY_URL` config knob or similar.
- [ ] **Browser-mode registry serve** — when `app/` is opened in a
      browser at localhost:1420, `fetch("/registry.json")` 404s because
      Vite serves from `app/` not the repo root. Add a `predev` copy
      script like web has, OR mount the registry path via Vite middleware.
- [ ] **Bundle / package** — for end users we want a NixOS package
      (in nixpkgs eventually) + AppImage / .deb / .rpm. First run today
      is `nix develop && cd app && bun install && bun run tauri dev`.

## Web showcase

- [ ] **Deep-link install button** — replace the copy-paste
      `nix-rice add <url>` command with a `riceregistry://add?url=...`
      deep link the local app intercepts. Requires the local app to
      register a URL scheme handler.
- [ ] **Per-item screenshot upload** — currently no per-item images;
      only the live fake-desktop preview. Allow items to ship a
      `previews.static` array with content-hashed PNG/MP4 paths;
      surface in the catalog list as thumbnails.

## Snapshot-current-config-as-rice

The "publish your current desktop as a rice" workflow. Mechanical when
the user composed from registry components; with hand-written Nix we'd
either inline it or refuse.

- [ ] **CLI: `nix-rice snapshot`** — read the user's installed.json +
      any cssVars overrides, emit a `registry:base` item.
- [ ] **App: same as a button.**

## Curation + community

Far from blocking but worth thinking about:

- [ ] **Two-tier curation** — verified (PR-gated, signed) + community
      (self-publish, caveat emptor) with visible labels in the UI.
- [ ] **Submission flow** — initially PR to this repo; eventually
      federation (item lives at the publisher's URL, registry is an
      index pointing at it).
- [ ] **Trust model** — for community-tier items, verification beyond
      schema-validation: stable URL, items build clean, no shell-exec
      in module activation hooks. Sandboxing for `apply_item`'s
      transitive dep installs.

## Cross-substrate items

Items targeting multiple substrates (e.g. a palette that ships GTK +
Qt + Hyprland adapters). Stylix's `stylix.targets.<X>` is the working
pattern.

- [ ] **Schema: `variants`** map from substrate-tag → file-set / module
      path.
- [ ] **Authoring example** — a single palette item with variants for
      gtk, qt, and hyprland.
- [ ] **Rule-of-three guard** — wait until we have three concrete
      cross-substrate items before extracting the abstraction.

## Material You / matugen integration

The substrate end-to-end pattern from the design conversation: drop a
wallpaper, get a coherent palette via matugen, propagate via Stylix.

- [ ] **`registry:lib` for matugen wrapper** — small home-manager
      module that watches a wallpaper path and regenerates a
      `registry:theme` from it. Demonstrates the data→code derivation.
- [ ] **`registry:wallpaper` example** — a small content-addressed
      wallpaper pack to pair with the matugen wrapper.

## Lints + CI checks

Multi-language registry items expose drift between source files and the
schema.

- [ ] **QML file compile check** — `qmllint` in CI for every
      `type: "qml"` file in the closure.
- [ ] **Nix file eval check** — `nix-instantiate --parse` or
      `nix eval --raw` for every `module:home` / `module:nixos` file.
- [ ] **Schema example coverage** — every `type` in the enum should
      have at least one example item.
- [ ] **Doc-coherence flake check** — fail build if `docs/DESIGN.md`
      references a `nori.<X>` / pattern that doesn't exist in code.
      Same shape as the homelab's pattern.

## Documentation

- [ ] **Single canonical targets list** — see "Schema + tooling".
- [ ] **Per-type authoring guide** — minimum required fields for
      `registry:theme`, `registry:component`, `registry:base`, etc.
      Examples are the implicit guide today; explicit prose helps once
      we have outside contributors.
- [ ] **Apply path runbook** — once implemented, document partial-apply
      recovery (manual flake rollback, generation reset, etc.).
