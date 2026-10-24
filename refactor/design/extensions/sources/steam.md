# Steam 接入设计

Steam 提供结构化商店资料、本人拥有库与愿望单导入，以及累计时长的明确采用。本文规定 App 范围、字段、图片、本人配置和完整导入流程。

<a id="scope"></a>

## 职责与入口

Steam 负责游戏平台身份、商店资料与图片，以及本人拥有库和愿望单的读取。它不充当角色或通用人物资料库，也不把平台累计时长解释成实际活动。

| 能力                 | 接入范围                                                       |
| -------------------- | -------------------------------------------------------------- |
| Game 名称搜索与定位  | 有限商店名称建议、明确 App ID 或商店链接；逐项核对实际应用类别 |
| Game 普通字段        | 名称、实际简介、适用的原始发行日期、来源分类标签与外链         |
| Game 图片            | 主图、背景、图标；没有已核实的标题标志字段，不提供 titleLogo   |
| 角色、人物、组织档案 | 不提供；开发与发行字符串、创作者社区账号不构成实体档案         |
| 资料关系与 Part      | 不声明；DLC 数组、fullgame 和商品包不自动变成作品关系或分部    |
| 本人清单导入         | 拥有库、愿望单，分别选用；支持手动导入与默认关闭的自动补齐     |
| 平台累计时长         | 单独读取并明确核对采用，沿本体补记操作执行                     |
| 远端写入与持续同步   | 不提供；没有评分、完成状态或愿望单写入入口                     |

公开资料统一使用结构化商店接口：IStoreBrowseService/GetItems 读取详情和素材，IStoreQueryService/SearchSuggestions 取得名称建议，GetStoreCategories 与 IStoreService/GetLocalizedNameForTags 取得分类和标签名称。以上路径均已匿名读通，详见[补充核验](../../../verification/evidence/game-sources/steam-storebrowse.md)。旧 appdetails、storesearch 只保留为比较证据，不进入运行依赖或自动回退路径；本人资料、拥有库与愿望单沿各自账号接口读取。

data_request 只请求本次字段需要的数据组，未采用的价格、购买方案和媒体信息不固定附带读取。核验时使用的完整字段请求不成为运行时每次都抓取全部内容的理由；一个返回数据组中的额外字段仍不扩大本次资料采用范围。

<a id="identity"></a>

## App 身份与对象范围

来源身份使用 source=steam、sourceId=app/{appid}。App ID 与用户 SteamID64、package、bundle、社区 clan 以及本地目录身份分别处理。SteamID64 全程保留十进制字符串，不经 JavaScript Number 往返。

普通名称发现和清单自动新建只采用已经核实为游戏的 App。music、software、video、购买包、画集与漫画商品不建立 Game；也不为它们新增音乐作品类型或另一类提供者。

GetItems 的 StoreItem.item_type 区分 App 等商品种类，type 则区分 App 内的游戏、demo、DLC、音乐等类别，不能混用两个枚举。本次主游戏 type=0、demo=1、DLC=4、音乐=11；CLANNAD 漫画商品实际属于 DLC，因此不能仅看到 DLC 就认定为游戏扩展。DLC 与 demo 不作为普通清单的新建目标；已经由用户明确作为独立 Game 管理并给出实际 App 身份的适用目标，可以读取其自身普通资料，但不能自动改成 fullgame 的身份、合并时长或创建基础作品。无法满足当前作品范围时明确报告不适用。

名称建议使用 SearchSuggestions，只开启 type_filters.include_games；同时开启 include_apps 会扩大到其他 App 类型，不能把它误当作必要的父开关。当前方案最多请求 50 项，并核对 metadata.total_matching_records、count 和实际返回记录；总量大于完整返回候选时，名称 resolve 返回 insufficientInput，不以首项或过滤后的唯一结果宣布对应。SearchSuggestions 没有分页参数，独立名称搜索不伪造下一页。StoreQuery.Query 的条件查询另有真实 start／count，但没有名称搜索字段，本扩展不为此扫描全站目录。

明确 App ID 仍须核对实际响应中的编号与对象范围。GetItems 支持有限批量输入，按每项身份与 success 检查结果，不按返回顺序对应。HTTP 200 不代表每项成功；本次不可用编号返回 success=15、visible=false、appid=0，不能借失败项覆盖正常目标，也不能据此声称编号必然不存在。批量上限、取消与响应字节预算由来源客户端统一维护。

<a id="fields"></a>

## 字段、语言与署名

