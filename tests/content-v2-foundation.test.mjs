import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildFoundationOutputs,
  buildInstances,
  deriveConceptId,
  deriveSide,
  EXPECTED_FOUNDATION_COUNTS,
  FOUNDATION_OUTPUT_PATHS,
  loadFoundationInputs,
  ROOT,
  serializeJson,
} from "../scripts/lib/content-v2-foundation.mjs";

test("side derivation preserves the documented anomaly without guessing", () => {
  assert.equal(deriveSide("Femur.l"), "left");
  assert.equal(deriveSide("Femur.r"), "right");
  assert.equal(deriveSide("Sternum"), "midline");
  assert.equal(deriveSide("Iliocostalis colli muscle"), "unresolved");
  assert.equal(deriveSide("Iliocostalis colli muscle.r"), "unresolved");
});

test("left and right legacy instances derive one stable concept id", () => {
  assert.equal(
    deriveConceptId({ id: "Femur_L" }, "skeleton"),
    "concept.skeleton.femur",
  );
  assert.equal(
    deriveConceptId({ id: "Femur_R" }, "skeleton"),
    "concept.skeleton.femur",
  );
  assert.equal(
    deriveConceptId({ id: "Iliocostalis_colli_muscle" }, "soft_tissue"),
    "concept.soft_tissue.iliocostalis_colli_muscle",
  );
  assert.equal(
    deriveConceptId({ id: "Iliocostalis_colli_muscle_R" }, "soft_tissue"),
    "concept.soft_tissue.iliocostalis_colli_muscle",
  );
});

test("foundation inventory matches all frozen production counts", () => {
  const inputs = loadFoundationInputs();
  const instances = buildInstances(inputs);
  assert.equal(instances.length, EXPECTED_FOUNDATION_COUNTS.instances);
  assert.equal(
    instances.filter((entry) => entry.availability.legacyQuizEligible).length,
    EXPECTED_FOUNDATION_COUNTS.quizEligible,
  );
  assert.equal(
    new Set(instances.map((entry) => entry.conceptId)).size,
    EXPECTED_FOUNDATION_COUNTS.concepts,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(EXPECTED_FOUNDATION_COUNTS.assetGroups).map((key) => [
        key,
        instances.filter((entry) => entry.assetGroup === key).length,
      ]),
    ),
    EXPECTED_FOUNDATION_COUNTS.assetGroups,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(EXPECTED_FOUNDATION_COUNTS.renderGroups).map((key) => [
        key,
        instances.filter((entry) => entry.renderGroup === key).length,
      ]),
    ),
    EXPECTED_FOUNDATION_COUNTS.renderGroups,
  );
});

test("checked-in generated v2 files are byte-for-byte reproducible", () => {
  for (const [relativePath, expected] of buildFoundationOutputs()) {
    const actual = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.equal(actual, serializeJson(expected), relativePath);
  }
});

test("snapshot contains the complete stable-id and quiz-id sets", () => {
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(ROOT, FOUNDATION_OUTPUT_PATHS.snapshot), "utf8"),
  );
  assert.equal(snapshot.instanceIds.length, 946);
  assert.equal(new Set(snapshot.instanceIds).size, 946);
  assert.equal(snapshot.quizEligibleIds.length, 739);
  assert.equal(new Set(snapshot.quizEligibleIds).size, 739);
  for (const file of Object.values(snapshot.files)) {
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
});

test("full hard-gate validator succeeds", () => {
  const result = spawnSync(process.execPath, ["scripts/validate-content-v2.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /946\/946 exact meshes/);
});
