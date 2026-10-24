# Playnite 备份、LiteDB 与字段核验

核验日期：2026-10-17。来源基线为 Playnite 10.62，固定提交 ecee01452a25db1fb2674a69f883d298d4c7be8a；核验时最新正式发布仍为该版本。用户提供的 playnite.zip 按实际数据库结构识别，没有根据文件名或源码基线推定其具体应用版本。

[完整接入方案](../../../design/extensions/importers/playnite.md)已确认。[结构化记录](2026-10-17-verification.json)保存公开来源地址和校验值、脱敏统计、依赖与验证边界；[合成结果](synthetic-results.json)保存逐项读取检查。

## 实际输入与读取结果

原 ZIP 为 147,561,380 字节，包含 library、libraryfiles、配置、扩展及主题目录。ZIP 成员使用反斜杠分隔，符合固定版本[备份实现](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Backup.cs)的写入方式。database.json 的 Version 为 4；[项目依赖](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Playnite.csproj)使用 LiteDB 4.1.4。

只读取所需的 13 个库文件、database.json 和游戏实际引用的库内图片。数据库字节直接装入只读内存流，没有解压用户数据库副本；没有运行 Playnite、源插件、恢复入口或任何游戏动作。原 ZIP 在核验前后的 SHA-256 均为 f2e18f2ca1d55ed82b6694db09896c2d6475cfd0bde007bc91c1d06d9b72e0ba。

| 范围           | 实际结果                                                                       |
| -------------- | ------------------------------------------------------------------------------ |
| 游戏           | 96 条 Game，源内部 ID 为 Guid，GameId 为字符串                                 |
| 自定义状态     | 8 条 CompletionStatus，另有 1 条 CompletionStatusSettings                      |
| 评分与备注     | 96 条均省略 UserScore 和 Notes；这份真实输入未覆盖非空评分或备注               |
| 时间           | 96 条 Playtime 与 PlayCount 均为 BSON Int64；33 条有 LastActivity              |
| 动作           | 34 个动作，均为 IsPlayAction=true、Type="File"、TrackingMode="Default"         |
| Steam 身份     | 62 条为已核实的官方 Steam PluginId 与合法 GameId；其余无非空库插件身份         |
| 目录与 ROM     | 95 条非空 InstallDirectory；无 ROM；emulators.db 为空                          |
| 分类与标签字典 | categories.db 为空；646 个 Tag、23 个 Genre、61 个 GameFeature、75 个 Platform |
| 其他资料字典   | 146 个 Company、2 个 Series、1 个 GameSource、3 个 AgeRating、4 个 Region      |
| 图片           | 78 个封面、86 个图标、84 个背景，共 248 个引用，全部找到并读完                 |
| 图片字节       | 合计 98,421,743 字节，均与 ZIP 记录长度一致                                    |

图片验证证明引用解析和字节可读，未宣称逐张解码、像素正确或完成本体附件准备。没有通过扩展目录名判断插件历史存在或不存在；这里只核验 Playnite 核心库。报告不保存用户游戏名单、标题、评分值、私人正文、本地媒体路径或执行命令。

## 字段与运行语义

[Game 模型](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/PlayniteSDK/Models/Game.cs)明确 UserScore、Favorite、Playtime、PlayCount 与 LastActivity 各自的含义。数据库的[映射配置](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Database/GameDatabase.cs)不保存 null，因此真实输入省略 UserScore 是正常未评分形态。零分不能与未评分合并；启动次数不能当作完成次数，最近活动时间也不能补成完成日期。

[CompletionStatus 模型](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/PlayniteSDK/Models/CompletionStatus.cs)只提供普通命名对象；[状态集合](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Database/Collections/CompletionStatusesCollection.cs)中的 DefaultStatus 与 PlayedStatus 不是固定完成语义。方案的“当前安排＋至少完成过一次”由用户按实际状态配置，属于产品采用规则，不声称来源有内建完成记录。

[备注编辑控件](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite.DesktopApp/Windows/GameEditWindow.xaml)使用支持换行的 TextBox；Notes 按普通文字处理。Description 为 HTML，另走正文转换。[ReleaseDate](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/PlayniteSDK/Models/ReleaseDate.cs)使用 yyyy、yyyy-M 或 yyyy-M-d，合法部分日期保持实际精度。

[GameAction](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/PlayniteSDK/Models/GameAction.cs) 的 File、URL、Emulator、Script 在实际 BSON 中是枚举名称字符串，不能直接假定为枚举数字。[启动控制器](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Controllers/GenericGameController.cs)分别解释参数、默认参数覆盖、ROM 和脚本上下文。[进程启动](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Common/ProcessStarter.cs)在工作目录为空时采用执行文件所在目录，和 Kisaki 命令的用户主目录默认值不同；转换时须落实这个差异。

