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

const cameraController = fs.readFileSync(path.join(root, "src/engine/cameraController.js"), "utf8");
const mutators = fs.readFileSync(path.join(root, "src/game/mutators.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

const mobileInteractionChecks = [
  [cameraController.includes("controls.enableZoom = true"), "Camera zoom must stay enabled."],
  [cameraController.includes("controls.zoomToCursor = true"), "Pinch zoom must follow the gesture midpoint."],
  [cameraController.includes("controls.touches.TWO = THREE.TOUCH.DOLLY_PAN"), "Two-finger zoom is not configured."],
  [!mutators.includes("no_zoom"), "A game mutator must not disable mobile zoom."],
  [styles.includes("touch-action: none"), "Canvas must own touch gestures."],
  [html.includes("2 Finger zoomen"), "Mobile zoom guidance is missing."],
  [app.includes("findNearestMeshByScreenDistance(meshes, pointer, 22)"), "Mobile tap fallback must keep a 22 px radius."],
];

for (const [passed, message] of mobileInteractionChecks) {
  if (!passed) {
    console.error(message);
    process.exit(1);
  }
}

console.log("Perf and mobile interaction smoke passed.");
