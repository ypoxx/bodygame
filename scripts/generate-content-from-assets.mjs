import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const assetsDir = path.join(root, "assets");
const contentDir = path.join(root, "content");

const SOURCES = [
  { file: "skeleton.glb", source: "skeleton_model", forcedLayer: "bones" },
  { file: "muscles.glb", source: "muscles_model", forcedLayer: null },
];

const FASCIA_TOKENS = [
  "fascia",
  "fascial",
  "aponeurosis",
  "retinaculum",
  "septum",
  "sheath",
  "capsule",
  "tendon",
  "ligament",
  "bursa",
  "thoracolumbar",
  "linea alba",
];

const HELPER_TOKENS = [
  "how to",
  "navigation",
  "manipulation",
  "selection",
  "stored views",
  "outliner",
  "cross section",
  "sagittal plane",
  "longitudinal plane",
  "display.st",
  "layers.st",
  "colors.st",
  "take a picture",
  "annotation",
  "labels",
  "label",
  "caption",
  "text",
];

const REGION_RULES = [
  { tag: "head", tokens: ["skull", "cranium", "mandible", "maxilla", "zygomatic", "nasal", "frontal", "parietal", "occipital", "orbital", "eye", "ear", "hyoid"] },
  { tag: "neck", tokens: ["cervical", "hyoid", "thyroid", "crico", "sternohyoid", "sternothyroid", "omohyoid", "scalene"] },
  { tag: "spine", tokens: ["vertebra", "atlas", "axis", "sacrum", "coccyx", "intervertebral"] },
  { tag: "thorax", tokens: ["rib", "stern", "thoracic", "costal", "pectoral"] },
  { tag: "abdomen", tokens: ["abdominal", "rectus", "oblique", "transversus", "linea alba", "umbilical"] },
  { tag: "pelvis", tokens: ["pelvis", "pelvic", "iliac", "ischial", "pubic", "inguinal"] },
  { tag: "upper_limb", tokens: ["clavicle", "clavicula", "scapula", "humerus", "ulna", "radius", "carpal", "metacarpal", "phalanx of hand", "wrist", "arm", "forearm", "brachial", "antebrachial", "deltoid"] },
  { tag: "lower_limb", tokens: ["femur", "patella", "tibia", "fibula", "tarsal", "metatarsal", "phalax of foot", "phalanx of foot", "leg", "thigh", "glute", "calf", "ankle", "calcaneus"] },
  { tag: "hand", tokens: ["hand", "carpal", "metacarpal", "finger of hand", "palmar"] },
  { tag: "foot", tokens: ["foot", "tarsal", "metatarsal", "toe", "calcaneus", "ankle"] },
];

const DE_REPLACEMENTS = [
  [/\bmuscle\b/gi, "Muskel"],
  [/\bligament\b/gi, "Band"],
  [/\bfascia\b/gi, "Faszie"],
  [/\bfascial\b/gi, "faszial"],
  [/\btendon\b/gi, "Sehne"],
  [/\bsheath\b/gi, "Scheide"],
  [/\bcapsule\b/gi, "Kapsel"],
  [/\bseptum\b/gi, "Septum"],
  [/\baponeurosis\b/gi, "Aponeurose"],
  [/\bretinaculum\b/gi, "Retinaculum"],
  [/\bbone\b/gi, "Knochen"],
  [/\bcartilage\b/gi, "Knorpel"],
  [/\bjoint\b/gi, "Gelenk"],
  [/\bof\b/gi, "des"],
];

const LAYER_ORDER = { bones: 0, muscles: 1, fasciae: 2 };

function parseGlbJson(filepath) {
  const buffer = fs.readFileSync(filepath);
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`${filepath} is not a valid GLB`);
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunkData = buffer.slice(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(chunkData.toString("utf8"));
    }
  }

  throw new Error(`JSON chunk not found in ${filepath}`);
}

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isHelperName(name) {
  if (!name) {
    return true;
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".g") || lower.endsWith(".j")) {
    return true;
  }
  if (HELPER_TOKENS.some((token) => lower.includes(token))) {
    return true;
  }
  const looksLikeLargeLabel = /^[A-Z0-9 .,'()/-]{6,}$/.test(name) && name.includes(" ");
  return looksLikeLargeLabel;
}

function extractSide(rawName) {
  if (/\.l$/i.test(rawName)) {
    return "L";
  }
  if (/\.r$/i.test(rawName)) {
    return "R";
  }
  return null;
}

function withoutSideSuffix(rawName) {
  return rawName.replace(/\.[lr]$/i, "");
}

