import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildTerminologyOutputs,
  buildRuntimeIndex,
  mergeCuratedConcepts,
  mergeCuratedSources,
  TERMINOLOGY_PATHS,
} from "../scripts/lib/content-v2-terminology.mjs";
import {
  collectHumanReviewGates,
  contentHash,
  DETAIL_FIELD_TO_CLAIM_FIELD,
  HARD_PUBLICATION_BLOCKS,
  projectPublishedLearning,
  releaseStateReviewTargets,
} from "../scripts/lib/content-v2-publish-gate.mjs";
import {
  MEDICAL_CONTENT_PROFILES,
  MEDICAL_CONTENT_PROFILE_POLICY,
} from "../scripts/lib/content-v2-completeness.mjs";
import {
  readJson,
  ROOT,
  serializeJson,
} from "../scripts/lib/content-v2-foundation.mjs";
import {
  assertValidJsonSchema,
  validateJsonSchema,
} from "../scripts/lib/json-schema-validator.mjs";

const concepts = readJson(TERMINOLOGY_PATHS.concepts);
const instances = readJson("content/v2/instances.json");
const registeredSources = readJson(TERMINOLOGY_PATHS.sources);
const runtimeIndex = readJson(TERMINOLOGY_PATHS.runtimeIndex);
const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
const typeIds = new Set(
  readJson("content/v2/taxonomy/anatomical-types.json").values.map((entry) => entry.id),
);
const regionIds = new Set(
  readJson("content/v2/taxonomy/regions.json").values.map((entry) => entry.id),
);

const baseConcept = concepts.find(
  (concept) =>
    concept.terminology.status === "official_base" &&
    concept.terminology.match.status !== "expert_review_required",
);
const baseInstance = instances.find((instance) => instance.conceptId === baseConcept.id);
const muscleConcept = concepts.find(
  (concept) =>
    concept.classification.anatomicalTypeId === "type.muscle" &&
    concept.terminology.status === "official_base" &&
    concept.terminology.match.status !== "expert_review_required" &&
    !HARD_PUBLICATION_BLOCKS.has(concept.id),
);
const fasciaConcept = concepts.find(
  (concept) =>
    concept.classification.anatomicalTypeId === "type.fascia" &&
    concept.terminology.status === "official_base" &&
    concept.terminology.match.status !== "expert_review_required" &&
    !HARD_PUBLICATION_BLOCKS.has(concept.id),
);

const snapshot = {
  sha256: "1".repeat(64),
  capturedAt: "2026-07-15",
  locatorBasis: "Stable test section locator",
};

const localizationSource = {
  id: "source.test.localization",
  sourceType: "terminology",
  title: "Test localization registry",
  provider: "Test provider",
  url: "https://example.test/localization",
  version: "test-1",
  rightsPolicy: "terminology_only",
  license: {
    id: "CC-BY-4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    attributionPath: "docs/test-attribution.md",
  },
  supports: ["localization"],
  snapshot,
};

const claimsSource = {
  id: "source.test.claims",
  sourceType: "textbook",
  title: "Test anatomical reference",
  provider: "Test provider",
  url: "https://example.test/anatomy",
  version: "test-1",
  rightsPolicy: "paraphrase_allowed",
  license: {
    id: "CC-BY-4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
    attributionPath: "docs/test-attribution.md",
  },
  supports: ["anatomical_claims"],
  snapshot: { ...snapshot, sha256: "2".repeat(64) },
};

function claim(claimId, field, textDe) {
  return {
    claimId,
    field,
    textDe,
    evidenceStatus: "sourced",
    sourceRefs: [{ sourceId: claimsSource.id, locator: `section:${claimId}` }],
  };
}

function completeDetails(concept) {
  const profile = MEDICAL_CONTENT_PROFILES[concept.classification.anatomicalTypeId];
  const containers = profile?.requiredDetailContainers || ["location"];
  return Object.fromEntries(containers.map((container) => [
    container,
    [claim(
      `pipeline.${container}`,
      DETAIL_FIELD_TO_CLAIM_FIELD[container],
      `Geprüfte Testangabe für ${container}.`,
    )],
  ]));
}

