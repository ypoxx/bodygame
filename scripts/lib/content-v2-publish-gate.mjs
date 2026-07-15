import crypto from "node:crypto";

export const DETAIL_FIELD_TO_CLAIM_FIELD = Object.freeze({
  location: "location",
  origins: "origin",
  insertions: "insertion",
  actions: "action",
  innervation: "innervation",
  articulations: "articulation",
  landmarks: "landmark",
  attachments: "attachment",
  role: "role",
  continuities: "continuity",
  contents: "content",
});

const CLAIM_RUNTIME_RIGHTS = new Set(["paraphrase_allowed", "public_domain"]);
const NAME_RUNTIME_RIGHTS = new Set([
  "terminology_only",
  "paraphrase_allowed",
  "public_domain",
]);

export const HARD_PUBLICATION_BLOCKS = Object.freeze(new Map([
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
]));

const GERMAN_MESH_SOURCE_ID = /^source\.(?:terminology|localization)\.german_mesh(?:\.|$)/;
const DESCRIPTOR_UI = /^D[0-9]{6}$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value) {
  return `sha256:${crypto.createHash("sha256").update(canonical(value)).digest("hex")}`;
}

export function collectClaims(concept) {
  const claims = [];
  if (concept.summary) claims.push(concept.summary);
  for (const claim of concept.claims || []) claims.push(claim);
  for (const fieldClaims of Object.values(concept.details || {})) {
    for (const claim of fieldClaims) claims.push(claim);
  }
  return claims;
}

export function assertConceptClaimSemantics(concept) {
  const seenClaimIds = new Set();
  const claimFields = new Set();
  const register = (claim, expectedField, container) => {
    if (!claim || typeof claim !== "object") {
      throw new Error(`${concept.id} ${container} must contain claim objects`);
    }
    if (claim.field !== expectedField) {
      throw new Error(
        `${concept.id} ${container} expects field '${expectedField}', got '${claim.field}'`,
      );
    }
    if (seenClaimIds.has(claim.claimId)) {
      throw new Error(`${concept.id} repeats claim '${claim.claimId}' across editorial containers`);
    }
    seenClaimIds.add(claim.claimId);
    claimFields.add(claim.field);
  };

  if (concept.summary) register(concept.summary, "summary", "summary");
  for (const claim of concept.claims || []) {
    if (claim?.field === "summary") {
      throw new Error(`${concept.id} generic claims may not contain a second summary`);
    }
    register(claim, claim?.field, "claims");
  }
  for (const [container, claims] of Object.entries(concept.details || {})) {
    const expectedField = DETAIL_FIELD_TO_CLAIM_FIELD[container];
    if (!expectedField) {
      throw new Error(`${concept.id} uses unsupported detail container '${container}'`);
    }
    if (!Array.isArray(claims) || claims.length === 0) {
      throw new Error(`${concept.id} detail container '${container}' must not be empty`);
    }
    for (const claim of claims) register(claim, expectedField, `details.${container}`);
  }

  for (const field of concept.notApplicableFields || []) {
    if (claimFields.has(field)) {
      throw new Error(`${concept.id} marks '${field}' not applicable but also supplies a claim`);
    }
  }
}

function requireImmutableSource(source, label) {
  const hash = source?.document?.sha256 || source?.snapshot?.sha256 || source?.asset?.sha256;
  if (!/^[a-f0-9]{64}$/.test(hash || "")) {
    throw new Error(`${label} cites a source without an immutable registered content hash`);
  }
}

export function assertSourceSpecificLocator(source, ref, label) {
  const locator = ref?.locator;
  const isGermanMesh = GERMAN_MESH_SOURCE_ID.test(source?.id || "");
  const isDescriptorLocator =
    locator &&
    typeof locator === "object" &&
    locator.kind === "mesh_descriptor" &&
    DESCRIPTOR_UI.test(locator.descriptorUi || "");
  if (isGermanMesh && !isDescriptorLocator) {
    throw new Error(`${label} must cite German MeSH with an exact DescriptorUI locator`);
  }
  if (!isGermanMesh && locator?.kind === "mesh_descriptor") {
    throw new Error(`${label} uses a German MeSH DescriptorUI locator for a different source`);
  }
}

function sourceForRef(sourceById, ref, label) {
  const source = sourceById.get(ref.sourceId);
  if (!source) throw new Error(`${label} cites unregistered source '${ref.sourceId}'`);
  requireImmutableSource(source, label);
  assertSourceSpecificLocator(source, ref, label);
  return source;
}

