"""Read pinned YACReader source and derive its current SQLite table shapes."""

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
COMMIT = "28f92f4d8bdbb7170f6002e00bed7503356eea03"
BASE = f"https://raw.githubusercontent.com/YACReader/yacreader/{COMMIT}/"
PATHS = [
    "VERSION", "common/yacreader_global.h", "common/yacreader_global.cpp",
    "YACReaderLibrary/db/data_base_management.cpp", "YACReaderLibrary/db/data_base_management.h",
    "YACReaderLibrary/db/comic_item.cpp", "YACReaderLibrary/db/comic_item.h",
    "YACReaderLibrary/db/comic_model.cpp", "YACReaderLibrary/db/comic_query_result_processor.cpp",
    "YACReaderLibrary/db/folder_model.cpp", "YACReaderLibrary/db/folder_item.cpp",
    "YACReaderLibrary/db/reading_list.cpp", "YACReaderLibrary/db/reading_list.h",
    "YACReaderLibrary/db/reading_list_model.cpp", "YACReaderLibrary/db/reading_list_item.cpp",
    "YACReaderLibrary/qml/InfoRating.qml", "YACReaderLibrary/yacreader_comic_info_helper.cpp",
    "YACReaderLibrary/initial_comic_info_extractor.cpp", "YACReaderLibrary/reading_list_management_coordinator.cpp",
    "common/comic.cpp", "common/comic.h", "common/comic_db.cpp", "common/comic_db.h",
    "common/library_item.cpp", "common/library_item.h", "common/bookmarks.cpp", "common/bookmarks.h",
    "common/pdf_comic.cpp", "common/pdf_comic.mm", "common/qnaturalsorting.cpp", "common/qnaturalsorting.h",
    "compressed_archive/compressed_archive.cpp", "compressed_archive/libarchive/compressed_archive.cpp",
    "compressed_archive/unarr/compressed_archive.cpp", "tests/natural_sorting_test/main.cpp",
    "YACReaderLibrary/xml_info_parser.cpp", "YACReaderLibrary/xml_info_library_scanner.cpp",
    "YACReaderLibrary/library_creator.cpp", "common/folder.cpp", "common/epub_page_index.cpp",
    "YACReaderLibrary/db_helper.cpp", "YACReaderLibrary/db_helper.h",
]
parser = argparse.ArgumentParser()
parser.add_argument("--path", choices=PATHS)
parser.add_argument("--needle")
parser.add_argument("--grep")
parser.add_argument("--line", type=int)
parser.add_argument("--limit", type=int, default=2)
args = parser.parse_args()


def fetch(path):
    url = BASE + path
    with urllib.request.urlopen(url, timeout=25) as response:
        data = response.read()
        metadata = {"path": path, "url": url, "status": response.status, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "checkedAt": datetime.now(timezone.utc).isoformat()}
    return path, data.decode("utf-8"), metadata


def origin_receipts():
    receipts = []
    endpoints = {
        "": ("archived", "default_branch"),
        "/releases/latest": ("tag_name", "published_at", "html_url"),
        "/git/ref/tags/10.4.0": ("ref", "object"),
    }
    for endpoint, keys in endpoints.items():
        url = "https://api.github.com/repos/YACReader/yacreader" + endpoint
        with urllib.request.urlopen(url, timeout=25) as response:
            data = response.read()
            payload = json.loads(data)
            receipts.append({"url": url, "status": response.status, "checkedAt": datetime.now(timezone.utc).isoformat(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), **{key: payload[key] for key in keys}})
    if receipts[-1]["object"]["sha"] != COMMIT:
        raise ValueError("Pinned release tag no longer matches the recorded commit.")
    return receipts


def schema_from_source(source):
    source = source[source.index("bool DataBaseManagement::createTables"):source.index("void DataBaseManagement::exportComicsInfo")]
    lines = source.splitlines()
    statements = {}
    for index, line in enumerate(lines):
        if not re.search(r'\.(?:prepare|exec)\("CREATE TABLE ', line):
            continue
        selected = []
        for candidate in lines[index:]:
            candidate = candidate.split("//", 1)[0].strip()
            selected.append(candidate)
            if re.search(r'\);\s*$', candidate):
                break
        sql = "".join(json.loads(literal) for literal in re.findall(r'"(?:[^"\\]|\\.)*"', "\n".join(selected)))
        sql = sql.replace("CREATE TABLE  (", "CREATE TABLE comic_info (")
        name = re.match(r"CREATE TABLE (\w+)", sql).group(1)
        statements.setdefault(name, sql)
    database = sqlite3.connect(":memory:")
    for sql in statements.values():
        database.execute(sql)
    tables = {}
    for name in statements:
        columns = [{"name": row[1], "type": row[2], "notNull": bool(row[3]), "default": row[4], "primaryKeyOrder": row[5]} for row in database.execute(f'PRAGMA table_info("{name}")')]
        foreign_keys = [{"table": row[2], "from": row[3], "to": row[4], "onDelete": row[6]} for row in database.execute(f'PRAGMA foreign_key_list("{name}")')]
        unique_indexes = [list(database.execute(f'PRAGMA index_info("{row[1]}")')) for row in database.execute(f'PRAGMA index_list("{name}")') if row[2]]
        tables[name] = {"columns": columns, "foreignKeys": foreign_keys, "uniqueColumns": [[column[2] for column in index] for index in unique_indexes], "createSql": statements[name]}
    database.close()
    if len(tables) != 10 or "comic_info" not in tables:
        raise ValueError("Expected current library schema was not found.")
    return tables


if args.path:
    _, source, _ = fetch(args.path)
    if args.line:
        lines = source.splitlines()
        print("\n".join(f"{index + 1}: {lines[index]}" for index in range(max(0, args.line - 1), min(len(lines), args.line + 89))))
    elif args.grep:
        for index, line in enumerate(source.splitlines(), 1):
            if re.search(args.grep, line, re.I):
                print(json.dumps({"line": index, "text": line[:600]}, ensure_ascii=False))
    elif args.needle:
        position = 0
        for _ in range(min(8, max(1, args.limit))):
            position = source.find(args.needle, position)
            if position < 0:
                break
            print(json.dumps({"offset": position, "text": source[max(0, position - 180):position + 2600]}, ensure_ascii=False))
            position += len(args.needle)
    else:
        print(source[:16000])
else:
    files = list(ThreadPoolExecutor(max_workers=4).map(fetch, PATHS))
    sources = {path: source for path, source, _ in files}
    version = re.search(r'#define DB_VERSION "([^"]+)"', sources["common/yacreader_global.h"]).group(1)
    db_source = sources["YACReaderLibrary/db/data_base_management.cpp"]
    fields_block = db_source[db_source.index('QString fields'):db_source.index('QString fields') + 5000]
    fields_block = fields_block[:fields_block.index(';')]
    fields_block = '\n'.join(line.split('//', 1)[0] for line in fields_block.splitlines())
    export_fields = ''.join(json.loads(literal) for literal in re.findall(r'"(?:[^"\\]|\\.)*"', fields_block)).split(',')
    output = {"sourceRef": "10.4.0", "commit": COMMIT, "databaseVersion": version, "originEvidence": origin_receipts(), "tables": schema_from_source(db_source), "exportFields": export_fields, "sourceApplicationExecuted": False, "sources": [metadata for _, _, metadata in files]}
    (ROOT / "source-contract.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceFiles": len(files), "databaseVersion": version, "tables": len(output["tables"])}))
