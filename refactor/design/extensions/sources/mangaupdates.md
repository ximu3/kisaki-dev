# MangaUpdates 接入设计

MangaUpdates 提供漫画、明确小说、已定类主体资料，以及本人列表、作品状态和总评分。本文规定公开 v1 API 的资料采用、账号、导入与同步。

<a id="scope"></a>

## 职责与页面

| 能力     | 终态方案                                                                       |
| -------- | ------------------------------------------------------------------------------ |
| 作品     | 漫画与来源明确分类的小说：搜索、定位、普通资料、图片、分类及直接作品关系       |
| 人物     | 已明确为 Person 的 Author 档案及其自身作品履历，不从混合作者名单自动建立人物   |
| 组织     | Publisher 的搜索、档案及实际出版参与；已明确为组织的 Author 团体档案及自身履历 |
| 分部     | 不提供卷、话目录或分部字段；翻译发布与累计数字不构成真实 Part 身份             |
| 本人接入 | 本人列表与评分的手动导入、独立自动导入；作品状态和总评分的本地到平台同步       |
| Webview  | 账号、资料采集、导入、同步四个页面                                             |

公开资料匿名访问固定的官方 v1 API。本人能力使用公开的账号会话接口，不需要注册 Kisaki 应用或配置 Client ID。接入不提供公共资料编辑、论坛、翻译发布管理、站点账号注册或远端自定义列表管理。

<a id="identity"></a>

## 对象、身份与范围