| 来源值                                                | 本地采用                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| 实际商店名称                                          | name；请求语言不等于原作语言                                                    |
| full_description_bbcode、basic_info.short_description | 完整介绍与短简介分别处理，将 BBCode 安全转换为共同 Markdown，不重复拼接同一内容 |
| GetItems.release.original_release_date                | 仅在合法且与当前作品范围相符时提供 releaseDate；保留原作与独立版本的范围区别    |
| release.steam_release_date                            | 商店发行信息，不回填原作首次发行日期                                            |
| tagids／tags、categories 与对应名称接口               | 采用来源公开展示的实际应用标签与功能分类，不混用标签、分类和 genreids 字典      |
| 商店、官网等实际地址                                  | externalLinks；只按已核实的对象范围提取其他来源身份                             |
| 开发／发行文字与 creator_clan_account_id              | 保留为商店署名说明，不虚构 person／organization 身份或工作关系                  |
| supported_languages、平台支持、系统要求               | 不写 originalLanguages；真实支持语言与原始创作语言不同                          |
| 评分统计、推荐数、价格、购买状态                      | 不写用户总评分、收藏、当前状态或完成历史                                        |

GetItems 实测为 CLANNAD 同时返回 2004-04-28 的 original_release_date 与 2015-11-23 的 Steam 发行信息；两者不能混用。独立移植、重制与其他版本的资料仍须符合当前 Game 范围，不利用原始日期将不同来源身份自动合并。

不推断 originalName、原作语言、原始作者身份、作品敏感性或来源未回答的字段。分级或内容描述缺席不代表非敏感；不声明普通 isNsfw 读取，也不制作没有真实接口依据的成人筛选开关。

资料语言来自本体输入，映射为 context.language 及名称字典的 language，国家／地区统一来自扩展设置并传入 context.country_code。同一作品的日文和繁体请求可能返回英文正文，本次样本已验证这种回退；不能把请求参数当成确有译文的证据。没有的正文保持缺席，不能复制查询词或把名称当简介。

<a id="images"></a>

## 图片与素材地址

| 真实素材                                       | 用途                                       |
| ---------------------------------------------- | ------------------------------------------ |
| header、main_capsule、library_capsule 等识别图 | primaryImage，保留各自布局，不固定竖幅尺寸 |
| library_hero、raw_page_background              | backdropImage                              |
| community_icon                                 | iconImage                                  |
| 购买包素材、商店生成的装饰、视频预告           | 不代替当前游戏的对应图片                   |

GetItems.assets 给出的文件名与 asset_url_format 是实际素材依据；社区图标使用已核验的应用编号、图标 hash 与官方 CDN 规则。不得探测猜出的 library_logo 文件来补造 titleLogo。相同素材的 1×／2×尺寸作为同一候选的可用规格，不制造重复候选；正式采用选择该素材的可用高分辨率版本，预览可以使用小图。