[进程监测](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Common/ProcessMonitor.cs)区分启动进程、进程树、目录与 Process.ProcessName。File 的普通 Default 走进程树，URL 的 Default 使用安装目录；不能将它们全写成同一种本体文件监测。过程没有运行真实路径或测试游戏启动，命令转换和完整监测行为留在实现验收。

官方 Steam 身份来自固定版本[SteamLibrary](https://github.com/JosefNemec/PlayniteExtensions/blob/886468f65724e6fd104f3a09847a17ba57cfb430/source/Libraries/SteamLibrary/SteamLibrary.cs)的 Guid；不是扩展 YAML 的包名。[Steam 启动控制器](https://github.com/JosefNemec/PlayniteExtensions/blob/886468f65724e6fd104f3a09847a17ba57cfb430/source/Libraries/SteamLibrary/SteamGameController.cs)实际使用 appid 的 Steam URI，支持方案中限定的平台链接转换。

<a id="reader-audit"></a>

## 读取程序与依赖审计

没有直接使用 Playnite 的 ItemCollection，因为其[初始化](https://github.com/JosefNemec/Playnite/blob/ecee01452a25db1fb2674a69f883d298d4c7be8a/source/Playnite/Database/Collections/ItemCollection.cs)会确保索引，并可能修复或重建损坏数据库。本次只使用上游 LiteDB 4.1.4 的 LiteEngine、StreamDiskService、FindAll 与 BSON 原始值，通过不可写的内存流验证读取。

使用官方 .NET SDK 10.0.402，在临时目录构建 Windows x64 NativeAOT。SDK 归档的 SHA-512 与官方发布元数据一致，没有全局安装或更改用户 NuGet 配置。原生程序为 4,891,648 字节，不依赖目标机器另装 .NET；本次实际用它读取了真实 ZIP 与合成数据库。六个正式桌面制品目标仍须分别构建、加载和运行，不能从 Windows 成功推定其他目标已经通过。

本次构建保留两类警告：

- NU1904 指向 LiteDB 4.1.4 的 [GHSA-3x49-g6rc-c284](https://github.com/advisories/GHSA-3x49-g6rc-c284)。该问题涉及 BSON 对象映射时由 _type 选择并实例化 CLR 类型。本程序不调用 BsonMapper、不加载源模型或插件，_type 仅输出为普通字符串；合成测试验证了一个不存在的类型标记仍原样读出。这个审计只适用于所列 API 路径，依赖及调用范围变化后须重新核对。
- 展开后的 8 条 IL3050 指向 BsonExpression.ParseSingleExpression 的动态数组表达式。程序只通过 FindAll 使用固定全量枚举，不开放来源查询表达式或数组表达式 DSL。本次原生执行已通过，但没有将警告隐藏，也没有宣称整个 LiteDB 包都适用于 NativeAOT。

[验证器源码](reader/Program.cs)包含两个研究入口：提供 ZIP 参数时仅输出脱敏汇总；无参数时从 stdin 接收单个数据库并向 stdout 输出内部带类型标记的 JSON 行。后者只在本次合成数据上验证，不将用户数据库正文输出为报告。正式交付应仅保留受控字节流读取接口，由 Node 管输入范围、大小、进程寿命和取消，不能原样把研究 ZIP 入口当产品 API。

## 合成夹具与复现

[夹具生成器](fixture/Program.cs)通过同版本 LiteEngine 创建真实数据库，包括 5 条保留游戏和 1 条随后删除的游戏。所有名称、备注、路径、脚本、图片与 ID 都是合成内容；没有复制用户记录。提供[数据库](synthetic-games.db)和[备份 ZIP](synthetic-backup.zip)，ZIP 使用与真实备份相同的反斜杠成员名。

[验证脚本](verify.mjs)对原生程序执行 22 项检查，覆盖零分／满分、null／省略字段、普通备注、布尔值、部分日期、UTC 时间、超出 JavaScript 安全整数的 Int64、Decimal／Binary 类型、四种动作、ROM 与模拟器引用、非游玩动作、类型标记、删除记录、标签与分类、图片解析和输入字节未改变。脚本只读取合成输入，未执行其中的动作或脚本。

可在独立临时目录复制 reader、fixture 与 verify.mjs，使用 .NET 10 SDK 及 NativeAOT 对应平台工具链复现：先以 nuget.org 恢复两个项目，运行 Fixture.csproj 生成到选定目录，再以 Release 和 win-x64 发布 PlayniteReader.csproj，最后将原生程序路径及夹具目录传给 node verify.mjs。其他目标采用对应 runtime identifier。生成目录不要指向真实 Playnite 库。

来源格式、关键字段与受限原生读取已经验证。资料方案获取、本体正式写入、图片解码、启动命令转换、状态配置页面、取消和六个平台的完整扩展运行仍待实现验收。本次没有改写 Kisaki 正式数据库，也没有留下用户数据库解压副本。

临时 SDK、读取程序和合成测试目录的删除被自动审批拦截，工具返回 blocked by policy；这些临时工具尚未清理。没有改用其他工具重试删除。
