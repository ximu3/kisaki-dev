"""Read actual synthetic bytes and check the proposed YACReader conversion boundaries."""

import hashlib
import io
import json
import math
import re
import sqlite3
import tarfile
import unicodedata
import zipfile
from collections import defaultdict
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
LIBRARY = FIXTURES / "library"
CONTRACT = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
MANIFEST = json.loads((ROOT / "fixture-manifest.json").read_text(encoding="utf-8"))
CHECKS = []
BIG_ID = 9007199254740993


def check(name, condition):
    CHECKS.append({"name": name, "passed": bool(condition)})


def rejects(name, operation, error=ValueError):
    try:
        operation()
    except error:
        check(name, True)
    else:
        check(name, False)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_database(path):
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    connection.execute("PRAGMA trusted_schema=OFF")
    try:
        schema = connection.execute("SELECT name,type,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'").fetchall()
        if any(row["type"] in ("view", "trigger") or "VIRTUAL TABLE" in (row["sql"] or "").upper() for row in schema):
            raise ValueError("Executable source schema is not supported.")
        tables = {row["name"] for row in schema if row["type"] == "table"}
        if tables == set(CONTRACT["tables"]):
            family = "library"
            columns = {name: [column["name"] for column in table["columns"]] for name, table in CONTRACT["tables"].items()}
        elif tables == {"comic_info", "db_info"}:
            family = "metadata-export"
            columns = {"comic_info": CONTRACT["exportFields"], "db_info": ["version"]}
        else:
            raise ValueError("Unknown source table family.")
        for name, expected in columns.items():
            actual = [row[1] for row in connection.execute(f'PRAGMA table_info("{name}")')]
            if actual != expected:
                raise ValueError("Unexpected source columns.")
        versions = [row[0] for row in connection.execute("SELECT version FROM db_info")]
        if versions != [CONTRACT["databaseVersion"]]:
            raise ValueError("Unsupported database version.")
        if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise ValueError("Invalid SQLite database.")
        result = {name: [dict(row) for row in connection.execute(f'SELECT {",".join(fields)} FROM "{name}"')] for name, fields in columns.items()}
        return family, result
    except sqlite3.DatabaseError as error:
        raise ValueError("Source database cannot be read.") from error
    finally:
        connection.close()


def index_rows(rows):
    result = {}
    for row in rows:
        key = row["id"]
        if type(key) is not int or key <= 0 or key in result:
            raise ValueError("Invalid source row identity.")
        result[key] = row
    return result


def validate_links(data):
    infos, comics, folders = (index_rows(data[name]) for name in ("comic_info", "comic", "folder"))
    problems = []
    for row in comics.values():
        if row["comicInfoId"] not in infos or row["parentId"] not in folders:
            problems.append(row["id"])
    for row in folders.values():
        if row["id"] == 1 and row["parentId"] == 1 and row["path"] == "/":
            continue
        visited = {row["id"]}
        current = row["parentId"]
        while current != 1:
            if current in visited or current not in folders:
                problems.append(row["id"])
                break
            visited.add(current)
            current = folders[current]["parentId"]
    return problems


def library_path(root, value, filename=None):
    if not isinstance(value, str) or not value.startswith("/") or value.startswith("//") or any(character in value for character in ("\\", "\0", ":")):
        raise ValueError("Invalid library relative path.")
    parts = value[1:].split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("Unsafe library path.")
    if filename is not None and parts[-1] != filename:
        raise ValueError("Filename and path disagree.")
    resolved = root.joinpath(*parts).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError("Library path leaves the selected root.")
    return resolved


def finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def rating(value):
    if value is None:
        return "unknown"
    if not finite_number(value) or not 0 <= value <= 5:
        raise ValueError("Invalid source rating.")
    return None if value == 0 else math.floor(value * 20 + 0.5)


def read_completion(value, scope, existing_count):
    if type(value) is not int or value not in (0, 1):
        raise ValueError("Invalid source read flag.")
    if value == 0:
        return None
    if scope == "part":
        return {"completed": True}
    if scope != "work":
        return None
    return {"initial": [{"date": None}], "expected": {"completionCount": 0}} if existing_count == 0 else None


