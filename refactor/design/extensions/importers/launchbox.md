# LaunchBox Importer 接入方案

LaunchBox 导入器读取 Windows Data XML 或官方备份中的明确资料，迁入游戏、本人记录、列表、图片与启动配置。输入依据官方说明、公开 API 合同及实际 XML 结构，见[格式核验](../../../verification/evidence/launchbox-importer/source-and-fixtures.md)。API 文档标注的 13.5 不作为磁盘 schema 或已验证应用版本。

<a id="scope"></a>

## 用途与输入

提供本地手动迁移页面，迁入用户选择的 ACGN 游戏。平台名、文件夹和 Genre 不自动决定范围；新作品以合法来源资料通过 prepared 新增。导入器不注册资料 provider、不登录源账号、不恢复 LaunchBox 或运行插件，也不持续扫描和同步；联网补充另行发起。

支持源程序关闭后取得的一致 Data 目录副本，以及官方 Create Data Backup 生成的 .7z 数据归档。官方备份只保存 Data 内的库数据与设置，不含游戏、模拟器、Images、视频或源程序。另行提供的 LaunchBox 根和本地内容根用于资源解析，不能把备份解包目录当作源程序根。

识别 Data/Platforms/_.xml 内的 LaunchBox 根、Game 行与明确关系行；平台定义为 Data/Platforms.xml，播放列表为 Data/Playlists/_.xml，模拟器为 Data/Emulators.xml。归档允许直接以 Data 内容为根，或有唯一 Data 外层；不会在多份备份、多个 Data 根或嵌套压缩包中自行择一。没有所选平台游戏文件时拒绝本次输入；缺少可选列表或模拟器文件只影响对应范围。

本项声明的是已列明字段的 Windows Data XML 系列。旧单体 LaunchBox.xml、Android 导出、公开 Metadata.xml 全站缓存、其他插件私有库和任意 XML 不是本输入。新版 XML 中未改变含义的字段仍按各自结构读取，未知字段不清空目标；未知的必要结构在写入前拒绝。不能依据文件名或用户填写的版本号接受结构不同的文件。

