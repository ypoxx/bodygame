import crypto from "node:crypto";

import { assertMedicalContentCompleteness } from "./content-v2-completeness.mjs";
import { HARD_PUBLICATION_BLOCKS } from "../../src/anatomy/publicationBlocks.js";
import {
  isRuntimeLearningStatus,
  RUNTIME_LEARNING_STATUSES,
} from "../../src/anatomy/learningStatus.js";

export { HARD_PUBLICATION_BLOCKS } from "../../src/anatomy/publicationBlocks.js";
export {
  isRuntimeLearningStatus,
  RUNTIME_LEARNING_STATUSES,
} from "../../src/anatomy/learningStatus.js";

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

const GERMAN_MESH_SOURCE_ID = /^source\.(?:terminology|localization)\.german_mesh(?:\.|$)/;
const FIPAT_TA2_SOURCE_ID = /^source\.terminology\.fipat\.ta2_2_07\.part_[25]$/;
const DESCRIPTOR_UI = /^D[0-9]{6}$/;
const FASCIA_CONSENSUS_SOURCE_ID = "source.reference.fascia_nomenclature_consensus.2019";
const VIRGINIA_TECH_SOURCE_ID = "source.textbook.virginia_tech.applied_human_anatomy.2022";
const BODYPARTS3D_SOURCE_ID = "source.reference.bodyparts3d.v4_0.isa_tree";

const REVIEW_POLICIES = Object.freeze({
  published: Object.freeze({
      verificationTier: "human_reviewed",
      anatomyRole: "medical_domain_expert",
      localizationRole: "localization_expert",
      releaseMedicalRole: "medical_domain_expert",
      releaseMeshRole: "anatomy_asset_expert",
      meshMappingStatus: "human_verified",
      reviewerKind: "human",
  }),
  source_verified_mvp: Object.freeze({
      verificationTier: "source_verified_mvp",
      anatomyRole: "source_research_reviewer",
      localizationRole: "source_localization_reviewer",
      releaseMedicalRole: "source_research_reviewer",
      releaseMeshRole: "geometry_research_reviewer",
      meshMappingStatus: "source_verified",
      reviewerKind: "agent",
  }),
});

function reviewPolicyForConcept(concept) {
  return REVIEW_POLICIES[concept.editorialStatus] || null;
}

function reviewPolicyForReleaseState(concept, releaseState) {
  return reviewPolicyForConcept(concept) || Object.values(REVIEW_POLICIES).find(
    (policy) => policy.verificationTier === releaseState?.verificationTier,
  ) || null;
}

function assertReviewerIdentity(record, expectedRole, reviewerKind, label) {
  if (record?.reviewerRole !== expectedRole) {
    throw new Error(`${label} review is not from the required ${reviewerKind} reviewer role`);
  }
  if (typeof record.reviewerId !== "string") {
    throw new Error(`${label} review has no reviewer identity`);
  }
  if (reviewerKind === "human") {
    if (record.reviewerId.startsWith("automation:") || record.reviewerId.startsWith("agent:")) {
      throw new Error(`${label} human review cannot be attributed to automation or an agent`);
    }
  } else if (!record.reviewerId.startsWith("agent:")) {
    throw new Error(`${label} MVP review must use an explicit agent reviewer identity`);
  }
}

function reviewMapKey(targetId, verificationTier) {
  return `${verificationTier}:${targetId}`;
}

