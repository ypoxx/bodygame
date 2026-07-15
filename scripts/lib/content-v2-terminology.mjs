import fs from "node:fs";
import path from "node:path";

import {
  buildSources,
  readJson,
  ROOT,
} from "./content-v2-foundation.mjs";
import {
  assertConceptClaimSemantics,
  assertReviewedReleaseState,
  collectHumanReviewGates,
  projectPublishedLearning,
} from "./content-v2-publish-gate.mjs";
import { assertValidJsonSchema } from "./json-schema-validator.mjs";

export const TA2_VERSION = "2.07";
export const TA2_EDITION = "2";

export const FIPAT_SOURCE_DEFINITIONS = Object.freeze({
  part2: Object.freeze({
    id: "source.terminology.fipat.ta2_2_07.part_2",
    title: "Terminologia Anatomica, second edition, version 2.07 — Part II",
    part: "Part II: Musculoskeletal system",
    url: "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf",
    sha256: "d30ce0d578b266ce4c47a6ff911e007a0cc440d65e9acaeb0680ec3eafa2231b",
  }),
  part5: Object.freeze({
    id: "source.terminology.fipat.ta2_2_07.part_5",
    title: "Terminologia Anatomica, second edition, version 2.07 — Part V",
    part: "Part V: Sense organs",
    url: "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-5.pdf",
    sha256: "ebda279a51bac4c62221c4539817394c28e3dd99925a06bf57adeeb12abd9e4c",
  }),
});

export const TERMINOLOGY_PATHS = Object.freeze({
  selectedTerms: "content/v2/terminology/ta2-2.07-selected-primary-terms.json",
  curatedConcepts: "content/v2/curated/concepts.json",
  curatedSources: "content/v2/curated/sources.json",
  releaseStates: "content/v2/curated/release-states.json",
  concepts: "content/v2/concepts/terminology.json",
  sources: "content/v2/sources.json",
  catalog: "content/v2/catalog.json",
  terminologyReview: "content/v2/reviews/terminology.json",
  classificationReview: "content/v2/reviews/classification.json",
  anatomyReview: "content/v2/reviews/anatomy.json",
  localizationReview: "content/v2/reviews/localization.json",
  meshMappingReview: "content/v2/reviews/mesh-mapping.json",
  runtimeIndex: "content/v2/runtime-index.json",
});

export const CURATED_CONCEPT_FIELDS = Object.freeze([
  "names",
  "summary",
  "claims",
  "details",
  "notApplicableFields",
  "relations",
  "editorialStatus",
  "evidenceStatus",
]);

export const EXPECTED_TERMINOLOGY_COUNTS = Object.freeze({
  concepts: 496,
  instances: 946,
  officialConcepts: 495,
  officialInstances: 944,
  derivedConcepts: 1,
  derivedInstances: 2,
  selectedTerms: 424,
  methods: Object.freeze({
    exact_v2_07: 392,
    series_variant: 90,
    reviewed_alias: 12,
    mesh_typo: 1,
    derived_structure: 1,
  }),
});

// The PDF table uses tightly spaced columns. These seven rows wrap the first
// English-UK word left of the extractor boundary. Values are reconstructed
// only for the English-UK primary field and remain explicitly marked below.
export const PRIMARY_ENGLISH_UK_RECONSTRUCTIONS = Object.freeze({
  1448: "Talus",
  1468: "Calcaneus",
  1484: "Navicular bone",
  1486: "Medial cuneiform bone",
  1487: "Intermediate cuneiform bone",
  1488: "Lateral cuneiform bone",
  1489: "Cuboid bone",
});

const ORDINALS = Object.freeze({
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
  sixth: "6",
  seventh: "7",
  eighth: "8",
  ninth: "9",
  tenth: "10",
  eleventh: "11",
  twelfth: "12",
});

