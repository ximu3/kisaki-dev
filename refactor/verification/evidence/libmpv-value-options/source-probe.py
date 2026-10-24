"""Record primary sources for comparison of public value representation choices."""

import hashlib
import html
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMMIT = "41f6a645068483470267271e1d09966ca3b9f413"
BASE = f"https://raw.githubusercontent.com/mpv-player/mpv/{COMMIT}/"
SOURCES = {
    "client": (BASE + "include/mpv/client.h", ["stay valid until the next mpv_wait_event()", "The keys are in random order"]),
    "node-copy": (BASE + "options/m_option.c", ["static void dup_node", "new->keys[n] = talloc_strdup"]),
    "user-data": (BASE + "player/command.c", ["static int do_op_udata", "m_option_copy(&udata_type, node, arg)"]),
    "commands": (BASE + "DOCS/man/input.rst", ["user-data", "MPV_FORMAT_BYTE_ARRAY"]),
    "node-worker": ("https://nodejs.org/download/release/v24.11.1/docs/api/worker_threads.html", ["object prototypes are not preserved", "JavaScript classes"]),
    "node-fs": ("https://nodejs.org/download/release/v24.11.1/docs/api/fs.html", ["fspromisesreaddirpath-options", "encoding"]),
    "napi-values": ("https://napi.rs/docs/concepts/values", ["Clone over Reference", "native class identity"]),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {"name": name, "url": url, "finalUrl": response.url, "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    body = data.decode("utf-8")
    normalized = body
    if name in {"node-worker", "node-fs", "napi-values"}:
        normalized = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", body)))
    receipt["markers"] = {marker: marker in body or marker in normalized for marker in markers}
    if not all(receipt["markers"].values()):
        raise ValueError(f"An expected source marker is absent: {name}.")
    return receipt


with ThreadPoolExecutor(max_workers=4) as pool:
    receipts = list(pool.map(fetch, SOURCES.items()))

result = {
    "purpose": "source evidence for comparing alternatives; not proof of a chosen public API",
    "designStatus": "exploration",
    "mpvRef": "v0.41.0",
    "mpvCommit": COMMIT,
    "nativeAddonExecuted": False,
    "nativeUserDataRoundTripExecuted": False,
    "nativeCommandsExecuted": False,
    "sources": receipts,
}
(ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceReceipts": len(receipts), "designStatus": result["designStatus"], "nativeExecuted": False}))
