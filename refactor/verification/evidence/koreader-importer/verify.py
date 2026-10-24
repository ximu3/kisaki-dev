"""Verify synthetic source bytes and proposed mappings, not a production importer."""

import copy
import functools
import hashlib
import json
import math
import re
import sqlite3
import sys
import zipfile
from pathlib import Path, PurePosixPath

from PIL import Image
from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
MANIFEST = json.loads((ROOT / "fixture-manifest.json").read_text(encoding="utf-8"))
CONTRACT = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
CHECKS = []


def check(name, actual, expected=True):
    CHECKS.append({"name": name, "passed": actual == expected})


def refused(name, action):
    try:
        action()
    except (ValueError, TypeError, KeyError, sqlite3.DatabaseError):
        check(name, True)
    else:
        check(name, False)


def require(condition):
    if not condition:
        raise ValueError("Synthetic boundary validation failed.")


def table(value):
    if isinstance(value, dict) and "$lua" in value:
        return {key: table(item) for key, item in value["$lua"]}
    return value


parsed = {path: table(data) for path, data in json.loads((ROOT / "parsed-fixtures.json").read_text(encoding="utf-8")).items()}
pdf_data = parsed["fixtures/library/pdf-book.sdr/metadata.pdf.lua"]
comic_data = parsed["fixtures/library/comic-book.sdr/metadata.cbz.lua"]
epub_data = parsed["fixtures/library/novel.sdr/metadata.epub.lua"]
missing_data = parsed["fixtures/detached/missing.sdr/metadata.epub.lua"]
collections = parsed["fixtures/settings/collection.lua"]
custom = parsed["fixtures/library/pdf-book.sdr/custom_metadata.lua"]["custom_props"]
check("Current annotations, not alternate provider backups", len(pdf_data["annotations"]), 4)
check("Lua empty-string override remains a known empty source field", {**pdf_data["doc_props"], **custom}["description"], "")
check("Custom source title overrides the source original", {**pdf_data["doc_props"], **custom}["title"], "星海纪事·修订名")
check("Authors split only on actual newlines", pdf_data["doc_props"]["authors"].splitlines(), ["甲作者", "乙作者"])
check("Source keywords remain ordinary terms", pdf_data["doc_props"]["keywords"].splitlines(), ["太空", "旅程"])


def status(summary):
    return {"reading": ("known", "active"), "abandoned": ("known", "onHold"), "complete": ("known", None)}.get((summary or {}).get("status"), ("unknown", None))


def rating(summary):
    if summary is None:
        return ("unknown", None)
    source = summary.get("rating")
    if source is None or source == 0 and not isinstance(source, bool):
        return ("known", None)
    require(type(source) is int and 1 <= source <= 5)
    return ("known", source * 20)


def completion(source, scope, existing_count):
    if source.get("summary", {}).get("status") != "complete":
        return None
    if scope == "part":
        return {"partCompleted": True}
    return {"date": None, "expectedCount": 0} if existing_count == 0 else None


check("Source abandoned means On hold", status(comic_data["summary"]), ("known", "onHold"))
check("Reading maps to the current active arrangement", status(epub_data["summary"]), ("known", "active"))
check("Complete has no current arrangement", status(pdf_data["summary"]), ("known", None))
check("Absent status stays unknown", status({}), ("unknown", None))
check("Unknown status is not guessed", status({"status": "dropped"}), ("unknown", None))
check("One-star rating is 20", rating(comic_data["summary"]), ("known", 20))
check("Four-star rating is 80", rating(pdf_data["summary"]), ("known", 80))
check("Five-star rating is 100", rating(missing_data["summary"]), ("known", 100))
check("Nil rating is unrated in a known summary", rating({}), ("known", None))
check("Zero rating is not a zero score", rating({"rating": 0}), ("known", None))
check("Missing summary is distinct from known unrated", rating(None), ("unknown", None))
for value in [2.5, -1, 6, True, float("nan")]:
    refused("Reject invalid KOReader star value " + str(value), lambda value=value: rating({"rating": value}))
check("Complete initializes one unknown-date Work record", completion(pdf_data, "work", 0), {"date": None, "expectedCount": 0})
check("Review modification date does not become a completion date", completion(pdf_data, "work", 0)["date"], None)
check("Existing completion history is preserved", completion(pdf_data, "work", 2), None)
check("A complete Part contributes only its flag", completion(pdf_data, "part", 0), {"partCompleted": True})
check("One hundred percent is not an explicit complete status", completion(epub_data, "work", 0), None)
check("Missing file does not block a known completion fact", completion(missing_data, "work", 0), {"date": None, "expectedCount": 0})


