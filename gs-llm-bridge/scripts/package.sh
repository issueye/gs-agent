#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
output_dir=${1:-"$project_root/dist/gs-llm-bridge"}

rm -rf -- "$output_dir"
mkdir -p -- "$output_dir"

tar -C "$project_root" \
  --exclude='./dist' \
  --exclude='./.data' \
  --exclude='./.data-*' \
  -cf - . | tar -C "$output_dir" -xf -

printf 'Packaged gs-llm-bridge to %s\n' "$output_dir"
