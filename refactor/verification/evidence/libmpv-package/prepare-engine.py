"""Prepare a separate Windows engine candidate without changing the frozen research prefix."""

from datetime import datetime, timezone
from pathlib import Path
import io
import json
import tarfile
import urllib.request

import zstandard

from audit import CACHE, HERE, digest, save


def main():
    work = CACHE / "engine-candidate-windows"
    archives = work / "archives"
    sources = work / "sources"
    tools = work / "tools"
    for directory in [archives, sources, tools, work / "prefix", work / "logs"]:
        directory.mkdir(parents=True, exist_ok=True)
    previous_file = HERE / "engine-input.json"
    previous = json.loads(previous_file.read_text()) if previous_file.is_file() else None
    inputs = [
        {"name": "ffmpeg", "version": "9.0.2", "url": "https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz", "kind": "source"},
        {"name": "mujs", "version": "1.3.11", "url": "https://mujs.com/downloads/mujs-1.3.11.tar.gz", "kind": "source"},
    ]
    database = CACHE / "engine-build/msys64/var/lib/pacman/sync"
    for repo, package, base in [
        ("msys", "make", "https://repo.msys2.org/msys/x86_64/"),
        ("msys", "diffutils", "https://repo.msys2.org/msys/x86_64/"),
        ("ucrt64", "mingw-w64-ucrt-x86_64-nasm", "https://repo.msys2.org/mingw/ucrt64/"),
        ("ucrt64", "mingw-w64-ucrt-x86_64-vulkan-headers", "https://repo.msys2.org/mingw/ucrt64/"),
    ]:
        with (database / (repo + ".db")).open("rb") as stream:
            data = zstandard.ZstdDecompressor().stream_reader(stream).read()
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            found = []
            for member in archive.getmembers():
                if not member.name.endswith("/desc") or not member.name.startswith(package + "-"):
                    continue
                text = archive.extractfile(member).read().decode()
                fields = {}
                for block in text.strip().split("\n\n"):
                    lines = block.splitlines()
                    fields[lines[0].strip("%")] = lines[1:]
                if fields.get("NAME") == [package]:
                    found.append({"name": package, "version": fields["VERSION"][0],
                                  "url": base + fields["FILENAME"][0],
                                  "kind": "build-header" if package.endswith("-headers") else "build-tool",
                                  "expectedSha256": fields["SHA256SUM"][0],
                                  "databaseSha256": digest(database / (repo + ".db"))})
            assert len(found) == 1, package
            inputs.extend(found)
    for item in inputs:
        target = archives / item["url"].rsplit("/", 1)[1]
        if not target.exists():
            with urllib.request.urlopen(item["url"], timeout=45) as response:
                payload = response.read()
            target.write_bytes(payload)
        item["sha256"] = digest(target)
        if "expectedSha256" in item:
            assert item["sha256"] == item["expectedSha256"]
        if previous:
            known = next((value for value in previous["inputs"] if value["name"] == item["name"]), None)
            if known:
                assert item["sha256"] == known["sha256"] and item["url"] == known["url"]
        item["path"] = str(target)
        if item["kind"] == "source":
            destination = sources / (item["name"] + "-" + item["version"])
            if not destination.exists():
                with tarfile.open(target) as archive:
                    archive.extractall(sources, filter="data")
            assert destination.is_dir()
            item["directory"] = str(destination)
        else:
            destination = tools / item["name"]
            if not destination.exists():
                with target.open("rb") as stream:
                    data = zstandard.ZstdDecompressor().stream_reader(stream).read()
                with tarfile.open(fileobj=io.BytesIO(data)) as archive:
                    archive.extractall(destination, filter="data")
            item["directory"] = str(destination)
    save(previous_file, {"preparedAt": datetime.now(timezone.utc).isoformat(), "work": str(work),
                         "inputs": inputs, "existingPrefixModified": False,
                         "scriptSha256": digest(HERE / "prepare-engine.py")})
    print(json.dumps({"prepared": [item["name"] for item in inputs]}))


if __name__ == "__main__":
    main()
