"""Record sources for the pending subscription delivery and lifetime proposal."""

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
    "client-header": (BASE + "include/mpv/client.h", ["mpv_observe_property", "mpv_unobserve_property", "mpv_hook_continue", '"overflow"']),
    "client-implementation": (BASE + "player/client.c", ["static int reserve_reply", "static void send_reply", "gen_property_change_event(ctx)", "gen_log_message_event(ctx)", '"file_error"']),
    "node-events": ("https://nodejs.org/download/release/v24.11.1/docs/api/events.html", ["returned by the called listeners are ignored", "captureRejections"]),
    "node-api": ("https://nodejs.org/download/release/v24.11.1/docs/api/n-api.html", ["napi_fatal_exception", "napi_fatal_error", "napi_tsfn_nonblocking", "napi_queue_full", "napi_async_init", "napi_make_callback", "napi_async_destroy"]),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {"name": name, "url": url, "finalUrl": response.url, "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    body = data.decode("utf-8")
    normalized = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", body))) if name.startswith("node-") else body
    receipt["markers"] = {marker: marker in body or marker in normalized for marker in markers}
    if not all(receipt["markers"].values()):
        raise ValueError(f"An expected source marker is absent: {name}.")
    return receipt


with ThreadPoolExecutor(max_workers=4) as pool:
    receipts = list(pool.map(fetch, SOURCES.items()))

result = {
    "purpose": "sources for a subscription proposal, not native execution",
    "designStatus": "proposal",
    "mpvRef": "v0.41.0",
    "mpvCommit": COMMIT,
    "nativeAddonExecuted": False,
    "callbackAndCloseRacesVerified": False,
    "queueCapacityVerified": False,
    "eventAndLogPayloadsComplete": False,
    "sources": receipts,
}
(ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceReceipts": len(receipts), "designStatus": result["designStatus"], "nativeExecuted": False}))