const TYPE_BY_LEGACY_TISSUE = Object.freeze({
  muscle: "type.muscle",
  fascia: "type.fascia",
  fascial_tract: "type.fascial_tract",
  fascial_arch: "type.fascial_arch",
  fascial_septum: "type.fascial_septum",
  synovial_bursa: "type.synovial_bursa",
  tendon_sheath: "type.tendon_sheath",
  tendon: "type.tendon",
  ligament: "type.ligament",
  retinaculum: "type.retinaculum",
  aponeurosis: "type.aponeurosis",
  capsule: "type.capsule",
  tendinous_structure: "type.tendinous_structure",
  muscle_trochlea: "type.muscle_trochlea",
  eyelid_tarsus: "type.eyelid_tarsus",
});

const ALIAS_DECISIONS = Object.freeze({
  "Atlas (C1)": Object.freeze({
    termId: 1038,
    method: "series_variant",
    reasonCode: "asset_parenthetical_qualifier",
    qualifiers: [{ kind: "vertebral_level", value: "C1" }],
  }),
  "Axis (C2)": Object.freeze({
    termId: 1050,
    method: "series_variant",
    reasonCode: "asset_parenthetical_qualifier",
    qualifiers: [{ kind: "vertebral_level", value: "C2" }],
  }),
  "Vertebra C7": Object.freeze({
    termId: 1057,
    method: "reviewed_alias",
    reasonCode: "official_wording_update",
    qualifiers: [{ kind: "vertebral_level", value: "C7" }],
  }),
  "Vertebra T1": Object.freeze({
    termId: 1063,
    method: "reviewed_alias",
    reasonCode: "official_wording_update",
    qualifiers: [{ kind: "vertebral_level", value: "T1" }],
  }),
  Talus: Object.freeze({
    termId: 1448,
    method: "reviewed_alias",
    reasonCode: "official_column_wrap_reconstruction",
  }),
  Calcaneus: Object.freeze({
    termId: 1468,
    method: "reviewed_alias",
    reasonCode: "official_column_wrap_reconstruction",
  }),
  "Navicular bone": Object.freeze({
    termId: 1484,
    method: "reviewed_alias",
    reasonCode: "official_column_wrap_reconstruction",
  }),
  "Medial cuneiform bone": Object.freeze({
    termId: 1486,
    method: "reviewed_alias",
    reasonCode: "official_column_wrap_reconstruction",
  }),
  "Intermediate cuneiform bone": Object.freeze({
    termId: 1487,
    method: "reviewed_alias",
    reasonCode: "official_column_wrap_reconstruction",
  }),
  "Lateral cuneiform bone": Object.freeze({
    termId: 1488,
    method: "reviewed_alias",
    reasonCode: "official_column_wrap_reconstruction",
  }),
  "Cuboid bone": Object.freeze({
    termId: 1489,
    method: "reviewed_alias",
    reasonCode: "official_column_wrap_reconstruction",
  }),
  "Tendon sheath - abd. pollicis longus - ext. pollicis brevis": Object.freeze({
    termId: 2577,
    method: "reviewed_alias",
    reasonCode: "asset_abbreviation",
  }),
  "Subfacial prepatellar bursa": Object.freeze({
    termId: 2736,
    method: "mesh_typo",
    reasonCode: "corrected_asset_typo",
  }),
  "Tendon sheath of tibialis anterior": Object.freeze({
    termId: 2756,
    method: "reviewed_alias",
    reasonCode: "official_wording_update",
  }),
  "Trochanteric bursa of gluteus medius muscle": Object.freeze({
    termId: 2725,
    method: "reviewed_alias",
    status: "expert_review_required",
    reasonCode: "singular_asset_for_plural_official_term",
  }),
});

