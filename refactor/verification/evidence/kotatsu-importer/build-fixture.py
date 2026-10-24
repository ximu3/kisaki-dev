"""Build synthetic official Kotatsu backup and downloaded-media inputs."""

import copy
import hashlib
import json
import warnings
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
CONTRACT = json.loads((ROOT / "source-contract.json").read_text(encoding="utf-8"))
IMAGE = (ROOT.parent / "koodo-importer/fixtures/library/cover/12.png").read_bytes()
NOW = 1792140000000
BIG = 9007199254740993


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=True).encode("utf-8")


def save(relative, data):
    path = FIXTURES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def archive(relative, entries):
    path = FIXTURES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as output:
            for name, data in entries:
                info = zipfile.ZipInfo(name, (2026, 10, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                output.writestr(info, data)
    return path


def manga(identity, title, source="EXAMPLE", public_url=None):
    url = f"https://example.invalid/manga/{identity}"
    return {"id": identity, "title": title, "alt_title": "别名一\n别名二", "url": f"/manga/{identity}", "public_url": public_url or url, "rating": 0.95, "nsfw": False, "content_rating": "SAFE", "cover_url": url + "/cover.png", "large_cover_url": None, "state": "ONGOING", "author": "甲作者\n乙画师", "source": source, "tags": [{"id": -44, "title": "旅程", "key": "journey", "source": source, "pinned": False}]}


book_a = manga(BIG, "星旅")
book_b = manga(-202, "分卷漫画")
book_b.update(source="LOCAL", url="file:///storage/emulated/0/Kotatsu/volume-series")
book_c = manga(303, "没有随附图像")
book_d = manga(404, "星旅", source="SECOND")
book_e = manga(505, "出版已结束")
book_e["state"] = "FINISHED"
book_e["rating"] = -1


def favorite(book, category, created, pinned=False, sort_key=0):
    return {"manga_id": book["id"], "category_id": category, "sort_key": sort_key, "pinned": pinned, "created_at": created, "manga": book}


def history(book, chapter, page, scroll, percent, chapters):
    return {"manga_id": book["id"], "created_at": NOW - 86400000, "updated_at": NOW - 600000, "chapter_id": chapter, "page": page, "scroll": float(scroll), "percent": percent, "chapters": chapters, "manga": book}


def bookmark(book, chapter, page, scroll, image_url, page_id):
    return {"manga_id": book["id"], "page_id": page_id, "chapter_id": chapter, "page": page, "scroll": scroll, "image_url": image_url, "created_at": NOW - 3600000, "percent": 0.5}


def bookmark_group(book, records):
    metadata = copy.deepcopy(book)
    metadata["tags"] = []
    return {"manga": metadata, "tags": book["tags"], "bookmarks": records}


sections = {name: [] for name in CONTRACT["archiveEntries"]}
sections["index"] = [{"app_id": CONTRACT["applicationId"], "app_version": CONTRACT["applicationVersionCode"], "created_at": NOW}]
sections["categories"] = [
    {"category_id": 1, "created_at": NOW - 100000, "sort_key": 0, "title": "正在追", "order": "NEWEST", "track": True, "show_in_lib": True},
    {"category_id": 2, "created_at": NOW - 90000, "sort_key": 10, "title": "暂时收起", "order": "ALPHABETIC", "track": False, "show_in_lib": False},
    {"category_id": 3, "created_at": NOW - 80000, "sort_key": 5, "title": "空分类", "order": "NEWEST", "track": True, "show_in_lib": True},
]
sections["favourites"] = [favorite(book_a, 1, NOW - 70000, True, 99), favorite(book_a, 2, NOW - 60000), favorite(book_b, 1, NOW - 50000), favorite(book_d, 1, NOW - 40000)]
sections["history"] = [history(book_a, 1001, 1, 0, 0.5, 10), history(book_b, -BIG, 2, 120, 0.75, 4), history(book_c, 3001, 4, 0, 1, 20), history(book_e, 5001, 2, 0, 1, 3)]
sections["bookmarks"] = [
    bookmark_group(book_a, [bookmark(book_a, 1001, 0, 0, "https://example.invalid/pages/first.png", -BIG), bookmark(book_a, 1001, 1, 120, "https://example.invalid/pages/second.png", BIG)]),
    bookmark_group(book_b, [bookmark(book_b, -BIG, 2, 0, "file+zip:///storage/emulated/0/Kotatsu/volume-series/0_first.cbz#00000000_00010002.png", 222)]),
    bookmark_group(book_c, [bookmark(book_c, 3001, 4, 0, "https://example.invalid/missing/page.png", 333)]),
]
sections["scrobbling"] = [
    {"scrobbler": 2, "id": 10, "manga_id": BIG, "target_id": 12345, "status": "COMPLETED", "chapter": 10, "comment": "喜欢这段 *旅程*。\n保留私人文字。", "rating": 0.6666667},
    {"scrobbler": 3, "id": 23456, "manga_id": BIG, "target_id": 23456, "status": "reading", "chapter": 4, "comment": None, "rating": 0.8},
    {"scrobbler": 1, "id": 12, "manga_id": -202, "target_id": 34567, "status": "rewatching", "chapter": 3, "comment": "重读中的一部漫画", "rating": 0.6},
    {"scrobbler": 4, "id": 13, "manga_id": 303, "target_id": 45678, "status": "completed", "chapter": 20, "comment": "NaN 和 Infinity 在这里是普通文字。", "rating": 0.85},
    {"scrobbler": 3, "id": 56789, "manga_id": 404, "target_id": 56789, "status": "dropped", "chapter": 0, "comment": None, "rating": 0},
    {"scrobbler": 2, "id": 15, "manga_id": 505, "target_id": 67890, "status": None, "chapter": 3, "comment": None, "rating": float("nan")},
    {"scrobbler": 99, "id": 16, "manga_id": 505, "target_id": 99, "status": "COMPLETED", "chapter": 3, "comment": None, "rating": 0.9},
]
sections["statistics"] = [
    {"manga_id": BIG, "started_at": NOW - 10000000, "duration": 123456, "pages": 3},
    {"manga_id": BIG, "started_at": NOW - 9000000, "duration": 60000, "pages": 2},
    {"manga_id": -202, "started_at": 0, "duration": 7000, "pages": 1},
    {"manga_id": 303, "started_at": NOW - 8000000, "duration": 0, "pages": 0},
    {"manga_id": 999, "started_at": NOW - 7000000, "duration": 5000, "pages": 1},
]
sections["settings"] = [{"synthetic_setting": "ignored-app-setting"}]
sections["reader_grid"] = [{"synthetic_grid": "ignored-reader-action"}]
sections["sources"] = [{"source": "EXAMPLE", "sort_key": 0, "used_at": NOW, "added_in": 1, "pinned": False, "enabled": True}]
sections["saved_filters"] = [{"synthetic_filter": "ignored-source-rule"}]
archive("backup.zip", [(key, encoded(value)) for key, value in sections.items()])
archive("partial-no-statistics.zip", [(key, encoded(value)) for key, value in sections.items() if key != "statistics"])


def chapter(identity, prefix, number, filename=None, branch=None):
    value = {"number": number, "volume": 0, "url": f"/chapter/{identity}", "name": f"第 {number} 话", "uploadDate": NOW - 86400000, "entries": prefix + "\\d{4}"}
    if filename is not None:
        value["file"] = filename
    if branch is not None:
        value["branch"] = branch
        value["scanlator"] = "另一发布组"
    return value


def media_index(book, chapters):
    return {"id": book["id"], "title": book["title"], "title_alt": "别名一", "alt_titles": ["别名一", "别名二"], "url": f"/manga/{book['id']}", "public_url": book["public_url"], "author": "甲作者", "authors": ["甲作者", "乙画师"], "cover": book["cover_url"], "description": "<p>合成下载资料。</p>", "rating": 0.95, "content_rating": "SAFE", "nsfw": False, "state": book["state"], "source": "EXAMPLE", "tags": [{"title": "旅程", "key": "journey"}], "chapters": chapters, "app_id": CONTRACT["applicationId"], "app_version": CONTRACT["applicationVersionCode"]}


index_a = media_index(book_a, {"1001": chapter(1001, "00000000_0001", 1), "1002": chapter(1002, "00000066_0002", 1, branch="B")})
index_a["cover_entry"] = "00000000_00000000.png"
archive("media/star-travel.cbz", [("index.json", encoded(index_a)), ("00000000_00000000.png", IMAGE)] + [(f"00000000_0001{page:04d}.png", IMAGE) for page in range(3)] + [(f"00000066_0002{page:04d}.png", IMAGE) for page in range(2)])
index_b = media_index(book_b, {str(-BIG): chapter(-BIG, "00000000_0001", 1, filename="0_first.cbz")})
index_b["cover_entry"] = "cover.png"
save("media/volume-series/index.json", encoded(index_b))
save("media/volume-series/cover.png", IMAGE)
archive("media/volume-series/0_first.cbz", [(f"00000000_0001{page:04d}.png", IMAGE) for page in range(3)] + [("README.txt", b"Synthetic non-page file.")])
archive("invalid/missing-page.cbz", [("index.json", encoded(index_a)), ("00000000_00010000.png", IMAGE), ("00000000_00010002.png", IMAGE)])
archive("invalid/duplicate-page.cbz", [("index.json", encoded(index_a)), ("00000000_00010000.png", IMAGE), ("00000000_00010000.jpg", IMAGE)])

for filename, members in {
    "natural-order.cbz": ["10.png", "2.png", "1.png", "01.png", "3.PNG", "notes.txt"],
    "unknown-mime.cbz": ["1.png", "2.zzz", "3.png"],
    "source-image-universe.cbz": ["1.png", "2.psd", "3.png"],
}.items():
    archive("media/" + filename, [(name, b"8BPS" if name.endswith(".psd") else IMAGE) for name in members])

bad_index = copy.deepcopy(index_a)
bad_index["chapters"]["1001"]["entries"] = "(a+)+$"
archive("invalid/arbitrary-pattern.cbz", [("index.json", encoded(bad_index)), ("aaaa.png", IMAGE)])
bad_index = copy.deepcopy(index_b)
bad_index["chapters"][str(-BIG)]["file"] = "../outside.cbz"
save("invalid/escaping-index.json", encoded(bad_index))
wrong_app = copy.deepcopy(sections["index"])
wrong_app[0]["app_id"] = "org.example.fork"
archive("invalid/other-app.zip", [("index", encoded(wrong_app)), ("history", encoded(sections["history"]))])
wrong_version = copy.deepcopy(sections["index"])
wrong_version[0]["app_version"] = 999999
archive("invalid/unknown-version.zip", [("index", encoded(wrong_version)), ("history", encoded(sections["history"]))])
archive("invalid/duplicate-member.zip", [("index", encoded(sections["index"])), ("INDEX", encoded(sections["index"]))])
archive("invalid/traversal.zip", [("index", encoded(sections["index"])), ("../history", b"[]")])
archive("invalid/duplicate-json-key.zip", [("index", b'[{"app_id":"org.koitharu.kotatsu","app_version":1033,"app_version":999,"created_at":1}]')])
archive("invalid/unsupported-json.zip", [("index", b'[{"app_id":"org.koitharu.kotatsu",/*comment*/"app_version":1033,"created_at":1}]')])
archive("invalid/oversized-entry.zip", [("index", encoded(sections["index"])), ("history", b" " * 1048576)])
save("invalid/non-zip.bin", b"Not a Kotatsu backup.")
save("invalid/duplicate-index-key.json", b'{"chapters":{"1001":{},"1001":{}}}')

manifest = {"synthetic": True, "sourceFamily": "Official Kotatsu v9.4.1, application version code 1033", "media": "Synthetic image bytes reused from earlier Koodo fixtures; no manga pages downloaded.", "backupEntries": CONTRACT["archiveEntries"], "files": []}
for path in sorted(FIXTURES.rglob("*")):
    if path.is_file():
        data = path.read_bytes()
        manifest["files"].append({"path": path.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
(ROOT / "fixture-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"inputFiles": len(manifest["files"]), "backupEntries": len(sections), "applicationExecuted": False}))
