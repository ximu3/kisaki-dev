# Kotatsu 导入器：源码与合成核验

对应第 29 项[完整方案](../../../design/extensions/importers/kotatsu.md)，完整方案已确认。用户明确没有实际备份并选择合成样本；本目录不包含用户漫画、账号资料或真实备份。

## 来源与基线

[官方仓库](https://github.com/KotatsuApp/Kotatsu)已归档并宣布停止支持。本项使用实际可读取的 v9.4.1 tag，提交 06a0b5829b8d5f214d60d5011d66ec1ccbd5630e，app_id=org.koitharu.kotatsu、versionCode=1033。读取时 GitHub latest release API 返回 404，因此不以该端点宣称最新发行；tag 与固定源码是格式依据。

该版本绑定 parsers 提交 4d1e521aef7e4d9f41c65adda5e274509e93807c，以及 Coil 3.3.0 提交 1731511f0c12ef556db7822a91b6ea03fa3f95a1。[source-contract.json](source-contract.json) 记录 81 个来源文件的 URL、状态、时间、字节数和 SHA-256，并从固定代码提取 11 个 ZIP 成员名、序列化字段名、追踪服务编号与状态词、已知 MIME 表。

| 固定来源                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 已核实内容                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [BackupRepository](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/backups/data/BackupRepository.kt)、[BackupSection](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/backups/domain/BackupSection.kt)                                                                                                                                                                                | 11 个根成员、数组包络、嵌套漫画与可选字段；允许非有限浮点字面量；不包含漫画下载字节                  |
| [MangaBackup](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/backups/data/model/MangaBackup.kt)、[实体映射](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/core/db/entity/EntityMapping.kt)                                                                                                                                                                                         | 有符号 Long、书目公众评分、无简介、别名与作者换行分隔；书签外层标签仍属于漫画                        |
| [追踪服务枚举](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/scrobbling/common/domain/model/ScrobblerService.kt)、[AniList 评分](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/scrobbling/anilist/data/ScoreFormat.kt)                                                                                                                                                            | 1 Shikimori、2 AniList、3 MAL、4 Kitsu，各自原始状态词；四个 Repository 已把私人评分归一化到 0–1     |
| [StatsCollector](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/stats/domain/StatsCollector.kt)、[StatsEntity](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/stats/data/StatsEntity.kt)、[ReaderActivity](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/reader/ui/ReaderActivity.kt)                | 毫秒起点与 now−startedAt、暂停移除状态、manga_id＋started_at 主键；有效行可以解释成已保存阅读区间    |
| [ReaderViewModel](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/reader/ui/ReaderViewModel.kt)、[MarkAsReadUseCase](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/history/domain/MarkAsReadUseCase.kt)                                                                                                                                                                             | 百分比按当前分支与已知章节计算，标为已读写入末章末页和 1；不提供独立逐次整作完成历史                 |
| [FavouritesDao](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/favourites/data/FavouritesDao.kt)、[FavouritesRepository](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/favourites/domain/FavouritesRepository.kt)                                                                                                                                                                  | 按分类加入书库；类别顺序、隐藏与自动追踪；成员 sort_key／pinned 不提供当前手动排序语义               |
| [MangaIndex](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/local/data/MangaIndex.kt)、[LocalMangaParser](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/local/data/input/LocalMangaParser.kt)、[DownloadWorker](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/download/ui/worker/DownloadWorker.kt) | 单个／分章 CBZ、index.json、原始章 ID 和有限 entries 模式、从 0 编入文件名的下载页号、逐章实际页读取 |
| [AlphanumComparator](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/core/util/AlphanumComparator.kt)、[Coil MIME 表](https://github.com/coil-kt/coil/blob/1731511f0c12ef556db7822a91b6ea03fa3f95a1/coil-core/src/commonMain/kotlin/coil3/util/mimeTypes.kt)、[WebtoonImageView](https://github.com/KotatsuApp/Kotatsu/blob/06a0b5829b8d5f214d60d5011d66ec1ccbd5630e/app/src/main/kotlin/org/koitharu/kotatsu/reader/ui/pager/webtoon/WebtoonImageView.kt)         | UTF-16、数字段长度、大小写／前导零；固定 MIME 与 Android 扩展边界；scroll 依赖屏幕宽度的像素含义     |

这些是来源事实。是否迁为喜爱、作品完成、普通合集、活动或附加时长，按接入方案中的明确采用规则解释，不把来源命名本身当作本体语义。

## 实际合成输入

[build-fixture.py](build-fixture.py) 生成 22 个输入文件，完整字节数和摘要见 [fixture-manifest.json](fixture-manifest.json)：

- 一个包含全部 11 分段的备份 ZIP，以及缺少 statistics 的部分副本，用于区分缺失与已知空。
- 五部有嵌套资料的漫画，含超过 JavaScript 安全范围的正编号、负章编号、同名异源、外层书签标签、库外历史及未附媒体。
- 四种追踪服务、相互不同的私人状态与评分、未知服务、null 状态和 NaN 值；公众评分与私人评分刻意不同。
- 三个分类，包含隐藏及空分类，多分类成员与没有生效手动语义的 sort_key／pinned。
- 两条真实形状的连续区间、未知起点但有效时长、零时长、无嵌套书目的孤立统计。
- 带 index.json 的单个 CBZ、目录索引与分章 CBZ，以及实际 PNG 封面和页面字节；图像复用此前的合成测试素材，没有下载漫画页面。
- 缺页、重复页、任意正则模式、逃逸文件路径、排序与 MIME 边界，以及错误应用／版本、重复 ZIP 成员／JSON 键、非 ZIP、超限数据等拒绝样本。

备份中的示例来源名和 example.invalid 地址只用于合成身份，不向这些地址发起请求。媒体索引保留真实字段结构，书签使用来源实际 file+zip URI 形态。源码写入器将 pageIndex 原样作为文件名页号，因此样本从 0000 开始；显示第 1 页对应零基 0。

## 已执行检查

[verify.py](verify.py) 读取真实 ZIP、JSON 和图片字节，结果见 [synthetic-results.json](synthetic-results.json)：115 项通过、0 项失败，全部 22 个输入文件保持不变。

覆盖八个固定源码模型的实际字段、来源扩展 JSON 与精确 64 位编号、未打开的设置分段、缺失分段、重复键／归档和预算；嵌套身份、标签与换行；四种服务状态、0–1 评分、空历史完成与未知日期；分类成员及稳定整理；毫秒区间、零／无效／未来时间、统计主键冲突、累计及 T−A；实际索引、分章文件、封面和 memberPath、任意正则拒绝、缺页／重页、非零像素偏移、来源 MIME 集合和 UTF-16 排序。

同一正源编号 9007199254740993 与负章节编号 -9007199254740993 均按精确整数处理。来源允许的 NaN 只被识别为非有限值，不成为有效私人评分；字符串中的 NaN／Infinity 没有被替换。JSON 解析使用 Python 标准库的整数／Decimal 和常量钩子，是格式探针，不等于证明 Node 正式制品已完成。

统计探针保留来源毫秒单位：123456 与 60000 汇总为 183456，活动终点按已核实的连续区间定义计算；未知起点不生成活动，但可以在明确的累计模式下采用有效时长。同一记录没有同时贡献活动和附加量。公众发表状态和阅读百分比不触发整作完成。

文件定位探针将当前有限 entries 模式解释为字面前缀及四位页号，不运行用户正则表达式。先核对原始编码与全部实际成员，再形成完整 memberPath；固定图片表之外的 Android MIME 回退没有被猜测。没有源视图尺寸时，非零 scroll 没有被规范化到一个虚假的页内点。

## 复核与限制

```powershell
python refactor/verification/evidence/kotatsu-importer/source-probe.py
python refactor/verification/evidence/kotatsu-importer/build-fixture.py
python refactor/verification/evidence/kotatsu-importer/verify.py
```

需要 Python 标准库和 Pillow。源码探针只读取固定源文件文本，没有执行 Android 应用、Kotlin 代码、来源爬虫、来源正则或下载任务。样本没有真实用户备份、操作系统私有目录、实际账户、源恢复操作或本体写入。

真实官方备份、实际源阅读器行为、大型输入、浏览器／Kana 跳转、图片附件保存、任务取消及独立扩展制品仍须按[正式验收](../../../design/extensions/importers/kotatsu.md#implementation)验证。合成格式与采用模型的成功不替代这些证据，未知分支或旧输入也不因结构相似获得兼容承诺。