export function normalizePrimaryValue(value) {
  return value
    .normalize("NFKC")
    .replace(/[‐‑–—]/g, "-")
    .replace(/-\s+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTermLabel(value) {
  return normalizePrimaryValue(value)
    .toLocaleLowerCase("en")
    .replace(/^\((.*)\)$/, "$1")
    .trim();
}

function sourceIdForPart(sourcePart) {
  const source = FIPAT_SOURCE_DEFINITIONS[sourcePart];
  if (!source) {
    throw new Error(`Unsupported official TA2 source part '${sourcePart}'`);
  }
  return source.id;
}

function officialField(value, sourcePart, sourcePage, termId, column) {
  return {
    value: normalizePrimaryValue(value),
    sourceRef: {
      sourceId: sourceIdForPart(sourcePart),
      locator: {
        kind: "pdf_term_row",
        pdfPage: sourcePage,
        termId,
        column,
      },
    },
  };
}

export function registryTermFromExtractedRow(row) {
  const reconstructedEnglish = PRIMARY_ENGLISH_UK_RECONSTRUCTIONS[row.termId];
  const englishUk = reconstructedEnglish || row.englishUk;
  if (!Number.isInteger(row.termId) || row.termId < 1) {
    throw new Error(`Invalid official TA2 term id '${row.termId}'`);
  }
  if (!row.latin || !englishUk || !Number.isInteger(row.sourcePage)) {
    throw new Error(`TA2 ${row.termId} is missing a required primary field or locator`);
  }
  return {
    termId: row.termId,
    edition: TA2_EDITION,
    version: TA2_VERSION,
    fields: {
      latin: officialField(row.latin, row.sourcePart, row.sourcePage, row.termId, "latin"),
      englishUk: officialField(englishUk, row.sourcePart, row.sourcePage, row.termId, "english_uk"),
    },
    extractionStatus: reconstructedEnglish
      ? "agent_reconstructed_column_wrap"
      : "direct_primary_columns",
  };
}

function seriesDecision(label) {
  let match;

  match = label.match(/^Costal cartilage of (\w+) rib$/);
  if (match && ORDINALS[match[1]]) {
    return {
      termId: 1140,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "rib_number", value: ORDINALS[match[1]] }],
    };
  }

  match = label.match(/^(Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth) rib$/);
  if (match) {
    return {
      termId: 1118,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "rib_number", value: ORDINALS[match[1].toLowerCase()] }],
    };
  }

  match = label.match(/^(First|Second|Fourth|Fifth) metacarpal bone$/);
  if (match) {
    return {
      termId: 1265,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "bone_number", value: ORDINALS[match[1].toLowerCase()] }],
    };
  }

  match = label.match(/^(Second|Third|Fourth) metatarsal bone$/);
  if (match) {
    return {
      termId: 1496,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "bone_number", value: ORDINALS[match[1].toLowerCase()] }],
    };
  }

  match = label.match(/^(Proximal|Middle|Distal) phalanx of (first|second|third|fourth|fifth) finger of (hand|foot)$/);
  if (match) {
    const ids = {
      hand: { Proximal: 1277, Middle: 1278, Distal: 1279 },
      foot: { Proximal: 1510, Middle: 1511, Distal: 1512 },
    };
    return {
      termId: ids[match[3]][match[1]],
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "digit_number", value: ORDINALS[match[2]] }],
    };
  }

  match = label.match(/^(Upper|Lower) (medial|lateral) incisor$/);
  if (match) {
    return {
      termId: 906,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [
        { kind: "jaw", value: match[1].toLowerCase() },
        { kind: "tooth_position", value: match[2] },
      ],
    };
  }

  match = label.match(/^(Upper|Lower) canine$/);
  if (match) {
    return {
      termId: 907,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "jaw", value: match[1].toLowerCase() }],
    };
  }

  match = label.match(/^(Upper|Lower) (first|second) premolar$/);
  if (match) {
    return {
      termId: 909,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [
        { kind: "jaw", value: match[1].toLowerCase() },
        { kind: "tooth_position", value: match[2] },
      ],
    };
  }

  match = label.match(/^(Upper|Lower) (first|second) molar tooth$/);
  if (match) {
    return {
      termId: 910,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [
        { kind: "jaw", value: match[1].toLowerCase() },
        { kind: "tooth_position", value: match[2] },
      ],
    };
  }

  match = label.match(/^Vertebra C([3-5])$/);
  if (match) {
    return {
      termId: 1032,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "vertebral_level", value: `C${match[1]}` }],
    };
  }

  match = label.match(/^Vertebra T([2-9]|1[0-2])$/);
  if (match) {
    return {
      termId: 1059,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "vertebral_level", value: `T${match[1]}` }],
    };
  }

  match = label.match(/^Vertebra L([1-5])$/);
  if (match) {
    return {
      termId: 1068,
      method: "series_variant",
      reasonCode: "series_member_not_individually_numbered",
      qualifiers: [{ kind: "vertebral_level", value: `L${match[1]}` }],
    };
  }

  return null;
}

