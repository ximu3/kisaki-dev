# 资料预设目录与采用规则

资料预设为七类 Entry 分别提供简体中文、繁体中文、英文和日文配置，共二十八项。每项预设固定语言初值、参与来源、对象字段和关系规则。用户选用后，配置进入普通 MetadataProfile 草稿；保存后成为用户独立维护的资料方案。

<a id="ownership"></a>

## 资源引用与配置副本

选用资源和复制配置具有不同的更新语义。引用的资源继续由原作者维护，复制得到的配置则由新拥有者维护。这一差别取决于业务模型，与内容来自内置功能还是扩展无关。

| 内容         | 使用模型                             | 更新含义                                                                       |
| ------------ | ------------------------------------ | ------------------------------------------------------------------------------ |
| 主题         | 选用已注册主题，修改他人主题时 Clone | 同一主题身份的作者更新作用于继续选用它的用户；Clone 后独立                     |
| 资料方案     | 模板建立用户自己的 MetadataProfile   | 来源、字段、匹配和合并策略由用户配置决定，不随模板更新改写                     |
| 文件识别方案 | 模板建立用户自己的同媒介识别方案     | 多个目录引用该用户方案；模板更新不改写方案，用户修改方案影响引用目录的后续识别 |
| Showcase     | 模板建立用户自己的展示区块           | 布局、数量、筛选和排序保持用户配置；查询与呈现实现正常更新                     |
| 线索提取规则 | 模板填入用户可编辑的规则             | 规则副本不自动合并后续模板改动                                                 |

各业务拥有自己的模板目录、定义与采用操作，字段范围由所属业务合同确定。工程脚手架在开发工具中独立提供。

