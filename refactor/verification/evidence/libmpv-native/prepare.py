"""Prepare one hashed Windows x64 libmpv build for isolated API probes."""

import hashlib
import json
import os
import platform
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath, PureWindowsPath

ROOT = Path(__file__).resolve().parent
REPOSITORY = Path(__file__).resolve().parents[4]
TAG = "20261018"
SOURCE_COMMIT = "01e2533f3143b8940857ca419b0b367f583e05ca"
NAME = "mpv-dev-x86_64-20261018-git-01e2533f31.7z"
URL = f"https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/{TAG}/{NAME}"
SHA256 = "d7f5621f42b6e161fe032df914a10bdece28a89df3e57c6c3e16a5a250929b5e"
SIZE = 31595598
CACHE = REPOSITORY / "node_modules/.cache/libmpv-design" / TAG
ARCHIVE = CACHE / NAME
EXTRACTED = CACHE / "extracted"
SEVEN_ZIP = REPOSITORY / "apps/desktop/node_modules/7zip-bin/win/x64/7za.exe"

if os.name != "nt" or platform.machine().lower() not in ("amd64", "x86_64"):
    raise RuntimeError("This probe input is only for Windows x64.")
if not SEVEN_ZIP.is_file():
    raise RuntimeError("The workspace 7-Zip executable is unavailable.")
CACHE.mkdir(parents=True, exist_ok=True)

if not ARCHIVE.exists():
    request = urllib.request.Request(URL, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=40) as response:
        data = response.read(SIZE + 1)
    if len(data) != SIZE or hashlib.sha256(data).hexdigest() != SHA256:
        raise RuntimeError("The downloaded probe archive does not match its published digest.")
    with ARCHIVE.open("xb") as output:
        output.write(data)

archive_data = ARCHIVE.read_bytes()
if len(archive_data) != SIZE or hashlib.sha256(archive_data).hexdigest() != SHA256:
    raise RuntimeError("The cached probe archive does not match its published digest.")

listing = subprocess.run(
    [str(SEVEN_ZIP), "l", "-slt", str(ARCHIVE)],
    capture_output=True, text=True, check=True, timeout=20,
    creationflags=subprocess.CREATE_NO_WINDOW,
).stdout.partition("----------")[2]
members = [line[7:] for line in listing.splitlines() if line.startswith("Path = ")]
if not members:
    raise RuntimeError("The probe archive has no listed members.")
for member in members:
    normalized = PurePosixPath(member.replace("\\", "/"))
    if normalized.is_absolute() or ".." in normalized.parts or PureWindowsPath(member).drive:
        raise RuntimeError("The probe archive contains a path outside its extraction directory.")

EXTRACTED.mkdir(exist_ok=True)
subprocess.run(
    [str(SEVEN_ZIP), "x", "-y", "-aos", f"-o{EXTRACTED}", str(ARCHIVE)],
    capture_output=True, text=True, check=True, timeout=30,
    creationflags=subprocess.CREATE_NO_WINDOW,
)
dlls = list(EXTRACTED.rglob("*mpv*.dll"))
if len(dlls) != 1:
    raise RuntimeError("The probe archive does not contain one unambiguous libmpv DLL.")
dll = dlls[0]
client_headers = list(EXTRACTED.rglob("client.h"))
if len(client_headers) != 1:
    raise RuntimeError("The probe archive does not contain one unambiguous client header.")

receipt = {
    "purpose": "isolated Windows x64 C API probe, not a selected release dependency",
    "preparedAt": datetime.now(timezone.utc).isoformat(),
    "source": URL,
    "sourceCommit": SOURCE_COMMIT,
    "publishedDigest": f"sha256:{SHA256}",
    "archiveBytes": SIZE,
    "archiveSha256": hashlib.sha256(archive_data).hexdigest(),
    "dll": str(dll),
    "dllSha256": hashlib.sha256(dll.read_bytes()).hexdigest(),
    "clientHeader": str(client_headers[0]),
    "selectedForRelease": False,
}
(ROOT / "binary-input.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"prepared": True, "archiveSha256": SHA256, "dllName": dll.name}))
