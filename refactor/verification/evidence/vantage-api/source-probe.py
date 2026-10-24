"""Record platform sources for the confirmed Vantage public-value semantics."""

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "windows-open-process": (
        "https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess",
        ("OpenProcess", "dwDesiredAccess"),
    ),
    "windows-process-path": (
        "https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew",
        ("QueryFullProcessImageNameW", "PROCESS_QUERY_LIMITED_INFORMATION"),
    ),
    "windows-foreground": (
        "https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow",
        ("GetForegroundWindow", "NULL"),
    ),
    "windows-focus": (
        "https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow",
        ("SetForegroundWindow", "restric"),
    ),
    "windows-terminate": (
        "https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess",
        ("TerminateProcess", "asynchronous"),
    ),
    "windows-close": (
        "https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-close",
        ("WM_CLOSE", "confirmation"),
    ),
    "linux-pidfd": (
        "https://man7.org/linux/man-pages/man2/pidfd_open.2.html",
        ("pidfd_open", "PIDFD_NONBLOCK"),
    ),
    "linux-comm": (
        "https://man7.org/linux/man-pages/man5/proc_pid_comm.5.html",
        ("TASK_COMM_LEN", "truncated"),
    ),
    "macos-foreground": (
        "https://developer.apple.com/documentation/appkit/nsworkspace/frontmostapplication.md",
        ("frontmostApplication", "NSRunningApplication"),
    ),
    "macos-executable": (
        "https://developer.apple.com/documentation/appkit/nsrunningapplication/executableurl.md",
        ("executableURL", "URL?"),
    ),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(
        url, headers={"User-Agent": "Kisaki-design-verification"}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {
            "name": name,
            "url": url,
            "finalUrl": response.url,
            "status": response.status,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    body = data.decode("utf-8")
    if not all(marker in body for marker in markers):
        raise ValueError(f"An expected source marker is absent: {name}.")
    receipt["presentMarkers"] = list(markers)
    return receipt


def main():
    with ThreadPoolExecutor(max_workers=4) as executor:
        receipts = list(executor.map(fetch, SOURCES.items()))
    result = {
        "purpose": "source evidence for public values and operation semantics",
        "designStatus": "public-values-confirmed",
        "nativeAddonBuilt": False,
        "vantageApiExecuted": False,
        "windowBackendExecuted": False,
        "captureExecuted": False,
        "platformMatrixCompleted": False,
        "sources": receipts,
    }
    output = ROOT / "source-contract.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceReceipts": len(receipts), "vantageApiExecuted": False}))


if __name__ == "__main__":
    main()
