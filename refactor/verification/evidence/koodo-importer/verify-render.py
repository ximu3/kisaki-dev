"""Measure how closely rendered blue regions match the normalized PDF quads."""

import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path

from PIL import Image


def blue_regions(image):
    """Return four-connected blue regions as half-open pixel bounds."""
    width, height = image.size
    pixels = image.load()
    remaining = set()
    for y in range(height):
        for x in range(width):
            red, green, blue = pixels[x, y]
            if red < 70 and 60 < green < 140 and blue > 170:
                remaining.add((x, y))

    bounds = []
    while remaining:
        seed = remaining.pop()
        region = [seed]
        pending = [seed]
        while pending:
            x, y = pending.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    pending.append(neighbor)
                    region.append(neighbor)

        xs, ys = zip(*region)
        bounds.append([min(xs), min(ys), max(xs) + 1, max(ys) + 1])

    return sorted(bounds)


def quad_bounds(quad, width, height):
    """Convert a normalized quad to raster coordinates."""
    xs, ys = zip(*quad)
    return [min(xs) * width, min(ys) * height, max(xs) * width, max(ys) * height]


def review(root):
    """Compare each fixture page and identify the exact inputs in the report."""
    geometry_path = root / "synthetic-results.json"
    geometry_source = geometry_path.read_bytes()
    geometry = json.loads(geometry_source)["pdfGeometry"]
    checks = []
    images = []
    for page in geometry:
        page_index = page["pageIndex"]
        path = root / "preview" / f"page-{page_index + 1}.png"
        image_source = path.read_bytes()
        with Image.open(BytesIO(image_source)) as original:
            width, height = original.size
            regions = blue_regions(original.convert("RGB"))

        checks.append({
            "name": f"page {page_index} renders two separate selected lines",
            "passed": len(regions) == 2,
        })
        expected_regions = [quad_bounds(quad, width, height) for quad in page["quads"]]
        for index, expected in enumerate(expected_regions):
            match = any(
                max(abs(actual - wanted) for actual, wanted in zip(region, expected)) <= 2
                for region in regions
            )
            checks.append({
                "name": f"page {page_index} line {index} matches normalized PDF quad within two raster pixels",
                "passed": match,
            })

        images.append({
            "path": path.relative_to(root).as_posix(),
            "width": width,
            "height": height,
            "sha256": hashlib.sha256(image_source).hexdigest(),
            "blueRegions": regions,
            "expectedRegions": expected_regions,
        })

    pdf_path = root / "fixtures/library/book/pdf-book.pdf"
    return {
        "evidenceClass": "rendered-synthetic-pdf-geometry",
        "inputPdfSha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
        "geometrySourceSha256": hashlib.sha256(geometry_source).hexdigest(),
        "passed": sum(item["passed"] for item in checks),
        "failed": sum(not item["passed"] for item in checks),
        "checks": checks,
        "images": images,
    }


def main():
    """Write the computed report to standard output."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, default=Path(__file__).resolve().parent)
    result = review(parser.parse_args().evidence_dir)
    print(json.dumps(result, indent=2))
    return int(result["failed"] > 0)


if __name__ == "__main__":
    raise SystemExit(main())
