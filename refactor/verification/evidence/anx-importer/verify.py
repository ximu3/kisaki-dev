"""Read synthetic Anx bytes and verify explicitly bounded migration models."""

import csv
import hashlib
import io
import json
import math
import platform
import re
import sqlite3
import zipfile
from pathlib import Path, PurePosixPath

import pypdf
from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / "fixtures"
LIBRARY = FIXTURE / "library"
manifest = json.loads((ROOT / "fixture-manifest.json").read_text(encoding="utf-8"))
schema = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
MAX_SAFE = 2**53 - 1
checks = []


def check(name, condition):
    checks.append({"name": name, "passed": bool(condition)})


def rejects(name, operation):
    try:
        operation()
    except (ValueError, UnicodeDecodeError):
        check(name, True)
    else:
        check(name, False)


def readonly(path):
    connection = sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    connection.execute("PRAGMA trusted_schema=OFF")
    return connection


def matches_family(connection):
    if connection.execute("PRAGMA user_version").fetchone()[0] != 7:
        return False
    for table in ("tb_books", "tb_notes", "tb_groups", "tb_reading_time", "tb_styles"):
        columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
        if columns != [item["name"] for item in schema["tables"][table]["columns"]]:
            return False
    return True


path = LIBRARY / "app_database.db"
check("Actual SQLite header identifies the database container", path.read_bytes().startswith(b"SQLite format 3\x00"))
connection = readonly(path)
check("Schema version and required columns match the declared family", matches_family(connection))
check("Source database passes SQLite integrity check", connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok")
tables = {}
for table in schema["tables"]:
    tables[table] = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
    check(f"{table} is a real readable table", len(connection.execute(f'PRAGMA table_info("{table}")').fetchall()) == len(schema["tables"][table]["columns"]))
try:
    connection.execute("UPDATE tb_books SET rating=5 WHERE id=1")
    refused = False
except sqlite3.OperationalError as error:
    refused = error.sqlite_errorcode == sqlite3.SQLITE_READONLY
check("Read-only connection rejects source writes", refused)
connection.close()
for filename in ("wrong-version.db", "foreign.db"):
    with readonly(FIXTURE / "invalid" / filename) as candidate:
        check(f"{filename} does not match the supported family", not matches_family(candidate))
check("Downloaded database7 snapshot has identical synthetic bytes", (FIXTURE / "remote/database7.db").read_bytes() == path.read_bytes())
books = {row["id"]: row for row in tables["tb_books"]}
notes = {row["id"]: row for row in tables["tb_notes"]}
check("Source integer IDs remain exact above JavaScript Number precision", books[9007199254740993]["id"] == 9007199254740993)
check("Same titles do not collapse distinct source records", books[1]["title"] == books[9007199254740993]["title"] and len(books) == 8)
check("Deleted source book is excluded from the default selection", len([row for row in books.values() if row["is_deleted"] == 0]) == 7)
check("Cloud-only book retains metadata without a fake local file", books[5]["title"] and not (LIBRARY / books[5]["file_path"]).exists())
check("Unknown note owner is not guessed from other books", notes[16]["book_id"] not in books)


def rating(value):
    if value is None or value == 0:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 < value <= 5:
        raise ValueError("Invalid source rating.")
    return math.floor(value * 20 + 0.5)


check("Half-star rating converts to the native score", rating(books[1]["rating"]) == 70)
check("Five-star upper bound converts to 100", rating(5) == 100)
check("Zero is unscored rather than a native zero score", rating(0) is None)
check("Nullable stored rating follows the source unscored default", rating(None) is None)
rejects("Negative rating is rejected", lambda: rating(-1))
rejects("Over-range rating is rejected without clamping", lambda: rating(6))
rejects("Non-finite rating is rejected", lambda: rating(float("nan")))
check("Source finished filter is only a percentage projection", books[1]["reading_percentage"] >= 0.98 and "completed" not in books[1])
check("Even a full percentage supplies no completion date or count", books[2]["reading_percentage"] == 1 and not {"completed_date", "read_count"}.intersection(books[2]))
check("Source Book has no independent favorite or current arrangement", not {"favorite", "status"}.intersection(books[1]))


def minimum_completion(percentage, scope, history_count=0):
    if type(percentage) not in (int, float) or not math.isfinite(percentage) or not 0.98 <= percentage <= 1:
        return {"records": [], "partCompleted": False}
    if scope == "part":
        return {"records": [], "partCompleted": True}
    records = [{"completedDate": None, "note": None}] if scope == "work" and history_count == 0 else []
    return {"records": records, "partCompleted": False}


check("Below-threshold percentage supplies no minimum completion", minimum_completion(0.979999, "work")["records"] == [])
check("The source 98 percent threshold initializes one unknown-date Work record", minimum_completion(0.98, "work")["records"] == [{"completedDate": None, "note": None}])
check("A full percentage still supplies only one minimum completion", len(minimum_completion(1, "work")["records"]) == 1)
check("Existing one-record history is preserved", minimum_completion(0.98, "work", 1)["records"] == [])
check("Existing repeated-completion history is preserved", minimum_completion(1, "work", 3)["records"] == [])
check("Part scope adopts a flag without Work completion history", minimum_completion(0.98, "part") == {"records": [], "partCompleted": True})
check("Unknown book grain does not become a Work completion", minimum_completion(1, "unknown")["records"] == [])
check("Invalid or missing percentages do not create completion records", all(minimum_completion(value, "work")["records"] == [] for value in (None, -1, 1.1, float("nan"), "0.98")))


def milliseconds(seconds):
    if type(seconds) is not int or not 0 <= seconds <= MAX_SAFE // 1000:
        raise ValueError("Invalid cumulative time.")
    return seconds * 1000


totals = {}
for row in tables["tb_reading_time"]:
    totals[row["book_id"]] = totals.get(row["book_id"], 0) + milliseconds(row["reading_time"])
check("Per-book total sums all distinct daily rows", totals[1] == 5_460_000)
check("Same-day legacy rows are not silently discarded", sum(row["reading_time"] for row in tables["tb_reading_time"] if row["book_id"] == 1 and row["date"].startswith("2026-10-15")) == 5400)
check("Unknown date does not invalidate an otherwise valid cumulative value", sum(row["reading_time"] for row in tables["tb_reading_time"] if row["date"] == "invalid-date") == 60)
check("Explicit zero and absent reading data remain different", totals[3] == 0 and 5 not in totals)
check("Multiple selected books can be grouped before one Work adoption", totals[1] + totals[2] == 6_060_000)
check("Additional duration replaces the source total minus actual activity", totals[1] - 1_800_000 == 3_660_000)
rejects("Negative time is rejected", lambda: milliseconds(-1))
rejects("Fractional time is rejected", lambda: milliseconds(1.5))
rejects("Time conversion overflow is rejected", lambda: milliseconds(MAX_SAFE // 1000 + 1))
check("Stored reading-time rows contain no complete activity interval", all("started_at" not in row and "ended_at" not in row for row in tables["tb_reading_time"]))

groups = {row["id"]: row for row in tables["tb_groups"]}


def group_path(key):
    labels = []
    visited = set()
    while key != 0:
        if key in visited or key not in groups or groups[key]["is_deleted"] != 0:
            raise ValueError("Invalid source group path.")
        visited.add(key)
        labels.append(groups[key]["name"])
        key = groups[key]["parent_id"]
    return list(reversed(labels))


check("Root group does not create a user collection", group_path(0) == [])
check("Nested group preserves its full readable path", group_path(2) == ["故事", "收藏"])
check("Same leaf name under another parent remains a separate group", group_path(3) == ["收藏"] and group_path(2) != group_path(3))
rejects("Cyclic group path is rejected", lambda: group_path(5))
rejects("Dangling parent does not become a guessed root", lambda: group_path(6))
rejects("Deleted group is excluded", lambda: group_path(4))
check("Parent collection includes direct books only", sorted(row["id"] for row in books.values() if row["group_id"] == 1 and not row["is_deleted"]) == [2, 5, 6])
check("Child collection preserves its own direct book", [row["id"] for row in books.values() if row["group_id"] == 2] == [1])
styles = tables["tb_styles"]
tags = {row["id"]: row["font_family"] for row in styles if abs(row["font_size"] - 1) < 0.0001 and row["font_family"] is not None}
check("Reserved style sentinels recover actual tag names", tags == {101: "轻小说", 102: "奇幻"})
check("Ordinary font style does not become a tag", 103 not in tags)


def relation(row):
    values = (row["line_height"], row["letter_spacing"])
    if any(type(value) not in (int, float) or not math.isfinite(value) or int(value) != value for value in values):
        raise ValueError("Invalid source relation.")
    if any(not 0 < value <= MAX_SAFE for value in values):
        raise ValueError("Unsafe source relation.")
    book_id, tag_id = map(int, values)
    if book_id not in books or tag_id not in tags:
        raise ValueError("Missing relation target.")
    return book_id, tag_id


by_style_id = {row["id"]: row for row in styles}
relations = {relation(by_style_id[key]) for key in (201, 202, 203)}
check("Repeated tag relation remains one native membership", relations == {(1, 101), (1, 102)})
rejects("Dangling tag reference is isolated", lambda: relation(by_style_id[204]))
rejects("Fractional REAL reference is not truncated to another book", lambda: relation(by_style_id[205]))
check("Bookmark color is a progress string instead of an annotation color", notes[12]["type"] == "bookmark" and notes[12]["color"] == "0.5")
check("Highlight quote and literal reader comment remain separate", notes[11]["content"] == "星光🌙" and '*字面标点*' in notes[11]["reader_note"])
check("Unknown note type still has preservable text", notes[15]["type"] == "unrecognized" and bool(notes[15]["content"]))
raw_csv = (FIXTURE / "exports/notes.csv").read_bytes()
rejects("Official GBK text is not silently decoded as UTF-8", lambda: raw_csv.decode("utf-8"))
csv_rows = list(csv.DictReader(io.StringIO(raw_csv.decode("gbk"), newline="")))
check("Official CSV exposes exactly nine declared columns", list(csv_rows[0]) == ["Book", "Author", "Chapter", "Content", "Reader Note", "Type", "Color", "Create Time", "Update Time"])
check("GBK CSV preserves Chinese, commas and quotes", csv_rows[0]["Content"] == '带逗号,与引号"的摘录')
check("CSV newlines and formula punctuation remain literal text", csv_rows[0]["Reader Note"] == "=SUM(1,2)\n下一行。")
check("Identical CSV rows stay distinct without source IDs", len(csv_rows) == 3 and csv_rows[0] == csv_rows[2])
check("CSV has no source ID, file hash or CFI to reconstruct positions", not {"id", "book_id", "cfi", "file_md5"}.intersection(csv_rows[0]))
check("CSV bookmark percentage is not interpreted as a hex color", csv_rows[1]["Color"] == "#0.5")
check("Markdown export is UTF-8 text with its own structure", (FIXTURE / "exports/notes.md").read_text(encoding="utf-8").startswith("# 星光庭院"))
check("Plain export retains its body without inferred book metadata", (FIXTURE / "exports/notes.txt").read_text(encoding="utf-8").startswith("第一章\n\t原文"))


def source_path(value):
    if "\\" in value or ":" in value or value.startswith("/") or ".." in PurePosixPath(value).parts:
        raise ValueError("Source path escapes the selected root.")
    path = (LIBRARY / value).resolve()
    if not path.is_relative_to(LIBRARY.resolve()):
        raise ValueError("Source path escapes the selected root.")
    return path


check("Exact source file path resolves under the selected root", source_path(books[1]["file_path"]).is_file())
rejects("Parent escape is rejected", lambda: source_path("../private.epub"))
rejects("Foreign absolute drive path is not silently followed", lambda: source_path("C:/private.epub"))
check("Unconverted EPUB digest matches the corresponding bytes", hashlib.md5(source_path(books[1]["file_path"]).read_bytes(), usedforsecurity=False).hexdigest() == books[1]["file_md5"])
check("Original TXT digest is not falsely treated as converted EPUB digest", hashlib.md5(source_path(books[6]["file_path"]).read_bytes(), usedforsecurity=False).hexdigest() != books[6]["file_md5"])
check("Converted example retains the original import digest", hashlib.md5((FIXTURE / "original.txt").read_bytes(), usedforsecurity=False).hexdigest() == books[6]["file_md5"])
with Image.open(source_path(books[1]["cover_path"])) as image:
    check("Adoptable cover contains real decodable image bytes", image.size == (32, 48))


def fixed_page(value, count):
    match = re.fullmatch(r"epubcfi\(/6/([1-9][0-9]*)\)", value)
    if not match:
        raise ValueError("Not a bare fixed-page address.")
    step = int(match[1])
    if step % 2 or step // 2 - 1 >= count:
        raise ValueError("Invalid fixed-page index.")
    return step // 2 - 1


pdf = PdfReader(source_path(books[2]["file_path"]))
check("PDF fixture contains three actual source pages", len(pdf.pages) == 3)
check("Bare source CFI maps to the physical PDF page", fixed_page(books[2]["last_read_position"], len(pdf.pages)) == 1)
rejects("PDF generated text-layer CFI is not a page-only address", lambda: fixed_page(notes[13]["cfi"], len(pdf.pages)))
rejects("Invalid odd synthetic page step is rejected", lambda: fixed_page("epubcfi(/6/3)", 3))
rejects("Out-of-range source page is not clamped", lambda: fixed_page("epubcfi(/6/8)", 3))
with zipfile.ZipFile(source_path(books[3]["file_path"])) as archive:
    extensions = (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".jxl", ".avif")
    files = sorted((name for name in archive.namelist() if name.endswith(extensions)), key=lambda name: name.encode("utf-16-be"))
    check("Comic page order follows source UTF-16 lexical ordering", files == ["pages/1.png", "pages/10.png", "pages/2.png"])
    check("Source comic extension filter excludes uppercase PNG", "pages/3.PNG" not in files)
    check("Comic synthetic CFI identifies the exact member", files[fixed_page(books[3]["last_read_position"], len(files))] == "pages/10.png")
    check("Comic member bytes remain actual image data", archive.read(files[1]).startswith(b"\x89PNG\r\n\x1a\n"))
check("Copied PDF bytes are identical to the inspected earlier synthetic fixture", source_path(books[2]["file_path"]).read_bytes() == (ROOT.parent / "koodo-importer/fixtures/library/book/pdf-book.pdf").read_bytes())
check("Every synthetic input matches its original manifest digest", all(hashlib.sha256((ROOT / item["path"]).read_bytes()).hexdigest() == item["sha256"] for item in manifest["files"]))
result = {"evidenceClass": "synthetic-source-bytes-and-proposal-models", "sourceApplicationExecuted": False, "productionImporterExecuted": False,
    "versions": {"python": platform.python_version(), "sqlite": sqlite3.sqlite_version, "pypdf": pypdf.__version__}, "inputFiles": len(manifest["files"]),
    "passed": sum(item["passed"] for item in checks), "failed": sum(not item["passed"] for item in checks), "checks": checks,
    "allInputsUnchanged": checks[-1]["passed"], "limits": ["No actual Anx app export, Flutter runtime, WebDAV sync or native Kisaki write.", "Date totals are tested only as cumulative values, not activity intervals.", "CFI module checks are separate from these database and fixed-page models.", "Path checks are bounded examples, not a complete hostile-filesystem implementation."]}
(ROOT / "synthetic-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": result["passed"], "failed": result["failed"], "inputFiles": result["inputFiles"], "allInputsUnchanged": result["allInputsUnchanged"]}))
if result["failed"]:
    print(json.dumps([item for item in checks if not item["passed"]]))
    raise SystemExit(1)