function acceptedReviewFor(map, targetId, verificationTier) {
  return map.get(reviewMapKey(targetId, verificationTier)) || map.get(targetId);
}

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
  const expectedKind = isGermanMesh
    ? "mesh_descriptor"
    : FIPAT_TA2_SOURCE_ID.test(source?.id || "")
      ? "pdf_term_row"
      : source?.id === FASCIA_CONSENSUS_SOURCE_ID
        ? "jats_element"
        : source?.id === VIRGINIA_TECH_SOURCE_ID
          ? "pdf_page"
          : source?.id === BODYPARTS3D_SOURCE_ID
            ? "tsv_row"
            : "string";
  const actualKind = typeof locator === "string" ? "string" : locator?.kind;

  if (actualKind !== expectedKind) {
    if (expectedKind === "mesh_descriptor") {
      throw new Error(`${label} must cite German MeSH with an exact DescriptorUI locator`);
    }
    if (expectedKind === "pdf_term_row") {
      throw new Error(`${label} must cite FIPAT TA2 with an exact PDF term-row locator`);
    }
    if (expectedKind === "jats_element") {
      throw new Error(`${label} must cite the fascia consensus with an exact JATS element locator`);
    }
    if (expectedKind === "pdf_page") {
      throw new Error(`${label} must cite Applied Human Anatomy with an exact PDF item locator`);
    }
    if (expectedKind === "tsv_row") {
      throw new Error(`${label} must cite BodyParts3D with an exact FMA/representation row locator`);
    }
    throw new Error(
      `${label} uses structured locator '${actualKind || "unknown"}' for a source that requires a textual locator`,
    );
  }

  if (
    expectedKind === "mesh_descriptor" &&
    !DESCRIPTOR_UI.test(locator.descriptorUi || "")
  ) {
    throw new Error(`${label} must cite German MeSH with an exact DescriptorUI locator`);
  }
  if (
    expectedKind === "pdf_term_row" &&
    !(
      Number.isInteger(locator.pdfPage) &&
      locator.pdfPage > 0 &&
      Number.isInteger(locator.termId) &&
      locator.termId > 0 &&
      ["latin", "english_uk"].includes(locator.column)
    )
  ) {
    throw new Error(`${label} must cite FIPAT TA2 with an exact PDF term-row locator`);
  }
  if (
    expectedKind === "jats_element" &&
    !(
      locator.sectionId === "ca23423-sec-0003" &&
      ["ca23423-tbl-0001", "ca23423-tbl-0002"].includes(locator.elementId)
    )
  ) {
    throw new Error(
      `${label} must cite one of the two scoped fascia-consensus definition tables in the Results section`,
    );
  }
  if (
    expectedKind === "pdf_page" &&
    !(
      locator?.kind === "pdf_page" &&
      Number.isInteger(locator.pdfPage) &&
      locator.pdfPage > 0 &&
      typeof locator.section === "string" &&
      locator.section.length > 0 &&
      typeof locator.item === "string" &&
      locator.item.length > 0 &&
      locator.itemKind === "authored_text"
    )
  ) {
    throw new Error(
      `${label} must cite an authored-text item in Applied Human Anatomy with an exact PDF locator`,
    );
  }
  if (
    expectedKind === "tsv_row" &&
    !(
      locator?.kind === "tsv_row" &&
      /^FMA[0-9]+$/.test(locator.rowKey || "") &&
      /^BP[0-9]+$/.test(locator.representationId || "")
    )
  ) {
    throw new Error(`${label} must cite BodyParts3D with an exact FMA/representation row locator`);
  }
}

function sourceForRef(sourceById, ref, label) {
  const source = sourceById.get(ref.sourceId);
  if (!source) throw new Error(`${label} cites unregistered source '${ref.sourceId}'`);
  requireImmutableSource(source, label);
  assertSourceSpecificLocator(source, ref, label);
  return source;
}

function assertExactInstanceAssetRef(ref, generatedInstance, label) {
  if (ref.sourceId !== generatedInstance.sourceId) {
    throw new Error(`${label} cites an asset source that does not own the generated instance`);
  }
  const expectedLocator = `Exact glTF mesh-node name: ${generatedInstance.meshName}`;
  if (ref.locator !== expectedLocator) {
    throw new Error(`${label} must cite the exact generated mesh-node name`);
  }
}

