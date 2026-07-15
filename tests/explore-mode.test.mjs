import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createExploreSearchIndex } from "../src/ui/exploreSearch.js";
import { getExplorePresentation } from "../src/ui/exploreContent.js";
import { decorateExploreEntry, getExploreDisplay } from "../src/ui/exploreTerminology.js";
import { shouldUseSelectionOutline } from "../src/engine/renderer.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const structures = JSON.parse(fs.readFileSync(path.join(root, "content/structures.json"), "utf8"));
const runtimeEntries = JSON.parse(fs.readFileSync(path.join(root, "content/v2/runtime-index.json"), "utf8"));
const runtimeById = new Map(runtimeEntries.map((entry) => [entry.id, entry]));
const decoratedEntries = structures.map((entry) => decorateExploreEntry(entry, runtimeById.get(entry.id)));
const decoratedById = new Map(decoratedEntries.map((entry) => [entry.id, entry]));

test("explore runtime covers every exact mesh without exposing legacy pseudo-German", () => {
  assert.equal(structures.length, 946);
  assert.equal(runtimeEntries.length, 946);
  assert.equal(runtimeById.size, 946);

  for (const entry of decoratedEntries) {
    assert.equal(entry.v2?.meshName, entry.meshName, entry.id);
    const display = getExploreDisplay(entry);
    assert.ok(display.title, entry.id);
    assert.doesNotMatch(display.title, /\bdes\b.*\bMuskel\b/i, entry.id);
  }
});

test("official pectoralis terminology replaces generated labels", () => {
  const entry = decoratedById.get("Sternocostal_head_of_pectoralis_major_muscle_L");
  assert.ok(entry);
  assert.equal(entry.explore.title, "Sternocostal head of pectoralis major muscle");
  assert.equal(entry.explore.latin, "Pars sternocostalis musculi pectoralis majoris");
  assert.equal(entry.explore.sideLabel, "links");
  assert.equal(entry.explore.typeId, "type.muscle");
  assert.equal(entry.explore.typeReviewStatus, "machine_inferred_from_asset_label");
  assert.ok(entry.aliases.includes("Brustmuskel"));
  assert.match(entry.explore.terminologyNotice, /FIPAT TA2 2\.07/);
});

test("derived tendon never presents the related muscle term as its own Latin name", () => {
  const entry = decoratedById.get("Tendon_of_extensor_digitorum_longus_L");
  assert.ok(entry);
  assert.equal(entry.explore.title, "Tendon of extensor digitorum longus");
  assert.equal(entry.explore.latin, "");
  assert.equal(entry.explore.status, "derived_structure");
  assert.equal(entry.explore.releaseBlocked, true);
  assert.match(entry.explore.terminologyNotice, /keinen eigenen Eintrag/);
});

test("iliopsoas fascia remains explicitly blocked by the geometry audit", () => {
  const entry = decoratedById.get("Iliopsoas_fascia_L");
  assert.ok(entry);
  assert.equal(entry.explore.releaseBlocked, true);
  assert.equal(entry.explore.releaseBlockReason, "geometry_pair_mismatch");
  assert.match(entry.explore.terminologyNotice, /Links-\/Rechts-Geometrie/);
});

test("ambiguous singular/plural bursa mapping fails closed", () => {
  const entry = decoratedById.get("Trochanteric_bursa_of_gluteus_medius_muscle_L");
  assert.ok(entry);
  assert.equal(entry.explore.title, "Trochanteric bursa of gluteus medius muscle");
  assert.equal(entry.explore.latin, "");
  assert.equal(entry.explore.releaseBlocked, true);
  assert.equal(entry.explore.releaseBlockReason, "terminology_mapping_requires_expert_review");
  assert.match(entry.explore.terminologyNotice, /Normbegriff bleibt/);
});

test("the mesh typo uses the corrected official subfascial term", () => {
  const entry = decoratedById.get("Subfacial_prepatellar_bursa_L");
  assert.ok(entry);
  assert.equal(entry.v2.terminology.baseTermId, 2736);
  assert.equal(entry.v2.terminology.matchMethod, "mesh_typo");
  assert.equal(entry.explore.title, "Subfascial prepatellar bursa");
  assert.equal(entry.explore.latin, "Bursa subfascialis prepatellaris");
});