function publishedPatch(
  concept = baseConcept,
  localization = localizationSource,
  localizationLocator = "descriptor:test",
  editorialStatus = "published",
) {
  const officialTerm = concept.terminology.baseTerm || concept.terminology.derivedFrom.officialTerm;
  return {
    conceptId: concept.id,
    names: {
      preferredDe: "Geprüfter Testname",
      preferredLatin: officialTerm.fields.latin.value,
      aliases: ["Testalias"],
      sourceRefs: [
        officialTerm.fields.latin.sourceRef,
        { sourceId: localization.id, locator: localizationLocator },
      ],
    },
    summary: claim("pipeline.summary", "summary", "Geprüfte Testzusammenfassung."),
    details: completeDetails(concept),
    editorialStatus,
    evidenceStatus: "sourced",
  };
}

function releaseStateFor(
  concept = baseConcept,
  verificationTier = concept.editorialStatus === "source_verified_mvp"
    ? "source_verified_mvp"
    : "human_reviewed",
) {
  const isMvp = verificationTier === "source_verified_mvp";
  const officialTerm = concept.terminology.baseTerm || concept.terminology.derivedFrom.officialTerm;
  const releaseState = {
    conceptId: concept.id,
    verificationTier,
    classification: {
      status: "resolved",
      anatomicalTypeId: concept.classification.anatomicalTypeId,
      sourceRefs: [officialTerm.fields.latin.sourceRef],
    },
    regions: {
      status: "resolved",
      regionIds: ["region.whole_body"],
      sourceRefs: [{ sourceId: claimsSource.id, locator: "section:reviewed-region" }],
    },
    instances: concept.instanceIds.map((instanceId) => {
      const instance = instanceById.get(instanceId);
      const assetRef = {
        sourceId: instance.sourceId,
        locator: `Exact glTF mesh-node name: ${instance.meshName}`,
      };
      return {
        instanceId,
        laterality: instance.side === "unresolved" ? "left" : instance.side,
        lateralitySourceRefs: [assetRef],
        meshMapping: {
          status: isMvp ? "source_verified" : "human_verified",
          sourceRefs: [assetRef],
        },
      };
    }),
    reviews: {},
  };
  const targets = releaseStateReviewTargets(releaseState);
  releaseState.reviews = Object.fromEntries(
    Object.entries(targets).map(([area, target]) => [
      area,
      {
        reviewId: `review.pipeline.release_${area.toLowerCase()}`,
        status: "accepted",
        targetHash: contentHash(target),
        authorId: "editor:test-author",
        reviewerId: isMvp
          ? `agent:test-${area.toLowerCase()}-reviewer`
          : area === "meshMapping"
            ? "expert:test-asset-reviewer"
            : `expert:test-${area.toLowerCase()}-reviewer`,
        reviewerRole: isMvp
          ? area === "meshMapping"
            ? "geometry_research_reviewer"
            : "source_research_reviewer"
          : area === "meshMapping"
            ? "anatomy_asset_expert"
            : "medical_domain_expert",
      },
    ]),
  );
  return releaseState;
}

function acceptedGates(concept) {
  const isMvp = concept.editorialStatus === "source_verified_mvp";
  const anatomyRecords = [
    concept.summary,
    ...Object.values(concept.details).flat(),
  ].map((entry, index) => ({
    id: `review.pipeline.anatomy_${index}`,
    targetType: "claim",
    targetId: entry.claimId,
    targetHash: contentHash(entry),
    status: "accepted",
    authorId: "editor:test-author",
    reviewerId: isMvp
      ? `agent:test-anatomy-reviewer-${index}`
      : `expert:test-anatomist-${index}`,
    reviewerRole: isMvp ? "source_research_reviewer" : "medical_domain_expert",
    verificationTier: isMvp ? "source_verified_mvp" : "human_reviewed",
  }));
  return collectHumanReviewGates([
    {
      schemaVersion: 2,
      reviewArea: "anatomical_content",
      status: "complete",
      records: anatomyRecords,
    },
    {
      schemaVersion: 2,
      reviewArea: "localization",
      status: "complete",
      records: [
        {
          id: "review.pipeline.localization",
          targetType: "names",
          targetId: concept.id,
          targetHash: contentHash(concept.names),
          status: "accepted",
          authorId: "editor:test-author",
          reviewerId: isMvp ? "agent:test-localization-reviewer" : "expert:test-localizer",
          reviewerRole: isMvp ? "source_localization_reviewer" : "localization_expert",
          verificationTier: isMvp ? "source_verified_mvp" : "human_reviewed",
        },
      ],
    },
  ]);
}

