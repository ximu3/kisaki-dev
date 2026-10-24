# RanobeDB 接入设计

RanobeDB 提供小说系列、内容单册、发行及制作资料。本文区分 Series、Book、Release 与已明确主体的含义，并规定读取、字段、图片和配置；个人导入与同步不在接入范围内。

<a id="scope"></a>

## 职责与页面

| 能力     | 终态方案                                                                                |
| -------- | --------------------------------------------------------------------------------------- |
| 小说作品 | Series 的搜索、定位、普通资料、直接作品关系、标签与真实单册目录                         |
| 卷与发行 | Book 的单册资料；按明确范围采用 Release 的页数、ISBN、链接和图片                        |
| 人物     | 已经明确为 Person 的 Staff 档案及其自身原作制作履历；不自动发现混合主体                 |
| 组织     | Publisher 档案、出版社与出版品牌的实际参与；已经明确为组织的 Staff 团体自身履历         |
| 图片     | 真实 Book／Release 封面，以及来源为 Series 选用的代表封面；没有背景、标题标志或档案图片 |
| 本人接入 | 不提供账号、清单导入或持续同步；公开个人 API 缺少完整读取能力                           |
| Webview  | 一个“资料采集”页面                                                                      |

扩展接入 RanobeDB 的小说资料，公开读取使用固定的官方 v0 API，无须本人账号。其他媒介超出本扩展范围。个人接口的能力与接入边界见[个人接口边界](#account)。

<a id="identity"></a>

## 对象与身份

source 为 ranobedb，sourceId 带真实资源类别与规范十进制编号：

| 来源资源       | 本体含义                                                               |
| -------------- | ---------------------------------------------------------------------- |
| series/<id>    | 对应范围一致的 Novel；不能将包含多个独立作品的任意分组直接作为一部作品 |
| book/<id>      | 有内容身份的单册；分卷作品中的明确单册对应 NovelVolume                 |
| release/<id>   | 出版发行记录，不创建 Edition、Publication 或第二个根条目               |
| staff/<id>     | 来源混合主体；只为已经明确分类的 Person 或 Organization 读取           |
| publisher/<id> | 出版社或独立署名品牌，分别对应真实 Organization                        |

Series、Book 与 Release 不按名称互换身份。一个 Book 可以有多个语言及载体的 Release；一个 Release 也可以完整或部分收录多个 Book。不同 ISBN 不自动形成不同卷，合订发行的 ID、总页数及 ISBN 不能复制给其所有成员，也不能据此建立新的整作。

staff_alias_id 标识同一 Staff 的具体署名，实际主体由 staff ID 确定。例如 abec 的署名指向 staff/589，12811 是该署名的别名编号，档案主名为 BUNBUN；接入将这些名称归入同一主体。

独立单行本也可能同时具有 Series 与 Book 记录。只有已经明确整作范围时，才能用完整单行本资料补充作品；不能仅凭 c_num_books=1、列表只有一项或去掉标题中的数字判定它没有分卷，也不据此补造“正文卷”。未能确定整作／单卷范围时，报告无法对应；已有明确 Book 身份的卷仍可直接读取。

已知 Release 只有在完整且恰好收录一个已对应 Book 时，才可以作为同一采用目标的发行身份与定位依据；多书合订、节选或归属不明时只保留适当来源链接。ISBN 校验类型、长度和校验位，作为相应出版物的版本依据，不增加本体普通 ISBN 字段或把它当作所有版本共享的内容身份。

<a id="search"></a>

## 搜索、定位与完整读取

小说名称搜索使用 /series，Publisher 使用 /publishers；这些是可准确归类的 Entry 搜索。Staff 搜索结果没有可靠的个人／团体判别字段，不作为 Person 或 Organization 的自动搜索候选。已经明确类型的 Staff 通过真实身份读取，不能根据名字、简介措辞或 Wikidata 链接临时猜类别。

Book 和 Release 不提供独立 Part search、resolve 或 session 根。它们通过真实 Series 范围，或者 Entry 会话内明确的 Part refs 读取；只有已知 Part refs 时可以省略来源根身份，不能再把 Book 的父 Series 宣布为已经对应的本地作品。

读取当前实际的 {series}、{book}、{staff}、{publisher}、{release} 响应信封，不按文档示例省略外层对象。搜索和反查沿 currentPage、totalPages、实际成员和总数完成必要分页，不假定请求的 limit 必然生效；实测 /tags 在 limit=2 时仍返回 24 项。

按书名的唯一结果仍是候选，交给共同 matching。只有明确来源身份、正式对应引用或已经启用的匹配规则才能形成采用依据；同作范围、主体类型和身份冲突各自核对。

完整性仅覆盖当前查询与所请求字段。分页失败、反查截断或必要发行信息缺失时，不返回半份成功关系；已取得的独立普通资料可以进入 partialResult。隐藏、删除、不可读及明确空值分别处理。

<a id="fields"></a>

## 字段与语言

| 来源值                                                    | 采用                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| titles 中的语言、title、official，主 title 与真实 aliases | name、aliases；按 preferredLanguages 选择，同一语言优先正式标题，缺少匹配时保留来源主名                             |
| title_orig 与 olang 对应的标题                            | originalName；不使用当前显示译名或自行罗马化替代                                                                    |
| Series／Book 的 olang                                     | Novel 的 originalLanguages；Book 的当前显示语言和译本语言不改变它                                                   |
| Series 自身 description                                   | 作品自己的说明正文；页面称为 Note，不用 book_description 补成整作剧情简介                                           |
| Book 的 description、description_ja                       | 该单册的实际英文／日文介绍；其他目标语言缺失时按本体回退规则处理                                                    |
| Staff／Publisher 的主名、真实别名、description、链接      | 已明确目标的 name、originalName、aliases、description、externalLinks；原名使用实际原文形式，不把笔名改作本名        |
| Series start_date、end_date                               | 当前作品的 releaseDate、releaseEndDate，保留日期精度                                                                |
| Book 原作语言的首次发行日期                               | 对应卷的 releaseDate；不以所选译本、再版或数字版日期覆盖                                                            |
| publication_status                                        | ongoing→ongoing、completed→finished、hiatus→paused、cancelled→cancelled；unknown 不回答，stalled 不自行等同正式暂停 |
| 明确选定且覆盖目标的 Release.pages                        | declaredPageCount；来源缺席不补零，不合计多卷或混用不同发行的页数                                                   |

来源以 99 表示未知月／日、99999999 表示未知日期。20100499 采用为 2010-04，不补成月末或当月第一日；非法组合不转成字符串日期。Series 的结束日期需要来源明确的作品结束事实，不能从最近一册发行日期推导。

sort_order 只表示来源排列，不填入 numberLabel。卷号只从与真实父作品相符的明确卷号表达取得，保留 5.5、上、下等原有文本；没有可靠编号时省略，不按数组位置编号。main／sub 说明来源目录中的主篇与补充单册，不新增 NovelVolume 类型，也不把 sub 改成另一部作品。

c_num_books 和列表长度是当前已登记书目数，不能作为完整作品的声明卷数。不由单册页数生成作品总页数；独立完整单行本只有在整作范围已确定后才可提供整作页数。

Markdown 正文沿公共内容合同采用。转换前移除来源 >!…!< 显式剧透块的全部内容，不仅删除遮罩；未标记的正文不做剧情猜测。不会把职员表、标签、统计和所有发行记录拼进 description。

image.nsfw、image.spoiler 只描述该图片，不能成为作品、人物或标签的 isNsfw／isSpoiler。API 没有同义字段的性别、生卒、成立解散日期不提供，也不从简介解析补齐。

<a id="parts"></a>

## 单册、发行选择与图片

workVolumes 采用已确定分卷作品的真实 Book 范围，同时保留 main 与 sub 中实际独立的单册。来源目录并不表示已出版或已有文件，未发行但已明确登记的真实卷可以存在；不能按宣布数量补齐空卷。首次采用可使用来源顺序，普通刷新不重排本地卷。

每个 Book 的名称、介绍、图片、原作首次发行日期分别来自该 Book。读取页数、ISBN、特定版封面前，先核对 Release.books 的收录对象与 complete／partial；只从范围完整的单书发行选择资料。缺少这一依据时不按语言、相同 ISBN 前缀或同名自行归组。

发行资料优先沿本次已经明确的 Release 身份。只有 Book 身份时，默认核对原作语言最早的单书完整 print 发行；若同一最早日期仍有范围或页数冲突，省略该页数字段并说明，不能按 ID 大小随便挑一版。digital 或译版页数只在已经明确相应发行时采用。preferredLanguages 可以选择实际文字与图片，不替用户更换出版版本。该选择只决定这次采用的一套版本资料，不建立版本库，也不改变原作语言和首次发行日期。

Book.image 提供单册封面；选定 Release 有自己的图片时可以提供对应版封面。Series 没有独立封面字段，官网明确以 books 的第一项图片作为 Series 的代表图，本方案沿用这一来源选择，并在候选中说明实际来自哪一册；不把所有单册封面都宣布为整作主图，也不自行跳过首项改取其他册。

图片地址按官方部署的图片基址与真实 filename 形成。来源返回的尺寸和敏感／剧透标记保留为候选事实；原图读取、格式与尺寸核验、附件采用仍由本体完成。没有原生人物、出版社图片或整作背景／标志，不使用官网 favicon 或书封裁图补位。

<a id="subjects"></a>

## 主体与作品参与

Staff 实际包含 CLAMP 等创作团体，且没有主体类型字段。因此沿 MangaDex、AniList 的同一边界：不由作品 Staff 表自动创建人物或团体，也不在 Work 或 Character 上下文输出无法定类的 personWorks。已明确类型及 staff 身份的档案仍可读取名称、简介、链接等普通资料。

Person 根或已经明确的 Staff 团体根，可以按来源实际反查查找参与的 Series，再读取必要 Book.editions，核对原作版本的真实署名。不能只用 Series.staff 的去重摘要判定所有卷、所有语言均有同一职责，也不因反查搜到一本书就宣称参与整个系列的所有内容。

原始 edition 的 lang=null 是该来源对原作版的明确表示，配合 Book.olang 解释。译版 translator 与有声发行 narrator 不进入原作小说工作；不能按人物 primary language 筛选实际工作语种。

| 原作署名 | 已明确 Person        | 已明确 Staff 团体       |
| -------- | -------------------- | ----------------------- |
| author   | creator              | creator                 |
| artist   | illustration         | other，保留插画职责说明 |
| editor   | editor               | other，保留编辑职责说明 |
| staff    | other，保留实际 note | other，保留实际 note    |

原作参与在作品尺度成立时输出作品工作，并在请求 note 时保留单册范围及来源署名。译版、角色和配音信息保持其来源背景；本接入的结构化参与范围以本节原作署名表为准。

Publisher 归为组织，publisher_type 描述该次发行的职责：publisher→publisher，imprint→imprint。接入读取原作语言的 print／digital 发行，核对作品范围后采用真实发行署名。出版社默认语言仅按其自身字段含义解释，翻译发行方保持对应版本范围。

personWorks 固定为 novel 下的 creator、illustration、editor、other，character 为 none。Organization 根的 organizationWorks 使用 scope:session：staff 身份为 creator、other，publisher 身份为 publisher、imprint；作品根的组织参与只提供 publisher、imprint。范围由资源身份与上述映射确定。

出版社和品牌保持各自身份，例如 KADOKAWA 与电击文库分别存在。child_publishers 不是作品参与，也不建立本体未提供的母子公司／品牌所属关系。组织反查同样需要实际发行与原作范围核对。

<a id="relations"></a>

## 直接作品关系、标签与跨站身份

| child_series.relation_type | 本体关系                                        |
| -------------------------- | ----------------------------------------------- |
| prequel、sequel            | prequel、sequel                                 |
| side story、main story     | sideStory、mainStory                            |
| spin-off、parent story     | spinOff、spinOffOrigin                          |
| alternate version          | related，并保留来源版本称谓；不猜重制或不同演绎 |

直接关系按表中类型与来源方向采用；未知枚举报告不能解释。没有返回关系时保持未回答或明确空集合的真实含义，作品名称只用于识别。具体正例与空结果样本见来源验证记录。

Series.tags 的 genre、content、demographic、tag 都是来源公共分类，可按资料采集页所选类别形成 entryTags。标签名称保留原文；description 从完整标签目录按规范名称读取，不把 tag ID 保存为本地标签身份。没有标记时不推导敏感或剧透布尔值，也不自行翻译名称。

Series 的 MAL 与 AniList 引用只有在所指仍为同一小说作品时才形成跨站身份；Wikidata 同样核对对象范围。AniDB 字段由官方编辑说明明确指向动画改编，不能绑定成当前 Novel 的同目标身份，也不据单个编号新增动画作品关系。未知链接作为 externalLinks 保留，不递归访问各站发现更多身份。

<a id="account"></a>

## 个人接口边界

本方案交付公开资料读取和采集配置。公开个人 API 缺少完整读取能力，因此本人账号、清单导入及持续同步不在交付范围内；页面与模块按这份实际能力组织。

当前官网 API 说明仍写“只读”，但公开源码已经提供 Bearer PAT 的 /api/v0/user/me，以及 Book、Series、Staff、Publisher、Release 的 PUT／DELETE。因此不能把原因简写成“平台没有个人 API”或“没有写入接口”。

具体缺口是：当前 v0 路由没有可供 PAT 完整枚举本人书目／系列列表或读取对应个人记录的 GET。/user/me 只返回账号摘要；Bearer 解析只作用于 /api/v0/user。公共 /book、/series 详情也没有返回网站编辑页的完整个人表单，不能用它们代替个人记录读取。

Book／Series 的 PUT 使用完整表单形状，包含状态、自定义标签、通知／发行偏好，以及会被缺省值替换的评分、日期和备注。缺少完整读取与读回入口，单靠这些写入 API 无法完成本人导入、保留未选内容、未知结果核对和重试；不能用默认值覆盖未知字段。这与接受平台原生联动是两件事。

网站本身另有分页清单和个人表单数据：公开清单的完整分页及匿名详情表单结构已实测，本人完整字段的读取路径已由源码核对；它们使用网站登录会话和 SvelteKit 页面数据协议，不属于公开 v0 个人 API。采用该路径需要另行依赖网站 Cookie 和内部页面合同。本方案明确不采用这一路径，不将“公开 API 不完整”扩大表述为网站完全无法读取个人数据。没有进行本人登录或远端写入。

<a id="settings"></a>

## 资料采集设置与内部组织

资料采集页提供公共联网测试、标签类别选择、图片筛选和网络设置。四类公共标签默认全部采用，敏感图片默认包含，明确标记的剧透图片默认排除；这两个筛选只决定图片候选，不裁掉作品目录或本人范围。正文显式剧透的移除是固定转换规则。

单次超时默认 20 秒，安全读取重试 2 次，429 尊重 Retry-After。来源调度遵守官方每分钟不超过 60 次请求的要求；分页、额外发行读取和重试共用同一预算。资料语言由本体方案提供，不设置第二套语言优先级、固定日语原作或独立罗马字偏好。

```text
src/
├── node/
│   ├── entry.ts
│   ├── client/        # API requests, validation, pagination and pacing
│   ├── metadata/      # Series, books, releases, archives and relations
│   ├── settings.ts
│   └── ipc.ts
├── webview/           # One Metadata page
└── shared/            # Pure private contracts and validation
```

client 拥有来源 DTO 和协议，metadata 的 provider、session、identity、fields、parts、credits、images 按实际职责拆分。私有 IPC 仅转发配置及联网测试，页面使用既定 Solid 与公共组件。没有个人能力就不创建 account、import、sync 空模块，不维护全站图书或发行镜像。

<a id="verification"></a>

## 预设与验收

默认作品与角色预设不使用 RanobeDB 自动发现人物工作及其 note；已明确人物自身的原作履历和普通档案字段仍可采用。小说作品的代表封面沿本页的真实来源选择；卷号只从明确编号表达取得，不由 sort_order 供应。其余字段按实际能力采用，用户已保存方案不自动重写。

来源依据见[接口核验](../../../verification/evidence/book-sources/live-api.md)。个人写入 API、公开读取缺口和网站页面数据分别记录，个人能力不属于本扩展验收范围。

验收覆盖完整多页查询、原作发行筛选、已知 Staff 自身履历、独立单行本范围、合订与部分收录排除、图片筛选、所有字段的缺席／空值、取消、限流和本体实际采用。来源可读与文档方案均不代替这些验收。