test("a runtime identity mismatch fails closed to the asset working label", () => {
  const source = structures.find((entry) => entry.id === "Iliopsoas_fascia_L");
  const wrongRuntime = runtimeById.get("Iliopsoas_fascia_R");
  const decorated = decorateExploreEntry(source, wrongRuntime);
  assert.equal(decorated.v2, null);
  assert.equal(decorated.explore.title, "Iliopsoas fascia");
  assert.equal(decorated.explore.latin, "");
  assert.equal(decorated.explore.typeReviewStatus, "unreviewed");
  assert.match(decorated.explore.terminologyNotice, /Arbeitsbezeichnung/);
});

test("published reviewed names drive title, Latin line, aliases and search", () => {
  const source = structures.find(
    (entry) => entry.id === "Sternocostal_head_of_pectoralis_major_muscle_L",
  );
  const runtime = structuredClone(runtimeById.get(source.id));
  runtime.learning = {
    status: "published",
    names: {
      preferredDe: "Brustbein-Rippen-Teil des großen Brustmuskels",
      preferredLatin: "Pars sternocostalis musculi pectoralis majoris",
      aliases: ["Sternokostaler Anteil"],
      sourceRefs: [{ sourceId: "source.test", locator: "term-row" }],
    },
    summary: {
      claimId: "summary.test",
      field: "summary",
      textDe: "Geprüfte Zusammenfassung.",
      evidenceStatus: "sourced",
      sourceRefs: [{ sourceId: "source.test", locator: "claim-row" }],
    },
    details: {
      location: [
        {
          claimId: "location.test",
          field: "location",
          textDe: "Geprüfte Lage.",
          evidenceStatus: "sourced",
          sourceRefs: [{ sourceId: "source.test", locator: "claim-row" }],
        },
      ],
    },
  };

  const decorated = decorateExploreEntry(source, runtime);
  assert.equal(decorated.explore.title, "Brustbein-Rippen-Teil des großen Brustmuskels");
  assert.equal(decorated.explore.latin, "Pars sternocostalis musculi pectoralis majoris");
  assert.ok(decorated.aliases.includes("Sternokostaler Anteil"));
  assert.match(decorated.explore.terminologyNotice, /unabhängig fachlich geprüft/);
  assert.equal(createExploreSearchIndex([decorated]).query("Sternokostaler", "all", 5).total, 1);
});

test("common German navigation terms find safe official or asset labels", () => {
  const index = createExploreSearchIndex(decoratedEntries);
  const cases = [
    ["Brustmuskel", /pectoralis/i],
    ["Rückenmuskel", /(?:latissimus|trapezius|rhomboid|spinalis|longissimus|iliocostalis)/i],
    ["Schlüsselbein", /clavicle/i],
    ["Kniescheibe", /patella/i],
    ["Schulterblatt", /scapula/i],
  ];

  for (const [query, expected] of cases) {
    const result = index.query(query, "all", 80);
    assert.ok(result.total > 0, query);
    assert.ok(result.entries.some((entry) => expected.test(entry.explore.title)), query);
  }
});

test("explore presentation hides legacy content and unpublished learning drafts", () => {
  const sourcedClaim = {
    claimId: "unsafe.legacy",
    field: "summary",
    textDe: "Darf nicht erscheinen.",
    evidenceStatus: "sourced",
    sourceRefs: [{ sourceId: "source.test", locator: "p. 1" }],
  };
  const legacyEntry = {
    summary: "Alte Zusammenfassung",
    summaryDe: "Alte deutsche Zusammenfassung",
    funFact: "Alte Anekdote",
    claims: [sourcedClaim],
    details: { location: [sourcedClaim] },
  };
  const draftEntry = {
    ...legacyEntry,
    v2: {
      learning: {
        status: "draft",
        summary: sourcedClaim,
        details: { location: [sourcedClaim] },
      },
    },
  };

  assert.deepEqual(getExplorePresentation(legacyEntry), {
    summary: "",
    sections: [],
    hasSourcedContent: false,
  });
  assert.deepEqual(getExplorePresentation(draftEntry), {
    summary: "",
    sections: [],
    hasSourcedContent: false,
  });
});

