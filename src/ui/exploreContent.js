import { isRenderableLearning } from "../anatomy/learningStatus.js?v=20260715-1";

const PLACEHOLDER_PATTERNS = [
  /im 3d[- ]modell (?:direkt )?selektierbar/i,
  /im 3d[- ]modell auswählbar/i,
  /fachliche benennung (?:wird|noch).*geprüft/i,
  /noch nicht für das quiz freigegeben/i,
];

const DETAIL_FIELDS = [
  ["location", "Lage"],
  ["role", "Rolle"],
  ["actions", "Funktion"],
  ["origins", "Ursprung"],
  ["insertions", "Ansatz"],
  ["innervation", "Innervation"],
  ["articulations", "Gelenkpartner"],
  ["landmarks", "Landmarken"],
  ["attachments", "Anheftungen"],
  ["continuities", "Kontinuitäten"],
  ["contents", "Inhalt"],
];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlaceholder(value) {
  return !hasText(value) || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function hasLocator(locator) {
  return hasText(locator) || (locator && typeof locator === "object" && Object.keys(locator).length > 0);
}

function hasSourceRefs(claim) {
  return (
    Array.isArray(claim?.sourceRefs) &&
    claim.sourceRefs.length > 0 &&
    claim.sourceRefs.every(
      (reference) => hasText(reference?.sourceId) && hasLocator(reference?.locator),
    )
  );
}

function extractSourcedClaimText(value) {
  const claims = Array.isArray(value) ? value : value == null ? [] : [value];
  const values = claims
    .filter(
      (claim) =>
        claim &&
        typeof claim === "object" &&
        claim.evidenceStatus === "sourced" &&
        hasSourceRefs(claim) &&
        !isPlaceholder(claim.textDe),
    )
    .map((claim) => claim.textDe.trim());

  return [...new Set(values)];
}

function getPublishedLearning(entry) {
  const learning = entry?.v2?.learning;
  return isRenderableLearning(learning)
    ? learning
    : null;
}

export function getExplorePresentation(entry) {
  const learning = getPublishedLearning(entry);
  if (!learning) {
    return {
      summary: "",
      sections: [],
      hasSourcedContent: false,
    };
  }

  const details = learning.details && typeof learning.details === "object" ? learning.details : {};
  const sections = [];

  for (const [field, label] of DETAIL_FIELDS) {
    const values = extractSourcedClaimText(details[field]);
    if (values.length) {
      sections.push({ key: field, label, values });
    }
  }

  const summary = extractSourcedClaimText(learning.summary)[0] || "";

  return {
    summary,
    sections,
    hasSourcedContent: Boolean(summary || sections.length),
  };
}
