# Fascia and connective-tissue audit (mobile v2)

Date: 2026-07-15

## Scope

- `assets/muscles.glb`
- `assets/derived/muscles.mobile-lod1.v2.glb`
- shared runtime/content taxonomy in `src/anatomy/softTissueTaxonomy.js`

The broad UI group is intentionally named **Bindegewebe**. It contains fasciae
and fascia-derived structures, but also bursae, tendon sheaths, tendons,
ligaments, retinacula, aponeuroses, eyelid tarsi and muscle trochleae. These
must not all be described as fasciae.

## Taxonomy result

| Display group / tissue type | Mesh nodes |
| --- | ---: |
| Muscles | 462 |
| Synovial bursae | 78 |
| Fasciae | 39 |
| Tendon sheaths | 26 |
| Retinacula | 18 |
| Fascial septa | 14 |
| Tendons | 6 |
| Ligaments | 6 |
| Aponeuroses | 6 |
| Fascial arches | 4 |
| Eyelid tarsi | 4 |
| Fascial tracts | 2 |
| Tendinous structures | 2 |
| Muscle trochleae | 2 |

All 207 connective-group structures remain explorable. They are marked
`review_required` and `quizEligible: false` until their names and facts have
been curated individually. `Tensor fasciae latae` is explicitly restored to
the muscle group (FIPAT TA2 2602).

## Geometry result

- 207/207 connective-group objects and names are present in production and v2.
- 105 unique meshes resolve to 102 left/right pairs and three midline meshes.
- No empty meshes, missing/null normals, inconsistent winding, isolated
  vertices, loose edges, edges with more than two faces, exact left/right
  overlaps or side swaps were found.
- The v2 material collapse changes only primitive/material grouping. It keeps
  object names, object-to-mesh assignments, geometry signatures, raycasting
  boundaries, vertices, triangles and bounds unchanged before export.
- 166/207 structures have open borders, including 76/78 bursae. They are
  rendered double-sided. Do not close or solidify them automatically without
  anatomical review.

## Mobile visibility and LOD action

At whole-body framing, about 74/207 structures project below 10 px and 136/207
below 24 px. The smallest measured examples are the trochlea of superior
oblique (~1.6 px), common tendinous ring (~2.7 px) and intermediate tendon of
digastric (~3.2 px). Pinch zoom, zoom-to-cursor, automatic focus for tiny
selections and the 22 px touch fallback therefore remain required.

The muscle/soft-tissue LOD now protects every mesh below 400 triangles from
decimation. This preserves the posterior thoracolumbar fascia, linea alba,
common tendinous ring and 23 small bursae. The posterior thoracolumbar fascia no
longer loses two tiny connected components.

## Manual follow-up (do not auto-correct)

- `Iliopsoas fascia.l/.r` is the only left/right pair with a notable residual
  center mismatch after mirroring: about 16 mm lateral and 10.7 mm vertical.
  Confirm against the authoritative source before moving either mesh.
- `Anterior intermuscular septum of leg` is a visually intact triangle soup
  (208 triangles in 208 components, 477 duplicate-position vertices). Weld it
  only if the render signature remains exact.
- The exported mobile `Calcaneal tendon` contains one degenerate triangle per
  shared mesh definition. It is visually insignificant; remove it only through
  a validated post-decimation cleanup.

Terminology reference: FIPAT, *Terminologia Anatomica*, second edition, Part 2.
