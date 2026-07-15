import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  ASSET_DEFINITIONS,
  buildFoundationOutputs,
  buildInstances,
  EXPECTED_FOUNDATION_COUNTS,
  FOUNDATION_OUTPUT_PATHS,
  loadFoundationInputs,
  readJson,
  ROOT,
  sha256,
} from "./lib/content-v2-foundation.mjs";
import {
  buildRuntimeIndex,
  buildTerminologySources,
  buildTerminologyOutputs,
  EXPECTED_TERMINOLOGY_COUNTS,
  FIPAT_SOURCE_DEFINITIONS,
  TERMINOLOGY_PATHS,
} from "./lib/content-v2-terminology.mjs";
import {
  assertSupportedSchema,
  assertValidJsonSchema,
} from "./lib/json-schema-validator.mjs";
import {
  assertConceptClaimSemantics,
  assertPublishedLearningGates,
  assertReviewedReleaseState,
  assertSourceSpecificLocator,
  collectHumanReviewGates,
  collectClaims,
  contentHash,
} from "./lib/content-v2-publish-gate.mjs";

const SCHEMA_PATHS = Object.freeze([
  "content/schemas/v2/catalog.schema.json",
  "content/schemas/v2/instance.schema.json",
  "content/schemas/v2/concept.schema.json",
  "content/schemas/v2/concept-patch.schema.json",
  "content/schemas/v2/source.schema.json",
  "content/schemas/v2/review.schema.json",
  "content/schemas/v2/release-state.schema.json",
  "content/schemas/v2/ta2-term.schema.json",
  "content/schemas/v2/runtime-index-entry.schema.json",
]);

const EXPECTED_INSTANCE_TYPE_COUNTS = Object.freeze({
  "type.aponeurosis": 6,
  "type.bone": 210,
  "type.cartilage": 31,
  "type.cavity": 8,
  "type.eyelid_tarsus": 4,
  "type.fascia": 39,
  "type.fascial_arch": 4,
  "type.fascial_septum": 14,
  "type.fascial_tract": 2,
  "type.ligament": 6,
  "type.muscle": 462,
  "type.muscle_trochlea": 2,
  "type.retinaculum": 18,
  "type.synovial_bursa": 78,
  "type.tendinous_structure": 2,
  "type.tendon": 6,
  "type.tendon_sheath": 26,
  "type.tooth": 28,
});

function fail(message) {
  throw new Error(message);
}

function requireCondition(condition, message) {
  if (!condition) fail(message);
}

function requireUnique(values, label) {
  requireCondition(new Set(values).size === values.length, `${label} must be unique`);
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, "en")));
}

