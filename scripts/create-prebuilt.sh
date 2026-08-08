#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

version="$(node -p "require('./package.json').version")"
sha="$(git rev-parse --short HEAD)"
archive="${OMNIROUTE_PREBUILT_OUTPUT:-dist/omniroute-prebuilt-${version}-${sha}.tar.gz}"
staging_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$staging_dir"
}
trap cleanup EXIT

mkdir -p "$(dirname "$archive")"
rm -f "$archive"

# The release artifact is assembled by the same path used for npm publishing.
# This keeps the PM2 deployment byte-for-byte aligned with the published CLI.
npm ci --no-audit --no-fund
npm run build:release

mkdir -p "$staging_dir"
cp -a dist/. "$staging_dir/"

cat > "$staging_dir/BUILD_INFO" <<INFO
version=$version
sha=$sha
built_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
INFO

test -f "$staging_dir/server.js"
tar -C "$staging_dir" -czf "$archive" .
printf '%s\n' "$archive"