function publicationContext(concept, options = {}) {
  const releaseState = options.includeReleaseState === false
    ? null
    : options.releaseState || releaseStateFor(concept);
  return {
    sourceById: new Map(
      [
        ...registeredSources,
        localizationSource,
        claimsSource,
        ...(options.extraSources || []),
      ].map((source) => [source.id, source]),
    ),
    releaseStateByConcept: releaseState
      ? new Map([[concept.id, releaseState]])
      : new Map(),
    instanceById,
    typeIds,
    regionIds,
    ...acceptedGates(concept),
  };
}

test("empty concept curation and source-only registration preserve runtime without learning copy", () => {
  assert.deepEqual(readJson(TERMINOLOGY_PATHS.curatedConcepts), []);
  assert.deepEqual(readJson(TERMINOLOGY_PATHS.releaseStates), []);
  const curatedSources = readJson(TERMINOLOGY_PATHS.curatedSources);
  assert.equal(curatedSources.length, 4);
  const germanMesh = curatedSources.find(
    (source) => source.id === "source.localization.german_mesh.2025_v30",
  );
  assert.deepEqual(germanMesh.supports, ["localization"]);
  assert.match(germanMesh.rightsScope, /PreferredLabelDE.*SynonymsDE/);
  assert.equal(concepts.length, 496);
  assert.equal(runtimeIndex.length, 946);
  assert.equal(runtimeIndex.some((entry) => entry.learning), false);
});

test("the Netlify build cannot copy files before the v2 hard gate passes", () => {
  assert.equal(
    readJson("package.json").scripts.build,
    "npm run content:v2:check && node scripts/build-netlify.mjs",
  );
});

test("a fully source-, hash- and human-reviewed patch projects one schema-valid published payload", () => {
  const published = mergeCuratedConcepts([baseConcept], [publishedPatch()])[0];
  const context = publicationContext(published);
  const [entry] = buildRuntimeIndex([baseInstance], [published], context);

  assert.equal(entry.learning.status, "published");
  assert.equal(entry.learning.names.preferredLatin, baseConcept.terminology.baseTerm.fields.latin.value);
  assert.equal(entry.learning.summary.claimId, "pipeline.summary");
  assert.deepEqual(
    Object.keys(entry.learning.details),
    MEDICAL_CONTENT_PROFILES[baseConcept.classification.anatomicalTypeId].requiredDetailContainers,
  );
  assert.deepEqual(entry.learning.reviewedState, {
    verificationTier: "human_reviewed",
    anatomicalTypeId: baseConcept.classification.anatomicalTypeId,
    regionIds: ["region.whole_body"],
    side: baseInstance.side,
    meshMappingStatus: "human_verified",
  });
  assert.equal(Object.hasOwn(entry.learning, "relations"), false);
  assertValidJsonSchema(
    readJson("content/schemas/v2/runtime-index-entry.schema.json"),
    entry,
    "positive runtime entry",
  );
});

test("a source-verified MVP patch projects without claiming human review", () => {
  const mvp = mergeCuratedConcepts(
    [baseConcept],
    [publishedPatch(baseConcept, localizationSource, "descriptor:test", "source_verified_mvp")],
  )[0];
  const context = publicationContext(mvp);
  const [entry] = buildRuntimeIndex([baseInstance], [mvp], context);

  assert.equal(entry.learning.status, "source_verified_mvp");
  assert.deepEqual(entry.learning.reviewedState, {
    verificationTier: "source_verified_mvp",
    anatomicalTypeId: baseConcept.classification.anatomicalTypeId,
    regionIds: ["region.whole_body"],
    side: baseInstance.side,
    meshMappingStatus: "source_verified",
  });
  assertValidJsonSchema(
    readJson("content/schemas/v2/runtime-index-entry.schema.json"),
    entry,
    "source-verified MVP runtime entry",
  );
});

