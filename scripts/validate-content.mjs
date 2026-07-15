import fs from "node:fs";
import path from "node:path";
import { PropertyBinding } from "three";
import {
  classifySoftTissue,
  classifySoftTissueNode,
  getSoftTissueNodeName,
} from "../src/anatomy/softTissueTaxonomy.js";

const root = process.cwd();
const schemaPath = path.join(root, "content", "schema.structures.json");
const structuresPath = path.join(root, "content", "structures.json");
const quizDataPath = path.join(root, "quizdata.json");

const HELPER_TOKENS = [
  "how to",
  "navigation",
  "manipulation",
  "selection",
  "stored views",
  "outliner",
  "cross section",
  "sagittal plane",
  "longitudinal plane",
  "display.st",
  "layers.st",
  "colors.st",
  "take a picture",
  "annotation",
  "labels",
  "label",
  "caption",
  "text",
];

const TAXONOMY_REGRESSION_CASES = [
  ["Tensor fasciae latae.l", "muscles", "muscle", true, "verified", 2602],
  ["Linea alba", "fasciae", "fascia", false, "review_required", null],
  ["Iliotibial tract.r", "fasciae", "fascial_tract", false, "review_required", 2690],
  ["Iliopectineal arch.l", "fasciae", "fascial_arch", false, "review_required", 2695],
  ["Tendinous arch of levator ani.r", "fasciae", "fascial_arch", false, "review_required", 2434],
  ["Common tendinous ring.l", "fasciae", "tendinous_structure", false, "review_required", 2047],
  ["Trochlea of superior oblique muscle.r", "fasciae", "muscle_trochlea", false, "review_required", 2049],
  ["Superior tarsus.l", "fasciae", "eyelid_tarsus", false, "review_required", 6827],
  ["Inferior tarsus.r", "fasciae", "eyelid_tarsus", false, "review_required", 6829],
  ["Future unknown structure.l", "fasciae", "unclassified_soft_tissue", false, "review_required", null],
];

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

function parseGlbJson(filepath) {
  const buffer = fs.readFileSync(filepath);
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    fail(`${path.relative(root, filepath)} is not a valid GLB`);
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunkData = buffer.slice(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(chunkData.toString("utf8"));
    }
  }

  fail(`JSON chunk not found in ${path.relative(root, filepath)}`);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isHelperName(name) {
  if (!name) {
    return true;
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".g") || lower.endsWith(".j")) {
    return true;
  }
  if (HELPER_TOKENS.some((token) => lower.includes(token))) {
    return true;
  }
  return /^[A-Z0-9 .,'()/-]{6,}$/.test(name) && name.includes(" ");
}

function collectAssetMeshNames(relativePath) {
  const filepath = path.join(root, relativePath);
  if (!fs.existsSync(filepath)) {
    fail(`Missing asset '${relativePath}'`);
  }
  const gltf = parseGlbJson(filepath);
  return Array.from(
    new Set(
      (gltf.nodes || [])
        .filter((node) => typeof node.mesh === "number")
        .map((node) => normalizeText(node.name))
        .filter((name) => name.length > 0)
        .filter((name) => !isHelperName(name)),
    ),
  );
}

for (const [meshName, displayGroup, tissueType, quizEligible, reviewStatus, ta2Id] of TAXONOMY_REGRESSION_CASES) {
  const actual = classifySoftTissue(meshName);
  if (
    actual.displayGroup !== displayGroup ||
    actual.tissueType !== tissueType ||
    actual.quizEligible !== quizEligible ||
    actual.reviewStatus !== reviewStatus ||
    actual.ta2Id !== ta2Id
  ) {
    fail(`Taxonomy regression for '${meshName}'`);
  }
}

const nestedPrimitive = {
  name: "Sternocostal_head_of_pectoralis_major_muscle_1",
  userData: {},
  parent: {
    name: "Sternocostal_head_of_pectoralis_major_musclel",
    userData: { name: "Sternocostal head of pectoralis major muscle.l" },
    parent: null,
  },
};
if (getSoftTissueNodeName(nestedPrimitive) !== "Sternocostal head of pectoralis major muscle.l") {
  fail("Nested GLTF primitives must inherit their anatomical source-node name");
}

