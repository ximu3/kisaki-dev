# TMDB 范围、资料与账号核验

核验日期：2026-10-15—16。本文保存官方接口、公开页面和字段范围的来源核对。实际账号操作另见[本人接口实测](account-api.md)，产品规则由[TMDB 设计](../../../design/extensions/sources/tmdb.md)定义。

最初取得 v3、v4 官方 OpenAPI，读取公开说明，并核对《葬送的芙莉莲》和《你的名字。》的真实公开页面；[该轮结构化记录](2026-10-15-public-contracts.json)没有经过认证的 API 调用。随后使用用户提供的应用 key 完成[公开 API 与隔离游客评分实测](live-api.md)，另存[实际请求记录](2026-10-16-live-api.json)。两轮证据分别保留，不把官方示例改写成实测，也不保存凭据、完整简介或完整响应正文。

## 分季必须核对内容范围

TMDB 的[内容录入规则](https://www.themoviedb.org/bible/new_content?language=en-US)明确规定：动画续作沿用连续集号时，可以继续放在同一个 TMDB season；集号重新从 1 开始时才建立新 season。这是该来源的编目规则，不能用其他站点的季度编号直接套用。

本次《葬送的芙莉莲》的真实页面如下：

| 来源页面                                                                                                                                           | 观察到的范围                                         | 可以确认的事实                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| [TMDB Season 1](https://www.themoviedb.org/tv/209867/season/1?language=en-US)                                                                      | 38 集                                                | 这条 season 记录目前包含第 1–38 集，不能仅凭名称将其认作第一期 28 集              |
| [TMDB 生产季分组](https://www.themoviedb.org/tv/209867/episode_group/679231eba8ce3489ceb57efc?language=en-US)                                      | Specials 26 项、Season 1 共 28 集、Season 2 共 10 集 | 这是已有分组集合；特殊内容的归属和种类仍要分别核对                                |
| [生产分组中的 Season 1](https://www.themoviedb.org/tv/209867/episode_group/679231eba8ce3489ceb57efc/group/679231fba8ce3489ceb57f02?language=en-US) | 28 个不同分集链接                                    | 成员指向标准路径 `season/1/episode/1` 至 `season/1/episode/28`                    |
| [生产分组中的 Season 2](https://www.themoviedb.org/tv/209867/episode_group/679231eba8ce3489ceb57efc/group/695a8bc96d2b236ebdd7c4f9?language=en-US) | 10 个不同分集链接                                    | 成员指向标准路径 `season/1/episode/29` 至 `season/1/episode/38`，没有另造一套分集 |
| [TMDB Cours 分组](https://www.themoviedb.org/tv/209867/episode_group/64f988c1ffc9de00c4a24917?language=en-US)                                      | 16、12、10 集三个分组                                | 播出档期分组与生产季分组不同，不能见到分组就自动创建独立 Anime                    |
| [动画官网第二期公告](https://frieren-anime.jp/news/4739/)                                                                                          | 明确将第 29 话称为第二期首集                         | 官方发行季度与 TMDB 默认 season 的范围不同                                        |

动画官网公告的正文由网页检索收录取得，本次直接 HTTP 请求遇到访问防护。TMDB 上述页面直接请求均成功。对 `tv/209867/season/2` 的试探请求返回 404；结合成功读取的成员目录，可以确认这批第二期分集目前使用 Season 1 内的 29–38 编号。不能把这个 404 概括为 TMDB 不收录第二期或没有分组能力。

[Episode Group 详情合同](https://developer.themoviedb.org/reference/tv-episode-group-details)给出分组集合 ID、各子分组 ID、名称与顺序，并在成员中保留原来的 episode ID、season_number、episode_number、show_id 和分组内 order。分组内位置、来源季集号与分集身份是三种不同事实；排列变化不应创建另一条 Episode。

## 搜索与分组查询

[TV 搜索](https://developer.themoviedb.org/reference/search-tv)返回 TV Series；multi search 返回 movie、tv、person，没有独立的 season 或 episode-group 搜索。找到 TV Series 后，才可通过[该剧的 episode_groups](https://developer.themoviedb.org/reference/tv-series-episode-groups)列出分组集合，再用集合 ID 读取各子分组与分集。比如先找到《芙莉莲》，再找到 Seasons 分组集合，最后才得到其中 28 集、10 集的两个生产季分组。

这些接口描述来源的查询能力；Kisaki 接入的对象范围由[来源设计](../../../design/extensions/sources/tmdb.md#scope)定义。

## 标准季名称与字段

官方季详情示例的 name 为 Season 1；translations.data 只有 name 和 overview，季图片只返回 posters。字段摘录见[结构化核对](2026-10-16-season-search.json)、[季详情](https://developer.themoviedb.org/reference/tv-season-details)与[季图片](https://developer.themoviedb.org/reference/tv-season-images)。

## 适用的资料对象

| TMDB 对象                  | 可用资料                                                                        | 必须保留的边界                                                                  |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Movie                      | 名称、原名、翻译、简介、日期、片长、海报、背景与 logo、署名、制作公司、外部标识 | 仅接入适用动画；独立影片无需补造一集                                            |
| TV Series                  | 整剧名称、原名、翻译、简介、状态、起止播出信息、图片、公司、网络与整剧演职员    | 只作标准季查询上下文，不作为作品绑定目标；整剧字段不自动成为季资料              |
| TV Season                  | 季名、简介、首播日期、海报、分集及季范围的演职员                                | season 不保证等于原作宣传中的某期；不能照搬整剧总集数、状态或公司参与到单季     |
| Episode Group 中的具体分组 | 真实分组 ID、名称、顺序与明确成员                                               | 已排除接入；保留此项说明来源能力与取舍依据                                      |
| TV Episode                 | 集名、简介、日期、时长、剧照、季集号及分集署名                                  | 分集和附加内容的分类须有依据；零号季不等于全部都是 Extra                        |
| Person                     | 主名、未逐项标注语言的别名、传记、生卒日期、性别、图片、外部标识与影视署名      | 只采用本产品适用的作品关系；职业标签不能代替具体作品职责                        |
| Company / Network          | 独立主体 ID、名称、其他名称、官网、logo 等实际字段                              | 两种 ID 命名空间不同；制作公司列表不等于动画制作 studio，播出网络不等于制作公司 |

对象与字段依据 [v3 OpenAPI](https://developer.themoviedb.org/openapi/tmdb-api.json)。人物反查、公司检索和季内署名映射已按[正式规则](../../../design/extensions/sources/tmdb.md#participation)确认，本表不将全部上游字段声明为本体能力。

cast 中的角色文字和 credit_id 不能组成 Character 的独立来源身份。TMDB 可以提供人物参与事实与角色文字说明，但本次规格没有可供本扩展采用的独立角色档案接口。跨作品角色应由拥有真实角色身份的来源提供，不从名称相同推导。

[语言说明](https://developer.themoviedb.org/docs/languages)明确指出人物名称和角色文字存在本地化缺口。因此，作品的 `language` 与 translations 规则不能原样套到所有对象。人物的 also_known_as 也没有逐项语言标记，不能凭文字外观认定译名。实际作品名称和简介则可按来源翻译读取，本次已核对《芙莉莲》的中、英、日季页面及《你的名字。》中文页面。

[图片说明](https://developer.themoviedb.org/docs/image-languages)区分 poster、backdrop 和 still 的选择方式；`language` 会过滤 images，额外语言与无语言图片由 `include_image_language` 指定。图片本身目前不承诺地区语言变体，因此不能把 zh 图片标签直接当作经过验证的简体或繁体版本。

## 人物、组织与署名补充核对

2026-10-16 补充读取四份公开贡献规则，并从已有官方 OpenAPI 提取十一项接口摘要，见[补充核验记录](2026-10-16-people-organizations.json)。本次没有调用经过认证的资料 API 或账号写入接口；档案、名称搜索及署名范围的观察见下文。

人物支持名称搜索、档案和影视参与读取；搜索结果中的 known_for 不能充当完整参与名单。公司支持名称搜索，播出机构没有对应的公开名称搜索端点，但两者均可按各自身份读取档案、别名和图片。公司与网络使用不同资源命名空间。[人物](https://developer.themoviedb.org/reference/person-details)、[公司](https://developer.themoviedb.org/reference/company-details)、[播出机构](https://developer.themoviedb.org/reference/network-details)

[制作资料规则](https://www.themoviedb.org/bible/tv/59f73eb49251416e71000025?language=en-US)要求公司主名使用罗马字，原文字形可以存入别名，但接口没有逐项别名语言。production_companies 不应包含经销商或仅资助的主体，不过这份数组没有区分动画制作与其他制作职责；不能只凭公司出现在其中就断言 studio。networks 表达原始播出机构，并按季反映首播机构变化，不等于所有可观看平台。

[电影演职员规则](https://www.themoviedb.org/bible/movie/59f3b16d9251414f20000003?language=en-US)要求采用原版演员，排除译配、加长版和动作捕捉表演，并用角色文字中的 voice 标记配音。[TV 常驻演员](https://www.themoviedb.org/bible/tv/59f73eb49251416e71000022?language=en-US)按季定义，[分集演员规则](https://www.themoviedb.org/bible/tv/59f743289251416e71000037?language=en-US)要求演员出现在分集原版中。API 没有逐项配音语种字段。角色文字和 credit_id 没有提供独立角色档案的来源身份。

## 个人记录的真实粒度

| API 范围                           | 官方响应结构或操作                                            | 对本体的影响                                                     |
| ---------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Movie account_states               | 当前电影的 favorite、rated、watchlist                         | 只能对应同范围的独立动画作品                                     |
| TV Series account_states           | 当前整剧的 favorite、rated、watchlist                         | 不接入 TV 个人记录，不把评分、收藏或待看复制到任一季             |
| TV Season account_states           | `id` 与 `results[]`，成员为 episode id、episode_number、rated | 这是该季内分集的评分列表，不是单季评分、收藏与待看记录           |
| TV Episode account_states / rating | 单集评分及设置、删除评分                                      | 本体 Part 只有完成标记；单集评分不成为“已看”，也不回填成作品评分 |
| v4 自定义列表                      | 混合 movie、tv 成员及列表资料                                 | 只采用适用动画影片成员；TV 成员不导入，也不自动拆成季            |

季接口的网页摘要写着评分、待看和收藏，但其[实际响应定义](https://developer.themoviedb.org/reference/tv-season-account-states)只有分集评分；[整剧账号状态](https://developer.themoviedb.org/reference/tv-series-account-states)才有三个整剧字段。v3 规格也只列出 movie、TV Series 和 TV Episode 的 rating 写入路径，没有单季或分组评分路径。不能由通用文案推断不存在的能力。

正式范围不接受 TV 作为作品绑定目标，包括当前只有一个 season、已经完结或集数相同的情况。上层 TV 仍可用于查询标准季，但不因此开放 TV 个人记录导入或回写。

本次官方规格没有给出作品完成历史、已看次数、逐集已看、续播位置或实际观看时长的同义账号接口。已评分、加入收藏或加入列表都不能据此产生完成记录；影片 runtime 是资料片长。支持的个人字段须保持[本体记录模型](../../../design/domains/records.md)的含义。

[v4 列表详情](https://developer.themoviedb.org/v4/reference/list-details)与[添加成员合同](https://developer.themoviedb.org/v4/reference/list-add-items)明确了 movie、tv 成员和私人列表的用户授权要求。v3 的列表写入以 movie 为范围，不能仅用 v3 的添加电影接口声称支持混合动画剧集清单。

## 评分与待看

[评分写入说明](https://developer.themoviedb.org/reference/movie-add-rating)说明评分默认会将影片移出待看，账号设置可以改变这一行为；已核对的账号状态响应没有提供该设置。官方请求示例包含 8.5，但请求结构未给出完整值域和步长。

游客测试的半分值与异常小数更新见[接口实测](live-api.md)，本人半分值、待看联动和清理见[账号实测](account-api.md)。两类测试分别记录实际结果，HTTP 成功不能代替业务值回读。

## 应用认证与用户授权

资料读取使用 TMDB [应用认证](https://developer.themoviedb.org/docs/authentication-application)，与本人账号授权分开。v3 支持 API key 或 API Read Access Token；Bearer 形式可以跨 v3、v4 使用。已确认统一配置 API Read Access Token，保留项目默认与用户覆盖。凭据从个人账号的 API 设置申请，属于应用认证；填写令牌不代替本人授权，公开资料也仍需有效应用凭据。

已确认采用一次 v4 浏览器授权，取得本人 user access token 和 account object ID，再通过官方[转换接口](https://developer.themoviedb.org/reference/authentication-create-session-from-v4-token)取得必要的 v3 session。这样既能读取本人私人混合列表中的适用动画影片，也能调用实际仍属于 v3 的影片评分、收藏与待看操作；[连接总则](../../../design/extensions/private-data.md#authorization)已同步采用该方向。

v4 的[请求令牌](https://developer.themoviedb.org/v4/reference/auth-create-request-token)允许设置 redirect_to，[用户授权说明](https://developer.themoviedb.org/v4/docs/authentication-user)写明未使用请求令牌约 15 分钟失效，[访问令牌交换](https://developer.themoviedb.org/v4/reference/auth-create-access-token)仍需应用访问凭据。该流程不是 OAuth 授权码流程，不添加无来源依据的 PKCE、refresh token 或 scope。请求时的本机回调与实例核验仍遵守[共同授权边界](../../../design/extensions/private-data.md#authorization)。

本次公开资料核对未执行用户授权，后续独立结果见[账号实测](account-api.md)。v4 指南中有两条链接漏了版本路径，本次默认版本地址返回 404，而带 `/v4/` 的官方页面与 OpenAPI 均可读取；这是文档链接问题，不构成接口失效结论。

## 普通字段的补充核对

普通字段、图片、人物与组织参与、标签和分部范围整理为[字段核对](metadata-mapping.md)，依据见[补充核验](2026-10-16-metadata-mapping.json)。新增公开核对确认：影片默认主日期有院线上映优先规则，Released 可能提前四天设置，adult 主要用于硬核色情；这些来源语义不能不加区分地映射为本体首发、发行结束和一般敏感标记。

官方署名详情可以返回具体季，为人物反查提供实际范围；影片合集成员不能直接变成前传或续作。上述具体映射已写入来源设计。官方预设同时移除 TMDB 的附加内容清单与两类 Part.type 引用，保留已知分部的公共字段读取；已保存的用户资料方案不随预设定义修改。

## 实际接口核验

[实测报告](live-api.md)记录公开字段、搜索首部与末页、标准季和分集、人物及组织、署名范围、图片和评分往返。实际 Season 1 返回 38 集、已知第 29 集可直接读取；Network 清单存在重复身份，图片候选含 SVG，而详情的 PNG 地址可以取得有效位图。以上结果支持既有范围与按身份去重的要求。

评分新增与修改并不总有相同结果，回读还可能暂时保留旧值；不能只看 201 或 success=true。游客单片 Account States 返回 401／3，不能据此推断本人状态；本轮未连接本人账号，也未验证收藏、待看和私密列表。测试评分已执行删除，列表与延后复查恢复初始空态。游客测试不进入正式产品的连接选项。
