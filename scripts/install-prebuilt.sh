#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/install-prebuilt.sh <tarball-path-or-url>" >&2
  exit 2
fi

source_arg="$1"
tmp_dir="$(mktemp -d)"
archive="$tmp_dir/omniroute-prebuilt.tar.gz"
staging_dir="$tmp_dir/dist"
old_dist="$tmp_dir/previous-dist"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

if [[ "$source_arg" =~ ^https?:// ]]; then
  curl -fL "$source_arg" -o "$archive"
else
  cp "$source_arg" "$archive"
fi

mkdir -p "$staging_dir"
tar -xzf "$archive" -C "$staging_dir"
test -f "$staging_dir/server.js"

# Keep the old bundle until the new one has been fully extracted. If the final
# move fails, restore the previous bundle so a failed upgrade does not leave the
# service without a runnable dist/ directory.
if [ -e dist ]; then
  mv dist "$old_dist"
fi
if ! mv "$staging_dir" dist; then
  if [ -e "$old_dist" ]; then
    mv "$old_dist" dist
  fi
  exit 1
fi
rm -rf "$old_dist"

pm2 delete omniroute 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 status omniroute
