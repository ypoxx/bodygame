#!/usr/bin/env python3
"""Compare deterministic Blender previews and optionally write a JSON report."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    before = Image.open(args.before).convert("RGB")
    after = Image.open(args.after).convert("RGB")
    if before.size != after.size:
        raise ValueError(f"Image sizes differ: {before.size} != {after.size}")

    difference = ImageChops.difference(before, after)
    stats = ImageStat.Stat(difference)
    mae = sum(stats.mean) / 3
    rms = math.sqrt(sum(value * value for value in stats.rms) / 3)
    changed = sum(1 for pixel in difference.get_flattened_data() if pixel != (0, 0, 0))
    pixel_count = before.width * before.height
    report = {
        "before": str(args.before),
        "after": str(args.after),
        "resolution": [before.width, before.height],
        "mae_8bit": round(mae, 6),
        "rms_8bit": round(rms, 6),
        "psnr_db": round(20 * math.log10(255 / rms), 6) if rms else None,
        "changed_pixel_ratio": round(changed / pixel_count, 8),
    }

    payload = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(payload, encoding="utf-8")
    print(payload, end="")


if __name__ == "__main__":
    main()
