"""Verify actual synthetic ZIP bytes and proposed Kotatsu adoption models."""

import copy
import functools
import hashlib
import io
import json
import math
import re
import stat
import sys
import unicodedata
import zipfile
from decimal import Decimal
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
CONTRACT = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
MANIFEST = json.loads((ROOT / "fixture-manifest.json").read_text(encoding="utf-8"))
NOW = 1792226400000
BIG = 9007199254740993
MAX_SAFE = 9007199254740991
CHECKS = []
SELECTED = {"index", "history", "categories", "favourites", "bookmarks", "scrobbling", "statistics"}


def require(condition):
    if not condition:
        raise ValueError("Synthetic boundary validation failed.")


def check(name, actual, expected=True):
    CHECKS.append({"name": name, "passed": actual == expected})


def refused(name, action):
    try:
        action()
    except (ValueError, TypeError, KeyError, zipfile.BadZipFile, OSError, RecursionError):
        check(name, True)
    else:
        check(name, False)


def long(value):
    require(type(value) is int and -(2**63) <= value < 2**63)
    return value


def integer(value, minimum=0, maximum=MAX_SAFE):
    require(type(value) is int and minimum <= value <= maximum)
    return value


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def parse_json(data):
    require(len(data) <= 512 * 1024)
    result = json.loads(data.decode("utf-8"), object_pairs_hook=unique_object, parse_float=Decimal, parse_constant=Decimal)
    count = 0

    def validate(value, depth):
        nonlocal count
        count += 1
        require(depth <= 48 and count <= 100000)
        if isinstance(value, dict):
            for key, item in value.items():
                require(len(key) <= 65536)
                validate(item, depth + 1)
        elif isinstance(value, list):
            for item in value:
                validate(item, depth + 1)
        elif isinstance(value, str):
            require(len(value) <= 65536)

    validate(result, 0)
    return result


def relative_path(name):
    require(isinstance(name, str) and bool(name) and "\\" not in name and "\x00" not in name)
    require(not name.startswith("/") and not re.match(r"^[A-Za-z]:", name))
    require(all(part not in ("", ".", "..") for part in name.split("/")))
    return PurePosixPath(name)


def entries(archive):
    result = {}
    total = 0
    require(len(archive.infolist()) <= 10000)
    for info in archive.infolist():
        if info.is_dir():
            relative_path(info.filename.rstrip("/"))
            continue
        relative_path(info.filename)
        require(info.filename not in result and not info.flag_bits & 1)
        require(stat.S_IFMT(info.external_attr >> 16) != stat.S_IFLNK)
        require(info.file_size <= 512 * 1024 and info.file_size <= max(1, info.compress_size) * 200)
        total += info.file_size
        require(total <= 8 * 1024 * 1024)
        result[info.filename] = info
    return result


def read_backup(path):
    data = {}
    opened = []
    with zipfile.ZipFile(path) as archive:
        members = entries(archive)
        lower = {}
        for name, info in members.items():
            key = name.lower()
            require(key not in lower)
            lower[key] = info
        require("index" in lower)
        for key in SELECTED:
            if key not in lower:
                continue
            value = parse_json(archive.read(lower[key]))
            require(isinstance(value, list) and all(isinstance(item, dict) for item in value))
            data[key] = value
            opened.append(key)
    header = data["index"]
    require(len(header) == 1)
    require(header[0].get("app_id") == CONTRACT["applicationId"])
    require(header[0].get("app_version") == CONTRACT["applicationVersionCode"])
    return data, opened


backup, opened = read_backup(FIXTURES / "backup.zip")
check("Official backup has eleven extensionless root members", len(CONTRACT["archiveEntries"]), 11)
check("Header is an array containing one index object", len(backup["index"]), 1)
check("Version code is an application version, fixed to this supported family", backup["index"][0]["app_version"], 1033)
for model, value in {
    "BackupIndex": backup["index"][0],
    "MangaBackup": backup["favourites"][0]["manga"],
    "TagBackup": backup["favourites"][0]["manga"]["tags"][0],
    "HistoryBackup": backup["history"][0],
    "FavouriteBackup": backup["favourites"][0],
    "CategoryBackup": backup["categories"][0],
    "ScrobblingBackup": backup["scrobbling"][0],
    "StatisticBackup": backup["statistics"][0],
}.items():
    check("Actual fixture fields match pinned source model " + model, set(value), set(CONTRACT["models"][model]))