function termIndex(terms) {
  const byId = new Map();
  const byEnglish = new Map();
  for (const term of terms) {
    if (byId.has(term.termId)) {
      throw new Error(`Duplicate selected TA2 term id ${term.termId}`);
    }
    byId.set(term.termId, term);
    const key = normalizeTermLabel(term.fields.englishUk.value);
    const matches = byEnglish.get(key) || [];
    matches.push(term);
    byEnglish.set(key, matches);
  }
  return { byId, byEnglish };
}

export function resolveConceptDecision(label, terms) {
  if (label === "Tendon of extensor digitorum longus") {
    return {
      method: "derived_structure",
      status: "expert_review_required",
      reasonCode: "derived_not_enumerated",
      derivedFromTermId: 2645,
      targetConceptId: "concept.soft_tissue.extensor_digitorum_longus",
      qualifiers: [],
    };
  }

  const alias = ALIAS_DECISIONS[label];
  if (alias) {
    return {
      ...alias,
      status: alias.status || "agent_reviewed",
      qualifiers: alias.qualifiers || [],
    };
  }

  const series = seriesDecision(label);
  if (series) {
    return { ...series, status: "agent_reviewed" };
  }

  const { byEnglish } = termIndex(terms);
  const matches = byEnglish.get(normalizeTermLabel(label)) || [];
  if (matches.length !== 1) {
    throw new Error(
      `Expected one official English-UK match for '${label}', found ${matches.length}`,
    );
  }
  return {
    termId: matches[0].termId,
    method: "exact_v2_07",
    status: "machine_verified",
    reasonCode: "exact_primary_label",
    qualifiers: [],
  };
}

export function selectedTermIdsForConcepts(concepts, terms) {
  const ids = new Set();
  for (const concept of concepts) {
    const decision = resolveConceptDecision(concept.workingLabel, terms);
    ids.add(decision.termId || decision.derivedFromTermId);
  }
  return [...ids].sort((a, b) => a - b);
}

function assetSourceRef(concept, instanceById) {
  const instances = concept.instanceIds.map((id) => instanceById.get(id));
  if (instances.some((instance) => !instance)) {
    throw new Error(`Concept '${concept.id}' references a missing instance`);
  }
  const sourceIds = new Set(instances.map((instance) => instance.sourceId));
  if (sourceIds.size !== 1) {
    throw new Error(`Concept '${concept.id}' spans multiple asset sources`);
  }
  return {
    sourceId: instances[0].sourceId,
    locator: `Exact glTF mesh-node name(s): ${instances.map((instance) => instance.meshName).join(" | ")}`,
  };
}

