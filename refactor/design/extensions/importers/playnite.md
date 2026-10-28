# Playnite Importer 接入方案

Playnite 导入器迁入备份或一致书库副本中的游戏、本人记录、分类与启动配置。输入依据 Playnite 10.62 固定源码与实际备份，见[核验记录](../../../verification/evidence/playnite-importer/live-backup.md)。新作品使用已知来源资料，联网补充由用户另外发起。

<a id="scope"></a>

## 用途与输入

提供本地手动迁移页面，解释 Playnite 库里的资料、身份、记录、分类和本地设置。不注册 metadata provider，不连接 Playnite 账号、运行源扩展或持续监听资料库；导入不要求在线资料方案。

支持官方备份 ZIP，以及源程序关闭后取得的完整 library 目录副本。已验证格式为 database.json 的 Version 4、LiteDB 4 文件格式及对应 Game 模型；10.62 是源码基线，不能据此断言用户备份的具体应用版本。文件名和 ZIP 后缀不承担格式识别。

官方备份将数据库放在 library，将库内图片放在 libraryfiles；直接目录副本则使用 library/files。ZIP 中正斜杠与反斜杠均按实际目录分隔解释。读取 games.db 和所选范围需要的字典库：completionstatuses、categories、tags、genres、features、platforms、series、sources、companies、ageratings、regions、emulators。每个文件独立读取，不把扩展数据、配置、主题、筛选预设、扫描器或工具恢复为 Kisaki 设置。

games.db 是必需输入。空的可选字典库是正常情况；缺少某个字典只影响引用它的字段，不能将未解析的名称或状态当作空值覆盖目标。现有但无法读取的所选数据库报告对应失败，其他独立范围继续。选择目录副本时须提供完整、一致的库；导入器不打开源程序仍在维护的活动库，也不替用户发起备份或恢复。

<a id="identity"></a>

## 身份与来源资料采用

每个有效 Game 形成一个游戏迁移输入。源 Guid 用于本输入中的数据库关联及批次步骤，GameId 按所属库插件的定义解释；只有含义已明确的插件身份组合才转换为正式外部身份。

本项支持官方 Steam 插件的 PluginId CB91DFC9-B977-43BF-8E70-55F46E410FAB，与合法正整数 GameId 组成 steam / app/{appid}。仅凭 Source 名称、URL 或一个数字不能推断该身份。其他插件和手动游戏以合法本地资料形成 prepared 候选，内部键仅用于本批次关联与进度。

全部有效身份共同对应一个本地游戏时复用；没有对应时调用 ingest.add 的 prepared 输入，采用合法来源字段。名称相同不触发本地合并，身份冲突按共同规则报告，已有作品不自动联网更新。源 Company、Series、Platform 名称不直接构成主体或作品关系。

以下普通资料默认选中，新对象直接采用有效值；已有对象默认保留，明确补空或覆盖后才更新：

| 来源内容                                                                          | 采用方式                                                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Name、SortingName                                                                 | 主名称、排序名称；名称同时可以作为原生定位线索                                               |
| Description                                                                       | 按 HTML 正常解析并转换为安全 Markdown，保留段落及可采用的图片引用                            |
| ReleaseDate                                                                       | 按源序列化格式保留年、年月或年月日，不补造精度                                               |
| Links                                                                             | 名称与安全 URL 组成的普通外链，不从任意链接另猜公开身份                                      |
| CoverImage                                                                        | 当前主图                                                                                     |
| BackgroundImage、Icon                                                             | 背景图与游戏图标；源格式没有标题标志字段                                                     |
| Added                                                                             | 选择加入日期时，按导入时系统时区取日历日期，写入 added_date                                  |
| DeveloperIds、PublisherIds、SeriesIds、AgeRatingIds、RegionIds、SourceId、Version | 选择“补充资料笔记”时解析实际名称和值，保留字段对应；不凭平面文字新建实体、作品关系或私人评价 |

来源普通资料默认选中，补充资料笔记默认关闭。新作品在 prepared 新增中采用所选字段；已有作品按明确选择更新。技术 created_at／updated_at 使用本次实际写入时间。

库内相对图片引用只在对应库资源根内解析，经 attachments 正式接收后不再依赖原包。源字段为远端图片 URL 时，按本体图片准备合同获取；源字段为绝对文件路径时，须纳入用户选定的本地资源范围或根映射，核验后读取。不存在的文件单独报告。Description 中实际引用的库内资源随正文准备，远端图片保留安全链接。读取整个目录不等于允许恢复其中的脚本或应用配置。

