import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(moduleDir, "../..");

export const EXPECTED_FOUNDATION_COUNTS = Object.freeze({
  instances: 946,
  concepts: 496,
  quizEligible: 739,
  assetGroups: Object.freeze({ skeleton: 277, soft_tissue: 669 }),
  renderGroups: Object.freeze({ bones: 277, muscles: 462, fasciae: 207 }),
  sides: Object.freeze({ left: 449, right: 449, midline: 46, unresolved: 2 }),
});

export const ILIOCOSTALIS_SIDE_ANOMALY = Object.freeze([
  "Iliocostalis colli muscle",
  "Iliocostalis colli muscle.r",
]);

export const ASSET_DEFINITIONS = Object.freeze([
  Object.freeze({
    assetGroup: "skeleton",
    path: "assets/skeleton.glb",
    manifestKey: "skeleton",
    sourceId: "source.asset.z_anatomy.skeleton.production",
  }),
  Object.freeze({
    assetGroup: "soft_tissue",
    path: "assets/muscles.glb",
    manifestKey: "muscles",
    sourceId: "source.asset.z_anatomy.soft_tissue.production",
  }),
]);

export const FOUNDATION_OUTPUT_PATHS = Object.freeze({
  snapshot: "content/v2/legacy-snapshot.json",
  instances: "content/v2/instances.json",
  concepts: "content/v2/concepts/stubs.json",
});

const RENDER_GROUP_ORDER = Object.freeze(["bones", "muscles", "fasciae"]);
const SIDE_ANOMALY_SET = new Set(ILIOCOSTALIS_SIDE_ANOMALY);

export function readJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

export function sha256(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest("hex");
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function assertLegacySnapshotOverwriteAllowed({ existing, expected, accept }) {
  if (existing !== expected && !accept) {
    throw new Error(
      "Refusing to overwrite the frozen legacy snapshot; review the legacy input diff and explicitly accept it",
    );
  }
}

export function parseGlbJson(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const buffer = fs.readFileSync(absolutePath);
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`${relativePath} is not a valid GLB`);
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunkData = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(chunkData.toString("utf8"));
    }
  }

  throw new Error(`JSON chunk not found in ${relativePath}`);
}

export function collectExactMeshNames(relativePath) {
  const gltf = parseGlbJson(relativePath);
  const names = (gltf.nodes || [])
    .filter((node) => Number.isInteger(node.mesh))
    .map((node, index) => {
      if (typeof node.name !== "string" || node.name.length === 0) {
        throw new Error(`${relativePath} mesh node ${index} has no exact name`);
      }
      return node.name;
    });
  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    throw new Error(`${relativePath} contains duplicate mesh-node names`);
  }
  return names;
}

export function neutralMeshName(meshName) {
  return meshName.replace(/\.[lr]$/i, "");
}

export function deriveSide(meshName) {
  if (SIDE_ANOMALY_SET.has(meshName)) {
    return "unresolved";
  }
  if (/\.l$/i.test(meshName)) {
    return "left";
  }
  if (/\.r$/i.test(meshName)) {
    return "right";
  }
  return "midline";
}

export function deriveConceptId(legacyEntry, assetGroup) {
  const neutralId = legacyEntry.id.replace(/_[LR]$/, "").toLowerCase();
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(neutralId)) {
    throw new Error(`Cannot derive stable concept id from '${legacyEntry.id}'`);
  }
  return `concept.${assetGroup}.${neutralId}`;
}

function sortedCounts(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b, "en")));
}