export function collectReviewGates(reviewLedgers) {
  const reviewIds = new Set();
  const reviewTargets = new Set();
  const acceptedAnatomyByClaim = new Map();
  const acceptedLocalizationByConcept = new Map();

  for (const ledger of reviewLedgers) {
    for (const record of ledger.records || []) {
      if (reviewIds.has(record.id)) throw new Error(`Duplicate review id '${record.id}'`);
      reviewIds.add(record.id);
      const targetKey = [
        ledger.reviewArea,
        record.targetType,
        record.targetId,
        record.verificationTier || "unspecified",
      ].join(":");
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
        if (!["medical_domain_expert", "source_research_reviewer"].includes(record.reviewerRole)) {
          throw new Error(`${record.id} has an unsupported anatomical-content reviewer role`);
        }
        if (!["human_reviewed", "source_verified_mvp"].includes(record.verificationTier)) {
          throw new Error(`${record.id} needs an explicit verification tier`);
        }
        acceptedAnatomyByClaim.set(
          reviewMapKey(record.targetId, record.verificationTier),
          record,
        );
      }
      if (ledger.reviewArea === "localization") {
        if (record.targetType !== "names") {
          throw new Error(`${record.id} localization acceptance must target one names object`);
        }
        if (!["localization_expert", "source_localization_reviewer"].includes(record.reviewerRole)) {
          throw new Error(`${record.id} has an unsupported localization reviewer role`);
        }
        if (!["human_reviewed", "source_verified_mvp"].includes(record.verificationTier)) {
          throw new Error(`${record.id} needs an explicit verification tier`);
        }
        acceptedLocalizationByConcept.set(
          reviewMapKey(record.targetId, record.verificationTier),
          record,
        );
      }
    }
  }

  return { acceptedAnatomyByClaim, acceptedLocalizationByConcept };
}

export const collectHumanReviewGates = collectReviewGates;