export function collectHumanReviewGates(reviewLedgers) {
  const reviewIds = new Set();
  const reviewTargets = new Set();
  const acceptedAnatomyByClaim = new Map();
  const acceptedLocalizationByConcept = new Map();

  for (const ledger of reviewLedgers) {
    for (const record of ledger.records || []) {
      if (reviewIds.has(record.id)) throw new Error(`Duplicate review id '${record.id}'`);
      reviewIds.add(record.id);
      const targetKey = `${ledger.reviewArea}:${record.targetType}:${record.targetId}`;
      if (reviewTargets.has(targetKey)) {
        throw new Error(`Duplicate review target '${targetKey}'`);
      }
      reviewTargets.add(targetKey);

      if (record.status !== "accepted") continue;
      if (record.authorId === record.reviewerId) {
        throw new Error(`${record.id} author/reviewer must be independent`);
      }
      if (ledger.reviewArea === "anatomical_content") {
        if (record.targetType !== "claim") {
          throw new Error(`${record.id} anatomy acceptance must target one claim`);
        }
        if (
          record.reviewerRole !== "medical_domain_expert" ||
          record.reviewerId?.startsWith("automation:")
        ) {
          throw new Error(`${record.id} needs a human medical-domain expert`);
        }
        acceptedAnatomyByClaim.set(record.targetId, record);
      }
      if (ledger.reviewArea === "localization") {
        if (record.targetType !== "names") {
          throw new Error(`${record.id} localization acceptance must target one names object`);
        }
        if (
          record.reviewerRole !== "localization_expert" ||
          record.reviewerId?.startsWith("automation:")
        ) {
          throw new Error(`${record.id} needs a human localization expert`);
        }
        acceptedLocalizationByConcept.set(record.targetId, record);
      }
    }
  }

  return { acceptedAnatomyByClaim, acceptedLocalizationByConcept };
}

export function assertPublishedClaimGates({ concepts, sourceById, acceptedAnatomyByClaim }) {
  for (const concept of concepts) {
    if (concept.editorialStatus !== "published") continue;
    for (const claim of collectClaims(concept)) {
      if (claim.evidenceStatus !== "sourced") {
        throw new Error(`${concept.id} publishes unsourced claim '${claim.claimId}'`);
      }
      if (!Array.isArray(claim.sourceRefs) || claim.sourceRefs.length === 0) {
        throw new Error(`${claim.claimId} is sourced without a source reference`);
      }
      for (const ref of claim.sourceRefs) {
        const source = sourceForRef(sourceById, ref, claim.claimId);
        if (!source.supports.includes("anatomical_claims")) {
          throw new Error(`${claim.claimId} cites a source that does not support anatomical claims`);
        }
        if (!CLAIM_RUNTIME_RIGHTS.has(source.rightsPolicy)) {
          throw new Error(`${claim.claimId} cites a source whose rights policy forbids runtime learning copy`);
        }
      }
      const expertReview = acceptedAnatomyByClaim.get(claim.claimId);
      if (!expertReview) {
        throw new Error(`${claim.claimId} lacks a current, claim-bound expert review`);
      }
      if (expertReview.targetType !== "claim" || expertReview.targetId !== claim.claimId) {
        throw new Error(`${claim.claimId} review is not claim-bound`);
      }
      if (expertReview.reviewerRole !== "medical_domain_expert") {
        throw new Error(`${claim.claimId} review is not from a medical-domain expert`);
      }
      if (
        typeof expertReview.reviewerId !== "string" ||
        expertReview.reviewerId.startsWith("automation:")
      ) {
        throw new Error(`${claim.claimId} review cannot be attributed to automation`);
      }
      if (expertReview.targetHash !== contentHash(claim)) {
        throw new Error(`${claim.claimId} expert review is stale`);
      }
    }
  }
}

export function releaseStateReviewTargets(releaseState) {
  return {
    classification: releaseState.classification,
    regions: releaseState.regions,
    laterality: releaseState.instances.map((instance) => ({
      instanceId: instance.instanceId,
      laterality: instance.laterality,
      lateralitySourceRefs: instance.lateralitySourceRefs,
    })),
    meshMapping: releaseState.instances.map((instance) => ({
      instanceId: instance.instanceId,
      meshMapping: instance.meshMapping,
    })),
  };
}

