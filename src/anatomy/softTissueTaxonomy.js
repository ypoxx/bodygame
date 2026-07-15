/**
 * Shared soft-tissue taxonomy used by both the browser runtime and Node-based
 * content tooling. Keep this module dependency-free so it can be imported in
 * either environment.
 */

export const TISSUE_LABELS_DE = Object.freeze({
  bone: "Knochen",
  muscle: "Muskel",
  fascia: "Faszie",
  fascial_tract: "Faszienzug",
  fascial_arch: "Faszienbogen",
  fascial_septum: "Faszienseptum",
  synovial_bursa: "Schleimbeutel",
  tendon_sheath: "Sehnenscheide",
  tendon: "Sehne",
  ligament: "Band",
  retinaculum: "Retinaculum",
  aponeurosis: "Aponeurose",
  capsule: "Kapsel",
  tendinous_structure: "Sehnenstruktur",
  muscle_trochlea: "Muskelrolle",
  eyelid_tarsus: "Lidplatte",
  unclassified_soft_tissue: "Ungeprüfte Weichteilstruktur",
});

const TA2_SOURCE = "FIPAT_TA2";
const NAME_RULE_SOURCE = "mesh_name_rule";

function classification({
  displayGroup,
  tissueType,
  quizEligible,
  reviewStatus,
  ta2Id = null,
  source,
}) {
  return Object.freeze({
    displayGroup,
    tissueType,
    quizEligible,
    reviewStatus,
    ta2Id,
    source,
  });
}

const CONNECTIVE_REVIEW_REQUIRED = Object.freeze({
  quizEligible: false,
  reviewStatus: "review_required",
});

const EXPLICIT_OVERRIDES = new Map([
  [
    "tensor fasciae latae",
    classification({
      displayGroup: "muscles",
      tissueType: "muscle",
      quizEligible: true,
      reviewStatus: "verified",
      ta2Id: 2602,
      source: TA2_SOURCE,
    }),
  ],
  [
    "linea alba",
    classification({
      displayGroup: "fasciae",
      tissueType: "fascia",
      ...CONNECTIVE_REVIEW_REQUIRED,
      source: TA2_SOURCE,
    }),
  ],
  [
    "iliotibial tract",
    classification({
      displayGroup: "fasciae",
      tissueType: "fascial_tract",
      ...CONNECTIVE_REVIEW_REQUIRED,
      ta2Id: 2690,
      source: TA2_SOURCE,
    }),
  ],
  [
    "iliopectineal arch",
    classification({
      displayGroup: "fasciae",
      tissueType: "fascial_arch",
      ...CONNECTIVE_REVIEW_REQUIRED,
      ta2Id: 2695,
      source: TA2_SOURCE,
    }),
  ],
  [
    "tendinous arch of levator ani",
    classification({
      displayGroup: "fasciae",
      tissueType: "fascial_arch",
      ...CONNECTIVE_REVIEW_REQUIRED,
      ta2Id: 2434,
      source: TA2_SOURCE,
    }),
  ],
  [
    "common tendinous ring",
    classification({
      displayGroup: "fasciae",
      tissueType: "tendinous_structure",
      ...CONNECTIVE_REVIEW_REQUIRED,
      ta2Id: 2047,
      source: TA2_SOURCE,
    }),
  ],
  [
    "trochlea of superior oblique muscle",
    classification({
      displayGroup: "fasciae",
      tissueType: "muscle_trochlea",
      ...CONNECTIVE_REVIEW_REQUIRED,
      ta2Id: 2049,
      source: TA2_SOURCE,
    }),
  ],
  [
    "superior tarsus",
    classification({
      displayGroup: "fasciae",
      tissueType: "eyelid_tarsus",
      ...CONNECTIVE_REVIEW_REQUIRED,
      ta2Id: 6827,
      source: TA2_SOURCE,
    }),
  ],
  [
    "inferior tarsus",
    classification({
      displayGroup: "fasciae",
      tissueType: "eyelid_tarsus",
      ...CONNECTIVE_REVIEW_REQUIRED,
      ta2Id: 6829,
      source: TA2_SOURCE,
    }),
  ],
]);

