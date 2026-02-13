#!/bin/bash
# Build script for Smart Capture Chrome extension
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"
ESBUILD="/usr/local/lib/node_modules_global/lib/node_modules/tsx/node_modules/.bin/esbuild"

# Clean
rm -rf "$DIST"
mkdir -p "$DIST/icons"

echo "[build] Cleaned dist/"

# Bundle service worker (ESM — manifest declares type: module)
echo "[build] Bundling service-worker..."
$ESBUILD src/background/service-worker.ts \
  --bundle --format=esm --target=es2020 \
  --outfile=dist/service-worker.js

# Bundle content script (IIFE — content scripts can't be ES modules)
echo "[build] Bundling content-script..."
$ESBUILD src/content/content-script.ts \
  --bundle --format=iife --target=es2020 \
  --outfile=dist/content-script.js

# Bundle popup JS
echo "[build] Bundling popup..."
$ESBUILD src/ui/popup/popup.ts \
  --bundle --format=esm --target=es2020 \
  --outfile=dist/popup.js

# Bundle options JS
echo "[build] Bundling options..."
$ESBUILD src/ui/options/options.ts \
  --bundle --format=esm --target=es2020 \
  --outfile=dist/options.js

# Copy manifest
cp "$ROOT/manifest.json" "$DIST/manifest.json"

# Copy and patch HTML files (.ts → .js)
sed 's/popup\.ts/popup.js/g' "$ROOT/src/ui/popup/popup.html" > "$DIST/popup.html"
sed 's/options\.ts/options.js/g' "$ROOT/src/ui/options/options.html" > "$DIST/options.html"

# Copy CSS
cp "$ROOT/src/ui/popup/popup.css" "$DIST/popup.css"
cp "$ROOT/src/ui/options/options.css" "$DIST/options.css"

# Copy icons if present
if [ -d "$ROOT/public/icons" ]; then
  cp -r "$ROOT/public/icons/"* "$DIST/icons/" 2>/dev/null || true
fi

echo "[build] Done! Extension ready in dist/"
echo "[build] Load it in Chrome: chrome://extensions → Load unpacked → select dist/"
