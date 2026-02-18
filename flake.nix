{
  description = "Comcal development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            chromium
            nodejs_22
            pnpm
            playwright-driver.browsers
          ];

          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/playwright-browsers
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            export CHROMIUM_BIN=${pkgs.chromium}/bin/chromium
            export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=${pkgs.chromium}/bin/chromium
            export PLAYWRIGHT_MCP_EXECUTABLE_PATH=${pkgs.chromium}/bin/chromium
            mkdir -p $PLAYWRIGHT_BROWSERS_PATH
            echo "Comcal dev environment loaded - Node $(node --version)"
          '';
        };
      }
    );
}
