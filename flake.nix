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
            echo "rice-registry dev shell"
            echo
            echo "  CLI:    cd cli && bun install"
            echo "          bun src/index.ts build"
            echo "          bun src/index.ts query --target hyprland"
            echo
            echo "  App:    cd app && bun install"
            echo "          bun run tauri dev   # first build is slow (Cargo fetches deps)"
          '';
        };
      });
}
