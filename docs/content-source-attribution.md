# AnatomyQuest Phase-B content sources

Stand: 2026-07-15

This file records attribution and use boundaries for immutable Phase-B source
snapshots. Registering a source does not publish a claim. Every claim still
needs a precise locator and must stay within the source's registered
capability and rights scope.

The deployed machine-readable registry is available at
[`content/v2/sources.json`](../content/v2/sources.json). A
`source_verified_mvp` entry is source- and test-verified but not reviewed by a
human medical expert; it is not intended for medical, diagnostic, or
therapeutic use. Human-reviewed content remains separately identified as
`published`.

## German MeSH 30.0

German MeSH, version 30.0 (December 2025), is provided by ZB MED –
Information Centre for Life Sciences under CC BY 4.0 for the German
translation columns. DOI: <https://doi.org/10.4126/FRL01-006526467>.

Only `PreferredLabelDE` and `SynonymsDE` are in scope. English NLM columns are
excluded. The registered SHA-256 is
`90e2dba833aeae49a05508e24dad974c7c8264c9179427d8a7650beae6028f04`.

## Fascia Nomenclature Committee consensus

Schleip R, Hedley G, Yucesoy CA. *Fascial nomenclature: Update on related
consensus process*. Clinical Anatomy. 2019;32:929–933.
<https://doi.org/10.1002/ca.23423>. The article is licensed under CC BY 4.0.

The registered snapshot is the Europe PMC JATS XML for `PMC6852276`, captured
on 2026-07-15 with SHA-256
`96549999aa132f850aaf89fac4f7b2927537698b0ee3490c70df8de29e98cab3`.
Its registered use is deliberately narrow: the two consensus definitions and
their explicit distinction in the Results section and Tables 1–2. It is not
evidence for any individual fascia's attachment, continuity, content, or
force-transmission role. Because the current claim gate cannot encode that
semantic boundary field by field, this snapshot is registered for
`classification` only and cannot unlock runtime anatomical claims.

## Applied Human Anatomy

Nolan MF, McNamara JP. *Applied Human Anatomy*. Virginia Tech Carilion School
of Medicine and Virginia Tech Publishing; 2022.
<https://doi.org/10.21061/applied-human-anatomy>. Text authored for the book is
licensed under CC BY 4.0. Separately credited photographs, illustrations, and
quotations are excluded from the automated content pipeline.

The registered first-edition PDF (ISBN 978-1-957213-41-5) was captured on
2026-07-15 with SHA-256
`1a4e1695b6857d3c82d06d783eca6c467c35ec186d2257fe49747f7696bd46fd`.

## BodyParts3D

BodyParts3D is provided by the Database Center for Life Science and archived
by the Life Science Database Archive under CC BY 4.0. Required attribution:
“BodyParts3D, © The Database Center for Life Science licensed under CC
Attribution 4.0 International”. License:
<https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>.

The registered BodyParts3D 4.0 IS-A parts list was captured on 2026-07-15 with
SHA-256
`ab7796deedd49205e77f3609a1cb8c53e2bbee14ecb5c9a6ca05227469780513`.
It is used only to propose FMA/BodyParts3D classification crosswalks. It is not
registered as evidence for anatomical learning claims or correctness of the
AnatomyQuest meshes.
