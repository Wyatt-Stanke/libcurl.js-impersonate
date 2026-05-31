#!/bin/bash
set -ex

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$SCRIPT_DIR/build"
cd "$SCRIPT_DIR/build"

ZSTD_VERSION="1.5.7"

if [ ! -d "zstd" ]; then
	git clone --depth 1 --branch "v${ZSTD_VERSION}" "https://github.com/facebook/zstd.git"
fi

PREFIX="$SCRIPT_DIR/build/zstd-wasm"
rm -rf "$PREFIX"
mkdir -p "$PREFIX/build"

cd "$PREFIX/build"
emcmake cmake "$SCRIPT_DIR/build/zstd/build/cmake" \
	-DCMAKE_INSTALL_PREFIX="$PREFIX" \
	-DCMAKE_BUILD_TYPE=Release \
	-DZSTD_BUILD_SHARED=OFF \
	-DZSTD_BUILD_STATIC=ON \
	-DZSTD_BUILD_PROGRAMS=OFF \
	-DZSTD_BUILD_TESTS=OFF \
	-DZSTD_MULTITHREAD_SUPPORT=OFF

emmake make -j$(nproc --all) install

rm -rf "$PREFIX/build"
cd "$SCRIPT_DIR"
