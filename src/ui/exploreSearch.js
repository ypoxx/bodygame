const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

export function normalizeExploreSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveExploreLayer(entry) {
  const layer = entry?.renderGroup || entry?.displayGroup || entry?.layer;
  if (layer === "muscles" || layer === "fasciae") {
    return layer;
  }
  return "bones";
}

function flattenAliases(entry) {
  const aliases = Array.isArray(entry?.aliases) ? entry.aliases : [];
  return aliases.flatMap((alias) => {
    if (typeof alias === "string") {
      return alias;
    }
    if (!alias || typeof alias !== "object") {
      return [];
    }
    return [alias.name, alias.nameDe, alias.nameLatin, alias.value].filter(Boolean);
  });
}

function makeDocument(entry) {
  const aliases = flattenAliases(entry);
  const explore = entry?.explore || {};
  const fields = {
    nameDe: normalizeExploreSearch(explore.title || entry.nameDe),
    nameLatin: normalizeExploreSearch(explore.latin || entry.nameLatin),
    officialEnglish: normalizeExploreSearch(entry?.v2?.terminology?.official?.englishUk),
    meshName: normalizeExploreSearch(entry.meshName),
    id: normalizeExploreSearch(entry.id),
    aliases: normalizeExploreSearch(aliases.join(" ")),
  };
  return {
    entry,
    layer: resolveExploreLayer(entry),
    fields,
    haystack: Object.values(fields).filter(Boolean).join(" "),
  };
}

function rankDocument(document, normalizedQuery, terms) {
  if (!normalizedQuery) {
    return 1;
  }

  const { fields, haystack } = document;
  if (!terms.every((term) => haystack.includes(term))) {
    return -1;
  }

  if (fields.nameDe === normalizedQuery) return 100;
  if (fields.nameLatin === normalizedQuery) return 96;
  if (fields.aliases.split(" ").includes(normalizedQuery)) return 92;
  if (fields.nameDe.startsWith(normalizedQuery)) return 86;
  if (fields.nameLatin.startsWith(normalizedQuery)) return 82;
  if (fields.aliases.includes(normalizedQuery)) return 76;
  if (fields.meshName.startsWith(normalizedQuery)) return 70;
  if (fields.nameDe.includes(normalizedQuery)) return 64;
  if (fields.nameLatin.includes(normalizedQuery)) return 60;
  return 40 - Math.min(20, haystack.indexOf(terms[0] || "") / 10);
}

export function createExploreSearchIndex(entries = []) {
  let documents = entries.map(makeDocument);

  return {
    replace(nextEntries = []) {
      documents = nextEntries.map(makeDocument);
    },

    query(rawQuery = "", layerFilter = "all", limit = 80) {
      const normalizedQuery = normalizeExploreSearch(rawQuery);
      const terms = normalizedQuery.split(" ").filter(Boolean);
      const ranked = [];

      for (const document of documents) {
        if (layerFilter !== "all" && document.layer !== layerFilter) {
          continue;
        }
        const score = rankDocument(document, normalizedQuery, terms);
        if (score < 0) {
          continue;
        }
        ranked.push({ entry: document.entry, score });
      }

      ranked.sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score;
        }
        return collator.compare(
          left.entry.explore?.title || left.entry.nameDe || left.entry.nameLatin || "",
          right.entry.explore?.title || right.entry.nameDe || right.entry.nameLatin || "",
        );
      });

      return {
        total: ranked.length,
        entries: ranked.slice(0, Math.max(1, limit)).map((result) => result.entry),
      };
    },
  };
}
