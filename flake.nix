{
  description = "rice-registry — Nix-native ricing registry (prototype)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Tauri 2 system deps for Linux desktop dev (webkit2gtk + rsvg).
        # https://tauri.app/start/prerequisites/#linux
        tauriBuildInputs = with pkgs; [
          webkitgtk_4_1
          glib
          libsoup_3
          openssl
          cairo
          gdk-pixbuf
          pango
          atkmm
          librsvg
          dbus
          libayatana-appindicator
        ];
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # CLI dev
            bun
            nodejs_22
            jq

            # Tauri app dev
            cargo
            rustc
            rustfmt
            clippy
            rust-analyzer
            pkg-config
          ];

          buildInputs = tauriBuildInputs;

          shellHook = ''
            # WebKitGTK + Wayland + NVIDIA (esp. Hyprland) trips a DMA-BUF
            # protocol error at WebView spawn time:
            #   Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display.
            # Disabling the DMA-BUF renderer falls back to a working code path.
            # https://github.com/tauri-apps/tauri/issues/9304
            export WEBKIT_DISABLE_DMABUF_RENDERER=1

            echo "rice-registry dev shell"
            echo
            echo "  Workspace:  bun install        # at root"
            echo "  CLI:        bun cli/src/index.ts build"
            echo "              bun cli/src/index.ts query --target hyprland"
            echo "  Web:        cd web && bun run dev"
            echo "  App:        cd app && bun run tauri dev   # first build is slow"
            echo
            echo "  Lint+fmt:   bun run check"
          '';
        };
      });
}
