# Mihon / Tachiyomi 备份导入方案

Mihon／Tachiyomi 导入器迁入备份中的漫画、分部、分类、追踪记录、私人文字与阅读信息。输入基线为 Mihon v0.21.2 和 Mihon 仓库保留的 Tachiyomi v0.15.3；来源系列及字段结构共同识别，依据见[源码及合成核验](../../../verification/evidence/mihon-importer/source-and-fixtures.md)。

<a id="scope"></a>

## 职责与输入

| 能力       | 本项范围                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 输入       | 已核验两代标准 Backup 消息，gzip 包装或原始 protobuf；常用扩展名 .tachibk、.proto.gz                                             |
| 对象       | 所选书库条目，以及明确选入的库外阅读条目；漫画为默认范围，实际小说可以明确选择类型                                               |
| 迁入       | 原生新增与身份复用、选定来源资料、分类、本人追踪记录、准确对应的分部已读、私人笔记、标记章节与阅读概况、实际文件及可转换续读位置 |
| Webview    | 一个手动导入页面，包含输入与范围、采用选项、执行进度和实际结果                                                                   |
| 账号与联网 | 不提供本扩展账号连接、在线来源、下载、账号恢复或同步；本地资料可独立迁入，联网补充另外发起                                       |
| 不恢复     | Android 设置、插件与仓库、源 Cookie、追踪服务令牌、更新任务及源阅读器配置                                                        |

