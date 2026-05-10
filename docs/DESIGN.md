# Design

The why behind the shape. Pinned decisions that don't live in commit messages.

## Audience

Aesthetic-first Linux users — the persona Framework's recent campaigns and
Apple have aimed for. Owns hardware they're proud of, treats device-as-self-
expression, willing to spend on aesthetic, **not** willing to learn deep
technical concepts. Currently underserved: Linux ricing has a steep
onboarding cliff (find dotfiles → clone → read README → cherry-pick → hope
versions match → no preview → no rollback). MySpace was accessible because
edits were low-stakes, copy-paste-cultural, immediately visible, and the
showcase was wired to the install. r/unixporn is the showcase but is
decoupled from install. We're closing that gap.

## Shape

```
content (registry items)            interface (the registry)
  ─────────────────────              ────────────────────────
  flake-shaped fragments             static JSON over HTTPS
  + JSON Schema validation           + slim index + per-item payloads

  shipped via                        consumed via
  ───────────                        ────────────
  PR / federation / dual-publish     CLI ⇒ TS+Bun (today)
                                     local app ⇒ Tauri 2 (today)
                                     web showcase ⇒ static site (next)
```

Three layers, each independently versionable:

1. **Schema** (`schemas/*.schema.json`) — the contract. shadcn-shaped, plus
   Nix extensions. JSON Schema 2020-12.
2. **Registry artifact** (`registry.json` index + `r/<name>.json` per item)
   — produced by `nix-rice build` from source manifests. Static-hostable.
3. **Source manifests** (`examples/**/rice.json`, eventually `rice.nix`) —
   what authors write. Builder validates + inlines content + emits artifacts.

## Decisions, pinned

### JSON wire format, Nix authoring as escape hatch

Wire is JSON because the consumers we care about aren't all NixOS:

