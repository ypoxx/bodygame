# Mobile 3D asset pipeline

`assets/skeleton.glb` and `assets/muscles.glb` remain the immutable production
inputs. The pipeline never overwrites them. Rebuild the derived LOD assets with:

```sh
bash scripts/build-mobile-lods.sh
```

Requirements: Blender 5.x and Python 3 with Pillow. The script verifies both
input SHA-256 hashes before processing, exports Draco-compressed GLBs, reimports
each result, checks object names/bounds/triangle counts and creates deterministic
front-view comparison renders plus numeric image-difference reports.

## Accepted LOD1 outputs

| Asset | Production | Mobile LOD1 | Triangles | File size | Preview PSNR |
| --- | ---: | ---: | ---: | ---: | ---: |
| Skeleton | 598,525 | 346,879 | 57.96% | 1.8 MB → 1.1 MB | 49.23 dB |
| Muscles | 2,137,457 | 758,897 | 35.50% | 4.8 MB → 1.8 MB | 43.84 dB |

Object names, mesh/object counts and hierarchy remain available after reimport,
so quiz selection can continue to address anatomy by name. Bounding-box drift is
below 0.7 mm. Draw calls are intentionally unchanged because merging structures
would remove the current per-structure picking boundary.

## Triangle-soup handling

`External abdominal oblique muscle` and `Multifidus thoracis muscle` contain
disconnected vertices with distinct corner normals. A render-exact weld is
therefore rejected automatically and the source mesh is restored. Only while
building the approximate LOD does the pipeline:

1. verify the position/material surface set,
2. weld duplicate positions without collapsing a triangle edge,
3. permit regenerated normals,
4. decimate the resulting topology.

For `Multifidus thoracis muscle`, one coincident duplicate triangle is collapsed;
the unique geometric surface set remains unchanged. Full details are recorded in
`reports/muscles.mobile-lod1.v1.json`.

## Master-source status

There is no authoritative `.blend` master in this workspace. The files named
`*.uncompressed.backup.glb` are full-scene exports, not one-to-one uncompressed
masters of the curated production assets:

- muscle backup: 1,423 objects / 996,589 instantiated triangles / 1.90 × 2.00 × 2.71 m
- skeleton backup: 5,406 objects / 10,293,966 instantiated triangles / 7.10 × 1.03 × 1.83 m

The current reproducibility boundary therefore starts at the hash-pinned
production GLBs. Before editing high-resolution anatomy, obtain and commit or
externally version an authoritative upstream Blender source, record its upstream
revision and license, then export new production GLBs and update the manifest.

See `assets/ATTRIBUTION.md` for the required provenance and ShareAlike notice.
