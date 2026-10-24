"""Read pinned KOReader source as text; never evaluate Lua data or source code."""

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent
COMMIT = "9192014d8bd82a91dc1012473be0f238dedfdb54"
BASE = f"https://raw.githubusercontent.com/koreader/koreader/{COMMIT}/"
BASE_COMMIT = "6e4bc81af4e04f78d81677a323a780a71b29702a"
BASE_PATHS = ["ffi/mupdf.lua", "ffi/MD5.lua", "wrap-mupdf.c", "thirdparty/mupdf/CMakeLists.txt", "thirdparty/mupdf/mupdf_cbz_chapter_support.patch", "thirdparty/mupdf/webp-upstream-697749.patch"]
MUPDF_COMMIT = "73d3100d46d8a9ad634f6ef035bbe78f0f947886"
MUPDF_PATHS = ["source/cbz/mucbz.c", "source/pdf/pdf-page.c", "source/fitz/stext-device.c", "source/fitz/string.c"]
PATHS = [
    "plugins/exporter.koplugin/base.lua", "plugins/exporter.koplugin/main.lua", "plugins/exporter.koplugin/clip.lua",
    "plugins/exporter.koplugin/target/json.lua", "plugins/exporter.koplugin/target/markdown.lua", "plugins/exporter.koplugin/target/text.lua", "plugins/exporter.koplugin/target/html.lua",
    "plugins/statistics.koplugin/main.lua", "plugins/statistics.koplugin/readerprogress.lua",
    "frontend/docsettings.lua", "frontend/luasettings.lua", "frontend/dump.lua", "frontend/util.lua",
    "frontend/readcollection.lua", "frontend/readhistory.lua",
    "frontend/apps/reader/modules/readerannotation.lua", "frontend/apps/reader/modules/readerhighlight.lua", "frontend/apps/reader/modules/readerbookmark.lua",
    "frontend/apps/reader/modules/readerpaging.lua", "frontend/apps/reader/modules/readerrolling.lua", "frontend/apps/reader/modules/readerstatus.lua",
    "frontend/ui/widget/bookstatuswidget.lua", "frontend/ui/widget/booklist.lua", "frontend/apps/filemanager/filemanagerbookinfo.lua",
    "frontend/document/pdfdocument.lua", "frontend/document/credocument.lua", "frontend/document/koptinterface.lua", "frontend/document/document.lua", "frontend/document/documentregistry.lua",
    "spec/unit/exporter_plugin_main_spec.lua", "spec/unit/docsettings_spec.lua",
    "frontend/apps/filemanager/filemanagerutil.lua", ".gitmodules",
]
PATHS += ["base/" + path for path in BASE_PATHS]
PATHS += ["mupdf/" + path for path in MUPDF_PATHS]
parser = argparse.ArgumentParser()
parser.add_argument("--path", choices=PATHS)
parser.add_argument("--needle")
parser.add_argument("--grep")
parser.add_argument("--limit", type=int, default=2)
parser.add_argument("--from-offset", type=int, default=0)
parser.add_argument("--line", type=int)
args = parser.parse_args()


def fetch(path):
    if path.startswith("base/"):
        url = f"https://raw.githubusercontent.com/koreader/koreader-base/{BASE_COMMIT}/{path[5:]}"
    elif path.startswith("mupdf/"):
        url = f"https://raw.githubusercontent.com/ArtifexSoftware/mupdf/{MUPDF_COMMIT}/{path[6:]}"
    else:
        url = BASE + path
    with urllib.request.urlopen(url, timeout=25) as response:
        data = response.read()
        metadata = {"path": path, "url": url, "status": response.status, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "checkedAt": datetime.now(timezone.utc).isoformat()}
    return path, data.decode("utf-8"), metadata


if args.path:
    path, source, metadata = fetch(args.path)
    if args.line:
        lines = source.splitlines()
        print("\n".join(f"{i + 1}: {lines[i]}" for i in range(max(0, args.line - 1), min(len(lines), args.line + 89))))
    elif args.grep:
        for index, line in enumerate(source.splitlines(), 1):
            if re.search(args.grep, line, re.I):
                print(json.dumps({"line": index, "text": line[:500]}, ensure_ascii=False))
    elif args.needle:
        position = max(0, args.from_offset)
        for _ in range(min(8, max(1, args.limit))):
            position = source.find(args.needle, position)
            if position < 0:
                break
            print(json.dumps({"offset": position, "text": source[max(0, position - 200):position + 3300]}, ensure_ascii=False))
            position += len(args.needle)
    else:
        print(source[args.from_offset:args.from_offset + 18000])
else:
    files = list(ThreadPoolExecutor(max_workers=4).map(fetch, PATHS))
    sources = {path: source for path, source, _ in files}
    statistics = sources["plugins/statistics.koplugin/main.lua"]
    database_version = int(re.search(r"DB_SCHEMA_VERSION\s*=\s*(\d+)", statistics).group(1))
    tables = {}
    for name in ("book", "page_stat_data", "numbers"):
        body = re.search(r"CREATE TABLE IF NOT EXISTS " + name + r"\s*\((.*?)\);", statistics, re.S | re.I).group(1)
        columns = []
        for line in body.splitlines():
            match = re.match(r"\s*(\w+)\s+(integer|text|real)\b(.*)", line, re.I)
            if match:
                key, kind, constraints = match.groups()
                columns.append({"name": key, "type": kind.upper(), "primaryKey": "primary key" in constraints.lower()})
        tables[name] = {"columns": columns}
    if database_version != 20221111 or len(tables["page_stat_data"]["columns"]) != 5:
        raise ValueError("Expected statistics schema was not found.")
    output = {"sourceRef": "v2026.07.1", "commit": COMMIT, "baseCommit": BASE_COMMIT, "mupdfVersion": "1.27.2", "mupdfCommit": MUPDF_COMMIT, "statisticsVersion": database_version, "statisticsTables": tables, "jsonExportVersion": "json/1.0.0", "sourceCodeExecuted": False, "sources": [metadata for _, _, metadata in files]}
    (ROOT / "source-contract.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceFiles": len(files), "sourceRef": output["sourceRef"]}))