export function assertPublishedClaimGates({ concepts, sourceById, acceptedAnatomyByClaim }) {
  for (const concept of concepts) {
    const reviewPolicy = reviewPolicyForConcept(concept);
    if (!reviewPolicy) continue;
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
      const claimReview = acceptedReviewFor(
        acceptedAnatomyByClaim,
        claim.claimId,
        reviewPolicy.verificationTier,
      );
      if (!claimReview) {
        throw new Error(`${claim.claimId} lacks a current, claim-bound review`);
      }
      if (claimReview.targetType !== "claim" || claimReview.targetId !== claim.claimId) {
        throw new Error(`${claim.claimId} review is not claim-bound`);
      }
      assertReviewerIdentity(
        claimReview,
        reviewPolicy.anatomyRole,
        reviewPolicy.reviewerKind,
        claim.claimId,
      );
      if (claimReview.targetHash !== contentHash(claim)) {
        throw new Error(`${claim.claimId} review is stale`);
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

function assertReleaseReview(review, target, expectedRole, reviewerKind, conceptId, area) {
  if (!review || review.status !== "accepted") {
    throw new Error(`${conceptId} lacks an accepted ${area} review`);
  }
  assertReviewerIdentity(review, expectedRole, reviewerKind, `${conceptId} ${area}`);
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
  const reviewPolicy = reviewPolicyForReleaseState(concept, releaseState);
  if (!reviewPolicy) {
    throw new Error(`${concept.id} release state has no supported verification tier`);
  }
  if (!releaseState || releaseState.conceptId !== concept.id) {
    throw new Error(`${concept.id} lacks a curated anatomical release state`);
  }
  if (releaseState.verificationTier !== reviewPolicy.verificationTier) {
    throw new Error(
      `${concept.id} release state must use '${reviewPolicy.verificationTier}' verification`,
    );
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
      assertExactInstanceAssetRef(ref, generatedInstance, `${instanceState.instanceId} laterality`);
    }
    if (instanceState.meshMapping?.status !== reviewPolicy.meshMappingStatus) {
      throw new Error(
        `${instanceState.instanceId} mesh mapping is not ${reviewPolicy.meshMappingStatus}`,
      );
    }
    for (const ref of instanceState.meshMapping.sourceRefs || []) {
      const source = sourceForRef(sourceById, ref, `${instanceState.instanceId} mesh mapping`);
      if (
        !source.supports.includes("mesh_identity") ||
        !source.supports.includes("geometry_provenance")
      ) {
        throw new Error(`${instanceState.instanceId} mesh mapping lacks registered geometry evidence`);
      }
      assertExactInstanceAssetRef(ref, generatedInstance, `${instanceState.instanceId} mesh mapping`);
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
    reviewPolicy.releaseMedicalRole,
    reviewPolicy.reviewerKind,
    concept.id,
    "classification",
  );
  assertReleaseReview(
    releaseState.reviews?.regions,
    targets.regions,
    reviewPolicy.releaseMedicalRole,
    reviewPolicy.reviewerKind,
    concept.id,
    "regions",
  );
  assertReleaseReview(
    releaseState.reviews?.laterality,
    targets.laterality,
    reviewPolicy.releaseMedicalRole,
    reviewPolicy.reviewerKind,
    concept.id,
    "laterality",
  );
  assertReleaseReview(
    releaseState.reviews?.meshMapping,
    targets.meshMapping,
    reviewPolicy.releaseMeshRole,
    reviewPolicy.reviewerKind,
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
  const reviewPolicy = reviewPolicyForConcept(concept);
  if (!reviewPolicy) return;
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
  assertMedicalContentCompleteness(
    concept,
    releaseState.classification.anatomicalTypeId,
  );
  if (concept.names.preferredLatin !== concept.terminology.baseTerm.fields.latin.value) {
    throw new Error(`${concept.id} preferredLatin must equal its pinned official TA2 Latin field`);
  }
  if ((concept.relations || []).length > 0) {
    throw new Error(
      `${concept.id} cannot publish relations before target-bound expert review is modeled`,
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
  const officialLatinRef = concept.terminology.baseTerm.fields.latin.sourceRef;
  if (!(concept.names.sourceRefs || []).some((ref) => canonical(ref) === canonical(officialLatinRef))) {
    throw new Error(`${concept.id} names must cite its exact pinned official TA2 Latin row`);
  }
  const localizationReview = acceptedReviewFor(
    acceptedLocalizationByConcept,
    concept.id,
    reviewPolicy.verificationTier,
  );
  if (!localizationReview) {
    throw new Error(`${concept.id} names lack a current, names-bound localization review`);
  }
  if (localizationReview.targetHash !== contentHash(concept.names)) {
    throw new Error(`${concept.id} localization review is stale`);
  }
  assertReviewerIdentity(
    localizationReview,
    reviewPolicy.localizationRole,
    reviewPolicy.reviewerKind,
    `${concept.id} localization`,
  );

  assertPublishedClaimGates({
    concepts: [concept],
    sourceById,
    acceptedAnatomyByClaim,
  });
  return releaseState;
}

export function projectPublishedLearning(concept, gates, instanceId) {
  const reviewPolicy = reviewPolicyForConcept(concept);
  if (!reviewPolicy) return null;
  const releaseState = assertPublishedLearningGates({ concept, ...gates });
  const instanceState = releaseState.instances.find((entry) => entry.instanceId === instanceId);
  if (!instanceState) {
    throw new Error(`${concept.id} cannot project learning for unreviewed instance '${instanceId}'`);
  }
  const learning = {
    status: concept.editorialStatus,
    names: concept.names,
    summary: concept.summary,
    details: concept.details,
    reviewedState: {
      verificationTier: reviewPolicy.verificationTier,
      anatomicalTypeId: releaseState.classification.anatomicalTypeId,
      regionIds: releaseState.regions.regionIds,
      side: instanceState.laterality,
      meshMappingStatus: instanceState.meshMapping.status,
    },
  };
  if ((concept.claims || []).length) learning.claims = concept.claims;
  return learning;
}
