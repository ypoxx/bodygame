#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXPECTED_SKELETON_SHA="ee48ce23d8a068478e42c7d7b722e0b3f8155920a60c5976dfc86e753eb33181"
EXPECTED_MUSCLES_SHA="99f2c7ac0e5fc01658b8432df589d677e1ac2a0b186166b62f72c5760a202396"

verify_sha() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "Source hash mismatch for $file" >&2
    echo "expected: $expected" >&2
    echo "actual:   $actual" >&2
    exit 1
  fi
}

verify_sha assets/skeleton.glb "$EXPECTED_SKELETON_SHA"
verify_sha assets/muscles.glb "$EXPECTED_MUSCLES_SHA"

blender -b --factory-startup --python scripts/blender_asset_pipeline.py -- \
  --input assets/skeleton.glb \
  --output assets/derived/skeleton.mobile-lod1.v2.glb \
  --report assets/derived/reports/skeleton.mobile-lod1.v2.json \
  --preview-before assets/derived/previews/skeleton.production.front.png \
  --preview-after assets/derived/previews/skeleton.mobile-lod1.v2.front.png \
  --collapse-material-slots \
  --lod-ratio 0.58 \
  --min-triangles 100 \
  --position-bits 14 \
  --normal-bits 10 \
  --texcoord-bits 12 \
  --draco-level 10

blender -b --factory-startup --python scripts/blender_asset_pipeline.py -- \
  --input assets/muscles.glb \
  --output assets/derived/muscles.mobile-lod1.v2.glb \
  --report assets/derived/reports/muscles.mobile-lod1.v2.json \
  --preview-before assets/derived/previews/muscles.production.front.png \
  --preview-after assets/derived/previews/muscles.mobile-lod1.v2.front.png \
  --repair-triangle-soup \
  --lod-weld-triangle-soup \
  --collapse-material-slots \
  --lod-ratio 0.35 \
  --min-triangles 400 \
  --position-bits 14 \
  --normal-bits 10 \
  --texcoord-bits 12 \
  --draco-level 10

python3 scripts/compare_asset_previews.py \
  assets/derived/previews/skeleton.production.front.png \
  assets/derived/previews/skeleton.mobile-lod1.v2.front.png \
  --report assets/derived/reports/skeleton.mobile-lod1.v2.visual.json

python3 scripts/compare_asset_previews.py \
  assets/derived/previews/muscles.production.front.png \
  assets/derived/previews/muscles.mobile-lod1.v2.front.png \
  --report assets/derived/reports/muscles.mobile-lod1.v2.visual.json

echo "Mobile LOD assets and validation reports are ready in assets/derived/."
