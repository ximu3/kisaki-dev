"""Build two complete libmpv variants using one frozen, private MSYS2 environment."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parents[4]
EVIDENCE = Path(__file__).resolve().parent
CACHE = ROOT / "node_modules/.cache/libmpv-design/engine-build"
MSYS = CACHE / "msys64"
COMMIT = "01e2533f3143b8940857ca419b0b367f583e05ca"
PATCH = EVIDENCE.parent / "libmpv-composition/upstream-black-guard.patch"
OPTIONS = [
    "--buildtype=release",
    "--wrap-mode=nodownload",
    "--auto-features=disabled",
    "-Dlibmpv=true",
    "-Dcplayer=false",
    "-Dbuild-date=false",
    "-Dtests=true",
    "-Dlibavdevice=enabled",
    "-Dlua=luajit",
    "-Dwin32-threads=enabled",
    "-Dd3d11=enabled",
    "-Dshaderc=enabled",
    "-Dspirv-cross=enabled",
    "-Dgl=disabled",
]


def digest(file):
    with Path(file).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(file, value):
    file.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def shell(arguments, log=None):
    env = os.environ.copy()
    env.update(MSYSTEM="UCRT64", CHERE_INVOKING="1")
    command = [str(MSYS / "usr/bin/bash.exe"), "--login", "-c", shlex.join(arguments)]
    if log:
        with log.open("w", encoding="utf-8") as stream:
            result = subprocess.run(command, cwd=CACHE, env=env, stdout=stream,
                                    stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            print("\n".join(log.read_text(encoding="utf-8", errors="replace").splitlines()[-45:]))
            raise RuntimeError(f"Build command failed; inspect {log.name}.")
        return None
    return subprocess.check_output(command, cwd=CACHE, env=env, text=True,
                                   encoding="utf-8", creationflags=subprocess.CREATE_NO_WINDOW).strip()


def msys_path(file):
    return "/" + file.drive[0].lower() + file.as_posix()[2:]


def runtime_inputs():
    return {file.name: {"size": file.stat().st_size, "sha256": digest(file)}
            for file in sorted((MSYS / "ucrt64/bin").glob("*.dll"))}


def freeze():
    installed = shell(["pacman", "-Q"])
    dlls = runtime_inputs()
    file = EVIDENCE / "dependencies.json"
    if file.exists():
        saved = json.loads(file.read_text(encoding="utf-8"))
        assert saved["installedPackages"] == installed, "Installed packages changed."
        assert saved["runtimeDlls"] == dlls, "Runtime dependencies changed."
        return saved
    saved = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "bootstrap": {
            "url": "https://github.com/msys2/msys2-installer/releases/download/2026-09-27/msys2-base-x86_64-20260927.tar.xz",
            "sha256": digest(CACHE / "msys2-base-x86_64-20260927.tar.xz"),
        },
        "installedPackages": installed,
        "tools": {name: shell(command) for name, command in {
            "gcc": ["gcc", "--version"],
            "meson": ["meson", "--version"],
            "ninja": ["ninja", "--version"],
            "pkgconf": ["pkgconf", "--version"],
            "dependencies": ["pkgconf", "--modversion", "libavcodec", "libavfilter", "libavformat", "libavutil", "libswscale", "libswresample", "libass", "libplacebo", "luajit", "shaderc", "spirv-cross-c-shared"],
        }.items()},
        "runtimeDlls": dlls,
        "packageArchives": {file.name: {"size": file.stat().st_size, "sha256": digest(file)}
                            for file in sorted((MSYS / "var/cache/pacman/pkg").glob("*.pkg.tar.zst"))},
        "retryMirrorConfiguration": "https://repo.msys2.org/",
        "productionDependencySelection": False,
    }
    assert saved["bootstrap"]["sha256"] == "ea2f31a0b6ade63914ce441ffb022f0f6aa96982bfefa2326460a26d5fb01322"
    write_json(file, saved)
    return saved


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("variant", choices=["baseline", "patched"])
    variant = parser.parse_args().variant
    dependencies = freeze()
    source = CACHE / f"mpv-{variant}"
    build = CACHE / f"build-{variant}"
    if variant == "patched" and not source.exists():
        baseline = json.loads((EVIDENCE / "baseline-contract.json").read_text(encoding="utf-8"))
        failures = [item for item in baseline["cases"]
                    if item["group"] == "previous-diagnostic" and item["subtitle"]
                    and item["transfer"] == "linear" and item["peakNits"] == 100
                    and item["toneMapping"] == "auto"]
        assert len(failures) == 6
        assert all(all(sample["nonFinite"] > 0 for sample in item["samples"]) for item in failures)
        shell(["git", "clone", "--quiet", "--no-hardlinks", "mpv-baseline", "mpv-patched"])
        shell(["git", "-C", source.name, "apply", "--check", msys_path(PATCH)])
        shell(["git", "-C", source.name, "apply", msys_path(PATCH)])
    assert shell(["git", "-C", source.name, "rev-parse", "HEAD"]) == COMMIT
    status = shell(["git", "-C", source.name, "status", "--porcelain"])
    if variant == "baseline":
        assert status == "", "Baseline source is modified."
    else:
        assert status.strip() == "M video/out/gpu/video_shaders.c"
        original = (CACHE / "mpv-baseline/video/out/gpu/video_shaders.c").read_bytes()
        before = b"color.rgb *= sig[sig_idx] / sig_orig;"
        after = b"color.rgb *= (sig_orig != 0.0 ? sig[sig_idx] / sig_orig : 0.0);"
        assert original.count(before) == 1
        assert (source / "video/out/gpu/video_shaders.c").read_bytes() == original.replace(before, after)
    configure_log = CACHE / f"configure-{variant}.log"
    print(f"Configuring {variant} with frozen dependencies.", flush=True)
    configure = ["meson", "setup", build.name, source.name, *OPTIONS]
    if build.exists():
        configure.append("--reconfigure")
    shell(configure, configure_log)
    print(f"Compiling {variant}.", flush=True)
    compile_log = CACHE / f"compile-{variant}.log"
    shell(["meson", "compile", "-C", build.name, "-j", "8"], compile_log)
    print(f"Running upstream tests for {variant}.", flush=True)
    test_log = CACHE / f"tests-{variant}.log"
    wrapper = f"python {shlex.quote((EVIDENCE / 'test-wrapper.py').as_posix())}"
    shell(["meson", "test", "-C", build.name, "--print-errorlogs", "--timeout-multiplier", "2",
           "--num-processes", "1", "--wrapper", wrapper], test_log)
    candidates = list(build.glob("*mpv-2.dll"))
    assert len(candidates) == 1
    dll = candidates[0]
    runtime = CACHE / "runtime" / variant
    runtime.mkdir(parents=True, exist_ok=True)
    for file in (MSYS / "ucrt64/bin").glob("*.dll"):
        target = runtime / file.name
        if target.exists():
            assert digest(target) == dependencies["runtimeDlls"][file.name]["sha256"]
        else:
            target.hardlink_to(file)
    shutil.copy2(dll, runtime / "libmpv-2.dll")
    freeze()
    assert shell(["git", "-C", source.name, "status", "--porcelain"]) == status
    record = {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "variant": variant,
        "sourceCommit": COMMIT,
        "sourceRemote": "https://github.com/mpv-player/mpv.git",
        "sourceStatus": status,
        "sourceDiff": shell(["git", "-C", source.name, "diff", "--no-ext-diff"]),
        "patchSha256": digest(PATCH) if variant == "patched" else None,
        "buildScriptSha256": digest(__file__),
        "testWrapperSha256": digest(EVIDENCE / "test-wrapper.py"),
        "dependenciesSha256": digest(EVIDENCE / "dependencies.json"),
        "options": OPTIONS,
        "dll": {"path": str(runtime / "libmpv-2.dll"), "sha256": digest(dll)},
        "artifacts": {str(file.relative_to(CACHE)): digest(file) for file in [
            configure_log, compile_log, test_log, build / "config.h",
            build / "meson-info/intro-buildoptions.json", build / "meson-info/intro-dependencies.json",
            build / "meson-logs/testlog-python.json",
        ]},
        "testOutput": test_log.read_text(encoding="utf-8"),
        "productionEngineModified": False,
    }
    write_json(EVIDENCE / f"{variant}-build.json", record)
    print(json.dumps({"variant": variant, "dllSha256": record["dll"]["sha256"], "testsPassed": True}), flush=True)


if __name__ == "__main__":
    main()