<a id="records"></a>

## 评分、喜爱与自定义状态

UserScore 是本人 0–100 整数评分，与本体同尺度。0 是有效零分；已验证格式中 null 或省略该可空字段均表示未评分，因为来源序列化不写 null。CriticScore 和 CommunityScore 是公共统计，不转换为个人评分。Favorite 对应特别喜爱，false 是实际值；Hidden 是源软件显示偏好，不转换为私人状态或内容敏感标记。

CompletionStatus 由用户自行命名，稳定关联键是 Guid。名称、语言、排序位置及 CompletionStatusSettings 的 DefaultStatus / PlayedStatus 都不能证明“已完成”；PlayedStatus 仅供源软件在游玩时设置状态。页面列出本次输入中的状态，每种状态分别配置两个含义：

| 配置项   | 可选含义                               | 初始选择 |
| -------- | -------------------------------------- | -------- |
| 当前安排 | 不采用、无当前安排、计划、进行中、搁置 | 不采用   |
| 完成事实 | 不采用、至少完成过一次                 | 不采用   |

这是一张本次导入配置表，同一源状态只设置一次，不对每个游戏弹出配对步骤。两项独立，例如“重玩中”可以对应 active，同时表明至少完成过一次。没有来源状态的游戏不采用状态，不把缺失解释成用户清除了本体安排。

“至少完成过一次”只在本地没有完成历史时初始化一条未知日期记录。已有历史保留，不因再次选择同一状态新增。PlayCount 是启动次数，不生成完成次数；LastActivity 是最近活动时间，不是完成日期。源核心库没有逐次完成历史，因此本项不提供追加来源逐次完成记录选项。

新游戏的评分、喜爱、当前状态和初始完成记录随 initial 同次提交。已有游戏默认保留个人值，明确选择采用来源个人值后才更新选中的评分、喜爱和已配置状态；未评分、false 和零分分别按实际语义处理。为已有游戏初始化空历史使用共同的 expected.completionCount: 0 条件。

<a id="duration"></a>

## 累计时长

Playtime 是累计秒数，在源文件中为 BSON Int64。先按精确整数读取，再核验非负范围并乘 1000 转为毫秒；不先经 JavaScript Number 舍入。超出本体可保存范围时只报告该时长未采用。

