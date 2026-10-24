"""Record platform sources without claiming a verified capture backend."""

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "windows-window-identity": ("https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-iswindow", ("IsWindow", "recycled")),
    "windows-capture-item": ("https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow", ("CreateForWindow", "1903")),
    "windows-free-threaded-pool": ("https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.direct3d11captureframepool.createfreethreaded?view=winrt-26100", ("CreateFreeThreaded", "1809", "17763")),
    "windows-cursor-control": ("https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.iscursorcaptureenabled?view=winrt-26100", ("IsCursorCaptureEnabled", "2004", "19041")),
    "windows-capture-hdr": ("https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture", ("DXGI_FORMAT_R16G16B16A16_FLOAT", "ContentSize")),
    "windows-print": ("https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-printwindow", ("PrintWindow", "blocking")),
    "macos-stream": ("https://developer.apple.com/documentation/screencapturekit/scstream.md", ("SCStream", "stopCapture")),
    "macos-filter": ("https://developer.apple.com/documentation/screencapturekit/sccontentfilter.md", ("desktopIndependentWindow", "SCWindow")),
    "macos-pixel-format": ("https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/pixelformat.md", ("BGRA", "420v")),
    "macos-color-space": ("https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/colorspacename.md", ("colorSpaceName", "display")),
    "macos-window-id": ("https://developer.apple.com/documentation/screencapturekit/scwindow/windowid.md", ("windowID", "CGWindowID")),
    "macos-terminate": ("https://developer.apple.com/documentation/appkit/nsrunningapplication/terminate().md", ("terminate", "before")),
    "macos-capture-access": ("https://developer.apple.com/documentation/coregraphics/cgpreflightscreencaptureaccess().md", ("CGPreflightScreenCaptureAccess", "Bool")),
    "x11-composite": ("https://www.x.org/releases/current/doc/compositeproto/compositeproto.txt", ("NameWindowPixmap", "resized")),
    "x11-process-hint": ("https://specifications.freedesktop.org/wm/latest/ar01s05.html", ("_NET_WM_PID", "WM_CLIENT_MACHINE")),
    "xdg-screencast-portal": ("https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html", ("SelectSources", "restore_token", "Start")),
    "mutter-42": ("https://raw.githubusercontent.com/GNOME/mutter/42.0/data/dbus-interfaces/org.gnome.Mutter.ScreenCast.xml", ("RecordWindow", "window-id")),
    "mutter-current": ("https://raw.githubusercontent.com/GNOME/mutter/main/data/dbus-interfaces/org.gnome.Mutter.ScreenCast.xml", ("RecordWindow", "window-id")),
    "kwin-5.24.7": ("https://raw.githubusercontent.com/KDE/kwin/v5.24.7/src/effects/screenshot/screenshotdbusinterface2.cpp", ("CaptureWindow", "checkPermissions", "bytesPerLine")),
    "kwin-current": ("https://raw.githubusercontent.com/KDE/kwin/master/src/plugins/screenshot/screenshotdbusinterface2.cpp", ("CaptureWindow", "QUuid")),
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
        "purpose": "platform route evidence, not complete capture validation",
        "designStatus": "platform-direction-confirmed",
        "windowsMinimumBuild": 19041,
        "nativeBackendBuilt": False,
        "windowsGraphicsCaptureExecuted": False,
        "olderWindowsCaptureValidated": False,
        "macosWindowMappingValidated": False,
        "linuxDesktopBackendExecuted": False,
        "colorConversionValidated": False,
        "platformMatrixCompleted": False,
        "sources": receipts,
    }
    (ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceReceipts": len(receipts), "captureBackendValidated": False}))


if __name__ == "__main__":
    main()
