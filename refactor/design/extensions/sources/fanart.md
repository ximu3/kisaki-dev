# Fanart.tv 接入设计

Fanart.tv 通过官方 v3.2 图片 API 为已有作品、人物和组织补充图片，并提供明确目标的素材浏览。本文区分自动资料读取与用户选图，规定身份、用途、凭据和运行职责。

<a id="scope"></a>

## 图片补充与对象范围

Fanart.tv 负责已有对象的图片补充与独立素材浏览，不承担作品目录发现、人物档案建立、消费记录导入或同步。图片所属资源、原始用途和本地采用目标分别表达，图片选择不会自动生成来源绑定。

| 对象或入口       | 自动资料读取                                               | 独立图片候选                                                 |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| 已确认的动画影片 | 凭明确 Movie 身份补主图、背景、标题标志                    | 支持明确影片编号或来源链接                                   |
| 动画季度         | 不把 TV 容器或图片季标记构造成作品身份，不自动继承整剧图片 | 可按明确 TVDB 剧集编号浏览素材；明确季查询只取对应实际季标记 |
| 已确认的人物     | 凭明确 MusicBrainz Artist 身份补人物主图                   | 可按同一明确艺人身份浏览人物图片                             |
| 已确认的组织     | 凭明确 Artist／Label 身份补适用主图                        | 可浏览已对应团体或厂牌的图片、标志                           |
| 角色             | 不读角色档案，不创建角色身份或关系                         | TV 下的 characterart 只作手动主图素材，由用户判断图中对象    |
| 游戏、漫画、小说 | 不提供它们的根图片；已知相关人物／组织仍可定向补图         | 不把其他类别改装成这些对象的图库                             |
| 分部             | 不提供字段或内容目录                                       | 不增加独立 Part 图片搜索，也不按图族造分集或卷话             |

“影片”“人物”“组织”的本体类别由既有可靠对应确定。Artist 可能是个人或团体，Fanart 的实际响应没有这个区分；不能把每个 Artist 建成人物，也不从名称推断类型。Album、release group 和碟面图不带来音乐作品或轨道模型。

<a id="identity"></a>

## 明确身份与定位

source 使用 fanarttv，各资源沿下表的原生编号形成身份。

| 来源资源 | 实际查询依据                   | 本扩展身份用途                                               |
| -------- | ------------------------------ | ------------------------------------------------------------ |
| Movie    | TMDB Movie ID 或 IMDb title ID | 规范为 fanarttv 的 movie/{tmdbMovieId}，核对实际响应中的编号 |
| TV       | TVDB series ID                 | 只作为图片检索坐标，不作为 Anime 根身份                      |
| Artist   | MusicBrainz Artist UUID        | artist/{uuid}，仅用于已确认人物或团体的图片读取              |
| Label    | MusicBrainz Label UUID         | label/{uuid}，用于已确认组织的图片读取                       |

Movie 的明确编号可以由已有资料线索取得，resolve 核对真实资源后返回同一影片；只有名称或不适用的 TV 线索时返回 insufficientInput。不提供 Entry 名称搜索，不抓取全站更新列表建立本地搜索库，也不从图片标题推断动画类别或发行信息。

人物和组织只按已确认身份读取，不提供姓名搜索或从图库创建实体的定位建议。它们可以作为根对象，也可以通过当前 Work 上下文中的明确 relatedEntries refs 定向补图；无同源作品根记录不妨碍真实主体的图片读取。

源标题只用于识别已查询资源与图片候选说明，不输出 name、originalName、简介、日期、角色或职员关系等普通元数据。来源返回的 albums、技术时间、likes 和 image_count 不转为本地作品、日期或个人记录。

使用 TVDB／MusicBrainz 编号不要求安装相应扩展。编号必须已明确取得；本扩展不调用未选来源来猜测编号，也不要求用户另建上层 TV 条目。

<a id="images"></a>

## 图片用途

| 图片族                                                 | 本体用途                                         | 适用边界                              |
| ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------- |
| movieposter、moviethumb                                | Anime.primaryImage                               | 已对应影片的海报或主卡片图            |
| moviebackground、movie4kbackground                     | Anime.backdropImage                              | 已对应影片的实际背景图                |
| hdmovielogo、movielogo                                 | Anime.titleLogo                                  | 已对应影片的实际标题标志              |
| tvposter、tvthumb、tvsquare、seasonposter、seasonthumb | Anime.primaryImage 候选                          | 手动选择；保留整剧与具体季标记        |
| showbackground、show4kbackground                       | Anime.backdropImage 候选                         | 整剧素材手动选用，不声明为季度资料    |
| hdtvlogo、clearlogo                                    | Anime.titleLogo 候选                             | 同上                                  |
| artistthumb                                            | Person.primaryImage 或 Organization.primaryImage | 对象已明确为个人或团体                |
| hdmusiclogo、musiclogo                                 | Organization.primaryImage                        | 已对应团体的实际标志，不当人物肖像    |
| musiclabel                                             | Organization.primaryImage                        | 已对应厂牌的实际标志                  |
| characterart                                           | Character.primaryImage 候选                      | 仅手动素材选择，不提供 Character 身份 |

banner、clearart、碟面与专辑封面没有同义的本体用途，不按长宽或透明度硬塞到背景、标题标志或分部封面。以后扩展用途需要明确字段含义，不能仅因出现新图片类别就自动接入。

