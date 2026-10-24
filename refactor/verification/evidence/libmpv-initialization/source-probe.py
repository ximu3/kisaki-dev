"""Record initialization source facts without loading or running a native library."""

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
    "client-header": ("include/mpv/client.h", [
        "avoid doing concurrent accesses on the uninitialized", "semi-deprecated",
        "mpv_set_option", "mpv_initialize", "config-dir",
    ]),
    "client-implementation": ("player/client.c", [
        'm_config_set_profile(mpctx->mconfig, "libmpv", 0)',
        "m_config_set_option_node(ctx->mpctx->mconfig, bstr0(name), data, 0)",
        "int r = mpv_set_option(ctx, name, format, data)",
        "case MPV_ERROR_OPTION_NOT_FOUND: return MPV_ERROR_PROPERTY_NOT_FOUND",
        "int mpv_initialize(mpv_handle *ctx)",
    ]),
    "embedded-defaults": ("etc/builtin.conf", [
        "[libmpv]", "config=no", "idle=yes", "terminal=no",
    ]),
    "core-initialization": ("player/main.c", [
        "mp_msg_set_early_logging(mpctx->global, true)",
        "mp_parse_cfgfiles(mpctx)", "mp_load_scripts(mpctx)",
    ]),
    "render-header": ("include/mpv/render.h", [
        "at most 1 context", "mpv_render_context_free", "mpv_render_context_create",
    ]),
    "render-implementation": ("video/out/vo_libmpv.c", [
        "int mpv_render_context_create(", "ctx->global = mp_client_get_global(mpv)",
        "mp_set_main_render_context(ctx->client_api, ctx, true)",
    ]),
}


def fetch(item):
    name, (path, markers) = item
    request = urllib.request.Request(BASE + path, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {
            "name": name, "url": BASE + path, "finalUrl": response.url,
            "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        }
    text = data.decode("utf-8")
    receipt["markers"] = {
        marker: [i for i, line in enumerate(text.splitlines(), 1) if marker in line]
        for marker in markers
    }
    if not all(receipt["markers"].values()):
        raise ValueError(f"An expected source location is absent: {name}.")
    return name, text, receipt


with ThreadPoolExecutor(max_workers=6) as pool:
    sources = list(pool.map(fetch, SOURCES.items()))
bodies = {name: text for name, text, _ in sources}
profile = bodies["embedded-defaults"].split("[libmpv]\n", 1)[1].split("\n[", 1)[0]
defaults = dict(line.split("=", 1) for line in profile.splitlines() if "=" in line and not line.startswith("#"))
assert defaults["config"] == "no"
assert defaults["terminal"] == "no"
assert defaults["idle"] == "yes"

result = {
    "purpose": "initialization proposal source receipts, not native verification",
    "designStatus": "proposal", "mpvRef": "v0.41.0", "mpvCommit": COMMIT,
    "embeddedDefaults": defaults,
    "nativeAddonExecuted": False,
    "optionApplicationVerified": False,
    "initializationLogsVerified": False,
    "cancellationAndCleanupVerified": False,
    "managedRenderingBeforeInitializationVerified": False,
    "scriptAndRenderingStartupVerified": False,
    "sources": [receipt for _, _, receipt in sources],
}
(ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceReceipts": len(sources), "embeddedDefaults": len(defaults), "nativeExecuted": False}))