- Web showcase (browsers don't eval Nix).
- rice-cooker on Arch and any future imperative consumer.
- Third-party crawlers, search indexes.
- Cross-language tooling (Rust, Go, TypeScript clients).

Static-hostable, schema-validated, no backend required.

Authoring-as-Nix is mechanical to add later: `nix eval --json --file
rice.nix` emits the canonical `r/<name>.json`. The wire format is
unaffected. Don't lock authoring to JSON; don't lock the wire to Nix.

### shadcn registry-item.json as baseline

We didn't invent the schema; we adapted shadcn/ui's. They've stress-tested
the type taxonomy, dependency-array shape, and `cssVars` decoupling for 2+
years across thousands of registries. Fields kept verbatim:

- `name`, `type`, `title`, `description`, `author`
- `registryDependencies` (transitive resolution)
- `cssVars` with `theme`/`light`/`dark` scopes
- `files: [{path, type, target, content}]`
- `categories`, `meta`

Nix-native extensions:

- `nixpkgsDependencies` — replaces shadcn's `dependencies` (npm) for our
  domain. Derivation names like `quickshell`, `matugen`.
- `compatibility` — version constraints for substrate (hyprland, quickshell,
  homeManager, stylix, nixpkgs).
- `targets` — substrate filter (see below).
- `slots` — explicit `provides`/`consumes`/`conflicts` (see below).
- `previews` — static images and live demo videos.
- File types: `module:home`, `module:nixos`, `qml`, `css`, `scss`, `config`,
  `asset`, `script`. shadcn's `registry:ui`/`registry:component` are
  manifest-level types; ours are file-level.

Type taxonomy:

| Type                 | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `registry:base`      | Whole rice — bundles everything else            |
| `registry:component` | Composed unit (bar, launcher, sidebar)          |
| `registry:ui`        | Atomic primitive (workspace pill, clock widget) |
| `registry:layout`    | Bar arrangement, panel positions                |
| `registry:theme`     | Palette values                                  |
| `registry:style`     | "Skin" — radius / density / glass-vs-flat       |
| `registry:font`      | Typeface bundle                                 |
| `registry:wallpaper` | Single image (or content-addressed pack)        |
| `registry:soundpack` | Audio cues                                      |
| `registry:animation` | Hyprland animation set                          |
| `registry:lib`       | Helper modules                                  |
| `registry:file`      | Misc                                            |

### Slot semantics — pinned

A "slot" is a logical position on the desktop that exactly one component
can fill (the bar, the launcher, the lockscreen). Items declare:

- **`provides: [slot...]`** — what this item fills. Two installed items
  with overlapping `provides` is a **conflict** (resolver MUST surface it,
  MUST NOT silently last-write-wins). Default to `[]`.
- **`consumes: [slot...]`** — what this item depends on existing. The
  resolver checks at install time. Failed `consumes` is a hard error.
  Default to `[]`.
- **`conflicts: [slot...]`** — explicit additional slots this item
  conflicts with beyond what `provides` already implies. Most items leave
  this empty; it exists for unusual cases (e.g. an item that doesn't
  _provide_ a bar but is incompatible with one).

Canonical slot vocabulary (extend with care):

```
bar                   the top/bottom panel
launcher              app launcher (fuzzel, wofi, anyrun, ...)
notification-daemon   mako, dunst, swaync, ...
lockscreen            hyprlock, swaylock, ...
screenshot            grim+slurp, hyprshot, ...
clipboard             cliphist, copyq, ...
wallpaper-daemon      hyprpaper, swaybg, swww, ...
session-menu          power/logout menu
osd                   on-screen display (volume, brightness)
theme.palette         the active color theme
theme.font.display    primary UI font
theme.font.mono       monospace font
theme.cursor          cursor theme
theme.icons           icon theme
theme.sounds          sound theme
```

Resolver behavior on conflict:

1. If two installed items have overlapping `provides`, abort install with
   a clear error naming both.
2. If a `consumes` requirement isn't satisfied by any installed item,
   abort install.
3. The resolver works against the user's _current_ set of installed items,
   not just the new transitive closure being installed. Installing `mountain-default` while `caelestia` is already installed must check
   `mountain-default.provides ∩ caelestia.provides`, not just check within
   the new install.

### Targets — multi-tech filter

An item declares `targets: [...]` of substrate tags it requires. The user
has a machine profile (declared on NixOS, probed on other distros). An
item is **installable** iff:

- `targets` is empty, OR
- `targets` contains `"any"`, OR
- every tag in `targets` is satisfied by the user's machine.

Filter is **`every`**, not `some`. An item targeting
`["hyprland", "quickshell"]` requires BOTH (i.e. a Hyprland session running
Quickshell). To support either-or, ship two items.

#### Canonical targets vocabulary

This is the single source of truth. Adding a tag means adding it here AND
to the schema description (TODO: derive one from the other).

**Compositors:**
`hyprland`, `sway`, `niri`, `river`, `wayfire`, `kwin`, `mutter`,
`gnome-shell`, `i3` (X11), `bspwm` (X11), `awesome` (X11)

**Bars / shells:**
`waybar`, `quickshell`, `eww`, `ags`, `gbar`, `polybar` (X11), `xmobar` (X11)

**Toolkits:**
`gtk3`, `gtk4`, `qt5`, `qt6`

**Desktop environments:**
`gnome`, `kde`, `xfce`, `cinnamon`, `cosmic`, `lxqt`, `mate`, `budgie`,
`pantheon`

**Session:**
`wayland`, `x11`

**Universal:**
`any`

If you find yourself reaching for a tag that isn't here, propose it in a
PR before using it ad-hoc. Vocabulary divergence is hard to reverse.

### Code vs data tier

The registry distributes **code** (in NixOS terms — declarative, in /nix/store,
re-derivable). User **data** lives outside the registry on btrfs/restic-managed
paths.

| Code (registry, flake, /nix/store)                | Data (user dirs, snapshots, restic)        |
| ------------------------------------------------- | ------------------------------------------ |
| Hyprland keybinds, animations, gaps, window rules | Wallpaper image files                      |
| Bar/widget composition + layout                   | Custom .otf/.ttf font files (paid/private) |
| Color palette **values**                          | Cursor sprite files                        |
| Font **selection** + sizes + variants             | Icon pack PNG/SVG files                    |
| Cursor / icon / sound theme **names**             | Sound files (alerts, login chimes)         |
| App-selection (which apps are themed)             | Screenshots taken with the rice            |
| Stylix config                                     | Generation history thumbnails              |
| Tiling rules, borders                             | Quickshell embedded asset blobs            |

Hybrid cases:

- **Wallpaper packs**: small, community-shared → ship as `registry:wallpaper`
  with content hashes (Nix fetches into /nix/store). Personal wallpapers →
  user data, sync via Syncthing or similar.
- **Fonts**: nixpkgs fonts → code (derivation reference). Private/purchased
  fonts → user data.
- **Palettes from wallpaper** (matugen): the _generator_ is code; the
  _input wallpaper_ is data; the resulting palette is derived (reproducible
  if the wallpaper is content-addressed).

The cross-machine sync story falls out of this split:

- **Code syncs via flake input** — atomic, identical, instant.
- **Data syncs via Syncthing/Tailscale** — whatever you'd use for any user
  files.

This maps onto the `nori.fs.<X>` tier system in the homelab CLAUDE.md
(`re-derivable | user | irreplaceable`). Same pattern, applied at the
desktop layer.

## Apply path — the design we'll build to

`add.ts` and `apply_item` are stubs today. When we build the real apply
path, this is the sequence:

```
nix-rice add <url-or-name>
  │
  ├─ 1. Fetch the registry-item.json (validate against schema)
  │
  ├─ 2. Resolve transitively
  │     - Walk registryDependencies; fetch each
  │     - Build dependency DAG
  │     - Detect cycles (error if any)
  │
  ├─ 3. Conflict check
  │     - Read user's currently-installed items (from a state file at
  │       ~/.config/rice-registry/installed.json or similar)
  │     - Union with new transitive closure
  │     - Surface any provides/conflicts overlap, any unmet consumes
  │     - Surface any compatibility (substrate version) failure
  │     - Abort with named conflict if any
  │
  ├─ 4. Mutate user's flake
  │     - Add flake input(s) for any items hosted at flake URLs
  │     - Add `imports = [ ... ];` entries to the user's home-manager
  │       module that the registry app owns
  │     - DO NOT touch the user's hand-written modules
  │
  ├─ 5. Build (preview)
  │     - `nh home build` against the new config
  │     - On failure: revert the flake mutation, report
  │
  ├─ 6. Switch (commit)
  │     - `nh home switch` (creates a generation)
  │     - Capture screenshot to ~/.local/share/rice-history/<gen>/preview.png
  │     - Update installed.json
  │
  └─ 7. Surface result
        - On failure: home-manager generation rollback is automatic
          (the generation didn't activate)
        - On success: report applied items + provide rollback command
```

### Open design questions for the apply path

These need answers before we implement:

- **Where does the user's "rice-owned" home-manager module live?** Options:
  (a) we generate `~/.config/home-manager/rice-registry.nix` and add it
  to imports automatically; (b) the user adds an import once during init,
  we mutate that file. (b) is more transparent; (a) needs less user setup.
  Lean (b) but requires an `init` command.
- **Preview without commit** — for "try this rice without applying" we
  probably need a separate path that side-loads QML/Hyprland configs into
  a nested compositor without touching home-manager. Same UX rice-cooker
  offers; technically out-of-band from the main apply path.
- **What does rollback look like to the user?** `home-manager` generations
  are the substrate; the local app should expose a timeline (history
  thumbnails, click to revert). The apply path needs to write the screenshot
  before declaring success.
- **Multi-machine sync** — applying on machine A should propagate to machine
  B if both share a flake. Probably the user's flake gets a new input on
  apply; rebuilding on B picks it up. Worth verifying the assumption.

## Wire format paths

The schema's `$id` URLs (`https://rice-registry.dev/schema/...`) currently
don't resolve to anything — domain isn't registered. Either register the
domain and host schemas there, or change `$id` to a GitHub-raw URL once the
repo's stable. Decide before encouraging external publishers.

## Upstream tracking

Worth keeping a light eye on:

- shadcn registry schema evolution (their changelog drove `registry:base`
  - first-class fonts). Worth re-reading every few months and absorbing.
- Quickshell — substrate is young; breaking changes possible.
- Hyprland — version compatibility constraints on items will move with
  upstream.
- rice-cooker — they've signaled openness to Nix flake support; worth
  opening an issue once our schema is more battle-tested.
