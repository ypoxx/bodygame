import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ROOT } from "../scripts/lib/content-v2-foundation.mjs";
import { assertValidJsonSchema } from "../scripts/lib/json-schema-validator.mjs";

const MANIFEST_DIRECTORY = path.join(
  ROOT,
  "content/v2/packages/phase-b/v1",
);
const SCHEMA_PATH = path.join(
  ROOT,
  "content/schemas/v2/phase-b-package-manifest.schema.json",
);

const EXPECTED_PACKAGES = Object.freeze([
  ["skeleton-01-head-neck.json", "phase_b.skeleton.head_neck", "skeleton", 1, 44, 76],
  ["skeleton-02-spine.json", "phase_b.skeleton.spine", "skeleton", 2, 26, 26],
  ["skeleton-03-thorax.json", "phase_b.skeleton.thorax", "skeleton", 3, 25, 47],
  ["skeleton-04-upper-extremity.json", "phase_b.skeleton.upper_extremity", "skeleton", 4, 32, 64],
  ["skeleton-05-pelvis-lower-extremity.json", "phase_b.skeleton.pelvis_lower_extremity", "skeleton", 5, 32, 64],
  ["muscles-01-head-orbit-face-tongue.json", "phase_b.muscles.head_orbit_face_tongue", "muscles", 1, 36, 72],
  ["muscles-02-neck-pharynx-larynx.json", "phase_b.muscles.neck_pharynx_larynx", "muscles", 2, 30, 59],
  ["muscles-03-back.json", "phase_b.muscles.back", "muscles", 3, 35, 70],
  ["muscles-04-thorax-abdomen-pelvic-floor.json", "phase_b.muscles.thorax_abdomen_pelvic_floor", "muscles", 4, 24, 47],
  ["muscles-05-shoulder-upper-arm.json", "phase_b.muscles.shoulder_upper_arm", "muscles", 5, 15, 30],
  ["muscles-06-forearm-hand.json", "phase_b.muscles.forearm_hand", "muscles", 6, 36, 72],
  ["muscles-07-hip-thigh.json", "phase_b.muscles.hip_thigh", "muscles", 7, 27, 54],
  ["muscles-08-lower-leg-foot.json", "phase_b.muscles.lower_leg_foot", "muscles", 8, 29, 58],
  ["connective-tissue-01-fasciae-arches-septa-tract.json", "phase_b.connective_tissue.fasciae_arches_septa_tract", "connective_tissue", 1, 31, 59],
  ["connective-tissue-02-upper-extremity-bursae-sheaths.json", "phase_b.connective_tissue.upper_extremity_bursae_sheaths", "connective_tissue", 2, 15, 30],
  ["connective-tissue-03-lower-extremity-bursae-sheaths.json", "phase_b.connective_tissue.lower_extremity_bursae_sheaths", "connective_tissue", 3, 37, 74],
  ["connective-tissue-04-retinacula-tendons-ligaments-special.json", "phase_b.connective_tissue.retinacula_tendons_ligaments_special", "connective_tissue", 4, 22, 44],
]);

const STOP_THE_LINE_PACKAGES = new Map([
  [
    "concept.soft_tissue.iliopsoas_fascia",
    "phase_b.connective_tissue.fasciae_arches_septa_tract",
  ],
  [
    "concept.soft_tissue.tendon_of_extensor_digitorum_longus",
    "phase_b.connective_tissue.retinacula_tendons_ligaments_special",
  ],
  [
    "concept.soft_tissue.trochanteric_bursa_of_gluteus_medius_muscle",
    "phase_b.connective_tissue.lower_extremity_bursae_sheaths",
  ],
  [
    "concept.soft_tissue.iliocostalis_colli_muscle",
    "phase_b.muscles.back",
  ],
]);

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "en"));
}

function conceptDomain(concept) {
  if (concept.assetGroup === "skeleton") return "skeleton";
  if (concept.renderGroupHints.length === 1 && concept.renderGroupHints[0] === "muscles") {
    return "muscles";
  }
  if (concept.renderGroupHints.length === 1 && concept.renderGroupHints[0] === "fasciae") {
    return "connective_tissue";
  }
  return null;
}