check("App settings, reader grid, sources and saved filters are not opened", set(opened).isdisjoint({"settings", "reader_grid", "sources", "saved_filters"}))
check("Unknown optional section remains absent", "statistics" in read_backup(FIXTURES / "partial-no-statistics.zip")[0], False)
for name in ["other-app.zip", "unknown-version.zip", "duplicate-member.zip", "traversal.zip", "duplicate-json-key.zip", "unsupported-json.zip", "oversized-entry.zip", "non-zip.bin"]:
    refused("Reject invalid backup " + name, lambda name=name: read_backup(FIXTURES / "invalid" / name))
refused("Reject duplicate JSON chapter keys", lambda: parse_json((FIXTURES / "invalid/duplicate-index-key.json").read_bytes()))
refused("Reject excessive JSON depth", lambda: parse_json(("[" * 60 + "0" + "]" * 60).encode()))
check("Long IDs remain exact beyond JavaScript safe integers", backup["favourites"][0]["manga_id"], BIG)
check("Negative source IDs are legitimate signed Long values", long(backup["history"][1]["chapter_id"]), -BIG)
refused("Reject source identifier outside signed 64-bit range", lambda: long(2**63))
refused("Boolean is not a source integer", lambda: long(True))
check("Non-finite float literal is parsed without changing string content", backup["scrobbling"][5]["rating"].is_nan())
check("NaN and Infinity inside user text remain ordinary text", backup["scrobbling"][3]["comment"], "NaN 和 Infinity 在这里是普通文字。")


def collect_books(sections):
    books = {}
    for section in ("favourites", "history", "bookmarks"):
        for row in sections.get(section, []):
            book = row["manga"]
            identity = long(book["id"])
            require(isinstance(book["title"], str) and bool(book["title"].strip()))
            if "manga_id" in row:
                require(long(row["manga_id"]) == identity)
            for bookmark in row.get("bookmarks", []):
                require(long(bookmark["manga_id"]) == identity)
            if identity in books:
                require(all(books[identity].get(key) == book.get(key) for key in ("title", "source", "url", "public_url")))
            else:
                books[identity] = copy.deepcopy(book)
            tags = books[identity].get("tags", []) + book.get("tags", []) + row.get("tags", [])
            books[identity]["tags"] = list({(tag["source"], tag["key"]): tag for tag in tags}.values())
    return books


books = collect_books(backup)
check("Embedded copies join into five actual source books", len(books), 5)
check("Same-title books remain distinct", sum(book["title"] == "星旅" for book in books.values()), 2)
check("Bookmark wrapper tags are source manga tags", books[BIG]["tags"][0]["title"], "旅程")
check("Repeated embedded tags are not duplicated", len(books[BIG]["tags"]), 1)
check("Backup aliases preserve their real newline delimiter", books[BIG]["alt_title"].splitlines(), ["别名一", "别名二"])
check("Backup author names use the real newline delimiter", books[BIG]["author"].splitlines(), ["甲作者", "乙画师"])
bad = copy.deepcopy(backup)
bad["history"][0]["manga_id"] = 77
refused("Reject mismatched outer and embedded book IDs", lambda: collect_books(bad))
bad = copy.deepcopy(backup)
bad["history"][0]["manga"]["public_url"] = "https://different.invalid/work"
refused("Do not silently choose one conflicting identity copy", lambda: collect_books(bad))
check("Source publication state is distinct from personal status", books[505]["state"], "FINISHED")


def tracking(service, book):
    require(str(service) in CONTRACT["scrobblers"])
    rows = [row for row in backup["scrobbling"] if row["scrobbler"] == service and row["manga_id"] == book]
    require(len(rows) <= 1)
    return rows[0] if rows else None


