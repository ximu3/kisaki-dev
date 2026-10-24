"""Build synthetic current-format KOReader inputs without executing Lua."""

import hashlib
import json
import sqlite3
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
CONTRACT = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
KOODO = ROOT.parent / "koodo-importer/fixtures/library"


def save(relative, value):
    path = FIXTURES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value if isinstance(value, bytes) else value.encode("utf-8"))
    return path


def lua(value):
    if value is None:
        return "nil"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r") + '"'
    if isinstance(value, (int, float)):
        return str(value)
    items = enumerate(value, 1) if isinstance(value, list) else value.items()
    return "{\n" + ",\n".join(f"[{lua(key)}] = {lua(item)}" for key, item in items) + "\n}"


def save_lua(relative, value):
    return save(relative, "-- Synthetic KOReader data.\nreturn " + lua(value) + "\n")


def partial_md5(data):
    samples = []
    for index in range(-1, 11):
        # LuaJIT bit.lshift masks shift counts to five bits, including negative counts.
        offset = (1024 << ((2 * index) & 31)) & 0xFFFFFFFF
        if offset >= len(data):
            break
        samples.append(data[offset:offset + 1024])
    return hashlib.md5(b"".join(samples)).hexdigest()


media = {}
for name, source in {
    "pdf-book.pdf": KOODO / "book/pdf-book.pdf",
    "comic-book.cbz": KOODO / "book/comic-book.cbz",
    "novel.epub": KOODO / "book/12.epub",
}.items():
    media[name] = save("library/" + name, source.read_bytes())

paths = {name: "/old/books/" + name for name in media}
hashes = {name: partial_md5(path.read_bytes()) for name, path in media.items()}
pdf = {
    "doc_path": paths["pdf-book.pdf"],
    "partial_md5_checksum": hashes["pdf-book.pdf"],
    "doc_props": {"title": "星海纪事", "authors": "甲作者\n乙作者", "description": "原始文件简介", "keywords": "太空\n旅程", "language": "zh", "publisher": "虚构出版社", "series": "合辑"},
    "summary": {"status": "complete", "rating": 4, "note": "后来补写的 *书评*\n保留原文。", "modified": "2026-10-12"},
    "last_page": 3, "page_positions": {3: 0}, "percent_finished": 1,
    "annotations": [
        {"page": 1, "pageno": 1, "pageref": "i", "drawer": "lighten", "color": "yellow", "text": "第一行\n第二行", "note": "保留 *字面星号*", "datetime": "2026-09-01 12:00:00", "pos0": {"page": 1}, "pos1": {"page": 1}, "pboxes": [{"x": 20, "y": 25, "w": 91, "h": 16}, {"x": 20, "y": 50, "w": 111, "h": 16}]},
        {"page": 2, "drawer": "underscore", "text": "跨页摘录", "datetime": "2026-09-02 12:00:00", "pos0": {"page": 2}, "pos1": {"page": 3}, "ext": {2: {"pos0": {"page": 2}, "pos1": {"page": 2}, "pboxes": [{"x": 25, "y": 20, "w": 16, "h": 91}]}, 3: {"pos0": {"page": 3}, "pos1": {"page": 3}, "pboxes": [{"x": 50, "y": 40, "w": 31, "h": 181}]}}},
        {"page": 2, "pageno": 99, "pageref": "封二", "text": "页书签", "note": "从物理页定位", "datetime": "2026-09-03 12:00:00"},
        {"page": 1, "drawer": "lighten", "text": "", "note": "区域批注", "datetime": "2026-09-04 12:00:00", "pos0": {"page": 1, "x": 40, "y": 50, "zoom": 2}, "pos1": {"page": 1, "x": 220, "y": 80, "zoom": 2}},
    ],
    "annotations_rolling": [{"page": "/body/DocFragment[1]/body/p[1].0", "text": "Inactive provider backup"}],
    "highlight": {"legacy": "Not another current annotation set"},
}
save_lua("library/pdf-book.sdr/metadata.pdf.lua", pdf)
save_lua("library/pdf-book.sdr/custom_metadata.lua", {"custom_props": {"title": "星海纪事·修订名", "description": "", "authors": "甲作者\n乙作者"}})
save("library/pdf-book.sdr/cover.png", (KOODO / "cover/12.png").read_bytes())
save_lua("library/comic-book.sdr/metadata.cbz.lua", {"doc_path": paths["comic-book.cbz"], "partial_md5_checksum": hashes["comic-book.cbz"], "doc_props": {"title": "漫游图卷", "authors": "丙画师"}, "summary": {"status": "abandoned", "rating": 1}, "last_page": 4, "page_positions": {4: 0.5}, "annotations": [{"page": 4, "pageno": 4, "text": "第十张图", "datetime": "2026-09-05 12:00:00"}]})
save_lua("library/novel.sdr/metadata.epub.lua", {"doc_path": paths["novel.epub"], "partial_md5_checksum": hashes["novel.epub"], "doc_props": {"title": "星光旅记", "authors": "丁作者"}, "summary": {"status": "reading"}, "percent_finished": 1, "last_xpointer": "/body/DocFragment[2]/body/p[1].4", "cre_dom_version": 20240101, "annotations": [{"page": "/body/DocFragment[2]/body/p[1].0", "pos0": "/body/DocFragment[2]/body/p[1].0", "pos1": "/body/DocFragment[2]/body/p[1].4", "drawer": "lighten", "text": "星光🌙", "note": "原文摘录仍可保留。", "datetime": "2026-09-06 12:00:00"}]})
save_lua("detached/missing.sdr/metadata.epub.lua", {"doc_path": "/old/books/missing.epub", "doc_props": {"title": "没有随附文件的书", "authors": "丁作者"}, "summary": {"status": "complete", "rating": 5, "note": "文件缺失不应丢弃书评。"}, "annotations": []})
save_lua("settings/collection.lua", {
    "favorites": {"settings": {"order": 1}, 1: {"file": paths["pdf-book.pdf"], "order": 2}, 2: {"file": paths["novel.epub"], "order": 1}},
    "旅途": {"settings": {"order": 2, "default": True, "folders": {"/not-authorized": {"subfolders": True}}, "filter": "unread"}, 1: {"file": paths["pdf-book.pdf"], "order": 2}, 2: {"file": paths["comic-book.cbz"], "order": 1}},
    "按书名排列": {"settings": {"order": 3, "collate": "strcoll"}, 1: {"file": paths["novel.epub"]}},
})

