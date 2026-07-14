import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "content", "schema.structures.json");
const structuresPath = path.join(root, "content", "structures.json");

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  fail("Missing content/schema.structures.json");
}
if (!fs.existsSync(structuresPath)) {
  fail("Missing content/structures.json");
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const data = JSON.parse(fs.readFileSync(structuresPath, "utf8"));

if (!Array.isArray(data)) {
  fail("structures.json must be an array");
}

const required = schema.items?.required || [];
const allowedLayers = new Set(["bones", "muscles", "fasciae"]);
const ids = new Set();

for (let index = 0; index < data.length; index += 1) {
  const entry = data[index];
  if (!entry || typeof entry !== "object") {
    fail(`Entry ${index} must be an object`);
  }

  for (const key of required) {
    if (!(key in entry)) {
      fail(`Entry ${index} missing required key '${key}'`);
    }
  }

  for (const [key, value] of Object.entries(entry)) {
    if (!(key in schema.items.properties)) {
      fail(`Entry ${index} has unknown key '${key}'`);
    }

    if ((key === "id" || key === "nameDe" || key === "nameLatin" || key === "funFact") && !String(value).trim()) {
      fail(`Entry ${index} key '${key}' must be non-empty`);
    }
  }

  if (ids.has(entry.id)) {
    fail(`Duplicate id '${entry.id}'`);
  }
  ids.add(entry.id);

  if (!allowedLayers.has(entry.layer)) {
    fail(`Entry ${index} has invalid layer '${entry.layer}'`);
  }

  if (!Array.isArray(entry.tags) || entry.tags.length === 0) {
    fail(`Entry ${index} must contain at least one tag`);
  }
}

console.log(`Validation passed (${data.length} structures).`);
