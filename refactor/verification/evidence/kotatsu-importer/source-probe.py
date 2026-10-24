"""Read pinned official Kotatsu sources as text without running Android code."""

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent
COMMIT = "06a0b5829b8d5f214d60d5011d66ec1ccbd5630e"
BASE = f"https://raw.githubusercontent.com/KotatsuApp/Kotatsu/{COMMIT}/"
PREFIX = "app/src/main/kotlin/org/koitharu/kotatsu/"
PARSER_COMMIT = "4d1e521aef7e4d9f41c65adda5e274509e93807c"
COIL_COMMIT = "1731511f0c12ef556db7822a91b6ea03fa3f95a1"
PATHS = [
    "backups/data/BackupRepository.kt", "backups/domain/BackupSection.kt",
    "backups/data/model/BackupIndex.kt", "backups/data/model/BookmarkBackup.kt",
    "backups/data/model/CategoryBackup.kt", "backups/data/model/FavouriteBackup.kt",
    "backups/data/model/HistoryBackup.kt", "backups/data/model/MangaBackup.kt",
    "backups/data/model/ScrobblingBackup.kt", "backups/data/model/SourceBackup.kt",
    "backups/data/model/StatisticBackup.kt", "backups/data/model/TagBackup.kt",
    "bookmarks/data/BookmarkEntity.kt", "bookmarks/data/BookmarksDao.kt",
    "bookmarks/data/EntityMapping.kt", "bookmarks/domain/Bookmark.kt",
    "bookmarks/domain/BookmarksRepository.kt",
    "history/data/HistoryEntity.kt", "history/data/HistoryDao.kt",
    "history/data/HistoryRepository.kt", "history/domain/HistoryUpdateUseCase.kt",
    "history/domain/MarkAsReadUseCase.kt", "details/domain/ProgressUpdateUseCase.kt",
    "list/domain/ReadingProgress.kt", "list/domain/ListSortOrder.kt",
    "favourites/data/FavouriteCategoryEntity.kt", "favourites/data/FavouriteEntity.kt",
    "favourites/data/FavouritesDao.kt", "favourites/domain/FavouritesRepository.kt",
    "stats/data/StatsEntity.kt", "stats/data/StatsDao.kt", "stats/data/StatsRepository.kt",
    "stats/domain/StatsCollector.kt", "stats/domain/StatsRecord.kt",
    "scrobbling/common/data/ScrobblingEntity.kt", "scrobbling/common/data/ScrobblingDao.kt",
    "scrobbling/common/domain/model/ScrobblerType.kt", "scrobbling/common/domain/model/ScrobblingInfo.kt",
    "scrobbling/common/domain/model/ScrobblingStatus.kt", "scrobbling/common/domain/Scrobbler.kt",
    "local/data/MangaIndex.kt", "local/data/input/LocalMangaParser.kt",
    "local/data/output/LocalMangaOutput.kt", "local/data/output/LocalMangaDirOutput.kt",
    "local/data/output/LocalMangaZipOutput.kt", "local/data/output/LocalMangaUtil.kt",
    "core/db/entity/MangaEntity.kt", "core/db/entity/ChapterEntity.kt",
    "core/util/AlphanumComparator.kt", "core/util/MimeTypes.kt",
    "core/model/MangaSource.kt", "core/db/entity/EntityMapping.kt",
    "core/util/ext/Uri.kt", "reader/ui/ReaderViewModel.kt",
    "scrobbling/common/domain/model/ScrobblerService.kt",
    "scrobbling/anilist/domain/AniListScrobbler.kt", "scrobbling/anilist/data/AniListRepository.kt",
    "scrobbling/kitsu/domain/KitsuScrobbler.kt", "scrobbling/kitsu/data/KitsuRepository.kt",
    "scrobbling/mal/domain/MALScrobbler.kt", "scrobbling/mal/data/MALRepository.kt",
    "scrobbling/shikimori/domain/ShikimoriScrobbler.kt", "scrobbling/shikimori/data/ShikimoriRepository.kt",
    "scrobbling/anilist/data/ScoreFormat.kt", "reader/ui/ReaderState.kt", "reader/ui/ReaderActivity.kt",
    "reader/ui/pager/standard/PageHolder.kt", "reader/ui/pager/BasePagerReaderFragment.kt",
    "reader/ui/pager/webtoon/WebtoonReaderFragment.kt", "reader/ui/pager/webtoon/WebtoonLayoutManager.kt",
    "reader/ui/pager/webtoon/WebtoonHolder.kt", "reader/ui/pager/webtoon/WebtoonImageView.kt",
    "download/ui/worker/DownloadWorker.kt",
]
PATHS += ["app/build.gradle", "gradle/libs.versions.toml"]
PATHS += ["parser/model/Constants.kt", "parser/model/Manga.kt", "parser/model/MangaState.kt", "parser/util/String.kt"]
PATHS += ["coil/commonMain/kotlin/coil3/util/mimeTypes.kt", "coil/androidMain/kotlin/coil3/util/mimeTypes.android.kt"]
parser = argparse.ArgumentParser()
parser.add_argument("--path", choices=PATHS)
parser.add_argument("--needle")
parser.add_argument("--grep")
parser.add_argument("--line", type=int)
parser.add_argument("--limit", type=int, default=2)
args = parser.parse_args()


