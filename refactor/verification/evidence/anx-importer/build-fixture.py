"""Build synthetic Anx schema-7 and export inputs without running Anx."""

import csv
import hashlib
import io
import json
import sqlite3
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / "fixtures"
LIBRARY = FIXTURE / "library"
KOODO = ROOT.parent / "koodo-importer/fixtures/library"
for directory in (LIBRARY / "file", LIBRARY / "cover", FIXTURE / "exports", FIXTURE / "invalid", FIXTURE / "remote"):
    directory.mkdir(parents=True, exist_ok=True)
schema = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))


def md5(data):
    return hashlib.md5(data, usedforsecurity=False).hexdigest()


members = {
    "mimetype": "application/epub+zip",
    "META-INF/container.xml": '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    "EPUB/package.opf": '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:synthetic:anx:novel</dc:identifier><dc:title>星光庭院</dc:title><dc:language>zh</dc:language><meta property="dcterms:modified">2026-10-17T00:00:00Z</meta></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="two.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref id="spine-one" idref="c1"/><itemref id="spine-two" idref="c2"/></spine></package>',
    "EPUB/one.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head><body><p id="p1">星光🌙与庭院。</p><p id="p,2">第二段<em>强调</em>尾声</p><p id="chunks">甲<![CDATA[乙]]>丙</p><p>星光🌙与庭院。</p></body></html>',
    "EPUB/two.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第二章</title></head><body><p>归途。</p></body></html>',
    "EPUB/nav.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">第一章</a></li><li><a href="two.xhtml">第二章</a></li></ol></nav></body></html>',
}
epub_path = LIBRARY / "file/novel.epub"
with zipfile.ZipFile(epub_path, "w") as archive:
    for name, text in members.items():
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 17, 0, 0, 0))
        info.compress_type = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
        archive.writestr(info, text.encode("utf-8"))
with zipfile.ZipFile(LIBRARY / "file/fixed.epub", "w") as archive:
    for name, text in members.items():
        if name == "EPUB/package.opf":
            text = text.replace("</metadata>", '<meta property="rendition:layout">pre-paginated</meta></metadata>')
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 17, 0, 0, 0))
        info.compress_type = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
        archive.writestr(info, text.encode("utf-8"))

# Reuse already inspected synthetic media bytes; no PDF content is edited.
for source, destination in ((KOODO / "book/pdf-book.pdf", LIBRARY / "file/pages.pdf"), (KOODO / "book/comic-book.cbz", LIBRARY / "file/comic.cbz"), (KOODO / "cover/12.png", LIBRARY / "cover/novel.png")):
    destination.write_bytes(source.read_bytes())
(LIBRARY / "file/converted.epub").write_bytes(epub_path.read_bytes())
original_text = "星光庭院\n原始 TXT 文件。".encode("utf-8")
(FIXTURE / "original.txt").write_bytes(original_text)
point = "epubcfi(/6/2[spine-one]!/4/2[p1]/1:4)"
selection = "epubcfi(/6/2[spine-one]!/4/2[p1],/1:0,/1:4)"


def book(key, title, file_path="", percentage=0.0, rating=0.0, group=0, deleted=0, cfi=""):
    path = LIBRARY / file_path
    return {"id": key, "title": title, "cover_path": "cover/novel.png" if key == 1 else "", "file_path": file_path,
        "last_read_position": cfi, "reading_percentage": percentage, "author": "合成作者", "is_deleted": deleted,
        "description": "合成来源简介。", "create_time": "2026-10-15T23:30:00.000", "update_time": "2026-10-17T10:00:00.000",
        "rating": rating, "group_id": group, "file_md5": md5(path.read_bytes()) if file_path and path.is_file() else None}


