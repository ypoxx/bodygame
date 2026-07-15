import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import {
  assertLegacySnapshotOverwriteAllowed,
  readJson,
  ROOT,
  serializeJson,
} from "../scripts/lib/content-v2-foundation.mjs";
import {
  buildTerminologyOutputs,
  EXPECTED_TERMINOLOGY_COUNTS,
  TERMINOLOGY_PATHS,
} from "../scripts/lib/content-v2-terminology.mjs";
import {
  assertPublishedClaimGates,
  contentHash,
} from "../scripts/lib/content-v2-publish-gate.mjs";
import {
  assertSupportedSchema,
  validateJsonSchema,
} from "../scripts/lib/json-schema-validator.mjs";

const concepts = readJson(TERMINOLOGY_PATHS.concepts);
const runtimeIndex = readJson(TERMINOLOGY_PATHS.runtimeIndex);
const terms = readJson(TERMINOLOGY_PATHS.selectedTerms);

test("all concepts and instances have an honest TA2 2.07 terminology projection", () => {
  assert.equal(concepts.length, 496);
  assert.equal(runtimeIndex.length, 946);
  assert.equal(terms.length, 424);
  assert.equal(concepts.filter((concept) => concept.terminology.status === "official_base").length, 495);
  assert.equal(concepts.filter((concept) => concept.terminology.status === "derived_structure").length, 1);
  assert.equal(runtimeIndex.filter((entry) => entry.terminology.status === "official_base").length, 944);
  assert.equal(runtimeIndex.filter((entry) => entry.terminology.status === "derived_structure").length, 2);
  assert.equal(new Set(runtimeIndex.map((entry) => entry.conceptId)).size, 496);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(EXPECTED_TERMINOLOGY_COUNTS.methods).map(([method]) => [
        method,
        concepts.filter((concept) => concept.terminology.match.method === method).length,
      ]),
    ),
    EXPECTED_TERMINOLOGY_COUNTS.methods,
  );
});

test("official ids are integers and the single derived structure has no invented TA2 id", () => {
  for (const concept of concepts) {
    if (concept.terminology.status === "official_base") {
      assert.equal(Number.isInteger(concept.terminology.baseTerm.termId), true);
      assert.doesNotMatch(String(concept.terminology.baseTerm.termId), /\*/);
    }
  }
  const derived = concepts.find((concept) => concept.terminology.status === "derived_structure");
  assert.equal(derived.id, "concept.soft_tissue.tendon_of_extensor_digitorum_longus");
  assert.equal(derived.terminology.derivedFrom.officialTerm.termId, 2645);
  assert.equal(derived.terminology.derivedFrom.targetConceptId, "concept.soft_tissue.extensor_digitorum_longus");
  assert.equal(Object.hasOwn(derived.terminology, "baseTerm"), false);
  assert.equal(derived.terminology.match.status, "expert_review_required");
});

test("every selected primary field has field-precise source provenance", () => {
  const sourceIds = new Set(readJson(TERMINOLOGY_PATHS.sources).map((source) => source.id));
  for (const term of terms) {
    assert.deepEqual(Object.keys(term.fields).sort(), ["englishUk", "latin"]);
    assert.equal(Object.hasOwn(term.fields, "latinSynonym"), false);
    for (const [fieldName, expectedColumn] of [["latin", "latin"], ["englishUk", "english_uk"]]) {
      const field = term.fields[fieldName];
      assert.ok(field.value.length > 0);
      assert.ok(sourceIds.has(field.sourceRef.sourceId));
      assert.equal(field.sourceRef.locator.kind, "pdf_term_row");
      assert.equal(field.sourceRef.locator.termId, term.termId);
      assert.equal(field.sourceRef.locator.column, expectedColumn);
      assert.ok(field.sourceRef.locator.pdfPage > 0);
    }
  }
});

test("known aliases, source typo and official wording update remain explicit", () => {
  const byLabel = new Map(concepts.map((concept) => [concept.workingLabel, concept]));
  const cases = [
    ["Cruciform part of fibrous sheath of digit of hand", 2586, "exact_v2_07"],
    ["Tendon sheath of extensors carpi radialis", 2578, "exact_v2_07"],
    ["Tendon sheath of extensor digitorum and extensor indicis", 2580, "exact_v2_07"],
    ["Subfacial prepatellar bursa", 2736, "mesh_typo"],
    ["Tendon sheath of tibialis anterior", 2756, "reviewed_alias"],
    ["Trochanteric bursa of gluteus medius muscle", 2725, "reviewed_alias"],
    ["Third rib", 1118, "series_variant"],
    ["Vertebra C7", 1057, "reviewed_alias"],
  ];
  for (const [label, termId, method] of cases) {
    const terminology = byLabel.get(label).terminology;
    assert.equal(terminology.baseTerm.termId, termId, label);
    assert.equal(terminology.match.method, method, label);
  }
});

test("singular trochanteric bursa mapping stays behind expert review", () => {
  const concept = concepts.find(
    (entry) => entry.workingLabel === "Trochanteric bursa of gluteus medius muscle",
  );
  assert.ok(concept);
  assert.equal(concept.terminology.baseTerm.termId, 2725);
  assert.equal(concept.terminology.match.status, "expert_review_required");
  assert.equal(concept.terminology.match.reasonCode, "singular_asset_for_plural_official_term");
});