目录项包含稳定 ID、本地化名称和说明，以及该业务必需的适用信息。类型、布局或依赖若能从配置可靠推导，就不重复手填；适用语言等需要作者判断的信息则明确声明。预设入口、搜索、筛选、目录、详情、空态和选择交互遵循[共同预设界面](../ui/components.md#presets)，各业务保留实际需要的字段、依赖和默认筛选条件。

载入模板只填写其声明范围内的普通草稿，校验和保存由所属业务负责。已有配置载入模板时，应明确替换范围；保存后保留原 ID 和范围之外的字段。被替换的手动修改不自动进行三方合并，也不维护模板版本基线或持续覆盖层。后续模板修复不改写旧副本，但格式演进及业务、provider 实现修复仍正常生效。

正式目录还包括 [10 项展示柜预设](../ui/showcase.md)、[9 项扫描规则](scanner.md#presets)，以及 holdings 管理的[文件识别方案预设](file-recognition.md#recognition-presets)。引导需要采用时复用所属功能的同一份定义，不维护引导专属副本。固定阅读选项和默认主题不会仅因被称为 preset 就变成配置模板。依赖缺失或资料库为空时，目录仍展示推荐及完整配置。首次选择流程由[引导](onboarding.md)定义。

<a id="languages"></a>

## 适用语言、筛选与固定初值

applicableLanguages 表示整份固定预设面向哪种资料语言需求，与目录文案的翻译及 Profile.preferredLanguages 分别定义。该字段必填：null 表示不限语言，非空规范语言标签列表表示明确适用范围。空列表或缺席都不能解释为不限语言。

适用语言不能取所有 provider 支持语言的并集，也不能包含全部回退语言。它只用于预设目录，不写入创建后的 Profile，也不永久限制用户编辑方案。

| 语言版本     | applicableLanguages | preferredLanguages 固定初值 |
| ------------ | ------------------- | --------------------------- |
| 简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 英文优先     | en                  | en → ja                     |
| 日文优先     | ja                  | ja → en                     |

繁体版本允许直接采用简体回退，预设说明须注明这一行为。四种版本覆盖当前主要需求，公开语言合同继续接受其他合法语言。语言初值确实不同时，可以共用固定字段定义，但每份预设保存完整规则；仅文案翻译不同而实际值相同的配置共用同一版本。

目录首次筛选优先使用业务已经明确的资料语言。新建入口没有这项选择时，可以参考 UI 语言。筛选条件应可见、可改、可清除，不持续覆盖用户选择。不限语言的项目可出现在任意语言筛选结果中；零结果时明确提示，并允许清除条件，不自动改为英语或切换预设。依赖不足单独展示，不能删除来源后生成同名的缩减配置。

用户选择预设时，载入的是预设本身的固定值，筛选语言不会写入配置。切换 UI 语言只改变目录文案，不重建草稿、已有方案或资料库内容。preferredLanguages 先影响各来源内部的取数，再由字段 provider 顺序决定取值；合法语言回退不会被跨来源的目标语言优先级覆盖。完整语义见[语言合同](metadata-profiles.md#languages)。

<a id="catalog"></a>

## 二十八项固定预设

| 编号 | 预设                  | applicableLanguages | preferredLanguages          |
| ---- | --------------------- | ------------------- | --------------------------- |
| 1    | 游戏资料·简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 2    | 游戏资料·繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 3    | 游戏资料·英文优先     | en                  | en → ja                     |
| 4    | 游戏资料·日文优先     | ja                  | ja → en                     |
| 5    | 动画资料·简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 6    | 动画资料·繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 7    | 动画资料·英文优先     | en                  | en → ja                     |
| 8    | 动画资料·日文优先     | ja                  | ja → en                     |
| 9    | 漫画资料·简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 10   | 漫画资料·繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 11   | 漫画资料·英文优先     | en                  | en → ja                     |
| 12   | 漫画资料·日文优先     | ja                  | ja → en                     |
| 13   | 小说资料·简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 14   | 小说资料·繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 15   | 小说资料·英文优先     | en                  | en → ja                     |
| 16   | 小说资料·日文优先     | ja                  | ja → en                     |
| 17   | 角色资料·简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 18   | 角色资料·繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 19   | 角色资料·英文优先     | en                  | en → ja                     |
| 20   | 角色资料·日文优先     | ja                  | ja → en                     |
| 21   | 人物资料·简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 22   | 人物资料·繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 23   | 人物资料·英文优先     | en                  | en → ja                     |
| 24   | 人物资料·日文优先     | ja                  | ja → en                     |
| 25   | 组织资料·简体中文优先 | zh-Hans             | zh-Hans → ja → en           |
| 26   | 组织资料·繁体中文优先 | zh-Hant             | zh-Hant → zh-Hans → ja → en |
| 27   | 组织资料·英文优先     | en                  | en → ja                     |
| 28   | 组织资料·日文优先     | ja                  | ja → en                     |

各类型的完整字段、关系和来源顺序分别定义如下：

| 类型                                      | 配置范围                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| [游戏](metadata-presets/games.md)         | 以日 Gal 为主的 ADV、Galgame、视觉小说资料、角色、制作、跨媒体关系与美术。 |
| [动画](metadata-presets/anime.md)         | 独立作品及季、角色制作、真实分集/附加内容和对应图片。                      |
| [漫画](metadata-presets/comics.md)        | 作品、作者画师、角色、真实卷话/收录及单册资料。                            |
| [小说](metadata-presets/novels.md)        | 叙事作品、作者插画家、真实卷、出版参与和单册资料。                         |
| [角色](metadata-presets/characters.md)    | 跨 ACGN 角色档案、出场及有作品上下文的人员工作。                           |
| [人物](metadata-presets/persons.md)       | 声优、游戏创作者与漫画/小说作者的档案和实际作品工作。                      |
| [组织](metadata-presets/organizations.md) | 制作方、工作室、社团、出版社及品牌的档案和作品参与。                       |

配置表的来源名称指向稳定 providerId。[来源键](../extensions/providers.md#source-keys)用于 ExternalIdentity，与能力登记的 providerId 分别维护。相同值合并展示仅为方便阅读，实际 definition 必须显式保存 providers、matching、fields 和 relations。未配置的规则直接省略，不存储“未配置”或 null。运行时不重新计算来源交集，也不自动加入来源新增的能力。

<a id="creation"></a>

## 创建与载入

手动创建、选用预设和从单个 provider 创建，都使用同一编辑器、校验及保存过程，最终得到普通 MetadataProfile。

从单个 provider 创建时，根据所选 EntryType 和实际能力生成可检查的草稿，并明确覆盖范围。生成的规则独立保存，provider 后续增加能力不会自动修改已有方案。只提供图片的能力可以生成图片方案，但不能因此保证足够创建完整条目。

选用预设时，用户先确定类型和可见的语言筛选，再查看固定语言、参与来源、字段与关系规则及依赖，随后载入草稿，按需编辑并保存。是否设为默认须另外明确。选择资料语言不会切换 UI、修改其他方案或覆盖库内资料。普通入口与引导采用相同内容，引导首次不预选需要创建的方案。

修改已有方案的 preferredLanguages，只影响后续传给来源的语言输入，不暗中重排来源。用户若要整体更换获取策略，可以在当前草稿载入另一份同类型模板，明确替换语言和资料规则，同时保留名称、默认资格及无关属性。保存前可以取消，但替换范围内的手动修改不会自动保留。

游戏预设统一服务以日 Gal 为主的用途。[Steam](../extensions/sources/steam.md)与 [IGDB](../extensions/sources/igdb.md)按实际字段能力选用，各字段的来源组合由资料收益和依赖成本决定。来源扩展完整交付自身合同，用户可以在资料方案中选用默认预设之外的能力。

<a id="selection"></a>

## 共同取值与对应规则

各类型表中的箭头表示 firstNonEmpty 按顺序选择来源，“合并”表示 union，“不配置”表示 definition 省略该规则。fields.entry 定义根对象字段；relations 先按成员规则确定集合，再补充已对应关系的属性，属性来源不引入新成员。

fields.tags 读取标签定义，entryTags 表达条目与标签的应用关系。标签身份沿共同 nameKey 规则处理，普通同名应用保留已有标签资料。

普通标量使用 firstNonEmpty，false 和 0 都是有效值。主图、背景、标题标志和图标分别选择首个非空候选集合。别名与链接使用 union；原始语言采用一份非空回答，不混入发行版本支持的语言。

单部作品的名册、作品关系和分部清单选择首个非空集合。独立角色的出场记录，以及人物、组织的跨作品履历，则按各自表格使用 union。两种用途不能互换。

游戏 workRelations 固定使用 Bangumi → VNDB → Wikidata，优先取得跨媒体清单。不能把 AniList 动画节点当作游戏，也不能混合所有站点的分类。中文独立档案优先使用跨 ACGN 中文来源，游戏中的关联档案则保留适合 Gal 的来源顺序。名称、简介和图片各按具体字段表取值，不用一条语言排名控制全部字段。

YMGal 的在线反向查询只支持组织的开发作品，人物和角色预设不向它请求反向关系。普通字段补充不带来关系枚举能力。

预设不配置 processors，不从简介推测身体属性或工作职责，也不按列表长度生成声明数量。未配置表示该预设默认没有选择这项规则，不表示 provider 或模型永远不支持。

完整身份优先于回退。以下固定回退分别保存在各份预设中：

| 对象               | 依次尝试的固定回退                                              |
| ------------------ | --------------------------------------------------------------- |
| 四类作品           | originalName ＋ releaseDate；name ＋ releaseDate                |
| 角色               | originalName ＋ birthDate                                       |
| 人物               | originalName ＋ birthDate                                       |
| 组织               | originalName ＋ foundedDate                                     |
| 小说卷、漫画卷和话 | 同作品及同编号范围内的 numberLabel；originalName ＋ releaseDate |
| 动画分集           | type ＋ numberLabel；type ＋ originalName ＋ releaseDate        |
| 动画附加内容       | type ＋ originalName ＋ releaseDate                             |
| 标签               | nameKey，不进入上述 Entry／Part 匹配                            |

回退要求键中的所有值真实且可比，且只有一个候选。已知身份、类型、归属或版本冲突不能被回退掩盖，缺少日期时也不降为纯名称匹配。Part 编号还受所属作品、种类及编号范围约束；卷内编号不能当作整部作品编号。预设不定义新的编号唯一规则，也不据此生成 sourceId。

Provider 使用真实结构 ID 和可以确认的外链。跨站 ID 相连，也不意味着整剧与单季、版本与单册或作品可以无条件合并。某来源只用于定位，应由规则表达，不另存角色模式，更不裁剪 provider 本身的能力。作品首发日期不能替换为商店上架、试玩、移植或汉化日期。

这些规则只决定候选资料。实际读取范围和本地采用由本次请求及 ingest 决定。已有对象必须成为明确目标才会修改；必要的新人物、角色和组织可以初始化，但关联作品和履历不会触发递归建库。缺少来源不授予清除权限，换图也不会绑定另一来源的身份。

<a id="source-constraints"></a>

## 来源字段与映射约束

来源适配须核对字段含义、语言、身份粒度、关系成员及属性、图片用途和读取条件。各 Provider 的输入、输出及生命周期见[来源合同](../extensions/catalog.md)，实际接入按[专项验收](../../verification/coverage.md)验证。

[VNDB](https://api.vndb.org/kana) 的游戏、角色、staff 署名别名和制作方，均按真实主体处理。制作方记录如果表示个人，不能强制映射为组织。traits 标签使用 group_name 与 name 共同表达完整语义，并保留 description、sexual 和 spoiler 的含义；不为此增加本体标签分组，也不自动翻译。Bangumi 的公司与人物、跨媒体清单及职责按真实分类映射，仅有“动画”或“书籍”分类不足以证明改编方向。

[AniList](https://github.com/AniList/docs) 的 Media 只有 ANIME 和 MANGA，小说需要进一步根据 format 判断，不存在游戏节点。按[已确认接入范围](../extensions/sources/anilist.md)，混合 Staff 不参与作品／角色侧人物工作发现，已明确人物可读取自身非配音制作履历；Studio 与已定类团体分别使用实际能力。普通单集时长不作为整部时长，排播不生成分部。Tag 的 description、两种 spoiler 及 isAdult 保持原义。Studio 没有的简介、标志、别名或生平日期不能虚配。设置目标语言偏好也不会把原正文变成译文。

[MangaDex](../extensions/sources/mangadex.md) 的 author 资源不区分个人与团体，只为已经明确主体类别和来源身份的对象补充名称、图像、多语传记和网站，不自动产生创作者关系，也不补造生日或原文名。章节 pages 是发布图片数，publishAt 和 readableAt 是发布及可读时间，均不作原作声明页数或发表日。默认漫画方案以 MangaDex 补充真实卷清单；每卷重置编号时，只采用明确的卷内 numberLabel，不填入作品范围话号。卷没有独立来源身份，封面资源也没有卷的独立外链页，因此不以 MangaDex 填写卷 externalLinks。语言变化不删除原作话或重建身份。

MangaUpdates 的默认采用范围见[来源合同](../extensions/sources/mangaupdates.md)，字段依据见[来源核验](../../verification/evidence/mangaupdates-anidb/live-api.md#metadata)。Author.actualname 用于原文发表用名；只有 status=Deceased 且 status_date 有效时采用死亡日期。混合 Author 保留为来源背景，已明确主体可补充其自身履历。latest_chapter、当前出版卷数及表示翻译完成的 completed 均保持来源含义，不作为原作最终总量或完结依据。

[RanobeDB 的来源合同](../extensions/sources/ranobedb.md)分别解释 Series、Book、署名和 Publisher。sort_order、书目数量和卷号不能混用，c_num_books 不映射为声明卷数。series.description、book_description 和卷的日文正文不能互相代用；Series 代表封面沿官网选定的首册图片。混合 Staff 不用于作品／角色上下文的人物工作发现，保留已明确主体自身的原作履历；没有适用图像或生平日期时保留缺项。

[Google Books](../extensions/sources/googlebooks.md)为已明确作品或卷补充出版书目资料，不加入固定默认预设。语言、简介、页数和出版日期保留版本范围，作者与出版社文字作为原始书目内容处理。

[NDL Search](../extensions/sources/ndl.md)纳入漫画与小说的默认预设，仅为已明确对应的卷补充 name、externalLinks、releaseDate 和 declaredPageCount，来源顺序见[漫画卷](metadata-presets/comics.md)与[小说卷](metadata-presets/novels.md)的字段表。RSS 更新时间不作为出版日期，书影能力沿来源合同处理。

[TMDB](https://developer.themoviedb.org/docs/languages) 的本地化、[人物资料](https://developer.themoviedb.org/reference/person-details)和图像按来源的缺项与回退规则采用，身份和配音阵容保持原有归属。电影片长可以映射整部时长；单集时长只表达一集，整季时长须有自己的来源依据。整剧图片用于单季时也须核对适用范围。

Wikidata 使用明确的 labels、aliases、语言、日期和关系，字段及陈述范围见[来源方案](../extensions/sources/wikidata.md)，字段依据见[来源核验](../../verification/evidence/reference-sources/live-api.md)。四类作品的关系说明采用 Wikidata，关联游戏的原始语言由其他适用来源提供。

映射按陈述含义判断：简短 description 不作为剧情长简介；P144、P4969 的具体关系与 P155、P156 的先后含义分别核对；P747 中的译本和发行版本保持原有粒度。能够确定具体类型时采用对应关系，其余使用 related 并保留原义。预设范围以已定义规则为准。

预设中未配置的特别篇声明数量、漫画或小说整部页数，以及部分标题标志，应保持缺项。日文档案长简介和繁体正文可以按规则合法回退；applicableLanguages 不保证每个字段都有目标语言。系统不会为填齐字段而默认翻译、转换简繁体或借用首卷介绍。

<a id="non-default-sources"></a>

## 依赖与提供者可用性

每份预设的 providers 清单列出参与定位和读取的全部提供者，资料规则只能引用清单内的 provider。安装其他扩展不会自动扩大方案。用户需要其他来源时，通过普通 Profile 编辑加入，并为相应字段或关系设置明确规则。

Provider 应按[官方来源合同](../extensions/sources.md#source-mapping)实现全部适用能力。一份预设没有引用某字段、关系或来源，不妨碍其他方案按已声明能力使用。

依赖缺失时，编辑器保留完整配置，并标出受影响的 provider 和规则。用户安装依赖或明确修改草稿后再保存，程序不能静默删减。普通创建和引导使用同一份预设定义，保存后的方案由用户独立维护。
