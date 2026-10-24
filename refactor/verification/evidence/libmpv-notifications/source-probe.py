"""Record pinned notification declarations and source locations, without loading mpv."""

import hashlib
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
    "client-header": ("include/mpv/client.h", [
        "mpv_event_start_file", "mpv_event_end_file", "mpv_event_client_message",
        "mpv_event_log_message", "terminal-default", "all weak mpv_handles are destroyed",
    ]),
    "client-implementation": ("player/client.c", [
        "int mpv_request_event(", "int mpv_request_log_messages(",
        "level != ctx->messages_level", '"file_error"', 'mpv_error_string(eef->error)',
        '[MPV_EVENT_IDLE] = "idle"', '[MPV_EVENT_TICK] = "tick"',
    ]),
    "log-implementation": ("common/msg.c", [
        "buffer_level = log->terminal_level", "lev != MSGL_STATUS",
        '.prefix = "overflow"', "if (root->early_buffer)",
        "root->early_buffer = NULL", "buffer->dropped += 1",
    ]),
    "initialization": ("player/main.c", ["mp_msg_set_early_logging(mpctx->global, true)"]),
}


def fetch(item):
    name, (path, markers) = item
    url = BASE + path
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {
            "name": name, "url": url, "finalUrl": response.url,
            "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        }
    body = data.decode("utf-8")
    receipt["markers"] = {
        marker: [i for i, line in enumerate(body.splitlines(), 1) if marker in line]
        for marker in markers
    }
    if not all(receipt["markers"].values()):
        raise ValueError(f"An expected source location is absent: {name}.")
    return name, body, receipt


with ThreadPoolExecutor(max_workers=4) as pool:
    fetched = list(pool.map(fetch, SOURCES.items()))
bodies = {name: body for name, body, _ in fetched}
header = bodies["client-header"]


def enum_values(prefix):
    return {name: int(value) for name, value in re.findall(rf"\b({prefix}\w+)\s*=\s*(-?\d+)\b", header)}


def struct_fields(name):
    match = re.search(rf"typedef struct {name}\s*\{{(.*?)\}}\s*{name}\s*;", header, re.S)
    if match is None:
        raise ValueError(f"A documented structure is absent: {name}.")
    body = re.sub(r"/\*.*?\*/", "", match[1], flags=re.S)
    return [re.sub(r"\s+", " ", field).strip() for field in body.split(";") if field.strip()]


end_fields = struct_fields("mpv_event_end_file")
expected_fields = [
    "mpv_end_file_reason reason", "int error", "int64_t playlist_entry_id",
    "int64_t playlist_insert_id", "int playlist_insert_num_entries",
]
if end_fields != expected_fields:
    raise ValueError("The end-file field contract differs from the inspected declaration.")

reasons = enum_values("MPV_END_FILE_REASON_")
if list(reasons.values()) != [0, 2, 3, 4, 5]:
    raise ValueError("The end-file reason codes differ from the inspected declaration.")
levels = enum_values("MPV_LOG_LEVEL_")
if list(levels.values()) != [0, 10, 20, 30, 40, 50, 60, 70]:
    raise ValueError("The log level codes differ from the inspected declaration.")

events = dict(re.findall(r'\[(MPV_EVENT_\w+)\]\s*=\s*"([^"]+)"', bodies["client-implementation"]))
ordinary = [
    "shutdown", "start-file", "end-file", "file-loaded", "client-message",
    "video-reconfig", "audio-reconfig", "seek", "playback-restart", "idle", "tick",
]
if not all(name in events.values() for name in ordinary):
    raise ValueError("An ordinary notification name is absent from the native table.")

result = {
    "purpose": "pinned source declarations and locators for the notification proposal",
    "designStatus": "proposal", "mpvRef": "v0.41.0", "mpvCommit": COMMIT,
    "declarations": {
        "endFileFields": end_fields,
        "startFileFields": struct_fields("mpv_event_start_file"),
        "logMessageFields": struct_fields("mpv_event_log_message"),
        "clientMessageFields": struct_fields("mpv_event_client_message"),
        "endFileReasons": reasons, "logLevels": levels,
        "ordinaryEventNames": ordinary,
    },
    "nativeAddonExecuted": False,
    "eventCopyAndTextDecodingVerified": False,
    "independentLogSelectionVerified": False,
    "earlyLogExclusionVerified": False,
    "queueCapacityAndGapDeliveryVerified": False,
    "weakClientShutdownVerified": False,
    "sources": [receipt for _, _, receipt in fetched],
}
(ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceReceipts": len(fetched), "ordinaryEventNames": len(ordinary), "endFileFields": len(end_fields), "nativeExecuted": False}))
