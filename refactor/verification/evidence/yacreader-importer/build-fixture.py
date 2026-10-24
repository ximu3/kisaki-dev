"""Build synthetic YACReader library, database export, and media fixtures."""

import hashlib
import io
import json
import sqlite3
import tarfile
import warnings
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
LIBRARY = FIXTURES / "library"
CONTRACT = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
BIG_ID = 9007199254740993


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def image_bytes(label, image_format="PNG"):
    image = Image.new("RGB", (240, 320), "#f4f0e8")
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, 220, 300), outline="#427486", width=4)
    draw.text((40, 140), label, fill="#26353d")
    target = io.BytesIO()
    image.save(target, format=image_format)
    return target.getvalue()


def archive(path, members):
    path.parent.mkdir(parents=True, exist_ok=True)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as target:
            for name, content in members:
                info = zipfile.ZipInfo(name, date_time=(2026, 10, 17, 0, 0, 0))
                info.compress_type = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                target.writestr(info, content)


def pseudo_hash(path):
    data = path.read_bytes()
    return hashlib.sha1(data[:524288]).hexdigest() + str(len(data))


def database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if not path.resolve().is_relative_to(FIXTURES.resolve()):
            raise ValueError("Fixture destination is outside the fixture directory.")
        path.unlink()
    connection = sqlite3.connect(path)
    for table in CONTRACT["tables"].values():
        connection.execute(table["createSql"])
    connection.execute("INSERT INTO db_info VALUES (?)", (CONTRACT["databaseVersion"],))
    connection.execute("INSERT INTO folder (id,parentId,name,path) VALUES (1,1,'root','/')")
    connection.execute("INSERT INTO default_reading_list (id,name) VALUES (1,'Favorites')")
    return connection


def insert(connection, table, values):
    columns = ",".join(values)
    placeholders = ",".join("?" for _ in values)
    connection.execute(f"INSERT INTO {table} ({columns}) VALUES ({placeholders})", tuple(values.values()))


page_names = [f"page{value:02}.png" for value in range(1, 10)] + ["page1011.png", "page12.png", "page13.png"]
pages = [(name, image_bytes(name)) for name in reversed(page_names)]
archive(LIBRARY / "Arc" / "star.cbz", pages + [("ComicInfo.xml", b"<ComicInfo><Notes>Embedded source note</Notes><Web>https://example.invalid/item-42/</Web></ComicInfo>"), ("__MACOSX/ghost.png", b"ignored")])
write(LIBRARY / "Copies" / "star-copy.cbz", (LIBRARY / "Arc" / "star.cbz").read_bytes())
archive(LIBRARY / "Arc" / "unopened.cbz", [("1.png", image_bytes("First")), ("2.png", image_bytes("Second"))])
if not (LIBRARY / "PDF" / "geometry.pdf").is_file():
    raise ValueError("The inspected synthetic PDF fixture must be provided before building.")

container = b'<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
package = b'''<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">synthetic-yacreader</dc:identifier><dc:title>Image book</dc:title><dc:language>en</dc:language><meta property="rendition:layout">pre-paginated</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="p1" href="p1.xhtml" media-type="application/xhtml+xml"/><item id="credits" href="credits.xhtml" media-type="application/xhtml+xml"/><item id="p2" href="p2.xhtml" media-type="application/xhtml+xml"/><item id="repeat" href="repeat.xhtml" media-type="application/xhtml+xml"/><item id="i1" href="images/1.png" media-type="image/png"/><item id="i2" href="images/2.png" media-type="image/png"/></manifest><spine><itemref idref="nav"/><itemref idref="p1"/><itemref idref="credits"/><itemref idref="p2"/><itemref idref="repeat"/></spine></package>'''
wrapper = lambda image: f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Page</title><meta name="viewport" content="width=240,height=320"/></head><body><img src="images/{image}.png"/></body></html>'.encode()
epub_members = [("mimetype", b"application/epub+zip"), ("META-INF/container.xml", container), ("OPS/book.opf", package), ("OPS/nav.xhtml", b'<html xmlns="http://www.w3.org/1999/xhtml"><body>Contents</body></html>'), ("OPS/credits.xhtml", b'<html xmlns="http://www.w3.org/1999/xhtml"><body>Credits</body></html>'), ("OPS/p1.xhtml", wrapper(1)), ("OPS/p2.xhtml", wrapper(2)), ("OPS/repeat.xhtml", wrapper(1)), ("OPS/images/1.png", image_bytes("Image 1")), ("OPS/images/2.png", image_bytes("Image 2"))]
archive(LIBRARY / "EPUB" / "fixed.epub", epub_members)

