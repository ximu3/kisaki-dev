"""Record primary sources for the confirmed native-project organization."""

import hashlib
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMMIT = "41f6a645068483470267271e1d09966ca3b9f413"
SOURCES = {
    "mpv-release": "https://api.github.com/repos/mpv-player/mpv/releases/tags/v0.41.0",
    "mpv-tag": "https://api.github.com/repos/mpv-player/mpv/git/ref/tags/v0.41.0",
    "mpv-tag-object": "https://api.github.com/repos/mpv-player/mpv/git/tags/2c219aa822df18a1b7fd9abe3e151cd93ad67307",
    "mpv-client": f"https://raw.githubusercontent.com/mpv-player/mpv/{COMMIT}/include/mpv/client.h",
    "mpv-render": f"https://raw.githubusercontent.com/mpv-player/mpv/{COMMIT}/include/mpv/render.h",
    "node-api": "https://nodejs.org/docs/latest-v24.x/api/n-api.html",
    "napi-rs-start": "https://napi.rs/docs/introduction/getting-started",
    "napi-rs-threads": "https://napi.rs/docs/concepts/threadsafe-function",
    "napi-rs-lifetime": "https://napi.rs/docs/concepts/understanding-lifetime",
    "napi-rs-packages": "https://napi.rs/docs/cli/create-npm-dirs",
    "cargo-workspaces": "https://doc.rust-lang.org/cargo/reference/workspaces.html",
    "cargo-package-layout": "https://doc.rust-lang.org/cargo/guide/project-layout.html",
    "rust-modules": "https://doc.rust-lang.org/book/ch07-05-separating-modules-into-different-files.html",
    "gnome-extension-layout": "https://gjs.guide/extensions/overview/anatomy.html",
    "kwin-script-layout": "https://develop.kde.org/docs/plasma/kwin/",
    "electron-texture": "https://www.electronjs.org/docs/latest/api/shared-texture",
}


def fetch(item):
    name, url = item
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {"name": name, "url": url, "finalUrl": response.url, "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    return name, data.decode("utf-8"), receipt


fetched = list(ThreadPoolExecutor(max_workers=4).map(fetch, SOURCES.items()))
texts = {name: body for name, body, _ in fetched}
tag = json.loads(texts["mpv-tag-object"])
if tag["object"]["sha"] != COMMIT:
    raise ValueError("The pinned mpv tag no longer resolves to the recorded commit.")
client = texts["mpv-client"]
api_version = re.search(r"#define MPV_CLIENT_API_VERSION MPV_MAKE_VERSION\((\d+),\s*(\d+)\)", client)
if api_version is None:
    raise ValueError("The fixed client API version could not be identified.")
symbols = {}
for source, names in {
    "mpv-client": ["mpv_command_node_async", "mpv_get_property_async", "mpv_set_property_async", "mpv_observe_property", "mpv_wait_event", "mpv_set_wakeup_callback", "mpv_free_node_contents", "mpv_terminate_destroy"],
    "mpv-render": ["mpv_render_context_create", "mpv_render_context_set_update_callback", "mpv_render_context_update", "mpv_render_context_render", "mpv_render_context_free", "MPV_RENDER_API_TYPE_OPENGL", "MPV_RENDER_API_TYPE_SW"],
}.items():
    lines = texts[source].splitlines()
    symbols[source] = {name: next((index for index, line in enumerate(lines, 1) if name in line), None) for name in names}
    if any(line is None for line in symbols[source].values()):
        raise ValueError("An expected API symbol is absent from the fixed source.")
release = json.loads(texts["mpv-release"])
result = {
    "purpose": "source evidence for organization, not native feasibility execution",
    "mpvRef": "v0.41.0",
    "mpvCommit": COMMIT,
    "mpvPublishedAt": release["published_at"],
    "clientApiVersion": ".".join(api_version.groups()),
    "symbols": symbols,
    "nativeProjectsBuilt": False,
    "nativeBackendsExecuted": False,
    "gpuOrElectronTransferExecuted": False,
    "sources": [receipt for _, _, receipt in fetched],
}
(ROOT / "organization-source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceReceipts": len(fetched), "mpvRef": result["mpvRef"], "clientApiVersion": result["clientApiVersion"], "nativeExecuted": False}))