def personal_status(row):
    if row is None:
        return {"known": False}
    definition = CONTRACT["scrobblers"].get(str(row["scrobbler"]))
    if definition is None:
        return {"known": False}
    source = {value: key for key, value in definition["states"].items()}.get(row.get("status"))
    state = {"PLANNED": "planned", "READING": "active", "RE_READING": "active", "ON_HOLD": "onHold"}
    if source == "COMPLETED":
        return {"known": True, "status": None, "completed": True}
    if source in state:
        return {"known": True, "status": state[source], "completed": False}
    return {"known": False}


def private_score(row):
    if row is None or "rating" not in row:
        return {"known": False}
    value = row["rating"]
    require(type(value) in (int, Decimal) and Decimal(value).is_finite() and 0 <= value <= 1)
    return {"known": True, "score": None if value == 0 else math.floor(value * 100 + Decimal("0.5"))}


def completion(row, count, scope="work"):
    if not personal_status(row).get("completed"):
        return None
    if scope == "part":
        return {"partCompleted": True}
    return {"date": None, "expectedCount": 0} if count == 0 else None


check("Source scrobbler IDs use this application's own mapping", {key: value["name"] for key, value in CONTRACT["scrobblers"].items()}, {"1": "SHIKIMORI", "2": "ANILIST", "3": "MAL", "4": "KITSU"})
check("AniList raw COMPLETED maps to a minimum completion fact", personal_status(tracking(2, BIG)), {"known": True, "status": None, "completed": True})
check("MAL raw reading is a distinct selected current value", personal_status(tracking(3, BIG)), {"known": True, "status": "active", "completed": False})
check("Shikimori rewatching means active for this manga cache", personal_status(tracking(1, -202)), {"known": True, "status": "active", "completed": False})
check("Kitsu completed uses its own raw vocabulary", personal_status(tracking(4, 303))["completed"])
check("Dropped has no native equivalent and does not clear current state", personal_status(tracking(3, 404)), {"known": False})
check("Null cached status remains unknown", personal_status(tracking(2, 505)), {"known": False})
check("Unknown service cannot borrow another service's status vocabulary", personal_status(backup["scrobbling"][-1]), {"known": False})
check("Missing selected service does not fall back to another", tracking(2, -202), None)
check("Normalized AniList rating rounds once to 67", private_score(tracking(2, BIG)), {"known": True, "score": 67})
check("Normalized MAL rating maps to 80", private_score(tracking(3, BIG))["score"], 80)
check("Normalized Kitsu rating maps to 85 without rescaling again", private_score(tracking(4, 303))["score"], 85)
check("Zero private rating means unrated", private_score(tracking(3, 404)), {"known": True, "score": None})
check("Public book rating is not selected as a private score", books[BIG]["rating"] * 100 != private_score(tracking(2, BIG))["score"])
for value in [Decimal("NaN"), Decimal("Infinity"), Decimal("-Infinity"), Decimal("1.01"), -1, True]:
    refused("Reject invalid personal score " + str(value), lambda value=value: private_score({"rating": value}))
check("Completion initializes one unknown-date record", completion(tracking(2, BIG), 0), {"date": None, "expectedCount": 0})
check("Existing history does not receive a minimum snapshot again", completion(tracking(2, BIG), 2), None)
check("Completed Part only supplies its completion flag", completion(tracking(2, BIG), 0, "part"), {"partCompleted": True})
check("Rereading does not invent previous completion counts", completion(tracking(1, -202), 0), None)
check("Progress one and publication FINISHED do not supply a tracked completion", completion(tracking(2, 505), 0), None)
check("Cache row ID is distinct from platform work target ID", tracking(2, BIG)["id"] != tracking(2, BIG)["target_id"])
check("Backup has no tracked completion date", "finished_at" in tracking(2, BIG), False)
check("Private comment retains line breaks and literal markup", tracking(2, BIG)["comment"], "喜欢这段 *旅程*。\n保留私人文字。")