function classifyConcept(concept, legacyById) {
  if (concept.assetGroup === "skeleton") {
    if (/cartilage/i.test(concept.workingLabel)) return "type.cartilage";
    if (/(?:incisor|canine|premolar|molar tooth)/i.test(concept.workingLabel)) return "type.tooth";
    if (/^(?:Anterior|Middle|Posterior) cells of ethmoid bone$|^Sinus of /i.test(concept.workingLabel)) {
      return "type.cavity";
    }
    return "type.bone";
  }

  const tissueTypes = new Set(
    concept.instanceIds.map((id) => {
      const legacy = legacyById.get(id);
      if (!legacy) throw new Error(`Missing legacy entry '${id}'`);
      return legacy.tissueType;
    }),
  );
  if (tissueTypes.size !== 1) {
    throw new Error(`Concept '${concept.id}' has inconsistent legacy tissue types`);
  }
  const [legacyType] = tissueTypes;
  const typeId = TYPE_BY_LEGACY_TISSUE[legacyType];
  if (!typeId) {
    throw new Error(`Concept '${concept.id}' has unsupported legacy type '${legacyType}'`);
  }
  return typeId;
}

function copyOfficialTerm(term) {
  return {
    termId: term.termId,
    fields: {
      latin: term.fields.latin,
      englishUk: term.fields.englishUk,
    },
  };
}

export function buildTerminologyConcepts({ concepts, instances, legacyStructures, terms }) {
  const { byId } = termIndex(terms);
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
  const legacyById = new Map(legacyStructures.map((entry) => [entry.id, entry]));

  return concepts.map((concept) => {
    const decision = resolveConceptDecision(concept.workingLabel, terms);
    const assetRef = assetSourceRef(concept, instanceById);
    const officialId = decision.termId || decision.derivedFromTermId;
    const official = byId.get(officialId);
    if (!official) {
      throw new Error(`Concept '${concept.id}' references unregistered official TA2 ${officialId}`);
    }

    const match = {
      method: decision.method,
      status: decision.status,
      inputLabel: concept.workingLabel,
      reasonCode: decision.reasonCode,
    };

    const terminology = decision.method === "derived_structure"
      ? {
          system: "FIPAT_TA2",
          edition: TA2_EDITION,
          version: TA2_VERSION,
          status: "derived_structure",
          derivedFrom: {
            relation: "tendon_of",
            targetConceptId: decision.targetConceptId,
            officialTerm: copyOfficialTerm(official),
            assetSourceRef: assetRef,
          },
          match,
        }
      : {
          system: "FIPAT_TA2",
          edition: TA2_EDITION,
          version: TA2_VERSION,
          status: "official_base",
          baseTerm: copyOfficialTerm(official),
          qualifiers: decision.qualifiers.map((qualifier) => ({
            ...qualifier,
            sourceRef: assetRef,
          })),
          match,
        };

    return {
      ...concept,
      classification: {
        anatomicalTypeId: classifyConcept(concept, legacyById),
        regionIds: ["region.unresolved"],
        status: "partial",
        reviewStatus: "machine_inferred_from_asset_label",
        method: "legacy_asset_label_taxonomy",
        sourceRefs: [assetRef],
      },
      terminology,
      editorialStatus: "draft",
      evidenceStatus: "partial",
    };
  });
}

export function mergeCuratedConcepts(generatedConcepts, curatedPatches) {
  const generatedById = new Map(generatedConcepts.map((concept) => [concept.id, concept]));
  const patchIds = new Set();
  for (const patch of curatedPatches) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new Error("Curated concept patches must be objects");
    }
    const { conceptId } = patch;
    if (patchIds.has(conceptId)) {
      throw new Error(`Duplicate curated concept patch '${conceptId}'`);
    }
    patchIds.add(conceptId);
    if (!generatedById.has(conceptId)) {
      throw new Error(`Curated concept patch targets missing concept '${conceptId}'`);
    }
    for (const key of Object.keys(patch)) {
      if (key !== "conceptId" && !CURATED_CONCEPT_FIELDS.includes(key)) {
        throw new Error(`Curated concept patch '${conceptId}' cannot override generated field '${key}'`);
      }
    }
  }

  const patchById = new Map(curatedPatches.map((patch) => [patch.conceptId, patch]));
  return generatedConcepts.map((concept) => {
    const patch = patchById.get(concept.id);
    if (!patch) return concept;
    const editorial = Object.fromEntries(
      CURATED_CONCEPT_FIELDS
        .filter((field) => Object.prototype.hasOwnProperty.call(patch, field))
        .map((field) => [field, patch[field]]),
    );
    const merged = { ...concept, ...editorial };
    assertConceptClaimSemantics(merged);
    return merged;
  });
}

