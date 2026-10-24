"""Record call-contract sources without claiming native permission or capture execution."""

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "node-api": ("https://nodejs.org/docs/latest-v24.x/api/n-api.md", ("napi_fatal_exception", "napi_add_async_cleanup_hook")),
    "node-abort": ("https://nodejs.org/docs/latest-v24.x/api/globals.md", ("AbortSignal.timeout(delay)", "AbortSignal.any(signals)")),
    "macos-screen-request": ("https://developer.apple.com/documentation/coregraphics/cgrequestscreencaptureaccess().md", ("CGRequestScreenCaptureAccess", "10.15.0")),
    "macos-screen-preflight": ("https://developer.apple.com/documentation/coregraphics/cgpreflightscreencaptureaccess().md", ("CGPreflightScreenCaptureAccess", "Bool")),
    "macos-cursor": ("https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/showscursor.md", ("showsCursor", "12.3.0")),
    "macos-window-shadow": ("https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/ignoreshadowssinglewindow.md", ("ignoreShadowsSingleWindow", "14.0.0")),
    "macos-content-rect": ("https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/contentrect.md", ("contentRect", "12.3.0")),
    "macos-scale-factor": ("https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/scalefactor.md", ("scaleFactor", "12.3.0")),
    "macos-frame-status": ("https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/status.md", ("SCStreamFrameInfo", "12.3.0")),
    "mutter-42-window": ("https://raw.githubusercontent.com/GNOME/mutter/42.0/data/dbus-interfaces/org.gnome.Mutter.ScreenCast.xml", ("RecordWindow", "cursor-mode", "hidden")),
    "kwin-5.24-window": ("https://raw.githubusercontent.com/KDE/kwin/v5.24.7/src/effects/screenshot/screenshotdbusinterface2.cpp", ("CaptureWindow", "checkPermissions", "screenShotFlagsFromOptions")),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {"name": name, "url": url, "finalUrl": response.url, "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    body = data.decode("utf-8")
    if not all(marker in body for marker in markers):
        raise ValueError(f"An expected source marker is absent: {name}.")
    receipt["presentMarkers"] = list(markers)
    return receipt


def main():
    with ThreadPoolExecutor(max_workers=4) as executor:
        receipts = list(executor.map(fetch, SOURCES.items()))
    result = {
        "purpose": "call-contract source evidence, not native execution",
        "designStatus": "proposal",
        "vantageAddonExecuted": False,
        "permissionPromptExecuted": False,
        "nativeObservationSchedulingVerified": False,
        "windowGeometryVerified": False,
        "macos13ShadowExclusionVerified": False,
        "captureTimeoutCalibrated": False,
        "sources": receipts,
    }
    (ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceReceipts": len(receipts), "nativeExecutionVerified": False}))


if __name__ == "__main__":
    main()