def ordered_members(collection):
    entries = [item for key, item in collection.items() if type(key) is int]
    if collection.get("settings", {}).get("collate"):
        return sorted({item["file"] for item in entries})
    require(all(type(item.get("order")) is int for item in entries))
    return [item["file"] for item in sorted(entries, key=lambda item: (item["order"], item["file"]))]


check("Persisted manual order is used", ordered_members(collections["旅途"]), [comic_data["doc_path"], pdf_data["doc_path"]])
check("Source scan rules do not expand persisted members", len(ordered_members(collections["旅途"])), 2)
check("Collated collections have only a member snapshot", ordered_members(collections["按书名排列"]), [epub_data["doc_path"]])
favorite_paths = set(ordered_members(collections["favorites"]))
check("Reserved favorites membership is known true", pdf_data["doc_path"] in favorite_paths)
check("Complete supplied favorites snapshot can express false", comic_data["doc_path"] in favorite_paths, False)
check("Default collection is not the favorites collection", collections["旅途"]["settings"]["default"] and "旅途" != "favorites")
check("Source review remains private plain text", pdf_data["summary"]["note"], "后来补写的 *书评*\n保留原文。")


def resolve_path(source, old_root, new_root):
    source_path = PurePosixPath(source)
    root_path = PurePosixPath(old_root)
    require(source_path.is_absolute() and ".." not in source_path.parts)
    relative = source_path.relative_to(root_path)
    target = (new_root / str(relative)).resolve()
    require(target.is_relative_to(new_root.resolve()))
    return target


check("Explicit old-to-new root maps an actual file", resolve_path(pdf_data["doc_path"], "/old/books", FIXTURES / "library").is_file())
refused("Reject paths outside the chosen old root", lambda: resolve_path("/elsewhere/a.pdf", "/old/books", FIXTURES / "library"))
refused("Reject parent traversal before normalization", lambda: resolve_path("/old/books/../a.pdf", "/old/books", FIXTURES / "library"))
check("Detached metadata survives without a matching file", resolve_path(missing_data["doc_path"], "/old/books", FIXTURES / "library").exists(), False)
with Image.open(FIXTURES / "library/pdf-book.sdr/cover.png") as cover:
    check("Companion cover is actual image bytes", cover.format, "PNG")


def partial_md5(data):
    sampled = []
    for index in range(-1, 11):
        offset = (1024 << ((2 * index) & 31)) & 0xFFFFFFFF
        if offset >= len(data):
            break
        sampled.append(data[offset:offset + 1024])
    return hashlib.md5(b"".join(sampled)).hexdigest()


original = bytearray(b"x" * 8192)
unsampled = bytearray(original)
unsampled[3000] = ord("y")
first_byte = bytearray(original)
first_byte[0] = ord("y")
check("Partial MD5 starts at byte zero despite the negative shift", partial_md5(original) != partial_md5(first_byte))
check("Unsampled changes can retain the same partial MD5", partial_md5(original), partial_md5(unsampled))
check("Full MD5 still distinguishes unsampled changes", hashlib.md5(original).digest() != hashlib.md5(unsampled).digest())
for filename, expected in MANIFEST["partialMd5"].items():
    check("Source partial checksum " + filename, partial_md5((FIXTURES / "library" / filename).read_bytes()), expected)