test("medical completeness profiles cover every resolved anatomical type", () => {
  assert.deepEqual(
    Object.keys(MEDICAL_CONTENT_PROFILES).sort(),
    [...typeIds].filter((typeId) => typeId !== "type.unresolved").sort(),
  );
  assert.deepEqual(
    MEDICAL_CONTENT_PROFILES["type.muscle"].requiredDetailContainers,
    ["location", "origins", "insertions", "actions", "innervation"],
  );
  assert.deepEqual(
    MEDICAL_CONTENT_PROFILES["type.fascia"].requiredDetailContainers,
    ["location", "attachments", "continuities", "role"],
  );
  assert.equal(MEDICAL_CONTENT_PROFILE_POLICY.inheritance, "direct_concept_claims_only");
  assert.match(MEDICAL_CONTENT_PROFILE_POLICY.notApplicableExceptions, /unsupported/);
});

test("muscle completeness is mandatory for human and source-verified MVP publication", () => {
  for (const editorialStatus of ["published", "source_verified_mvp"]) {
    const incomplete = mergeCuratedConcepts(
      [muscleConcept],
      [publishedPatch(
        muscleConcept,
        localizationSource,
        "descriptor:test",
        editorialStatus,
      )],
    )[0];
    delete incomplete.details.innervation;
    const instance = instanceById.get(incomplete.instanceIds[0]);

    assert.throws(
      () => projectPublishedLearning(
        incomplete,
        publicationContext(incomplete),
        instance.id,
      ),
      /lacks direct medically required detail fields: details\.innervation/,
      editorialStatus,
    );
  }
});

test("parent identity and flat not-applicable markers cannot fill direct medical fields", () => {
  const incomplete = mergeCuratedConcepts(
    [muscleConcept],
    [publishedPatch(muscleConcept)],
  )[0];
  incomplete.parentConceptId = baseConcept.id;
  delete incomplete.details.insertions;
  const instance = instanceById.get(incomplete.instanceIds[0]);
  assert.throws(
    () => projectPublishedLearning(
      incomplete,
      publicationContext(incomplete),
      instance.id,
    ),
    /lacks direct medically required detail fields: details\.insertions/,
  );

  incomplete.notApplicableFields = ["insertion"];
  assert.throws(
    () => projectPublishedLearning(
      incomplete,
      publicationContext(incomplete),
      instance.id,
    ),
    /reasoned, target-hash-bound exception review is required but not yet modeled/,
  );
});

test("connective-tissue publication requires attachment and functional context", () => {
  const incomplete = mergeCuratedConcepts(
    [fasciaConcept],
    [publishedPatch(fasciaConcept, localizationSource, "descriptor:test", "source_verified_mvp")],
  )[0];
  delete incomplete.details.attachments;
  delete incomplete.details.role;
  const instance = instanceById.get(incomplete.instanceIds[0]);

  assert.throws(
    () => projectPublishedLearning(
      incomplete,
      publicationContext(incomplete),
      instance.id,
    ),
    /details\.attachments, details\.role/,
  );
});

test("an MVP patch cannot reuse human roles or anonymous automation", () => {
  const mvp = mergeCuratedConcepts(
    [baseConcept],
    [publishedPatch(baseConcept, localizationSource, "descriptor:test", "source_verified_mvp")],
  )[0];
  const context = publicationContext(mvp);
  const summaryReview = [...context.acceptedAnatomyByClaim.values()].find(
    (review) => review.targetId === "pipeline.summary",
  );
  summaryReview.reviewerRole = "medical_domain_expert";
  summaryReview.reviewerId = "automation:test";

  assert.throws(
    () => projectPublishedLearning(mvp, context, baseInstance.id),
    /required agent reviewer role/,
  );
});

