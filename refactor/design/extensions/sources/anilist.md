# AniList 接入设计

AniList 通过 GraphQL 提供作品、角色和制作主体资料，以及本人列表与喜爱。本文定义对象粒度、字段采用、授权、导入、同步及页面职责。

<a id="scope"></a>

## 职责与页面

| 能力     | 接入范围                                                                         |
| -------- | -------------------------------------------------------------------------------- |
| 作品     | Anime、Comic、Novel 的搜索、定位、普通字段、图片与直接作品关系                   |
| 角色     | 合适的 Character 档案、搜索、作品角色和反向作品关系；排除通用署名占位            |
| Studio   | Organization 档案、搜索与实际作品参与；不虚构缺失的简介、图片或日期              |
| Staff    | 已明确为 Person 或 Organization 的档案和自身制作履历；不自动区分或新建个人／团体 |
| 本人导入 | 全部媒体记录、状态范围、自定义列表及动画／书籍／角色／Staff／Studio 喜爱         |
| 持续同步 | 作品状态、总评分、单一完成日期及适用条目的喜爱标记，按下文独立操作边界提供       |
| 不提供   | Part 目录与分部同步、累计进度或次数到本地历史的转换、远端自定义列表管理          |
| Webview  | 资料采集、账号、导入、同步四页                                                   |

公开资料使用匿名 GraphQL，个人读取与写入才带本人令牌。资料、账号、导入和同步共用一个来源客户端与限流队列，但不混淆公开数据与本人字段。

<a id="identity"></a>

## 对象、粒度与来源身份

source 使用 anilist；身份分别为 media/<id>、character/<id>、staff/<id>、studio/<id>。Media ID 与本人 MediaList.id、角色／人员关系 edge ID、排播 ID 不互换。

| 来源范围                                   | 本体采用                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Media.type=ANIME                           | Anime；TV、TV_SHORT、MOVIE、OVA、ONA、SPECIAL 与动画 MUSIC 记录保持实际独立作品范围 |
| Media.type=MANGA，format=NOVEL             | Novel                                                                               |
| Media.type=MANGA，format=MANGA 或 ONE_SHOT | Comic                                                                               |
| Character                                  | 符合本体范围的角色                                                                  |
| Studio                                     | 真实制作组织                                                                        |
| Staff                                      | 仅在主体类别已经明确时作为 Person 或 Organization 读取                              |

ANIME 中的 MUSIC 是动画视频，不是音频作品。独立 OVA、特别篇、短片、单篇漫画和小说记录不因名称或总数改成 Part。未知书籍格式不能默认作为漫画；来源只有总卷数或总话数，也不生成真实分部。

同一来源的不同季、版本和合编分别保留身份。idMal 是实际跨站对应线索，仍要核对类型、版本和作品范围；不因名称相同或只有一个返回结果就合并。尤其不能从一个根作品对应推导分部一一对应：AniList 的目录规则会把某些第 0 集计入整季，也可能采用不同的拆集或再版范围。

<a id="subjects"></a>

## 角色、个人与团体边界

官方手册明确使用 character/36309 表示跨作品旁白、character/36310 表示无法归属具体角色的其他声音。它们是署名占位，不能作为 Character、喜爱导入目标或关系端点；判断按已核实的身份，不按翻译后的名字。

