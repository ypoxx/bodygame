import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  assertSnapshotFormat,
  assertSnapshotLocksMatchRegistry,
  SOURCE_SNAPSHOT_SPECS,
  verifySnapshotFile,
} from "../scripts/verify-content-source-snapshots.mjs";
import { assertSourceSpecificLocator } from "../scripts/lib/content-v2-publish-gate.mjs";

test("Phase-B source snapshot locks match the curated registry", () => {
  assert.equal(SOURCE_SNAPSHOT_SPECS.length, 4);
  assert.doesNotThrow(() => assertSnapshotLocksMatchRegistry());
  const registry = JSON.parse(
    fs.readFileSync(path.resolve("content/v2/curated/sources.json"), "utf8"),
  );
  const fascia = registry.find(
    (source) => source.id === "source.reference.fascia_nomenclature_consensus.2019",
  );
  assert.deepEqual(fascia.supports, ["classification"]);
});

test("source snapshot verification fails closed on changed bytes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "anatomyquest-source-test-"));
  const filePath = path.join(tempDir, "changed-snapshot.txt");
  fs.writeFileSync(filePath, "changed\n");
  const spec = {
    sourceId: "source.test.changed",
    sha256: "0".repeat(64),
  };

  assert.throws(
    () => verifySnapshotFile(spec, filePath),
    /expected SHA-256.*got/,
  );
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("snapshot format checks bind the scoped JATS elements and BodyParts3D row identities", () => {
  assert.doesNotThrow(() => assertSnapshotFormat(
    { sourceId: "source.test.jats", format: "jats_fascia_consensus" },
    '<sec id="ca23423-sec-0003"><table-wrap id="ca23423-tbl-0001"/><table-wrap id="ca23423-tbl-0002"/></sec>',
  ));
  assert.throws(
    () => assertSnapshotFormat(
      { sourceId: "source.test.jats", format: "jats_fascia_consensus" },
      '<sec id="ca23423-sec-0001"/>',
    ),
    /lacks scoped element/,
  );

  assert.doesNotThrow(() => assertSnapshotFormat(
    { sourceId: "source.test.tsv", format: "bodyparts_tsv", expectedRows: 2 },
    "concept id\trepresentation id\ten\nFMA3710\tBP8338\tvascular tree\n",
  ));
  assert.throws(
    () => assertSnapshotFormat(
      { sourceId: "source.test.tsv", format: "bodyparts_tsv", expectedRows: 2 },
      "concept id\trepresentation id\ten\nFMA3710\tFJ8338\tvascular tree\n",
    ),
    /malformed BodyParts3D TSV row/,
  );
});

test("snapshot verification without supplied files fails instead of only listing locks", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-content-source-snapshots.mjs"], {
    cwd: path.resolve("."),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no snapshot files supplied/);
});

test("registered Phase-B references require source-specific structured locators", () => {
  const cases = [
    {
      source: { id: "source.reference.fascia_nomenclature_consensus.2019" },
      locator: {
        kind: "jats_element",
        sectionId: "ca23423-sec-0003",
        elementId: "ca23423-tbl-0001",
      },
      error: /exact JATS element locator/,
    },
    {
      source: { id: "source.textbook.virginia_tech.applied_human_anatomy.2022" },
      locator: {
        kind: "pdf_page",
        pdfPage: 39,
        section: "Hip Girdle and Lower Limb",
        item: "Anatomy Review Question 7",
        itemKind: "authored_text",
      },
      error: /exact PDF item locator/,
    },
    {
      source: { id: "source.reference.bodyparts3d.v4_0.isa_tree" },
      locator: {
        kind: "tsv_row",
        rowKey: "FMA3710",
        representationId: "BP8338",
      },
      error: /exact FMA\/representation row locator/,
    },
  ];

  for (const { source, locator, error } of cases) {
    assert.throws(
      () => assertSourceSpecificLocator(source, { locator: "section:1" }, source.id),
      error,
    );
    assert.doesNotThrow(
      () => assertSourceSpecificLocator(source, { locator }, source.id),
    );

    assert.throws(
      () => assertSourceSpecificLocator(
        { id: "source.test.unstructured" },
        { locator },
        "source.test.unstructured",
      ),
      /requires a textual locator/,
    );
  }

  assert.throws(
    () => assertSourceSpecificLocator(
      { id: "source.terminology.fipat.ta2_2_07.part_2" },
      {
        locator: {
          kind: "jats_element",
          sectionId: "fake-section",
          elementId: "fake-element",
        },
      },
      "FIPAT wrong locator",
    ),
    /exact PDF term-row locator/,
  );
  assert.throws(
    () => assertSourceSpecificLocator(
      { id: "source.reference.fascia_nomenclature_consensus.2019" },
      {
        locator: {
          kind: "jats_element",
          sectionId: "ca23423-sec-0001",
          elementId: "ca23423-fig-0001",
        },
      },
      "out-of-scope fascia element",
    ),
    /two scoped fascia-consensus definition tables/,
  );
  assert.doesNotThrow(() => assertSourceSpecificLocator(
    { id: "source.terminology.fipat.ta2_2_07.part_2" },
    {
      locator: {
        kind: "pdf_term_row",
        pdfPage: 14,
        termId: 1038,
        column: "latin",
      },
    },
    "FIPAT exact locator",
  ));
});
