# 导入器名单调查与已确认取舍

调查日期：2026-10-15。对象为调整前目录中的全部 15 个导入器，表中序号沿用调查时的 19–33。[当前目录](../../../design/extensions/catalog.md#catalog)已采用本轮确认的 13 个导入器；正式目录为 17 个资料或平台来源、13 个导入器、3 个译本，共 33 项。

官方维护 13 个迁移导入器，NFO／ComicInfo 合为一项。下文按实际输入格式和迁移价值说明选择依据。

[结构化核验记录](2026-10-15-research.json)包含固定版本、提交、公开源文件地址、请求结果、内容校验值及逐项判断。具体字段合同和交付验收仍由[各导入器的逐项设计](../../../design/extensions/importers.md#catalog)完成。

## 判断方法与证据边界

导入器的价值主要是带走用户已经积累的整理、记录和文字。重新扫描文件、重新取得作品资料或接入另一网站，通常不能恢复这些内容。因此，同样处理 EPUB 的两个阅读器、同样管理漫画的两个软件，不等于可以互相替代。

本次从四个方面判断：适用的 ACGN 用户场景；重新扫描无法恢复的内容；公开格式能否离线解释和限定支持范围；官方需要长期承担的解析、映射与验证工作。小说以轻小说使用场景评估，泛图书规模本身不构成保留理由。

- 核对了 12 个开源项目的备份或导出实现、数据模型和相关写入逻辑。其中 11 项固定到当时的正式发布版本；Kotatsu 固定到已归档仓库的提交，不冒充正式发行版。
- Goodreads 使用其官方公开 CSV 样例与官方帮助站的版主答复；LaunchBox 使用公开插件合同、官方论坛版主的备份说明及用户贴出的 XML 实例。用户实例只证明该实例的结构，不提升为厂商格式规范。
- NFO 与 ComicInfo 分别查阅 Kodi 官方说明和 Anansi 的格式文档。ComicInfo 2.1 仍标为 Draft；不能将草案叫作已稳定发布的格式。
- 未取得这 15 项的用户私有备份，也未进行完整导入实现或端到端迁移测试。源码能确认字段和导出行为，不能证明某份实际备份完整、所有历史版本兼容，或所有字段都已有本体对应。
- GitHub stars、仓库建立时间和公开发布记录只用作可见度与维护历史的辅助证据，不等同于用户数、活跃用户数或可靠性测量。没有据此宣称某软件“不稳定”。

## 全部十五项对照

### 游戏管理

| 原序号与导入器   | 核验基线与实际输入                                                                        | 用户数据与迁移价值                                                                                         | 需要承担的具体边界                                                                                                                         | 取舍         |
| ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 20. Vnite        | v4.14.0；`vnite-database-*.zip` 中的 PouchDB 数据目录，备份前关闭数据库                   | 游戏资料、外部身份、个人评分与状态、合集、起止时间记录、图文回忆、图片和本地启动设置；游戏经历的内容较完整 | 不是普通条目 JSON；各数据库和附件要一起解释。`multiple` 只有状态含义，不能据此捏造完成次数；总量和区间不能重复计时                         | 保留         |
| 21. Playnite     | 10.62；ZIP 内 `library`、可选 `libraryfiles`，或完整一致的库副本；集合采用 LiteDB         | 用户整理、标签和分类、评分、完成状态、累计游玩时长、文件与启动动作；覆盖一般游戏库迁出                     | `Playtime` 为秒；`PlayCount` 是游玩次数。完成状态是可自定义的独立对象，不能只按一组固定名称硬编码；插件记录另有格式                        | 保留         |
| 22. PotatoVN     | v1.10.2.0；`.pvnExport.zip` 导出游戏、库、分类、staff 和图片；另有版本化单目录元数据备份  | 面向 Galgame 的整理、源身份、角色与职员资料、评论、评分、游玩记录和本地配置                                | `PlayedTime` 为按日分钟汇总，`TotalPlayTime` 由其求和；两者不能叠加，也不能生成精确活动。全库导出与单游戏 `GameMetaBackup` 版本 2 分别识别 | 保留         |
| 26. LunaBox      | v1.13.3；数据库备份 ZIP 内 `database/` 为 DuckDB 导出，另含封面；全量包还带其他目录和配置 | 起止时间及秒级时长、个人评价、路线与章节进度文字、分类、图片和本地配置，都有真实迁移价值                   | 需独立解释 DuckDB 导出 CSV 与 schema，不能把它当 SQLite 或执行包内 SQL；区分资料评分与个人评价；全量备份与存档 ZIP 不是同一种输入          | 移出官方清单 |
| 27. ReinaManager | v0.32.0；`VACUUM INTO` 产生 `reina_manager_*.db`；自定义封面另有备份                      | 来源资料与用户覆盖、个人评分和评价、合集、真实会话、汇总统计及本地配置                                     | 当前会话 `duration` 存储四舍五入的分钟，起止时间另存；不能当秒读，也不能把超过区间长度的取整时长强塞进活动。数据库与封面备份需明确配套     | 移出官方清单 |
| 28. LaunchBox    | 公开插件文档标注 13.5；官方备份说明与公开平台 XML 实例，未验证当前所有版本                | 平台库、游戏整理、列表、个人星级、完成标记、累计时长和可转换的启动配置；保留主机与模拟器游戏库的迁出入口   | Data 备份不含 ROM、模拟器或图片。公开 API 字段不等于完整 XML schema；不能把所有 `Notes` 当私人笔记，不能恢复或执行脚本                     | 保留         |

Vnite 的[备份实现](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/features/database/services/backup.ts)、[游戏模型](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/types/models/game.ts)和[数据库管理](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/core/database/BaseDBManager.ts)相互核对；Playnite 的[备份](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Backup.cs)、[集合存储](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Database/Collections/ItemCollection.cs)与[游戏模型](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/PlayniteSDK/Models/Game.cs)确认了其输入并非 SQLite。PotatoVN 的[导出任务](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager/Models/BgTasks/ExportTask.cs)和[游戏模型](https://github.com/GoldenPotato137/PotatoVN/blob/d877bbe166e5b71d6520784f9d268e6df7eb4487/GalgameManager.WinApp.Base/Models/Galgame.cs)确认了内容与日级时长。

LunaBox 的[备份](https://github.com/Saramanda9988/LunaBox/blob/36413a2878111cf0951d69f9c39644b08728b75b/internal/service/backup_service.go)、[游玩会话](https://github.com/Saramanda9988/LunaBox/blob/36413a2878111cf0951d69f9c39644b08728b75b/internal/models/play_session.go)和[个人评价](https://github.com/Saramanda9988/LunaBox/blob/36413a2878111cf0951d69f9c39644b08728b75b/internal/models/game_review.go)说明它具备值得迁出的内容。ReinaManager 的[数据库备份](https://github.com/huoshen80/ReinaManager/blob/9c1bf8679d356828bc2e359583f4d139b73ef821/src-tauri/src/backup/database.rs)与[会话写入](https://github.com/huoshen80/ReinaManager/blob/9c1bf8679d356828bc2e359583f4d139b73ef821/src-tauri/src/game/monitor/session.rs)说明其输入可读，但分钟取整与本体精确活动之间有明确差异。移出这两项属于官方投入取舍，不是技术不可行的结论。

LaunchBox 的[IGame 合同](https://pluginapi.launchbox-app.com/html/b33d2055-e2be-3f42-12c6-adbc5668f454.htm)、[版主对备份范围的说明](https://forums.launchbox-app.com/topic/70213-rename-roms-from-cryptic-names-to-same-as-the-gamesdb/)和[公开 XML 实例](https://forums.launchbox-app.com/topic/82395-adding-games-manually-to-a-platforms-xml/)分别提供字段、目录和样例证据。保留的理由是模拟器与主机收藏场景；Playnite 能管理相似游戏，不意味着已经带走 LaunchBox 用户的列表和记录。

### 阅读器与书库

| 原序号与导入器   | 核验基线与实际输入                                                                   | 用户数据与迁移价值                                                                     | 需要承担的具体边界                                                                                                             | 取舍 |
| ---------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 19. Goodreads    | 官方公开 CSV 样例与帮助站导出说明；样例仅证明官方导入列                              | 轻小说、漫画的书架、评分、评价与明确阅读事实；可作为没有本地电子书的用户记录入口       | 样例是官方导入列说明，不能据此宣称现行完整导出已验证；书籍版本、单册和整部作品先对应。CSV 不提供电子书，也不能重建逐次阅读区间 | 保留 |
| 23. calibre      | v9.16.0；一致的 `metadata.db` 与书库目录，或明确范围的 OPF/书目导出                  | 本地书库组织、作者、系列序号、标识、标签、评分，以及数据库中的阅读位置、书签与高亮备注 | 完整书库与单纯书目导出的能力不同；标注按书籍、格式、用户划分。自定义列、书目 comments、作者资料笔记和用户高亮分别解释          | 保留 |
| 29. Koodo Reader | v2.4.6；ZIP 内 `config/*.db`、配置 JSON、书籍与封面；另有笔记 JSON 导出              | 书架、收藏、书签、笔记、高亮和阅读位置；笔记导出带书名、作者、文件 MD5 与原笔记字段    | 当前备份数据库为 SQLite；不能沿用“全是 JSON”的假设。CFI、range、page、percentage 语义不同；纯笔记导出不代表全书库迁移          | 保留 |
| 30. Anx Reader   | v1.14.0；`app_database.db`，当前 schema 版本 7；明确的书库文件与 MD/TXT/CSV 笔记导出 | 书库分组、个人评分、摘录、用户批注、书签和 CFI 阅读位置；用户文字无法由 EPUB 扫描恢复  | 笔记 CSV 不带 CFI，数据库才有；阅读时长在写入时按书和日期合并，不能因模型存在 `startedAt` 就当逐次会话                         | 保留 |
| 31. KOReader     | v2026.07.1；exporter 的 JSON 与 `.sdr/metadata.*.lua` 数据；另核对统计库实现         | 电子墨水设备等场景中的高亮、笔记、书签与阅读状态；官方 JSON 可直接导出文字             | JSON 与 sidecar 保存范围不同；sidecar 只解析数据，不执行 Lua。XPointer、重排页码与本体位置不能直接等同；统计库是另一输入范围   | 保留 |

Goodreads 的[官方 CSV 样例](https://www.goodreads.com/assets/sample_export.csv)在本次请求中实际返回 200，含 Title、Author、ISBN、My Rating、Date Read、Shelves、Bookshelves、My Review 等列，但没有 Book Id、Exclusive Shelf、Read Count。2026-10-17 的[实际导出核对](../goodreads-importer/live-export.md)进一步确认该文件用于官方导入格式说明，不能作为当前真实导出格式的证明；空书架没有导出按钮。其[帮助站版主答复](https://help.goodreads.com/s/question/0D5ar00000XtvJ3CAJ/how-do-i-download-my-library-as-a-csv-file)仍指向导出功能。旧帮助文章地址本次返回 404，浏览工具直接打开问答页只得到加载外壳，版主内容来自检索收录；这些结果不能解释为导出功能已撤销。随后用户允许添加测试书目，已完成[当前 23 列真实导出核验](../goodreads-importer/live-export.md)，并发现四分之一星、在读计数与日期精度丢失。全部测试数据已清理；当前对象与采用范围已在[完整接入方案](../../../design/extensions/importers/goodreads.md)确认。

calibre 的[数据库结构](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/resources/metadata_sqlite.sql)包含 `last_read_positions` 和 `annotations`；[标注逻辑](https://github.com/kovidgoyal/calibre/blob/61c4027d2bfe737e0177e09952ee4942042a5892/src/calibre/db/annotations.py)区分书签标题、高亮文字与用户备注。因此仅以 OPF 书目信息评估 calibre 会漏掉个人积累。

Koodo 的[备份](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/backup.ts)、[SQLite 转换](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/sqlUtil.ts)和[笔记导出](https://github.com/koodo-reader/koodo-reader/blob/1fd0cc7f151916447d396e0c8a2c036180992cab/src/utils/file/export.ts)可以对应到实际输入。Anx 的[数据库](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/dao/database.dart)、[笔记导出](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/service/notes/export_notes.dart)和[阅读时长写入](https://github.com/Anxcye/anx-reader/blob/356b7183e8463e7c60d84a72502d0055e55a19fd/lib/dao/reading_time.dart)分别确认了 schema、文字导出和按日累计的事实。不能以两者都读取 EPUB 为理由把它们合并成同一种源格式。

KOReader 的[JSON exporter](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/plugins/exporter.koplugin/target/json.lua)、[sidecar 管理](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/frontend/docsettings.lua)和[阅读统计](https://github.com/koreader/koreader/blob/9192014d8bd82a91dc1012473be0f238dedfdb54/plugins/statistics.koplugin/main.lua)是三种不同范围。统计库还区分原始页记录与重排页数的投影视图；本次只确认存在这些结构，不预先承诺将全部统计恢复成本体活动。

### 漫画管理与通用资料文件

| 原序号与导入器               | 核验基线与实际输入                                                                                           | 用户数据与迁移价值                                                                           | 需要承担的具体边界                                                                                                                        | 取舍       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 24. Mihon / Tachiyomi Backup | Mihon v0.21.2；按 gzip 标记识别后解析 protobuf Backup，保留明确验证的 Tachiyomi 备份系列                     | 书库、分类、章节已读与书签、漫画笔记、来源链接和阅读历史；在线漫画使用习惯直接相关           | 备份不含下载章节与自定义封面；`favorite` 不能未经语义核对就当本体特别喜爱。历史的最近阅读时间与累计阅读时长不是逐次区间；分支字段分别识别 | 保留       |
| 25. NFO                      | Kodi 的 movie、tvshow、episodedetails；ComicInfo 1.0/2.0，2.1 草案单独判断                                   | 动画与漫画用户随文件保存的资料、外部身份、署名和适用个人记录；跨软件输入，职责较窄           | 两种格式不是同一个 schema；ComicInfo `Volume` 不是日漫单行本卷号。Kodi 片长、播放计数和续播位置有不同含义；输入根元素本身不证明内容是动画 | 保留并更名 |
| 32. Kotatsu                  | 已归档仓库提交 `34f6e523`；ZIP 内 index、history、categories、favourites、bookmarks、statistics 等 JSON 数组 | 旧漫画书库、分类、来源链接、阅读进度与书签；软件停止维护后仍需要迁出这些积累                 | 归档状态不等于备份不可读。当前核验不是发行版兼容测试；在线源标识、章节 ID 和远端页位不能冒充本体身份或本地位置                            | 保留       |
| 33. YACReader                | 10.4.0；`.yacreaderlibrary/library.ydb` 或正式库备份，SQLite；另有部分资料 `.ydb` 导出                       | 本地漫画文件对应、用户修改资料、评分、已读、当前页、书签、标签与阅读列表；与在线漫画备份不同 | “Export comics info” 只选出部分 comic_info 行，且不包含完整库关系；不能拿它替代全库备份。文件页序、多个库内部 ID 与缺失图片分别核对       | 保留       |

Mihon 的[官方备份说明](https://mihon.app/docs/guides/backups)与[Backup 模型](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/Backup.kt)、[漫画字段](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/BackupManga.kt)相互印证。不过，[v0.21.0 发布说明](https://github.com/mihonapp/mihon/releases/tag/v0.21.0)已宣布这是兼容 Tachiyomi `.tachibk` 的最后一个大版本。一个导入器可以保留多个明确格式系列；不能把“当前兼容”写成未来永久共用格式，也不要求用户先用新版 Mihon 恢复旧备份。

Kodi 的[电影](https://kodi.wiki/view/NFO_files/Movies)、[剧集](https://kodi.wiki/view/NFO_files/TV_shows)和[分集 NFO](https://kodi.wiki/view/NFO_files/Episodes)分别定义资料与使用字段。Anansi 的[ComicInfo 字段说明](https://anansi-project.github.io/docs/comicinfo/documentation)将 Volume 解释为美漫的出版批次或系列卷次；[2.0 schema](https://anansi-project.github.io/docs/comicinfo/schemas/v2.0)与[2.1 草案](https://anansi-project.github.io/docs/comicinfo/schemas/v2.1)分别列出字段。已将名称改为 **NFO / ComicInfo Importer**，使名称与已声明的两个输入范围相符；仍由一个扩展提供文件资料迁入，解析与映射各自独立。

Kotatsu 的[归档仓库](https://github.com/KotatsuApp/Kotatsu)、[备份实现](https://github.com/KotatsuApp/Kotatsu/blob/34f6e5232bf7f0bcdf8f3fbddb986697518e82a4/app/src/main/kotlin/org/koitharu/kotatsu/backups/data/BackupRepository.kt)和[备份成员名称](https://github.com/KotatsuApp/Kotatsu/blob/34f6e5232bf7f0bcdf8f3fbddb986697518e82a4/app/src/main/kotlin/org/koitharu/kotatsu/backups/domain/BackupSection.kt)支持离线迁出的判断。YACReader 的[数据库创建、导出与备份实现](https://github.com/YACReader/yacreader/blob/28f92f4d8bdbb7170f6002e00bed7503356eea03/YACReaderLibrary/db/data_base_management.cpp)则明确区分全库备份与按条件选出的资料导出；读取 ComicInfo 无法恢复其全部阅读列表和本地状态。

## 为什么只移出两项

LunaBox、ReinaManager 都在维护，且有用户数据值得迁移。相近的中文 Galgame 管理场景中，本轮优先承担 Vnite 和 PotatoVN 两个入口：前者保留图文回忆与游戏使用记录，后者提供较完整的 Galgame 整理与角色、职员资料。另保留 Playnite 和 LaunchBox，分别覆盖一般游戏库与主机、模拟器收藏的入口。

公开仓库建立时间分别为 PotatoVN 2023-03、Vnite 2024-07、ReinaManager 2025-01、LunaBox 2025-12。查询时 stars 分别为 1462、1363、703、376。这些只是辅助信号：它们支持前两项拥有更长的公开维护历史与更高的公开可见度，不能推导真实用户人数或逐版本稳定性。LunaBox 的 DuckDB 导出和 ReinaManager 的独立 schema、会话口径仍需要分别维护，不能因功能相近便复用一套解析合同。

因此本轮将 LunaBox、ReinaManager 移出官方清单，减少同一细分场景中持续维护的独立格式。这一选择有明确代价：这两个软件的用户不能直接迁入其专属记录；没有声称 Vnite、PotatoVN 或重新扫描能替他们恢复。它们可以有独立第三方实现，但不自动列为以后必须交付的官方项目。

其余项仍保留，是因为调查发现了具体的个人积累或不同使用入口。尤其不建议为了凑到七项而删除 Koodo、Anx、KOReader、YACReader、Kotatsu；已有资料来源与文件扫描并不覆盖这些迁移。调查时 Goodreads 和 LaunchBox 的公开格式证据没有开源项目完整，不能据此判为不可用或没有价值。Goodreads 随后已经补齐当前真实 CSV 夹具与语义核验；LaunchBox 仍需在逐项设计时补真实输入。

## 保留之后仍需逐项定稿

名单保留不等于已承诺任意年代、任意分支、任意导出都能完整恢复。每项按[已有导入合同](../../../design/extensions/importers.md)明确支持的格式与版本，并用真实格式夹具验证；正式完成状态仍见[设计进度](../../../implementation/status.md#design)。

共同需要守住的语义包括：单册和整部作品的区别；来源公开评分与用户私人评分的区别；书库成员与特别喜爱的区别；完成次数与打开、游玩次数的区别；精确区间与按日、累计量的区别；同文件位置与阅读器专用坐标的区别。没有本体对应的内容如实报告，不为保留一个导入器而扩充来源专用模型或制造活动、完成记录。
