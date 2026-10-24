# Steam 与 IGDB 真实接口核验

本页保留首轮接口比较证据。后续[结构化商店核验](steam-storebrowse.md)已验证完整正文、标签及名称建议，当前 Steam 草案改用相应组合；下文的 appdetails、storesearch 样本不再表示运行依赖。

核验日期：2026-10-16。测试使用用户明确提供的 Steam 及 Twitch 应用凭据，只在核验进程内处理。结果覆盖以下来源读取、认证和资源样本。

共 59 次 API／认证调用，其中 Steam 21 次、IGDB 36 次、Twitch 2 次；58 次 HTTP 200，一次 401 来自对未标明种类的 Twitch 输入进行令牌验证。后续将其作为 Client Secret 换取应用令牌成功，实际 IGDB 查询全部读通。另有 8 次公开图片 HEAD，均为 200；没有下载完整图片或验证本体解码。

## Steam 本人读取

| 检查                    | 结果                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| 本人编号与 profile 响应 | 返回实际配置目标，身份一致；报告不保存编号、名字或头像                       |
| GetOwnedGames           | 声明与实际均为 42 个不同 App；累计分钟数均为非负整数                         |
| 拥有范围再次核对        | 显式排除家庭共享与 free-sub 扩展范围后仍为 42 项；没有 family_shared=true 项 |
| GetWishlist             | 50 个不同 App，实际字段为 appid、date_added、priority                        |
| GetWishlistItemCount    | 50，与本次完整响应一致                                                       |
| 空 App 过滤             | response 只有 game_count=0，没有 games；证明不能把缺少 games 一律报为私密库  |

空过滤不是空账号，也不是私密账号样本。本次正常账号的读取无法证明其他隐私条件；公开个人主页本身也不证明拥有库可读。没有请求或保存完整私人清单的持久副本，没有发起任何平台写入。

GetSupportedAPIList 实际提供了 IPlayerService、IWishlistService 的读取方法与参数。愿望单的普通完整读取没有 page 参数；另有带复杂上下文的 SortedFiltered 方法，本方案没有借它伪造现有端点的分页。

## Steam 商店对象与语言

CLANNAD 名称建议返回 7 个 App，其中包含主游戏、Side Stories、两张音乐作品、漫画、画集和相关音乐商品。宽泛查询返回 10 项且 total=10，额外 start／count／page 参数没有改变 ID 序列。无结果查询返回 total=0、items=[]；缺失应用的 appdetails 返回 HTTP 200 与 success=false。

| 公开样本                   | 真实结果                         |
| -------------------------- | -------------------------------- |
| CLANNAD 324160             | type=game；商店日期 2015-11-23   |
| Original Soundtrack 416930 | type=music；fullgame 指向 324160 |
| Anthology Manga 519110     | type=dlc；fullgame 也指向 324160 |
| Danganronpa V3 Demo 589120 | type=demo；fullgame 指向 567640  |

因此 DLC 不等于游戏扩展作品，fullgame 不证明两个 App 身份等价。商品目录中可见音乐或漫画，也不扩大 Steam provider 的本体条目类型。

同一 CLANNAD 的英文、简体、繁体、日文请求均成功。简体正文与英文不同；日文与繁体正文和英文完全相同，已用文本哈希核对，没有把正文保存在报告中。支持语言字段是商店呈现的游戏语言能力，不表示原作语言。

公开 IStoreBrowseService/GetItems 无 key 读取成功，返回 basic_info、assets、release 等实际字段。其 release 分别给出 original_release_date 与 steam_release_date，本样本对应 2004-04-28 与 2015-11-23。basic_info 中的开发／发行方还有 creator_clan_account_id，这是创作者社区账号引用，不能直接声明为现实主体资料库身份。

## Steam 素材

GetItems.assets 返回实际文件名、asset_url_format、不同尺寸的主胶囊、header、library_capsule、library_hero、raw_page_background 和 community_icon。没有返回游戏标题标志字段，本方案不通过猜文件名声称支持 titleLogo。

header、原始背景、2×库封面、2×库背景与社区图标的 HEAD 均成功，均为 JPEG。本次库封面 154,432 字节、库背景 416,124 字节，数字仅表示此次素材。CDN 请求不带 API key；尺寸规格不作为多个不同图像候选。

## IGDB 对象、查询与归属

