"""Build a Windows candidate with explicit playback features and separate outputs."""

from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import tempfile

import pefile

from audit import CACHE, HERE, SYSTEM_IMPORTS, digest, save


INPUT = json.loads((HERE / "engine-input.json").read_text())
WORK = Path(INPUT["work"])
PREFIX = WORK / "prefix"
MSYS = CACHE / "engine-build/msys64"
SOURCE = CACHE / "engine-build/mpv-patched"
PACKAGES = {item["name"]: item for item in INPUT["inputs"]}
FFMPEG_OPTIONS = [
    "--enable-shared", "--disable-static", "--disable-gpl", "--disable-nonfree",
    "--disable-version3", "--disable-autodetect", "--disable-programs", "--disable-doc",
    "--disable-debug", "--enable-network", "--enable-schannel", "--enable-w32threads",
    "--enable-d3d11va", "--enable-dxva2", "--enable-libdav1d", "--enable-libopus",
    "--enable-libvorbis", "--enable-libvpx", "--enable-libass", "--enable-libsoxr",
    "--enable-libzimg", "--enable-libxml2", "--enable-zlib", "--enable-bzlib",
    "--enable-lzma", "--enable-iconv", "--extra-libs=-liconv", "--enable-libplacebo", "--enable-vulkan",
]
MPV_OPTIONS = [
    "--buildtype=release", "--wrap-mode=nodownload", "--auto-features=disabled",
    "-Dlibmpv=true", "-Dcplayer=false", "-Dbuild-date=false", "-Dgpl=false",
    "-Dlua=luajit", "-Djavascript=enabled", "-Dwin32-threads=enabled",
    "-Dd3d11=enabled", "-Dd3d-hwaccel=enabled", "-Dwasapi=enabled",
    "-Dshaderc=enabled", "-Dspirv-cross=enabled", "-Dgl=disabled",
    "-Diconv=enabled", "-Dzlib=enabled", "-Dlcms2=enabled", "-Dlibavdevice=enabled",
    "-Dlibcurl=disabled",
]


def msys_path(file):
    file = Path(file).resolve()
    return "/" + file.drive[0].lower() + file.as_posix()[2:]


