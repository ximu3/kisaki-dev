"""Fetch the fixed CSS syntax parser used by the isolated author-style comparison."""

from datetime import datetime, timezone
from pathlib import Path
import base64
import hashlib
import io
import json
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / "node_modules/.cache/kana-css-input/css-tree/3.2.1"
CACHE.mkdir(parents=True, exist_ok=True)
metadata_url = "https://registry.npmjs.org/css-tree/3.2.1"
with urllib.request.urlopen(metadata_url, timeout=20) as response:
    metadata = json.load(response)
with urllib.request.urlopen(metadata["dist"]["tarball"], timeout=30) as response:
    data = response.read()
integrity = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
if integrity != metadata["dist"]["integrity"]:
    raise RuntimeError("The CSS parser artifact did not match its published integrity.")
(CACHE / "parser.tgz").write_bytes(data)
with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
    for member in archive.getmembers():
        if not (CACHE / member.name).resolve().is_relative_to(CACHE.resolve()):
            raise RuntimeError("A parser package member escaped its cache.")
    archive.extractall(CACHE, filter="data")

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
record = {
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "metadataUrl": metadata_url,
    "version": metadata["version"],
    "integrity": integrity,
    "tarballSha256": sha(CACHE / "parser.tgz"),
    "bundleSha256": sha(CACHE / "package/dist/csstree.esm.js"),
    "licenseSha256": sha(CACHE / "package/LICENSE"),
    "prepareSha256": sha(Path(__file__)),
    "workspaceDependenciesChanged": False,
    "packageScriptsExecuted": False,
}
(HERE / "source-input.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"version": record["version"], "bundleSha256": record["bundleSha256"]}))
