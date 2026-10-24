"""Audit the existing research binaries; this does not select a release build."""

from datetime import datetime, timezone
from pathlib import Path
import ctypes
import hashlib
import json
import re

import pefile


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / "node_modules/.cache/libmpv-design"
RUNTIME = CACHE / "engine-build/runtime/patched"
REDIST = Path("D:/Microsoft Visual Studio/2022/Community/VC/Redist/MSVC/14.42.34433/x64/Microsoft.VC143.CRT")
SYSTEM_IMPORTS = set("""
advapi32.dll avicap32.dll avrt.dll bcrypt.dll bcryptprimitives.dll cfgmgr32.dll
crypt32.dll d3d11.dll dnsapi.dll dwmapi.dll dwrite.dll dxgi.dll gdi32.dll
gdiplus.dll imm32.dll iphlpapi.dll kernel32.dll msimg32.dll ncrypt.dll ntdll.dll
ole32.dll oleaut32.dll rpcrt4.dll shcore.dll shell32.dll shlwapi.dll user32.dll
userenv.dll usp10.dll uxtheme.dll version.dll winmm.dll ws2_32.dll wsock32.dll
""".split())
CRT_IMPORTS = {"msvcp140.dll", "vcruntime140.dll", "vcruntime140_1.dll"}


def digest(file):
    with Path(file).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def save(file, value):
    file.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def package_owners():
    owners = {}
    database = CACHE / "engine-build/msys64/var/lib/pacman/local"
    for directory in database.iterdir():
        description = directory / "desc"
        files = directory / "files"
        if not description.is_file() or not files.is_file():
            continue
        fields = {}
        for block in description.read_text(encoding="utf-8").strip().split("\n\n"):
            lines = block.splitlines()
            if lines:
                fields[lines[0].strip("%")] = lines[1:]
        for name in files.read_text(encoding="utf-8").splitlines():
            if name.startswith("ucrt64/bin/") and name.lower().endswith(".dll"):
                owners[Path(name).name.lower()] = {
                    "name": fields["NAME"][0],
                    "version": fields["VERSION"][0],
                    "declaredLicenses": fields.get("LICENSE", []),
                }
    return owners


def main():
    engine = json.loads((HERE.parent / "libmpv-upstream-fix/patched-build.json").read_text())
    gpu = json.loads((HERE.parent / "libmpv-gpu/native-contract.json").read_text())
    addon = CACHE / "gpu-target/libmpv-gpu-probe.node"
    assert digest(addon) == gpu["addonSha256"]
    assert digest(RUNTIME / "libmpv-2.dll") == engine["dll"]["sha256"]
    owners = package_owners()
    lookup = {p.name.lower(): p for p in RUNTIME.glob("*.dll")}
    lookup.update({name: REDIST / name for name in CRT_IMPORTS})
    pending = [addon, RUNTIME / "libmpv-2.dll"]
    seen = set()
    files = []
    external = {}
    while pending:
        file = pending.pop()
        if file in seen:
            continue
        seen.add(file)
        with pefile.PE(str(file), fast_load=True) as binary:
            assert binary.FILE_HEADER.Machine == 0x8664, file
            binary.parse_data_directories(directories=[1, 13])
            imports = []
            for table, kind in [("DIRECTORY_ENTRY_IMPORT", "normal"),
                                ("DIRECTORY_ENTRY_DELAY_IMPORT", "delay")]:
                for entry in getattr(binary, table, []):
                    name = entry.dll.decode("ascii").lower()
                    imports.append({"name": name, "kind": kind})
                    if name in lookup:
                        pending.append(lookup[name])
                    elif name.startswith("api-ms-win-") or name in SYSTEM_IMPORTS:
                        external.setdefault(name, set()).add(file.name)
                    else:
                        raise RuntimeError(f"Unclassified import: {file.name}: {name}")
        role = "addon" if file == addon else "msvc-runtime" if file.parent == REDIST else "media-runtime"
        files.append({"path": "native/" + file.name, "source": str(file), "role": role,
                      "bytes": file.stat().st_size, "sha256": digest(file),
                      "machine": "amd64", "imports": sorted(imports, key=lambda item: (item["name"], item["kind"])),
                      "package": owners.get(file.name.lower()) if role == "media-runtime" else None})
    config_file = CACHE / "engine-build/build-patched/config.h"
    config = dict(re.findall(r"^#define (HAVE_[A-Z0-9_]+) ([01])$", config_file.read_text(), re.M))
    features = {name: config[name] == "1" for name in [
        "HAVE_D3D11", "HAVE_D3D_HWACCEL", "HAVE_GL", "HAVE_JAVASCRIPT", "HAVE_LUA",
        "HAVE_WASAPI", "HAVE_LIBASS", "HAVE_LIBPLACEBO", "HAVE_LIBCURL",
    ]}
    ffmpeg = {}
    for name, prefix in [("avcodec-63.dll", "avcodec"), ("avformat-63.dll", "avformat"),
                         ("avfilter-12.dll", "avfilter")]:
        library = ctypes.CDLL(str(RUNTIME / name), winmode=0x1100)
        result = {}
        for field in ["configuration", "license"]:
            function = getattr(library, prefix + "_" + field)
            function.restype = ctypes.c_char_p
            result[field] = function().decode("utf-8")
        ffmpeg[name] = result
    value = {
        "checkedAt": datetime.now(timezone.utc).isoformat(), "target": "win32-x64-msvc",
        "scope": "private research package, not a release candidate", "pefile": pefile.__version__,
        "sourceCommit": engine["sourceCommit"], "patchSha256": engine["patchSha256"],
        "engineReceiptSha256": digest(HERE.parent / "libmpv-upstream-fix/patched-build.json"),
        "researchBuildOptions": engine["options"], "configSha256": digest(config_file),
        "researchFeatures": features, "ffmpeg": ffmpeg,
        "runtimeDirectoryFiles": len(list(RUNTIME.glob("*.dll"))),
        "runtimeDirectoryBytes": sum(p.stat().st_size for p in RUNTIME.glob("*.dll")),
        "files": sorted(files, key=lambda item: item["path"].lower()),
        "systemImports": {key: sorted(value) for key, value in sorted(external.items())},
        "systemImportClassification": "explicit Windows imports and API-set namespace; no arbitrary System32 fallback",
        "msvcSource": str(REDIST), "dynamicPluginsAndDataAudited": False,
        "releaseLicensesComplete": False, "formalEngineSelected": False,
        "sources": {"audit.py": digest(HERE / "audit.py")},
    }
    save(HERE / "dependency-audit.json", value)
    print(json.dumps({"files": len(files), "bytes": sum(item["bytes"] for item in files),
                      "roles": {role: sum(item["role"] == role for item in files)
                                for role in ["addon", "media-runtime", "msvc-runtime"]},
                      "features": features}))


if __name__ == "__main__":
    main()
