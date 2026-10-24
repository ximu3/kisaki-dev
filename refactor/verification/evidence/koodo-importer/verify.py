"""Read actual synthetic bytes and check bounded proposal models, not a production importer."""

import csv
import hashlib
import io
import json
import math
import platform
import re
import sqlite3
import zipfile
from datetime import date
from pathlib import Path, PurePosixPath

import PIL
import pypdf
import reportlab
from lxml import etree
from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
LIBRARY = FIXTURES / "library"
manifest = json.loads((ROOT / "fixture-manifest.json").read_text(encoding="utf-8"))
contract = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
checks = []


def check(name, condition):
    checks.append({"name": name, "passed": bool(condition)})


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


before = {item["path"]: hash_file(ROOT / item["path"]) for item in manifest["files"]}
check("manifest matches every generated input", all(before[item["path"]] == item["sha256"] for item in manifest["files"]))
tables = {}
for table in ("books", "notes", "bookmarks", "words"):
    path = LIBRARY / "config" / f"{table}.db"
    check(f"{table} has actual SQLite header", path.read_bytes().startswith(b"SQLite format 3\x00"))
    connection = sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    connection.execute("PRAGMA trusted_schema=OFF")
    columns = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
    check(f"{table} columns match pinned declarations", columns == [item["name"] for item in contract["tables"][table]["columns"]])
    check(f"{table} passes SQLite integrity check", connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok")
    try:
        connection.execute(f'DELETE FROM "{table}"')
        readonly = False
    except sqlite3.OperationalError as error:
        readonly = error.sqlite_errorcode == sqlite3.SQLITE_READONLY
    check(f"{table} refuses writes", readonly)
    tables[table] = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
    connection.close()
check("integer affinity preserves actual string highlight color", tables["notes"][0]["color"] == "background-#fff000")
check("backup tag array preserves commas inside a tag", json.loads(tables["notes"][0]["tag"]) == ["moon,light", "review"])
check("backup date is a JSON object in a text cell", json.loads(tables["notes"][0]["date"]) == {"year": 2026, "month": 10, "day": 15})
check("no rating or public identity invented from Book columns", not {"rating", "isbn", "publishedAt", "sourceId"}.intersection(tables["books"][0]))

outer = json.loads((LIBRARY / "config" / "config.json").read_text(encoding="utf-8"))
allowed = {"favoriteBooks", "deletedBooks", "recentBooks", "shelfList", "sortedShelfList", "recordLocation", "readingTime", "readingStats"}
config = {key: json.loads(outer[key]) for key in allowed if key in outer}
check("config values require a second JSON decode", all(isinstance(value, str) for value in outer.values()))
check("allowlist omits token content", "thirdpartyToken" not in config)
check("source deleted book excluded by default", len([row for row in tables["books"] if row["key"] not in config["deletedBooks"]]) == 6)
check("favorite list is independent of shelves", set(config["favoriteBooks"]) == {"12", "comic-book"})
check("shelf display order uses explicit names", config["sortedShelfList"] == ["Read", "Archive"])
check("shelf member order remains stored array order", config["shelfList"]["Archive"] == ["pdf-book", "12", "comic-book", "missing-book"])
existing = ["comic-book", "12"]
appended = existing + [key for key in config["shelfList"]["Archive"] if key not in existing]
check("existing collection order kept and new members appended", appended == ["comic-book", "12", "pdf-book", "missing-book"])
malformed = json.loads((FIXTURES / "invalid" / "malformed-config.json").read_text(encoding="utf-8"))
try:
    json.loads(malformed["favoriteBooks"])
    malformed_rejected = False
except json.JSONDecodeError:
    malformed_rejected = True
check("malformed optional config is not an authoritative empty list", malformed_rejected)


def finished(location):
    return isinstance(location, dict) and location.get("percentage") == "1"


locations = config["recordLocation"]
check("exact saved Done value supplies one minimum completion fact", finished(locations["marked-book"]))
check("100 percent display rounding is not Done", round(float(locations["rounded-book"]["percentage"]) * 100, 2) == 100 and not finished(locations["rounded-book"]))
check("Done alone has no resumable position", "chapterDocIndex" not in locations["marked-book"])
check("Done may preserve an earlier PDF page", finished(locations["pdf-book"]) and locations["pdf-book"]["chapterDocIndex"] == "1")
check("missing location gives no completion fact", not finished(None))
check("numeric value is not silently coerced to source string", not finished({"percentage": 1}))
check("source middle progress is not a current arrangement", "status" not in locations["12"] and "rounded-book" in config["recentBooks"])
for history_count in (0, 1, 3):
    appended_count = 1 if history_count == 0 and finished(locations["marked-book"]) else 0
    check(f"minimum completion adopts only into empty history {history_count}", appended_count == (1 if history_count == 0 else 0))
daily = []
for calendar_day, entries in config["readingStats"].items():
    date.fromisoformat(calendar_day)
    for value in entries:
        book_key, seconds = value.rsplit("-", 1)
        daily.append((calendar_day, book_key, int(seconds)))
check("daily key splits on final hyphen", ("2026-10-15", "pdf-book", 60) in daily)
check("total and daily seconds are separate overlapping views", config["readingTime"]["12"] == sum(seconds for _, key, seconds in daily if key == "12") == 150)
check("daily totals cannot supply activity start and end", all(len(item) == 3 for item in daily))

exports = json.loads((FIXTURES / "exports" / "notes.json").read_text(encoding="utf-8"))
csv_exports = list(csv.DictReader(io.StringIO((FIXTURES / "exports" / "notes.csv").read_text(encoding="utf-8"), newline="")))
check("JSON and CSV preserve multiline literal note text", exports[0]["notes"] == csv_exports[0]["notes"] == tables["notes"][0]["notes"])
check("CSV leading formula punctuation stays text", csv_exports[1]["notes"].startswith("=SUM(1,2)"))
check("export tag text cannot reconstruct comma-containing labels", exports[0]["tag"] == "moon,light,review" and exports[0]["tag"].split(",") != json.loads(tables["notes"][0]["tag"]))
check("export dates retain calendar precision", date.fromisoformat(exports[0]["date"]) == date(2026, 10, 15))
highlights = json.loads((FIXTURES / "exports" / "highlights.json").read_text(encoding="utf-8"))
check("highlight export omits note content", all("notes" not in row and row["exportType"] == "highlight" for row in highlights))
check("source cfi is a JSON record rather than an EPUB CFI", json.loads(exports[0]["cfi"])["chapterDocIndex"] == "0" and not exports[0]["cfi"].startswith("epubcfi("))
check("declared backup config omits PDF reflow membership", "convertPDFBooks" not in contract["declaredConfigKeys"])
check("declared backup config omits pinned-book membership", "topBooks" not in contract["declaredConfigKeys"])


def pdf_position(location, raw_mode_confirmed, page_count):
    if not raw_mode_confirmed or not isinstance(location, dict):
        return None
    index = location.get("chapterDocIndex")
    if not isinstance(index, str) or not re.fullmatch(r"0|[1-9][0-9]*", index):
        return None
    index = int(index)
    return {"pageIndex": index, "point": [0, 0]} if index < page_count else None


check("PDF unknown reading mode blocks page-only resume", pdf_position(locations["pdf-book"], False, 3) is None)
check("PDF explicitly confirmed raw mode preserves actual page", pdf_position(locations["pdf-book"], True, 3) == {"pageIndex": 1, "point": [0, 0]})
check("PDF Done-only record does not imply last page", pdf_position(locations["marked-book"], True, 3) is None)
check("PDF out-of-range page is not clamped", pdf_position({"chapterDocIndex": "3"}, True, 3) is None)
check("PDF negative page is rejected", pdf_position({"chapterDocIndex": "-1"}, True, 3) is None)
check("PDF highlighter source geometry identifies an actual page", set(json.loads(exports[1]["range"])) == {"page", "coords", "readerMode"})


def unique_rows(rows):
    found = {}
    conflicts = set()
    for row in rows:
        key = (row["bookKey"], row["key"])
        if key in found and found[key] != row:
            conflicts.add(key)
        else:
            found[key] = row
    return [row for key, row in found.items() if key not in conflicts], conflicts


check("identical same-input source key is counted once", len(unique_rows(exports + exports)[0]) == 4)
conflicted, conflicts = unique_rows(exports + [{**exports[0], "notes": "Conflicting synthetic text."}])
check("conflicting source key does not silently choose a row", len(conflicted) == 3 and len(conflicts) == 1)
for extension in ("json", "csv"):
    with zipfile.ZipFile(FIXTURES / "exports" / f"batch-{extension}.zip") as archive:
        raw = archive.read(f"all.{extension}").decode("utf-8")
        rows = json.loads(raw) if extension == "json" else list(csv.DictReader(io.StringIO(raw)))
        check(f"{extension} batch chooses all once", len(archive.namelist()) == 3 and len(rows) == 4)


def safe_members(names):
    normalized = []
    for name in names:
        if "\\" in name or ":" in name or name.startswith("/") or ".." in PurePosixPath(name).parts:
            return False
        normalized.append(name.casefold())
    return len(normalized) == len(set(normalized))


with zipfile.ZipFile(FIXTURES / "backup.zip") as archive:
    check("backup is a readable ZIP with unchanged database bytes", archive.testzip() is None and archive.read("config/books.db") == (LIBRARY / "config" / "books.db").read_bytes())
    check("backup member names stay inside the declared root", safe_members(archive.namelist()))
    check("backup books are singular book directory", "book/12.epub" in archive.namelist() and not any(name.startswith("books/") for name in archive.namelist()))
with zipfile.ZipFile(FIXTURES / "invalid" / "path-traversal.zip") as archive:
    check("traversal member rejected before any extraction", not safe_members(archive.namelist()))
with zipfile.ZipFile(FIXTURES / "invalid" / "old-json-backup.zip") as archive:
    check("old JSON backup does not impersonate SQLite family", "config/books.db" not in archive.namelist())
with zipfile.ZipFile(FIXTURES / "invalid" / "multiple-roots.zip") as archive:
    roots = [name.removesuffix("config/books.db") for name in archive.namelist() if name.endswith("config/books.db")]
    check("multiple source roots remain ambiguous", len(roots) == 2)
check("case-colliding destination names rejected", not safe_members(["cover/A.png", "cover/a.png"]))

for row in tables["books"][:3]:
    path = LIBRARY / "book" / f'{row["key"]}.{row["format"].lower()}'
    check(f'whole-file MD5 verifies bytes for {row["key"]}', hashlib.md5(path.read_bytes(), usedforsecurity=False).hexdigest() == row["md5"])
changed = (LIBRARY / "book" / "12.epub").read_bytes() + b"changed"
check("changed file digest prevents source-coordinate association", hashlib.md5(changed, usedforsecurity=False).hexdigest() != tables["books"][0]["md5"])
check("missing source path creates no holding", not (LIBRARY / "book" / "missing-book.epub").exists())
cover_matches = [path for path in (LIBRARY / "cover").iterdir() if path.stem == "12"]
check("exact cover key avoids prefix collision", len(cover_matches) == 1 and len(list((LIBRARY / "cover").glob("12*"))) == 2)
with Image.open(cover_matches[0]) as cover:
    check("selected cover contains decodable image bytes", cover.size == (32, 48))

with zipfile.ZipFile(LIBRARY / "book" / "comic-book.cbz") as archive:
    extensions = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff", ".jfif", ".jpe", ".heic")
    universe = [name for name in archive.namelist() if name.endswith(extensions)]
    ordered = sorted(universe, key=lambda name: [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", name)])
    check("ASCII comic model keeps numeric page order", ordered == ["pages/1.png", "pages/2.png", "pages/10.png"])
    check("source comic filter is case sensitive", "pages/3.PNG" not in universe)
    location = locations["comic-book"]
    check("comic href maps to exact actual member", location["chapterHref"] == ordered[int(location["chapterDocIndex"])] == "pages/10.png")
    check("comic href does not become a title or basename guess", "10.png" not in archive.namelist())
    with Image.open(io.BytesIO(archive.read(location["chapterHref"]))) as image:
        check("mapped comic member is a readable page", image.size == (32, 48))
with zipfile.ZipFile(FIXTURES / "invalid" / "comic-collation-tie.cbz") as archive:
    check("collation tie blocks index-only inference", len({name.casefold() for name in archive.namelist()}) != len(archive.namelist()))

with zipfile.ZipFile(LIBRARY / "book" / "12.epub") as archive:
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    package = etree.fromstring(archive.read("EPUB/package.opf"), parser)
    check("EPUB is a real package with two spine items", len(package.findall("{http://www.idpf.org/2007/opf}spine/{http://www.idpf.org/2007/opf}itemref")) == 2)
    chapter = etree.fromstring(archive.read("EPUB/chapter1.xhtml"), parser)
    paragraphs = chapter.findall(".//{http://www.w3.org/1999/xhtml}p")
    raw_text = "".join(chapter.itertext())
    visible_model = "".join("".join(item.itertext()) for item in paragraphs if item.attrib.get("style") != "display:none")
    check("raw and visible-text indices are not interchangeable", raw_text != visible_model and "Hidden text" not in visible_model)
    check("same quote is ambiguous even inside one chapter", visible_model.count(exports[0]["text"]) == 2)
    check("UTF-16 counts differ from code points for source quote", len(exports[0]["text"].encode("utf-16-le")) // 2 == len(exports[0]["text"]) + 1)
    check("unconverted EPUB note still keeps quote and comment", bool(exports[0]["text"]) and bool(exports[0]["notes"]))
sentinel = json.loads((FIXTURES / "invalid" / "annotation-sentinel.json").read_text(encoding="utf-8"))
check("ink sentinel is not a literal private comment", sentinel["notes"] == "annotation" and not sentinel["text"])


def normalize_quad(rectangle, page):
    left, bottom, right, top = map(float, page.cropbox)
    unit = float(page.get("/UserUnit", 1))
    if unit <= 0 or not math.isfinite(unit):
        raise ValueError("Invalid user unit.")
    x1, y1, x2, y2 = rectangle
    if not all(math.isfinite(value) for value in rectangle) or x1 == x2 or y1 == y2:
        raise ValueError("Invalid rectangle.")
    rotation = int(page.get("/Rotate", 0)) % 360
    points = []
    for x, y in ((x1, y1), (x2, y1), (x2, y2), (x1, y2)):
        u, v = (x - left) * unit / ((right - left) * unit), (top - y) * unit / ((top - bottom) * unit)
        if rotation == 90:
            u, v = 1 - v, u
        elif rotation == 180:
            u, v = 1 - u, 1 - v
        elif rotation == 270:
            u, v = v, 1 - u
        elif rotation != 0:
            raise ValueError("Unsupported document rotation.")
        if not 0 <= u <= 1 or not 0 <= v <= 1:
            raise ValueError("Rectangle falls outside visible page.")
        points.append([u, v])
    center_x = sum(point[0] for point in points) / 4
    center_y = sum(point[1] for point in points) / 4
    points.sort(key=lambda point: math.atan2(point[1] - center_y, point[0] - center_x))
    first = min(range(4), key=lambda index: (points[index][1], points[index][0]))
    return points[first:] + points[:first]


pdf = PdfReader(LIBRARY / "book" / "pdf-book.pdf")
check("PDF has three actual pages", len(pdf.pages) == 3)
expected_first = [[20 / 260, 40 / 180], [125 / 180, 20 / 260], [40 / 180, 150 / 260]]
geometry = []
for index, page in enumerate(pdf.pages):
    source_range = json.loads(tables["notes"][index + 1]["range"])
    quads = [normalize_quad(rectangle, page) for rectangle in source_range["coords"]]
    check(f"PDF page {index} keeps two line quads", len(quads) == 2 and source_range["page"] == index)
    check(f"PDF page {index} applies crop and rotation", all(math.isclose(value, wanted) for value, wanted in zip(quads[0][0], expected_first[index])))
    check(f"PDF page {index} keeps finite normalized geometry", all(0 <= value <= 1 for quad in quads for point in quad for value in point))
    area = sum(quads[0][i][0] * quads[0][(i + 1) % 4][1] - quads[0][(i + 1) % 4][0] * quads[0][i][1] for i in range(4))
    check(f"PDF page {index} quad winds clockwise from top-left", area > 0 and quads[0][0] == min(quads[0], key=lambda point: (point[1], point[0])))
    geometry.append({"pageIndex": index, "rotation": int(page.get("/Rotate", 0)), "userUnit": float(page.get("/UserUnit", 1)), "quads": quads})
try:
    normalize_quad([0, 170, 130, 155], pdf.pages[0])
    outside_rejected = False
except ValueError:
    outside_rejected = True
check("PDF out-of-crop range is rejected without clipping", outside_rejected)
check("PDF source page stays zero based", json.loads(tables["notes"][1]["range"])["page"] == 0)
check("PDF UserUnit exists and affects physical size", float(pdf.pages[2]["/UserUnit"]) == 2 and float(pdf.pages[2].cropbox.width) * 2 == 520)
check("all input bytes unchanged after read probes", all(hash_file(ROOT / name) == digest for name, digest in before.items()))

result = {
    "evidenceClass": "synthetic-byte-probes-and-explicit-proposal-models",
    "sourceApplicationExecuted": False, "productionImporterExecuted": False,
    "versions": {"python": platform.python_version(), "sqlite": sqlite3.sqlite_version, "pypdf": pypdf.__version__, "pillow": PIL.__version__, "reportlab": reportlab.Version, "lxml": ".".join(map(str, etree.LXML_VERSION))},
    "inputFiles": len(manifest["files"]), "passed": sum(item["passed"] for item in checks), "failed": sum(not item["passed"] for item in checks),
    "allInputsUnchanged": checks[-1]["passed"], "checks": checks, "pdfGeometry": geometry,
    "limits": ["No real Koodo export or source application execution.", "No production Kisaki or Kana write/jump test.", "No full browser/Rangy or generic EPUB coordinate conversion.", "ASCII comic ordering model does not prove all locale collation.", "Archive checks cover these synthetic inputs, not a complete adversarial archive implementation."],
}
(ROOT / "synthetic-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: result[key] for key in ("inputFiles", "passed", "failed", "allInputsUnchanged")}))
if result["failed"]:
    print(json.dumps([item for item in checks if not item["passed"]]))
    raise SystemExit(1)
