import { isRenderableLearning } from "../anatomy/learningStatus.js?v=20260715-1";
import { publicationBlockForConcept } from "../anatomy/publicationBlocks.js?v=20260715-1";

const SIDE_LABELS_DE = Object.freeze({
  left: "links",
  right: "rechts",
  midline: "mittig",
  unresolved: "Seite ungeklärt",
});

// Navigation aliases help non-specialists find a structure. They are never
// rendered as anatomical names or treated as medical content.
const COMMON_NAVIGATION_ALIASES = Object.freeze([
  { pattern: /\bpectoralis\b/i, groups: ["muscles"], aliases: ["Brustmuskel", "Brustmuskulatur"] },
  {
    pattern:
      /\b(?:latissimus dorsi|trapezius|rhomboid|erector spinae|spinalis|longissimus|iliocostalis|multifidus|rotator|semispinalis|splenius)\b/i,
    groups: ["muscles"],
    aliases: ["Rückenmuskel", "Rückenmuskulatur"],
  },
  { pattern: /\bclavicle\b|\bclavicula\b/i, groups: ["bones"], aliases: ["Schlüsselbein"] },
  { pattern: /\bpatella\b/i, groups: ["bones"], aliases: ["Kniescheibe"] },
  { pattern: /\bscapula\b/i, groups: ["bones"], aliases: ["Schulterblatt"] },
  { pattern: /\bmandible\b|\bmandibula\b/i, groups: ["bones"], aliases: ["Unterkiefer"] },
  { pattern: /\bfemur\b/i, groups: ["bones"], aliases: ["Oberschenkelknochen"] },
  { pattern: /\bhumerus\b/i, groups: ["bones"], aliases: ["Oberarmknochen"] },
  { pattern: /\bcalcaneus\b/i, groups: ["bones"], aliases: ["Fersenbein"] },
  { pattern: /\b(?:gastrocnemius|soleus)\b/i, groups: ["muscles"], aliases: ["Wadenmuskel", "Wadenmuskulatur"] },
  { pattern: /\bgluteus\b/i, groups: ["muscles"], aliases: ["Gesäßmuskel", "Gesäßmuskulatur"] },
  { pattern: /\brectus abdominis\b/i, groups: ["muscles"], aliases: ["Bauchmuskel", "Bauchmuskulatur"] },
]);

function cleanTerm(value) {
  let result = String(value || "")
    .replace(/(?:\.[lr]|_[lr]|-\s*[lr]|\s+\([lr]\))$/i, "")
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (result.startsWith("(") && result.endsWith(")") && !/[()]/.test(result.slice(1, -1))) {
    result = result.slice(1, -1).trim();
  }
  return result;
}

function inferSide(entry, runtimeEntry) {
  if (runtimeEntry?.side) {
    return runtimeEntry.side;
  }
  const meshName = String(entry?.meshName || "");
  if (/\.l$/i.test(meshName)) return "left";
  if (/\.r$/i.test(meshName)) return "right";
  return "midline";
}

function flattenStringAliases(value) {
  return (Array.isArray(value) ? value : []).flatMap((alias) => {
    if (typeof alias === "string") return [alias];
    if (!alias || typeof alias !== "object") return [];
    return [alias.name, alias.nameDe, alias.nameLatin, alias.value].filter(Boolean);
  });
}

function navigationAliases(referenceText, renderGroup) {
  const aliases = [];
  for (const rule of COMMON_NAVIGATION_ALIASES) {
    if (rule.groups.includes(renderGroup) && rule.pattern.test(referenceText)) {
      aliases.push(...rule.aliases);
    }
  }
  return aliases;
}