books = [
    book(1, "星光庭院", "file/novel.epub", 0.98, 3.5, 2, cfi=point),
    book(2, "合成 PDF", "file/pages.pdf", 1.0, 0, 1, cfi="epubcfi(/6/4)"),
    book(3, "合成漫画", "file/comic.cbz", 0.5, 4.5, 3, cfi="epubcfi(/6/4)"),
    book(4, "已删除书籍", deleted=1), book(5, "仅在云端", "file/missing.epub", group=1),
    book(6, "由 TXT 转换", "file/converted.epub", 0.25, 2, 1, cfi=point),
    book(8, "固定版式 EPUB", "file/fixed.epub", 0.5, 0, 3, cfi="epubcfi(/6/4[spine-two])"),
    book(9007199254740993, "星光庭院", group=0),
]
books[5]["file_md5"] = md5(original_text)
notes = [
    {"id": 11, "book_id": 1, "content": "星光🌙", "cfi": selection, "chapter": "第一章", "type": "highlight", "color": "ffff00", "reader_note": '保留 *字面标点*、逗号,\n以及"引号"。'},
    {"id": 12, "book_id": 1, "content": "与庭院。", "cfi": point, "chapter": "第一章", "type": "bookmark", "color": "0.5", "reader_note": None},
    {"id": 13, "book_id": 2, "content": "PDF 文本摘录", "cfi": "epubcfi(/6/2!/4/2/1:0)", "chapter": "Page 1", "type": "underline", "color": "ff0000", "reader_note": "只有渲染层位置。"},
    {"id": 14, "book_id": 3, "content": "漫画页面", "cfi": "epubcfi(/6/4)", "chapter": "10.png", "type": "bookmark", "color": "0.5", "reader_note": None},
    {"id": 15, "book_id": 1, "content": "未知种类的真实文字", "cfi": "", "chapter": "", "type": "unrecognized", "color": "", "reader_note": "私人补充。"},
    {"id": 16, "book_id": 999, "content": "失联记录", "cfi": point, "chapter": "", "type": "highlight", "color": "00ff00", "reader_note": None},
]
for note in notes:
    note.update({"create_time": "2026-10-15T12:00:00.000", "update_time": "2026-10-16T13:30:00.000"})
groups = [
    {"id": 0, "name": "Root", "parent_id": None, "is_deleted": 0},
    {"id": 1, "name": "故事", "parent_id": 0, "is_deleted": 0},
    {"id": 2, "name": "收藏", "parent_id": 1, "is_deleted": 0},
    {"id": 3, "name": "收藏", "parent_id": 0, "is_deleted": 0},
    {"id": 4, "name": "已删除分组", "parent_id": 0, "is_deleted": 1},
    {"id": 5, "name": "循环", "parent_id": 5, "is_deleted": 0},
    {"id": 6, "name": "失联父组", "parent_id": 999, "is_deleted": 0},
]
for group in groups:
    group.update({"create_time": "2026-10-15T12:00:00.000", "update_time": "2026-10-16T13:30:00.000"})
styles = [
    {"id": 101, "font_size": 1.0, "font_family": "轻小说", "line_height": 0x123456},
    {"id": 102, "font_size": 1.00005, "font_family": "奇幻", "line_height": None},
    {"id": 103, "font_size": 16.0, "font_family": "Ordinary font", "line_height": 1.5},
    {"id": 201, "font_size": 2.0, "line_height": 1.0, "letter_spacing": 101.0},
    {"id": 202, "font_size": 2.00005, "line_height": 1.0, "letter_spacing": 102.0},
    {"id": 203, "font_size": 2.0, "line_height": 1.0, "letter_spacing": 101.0},
    {"id": 204, "font_size": 2.0, "line_height": 2.0, "letter_spacing": 999.0},
    {"id": 205, "font_size": 2.0, "line_height": 1.5, "letter_spacing": 101.0},
]
times = [
    {"id": 1001, "book_id": 1, "date": "2026-10-15", "reading_time": 3600},
    {"id": 1002, "book_id": 1, "date": "2026-10-15T18:30:00", "reading_time": 1800},
    {"id": 1003, "book_id": 1, "date": "invalid-date", "reading_time": 60},
    {"id": 1004, "book_id": 2, "date": "2026-10-16", "reading_time": 600},
    {"id": 1005, "book_id": 3, "date": "2026-10-16", "reading_time": 0},
]
path = LIBRARY / "app_database.db"
connection = sqlite3.connect(path)
for table in schema["tables"]:
    connection.execute(f'DROP TABLE IF EXISTS "{table}"')