def shell(arguments, cwd, name):
    paths = [PREFIX / "bin"] + [
        Path(item["directory"]) / ("ucrt64/bin" if item["name"].startswith("mingw-") else "usr/bin")
        for item in INPUT["inputs"] if item["kind"] == "build-tool"
    ]
    path = ":".join(msys_path(directory) for directory in paths) + ":/ucrt64/bin:/usr/bin:/c/Windows/System32"
    pkgconfig = msys_path(PREFIX / "lib/pkgconfig") + ":/ucrt64/lib/pkgconfig:/ucrt64/share/pkgconfig"
    script = "\n".join([
        "export PATH=" + shlex.quote(path), "export PKG_CONFIG_PATH=" + shlex.quote(pkgconfig),
        "export PKG_CONFIG_LIBDIR=" + shlex.quote(pkgconfig), "cd " + shlex.quote(msys_path(cwd)),
        "exec " + shlex.join(str(argument) for argument in arguments),
    ])
    environment = dict(os.environ, MSYSTEM="UCRT64", CHERE_INVOKING="1")
    log = WORK / "logs" / (name + ".log")
    print(name, flush=True)
    with log.open("w", encoding="utf-8") as stream:
        result = subprocess.run([str(MSYS / "usr/bin/bash.exe"), "--login", "-c", script],
                                cwd=WORK, env=environment, stdout=stream, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        print("\n".join(log.read_text(encoding="utf-8", errors="replace").splitlines()[-45:]))
        raise RuntimeError(f"Candidate build failed: {name}.")


def build_mujs():
    source = Path(PACKAGES["mujs"]["directory"])
    for directory in [PREFIX / "bin", PREFIX / "include", PREFIX / "lib/pkgconfig"]:
        directory.mkdir(parents=True, exist_ok=True)
    shell(["make", "one.c", "astnames.h", "opnames.h"], source, "mujs-generated")
    shell(["gcc", "-O2", "-std=c99", "-shared", "one.c", "-lm",
           "-Wl,--out-implib," + msys_path(PREFIX / "lib/libmujs.dll.a"),
           "-o", msys_path(PREFIX / "bin/mujs.dll")], source, "mujs-build")
    shutil.copyfile(source / "mujs.h", PREFIX / "include/mujs.h")
    (PREFIX / "lib/pkgconfig/mujs.pc").write_text(
        f"prefix={PREFIX.as_posix()}\nlibdir=${{prefix}}/lib\nincludedir=${{prefix}}/include\n"
        "Name: mujs\nDescription: MuJS shared library for the Windows candidate\n"
        "Version: 1.3.11\nLibs: -L${libdir} -lmujs\nCflags: -I${includedir}\n", encoding="utf-8")


def build_ffmpeg():
    source = Path(PACKAGES["ffmpeg"]["directory"])
    build = WORK / "ffmpeg-build"
    build.mkdir(exist_ok=True)
    headers = Path(PACKAGES["mingw-w64-ucrt-x86_64-vulkan-headers"]["directory"]) / "ucrt64/include"
    shell([msys_path(source / "configure"), "--prefix=" + msys_path(PREFIX),
           "--extra-cflags=-I" + headers.as_posix(),
           "--target-os=mingw32", "--arch=x86_64", "--cc=gcc", *FFMPEG_OPTIONS], build, "ffmpeg-configure")
    shell(["make", "-j8"], build, "ffmpeg-build")
    shell(["make", "install"], build, "ffmpeg-install")
    # Generated pkg-config files must work when Meson launches native Windows tools.
    for file in (PREFIX / "lib/pkgconfig").glob("lib*.pc"):
        file.write_text(re.sub(r"^prefix=.*$", "prefix=" + PREFIX.as_posix(), file.read_text(), flags=re.M),
                        encoding="utf-8")


def build_mpv():
    record = json.loads((HERE.parent / "libmpv-upstream-fix/patched-build.json").read_text())
    original = (CACHE / "engine-build/mpv-baseline/video/out/gpu/video_shaders.c").read_bytes()
    assert (SOURCE / "video/out/gpu/video_shaders.c").read_bytes() == original.replace(
        b"color.rgb *= sig[sig_idx] / sig_orig;",
        b"color.rgb *= (sig_orig != 0.0 ? sig[sig_idx] / sig_orig : 0.0);")
    build = WORK / "mpv-build"
    arguments = ["meson", "setup", msys_path(build), msys_path(SOURCE), *MPV_OPTIONS]
    if build.exists():
        arguments.append("--reconfigure")
    shell(arguments, WORK, "mpv-configure")
    shell(["meson", "compile", "-C", msys_path(build), "-j8"], WORK, "mpv-build")
    return record


def assemble():
    library = WORK / "mpv-build/libmpv-2.dll"
    lookup = {file.name.lower(): file for file in (MSYS / "ucrt64/bin").glob("*.dll")}
    lookup.update({file.name.lower(): file for file in (PREFIX / "bin").glob("*.dll")})
    lookup["libmpv-2.dll"] = library
    runtime_root = WORK / "runtimes"
    runtime_root.mkdir(exist_ok=True)
    runtime = Path(tempfile.mkdtemp(prefix="candidate-", dir=runtime_root))
    pending = [library]
    files = []
    seen = set()
    external = set()
    system = SYSTEM_IMPORTS | {"mfplat.dll", "mfuuid.dll", "dxva2.dll", "secur32.dll", "comdlg32.dll"}
    while pending:
        file = pending.pop()
        if file.name.lower() in seen:
            continue
        seen.add(file.name.lower())
        with pefile.PE(str(file), fast_load=True) as binary:
            assert binary.FILE_HEADER.Machine == 0x8664
            binary.parse_data_directories(directories=[1, 13])
            imports = sorted({entry.dll.decode("ascii").lower()
                              for table in ["DIRECTORY_ENTRY_IMPORT", "DIRECTORY_ENTRY_DELAY_IMPORT"]
                              for entry in getattr(binary, table, [])})
        for name in imports:
            if name in lookup:
                pending.append(lookup[name])
            elif name.startswith("api-ms-win-") or name in system:
                external.add(name)
            else:
                raise RuntimeError(f"Unclassified candidate dependency: {file.name}: {name}")
        shutil.copyfile(file, runtime / file.name)
        files.append({"name": file.name, "source": str(file), "sha256": digest(file),
                      "bytes": file.stat().st_size, "imports": imports})
    config_file = WORK / "mpv-build/config.h"
    config = dict(re.findall(r"^#define (HAVE_[A-Z0-9_]+) ([01])$", config_file.read_text(), re.M))
    required = ["HAVE_D3D11", "HAVE_D3D_HWACCEL", "HAVE_WASAPI", "HAVE_JAVASCRIPT", "HAVE_LUA",
                "HAVE_LIBASS", "HAVE_LIBPLACEBO", "HAVE_ZLIB", "HAVE_ICONV", "HAVE_LCMS2"]
    assert all(config[name] == "1" for name in required)
    assert config["HAVE_GPL"] == "0"
    previous = json.loads((HERE.parent / "libmpv-upstream-fix/patched-build.json").read_text())
    save(HERE / "engine-build.json", {
        "builtAt": datetime.now(timezone.utc).isoformat(), "scope": "Windows design candidate, not a release",
        "sourceCommit": previous["sourceCommit"], "patchSha256": previous["patchSha256"],
        "inputSha256": digest(HERE / "engine-input.json"), "ffmpegOptions": FFMPEG_OPTIONS,
        "mpvOptions": MPV_OPTIONS, "runtime": str(runtime), "files": sorted(files, key=lambda item: item["name"]),
        "systemImports": sorted(external), "features": {name: config[name] == "1" for name in required + ["HAVE_GPL"]},
        "configSha256": digest(config_file), "scriptSha256": digest(HERE / "build-engine.py"),
        "logs": {file.name: digest(file) for file in (WORK / "logs").glob("*.log")},
        "dynamicPluginsAndDataAudited": False, "licensesComplete": False,
        "sixTargetBuildTupleFrozen": False, "researchArtifactsModified": False,
    })
    print(json.dumps({"runtime": str(runtime), "files": len(files),
                      "bytes": sum(file["bytes"] for file in files)}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=["all", "mujs", "ffmpeg", "mpv", "assemble"], default="all")
    options = parser.parse_args()
    for item in INPUT["inputs"]:
        assert digest(item["path"]) == item["sha256"]
    if options.stage in ["all", "mujs"]:
        build_mujs()
    if options.stage in ["all", "ffmpeg"]:
        build_ffmpeg()
    if options.stage in ["all", "mpv"]:
        build_mpv()
    if options.stage in ["all", "assemble"]:
        assemble()


if __name__ == "__main__":
    main()
