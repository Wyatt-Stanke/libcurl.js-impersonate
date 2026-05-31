#!/bin/bash
# Build libcurl.js with BoringSSL + Chrome TLS fingerprint impersonation.
# Produces out/libcurl_full.mjs
set -ex

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIBCURL_JS_DIR="$SCRIPT_DIR/libcurl.js"
OUT_DIR="$SCRIPT_DIR/out"

if ! command -v emcc >/dev/null 2>&1; then
	EMSDK_ENV="$HOME/emsdk/emsdk_env.sh"
	if [ ! -f "$EMSDK_ENV" ]; then
		echo "ERROR: emcc not found on PATH and no emsdk at \$HOME/emsdk." >&2
		exit 1
	fi
	source "$EMSDK_ENV"
fi
echo "emcc: $(emcc --version | head -1)"

echo "Initializing submodules..."
cd "$SCRIPT_DIR"
git submodule update --init --recursive
CLIENT_DIR="$LIBCURL_JS_DIR/client"

echo "Applying build overrides..."
git -C "$LIBCURL_JS_DIR" checkout -- client/build.sh client/tools/curl.sh client/libcurl/http.c client/fragments/load_later.js client/fragments/force_wsproxy.js client/javascript/main.js
patch -p1 -d "$CLIENT_DIR" <"$SCRIPT_DIR/patches/build.patch"
patch -p1 -d "$CLIENT_DIR" <"$SCRIPT_DIR/patches/curl.patch"
patch -p1 -d "$CLIENT_DIR" <"$SCRIPT_DIR/patches/http.patch"
patch -p1 -d "$CLIENT_DIR" <"$SCRIPT_DIR/patches/fragments.patch"

cp "$SCRIPT_DIR/tools/boringssl.sh" "$CLIENT_DIR/tools/boringssl.sh"
cp "$SCRIPT_DIR/tools/zstd.sh" "$CLIENT_DIR/tools/zstd.sh"
cp "$SCRIPT_DIR/tools/all_deps.sh" "$CLIENT_DIR/tools/all_deps.sh"
chmod +x "$CLIENT_DIR/tools/boringssl.sh" "$CLIENT_DIR/tools/zstd.sh" "$CLIENT_DIR/tools/all_deps.sh"

mkdir -p "$CLIENT_DIR/patches"
cp "$SCRIPT_DIR/curl-impersonate/patches/boringssl.patch" "$CLIENT_DIR/patches/boringssl.patch"
cp "$SCRIPT_DIR/curl-impersonate/patches/curl.patch" "$CLIENT_DIR/patches/curl-impersonate.patch"
rm -rf "$CLIENT_DIR/build/curl"
rm -rf "$CLIENT_DIR/build/curl-wasm"

mkdir -p "$CLIENT_DIR/build"
cd "$CLIENT_DIR"
bash tools/all_deps.sh

CACERT_H="$CLIENT_DIR/build/curl-wasm/include/cacert.h"
CACERT_PEM="$CLIENT_DIR/build/cacert.pem"
if [ ! -f "$CACERT_H" ]; then
	if [ ! -f "$CACERT_PEM" ]; then
		wget "https://curl.se/ca/cacert.pem" -O "$CACERT_PEM"
	fi
	python3 tools/gen_cert.py "$CACERT_PEM" >"$CACERT_H"
fi

mkdir -p "$OUT_DIR"
cd "$CLIENT_DIR"
OUT_DIR="$OUT_DIR" bash build.sh release single_file

pnpx --package=typescript tsc --declaration --allowJs --emitDeclarationOnly --ignoreConfig "$OUT_DIR/libcurl_full.mjs"

echo "=== Build complete ==="
echo "Output: $OUT_DIR/libcurl_full.mjs"