const CONNECTIVE_RULES = Object.freeze([
  { tissueType: "synovial_bursa", pattern: /\bburs(?:a|ae)\b/ },
  {
    tissueType: "tendon_sheath",
    pattern: /\b(?:tendon|synovial|fibrous)?\s*sheaths?\b/,
  },
  { tissueType: "aponeurosis", pattern: /\baponeuros(?:is|es)\b/ },
  { tissueType: "retinaculum", pattern: /\bretinacul(?:um|a)\b/ },
  { tissueType: "fascial_septum", pattern: /\bsept(?:um|a)\b/ },
  { tissueType: "capsule", pattern: /\bcapsules?\b/ },
  { tissueType: "ligament", pattern: /\bligaments?\b/ },
  { tissueType: "tendon", pattern: /\btend(?:on|ons|inous)\b/ },
  { tissueType: "fascia", pattern: /\b(?:fasciae?|fascial|thoracolumbar)\b/ },
]);

// Some source-mesh names omit the word "muscle". These lexemes identify the
// remaining muscle names in the supplied anatomical model without using a
// blanket "everything else is muscle" fallback.
const MUSCLE_NAME_PATTERN = /\b(?:abductors?|adductors?|bucinator|corrugator|depressors?|diaphragm|extensors?|flexors?|sphincter|constrictor|gastrocnemius|triceps|levators?|levatores|masseter|biceps|obturator|orbicularis|platysma|pronator|psoas|rotatores|supinator)\b/;

/**
 * Normalize a GLB mesh-node name to a side-independent lookup key.
 */
export function normalizeSoftTissueMeshName(meshName) {
  return String(meshName || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/(?:\.[lr]|_[lr]|-\s*[lr]|\s+\([lr]\))$/i, "")
    .replace(/[_.-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Resolve the anatomical source name from a Three.js object. GLTFLoader
 * sanitizes Object3D.name for animation bindings (for example `.l` becomes
 * `l`), but preserves the original glTF node name in userData.name.
 */
export function getSoftTissueNodeName(node) {
  return String(node?.userData?.name || node?.name || "");
}

/**
 * Classify a loaded Three.js node without losing anatomical side suffixes.
 */
export function classifySoftTissueNode(node) {
  return classifySoftTissue(getSoftTissueNodeName(node));
}

/**
 * Classify one mesh-node name into its display group and anatomical tissue
 * type. Unknown names are deliberately quarantined in the broad connective
 * display group and excluded from quizzes until reviewed.
 */
export function classifySoftTissue(meshName) {
  const baseName = normalizeSoftTissueMeshName(meshName);
  const explicit = EXPLICIT_OVERRIDES.get(baseName);
  if (explicit) {
    return { ...explicit };
  }

  for (const rule of CONNECTIVE_RULES) {
    if (rule.pattern.test(baseName)) {
      return {
        displayGroup: "fasciae",
        tissueType: rule.tissueType,
        ...CONNECTIVE_REVIEW_REQUIRED,
        ta2Id: null,
        source: NAME_RULE_SOURCE,
      };
    }
  }

  if (/\bmuscles?\b/.test(baseName) || MUSCLE_NAME_PATTERN.test(baseName)) {
    return {
      displayGroup: "muscles",
      tissueType: "muscle",
      quizEligible: true,
      reviewStatus: "auto_classified",
      ta2Id: null,
      source: NAME_RULE_SOURCE,
    };
  }

  return {
    displayGroup: "fasciae",
    tissueType: "unclassified_soft_tissue",
    quizEligible: false,
    reviewStatus: "review_required",
    ta2Id: null,
    source: "unclassified",
  };
}
