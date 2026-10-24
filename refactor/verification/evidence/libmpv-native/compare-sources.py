"""Compare relevant C source bodies between the design and probe-build revisions."""

import hashlib
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REVISIONS = {
    "design": "41f6a645068483470267271e1d09966ca3b9f413",
    "probe": "01e2533f3143b8940857ca419b0b367f583e05ca",
}
PATHS = ["player/client.c", "stream/stream_cb.c"]


def fetch(item):
    label, revision, path = item
    url = f"https://raw.githubusercontent.com/mpv-player/mpv/{revision}/{path}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"}), timeout=25) as response:
        data = response.read()
        status = response.status
    return label, path, data.decode("utf-8"), {"revision": revision, "path": path, "url": url, "status": status, "sha256": hashlib.sha256(data).hexdigest()}


with ThreadPoolExecutor(max_workers=4) as pool:
    fetched = list(pool.map(fetch, [(label, revision, path) for label, revision in REVISIONS.items() for path in PATHS]))
bodies = {(label, path): body for label, path, body, _ in fetched}
comparisons = {}
for name in ["getproperty_fn", "mpv_observe_property", "mpv_stream_cb_add_ro"]:
    extracted = {}
    for label in REVISIONS:
        body = bodies[label, "player/client.c"]
        match = re.search(rf"^(?:static )?(?:int|void) {name}\([^;]*?\n\{{.*?^\}}", body, re.M | re.S)
        if not match:
            raise RuntimeError(f"The expected source function is absent: {label}/{name}.")
        extracted[label] = match.group(0)
    comparisons[name] = {"sameBody": extracted["design"] == extracted["probe"], "sha256": {label: hashlib.sha256(body.encode()).hexdigest() for label, body in extracted.items()}}
comparisons["stream/stream_cb.c"] = {"sameFile": bodies["design", "stream/stream_cb.c"] == bodies["probe", "stream/stream_cb.c"]}
result = {"checkedAt": datetime.now(timezone.utc).isoformat(), "revisions": REVISIONS, "comparisons": comparisons, "receipts": [receipt for _, _, _, receipt in fetched], "provesDesignRevisionExecuted": False}
(ROOT / "source-comparison.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({name: item.get("sameBody", item.get("sameFile")) for name, item in comparisons.items()}))
