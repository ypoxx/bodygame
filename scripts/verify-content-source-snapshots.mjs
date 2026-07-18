import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { readJson } from "./lib/content-v2-foundation.mjs";

export const SOURCE_SNAPSHOT_SPECS = Object.freeze([
  Object.freeze({
    sourceId: "source.localization.german_mesh.2025_v30",
    suggestedFileName: "german-mesh-v30.csv",
    sha256: "90e2dba833aeae49a05508e24dad974c7c8264c9179427d8a7650beae6028f04",
    bytes: 26_673_430,
    format: "german_mesh_csv",
  }),
  Object.freeze({
    sourceId: "source.reference.fascia_nomenclature_consensus.2019",
    suggestedFileName: "fascia-consensus-2019.xml",
    sha256: "96549999aa132f850aaf89fac4f7b2927537698b0ee3490c70df8de29e98cab3",
    bytes: 53_951,
    format: "jats_fascia_consensus",
  }),
  Object.freeze({
    sourceId: "source.textbook.virginia_tech.applied_human_anatomy.2022",
    suggestedFileName: "applied-human-anatomy-2022.pdf",
    sha256: "1a4e1695b6857d3c82d06d783eca6c467c35ec186d2257fe49747f7696bd46fd",
    bytes: 639_383,
    format: "pdf",
  }),
  Object.freeze({
    sourceId: "source.reference.bodyparts3d.v4_0.isa_tree",
    suggestedFileName: "bodyparts3d-v4-isa.txt",
    sha256: "ab7796deedd49205e77f3609a1cb8c53e2bbee14ecb5c9a6ca05227469780513",
    bytes: 128_086,
    format: "bodyparts_tsv",
    expectedRows: 2_906,
  }),
]);

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function assertSnapshotFormat(spec, bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (spec.format === "pdf") {
    if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error(`${spec.sourceId}: snapshot is not a PDF byte stream`);
    }
    return;
  }

  const text = buffer.toString("utf8");
  if (spec.format === "german_mesh_csv") {
    for (const header of ["DescriptorUI", "PreferredLabelDE", "SynonymsDE"]) {
      if (!text.includes(header)) {
        throw new Error(`${spec.sourceId}: German MeSH snapshot lacks '${header}'`);
      }
    }
    return;
  }
  if (spec.format === "jats_fascia_consensus") {
    for (const marker of [
      'id="ca23423-sec-0003"',
      'id="ca23423-tbl-0001"',
      'id="ca23423-tbl-0002"',
    ]) {
      if (!text.includes(marker)) {
        throw new Error(`${spec.sourceId}: JATS snapshot lacks scoped element ${marker}`);
      }
    }
    return;
  }
  if (spec.format === "bodyparts_tsv") {
    const rows = text.trimEnd().split(/\r?\n/);
    if (rows[0] !== "concept id\trepresentation id\ten") {
      throw new Error(`${spec.sourceId}: BodyParts3D TSV header changed`);
    }
    if (spec.expectedRows && rows.length !== spec.expectedRows) {
      throw new Error(
        `${spec.sourceId}: expected ${spec.expectedRows} TSV rows including header, got ${rows.length}`,
      );
    }
    for (const [index, row] of rows.slice(1).entries()) {
      const [conceptId, representationId, label, ...extra] = row.split("\t");
      if (
        !/^FMA[0-9]+$/.test(conceptId || "") ||
        !/^BP[0-9]+$/.test(representationId || "") ||
        !label ||
        extra.length > 0
      ) {
        throw new Error(`${spec.sourceId}: malformed BodyParts3D TSV row ${index + 2}`);
      }
    }
  }
}

export function assertSnapshotLocksMatchRegistry(
  specs = SOURCE_SNAPSHOT_SPECS,
  registry = readJson("content/v2/curated/sources.json"),
) {
  const sourceById = new Map(registry.map((source) => [source.id, source]));
  for (const spec of specs) {
    const source = sourceById.get(spec.sourceId);
    if (!source) throw new Error(`Snapshot lock targets unregistered source '${spec.sourceId}'`);
    if (source.snapshot?.sha256 !== spec.sha256) {
      throw new Error(`${spec.sourceId} snapshot lock differs from curated source registry`);
    }
  }
}

export function verifySnapshotFile(spec, filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`${spec.sourceId}: missing '${filePath}'`);
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`${spec.sourceId}: '${filePath}' is not a regular file`);
  if (spec.bytes && stat.size !== spec.bytes) {
    throw new Error(`${spec.sourceId}: expected ${spec.bytes} bytes, got ${stat.size}`);
  }
  const actualHash = hashFile(filePath);
  if (actualHash !== spec.sha256) {
    throw new Error(`${spec.sourceId}: expected SHA-256 ${spec.sha256}, got ${actualHash}`);
  }
  assertSnapshotFormat(spec, fs.readFileSync(filePath));
  return { sourceId: spec.sourceId, filePath, bytes: stat.size, sha256: actualHash };
}

function printList() {
  for (const spec of SOURCE_SNAPSHOT_SPECS) {
    console.log(`${spec.sourceId}\t${spec.sha256}\t${spec.suggestedFileName}`);
  }
}

function main() {
  assertSnapshotLocksMatchRegistry();
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    printList();
    return;
  }
  if (args.length === 0) {
    throw new Error(
      "no snapshot files supplied; use --list or source.id=/path/to/pinned-snapshot",
    );
  }

  const specById = new Map(SOURCE_SNAPSHOT_SPECS.map((spec) => [spec.sourceId, spec]));
  const verified = [];
  for (const assignment of args) {
    const separator = assignment.indexOf("=");
    if (separator < 1 || separator === assignment.length - 1) {
      throw new Error(`Expected source.id=/absolute/or/relative/path, got '${assignment}'`);
    }
    const sourceId = assignment.slice(0, separator);
    const filePath = path.resolve(assignment.slice(separator + 1));
    const spec = specById.get(sourceId);
    if (!spec) throw new Error(`No snapshot lock registered for '${sourceId}'`);
    verified.push(verifySnapshotFile(spec, filePath));
  }

  for (const result of verified) {
    console.log(
      `Verified ${result.sourceId}: ${result.bytes} bytes, SHA-256 ${result.sha256}`,
    );
  }
}

if (path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`Source snapshot verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