export function mergeCuratedSources(baseSources, curatedSources) {
  const ids = new Set(baseSources.map((source) => source.id));
  for (const source of curatedSources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error("Curated sources must be objects");
    }
    if (ids.has(source.id)) throw new Error(`Duplicate registered source '${source.id}'`);
    if (source.sourceType === "asset") {
      throw new Error(`Curated source '${source.id}' cannot replace or extend generator-owned assets`);
    }
    if (!source.snapshot?.sha256) {
      throw new Error(`Curated source '${source.id}' needs a pinned snapshot hash`);
    }
    ids.add(source.id);
  }
  return [...baseSources, ...curatedSources];
}

export function buildTerminologySources(curatedSources = []) {
  const fipatLicense = {
    id: "FIPAT-TA2-INDIVIDUAL-TERMS-PUBLIC-DOMAIN",
    url: "https://libraries.dal.ca/Fipat/ta2.html",
    attributionPath: "docs/learning-mode-plan.md",
  };
  const baseSources = [
    ...buildSources(),
    ...Object.values(FIPAT_SOURCE_DEFINITIONS).map((source) => ({
      id: source.id,
      sourceType: "terminology",
      title: source.title,
      provider: "Federative International Programme for Anatomical Terminology (FIPAT)",
      url: source.url,
      version: `TA2 second edition ${TA2_VERSION}`,
      rightsPolicy: "terminology_only",
      license: fipatLicense,
      supports: ["terminology", "classification"],
      document: {
        mediaType: "application/pdf",
        sha256: source.sha256,
        part: source.part,
        locatorBasis: "1-based PDF page + TA2 term row + language column",
      },
    })),
  ];
  return mergeCuratedSources(baseSources, curatedSources);
}

export function buildTerminologyCatalog() {
  return {
    $schema: "../schemas/v2/catalog.schema.json",
    schemaVersion: 2,
    catalogId: "anatomyquest.content.v2",
    stage: "content_migration",
    legacySnapshot: "legacy-snapshot.json",
    collections: {
      instances: {
        path: "instances.json",
        itemSchema: "../schemas/v2/instance.schema.json",
      },
      concepts: [
        {
          path: "concepts/terminology.json",
          itemSchema: "../schemas/v2/concept.schema.json",
          status: "draft",
        },
      ],
      curatedConcepts: {
        path: "curated/concepts.json",
        itemSchema: "../schemas/v2/concept-patch.schema.json",
        status: "draft",
      },
      sources: {
        path: "sources.json",
        itemSchema: "../schemas/v2/source.schema.json",
      },
      curatedSources: {
        path: "curated/sources.json",
        itemSchema: "../schemas/v2/source.schema.json",
        status: "draft",
      },
      releaseStates: {
        path: "curated/release-states.json",
        itemSchema: "../schemas/v2/release-state.schema.json",
        status: "draft",
      },
      terminology: {
        path: "terminology/ta2-2.07-selected-primary-terms.json",
        itemSchema: "../schemas/v2/ta2-term.schema.json",
        status: "draft",
      },
      runtimeIndex: {
        path: "runtime-index.json",
        itemSchema: "../schemas/v2/runtime-index-entry.schema.json",
        status: "draft",
      },
    },
    taxonomies: {
      regions: "taxonomy/regions.json",
      anatomicalTypes: "taxonomy/anatomical-types.json",
      relationTypes: "taxonomy/relation-types.json",
    },
    reviews: [
      "reviews/terminology.json",
      "reviews/classification.json",
      "reviews/anatomy.json",
      "reviews/localization.json",
      "reviews/mesh-mapping.json",
    ],
  };
}

