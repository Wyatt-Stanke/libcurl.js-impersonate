#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "out/libcurl_full.mjs" ]; then
    echo "ERROR: out/libcurl_full.mjs not found. Run build.sh first." >&2
    exit 1
fi

echo "Compiling TypeScript..."
rm -rf dist
mkdir -p dist
pnpx --package=typescript tsc --project tsconfig.build.json

sed -i 's|../out/libcurl_full.mjs|./libcurl_full.mjs|g' dist/index.js dist/index.d.ts 2>/dev/null || true

echo "Copying WASM bundle..."
cp out/libcurl_full.mjs dist/libcurl_full.mjs
cp out/libcurl_full.d.mts dist/libcurl_full.d.mts

echo "dist/ ready"