Progress 采用 13.22 起的文字合同；14.0 起的 JSONL 游玩历史及存档管理沿[范围限制](#newer-data)处理。版本与格式依据见[核验记录](../../../verification/evidence/launchbox-importer/source-and-fixtures.md)。

<a id="reading"></a>

## 读取与本次关联

XML 使用成熟解析器，按 BOM 与声明处理 UTF-8、UTF-16，禁用 DTD、外部实体和外部 schema 加载。字段名区分大小写，不把 API 属性名直接套为 XML 名：Game 的 ID、DatabaseID、Emulator，与 AdditionalApplication 的 Id、GameID、EmulatorId，以及 PlaylistGame 的 GameId、LaunchBoxDbId 分别解释。

每份 XML 先完成结构检查，再处理所选行。重复标量、无效类型和相互冲突的关系不能按最后出现值覆盖。损坏的 XML 文件整体失败；合法文件内独立可选字段无效只影响该字段。限制文件大小、节点深度与数量、正文长度、归档成员数和展开量；错误保留位置及原因，不打印完整 XML、命令内容、私人文字或完整行。

源 Game GUID 在本次 Data 集合内关联附加项、自定义字段和列表成员，不写为公开身份。同一 GUID 在多平台文件重复出现时，重复且相同的游戏行只处理一次；内容矛盾的重复项报告冲突，不能按扫描顺序择一。缺失或无效 GUID 的行不能参与依赖 GUID 的迁入，源名称不作为其代用键。不同 GUID 恰有同名不自动合并。

本批次从源 GUID 对应到实际 GameRef，并随步骤进度保留。附加项经 GameID、播放列表经 GameId 关联；失联记录不按 GameTitle、文件名或数组位置猜目标。LaunchBoxDbId 可作为核对线索，不替代真实成员关系；未迁入游戏的成员报告未迁入。

归档只读所需成员，不恢复源目录、不修改 Data、不装载 DLL 或执行附带脚本。原生归档程序由扩展自身固定交付，使用参数数组、shell: false、隐藏窗口和有界管道；不能执行归档里的程序。无论后端使用流还是受限工作目录，都须拒绝穿越、盘符、UNC、链接和重名成员，禁止将临时文件登记为持有内容。

<a id="identity"></a>

## 作品身份与来源资料

DatabaseID 是 LaunchBox Games Database 的公开游戏记录号，规范身份为 source=launchbox、sourceId=game/<正整数>。内部 ID、PlaylistId、模拟器 ID 和 Public DatabaseID 的含义不同。公开页面按平台区分版本，例如同一标题的 Windows 与 PlayStation 2 各有记录；这种发行粒度必须先核对，不能把端口、重制、合集和原作仅按标题合成一个本体游戏。

多个已明确属于同一作品的来源身份可以对应一个 Game，并保留各自真实身份。不同平台记录并不自动合并，也不自动声明为不同作品；由原生定位确认实际作品范围。已经绑定的全部身份共同指向唯一对象时复用；冲突沿共同规则报告，不回退按名称新建。

本项只将已明确的 Steam 游戏入口转为 steam / app/{appid}，例如 ApplicationPath 中严格符合已知格式的 steam://rungameid/{appid} 或 steam://run/{appid}。appid 须在正 uint32 范围内，非 Steam 快捷方式的长 gameid 不能作 appid；输入无法证明游戏范围时不绑定该身份，其他合法资料仍可迁入。不从 Source 名称或任意数字猜身份。GogAppId 等未定义映射的值可作为选定补充文字保存。

没有本地对应时，以真实名称、合法公开身份及可准确映射的来源字段形成 prepared 输入，经 ingest.add 新增。初始评分、喜爱、当前安排与完成记录通过 initial 同次提交。缺少准确主体及参与依据时不生成角色、人物、组织或关系，联网补充由用户另行选择。

已有作品直接复用，本次迁移按所选内容补充本地数据。新建须先确认 ACGN 内容与独立作品范围。Developer、Publisher、Series、CloneOf 和模拟器名称只作为来源背景，主体及作品关系须经过各自正式的身份与范围核对。

<a id="metadata"></a>

## 可选来源资料

来源普通资料默认选中，新对象直接采用有效字段；已有对象默认保留，明确选择补空或覆盖后才更新。缺失或空白不清除已有资料。

| 来源内容                                                                           | 对应                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Title、SortTitle                                                                   | 主名称与排序名称；排序名称不自动成为别名                                                         |
| Notes                                                                              | 作品简介，按实际普通文字保留换行；它常由资料下载填入，不默认称为私人备注                         |
| ReleaseDate                                                                        | 只有确属目标作品首次发行范围时采用；平台移植、区域发行或版本日期保留为补充资料文字               |
| WikipediaURL、VideoUrl                                                             | 经过正常 URL 校验的普通外链；视频链接不生成音声／动画作品                                        |
| DateAdded                                                                          | 选择加入日期时按明确偏移或已知源时区取日历日期；无时区且不能解释时不猜日界                       |
| Genre、PlayMode、Platform                                                          | 可选普通标签；已知分号分隔的列表按实际项目解析，平台使用完整本地名称                             |
| Developer、Publisher、Series、Region、Version、Rating、ReleaseType、Source、Status | 用户选择“补充资料笔记”后保留名称、字段和值，不将年龄分级 Rating 或来源说明 Status 解释为本人评价 |

资料日期按真实值与已知精度处理，不把有效 1 月 1 日当异常，也不把平台版发行日向原作借用。DateModified、LastPlayedDate 和文件修改时间不作为作品发行日期、笔记创作日期或完成日期。技术 created_at / updated_at 使用本次实际写入时间。

Notes 本身没有“由本人撰写”的保证。用户确实用它写了私人文字时，可以单独选择“将 Notes 保留为笔记”；创建一篇关联游戏的普通 Note，不额外用相同正文覆盖作品简介，除非两个选项均明确选择。空内容不建笔记，另建批次可以明确新建，同批次继续跳过已完成步骤，不按正文合并不同事实。

CustomField 通过 GameID 关联，Name / Value 是文字数据而非类型声明。页面按本次出现的字段列出“忽略、文字笔记、标签、手动分组”用途，默认忽略。用户选择后保留字段名与对应值；文本不执行为公式或脚本，不根据名字含 rating、completed、hours 或日期就生成私人记录。分组按明确源字段及完整值组织，不把任意分号一律拆为多个标签。选择完整列表语义时才采用分号分隔。

<a id="personal"></a>

## 星级、喜爱与完成事实

StarRatingFloat 是本人星级，0 表示未评分，合法正值在五分尺度上换为 0–100 整数，按 ×20 后四舍五入；例如 3.75 星为 75 分。该字段存在时不再从旧整数 StarRating 覆盖或补救非法值。仅有已声明旧整数 StarRating 的输入按同样五分尺度解释。未知、未评分和非法值分别处理，不钳制越界值。

CommunityStarRating、CommunityStarRatingTotalVotes 和依显示设置混用两者的 CommunityOrLocalStarRating 不作为本人分数。Favorite 的 true / false 对应特别喜爱；Hide、Broken、Installed、Portable 和 Missing* 都不是私人状态、内容敏感标记或文件存在性的证据。

13.22 之前 Completed=true 表示至少完成过一次，选择后只能为空历史初始化一条未知日期完成记录；false 不删除已有历史。新格式中的 Progress 优先，旧 Completed 即便仍存在，也不能覆盖进度判断。Progress 缺失时可以使用明确旧字段；Progress 存在但为空、无效或未配置时，不借旧字段绕过选择。

Progress 采用完整 Category / Value 文字，官方允许自定义类别与值，因此页面按本次不同值配置两项独立含义：

| 配置     | 可选含义                               | 默认   |
| -------- | -------------------------------------- | ------ |
| 当前安排 | 不采用、无当前安排、计划、进行中、搁置 | 不采用 |
| 完成事实 | 不采用、至少完成过一次                 | 不采用 |

页面可显示对官方原始值的建议，例如 Not Started / Want to Play 对应计划，Active / In Progress 对应进行中，Active / Paused 对应搁置，Done / Beaten、Completed、Mastered 可表明至少完成过一次；建议不自动提交。Done / Dropped 不能只因属于 Done 就当通关，Active / Continuous 也不推断完成次数。用户在本次表中一次设置同值含义，不逐游戏弹出配对向导。

官方旧 Completed 升级为 Done / Mastered，证明新版这一个状态不能反推完整收集、100% 成就、通关次数或时间。自动进度规则可能依赖时长、成就和未游玩天数，本项采用已保存的当前值，不复制或重跑这些规则。

新对象个人值随 initial 提交；已有个人值默认保留，只有明确选中采用的字段才更新。初始化已有对象空历史遵守 expected.completionCount: 0，不为已有历史追加“至少一次”。PlayCount 是启动／游玩次数，不是通关次数；LastPlayedDate 不是通关日期，二者均不生成完成历史。

<a id="duration"></a>

## 累计时长与逐次历史

Game.PlayTime 按来源主游戏记录的累计秒数读取，非负整数精确转为毫秒；非法值或溢出只影响该时长。选项明确叫“采用来源主记录累计时长”，不声称核实了整组版本的独立总和。

新游戏把所选主记录累计值写为附加时长。已有游戏默认保留；明确采用时按[共同绝对值规则](../importers.md#duration)扣除本体已保存的实际活动量后设置 additional_duration_ms，不在旧附加值上重复相加；较小来源总量不能删除本体活动或产生负数。

AdditionalApplication.PlayTime 是附加项自己的秒数。当前公开合同没有充分说明各时期 Game.PlayTime 与所有附加版本值的聚合／同步关系，而且附加项也可能是安装程序或助手。本项不求和、不取最大、不把主记录和各版本都导为活动；用户选择“版本游玩概况”时，可把附加版本名称、原始时长及最近游玩日期保存为文字 Note，并明确这部分没有另计入总时长。

多个源主游戏最终对应同一个本体作品时，个人值相容者只采用一份；评分、安排或累计值不同的字段报告冲突，不按最后处理者覆盖、不任意求和。各条独立可转换启动配置仍可迁入。不能把各平台都显示十小时理解为已经游玩二十小时。

<a id="newer-data"></a>

### PlaySessions 与存档管理的输入范围

14.0 起的逐次游玩历史保存在 Data/PlaySessions/<年份>.jsonl；[官方人员说明](https://forums.launchbox-app.com/topic/94244-launchbox-for-windows-140-released/page/3/)描述每行包含游戏、起止时间和有效秒数。

JSONL 游玩明细不在本项输入合同内：字段形状、时间编码、游戏／版本键及与累计总量的覆盖关系缺少完整格式依据，见[格式核验](../../../verification/evidence/launchbox-importer/source-and-fixtures.md)。检测到该目录时，数据范围说明“逐次游玩历史未迁入”；所选 XML 主记录累计仍可独立采用，不由 LastPlayedDate 与总时长反推区间。

新版 Save Management 的配置、存档位置、状态槽位和备份不在旧 API/XML 证据内。本项不从 Main/AdditionalApplication 的路径推断存档目录，也不把源备份恢复为本体历史；遇到实际保存管理数据时说明未迁入。图片、说明书、视频、成就缓存、排行榜、源主题及账号凭据也不扩大为其他媒体作品或本体设置。

<a id="collections"></a>

## 标签与手动播放列表

Genre、PlayMode、Platform 和已选自定义字段按本次用途成为普通标签，沿共同 nameKey 规则复用。Series 文字可以显式选为标签或保留笔记，不直接新建系列实体。

手动播放列表迁为手动 Collection。用户选择新建或明确使用已有合集；同名不自动合并。名称取 Name，NestedName 是侧栏显示名，SortTitle 是排序文字，均不作为合集身份。列表自身 Notes 可作为所选合集说明，不混成每个成员的私人笔记。

成员通过本次 GameId 对应建立；同一目标只成为一次成员。明确手动排序且 ManualOrder 为有效非负序号时保留顺序，同值按原成员顺序保持稳定；-1 代表未提供人工位置，不当第一个成员。非手动排序不宣称保存了源界面的动态排序，按本次成员顺序追加，已有成员顺序保持。

AutoPopulate=true 的列表由过滤规则决定，XML 中出现的成员不保证是完整当前快照。本项不把缓存成员冒充完整合集、不复制源过滤器或运行源插件；用户需要保留该集合时，可在 LaunchBox 中转为手动快照后再提供 Data。所选自动列表明确报告未迁入，其他手动列表继续。

平台本身作为标签；源 Platform Categories / Parents 负责侧栏层级和多父显示，不自动转成本体嵌套合集。其层级没有本项承诺的同义采用，不把一个平台或列表的多处展示复制为多个作品或多份成员。若用户选择平台分组，可以按本次实际 Game.Platform 成员建立普通平面合集，仍使用新建／明确复用规则。

<a id="images"></a>

## 来源图片

图片采用默认关闭。官方数据备份没有图片，须另行提供实际 Images 或对应资源根。Data/Platforms.xml 中的 PlatformFolder 以 Platform / MediaType / FolderPath 确定平台媒体位置；没有覆盖时使用源程序根下的正常平台／图片类型目录，不能把公开 Metadata/Platforms.xml 缓存当作本地文件设置。

FrontImagePath、BackgroundImagePath 等是公开运行时 API 属性，不据此假设平台 XML 保存了对应路径。图片主要通过平台、媒体类别和文件名关联。只采用已经明确归属的源字节：

| 来源图片类型        | 本体用途 |
| ------------------- | -------- |
| Box - Front         | 当前主图 |
| Fanart - Background | 背景图   |
| Clear Logo          | 标题标志 |
| 明确游戏 Icon       | 游戏图标 |

Back、3D Box、Cart、Disc、Banner、Screenshot 等不自动冒充以上用途；平台、分类或列表的默认图不补作游戏自己的图片。来源没有图标文件时不从可执行文件提取替代。

按[官方开发者说明](https://forums.launchbox-app.com/topic/90566-question-about-metadata-in-database-versus-xml-files/)核对完整 ROM basename、合法化的完整标题，以及标题附数字或本地 GUID 后缀的已知格式。不去掉括号、地区、版本、冠词或标点模糊匹配另一作品。同平台多个同名游戏必须能由 GUID 或明确 ROM 名消除歧义，否则只报告图片未采用。

来源可能保存多个地区和同类图片，Data 不足以证明当前显示哪一张。本次可以设定地区优先序；同级仍有多个有效候选时，通过正常选图入口明确选择，后台不按枚举顺序择图或等待逐行选择。未选定图片时保留已有值，不阻止游戏与个人记录迁入。

根映射只作用于结构化路径。解析后的真实文件必须在用户授权资源根内，符号链接不能扩大范围。所选字节由 attachments 正式接收，不保留对备份临时目录的依赖。不存在、无法解码、归属冲突与未提供资源分别报告。

<a id="local"></a>

## 本地内容与启动配置

本地内容及启动配置默认关闭，导入时只保存，不启动游戏、模拟器、链接或脚本。LaunchBox 的 Installed 和 Broken 不代替实际文件检查；ApplicationPath 可能是 EXE、ROM、快捷方式或 URI，不能一律取父目录登记整个平台 ROM 文件夹为该游戏的专属目录。

明确的单游戏 RootFolder 或用户选定实际游戏目录，经核验后可登记 GameDirectory；平台的 Game 文件夹是公共导入位置，不能批量当作每个游戏的持有目录。单文件 ROM 可以形成明确启动目标而没有伪造的专属目录。CUE 的轨道、现有 M3U 的光盘等依赖保持原文件结构，不搬动、改写或从临时备份中登记内容。

源相对路径以真实 LaunchBox 程序根解释，允许其实际使用的 ..\\ 关系，但展开后仍须在所选本地根范围内；不能只因合法来源含 .. 就拒绝，也不能因此越过授权根。用户给出根映射后再核验文件，不全文替换命令、参数与 URL；UNC 路径按实际网络位置检查。

| 来源启动方式                                   | 本项采用                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| 普通文件或快捷方式，无参数                     | 核验实际目标后保存文件启动；不解析快捷方式后另选未知程序                      |
| 普通程序，带参数                               | Windows 上构成同义完整命令，正确保留参数和实际工作目录语义                    |
| 明确 URI                                       | 保存普通链接启动，保留协议，导入时不打开                                      |
| 明确模拟器与普通 ROM                           | 从游戏、模拟器及精确匹配的平台行确定 EXE、ROM 和参数，再生成同义 Windows 配置 |
| 手动选择的附加游戏版本或光盘                   | 作为所属 Game 的另一 LocalConfig；不创建另一份评分或完成记录                  |
| 自动前后置程序、安装器、补丁器、文档、启动脚本 | 不作为游戏启动配置，也不还原成本体回调                                        |

附加版本由实际行和用户本次选择确定，不能根据 AutoRunBefore=false / AutoRunAfter=false 就判定它是游戏版本。主 ApplicationPath 常同时作为一条附加版本保存；同一次请求对完全相同的已解析启动设置只登记一次。版本、地区和光盘名称保留；多版本各自配置，来源默认版本不覆盖本体已有首选，也不把扫描第一项设置为首选。

模拟器按 Game.Emulator 或附加项 EmulatorId 精确关联，不能按 Title 或平台默认值替代缺失的关联。参数使用[官方三层优先规则](https://feedback.launchbox-app.com/en/help/articles/3038328-setting-up-an-emulator-manually)：有效游戏自定义参数、匹配的平台行参数、模拟器默认参数；第一个适用的非空层取代后面的层，不把三层拼起来。多条同平台配置无法唯一解释时，不随意取第一行。

明确展开 %romfile%、%platform%、%gameid%、%romlocation%、%romfilename%、%romextension%、%romlocation_noquotes% 和 %noromfile%。%romfile% 依 NoQuotes / FileNameWithoutExtensionAndPath 决定路径形态；缺少该占位且没有 %noromfile% 时才按来源规则追加 ROM，NoSpace 控制前置空格。源参数是 Windows 程序参数，不能原样拼入 shell 后改变百分号、引号或命令元字符含义。

%launchboxorbigboxexepath%、未知源运行变量、AutoExtract、动态生成 M3U、内建 DOSBox / ScummVM、源模拟器插件和依赖脚本的启动不在可直接转换范围：它们依赖源程序运行时，不能用看似相同的 EXE 命令冒充等价。已经存在且由模拟器直接读取的实际 M3U 可按普通 ROM 处理；不会为导入临时生成另一份光盘列表。源辅助脚本与设置只有在确实不影响主目标独立启动时，才允许保存主目标并列明未迁入的辅助行为。

监测和计时采用本体正常配置合同。已登记真实专属目录时可使用本体从目录创建配置的正常监测默认；模拟器进程和公共 ROM 目录不代表某个游戏的独立运行，不能静默用它们填监测目标。其余明确启动目标可以作为未完成配置保存，后续在正常配置编辑中补全。源启动屏幕、进程／窗口跟踪、AutoHotkey 暂停与退出、时间阈值和轮询参数不转换成本体计时语义。

<a id="interface"></a>

## 页面、默认值与执行

页面依次包含输入、游戏与数据范围、进度含义、自定义字段用途、可选资源根与本地配置、执行和结果。来源普通资料默认选中，导入直接使用本页映射；结果可另行联网补充。用户在本页完成必要配置后直接执行所选范围。

评分与喜爱、旧 Completed 完成事实、主记录累计时长、标签和手动列表默认选中，作用于新作品；新版 Progress 须完成含义配置后采用。已有个人值与累计时长、Notes 私人文字、自定义字段、补充资料笔记、版本概况、需要选择的图片及本地设置分别选择，默认关闭；来源普通字段沿共同默认选中。未选范围不逐项告警，所选内容未完成时准确报告。

列表一字段一列，名称、平台、来源身份、目标及结果分别成列，窄宽度水平滚动。来源作品、附加版本和播放列表分别保持实际对象关系，不能在第一列叠放一组副信息来隐藏必要字段。

prepared 新增与 initial 同次提交，alreadyExists 按已有对象选项处理。其他资料、时长、笔记、合集、附件和本地配置使用各自完整操作；每步结果与 GUID 对应按[批次合同](../importers.md#repeat)保存。取消保留已提交事实，继续不重复已完成项，未知提交先核对；关闭页面不取消任务。

<a id="organization"></a>

## 实现归属与验收

使用自己的独立扩展工程，不从 Playnite、PotatoVN 或其他导入器复制其私人合同：

```text
src/
├── node/
│   ├── entry.ts
│   ├── input/
│   │   ├── reader.ts
│   │   ├── archives.ts
│   │   ├── xml.ts
│   │   └── types.ts
│   ├── mapping/
│   │   ├── identities.ts
│   │   ├── records.ts
│   │   ├── collections.ts
│   │   ├── images.ts
│   │   └── launching.ts
│   ├── import/
│   │   ├── coordinator.ts
│   │   └── operations.ts
│   └── ipc.ts
├── webview/
│   ├── index.html
│   ├── entry.tsx
│   ├── import-page.tsx
│   └── styles.css
└── shared/
    ├── contracts.ts
    └── validation.ts
```

input 只读实际格式和路径；mapping 负责来源字段含义，不写本体。import 通过公开 query、ingest、library、records、collections、attachments、holdings 和游戏配置操作组织任务；实际 API 名称沿各领域既有合同，不新建 ImportProvider、私有写库入口或资料爬虫。页面通过本扩展 IPC 提交一次请求和查看结果；任务寿命归 Node。

格式依据与样本范围见[核验记录](../../../verification/evidence/launchbox-importer/source-and-fixtures.md)。格式验收覆盖明示 XML、关系键、标量存在性、UTF-16、.7z 成员读取、身份范围、评分／进度、累计换算、手动顺序、路径边界、图片歧义和参数优先。

完整迁移验收覆盖真实 Data 与官方备份、所有声明的序列化分支、真实图片选择与附件复制、Windows 参数与工作目录等价、各目标平台的归档组件、离线 prepared／initial 新增、原批次继续与已有资料采用、已有值保护、空历史条件、重复来源冲突、取消和错误、独立 .kisx 安装及宿主运行。不能把尚未核实的 JSONL、存档管理、动态列表和源运行时启动宣称为已支持。