[官方备份说明](https://mihon.app/docs/guides/backups)明确：备份可含书库、章节、追踪、历史、分类与设置，但不含扩展程序、下载章节、本地来源章节或自定义封面。选择备份不代表媒体文件已经存在，远端章节 URL 不登记为本地文件。

Mihon [v0.21.0 发布说明](https://github.com/mihonapp/mihon/releases/tag/v0.21.0)已声明这是最后一个支持旧 Tachiyomi 备份的主要版本。本项固定自己的受支持格式系列，不把相同扩展名当成未来格式或所有分支都兼容的保证。

<a id="format"></a>

## 格式识别与只读解析

两代 [Backup](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/Backup.kt) 都没有可靠的导出应用版本头。界面要求选择已知来源系列，结构核对仍在执行前完成；文件后缀或存在某个新可选字段不能单独决定评分量尺。未知来源版本不能猜测版本相关字段。

1. 按 gzip 魔数识别包装，用成熟 gzip／protobuf 库解析已知字段；限制输入、解压后体积、消息深度、条目数和字符串长度。原始 protobuf 走相同结构校验。
2. source、url 等必需字段以及各消息的实际类型必须有效。文件整体损坏或结构不属于支持系列时，在正式写入前拒绝；独立行的业务值错误只影响相关对象或采用项。
3. 所有 Long 保留有符号 64 位精度，使用整数对象或十进制文本跨界，不能先转 JavaScript number。source=0 是本地来源，负 source ID 也可能有效；源显示名不是唯一键。
4. 遵守源码缺省值。BackupManga.favorite 缺省 true；read、bookmark 缺省 false。缺席数组可能是导出时未选章节、分类或追踪，不能拿空数组清空本地资料或记录。
5. 只读取已声明的数据投影。设置、来源设置和扩展仓库不反序列化为可执行对象，私密值不进入日志、报告或笔记。manga／chapter 的 memo 是来源扩展数据，不当作私人备注。

[旧模型](https://github.com/mihonapp/mihon/blob/49991d38d97e21746dcc9e5f2c177bccb94c93b3/app/src/main/java/eu/kanade/tachiyomi/data/backup/models/Backup.kt)中为更早备份保留的 brokenSources／brokenHistory 含非标准字段 0，不属于本项标准消息合同；当前 v0.15.3 正常导出的 sources=101、history=104 属于支持范围。legacy JSON、任意分支私有消息和备份查看器自定义 JSON 不作为输入系列。受影响内容明确报告，不假装已经恢复。

源文件始终只读。导入不调用源应用恢复、升级数据库或安装扩展，不把备份上传到在线查看器。正式制品随包提供解析依赖，运行时不从 CDN 下载执行代码。

<a id="identity"></a>

## 作品身份、粒度与普通资料

source＋url 标识本输入的来源记录，用于连接章节、历史、分类及同批次步骤。它不是 Kisaki 公开来源身份，不跨新批次推断同一作品。源名称、标题或 float 话号相同均不触发合并。

公开身份来自真实绝对链接或追踪记录中已经核实的 mediaId。MyAnimeList、AniList、Bangumi、MangaUpdates 等使用已确认来源合同；MangaUpdates 当前十进制 ID 通过精确整数转规范 base36，旧网页编号不能混用。libraryId 是用户列表行号，不能当作品 ID；mediaIdInt 与 mediaId 同时提供且互相矛盾时报告冲突。

相对来源 URL 不带域名。用户可以按明确的 source ID 提供来源站点基址，随后按实际 URL 和已知来源合同核对；不能从来源显示名或 64 位 ID 猜域名。没有本体来源合同的平台只保留有效普通外链，不新增伪造的 source 类型。所有链接与追踪身份均核对作品／卷的实际范围，不能把 Bangumi 单卷记录绑到系列 Work。

已有准确目标直接复用。缺少目标时，以选定 Comic／Novel 类型和合法来源资料形成 prepared 输入，经 ingest.add 新增；评分、状态与初始完成经 initial 同次提交。类型按实际范围选择，画册、工具书和其他范围外内容不强制归类；母体、单卷与版本归属不明时报告问题。

| 来源数据                                               | 用途与采用                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| title、author、artist、description                     | 有效名称与简介默认选入普通资料，供 prepared 新增或明确更新；作者、画师文字按下文主体规则处理 |
| genre                                                  | 选中时作为普通标签；不据此猜作品国别、原作语言或个人状态                                     |
| status                                                 | 作品发表状态，按已核实普通资料含义处理；不是用户阅读状态                                     |
| thumbnailUrl                                           | 选中保留来源封面时，合法可访问地址通过附件准备；无凭据可读条件时报告图片未迁入               |
| dateAdded、favoriteModifiedAt                          | 加入源书库的时间；不覆盖本体创建时间，也不成为首次阅读或完成日期                             |
| favorite                                               | 是否加入源书库；仅控制范围，不转换为本体“喜爱”                                               |
| viewer／viewer_flags、chapterFlags、excludedScanlators | 源界面与阅读设置，不混入资料、已读记录或本体完整阅读配置                                     |
| initialized、nextUpdate、memo                          | 源运行状态或扩展数据，不迁入本体字段                                                         |

作者／画师姓名不能确定 Person 或 Organization，也不证明原作或版本职责。本项不从这些字符串建立主体及署名关系。来源缺席不清除已有资料；已有值默认保留，明确选择补空或覆盖时才修改。

<a id="parts"></a>

## 章节、卷和已读

BackupChapter 是来源阅读列表中的一项，可能是一话、译组发布、拆分文件、整卷或本地归档。chapterNumber 是 float，缺少可靠卷范围；sourceOrder 是源列表顺序。字段名、最大话号、行数和文件后缀都不能证明真实 Part 结构。

分部依次按以下依据处理：

1. 已知公开 chapter／volume 身份先核对母体，再用本体全部身份准确对应。例如 MangaDex chapter UUID 须沿已确认聚合合同判断内容等价，不能只按同号合并不同发布。
2. 没有公开身份但已经明确内容种类与编号范围时，只在对应 Work／卷范围内使用本体已启用的种类、编号、标题和收录 matching；必须唯一、没有粒度或版本冲突。float 话号只能作为线索，不能还原丢失的编号文本。
3. 本地文件沿用户选择的本体文件识别方案解释卷、话和归属。明确的卷文件关联 ComicVolume 或 NovelVolume，不因 BackupChapter 名称而改为 ComicChapter。没有准确结构时仍可登记 Work 下的文件并阅读，不补造 Part。

新增真实卷话与收录通过本体完整操作完成，已有目录按准确身份或明确本地对应复用。文件排列和来源进度计数不补建目录，也不自动重排已有目录。

read 只采用到准确对应的完整 Part。已经确认内容等价的多份发布中，有一份完整已读即可形成该 Part 的 true；全部所选对应值为 false 时，只有明确采用已有个人值才清除本地标记。拆分片段不能单独标记整话已读；等价性未证明时不跨发布传播。章节列表缺席不能清除任何标记。

read=true 不提供分部完成日期、次数或活动；全部章节已读也不生成 Work 完成历史。未能对应的所选已读信息报告未迁入，用户选中的阅读概况笔记仍可保留其来源表达。

<a id="tracking"></a>

## 本人追踪记录、评分与完成事实

追踪数据是备份中的本人记录快照，不进行实时账户读取或回写。用户从本次实际出现的服务中明确选一个作为本人记录来源，再选择评分、当前状态与完成事实；默认不采用。某项没有所选服务记录时保持未知，不静默使用另一个服务，也不平均多个服务的评分。

[TrackerManager](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/track/TrackerManager.kt)中的编号必须连同服务解释，不能把数字状态共用为一个枚举。

| 服务 ID        | 本次可采用的当前状态编号         | 完成编号 | 评分存储与本体 0–100                                                                    |
| -------------- | -------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| 1 MyAnimeList  | 6→planned，1／7→active，3→onHold | 2        | 1–10 整数 ×10；0 未评分                                                                 |
| 2 AniList      | 5→planned，1／6→active，3→onHold | 2        | 已存 1–100，按整数规则采用；0 未评分，不再按界面星数换算                                |
| 3 Kitsu        | 5→planned，1→active，3→onHold    | 2        | Mihon 基线 2–20 整数 ×5；Tachiyomi 基线 1–10、半分步长 ×10；0 未评分，当前基线也识别 −1 |
| 4 Shikimori    | 5→planned，1／6→active，3→onHold | 2        | 1–10 整数 ×10；0 未评分                                                                 |
| 5 Bangumi      | 1→planned，3→active，4→onHold    | 2        | 1–10 整数 ×10；0 未评分                                                                 |
| 7 MangaUpdates | 1→planned，0→active，4→onHold    | 2        | 当前 1–10、一位小数 ×10；旧基线还允许 0.1–0.9 的存储值，照其量尺采用；0 未评分          |
| 10 Hikka       | 4→planned，0／5→active，2→onHold | 1        | 当前基线 1–10 整数 ×10；0 未评分                                                        |
| 11 MangaBaka   | 5→planned，1／6→active，3→onHold | 2        | 当前基线 1–100；0 未评分                                                                |
| 12 Comick      | 5→planned，1→active，3→onHold    | 2        | 当前基线 1–10 整数 ×10；0 未评分                                                        |

Tachiyomi 基线不包含服务 10–12。放弃、unfinished、considering 和未知状态没有本体同义状态，报告该状态未采用，保留已有当前状态和历史；其他所选字段独立处理。重读只设置 active，不凭该标记生成过去完成次数。

Kitsu 的两代量尺来自[当前实现](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/track/kitsu/Kitsu.kt)与[旧实现](https://github.com/mihonapp/mihon/blob/49991d38d97e21746dcc9e5f2c177bccb94c93b3/app/src/main/java/eu/kanade/tachiyomi/data/track/kitsu/Kitsu.kt)。数值 8 可能是 40 或 80 分，不能按数值大小自动判断。来源系列负责版本默认；已知跨版本恢复而量尺不明时，只要求明确该项实际量尺或跳过该评分，不更改其他记录。float 编码误差按源量尺容差还原，非法值不裁剪。

Komga（6）、Kavita（8）、Suwayomi（9）的记录属于自建服务或阅读服务上的系列进度，本项不将其“目前章节全读完”变成整部作品完成，也没有评分可采用；可用链接只作普通来源线索。追踪 private 不转换为不存在的 Work 私密字段，lastChapterRead／totalChapters 不转换成前 N 话的标记、目录或完成次数。

完成状态表示一次既有完成事实：仅在本地历史为空时初始化一条记录，并在明确采用当前状态时清除当前安排。有效 finishedReadingDate 可为该记录提供日期，也可以与当前 active 并存；同一快照的状态和日期只形成一条记录。当前状态与完成采用分别选择，不能只选历史就清除已有当前状态。

完成日期和历史时刻是毫秒时间值；0 为未知，不能导成 1970-01-01。按用户本次选择的来源日期时区取得 CalendarDate，默认本机时区；非法或矛盾日期报告该字段问题。startedReadingDate 不成为阅读活动或完成日期。Part 范围只采用对应布尔完成标记，不提升为 Work 评分、状态或历史。

同一 Work 在本次对应多条来源记录时，先合并兼容的本人事实；互相矛盾的评分或状态报告该项，不按处理顺序覆盖。一次完成快照不能因多个源站、格式或译组重复初始化。已有历史保留，空历史初始化带 expected.completionCount: 0；本项没有逐次完成明细，不提供将快照向非空历史反复追加的选项。

<a id="organization-notes"></a>

## 分类、笔记、整章书签与阅读概况

分类可选迁为手动 Collection。[创建器](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/backup/create/creators/MangaBackupCreator.kt)写入 manga.categories 的是分类 order，而非当前分类 id。联接必须按 order，重复 order 或未知引用报告整理未完成；不回退按 id、名称或数组下标。系统“未分类”没有真实用户分类记录，不创建同名合集。空选择不删除现有成员，同名合集不自动合并。

分类 order 仅表达分类的排列，不证明分类内条目的手动顺序。成员只采用准确对应 Entry；多条来源记录归同一个 Work 时只建立一次成员关系，Part 不能偷偷替换成母体成员。source flags 的排序／筛选设置不成为本地智能合集规则。genre 与私人分类分开，只有选定的 genre 才作为普通标签。

| 内容                  | 保存方式                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- |
| manga.notes           | 保留有意义 Markdown，创建关联作品的独立 Note；来源没有笔记时不造空 Note                     |
| chapter.bookmark      | 表示整章标记；用户选中“标记章节”时，按作品创建一篇 Note，列出来源章节标题、译组及有效链接   |
| history＋所选章节记录 | 用户选中“阅读概况”时，按作品创建一篇 Note，列出来源章节、已读状态和最后阅读时刻；未知值留空 |

笔记是用户明确选择保存的可读内容，不保存原始 protobuf、令牌、opaque memo 或机器恢复清单。正文只有真实来源信息，不追加格式精度警告。无法直接关联 Part 时，可在 Note 正文保留卷话上下文并关联已明确 Work；不能凭标题再找一个同名作品。来源图片链接不自动下载；明确选择可用本地正文资源时走附件操作，图片失败与文字结果分开。

[history 表](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/data/src/main/sqldelight/tachiyomi/data/history.sq)每章一行：read_at 是最后阅读时刻，read_duration 是累计毫秒；清空最后阅读时间后累计量仍可保留。本项不生成 comic_reading_activity，也不用“最后时间减累计时长”造区间。

用户可单独选择采用累计阅读时长。对本次所选书目实际提供的 history，按来源、书目与章节 URL 核对重复及冲突，以已声明模型的非负 readDuration 毫秒归集到准确 Work；64 位值与求和都先检查本体安全整数范围。同一来源键只计一次，相同章节编号或同名译组不能替代来源身份。多个来源书目归属同一 Work 时，先合计所选独立计时范围，再按[共同附加时长规则](../../domains/records.md#duration)执行一次绝对值采用，不能逐章覆盖。history 整体缺席时不推断为零。

新作品所选总量进入 initial 的附加时长；已有作品默认保留，明确采用时扣除本次已保存实际活动量后设置 additional_duration_ms。它计入累计阅读时间，但不产生日期图表、最近使用或完成事实。累计量不再写入阅读概况 Note；该笔记仅承担用户选定的章节与最后阅读信息。

整章 bookmark 没有页内坐标，不以 lastPageRead 或章首页补造点位 Annotation。所选笔记、标记章节与概况在同批次只执行未完成步骤；另建批次可明确再次创建，不覆盖已有笔记，也不按正文合并不同事实。

<a id="files"></a>

## 实际文件与续读位置

用户可明确提供已经复制到持久目录的本地来源根，以及按 source ID 指定的下载来源目录。备份不含这些字节；缺文件只影响文件和位置，不阻止独立作品、记录、分类或文字迁入。Android content:// 不作为桌面文件路径。

本地 source=0 的 manga.url 是作品目录名，chapter.url 是该目录下的成员相对路径。按已核实布局逐层解析并核对真实路径，不允许越过选定根或经符号链接逃逸。来源目录可能同名、章节路径可能重复；存在多个实际文件候选时报告冲突，不挑最新或最大文件。

下载按已知来源目录、经过源规则处理的作品标题和章节名寻找。[当前 DownloadProvider](https://github.com/mihonapp/mihon/blob/9612d955db3165e1578fdf9ff19ca9b7762c4a46/app/src/main/java/eu/kanade/tachiyomi/data/download/DownloadProvider.kt)包含译组、UTF-8 字节截断、非 ASCII 转换和 URL 摘要后缀，以及明确的历史命名变体；旧基线使用自己的命名规则。实现完整重现对应家族的候选集合，只在唯一候选上采用，不开展模糊递归搜索。仅有 BackupSource.name 无法还原包含语言的 source.toString() 目录，因此来源目录由用户明确指定。

真实文件通过 holdings 的完整操作核验并登记，按明确 Part 或 Work 关联。图片目录、CBZ 与本体已支持的实际归档可登记；源支持的其他格式仍须由本体实际读取能力验证。没有准确 Part 不阻止 Work 文件可读；文件首选默认保持，来源最近阅读不自动设为首选。

lastPageRead 是零基物理页面索引，与 reader 的双页、阅读方向和屏幕翻页数不同。转换先确定同一实际文件与来源加载路径，再找到具体页面成员：

| 来源读取方式                             | 来源页序及本体转换                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 下载的图片目录                           | DownloadManager 对图片文件名排序；按该页序将索引转为实际 memberPath                                  |
| 本地图片目录                             | DirectoryPageLoader 使用不区分大小写的自然数字比较；转为实际 memberPath                              |
| ZIP／CBZ 等图片归档                      | 对真实图片成员按来源自然比较排序，保留完整成员路径；转为实际 memberPath                              |
| 源 EPUB 的图片页列表或无法核实的其他顺序 | 不把图片列表索引当作 EPUB spine、CFI 或 PDF 固有页码；登记文件独立完成，无法同义转换的位置报告未迁入 |

来源排序与本体默认排序不同不妨碍采用具体 memberPath；重名成员、大小写／自然数比较并列、过滤图片差异等导致页序不唯一时，不猜测旧页位。不能把数值越界截到末页，不能把 64 位值先舍入。页内没有偏移信息，采用实际页面的起点 point=(0,0)，不虚构选区或高亮。

缺省 lastPageRead=0 也可能表示从未阅读。只有大于零的合法索引，或该章存在有效最后阅读时刻，才迁入位置；单独 read=true 或 bookmark=true 不证明访问过首页。缺少历史不阻止已经明确的大于零位置采用。

位置保存到这份实际文件，初始进度为 null，之后由 Kana 计算；不自动打开文件、修改当前状态、创建活动、设置首选或生成完成记录。已有位置默认保留，用户明确采用后才更新。同一文件有互相矛盾的来源位置时报告冲突，不取最大页。源没有历史字节信息，本项不声称证明文件从未修改，也不给正式位置增加 hash 或版本字段。

<a id="interface"></a>

## 页面与执行

一个页面选择备份、来源系列、书库／库外范围、类型及本次采用。默认范围为书库中的漫画，库外条目另选。来源普通资料默认选中，无须资料方案；标题、来源、分类、范围和结果各占一列，窄宽度横向滚动。

genre 标签、分类合集、本人追踪记录、分部已读、累计时长、私人笔记、标记章节、阅读概况、文件与续读分别选择，默认关闭；来源普通字段沿共同默认选中。开启相关内容后显示追踪服务、日期时区、来源基址、下载根或文件识别方案。已有值默认保留，未选内容和正常缺席不产生问题提示。

开始后固定本次输入及配置，预先核对格式、记录身份和同一目标的矛盾事实。随后使用原生新增／复用，再按完整操作采用所选普通资料、现有个人值、初始历史、分部标记、文件位置、Note 和分类。异步资料／附件准备不放入数据库事务，不调用源扩展取得章节正文。

结果记录新增、更新、未变化、部分完成、跳过、失败及未迁入原因。每个完整操作独立提交，取消保留已完成部分，关闭页面不取消任务。批次与步骤保存在本扩展私有数据，清理任务报告不影响继续批次。

新建与继续批次沿[共同规则](../importers.md#repeat)执行。同批次不重复已完成 Note，未知提交先核对；另建批次可明确追加。本项只有完成快照，不能向非空完成历史追加。

<a id="implementation"></a>

## 源码职责与验收

    src/
    ├── node/
    │   ├── entry.ts
    │   ├── input/
    │   │   ├── backup.ts
    │   │   ├── schema.ts
    │   │   ├── files.ts
    │   │   └── validation.ts
    │   ├── mapping/
    │   │   ├── identity.ts
    │   │   ├── metadata.ts
    │   │   ├── parts.ts
    │   │   ├── tracking.ts
    │   │   ├── organization.ts
    │   │   ├── notes.ts
    │   │   └── positions.ts
    │   ├── import.ts
    │   └── ipc.ts
    ├── webview/
    │   ├── entry.tsx
    │   ├── page.tsx
    │   ├── selection/selection.tsx
    │   ├── results/results.tsx
    │   └── styles.css
    └── shared/
        ├── contracts.ts
        └── validation.ts

input 负责源格式家族、只读字节与文件布局；mapping 解释来源事实和本次对应，不持有正式本体数据；positions 属于本扩展的索引转换，不能把 Mihon 私有页码加入 Kana 的公开位置。import 组织 SDK 完整操作、任务与实际结果，IPC 只转发，Webview 不自行读取备份和写库。

正式验收覆盖两代实际导出、适用的选项组合、规范消息全部边界与资源预算、已声明来源的准确身份与多语版本、卷话与片段、跨版本追踪快照、真实日期时区、完整下载文件名算法与自然比较器、大小写／符号链接／归档冲突、实际图片识别及 Kana 跳转、Note 和合集写入、initial／空历史基线、已有值保护、取消与未知结果，以及六个桌面目标的独立扩展制品。
