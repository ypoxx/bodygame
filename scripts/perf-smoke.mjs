import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "quizdata.json",
  "assets/skeleton.glb",
  "assets/draco/draco_decoder.wasm",
  "assets/draco/draco_decoder.js",
  "assets/draco/draco_wasm_wrapper.js",
];

for (const rel of requiredFiles) {
  const absolute = path.join(root, rel);
  if (!fs.existsSync(absolute)) {
    console.error(`Missing required file: ${rel}`);
    process.exit(1);
  }
}

const glbFiles = ["assets/skeleton.glb", "assets/muscles.glb"]
  .map((rel) => ({ rel, absolute: path.join(root, rel) }))
  .filter((entry) => fs.existsSync(entry.absolute));

for (const file of glbFiles) {
  const sizeMb = fs.statSync(file.absolute).size / (1024 * 1024);
  console.log(`${file.rel}: ${sizeMb.toFixed(2)} MB`);

  if (sizeMb > 20) {
    console.error(`Warning: ${file.rel} is larger than 20 MB.`);
  }
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!html.includes("type=\"importmap\"")) {
  console.error("Missing importmap in index.html");
  process.exit(1);
}

console.log("Perf smoke passed.");
