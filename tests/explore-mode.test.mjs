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

function classesForId(html, id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const openingTag = html.match(new RegExp(`<[^>]*\\bid="${escapedId}"[^>]*>`))?.[0];
  assert.ok(openingTag, `Missing element #${id}`);
  const classValue = openingTag.match(/\bclass="([^"]*)"/)?.[1] || "";
  return new Set(classValue.split(/\s+/).filter(Boolean));
}

function reviewedStateFor(status) {
  return {
    verificationTier: status === "published" ? "human_reviewed" : "source_verified_mvp",
    anatomicalTypeId: "type.muscle",
    regionIds: ["region.thorax"],
    side: "left",
    meshMappingStatus: status === "published" ? "human_verified" : "source_verified",
  };
}

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
  assert.equal(entry.explore.releaseBlockReason, "iliopsoas_fascia_geometry_pair_anomaly");
  assert.match(entry.explore.terminologyNotice, /Links-\/Rechts-Geometrie/);
});

test("ambiguous singular/plural bursa mapping fails closed", () => {
  const entry = decoratedById.get("Trochanteric_bursa_of_gluteus_medius_muscle_L");
  assert.ok(entry);
  assert.equal(entry.explore.title, "Trochanteric bursa of gluteus medius muscle");
  assert.equal(entry.explore.latin, "");
  assert.equal(entry.explore.releaseBlocked, true);
  assert.equal(entry.explore.releaseBlockReason, "trochanteric_bursa_singular_plural_ambiguity");
  assert.match(entry.explore.terminologyNotice, /Normbegriff bleibt/);
});

test("all hard publication blocks are reflected in the explore UI", () => {
  const cases = [
    ["Iliopsoas_fascia_L", "iliopsoas_fascia_geometry_pair_anomaly"],
    ["Tendon_of_extensor_digitorum_longus_L", "derived_extensor_digitorum_longus_tendon"],
    [
      "Trochanteric_bursa_of_gluteus_medius_muscle_L",
      "trochanteric_bursa_singular_plural_ambiguity",
    ],
    ["Iliocostalis_colli_muscle", "iliocostalis_colli_unresolved_laterality"],
  ];

  for (const [instanceId, expectedReason] of cases) {
    const entry = decoratedById.get(instanceId);
    assert.ok(entry, instanceId);
    assert.equal(entry.explore.releaseBlocked, true, instanceId);
    assert.equal(entry.explore.releaseBlockReason, expectedReason, instanceId);
  }

  const iliocostalis = decoratedById.get("Iliocostalis_colli_muscle");
  assert.equal(iliocostalis.explore.side, "unresolved");
  assert.match(iliocostalis.explore.terminologyNotice, /Seitigkeit.*ungeklärt/);
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
    reviewedState: reviewedStateFor("published"),
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
  assert.equal(decorated.explore.learningStatus, "published");
  assert.match(decorated.explore.terminologyNotice, /unabhängig fachlich geprüft/);
  assert.equal(createExploreSearchIndex([decorated]).query("Sternokostaler", "all", 5).total, 1);
});

