# LaunchBox 来源与合成核验

2026-10-17，第 25 项。用户明确没有实际 LaunchBox Data 或备份，使用合成样本。[完整方案](../../../design/extensions/importers/launchbox.md)已确认。本记录区分官方合同、公开输入片段、方案推导和技术探针；没有运行 LaunchBox、游戏或正式 Kisaki 导入器。

<a id="sources"></a>

## 来源层次

LaunchBox 的公开 Plugin API 文档标注程序集 13.5.0.0，大量属性没有语义摘要。它描述运行时接口，不是磁盘 XML schema；本次未取得本体公开源码，也没有把第三方兼容项目当作本体源码。磁盘字段写法另用来源用户实际展示的 XML 片段核对。

[官方更新记录](https://www.launchbox-app.com/about/changelog)截至检查时列出 14.0（2026-08-14）、14.0.1（2026-08-25）与没有发布日期的 14.1。官方当前指南说明的新版能力单独记录，不能以 13.5 API 列表断言源软件没有这些数据。

| 来源                                                                                                                                                                                                                         | 证明内容                                                           | 不能据此证明                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| [IGame API](https://pluginapi.launchbox-app.com/html/b33d2055-e2be-3f42-12c6-adbc5668f454.htm)                                                                                                                               | 公开主游戏属性及 API 基线                                          | 当前 XML 完整 schema、字段默认值、保存版本       |
| [StarRatingFloat](https://pluginapi.launchbox-app.com/html/7af3e6e4-be9e-421d-b896-6f88123f6083.htm)                                                                                                                         | 浮点本人评分优先于弃用整数属性                                     | 任意社区评分都是本人值                           |
| [当前主题绑定](https://feedback.launchbox-app.com/help/articles/3543252-data-bindings)                                                                                                                                       | 主记录 PlayTime 的秒单位、本人五分尺度、Progress 完整文字          | 逐次历史格式、所有版本累计如何聚合               |
| [AdditionalApplication.PlayTime](https://pluginapi.launchbox-app.com/html/f53bd2ac-ade4-3ee5-93f5-55e0abe7abc6.htm)                                                                                                          | 附加项自己保存秒数                                                 | 它与主 Game.PlayTime 一定互不重叠                |
| [备份指南](https://feedback.launchbox-app.com/en/help/articles/4521068-backing-up-and-restoring-your-launchbox-setup)                                                                                                        | 官方 .7z 只保存 Data，游戏和媒体在外                               | 实际用户包的根布局、源文件存在                   |
| [游戏进度指南](https://feedback.launchbox-app.com/en/help/articles/6612691-game-progress-tracking)                                                                                                                           | 13.22 后自定义 Category / Value；旧 Completed 迁为 Done / Mastered | Mastered 是独立 100% 成就事实、完成次数或日期    |
| [手动与自动列表](https://feedback.launchbox-app.com/en/help/articles/1792544-playlists-manual-auto-populated-and-filter-based)                                                                                               | 手动顺序、自动规则、转手动快照和多父侧栏显示                       | 自动列表 XML 中的成员一定是完整当前快照          |
| [游戏编辑指南](https://feedback.launchbox-app.com/en/help/articles/6470204-editing-game-details-and-fixing-incorrect-matches)                                                                                                | 资料、媒体、版本和伴随应用各有含义                                 | 所有无自动运行标记的附加项都是游戏               |
| [多光盘指南](https://feedback.launchbox-app.com/en/help/articles/8972270-multi-disc-games-and-m3u-playlists)                                                                                                                 | 根启动文件也可存在于版本行，临时 M3U 依赖源运行时                  | 主文件和同一版本应迁成两套相同配置               |
| [文件与路径](https://feedback.launchbox-app.com/en/help/articles/3760208-managing-game-files-folders-and-paths)                                                                                                              | 相对路径基于源程序根，允许父目录和 UNC，平台 Game 文件夹是公共位置 | ApplicationPath 父目录就是游戏专属目录           |
| [模拟器设置](https://feedback.launchbox-app.com/en/help/articles/3038328-setting-up-an-emulator-manually)与[命令变量](https://feedback.launchbox-app.com/en/help/articles/7078334-launchbox-built-in-command-line-variables) | 三层参数替代关系、ROM 自动追加、明确占位符、自动解包／M3U 依赖     | 直接把参数粘贴到 shell 后仍然同义                |
| [开发者图片说明](https://forums.launchbox-app.com/topic/90566-question-about-metadata-in-database-versus-xml-files/)                                                                                                         | ROM basename、合法化标题和编号／GUID 后缀匹配                      | 当前主题所用图片、所有宽松匹配和地区优先序       |
| [官方人员历史说明](https://forums.launchbox-app.com/topic/94244-launchbox-for-windows-140-released/page/3/)                                                                                                                  | Data/PlaySessions 年份 JSONL 存在，含起止和有效秒数                | 具体属性名、时间编码、版本键、与累计值的覆盖关系 |
| 公开数据库的 [Windows](https://gamesdb.launchbox-app.com/games/details/20134-clannad)与 [PS2](https://gamesdb.launchbox-app.com/games/details/158875-clannad)记录                                                            | 同一标题按发行平台有不同身份与日期                                 | 两条记录应自动合并为同一本体作品                 |

公开输入证据另包括[平台 XML 片段](https://forums.launchbox-app.com/topic/82395-adding-games-manually-to-a-platforms-xml/)、[附加版本片段](https://forums.launchbox-app.com/topic/91814-re-import-titles-are-missing/)、[列表生成样例](https://forums.launchbox-app.com/topic/52395-howto-custom-playlist-creation-with-python/)、[自定义字段写入样例](https://forums.launchbox-app.com/topic/90652-importing-teknoparrot-games/?comment=497716&do=findComment)和[Progress 字段片段](https://forums.launchbox-app.com/topic/92343-ms-dosxml-file-is-getting-over-written-with-old-data/)。这些是源用户或工具作者直接给出的输入／代码，不是厂商 schema；没有运行它们的脚本，也没有保存整份用户库或私人路径。

[历史单体 XML](https://gist.github.com/Xananax/7dccce48db254ef7acd0)只对照 Emulator / EmulatorPlatform 的序列化名字，不能据此宣布旧单体库或全部新版模拟器设置受支持。[评分撤回案例](https://forums.launchbox-app.com/topic/86591-bug-un-rating-games-defaults-to-community-rating/)提供 0 与未评分的观察，结合官方评分合同使用，不把界面上的公共替代值当本人值。

Steam 入口的 appid 范围另按 [Steamworks 的 uint32 参数合同](https://partner.steamgames.com/doc/webapi/ISteamUserStats)核对，不把任意长 gameid 当作 App ID。

各来源 URL、抓取时间、HTTP 状态、字节数、SHA-256 和证据类别保存在 [verification JSON](2026-10-17-verification.json)。只保存摘要与人工归纳，不在仓库复制完整论坛内容、SDK 页面或厂商代码。

<a id="findings"></a>

## 影响方案的结果

- 软件库迁移与已确认的文件资料采用统一：新作品先走 profile／initial，再按选择 prepared 更新；已有对象直接复用。
- 内部 GUID 负责本次关联；DatabaseID 是公开游戏记录。附加版本没有自动独立成作品的依据，平台版发行日期也不能替代原作首次发行。
- 五分星级保留小数，0 是未评分；公众评分和年龄分级分别处理。Progress 允许自定义，因此设置当前安排与完成事实，不能按类别 Done 一概通关。
- PlayCount 和 LastPlayedDate 不提供通关次数／日期。主 PlayTime 与附加项时长没有已核实的互斥范围，不能相加；本项采用主记录值并明确名称。
- Notes 可由资料下载填入，作为简介处理；用户明确选择后也可保存文字 Note。自定义字段只按本次用途采用，不按名字猜类型。
- 手动列表与实际 ManualOrder 可以迁入。自动规则列表的缓存成员不等于完整快照；平台及 Parents 侧栏结构不伪造成嵌套合集。
- 官方备份没有游戏和图片。图片归属、实际资源根、唯一候选、参数层级和源运行时依赖分别核对。

<a id="fixtures"></a>

## 合成输入与 73 项检查

[build-fixture.py](build-fixture.py)生成 26 个输入文件，清单与校验值见 [fixture manifest](fixture-manifest.json)。包含：

- 两个平台 XML、平台定义、模拟器及平台关联、手动与自动列表。
- UTF-16、字段换序、大小写区别、重复标量／游戏、错误根、未知命名空间、DTD 和损坏 XML。
- Data 内容直接为根、唯一 Data 外层两份实际 .7z，均由本机已有 7-Zip 创建。
- 三张可解码的一像素 PNG，以及仅供路径核对的惰性文字文件；带 .exe、.cmd、.iso 后缀不代表真实程序或媒体。
- 一份只验证 PlaySessions 目录存在的 JSONL；内容明确是探针标记，不编造 LaunchBox 行字段，也不当作受支持历史。

[verify.py](verify.py)使用 lxml 的真实 XML 解码、Windows CommandLineToArgvW、Pillow 图片读取和 7-Zip 成员流读取，另以明确的小型模型检查所提采用规则。[结果](synthetic-results.json)为 73 项通过、0 项失败，全部输入在检查后校验值保持不变。

| 检查范围       | 实际证明                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------- |
| XML 与字节     | UTF-16、转义正文、字段顺序、大小写关联、无外部实体解析及拒绝项；不是厂商 schema 认证         |
| 7z             | 两种合成根布局可列举、流式取 XML、原生完整性检测，字节与输入相同且不含游戏／图片             |
| 身份与记录模型 | GUID／公开编号分开、已知 Steam URI、星级优先与空值、显式进度对应、时长单位与绝对值差额       |
| 集合模型       | 手动位置、未设位置、重复成员、失联引用和自动列表拒绝；没有执行源自动过滤器                   |
| 路径与图片     | 源程序根、明确授权父目录、越界反例、惰性目标存在、同类多图歧义与 PNG 可读                    |
| 参数模型       | 三层替代、ROM 占位／抑制、文件名形态、引号与空格、未知源变量拒绝；Windows 原生拆参不启动进程 |

Python 及底层库版本见结果 JSON。7z 探针使用仓库现有 7zip-bin 5.2.0 携带的 7-Zip 21.07 x64，没有为本次安装依赖。这个旧工具版本只用于合成格式验证，不作为正式扩展依赖选择；正式制品应交付受维护的归档读取后端并验证所有目标平台。

7z 列举探针只解释自己的已知成员名，不声称它是可用于任意恶意文件名的生产解析器。映射检查验证所列输入与预期值，不证明未公开的源程序内部行为；参数拆分也不代替完整 shell、工作目录与实际宿主启动等价。

<a id="limits"></a>

## 仍需独立验收

本次没有真实 Data、官方备份或源软件运行证据。实际 XML 默认／缺席语义、所有模拟器序列化分支、图片与地区规则、完整资源预算、符号链接、跨平台路径、真实原生新增与写入、后台取消、完整制品及宿主运行均需实施验收。

PlaySessions JSONL 的具体行格式、主记录与版本时长的覆盖关系，以及新版存档管理数据没有在本次确认。本项明确不承诺迁入 JSONL 明细与源存档管理；不能用推测字段、累计量或起止时间倒算填充这些空白。若后续扩大支持，须取得真实输入完成单独格式与语义适配，再更新声明。

本体原生新增、prepared 采用、已有值保护、空历史条件、时长绝对值、笔记与合集、附件接收、真实 LocalConfig 和独立安装的验收不由上述 73 项探针替代。
