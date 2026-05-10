# rice-cooker comparison

Notes from reading [amarsbar/rice-cooker][rc] @ HEAD on 2026-05-10. Their
catalog format is `backend/catalog.toml` (TOML, hand-curated, PR-gated);
parser + validator at `backend/src/catalog.rs`.

[rc]: https://github.com/amarsbar/rice-cooker

## Their manifest

A rice is one TOML table:

```toml
[noctalia]
display_name = "Noctalia"
creator_name = "noctalia-dev"
repo         = "https://github.com/noctalia-dev/noctalia-shell"
commit       = "d7b68652e79bce5813dc4fea7e51636a5da3e1b7"   # any git ref
symlink_src  = "."                                          # path inside clone
symlink_dst  = "~/.config/quickshell/noctalia"              # must be under $HOME
package_managed = false                                     # opt: rice ships as Arch pkg
preview_deps    = ["noctalia-qs"]                           # opt: minimal preview deps
install_deps    = [...]                                     # opt: full install deps
interactive     = false                                     # reserved
```

Apply path: clone repo at `commit` → symlink `clone/symlink_src` → `symlink_dst`
→ point Quickshell at it via `qs -c <name>`. No file mutation in user's dotfiles.
Revert = remove symlink. Install (persistent) additionally runs
`yay -S {install_deps}`.

7 rices in catalog at writing time. All Hyprland + Quickshell on Arch.

## Side-by-side

| Concept                | rice-cooker (Arch)                            | rice-registry (Nix)                                   |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Granularity            | atomic rice only                              | type taxonomy (`base`/`component`/`theme`/`font`/...) |
| Source                 | `repo` + `commit` (git ref)                   | inlined `files[].content`, or flake input             |
| Apply mechanism        | clone + symlink                               | flake import + home-manager generation                |
| Preview-without-commit | yes (symlink swap, original untouched)        | not yet — planned via nested compositor               |
| Persistent install     | `yay -S` deps + symlink                       | `nh home switch` (atomic generation)                  |
| Rollback               | flat undo (revert)                            | timeline (any prior generation)                       |
| Composition            | none (atomic)                                 | `registryDependencies`                                |
| Theming                | baked into rice                               | `cssVars` decoupled, `registry:theme` swappable       |
| Substrate filter       | none (Arch + Hyprland + Quickshell hardcoded) | `targets[]` array                                     |
| Multi-machine sync     | reinstall manually                            | flake input update + switch                           |
| Curation               | PR to single TOML                             | TBD — likely two-tier (verified + community)          |
| Auth                   | none — fully public                           | TBD                                                   |

## Should our output emit their format?

No, not as primary output. The manifests describe different distribution
models:

- rice-cooker ships **pointers** (git ref + paths inside the clone).
  Apply = clone + symlink at runtime.
- rice-registry ships **content** (inlined module bodies, palette values,
  QML, Nix expressions). Apply = home-manager generation.

A registry item with `registryDependencies: ["minimal-bar", "mountain-mist"]`

- inlined `cssVars` has no representation in their schema — there's no
  composition primitive on their side, and they don't ship palettes
  separately from rices. A `registry:theme` is meaningless to them.

## What does make sense

Three integration paths, ordered by feasibility:

### 1. `nix-rice catalog-import` — read their TOML, emit our JSON

Each rice-cooker entry maps to a `registry:base` in our format:

| Their field        | Our field                                                                     |
| ------------------ | ----------------------------------------------------------------------------- |
| `[name]` table key | `name`                                                                        |
| `display_name`     | `title`                                                                       |
| `creator_name`     | `author`                                                                      |
| `repo` + `commit`  | new `source.git = { url, ref }` field, or fetched-flake input                 |
| `symlink_src/dst`  | activation hook in generated `homeModule`                                     |
| `install_deps`     | `nixpkgsDependencies` (best-effort name mapping; some Arch names won't exist) |
| `package_managed`  | discarded — Nix is always package-managed                                     |
| (always)           | `targets: ["hyprland", "quickshell", "wayland"]`                              |
| (always)           | `type: "registry:base"`                                                       |

Lossy on the install-deps mapping, but bootstraps content. Worth ~50 LoC
to add to the CLI. Punt until we have a reason to actually pull their
content (e.g. demo material for the website).

### 2. Manifest spec convergence

Their `catalog.toml` header says _"We recommend packaging your rice with
nix flakes. Rice cooker will be updated to support them soon."_ — they're
open to a Nix path. Worth filing an issue on their repo with a sketch of
a manifest spec both can target. The schema would be a superset of theirs
(our additional types + slots + cssVars + registryDependencies). Rice-cooker
would consume only the `registry:base` items with a single `source.git`
entry; rice-registry would consume everything.

Defer until our schema is more battle-tested — proposing convergence now
risks locking in a shape we'll regret.

### 3. Separate registries, dual-publish

Authors register on both. Rice-cooker for Arch+Hyprland+Quickshell users;
rice-registry for the multi-substrate Nix world. Inevitable as a transient
state regardless of whether (1) or (2) lands.

## Schema additions implied

If we want option 1 to land cleanly, the registry-item schema needs a
`source` field that's currently absent — for items whose content lives at
a remote git ref rather than inlined in the registry. Sketch:

```jsonc
{
  "source": {
    "type": "git",
    "url": "https://github.com/example/rice",
    "ref": "<sha or tag>",
    "subPath": "quickshell",
  },
}
```

Or a flake-input variant:

```jsonc
{
  "source": {
    "type": "flake",
    "url": "github:example/rice",
    "rev": "<sha>",
  },
}
```

Don't add this speculatively — wait until we ingest a real catalog and
need it.
