#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
PACKAGE_ROOT="$ROOT/.package"
OS_NAME=$(uname -s)
case "$OS_NAME" in
  Linux*) PLATFORM="linux" ;;
  Darwin*) PLATFORM="darwin" ;;
  *) echo "Unsupported OS for package.sh: $OS_NAME" >&2; exit 1 ;;
esac
STAGING="$PACKAGE_ROOT/@serviceadmin-$PLATFORM"
TAR_PATH="$DIST/@serviceadmin-$PLATFORM.tar.gz"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "Build output missing. Run npm run build first." >&2
  exit 1
fi

mkdir -p "$DIST" "$PACKAGE_ROOT"
rm -rf "$STAGING"
mkdir -p "$STAGING/runtime" "$STAGING/dist"

cp "$ROOT/runtime/server.js" "$STAGING/runtime/server.js"
cp "$ROOT/runtime/$PLATFORM/start-@serviceadmin.sh" "$STAGING/runtime/start-@serviceadmin.sh"
cp -R "$ROOT/config" "$STAGING/config"
cp "$DIST/index.html" "$STAGING/dist/index.html"
cp -R "$DIST/assets" "$STAGING/dist/assets"
cp -R "$DIST/images" "$STAGING/dist/images"
cp -R "$DIST/services" "$STAGING/dist/services"

chmod +x "$STAGING/runtime/start-@serviceadmin.sh" 2>/dev/null || true

rm -f "$TAR_PATH"
tar -czf "$TAR_PATH" -C "$STAGING" .
echo "Created $TAR_PATH"
