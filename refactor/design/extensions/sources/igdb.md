# IGDB 接入设计

IGDB 通过官方 v4 API 提供游戏、角色、公司、关系和图片资料。本文规定真实对象范围、字段与关系采用、完整读取及应用凭据管理。

<a id="scope"></a>

## 资料范围

| 对象                      | 搜索与定位                                    | 读取范围                                                       |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Game                      | 名称查询、明确 IGDB 身份、已核实的 Steam 对应 | 普通字段、四类图片、直接作品关系、角色关联与组织参与           |
| Character                 | 有效角色名称与明确身份                        | 实际角色字段、肖像、适用作品关联                               |
| Organization              | 公司名称条件查询、明确公司身份                | 名称、介绍、标志、成立日期、网站与真实作品参与                 |
| Person                    | 不提供                                        | 不把 Twitch／IGDB 用户、编辑者或公司名单当作通用人员与配音资料 |
| Anime、Comic、Novel、Part | 不提供                                        | 游戏目录里的 Episode、Season 不变成动画季或分集                |

该扩展只做资料读取，不提供本人收藏、游戏库导入、评分／状态回写或持续同步，也不调用 IGDB 的数据编辑、报告或 webhook 注册接口。一个“资料采集”页面即可完成应用凭据配置与读取测试。

<a id="identity"></a>

## 身份、类别与名称

source 使用 igdb，身份分别为 game/{id}、character/{id}、company/{id}；game_type、image_type、地区、平台和来源系列的编号不是条目身份。已不存在或改变归属的源记录不会自动迁移已有绑定。

Main Game、明确的 DLC／Expansion、Standalone Expansion、Mod、Remake、Remaster、Expanded Game、Port、Fork，以及可独立管理的游戏 Episode／Season，按实际游戏记录解释为 Game。Episode／Season 保留游戏含义，不建立 Game Part，也不进入动画模型。Bundle、Pack / Addon、Update 以及普通购买版本不作为自动新建目标；购买组合不能仅因有独立 IGDB ID 就变成合编作品。未知类型不默认当 Main Game。

parent_game 与 version_parent 不构成无条件身份等价。本次 Steam App 324160 明确对应 IGDB 262492，其 Port 父链最终到达 9607；接入保留实际命中的移植记录，不能沿父链把这些编号全部绑定为同一作品，也不能把原作日期与移植日期拼成一份记录。已独立管理的移植、重制和高清版可以使用本体现有作品关系。

Steam 对应通过 external_game_sources 的真实 Steam 类型及 external_games 的 uid 核对，必须确认返回记录的 game 归属。一个线索命中多个适用记录时返回候选，不选首项。普通商店链接、父级关系和相似名称不能代替这项核验。

游戏名称使用有效的全文搜索，组织名称使用 name 条件查询并稳定分页。companies 的 search 在已核对样本中无法取得相应组织，不能用其空回答判断组织不存在；查询依据见[实际核验](../../../verification/evidence/game-sources/live-api.md)。名称输入按 APICalypse 字符串与通配符规则编码，不允许查询片段注入。

名称 resolve 将完整的本次候选交给共同 matching；范围过宽、达到读取预算或读取中断时返回 insufficientInput 或实际失败，不以首项宣布唯一。独立搜索使用真实 limit／offset，保留来源顺序和实际续读位置；过滤当前不适用类型后继续处理原始页，不把过滤后的空页当结束。

<a id="fields"></a>

## 普通字段与语言

| 对象／来源值                                            | 采用约定                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Game.name                                               | 实际主名；不据英文数据库名称推断原名                                                           |
| alternative_names、game_localizations                   | 保留实际别名与地区名称；地区不等于语种，也不能自动认定为原文名                                 |
| summary、storyline                                      | 作为有区别的简介内容去重整理，不增加自动翻译或固定多语正文承诺                                 |
| first_release_date、release_dates                       | 核对当前 Game 的发行范围与 date_format，保留年、月、日实际精度；不以数据库更新时间充当发行日期 |
| genres、themes、keywords、模式与视角分类                | 按明确含义提供标签，不作为本体类型或个人偏好                                                   |
| Erotic 主题                                             | 只在实际存在时提供 isNsfw=true；缺席不清除本地敏感标记                                         |
| language_supports                                       | 语言支持，不写 originalLanguages                                                               |
| Character.name、akas、description、mug_shot             | 对应名称、别名、简介与肖像；不存在的身体数据不推断                                             |
| Character.character_gender                              | 按实际分类映射 male、female、other；未知不写 other 或 genderless                               |
| Company.name、description、logo、websites               | 实际组织名称、简介、主图和网站                                                                 |
| Company.start_date、start_date_format                   | foundedDate，保留日期精度；合法的 1970 年以前时间戳不能当成缺失                                |
| Company.change_date、changed_company_id、parent、status | 不当作解散日期、同主体别名或合并指令，不建立组织背景关系图                                     |