test("classification corrects the skeleton layer without claiming anatomy verification", () => {
  const counts = {};
  for (const entry of runtimeIndex) counts[entry.classification.typeId] = (counts[entry.classification.typeId] || 0) + 1;
  assert.equal(counts["type.bone"], 210);
  assert.equal(counts["type.cartilage"], 31);
  assert.equal(counts["type.tooth"], 28);
  assert.equal(counts["type.cavity"], 8);
  assert.equal(counts["type.muscle"], 462);
  assert.equal(runtimeIndex.reduce((sum, entry) => sum + (entry.renderGroup !== "bones"), 0), 669);
  assert.equal(runtimeIndex.every((entry) => entry.classification.status === "partial"), true);
  assert.equal(
    runtimeIndex.every(
      (entry) =>
        entry.classification.reviewStatus === "machine_inferred_from_asset_label" &&
        entry.classification.method === "legacy_asset_label_taxonomy",
    ),
    true,
  );
  assert.doesNotMatch(JSON.stringify(runtimeIndex), /anatomy_verified/);
  const sourceById = new Map(readJson(TERMINOLOGY_PATHS.sources).map((source) => [source.id, source]));
  assert.equal(
    concepts.every(
      (concept) =>
        concept.classification.sourceRefs.length === 1 &&
        sourceById.get(concept.classification.sourceRefs[0].sourceId)?.sourceType === "asset",
    ),
    true,
  );
});

test("runtime index is compact, exact and contains no unreviewed German or claims", () => {
  assert.equal(new Set(runtimeIndex.map((entry) => entry.id)).size, 946);
  assert.equal(new Set(runtimeIndex.map((entry) => entry.meshName)).size, 946);
  for (const entry of runtimeIndex) {
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["classification", "conceptId", "id", "meshName", "renderGroup", "side", "terminology"],
    );
  }
  assert.doesNotMatch(JSON.stringify(runtimeIndex), /nameDe|preferredDe|funFact|summary|claims|details/);
  assert.ok(
    gzipSync(fs.readFileSync(path.join(ROOT, TERMINOLOGY_PATHS.runtimeIndex)), { level: 9 }).length < 50 * 1024,
    "runtime index must remain below 50 KiB gzip",
  );
});

test("terminology and runtime generated files are byte-for-byte reproducible", () => {
  for (const [relativePath, expected] of buildTerminologyOutputs()) {
    const actual = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.equal(actual, serializeJson(expected), relativePath);
  }
});

test("the real JSON Schema validator rejects malformed Phase B data", () => {
  const schema = readJson("content/schemas/v2/concept.schema.json");
  assertSupportedSchema(schema);
  const invalid = structuredClone(concepts[0]);
  invalid.terminology.baseTerm.termId = "729*1";
  const errors = validateJsonSchema(schema, invalid, "invalid concept");
  assert.ok(errors.some((error) => error.includes("oneOf")));
  assert.throws(
    () => assertSupportedSchema({ type: "object", inventedKeyword: true }),
    /unsupported JSON Schema keyword/,
  );
});

test("publish gate requires sourced content and a current claim-bound medical expert review", () => {
  const claim = {
    claimId: "claim.test.location",
    field: "location",
    textDe: "Testinhalt",
    evidenceStatus: "sourced",
    sourceRefs: [{ sourceId: "source.claims", locator: "p. 1" }],
  };
  const published = [{ id: "concept.test", editorialStatus: "published", summary: claim }];
  const sourceById = new Map([
    ["source.claims", {
      supports: ["anatomical_claims"],
      rightsPolicy: "paraphrase_allowed",
      snapshot: { sha256: "1".repeat(64) },
    }],
  ]);
  assert.throws(
    () => assertPublishedClaimGates({ concepts: published, sourceById, acceptedAnatomyByClaim: new Map() }),
    /lacks a current, claim-bound expert review/,
  );
  const review = {
    targetType: "claim",
    targetId: claim.claimId,
    targetHash: contentHash(claim),
    reviewerRole: "medical_domain_expert",
    reviewerId: "expert:test-reviewer",
  };
  assert.doesNotThrow(() => assertPublishedClaimGates({
    concepts: published,
    sourceById,
    acceptedAnatomyByClaim: new Map([[claim.claimId, review]]),
  }));
  review.targetHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  assert.throws(
    () => assertPublishedClaimGates({
      concepts: published,
      sourceById,
      acceptedAnatomyByClaim: new Map([[claim.claimId, review]]),
    }),
    /stale/,
  );
});

test("legacy snapshot cannot be silently overwritten", () => {
  assert.throws(
    () => assertLegacySnapshotOverwriteAllowed({ existing: "old", expected: "new", accept: false }),
    /Refusing to overwrite/,
  );
  assert.doesNotThrow(
    () => assertLegacySnapshotOverwriteAllowed({ existing: "old", expected: "new", accept: true }),
  );
});

test("official primary-term import matches the pinned extraction when available", {
  skip: !fs.existsSync("/tmp/ta2-official-terms.json"),
}, () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/import-ta2-primary-terms.mjs", "--input", "/tmp/ta2-official-terms.json", "--check"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /424 selected terms/);
});