function classifySoftTissue(rawName) {
  const lower = withoutSideSuffix(rawName)
    .toLowerCase()
    .replace(/[_.-]+/g, " ");
  return FASCIA_TOKENS.some((token) => lower.includes(token)) ? "fasciae" : "muscles";
}

function toLatinDisplay(rawName) {
  const side = extractSide(rawName);
  const base = withoutSideSuffix(rawName)
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!side) {
    return base;
  }
  return `${base} (${side})`;
}

function toGermanDisplay(latinDisplay) {
  let out = latinDisplay;
  for (const [pattern, replacement] of DE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/\(L\)$/i, "(links)");
  out = out.replace(/\(R\)$/i, "(rechts)");
  return out;
}

function toStableId(rawName) {
  const side = extractSide(rawName);
  const base = withoutSideSuffix(rawName)
    .replace(/[()]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return side ? `${base}_${side}` : base;
}

function regionTagsFromName(rawName) {
  const lower = rawName.toLowerCase();
  const tags = [];
  for (const rule of REGION_RULES) {
    if (rule.tokens.some((token) => lower.includes(token))) {
      tags.push(rule.tag);
    }
  }
  return tags;
}

function layerFunFact(layer, latinDisplay) {
  if (layer === "bones") {
    return `${latinDisplay} ist als eigene Knochenstruktur im 3D-Modell selektierbar.`;
  }
  if (layer === "fasciae") {
    return `${latinDisplay} gehoert zu den faszialen bzw. bindegewebigen Strukturen und verbindet benachbarte Gewebe.`;
  }
  return `${latinDisplay} ist als Muskelstruktur im Bewegungsapparat-Layer enthalten.`;
}

function collectModelEntries({ file, source, forcedLayer }) {
  const filepath = path.join(assetsDir, file);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Missing asset: ${file}`);
  }
  const gltf = parseGlbJson(filepath);
  const nodes = gltf.nodes || [];
  const meshNodes = nodes.filter((node) => typeof node.mesh === "number");
  const uniqueNames = Array.from(
    new Set(
      meshNodes
        .map((node) => normalizeText(node.name))
        .filter((name) => name.length > 0)
        .filter((name) => !isHelperName(name)),
    ),
  );

  return uniqueNames.map((rawName) => {
    const layer = forcedLayer || classifySoftTissue(rawName);
    const latin = toLatinDisplay(rawName);
    const german = toGermanDisplay(latin);
    const side = extractSide(rawName);
    const tags = [layer, ...regionTagsFromName(rawName), source];
    if (side === "L") {
      tags.push("left");
    } else if (side === "R") {
      tags.push("right");
    } else {
      tags.push("midline");
    }
    tags.push("auto-generated", "quiz");

    return {
      rawName,
      id: toStableId(rawName),
      nameDe: german,
      nameLatin: latin,
      funFact: layerFunFact(layer, latin),
      layer,
      tags: Array.from(new Set(tags)),
    };
  });
}

function ensureUniqueIds(entries) {
  const seen = new Set();
  for (const entry of entries) {
    let candidate = entry.id;
    let suffix = 2;
    while (seen.has(candidate)) {
      candidate = `${entry.id}_${suffix}`;
      suffix += 1;
    }
    entry.id = candidate;
    seen.add(candidate);
  }
}

function main() {
  const entries = [];
  for (const source of SOURCES) {
    entries.push(...collectModelEntries(source));
  }

  entries.sort((a, b) => {
    const layerDiff = (LAYER_ORDER[a.layer] ?? 99) - (LAYER_ORDER[b.layer] ?? 99);
    if (layerDiff !== 0) {
      return layerDiff;
    }
    return a.nameLatin.localeCompare(b.nameLatin, "en");
  });

  ensureUniqueIds(entries);

  const structures = entries.map(({ id, nameDe, nameLatin, funFact, layer, tags }) => ({
    id,
    nameDe,
    nameLatin,
    funFact,
    layer,
    tags,
  }));

  const quizData = structures.map(({ id, nameDe, nameLatin, funFact, layer }) => ({
    id,
    nameDe,
    nameLatin,
    funFact,
    layer,
  }));

  fs.writeFileSync(path.join(contentDir, "structures.json"), `${JSON.stringify(structures, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "quizdata.json"), `${JSON.stringify(quizData, null, 2)}\n`);

  const layerStats = structures.reduce((acc, item) => {
    acc[item.layer] = (acc[item.layer] || 0) + 1;
    return acc;
  }, {});

  console.log(`Generated ${structures.length} structures.`);
  console.log(`Layer distribution: ${JSON.stringify(layerStats)}`);
}

main();
