#!/bin/bash
# Build BoringSSL for WASM using Emscripten.
# Outputs build/boringssl-wasm/ with lib/libssl.a, lib/libcrypto.a, include/

set -ex

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PREFIX="$BUILD_DIR/boringssl-wasm"

CURL_IMPERSONATE_CMAKE="$SCRIPT_DIR/../../curl-impersonate/CMakeLists.txt"
if [ ! -f "$CURL_IMPERSONATE_CMAKE" ]; then
	echo "ERROR: curl-impersonate submodule not found at $CURL_IMPERSONATE_CMAKE"
	echo "Run: git submodule update --init"
	exit 1
fi
BORING_SSL_COMMIT="$(grep 'set(BORING_SSL_COMMIT' "$CURL_IMPERSONATE_CMAKE" | sed 's/.*set(BORING_SSL_COMMIT "\(.*\)".*/\1/')"
if [ -z "$BORING_SSL_COMMIT" ]; then
	echo "ERROR: could not extract BORING_SSL_COMMIT from $CURL_IMPERSONATE_CMAKE"
	exit 1
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

if [ ! -d "boringssl" ]; then
	echo "Downloading BoringSSL $BORING_SSL_COMMIT..."
	GIT_VERSION=$(git --version | awk '{print $3}')
	REQUIRED_VERSION="2.49.0"
	if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$GIT_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
		git clone --depth 1 --revision "$BORING_SSL_COMMIT" \
			"https://github.com/google/boringssl.git" boringssl
	else
		echo 'Please update git!!!!! Please!'
		echo "Your git version $GIT_VERSION is AT LEAST $(( ($(date +%s) - $(date -d "2025-03-14" +%s)) / 86400 )) days old\!"
		sleep 3
		git clone "https://github.com/google/boringssl.git" boringssl
		cd boringssl
		git checkout "$BORING_SSL_COMMIT"
		cd ..
	fi
fi
cd boringssl

PATCH="$SCRIPT_DIR/patches/boringssl.patch"
if [ -f "$PATCH" ] && ! grep -q "curl-impersonate" ssl/ssl_cipher.cc 2>/dev/null; then
	echo "Applying boringssl.patch..."
	patch -p1 <"$PATCH"
fi

# Build BoringSSL for WASM
mkdir -p build
cd build

emcmake cmake \
	-GNinja \
	-DCMAKE_BUILD_TYPE=Release \
	-DBUILD_SHARED_LIBS=OFF \
	-DCMAKE_POSITION_INDEPENDENT_CODE=ON \
	-DOPENSSL_NO_ASM=1 \
	-DCMAKE_C_FLAGS="-Wno-error -Wno-unused-command-line-argument" \
	-DCMAKE_CXX_FLAGS="-Wno-error -Wno-unused-command-line-argument" \
	..

emmake ninja -j$(nproc --all) ssl crypto

# Install into prefix
rm -rf "$PREFIX"
mkdir -p "$PREFIX/lib"
cp ssl/libssl.a "$PREFIX/lib/"
cp crypto/libcrypto.a "$PREFIX/lib/"
cp -r ../include "$PREFIX/"

echo "BoringSSL WASM build complete: $PREFIX"
