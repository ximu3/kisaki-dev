"""Record primary sources for the confirmed Kana organization."""

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "epub-layout": (
        "https://www.w3.org/TR/epub-33/",
        ("rendition:layout", "rendition:layout-reflowable"),
    ),
    "epub-cfi": (
        "https://w3c.github.io/epub-specs/epub33/epubcfi/",
        ("UTF-16", "spine"),
    ),
    "pdfjs-document": (
        "https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html",
        ("PDFDataRangeTransport", "PDFWorker", "cMapUrl"),
    ),
    "zipjs-reader": (
        "https://gildas-lormeau.github.io/zip.js/api/classes/Reader.html",
        ("readUint8Array", "createReadable"),
    ),
    "html-sandbox": (
        "https://html.spec.whatwg.org/multipage/iframe-embed-object.html",
        ("allow-same-origin", "allow-scripts"),
    ),
    "dom-range": (
        "https://dom.spec.whatwg.org/",
        ("concept-range-bp-set", "setStart", "setEnd"),
    ),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(
        url, headers={"User-Agent": "Kisaki-design-verification"}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {
            "name": name,
            "url": url,
            "finalUrl": response.url,
            "status": response.status,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    body = data.decode("utf-8")
    if not all(marker in body for marker in markers):
        raise ValueError(f"An expected source marker is absent: {name}.")
    receipt["presentMarkers"] = list(markers)
    return receipt


def main():
    with ThreadPoolExecutor(max_workers=4) as executor:
        receipts = list(executor.map(fetch, SOURCES.items()))
    result = {
        "purpose": "source evidence for organization, not format or browser execution",
        "designStatus": "organization-confirmed",
        "dependencyVersionsLocked": False,
        "kanaProjectCreated": False,
        "formatsExecuted": False,
        "browserLayoutExecuted": False,
        "positionRoundTripExecuted": False,
        "sources": receipts,
    }
    output = ROOT / "organization-source-contract.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceReceipts": len(receipts), "kanaExecuted": False}))


if __name__ == "__main__":
    main()
