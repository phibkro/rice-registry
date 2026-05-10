{ config, lib, pkgs, ... }:

let
  cfg = config.rice.components.minimal-bar;
in {
  options.rice.components.minimal-bar = {
    enable = lib.mkEnableOption "minimal-bar (Quickshell)";
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ pkgs.quickshell ];

    xdg.configFile."quickshell/minimal-bar/Bar.qml".source = ./Bar.qml;

    wayland.windowManager.hyprland.settings.exec-once = [
      "${pkgs.quickshell}/bin/qs -p ~/.config/quickshell/minimal-bar/Bar.qml"
    ];
  };
}