for (const [filepath, label] of [
  [schemaPath, "content/schema.structures.json"],
  [structuresPath, "content/structures.json"],
  [quizDataPath, "quizdata.json"],
]) {
  if (!fs.existsSync(filepath)) {
    fail(`Missing ${label}`);
  }
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const data = JSON.parse(fs.readFileSync(structuresPath, "utf8"));
const quizData = JSON.parse(fs.readFileSync(quizDataPath, "utf8"));

if (!Array.isArray(data)) {
  fail("structures.json must be an array");
}
if (!Array.isArray(quizData)) {
  fail("quizdata.json must be an array");
}

const properties = schema.items?.properties || {};
const required = schema.items?.required || [];
const allowedLayers = new Set(properties.layer?.enum || []);
const allowedDisplayGroups = new Set(properties.displayGroup?.enum || []);
const allowedTissueTypes = new Set(properties.tissueType?.enum || []);
const allowedReviewStatuses = new Set(properties.reviewStatus?.enum || []);
const ids = new Set();
const meshNames = new Set();
const stringFields = ["id", "meshName", "nameDe", "nameLatin", "funFact", "source"];

for (let index = 0; index < data.length; index += 1) {
  const entry = data[index];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    fail(`Entry ${index} must be an object`);
  }

  for (const key of required) {
    if (!(key in entry)) {
      fail(`Entry ${index} missing required key '${key}'`);
    }
  }

  for (const key of Object.keys(entry)) {
    if (!(key in properties)) {
      fail(`Entry ${index} has unknown key '${key}'`);
    }
  }

  for (const key of stringFields) {
    if (typeof entry[key] !== "string" || !entry[key].trim()) {
      fail(`Entry ${index} key '${key}' must be a non-empty string`);
    }
  }

  if (ids.has(entry.id)) {
    fail(`Duplicate id '${entry.id}'`);
  }
  ids.add(entry.id);

  if (meshNames.has(entry.meshName)) {
    fail(`Duplicate meshName '${entry.meshName}'`);
  }
  meshNames.add(entry.meshName);

  if (!allowedLayers.has(entry.layer)) {
    fail(`Entry ${index} has invalid layer '${entry.layer}'`);
  }
  if (!allowedDisplayGroups.has(entry.displayGroup)) {
    fail(`Entry ${index} has invalid displayGroup '${entry.displayGroup}'`);
  }
  if (entry.layer !== entry.displayGroup) {
    fail(`Entry ${index} layer/displayGroup mismatch for '${entry.meshName}'`);
  }
  if (!allowedTissueTypes.has(entry.tissueType)) {
    fail(`Entry ${index} has invalid tissueType '${entry.tissueType}'`);
  }
  if (typeof entry.quizEligible !== "boolean") {
    fail(`Entry ${index} quizEligible must be boolean`);
  }
  if (!allowedReviewStatuses.has(entry.reviewStatus)) {
    fail(`Entry ${index} has invalid reviewStatus '${entry.reviewStatus}'`);
  }
  if (entry.ta2Id !== undefined && (!Number.isInteger(entry.ta2Id) || entry.ta2Id < 1)) {
    fail(`Entry ${index} ta2Id must be a positive integer`);
  }
  if (entry.reviewStatus === "review_required" && entry.quizEligible) {
    fail(`Entry ${index} '${entry.meshName}' requires review and cannot be quizEligible`);
  }
  if (entry.displayGroup === "fasciae" && (entry.reviewStatus !== "review_required" || entry.quizEligible)) {
    fail(`Entry ${index} '${entry.meshName}' connective content must remain review_required and quiz-ineligible`);
  }

  if (!Array.isArray(entry.tags) || entry.tags.length === 0 || entry.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
    fail(`Entry ${index} must contain at least one non-empty string tag`);
  }
  if (entry.quizEligible !== entry.tags.includes("quiz")) {
    fail(`Entry ${index} '${entry.meshName}' quiz tag must match quizEligible`);
  }
}