function assertExactCount(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

export function loadFoundationInputs() {
  const legacyStructures = readJson("content/structures.json");
  const legacyQuizData = readJson("quizdata.json");
  const assetManifest = readJson("assets/source-manifest.json");
  if (!Array.isArray(legacyStructures) || !Array.isArray(legacyQuizData)) {
    throw new Error("Legacy structures and quiz data must be arrays");
  }

  const assetByMeshName = new Map();
  const assetMeshNames = {};
  for (const definition of ASSET_DEFINITIONS) {
    const meshNames = collectExactMeshNames(definition.path);
    const pinnedHash = assetManifest.inputs?.[definition.manifestKey]?.sha256;
    if (pinnedHash !== sha256(definition.path)) {
      throw new Error(`${definition.path} no longer matches assets/source-manifest.json`);
    }
    assetMeshNames[definition.assetGroup] = meshNames;
    for (const meshName of meshNames) {
      if (assetByMeshName.has(meshName)) {
        throw new Error(`Mesh '${meshName}' occurs in more than one production GLB`);
      }
      assetByMeshName.set(meshName, definition);
    }
  }

  const legacyIdSet = new Set();
  const legacyMeshSet = new Set();
  for (const entry of legacyStructures) {
    if (typeof entry.id !== "string" || typeof entry.meshName !== "string") {
      throw new Error("Every legacy structure needs a string id and meshName");
    }
    if (legacyIdSet.has(entry.id)) {
      throw new Error(`Duplicate legacy id '${entry.id}'`);
    }
    if (legacyMeshSet.has(entry.meshName)) {
      throw new Error(`Duplicate legacy meshName '${entry.meshName}'`);
    }
    if (!assetByMeshName.has(entry.meshName)) {
      throw new Error(`Legacy mesh '${entry.meshName}' is absent from the production GLBs`);
    }
    legacyIdSet.add(entry.id);
    legacyMeshSet.add(entry.meshName);
  }

  for (const meshName of assetByMeshName.keys()) {
    if (!legacyMeshSet.has(meshName)) {
      throw new Error(`Production mesh '${meshName}' is absent from legacy content`);
    }
  }

  const quizById = new Map();
  for (const entry of legacyQuizData) {
    if (quizById.has(entry.id)) {
      throw new Error(`Duplicate quizdata id '${entry.id}'`);
    }
    quizById.set(entry.id, entry);
  }
  if (quizById.size !== legacyStructures.length) {
    throw new Error("quizdata.json must remain a complete v1 compatibility projection");
  }
  for (const entry of legacyStructures) {
    const quizEntry = quizById.get(entry.id);
    if (!quizEntry) {
      throw new Error(`quizdata.json is missing legacy id '${entry.id}'`);
    }
    if (quizEntry.meshName !== entry.meshName || quizEntry.quizEligible !== entry.quizEligible) {
      throw new Error(`quizdata.json differs from content/structures.json for '${entry.id}'`);
    }
  }

  assertExactCount("Legacy instance count", legacyStructures.length, EXPECTED_FOUNDATION_COUNTS.instances);
  assertExactCount("Quiz compatibility count", legacyQuizData.length, EXPECTED_FOUNDATION_COUNTS.instances);
  assertExactCount("Production mesh count", assetByMeshName.size, EXPECTED_FOUNDATION_COUNTS.instances);
  for (const [assetGroup, expected] of Object.entries(EXPECTED_FOUNDATION_COUNTS.assetGroups)) {
    assertExactCount(`${assetGroup} mesh count`, assetMeshNames[assetGroup].length, expected);
  }
  assertExactCount(
    "Legacy quiz-eligible count",
    legacyStructures.filter((entry) => entry.quizEligible).length,
    EXPECTED_FOUNDATION_COUNTS.quizEligible,
  );

  return {
    legacyStructures,
    legacyQuizData,
    assetManifest,
    assetByMeshName,
    assetMeshNames,
  };
}

export function buildInstances(inputs) {
  return inputs.legacyStructures.map((entry) => {
    const asset = inputs.assetByMeshName.get(entry.meshName);
    return {
      id: entry.id,
      conceptId: deriveConceptId(entry, asset.assetGroup),
      meshName: entry.meshName,
      assetGroup: asset.assetGroup,
      renderGroup: entry.displayGroup,
      side: deriveSide(entry.meshName),
      availability: {
        discover: true,
        quizPolicy: "inherit",
        legacyQuizEligible: entry.quizEligible,
      },
      sourceId: asset.sourceId,
      mapping: {
        method: "exact_mesh_name",
        status: "verified",
      },
    };
  });
}

export function buildConceptStubs(instances) {
  const groups = new Map();
  for (const instance of instances) {
    let concept = groups.get(instance.conceptId);
    if (!concept) {
      concept = {
        id: instance.conceptId,
        workingLabel: neutralMeshName(instance.meshName),
        workingLabelStatus: "asset_label_unverified",
        assetGroup: instance.assetGroup,
        renderGroupHints: new Set(),
        instanceIds: [],
        classification: {
          anatomicalTypeId: "type.unresolved",
          regionIds: ["region.unresolved"],
          status: "needs_source",
          reviewStatus: "unreviewed",
          method: "unresolved",
        },
        editorialStatus: "draft",
        evidenceStatus: "needs_source",
      };
      groups.set(instance.conceptId, concept);
    }
    if (concept.assetGroup !== instance.assetGroup) {
      throw new Error(`Concept '${instance.conceptId}' spans multiple asset groups`);
    }
    if (concept.workingLabel !== neutralMeshName(instance.meshName)) {
      throw new Error(`Concept '${instance.conceptId}' has inconsistent source labels`);
    }
    concept.renderGroupHints.add(instance.renderGroup);
    concept.instanceIds.push(instance.id);
  }

  return [...groups.values()].map((concept) => ({
    ...concept,
    renderGroupHints: [...concept.renderGroupHints].sort(
      (a, b) => RENDER_GROUP_ORDER.indexOf(a) - RENDER_GROUP_ORDER.indexOf(b),
    ),
  }));
}

export function buildSources() {
  const upstream = "https://github.com/Z-Anatomy/Models-of-human-anatomy";
  return ASSET_DEFINITIONS.map((asset) => ({
    id: asset.sourceId,
    sourceType: "asset",
    title:
      asset.assetGroup === "skeleton"
        ? "Z-Anatomy curated production skeleton GLB"
        : "Z-Anatomy curated production soft-tissue GLB",
    provider: "Z-Anatomy",
    url: upstream,
    version: `sha256:${sha256(asset.path)}`,
    rightsPolicy: "citation_only",
    license: {
      id: "CC-BY-SA-4.0",
      url: `${upstream}/blob/master/License.txt`,
      attributionPath: "assets/ATTRIBUTION.md",
    },
    supports: ["mesh_identity", "geometry_provenance"],
    asset: {
      path: asset.path,
      sha256: sha256(asset.path),
    },
  }));
}

export function buildLegacySnapshot(inputs, instances) {
  const quizEligibleIds = inputs.legacyStructures
    .filter((entry) => entry.quizEligible)
    .map((entry) => entry.id);
  return {
    schemaVersion: 2,
    snapshotId: "legacy-v1-production-foundation",
    ordering: "content/structures.json file order",
    files: {
      "assets/muscles.glb": { sha256: sha256("assets/muscles.glb") },
      "assets/skeleton.glb": { sha256: sha256("assets/skeleton.glb") },
      "assets/source-manifest.json": { sha256: sha256("assets/source-manifest.json") },
      "content/schema.structures.json": { sha256: sha256("content/schema.structures.json") },
      "content/structures.json": { sha256: sha256("content/structures.json") },
      "quizdata.json": { sha256: sha256("quizdata.json") },
    },
    counts: {
      instances: instances.length,
      concepts: new Set(instances.map((instance) => instance.conceptId)).size,
      quizEligible: quizEligibleIds.length,
      assetGroups: sortedCounts(instances.map((instance) => instance.assetGroup)),
      renderGroups: sortedCounts(instances.map((instance) => instance.renderGroup)),
      sides: sortedCounts(instances.map((instance) => instance.side)),
      legacyTissueTypes: sortedCounts(inputs.legacyStructures.map((entry) => entry.tissueType)),
      legacyReviewStatuses: sortedCounts(inputs.legacyStructures.map((entry) => entry.reviewStatus)),
    },
    instanceIds: inputs.legacyStructures.map((entry) => entry.id),
    quizEligibleIds,
  };
}

export function buildCatalog() {
  return {
    $schema: "../schemas/v2/catalog.schema.json",
    schemaVersion: 2,
    catalogId: "anatomyquest.content.v2",
    stage: "foundation",
    legacySnapshot: "legacy-snapshot.json",
    collections: {
      instances: {
        path: "instances.json",
        itemSchema: "../schemas/v2/instance.schema.json",
      },
      concepts: [
        {
          path: "concepts/stubs.json",
          itemSchema: "../schemas/v2/concept.schema.json",
          status: "draft",
        },
      ],
      sources: {
        path: "sources.json",
        itemSchema: "../schemas/v2/source.schema.json",
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

export function buildFoundationOutputs() {
  const inputs = loadFoundationInputs();
  const instances = buildInstances(inputs);
  const concepts = buildConceptStubs(instances);
  assertExactCount("Generated concept count", concepts.length, EXPECTED_FOUNDATION_COUNTS.concepts);

  return new Map([
    [FOUNDATION_OUTPUT_PATHS.snapshot, buildLegacySnapshot(inputs, instances)],
    [FOUNDATION_OUTPUT_PATHS.instances, instances],
    [FOUNDATION_OUTPUT_PATHS.concepts, concepts],
  ]);
}
