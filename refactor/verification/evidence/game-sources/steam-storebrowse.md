# Steam 结构化商店接口覆盖核验

2026-10-16，针对“StoreBrowse 能否取代旧 Store 接口”补充核验。依据是 Steam 商店页面实际引用的官方前端 JavaScript 中的协议定义，以及直接访问 Steam API 的结果；没有执行下载的 JavaScript，也没有使用个人 key、账号令牌或 cookie。

本轮完成 16 次匿名 GET，全部 HTTP 200；另读取一个 Steam 商店页面及其两个官方 JavaScript 文件。请求与必要结果投影见[结构化证据](2026-10-16-steam-storebrowse.json)。接口可访问与本体运行验收仍是不同阶段。

## GetItems 的实际覆盖

官方前端定义了 StoreBrowseItemDataRequest，可以按需请求不同字段，而不必取得整个商店对象。

| 数据组     | 实际字段或选项                                     | 核验结论                                                       |
| ---------- | -------------------------------------------------- | -------------------------------------------------------------- |
| 基本资料   | name、type、basic_info                             | 名称、应用类别、短简介与开发／发行署名均可读取                 |
| 完整介绍   | include_full_description → full_description_bbcode | 英文样本 1,175 字符，简体 189 字符；返回 BBCode，不只是短简介  |
| 发行信息   | release                                            | 与前轮相同，原始发行与 Steam 发行分别表达                      |
| 图片与媒体 | assets、screenshots、trailers                      | 包含素材与可选截图／预告数据；Kisaki 仍只采用既定图片用途      |
| 语言与平台 | supported_languages、platforms                     | 结构化语言支持与系统平台；不表示原作语言                       |
| 标签与分类 | tagids、tags、categories                           | 实际应用标签与功能分类，名称通过对应接口读取                   |
| 购买和统计 | purchase_options、reviews、game_rating             | 协议提供相应读取选项，具体项目可能缺席；不成为用户私人记录     |
| 更多详情   | extra_details                                      | 实测有官网等链接、系统要求、版权说明等结构；不扩大本体对象类型 |

简体完整正文与英文不同，日文请求的完整正文与英文相同；结构化接口仍有真实语言回退。请求更多字段不会保证每个 App 都有对应值。

一次 GetItems 请求混合主游戏、音乐、DLC、demo 和不可用编号，分别返回对应记录与状态。样本中 Game.type=0、demo=1、DLC=4、music=11；它们的 item_type 都是 App 的 0。不能只看 item_type 就把所有应用当成游戏。

不可用编号仍占一个返回项目，success=15、visible=false、appid=0；其他正常项目 success=1。HTTP 200 不能代替逐项成功检查，也不能按数组位置或 appid=0 将失败项对应给另一个目标。单项不可用不抹掉同批正常结果。

## 名称搜索属于 StoreQuery

StoreBrowse.GetItems 按明确编号读取；名字搜索由 IStoreQueryService/SearchSuggestions 承担，返回同一套 StoreItem 结构。

实测只设置 type_filters.include_games=true 时，CLANNAD 返回两部游戏，已经排除漫画、画集和音乐商品。若同时设置 include_apps=true，就会扩大到其他 App 类型；不能把两个开关当作层层收紧条件。

| 名称查询          | 返回数量 | metadata.total_matching_records |
| ----------------- | -------- | ------------------------------- |
| CLANNAD，仅游戏   | 2        | 2                               |
| a，max_results=20 | 20       | 31,015                          |
| a，max_results=50 | 50       | 31,015                          |
| 明确无匹配词      | 0        | 0                               |

这些是本次样本，不是全站永久数量。相比旧 storesearch 的最多 10 项和模糊 total，新接口能明确表明当前建议未覆盖全部匹配；不能据此宣称名称建议可以任意分页。

官方前端的 SearchSuggestions 请求没有 start、offset 或 cursor，只有 max_results 等选项。名称搜索保持有界建议，当前方案最多请求 50 项；总匹配数大于完整返回候选时，名称 resolve 返回 insufficientInput，独立搜索不伪造下一页。

## 条件查询与名称建议不同

IStoreQueryService/Query 支持 start／count 和类型、标签、发行条件等筛选。仅游戏条件下，本次 start=0 与 start=3 分别返回不同的三个 App，元数据中的 start 与 count 对应正确。

其查询结构没有名称搜索字段。不能把 Query 的分页能力移植到 SearchSuggestions，也不能为了补齐名字搜索而抓取全站目录。本轮只核验该能力，不给 Kisaki 增加全站浏览或镜像模块。

## 标签与功能分类

IStoreService/GetLocalizedNameForTags 按实际 tagids 返回名称；本次英文、简体都完整返回所请求的 20 个标签，简体包含“视觉小说”“动漫”“剧情丰富”等实际翻译。

IStoreBrowseService/GetStoreCategories 返回 72 条实际功能分类及名称，英文与简体均可读取。标签 ID、功能分类 ID 与 genreids 有各自含义，不混用字典，也不把数字直接当标签名称。

样本请求 20 个和 100 个应用标签时均返回 20 项；这不能证明所有游戏或接口的全局上限。采用的是来源公开展示的标签范围，不宣称穷尽全部用户标签投票。

## 对当前方案的修正

已确认 Steam 设计采用以下读取路径：

- GetItems 负责已知目标的普通资料、完整正文和图片，并支持有限批量读取。
- SearchSuggestions 负责有限名称建议与游戏类型过滤。
- GetLocalizedNameForTags、GetStoreCategories 负责所需标签和功能分类名称。
- 本人资料、拥有库与愿望单仍分别使用相应的账号读取接口。

旧 appdetails、storesearch 留作本轮比较证据，不再是运行依赖或自动回退路径。正文适配从清理 HTML 改为将 BBCode 转为共同 Markdown；来源输入仍须经过正常的内容、图片与字节边界。

这套组合覆盖当前 Kisaki 已计划的 Steam 元数据能力。它不表示两个接口的每个字段都一一同名，也不代表 Steam 对这些前端接口提供了与正式第三方文档相同的稳定性承诺。完整实现仍需覆盖批量上限、逐项失败、丰富正文、取消和真实界面采用。

官方原始依据：[Steam 商店页面](https://store.steampowered.com/app/324160/)、[本次页面引用的前端协议代码](https://store.akamai.steamstatic.com/public/javascript/applications/store/main.js?v=_0Z8Efjhiq37&l=english&_cdn=akamai)。源码 URL、内容哈希及提取字段记录在结构化证据中，不以第三方协议镜像作为运行依赖。