季度日期最多保留已知的年份，不虚构月初、季末或某一天；TBD 保持未知。first_release_date 与某个发行记录冲突时须保留范围并按实际证据处理，不能把所有平台版本取最小值后宣称属于当前独立作品。

IGDB 的基本正文通常来自其实际数据库文本，game_localizations 提供地区名称和适用封面，不能据此承诺四种语言都有简介。来源未声明语种的名字保持该精度；资料语言偏好不能改变身份、编造译名或推导原作语言。

公共评分、热度、关注数、game_time_to_beats、系统时间和用户账号均不成为本地个人记录、实际游玩时长或游戏总时长。不提供付费数据集、全站镜像和远程媒体下载任务。

<a id="relations"></a>

## 角色、组织与作品关系

角色范围遵守[本体 Character 定义](../../domains/catalog.md#characters)。自动发现只采用来源明确归为 Human、Alien、Animal、Android 的适用角色；未分类、Unknown 和占位资源不自动创建对象或关系。已经明确为 Character 的真实身份可以定向补字段。实测角色目录含名为 Additional voices 的未分类占位项，不能仅因位于 characters 端点就作为角色收录。

角色的 games 表达作品关联，不表达本作主角、配角或声优。没有明确 role 时保持缺席，不从出现顺序、肖像或简介推断定位。当前 Game 的角色名单按 games 条件完整查询，相关人物与配音不从其他账号表补造。

组织必须是实际组织主体，不能从名字将明确的个人或占位项强制建立为 Organization。Company 的社区编辑记录和发行署名不变成人物资料。

| involved_companies 的明确事实 | 本体组织参与              |
| ----------------------------- | ------------------------- |
| developer                     | developer                 |
| publisher                     | publisher                 |
| porting                       | other，并保留移植工作说明 |
| supporting                    | other，并保留协力工作说明 |

同一组织可以有多个实际职责；porting 与 supporting 同属 other 时合并保留说明，不复制相同业务键。不把 porting 偷换成开发或本地化，也不从一个组织通常经营的业务推导本作职责。反查作品优先查询 involved_companies 的公司归属与全部布尔职责，不只拼接 developed／published 缓存列表。

作品关系只映射已明确的 remake、remaster、port、expansion 及各自反向含义，并核对两端实际游戏对象。similar_games 是推荐，不写作品关系；collections、franchises 与 membership 不生成两两续作关系，也不自动创建用户合集。fork、普通版本和来源 series 的存在不提供新的关系类型。

Game 中的主体与关系、从 Character／Organization 反查的作品以及明确 refs 的字段读取，都沿共同 read 范围交付。完整关系只表示该来源本次适用范围，不扩张成现实中的全部参与者；不能借节点缺少可选介绍而丢掉已取得的有效参与事实。

<a id="images"></a>

## 图片能力

| 来源用途                                                          | 本体字段                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| covers 中实际主封面、替代封面、历史封面、方形封面与适用本地化封面 | Game.primaryImage                                             |
| 普通 Artwork／Key art 与作品截图                                  | Game.backdropImage 候选，保留原分类；标志、图标和信息图不混入 |
| logos 中的彩色／黑／白游戏标志与历史标志                          | Game.titleLogo                                                |
| artworks 中明确标为 Icon／Historical icon 的资源                  | Game.iconImage                                                |
| character_mug_shots、company_logos                                | Character／Organization.primaryImage                          |

image_types 的 16 种分类按实际用途接入，其中 logos 与带 Icon 标记的 artworks 均有正向样本。图标必须来自适用的来源图片，不能从任意封面裁出；未知分类不自动接入其他用途。

字段读取交付所选用途的完整候选；独立选图按当前来源目标与实际分页续读。游戏 logo、公司 logo 和角色肖像分开查询，名字相同不代表同一资源。

按实际 image_id 和已核实的 IGDB CDN 规则取得原尺寸与预览规格，保留透明度。实测 .jpg 地址可以返回 PNG，不能按扩展名决定解码器；有透明度的标志已验证可用 PNG 读取。原图、可选缩略与动画继续沿[公共图片能力](../../domains/attachments.md#images)处理，不使用 WebM，也不把小图当作已取得原图。

<a id="reads"></a>

## 完整读取与当前协议

普通数组必须完整覆盖本次来源范围，不能依赖默认 10 项或只读第一页。查询显式指定字段、limit 和稳定排序；分批上限不超过接口允许的 500，4 次／秒与最多 8 个进行中请求是同一应用凭据的整体限制，所有内部子查询共同调度。

反向关系和图片集合按其拥有者字段查询并完成分页。父记录缓存的编号数组只是线索：本次 CLANNAD 列出 6 个 external_games 编号，其中 2 个已经读不到，按实际 game 归属查询得到 4 条记录。使用完整的归属查询确认当前事实，不从悬空编号制造网站身份，也不将一次不完整的 by-id 读取冒充完整名单。

必要请求失败时沿公共 ExecutionFailure 和合法 partialResult 交付独立已完成资料；空数组只表示成功读取的当前范围确实为空。未知字段、未知分类、来源记录缺失和权限失败分别处理，不通过错误文案分支。

采用当前 game_type、game_status、character_gender、character_species、date_format、release_region、external_game_source、image_type 等字段及对应字典，不加入旧 category／gender／species／artwork_type 形状的兼容分支。来源字典只是有界客户端数据，不成为本体动态类型注册表。

<a id="settings"></a>

## 应用凭据与一个页面

用户配置自己的 Twitch Client ID 与 Client Secret，使用 client_credentials 获取应用访问令牌。它不代表用户登录，也不授予私人游戏列表或评分权限。正式配置保留用户覆盖能力；不将维护者的保密 Client Secret 作为默认值写入扩展制品，也不为免配置而新增代理服务。

Client Secret 和令牌由 secrets 保护，界面只取得配置状态。令牌缓存纳入当前 Client ID 与凭据修订，按 expires_in 提前重新取得；这条流程不使用 refresh token。并发刷新合并，401 最多触发一次重新取令牌后的安全查询，不能无限循环或继续使用旧配置。

“资料采集”页面提供凭据配置、保存、移除、联网测试和网络设置。默认单次超时 20 秒，安全读取重试 2 次，429 尊重 Retry-After；限流和并发由扩展内部调度。保存、测试与采集分别触发，移除秘密与恢复普通默认值分别操作。

资料按正常范围接纳来源的情色主题记录。语言与来源优先序由本体方案确定；扩展按实际参数缓存本次查询所需的数据。

本扩展使用已经核实、可以免费取得的普通查询能力，商业使用遵守官方合作流程。运行依赖限定于这些公开能力和现有配额；付费数据集、合作方专享 dump 及额外配额在本方案范围之外。

<a id="organization"></a>

## 内部组织与验收

```text
src/
├── node/
│   ├── entry.ts
│   ├── client/        # HTTP queries, dictionaries, authentication, pacing
│   ├── metadata/      # Game, character, company, images, relations
│   ├── settings.ts
│   └── ipc.ts
├── webview/           # One Metadata page
└── shared/            # Pure private contracts and validation
```

client 的 gateway、auth、query、validation、types 分别承担相应职责；metadata 按实际游戏、角色与公司能力组织。私有 IPC 仅转发完整配置和测试操作，页面使用既定 Solid 与基础 UI。IGDB 请求及来源数据解析由 Node 侧 client 负责。

验收覆盖全部字段、相关节点与 refs、名字转义、取消与限流、配置更换、图片处理和附件采用。来源接口证据与完整扩展的结果分别记录。

依据：[IGDB 官方接口](https://api-docs.igdb.com/)、[Twitch 应用令牌](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow)、[本体关系含义](../../domains/relations.md)、[实际核验](../../../verification/evidence/game-sources/live-api.md)。
