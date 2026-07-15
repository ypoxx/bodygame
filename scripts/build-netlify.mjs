import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "dist");

const rootFiles = [
  "app.js",
  "favicon.ico",
  "index.html",
  "manifest.json",
  "quizdata.json",
  "styles.css",
  "sw.js",
];

const versionedThreeRoot = "vendor/three/0.185.0";
const vendorFiles = [
  "build/three.module.min.js",
  "build/three.core.min.js",
  "examples/jsm/controls/OrbitControls.js",
  "examples/jsm/environments/RoomEnvironment.js",
  "examples/jsm/loaders/DRACOLoader.js",
  "examples/jsm/loaders/GLTFLoader.js",
  "examples/jsm/utils/BufferGeometryUtils.js",
  "examples/jsm/utils/SkeletonUtils.js",
];

await verifyImportMapCspHash();

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const relativePath of rootFiles) {
  await copyFile(relativePath);
}

await copyTree("src", ({ name }) => name.endsWith(".js"));
await copyTree("content", ({ name }) => name === "structures.json");
await copyTree("assets/icons", ({ name }) => !name.startsWith("."));
await copyTree("assets/draco", ({ name }) => !name.startsWith("."));
await copyFile("assets/ATTRIBUTION.md");
await copyFile("assets/derived/skeleton.mobile-lod1.v2.glb");
await copyFile("assets/derived/muscles.mobile-lod1.v2.glb");
await copyTree("assets", ({ name, entry, relativePath }) => {
  if (entry.isDirectory()) {
    return false;
  }
  if (name.includes("backup") || name.startsWith(".")) {
    return false;
  }
  return relativePath.endsWith(".glb");
}, { shallow: true });

for (const relativePath of vendorFiles) {
  await copyFileAs(
    path.join("node_modules/three", relativePath),
    path.join(versionedThreeRoot, relativePath),
  );
}

const outputStats = await collectStats(outputRoot);
const maximumFileSize = outputStats.files.reduce((maximum, file) => Math.max(maximum, file.size), 0);

console.log(
  `Netlify bundle: ${outputStats.files.length} files, ${formatBytes(outputStats.totalSize)}, largest ${formatBytes(maximumFileSize)}`,
);

if (outputStats.totalSize > 50 * 1024 * 1024) {
  throw new Error("Produktionsbundle ist größer als 50 MiB; prüfe versehentlich kopierte Backups.");
}

if (outputStats.files.some((file) => file.relativePath.includes("backup"))) {
  throw new Error("Ein Backup wurde in das Produktionsbundle kopiert.");
}

async function copyFile(relativePath) {
  await copyFileAs(relativePath, relativePath);
}

async function copyFileAs(sourceRelativePath, destinationRelativePath) {
  const source = path.join(projectRoot, sourceRelativePath);
  const destination = path.join(outputRoot, destinationRelativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
}

async function verifyImportMapCspHash() {
  const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
  const config = await readFile(path.join(projectRoot, "netlify.toml"), "utf8");
  const importMap = html.match(/<script\s+type=["']importmap["']>([\s\S]*?)<\/script>/i)?.[1];
  if (!importMap) {
    throw new Error("Importmap in index.html nicht gefunden.");
  }

  const hash = createHash("sha256").update(importMap).digest("base64");
  if (!config.includes(`'sha256-${hash}'`)) {
    throw new Error(`CSP-Hash der Importmap ist veraltet. Erwartet: sha256-${hash}`);
  }
}

async function copyTree(relativeDirectory, include, options = {}) {
  const sourceDirectory = path.join(projectRoot, relativeDirectory);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (!options.shallow) {
        await copyTree(relativePath, include, options);
      }
      continue;
    }

    if (!include({ name: entry.name, entry, relativePath })) {
      continue;
    }

    await copyFile(relativePath);
  }
}

async function collectStats(directory) {
  const files = [];
  let totalSize = 0;

  async function visit(currentDirectory) {
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      const fileStats = await stat(absolutePath);
      const relativePath = path.relative(directory, absolutePath);
      files.push({ relativePath, size: fileStats.size });
      totalSize += fileStats.size;
    }
  }

  await visit(directory);
  return { files, totalSize };
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
