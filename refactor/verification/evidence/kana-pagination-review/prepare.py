"""Pin independent pagination sources without installing workspace dependencies."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / "node_modules/.cache/kana-pagination-review"
COMMIT = "d5639e71be3e5c94ba4f436eae36e5afddc0b161"
REPOSITORY = "pagedjs/paged-layout"


def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Kana-design-review"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


tree_url = f"https://api.github.com/repos/{REPOSITORY}/git/trees/{COMMIT}?recursive=1"
tree_bytes = get(tree_url)
tree = json.loads(tree_bytes)
names = [
    item["path"]
    for item in tree["tree"]
    if item["type"] == "blob"
    and (
        item["path"].startswith("src/") and item["path"].endswith(".js")
        or item["path"] in {"README.md", "package.json", "vitest.config.js"}
    )
]
destination = CACHE / "paged-layout" / COMMIT


def fetch(name):
    target = (destination / name).resolve()
    if not target.is_relative_to(destination.resolve()):
        raise RuntimeError("A source path escaped the comparison cache.")
    url = f"https://raw.githubusercontent.com/{REPOSITORY}/{COMMIT}/{name}"
    data = get(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {"path": name, "url": url, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


with ThreadPoolExecutor(max_workers=4) as executor:
    sources = list(executor.map(fetch, names))

viv_cache = ROOT / "node_modules/.cache/kana-breaks/vivliostyle/2.45.2"
source_map_path = viv_cache / "package/lib/vivliostyle.js.map"
source_map = json.loads(source_map_path.read_text(encoding="utf-8"))
embedded = []
source_destination = CACHE / "vivliostyle-sources"
for name, data in zip(source_map["sources"], source_map["sourcesContent"]):
    prefix = "../src/vivliostyle/"
    if not name.startswith(prefix) or data is None:
        continue
    relative = name[len(prefix):]
    target = (source_destination / relative).resolve()
    if not target.is_relative_to(source_destination.resolve()):
        raise RuntimeError("An embedded source escaped the comparison cache.")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(data, encoding="utf-8", newline="\n")
    embedded.append({"path": relative, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})

record = {
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "repository": REPOSITORY,
    "commit": COMMIT,
    "packageVersion": "0.1.0",
    "npmPackageAvailableAtCheck": False,
    "licenseStatement": "README states MIT; this tree contains no standalone LICENSE file.",
    "treeUrl": tree_url,
    "treeSha256": hashlib.sha256(tree_bytes).hexdigest(),
    "sources": sources,
    "vivliostyleVersion": "2.45.2",
    "vivliostyleSourceMapSha256": hashlib.sha256(source_map_path.read_bytes()).hexdigest(),
    "vivliostyleEmbeddedSources": embedded,
    "prepareSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    "packageScriptsExecuted": False,
    "workspaceDependenciesChanged": False,
}
(HERE / "source-input.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"commit": COMMIT, "sourceCount": len(sources), "embeddedSourceCount": len(embedded)}))