test("published learning renders every schema detail field from sourced claims only", () => {
  const sourceRefs = [{ sourceId: "source.test", locator: { section: "test" } }];
  const claim = (claimId, field, textDe, overrides = {}) => ({
    claimId,
    field,
    textDe,
    evidenceStatus: "sourced",
    sourceRefs,
    ...overrides,
  });
  const fieldCases = [
    ["location", "location", "Lage"],
    ["role", "role", "Rolle"],
    ["actions", "action", "Funktion"],
    ["origins", "origin", "Ursprung"],
    ["insertions", "insertion", "Ansatz"],
    ["innervation", "innervation", "Innervation"],
    ["articulations", "articulation", "Gelenkpartner"],
    ["landmarks", "landmark", "Landmarken"],
    ["attachments", "attachment", "Anheftungen"],
    ["continuities", "continuity", "Kontinuitäten"],
    ["contents", "content", "Inhalt"],
  ];
  const details = Object.fromEntries(
    fieldCases.map(([detailField, claimField]) => [
      detailField,
      [
        claim(`${detailField}.valid`, claimField, `${detailField} veröffentlicht`),
        claim(`${detailField}.partial`, claimField, `${detailField} Entwurf`, {
          evidenceStatus: "partial",
        }),
        claim(`${detailField}.unreferenced`, claimField, `${detailField} ohne Quelle`, {
          sourceRefs: [],
        }),
        `${detailField} Legacy-String`,
      ],
    ]),
  );
  const entry = {
    claims: [claim("legacy.claim", "role", "Legacy-Claim")],
    relations: [claim("legacy.relation", "role", "Legacy-Beziehung")],
    v2: {
      learning: {
        status: "published",
        summary: claim("summary.valid", "summary", "Veröffentlichte Zusammenfassung"),
        claims: [claim("generic.claim", "role", "Generischer Claim")],
        relations: [claim("relation.claim", "role", "Beziehung")],
        details,
      },
    },
  };

  const presentation = getExplorePresentation(entry);
  assert.equal(presentation.summary, "Veröffentlichte Zusammenfassung");
  assert.equal(presentation.hasSourcedContent, true);
  assert.deepEqual(
    presentation.sections,
    fieldCases.map(([key, , label]) => ({
      key,
      label,
      values: [`${key} veröffentlicht`],
    })),
  );
  assert.doesNotMatch(JSON.stringify(presentation), /Legacy|Entwurf|ohne Quelle|Generischer Claim|Beziehung/);
});

test("mobile release shell contains the accessibility and offline gates", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src/engine/renderer.js"), "utf8");

  assert.match(html, /class="explore-detail-pane"[\s\S]*?aria-hidden="true"[\s\S]*?inert/);
  assert.match(app, /function setExploreDetailVisibility\(visible\)/);
  assert.match(styles, /\.experience-btn\s*\{[\s\S]*?min-height:\s*2\.75rem/);
  assert.match(serviceWorker, /content\/v2\/runtime-index\.json/);
  assert.match(serviceWorker, /muscles\.mobile-lod1\.v2\.glb/);
  assert.match(app, /getActiveSelectables\(\)\.filter\(isSelectableVisible\)/);
  assert.match(app, /targetHeightRatio:\s*selected \? 0\.48 : 0\.76/);
  assert.match(app, /yOffsetRatio:\s*selected \? -0\.38 : 0/);
  assert.match(renderer, /shouldUseSelectionOutline\(lastWidth\)/);
});

test("selection outline policy protects mobile and coarse-pointer renderers", () => {
  assert.equal(shouldUseSelectionOutline(390, false), false);
  assert.equal(shouldUseSelectionOutline(820, false), false);
  assert.equal(shouldUseSelectionOutline(821, false), true);
  assert.equal(shouldUseSelectionOutline(1440, true), false);
});
