# AnatomyQuest mobile learning mode — release readiness

Date: 2026-07-15
Scope: mobile-first `Entdecken` experience, content v2 foundation, production GLBs and mobile LOD v2

## Decision

- **Technical preview:** ready.
- **Production as a medically complete learning mode:** blocked.

Latest verified Netlify preview:
`https://6a5797b750b51d736ae6a6e5--anatomyquest-3d.netlify.app`
(deploy `6a5797b750b51d736ae6a6e5`). It was intentionally not promoted to the
production alias.

The current product is an honest terminology explorer. It deliberately hides
unreviewed anatomical learning claims instead of presenting generated copy as
medical content.

## Verified technical state

- 946/946 selectable production mesh instances map exactly to stable content IDs.
- 496 side-neutral concepts cover the 946 concrete instances.
- All 232 muscle concepts and all 462 muscle instances are present in both the
  production model and the mobile LOD. The LOD conversion lost zero selectable
  muscles.
- The asset contains 13 chest concepts / 25 chest meshes and 35 back concepts /
  70 back meshes. Pectoralis major, trapezius and erector spinae are represented
  through their selectable parts rather than redundant parent meshes.
- Browser QA at exact 390×844 and 320×568 mobile viewports loads:
  - `assets/derived/skeleton.mobile-lod1.v2.glb`
  - `assets/derived/muscles.mobile-lod1.v2.glb`
- Physical-device QA has not yet been recorded.
- Mobile v2 has one primitive per selectable node: 277 skeleton and 669
  soft-tissue primitives.
- Estimated draw calls fell from 575 to 277 for the skeleton and from 898 to
  669 for soft tissue: 1,473 to 946 in total, a reduction of about 35.8%.
- Instantiated triangles fell from 2,735,982 to 1,122,124, about 59.0%, while
  the protected soft-tissue floor keeps meshes below 400 triangles intact.
- Front-view comparison against the production assets measures 49.20 dB PSNR
  for the skeleton and 44.17 dB for soft tissue.
- The previously blocking pectoralis selected-state transition completes
  without a stall; the latest loaded 390×844 run completed in about 267 ms. It
  previously exceeded 30 s before the mobile selection fix. This is an
  interaction smoke observation, not a performance benchmark.
- Cause of that stall: first WebGL render of the duplicated geometry outline
  shell. Narrow/coarse-pointer devices now use the existing material color and
  emissive selection treatment without the extra outline draw call.
- At 320×568, the selected-state tool row ends above the learning card and does
  not overlap it. Front/back view and isolation state transitions complete.
- Final 390×844 and 320×568 browser runs reported no console errors or warnings,
  no horizontal overflow and `touch-action: none` on the canvas.
- Pinch zoom remains enabled through `OrbitControls`, two-touch
  `DOLLY_PAN`, zoom-to-cursor and `touch-action: none`; the performance smoke
  test prevents those settings from regressing. A physical two-finger gesture
  on real hardware remains an explicit device-acceptance check.
- Invisible meshes are removed from pointer-raycast candidates while a
  structure is isolated.
- Active bone, muscle and connective-tissue chips now use opaque dark layer
  surfaces with layer-specific text and borders. The selected muscle chip
  reaches about 5.57:1 text contrast in its worst-case compositing calculation.
- The service-worker cache and module URLs were advanced for the selection fix.

## Automated gates

All passed on the production bundle:

- 30/30 v2 data, terminology and publication-gate tests
- 13/13 explore-mode UI/content tests
- 43 passed tests in total; one optional FIPAT import test skipped
- legacy and v2 validators
- deterministic v2 regeneration check
- mobile performance and interaction smoke check
- Netlify bundle build
- `git diff --check`

## Content publication safety

- The Phase-B curation layer, source registry, claim hashes and independent
  review gates are implemented fail-closed.
- Generated IDs, mesh mappings, terminology and classifications cannot be
  overwritten by a curated patch.
- A separate curated release state must cover the resolved classification,
  region, laterality of every instance and human-verified mesh mapping. Each of
  those four state blocks is hash-bound to an independent human review.
- Only `published` runtime payloads with source capability, precise locator,
  immutable source hash and current accepted human-review hashes can reach the
  learning card or search index.
- The registered German MeSH 30.0 snapshot is restricted to the licensed
  German preferred-label and synonym columns. Registration alone publishes no
  German name; a German MeSH reference must use an exact structured
  `DescriptorUI` locator.
- The four known stop-line concepts are explicit hard publication blocks in
  code, not only editorial notes.
- The runtime still contains 946 instances / 496 concepts and intentionally
  contains zero published learning payloads.
- Five sources are registered, but none currently supports
  `anatomical_claims`. No medical claim can therefore pass the publication
  gate until an eligible pinned reference is added.

## Anatomical and editorial blockers

1. Phase B contains no published anatomical learning claims yet. Consequently,
   0/946 instance cards expose sourced summaries or details.
2. `content/v2/reviews/anatomy.json` and
   `content/v2/reviews/localization.json` have not started.
3. The official TA2 audit confirms terminology coverage, not geometry or whole-
   body completeness. A working review classification found 93 individual or
   part terms without a selectable mesh in the source asset. Examples include
   semispinalis capitis and the lumbar part of longissimus thoracis; the largest
   apparent source-asset gaps are in head/neck and pelvis/perineum. This count
   requires expert adjudication before it becomes a product claim.
4. Classification is still explicitly partial and machine-inferred from
   exact source-asset labels. It does not claim anatomical verification.
5. Terminology remains formally `in_progress / needs_review`, although the
   deterministic FIPAT primary-field and locator checks pass. Independent
   terminology review remains pending.
6. `Iliopsoas fascia.l/.r` remains release-blocked because its mirrored pair
   has a notable residual center mismatch.
7. `Trochanteric bursa of gluteus medius muscle` remains release-blocked: the
   singular asset label is not sufficient evidence for the plural TA2 2725
   concept. The possible official name and Latin are hidden until expert and
   geometry review.
8. `Tendon of extensor digitorum longus` is a derived structure without its own
   TA2 entry; `Iliocostalis colli muscle` has two instances with unresolved
   laterality. Both remain release-blocked.
9. The mobile calcaneal-tendon mesh contains one post-decimation degenerate
   triangle per shared mesh definition. It is visually insignificant but must
   be cleaned and re-audited before a zero-geometry-defect release claim.
10. The anterior intermuscular septum of the leg remains a triangle soup; 166 of
   207 connective-tissue instances have open borders, including 76 of 78
   bursae. These must not be closed or solidified automatically.
11. At whole-body framing, 74 of 207 connective-tissue instances project below
   10 px and 136 below 24 px. Focus and touch fallback remain mandatory even
   though pinch zoom is enabled.
12. Four hard-coded vertebral cases — `Atlas (C1)`, `Axis (C2)`, `Vertebra C7`
   and `Vertebra T1` — still need explicit synonym-column decision provenance
   in the schema and review trail.

## Publication rule

Netlify preview deployment is permitted for this technical milestone.
Production promotion remains blocked until every published concept has:

1. FIPAT and eligible localization sources for the complete name block;
2. `preferredLatin` equal to the pinned TA2 primary field;
3. a current name hash and accepted independent `localization_expert` review;
4. resolved, independently accepted classification, region, laterality and
   mesh-mapping release state;
5. a sourced summary and at least one sourced detail field;
6. for every claim, a registered `anatomical_claims` source with an allowed
   runtime-use policy and precise locator;
7. a current claim hash and accepted independent `medical_domain_expert`
   review; and
8. no unresolved terminology, derived terminology or explicit stop-line flag.