function assertReleaseReview(review, target, expectedRole, conceptId, area) {
  if (!review || review.status !== "accepted") {
    throw new Error(`${conceptId} lacks accepted human ${area} review`);
  }
  if (review.reviewerRole !== expectedRole || review.reviewerId?.startsWith("automation:")) {
    throw new Error(`${conceptId} ${area} review is not from the required human expert`);
  }
  if (review.authorId === review.reviewerId) {
    throw new Error(`${conceptId} ${area} author/reviewer must be independent`);
  }
  if (review.targetHash !== contentHash(target)) {
    throw new Error(`${conceptId} ${area} review is stale`);
  }
}

export function assertReviewedReleaseState({
  concept,
  releaseState,
  sourceById,
  instanceById,
  typeIds,
  regionIds,
}) {
  if (!releaseState || releaseState.conceptId !== concept.id) {
    throw new Error(`${concept.id} lacks a curated anatomical release state`);
  }
  if (releaseState.classification?.status !== "resolved") {
    throw new Error(`${concept.id} classification is not resolved`);
  }
  if (typeIds && !typeIds.has(releaseState.classification.anatomicalTypeId)) {
    throw new Error(`${concept.id} has an unknown reviewed anatomical type`);
  }
  for (const ref of releaseState.classification.sourceRefs || []) {
    const source = sourceForRef(sourceById, ref, `${concept.id} classification`);
    if (!source.supports.includes("classification")) {
      throw new Error(`${concept.id} classification source is not registered for classification`);
    }
  }

  if (
    releaseState.regions?.status !== "resolved" ||
    !Array.isArray(releaseState.regions.regionIds) ||
    releaseState.regions.regionIds.length === 0 ||
    releaseState.regions.regionIds.includes("region.unresolved")
  ) {
    throw new Error(`${concept.id} anatomical regions are not resolved`);
  }
  if (regionIds && releaseState.regions.regionIds.some((id) => !regionIds.has(id))) {
    throw new Error(`${concept.id} has an unknown reviewed anatomical region`);
  }
  for (const ref of releaseState.regions.sourceRefs || []) {
    const source = sourceForRef(sourceById, ref, `${concept.id} regions`);
    if (!source.supports.includes("anatomical_claims")) {
      throw new Error(`${concept.id} region source is not registered for anatomical claims`);
    }
  }

  const reviewedInstanceIds = (releaseState.instances || []).map((entry) => entry.instanceId);
  if (JSON.stringify(reviewedInstanceIds) !== JSON.stringify(concept.instanceIds)) {
    throw new Error(`${concept.id} release state must cover every instance in canonical order`);
  }
  for (const instanceState of releaseState.instances) {
    if (!(["left", "right", "midline"].includes(instanceState.laterality))) {
      throw new Error(`${instanceState.instanceId} laterality is unresolved`);
    }
    const generatedInstance = instanceById?.get(instanceState.instanceId);
    if (!generatedInstance || generatedInstance.conceptId !== concept.id) {
      throw new Error(`${instanceState.instanceId} release state targets a missing generated instance`);
    }
    if (
      generatedInstance.side !== "unresolved" &&
      generatedInstance.side !== instanceState.laterality
    ) {
      throw new Error(`${instanceState.instanceId} release laterality conflicts with generated identity`);
    }
    for (const ref of instanceState.lateralitySourceRefs || []) {
      const source = sourceForRef(sourceById, ref, `${instanceState.instanceId} laterality`);
      if (!source.supports.includes("geometry_provenance")) {
        throw new Error(`${instanceState.instanceId} laterality lacks geometry provenance`);
      }
    }
    if (instanceState.meshMapping?.status !== "human_verified") {
      throw new Error(`${instanceState.instanceId} mesh mapping is not human verified`);
    }
    for (const ref of instanceState.meshMapping.sourceRefs || []) {
      const source = sourceForRef(sourceById, ref, `${instanceState.instanceId} mesh mapping`);
      if (
        !source.supports.includes("mesh_identity") ||
        !source.supports.includes("geometry_provenance")
      ) {
        throw new Error(`${instanceState.instanceId} mesh mapping lacks registered geometry evidence`);
      }
    }
  }

  const targets = releaseStateReviewTargets(releaseState);
  const reviewIds = Object.values(releaseState.reviews || {}).map((review) => review.reviewId);
  if (new Set(reviewIds).size !== 4) {
    throw new Error(`${concept.id} release review ids must be unique`);
  }
  assertReleaseReview(
    releaseState.reviews?.classification,
    targets.classification,
    "medical_domain_expert",
    concept.id,
    "classification",
  );
  assertReleaseReview(
    releaseState.reviews?.regions,
    targets.regions,
    "medical_domain_expert",
    concept.id,
    "regions",
  );
  assertReleaseReview(
    releaseState.reviews?.laterality,
    targets.laterality,
    "medical_domain_expert",
    concept.id,
    "laterality",
  );
  assertReleaseReview(
    releaseState.reviews?.meshMapping,
    targets.meshMapping,
    "anatomy_asset_expert",
    concept.id,
    "mesh mapping",
  );
}

