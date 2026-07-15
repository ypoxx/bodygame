import fs from "node:fs";
import path from "node:path";

import { readJson, ROOT, serializeJson } from "./lib/content-v2-foundation.mjs";
import {
  EXPECTED_TERMINOLOGY_COUNTS,
  FIPAT_SOURCE_DEFINITIONS,
  PRIMARY_ENGLISH_UK_RECONSTRUCTIONS,
  registryTermFromExtractedRow,
  resolveConceptDecision,
  selectedTermIdsForConcepts,
  TERMINOLOGY_PATHS,
} from "./lib/content-v2-terminology.mjs";

const inputFlag = process.argv.indexOf("--input");
const inputPath = inputFlag >= 0 ? process.argv[inputFlag + 1] : "/tmp/ta2-official-terms.json";
const checkOnly = process.argv.includes("--check");

if (!inputPath) {
  throw new Error("--input needs a JSON path");
}

const extracted = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(extracted.terms)) {
  throw new Error("Official extraction must contain a terms array");
}
for (const [part, expected] of Object.entries(FIPAT_SOURCE_DEFINITIONS)) {
  const extractedSource = extracted.sources?.find(
    (source) => source.id === `fipat-ta2-2.07-${part}`,
  );
  if (
    !extractedSource ||
    extractedSource.version !== "2.07" ||
    extractedSource.url !== expected.url ||
    extractedSource.sha256 !== expected.sha256
  ) {
    throw new Error(`Official extraction source metadata differs for ${part}`);
  }
}
const allTerms = extracted.terms
  .filter((row) => row.latin && (row.englishUk || PRIMARY_ENGLISH_UK_RECONSTRUCTIONS[row.termId]))
  .map(registryTermFromExtractedRow);
const concepts = readJson("content/v2/concepts/stubs.json");
const selectedIds = selectedTermIdsForConcepts(concepts, allTerms);

if (selectedIds.length !== EXPECTED_TERMINOLOGY_COUNTS.selectedTerms) {
  throw new Error(
    `Expected ${EXPECTED_TERMINOLOGY_COUNTS.selectedTerms} selected official terms, got ${selectedIds.length}`,
  );
}

const allById = new Map(allTerms.map((term) => [term.termId, term]));
const selected = selectedIds.map((termId) => {
  const term = allById.get(termId);
  if (!term) throw new Error(`Missing selected TA2 ${termId}`);
  return term;
});

for (const concept of concepts) {
  resolveConceptDecision(concept.workingLabel, selected);
}

const outputPath = path.join(ROOT, TERMINOLOGY_PATHS.selectedTerms);
const expected = serializeJson(selected);
if (checkOnly) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== expected) {
    console.error(`${TERMINOLOGY_PATHS.selectedTerms} differs from the pinned official extraction.`);
    process.exit(1);
  }
  console.log(`TA2 primary-term import is reproducible (${selected.length} selected terms).`);
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, expected);
  console.log(`Wrote ${TERMINOLOGY_PATHS.selectedTerms} (${selected.length} selected terms).`);
}