素材 URL、实际 MIME 和尺寸分别核对。下载、静态缩略、ICO、动态图、裁剪和附件采用都沿[公共图片合同](../../domains/attachments.md#images)执行；不增加 WebM 预览或来源私有图片存储。已经采用的图片来自本地附件，不继续依赖商店资源可用性。

<a id="account"></a>

## 本人配置与读取状态

账号页配置用户自己的 Web API key 与明确的 SteamID64，允许从标准个人主页链接提取该编号；自定义主页名称只能经 ResolveVanityURL 核对，不能把昵称当编号。页面显示实际取得的账号名称、头像和可读状态，key 由 secrets 保存，页面不回读完整秘密。

本人身份配置和读取验证使用上述 SteamID 与 Web API key。GetPlayerSummaries 核对返回的目标身份，GetOwnedGames 与愿望单接口分别验证读取能力；个人主页公开不保证所有清单可读，配置中的 SteamID 也不能冒充 Web API 对 key 所有者的证明。

实际本次拥有库和愿望单均可读取。GetOwnedGames 使用 include_appinfo、include_played_free_games，显式限定不把家庭共享许可当本人拥有；API 的其他范围开关按其实际意义固定。默认拥有范围不扩展为全部免费游戏、短期访问或所有 App 许可。

game_count=0 与缺失 count 分开。本次用空 App 过滤范围得到 game_count=0 且没有 games 字段，这是明确空结果；response={}、认证失败、不可访问或数量不符不能伪装为空库。愿望单读取 GetWishlist，并与 GetWishlistItemCount 核对当前范围；平台同时变化时有界重读，仍不完整则报告，不能提交半份清单。

凭据只发送到确需认证的本人读取端点，不按同属 api.steampowered.com 就附加到公开商店请求，也不发到图片 CDN。保存、读取验证、普通设置重置、移除凭据和断开各自明确；断开停止后续本人读取及自动触发，不能影响已有本地资料。换账号不沿用旧清单缓存或自动导入设置。

<a id="import"></a>

## 拥有库与愿望单导入

导入页分别选择拥有库和愿望单、对象与本次采用范围，再直接执行任务，遵守[共同导入规则](../synchronization.md#import)。同一 App 在两个范围中出现时只对应一个 Game，不按名称建立重复对象，也不创建空 holdings 或启动配置。

| 来源信息                             | 采用约定                                                   |
| ------------------------------------ | ---------------------------------------------------------- |
| 拥有库成员                           | 创建或复用适用游戏；不自动设置 planned、active、完成或收藏 |
| 愿望单成员                           | 创建或复用适用游戏；用户选择采用当前状态时设为 planned     |
| 愿望单 priority、date_added          | 不成为个人评分、开始日期或完成日期；不持久镜像远端排序     |
| 最后游玩、近两周时长、各平台累计时长 | 不生成活动区间、最近游玩记录或完成事实                     |
| 不适用 App、不可访问记录、身份冲突   | 按项目报告未采用原因，其他独立项目继续                     |

已有对象只按用户本次选择采用个人值，不隐式刷新名字和封面。导入可选择本地目标合集，但没有新增的远端合集管理或镜像关系。平台移除条目不删除本地对象、状态或合集成员。

自动导入默认关闭，启用后按共同调度补齐所选当前清单中的本地缺项；默认每 60 分钟检查，可调整检查间隔。它不反复覆盖已有状态，也不承担时长同步。关闭页面不取消已接纳任务；取消、断开和关闭自动开关遵守各自边界。

<a id="playtime"></a>

## 累计时长的明确采用

playtime_forever 是来源累计分钟数，按精度乘以 60,000 转为毫秒，不与 playtime_2weeks、各系统或离线子统计再次相加。它只作为[平台总量核对](../../domains/games.md#duration)的参考，不作为拥有库导入的隐式写入字段，也不定时覆盖本地补记。

用户核对已对应游戏时，读取当前本地实际活动、已有补记和平台总量，通过本体补记操作保存确认后的非负绝对值。例如来源 10 小时、本地实际活动 3 小时，将补记设置为 7 小时。来源总量小于本地活动时报告该总量无法采用，保留活动与原补记。

核对快照与确认值在本次提交中固定，重试不重新计算另一份补记；在途新增活动按正常规则继续计入。采用不记录跨次平台时长账本，不把导入当天当作游玩日期，也不伪造最近使用。

<a id="settings"></a>

## 三个页面与默认配置

| 页面              | 内容                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| 资料采集 Metadata | 商店国家／地区、网络设置和公开读取测试；国家初值 US，语言沿本体请求                                |
| 账号 Account      | 本人 SteamID、key、实际连接状态、读取验证和断开                                                    |
| 导入 Import       | 拥有库／愿望单范围、已有对象采用方式、本地目标合集、自动补齐与任务结果；累计时长核对为明确独立操作 |

不注册 Sync 页面。三个页面使用既定 Solid 和基础 UI，私有 IPC 只发起完整业务；页面不直接请求 Steam，不自行修改本体数据库。

默认单次请求超时 20 秒，安全读取重试 2 次。公开商店与本人读取分别调度，所有商店子请求保守节流，429 尊重服务端退避；不把非官方流传的固定配额作为来源保证。缓存有界并纳入语言、地区、账号和配置归属，不建立全站 App 索引或第二份用户库。

<a id="organization"></a>

## 内部组织与核验

```text
src/
├── node/
│   ├── entry.ts
│   ├── client/        # Store and Web API requests, parsing, pacing
│   ├── metadata/      # Identity, names, fields, images
│   ├── account/       # Configured identity and credential lifecycle
│   ├── import/        # Current lists and native ingest operations
│   ├── playtime/      # Explicit total comparison and adoption
│   ├── settings.ts
│   └── ipc.ts
├── webview/           # Metadata, Account, Import
└── shared/            # Pure private contracts and validation
```

client 内以 gateway.ts、store.ts、player.ts、validation.ts、types.ts 分责，分别承担传输、公开商店、本人记录与边界解析。业务文件使用 provider、identity、manager、mappers 等实际职责名，导入与时长采用由各自业务模块组织，通过本体既定操作提交。

验收覆盖完整与大规模清单、真实空库、私人不可访问账号、家庭共享、商店地区、语言回退、对象分类、愿望单采用与自动补齐、累计时长快照、配置更换、取消、任务和图片采用。各账号权限条件分别记录运行结果。

依据：[Steam Web API](https://partner.steamgames.com/doc/webapi_overview)、[IPlayerService](https://partner.steamgames.com/doc/webapi/IPlayerService)、[应用类别](https://partner.steamgames.com/doc/store/application)、[实际接口证据](../../../verification/evidence/game-sources/live-api.md)。