test("all current 496 concepts remain unpublishable without a reviewed anatomical release state", () => {
  for (const concept of concepts) {
    const published = mergeCuratedConcepts([concept], [publishedPatch(concept)])[0];
    const context = publicationContext(published, { includeReleaseState: false });
    assert.throws(
      () => projectPublishedLearning(published, context, concept.instanceIds[0]),
      /hard-blocked from publication|unresolved or derived terminology|lacks a curated anatomical release state/,
      concept.id,
    );
  }
});

test("stale or automated anatomical release reviews cannot unlock publication", () => {
  const published = mergeCuratedConcepts([baseConcept], [publishedPatch()])[0];
  const staleState = releaseStateFor(published);
  staleState.reviews.classification.targetHash = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => projectPublishedLearning(
      published,
      publicationContext(published, { releaseState: staleState }),
      baseInstance.id,
    ),
    /classification review is stale/,
  );

  const automatedState = releaseStateFor(published);
  automatedState.reviews.meshMapping.reviewerId = "automation:test-reviewer";
  assert.throws(
    () => projectPublishedLearning(
      published,
      publicationContext(published, { releaseState: automatedState }),
      baseInstance.id,
    ),
    /human review cannot be attributed to automation or an agent/,
  );
});

test("German MeSH localization requires an exact DescriptorUI locator object", () => {
  const germanMesh = registeredSources.find(
    (source) => source.id === "source.localization.german_mesh.2025_v30",
  );
  const invalidPublished = mergeCuratedConcepts(
    [baseConcept],
    [publishedPatch(baseConcept, germanMesh, "DescriptorUI:D000001")],
  )[0];
  assert.throws(
    () => projectPublishedLearning(
      invalidPublished,
      publicationContext(invalidPublished),
      baseInstance.id,
    ),
    /German MeSH with an exact DescriptorUI locator/,
  );

  const validPublished = mergeCuratedConcepts(
    [baseConcept],
    [publishedPatch(baseConcept, germanMesh, {
      kind: "mesh_descriptor",
      descriptorUi: "D000001",
    })],
  )[0];
  assert.doesNotThrow(() => projectPublishedLearning(
    validPublished,
    publicationContext(validPublished),
    baseInstance.id,
  ));
});

test("the checked-in zero-learning runtime remains byte-reproducible", () => {
  const expected = serializeJson(buildTerminologyOutputs().get(TERMINOLOGY_PATHS.runtimeIndex));
  const actual = fs.readFileSync(path.join(ROOT, TERMINOLOGY_PATHS.runtimeIndex), "utf8");
  assert.equal(actual, expected);
  assert.equal(JSON.parse(actual).some((entry) => entry.learning), false);
});

test("curated patches cannot override generator-owned identity, mapping or terminology", () => {
  const protectedPatch = {
    conceptId: baseConcept.id,
    classification: { anatomicalTypeId: "type.muscle" },
  };
  assert.throws(
    () => mergeCuratedConcepts([baseConcept], [protectedPatch]),
    /cannot override generated field 'classification'/,
  );
  const errors = validateJsonSchema(
    readJson("content/schemas/v2/concept-patch.schema.json"),
    protectedPatch,
    "protected patch",
  );
  assert.ok(errors.some((error) => error.includes("classification is not allowed")));
});

test("claim fields must match their semantic container", () => {
  const invalid = publishedPatch();
  invalid.details.location[0].field = "action";
  assert.throws(
    () => mergeCuratedConcepts([baseConcept], [invalid]),
    /details\.location expects field 'location', got 'action'/,
  );
});

test("duplicate review ids and duplicate review targets are rejected", () => {
  const record = {
    id: "review.pipeline.duplicate_a",
    targetType: "claim",
    targetId: "pipeline.summary",
    status: "needs_review",
  };
  assert.throws(
    () => collectHumanReviewGates([
      { reviewArea: "anatomical_content", records: [record, { ...record }] },
    ]),
    /Duplicate review id/,
  );
  assert.throws(
    () => collectHumanReviewGates([
      {
        reviewArea: "anatomical_content",
        records: [record, { ...record, id: "review.pipeline.duplicate_b" }],
      },
    ]),
    /Duplicate review target/,
  );
});

