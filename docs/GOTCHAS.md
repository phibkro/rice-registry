# Gotchas

Known landmines and their fixes.

## Tauri app crashes on launch with `Error 71 (Protocol error) dispatching to Wayland display`

Symptom:

```
Running `target/debug/rice-registry-app`
Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display.
error: script "tauri" exited with code 1
```

Cause: WebKitGTK 4.1's DMA-BUF renderer is broken on several
Wayland-on-NVIDIA setups (especially Hyprland) and on some Mesa
versions. The `Error 71` is `EPROTO` from a Wayland protocol mismatch
during WebView surface allocation.

Fix: set `WEBKIT_DISABLE_DMABUF_RENDERER=1` before launching the app.
The dev shell exports it automatically (`flake.nix` shellHook). If
running outside `nix develop`:

```sh
export WEBKIT_DISABLE_DMABUF_RENDERER=1
bun run tauri dev
```

If that's not enough, add `WEBKIT_DISABLE_COMPOSITING_MODE=1` as a
second fallback. Worst case: `GDK_BACKEND=x11` forces XWayland.

References:

- https://github.com/tauri-apps/tauri/issues/9304
- https://gitlab.gnome.org/GNOME/gtk/-/issues/6589

## CI step `bun --filter <pkg> run build` fails with "No packages matched the filter"

Symptom: GH Actions build step exits 1 with `error: No packages
matched the filter`.

Cause: bun's `--filter` syntax against the `name` field in
`package.json` doesn't always match in workspace contexts (specifics
vary by bun version).

Fix: use `working-directory: <pkg>` + `run: bun run build` instead.
Already applied in `.github/workflows/deploy-pages.yml`.

## oxfmt format check passes locally, fails in CI

Symptom: `bun x oxfmt --check` is clean locally; CI's "Format check
(oxfmt)" step fails on a file you didn't touch.

Cause: oxfmt's file-discovery scan can miss files on the first pass
in some directory layouts. Running `oxfmt` (write) on the specific
file fixes it; subsequent `--check` runs are clean.

Fix: when this happens, run `bun x oxfmt <path-to-file>` once
explicitly, then re-run `bun x oxfmt --check` to confirm idempotent.

## Pre-commit hook reports "bun not on PATH; skipping"

Symptom: committing from a host without `nix develop` active prints
the skip message.

This is intentional. The hook is a soft gate; the CI workflow runs
the same `oxlint` + `oxfmt --check` on push and will block bad
commits at the PR level. If you want hard local enforcement, run
`nix develop` (which puts bun on PATH) before committing.

## `app/src-tauri/src/lib.rs` resolves the registry via `CARGO_MANIFEST_DIR`

This is dev-only. It works while the binary lives in the same git
clone it was compiled in; for a packaged build, replace with a
runtime config (env var `RICE_REGISTRY_DIR`, or a config file).
Tracked in `OUTSTANDING.md`.