| 检查                                   | 真实结果                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| name="CLANNAD" 精确过滤                | 0；源主名为 Clannad，不能以大小写精确查询代替名称搜索             |
| 游戏全文搜索 clannad                   | 11 个结果，包含普通游戏、Port、Episode 和 Bundle                  |
| external_game_source=Steam、uid=324160 | 返回 game=262492，属于 Port                                       |
| 该记录父链                             | 262492 → 262489 → 262473 → 9607；各自保留真实游戏记录             |
| companies 的 search 子句               | Key 与 Nintendo 均返回 0                                          |
| companies 的 name 条件                 | 精确不区分大小写匹配 Key 得 3031；Nintendo 包含查询得到 47 项     |
| 组织分页                               | offset 0／20／40，分别 20／20／7 项，计数端点为 47                |
| Key 组织参与                           | involved_companies 返回 64 条不同游戏参与，包含实际开发和发行职责 |
| 不存在的游戏编号                       | HTTP 200、[]                                                      |

普通查询不能绕过来源真实范围。特别是 Steam 对应的游戏记录不是原作 9607；父链和名称相近都不能作为无条件同一身份的依据。

CLANNAD 主记录列出 6 个 external_games 引用。按编号读取和扩展只返回 4 条，其中 41013、1304831 当前不可读；按 game=9607 的拥有者查询也返回同样的 4 条。方案据此以实际归属查询完成集合，不补造悬空编号对应的网站或错误地复制旧映射。

## IGDB 字段与角色

CLANNAD 有来源 summary／storyline、真实发行记录、地区本地名、语言支持和公司参与。game_localizations 的 name 与 region 没有直接给出原作语言；release_dates 已使用 date_format、release_region。公司成立日期有年精度和早于 1970 年的合法样本，不能简单要求时间戳为正。

角色按 games 条件可读取并分页，CLANNAD 的当前计数为零。另取得带明确性别、物种与肖像的角色样本；实际字典仍区分 Male、Female、Other，未知不能擅自写为 Other。

characters 中的 id=2 名为 Additional voices，完整读取确认没有 character_gender、character_species 或 mug_shot。它是不可据资源路径自动接纳的占位样本；方案将未分类资源排除在自动角色发现之外，不以姓名或简介猜测人格。

Erotic 主题实际编号为 42。这里只提供来源明确的正向主题信息，不将没有该主题解释成确定的非敏感声明。

## IGDB 图片

当前 image_types 返回 16 个实际类别，覆盖主／历史／替代／方形封面、Artwork／Key art、不同颜色的游戏标志、Icon 及历史类型。

- logos 端点取得透明黑／白标志的正向样本；CLANNAD 自身当前没有 logo，是正常的特定对象空结果。
- artworks 中 image_type=Icon 取得正向样本；相同条件在 covers 与 logos 返回空，不把字典中存在的类别当作每个端点都实际有图。
- company_logos 返回 Key 的实际组织标志；角色肖像使用独立资源，不与游戏标志混用。
- IGDB 原尺寸封面、透明标志 PNG 与图标的 HEAD 全部成功。图标 URL 后缀为 .jpg，实际 Content-Type 为 image/png，验证了不能按后缀决定媒体类型。

这里只做 HTTP 与资源类型检查。透明度字段、图片头和尺寸提示不能代替实际解码、预算控制或最终附件采用验收。

## 证据范围与后续

[结构化记录](2026-10-16-read-only.json)保存请求类别、状态、必要公开字段和个人读取汇总，不包含 key、Client ID、Client Secret、令牌、本人 SteamID、完整私人清单或原始响应正文。应用令牌只用于本次读取，没有调用数据编辑、收藏、评分、愿望单写入或网页会话接口。

尚未验证私密不可访问、真实空账号、家庭共享和大规模本人清单；未刻意触发限流。完整扩展、页面、任务、自动导入、时长采用、本地资料写入、图片解码和资源释放在实现后验收。

来源：[Steam Web API 概览](https://partner.steamgames.com/doc/webapi_overview)、[IPlayerService](https://partner.steamgames.com/doc/webapi/IPlayerService)、[Steam 应用分类](https://partner.steamgames.com/doc/store/application)、[IGDB 官方文档](https://api-docs.igdb.com/)、[Twitch 应用令牌](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow)。