export = {"title": "星海纪事", "author": "甲作者\n乙作者", "file": paths["pdf-book.pdf"], "md5sum": hashlib.md5(media["pdf-book.pdf"].read_bytes()).hexdigest(), "number_of_pages": 3, "exported": False, "entries": [{"sort": "highlight", "page": "i", "time": 1788235200, "text": "第一行\n第二行", "note": "保留 *字面星号*", "chapter": "序", "drawer": "lighten", "color": "yellow", "pn_xp": 1}]}
save("exports/single.json", json.dumps({**export, "created_on": 1792140000, "version": "json/1.0.0"}, ensure_ascii=False, indent=2) + "\n")
second_export = {"title": "星光旅记", "author": "丁作者", "file": paths["novel.epub"], "number_of_pages": 100, "exported": False, "entries": [{"sort": "highlight", "page": 20, "time": 1788667200, "text": "星光🌙", "note": "原文摘录仍可保留。", "pn_xp": "/body/DocFragment[2]/body/p[1].0"}]}
save("exports/multiple.json", json.dumps({"created_on": 1792140000, "version": "json/1.0.0", "documents": [export, second_export]}, ensure_ascii=False, indent=2) + "\n")
save("exports/notes.md", "# 星光旅记\n\n星光🌙\n\n原文摘录仍可保留。\n")
save("exports/notes.txt", "星海纪事\n第一行\n第二行\n保留 *字面星号*\n")

database = FIXTURES / "settings/statistics.sqlite3"
database.unlink(missing_ok=True)
db = sqlite3.connect(database)
for name, definition in CONTRACT["statisticsTables"].items():
    columns = []
    for column in definition["columns"]:
        suffix = " PRIMARY KEY" if column["primaryKey"] else ""
        if name == "book" and column["primaryKey"]:
            suffix += " AUTOINCREMENT"
        columns.append(f'"{column["name"]}" {column["type"]}{suffix}')
    if name == "page_stat_data":
        columns += ["UNIQUE (id_book, page, start_time)", "FOREIGN KEY (id_book) REFERENCES book(id)"]
    db.execute(f'CREATE TABLE "{name}" ({", ".join(columns)})')
