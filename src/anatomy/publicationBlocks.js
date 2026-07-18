const HARD_PUBLICATION_BLOCK_MAP = new Map([
  [
    "concept.soft_tissue.iliopsoas_fascia",
    "iliopsoas_fascia_geometry_pair_anomaly",
  ],
  [
    "concept.soft_tissue.tendon_of_extensor_digitorum_longus",
    "derived_extensor_digitorum_longus_tendon",
  ],
  [
    "concept.soft_tissue.trochanteric_bursa_of_gluteus_medius_muscle",
    "trochanteric_bursa_singular_plural_ambiguity",
  ],
  [
    "concept.soft_tissue.iliocostalis_colli_muscle",
    "iliocostalis_colli_unresolved_laterality",
  ],
]);

export const HARD_PUBLICATION_BLOCKS = Object.freeze({
  get size() {
    return HARD_PUBLICATION_BLOCK_MAP.size;
  },
  get(conceptId) {
    return HARD_PUBLICATION_BLOCK_MAP.get(conceptId);
  },
  has(conceptId) {
    return HARD_PUBLICATION_BLOCK_MAP.has(conceptId);
  },
  keys() {
    return HARD_PUBLICATION_BLOCK_MAP.keys();
  },
  entries() {
    return HARD_PUBLICATION_BLOCK_MAP.entries();
  },
  [Symbol.iterator]() {
    return HARD_PUBLICATION_BLOCK_MAP[Symbol.iterator]();
  },
});

export function publicationBlockForConcept(conceptId) {
  return HARD_PUBLICATION_BLOCK_MAP.get(conceptId) || null;
}
