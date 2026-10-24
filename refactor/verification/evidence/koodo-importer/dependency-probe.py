"""Inspect the exact Rangy dependency as source data without executing it."""

import base64
import hashlib
import io
import json
import tarfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REGISTRY = "https://registry.npmjs.org/rangy/1.3.0"


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        data = response.read()
        return data, {
            "url": url,
            "status": response.status,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }


metadata_bytes, registry = fetch(REGISTRY)
metadata = json.loads(metadata_bytes)
assert metadata["version"] == "1.3.0"
archive, package = fetch(metadata["dist"]["tarball"])
integrity = "sha512-" + base64.b64encode(hashlib.sha512(archive).digest()).decode()
assert integrity == metadata["dist"]["integrity"]
with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
    source_path = "package/lib/rangy-textrange.js"
    source = bundle.extractfile(source_path).read()
assert b"saveCharacterRanges" in source and b"restoreCharacterRanges" in source
result = {
    "package": "rangy",
    "version": "1.3.0",
    "integrity": integrity,
    "sourceCodeExecuted": False,
    "sources": [registry, package],
    "member": {
        "path": source_path,
        "bytes": len(source),
        "sha256": hashlib.sha256(source).hexdigest(),
    },
    "findings": [
        "saveCharacterRanges records characterRange start/end and backward.",
        "With omitted options, JSON serialization omits characterOptions.",
        "Indices use rendered visible text rules, not raw textContent offsets.",
    ],
}
(ROOT / "dependency-contract.json").write_text(
    json.dumps(result, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps({"package": result["package"], "version": result["version"], "verified": True}))
