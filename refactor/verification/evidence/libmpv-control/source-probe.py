"""Inventory pinned control APIs and record primary sources without executing libmpv."""

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
    "client-header": (BASE + "include/mpv/client.h", [
        "MPV_ERROR_GENERIC", "hooks can't be removed explicitly",
        "same hook with same priority", "Unknown values should be treated as unknown",
        "Any handle can make the core quit",
        "Errors when setting options", "mpv_get_time_ns",
    ]),
    "client-implementation": (BASE + "player/client.c", [
        "mpv_create_weak_client", "mpv_load_config_file", "mpv_get_property_osd_string",
    ]),
    "hook-implementation": (BASE + "player/command.c", [
        "mp_hook_test_completion", "mp_client_id_exists(mpctx, h->client_id)",
        "mp_hook_continue(mpctx, h->client_id, h->seq)", "hook_remove(mpctx, h)",
        "return (*h1)->priority - (*h2)->priority",
    ]),
    "input-manual": (BASE + "DOCS/man/input.rst", [
        "Hooks", "on_load_fail", "on_after_end_file", "barriers",
    ]),
    "lua-hooks": (BASE + "DOCS/man/lua.rst", [
        "mp.add_hook(type, priority, fn)",
        "Returning from the hook function should not automatically continue",
        "Doesn't need to be called unless",
    ]),
    "stream-header": (BASE + "include/mpv/stream_cb.h", ["mpv_stream_cb_add_ro"]),
    "render-header": (BASE + "include/mpv/render.h", ["mpv_render_context_create"]),
    "node-errors": ("https://nodejs.org/download/release/v24.11.1/docs/api/errors.html", ["ABORT_ERR", "error.cause"]),
    "node-api": ("https://nodejs.org/download/release/v24.11.1/docs/api/n-api.html", [
        "napi_add_async_cleanup_hook", "napi_remove_async_cleanup_hook",
        "napi_ref_threadsafe_function", "napi_unref_threadsafe_function",
    ]),
    "node-timers": ("https://nodejs.org/download/release/v24.11.1/docs/api/timers.html", [
        "timeout.unref()", "timeout.ref()", "timeout.hasRef()", "AbortError",
    ]),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {
            "name": name, "url": url, "finalUrl": response.url,
            "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        }
    body = data.decode("utf-8")
    normalized = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", body))) if name.startswith("node-") else body
    receipt["markers"] = {marker: marker in body or marker in normalized for marker in markers}
    if not all(receipt["markers"].values()):
        raise ValueError(f"An expected source marker is absent: {name}.")
    return name, body, receipt


with ThreadPoolExecutor(max_workers=6) as pool:
    fetched = list(pool.map(fetch, SOURCES.items()))
bodies = {name: body for name, body, _ in fetched}
header = bodies["client-header"]
stripped = re.sub(r"/\*.*?\*/", "", header, flags=re.S)
declarations = re.findall(r"^MPV_EXPORT\s+.*?;", stripped, re.M | re.S)
functions = [re.search(r"\b(mpv_\w+)\s*\(", item).group(1) for item in declarations]
errors = {name: int(value) for name, value in re.findall(r"\b(MPV_ERROR_\w+)\s*=\s*(-?\d+)", header)}
assert errors["MPV_ERROR_SUCCESS"] == 0
assert set(errors.values()) == set(range(-20, 1))
hook_section = bodies["input-manual"].split("\nHooks\n", 1)[1].split("\nInput Command Prefixes\n", 1)[0]
hooks = re.findall(r"^``(on_\w+)``\s*$", hook_section, re.M)
assert len(hooks) == 6

groups = [
    ("public", "getClientApiVersion", ["mpv_client_api_version"]),
    ("ownedInternal", "safe error metadata; native messages are not classification keys", ["mpv_error_string"]),
    ("ownedInternal", "native memory ownership", ["mpv_free", "mpv_free_node_contents"]),
    ("public", "actual client identity snapshots", ["mpv_client_name", "mpv_client_id"]),
    ("public", "createMpv initialization", ["mpv_create", "mpv_initialize", "mpv_set_option"]),
    ("mapped", "explicit string-valued initialization option", ["mpv_set_option_string"]),
    ("ownedInternal", "detach owned clients after their work is settled", ["mpv_destroy"]),
    ("public", "Mpv.close", ["mpv_terminate_destroy"]),
    ("proposal", "Mpv-owned named clients; raw strong/weak choice stays private", ["mpv_create_client", "mpv_create_weak_client"]),
    ("public", "loadConfigFile; native partial-application semantics", ["mpv_load_config_file"]),
    ("public", "getTimeNs", ["mpv_get_time_ns"]),
    ("mapped", "nanosecond clock can be expressed in microseconds", ["mpv_get_time_us"]),
    ("mapped", "one structured command API with independent value representations", ["mpv_command", "mpv_command_node", "mpv_command_ret", "mpv_command_async", "mpv_command_node_async"]),
    ("notExposedParser", "textual command parser is not a second public input grammar; structured flags remain available", ["mpv_command_string"]),
    ("ownedInternal", "best-effort native abort after AbortSignal cancellation", ["mpv_abort_async_command"]),
    ("mapped", "setProperty with explicit input representation", ["mpv_set_property", "mpv_set_property_string", "mpv_set_property_async"]),
    ("mapped", "structured del command", ["mpv_del_property"]),
    ("public", "getProperty; complete low-level format selection remains a separate audit", ["mpv_get_property", "mpv_get_property_async"]),
    ("public", "getPropertyText plain or osd", ["mpv_get_property_string", "mpv_get_property_osd_string"]),
    ("public", "observeProperty; value-less notification mode remains a separate audit", ["mpv_observe_property"]),
    ("ownedInternal", "independent subscription cleanup", ["mpv_unobserve_property"]),
    ("ownedInternal", "typed event name mapping", ["mpv_event_name"]),
    ("mapped", "direct C event records preserve codes omitted by event_to_node", ["mpv_event_to_node"]),
    ("ownedInternal", "event selection without disabling replies or core shutdown", ["mpv_request_event"]),
    ("public", "observeLogs and finite initializationLogs", ["mpv_request_log_messages"]),
    ("ownedInternal", "native event pump and wakeup scheduling", ["mpv_wait_event", "mpv_wakeup", "mpv_set_wakeup_callback"]),
    ("ownedInternal", "cleanup after outstanding native requests", ["mpv_wait_async_requests"]),
    ("proposal", "addHook awaits task handlers; guarded native continuation stays private", ["mpv_hook_add", "mpv_hook_continue"]),
    ("deprecated", "Node uses wakeup integration; no borrowed raw file descriptor", ["mpv_get_wakeup_pipe"]),
]
coverage = {}
for category, responsibility, names in groups:
    for name in names:
        if name in coverage:
            raise ValueError(f"Duplicate API ownership: {name}.")
        coverage[name] = {"category": category, "responsibility": responsibility}
if set(functions) != set(coverage):
    raise ValueError("The Client API inventory and ownership map do not match.")

result = {
    "purpose": "control API source inventory, not native execution",
    "mpvRef": "v0.41.0", "mpvCommit": COMMIT,
    "nativeErrors": errors, "knownHooks": hooks, "clientApiFunctionCount": len(functions),
    "nativeAddonExecuted": False,
    "nativeErrorInstancesVerified": False,
    "clientAndHookDisposalVerified": False,
    "asyncHookExecutionVerified": False,
    "nodeEnvironmentCleanupVerified": False,
    "queueCapacityVerified": False,
    "scopeDecisionsComplete": False,
    "sources": [receipt for _, _, receipt in fetched],
}
(ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
(ROOT / "client-api-coverage.json").write_text(json.dumps({
    "scope": "every client.h function, not every parameter combination or all mpv headers",
    "mpvCommit": COMMIT,
    "nativeExecuted": False,
    "functions": [{"name": name, **coverage[name]} for name in functions],
    "remaining": ["low-level property formats", "value-less property notifications", "complete command/option/property catalogues", "Stream CB interface", "Render API and platform interoperability"],
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"sourceReceipts": len(fetched), "clientApiFunctions": len(functions), "negativeErrorCodes": len(errors)-1, "knownHooks": len(hooks), "nativeExecuted": False}))