def selected_current(local, source, selected=False):
    return source if selected and source != "unknown" else local


def archive_members(path):
    members = {}
    if path.suffix == ".cbt":
        with tarfile.open(path) as archive:
            entries = [(entry.name, entry.isfile(), archive.extractfile(entry).read() if entry.isfile() else b"") for entry in archive.getmembers()]
    else:
        with zipfile.ZipFile(path) as archive:
            entries = [(entry.filename, not entry.is_dir(), archive.read(entry)) for entry in archive.infolist()]
    for name, regular, content in entries:
        if name.startswith(("/", "\\")) or "\\" in name or ":" in name or "\0" in name or any(part in (".", "..") for part in name.split("/")):
            raise ValueError("Unsafe archive member.")
        if name in members:
            raise ValueError("Duplicate archive member.")
        if not regular:
            raise ValueError("Non-regular member in this fixture subset.")
        members[name] = content
    return members


def image_page_names(members):
    names = []
    for name, content in members.items():
        if "__MACOSX" in name:
            continue
        if name.lower().endswith(("png", "jpg", "jpeg")):
            with Image.open(io.BytesIO(content)) as image:
                image.verify()
            names.append(name)
        elif name == "ComicInfo.xml":
            continue
        else:
            raise ValueError("The source image-plugin classification is not proven.")
    if not names:
        raise ValueError("No image pages.")
    return names


def common_prefix(names):
    if len(names) < 2:
        return ""
    frequency = {}
    length = len(names[0].rsplit("/", 1)[-1])
    count = 1
    previous = ""
    for index in range(1, len(names)):
        previous = names[index - 1].rsplit("/", 1)[-1]
        current = names[index].rsplit("/", 1)[-1]
        position = 0
        while position < min(len(previous), len(current)) and previous[position] == current[position]:
            position += 1
        if 0 < position < length:
            frequency[previous[:length]] = count
            length = position
            count += 1
        elif position == 0:
            frequency[previous[:length]] = count
            length = len(current)
            count = 1
        else:
            count += 1
    frequency[previous[:length]] = count
    best = ""
    maximum = 0
    for prefix in sorted(frequency):
        if frequency[prefix] > maximum:
            maximum = frequency[prefix]
            best = prefix
    return "" if best.isdecimal() or maximum < len(names) * 0.60 else best