database = FIXTURES / "settings/statistics.sqlite3"
check("SQLite file header", database.read_bytes()[:16], b"SQLite format 3\x00")
db = sqlite3.connect(database.as_uri() + "?mode=ro&immutable=1", uri=True)
db.row_factory = sqlite3.Row
db.execute("PRAGMA query_only=ON")
db.execute("PRAGMA trusted_schema=OFF")
check("Current statistics schema version", db.execute("PRAGMA user_version").fetchone()[0], 20221111)
check("SQLite fixture integrity", db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
for name, definition in CONTRACT["statisticsTables"].items():
    check("Source-derived columns " + name, [row[1] for row in db.execute(f'PRAGMA table_info("{name}")')], [column["name"] for column in definition["columns"]])
refused("Query-only snapshot refuses writes", lambda: db.execute("UPDATE book SET title='forbidden'"))
check("Database identifiers retain 64-bit precision", db.execute("SELECT id FROM book WHERE id > 9007199254740991").fetchone()[0], 9007199254740993)
check("Source title alone is not unique", db.execute("SELECT count(*) FROM book WHERE title=?", ("星海纪事",)).fetchone()[0], 2)
check("Title, authors and partial hash identify one source statistics row", db.execute("SELECT count(*) FROM book WHERE title=? AND authors=? AND md5=?", (pdf_data["doc_props"]["title"], pdf_data["doc_props"]["authors"], pdf_data["partial_md5_checksum"])).fetchone()[0], 1)


def raw_total(book_id):
    rows = list(db.execute("SELECT duration FROM page_stat_data WHERE id_book=?", (book_id,)))
    require(all(type(row[0]) is int and row[0] >= 0 for row in rows))
    total = sum(row[0] for row in rows) * 1000
    require(total <= 9007199254740991)
    return total


def additional(total, activity):
    require(type(total) is int and type(activity) is int and 0 <= activity <= total <= 9007199254740991)
    return total - activity


check("Raw page records preserve fifteen seconds", raw_total(1), 15000)
check("Source rescaling view truncates those records to fourteen seconds", db.execute("SELECT sum(duration) FROM page_stat WHERE id_book=1").fetchone()[0], 14)
check("Five seconds rescaled to two pages becomes four in the source view", db.execute("SELECT sum(duration) FROM page_stat WHERE id_book=1 AND start_time=100").fetchone()[0], 4)
check("Distinct books aggregate once before Work adoption", raw_total(1) + raw_total(2), 75000)
check("Known empty raw records mean zero in the declared raw-record metric", raw_total(6), 0)
check("Cached total is not added or substituted", db.execute("SELECT total_read_time FROM book WHERE id=6").fetchone()[0], 999)
refused("One invalid duration prevents a partial Book total", lambda: raw_total(4))
check("New Work uses the selected total as initial additional time", additional(75000, 0), 75000)
check("Existing Work subtracts its actual saved activity", additional(75000, 15000), 60000)
refused("Source total smaller than saved activity is refused", lambda: additional(75000, 80000))
frozen_additional = additional(75000, 15000)
check("Activity recorded in flight remains additional to the frozen adoption", frozen_additional + 20000, 80000)


def parse_export(data):
    require(data.get("version") == "json/1.0.0")
    books = data.get("documents") if "documents" in data else [data]
    require(isinstance(books, list) and all(isinstance(book, dict) and isinstance(book.get("entries"), list) for book in books))
    return books


single = json.loads((FIXTURES / "exports/single.json").read_text(encoding="utf-8"))
multiple = json.loads((FIXTURES / "exports/multiple.json").read_text(encoding="utf-8"))
check("Current JSON single-book envelope", len(parse_export(single)), 1)
check("Current JSON multi-book envelope", len(parse_export(multiple)), 2)
check("JSON optional checksum is full-file MD5", single["md5sum"], MANIFEST["fullMd5"]["pdf-book.pdf"])
check("JSON export timestamp differs from annotation creation", single["created_on"] != single["entries"][0]["time"])
check("JSON display page can be a Roman label", single["entries"][0]["page"], "i")
check("JSON omits endpoints and PDF geometry", set(single["entries"][0]).isdisjoint({"pos0", "pos1", "pboxes", "ext"}))
refused("Reject unknown JSON export version", lambda: parse_export({**single, "version": "json/9"}))
refused("Reject unrelated JSON structure", lambda: parse_export({"version": "json/1.0.0", "entries": {}}))
check("Markdown preserves the whole source file", (FIXTURES / "exports/notes.md").read_text(encoding="utf-8").count("星光"), 2)
check("TXT user markup remains literal source text", "*字面星号*" in (FIXTURES / "exports/notes.txt").read_text(encoding="utf-8"))
check("EPUB XPointer is not an EPUB CFI", epub_data["annotations"][1]["pos0"].startswith("/body/DocFragment["))
check("Unconverted EPUB text is still available", epub_data["annotations"][1]["text"], "星光🌙")

pdf_path = FIXTURES / "library/pdf-book.pdf"
pdf = PdfReader(pdf_path)


def page_bounds(index):
    page = pdf.pages[index]
    crop, media = page.cropbox, page.mediabox
    x0, y0 = max(crop.left, media.left), max(crop.bottom, media.bottom)
    x1, y1 = min(crop.right, media.right), min(crop.top, media.top)
    unit = float(page.get("/UserUnit", 1))
    rotate = int(page.get("/Rotate", 0)) % 360
    require(unit > 0 and rotate in (0, 90, 180, 270) and x1 > x0 and y1 > y0)
    width, height = float(x1 - x0) * unit, float(y1 - y0) * unit
    return (height, width) if rotate in (90, 270) else (width, height)


def page_index(one_based):
    require(type(one_based) is int and 1 <= one_based <= len(pdf.pages))
    return one_based - 1


def quad(box, index):
    x, y, width, height = (box[key] for key in ("x", "y", "w", "h"))
    require(all(type(value) in (int, float) and math.isfinite(value) for value in (x, y, width, height)))
    require(x >= 0 and y >= 0 and width > 1 and height > 1)
    page_width, page_height = page_bounds(index)
    # KOReader's PDF annotation adapter uses inclusive pbox endpoints.
    right, bottom = x + width - 1, y + height - 1
    require(right <= page_width and bottom <= page_height)
    return [(x / page_width, y / page_height), (right / page_width, y / page_height), (right / page_width, bottom / page_height), (x / page_width, bottom / page_height)]


def pdf_selection(annotation):
    first, last = annotation["pos0"]["page"], annotation["pos1"]["page"]
    page_index(first)
    page_index(last)
    require(first <= last and annotation["page"] == first)
    result = []
    for page in range(first, last + 1):
        source = annotation if first == last else annotation["ext"][page]
        boxes = source["pboxes"]
        require(isinstance(boxes, dict) and bool(boxes))
        result.append({"page": {"type": "pageIndex", "index": page - 1}, "quads": [quad(boxes[key], page - 1) for key in sorted(boxes)]})
    return {"type": "pages", "pages": result}


def pdf_region(annotation):
    start, end = annotation["pos0"], annotation["pos1"]
    require(start["page"] == end["page"] == annotation["page"])
    zoom = start.get("zoom", 1)
    require(type(zoom) in (int, float) and math.isfinite(zoom) and zoom > 0 and zoom == end.get("zoom", 1))
    x0, x1 = sorted((start["x"] / zoom, end["x"] / zoom))
    y0, y1 = sorted((start["y"] / zoom, end["y"] / zoom))
    width, height = page_bounds(page_index(start["page"]))
    require(all(math.isfinite(value) for value in (x0, x1, y0, y1)) and 0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height)
    return {"page": {"type": "pageIndex", "index": start["page"] - 1}, "rect": {"x": x0 / width, "y": y0 / height, "width": (x1 - x0) / width, "height": (y1 - y0) / height}}


check("Actual PDF page count", len(pdf.pages), 3)
check("Crop, rotation and UserUnit determine native bounds", [page_bounds(index) for index in range(3)], [(260, 180), (180, 260), (360, 520)])
selection = pdf_selection(pdf_data["annotations"][1])
check("Every line keeps its own quadrilateral", len(selection["pages"][0]["quads"]), 2)
check("Inclusive pbox right endpoint is x+w-1", selection["pages"][0]["quads"][0][1][0], 110 / 260)
check("Native quad order is clockwise from upper left", selection["pages"][0]["quads"][0], [(20 / 260, 25 / 180), (110 / 260, 25 / 180), (110 / 260, 40 / 180), (20 / 260, 40 / 180)])
multi_selection = pdf_selection(pdf_data["annotations"][2])
check("Multi-page ext retains both physical pages", [item["page"]["index"] for item in multi_selection["pages"]], [1, 2])
check("UserUnit page normalizes its source native geometry", multi_selection["pages"][1]["quads"][0][1][0], 80 / 360)
incomplete = copy.deepcopy(pdf_data["annotations"][2])
del incomplete["ext"][3]
refused("Incomplete multi-page geometry is not partly adopted", lambda: pdf_selection(incomplete))
for box in [{"x": 0, "y": 0, "w": 1, "h": 20}, {"x": -1, "y": 0, "w": 5, "h": 5}, {"x": 250, "y": 0, "w": 20, "h": 5}, {"x": 0, "y": 0, "w": math.nan, "h": 5}]:
    refused("Reject invalid pbox " + str(box), lambda box=box: quad(box, 0))
check("Page bookmark ignores display pageno and pageref", page_index(pdf_data["annotations"][3]["page"]), 1)
for page in [0, -1, 4, 1.5, True]:
    refused("Reject invalid physical page " + str(page), lambda page=page: page_index(page))
region = pdf_region(pdf_data["annotations"][4])
check("Region zoom is removed in native coordinates", region["rect"], {"x": 20 / 260, "y": 25 / 180, "width": 90 / 260, "height": 15 / 180})
bad_zoom = copy.deepcopy(pdf_data["annotations"][4])
bad_zoom["pos1"]["zoom"] = 3
refused("Region endpoint zoom conflict is rejected", lambda: pdf_region(bad_zoom))
check("Known page origin can supply a fixed-page resume point", pdf_data["page_positions"][pdf_data["last_page"]], 0)
check("Nonzero approximate page position is not claimed as exact resume", comic_data["page_positions"][comic_data["last_page"]] != 0)

EXTENSIONS = {"bmp", "gif", "hdp", "j2k", "jb2", "jbig2", "jp2", "jpeg", "jpg", "jpx", "jxr", "pam", "pbm", "pgm", "pkm", "png", "pnm", "ppm", "tif", "tiff", "wdp", "webp"}


def natural_compare(left, right):
    require(left.isascii() and right.isascii())
    a = b = 0
    while a < len(left) or b < len(right):
        l = left[a] if a < len(left) else "\0"
        r = right[b] if b < len(right) else "\0"
        if l.isdigit() and r.isdigit():
            left_match = re.match(r"[0-9]+", left[a:])[0]
            right_match = re.match(r"[0-9]+", right[b:])[0]
            x, y = int(left_match), int(right_match)
            require(x <= 2147483647 and y <= 2147483647)
            a += len(left_match)
            b += len(right_match)
        else:
            x, y = ord(l.upper()), ord(r.upper())
            a += 1
            b += 1
        if x != y:
            return -1 if x < y else 1
    return 0


def comic_members(path):
    with zipfile.ZipFile(path) as archive:
        names = [info.filename for info in archive.infolist() if not info.is_dir() and info.filename.rsplit(".", 1)[-1].lower() in EXTENSIONS]
    require(all(name.isascii() and not name.startswith("/") and ".." not in PurePosixPath(name).parts for name in names))
    for name in names:
        require(all(int(number) <= 2147483647 for number in re.findall(r"[0-9]+", name)))
    ordered = sorted(names, key=functools.cmp_to_key(natural_compare))
    require(all(natural_compare(a, b) != 0 for a, b in zip(ordered, ordered[1:])))
    return ordered


members = comic_members(FIXTURES / "library/comic-book.cbz")
check("MuPDF CBZ includes uppercase extensions and uses numeric ordering", members, ["pages/1.png", "pages/2.png", "pages/3.PNG", "pages/10.png"])
check("One-based CBZ page four maps to the full actual member path", members[comic_data["annotations"][1]["page"] - 1], "pages/10.png")
for name in ["collation-tie.cbz", "numeric-overflow.cbz", "unicode-order.cbz"]:
    refused("Refuse uncertain source order " + name, lambda name=name: comic_members(FIXTURES / "invalid" / name))
check("Native-unsupported source pages are not dropped before indexing", comic_members(FIXTURES / "invalid/unsupported-page.cbz"), ["1.png", "2.jb2", "3.png"])

for item in MANIFEST["files"]:
    data = (ROOT / item["path"]).read_bytes()
    require(len(data) == item["bytes"] and hashlib.sha256(data).hexdigest() == item["sha256"])
check("All fixture inputs remain unchanged", True)
db.close()
result = {"synthetic": True, "sourceApplicationExecuted": False, "productionImporterExecuted": False, "luaCodeExecuted": False, "pdfGeometryBasis": "Pinned MuPDF 1.27.2 formulas and actual synthetic PDF boxes; no exact source renderer execution", "inputFiles": len(MANIFEST["files"]), "checks": CHECKS, "passed": sum(item["passed"] for item in CHECKS), "failed": sum(not item["passed"] for item in CHECKS), "allInputsUnchanged": True}
(ROOT / "synthetic-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": result["passed"], "failed": result["failed"], "failedChecks": [item["name"] for item in CHECKS if not item["passed"]]}))
if result["failed"]:
    raise SystemExit(1)
