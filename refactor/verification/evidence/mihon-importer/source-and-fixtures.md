# Mihon / Tachiyomi 备份源码与合成核验

2026-10-17，第 23 项导入器。用户明确没有可供核验的实际备份，采用固定公开源码与合成样本。[完整方案](../../../design/extensions/importers/mihon.md)已确认；本记录不表示正式扩展、Android 导出或本体迁入已经验收。

<a id="baseline"></a>

## 固定基线

| 来源      | 固定版本与提交                                                       | 核验范围                                                                 |
| --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Mihon     | v0.21.2，9612d955db3165e1578fdf9ff19ca9b7762c4a46；发布于 2026-10-13 | 消息字段、创建与恢复、追踪服务、阅读历史、下载布局和页序                 |
| Tachiyomi | Mihon 仓库保留的 v0.15.3，49991d38d97e21746dcc9e5f2c177bccb94c93b3   | 标准 protobuf 系列、旧评分存储、文件布局与页序；不据此补造原项目发布日期 |

读取 75 个固定版本源码文件，共 88 次公开请求：86 次 HTTP 200，2 次 HTTP 404。一个 404 来自原 Tachiyomi latest-release API，另一个是探索旧 LocalSource 文件位置时的错误候选；随后从固定源码树定位到实际路径并读通。请求时间、URL、字节数和 SHA-256 记录在 [verification JSON](2026-10-17-verification.json)。两个固定版本的 tag、tag object 和 commit 分开记录，不以漂移分支作为证据。