test("MVP and human reviews for the same target coexist without overwriting audit state", () => {
  const sharedTarget = "pipeline.summary";
  const records = [
    {
      id: "review.pipeline.same_target_mvp",
      targetType: "claim",
      targetId: sharedTarget,
      targetHash: `sha256:${"1".repeat(64)}`,
      status: "accepted",
      authorId: "agent:test-author",
      reviewerId: "agent:test-independent-reviewer",
      reviewerRole: "source_research_reviewer",
      verificationTier: "source_verified_mvp",
    },
    {
      id: "review.pipeline.same_target_human",
      targetType: "claim",
      targetId: sharedTarget,
      targetHash: `sha256:${"1".repeat(64)}`,
      status: "accepted",
      authorId: "editor:test-author",
      reviewerId: "expert:test-anatomist",
      reviewerRole: "medical_domain_expert",
      verificationTier: "human_reviewed",
    },
  ];

  const gates = collectHumanReviewGates([
    { reviewArea: "anatomical_content", records },
  ]);
  assert.equal(gates.acceptedAnatomyByClaim.size, 2);
  assert.equal(
    gates.acceptedAnatomyByClaim.get(`source_verified_mvp:${sharedTarget}`).id,
    "review.pipeline.same_target_mvp",
  );
  assert.equal(
    gates.acceptedAnatomyByClaim.get(`human_reviewed:${sharedTarget}`).id,
    "review.pipeline.same_target_human",
  );
});

test("the four stop-line concepts are explicitly hard-blocked from learning publication", () => {
  assert.deepEqual(
    [...HARD_PUBLICATION_BLOCKS.keys()].sort(),
    [
      "concept.soft_tissue.iliocostalis_colli_muscle",
      "concept.soft_tissue.iliopsoas_fascia",
      "concept.soft_tissue.tendon_of_extensor_digitorum_longus",
      "concept.soft_tissue.trochanteric_bursa_of_gluteus_medius_muscle",
    ],
  );
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  for (const conceptId of HARD_PUBLICATION_BLOCKS.keys()) {
    const concept = conceptById.get(conceptId);
    for (const editorialStatus of ["published", "source_verified_mvp"]) {
      const released = mergeCuratedConcepts(
        [concept],
        [publishedPatch(concept, localizationSource, "descriptor:test", editorialStatus)],
      )[0];
      assert.throws(
        () => projectPublishedLearning(released, {
          sourceById: new Map(),
          acceptedAnatomyByClaim: new Map(),
          acceptedLocalizationByConcept: new Map(),
        }),
        /hard-blocked from publication/,
        `${conceptId}:${editorialStatus}`,
      );
    }
  }
});

test("preferredLatin must equal the pinned official TA2 Latin field", () => {
  const patch = publishedPatch();
  patch.names.preferredLatin = "Invented Latin";
  const published = mergeCuratedConcepts([baseConcept], [patch])[0];
  assert.throws(
    () => projectPublishedLearning(published, publicationContext(published)),
    /preferredLatin must equal its pinned official TA2 Latin field/,
  );
});

test("curated sources append uniquely without altering the four base registrations", () => {
  const generatorOwnedSources = registeredSources.slice(0, 4);
  assert.equal(generatorOwnedSources.length, 4);
  assert.equal(registeredSources[4].id, "source.localization.german_mesh.2025_v30");
  const merged = mergeCuratedSources(generatorOwnedSources, [localizationSource]);
  assert.deepEqual(merged.slice(0, 4), generatorOwnedSources);
  assert.equal(merged[4].id, localizationSource.id);
  assert.throws(
    () => mergeCuratedSources(generatorOwnedSources, [{ ...localizationSource, id: generatorOwnedSources[0].id }]),
    /Duplicate registered source/,
  );
  assert.throws(
    () => mergeCuratedSources(generatorOwnedSources, [{ ...localizationSource, id: "source.test.asset", sourceType: "asset" }]),
    /cannot replace or extend generator-owned assets/,
  );
});