test("source-verified MVP learning is visible with an explicit non-medical notice", () => {
  const source = structures.find(
    (entry) => entry.id === "Sternocostal_head_of_pectoralis_major_muscle_L",
  );
  const runtime = structuredClone(runtimeById.get(source.id));
  runtime.learning = {
    status: "source_verified_mvp",
    reviewedState: reviewedStateFor("source_verified_mvp"),
    names: {
      preferredDe: "Brustbein-Rippen-Teil des großen Brustmuskels",
      preferredLatin: "Pars sternocostalis musculi pectoralis majoris",
      sourceRefs: [{ sourceId: "source.test", locator: "term-row" }],
    },
    summary: {
      claimId: "summary.mvp_test",
      field: "summary",
      textDe: "Quellengeprüfte MVP-Zusammenfassung.",
      evidenceStatus: "sourced",
      sourceRefs: [{ sourceId: "source.test", locator: "claim-row" }],
    },
    details: {
      location: [
        {
          claimId: "location.mvp_test",
          field: "location",
          textDe: "Quellengeprüfte MVP-Lage.",
          evidenceStatus: "sourced",
          sourceRefs: [{ sourceId: "source.test", locator: "claim-row" }],
        },
      ],
    },
  };

  const decorated = decorateExploreEntry(source, runtime);
  assert.equal(decorated.explore.title, "Brustbein-Rippen-Teil des großen Brustmuskels");
  assert.equal(decorated.explore.learningStatus, "source_verified_mvp");
  assert.match(decorated.explore.terminologyNotice, /vom Autor getrennten Agenten gegengeprüft/);
  assert.match(decorated.explore.terminologyNotice, /nicht humanmedizinisch fachgeprüft/);
  assert.deepEqual(getExplorePresentation(decorated), {
    summary: "Quellengeprüfte MVP-Zusammenfassung.",
    sections: [{ key: "location", label: "Lage", values: ["Quellengeprüfte MVP-Lage."] }],
    hasSourcedContent: true,
  });
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
        reviewedState: reviewedStateFor("published"),
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
  const sourcePage = fs.readFileSync(path.join(root, "content-sources.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const renderer = fs.readFileSync(path.join(root, "src/engine/renderer.js"), "utf8");
  const buildScript = fs.readFileSync(path.join(root, "scripts/build-netlify.mjs"), "utf8");

  assert.match(html, /class="explore-detail-pane"[\s\S]*?aria-hidden="true"[\s\S]*?inert/);
  assert.match(html, /nicht humanmedizinisch freigegeben und nicht für medizinische Nutzung/);
  assert.match(html, /href="\.\/content-sources\.html"/);
  assert.match(sourcePage, /Nicht für medizinische Nutzung/);
  assert.match(sourcePage, /doi\.org\/10\.1002\/ca\.23423/);
  assert.match(sourcePage, /doi\.org\/10\.21061\/applied-human-anatomy/);
  assert.match(sourcePage, /BodyParts3D 4\.0/);
  assert.match(app, /function setExploreDetailVisibility\(visible\)/);
  assert.match(app, /MVP · nicht human geprüft/);
  assert.doesNotMatch(app, /0x0c1420|0x14202e/);
  assert.match(styles, /\.experience-btn\s*\{[\s\S]*?min-height:\s*2\.75rem/);
  assert.match(styles, /--stage-control:\s*rgba\(22, 14, 18, 0\.68\)/);
  assert.match(
    styles,
    /\.app-shell\[data-experience-mode="explore"\] \.scene-panel\s*\{[\s\S]*?#22161d[\s\S]*?var\(--stage\)/,
  );
  assert.match(
    styles,
    /\.app-shell\[data-experience-mode="explore"\] \.info-panel\s*\{[\s\S]*?var\(--sheet\)[\s\S]*?var\(--shadow-sheet\)/,
  );
  assert.doesNotMatch(styles, /--explore-bg|#0c1420|#09111b|#f1efeb/);
  assert.match(styles, /\.explore-learning-badge\.learning-source_verified_mvp/);
  assert.match(styles, /\.settings-meta-links\s*\{[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(serviceWorker, /content\/v2\/runtime-index\.json/);
  assert.match(serviceWorker, /content\/v2\/sources\.json/);
  assert.match(serviceWorker, /docs\/content-source-attribution\.md/);
  assert.match(serviceWorker, /content-sources\.html/);
  assert.match(serviceWorker, /src\/anatomy\/learningStatus\.js/);
  assert.match(serviceWorker, /src\/anatomy\/publicationBlocks\.js/);
  assert.match(serviceWorker, /anatomyquest3d-mobile-v20/);
  assert.match(serviceWorker, /src\/engine\/cameraController\.js\?v=20260718-1/);
  assert.match(serviceWorker, /src\/engine\/meshPicking\.js\?v=20260718-1/);
  assert.match(serviceWorker, /muscles\.mobile-lod1\.v2\.glb/);
  assert.match(app, /getActiveSelectables\(\)\.filter\(isSelectableVisible\)/);
  assert.match(app, /peek:\s*\{ targetHeightRatio: 0\.62, targetWidthRatio: 0\.7, yOffsetRatio: -0\.12 \}/);
  assert.match(app, /expanded:\s*\{ targetHeightRatio: 0\.5, targetWidthRatio: 0\.64, yOffsetRatio: -0\.3 \}/);
  assert.match(renderer, /shouldUseSelectionOutline\(lastWidth\)/);
  assert.match(buildScript, /copyFile\("content\/v2\/sources\.json"\)/);
  assert.match(buildScript, /copyFile\("docs\/content-source-attribution\.md"\)/);
  assert.match(buildScript, /"content-sources\.html"/);
});

test("learning and quiz compose the same visual primitives", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  const quizCtaClasses = classesForId(html, "startRoundBtn");
  const learningCtaClasses = classesForId(html, "explorePracticeBtn");
  for (const sharedClass of ["btn", "btn-primary"]) {
    assert.equal(quizCtaClasses.has(sharedClass), true, `Quiz CTA misses .${sharedClass}`);
    assert.equal(learningCtaClasses.has(sharedClass), true, `Learning CTA misses .${sharedClass}`);
  }

  const quizCopyClasses = classesForId(html, "factValue");
  const learningCopyClasses = classesForId(html, "exploreSummaryValue");
  assert.equal(quizCopyClasses.has("fact"), true);
  assert.equal(learningCopyClasses.has("fact"), true);

  for (const id of ["layerBonesBtn", "layerMusclesBtn", "layerFasciaeBtn"]) {
    assert.equal(classesForId(html, id).has("layer-btn"), true, `${id} misses .layer-btn`);
  }

  const learningLayerTags = Array.from(
    html.matchAll(/<button\b[^>]*\bdata-explore-layer="(?:bones|muscles|fasciae)"[^>]*>/g),
    (match) => match[0],
  );
  assert.equal(learningLayerTags.length, 3);
  for (const openingTag of learningLayerTags) {
    assert.match(openingTag, /\bclass="[^"]*\blayer-btn\b[^"]*"/);
  }

  assert.match(
    html,
    /class="explore-detail-heading"[\s\S]*?<div class="pane-heading">[\s\S]*?class="latin-name"/,
  );
});

test("explore selection uses a compact accessible inspector with progressive disclosure", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  for (const id of [
    "exploreSelectedCommand",
    "exploreSelectedSearchBtn",
    "exploreSelectedLayerBtn",
    "exploreSelectedLayerValue",
    "exploreDetailsBtn",
    "exploreDetailBody",
    "exploreMoreBtn",
    "exploreMorePanel",
  ]) {
    assert.match(html, new RegExp(`\\bid="${id}"`));
  }

  assert.match(html, /id="exploreDetailsBtn"[\s\S]*?aria-controls="exploreDetailBody"[\s\S]*?aria-expanded="false"/);
  assert.match(html, /id="exploreDetailBody"[\s\S]*?aria-hidden="true" inert/);
  assert.match(html, /id="exploreMoreBtn"[\s\S]*?aria-controls="exploreMorePanel"[\s\S]*?aria-expanded="false"/);
  assert.match(html, /id="exploreMorePanel"[\s\S]*?aria-hidden="true"[\s\S]*?inert/);
  assert.match(html, /id="exploreCloseDetailBtn"/);

  assert.match(styles, /--explore-sheet-peek:\s*max\(9\.5rem/);
  assert.match(styles, /--explore-sheet-expanded:\s*43svh/);
  assert.match(styles, /--explore-sheet-full:\s*78svh/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(app, /setSheetState\("peek"\)/);
  assert.match(app, /stepExploreSheetState\(deltaY < 0 \? 1 : -1\)/);
  assert.match(app, /setExploreMoreOpen\(/);
  assert.doesNotMatch(
    app,
    /ui\.sheetHandleBtn\?\.addEventListener\("click", \(\) => \{[\s\S]{0,180}clearExploreSelection/,
  );
});

test("selection outline policy protects mobile and coarse-pointer renderers", () => {
  assert.equal(shouldUseSelectionOutline(390, false), false);
  assert.equal(shouldUseSelectionOutline(820, false), false);
  assert.equal(shouldUseSelectionOutline(821, false), true);
  assert.equal(shouldUseSelectionOutline(1440, true), false);
});