function fileHash(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function resolveContentPath(relativePath) {
  requireCondition(typeof relativePath === "string" && relativePath.length > 0, "Catalog path must be non-empty");
  requireCondition(!path.isAbsolute(relativePath), `Catalog path '${relativePath}' must be relative`);
  const contentRoot = path.join(ROOT, "content");
  const resolved = path.resolve(ROOT, "content/v2", relativePath);
  requireCondition(
    resolved === contentRoot || resolved.startsWith(`${contentRoot}${path.sep}`),
    `Catalog path '${relativePath}' escapes content/`,
  );
  requireCondition(fs.existsSync(resolved), `Catalog path '${relativePath}' does not exist`);
  return resolved;
}

function verifyGeneratedFiles() {
  for (const outputs of [buildFoundationOutputs(), buildTerminologyOutputs()]) {
    for (const [relativePath, expected] of outputs) {
      const actual = readJson(relativePath);
      requireCondition(
        isDeepStrictEqual(actual, expected),
        `${relativePath} is stale; rebuild it and review the diff`,
      );
    }
  }
}

function validateSchemasAndCollections(catalog) {
  const schemaIds = [];
  for (const schemaPath of SCHEMA_PATHS) {
    const schema = readJson(schemaPath);
    assertSupportedSchema(schema, schemaPath);
    requireCondition(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${schemaPath} must use JSON Schema 2020-12`);
    requireCondition(typeof schema.$id === "string" && schema.$id.length > 0, `${schemaPath} needs a stable $id`);
    requireCondition(schema.additionalProperties === false, `${schemaPath} must reject unknown root properties`);
    schemaIds.push(schema.$id);
  }
  requireUnique(schemaIds, "JSON Schema ids");

  const catalogSchema = readJson("content/schemas/v2/catalog.schema.json");
  assertValidJsonSchema(catalogSchema, catalog, "content/v2/catalog.json");
  requireCondition(catalog.stage === "content_migration", "Phase B catalog must be at content_migration stage");
  resolveContentPath(catalog.$schema);
  resolveContentPath(catalog.legacySnapshot);

  const collections = [
    catalog.collections.instances,
    ...catalog.collections.concepts,
    catalog.collections.curatedConcepts,
    catalog.collections.sources,
    catalog.collections.curatedSources,
    catalog.collections.releaseStates,
    catalog.collections.terminology,
    catalog.collections.runtimeIndex,
  ];
  for (const collection of collections) {
    const collectionPath = resolveContentPath(collection.path);
    const schemaPath = resolveContentPath(collection.itemSchema);
    const values = JSON.parse(fs.readFileSync(collectionPath, "utf8"));
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    requireCondition(Array.isArray(values), `${collection.path} must be an array collection`);
    values.forEach((value, index) => {
      assertValidJsonSchema(schema, value, `${collection.path}[${index}]`);
    });
  }

  const conceptSchema = readJson("content/schemas/v2/concept.schema.json");
  readJson("content/v2/concepts/stubs.json").forEach((value, index) => {
    assertValidJsonSchema(conceptSchema, value, `concepts/stubs.json[${index}]`);
  });

  const reviewSchema = readJson("content/schemas/v2/review.schema.json");
  for (const reviewPath of catalog.reviews) {
    const absolutePath = resolveContentPath(reviewPath);
    const review = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    assertValidJsonSchema(reviewSchema, review, reviewPath);
  }
}

function validateTaxonomy(relativePath, taxonomyId, prefix) {
  const taxonomy = readJson(relativePath);
  requireCondition(taxonomy.schemaVersion === 2, `${relativePath} must use schemaVersion 2`);
  requireCondition(taxonomy.taxonomyId === taxonomyId, `${relativePath} has the wrong taxonomy id`);
  requireCondition(Array.isArray(taxonomy.values) && taxonomy.values.length > 0, `${relativePath} needs values`);
  const ids = taxonomy.values.map((value) => {
    requireCondition(
      value && Object.keys(value).sort().join(",") === "id,labelDe",
      `${relativePath} taxonomy entries must contain only id and labelDe`,
    );
    requireCondition(value.id.startsWith(prefix), `${relativePath} id '${value.id}' has the wrong prefix`);
    requireCondition(typeof value.labelDe === "string" && value.labelDe.length > 0, `${relativePath} '${value.id}' needs a label`);
    return value.id;
  });
  requireUnique(ids, `${relativePath} ids`);
  return new Set(ids);
}

function validateFoundation(inputs, snapshot, instances, stubs) {
  requireCondition(instances.length === EXPECTED_FOUNDATION_COUNTS.instances, "Instance count must remain 946");
  requireCondition(stubs.length === EXPECTED_FOUNDATION_COUNTS.concepts, "Concept count must remain 496");
  requireUnique(instances.map((entry) => entry.id), "instance ids");
  requireUnique(instances.map((entry) => entry.meshName), "exact mesh names");
  requireUnique(stubs.map((entry) => entry.id), "foundation concept ids");
  requireCondition(
    isDeepStrictEqual(instances, buildInstances(inputs)),
    "instances.json no longer matches the deterministic exact-mesh projection",
  );
  requireCondition(
    instances.every((entry) => entry.mapping.method === "exact_mesh_name" && entry.mapping.status === "verified"),
    "All 946 instances must retain exact verified mesh mapping",
  );
  requireCondition(
    instances.filter((entry) => entry.availability.legacyQuizEligible).length === EXPECTED_FOUNDATION_COUNTS.quizEligible,
    "Legacy quiz pool must remain 739 instances",
  );
  requireCondition(
    stubs.every(
      (concept) => concept.classification.reviewStatus === "unreviewed" && concept.editorialStatus === "draft",
    ),
    "Foundation stubs may not claim a performed review",
  );

  requireCondition(snapshot.schemaVersion === 2, "Legacy snapshot schemaVersion changed");
  requireCondition(snapshot.counts.instances === 946 && snapshot.counts.concepts === 496, "Legacy snapshot counts changed");
  requireCondition(
    isDeepStrictEqual(snapshot.instanceIds, inputs.legacyStructures.map((entry) => entry.id)),
    "Legacy snapshot stable ids differ from content/structures.json",
  );
  requireCondition(
    isDeepStrictEqual(
      snapshot.quizEligibleIds,
      inputs.legacyStructures.filter((entry) => entry.quizEligible).map((entry) => entry.id),
    ),
    "Legacy snapshot quiz ids differ from the frozen compatibility pool",
  );
  for (const [relativePath, metadata] of Object.entries(snapshot.files)) {
    requireCondition(sha256(relativePath) === metadata.sha256, `Legacy snapshot hash is stale for ${relativePath}`);
  }
}

function validateSources(sources) {
  requireCondition(sources.length >= 4, "The four generator-owned base sources must remain registered");
  requireUnique(sources.map((source) => source.id), "source ids");
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const baseSources = buildTerminologySources();
  requireCondition(baseSources.length === 4, "The generator must retain exactly four base source definitions");
  for (const expected of baseSources) {
    requireCondition(
      isDeepStrictEqual(sourceById.get(expected.id), expected),
      `Generator-owned base source '${expected.id}' changed`,
    );
  }
  const curatedSources = readJson(TERMINOLOGY_PATHS.curatedSources);
  requireCondition(
    isDeepStrictEqual(sources, buildTerminologySources(curatedSources)),
    "sources.json must be the exact ordered base + curated source registry",
  );
  for (const source of curatedSources) {
    requireCondition(source.sourceType !== "asset", `${source.id} may not extend generator-owned assets`);
    requireCondition(
      /^[a-f0-9]{64}$/.test(source.snapshot?.sha256 || ""),
      `${source.id} needs a pinned curated snapshot hash`,
    );
  }
  for (const asset of ASSET_DEFINITIONS) {
    const source = sourceById.get(asset.sourceId);
    requireCondition(source?.sourceType === "asset", `Missing asset source '${asset.sourceId}'`);
    requireCondition(source.asset.sha256 === sha256(asset.path), `${asset.sourceId} has a stale asset hash`);
    requireCondition(
      isDeepStrictEqual(source.supports, ["mesh_identity", "geometry_provenance"]),
      `${asset.sourceId} must not authorize terminology or medical claims`,
    );
  }
  for (const [part, expected] of Object.entries(FIPAT_SOURCE_DEFINITIONS)) {
    const source = sourceById.get(expected.id);
    requireCondition(source?.sourceType === "terminology", `Missing official FIPAT source '${expected.id}'`);
    requireCondition(source.url === expected.url, `${expected.id} URL changed`);
    requireCondition(source.document.sha256 === expected.sha256, `${expected.id} SHA-256 changed`);
    requireCondition(source.version.includes("2.07"), `${expected.id} must pin TA2 2.07`);
    requireCondition(
      isDeepStrictEqual(source.supports, ["terminology", "classification"]),
      `${expected.id} must support terminology/classification only`,
    );
    const optionalPdf = `/tmp/FIPAT-TA2-${part === "part2" ? "Part-2" : "Part-5"}.pdf`;
    if (fs.existsSync(optionalPdf)) {
      requireCondition(fileHash(optionalPdf) === expected.sha256, `${optionalPdf} differs from its registered source hash`);
    }
  }
  return sourceById;
}

function walkSourceRefs(value, callback, pathLabel = "root", seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (
    !Array.isArray(value) &&
    typeof value.sourceId === "string" &&
    Object.prototype.hasOwnProperty.call(value, "locator")
  ) {
    callback(value, pathLabel);
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => walkSourceRefs(child, callback, `${pathLabel}[${index}]`, seen));
  } else {
    for (const [key, child] of Object.entries(value)) {
      walkSourceRefs(child, callback, `${pathLabel}.${key}`, seen);
    }
  }
}

function validateSourceRefs(values, sourceById, termById) {
  for (const [label, value] of values) {
    walkSourceRefs(value, (sourceRef, refPath) => {
      const source = sourceById.get(sourceRef.sourceId);
      requireCondition(Boolean(source), `${label}:${refPath} has unresolved source '${sourceRef.sourceId}'`);
      assertSourceSpecificLocator(source, sourceRef, `${label}:${refPath}`);
      if (typeof sourceRef.locator === "string") {
        requireCondition(sourceRef.locator.trim().length > 0, `${label}:${refPath} has an empty locator`);
        return;
      }
      const locator = sourceRef.locator;
      if (locator.kind === "mesh_descriptor") return;
      requireCondition(source.sourceType === "terminology", `${label}:${refPath} uses a PDF locator on a non-terminology source`);
      requireCondition(locator.kind === "pdf_term_row", `${label}:${refPath} has an unsupported locator kind`);
      const term = termById.get(locator.termId);
      requireCondition(Boolean(term), `${label}:${refPath} references unregistered TA2 ${locator.termId}`);
      const fieldName = locator.column === "latin" ? "latin" : "englishUk";
      requireCondition(
        isDeepStrictEqual(term.fields[fieldName].sourceRef, sourceRef),
        `${label}:${refPath} locator does not match TA2 ${locator.termId} ${locator.column}`,
      );
    });
  }
}

function assertNoSyntheticTermIds(value, label) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["termId", "baseTermId", "relatedTermId"].includes(key)) {
      requireCondition(Number.isInteger(child) && child > 0, `${label}.${key} must be a positive official integer`);
    }
    assertNoSyntheticTermIds(child, `${label}.${key}`);
  }
}

function validateTerminology(
  concepts,
  instances,
  terms,
  runtimeIndex,
  typeIds,
  relationTypeIds,
  sourceById,
  reviewGates,
) {
  requireCondition(concepts.length === EXPECTED_TERMINOLOGY_COUNTS.concepts, "Terminology concept count must be 496");
  requireCondition(terms.length === EXPECTED_TERMINOLOGY_COUNTS.selectedTerms, "Selected TA2 registry must contain 424 used terms");
  requireCondition(runtimeIndex.length === EXPECTED_TERMINOLOGY_COUNTS.instances, "Runtime index must contain 946 entries");
  requireUnique(concepts.map((concept) => concept.id), "terminology concept ids");
  requireUnique(terms.map((term) => term.termId), "selected official TA2 term ids");
  requireUnique(runtimeIndex.map((entry) => entry.id), "runtime instance ids");
  requireUnique(runtimeIndex.map((entry) => entry.meshName), "runtime exact mesh names");
  const termById = new Map(terms.map((term) => [term.termId, term]));
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
  const curatedConceptIds = new Set(
    readJson(TERMINOLOGY_PATHS.curatedConcepts).map((patch) => patch.conceptId),
  );

  const officialConcepts = concepts.filter((concept) => concept.terminology.status === "official_base");
  const derivedConcepts = concepts.filter((concept) => concept.terminology.status === "derived_structure");
  requireCondition(officialConcepts.length === 495, "Exactly 495/496 concepts need an official TA2 base term");
  requireCondition(derivedConcepts.length === 1, "Exactly one concept must remain a derived structure");
  requireCondition(
    officialConcepts.reduce((sum, concept) => sum + concept.instanceIds.length, 0) === 944,
    "Exactly 944/946 instances need an official/base TA2 mapping",
  );
  requireCondition(
    isDeepStrictEqual(countBy(concepts.map((concept) => concept.terminology.match.method)), EXPECTED_TERMINOLOGY_COUNTS.methods),
    "Terminology match-method distribution changed",
  );

  for (const concept of concepts) {
    assertConceptClaimSemantics(concept);
    if (!curatedConceptIds.has(concept.id)) {
      requireCondition(concept.editorialStatus === "draft", `${concept.id} must remain generated draft`);
      requireCondition(concept.evidenceStatus === "partial", `${concept.id} must remain generated partial content`);
      requireCondition(
        !concept.names && !concept.summary && !concept.claims && !concept.details && !concept.relations,
        `${concept.id} contains editorial data outside the curated patch layer`,
      );
    }
    requireCondition(typeIds.has(concept.classification.anatomicalTypeId), `${concept.id} has an unknown anatomical type`);
    requireCondition(concept.classification.status === "partial", `${concept.id} classification must remain partial`);
    requireCondition(
      concept.classification.reviewStatus === "machine_inferred_from_asset_label" &&
        concept.classification.method === "legacy_asset_label_taxonomy",
      `${concept.id} classification must not claim anatomical verification`,
    );
    requireCondition(concept.classification.regionIds.length === 1 && concept.classification.regionIds[0] === "region.unresolved", `${concept.id} invents a region in Phase B`);
    requireCondition(
      concept.classification.sourceRefs.length === 1 &&
        sourceById.get(concept.classification.sourceRefs[0].sourceId)?.sourceType === "asset",
      `${concept.id} classification must cite only its exact asset-label provenance`,
    );
    for (const instanceId of concept.instanceIds) {
      requireCondition(instanceById.get(instanceId)?.conceptId === concept.id, `${concept.id} has an invalid instance projection`);
    }
    for (const relation of concept.relations || []) {
      requireCondition(
        relationTypeIds.has(relation.relationTypeId),
        `${concept.id} uses unknown relation type '${relation.relationTypeId}'`,
      );
      requireCondition(
        conceptById.has(relation.targetConceptId),
        `${concept.id} relation targets missing concept '${relation.targetConceptId}'`,
      );
      requireCondition(
        relation.sourceRefs.every((ref) => sourceById.get(ref.sourceId)?.supports.includes("anatomical_claims")),
        `${concept.id} relation cites a source not registered for anatomical claims`,
      );
    }

    if (concept.terminology.status === "official_base") {
      const term = termById.get(concept.terminology.baseTerm.termId);
      requireCondition(Boolean(term), `${concept.id} references missing official TA2 ${concept.terminology.baseTerm.termId}`);
      requireCondition(
        isDeepStrictEqual(concept.terminology.baseTerm.fields, term.fields),
        `${concept.id} changes the pinned primary official fields`,
      );
    } else {
      requireCondition(
        concept.id === "concept.soft_tissue.tendon_of_extensor_digitorum_longus",
        `Unexpected derived concept '${concept.id}'`,
      );
      requireCondition(concept.terminology.derivedFrom.officialTerm.termId === 2645, "Derived tendon must relate to official muscle TA2 2645");
      requireCondition(
        concept.terminology.derivedFrom.targetConceptId === "concept.soft_tissue.extensor_digitorum_longus",
        "Derived tendon target concept changed",
      );
      requireCondition(concept.terminology.match.status === "expert_review_required", "Derived structure must remain expert-review-required");
    }
    assertNoSyntheticTermIds(concept.terminology, concept.id);
  }

  const specialCases = new Map(concepts.map((concept) => [concept.workingLabel, concept]));
  const expectTerm = (label, termId, method) => {
    const concept = specialCases.get(label);
    requireCondition(Boolean(concept), `Missing special case '${label}'`);
    requireCondition(concept.terminology.baseTerm?.termId === termId, `${label} must map to official TA2 ${termId}`);
    requireCondition(concept.terminology.match.method === method, `${label} must use ${method}`);
  };
  expectTerm("Cruciform part of fibrous sheath of digit of hand", 2586, "exact_v2_07");
  expectTerm("Tendon sheath of extensors carpi radialis", 2578, "exact_v2_07");
  expectTerm("Tendon sheath of extensor digitorum and extensor indicis", 2580, "exact_v2_07");
  expectTerm("Subfacial prepatellar bursa", 2736, "mesh_typo");
  expectTerm("Tendon sheath of tibialis anterior", 2756, "reviewed_alias");
  expectTerm("Trochanteric bursa of gluteus medius muscle", 2725, "reviewed_alias");
  expectTerm("Third rib", 1118, "series_variant");
  expectTerm("Vertebra C7", 1057, "reviewed_alias");
  expectTerm("Vertebra T1", 1063, "reviewed_alias");

  const actualRuntime = buildRuntimeIndex(instances, concepts, {
    sourceById,
    ...reviewGates,
  });
  requireCondition(isDeepStrictEqual(runtimeIndex, actualRuntime), "runtime-index.json is not the exact generated projection");
  requireCondition(
    new Set(runtimeIndex.map((entry) => entry.conceptId)).size === 496,
    "Runtime index must cover all 496 concepts",
  );
  requireCondition(
    runtimeIndex.filter((entry) => entry.terminology.status === "derived_structure").length === 2,
    "Runtime index must expose exactly two derived tendon instances",
  );
  for (const entry of runtimeIndex) {
    const instance = instanceById.get(entry.id);
    requireCondition(instance?.meshName === entry.meshName && instance.conceptId === entry.conceptId, `${entry.id} runtime mapping is stale`);
    const concept = conceptById.get(entry.conceptId);
    if (entry.learning) {
      requireCondition(concept.editorialStatus === "published", `${entry.id} projects unpublished learning`);
      requireCondition(entry.learning.status === "published", `${entry.id} has a non-published learning payload`);
      requireCondition(
        concept.terminology.status === "official_base" &&
          concept.terminology.match.status !== "expert_review_required",
        `${entry.id} projects learning behind an unresolved terminology gate`,
      );
    } else {
      requireCondition(
        !/nameDe|preferredDe|summary|claims|details|funFact/.test(JSON.stringify(entry)),
        `${entry.id} runtime index leaks editorial copy outside learning`,
      );
    }
    assertNoSyntheticTermIds(entry.terminology, `runtime.${entry.id}`);
  }
  requireCondition(
    isDeepStrictEqual(countBy(runtimeIndex.map((entry) => entry.classification.typeId)), EXPECTED_INSTANCE_TYPE_COUNTS),
    "Runtime anatomical-type counts changed",
  );

  validateSourceRefs(
    [
      ["selected terms", terms],
      ["terminology concepts", concepts],
      ["runtime index", runtimeIndex],
    ],
    sourceById,
    termById,
  );

  return { conceptById, termById };
}

function validateReleaseStates(
  releaseStates,
  concepts,
  instances,
  sourceById,
  termById,
  typeIds,
  regionIds,
) {
  requireUnique(releaseStates.map((state) => state.conceptId), "curated release-state concept ids");
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
  const releaseStateByConcept = new Map(
    releaseStates.map((releaseState) => [releaseState.conceptId, releaseState]),
  );
  const releaseReviewIds = [];
  for (const releaseState of releaseStates) {
    const concept = conceptById.get(releaseState.conceptId);
    requireCondition(Boolean(concept), `${releaseState.conceptId} release state targets a missing concept`);
    assertReviewedReleaseState({
      concept,
      releaseState,
      sourceById,
      instanceById,
      typeIds,
      regionIds,
    });
    for (const review of Object.values(releaseState.reviews)) {
      releaseReviewIds.push(review.reviewId);
    }
  }
  requireUnique(releaseReviewIds, "curated release review ids");
  validateSourceRefs([[TERMINOLOGY_PATHS.releaseStates, releaseStates]], sourceById, termById);
  return { releaseStateByConcept, instanceById, releaseReviewIds };
}

function validateReviewsAndPublishGate(
  catalog,
  concepts,
  instances,
  sourceById,
  termById,
  releaseContext,
  typeIds,
  regionIds,
) {
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const instanceById = new Map(instances.map((instance) => [instance.id, instance]));
  const claims = concepts.flatMap((concept) => collectClaims(concept).map((claim) => ({ concept, claim })));
  requireUnique(claims.map(({ claim }) => claim.claimId), "global claim ids");
  const claimById = new Map(claims.map(({ claim }) => [claim.claimId, claim]));
  const reviewLedgers = catalog.reviews.map((reviewPath) => readJson(`content/v2/${reviewPath}`));
  const reviewGates = collectHumanReviewGates(reviewLedgers);
  const ledgerReviewIds = reviewLedgers.flatMap((ledger) =>
    ledger.records.map((record) => record.id)
  );
  requireUnique(ledgerReviewIds, "review-ledger ids");
  const releaseReviewIdSet = new Set(releaseContext.releaseReviewIds);
  for (const reviewId of ledgerReviewIds) {
    requireCondition(
      !releaseReviewIdSet.has(reviewId),
      `Review id '${reviewId}' is duplicated between a ledger and a release state`,
    );
  }

  for (const [index, reviewPath] of catalog.reviews.entries()) {
    const review = reviewLedgers[index];
    for (const record of review.records) {
      if (record.targetType === "instance") {
        requireCondition(instanceById.has(record.targetId), `${record.id} targets a missing instance`);
      } else if (record.targetType === "concept") {
        requireCondition(conceptById.has(record.targetId), `${record.id} targets a missing concept`);
      } else if (record.targetType === "names") {
        requireCondition(conceptById.get(record.targetId)?.names, `${record.id} targets missing concept names`);
      } else if (record.targetType === "claim") {
        requireCondition(claimById.has(record.targetId), `${record.id} targets a missing claim`);
      } else if (record.targetType === "catalog") {
        requireCondition(record.targetId === catalog.catalogId, `${record.id} targets a different catalog`);
      }
      if (["accepted", "changes_requested"].includes(record.status)) {
        requireCondition(record.authorId !== record.reviewerId, `${record.id} author/reviewer must be independent`);
        let expectedHash;
        if (review.reviewArea === "mesh_mapping" && record.targetType === "catalog") {
          expectedHash = `sha256:${sha256(FOUNDATION_OUTPUT_PATHS.instances)}`;
        } else if (record.targetType === "instance") {
          expectedHash = contentHash(instanceById.get(record.targetId));
        } else if (record.targetType === "concept") {
          expectedHash = contentHash(conceptById.get(record.targetId));
        } else if (record.targetType === "names") {
          expectedHash = contentHash(conceptById.get(record.targetId).names);
        } else if (record.targetType === "claim") {
          expectedHash = contentHash(claimById.get(record.targetId));
        } else {
          expectedHash = contentHash(catalog);
        }
        requireCondition(record.targetHash === expectedHash, `${record.id} is stale or not target-bound`);
      }
    }
    validateSourceRefs([[reviewPath, review]], sourceById, termById);
  }

  for (const { claim } of claims) {
    if (claim.evidenceStatus === "sourced") {
      requireCondition(claim.sourceRefs.length > 0, `${claim.claimId} is sourced without a source`);
      requireCondition(
        claim.sourceRefs.every((ref) => sourceById.get(ref.sourceId)?.supports.includes("anatomical_claims")),
        `${claim.claimId} cites a source not registered for anatomical claims`,
      );
    }
  }
  for (const concept of concepts) {
    assertPublishedLearningGates({
      concept,
      sourceById,
      ...reviewGates,
      releaseStateByConcept: releaseContext.releaseStateByConcept,
      instanceById: releaseContext.instanceById,
      typeIds,
      regionIds,
    });
  }
  return {
    ...reviewGates,
    releaseStateByConcept: releaseContext.releaseStateByConcept,
    instanceById: releaseContext.instanceById,
    typeIds,
    regionIds,
  };
}

function main() {
  verifyGeneratedFiles();
  const inputs = loadFoundationInputs();
  const catalog = readJson(TERMINOLOGY_PATHS.catalog);
  const snapshot = readJson(FOUNDATION_OUTPUT_PATHS.snapshot);
  const instances = readJson(FOUNDATION_OUTPUT_PATHS.instances);
  const stubs = readJson(FOUNDATION_OUTPUT_PATHS.concepts);
  const concepts = readJson(TERMINOLOGY_PATHS.concepts);
  const sources = readJson(TERMINOLOGY_PATHS.sources);
  const terms = readJson(TERMINOLOGY_PATHS.selectedTerms);
  const releaseStates = readJson(TERMINOLOGY_PATHS.releaseStates);
  const runtimeIndex = readJson(TERMINOLOGY_PATHS.runtimeIndex);

  validateSchemasAndCollections(catalog);
  const typeIds = validateTaxonomy("content/v2/taxonomy/anatomical-types.json", "anatomical-types", "type.");
  const regionIds = validateTaxonomy("content/v2/taxonomy/regions.json", "regions", "region.");
  const relationTypeIds = validateTaxonomy("content/v2/taxonomy/relation-types.json", "relation-types", "relation.");
  validateFoundation(inputs, snapshot, instances, stubs);
  const sourceById = validateSources(sources);
  const termById = new Map(terms.map((term) => [term.termId, term]));
  const releaseContext = validateReleaseStates(
    releaseStates,
    concepts,
    instances,
    sourceById,
    termById,
    typeIds,
    regionIds,
  );
  const reviewGates = validateReviewsAndPublishGate(
    catalog,
    concepts,
    instances,
    sourceById,
    termById,
    releaseContext,
    typeIds,
    regionIds,
  );
  validateTerminology(
    concepts,
    instances,
    terms,
    runtimeIndex,
    typeIds,
    relationTypeIds,
    sourceById,
    reviewGates,
  );

  console.log(
    "v2 validation passed: JSON Schemas executed; 946/946 exact meshes; 496 concepts; 495 official bases; 944/946 official/base instances; 0 synthetic TA2 ids.",
  );
  console.log(
    "Classification gate passed: 210 bone, 31 cartilage, 28 tooth, 8 cavity, and 669 typed soft-tissue instances; all remain partial/machine-inferred from legacy asset labels only.",
  );
  console.log(
    `Publish gate passed: ${runtimeIndex.filter((entry) => entry.learning).length} instance learning payload(s); names, claims, classification, regions, laterality, and mesh mapping are source-, hash-, and human-review-bound.`,
  );
}

try {
  main();
} catch (error) {
  console.error(`v2 validation failed: ${error.message}`);
  process.exit(1);
}
