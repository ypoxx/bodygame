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
  "src/anatomy/softTissueTaxonomy.js",
  "assets/derived/skeleton.mobile-lod1.v2.glb",
  "assets/derived/muscles.mobile-lod1.v2.glb",
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

function readGlbJson(absolute) {
  const buffer = fs.readFileSync(absolute);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`Invalid GLB header: ${path.relative(root, absolute)}`);
  }
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error(`Unsupported or truncated GLB: ${path.relative(root, absolute)}`);
  }

  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.length) {
    throw new Error(`Missing GLB JSON chunk: ${path.relative(root, absolute)}`);
  }
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trim());
}

function instantiatedPrimitiveStats(absolute) {
  const gltf = readGlbJson(absolute);
  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
  const meshes = Array.isArray(gltf.meshes) ? gltf.meshes : [];
  let nodesWithMesh = 0;
  let instantiatedPrimitives = 0;

  for (const node of nodes) {
    if (!Number.isInteger(node.mesh)) continue;
    const mesh = meshes[node.mesh];
    if (!mesh || !Array.isArray(mesh.primitives)) {
      throw new Error(`Node references an invalid mesh in ${path.relative(root, absolute)}`);
    }
    nodesWithMesh += 1;
    instantiatedPrimitives += mesh.primitives.length;
  }
  return { nodesWithMesh, instantiatedPrimitives };
}

const optimizedAssetChecks = [
  {
    rel: "assets/derived/skeleton.mobile-lod1.v2.glb",
    expectedNodesWithMesh: 277,
    expectedInstantiatedPrimitives: 277,
  },
  {
    rel: "assets/derived/muscles.mobile-lod1.v2.glb",
    expectedNodesWithMesh: 669,
    expectedInstantiatedPrimitives: 669,
  },
];

for (const check of optimizedAssetChecks) {
  const stats = instantiatedPrimitiveStats(path.join(root, check.rel));
  console.log(
    `${check.rel}: ${stats.nodesWithMesh} mesh nodes, ` +
      `${stats.instantiatedPrimitives} instantiated primitives`,
  );
  if (
    stats.nodesWithMesh !== check.expectedNodesWithMesh ||
    stats.instantiatedPrimitives !== check.expectedInstantiatedPrimitives
  ) {
    console.error(
      `Unexpected draw-call structure for ${check.rel}; expected ` +
        `${check.expectedNodesWithMesh}/${check.expectedInstantiatedPrimitives}, got ` +
        `${stats.nodesWithMesh}/${stats.instantiatedPrimitives}.`,
    );
    process.exit(1);
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
  [app.includes("skeleton.mobile-lod1.v2.glb"), "Runtime must use the draw-call optimized skeleton asset."],
  [app.includes("muscles.mobile-lod1.v2.glb"), "Runtime must use the draw-call optimized soft-tissue asset."],
  [app.includes("allContent.filter((item) => item.quizEligible)"), "Runtime must exclude unreviewed connective content from quizzes."],
  [app.includes("classifySoftTissue(node.name)"), "Runtime must use the shared soft-tissue taxonomy for model meshes."],
];

for (const [passed, message] of mobileInteractionChecks) {
  if (!passed) {
    console.error(message);
    process.exit(1);
  }
}

console.log("Perf and mobile interaction smoke passed.");
