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
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            bun
            nodejs_22
            jq
          ];

          shellHook = ''
            echo "rice-registry dev shell"
            echo "  cd cli && bun install   # first time"
            echo "  bun src/index.ts build  # compile examples → registry.json + r/*.json"
          '';
        };
      });
}