function terminologyNotice(runtimeEntry, qualifierText, publicationBlock, side) {
  const terminology = runtimeEntry?.terminology;
  const visibleLearning = isRenderableLearning(runtimeEntry?.learning)
    ? runtimeEntry.learning
    : null;
  let notice = "Arbeitsbezeichnung aus dem 3D-Asset; Terminologie und Strukturtyp sind noch nicht fachlich freigegeben.";

  if (visibleLearning?.status === "published") {
    notice = "Deutscher Fachname und Lerninhalte sind quellengebunden sowie unabhängig fachlich geprüft.";
  } else if (visibleLearning?.status === "source_verified_mvp") {
    notice = "Quellengebundener MVP-Inhalt: durch einen vom Autor getrennten Agenten gegengeprüft, aber nicht humanmedizinisch fachgeprüft und nicht für medizinische Nutzung bestimmt.";
  } else if (terminology?.status === "derived_structure") {
    notice = `Diese separat modellierte Struktur besitzt in TA2 2.07 keinen eigenen Eintrag. Sie ist nur als abgeleitete Modellstruktur mit Term ${terminology.relatedTermId} verknüpft und bleibt bis zur Fachprüfung gesperrt.`;
  } else if (terminology?.matchStatus === "expert_review_required") {
    notice = `Mögliche Zuordnung zu FIPAT TA2 2.07, Term ${terminology.baseTermId}; Modellbezeichnung und Normbegriff sind noch nicht eindeutig deckungsgleich. Der Normbegriff bleibt bis zur medizinischen und geometrischen Fachprüfung ausgeblendet.`;
  } else if (terminology?.status === "official_base") {
    const termId = terminology.baseTermId;
    notice = terminology.matchMethod === "series_variant"
      ? `TA2-2.07-Basisbegriff ${termId}; die konkrete Variante${qualifierText ? ` (${qualifierText})` : ""} stammt aus der exakten Modellbezeichnung. Die anatomische Fachfreigabe steht aus.`
      : `Normbegriff nach FIPAT TA2 2.07, Term ${termId}. Mesh-Zuordnung und Strukturtyp wurden maschinell abgeglichen; die anatomische Fachfreigabe steht aus.`;
  }

  if (publicationBlock === "iliopsoas_fascia_geometry_pair_anomaly") {
    notice += " Zusätzlich ist die Links-/Rechts-Geometrie auffällig; diese Struktur bleibt bis zur Assetprüfung gesperrt.";
  } else if (publicationBlock === "iliocostalis_colli_unresolved_laterality") {
    notice += " Die Seitigkeit der beiden Modellinstanzen ist ungeklärt; diese Struktur bleibt bis zur Geometrieprüfung gesperrt.";
  } else if (
    publicationBlock &&
    terminology?.status !== "derived_structure" &&
    terminology?.matchStatus !== "expert_review_required"
  ) {
    notice += " Für diese Struktur ist ein dokumentierter Stopfall offen; Lerninhalte bleiben bis zur Auflösung gesperrt.";
  } else if (side === "unresolved" && !publicationBlock) {
    notice += " Die Seitigkeit ist ungeklärt; Lerninhalte bleiben bis zur Auflösung gesperrt.";
  }
  return notice;
}

export function decorateExploreEntry(entry, runtimeEntry = null) {
  const runtimeMatches =
    runtimeEntry && runtimeEntry.id === entry?.id && runtimeEntry.meshName === entry?.meshName;
  const runtime = runtimeMatches ? runtimeEntry : null;
  const terminology = runtime?.terminology;
  const learning = isRenderableLearning(runtime?.learning) ? runtime.learning : null;
  const reviewedNames = learning?.names && typeof learning.names === "object" ? learning.names : null;
  const official =
    terminology?.status === "official_base" && terminology?.matchStatus !== "expert_review_required"
      ? terminology.official
      : null;
  const matchMethod = terminology?.matchMethod || null;
  const assetTitle = cleanTerm(entry?.meshName || entry?.nameLatin || entry?.id);
  const title =
    cleanTerm(reviewedNames?.preferredDe) ||
    (official && matchMethod !== "series_variant"
      ? cleanTerm(official.englishUk) || assetTitle
      : assetTitle);
  const latin =
    cleanTerm(reviewedNames?.preferredLatin) || (official ? cleanTerm(official.latin) : "");
  const side = inferSide(entry, runtime);
  const sideLabel = SIDE_LABELS_DE[side] || SIDE_LABELS_DE.unresolved;
  const qualifiers = Array.isArray(terminology?.qualifiers) ? terminology.qualifiers : [];
  const qualifierText = qualifiers.map((qualifier) => qualifier?.value).filter(Boolean).join(", ");
  const publicationBlock = publicationBlockForConcept(runtime?.conceptId);
  const referenceText = [title, latin, assetTitle].filter(Boolean).join(" ");
  const exploreAliases = navigationAliases(referenceText, runtime?.renderGroup || entry?.displayGroup || entry?.layer || "bones");
  const aliases = [
    ...new Set([
      ...flattenStringAliases(entry?.aliases),
      ...flattenStringAliases(reviewedNames?.aliases),
      ...exploreAliases,
    ]),
  ];

  return {
    ...entry,
    aliases,
    v2: runtime,
    explore: {
      title,
      latin,
      side,
      sideLabel,
      status: terminology?.status || "asset_label_unverified",
      learningStatus: learning?.status || null,
      matchMethod,
      typeId: runtime?.classification?.typeId || null,
      typeReviewStatus: runtime?.classification?.reviewStatus || "unreviewed",
      qualifierText,
      terminologyNotice: terminologyNotice(runtime, qualifierText, publicationBlock, side),
      releaseBlocked:
        Boolean(publicationBlock) || side === "unresolved" || terminology?.status === "derived_structure" || terminology?.matchStatus === "expert_review_required",
      releaseBlockReason: publicationBlock
        ? publicationBlock
        : side === "unresolved"
          ? "unresolved_laterality"
        : terminology?.status === "derived_structure"
          ? "derived_term_requires_expert_review"
          : terminology?.matchStatus === "expert_review_required"
            ? "terminology_mapping_requires_expert_review"
            : null,
    },
  };
}

export function getExploreDisplay(entry) {
  if (entry?.explore?.title) {
    return entry.explore;
  }
  return decorateExploreEntry(entry).explore;
}
