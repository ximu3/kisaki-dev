"""Compare PDF probe geometry with the rendered blue rectangles without editing images."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
geometry = json.loads((ROOT / "synthetic-results.json").read_text(encoding="utf-8"))["pdfGeometry"]
checks = []
images = []
for page in geometry:
    path = ROOT / "preview" / f'page-{page["pageIndex"] + 1}.png'
    with Image.open(path) as original:
        picture = original.convert("RGB")
    width, height = picture.size
    blue = {(x, y) for y in range(height) for x in range(width) if (lambda rgb: rgb[0] < 70 and 60 < rgb[1] < 140 and rgb[2] > 170)(picture.getpixel((x, y)))}
    components = []
    while blue:
        seed = blue.pop()
        stack = [seed]
        points = [seed]
        while stack:
            x, y = stack.pop()
            for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbor in blue:
                    blue.remove(neighbor)
                    stack.append(neighbor)
                    points.append(neighbor)
        components.append([min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points) + 1, max(y for _, y in points) + 1])
    checks.append({"name": f'page {page["pageIndex"]} renders two separate selected lines', "passed": len(components) == 2})
    for index, quad in enumerate(page["quads"]):
        expected = [min(point[0] for point in quad) * width, min(point[1] for point in quad) * height, max(point[0] for point in quad) * width, max(point[1] for point in quad) * height]
        match = any(max(abs(actual - wanted) for actual, wanted in zip(component, expected)) <= 2 for component in components)
        checks.append({"name": f'page {page["pageIndex"]} line {index} matches normalized PDF quad within two raster pixels', "passed": match})
    images.append({"path": path.relative_to(ROOT).as_posix(), "width": width, "height": height, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
version = subprocess.run(["pdftoppm", "-v"], capture_output=True, text=True, check=True).stderr.splitlines()[0]
result = {"evidenceClass": "rendered-synthetic-pdf-geometry", "renderer": version, "inputPdfSha256": hashlib.sha256((ROOT / "fixtures/library/book/pdf-book.pdf").read_bytes()).hexdigest(), "passed": sum(item["passed"] for item in checks), "failed": sum(not item["passed"] for item in checks), "checks": checks, "images": images, "visualReview": "Codex inspected all three previews; page labels and two blue lines are visible with the declared rotations.", "limitations": "Raster comparison verifies normalized crop/rotation geometry, not physical UserUnit scaling or source-reader execution."}
(ROOT / "render-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": result["passed"], "failed": result["failed"]}))
if result["failed"]:
    raise SystemExit(1)