library_db = LIBRARY / ".yacreaderlibrary" / "library.ydb"
db = database(library_db)
for identifier, name in [(2, "Arc"), (3, "Copies"), (4, "PDF"), (5, "EPUB")]:
    insert(db, "folder", {"id": identifier, "parentId": 1, "name": name, "path": "/" + name, "finished": 1, "completed": 1})

star_hash = pseudo_hash(LIBRARY / "Arc" / "star.cbz")
info_rows = [
    {"id": 101, "title": "Star Travel", "series": "Star Travel", "hash": star_hash, "numPages": 12, "edited": 1, "read": 1, "hasBeenOpened": 1, "currentPage": 10, "bookmark1": 0, "bookmark2": 9, "bookmark3": -1, "rating": 4.5, "notes": "Source note <b>literal</b>\nSecond line", "review": "Source review", "writer": "Writer A\nWriter B", "tags": "Space, opera\nAdventure", "date": "1/1/2020", "comicVineID": "42", "lastTimeOpened": 1700000000, "type": 1},
    {"id": 201, "title": "Paper Geometry", "hash": pseudo_hash(LIBRARY / "PDF" / "geometry.pdf"), "numPages": 3, "edited": 1, "read": 0, "hasBeenOpened": 1, "currentPage": 1, "bookmark1": 0, "bookmark2": 2, "rating": 0},
    {"id": 301, "title": "Unopened", "hash": pseudo_hash(LIBRARY / "Arc" / "unopened.cbz"), "numPages": 2, "read": 0},
    {"id": 401, "title": "Image Book", "hash": pseudo_hash(LIBRARY / "EPUB" / "fixed.epub"), "numPages": 3, "hasBeenOpened": 1, "currentPage": 3, "bookmark1": 2, "edited": 1},
    {"id": 501, "title": "Missing File", "hash": "a" * 40 + "100", "numPages": 20, "read": 1, "rating": 3},
    {"id": 601, "title": "Metadata Only", "hash": "b" * 40 + "200", "edited": 1, "review": "Text without a file"},
]
for row in info_rows:
    insert(db, "comic_info", row)
for identifier, parent, info, path in [(BIG_ID, 2, 101, "/Arc/star.cbz"), (BIG_ID + 1, 3, 101, "/Copies/star-copy.cbz"), (20, 4, 201, "/PDF/geometry.pdf"), (30, 2, 301, "/Arc/unopened.cbz"), (40, 5, 401, "/EPUB/fixed.epub"), (50, 2, 501, "/Arc/missing.cbz")]:
    insert(db, "comic", {"id": identifier, "parentId": parent, "comicInfoId": info, "fileName": path.rsplit("/", 1)[1], "path": path})
for identifier, name, color, order in [(1, "Revisit", "red", 0), (2, "Empty label", "green", 3)]:
    insert(db, "label", {"id": identifier, "name": name, "color": color, "ordering": order})
insert(db, "comic_label", {"comic_id": BIG_ID, "label_id": 1, "ordering": 0})
for identifier, parent, name, order in [(10, None, "Weekend", 0), (11, 10, "First arc", 0), (12, 10, "Second arc", 1), (13, None, "Empty list", 0)]:
    insert(db, "reading_list", {"id": identifier, "parentId": parent, "name": name, "ordering": order})
for list_id, comic_id, order in [(10, 20, 0), (11, BIG_ID, 0), (11, 30, 1), (12, 40, 0), (12, BIG_ID + 1, 1)]:
    insert(db, "comic_reading_list", {"reading_list_id": list_id, "comic_id": comic_id, "ordering": order})
insert(db, "comic_default_reading_list", {"comic_id": BIG_ID, "default_reading_list_id": 1, "ordering": 0})
db.commit()
backup_path = FIXTURES / "full-backup.ydb"
if backup_path.exists():
    backup_path.unlink()
db.execute("VACUUM INTO ?", (str(backup_path),))
export_path = FIXTURES / "comics-info.ydb"
if export_path.exists():
    export_path.unlink()
