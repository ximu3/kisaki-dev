"""Record fixed upstream sources for the confirmed principal libmpv call semantics."""

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMMIT = "41f6a645068483470267271e1d09966ca3b9f413"
BASE = f"https://raw.githubusercontent.com/mpv-player/mpv/{COMMIT}/"
SOURCES = {
    "client": ("include/mpv/client.h", ["MPV_FORMAT_INT64", "MPV_ERROR_PROPERTY_UNAVAILABLE", "mpv_command_node_async", "mpv_abort_async_command", "MPV_EVENT_QUEUE_OVERFLOW", "mpv_observe_property"]),
    "render": ("include/mpv/render.h", ["mpv_render_context_free", "MPV_RENDER_API_TYPE_OPENGL"]),
    "commands": ("DOCS/man/input.rst", ["screenshot-raw", "Asynchronous command details"]),
    "screenshot": ("player/screenshot.c", ["void cmd_screenshot_raw", 'node_map_add_int64(res, "stride"', ".size = img->stride[0] * img->h"]),
    "node-values": ("misc/node.c", ["struct mpv_node *node_map_badd", "not check for already existing entries under the same key"]),
}


def fetch(item):
    name, (path, markers) = item
    url = BASE + path
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {"name": name, "url": url, "finalUrl": response.url, "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    lines = data.decode("utf-8").splitlines()
    receipt["markers"] = {marker: next((index for index, line in enumerate(lines, 1) if marker in line), None) for marker in markers}
    if any(line is None for line in receipt["markers"].values()):
        raise ValueError(f"An expected source marker is absent: {name}.")
    return receipt


with ThreadPoolExecutor(max_workers=4) as pool:
    receipts = list(pool.map(fetch, SOURCES.items()))

result = {
    "purpose": "source review for confirmed principal call semantics; no native execution or complete public contract",
    "designStatus": "call-semantics-confirmed",
    "mpvRef": "v0.41.0",
    "mpvCommit": COMMIT,
    "publicValueRepresentationComplete": False,
    "nativeProjectsBuilt": False,
    "nativeCallsExecuted": False,
    "screenshotLayoutsExecuted": False,
    "gpuOrElectronTransferExecuted": False,
    "sources": receipts,
}
(ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceReceipts": len(receipts), "mpvRef": result["mpvRef"], "designStatus": result["designStatus"], "nativeExecuted": False}))
