"""Read pinned Anx source as data and record derived schema and source receipts."""

import argparse
import hashlib
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMMIT = "356b7183e8463e7c60d84a72502d0055e55a19fd"
BASE = f"https://raw.githubusercontent.com/Anxcye/anx-reader/{COMMIT}/"
PATHS = [
    "lib/dao/database.dart", "lib/dao/book.dart", "lib/dao/book_note.dart", "lib/dao/reading_time.dart", "lib/dao/tag.dart",
    "lib/models/book.dart", "lib/models/book_note.dart", "lib/models/reading_time.dart", "lib/models/bookmark.dart", "lib/models/tag.dart", "lib/models/tb_group.dart",
    "lib/providers/tb_groups.dart", "lib/providers/total_reading_time.dart", "lib/providers/sync.dart",
    "lib/service/notes/export_notes.dart", "lib/service/database_sync_manager.dart", "lib/service/md5_service.dart", "lib/service/book.dart",
    "lib/utils/import_book.dart", "lib/utils/get_path/get_base_path.dart", "lib/utils/get_path/databases_path.dart",
    "lib/page/book_player/epub_player.dart", "lib/service/book_player/book_player_server.dart",
    "assets/foliate-js/src/view.js", "assets/foliate-js/src/epubcfi.js", "assets/foliate-js/src/book.js", "assets/foliate-js/src/epub.js",
    "assets/foliate-js/src/pdf.js", "assets/foliate-js/src/comic-book.js", "assets/foliate-js/src/fb2.js", "assets/foliate-js/src/mobi.js", "assets/foliate-js/src/overlayer.js",
    "assets/foliate-js/index.html", "assets/foliate-js/package.json", "pubspec.yaml",
    "lib/page/book_detail.dart", "lib/widgets/bookshelf/book_bottom_sheet.dart", "lib/page/book_player/minute_clock.dart", "lib/providers/bookmark.dart",
    "lib/utils/convert_string_to_uint8list.dart",
    "lib/page/reading_page.dart",
    "lib/providers/reading_completion_provider.dart", "lib/providers/book_filters.dart", "lib/widgets/bookshelf/book_cover.dart", "lib/providers/current_reading.dart",
    "assets/foliate-js/src/fixed-layout.js", "lib/providers/book_list.dart",
    "lib/widgets/book_notes/book_note_tile.dart",
]
parser = argparse.ArgumentParser()
parser.add_argument("--path", choices=PATHS)
parser.add_argument("--needle")
parser.add_argument("--grep")
parser.add_argument("--limit", type=int, default=3)
parser.add_argument("--from-offset", type=int, default=0)
args = parser.parse_args()


def fetch(path):
    url = BASE + path
    with urllib.request.urlopen(url, timeout=25) as response:
        data = response.read()
        receipt = {"path": path, "url": url, "status": response.status, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "checkedAt": datetime.now(timezone.utc).isoformat()}
    return path, data.decode("utf-8"), receipt


if args.path:
    path, source, receipt = fetch(args.path)
    if args.grep:
        for index, line in enumerate(source.splitlines(), 1):
            if re.search(args.grep, line, re.I):
                print(json.dumps({"line": index, "text": line[:500]}, ensure_ascii=False))
    elif args.needle:
        position = max(0, args.from_offset)
        for _ in range(min(8, max(1, args.limit))):
            position = source.find(args.needle, position)
            if position < 0:
                break
            print(json.dumps({"offset": position, "text": source[max(0, position - 220):position + 3000]}, ensure_ascii=False))
            position += len(args.needle)
    else:
        print(source[args.from_offset:args.from_offset + 24000])
else:
    files = list(ThreadPoolExecutor(max_workers=4).map(fetch, PATHS))
    sources = {path: content for path, content, _ in files}
    database = sources["lib/dao/database.dart"]
    version = int(re.search(r"currentDbVersion\s*=\s*(\d+)", database).group(1))
    tables = {}
    for match in re.finditer(r"CREATE TABLE (tb_\w+)\s*\((.*?)\)\s*'''", database, re.S):
        name, body = match.groups()
        columns = []
        for line in body.splitlines():
            column = re.match(r"\s*(\w+)\s+(INTEGER|REAL|TEXT)\b(.*)", line)
            if column:
                key, kind, constraints = column.groups()
                columns.append({"name": key, "type": kind, "primaryKey": "PRIMARY KEY" in constraints})
        tables[name] = {"columns": columns}
    for match in re.finditer(r"ALTER TABLE (tb_\w+) ADD COLUMN (\w+) (INTEGER|REAL|TEXT)", database):
        table, name, kind = match.groups()
        tables[table]["columns"].append({"name": name, "type": kind, "primaryKey": False})
    if version != 7 or not all(name in tables for name in ("tb_books", "tb_notes", "tb_reading_time", "tb_groups")):
        raise ValueError("Expected pinned source schema was not found.")
    result = {"sourceRef": "v1.14.0", "commit": COMMIT, "databaseVersion": version, "tables": tables, "sourceCodeExecuted": False, "sources": [receipt for _, _, receipt in files]}
    (ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceFiles": len(files), "version": version, "tables": list(tables)}))
