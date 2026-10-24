"""Fetch one fixed layout-engine artifact into the isolated experiment cache."""

from pathlib import Path
from datetime import datetime, timezone
import base64
import hashlib
import io
import json
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[3] / "node_modules/.cache/kana-breaks/vivliostyle/2.45.2"
CACHE.mkdir(parents=True, exist_ok=True)
metadata_url = "https://registry.npmjs.org/@vivliostyle/core/2.45.2"
with urllib.request.urlopen(metadata_url, timeout=20) as response:
    metadata = json.load(response)
with urllib.request.urlopen(metadata["dist"]["tarball"], timeout=30) as response:
    archive_bytes = response.read()
integrity = "sha512-" + base64.b64encode(hashlib.sha512(archive_bytes).digest()).decode()
if integrity != metadata["dist"]["integrity"]:
    raise RuntimeError("The layout artifact did not match its published integrity.")
(CACHE / "core.tgz").write_bytes(archive_bytes)
with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:gz") as archive:
    for member in archive.getmembers():
        if not (CACHE / member.name).resolve().is_relative_to(CACHE.resolve()):
            raise RuntimeError("A package member escaped its cache directory.")
    archive.extractall(CACHE, filter="data")

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
license_url = "https://raw.githubusercontent.com/vivliostyle/vivliostyle.js/" + metadata["gitHead"] + "/LICENSE"
with urllib.request.urlopen(license_url, timeout=20) as response:
    (CACHE / "upstream-LICENSE").write_bytes(response.read())
record = {
    "recordedAt": datetime.now(timezone.utc).isoformat(),
    "metadataUrl": metadata_url,
    "version": metadata["version"],
    "licenseIdentifier": metadata.get("license"),
    "gitHead": metadata.get("gitHead"),
    "integrity": integrity,
    "tarballSha256": sha(CACHE / "core.tgz"),
    "bundleSha256": sha(CACHE / "package/lib/vivliostyle.js"),
    "licenseIncludedInPackage": (CACHE / "package/LICENSE").is_file(),
    "upstreamLicenseUrl": license_url,
    "upstreamLicenseSha256": sha(CACHE / "upstream-LICENSE"),
    "prepareSha256": sha(Path(__file__)),
    "packageScriptsExecuted": False,
    "workspaceDependenciesChanged": False,
}
(HERE / "layout-input.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: record[key] for key in ["version", "integrity", "bundleSha256"]}))