def fetch(path):
    if path.startswith("parser/"):
        url = f"https://raw.githubusercontent.com/KotatsuApp/kotatsu-parsers/{PARSER_COMMIT}/src/main/kotlin/org/koitharu/kotatsu/parsers/{path[7:]}"
    elif path.startswith("coil/"):
        url = f"https://raw.githubusercontent.com/coil-kt/coil/{COIL_COMMIT}/coil-core/src/{path[5:]}"
    else:
        relative = path if path.startswith(("app/", "gradle/")) else PREFIX + path
        url = BASE + relative
    with urllib.request.urlopen(url, timeout=25) as response:
        data = response.read()
        metadata = {"path": path, "url": url, "status": response.status, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "checkedAt": datetime.now(timezone.utc).isoformat()}
    return path, data.decode("utf-8"), metadata


if args.path:
    path, source, metadata = fetch(args.path)
    if args.line:
        lines = source.splitlines()
        print("\n".join(f"{index + 1}: {lines[index]}" for index in range(max(0, args.line - 1), min(len(lines), args.line + 89))))
    elif args.grep:
        for index, line in enumerate(source.splitlines(), 1):
            if re.search(args.grep, line, re.I):
                print(json.dumps({"line": index, "text": line[:600]}, ensure_ascii=False))
    elif args.needle:
        position = 0
        for _ in range(min(8, max(1, args.limit))):
            position = source.find(args.needle, position)
            if position < 0:
                break
            print(json.dumps({"offset": position, "text": source[max(0, position - 180):position + 2400]}, ensure_ascii=False))
            position += len(args.needle)
    else:
        print(source[:16000])
else:
    files = list(ThreadPoolExecutor(max_workers=4).map(fetch, PATHS))
    sources = {path: source for path, source, _ in files}
    sections = re.findall(r'^\s*([A-Z_]+)\("([^"]+)"\)', sources["backups/domain/BackupSection.kt"], re.M)
    fields = {path.rsplit("/", 1)[-1][:-3]: re.findall(r'@SerialName\("([^"]+)"\)', source) for path, source in sources.items() if path.startswith("backups/data/model/")}
    version = int(re.search(r"versionCode\s*=\s*(\d+)", sources["app/build.gradle"]).group(1))
    require_source = len(sections) == 11 and version == 1033
    if not require_source:
        raise ValueError("Expected official backup structure was not found.")
    mime_types = dict(re.findall(r'put\("([^"]+)", "([^"]+)"\)', sources["coil/commonMain/kotlin/coil3/util/mimeTypes.kt"]))
    services = {}
    for name, identity in re.findall(r'^\s*([A-Z]+)\((\d+),', sources["scrobbling/common/domain/model/ScrobblerService.kt"], re.M):
        prefix, class_name = {"SHIKIMORI": ("shikimori", "Shikimori"), "ANILIST": ("anilist", "AniList"), "MAL": ("mal", "MAL"), "KITSU": ("kitsu", "Kitsu")}[name]
        source = sources[f"scrobbling/{prefix}/domain/{class_name}Scrobbler.kt"]
        services[identity] = {"name": name, "states": dict(re.findall(r'statuses\[ScrobblingStatus\.([A-Z_]+)\] = "([^"]+)"', source))}
    output = {"sourceRef": "v9.4.1", "commit": COMMIT, "parserCommit": PARSER_COMMIT, "coilVersion": "3.3.0", "coilCommit": COIL_COMMIT, "applicationId": "org.koitharu.kotatsu", "applicationVersionCode": version, "archiveEntries": [entry for _, entry in sections], "models": fields, "scrobblers": services, "knownMimeTypes": mime_types, "sourceCodeExecuted": False, "sources": [metadata for _, _, metadata in files]}
    (ROOT / "source-contract.json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sourceFiles": len(files), "entries": len(sections), "applicationVersion": version}))