来源样本中，《芙莉莲》的 seasonposter 全部标为 all，《进击的巨人》同时包含明确季号、all 和缺失季号。all、缺失值和具体季分别保留，不把 all 当第一季，也不从图片名推断所属季度。季查询只选与所给季号相同的真实标记；同一季号也不单独证明与本地独立作品的内容范围相同。

手动素材浏览沿既有“用 B 的图片替换 A”规则：只修改用户指定的图片字段，不创建 B、不绑定 B 的身份，也不读取或覆盖其他字段。因此整剧背景或人物组合图可以作为用户明确选择的素材，但不能经普通资料读取自动变成季度或角色事实。

<a id="browse"></a>

## 查询、语言与预览

独立图片候选使用现有 query 输入，接受有资源种类的明确坐标，例如 movie/372058、movie/tt5311514、tv/424536、tv/267440/season/2、artist/{uuid}、label/{uuid}，也可解析对应的已知来源链接。纯数字存在资源种类歧义时不猜测；没有名称搜索能力时不把名称查询伪装成空图库。

当前 API 一次按资源返回图片数组，接入按需取得结果，再按请求用途、语言及实际范围分批交付候选。游标只在同一查询与配置的结果中续读，普通字段 read 则返回本次所选用途的完整结果。来源检索使用明确资源坐标。

图片的语言精度沿来源保留，00 表示来源声明无语言，空值保持未知；zh 不自动成为简体或繁体。语言选择沿本体规则，同等条件使用实际 likes 和稳定图片身份组织顺序。likes 不代表用户评分或质量保证。

固定使用 v3.2，正确读取字符串形式的尺寸、likes、季号及数组形式的 albums。未知图片族保持为未映射，不动态扩展本体字段；缺少单张图片的可选信息不伪造 0、false 或署名。整个已支持资源请求失败时不能用空数组掩盖。

原图使用 API 的真实 URL。官方 CDN 的 preview 与 bigpreview 只是同一原图的较小预览，分别用于约 200、400 像素的展示；二者不成为独立候选，原尺寸也不能冒充预览尺寸。只有确定的 Fanart CDN 地址按官方规则生成这两种预览地址，不对任意 URL 做路径替换。

API 实测没有返回图片作者或逐图许可字段，不用 Artist 名称猜上传者，不把 SDK 的 MIT 许可或接口说明的许可声明套到所有图片上。保留可确认的来源与原图链接，素材权利按实际来源说明处理，不生成虚构归属。

<a id="settings"></a>

## 凭据与一个配置页面

只注册“资料采集”页面，使用既定 Solid 与基础 UI。提供项目配置状态、可选个人 key、保存／移除、连接测试、超时和安全读取重试；实际图片查找与采用沿本体共享界面，不另建图库页面、账号登录页或同步页面。

官方区分项目 key 与个人 key，申请入口为 [Get an API key](https://fanart.tv/get-an-api-key/)。正式扩展由维护者准备项目 key，用户可以填写个人 key；不要求普通用户为应用申请项目 key。

有效个人 key 可以单独以 client-key 访问。项目与个人 key 同时存在时按来源协议发送，当前访问身份纳入缓存归属；没有有效访问配置时明确报告。官方说明中的新图可见延迟属于来源条件，不能保证实时，也不把付费 VIP 当作基础能力。

key 使用 secrets，界面只取得配置状态。凭据只发送到 API，不发给图片 CDN；保存、测试、移除和恢复普通设置分别操作。默认超时 20 秒，安全读取重试 2 次，429 尊重 Retry-After；固定 v3.2，不增加旧协议回退或版本切换器。

Fanart 没有可用的 NSFW 图片筛选合同，不提供一个实际无效的开关，也不把无标记写成作品或人物的非敏感声明。姓名、字段语言和资料优先序不在来源页面重新配置。

<a id="organization"></a>

## 内部组织

```text
src/
├── node/
│   ├── entry.ts
│   ├── client/
│   │   ├── gateway.ts
│   │   ├── validation.ts
│   │   └── types.ts
│   ├── metadata/
│   │   ├── provider.ts
│   │   ├── identity.ts
│   │   ├── lookup.ts
│   │   └── images.ts
│   ├── settings.ts
│   └── ipc.ts
├── webview/
│   ├── index.html
│   ├── entry.tsx
│   └── settings/
└── shared/
    ├── contracts.ts
    └── validation.ts
```

client 解释本来源请求、凭据方式和响应；metadata 拥有资源种类、用途及人工素材与自动资料的界线。图片字节准备由本体负责，各扩展按自身来源范围组织客户端与资料映射。

官方客户端用于核对来源合同；其当前构造器要求 apiKey，而实际 API 已支持个人 key 单独访问。本实现使用直接、可取消的 HTTP 调用覆盖已核验方式，不借兼容别名或错误文字分支补协议。

<a id="核验要求"></a>

## 预设与验收

来源依据见[只读核验](../../../verification/evidence/artwork-sources/live-api.md)。

验收覆盖字段范围、明确身份读取、人工选图不绑定、语言、缓存归属、取消和附件采用。动画预设选用 Fanart 时，其根图片读取仅适用于已确认影片；剧集素材通过独立选图入口使用。预设定义明确此范围，字段优先序由预设定义，用户保存的方案不自动改写。

参考：[官方 API](https://api.fanart.tv/)、[官方客户端](https://github.com/fanart-tv/fanart.tv-api)、[提供者合同](../providers.md)、[手动图片选择](../../domains/metadata.md#search)、[附件合同](../../domains/attachments.md#images)。