def category_members(identity):
    rows = [row for row in backup["favourites"] if row["category_id"] == identity]
    require(any(category["category_id"] == identity for category in backup["categories"]))
    return list(dict.fromkeys(row["manga_id"] for row in sorted(rows, key=lambda row: (-row["created_at"], row["manga_id"]))))


check("Category association uses category_id", set(category_members(1)), {BIG, -202, 404})
check("Chosen hidden categories retain real members", category_members(2), [BIG])
check("Empty explicit category remains an empty collection candidate", category_members(3), [])
check("Unused member sort_key and pinned do not claim a manual order", category_members(1), [404, -202, BIG])
check("Category sort_key belongs to the category sequence", [row["category_id"] for row in sorted(backup["categories"], key=lambda row: row["sort_key"])], [1, 3, 2])
refused("Unknown category does not match by title or array position", lambda: category_members(99))


def stat_rows(identity, rows=None):
    require(identity in books)
    result = {}
    for row in backup.get("statistics", []) if rows is None else rows:
        if row["manga_id"] != identity:
            continue
        key = (long(row["manga_id"]), long(row["started_at"]))
        if key in result:
            require(result[key] == row)
        result[key] = row
    return list(result.values())


def activity(row):
    start = integer(row["started_at"], 1)
    duration = integer(row["duration"])
    require(start + duration <= NOW and start + duration <= MAX_SAFE)
    if duration == 0:
        return None
    return {"startedAt": start, "endedAt": start + duration, "durationMs": duration}


def total(identity, rows=None):
    require("statistics" in backup)
    value = sum(integer(row["duration"]) for row in stat_rows(identity, rows))
    require(value <= MAX_SAFE)
    return value


def additional(source, activity_total):
    integer(source)
    integer(activity_total)
    require(source >= activity_total)
    return source - activity_total


records = stat_rows(BIG)
check("Each saved statistics row represents a millisecond interval", activity(records[0]), {"startedAt": records[0]["started_at"], "endedAt": records[0]["started_at"] + 123456, "durationMs": 123456})
check("Pause-separated source rows remain two activities", len([activity(row) for row in records]), 2)
check("Source duration sum is 183456 milliseconds", total(BIG), 183456)
check("A complete statistics section with no rows for a known book has zero total", total(404), 0)
check("Duplicate source primary key with identical content counts once", total(BIG, records + [records[0]]), 183456)
conflict = copy.deepcopy(records[0])
conflict["duration"] += 1
refused("Conflicting duplicate statistic is not resolved by taking the larger total", lambda: stat_rows(BIG, records + [conflict]))
refused("Unknown start does not create an activity", lambda: activity(stat_rows(-202)[0]))
check("Explicit total-only mode can retain a duration with unknown start", total(-202), 7000)
check("Known zero duration creates no empty activity", activity(stat_rows(303)[0]), None)
refused("Orphan statistic does not create a placeholder Work", lambda: total(999))
refused("Negative duration is refused", lambda: activity({"started_at": NOW - 10, "duration": -1}))
refused("Future ending is refused without clamping", lambda: activity({"started_at": NOW - 10, "duration": 20}))
refused("Unsafe cumulative duration is refused", lambda: total(BIG, [{"manga_id": BIG, "started_at": 1, "duration": MAX_SAFE}, {"manga_id": BIG, "started_at": 2, "duration": 1}]))
check("New total-only adoption initializes additional time", additional(total(BIG), 0), 183456)
check("Existing total-only adoption subtracts actual saved activity", additional(total(BIG), 83456), 100000)
refused("Source total below saved activity is not adopted", lambda: additional(total(BIG), 200000))


def utf16(text):
    data = text.encode("utf-16-be")
    return [int.from_bytes(data[index:index + 2], "big") for index in range(0, len(data), 2)]


def digit(unit):
    return unicodedata.category(chr(unit)) == "Nd"