for table, definition in schema["tables"].items():
    columns = []
    for column in definition["columns"]:
        constraint = " PRIMARY KEY" if column["primaryKey"] else ""
        if column["primaryKey"] and table != "tb_reading_time":
            constraint += " AUTOINCREMENT"
        if table == "tb_groups" and column["name"] == "is_deleted":
            constraint += " DEFAULT 0"
        columns.append(f'"{column["name"]}" {column["type"]}{constraint}')
    if table == "tb_groups":
        columns.append('FOREIGN KEY (parent_id) REFERENCES tb_groups(id)')
    connection.execute(f'CREATE TABLE "{table}" ({", ".join(columns)})')
for table, rows in (("tb_books", books), ("tb_notes", notes), ("tb_groups", groups), ("tb_styles", styles), ("tb_reading_time", times)):
    names = [column["name"] for column in schema["tables"][table]["columns"]]
    for row in rows:
        connection.execute(f'INSERT INTO "{table}" VALUES ({", ".join("?" for _ in names)})', [row.get(name) for name in names])
connection.execute("PRAGMA user_version=7")
connection.commit()
connection.close()
(FIXTURE / "remote/database7.db").write_bytes(path.read_bytes())
wrong = FIXTURE / "invalid/wrong-version.db"
wrong.write_bytes(path.read_bytes())
with sqlite3.connect(wrong) as connection:
    connection.execute("PRAGMA user_version=6")
foreign = FIXTURE / "invalid/foreign.db"
with sqlite3.connect(foreign) as connection:
    connection.execute("DROP TABLE IF EXISTS unrelated")
    connection.execute("CREATE TABLE unrelated (id INTEGER PRIMARY KEY)")
    connection.execute("PRAGMA user_version=7")
headers = ["Book", "Author", "Chapter", "Content", "Reader Note", "Type", "Color", "Create Time", "Update Time"]
csv_rows = [
    ["星光庭院", "合成作者", "第一章", "带逗号,与引号\"的摘录", "=SUM(1,2)\n下一行。", "highlight", "#ffff00", "2026-10-15T12:00:00.000", "2026-10-16T13:30:00.000"],
    ["星光庭院", "合成作者", "第一章", "书签文字", "", "bookmark", "#0.5", "2026-10-15T12:00:00.000", "2026-10-16T13:30:00.000"],
]
csv_rows.append(csv_rows[0].copy())
text = io.StringIO(newline="")
writer = csv.writer(text, lineterminator="\r\n")
writer.writerow(headers)
writer.writerows(csv_rows)
(FIXTURE / "exports/notes.csv").write_bytes(text.getvalue().encode("gbk"))
(FIXTURE / "exports/notes.md").write_text('# 星光庭院\n\n *合成作者*\n\n## 第一章\n\n> 原文\n\n私人批注。\n\n', encoding="utf-8")
(FIXTURE / "exports/notes.txt").write_text('第一章\n\t原文\n\t\t私人批注。', encoding="utf-8")
manifest = {"synthetic": True, "sourceRef": "v1.14.0", "databaseVersion": 7, "pdfReusedWithoutEdits": True, "files": []}
for file in sorted(FIXTURE.rglob("*")):
    if file.is_file():
        data = file.read_bytes()
        manifest["files"].append({"path": file.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
(ROOT / "fixture-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"files": len(manifest["files"]), "books": len(books), "notes": len(notes), "tables": len(schema["tables"])}))