其他角色按来源角色档案及[本体角色范围](../../domains/catalog.md#characters)采用。明确的普通机体、舰船、地点或虚构组织不因位于 character 路径就自动成为角色，不解析简介来推断人格。

Staff 明确容纳个人、公司和团队，CLAMP 已有实际样本；API 没有可区分这些主体的类别字段。沿用 [MangaDex 的规则](mangadex.md#identities)，不提供 Staff 的人物／组织名称搜索或 resolve，不从作品 staff 或 voiceActors 名单自动创建人物、团体或工作关系。

已明确为 Person 的 staff 根可读普通字段及自身 staffMedia 制作工作；已明确为 Organization 的 staff 根可读团体资料及自身工作。relatedEntries 的明确 refs 也可补字段。provider 不查询本地库猜主体类型，关系成员也不依赖本次普通字段或 refs 的选择。

因此，作品上下文不声明由混合 Staff 名单构建的 personWorks／Staff 团体工作；人物根的 personWorks 与已知团体根的 organizationWorks 则可以提供。这是读取上下文的实际差异，不将部分人员名单伪装成完整名册。

<a id="search"></a>

## 搜索、分页与请求完整性

独立作品搜索使用 Page.media 与 SEARCH_MATCH，并按 type、format 限定目标；角色和 Studio 使用对应的分页搜索。独立搜索使用真实下一页，名称 resolve 完成必要的有限候选集合后再交给 matching。

GraphQL 变量承载用户输入，不拼接查询文本。普通字段按请求选择；为核对类别、主体范围或关系方向必须读取的字段，不因它们未被选为普通资料而省略。

分页依赖 hasNextPage、实际页位置和已取得的对象，不使用 total 或 lastPage 控制结束。本次同一作品角色目录前四页各 25 项，total 一直为 500；第五页为空且 hasNextPage=false，最终实际为 100 项。名称搜索的 total 也出现 5000 的估计值。

只完成部分页、重复页、预算耗尽或发生 GraphQL errors 时，不交付半份成功集合。HTTP 200 不能代替 GraphQL 成功判断；已完成且独立的字段可以沿共同 partialResult 保留，失败部分缺席，不改成空数组。

<a id="fields"></a>

## 名称、正文、普通字段与图片

| 来源值                                        | 本地采用                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| title.romaji／english／native                 | name 按明确语言与 preferredLanguages 选择；无匹配时采用真实 romaji 主名称                          |
| title.native、人物／角色 name.native          | 有明确原文含义时提供 originalName，不从显示译名反填                                                |
| synonyms、name.alternative                    | aliases；保留真实整体名称，不按括号、逗号或斜线随意拆分                                            |
| description                                   | 共同 Markdown，按下文处理来源格式与显式剧透                                                        |
| startDate、endDate                            | releaseDate、releaseEndDate，保留 FuzzyDate 实际精度                                               |
| status                                        | NOT_YET_RELEASED→planned，RELEASING→ongoing，FINISHED→finished，HIATUS→paused，CANCELLED→cancelled |
| isAdult                                       | 当前作品的 isNsfw；不传播到人物、角色、组织或分部                                                  |
| volumes；漫画 chapters                        | 明确总量可提供相应声明数；null 表示未知，不补零                                                    |
| 角色 gender、dateOfBirth、age、bloodType      | 明确性别与生日、数值或完整文字年龄、可识别的 ABO 血型                                              |
| 已明确人物的 gender、dateOfBirth、dateOfDeath | 对应人物资料；不保存随时间变化的 age                                                               |
| siteUrl、作品结构化 externalLinks             | externalLinks；不将正文中任意被提及对象的链接提升为当前对象身份                                    |

native 名称不自动变成所有语言都有的译名。中文偏好没有对应名称时使用来源实际回退值，不转换简繁或自行翻译。正文通常只有一份，不能把 preferredLanguages 当成该正文确有相应译本的证据。

名称选择采用明确的显示约定：英文偏好使用实际 english 标题，日文偏好优先 native 原文形式；没有专门名称字段的语种不宣称取得译名，继续按偏好中的可用形式或来源主名称回退。人物与角色使用实际完整名／原文名，不把罗马字转写称为正式英文译名。native 始终表示原文，不保证它属于所请求语种，也不据此写入作品语言。

请求 asHtml=false 后仍按实际返回内容安全处理 Markdown／HTML 片段。明确的 ~~!…!~~ 剧透块连同内容移除，alternativeSpoiler 不进入 aliases；同一边界适用于带显式剧透标记的角色属性。未标记内容不做剧情推断，也不将整个角色排除。

性别采用来源明确值，不从图片、名字或声优推断；未知与有条件的无法统一值不当作 other。age 的范围、阶段或 1000+ 之类值完整保留为文字。血型只采用明确 ABO 分类，其他值不猜测。没有结构化提供的身高、体重、三围和罩杯不从简介抓数字。

countryOfOrigin 不是 originalLanguages，Staff.languageV2 也不是作品原作语种。不声明 originalLanguages。episodes 与 duration 分别是来源总集数和通常单集分钟数，不填入正片数或整部时长，不相乘。实际流媒体条目数也不成为声明数量。

作品封面提供 primaryImage，bannerImage 提供 backdropImage；角色和已明确 Staff 的档案图提供 primaryImage。大、小规格属于同一素材，不猜额外图像路径。Studio 没有自己的图片、简介、别名或成立／解散字段，不能从关联作品、社交头像或 Staff 拼造。

不提供 titleLogo、iconImage 或来源没有给出的分部图片。独立图片浏览覆盖可搜索的作品和角色；混合 Staff 的图片随已明确的档案读取。实际图片下载、校验、预览、裁剪与本地采用沿[公共图片合同](../../domains/attachments.md#images)完成。

<a id="relations"></a>

## 作品角色、制作工作与组织

workCharacters 来自完整 characters 连接；MAIN、SUPPORTING、BACKGROUND 分别采用 main、supporting、other，保留真实身份并排除通用占位。角色根的 media 连接使用相同规则；不能从作品关系中的 CHARACTER 类型推造具体登场关系。

已知个人或团体的 staffMedia 提供其真实制作／作者工作。采用作品原版范围，排除 ADR 及明确标注的译版、授权版本岗位；普通未限定署名按来源主记录采用，不宣称来源不会漏标。原岗位、集数、卷话范围和署名限定保留在所选 note，不创建 Part 或隐藏版本引用。

| 原始工作                                                | 已明确 Person 的职责                              |
| ------------------------------------------------------- | ------------------------------------------------- |
| Story；Story & Art；Story & Illustration                | creator；后两项再分别提供 drawing 或 illustration |
| Original Creator／Original Story                        | originalCreator                                   |
| Character Design／Original Character Design             | characterDesign／characterCreator                 |
| Director／Chief Director、Episode Director              | director、direction                               |
| Series Composition、Storyboard、Script                  | seriesComposition、storyboard、scenario           |
| Key Animation／In-Between Animation、Animation Director | drawing、animationDirector                        |
| Art、Background Art、Color Design、Photography          | art、photography，按实际岗位区分                  |
| Music、演唱／作曲／编曲等音乐工作，Sound 等音响工作     | music、sound                                      |
| Producer、Editing、明确出版职责                         | producer、editor、publisher                       |
| 其他明确制作参与                                        | other，并保留真实岗位                             |

团体工作使用组织已有同义职责；没有同义职责的真实参与使用 other。通常职业、简介、出演热度或参与其他作品不产生本作工作。

Studio 关系按作品边界读取。isMain=true 明确表达本作主动画制作，可采用 studio；其余关联只证明参与，采用 other 并保留来源说明，不根据组织通常是动画公司或出品公司补出具体职责。Studio 根的 media 连接同样核对 isMainStudio，不因读取方向不同改变角色。

人物 personWorks 声明固定 scope：workTypes 为 anime、comic、novel，roles 使用上表职责，character 为 none。语种字段描述 Staff，缺少作品原配判定所需的对应依据，因此配音资料保留为来源内容，Provider 的成员范围限于制作履历。

organizationWorks 在组织上下文声明 scope:session。openSession 按身份资源确定实际范围：studio/<id> 使用 studio、other；已明确团体的 staff/<id> 使用 creator、originalCreator、music、sound、producer、publisher、other。两者的 workTypes 均限定为本接入支持的 anime、comic、novel，并采用领域的职责相容规则。Studio 的媒体连接见[官方合同](https://docs.anilist.co/reference/object/studio)，根资源与成员类型按本页身份规则解释。

作品上下文中的 Studio 关系使用固定的 studio、other 范围。会话在开始读取前交付相应 relationScopes，后续结果返回普通数组。

<a id="work-relations"></a>

## 作品直接关系与标签

| AniList 关系                    | 本体关系                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| PREQUEL／SEQUEL                 | prequel／sequel                                                                         |
| ADAPTATION／SOURCE              | adaptation／sourceMaterial                                                              |
| SIDE_STORY、SPIN_OFF、SUMMARY   | sideStory、spinOff、summary                                                             |
| COMPILATION／CONTAINS           | compilation／includedWork；端点必须是独立作品                                           |
| ALTERNATIVE                     | related；它也用于同一站外原作的不同改编，单凭此值不足以确定本体的不同演绎               |
| CHARACTER、SAME_UNIVERSE、OTHER | related，保留来源直接联系的含义                                                         |
| PARENT                          | 读取对端指向当前对象的实际关系，分别确定 mainStory、spinOffOrigin、fullStory 等反向含义 |

PARENT 在来源中用于外传、衍生、总集等多种反向关系。接入根据明确的具体含义决定方向；信息不足时保留已经证实的直接联系及来源说明。未知枚举按无法解释报告。

SOURCE 和 ADAPTATION 按来源明确方向采用，不按日期或媒介推断。共享角色、同一世界观和作品合编不建立新的系列实体、角色关系或用户合集。已知范围不同的再版、再剪辑与序章关系不自动作为身份等价。

作品 genres 与 tags 形成实际公共标签。标签 name、description、isAdult 分别提供名称、说明和敏感标记；category 只是来源分类，不展开成附加标签；rank 不变成个人评分、权重或任意 note。

标签应用的 isSpoiler 使用明确的 isMediaSpoiler 或 isGeneralSpoiler；有来源标记的应用保留其剧透属性，不把标记丢掉后当普通标签。需要独立标签定义时读取并有界缓存官方标签字典，不镜像全站作品。

<a id="parts"></a>

## 分部与累计进度

不声明 workEpisodes、workVolumes、workChapters、workExtras 或 Part 字段。airingSchedule 是排播记录；streamingEpisodes 是平台播放条目，可能有多供应方、地区、版本和覆盖缺口。它们不构成已经核实的统一内容目录。

进度中的 episodes／chapters 数量与 progressVolumes 都没有指出具体哪些本地分部完成，也不能仅凭编号将其他来源的目录当作 AniList 顺序。它们可以在来源记录及结果说明中展示，但不导入为分部完成标记、不持续回写。

repeat 不生成多次完成历史；advancedScores 不求平均变成本体总分。作品完成记录也不根据这些累计值推导实际活动区间。

<a id="account"></a>

## 本人授权与续期

正式接入采用[已经确定的新 relay 合同](../private-data.md#relay-protocol)：上游授权码经 relay 的 HTTPS 回调，最后一跳为动态 loopback；扩展与 relay 的交付使用 S256 校验，不在桌面制品中内嵌 AniList client secret。

通过 Viewer 核验本人稳定 ID，保存实际令牌、有效期与账号绑定。公开资料不依赖这个连接；本人 mediaListEntry、私密列表及写入必须使用已核验账号。

AniList 没有细分 scope，账号页不伪称可取得只读授权。扩展只执行用户明确启用的操作，不因令牌具有写权限就自动写入。

官方说明目前仍写“不支持 refresh token”，但本次 authorization_code 响应实际包含刷新令牌，refresh_token grant 返回 200，刷新后的 Viewer 为同一账号。方案因此提供真实已验证的续期流程，通过新 relay 转交上游刷新；不能沿用文档中的“不支持刷新”作为固定行为。保存和轮换遵守秘密原子提交，失效或拒绝时由用户重新授权。

本次来源核验临时使用本机保密客户端取得令牌，原应用回调已经恢复；这不改变正式接入方案，也不代替新 relay 的实现验收。

现有记录的 private 保持原值。连接设置明确选择新列表项的可见性，初值为私密；创建时显式传入，普通更新不重设可见性。收藏不属于私密列表项，按站点自身展示规则处理，不作逐项私密承诺。

账号连接不启动导入或同步。换账号停止旧账号的后续任务并关闭自动功能，断开按共同规则清除秘密、释放未完成会话，保留本地资料。元数据请求、图片和外链不携带用户 token。

<a id="import"></a>

## 本人列表与喜爱导入

使用带本人 userId 的 Page.mediaList 读取实际记录，不仅拼接界面状态分组；记录包含 customLists 与 hiddenFromStatusLists，不能把“从状态列表隐藏”当作记录不存在。按真实分页取得所选类型范围，再按状态或选中的自定义列表成员过滤。

自定义列表的可选名称来自本人 mediaListOptions，选择键包含媒体类型和来源原名，不使用数组下标，也不为其伪造稳定远端 ID。名称失效后报告该选择不可用，不自动对应另一个同序号列表。MediaListCollection 可辅助读取平台分组，使用时完成 hasNextChunk 所要求的所有块并按真实列表项去重。

customLists 默认是名称到布尔值的映射；只有实际为 true 的成员关系才采用。不能把任意对象键、数组位置或另一返回形状当作已选列表名称。

喜爱分别读取 Viewer.favourites 下的 anime、manga、characters、staff、studios，独立完成分页。manga 中的 NOVEL 仍是 Novel；Staff 成员只有已经明确主体类别时才能复用或采用，不能因属于人员喜爱就自动创建 Person。

范围、采用字段、资料方案和目标手动合集分别选择。自定义列表提供来源范围与成员依据，采用后形成普通本地资料及所选合集成员。隐藏标记、私密状态和普通作品标签分别保持原义。

| 来源个人值                | 本地采用                                             |
| ------------------------- | ---------------------------------------------------- |
| PLANNING、CURRENT、PAUSED | planned、active、onHold                              |
| REPEATING                 | active，不推导过去完成次数                           |
| COMPLETED                 | 按共同规则初始化完成事实及清除当前状态，保留已有历史 |
| DROPPED                   | 状态不采用；其他所选字段独立处理                     |
| score(format:POINT_100)>0 | 本人总分，沿共同整数规则采用                         |
| 同一字段为 0              | 未评分                                               |
| 完整 completedAt          | 采用本次所选完成日期；不完整日期不补齐               |
| 已核验本人喜爱            | 相应 Entry 的 favorite，和列表状态分别采用           |

已完成但日期不完整时可以保留未知日期的完成事实。进行中且确有完整过去完成日期时按共同规则处理；repeat、开始日期、notes、累计进度、自由标签或站点技术时间不制造历史。没有个人记录、权限不足或相关 GraphQL 字段失败不能解释为未评分或取消喜爱。

手动导入和默认关闭的自动补齐沿[共同导入合同](../synchronization.md#import)执行。已有本地对象不因自动导入刷新个人值，远端移除不删除本地对象，本地删除后的对象仍可能在后续当前清单检查中重新导入。

<a id="sync"></a>

## 评分、日期与状态写入

已存在的记录按真实 MediaList.id 更新，并核对它属于当前账号和对应 Media；不把 mediaId 当列表项 ID。写入只带所选且需要修改的字段，不重发整条记录，不附带原日期、进度或次数来压制平台联动。

评分读取显式使用 POINT_100，写入使用 scoreRaw。实际 87 分分别显示为 POINT_10 的 8、POINT_10_DECIMAL 的 8.7、POINT_5 的 4、POINT_3 的 3，因此不能先读取用户显示分制再自行线性换算。scoreRaw 的正值 1–100 已有低值样本；0 表示清除。native 的有效 0 分不能写成未评分，null 才发送 0。

高级多维评分模式通过正式总分字段与 scoreRaw 接入，账号评分格式和各维度保持原值。来源自己的重算按实际结果说明，不能将未保留的请求分数报告为成功，也不回写维度来凑出总分。[官方 mutation](https://docs.anilist.co/reference/mutation)分别提供 scoreRaw 与 advancedScores，本接入只写总分。本次实测没有启用高级模式，该模式的实际重算与回读仍需来源验收。

完成日期写入本地最早已知完整日期；清除时显式提交 year、month、day 均为 null 的 FuzzyDateInput。日期可独立更新和清除，不需要把当前状态改为完成。

状态以本地当前安排与完成历史形成：

| 本地投影                         | AniList 目标                                   |
| -------------------------------- | ---------------------------------------------- |
| planned、active、onHold          | PLANNING、CURRENT、PAUSED                      |
| active，当前来源已经为 REPEATING | 保留 REPEATING                                 |
| 当前状态空且已有完成历史         | COMPLETED，接受来源正常的进度、日期和次数联动  |
| 当前状态空且没有完成历史         | 不提供状态清除；status:null 实测会写成 CURRENT |

相同状态无需重写，不能为“规范化”而重复提交 COMPLETED。独立评分和日期更新保持原状态、数量和 repeat，CURRENT 与 COMPLETED 均按此处理。

<a id="coupling"></a>

## 创建与原生联动

本次真实调用确认如下行为：

| 动作                                         | 实际结果                                             |
| -------------------------------------------- | ---------------------------------------------------- |
| 仅提供评分创建列表项                         | 默认 CURRENT，并自动填写开始日期                     |
| 转为 CURRENT，明确传入空 startedAt           | 可以保持开始日期未知                                 |
| 转为 COMPLETED，未提供完成日期               | 自动填写完成日期                                     |
| 转为 COMPLETED，明确传入原完成日期或全空日期 | 能保留该日期                                         |
| 已知总集数 28，转为 COMPLETED                | progress 强制变为 28；显式传入原值 0 或 2 也不能保留 |
| REPEATING 转为 COMPLETED                     | repeat 增加；显式传入原次数也不能阻止                |
| 直接将 progress 提高到已知总量               | 可以联动改为 COMPLETED 并填写日期                    |
| 小说总话数和总卷数均为 null，转为 COMPLETED  | 本次保留了已有的 2 话、1 卷进度                      |

据此沿[共同原生写入规则](../synchronization.md#writes)执行：

1. 已有记录的评分、完成日期和合法状态更新分别提供。没有记录时也可仅凭正评分或完整完成日期创建，接受默认 CURRENT 及来源自动日期，不要求额外选择状态。新项明确传入已选择的 private；仅清除字段且没有记录时无需修改。
2. 正常提交 CURRENT 或 COMPLETED，接受来源自动填写的日期、已知总量进度和 REPEATING 完成时的 repeat 增量；不以原进度未满或次数会增加为理由拒绝。
3. 完成日期也被选中时，同次提交本地最早已知日期或明确清空值；未选时不发送 completedAt。startedAt 没有本体同义字段，不发送空值或原值干预来源行为。
4. 已经为 COMPLETED 时不重复提交该状态，评分、日期等字段仍按各自差异更新。写入结果不确定时先回读，不重放可能再次增加次数的状态转换。
5. 来源联动结果在本次报告中表达；不将自动日期或 repeat 反向生成本地完成历史，也不把满进度转成本地逐分部标记。

不提供累计进度或重看次数的独立同步入口；它们没有足以对应具体本地记录的语义。正常状态转换不受此限制，不补选字段、不恢复进度或次数，也不删除重建记录。状态清空仍不支持，status:null 变为 CURRENT 不能当作清空成功；其他有效所选字段可以继续提交。

<a id="favourites"></a>

## 喜爱同步

喜爱对动画、漫画／小说、角色、已明确主体的 Staff 和 Studio 分别使用对应的来源身份，与媒体列表存在与否无关。只按 native favorite 投影，不把收藏列表、计划、购买或完成当作喜爱。

ToggleFavourite 是切换操作。先读取当前事实，仅在与目标不同的时候调用一次；不能把重试当作幂等设置，也不能为读取下一页重新执行 mutation。

本次切换成功后，首次立即读取 Media.isFavourite 仍曾返回旧值，后续读取才更新。写后结合成功 mutation 的结果与本人收藏读取做有界一致性核对，不因一次旧值再次切换。结果不确定时保留未确认状态，先等待并重读，不能盲目重放。只有完整且有效的读取才可用来确认“未收藏”。

撤回喜爱不删除媒体列表项；删除本地条目仅退出同步范围，不自动删除平台记录或喜爱。来源不能表达的占位角色和未明确类型的 Staff 不形成自动写入目标。

<a id="pages"></a>

## 配置、页面与内部组织

资料采集页管理名称搜索是否包含成人作品、请求超时和读取重试，并提供匿名联网测试及来源使用说明。成人搜索默认包含：包含时不加入 isAdult=false 过滤，关闭时才限定非成人；该选择不影响已知身份和本人清单。

使用固定官方 GraphQL 地址，不保留旧镜像地址和 preferRomajiTitles。资料语言来自本体，单次超时默认 20 秒，安全读取重试默认 2 次。保存、联网测试和恢复普通默认值分别执行。

账号页管理授权、续期状态、本人摘要、新列表项可见性及断开；导入页负责清单和成员范围、个人字段采用、资料方案、目标合集与自动补齐；同步页负责绑定对象范围、字段、手动执行和默认关闭的自动执行。

所有 GraphQL 调用共用限流。按实际响应头调整预算，本次返回 30 次／分钟；遵守 Retry-After，不按过时的 90 次默认额度持续请求。GraphQL 错误、鉴权失效、来源限制与网络重试分别处理。

Node 和 Webview 的职责如下：

```text
src/
├── node/
│   ├── entry.ts
│   ├── client/
│   │   ├── client.ts
│   │   ├── documents.ts
│   │   ├── validation.ts
│   │   └── types.ts
│   ├── account/
│   │   ├── account.ts
│   │   ├── authorization.ts
│   │   └── store.ts
│   ├── metadata/
│   │   ├── provider.ts
│   │   ├── identities.ts
│   │   ├── archives.ts
│   │   ├── relations.ts
│   │   ├── credits.ts
│   │   └── descriptions.ts
│   ├── import/
│   │   ├── importer.ts
│   │   ├── lists.ts
│   │   ├── adoption.ts
│   │   └── scheduler.ts
│   ├── sync/
│   │   ├── synchronizer.ts
│   │   ├── projection.ts
│   │   ├── writes.ts
│   │   ├── store.ts
│   │   └── subscriptions.ts
│   ├── settings.ts
│   └── ipc.ts
├── webview/
│   ├── entry.tsx
│   └── pages/
│       ├── metadata/page.tsx
│       ├── account/page.tsx
│       ├── import/page.tsx
│       └── sync/page.tsx
└── shared/
    ├── contracts.ts
    └── validation.ts
```

GraphQL 文档与响应由 client 管理，metadata 解释图谱范围，writes 维护来源操作、所选值投影和原生联动的实际结果。import、sync 复用本体完整操作和事实事件，不新增 provider 协议或镜像资料库。Webview 使用既定 Solid 和公共组件，不读取秘密、直接联网或写数据库；任务寿命不依赖页面。

<a id="verification"></a>

## 预设与验证

来源事实见[接口报告](../../../verification/evidence/anime-platforms/live-api.md)与[结构化记录](../../../verification/evidence/anime-platforms/2026-10-16-api.json)。默认预设遵守本页的主体、原配、上下文与时长范围，用户保存的资料方案不自动重写。

AniList 用途条款的适用性是发行条件之一，依据见[来源筛选](../../../verification/evidence/source-selection/comparison.md)。官方字段、实际来源调用、用途条件和扩展运行分别核验；API 可读或其他客户端获列出不能证明项目已获认可。

验收覆盖非空自定义列表、隐藏成员、真实私密访问失败、高级多维评分模式、其他喜爱对象的实际切换、大规模分页与并发变化。完整页面、自动触发、本地采用、同步确认、取消以及图片解码分别验收。
