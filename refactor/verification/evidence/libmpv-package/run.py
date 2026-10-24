"""Pack private fixtures and consume their tarballs without development PATH entries."""

from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
import os
import shutil
import subprocess
import tarfile
import tempfile

from audit import CACHE, HERE, ROOT, digest, save


def execute(arguments, **kwargs):
    process = subprocess.run([str(item) for item in arguments], capture_output=True,
                             text=True, encoding="utf-8", errors="replace", timeout=90,
                             creationflags=subprocess.CREATE_NO_WINDOW, **kwargs)
    if process.returncode:
        raise RuntimeError(f"Command failed ({process.returncode}):\n{process.stdout[-4000:]}\n{process.stderr[-4000:]}")
    return process


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, default=HERE / "dependency-audit.json")
    options = parser.parse_args()
    audit_file = options.audit.resolve()
    audit = json.loads(audit_file.read_text())
    assert digest(HERE / "audit.py") == audit["sources"]["audit.py"]
    graphics = json.loads((HERE.parent / "libmpv-gpu/binary-input.json").read_text())
    sdr = json.loads((HERE.parent / "libmpv-sdr-integration/source-input.json").read_text())
    sample = Path(graphics["sample"]["path"])
    assert digest(sample) == graphics["sample"]["sha256"]
    executable = Path(graphics["electron"]["runtime"]) / "electron.exe"
    assert digest(executable) == sdr["electronExeSha256"]
    cache = CACHE / "package"
    cache.mkdir(exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="pack ", dir=cache))
    staging = work / "staging"
    public = staging / "main"
    platform = staging / "platform"
    dist = work / "tarballs"
    consumer = work / "consumer"
    empty_cwd = work / "empty working directory"
    for directory in [public, platform / "native", dist, consumer, empty_cwd]:
        directory.mkdir(parents=True)
    version = "0.0.0-probe.2"
    main_name = "@libmpv-design/loader-probe"
    platform_name = "@libmpv-design/loader-probe-win32-x64"
    common = {"version": version, "private": True, "license": "UNLICENSED"}
    save(public / "package.json", {**common, "name": main_name, "main": "loader.cjs",
                                  "exports": "./loader.cjs", "files": ["loader.cjs"],
                                  "optionalDependencies": {platform_name: version}})
    save(platform / "package.json", {**common, "name": platform_name, "os": ["win32"],
                                    "cpu": ["x64"], "main": "platform.cjs",
                                    "exports": "./platform.cjs",
                                    "files": ["platform.cjs", "artifact.json", "native", "fixture.ppm"]})
    shutil.copyfile(HERE / "loader.cjs", public / "loader.cjs")
    (platform / "platform.cjs").write_text(
        "module.exports = { root: __dirname, version: require('./package.json').version, "
        "manifest: require('./artifact.json') }\n", encoding="utf-8")
    for file in audit["files"]:
        assert digest(file["source"]) == file["sha256"], file["path"]
        shutil.copyfile(file["source"], platform / file["path"])
    shutil.copyfile(sample, platform / "fixture.ppm")
    manifest = {"scope": audit["scope"], "version": version, "target": audit["target"],
                "nodeApi": 8, "files": [{key: file[key] for key in ["path", "role", "sha256", "bytes"]}
                                         for file in audit["files"]],
                "auditSha256": digest(audit_file),
                "notForPublication": True, "thirdPartyNoticesComplete": False}
    save(platform / "artifact.json", manifest)
    pnpm = shutil.which("pnpm")
    node = shutil.which("node")
    assert pnpm and node
    pnpm_version = execute([pnpm, "--version"], cwd=ROOT).stdout.strip()
    for directory in [public, platform]:
        execute([pnpm, "--dir", directory, "pack", "--pack-destination", dist], cwd=ROOT)
    tarballs = {}
    for file in dist.glob("*.tgz"):
        with tarfile.open(file) as archive:
            package = json.load(archive.extractfile("package/package.json"))
            assert "scripts" not in package
            assert all(item.name.startswith("package/") for item in archive.getmembers())
            tarballs[package["name"]] = {"path": str(file), "sha256": digest(file),
                                       "bytes": file.stat().st_size, "package": package}
    assert set(tarballs) == {main_name, platform_name}
    # Local overrides resolve the exact private platform tarball without a registry publication.
    dependencies = {name: "file:" + value["path"].replace("\\", "/") for name, value in tarballs.items()}
    save(consumer / "package.json", {"name": "isolated-libmpv-consumer", "private": True,
                                    "dependencies": dependencies,
                                    "pnpm": {"overrides": {platform_name: dependencies[platform_name]}}})
    execute([pnpm, "--dir", consumer, "install", "--ignore-workspace", "--offline",
             "--ignore-scripts", "--no-lockfile", "--store-dir", work / "pnpm store"], cwd=ROOT)
    shutil.copyfile(HERE / "consumer.cjs", consumer / "consumer.cjs")
    environment = dict(os.environ)
    for name in ["NODE_OPTIONS", "NODE_PATH", "ELECTRON_RUN_AS_NODE"]:
        environment.pop(name, None)
    # This affects only the two owned child processes, never the workstation environment.
    environment["PATH"] = str(Path(os.environ["SystemRoot"]) / "System32")
    results = []
    for name, host in [("node", Path(node)), ("electron", executable)]:
        process = execute([host, consumer / "consumer.cjs"], cwd=empty_cwd, env=environment)
        result = json.loads((consumer / (name + ".json")).read_text())
        installed = Path(result["platform"])
        assert installed.resolve().is_relative_to(consumer.resolve())
        assert Path(result["main"]).resolve().is_relative_to(consumer.resolve())
        assert result["path"] == environment["PATH"] and result["frameResourcesReleased"]
        # Keep paths below the diagnostic report's observed truncation boundary.
        # This constrains only the observer, not the package loader.
        assert all(len(str(installed / file["path"])) < 260 for file in audit["files"])
        for file in audit["files"]:
            assert digest(installed / file["path"]) == file["sha256"], file["path"]
        roles = {Path(file["path"]).name.lower(): file["role"] for file in audit["files"]}
        observed = []
        for file in result.pop("observedModules"):
            actual = Path(file)
            role = roles[actual.name.lower()]
            packaged = actual.samefile(installed / "native" / actual.name)
            if role != "msvc-runtime":
                assert packaged, file
            observed.append({"name": actual.name, "role": role, "packaged": packaged, "path": file})
        assert any(item["name"].lower() == "libmpv-2.dll" for item in observed)
        assert {item["name"].lower() for item in observed} == set(roles)
        results.append({"host": name, "executable": str(host), "executableSha256": digest(host),
                        **result, "observedModules": observed, "stderr": process.stderr[-4000:]})
    receipt = {"checkedAt": datetime.now(timezone.utc).isoformat(), "workingDirectory": str(work),
               "pnpm": pnpm_version, "tarballs": tarballs, "consumers": results,
               "sources": {name: digest(HERE / name) for name in ["audit.py", "run.py", "loader.cjs", "consumer.cjs"]},
               "dependencyAudit": str(audit_file), "dependencyAuditSha256": digest(audit_file),
               "nativeFilesVerifiedAfterInstall": len(audit["files"]), "offlineInstall": True,
               "installScriptsExecuted": False, "nativeAddonRebuilt": False,
               "publicMpvImplementation": False, "windowsCleanMachineExecuted": False,
               "macosExecuted": False, "linuxExecuted": False, "published": False,
               "formalEngineSelected": False, "dynamicPluginsAndDataAudited": False}
    save(HERE / "package-contract.json", receipt)
    print(json.dumps({"tarballs": len(tarballs), "consumers": [result["host"] for result in results],
                      "nativeFiles": len(audit["files"]), "observedMedia": {
                          result["host"]: sum(item["role"] == "media-runtime" for item in result["observedModules"])
                          for result in results}}))


if __name__ == "__main__":
    main()