function compactOfficialFields(officialTerm) {
  return {
    latin: officialTerm.fields.latin.value,
    englishUk: officialTerm.fields.englishUk.value,
    sourceRefs: {
      latin: officialTerm.fields.latin.sourceRef,
      englishUk: officialTerm.fields.englishUk.sourceRef,
    },
  };
}

export function buildRuntimeIndex(instances, terminologyConcepts, gates = {}) {
  const publicationGates = {
    sourceById: gates.sourceById || new Map(),
    acceptedAnatomyByClaim: gates.acceptedAnatomyByClaim || new Map(),
    acceptedLocalizationByConcept: gates.acceptedLocalizationByConcept || new Map(),
    releaseStateByConcept: gates.releaseStateByConcept || new Map(),
    instanceById: gates.instanceById || new Map(instances.map((instance) => [instance.id, instance])),
    typeIds: gates.typeIds,
    regionIds: gates.regionIds,
  };
  const conceptById = new Map(terminologyConcepts.map((concept) => [concept.id, concept]));
  return instances.map((instance) => {
    const concept = conceptById.get(instance.conceptId);
    if (!concept) throw new Error(`Runtime instance '${instance.id}' has no terminology concept`);
    const base = {
      id: instance.id,
      conceptId: instance.conceptId,
      meshName: instance.meshName,
      side: instance.side,
      renderGroup: instance.renderGroup,
      classification: {
        typeId: concept.classification.anatomicalTypeId,
        status: concept.classification.status,
        reviewStatus: concept.classification.reviewStatus,
        method: concept.classification.method,
      },
    };
    const learning = projectPublishedLearning(concept, publicationGates, instance.id);
    if (learning) base.learning = learning;
    if (concept.terminology.status === "official_base") {
      return {
        ...base,
        terminology: {
          status: "official_base",
          baseTermId: concept.terminology.baseTerm.termId,
          official: compactOfficialFields(concept.terminology.baseTerm),
          qualifiers: concept.terminology.qualifiers.map(({ kind, value }) => ({ kind, value })),
          matchMethod: concept.terminology.match.method,
          matchStatus: concept.terminology.match.status,
        },
      };
    }
    return {
      ...base,
      terminology: {
        status: "derived_structure",
        relatedTermId: concept.terminology.derivedFrom.officialTerm.termId,
        relatedOfficial: compactOfficialFields(concept.terminology.derivedFrom.officialTerm),
        relation: concept.terminology.derivedFrom.relation,
        matchMethod: concept.terminology.match.method,
        matchStatus: concept.terminology.match.status,
      },
    };
  });
}

function buildPendingReview(reviewArea, id, notes) {
  return {
    schemaVersion: 2,
    reviewArea,
    status: "in_progress",
    records: [
      {
        id,
        targetType: "catalog",
        targetId: "anatomyquest.content.v2",
        status: "needs_review",
        notes,
      },
    ],
  };
}