db.execute("CREATE UNIQUE INDEX book_title_authors_md5 ON book(title, authors, md5)")
db.execute(f'PRAGMA user_version={CONTRACT["statisticsVersion"]}')
db.execute("CREATE VIEW page_stat AS SELECT id_book, first_page+idx-1 AS page, start_time, duration/(last_page-first_page+1) AS duration FROM (SELECT id_book, page, total_pages, pages, start_time, duration, ((page-1)*pages)/total_pages+1 AS first_page, max(((page-1)*pages)/total_pages+1,(page*pages)/total_pages) AS last_page, idx FROM page_stat_data JOIN book ON book.id=id_book JOIN (SELECT number AS idx FROM numbers) AS N ON idx <= (last_page-first_page+1))")
books = [
    (1, "星海纪事", "甲作者\n乙作者", 1, 1792140000, 3, 4, "合辑", "zh", hashes["pdf-book.pdf"], 14, 4),
    (2, "漫游图卷", "丙画师", 0, 1792140000, 0, 4, "", "zh", hashes["comic-book.cbz"], 60, 2),
    (3, "星光旅记", "丁作者", 1, 1792140000, 1, 100, "", "zh", hashes["novel.epub"], 120, 1),
    (4, "异常时长", "戊作者", 0, 1792140000, 0, 10, "", "zh", "a" * 32, 10, 1),
    (9007199254740993, "星海纪事", "甲作者\n乙作者", 0, 1792140000, 0, 2, "", "zh", "b" * 32, 30, 1),
    (6, "没有页记录", "己作者", 0, 1792140000, 0, 20, "", "zh", "c" * 32, 999, 1),
]
db.executemany("INSERT INTO book VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", books)
db.executemany("INSERT INTO page_stat_data VALUES (?,?,?,?,?)", [(1, 1, 100, 5, 2), (1, 2, 105, 10, 2), (2, 1, 200, 60, 4), (3, 20, 300, 120, 100), (4, 1, 400, -5, 10), (4, 2, 410, 10, 10), (9007199254740993, 1, 500, 30, 2)])
db.executemany("INSERT INTO numbers VALUES (?)", [(number,) for number in range(1, 101)])
db.commit()
db.close()

save("grammar/valid.lua", '-- Data only.\nreturn { name = "星光🌙", escaped = "\\230\\152\\159", long = [=[line one\nline two]=], nil_value = nil, yes = true, no = false, negative = -3, [1] = "numeric", ["1"] = "string", ["__proto__"] = { polluted = true }, code_text = "os.execute(\'never\')" }\n')
bad_lua = {
    "call": 'return { x = os.execute("never") }',
    "function": "return { x = function() return 1 end }",
    "assignment": "x = 1; return {}",
    "arithmetic": "return { x = 1 + 2 }",
    "computed-key": "return { [1 + 1] = 3 }",
    "duplicate": "return { [1] = 2, 3 }",
    "duplicate-nil": "return { x = nil, x = 3 }",
    "infinite": "return { x = 1e309 }",
    "require": 'return require("evil")',
    "multi-return": "return {}, {}",
    "deep": "return " + "{ x = " * 65 + "1" + "}" * 65,
    "nul": 'return { x = "a" }\x00',
}
for name, source in bad_lua.items():
    save("grammar/reject-" + name + ".lua", source)
save("grammar/invalid-text.lua", 'return { valid = "fine", bad = "\\255" }')
with zipfile.ZipFile(media["comic-book.cbz"]) as archive:
    image_bytes = archive.read("pages/1.png")
for name, members in {"collation-tie.cbz": ["1.png", "01.png"], "numeric-overflow.cbz": ["2147483648.png", "2.png"], "unsupported-page.cbz": ["1.png", "2.jb2", "3.png"], "unicode-order.cbz": ["甲.png", "a.png"]}.items():
    target = FIXTURES / "invalid" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w") as archive:
        for member in members:
            archive.writestr(member, image_bytes)

manifest = {"synthetic": True, "sourceFamily": "KOReader v2026.07.1 current sidecar, JSON exporter and statistics 20221111", "mediaOrigin": "Unchanged, previously inspected synthetic Koodo inputs", "fullMd5": {name: hashlib.md5(path.read_bytes()).hexdigest() for name, path in media.items()}, "partialMd5": hashes, "files": []}
for path in sorted(FIXTURES.rglob("*")):
    if path.is_file():
        data = path.read_bytes()
        manifest["files"].append({"path": path.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
(ROOT / "fixture-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"files": len(manifest["files"]), "books": len(books), "luaCodeExecuted": False}))