const schema = readJson(SCHEMA_PATH);
const manifestFiles = fs.readdirSync(MANIFEST_DIRECTORY)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort((a, b) => a.localeCompare(b, "en"));
const manifests = manifestFiles.map((fileName) => ({
  fileName,
  value: readJson(path.join(MANIFEST_DIRECTORY, fileName)),
}));
const concepts = readJson(path.join(ROOT, "content/v2/concepts/stubs.json"));
const instances = readJson(path.join(ROOT, "content/v2/instances.json"));
const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));

test("the 17 versioned Phase B manifests satisfy their schema and frozen package totals", () => {
  assert.deepEqual(
    manifestFiles,
    sorted(EXPECTED_PACKAGES.map(([fileName]) => fileName)),
  );

  const manifestByFile = new Map(manifests.map((entry) => [entry.fileName, entry.value]));
  for (const [
    fileName,
    packageId,
    assetDomain,
    packageSequence,
    expectedConceptCount,
    expectedInstanceCount,
  ] of EXPECTED_PACKAGES) {
    const manifest = manifestByFile.get(fileName);
    assertValidJsonSchema(schema, manifest, fileName);
    assert.equal(manifest.packageId, packageId, fileName);
    assert.equal(manifest.assetDomain, assetDomain, fileName);
    assert.equal(manifest.packageSequence, packageSequence, fileName);
    assert.equal(manifest.assignmentBasis, "working_asset_label", fileName);
    assert.equal(
      manifest.assignmentStatus,
      "working_assignment_not_medically_verified",
      fileName,
    );
    assert.equal(manifest.expectedConceptCount, expectedConceptCount, fileName);
    assert.equal(manifest.conceptIds.length, expectedConceptCount, fileName);
    assert.equal(manifest.expectedInstanceCount, expectedInstanceCount, fileName);

    const resolvedInstanceCount = manifest.conceptIds.reduce((count, conceptId) => {
      const concept = conceptById.get(conceptId);
      assert.ok(concept, `${fileName}: unknown concept id '${conceptId}'`);
      assert.equal(conceptDomain(concept), assetDomain, `${fileName}: ${conceptId}`);
      return count + concept.instanceIds.length;
    }, 0);
    assert.equal(resolvedInstanceCount, expectedInstanceCount, fileName);
  }
});

test("package concept IDs are disjoint and cover exactly all 496 concepts and 946 instances", () => {
  const assignedConceptIds = manifests.flatMap(({ value }) => value.conceptIds);
  assert.equal(assignedConceptIds.length, 496);
  assert.equal(new Set(assignedConceptIds).size, 496, "package concept IDs must be disjoint");
  assert.deepEqual(sorted(assignedConceptIds), sorted(conceptById.keys()));

  const assignedInstanceIds = assignedConceptIds.flatMap(
    (conceptId) => conceptById.get(conceptId).instanceIds,
  );
  assert.equal(assignedInstanceIds.length, 946);
  assert.equal(new Set(assignedInstanceIds).size, 946, "resolved instance IDs must be unique");
  assert.deepEqual(sorted(assignedInstanceIds), sorted(instances.map((instance) => instance.id)));

  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
  for (const concept of concepts) {
    for (const instanceId of concept.instanceIds) {
      assert.equal(instanceById.get(instanceId)?.conceptId, concept.id, instanceId);
    }
  }
});

test("all and only the four hard stop-the-line concepts are explicit and prioritized", () => {
  const declaredStops = manifests.flatMap(({ value }) =>
    value.stopTheLineConceptIds.map((conceptId) => [conceptId, value.packageId]),
  );
  assert.equal(declaredStops.length, 4);
  assert.equal(new Set(declaredStops.map(([conceptId]) => conceptId)).size, 4);
  assert.deepEqual(new Map(declaredStops), STOP_THE_LINE_PACKAGES);

  for (const { fileName, value: manifest } of manifests) {
    for (const conceptId of manifest.stopTheLineConceptIds) {
      assert.ok(manifest.conceptIds.includes(conceptId), `${fileName}: ${conceptId}`);
    }
    assert.equal(
      manifest.reviewPriority,
      manifest.stopTheLineConceptIds.length > 0 ? "stop_the_line_first" : "standard",
      fileName,
    );
  }
});
