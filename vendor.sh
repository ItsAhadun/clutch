#!/bin/sh
# Fills vendor/ with the speech-to-text libraries offscreen.js loads. MV3 can't run code from the
# web, so they ship inside the extension; they're fetched from npm rather than kept in git.
set -e
tmp=$(mktemp -d)
npm pack --silent --pack-destination "$tmp" @huggingface/transformers@4.3.0 onnxruntime-web@1.31.0-dev.20260914-8d85527a0
mkdir -p "$tmp/t" "$tmp/o" vendor
tar xzf "$tmp"/huggingface-transformers-*.tgz -C "$tmp/t"
tar xzf "$tmp"/onnxruntime-web-*.tgz -C "$tmp/o"
cp "$tmp/t/package/dist/transformers.min.js" "$tmp/t/package/LICENSE" vendor/
cp "$tmp/o/package/dist/ort-wasm-simd-threaded.mjs" "$tmp/o/package/dist/ort-wasm-simd-threaded.wasm" vendor/
rm -rf "$tmp"
