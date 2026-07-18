const profile = (label, requiredDetailContainers) => Object.freeze({
  label,
  requiredDetailContainers: Object.freeze(requiredDetailContainers),
});

// These profiles deliberately describe the minimum direct learning content for
// one concept. Parent concepts, relations, and inferred asset labels cannot
// satisfy a requirement on behalf of the concept being released.
export const MEDICAL_CONTENT_PROFILES = Object.freeze({
  "type.bone": profile("bone", ["location", "articulations", "landmarks"]),
  "type.cartilage": profile("cartilage", ["location", "articulations", "role"]),
  "type.tooth": profile("tooth", ["location", "articulations", "landmarks", "role"]),
  "type.cavity": profile("cavity", ["location", "contents", "continuities"]),
  "type.muscle": profile("muscle", [
    "location",
    "origins",
    "insertions",
    "actions",
    "innervation",
  ]),
  "type.fascia": profile("fascia", ["location", "attachments", "continuities", "role"]),
  "type.fascial_tract": profile("fascial tract", [
    "location",
    "attachments",
    "continuities",
    "role",
  ]),
  "type.fascial_arch": profile("fascial arch", ["location", "attachments", "role"]),
  "type.fascial_septum": profile("fascial septum", ["location", "attachments", "role"]),
  "type.synovial_bursa": profile("synovial bursa", ["location", "contents", "role"]),
  "type.tendon_sheath": profile("tendon sheath", ["location", "contents", "role"]),
  "type.tendon": profile("tendon", ["location", "attachments", "role"]),
  "type.ligament": profile("ligament", ["location", "attachments", "role"]),
  "type.retinaculum": profile("retinaculum", ["location", "attachments", "role"]),
  "type.aponeurosis": profile("aponeurosis", ["location", "attachments", "role"]),
  "type.capsule": profile("capsule", [
    "location",
    "attachments",
    "articulations",
    "role",
  ]),
  "type.tendinous_structure": profile("tendinous structure", [
    "location",
    "attachments",
    "role",
  ]),
  "type.muscle_trochlea": profile("muscle trochlea", ["location", "articulations", "role"]),
  "type.eyelid_tarsus": profile("eyelid tarsus", ["location", "attachments", "role"]),
});

export const MEDICAL_CONTENT_PROFILE_POLICY = Object.freeze({
  version: 1,
  inheritance: "direct_concept_claims_only",
  notApplicableExceptions: "unsupported_until_hash_bound_exception_reviews_are_modeled",
});

function hasDirectClaims(details, container) {
  return Object.prototype.hasOwnProperty.call(details, container) &&
    Array.isArray(details[container]) &&
    details[container].length > 0 &&
    details[container].every(
      (claim) =>
        claim &&
        typeof claim === "object" &&
        typeof claim.textDe === "string" &&
        claim.textDe.trim().length > 0,
    );
}

export function assertMedicalContentCompleteness(concept, anatomicalTypeId) {
  const conceptId = concept?.id || "unknown concept";
  if (anatomicalTypeId === "type.unresolved") {
    throw new Error(`${conceptId} cannot publish with unresolved anatomical type`);
  }
  const contentProfile = MEDICAL_CONTENT_PROFILES[anatomicalTypeId];
  if (!contentProfile) {
    throw new Error(`${conceptId} has no medical completeness profile for '${anatomicalTypeId}'`);
  }

  if ((concept.notApplicableFields || []).length > 0) {
    throw new Error(
      `${conceptId} cannot use unstructured not-applicable fields; ` +
      "a reasoned, target-hash-bound exception review is required but not yet modeled",
    );
  }

  const details = concept.details && typeof concept.details === "object"
    ? concept.details
    : {};
  const missing = contentProfile.requiredDetailContainers.filter(
    (container) => !hasDirectClaims(details, container),
  );
  if (missing.length > 0) {
    throw new Error(
      `${conceptId} (${contentProfile.label}) lacks direct medically required detail fields: ` +
      missing.map((container) => `details.${container}`).join(", "),
    );
  }

  return contentProfile;
}