db.execute("ATTACH DATABASE ? AS exported", (str(export_path),))
db.execute("CREATE TABLE exported.db_info (version TEXT NOT NULL)")
db.execute("INSERT INTO exported.db_info SELECT * FROM db_info")
db.execute("CREATE TABLE exported.comic_info AS SELECT " + ",".join(CONTRACT["exportFields"]) + " FROM comic_info WHERE edited=1 OR comicVineID IS NOT NULL")
db.commit()
db.close()
write(LIBRARY / ".yacreaderlibrary" / "covers" / (star_hash + ".jpg"), image_bytes("Star cover", "JPEG"))
write(LIBRARY / ".yacreaderlibrary" / "covers" / "folders" / "2.jpg", image_bytes("Folder cover", "JPEG"))

other_db = database(FIXTURES / "other-library.ydb")
insert(other_db, "comic_info", {"id": 101, "title": "Another Library", "hash": "c" * 40 + "300"})
insert(other_db, "comic", {"id": BIG_ID, "parentId": 1, "comicInfoId": 101, "fileName": "other.cbz", "path": "/other.cbz"})
other_db.commit()
other_db.close()

mutations = {
    "unknown-version.ydb": "UPDATE db_info SET version='99.0.0'",
    "missing-relationship-table.ydb": "DROP TABLE comic_reading_list",
    "dangling-comic.ydb": "UPDATE comic SET comicInfoId=999 WHERE id=20",
    "cycle-list.ydb": "UPDATE reading_list SET parentId=11 WHERE id=10",
    "dangling-list.ydb": "UPDATE reading_list SET parentId=999 WHERE id=11",
    "malformed-personal.ydb": "UPDATE comic_info SET rating=8,read=2,currentPage=-2,bookmark1=99 WHERE id=201",
    "source-view.ydb": "DROP TABLE comic; CREATE VIEW comic AS SELECT 1 AS id",
}
for filename, sql in mutations.items():
    path = FIXTURES / "invalid" / filename
    write(path, library_db.read_bytes())
    with sqlite3.connect(path) as invalid:
        invalid.executescript(sql)
write(FIXTURES / "invalid" / "not-sqlite.ydb", b"not a database")

invalid_archives = {
    "collation-tie.cbz": [("page1.png", image_bytes("A")), ("page01.png", image_bytes("B"))],
    "case-tie.cbz": [("page1.png", image_bytes("A")), ("PAGE1.PNG", image_bytes("B"))],
    "unknown-format.cbz": [("page1.png", image_bytes("A")), ("page2.avif", b"unknown plugin")],
    "unicode-order.cbz": [("第一.png", image_bytes("A")), ("第二.png", image_bytes("B"))],
    "duplicate-member.cbz": [("1.png", image_bytes("A")), ("1.png", image_bytes("B"))],
    "traversal.cbz": [("../1.png", image_bytes("A"))],
    "suffix-without-dot.cbz": [("page1png", image_bytes("A")), ("page2png", image_bytes("B"))],
    "macos-case.cbz": [("__macosx/page1.png", image_bytes("A")), ("__MACOSX/page2.png", b"excluded")],
}
for filename, members in invalid_archives.items():
    archive(FIXTURES / "media-cases" / filename, members)
with tarfile.open(FIXTURES / "media-cases" / "pages.cbt", "w") as target:
    for name in ("page2.png", "page1.png"):
        data = image_bytes(name)
        info = tarfile.TarInfo(name)
        info.size = len(data)
        target.addfile(info, io.BytesIO(data))
archive(FIXTURES / "media-cases" / "reflow.epub", [(name, data.replace(b"pre-paginated", b"reflowable") if name == "OPS/book.opf" else data) for name, data in epub_members])
archive(FIXTURES / "media-cases" / "missing-spine-image.epub", [(name, data) for name, data in epub_members if name != "OPS/images/2.png"])

# Equal partial hashes do not prove that bytes after the first 512 KiB are equal.
write(FIXTURES / "media-cases" / "partial-hash-a.bin", b"P" * 524288 + b"original tail")
write(FIXTURES / "media-cases" / "partial-hash-b.bin", b"P" * 524288 + b"modified tail")
manifest = [{"path": str(path.relative_to(ROOT)).replace("\\", "/"), "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in sorted(FIXTURES.rglob("*")) if path.is_file()]
(ROOT / "fixture-manifest.json").write_text(json.dumps({"origin": "synthetic", "files": manifest}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"inputFiles": len(manifest), "comicRows": 6, "infoRows": 6, "exportFields": len(CONTRACT["exportFields"])}))
