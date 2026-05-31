#!/bin/bash
set -ex
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$SCRIPT_DIR/build"

for dep in \
	"boringssl-wasm:boringssl" \
	"cjson-wasm:cjson" \
	"zlib-wasm:zlib" \
	"brotli-wasm:brotli" \
	"zstd-wasm:zstd" \
	"nghttp2-wasm:nghttp2" \
	"curl-wasm:curl"; do
	prefix="${dep%%:*}"
	script="${dep##*:}"
	[ ! -d "$SCRIPT_DIR/build/$prefix" ] && tools/$script.sh
done

CURL_PREFIX="$SCRIPT_DIR/build/curl-wasm"
for dep in boringssl-wasm cjson-wasm zlib-wasm brotli-wasm zstd-wasm nghttp2-wasm; do
	cp -r "$SCRIPT_DIR/build/$dep"/* "$CURL_PREFIX"
done