export function assertPublishedLearningGates({
  concept,
  sourceById,
  acceptedAnatomyByClaim,
  acceptedLocalizationByConcept,
  releaseStateByConcept,
  instanceById,
  typeIds,
  regionIds,
}) {
  if (concept.editorialStatus !== "published") return;
  const hardBlock = HARD_PUBLICATION_BLOCKS.get(concept.id);
  if (hardBlock) {
    throw new Error(`${concept.id} is hard-blocked from publication: ${hardBlock}`);
  }
  assertConceptClaimSemantics(concept);
  if (
    concept.terminology?.status !== "official_base" ||
    concept.terminology?.match?.status === "expert_review_required"
  ) {
    throw new Error(`${concept.id} cannot publish learning for unresolved or derived terminology`);
  }
  const releaseState = releaseStateByConcept?.get(concept.id);
  assertReviewedReleaseState({
    concept,
    releaseState,
    sourceById,
    instanceById,
    typeIds,
    regionIds,
  });
  if (
    !concept.names ||
    !concept.summary ||
    !concept.details ||
    Object.keys(concept.details).length === 0 ||
    concept.evidenceStatus !== "sourced"
  ) {
    throw new Error(`${concept.id} needs sourced names, a summary and details before publication`);
  }
  if (concept.names.preferredLatin !== concept.terminology.baseTerm.fields.latin.value) {
    throw new Error(`${concept.id} preferredLatin must equal its pinned official TA2 Latin field`);
  }
  if ((concept.relations || []).length > 0 || (concept.notApplicableFields || []).length > 0) {
    throw new Error(
      `${concept.id} cannot publish relations or not-applicable assertions before target-bound expert review is modeled`,
    );
  }

  let hasTerminologySource = false;
  let hasLocalizationSource = false;
  for (const ref of concept.names.sourceRefs || []) {
    const source = sourceForRef(sourceById, ref, `${concept.id} names`);
    if (!NAME_RUNTIME_RIGHTS.has(source.rightsPolicy)) {
      throw new Error(`${concept.id} names cite a source whose rights policy forbids runtime names`);
    }
    hasTerminologySource ||= source.supports.includes("terminology");
    hasLocalizationSource ||= source.supports.includes("localization");
  }
  if (!hasTerminologySource || !hasLocalizationSource) {
    throw new Error(`${concept.id} names need registered terminology and localization sources`);
  }
  const localizationReview = acceptedLocalizationByConcept.get(concept.id);
  if (!localizationReview) {
    throw new Error(`${concept.id} names lack a current, names-bound localization review`);
  }
  if (localizationReview.targetHash !== contentHash(concept.names)) {
    throw new Error(`${concept.id} localization review is stale`);
  }

  assertPublishedClaimGates({
    concepts: [concept],
    sourceById,
    acceptedAnatomyByClaim,
  });
  return releaseState;
}

export function projectPublishedLearning(concept, gates, instanceId) {
  if (concept.editorialStatus !== "published") return null;
  const releaseState = assertPublishedLearningGates({ concept, ...gates });
  const instanceState = releaseState.instances.find((entry) => entry.instanceId === instanceId);
  if (!instanceState) {
    throw new Error(`${concept.id} cannot project learning for unreviewed instance '${instanceId}'`);
  }
  const learning = {
    status: "published",
    names: concept.names,
    summary: concept.summary,
    details: concept.details,
    reviewedState: {
      anatomicalTypeId: releaseState.classification.anatomicalTypeId,
      regionIds: releaseState.regions.regionIds,
      side: instanceState.laterality,
      meshMappingStatus: instanceState.meshMapping.status,
    },
  };
  if ((concept.claims || []).length) learning.claims = concept.claims;
  return learning;
}