新游戏在选定累计时长时写入附加时长；已有游戏默认保留，用户明确选择“采用来源总时长”时遵守[绝对值采用规则](../importers.md#duration)，扣除已保存实际活动量后设置 additional_duration_ms。不能在旧附加值上反复累加，也不能删除实际活动来适应较小的来源总量。

核心库只提供总量、启动次数与最近时间，不能生成逐次活动区间或日历。GameActivity 等扩展各有独立格式，本项不解析 extensiondata 中未声明的历史；不能因备份带有扩展文件，就声称已迁入其活动明细。

<a id="organization-data"></a>

## 备注、标签与分类

Notes 是多行普通文字，选择后创建关联游戏的独立 Note，保留换行且不把尖括号直接解释为 HTML。Added、Modified 和 LastActivity 不充当写作时间。空备注不创建笔记；同批次继续跳过已完成项，另建批次可明确追加。

TagIds、GenreIds、FeatureIds、PlatformIds 解析到来源字典，选择“标签”后作为普通标签，按共同 nameKey 规则复用；它们不生成角色、作品平台专属实体或作品关系。丢失的字典引用只报告对应标签未迁入。

CategoryIds 对应用户分类，迁为手动合集。用户可以选择源分类本次新建，或明确选用已有合集；已有同名合集不自动合并。成员通过本次源 Guid 到 GameRef 的对应建立，未迁入游戏不生成空成员。源 Category 本身不保存成员人工顺序，不能把当前界面排序当成来源顺序；新成员按本次列表顺序追加，已有成员顺序保留。

补充资料笔记仅保留上表明确的资料文字，不把公共评分、运行状态、显示分组或缓存统计混入私人笔记。Manual 路径不属于本体游戏内容消费单元，保留为未迁入的说明书设置，不登记为漫画／小说文件。

<a id="local"></a>

## 内容目录与启动配置

本地目录和启动配置由用户选择迁入，默认关闭。InstallDirectory 经实际位置核验后登记 GameDirectory；IsInstalled 等标记不代替文件检查。只知道目录时不生成空配置，也不搜索并选择目录中第一个 EXE。

根映射作用于已经解析的结构化路径，不全文替换命令、参数或 URL。Playnite 会尝试在其他盘符寻找同一路径，本项只采用用户给出的明确根映射，不跨盘猜测位置。源相对路径以源定义所需的 Playnite 程序根解释，用户未提供这个根时，不把备份目录或 Kisaki 工作目录当作替代。

只将 IsPlayAction 为 true 的可转换 GameAction 作为启动配置，保留名称和本次输入顺序。GameAction 没有跨输入稳定 ID，固定输入内使用游戏源键与动作序号组成步骤键；继续原批次复用已完成配置，不跨新批次猜测对应。多个动作分别保存，不按第一项设置首选。

| 来源动作                             | 采用方式                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| File，无参数且无独立工作目录要求     | 解析并核验实际文件，采用文件启动                                                                                        |
| File，带参数或工作目录               | Windows 上生成同义的完整命令，工作目录单独保存；空源工作目录按源默认的启动文件所在目录落实                              |
| URL                                  | 采用实际链接，保留其协议；导入时不打开                                                                                  |
| Emulator，实际自定义配置             | 按 EmulatorId / EmulatorProfileId 找到 CustomProfiles，展开明确的模拟器 EXE、ROM、参数与工作目录，生成 Windows 完整命令 |
| Script，或依赖启动脚本才能完成的动作 | 不迁为可执行配置；源 PowerShell 代码依赖 PlayniteApi、Game 等运行上下文                                                 |
| 仅指向 Playnite 内建模拟器定义的动作 | 不猜测运行时定义、安装目录中的 EXE 或导入脚本；没有完整自定义配置时报告未迁入                                           |

文件参数转换必须保留 Windows 参数含义，正确处理空格、引号、百分号和命令元字符，不能将 ProcessStartInfo.Arguments 直接拼成新的 shell 程序。无法保持执行含义的动作报告具体原因。Windows 命令不能作为其他平台的原生命令使用；资料、个人记录和普通可用链接仍可独立迁入。

自定义模拟器使用用户本次选定的 ROM；只有一个实际 ROM 时可直接采用，多 ROM 不静默取第一项。OverrideDefaultArgs 为 true 时采用动作 Arguments，否则采用配置 Arguments 并追加 AdditionalArguments。解析 InstallDir、EmulatorDir、ImagePath / ImageName / ImageNameNoExt / ImageDir，以及已确定的 Name、GameId、DatabaseId、PluginId、Version 等来源变量；Platform 依来源第一项的实际规则解析。PlayniteDir 需要用户提供源程序根，不从配置或未知目录猜测。未解析变量不能原样成为假定可用的启动目标。

所选动作有 PreScript、PostScript、GameStartedScript、模拟器 StartupScript / ExitScript 等源环境依赖时，相关脚本不转换为普通本体回调。已能独立解释的主启动目标可以保留，但在结果中列明相关回调未迁入；启动本身由脚本实现时不能建立伪造的可用配置。全局脚本、HDR、插件启动控制器和应用级监测偏好不恢复。

官方 Steam PluginId 与有效 appid 已明确，且 IncludeLibraryPluginAction 为 true 时，可以生成 steam://rungameid/{appid} 的普通链接配置；这是已知平台入口，不执行或恢复源插件。其他插件动作不按 PluginId 猜测入口。

监测独立处理：Directory 采用 TrackingPath，缺省时采用已核验的 InstallDirectory；URL 的 Default 同样采用该安装目录。ProcessName 是不带扩展名的 Windows Process.ProcessName，转换为本体完整 EXE 文件名，仍采用本体自身的平台比较规则。源 Process、OriginalProcess 和普通 File 的 Default 分别依赖进程树或启动 PID，与本体文件监测不同，不能谎称等价。用户选入并成功登记内容目录时，可以按本体“从目录创建配置”的正常行为将该目录填为监测目标；否则保留已有启动目标为未完成配置，使用时通过正常配置编辑补全。采用本体目录监测的动作在结果中说明这一实际设置。

TrackingFrequency、InitialTrackingDelay 等源轮询设置不转换成本体计时或观察语义；本体计时方式使用正常默认值。Playnite 核心库没有可对应的存档目录和历史备份模型，本项不从扩展缓存猜测存档或恢复备份。所有配置迁入都只保存，不运行命令、脚本、模拟器或游戏。

<a id="interface"></a>

## 单页流程与默认值

页面依次选择备份或目录、游戏与数据范围，配置来源状态、必要根映射及多 ROM 选择。来源普通资料默认选中，直接使用本页映射；结果可打开普通更新器另行补充。名称、身份、目标与结果分列，用户在本页完成状态配置后直接执行所选范围。

评分与喜爱、累计时长、备注、标签和分类默认选择，作用于新作品；状态需明确完成对应后才采用。已有作品个人值、已有总时长、来源资料保留、补充资料笔记、本地目录与启动配置分别选择，默认保留已有资料及记录。未选择范围和正常来源默认值不逐项告警，只有所选内容实际未采用或采用方式改变时说明结果。

prepared 新增与 initial 共同提交，alreadyExists 按已有对象规则处理。其他资料、时长、笔记、合集与本地配置分别使用完整操作。源键对应和步骤结果按[批次合同](../importers.md#repeat)保存，继续时跳过已完成项，未知提交先核对；取消保留实际结果，关闭页面不取消任务。

<a id="implementation"></a>

## 格式读取与源码职责

采用与来源格式相符的 LiteDB 4.1.4 读取库，不手写 LiteDB 页、索引或 BSON 解析器。它没有可直接用于 Node 的同等受支持入口，因此扩展携带一个按目标平台编译的 .NET NativeAOT 读取程序；用户无需安装 .NET。六个桌面目标分别构建读取程序，并验证同一格式夹具的读取；目标支持以各自制品的实际结果为准。读取路线与平台证据见[原生读取核验](../../../verification/evidence/playnite-importer/live-backup.md#reader-audit)。

Node 负责 ZIP、目录范围、字节限制、任务取消及来源语义；读取程序只接收单个数据库字节流，以只读内存 StreamDiskService 和 LiteEngine 枚举 BSON 原始值，输出内部带类型标记的 JSON 行。Guid、DateTime、Int64、Decimal、Binary 等保留实际类型，Int64 用十进制文本传输；标准输出只进入父进程解析管道，不成为运行日志。使用 shell: false / 隐藏窗口启动随扩展交付的固定程序，任务结束或取消时收回子进程与流。

不使用 Playnite 的数据库初始化入口，因为它会创建索引、修复或重建源库；也不使用 BsonMapper、来源 CLR 模型、反射实例化或来源查询表达式。所有字段只当作数据，_type 等标记不激活类型。LiteDB 4.1.4 的已知对象映射漏洞及 AOT 警告有[单独审计记录](../../../verification/evidence/playnite-importer/live-backup.md#reader-audit)；本接入的调用范围限于该受限读取路径，不将其结论扩大到该库其他 API。

    src/
    ├── node/
    │   ├── entry.ts
    │   ├── input/
    │   │   ├── archive.ts
    │   │   ├── database.ts
    │   │   ├── validation.ts
    │   │   └── types.ts
    │   ├── mapping/
    │   │   ├── identity.ts
    │   │   ├── metadata.ts
    │   │   ├── records.ts
    │   │   ├── organization.ts
    │   │   └── launch.ts
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
    reader/
    ├── Reader.csproj
    └── Program.cs

archive 管输入和库内资源，database 管固定读取程序与类型传输，mapping 解释各类来源事实，import 调用本体公开完整操作并汇总实际结果。IPC 只转发，Webview 不打开数据库。读取程序只承担成熟格式库与 Node 之间的适配，不放资料方案、身份匹配或导入业务。按需读取选中内容，不在扩展激活时扫描库或启动读取程序。

<a id="acceptance"></a>

## 验收范围

格式与读取依据见[真实备份及补充夹具](../../../verification/evidence/playnite-importer/live-backup.md)。验收覆盖游戏、状态、文件动作、Steam 身份和库内图片，以及零分、未评分、备注、部分日期、四种动作、ROM、自定义模拟器、标签分类、删除记录和精确 Int64 的迁入结果。

完整迁移验收覆盖离线 prepared 新增与原批次继续、已有身份复用与冲突、initial 同次提交、明确来源资料保留、自定义状态双轴配置、空历史条件、累计时长采用、普通文字与附件准备、分类成员、Windows 参数保真、变量和根映射、监测方式、脚本未迁入结果、多 ROM、六个平台读取、输入限制、取消与中断。损坏或不完整输入必须保留独立成功结果；真实用户正文、完整记录、命令与路径不得进入报告夹具或日志。