官方[备份说明](https://mihon.app/docs/guides/backups)确认可选数据及不含下载文件、扩展和自定义封面。[v0.21.0 发布说明](https://github.com/mihonapp/mihon/releases/tag/v0.21.0)声明后续主要版本将结束旧 Tachiyomi 格式支持。因此本项只声明已核验家族，不把后缀当作长期格式保证。

<a id="facts"></a>

## 已核对的关键事实

| 源码事实                                                        | 方案影响                                               | 主要依据                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gzip 魔数与原始 protobuf 均可读取；没有可靠版本头               | 包装识别和来源系列选择分开；不猜 Kitsu 评分量尺        | [BackupDecoder](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/BackupDecoder.kt)                                                                                                                                                                                         |
| favorite 缺省 true，含义是书库成员                              | 缺省值不能误用 protobuf 的普通 false；不映射本体喜爱   | [BackupManga](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/BackupManga.kt)                                                                                                                                                                                      |
| categories 存 category.order，系统未分类被过滤                  | 不按 category.id、名称或数组位置联接；不补造未分类合集 | [MangaBackupCreator](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/create/creators/MangaBackupCreator.kt)                                                                                                                                                               |
| read、bookmark、lastPageRead 是不同字段；chapterNumber 是 float | 分开已读、整章标记和续读；不按同号生成等价话           | [BackupChapter](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/BackupChapter.kt)                                                                                                                                                                                  |
| reader 写 page.index；duration 使用毫秒；history 每章唯一       | 续读为零基索引；最后时间与累计量不还原活动区间         | [ReaderViewModel](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/ui/reader/ReaderViewModel.kt)、[history.sq](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/data/src/main/sqldelight/tachiyomi/data/history.sq)                                     |
| libraryId 与 mediaId 分开，旧 mediaIdInt 有读取优先级           | 公开资源 ID 不使用列表行号；互相矛盾时拒绝该身份       | [BackupTracking](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/BackupTracking.kt)                                                                                                                                                                                |
| 当前 Kitsu 用 2–20，旧 Kitsu 用 1–10；两代 AniList 都存百分制   | 同样字段值需要版本语义；界面星数不能再乘一次           | [当前 Kitsu](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/track/kitsu/Kitsu.kt)、[旧 Kitsu](https://github.com/mihonapp/mihon/blob/49991d38d97e21746dcc9e5f2c177bccb94c93b3/app/src/main/java/eu/kanade/tachiyomi/data/track/kitsu/Kitsu.kt)                                  |
| notes 按 Markdown 展示；memo 为不透明扩展数据                   | 前者创建 Note，后者不作为私人正文                      | [MangaNotesDisplay](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/presentation/manga/components/MangaNotesDisplay.kt)                                                                                                                                                                         |
| 本地 chapter.url 是作品目录与成员路径                           | 可在用户明确的持久根解析，不使用 Android content URI   | [LocalSource](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/source-local/src/main/kotlin/tachiyomi/source/local/LocalSource.kt)                                                                                                                                                                                           |
| 下载目录 sortedBy(name)，本地目录和归档使用自然比较             | 先恢复来源页序，再转 memberPath；不能统一套一个排序器  | [DownloadManager](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/download/DownloadManager.kt)、[ArchivePageLoader](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/ui/reader/loader/ArchivePageLoader.kt) |

[选定字段声明](source-fields.json)从两代 14 个模型文件提取 123 处字段声明，排除同文件中另行定义的 BrokenBackupHistory／BrokenBackupSource。验证脚本逐模型核对所选 schema 字段的编号；没有声称为所有可选消息提供完整恢复。

<a id="fixtures"></a>

## 合成样本与结果

[fixture-data.json](fixture-data.json)包含当前三条来源记录、旧版一条记录、正负 64 位极值与本地来源、相同显示名、库外已读条目、分类 order／id 不同、同号不同发布、半话、Markdown、整章标记、累计历史和多个追踪器。

[build-fixture.mjs](build-fixture.mjs)使用固定 protobufjs 8.8.1 与 long 5.3.2 生成标准消息字节，再通过 Node gzip 包装。另行加入一个不解析的可选字段，用合成标记检查私密投影排除；该字段不声称复现 Kotlin 的 PreferenceValue 序列化。两条人工固定的最小 wire 示例独立验证 source=0、favorite 的 true 缺省与显式 false。

9 个输入夹具包括原始 protobuf、当前 gzip、旧版 gzip、坏 CRC gzip、拒绝用 legacy JSON、实际 CBZ 和三个下载目录 PNG。CBZ 与图片目录包含 1.png、2.png、10.png，可观察自然排序与文件名排序的页位差异。PNG 为生成的一像素 RGBA 图，脚本核对实际解压后的扫描行；它不是用户漫画。

[verify.mjs](verify.mjs)已通过 **97 项检查**，详见 [synthetic-results.json](synthetic-results.json)。全部输入文件在读取前后与 [manifest](fixture-manifest.json) 的 SHA-256 一致，未写源文件。检查涵盖字段编号、gzip／raw 一致、必填字段、64 位精度、版本评分、状态零值、分类歧义、旧新追踪 ID 冲突、历史字段、实际归档页序、缺省零页、越界值和路径边界。

脚本的 8 MiB 体积限制仅用于这组小夹具，不代替正式扩展对实际规模、层级、条目数和解压资源的完整预算。自然比较探针只覆盖简单 ASCII 数字文件名，不是来源比较器的完整替代品。设计中的整套文件命名变体、符号链接检查、真实图片探测、身份匹配和本体采用仍须实现。

累计时长采用随四类作品的[共同附加时长合同](../../../design/domains/records.md#duration)统一修订：有效 readDuration 按选定来源范围归集到 Work，采用附加绝对值；不再将其写入阅读概况 Note，也不构造活动。既有 97 项源格式检查不变，另见跨 Koodo／Mihon 的[33 项累计采用模型检查](../koodo-importer/duration-results.json)，它不替代正式记录写入与统计验收。

<a id="reproduce"></a>

## 复现

在仓库根使用现有 Node 24 与 fflate 0.8.3：

```powershell
node refactor/verification/evidence/mihon-importer/build-fixture.mjs node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
node refactor/verification/evidence/mihon-importer/verify.mjs node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
```

构建脚本只覆盖本证据目录中自己生成的合成夹具，不读取用户备份。验证脚本通过固定公开 URL 取得两份依赖，先核对 SHA-256，再在隔离 JavaScript 上下文加载；输入数据不会执行，也不会上传。没有修改仓库 package.json、lockfile 或运行时源码。正式扩展须随制品打包依赖，不能沿用研究脚本的网络加载方式。

当前记录证明选定源码合同及样本解析，不证明 Android 实际导出、Kotlin 编码器互通、完整文件适配、正式 SDK 采用或 Kana 跳转。实际备份、版本间恢复、全部声明服务与文件边界、用户界面、取消及六平台制品，继续按方案的正式验收执行。
