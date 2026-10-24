# 官方扩展的来源与格式证据

本页索引 17 项资料与平台扩展、13 项迁移导入器和 3 项译本所用的证据。能力与映射由[官方扩展设计](../../design/extensions/catalog.md)定义；以下结果只覆盖各记录的来源、版本、样本和执行范围。

## 资料与平台来源

| 来源         | 核对范围与记录                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| VNDB         | [身份、元数据及本人操作](#vndb)                                                                                         |
| Bangumi      | [对象粒度、关系、目录及本人操作](#bangumi)                                                                              |
| 月幕Galgame  | [公开合同](ymgal/public-contracts.md)、[字段映射](ymgal/metadata-mapping.md)                                            |
| MangaDex     | [公开与个人接口](mangadex/public-contracts.md)、[元数据与卷话](mangadex/metadata-mapping.md)                            |
| TMDB         | [公开资料及游客评分](tmdb/live-api.md)、[本人授权与私密列表](tmdb/account-api.md)、[字段映射](tmdb/metadata-mapping.md) |
| SteamGridDB  | [四类图片、分页、ICO 及资源格式](artwork-sources/live-api.md)                                                           |
| Steam        | [商店、名称查询、本人清单与时长](game-sources/live-api.md)                                                              |
| IGDB         | [对象粒度、公司与角色、关系和图片](game-sources/live-api.md)                                                            |
| MyAnimeList  | [官方授权、刷新、动画与小说记录](anime-platforms/live-api.md)                                                           |
| AniList      | [资料、本人记录、评分与完成联动](anime-platforms/live-api.md)                                                           |
| Google Books | [书目、系列、身份授权及限定书架写入](book-sources/live-api.md)                                                          |
| RanobeDB     | [作品、单册、发行与个人 API 边界](book-sources/live-api.md)                                                             |
| MangaUpdates | [资料、同账号续期、状态与评分写入](mangaupdates-anidb/live-api.md)                                                      |
| NDL Search   | [出版记录、ISBN、查询与书影边界](reference-sources/live-api.md)                                                         |
| itch.io      | [公开资料、只读授权、合集与撤销](reference-sources/live-api.md#itch)                                                    |
| Wikidata     | [类型、粒度、rank、关系与内容目录](reference-sources/live-api.md)                                                       |
| Fanart.tv    | [影片、剧集与季、人物组织及图片资源](artwork-sources/live-api.md)                                                       |

来源取舍依据见[逐站比较](source-selection/comparison.md)。这些记录中的来源响应、样本计数和失败是接口事实，不能用来推定全部来源数据或正式扩展均已验收。

## 迁移输入

| 导入器           | 证据                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| Goodreads        | [真实导出](goodreads-importer/live-export.md)                               |
| Vnite            | [真实备份](vnite-importer/live-backup.md)                                   |
| Playnite         | [真实备份与原生读取](playnite-importer/live-backup.md)                      |
| PotatoVN         | [固定源码与合成输入](potatovn-importer/source-and-fixtures.md)              |
| calibre          | [SQLite、OPF 与字段样本](calibre-importer/source-and-fixtures.md)           |
| Mihon／Tachiyomi | [两代 protobuf 与文件样本](mihon-importer/source-and-fixtures.md)           |
| NFO／ComicInfo   | [NFO、XSD、CBZ 与播放位置](nfo-comicinfo-importer/source-and-fixtures.md)   |
| LaunchBox        | [官方合同、Data XML 与 7z](launchbox-importer/source-and-fixtures.md)       |
| Koodo Reader     | [SQLite、JSON、CSV 与文件位置](koodo-importer/source-and-fixtures.md)       |
| Anx Reader       | [schema 7、导出与个人记录](anx-importer/source-and-fixtures.md)             |
| KOReader         | [随书数据、统计、位置与 PDF 几何](koreader-importer/source-and-fixtures.md) |
| Kotatsu          | [备份、分类、记录与下载索引](kotatsu-importer/source-and-fixtures.md)       |
| YACReader        | [三种输入、共享文件与页位](yacreader-importer/source-and-fixtures.md)       |

格式取舍见[逐项比较](importer-selection/comparison.md)。合成输入与真实导出分别标明，正式本体采用、目标环境和发行消费按[验收场景](../scenarios/sources.md)核对。

<a id="vndb"></a>

## VNDB

| 范围                 | 记录                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 对象、别名与实际署名 | [身份](vndb/identity.md)、[普通字段](vndb/common-metadata.md)                                                                       |
| 原版与角色范围       | [角色](vndb/character-scope.md)、[职员版本](vndb/editions.md)、[首发](vndb/release-scope.md)                                        |
| 职员、作品与配音     | [职责与备注](vndb/staff-roles.md)、[作品关系](vndb/work-relations.md)、[配音](vndb/voice-scope.md)、[语种备注](vndb/voice-notes.md) |
| 标签、图片与搜索     | [字段边界](vndb/tags-images-account-boundaries.md)、[设置与中文映射](vndb/settings-search-mapping.md)                               |
| 本人记录             | [公开合同](vndb/personal-records.md)、[授权只读](vndb/authenticated-read.md)、[限定读写及清理](vndb/account-roundtrip.md)           |

<a id="bangumi"></a>

## Bangumi

| 范围                 | 记录                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| 对象、版本与章节     | [作品粒度](bangumi/subject-scope.md)、[版本](bangumi/versions.md)                                               |
| 主体、岗位与反向查询 | [关系](bangumi/relations.md)、[职员路径](bangumi/staff-read-paths.md)                                           |
| 普通资料与目录       | [标签](bangumi/tags.md)、[字段](bangumi/ordinary-fields.md)、[目录成员](bangumi/directories.md)                 |
| 本人操作             | [接口与公开实现](bangumi/account-operations.md)、[授权收藏与实际取消结果](bangumi/authenticated-collections.md) |

<a id="languages"></a>

## 三项官方译本

[共享合同与代表性消息](language-extensions/contracts-and-fixtures.md)覆盖简体中文、繁体中文和日语的声明，以及英语基准。试件使用四语言各 37 条消息，实际执行 ICU 解析与格式化、Locale 匹配及生成的 TypeScript 调用检查；登记和恢复使用内存模型。

既有四语言目录的只读盘点用于估计文案转换工作量。全量译文、术语、语气、真实界面与各运行环境按[语言扩展场景](../scenarios/ui.md)验收。