source 使用 mangaupdates，sourceId 采用资源类别与网站当前规范的小写 base36 代码，沿用 [MangaDex 跨站身份](mangadex.md#links-tags)的同一语法。

| 来源资源  | sourceId               | 本体对象                            |
| --------- | ---------------------- | ----------------------------------- |
| Series    | series/&lt;code&gt;    | 范围一致的 Comic 或 Novel           |
| Author    | author/&lt;code&gt;    | 已明确类别的 Person 或 Organization |
| Publisher | publisher/&lt;code&gt; | 真实出版方 Organization             |

API 的十进制整数 ID 与当前页面代码在边界处准确转换；《四叶妹妹》的 23606352927 与 auem2hr 已核对。序列化为规范字符串，不通过浮点舍入接受超出安全整数范围的值。名称 slug 不参与身份，author 与 publisher 不能仅因数字相同就合并。旧 series.html?id= 的历史编号属于另一编号体系，不把它转 base36 冒充当前 ID；缺少明确对应时只保留外链。

Novel 类型对应小说；Manga、Manhwa、Manhua、OEL 及其他明确漫画类型对应漫画。来源把同人小说实际归为 Novel，Doujinshi 按其漫画目录中的同人作品解释；遇到与媒介证据矛盾的记录报告无法归类。Artbook、Drama CD 和未知类型不强行映射。国别风格名称不直接推导 originalLanguages。

独立短篇可以直接是作品，不制造“正文话”。明确的漫画合编出版物可以作为合编作品，并与独立管理的所收作品建立 compilation 关系；网站为合并条目而记录的短篇标题、任意作者作品集或系列分组不能单凭同名成为另一作品。来源仅有总量或发布列表时，不生成卷、话、收录、文件或 holdings。

<a id="search"></a>

## 搜索与完整读取

作品搜索使用 POST /series/search，按请求的 Comic／Novel 范围过滤并复核每条实际类型；出版方使用 POST /publishers/search。已知身份直接读取真实 Series、Author 或 Publisher。Author 搜索不提供 Person／Organization 自动候选，因为其模型无法区分个人与创作团体；不能从性别、名字或传记猜类型。

名称结果由共同 matching 核对，不能把第一条或唯一名称命中当作已确定身份。SAO 的 Novel 搜索实际返回大量模糊候选，搜索参数不保证精确同名。分页沿实际 page、per_page、total_hits 与成员读取；Author 搜索实测没有按请求的 3 条限量返回，不能以请求页长计算完成。

Publisher 的反查返回作品与连载刊物两个集合；Author 的作品反查需要继续读取 Series，确认媒介及真实署名。不能截取前若干结果后宣布关系完整。必要分页、目标类型或关系详情读取失败时，不以半份集合支持替换；可独立成立的普通字段按共同 partialResult 规则保留。

<a id="fields"></a>

## 普通字段、语言与图片

| 目标                          | 提供的字段                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Comic／Novel                  | name、适用 aliases、description、primaryImage、externalLinks、明确的 releaseDate、releaseStatus、declaredVolumeCount、正向 isNsfw 及公开标签 |
| 已明确 Person 的 Author       | name、originalName、aliases、description、primaryImage、externalLinks、birthDate、适用 deathDate、gender                                     |
| 已明确 Organization 的 Author | name、originalName、aliases、description、primaryImage、externalLinks                                                                        |
| Publisher Organization        | name、aliases、description、externalLinks                                                                                                    |

Series.title 是来源主名，associated 没有语言或正式标题标记。普通作品的真实异名可作为 aliases；合编或短篇合并记录中的 associated 还可能包含所收短篇标题，无法区分时省略该名单，不把每篇标题都作为整作别名。不能按字符集挑出 originalName、推导原作语言或声称已经提供目标语言译名。名称搜索可使用来源收录的其他名称，但搜索线索不自动成为采用字段。

Author.actualname 按[官方姓名说明](https://api.mangaupdates.com/v1/faq/7/questions/59)表示原文发表用名，可提供 originalName，并非法律本名。name 保留来源正式主名和姓名顺序；associated 保存实际其他署名，不自动交换姓与名。description 采用 Series.description、Author.comments 或 Publisher.info 的普通正文，沿公共 Markdown 与安全内容合同处理；论坛评论、统计和完整职员表不拼入简介。

Series.year 只有明确的合法单年才能提供年精度 releaseDate；它按来源编辑规则表示首次发表，不以最近更新或译版出版日替代。Author.birthday 保留实际日期精度；只有 status=Deceased 且 status_date 是有效日期时才提供 deathDate，已由三浦建太郎档案及网页“死亡日期”字段核对。其他状态日期不视作死亡日期，团体的生日及状态日期也不变成成立或解散日期。

Series.status 按可确定的单一原作状态解释：Ongoing→ongoing、Hiatus→paused、Complete→finished；只有明确取消／中止事实才采用 cancelled。多版本或多个部分的混合文字不能取第一段凑成状态。completed 表示是否已完整翻译，不映射为原作完结。

“N Volumes (Ongoing)”表示当前已出版卷数，不是最终声明卷数。只有范围明确、已完结的总卷数才提供 declaredVolumeCount；多版本分别说明，不合计。latest_chapter 属于翻译发布语境，不提供 declaredChapterCount；没有可靠的页数、结束发表日或原作语言时保持缺席。公众评分及投票数不成为本人的总评分。

作品和 Author 的 image.url.original 提供实际主图；thumb 仅作预览。Publisher 没有原生档案图片，不用 favicon 或书封代替。来源不提供背景与标题标志。图片 GET、格式与尺寸验证沿本体能力执行；实测原图可 GET，而 HEAD 返回 400，不能只凭 HEAD 判断失效。

<a id="tags"></a>

## 公开分类与敏感标记

作品 genres 和 categories 分别作为公开标签来源，默认均启用。genre 的正式说明可提供标签 description；category 的投票数不是关系权重，也不为其拼造说明。Author 的常见题材统计不自动变为人物标签。

Adult 与 Hentai 等明确限制级定义可正向提供作品 isNsfw=true。Mature、Smut 或缺少成人标签不自动提供 false；公开标签没有明确的剧透字段时不猜 isSpoiler。图片也没有同义敏感／剧透标记时保持未知。

资料搜索默认包含敏感内容。用户的名称搜索筛选不限制明确身份读取及本人列表范围，也不能因筛选后为空而宣布来源没有成员。来源权限造成的可见范围按实际结果说明。

<a id="subjects"></a>

## 人物、出版方与作品关系

Author 混有 CLAMP 等团体，即使 gender=Female 也不能证明它是 Person。因此作品上下文不从 Author 名单自动创建人物或组织，也不输出无法分类的 personWorks；角色本身及配音关系没有相应来源能力。

Person 根或已明确的 Author 团体根，可以通过自己的真实身份反查作品，并按 Series 的实际署名读取关系。Author→creator；Person 的 Artist 在漫画中为 drawing、小说中为 illustration。团体的 Author 同样使用 organizationWorks.creator，团体绘画工作使用 other 并保留具体职责说明。一个作者兼任 Author 与 Artist 时保留两个确有的职责，不将整作署名推给所有角色或分部。

Person 根的 personWorks 固定为 comic、novel 中本页映射的 creator、drawing、illustration，character 为 none，并按媒介职责相容性限定组合。Organization 根的 organizationWorks 使用 scope:session：Author 身份为 creator、other，Publisher 身份为 publisher；作品根只提供 publisher。各范围在读取前固定。

作品的 publishers 按实际 Original／English 出版范围解释。原作出版方提供 organizationWorks.publisher；English 译版署名不冒充原作出版参与，出版地或 Publisher 档案自身 type 不能替代每部作品上的署名范围。Publisher 反查需要再核对 Series 的出版项。发行说明只用于相应关系 note，刊物名称不自动建立出版社或出版品牌，介绍中的隶属措辞也不解析为组织关系。

| 来源直接关系                      | 采用                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Prequel／Sequel                   | 按明确方向采用 prequel／sequel                                                          |
| Main Story／Side Story            | mainStory／sideStory                                                                    |
| Spin-Off                          | spinOff，沿实际直接表达，不靠对方的另一标签猜反向含义                                   |
| Adapted From                      | 当前作品指向原作的 sourceMaterial                                                       |
| Alternate Version                 | 有明确不同演绎语义时采用 alternativeVersion；普通再版不能另建作品                       |
| Part of Anthology／Full Anthology | 仅在两个端点都是明确独立作品且收录语义成立时，采用 includedWork／compilation 的相应方向 |
| Other                             | 来源明确给出的普通直接联系，使用 related                                                |

未知标签报告未采用，不一律降成 related；推荐结果不进入 workRelations。同一事实沿本体关系方向规范化，冲突不靠新增重复关系掩盖。Series.anime.start／end 是动画对应的漫画章节范围文字，没有动画身份，不能作为发行日期或凭此创建动画关系。

<a id="account"></a>

## 账号、续期与私有数据

账号页通过私有 IPC 把一次登录输入交给 Node，调用官方 PUT /account/loginWithCookie。Node 使用自己的会话容器接收并维护 Cookie，再以 GET /account/profile 的稳定 user_id 确认身份；不读取外部浏览器 Cookie，也不把密码放入 URL、日志、设置或持久存储。注册及账号恢复跳到官网处理。

只有来源会话进入 secrets。密码仅用于本次登录，请求结束即释放，不保存密码供后台重新登录。GET /account/refresh 更新会话后重新核对同一账号；按实际有效期与认证响应处理续期，不编造固定会话寿命。失效时暂停本人任务并要求重新连接，匿名资料仍可用。

断开时停止本账号任务、清理私有缓存与 secrets，并尽力调用官方 logout；换账号不复用旧列表 ID、操作基线或同步指纹。账号连接不触发导入或同步。列表级可见性沿来源已有设置，扩展不修改账号或列表隐私，也不承诺逐条记录具有独立私密开关。

<a id="personal"></a>

## 本人读取与手动导入

GET /lists 取得真实列表身份、type 和 custom；POST /lists/{id}/search 完整读取本次范围。读取全部成员时省略 search，空字符串实测会返回 400。列表详情与搜索响应可能承载不同的 options；不能把 GET /lists 缺少可见性字段解释为公开。

GET /lists/series/{series_id} 取得已对应记录，实际不一定返回 list_type，须按 list_id 联接本人列表定义。评分使用实际个人 user_rating 或 GET /series/{id}/rating，不使用公共 rating。只有身份有效、作品确实可读且该个人端点明确返回不存在，才按记录缺席处理；401、失败和未知均不能当作清空依据。

手动导入可选择本人全部列表、固定状态或自定义列表，并选择实际 Comic／Novel 范围、资料方案、个人采用项及可选本地目标合集。自定义列表按自己的明确 type 解释状态，不从用户取的列表名猜“收藏”或“在读”；未知类型只作为所选成员范围。列表没有公开的独立全量评分目录，未加入列表的单独评分只能为已明确对应的作品读取，不能声称枚举了全部评分作品。

缺少本地作品时按准确 Series 身份及实际媒介调用完整 ingest；已有作品只复用并执行选定的个人记录操作，不借导入刷新全部元数据。新建与本次初始个人值沿同一完整操作采用，明确完成事实且本地尚无完成历史时，可以初始化一条日期未知的完成记录；已有历史不被替换，也不按每次导入追加一次完成。

| 来源个人事实                          | 本地采用                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| read／wish／hold                      | active／planned／onHold；保留已有完成历史                                          |
| complete                              | 本次选择采用完成事实时按共同初始化规则处理，并清除当前状态；没有完成日期时保留未知 |
| unfinished                            | 本体没有同义的放弃状态，说明未采用，不改为 onHold 或删除                           |
| 有效本人评分                          | 按来源实际 1–10 值换算为 0–100 整数；缺席与请求失败分开                            |
| volume／chapter／priority／time_added | 不采用为 Part 完成、阅读位置、评价权重或完成日期                                   |

数字卷话是平台当前记录，实测愿望单默认便是 1／1，不能解释为累计已读数。没有真实 Part 身份与范围，不做分部进度导入或回写。关注、愿望与自定义名单不变成 isFavorite；来源没有原生同义喜爱字段。私人评论、自由标签、短评、站内优先级、累计时长和笔记不加入持续同步。

列表成员可以在本次明确导入中加入用户选定的本地合集，但不持续镜像远端列表结构，不创建、改名或删除远端自定义列表。自动导入独立默认关闭；启用后按所选来源列表补齐缺少作品，已有对象只复用，并可加入用户选定的手动合集，不覆盖其资料或个人记录。远端移除不删除本地作品或合集成员；本地删除后仍在来源范围内的作品，后续可能重新导入，不维护永久排除名册。

<a id="sync"></a>

## 本地到平台同步

同步只处理已有准确 Series 身份且在本次范围内的作品，分别选择作品状态和总评分。手动执行与自动开关独立，自动同步默认关闭。写入前读取账号、列表定义及选定字段的实际基线；权限、类型或身份不明确时报告该项，不按名称自行另建远端记录。

| 本地状态                   | 来源操作                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| active／planned／onHold    | 对应 read／wish／hold                                                                          |
| 当前状态为空且已有完成历史 | 对应 complete；不提交虚构完成日期或次数                                                        |
| 当前状态为空且没有完成历史 | 来源没有独立清空状态语义；已有记录报告该字段无法清除，不删除整条列表记录；本来不存在时无需创建 |

目标列表从本人定义中按 type 与 custom=false 选择唯一的系统列表，不硬编码 0–4 或翻译后的名称。已有自定义列表若确实表达同一状态则保持其真实 list_id；改变状态时接受平台将作品移出原自定义列表的正常行为，不反向补偿。

新增使用 POST /lists/series，已有状态更新使用 POST /lists/series/update；仅提交所选作品引用和目标 list_id。已有卷话进度、优先级及其他未选值不主动提交。实测部分更新保留 2／3 测试进度，但执行仍以实际回读为准；创建时接受平台正常产生的 1／1、priority 等默认值，不把它们抄回本地为完成事实。

评分独立于列表成员。本地整数 10–100 除以 10 后写入，来源支持一位小数；本地 0–9 没有可准确表达的评分值，报告无法同步，不裁剪、不视作清除。null 使用 DELETE /series/{id}/rating；只提交评分不要求先建列表成员。实测 8.7 原值保留，8.75 被量化为 8.8，0 在原本无评分时仍无评分，不能据此宣称来源支持有效零分或已证明零能删除既有评分。

状态与评分分别报告结果，其中一项不支持不阻断另一项。直接写入只作用于用户选择的作品，接受[平台原生联动](../synchronization.md#writes)。超时或响应不明时先有限回读，不盲目重复创建；回读与本地基线变化分别核对，不把服务器接受请求当作全部字段成功。

<a id="settings"></a>

## 页面、默认值与运行

| 页面     | 内容与初值                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------- |
| 账号     | 登录、连接状态、当前账号、重新连接、断开；不保存密码                                               |
| 资料采集 | 连接测试、genres／categories 两项标签开关，均默认开启；名称搜索包含敏感内容默认开启                |
| 导入     | 本人列表范围、Comic／Novel、资料方案、采用的状态／评分、可选目标合集；手动执行与默认关闭的自动导入 |
| 同步     | 已绑定作品范围、状态／评分、手动执行与默认关闭的自动同步；明确列表级原生可见性                     |

默认导入范围为全部本人列表、漫画和小说，个人采用默认包含状态与评分；本地合集默认不选。同步字段默认包含状态与评分，执行范围由用户选择或其已保存的范围配置决定。连接与保存设置均不自动执行。语言偏好、字段优先序和匹配规则仍由本体资料方案管理，不另建一套来源配置。

自动触发沿[共同合同](../synchronization.md)：自动导入在启用、应用恢复及运行期间每小时检查；自动同步在启用、恢复连接，以及所选本地字段或来源身份改变后核对，不轮询远端个人值。同一账号执行不重入，相关本地变化有界合并后重读；换账号关闭两个自动开关，重新启用后才按新账号工作。

公共客户端按全扩展共用的队列请求；普通请求默认至少间隔 1.1 秒，写请求至少间隔 5.2 秒。这是本扩展的保守节奏，不宣称是来源公布的精确限额。请求超时 20 秒，读取遇到临时错误最多重试两次，遵守 Retry-After，取消后不再派发。公开档案与查询默认缓存一小时，genre 字典缓存一天，明确刷新绕过缓存，批内复用响应；本人数据按账号隔离并在写入后失效，写前基线不使用过期缓存。

资料页和采用结果保留 MangaUpdates 出处及真实页面链接。授权信息、私有正文、完整 HTTP 内容和账号标识不写入日志或 Task 历史。页面关闭不取消已由 Node 接纳的任务；扩展停用／卸载按共同生命周期停止新工作、处理已在途请求并释放会话与订阅。

<a id="organization"></a>

## 源码职责

```text
src/
├── node/
│   ├── entry.ts
│   ├── client/
│   │   ├── gateway.ts
│   │   └── types.ts
│   ├── account/
│   │   └── manager.ts
│   ├── metadata/
│   │   ├── provider.ts
│   │   ├── identity.ts
│   │   ├── fields.ts
│   │   └── relations.ts
│   ├── import/
│   │   └── coordinator.ts
│   ├── sync/
│   │   └── coordinator.ts
│   ├── records.ts
│   ├── settings.ts
│   └── ipc.ts
├── webview/
│   ├── index.html
│   ├── entry.tsx
│   ├── pages/
│   │   ├── account/
│   │   ├── metadata/
│   │   ├── import/
│   │   └── sync/
│   └── styles.css
└── shared/
    ├── contracts.ts
    └── validation.ts
```

client 负责来源传输、节流、分页与响应边界；account 管理身份、Cookie 和续期。metadata 解释来源身份、普通字段和关系；records 统一解释列表类型、状态与评分，不拥有第二份个人资料库。import 和 sync 复用这些规则，各自组织本体完整操作及来源写入。ipc 只转发私有业务调用，shared 只保存纯界面合同及输入规则，正式本体值直接引用公开 API。

四个页面通过一个轻量 Webview 入口登记，路由按需加载；任务、事件订阅和执行寿命由 Node 拥有。工程目录按实际耦合拆分，入口直接指向相应实现，能力范围遵守本页的来源合同。

<a id="verification"></a>

## 预设与验证

来源依据见[接口核验](../../../verification/evidence/mangaupdates-anidb/live-api.md)。验收覆盖真实非空自定义列表、完整分页、账号切换、取消、冲突、本体采用与 UI 运行。

默认漫画预设的 personWorks 成员不采用 MangaUpdates，note 保持不配置，保留实际出版方参与；已明确人物自身的履历继续可用。人物 originalName 与有条件的 deathDate 按真实字段参加默认取值链，各预设沿同一原文名规则采用。作品 aliases、总量、敏感标记与分部缺项按本页约束读取，不增加无法分类的组织作者发现。字段与对象范围见[来源核验](../../../verification/evidence/mangaupdates-anidb/live-api.md)。
