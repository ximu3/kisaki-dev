"""Record versioned KWin source facts without executing a desktop backend."""

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
VERSIONS = ("v5.24.7", "v5.27.12", "v6.6.0", "v6.7.0", "v6.8.0")
REMOVAL_COMMIT = "0ea31ae72eb052cb9c9cc508318fc3f0f329ed53"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
        receipt = {
            "url": url,
            "finalUrl": response.url,
            "status": response.status,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
        }
    return body, receipt


def inspect_version(version):
    directory = "src/effects/screenshot" if version.startswith("v5.") else "src/plugins/screenshot"
    url = f"https://raw.githubusercontent.com/KDE/kwin/{version}/{directory}/screenshotdbusinterface2.cpp"
    body, receipt = fetch(url)
    source = body.decode("utf-8")
    markers = {
        "captureWindow": "::CaptureWindow(" in source,
        "checkPermissions": "checkPermissions" in source,
        "restrictedInterfaceLookup": "fetchRestrictedDBusInterfacesFromPid" in source,
    }
    expected_check = version != "v6.8.0"
    assert markers["captureWindow"], version
    assert markers["checkPermissions"] == expected_check, version
    assert markers["restrictedInterfaceLookup"] == expected_check, version
    return {"version": version, **receipt, "markers": markers}


def main():
    with ThreadPoolExecutor(max_workers=len(VERSIONS)) as executor:
        versions = list(executor.map(inspect_version, VERSIONS))

    body, receipt = fetch(f"https://api.github.com/repos/KDE/kwin/commits/{REMOVAL_COMMIT}")
    commit = json.loads(body)
    assert commit["sha"] == REMOVAL_COMMIT
    files = [item["filename"] for item in commit["files"]]
    assert "src/plugins/screenshot/screenshotdbusinterface2.cpp" in files
    assert "src/plugins/screenshot/org.kde.KWin.ScreenShot2.xml" in files

    result = {
        "purpose": "Versioned source evidence for Linux integration design",
        "designStatus": "proposal",
        "nativeCaptureExecuted": False,
        "desktopRegistrationExecuted": False,
        "appImageIdentityVerified": False,
        "desktopProtocolExecuted": False,
        "versions": versions,
        "removalCommit": {
            **receipt,
            "sha": commit["sha"],
            "committedAt": commit["commit"]["committer"]["date"],
            "files": files,
        },
    }
    output = ROOT / "linux-integration-source-contract.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Recorded {len(versions)} versioned source checks and the removal commit.")


if __name__ == "__main__":
    main()
