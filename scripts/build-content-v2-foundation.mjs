import fs from "node:fs";
import path from "node:path";
import {
  buildFoundationOutputs,
  assertLegacySnapshotOverwriteAllowed,
  ROOT,
  serializeJson,
} from "./lib/content-v2-foundation.mjs";

const checkOnly = process.argv.includes("--check");
const acceptLegacySnapshot = process.argv.includes("--accept-legacy-snapshot");
const outputs = buildFoundationOutputs();
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

  if (
    relativePath === "content/v2/legacy-snapshot.json" &&
    fs.existsSync(absolutePath)
  ) {
    try {
      assertLegacySnapshotOverwriteAllowed({
        existing: fs.readFileSync(absolutePath, "utf8"),
        expected,
        accept: acceptLegacySnapshot,
      });
    } catch (error) {
      console.error(error.message);
      console.error("Rerun with --accept-legacy-snapshot only after intentional review.");
      process.exit(1);
    }
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, expected);
  console.log(`Wrote ${relativePath}`);
}

if (stale.length > 0) {
  console.error("The checked-in v2 foundation is stale:");
  for (const relativePath of stale) {
    console.error(`- ${relativePath}`);
  }
  console.error("Run `npm run content:v2:build` and review the resulting snapshot diff.");
  process.exit(1);
}

if (checkOnly) {
  console.log(`v2 foundation is reproducible (${outputs.size} generated files).`);
}
