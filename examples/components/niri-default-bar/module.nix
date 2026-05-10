{ config, lib, pkgs, ... }:

let
  cfg = config.rice.components.niri-default-bar;
in {
  options.rice.components.niri-default-bar = {
    enable = lib.mkEnableOption "niri-default-bar (Waybar)";
  };

  config = lib.mkIf cfg.enable {
    programs.waybar = {
      enable = true;
      settings = [{
        layer = "top";
        position = "top";
        modules-left = [ "niri/workspaces" ];
        modules-center = [ "clock" ];
        modules-right = [ "tray" "battery" ];
      }];
    };
  };
}