export function buildTerminologyOutputs() {
  const concepts = readJson("content/v2/concepts/stubs.json");
  const instances = readJson("content/v2/instances.json");
  const legacyStructures = readJson("content/structures.json");
  const terms = readJson(TERMINOLOGY_PATHS.selectedTerms);
  const curatedConcepts = readJson(TERMINOLOGY_PATHS.curatedConcepts);
  const curatedSources = readJson(TERMINOLOGY_PATHS.curatedSources);
  const releaseStates = readJson(TERMINOLOGY_PATHS.releaseStates);
  if (
    !Array.isArray(curatedConcepts) ||
    !Array.isArray(curatedSources) ||
    !Array.isArray(releaseStates)
  ) {
    throw new Error("Curated concept, source and release-state layers must be JSON arrays");
  }
  const conceptPatchSchema = readJson("content/schemas/v2/concept-patch.schema.json");
  const sourceSchema = readJson("content/schemas/v2/source.schema.json");
  const releaseStateSchema = readJson("content/schemas/v2/release-state.schema.json");
  curatedConcepts.forEach((patch, index) => {
    assertValidJsonSchema(conceptPatchSchema, patch, `${TERMINOLOGY_PATHS.curatedConcepts}[${index}]`);
  });
  curatedSources.forEach((source, index) => {
    assertValidJsonSchema(sourceSchema, source, `${TERMINOLOGY_PATHS.curatedSources}[${index}]`);
  });
  releaseStates.forEach((releaseState, index) => {
    assertValidJsonSchema(
      releaseStateSchema,
      releaseState,
      `${TERMINOLOGY_PATHS.releaseStates}[${index}]`,
    );
  });

  const generatedConcepts = buildTerminologyConcepts({
    concepts,
    instances,
    legacyStructures,
    terms,
  });
  const terminologyConcepts = mergeCuratedConcepts(generatedConcepts, curatedConcepts);
  const sources = buildTerminologySources(curatedSources);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const conceptById = new Map(terminologyConcepts.map((concept) => [concept.id, concept]));
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
  const releaseStateByConcept = new Map(
    releaseStates.map((releaseState) => [releaseState.conceptId, releaseState]),
  );
  if (releaseStateByConcept.size !== releaseStates.length) {
    throw new Error("Curated anatomical release states must have unique concept ids");
  }
  const typeIds = new Set(
    readJson("content/v2/taxonomy/anatomical-types.json").values.map((entry) => entry.id),
  );
  const regionIds = new Set(
    readJson("content/v2/taxonomy/regions.json").values.map((entry) => entry.id),
  );
  for (const releaseState of releaseStates) {
    const concept = conceptById.get(releaseState.conceptId);
    if (!concept) throw new Error(`Release state targets missing concept '${releaseState.conceptId}'`);
    assertReviewedReleaseState({
      concept,
      releaseState,
      sourceById,
      instanceById,
      typeIds,
      regionIds,
    });
  }
  const terminologyReview = buildPendingReview(
    "terminology",
    "review.terminology.phase_b_independent_check",
    "Exact and rule-based TA2 2.07 mappings are source-bound; independent terminology review remains pending.",
  );
  const classificationReview = buildPendingReview(
    "classification",
    "review.classification.phase_b_independent_check",
    "Anatomical types are machine-inferred only from deterministic legacy asset-label taxonomy; TA2 does not substantiate these type assignments and expert anatomical review remains pending.",
  );
  const reviewGates = collectHumanReviewGates([
    terminologyReview,
    classificationReview,
    readJson(TERMINOLOGY_PATHS.anatomyReview),
    readJson(TERMINOLOGY_PATHS.localizationReview),
    readJson(TERMINOLOGY_PATHS.meshMappingReview),
  ]);
  const runtimeIndex = buildRuntimeIndex(instances, terminologyConcepts, {
    sourceById,
    releaseStateByConcept,
    instanceById,
    typeIds,
    regionIds,
    ...reviewGates,
  });

  return new Map([
    [TERMINOLOGY_PATHS.concepts, terminologyConcepts],
    [TERMINOLOGY_PATHS.runtimeIndex, runtimeIndex],
    [TERMINOLOGY_PATHS.sources, sources],
    [TERMINOLOGY_PATHS.catalog, buildTerminologyCatalog()],
    [TERMINOLOGY_PATHS.terminologyReview, terminologyReview],
    [TERMINOLOGY_PATHS.classificationReview, classificationReview],
  ]);
}

export function selectedTermsExist() {
  return fs.existsSync(path.join(ROOT, TERMINOLOGY_PATHS.selectedTerms));
}
