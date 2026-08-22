#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../../.." && pwd)"
blender_bin="${BLENDER_BIN:-blender}"
output_dir="$repo_root/public/art/v3/project-court"
raw_glb="$output_dir/project-court-frame.raw.glb"
dedup_glb="$output_dir/.project-court-frame.dedup.glb"
final_glb="$output_dir/project-court-frame.glb"
report_json="$output_dir/project-court-frame.report.json"
blend_file="$repo_root/art/blender/project_court_frame.blend"

mkdir -p "$output_dir"

"$blender_bin" --background --factory-startup \
  --python "$repo_root/art/blender/project_court_frame.py" -- \
  --output "$raw_glb" \
  --blend "$blend_file"

if [[ ! -s "$raw_glb" ]]; then
  echo "Blender did not produce $raw_glb" >&2
  exit 1
fi

# Preserve the authored hierarchy and stable LOD/socket node names. The generic
# optimize preset flattens the very contract the runtime relies upon.
npx --yes @gltf-transform/cli@4.2.1 dedup "$raw_glb" "$dedup_glb"
npx --yes @gltf-transform/cli@4.2.1 meshopt \
  "$dedup_glb" "$final_glb" \
  --level high \
  --quantization-volume mesh \
  --quantize-color 8 \
  --quantize-normal 10 \
  --quantize-position 14

node "$repo_root/scripts/art/v3/inspect-project-court.mjs" \
  "$final_glb" --json "$report_json"

for generated_intermediate in "$raw_glb" "$dedup_glb"; do
  if [[ -f "$generated_intermediate" ]]; then
    unlink "$generated_intermediate"
  fi
done