def compare(left, right):
    a, b = utf16(left), utf16(right)
    i = j = 0
    while i < len(a) and j < len(b):
        end_a, end_b = i + 1, j + 1
        while end_a < len(a) and digit(a[end_a]) == digit(a[i]):
            end_a += 1
        while end_b < len(b) and digit(b[end_b]) == digit(b[j]):
            end_b += 1
        first, second = a[i:end_a], b[j:end_b]
        if digit(first[0]) and digit(second[0]) and len(first) != len(second):
            return len(first) - len(second)
        if first != second:
            return -1 if first < second else 1
        i, j = end_a, end_b
    return len(a) - len(b)


def source_image_members(archive):
    members = entries(archive)
    result = []
    for name in members:
        if "/" in name:
            continue
        normalized = name.lower().removesuffix("~").removesuffix(".tmp")
        extension = normalized.rsplit(".", 1)[-1] if "." in normalized else ""
        if not 2 <= len(extension) <= 5:
            continue
        mime = CONTRACT["knownMimeTypes"].get(extension)
        require(mime is not None)
        if mime.startswith("image/"):
            result.append(name)
    return sorted(result, key=functools.cmp_to_key(compare))


def branch_hash(value):
    result = 0
    for unit in utf16(value or ""):
        result = (31 * result + unit) & 0xFFFFFFFF
    return result if result < 2**31 else result - 2**32


def generated_prefix(chapter):
    match = re.fullmatch(r"(-?[0-9]+)_([0-9]+)\\d\{4\}", chapter["entries"])
    require(match is not None)
    require(match[1] == f'{branch_hash(chapter.get("branch")):08d}')
    require(int(match[2]) > 0 and match[2] == f'{int(match[2]):04d}')
    return match[1] + "_" + match[2]


def indexed_members(archive, chapter, inside_index):
    prefix = generated_prefix(chapter)
    available = list(entries(archive)) if inside_index else source_image_members(archive)
    found = []
    for name in available:
        stem = PurePosixPath(name).name.split(".", 1)[0]
        tail = stem[len(prefix):] if stem.startswith(prefix) else ""
        matches = len(tail) == 4 and tail.isascii() and tail.isdigit()
        if not inside_index:
            require(matches)
        if matches:
            found.append((int(tail), name))
    ordered = sorted(found, key=functools.cmp_to_key(lambda a, b: compare(a[1], b[1])))
    require(bool(ordered) and [number for number, _ in ordered] == list(range(len(ordered))))
    return [name for _, name in ordered]


def location(index, container, chapter_id, page, scroll):
    require(index["app_id"] == CONTRACT["applicationId"] and index["app_version"] == 1033)
    chapter = index["chapters"][str(long(chapter_id))]
    integer(page)
    require(scroll == 0 and not isinstance(scroll, bool))
    if "file" in chapter:
        relative = relative_path(chapter["file"])
        target = (container / str(relative)).resolve()
        require(target.is_relative_to(container.resolve()))
        inside = False
    else:
        target = container
        inside = True
    with zipfile.ZipFile(target) as archive:
        members = indexed_members(archive, chapter, inside)
        require(page < len(members))
        member = members[page]
        with Image.open(io.BytesIO(archive.read(member))) as image:
            image.verify()
    return {"file": target, "position": {"type": "page", "page": {"type": "memberPath", "path": member}, "point": {"x": 0, "y": 0}}}


with zipfile.ZipFile(FIXTURES / "media/star-travel.cbz") as archive:
    index_a = parse_json(archive.read("index.json"))
    with Image.open(io.BytesIO(archive.read(index_a["cover_entry"]))) as image:
        check("Indexed cover has actual image bytes", image.format, "PNG")
