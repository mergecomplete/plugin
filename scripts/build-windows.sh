#!/bin/sh
# Builds bin/mergecomplete-mcp.exe, the plugin's server on Windows, from
# fallback/main.go. The build is reproducible: the same Go, no paths, no VCS
# stamp and no build ID, so CI runs this and fails if the committed file
# differs from what the source makes.
#
#   scripts/build-windows.sh
#
# Needs Go; GOTOOLCHAIN fetches the pinned version when it isn't the one
# installed.

set -eu

GO_VERSION=1.25.14
root=$(cd "$(dirname "$0")/.." && pwd)

cd "$root/fallback"
GOTOOLCHAIN="go$GO_VERSION" GOOS=windows GOARCH=amd64 CGO_ENABLED=0 GOFLAGS='' \
	go build -trimpath -buildvcs=false -ldflags='-s -w -buildid=' -o "$root/bin/mergecomplete-mcp.exe" .
printf 'Built bin/mergecomplete-mcp.exe with Go %s\n' "$GO_VERSION"
