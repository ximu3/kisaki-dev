"""Build synthetic current-family Koodo inputs; no real library data is used."""

import csv
import hashlib
import io
import json
import sqlite3
import zipfile
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import FloatObject, NameObject, RectangleObject
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
LIBRARY = FIXTURES / "library"
SCHEMA = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))["tables"]
for directory in (LIBRARY / "config", LIBRARY / "book", LIBRARY / "cover", FIXTURES / "exports", FIXTURES / "invalid"):
    directory.mkdir(parents=True, exist_ok=True)


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def digest(data):
    return hashlib.md5(data, usedforsecurity=False).hexdigest()


def write_zip(path, members):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in members:
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
            archive.writestr(info, value)


def png(color):
    output = io.BytesIO()
    Image.new("RGB", (32, 48), color).save(output, format="PNG")
    return output.getvalue()


epub = LIBRARY / "book" / "12.epub"
write_zip(epub, [
    ("mimetype", "application/epub+zip"),
    ("META-INF/container.xml", '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
    ("EPUB/package.opf", '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:synthetic:koodo:novel</dc:identifier><dc:title>Synthetic Novel</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-15T00:00:00Z</meta></metadata><manifest><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'),
    ("EPUB/nav.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">One</a></li><li><a href="chapter2.xhtml">Two</a></li></ol></nav></body></html>'),
    ("EPUB/chapter1.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><p id="first">Moon 🌙 returns.</p><p style="display:none">Hidden text changes raw offsets.</p><p>Moon 🌙 returns.</p><p><ruby>月<rt>moon</rt></ruby> and light.</p></body></html>'),
    ("EPUB/chapter2.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head><body><p>Moon 🌙 returns.</p></body></html>'),
])

comic = LIBRARY / "book" / "comic-book.cbz"
write_zip(comic, [
    ("pages/10.png", png("navy")), ("pages/2.png", png("gold")),
    ("pages/1.png", png("green")), ("pages/3.PNG", png("red")),
    ("text.txt", "Not a page."),
])
write_zip(FIXTURES / "invalid" / "comic-collation-tie.cbz", [("A.png", png("white")), ("a.png", png("black"))])

# The PDF skill operation marker must be run immediately before invoking this builder.
pdf_buffer = io.BytesIO()
pdf_canvas = canvas.Canvas(pdf_buffer, pagesize=(300, 240), invariant=1)
rectangles = [[40, 170, 130, 155], [40, 145, 150, 130]]
for index in range(3):
    pdf_canvas.setFont("Helvetica", 11)
    pdf_canvas.drawString(40, 190, f"Synthetic page {index + 1}")
    for x1, y1, x2, y2 in rectangles:
        pdf_canvas.setFillColorRGB(0.1, 0.4, 0.8)
        pdf_canvas.rect(x1, y2, x2 - x1, y1 - y2, fill=1, stroke=0)
    pdf_canvas.showPage()
pdf_canvas.save()
pdf_source = PdfReader(io.BytesIO(pdf_buffer.getvalue()))
pdf_writer = PdfWriter()
for index, page in enumerate(pdf_source.pages):
    page.cropbox = RectangleObject([20, 30, 280, 210])
    if index:
        page.rotate(90 if index == 1 else 270)
    page[NameObject("/UserUnit")] = FloatObject(2 if index == 2 else 1)
    pdf_writer.add_page(page)
pdf_path = LIBRARY / "book" / "pdf-book.pdf"
with pdf_path.open("wb") as output:
    pdf_writer.write(output)

(LIBRARY / "cover" / "12.png").write_bytes(png("teal"))
(LIBRARY / "cover" / "123.png").write_bytes(png("purple"))


def book(key, name, file=None, format="EPUB"):
    data = file.read_bytes() if file else b""
    return {
        "key": key, "name": name, "author": "Synthetic Author", "description": "Synthetic source description.",
        "md5": digest(data) if file else "", "cover": "", "format": format, "publisher": "Synthetic Publisher",
        "size": len(data), "page": 3 if format == "PDF" else 0,
        "path": f"Z:/synthetic-only/{key}.{format.lower()}", "charset": "UTF-8",
    }


books = [
    book("12", "Synthetic Novel", epub), book("pdf-book", "Synthetic PDF", pdf_path, "PDF"),
    book("comic-book", "Synthetic Comic", comic, "CBZ"), book("deleted-book", "Synthetic Removed"),
    book("marked-book", "Synthetic Finished Without Position"), book("rounded-book", "Synthetic Rounded Progress"),
    book("missing-book", "Synthetic Missing File"),
]
locations = {
    "12": {"text": "Moon 🌙 returns.", "chapterTitle": "One", "chapterDocIndex": "0", "chapterHref": "chapter1.xhtml", "count": "0", "percentage": "0.25", "page": "3", "xpath": "/body/DocFragment[1]/body/p[1]", "timestamp": 1792022400},
    "pdf-book": {"text": "", "chapterTitle": "", "chapterDocIndex": "1", "chapterHref": "title1", "count": "0", "percentage": "1", "page": "0"},
    "comic-book": {"text": "", "chapterTitle": "10.png", "chapterDocIndex": "2", "chapterHref": "pages/10.png", "count": "0", "percentage": "0.5", "page": "0"},
    "marked-book": {"percentage": "1"},
    "rounded-book": {"percentage": "0.99999"},
}
config = {
    "favoriteBooks": ["12", "comic-book"], "deletedBooks": ["deleted-book"],
    "recentBooks": ["rounded-book", "12"], "recentAdd": ["missing-book"],
    "shelfList": {"Archive": ["pdf-book", "12", "comic-book", "missing-book"], "Read": ["comic-book", "12"]},
    "sortedShelfList": ["Read", "Archive"], "recordLocation": locations,
    "readingTime": {"12": 150, "pdf-book": 60, "comic-book": 45},
    "readingStats": {"2026-10-15": ["12-120", "pdf-book-60"], "2026-10-16": ["12-30", "comic-book-45"]},
    "noteTags": ["moon,light", "review"],
    "thirdpartyToken": "synthetic-placeholder-never-read",
}
(LIBRARY / "config" / "config.json").write_text(encode({key: encode(value) for key, value in config.items()}), encoding="utf-8")
source_date = {"year": 2026, "month": 10, "day": 15}
notes = [{
    "key": "note-novel", "bookKey": "12", "date": source_date, "chapter": "One", "chapterIndex": 0,
    "text": "Moon 🌙 returns.", "cfi": encode(locations["12"]),
    "range": encode({"characterRange": {"start": 0, "end": 16}, "backward": False}),
    "notes": 'Literal "quote", comma\nand a new line.', "percentage": "0.25", "color": "background-#fff000", "tag": ["moon,light", "review"],
}]
for index in range(3):
    stored_rectangles = [
        [x1, y1, x2, y2] if index == 0 else [x1, y2, x2, y1] if index == 1 else [x2, y1, x1, y2]
        for x1, y1, x2, y2 in rectangles
    ]
    notes.append({
        "key": f"note-pdf-{index}", "bookKey": "pdf-book", "date": source_date, "chapter": f"Page {index + 1}", "chapterIndex": index,
        "text": "Synthetic selected lines.", "cfi": encode({**locations["pdf-book"], "chapterDocIndex": str(index)}),
        "range": encode({"page": index, "coords": stored_rectangles, "readerMode": "scroll"}),
        "notes": "=SUM(1,2) is literal text.", "percentage": str(index / 2), "color": "background-#FEF3CD", "tag": [],
    })
bookmarks = [
    {"key": "bookmark-comic", "bookKey": "comic-book", "cfi": encode(locations["comic-book"]), "label": "Remember this page", "percentage": "0.5", "chapter": "10.png"},
    {"key": "bookmark-novel", "bookKey": "12", "cfi": encode(locations["12"]), "label": "Return to the opening", "percentage": "0.25", "chapter": "One"},
]
words = [{"key": "word-1", "bookKey": "12", "date": source_date, "word": "moon", "sentence": "Moon 🌙 returns.", "chapter": "One"}]


def database(name, rows):
    path = LIBRARY / "config" / f"{name}.db"
    columns = SCHEMA[name]["columns"]
    connection = sqlite3.connect(path)
    connection.execute(f'DROP TABLE IF EXISTS "{name}"')
    declarations = [f'"{item["name"]}" {item["declaredType"]}' + (" PRIMARY KEY" if item["primaryKey"] else "") for item in columns]
    connection.execute(f'CREATE TABLE "{name}" ({", ".join(declarations)})')
    names = [item["name"] for item in columns]
    for row in rows:
        values = [encode(row[name]) if isinstance(row[name], (dict, list)) else row[name] for name in names]
        connection.execute(f'INSERT INTO "{name}" VALUES ({", ".join("?" for _ in values)})', values)
    connection.commit()
    connection.close()


for table, rows in (("books", books), ("notes", notes), ("bookmarks", bookmarks), ("words", words)):
    database(table, rows)

exports = []
for note in notes:
    source_book = next(item for item in books if item["key"] == note["bookKey"])
    exports.append({**note, "date": "2026-10-15", "tag": ",".join(note["tag"]),
        "color": note["color"].split("-", 1)[1], "styleType": "background",
        "bookName": source_book["name"], "bookAuthor": source_book["author"], "bookMd5": source_book["md5"], "exportType": "note"})
highlights = [{**{key: value for key, value in row.items() if key != "notes"}, "exportType": "highlight"} for row in exports]


def csv_bytes(rows):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


for name, rows in (("notes", exports), ("highlights", highlights)):
    (FIXTURES / "exports" / f"{name}.json").write_text(encode(rows), encoding="utf-8")
    (FIXTURES / "exports" / f"{name}.csv").write_bytes(csv_bytes(rows))
for extension in ("json", "csv"):
    serializer = (lambda rows: encode(rows).encode("utf-8")) if extension == "json" else csv_bytes
    write_zip(FIXTURES / "exports" / f"batch-{extension}.zip", [
        (f"all.{extension}", serializer(exports)),
        (f"Synthetic Novel.{extension}", serializer(exports[:1])),
        (f"Synthetic PDF.{extension}", serializer(exports[1:])),
    ])
members = [(path.relative_to(LIBRARY).as_posix(), path.read_bytes()) for path in sorted(LIBRARY.rglob("*")) if path.is_file()]
write_zip(FIXTURES / "backup.zip", members)
write_zip(FIXTURES / "invalid" / "old-json-backup.zip", [("config/books.json", "[]")])
write_zip(FIXTURES / "invalid" / "path-traversal.zip", [("../config/books.db", b"not SQLite")])
write_zip(FIXTURES / "invalid" / "multiple-roots.zip", [(f"{prefix}/{name}", data) for prefix in ("a", "b") for name, data in members if name.startswith("config/")])
(FIXTURES / "invalid" / "malformed-config.json").write_text('{"favoriteBooks":"not-json"}', encoding="utf-8")
(FIXTURES / "invalid" / "annotation-sentinel.json").write_text(encode({"notes": "annotation", "text": "", "range": "{\"objects\":[]}"}), encoding="utf-8")
manifest = {"synthetic": True, "sourceFamily": "Koodo v2.4.6 SQLite backup and note/highlight exports", "pdf": {"pageCount": 3, "cropBox": [20, 30, 280, 210], "rotations": [0, 90, 270], "userUnits": [1, 1, 2], "rectangles": rectangles}, "files": []}
for path in sorted(FIXTURES.rglob("*")):
    if path.is_file():
        data = path.read_bytes()
        manifest["files"].append({"path": path.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
(ROOT / "fixture-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"files": len(manifest["files"]), "books": len(books), "notes": len(notes), "pdfPages": 3}))