index_b = parse_json((FIXTURES / "media/volume-series/index.json").read_bytes())
check("Downloaded index retains the exact backup book identity", index_a["id"], BIG)
check("Separate branches with equal chapter numbers remain separate", [chapter["number"] for chapter in index_a["chapters"].values()], [1, 1])
check("Index chapter keys retain negative 64-bit identity", int(next(iter(index_b["chapters"]))), -BIG)
first = location(index_a, FIXTURES / "media/star-travel.cbz", 1001, 0, 0)
check("Original zero-based page zero maps to the encoded first member", first["position"]["page"]["path"], "00000000_00010000.png")
check("Cover and another branch are excluded by the source chapter pattern", location(index_a, FIXTURES / "media/star-travel.cbz", 1001, 2, 0)["position"]["page"]["path"], "00000000_00010002.png")
last = location(index_b, FIXTURES / "media/volume-series", -BIG, 2, 0)
check("Per-chapter CBZ keeps its actual file", last["file"].name, "0_first.cbz")
check("Per-chapter CBZ maps the third zero-based member", last["position"]["page"]["path"], "00000000_00010002.png")
check("Source local bookmark URI uses file+zip and names the same member", unquote(urlsplit(backup["bookmarks"][1]["bookmarks"][0]["image_url"]).fragment), last["position"]["page"]["path"])
for page in [-1, 3, True]:
    refused("Reject invalid source page " + str(page), lambda page=page: location(index_a, FIXTURES / "media/star-travel.cbz", 1001, page, 0))
refused("Missing chapter is not matched by displayed number", lambda: location(index_a, FIXTURES / "media/star-travel.cbz", 999, 0, 0))
refused("Pixel scroll without source view dimensions is not normalized", lambda: location(index_a, FIXTURES / "media/star-travel.cbz", 1001, 1, 120))
for name in ["missing-page.cbz", "duplicate-page.cbz", "arbitrary-pattern.cbz"]:
    with zipfile.ZipFile(FIXTURES / "invalid" / name) as archive:
        index = parse_json(archive.read("index.json"))
    refused("Reject uncertain indexed position " + name, lambda index=index, name=name: location(index, FIXTURES / "invalid" / name, 1001, 0, 0))
escaping = parse_json((FIXTURES / "invalid/escaping-index.json").read_bytes())
refused("Reject escaping chapter file path", lambda: location(escaping, FIXTURES / "media/volume-series", -BIG, 0, 0))
with zipfile.ZipFile(FIXTURES / "media/natural-order.cbz") as archive:
    check("Kotatsu comparator preserves leading-zero distinctions", source_image_members(archive), ["1.png", "2.png", "3.PNG", "01.png", "10.png"])
with zipfile.ZipFile(FIXTURES / "media/source-image-universe.cbz") as archive:
    check("Source image universe includes native-unsupported or invalid image candidates", source_image_members(archive), ["1.png", "2.psd", "3.png"])
with zipfile.ZipFile(FIXTURES / "media/unknown-mime.cbz") as archive:
    refused("Unknown Android MIME fallback is not silently dropped", lambda: source_image_members(archive))
check("Source string comparator uses UTF-16 ordering", compare("a🌙.png", "a\ue000.png") < 0)
check("Source natural comparator is case-sensitive", compare("1.PNG", "1.png") < 0)
check("Source natural comparator does not parse numeric chunks as C integers", compare("9999999999.png", "10000000000.png") < 0)
check("Bookmarks contain no private note, title or highlight quote", set(backup["bookmarks"][0]["bookmarks"][0]).isdisjoint({"note", "title", "text", "quote"}))
check("Remote image URL alone is not a local media file", urlsplit(backup["bookmarks"][2]["bookmarks"][0]["image_url"]).scheme, "https")

for item in MANIFEST["files"]:
    data = (ROOT / item["path"]).read_bytes()
    require(len(data) == item["bytes"] and hashlib.sha256(data).hexdigest() == item["sha256"])
check("All source fixture bytes remain unchanged", True)
result = {"synthetic": True, "sourceApplicationExecuted": False, "productionImporterExecuted": False, "androidOrKotlinExecuted": False, "inputFiles": len(MANIFEST["files"]), "checks": CHECKS, "passed": sum(item["passed"] for item in CHECKS), "failed": sum(not item["passed"] for item in CHECKS), "allInputsUnchanged": True}
(ROOT / "synthetic-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": result["passed"], "failed": result["failed"], "failedChecks": [item["name"] for item in CHECKS if not item["passed"]]}))
if result["failed"]:
    raise SystemExit(1)
