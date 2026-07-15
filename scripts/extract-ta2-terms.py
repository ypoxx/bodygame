#!/usr/bin/env python3
"""Extract the public-domain terms used by AnatomyQuest from official TA2 PDFs.

The FIPAT PDFs are landscape tables without a machine-readable companion file.
This extractor uses the stable column positions of edition 2.07. It does not
copy explanatory endnotes; it emits terminology rows only. The source PDFs are
not written to the repository and must match the registered SHA-256 hashes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import pdfplumber


SOURCE_SPECS = {
    "part2": {
        "version": "2.07",
        "sha256": "d30ce0d578b266ce4c47a6ff911e007a0cc440d65e9acaeb0680ec3eafa2231b",
        "url": "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-2.pdf",
    },
    "part5": {
        "version": "2.07",
        "sha256": "ebda279a51bac4c62221c4539817394c28e3dd99925a06bf57adeeb12abd9e4c",
        "url": "https://cdn.dal.ca/content/dam/dalhousie/pdf/library/FIPAT/TA2/FIPAT-TA2-Part-5.pdf",
    },
}

COLUMN_NAMES = (
    "latin",
    "latinSynonym",
    "englishUk",
    "englishUs",
    "englishSynonym",
    "other",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_cell(parts: list[str]) -> str:
    value = " ".join(parts)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def word_column(x0: float) -> str | None:
    if 95 <= x0 < 210:
        return "latin"
    if 210 <= x0 < 327:
        return "latinSynonym"
    if 327 <= x0 < 440:
        return "englishUk"
    if 440 <= x0 < 554:
        return "englishUs"
    if 554 <= x0 < 679:
        return "englishSynonym"
    if x0 >= 679:
        return "other"
    return None


def group_lines(words: list[dict]) -> list[list[dict]]:
    lines: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not lines or abs(lines[-1][0]["top"] - word["top"]) > 1.2:
            lines.append([word])
        else:
            lines[-1].append(word)
    return lines


def extract_rows(pdf_path: Path) -> list[dict]:
    rows: list[dict] = []

    with pdfplumber.open(pdf_path) as document:
        for page_number, page in enumerate(document.pages, start=1):
            page_text = page.extract_text() or ""
            if re.search(r"\bENDNOTES\b", page_text):
                break
            current: dict | None = None
            table_words = [
                word for word in page.extract_words() if 60 <= word["top"] < 530
            ]
            for line in group_lines(table_words):
                ordered = sorted(line, key=lambda item: item["x0"])
                id_word = next(
                    (
                        word
                        for word in ordered
                        if 60 <= word["x0"] < 95 and re.fullmatch(r"\d+", word["text"])
                    ),
                    None,
                )

                if id_word:
                    if current:
                        rows.append(current)
                    current = {
                        "termId": int(id_word["text"]),
                        "sourcePage": page_number,
                        **{name: [] for name in COLUMN_NAMES},
                    }

                if not current:
                    continue

                for word in ordered:
                    if word is id_word:
                        continue
                    column = word_column(word["x0"])
                    if column:
                        current[column].append(word["text"])

            if current:
                rows.append(current)

    normalized: list[dict] = []
    seen: set[int] = set()
    for row in rows:
        term_id = row["termId"]
        if term_id in seen:
            raise ValueError(f"Duplicate TA2 term id {term_id} in {pdf_path}")
        seen.add(term_id)
        normalized.append(
            {
                "termId": term_id,
                "latin": normalize_cell(row["latin"]),
                "latinSynonym": normalize_cell(row["latinSynonym"]),
                "englishUk": normalize_cell(row["englishUk"]),
                "englishUs": normalize_cell(row["englishUs"]),
                "englishSynonym": normalize_cell(row["englishSynonym"]),
                "sourcePage": row["sourcePage"],
            }
        )

    return normalized


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--part2", type=Path, required=True)
    parser.add_argument("--part5", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    source_paths = {"part2": args.part2, "part5": args.part5}
    sources = []
    all_rows: list[dict] = []

    for source_id, path in source_paths.items():
        expected = SOURCE_SPECS[source_id]
        actual_hash = sha256(path)
        if actual_hash != expected["sha256"]:
            raise ValueError(
                f"Unexpected SHA-256 for {path}: {actual_hash}; expected {expected['sha256']}"
            )
        rows = extract_rows(path)
        all_rows.extend({**row, "sourcePart": source_id} for row in rows)
        sources.append(
            {
                "id": f"fipat-ta2-2.07-{source_id}",
                "version": expected["version"],
                "url": expected["url"],
                "sha256": expected["sha256"],
                "termCount": len(rows),
            }
        )

    ids = [row["termId"] for row in all_rows]
    if len(ids) != len(set(ids)):
        raise ValueError("TA2 term ids overlap between supplied parts")

    output = {
        "schemaVersion": 1,
        "notice": (
            "FIPAT TA2 individual terms are public domain. Source statements "
            "refer to Terminologia Anatomica, second edition, version 2.07."
        ),
        "sources": sources,
        "terms": sorted(all_rows, key=lambda row: row["termId"]),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(all_rows)} TA2 rows to {args.out}")


if __name__ == "__main__":
    main()