const skeletonNames = collectAssetMeshNames("assets/skeleton.glb");
const softTissueNames = collectAssetMeshNames("assets/muscles.glb");
const expectedAssets = [
  ...skeletonNames.map((meshName) => ({ meshName, assetGroup: "bones" })),
  ...softTissueNames.map((meshName) => ({ meshName, assetGroup: "soft_tissue" })),
];
const expectedByMeshName = new Map();

for (const expected of expectedAssets) {
  if (expectedByMeshName.has(expected.meshName)) {
    fail(`Asset meshName '${expected.meshName}' appears in multiple source models`);
  }
  expectedByMeshName.set(expected.meshName, expected);
}

if (data.length !== expectedByMeshName.size) {
  fail(`Asset/content count mismatch: ${expectedByMeshName.size} asset meshes, ${data.length} content entries`);
}

for (const meshName of expectedByMeshName.keys()) {
  if (!meshNames.has(meshName)) {
    fail(`Asset mesh '${meshName}' is missing from structures.json`);
  }
}
for (const meshName of meshNames) {
  if (!expectedByMeshName.has(meshName)) {
    fail(`structures.json contains mesh '${meshName}' that is absent from source assets`);
  }
}

const dataByMeshName = new Map(data.map((entry) => [entry.meshName, entry]));
const taxonomyFields = ["displayGroup", "tissueType", "quizEligible", "reviewStatus", "source"];

for (const meshName of softTissueNames) {
  const entry = dataByMeshName.get(meshName);
  const expected = classifySoftTissue(meshName);
  const runtimeNode = {
    name: PropertyBinding.sanitizeNodeName(meshName),
    userData: { name: meshName },
  };
  const runtimeClassification = classifySoftTissueNode(runtimeNode);
  if (
    runtimeClassification.displayGroup !== expected.displayGroup ||
    runtimeClassification.tissueType !== expected.tissueType
  ) {
    fail(`Three.js runtime taxonomy mismatch for '${meshName}'`);
  }
  for (const key of taxonomyFields) {
    if (entry[key] !== expected[key]) {
      fail(`Shared taxonomy mismatch for '${meshName}' at '${key}': expected '${expected[key]}', got '${entry[key]}'`);
    }
  }
  if ((entry.ta2Id ?? null) !== expected.ta2Id) {
    fail(`Shared taxonomy mismatch for '${meshName}' at 'ta2Id'`);
  }
  if (entry.layer !== expected.displayGroup) {
    fail(`Compatibility layer mismatch for '${meshName}'`);
  }
}

for (const meshName of skeletonNames) {
  const entry = dataByMeshName.get(meshName);
  if (
    entry.layer !== "bones" ||
    entry.displayGroup !== "bones" ||
    entry.tissueType !== "bone" ||
    !entry.quizEligible
  ) {
    fail(`Skeleton classification mismatch for '${meshName}'`);
  }
}

if (quizData.length !== data.length) {
  fail(`quizdata.json count mismatch: expected ${data.length}, got ${quizData.length}`);
}
const fallbackById = new Map(quizData.map((entry) => [entry.id, entry]));
if (fallbackById.size !== quizData.length) {
  fail("quizdata.json contains duplicate ids");
}
const fallbackFields = [
  "meshName",
  "nameDe",
  "nameLatin",
  "funFact",
  "layer",
  "displayGroup",
  "tissueType",
  "quizEligible",
  "reviewStatus",
  "source",
];
for (const entry of data) {
  const fallback = fallbackById.get(entry.id);
  if (!fallback) {
    fail(`quizdata.json is missing '${entry.id}'`);
  }
  for (const key of fallbackFields) {
    if (fallback[key] !== entry[key]) {
      fail(`quizdata.json mismatch for '${entry.id}' at '${key}'`);
    }
  }
  if ((fallback.ta2Id ?? null) !== (entry.ta2Id ?? null)) {
    fail(`quizdata.json mismatch for '${entry.id}' at 'ta2Id'`);
  }
}

const distribution = data.reduce((counts, entry) => {
  const key = `${entry.displayGroup}/${entry.tissueType}`;
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});

console.log(`Validation passed (${data.length} structures; ${skeletonNames.length} bones, ${softTissueNames.length} soft-tissue meshes).`);
console.log(`Taxonomy distribution: ${JSON.stringify(distribution)}`);