def page_order(names, heuristic=True):
    if len(names) == 1:
        return names[:]
    parsed = []
    for name in names:
        match = re.fullmatch(r"([^0-9]*)([0-9]+)([^0-9]*)", name)
        if not name.isascii() or match is None:
            raise ValueError("Locale-independent ordering is not proven.")
        parsed.append((match[1], int(match[2]), match[3], name))
    if len({(prefix, suffix) for prefix, _, suffix, _ in parsed}) != 1:
        raise ValueError("Source collation context is unknown.")
    if len({number for _, number, _, _ in parsed}) != len(parsed):
        raise ValueError("Source collation has an ambiguous tie.")
    ordered = [name for _, _, _, name in sorted(parsed, key=lambda row: row[1])]
    if not heuristic or len(ordered) >= 1000:
        return ordered
    prefix = common_prefix(ordered)
    maximum_digits = len(str(len(ordered))) * 2
    singles, spreads = [], []
    for name in ordered:
        basename = name.rsplit("/", 1)[-1]
        digits = re.match(r"[0-9]+", basename[len(prefix):]) if basename.startswith(prefix) else None
        value = digits[0] if digits else ""
        is_spread = False
        if 3 <= len(value) <= maximum_digits and len(value) % 2 == 0:
            left, right = int(value[:len(value) // 2]), int(value[len(value) // 2:])
            is_spread = left > 0 and right - left == 1
        (spreads if is_spread else singles).append(name)
    result = []
    while singles and spreads:
        result.append(singles.pop(0) if singles[0].lower() < spreads[0].lower() else spreads.pop(0))
    return result + singles + spreads


def point(page):
    return {"type": "page", "page": page, "point": {"x": 0, "y": 0}}


def indexed_position(index, pages):
    if type(index) is not int or not 0 <= index < len(pages):
        raise ValueError("Source page is outside the actual content.")
    return point(pages[index])


def bookmarks(row, pages):
    result = []
    seen = set()
    for key in ("bookmark1", "bookmark2", "bookmark3"):
        value = row[key]
        if value == -1:
            continue
        if value in seen:
            continue
        result.append(indexed_position(value, pages))
        seen.add(value)
    return result


def resume(row, pages):
    if type(row["hasBeenOpened"]) is not int or row["hasBeenOpened"] not in (0, 1):
        raise ValueError("Invalid opened flag.")
    if row["hasBeenOpened"] == 0:
        return None
    value = row["currentPage"]
    if type(value) is not int:
        raise ValueError("Invalid source page.")
    return indexed_position(value - 1, pages)


def xml(data):
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("Untrusted XML declarations are not supported.")
    return ElementTree.fromstring(data)


def local_name(tag):
    return tag.rsplit("}", 1)[-1]


def resolve_member(base, reference, members):
    url = urlsplit(reference)
    if url.scheme or url.netloc or url.query:
        raise ValueError("External resource is not a source page.")
    decoded = unquote(url.path)
    parts = list(PurePosixPath(base).parent.parts)
    if decoded.startswith(("/", "\\")) or "\\" in decoded:
        raise ValueError("Invalid EPUB resource path.")
    for part in decoded.split("/"):
        if part == "..":
            if not parts:
                raise ValueError("EPUB resource escapes its archive.")
            parts.pop()
        elif part not in ("", "."):
            parts.append(part)
    result = "/".join(parts)
    if result not in members:
        raise ValueError("Referenced EPUB resource is missing.")
    return result


def wrapper_image(data, path, members):
    images = set()
    text = []
    def visit(node):
        name = local_name(node.tag)
        style = node.attrib.get("style", "").replace(" ", "").lower()
        if name in {"head", "script", "style", "title", "desc", "metadata"} or "hidden" in node.attrib or "display:none" in style or "visibility:hidden" in style:
            return
        if node.text:
            text.append(node.text)
        attributes = {local_name(key): value for key, value in node.attrib.items()}
        key = {"img": "src", "image": "href", "object": "data"}.get(name)
        if key and attributes.get(key):
            images.add(resolve_member(path, attributes[key], members))
        for child in node:
            visit(child)
            if child.tail:
                text.append(child.tail)
    visit(xml(data))
    significant = sum(len(character.encode("utf-16-le")) // 2 for character in "".join(text) if not character.isspace() and unicodedata.category(character) != "Cf")
    return next(iter(images)) if len(images) == 1 and significant <= 32 else None


def epub_pages(path):
    members = archive_members(path)
    container = xml(members["META-INF/container.xml"])
    rootfiles = [node.attrib["full-path"] for node in container.iter() if local_name(node.tag) == "rootfile" and node.attrib.get("media-type") == "application/oebps-package+xml"]
    if len(rootfiles) != 1:
        raise ValueError("Ambiguous EPUB package.")
    package_path = rootfiles[0]
    package = xml(members[package_path])
    layout = [node.text for node in package.iter() if local_name(node.tag) == "meta" and node.attrib.get("property") == "rendition:layout"]
    if layout != ["pre-paginated"]:
        raise ValueError("Fixed page addressing is not proven for this EPUB.")
    manifest = {node.attrib["id"]: node.attrib for node in package.iter() if local_name(node.tag) == "item"}
    spine = [node.attrib for node in package.iter() if local_name(node.tag) == "itemref"]
    pages = []
    non_images = 0
    linear_count = sum(item.get("linear") != "no" for item in spine)
    for index, item in enumerate(spine):
        if item.get("linear") == "no":
            continue
        entry = manifest.get(item["idref"])
        if entry is None:
            raise ValueError("Spine item is missing from the manifest.")
        if "nav" in entry.get("properties", "").split():
            continue
        content_path = resolve_member(package_path, entry["href"], members)
        media_type = entry["media-type"]
        if media_type.startswith("image/") and media_type != "image/svg+xml":
            image_path = content_path
        elif media_type in ("application/xhtml+xml", "image/svg+xml"):
            image_path = wrapper_image(members[content_path], content_path, members)
        else:
            image_path = None
        if image_path is None:
            non_images += 1
            continue
        if not image_path.lower().endswith(("png", "jpg", "jpeg")):
            raise ValueError("EPUB image-plugin classification is not proven.")
        with Image.open(io.BytesIO(members[image_path])) as image:
            image.verify()
        pages.append({"page": {"type": "epubSpineItem", "index": index}, "image": image_path})
    if non_images > max(1, linear_count // 20) or not pages:
        raise ValueError("Source image-based EPUB boundary is not met.")
    return pages


def reading_lists(data, comic_targets):
    lists = index_rows(data["reading_list"])
    for row in lists.values():
        parent = row["parentId"]
        if parent is not None and (parent not in lists or lists[parent]["parentId"] is not None):
            raise ValueError("Invalid or unsupported reading-list hierarchy.")
    members = defaultdict(list)
    for row in data["comic_reading_list"]:
        if row["reading_list_id"] not in lists or row["comic_id"] not in comic_targets:
            raise ValueError("Dangling reading-list member.")
        members[row["reading_list_id"]].append(row)
    output = {}
    for row in lists.values():
        parent = row["parentId"]
        title = row["name"] if parent is None else lists[parent]["name"] + " / " + row["name"]
        groups = [row["id"]]
        if parent is None:
            groups += [child["id"] for child in sorted(lists.values(), key=lambda child: (child["ordering"], child["id"])) if child["parentId"] == row["id"]]
        targets = []
        for group in groups:
            for member in sorted(members[group], key=lambda member: (member["ordering"], member["comic_id"])):
                target = comic_targets[member["comic_id"]]
                if target not in targets:
                    targets.append(target)
        output[row["id"]] = {"name": title, "members": targets}
    return output


before = {entry["path"]: digest(ROOT / entry["path"]) for entry in MANIFEST["files"]}
check("All fixture bytes match the recorded manifest", all(before[entry["path"]] == entry["sha256"] for entry in MANIFEST["files"]))
family, data = load_database(LIBRARY / ".yacreaderlibrary" / "library.ydb")
backup_family, backup = load_database(FIXTURES / "full-backup.ydb")
export_family, exported = load_database(FIXTURES / "comics-info.ydb")
check("The full library is the ten-table family", family == "library" and len(data) == 10)
check("VACUUM backup retains every table and selected row", backup_family == family and backup == data)
check("Metadata export is a separate two-table family", export_family == "metadata-export" and len(exported) == 2)
check("Export contains the 59 source-selected fields without id", len(CONTRACT["exportFields"]) == 59 and "id" not in exported["comic_info"][0])
check("Export omits an unedited read book", "Missing File" not in {row["title"] for row in exported["comic_info"]})
check("Export includes four qualifying records, including metadata without a file", len(exported["comic_info"]) == 4 and any(row["title"] == "Metadata Only" for row in exported["comic_info"]))
check("Export does not assert absent favorites or reading lists are empty", "comic_default_reading_list" not in exported and "reading_list" not in exported)
with sqlite3.connect((FIXTURES / "comics-info.ydb").as_uri() + "?mode=ro", uri=True) as connection:
    check("CTAS export loses comic_info primary keys and defaults", all(row[4] is None and row[5] == 0 for row in connection.execute("PRAGMA table_info(comic_info)")))
with sqlite3.connect((FIXTURES / "full-backup.ydb").as_uri() + "?mode=ro", uri=True) as connection:
    check("PRAGMA user_version is not the YACReader schema version", connection.execute("PRAGMA user_version").fetchone()[0] == 0)
    rejects("Source SQLite writes are blocked", lambda: connection.execute("UPDATE db_info SET version='changed'"), sqlite3.OperationalError)
for filename in ("unknown-version.ydb", "missing-relationship-table.ydb", "source-view.ydb", "not-sqlite.ydb"):
    rejects("Reject " + filename, lambda filename=filename: load_database(FIXTURES / "invalid" / filename))
check("Declared hash uniqueness is retained in the source contract", ["hash"] in CONTRACT["tables"]["comic_info"]["uniqueColumns"])
check("Root folder's documented self-reference is valid", validate_links(data) == [])
_, dangling = load_database(FIXTURES / "invalid" / "dangling-comic.ydb")
check("Disconnected comic relation is reported at the affected row", validate_links(dangling) == [20])
comics = index_rows(data["comic"])
infos = index_rows(data["comic_info"])
check("Two adjacent identifiers beyond JavaScript safe integer remain distinct", BIG_ID in comics and BIG_ID + 1 in comics)
check("Two physical files share one personal-record row", comics[BIG_ID]["comicInfoId"] == comics[BIG_ID + 1]["comicInfoId"] == 101)
check("Source grouping does not count duplicate physical copies twice", len({row["comicInfoId"] for row in comics.values()}) == 5)
_, other = load_database(FIXTURES / "other-library.ydb")
check("Another library's equal id remains a distinct input identity", ("first", BIG_ID) != ("second", other["comic"][0]["id"]) and other["comic_info"][0]["title"] != infos[101]["title"])
check("Author fields split on newlines", infos[101]["writer"].split("\n") == ["Writer A", "Writer B"])
check("A comma inside a stored tag is preserved", infos[101]["tags"].split("\n") == ["Space, opera", "Adventure"])
check("Notes and reviews remain distinct selected text", infos[101]["notes"] != infos[101]["review"] and "<b>literal</b>" in infos[101]["notes"])
check("A numeric ComicVine suffix alone is not a verified public URL", urlsplit(infos[101]["comicVineID"]).scheme == "")
check("Source date text has no retained original precision", infos[101]["date"] == "1/1/2020" and "year" not in infos[101])
for source, expected in [(0, None), (1, 20), (4.5, 90), (5, 100), (None, "unknown")]:
    check("Rating conversion " + repr(source), rating(source) == expected)
for source in (-1, 5.1, float("nan"), float("inf"), "4", True):
    rejects("Reject rating " + repr(source), lambda source=source: rating(source))
check("Existing score is preserved by default", selected_current(75, 90) == 75)
check("Explicit unrated zero clears a score", selected_current(75, rating(0), True) is None)
check("Unknown score does not clear an existing score", selected_current(75, rating(None), True) == 75)
check("Read initializes one unknown-date completion on empty history", read_completion(1, "work", 0) == {"initial": [{"date": None}], "expected": {"completionCount": 0}})
check("Read does not append to existing completion history", read_completion(1, "work", 2) is None)
check("Unread does not delete completion history", read_completion(0, "work", 2) is None)
check("A part read flag stays a part flag", read_completion(1, "part", 0) == {"completed": True})
check("An unresolved content scope creates no completion", read_completion(1, "unknown", 0) is None)
rejects("Non-boolean source read flag is not coerced", lambda: read_completion(2, "work", 0))
check("No source table supplies reading activities or duration", not any("duration" in column["name"].lower() for table in CONTRACT["tables"].values() for column in table["columns"]))
check("Last-open time remains a single seconds timestamp", infos[101]["lastTimeOpened"] == 1700000000)
check("Favorites use the documented built-in id", data["comic_default_reading_list"][0]["default_reading_list_id"] == 1)
check("A non-favorite physical copy does not negate its shared candidate's favorite", any(row["comic_id"] == BIG_ID for row in data["comic_default_reading_list"]) and not any(row["comic_id"] == BIG_ID + 1 for row in data["comic_default_reading_list"]))
check("Labels attach to physical comic ids", data["comic_label"][0]["comic_id"] == BIG_ID and data["comic_label"][0]["comic_id"] not in infos)
check("An empty label remains selectable", any(row["name"] == "Empty label" for row in data["label"]))
targets = {identifier: "work-" + str(row["comicInfoId"]) for identifier, row in comics.items()}
collections = reading_lists(data, targets)
check("Parent list has direct members then its ordered children", collections[10]["members"] == ["work-201", "work-101", "work-301", "work-401"])
check("Child list keeps its parent context", collections[11] == {"name": "Weekend / First arc", "members": ["work-101", "work-301"]})
check("An empty list becomes an empty manual collection", collections[13]["members"] == [])
check("Multiple copies collapse only after mapping to the same target", collections[10]["members"].count("work-101") == 1)
for filename in ("cycle-list.ydb", "dangling-list.ydb"):
    _, invalid = load_database(FIXTURES / "invalid" / filename)
    rejects("Reject hierarchy " + filename, lambda invalid=invalid: reading_lists(invalid, targets))

star = library_path(LIBRARY, comics[BIG_ID]["path"], comics[BIG_ID]["fileName"])
check("A single leading slash means library-root-relative", star == (LIBRARY / "Arc" / "star.cbz").resolve())
for path in ("/../outside.cbz", "//server/share.cbz", "C:/other.cbz", "/Arc/../other.cbz", "/Arc\\other.cbz", "/Arc/file:stream", "/Arc//other.cbz"):
    rejects("Reject library path " + path, lambda path=path: library_path(LIBRARY, path))
rejects("A filename/path mismatch is reported", lambda: library_path(LIBRARY, "/Arc/star.cbz", "other.cbz"))
check("Missing media is separate from the valid source record", not library_path(LIBRARY, comics[50]["path"]).exists() and infos[501]["read"] == 1)
source_hash = hashlib.sha1(star.read_bytes()[:524288]).hexdigest() + str(star.stat().st_size)
check("Source hash is SHA1 of prefix concatenated with decimal size", infos[101]["hash"] == source_hash)
case_a, case_b = [FIXTURES / "media-cases" / name for name in ("partial-hash-a.bin", "partial-hash-b.bin")]
partial = lambda path: hashlib.sha1(path.read_bytes()[:524288]).hexdigest() + str(path.stat().st_size)
check("Different tails can have equal YACReader pseudo hashes", partial(case_a) == partial(case_b) and digest(case_a) != digest(case_b))
cover = LIBRARY / ".yacreaderlibrary" / "covers" / (source_hash + ".jpg")
with Image.open(cover) as image:
    check("Comic cover is decoded from the exact source hash filename", image.format == "JPEG" and image.size == (240, 320))
check("Folder cover has separate ownership", (cover.parent / "folders" / "2.jpg").exists() and cover.name != "2.jpg")

names = image_page_names(archive_members(star))
ordered = page_order(names)
check("Archive storage order is not the source page order", names[0] == "page13.png" and ordered[0] == "page01.png")
check("Spread heuristic moves page1011 before page12", ordered[9:12] == ["page1011.png", "page12.png", "page13.png"])
check("A spread is one source page, not two", len(ordered) == 12)
check("Directory/numerical ordering would differ from archive heuristic", page_order(names, False)[-1] == "page1011.png")
check("Heuristic is bypassed at 1000 pages", page_order([f"page{value}.png" for value in range(1000)]) == [f"page{value}.png" for value in range(1000)])
pages = [{"type": "memberPath", "path": name} for name in ordered]
check("Bookmark zero is the first actual member", bookmarks(infos[101], pages)[0]["page"]["path"] == "page01.png")
check("Bookmark nine uses heuristic page ten", bookmarks(infos[101], pages)[1]["page"]["path"] == "page1011.png")
check("Current page ten is one-based and agrees with bookmark nine", resume(infos[101], pages) == bookmarks(infos[101], pages)[1])
check("Empty bookmark slot minus one creates no annotation", len(bookmarks(infos[101], pages)) == 2)
duplicate_slot = {**infos[101], "bookmark2": 0}
check("Duplicate bookmark slots in one record do not multiply points", len(bookmarks(duplicate_slot, pages)) == 1)
check("Unopened default currentPage one creates no resume position", resume(infos[301], pages) is None)
check("Opened first page is valid", resume(infos[201], pages) == point(pages[0]))
for value in (-2, 12, 100, 1.5, True):
    rejects("Reject out-of-range or invalid bookmark " + repr(value), lambda value=value: indexed_position(value, pages))
for value in (0, -1, 13):
    rejects("Reject invalid one-based resume " + str(value), lambda value=value: resume({**infos[101], "currentPage": value}, pages))
for filename in ("collation-tie.cbz", "case-tie.cbz", "unknown-format.cbz", "unicode-order.cbz", "duplicate-member.cbz", "traversal.cbz"):
    rejects("Reject ambiguous source page mapping " + filename, lambda filename=filename: page_order(image_page_names(archive_members(FIXTURES / "media-cases" / filename))))
check("Source suffix filtering does not require a dot", page_order(image_page_names(archive_members(FIXTURES / "media-cases" / "suffix-without-dot.cbz"))) == ["page1png", "page2png"])
check("The source __MACOSX exclusion is case-sensitive", image_page_names(archive_members(FIXTURES / "media-cases" / "macos-case.cbz")) == ["__macosx/page1.png"])
check("TAR storage order is independently mapped to member identity", page_order(image_page_names(archive_members(FIXTURES / "media-cases" / "pages.cbt"))) == ["page1.png", "page2.png"])
pdf_path = LIBRARY / "PDF" / "geometry.pdf"
pdf = PdfReader(pdf_path)
pdf_pages = [{"type": "pageIndex", "index": index} for index in range(len(pdf.pages))]
check("PDF uses three physical pages", len(pdf_pages) == infos[201]["numPages"] == 3)
check("PDF bookmark two means physical page three", bookmarks(infos[201], pdf_pages)[1] == point({"type": "pageIndex", "index": 2}))
check("PDF CropBox and rotation do not change page identity", len({page.get("/Rotate", 0) for page in pdf.pages}) > 1 and pdf_pages[0]["index"] == 0)
check("Copied PDF exactly matches the already rendered synthetic asset", digest(pdf_path) == digest(ROOT.parent / "koodo-importer" / "fixtures" / "library" / "book" / "pdf-book.pdf"))
epub = epub_pages(LIBRARY / "EPUB" / "fixed.epub")
check("EPUB source image pages retain original spine indices", [entry["page"]["index"] for entry in epub] == [1, 3, 4])
check("Repeated EPUB image bytes remain distinct spine occurrences", epub[0]["image"] == epub[2]["image"] and epub[0]["page"] != epub[2]["page"])
check("EPUB third source page maps to spine item four", resume(infos[401], [entry["page"] for entry in epub]) == point({"type": "epubSpineItem", "index": 4}))
rejects("Reflow EPUB page addressing is not guessed", lambda: epub_pages(FIXTURES / "media-cases" / "reflow.epub"))
rejects("Missing EPUB page does not silently shift indices", lambda: epub_pages(FIXTURES / "media-cases" / "missing-spine-image.epub"))
rejects("XML declarations are not executed", lambda: xml(b'<!DOCTYPE x [<!ENTITY a SYSTEM "file:///private">]><x>&a;</x>'))
_, malformed = load_database(FIXTURES / "invalid" / "malformed-personal.ydb")
malformed_row = index_rows(malformed["comic_info"])[201]
rejects("Malformed optional score is rejected independently", lambda: rating(malformed_row["rating"]))
rejects("Malformed optional read flag is rejected independently", lambda: read_completion(malformed_row["read"], "work", 0))
check("Malformed personal fields do not erase usable bibliographic text", malformed_row["title"] == "Paper Geometry")
after = {entry["path"]: digest(ROOT / entry["path"]) for entry in MANIFEST["files"]}
check("All 32 input files remain byte-identical after verification", before == after)
result = {"evidenceClass": "synthetic-byte-and-mapping-probe", "sourceApplicationExecuted": False, "qtOrCppExecuted": False, "productionImporterExecuted": False, "inputFiles": len(MANIFEST["files"]), "passed": sum(check["passed"] for check in CHECKS), "failed": sum(not check["passed"] for check in CHECKS), "allInputsUnchanged": before == after, "checks": CHECKS}
(ROOT / "synthetic-results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: result[key] for key in ("inputFiles", "passed", "failed", "allInputsUnchanged")}))
for item in CHECKS:
    if not item["passed"]:
        print("FAILED: " + item["name"])
raise SystemExit(1 if result["failed"] else 0)
