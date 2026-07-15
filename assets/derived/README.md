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

## Mobile LOD1 v2 outputs

| Asset | Production triangles | Mobile triangles | Triangle ratio | Instantiated primitives before → v2 |
| --- | ---: | ---: | ---: | ---: |
| Skeleton | 598,525 | 346,879 | 57.96% | 575 → 277 |
| Muscles and fasciae | 2,137,457 | 775,245 | 36.27% | 898 → 669 |

Object names, mesh/object counts and hierarchy remain available after reimport,
so quiz selection can continue to address anatomy by name. The v2 pipeline does
not join anatomical objects. Instead, after LOD generation it assigns all
polygons within each existing mesh to material slot 0 and removes only the
unused slots. This produces one glTF primitive per mesh node while preserving
the picking boundary of every structure.

The pipeline verifies before/after geometry signatures, vertex and triangle
counts, bounds, object-to-mesh assignments and object names before export. It
then reimports the GLB and checks names, object/mesh counts, triangle counts and
the one-primitive-per-node draw structure. `npm run perf:smoke` independently
parses the GLB JSON and asserts 277/277 mesh nodes/instantiated primitives for
the skeleton and 669/669 for the muscles/fascia asset. File sizes and visual
comparison metrics are recorded in the generated `*.v2.json` reports.

For the soft-tissue LOD, meshes below 400 triangles are intentionally protected
from decimation. This keeps tiny quiz-relevant and connective structures such as
the linea alba, common tendinous ring, small bursae and the posterior layer of
the thoracolumbar fascia intact in the mobile asset.

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
`reports/muscles.mobile-lod1.v2.json`.

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
