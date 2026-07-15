import fs from "node:fs";
import path from "node:path";

import { ROOT, serializeJson } from "./lib/content-v2-foundation.mjs";
import {
  buildTerminologyOutputs,
  selectedTermsExist,
  TERMINOLOGY_PATHS,
} from "./lib/content-v2-terminology.mjs";

const checkOnly = process.argv.includes("--check");
if (!selectedTermsExist()) {
  throw new Error(
    `Missing ${TERMINOLOGY_PATHS.selectedTerms}; run scripts/import-ta2-primary-terms.mjs against the pinned extraction`,
  );
}

const outputs = buildTerminologyOutputs();
const stale = [];

for (const [relativePath, value] of outputs) {
  const absolutePath = path.join(ROOT, relativePath);
  const expected = serializeJson(value);
  if (checkOnly) {
    if (!fs.existsSync(absolutePath) || fs.readFileSync(absolutePath, "utf8") !== expected) {
      stale.push(relativePath);
    }
    continue;
  }
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, expected);
  console.log(`Wrote ${relativePath}`);
}

if (stale.length) {
  console.error("The checked-in v2 terminology migration is stale:");
  for (const relativePath of stale) console.error(`- ${relativePath}`);
  process.exit(1);
}

if (checkOnly) {
  console.log(`v2 terminology migration is reproducible (${outputs.size} generated files).`);
}
