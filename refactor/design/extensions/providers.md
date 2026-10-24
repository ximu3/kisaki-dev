# 资料提供者、字段处理器与识别器

metadata.providers 负责解释来源记录并按请求读取资料，metadata.fieldProcessors 负责加工已经选取的字段，scanner.recognizers 负责从实际候选中取得识别线索。三类实现都需要明确登记、选用和释放。组合算法和结果采用仍由各自领域负责。

<a id="identity"></a>

## 外部身份与来源条目

```ts
interface ExternalIdentity {
  source: string
  sourceId: string
}

interface SourceEntry<T extends EntryType = EntryType> {
  type: T
  identity: ExternalIdentity
  identification: IdentificationFields<T>
  externalIdentities?: ExternalIdentity[]
}
```

ExternalIdentity 适用于七种 Entry 和五种真实 Part。source 与完整、规范的 sourceId 共同确定一条来源记录，并提供读取该记录所需的身份依据。认证、语言、缓存和网络配置不属于身份。宿主将 sourceId 视为不透明字符串并精确比较；支持同一 source 的不同 provider 必须使用同一语法，不依赖判等回调、隐含的跨调用表，或附加的 JSON key、locator、readContext。复杂标识应包含必要的资源类别、实例或父级范围，来源读取可以在内部发起多个请求。

<a id="source-keys"></a>

### 来源键的命名

source 使用来源实际采用的品牌名称或正式通用名称，转为小写并去除空格和展示用标点。品牌本身使用缩写时保留该拼写，例如 vndb、igdb、tmdb；MyAnimeList 使用 myanimelist，不另缩写为 mal。月幕Galgame 使用 ymgal，标识体系采用 isbn 等通用标识。必要的地域或实例限定由对应来源固定。

#### 官方来源扩展（17 项）

下表与[官方扩展目录](catalog.md#catalog)中的 17 个资料与平台来源对应，列出各扩展的主要来源键。

| 来源或标识体系        | source       | 来源资源语法                                     |
| --------------------- | ------------ | ------------------------------------------------ |
| VNDB                  | vndb         | [VNDB](sources/vndb.md#identities)               |
| Bangumi               | bangumi      | [Bangumi](sources/bangumi.md#identities)         |
| 月幕Galgame           | ymgal        | [月幕Galgame](sources/ymgal.md#ymgal-scope)      |
| MangaDex              | mangadex     | [MangaDex](sources/mangadex.md#identities)       |
| TMDB                  | tmdb         | [TMDB](sources/tmdb.md#identities)               |
| SteamGridDB           | steamgriddb  | [SteamGridDB](sources/steamgriddb.md#lookup)     |
| Steam                 | steam        | [Steam](sources/steam.md#identity)               |
| IGDB                  | igdb         | [IGDB](sources/igdb.md#identity)                 |
| MyAnimeList           | myanimelist  | [MyAnimeList](sources/mal.md#identity)           |
| AniList               | anilist      | [AniList](sources/anilist.md#subjects)           |
| Google Books          | googlebooks  | [Google Books](sources/googlebooks.md#identity)  |
| RanobeDB              | ranobedb     | [RanobeDB](sources/ranobedb.md#identity)         |
| MangaUpdates          | mangaupdates | [MangaUpdates](sources/mangaupdates.md#identity) |
| 国立国会图书馆（NDL） | ndl          | [国立国会图书馆书目](sources/ndl.md#identity)    |
| itch.io               | itchio       | [itch.io](sources/itchio.md#identity)            |
| Wikidata              | wikidata     | [Wikidata](sources/wikidata.md#identity)         |
| Fanart.tv             | fanarttv     | [Fanart.tv](sources/fanart.md#identity)          |

#### 其他已有的外部身份键

以下键由既有导入、跨站映射或出版物对应使用，不增加官方来源扩展。[来源排除规则](catalog.md#excluded)允许保留有依据的外部标识，同时排除对应网站的官方提供者与隐含读取。

| 标识来源                 | source        | 保留用途                                                                                                                         |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Goodreads                | goodreads     | [Goodreads 导入器](importers/goodreads.md#input)保存导出中明确的公开书目身份                                                     |
| LaunchBox Games Database | launchbox     | [LaunchBox 导入器](importers/launchbox.md#identity)保存公开 DatabaseID，不保存内部库 ID                                          |
| Kitsu                    | kitsu         | [MangaDex 跨站映射](sources/mangadex.md#links-tags)与 [Kotatsu 导入](importers/kotatsu.md#identity)复用 manga/<id>，不调用 Kitsu |
| BOOK☆WALKER 日本站       | bookwalker-jp | [MangaDex 跨站映射](sources/mangadex.md#links-tags)保留范围一致的系列身份，不调用 BOOK☆WALKER                                    |
| ISBN                     | isbn          | [出版物对应](sources/ndl.md#identity)使用经过校验的 ISBN-13；它是标识体系，不是独立来源扩展                                      |

17 项限定官方来源扩展的交付范围，source 仍是[开放身份](../domains/values.md#vocabularies)。其他来源按同一命名规则定义键及资源语法；值由适配器生成，宿主精确比较，不根据显示名或简称自动改写。

上游字段、URL、原生 ID 和文献标准名称保持原语法。例如 MangaDex 的 links.mal 映射为 myanimelist，Vnite 的 metadata.vndbId 对应 vndb；sourceId 中的 v17、manga/123 等原生标识不随来源键改名。providerId、扩展 ID、文档路径与来源键分别表达自己的身份，同一来源的正式绑定只使用同一个规范键。

### 完整身份示例

| source  | sourceId 示例   | 含义                                 |
| ------- | --------------- | ------------------------------------ |
| vndb    | v17             | 来源原生编号已包含资源类别           |
| bangumi | subject/123     | 条目资源范围及编号                   |
| bangumi | person/123      | 人物资源范围及编号                   |
| tmdb    | tv/100/season/2 | 系列 ID 与季编号组成的完整季资源标识 |

TMDB 的 tv/100/season/2 已包含读取系列与季所需的依据。独立 season ID 可以留在 provider 缓存中，不再冗余持久保存。外部身份不承诺来源键永远不变；来源编号发生变化时，按真实依据更正。本地改名、改编号或调整顺序不会改变来源身份。

TMDB 的作品目标仅为适用影片和范围一致的标准季，TV 只提供季查询上下文，不接入剧集组。已知分集仍可按标准季集身份直接读取，具体边界见[TMDB 接入范围](sources/tmdb.md#scope)。

SourceEntry.type 表达七类 Entry 中的对象类别。identity 指向该对象自己的一个来源记录；externalIdentities 保存来源明示的其他等价身份，既可以来自其他来源，也可以是同一来源的另一条记录，并排除 identity 本身。

identification 使用来源的识别资料。完整名称需要父级标题和自身名称时，由 provider 按来源规则组合，搜索、定位与字段读取共用这一规则；父级身份仍属于父级。查询词、界面装饰和处理器输出只用于各自用途。

用户合并搜索目标时，另行整理 clues，保留原 SourceEntry。弱规则得到的对应仅用于本次执行；长期身份绑定只接受来源明示或用户确认的等价关系。

Entry 与 Part 的读取结果沿同一身份含义。例如，来源明确归为同一话的不同发布 UUID 可以对应一个 ComicChapter，并保留各个真实身份；不能仅因名称或编号相同就宣布等价。匹配核对这一组全部身份，不能只检查 identity。组内身份已绑定不同目标，或与作品归属、类型冲突时，按现有身份冲突处理，不选第一项、丢弃其余身份或自动合并目标。新增、更新和明确身份编辑仍使用既有完整操作边界，单纯读取不保存绑定。

宿主只校验通用值、绑定规则和 URL 编码，不通过修剪空白、转换大小写、NFKC 或截取数字猜测身份等价。允许多种输入写法的来源，由适配方在形成正式值前完成规范化。查询和 deeplink 不会启动 provider 来修正输入。身份变更必须完整核对冲突，不能作为普通 overwrite 处理。只读、搜索和换图不会写入绑定；ingest 明确采用来源身份，或用户明确编辑绑定时，由 library 按同一身份约束保存。

Entry 和 Part 的绑定分别存入各自[身份表](../domains/catalog.md)，不建立通用父表或附加坐标。Part 拥有身份，不代表它成为独立的 search、resolve 或 session 根。Tag 使用 nameKey，没有外部 ID。[EntryIdentifier](../ui/navigation.md#identity) 只用于寻找根条目；source 和 sourceId 各自编码为一个组件。JCS 不用于身份，但仍用于分发签名。

<a id="source-links"></a>

## 从源记录提取跨站身份

provider 读取来源结构中的跨站编号和已知外链，核对站点与资源语法后生成规范身份。来源明确给出对应关系时，不能只保存展示链接而遗漏身份；未知链接可以保留为 externalLinks，不猜测其对应。本体不新增通用 URL 提取贡献，也不增加用户网页导入入口。

链接可能指向发行版、整部剧集、另一季、人员、关联作品或官网，必须按真实范围处理，不能全部绑定到当前对象。相关 Entry 和 Part 分别保留自己的真实身份。为提取身份而读取必要的原链接，不受 fields.externalLinks 开关限制，也不会扩大普通字段输出。metadata 不在合并后再次通用抽号，或遍历外链网站寻找身份。

来源格式解析由对应 provider 负责，可以复用纯工具。宿主不按域名、数字或相似度推断身份。一条对应链如果前段依赖弱匹配，后段出现真实外链也不能自动使整条链成为强绑定；最终采用必须保留原有依据。

<a id="capabilities"></a>

## 能力声明与登记

```ts
const registration = await context.metadata.providers.register({
  id: 'metadata',
  name: 'Example',
  capabilities: {
    anime: {
      search: true,
      resolve: true,
      read: {
        objects: {
          entry: {
            identitySources: ['example'],
            fields: ['name', 'description', 'primaryImage']
          },
          relatedEntries: {
            person: {
              fields: ['name']
            }
          },
          parts: {
            episode: {
              identitySources: ['example'],
              fields: ['numberLabel', 'name', 'description']
            }
          }
        },
        relations: {
          personWorks: {
            fields: ['note'],
            scope: [{ roles: ['characterDesign'], character: 'none' }]
          },
          workEpisodes: { fields: [] }
        }
      }
    }
  },
  search,
  resolve,
  openSession
})
```

capabilities 分别为七种 Entry 上下文声明实际实现的 search、resolve、read 和图片候选能力，字段使用[固定目录](../domains/metadata-profiles.md#fields)。执行时按来源要求核对连接与网络条件，各记录只回答真实可用的值。能力缺席表示不支持，已声明能力须有实现。search 面向条目，并独立声明搜索方式；Part 经 parts 读取。

read.objects 的 fields 声明普通字段，identitySources 声明可直接读取的 ExternalIdentity.source。根节点用它解释 openSession.identity，相关 Entry 与 Part 节点用它解释 refs；来源优先序由资料方案决定。相关节点省略 identitySources 时，读取限于真实根或关系上下文；支持根身份读取时须明确声明该列表。关系读取可以使用 entry.fields: []，仅为已知相关 Entry 或 Part 补字段时也可以省略根 entry。

relations 能力节点包含 fields，表示可提供的普通属性；fields:[] 表示只提供成员。四类资料关系还声明 scope，取[固定范围](../domains/metadata-contracts.md#relation-scopes)、null 或 session。固定范围在登记时确定；null 表示该能力只提供补充事实；session 由读取会话根据目标确定为具体范围或 null。entryTags、volumeChapters 和分部所属清单的上下文范围由各自关系键确定。

节点缺席表示未提供该能力。请求中的 fields 选择本次属性，成功结果直接返回成员数组。resolve:true 表示实现了定位操作，实际结果由输入线索决定。

图片候选按照 primaryImage、backdropImage、iconImage、titleLogo 及各类型适用性单独声明。输入为 { entryType, field, query, cursor?, preferredLanguages? }，结果为 { images: ImageCandidate[], nextCursor? }，取消通过 context 传递。图片候选不带来通用字段搜索、另一套 provider 注册域或 Part 搜索能力。

候选原图与可选图片缩略遵守[公共图片合同](../domains/attachments.md#images)。来源不自建转换或播放器；不可用的视频缩略不能使受支持的动态原图从候选中消失。

register 的局部 id 由宿主绑定为 extensionId:localId，name 和可选 description 使用 LocalizedText；句柄提供只读 ref 和 dispose。能力描述是可传递值，方法由实例持有。注册域内 ID 唯一，失效的 Profile 引用保留供用户处理。Profile 保存提供者 ID、四组规则和语言；来源私有设置归扩展。影响读取范围的设置在会话建立时固定，设置变更用于新会话及其他后续调用。

<a id="resolve"></a>

## 搜索与来源内定位

提供者按字段级能力接收请求，并按实际来源接口批量读取。固定语义目录覆盖七类条目字段、四类资料关系、Part 与内容组织、标签及图片，加工范围限于其中的可加工字段。外部身份用于对应，私人记录、持有内容、阅读位置、技术主键与技术时间由相应本体能力管理。

search 提供独立的候选浏览。resolve 使用 { entryType, clues, preferredLanguages? } 在一个来源内定位，并单独接收 context。clues 包含当前类型适用的识别字段和 externalIdentities，WorkClues 是其中的作品分支。resolve 可以直接查询、内部搜索或使用真实映射，不要求先调用公开 search，也不要求实现者同时提供浏览搜索。

```ts
type ResolveResult =
  | { type: 'resolved'; record: SourceEntry }
  | { type: 'candidates'; records: SourceEntry[] }
  | { type: 'notFound' }
  | { type: 'insufficientInput' }
```

resolved 必须有明确身份或真实映射依据。仅按名称查询，即使只找到一项，也应返回 candidates，由 matching 决定。provider 负责完成本次定位必要的分页、去重和资料补充，再交付可用的完整候选范围。它不能把已知只有第一页或已经截断的列表当作完整结果，但也不要求穷尽整个站点。resolve 不向 metadata 暴露 complete、cursor 或候选分页状态，不能自行用弱匹配取首项绕过 Profile。

insufficientInput 表示现有 clues 无法支持有意义的定位，或无法形成可交付的候选集合；查询后也可以返回此结果，其他 provider 提供的新信息可用于后续尝试。能够交付有限候选集合时返回 candidates，本次检索完成但未找到目标时返回 notFound。操作支持与输入结构在执行前校验；无法解释身份且缺少其他有效线索时返回 insufficientInput。网络、超时、取消和实例失效按执行错误处理。

provider 必须核实根目标和 Part 的粒度，不能把卷或集包装成 SourceEntry。原始对象资料与关系分别表达。同一人物只提供一个对象，多项职责或角色工作则分别提供事实。工作关系必须有真实作品上下文，不能仅从角色登场推导来源未声明的配音组合。

<a id="session"></a>

## Entry 上下文中的读取会话

openSession({ entryType, identity?, preferredLanguages? }, context) 返回 MetadataReadSession。identity 是根对象的完整身份，可以是已知可读身份，也可以来自 resolve；输入不再重复携带 target 或 SourceEntry record。语言在本次会话内固定，账号连接仍属于扩展私有状态。Entry 表达本次读取的组织范围，并不要求每个来源都存在对应的根记录。

只读取已知相关 Entry 或 Part refs 的字段时，可以省略根 identity。本地作品和采用目标由 metadata 与 ingest 持有，provider 只取得来源引用。

缺少根 identity 时，会话只读取明确 refs 的字段；关系读取使用已经确定的根上下文。

MetadataReadSession 提供只读 relationScopes，以及 read 和 close。openSession 成功前，provider 按根身份、Entry 类型和本次来源设置确定关系范围：固定声明原样采用，scope 为 'session' 的节点解析为具体范围或 null。workCharacters 在 Work 根通常使用 all，在 Character 根按支持的 workTypes 声明。entryTags 和 volumeChapters 的适用范围为 all，分部所属清单按根作品读取。只有字段 refs 的会话使用空 relationScopes。

同一会话中的后续 read 共用这份合同。范围与语言、影响范围的配置一起固定，metadata 在发出读取前取得其值。SDK 分别交付范围快照与会话句柄，资源寿命沿既有 read／close 接入。

```ts
const session = await provider.openSession(
  {
    entryType: 'anime',
    identity: sourceEntry.identity,
    preferredLanguages: ['zh-Hans', 'ja', 'en']
  },
  { signal }
)

try {
  await session.read(
    {
      objects: {
        parts: {
          episode: {
            fields: ['description']
          }
        }
      }
    },
    { signal }
  )
} finally {
  await session.close()
}
```

metadata 拥有会话句柄，正常、失败和取消均在 finally 中 close。关闭使用独立于已取消 signal 的清理路径；open 与每次 read 分别接收调用 context。provider 按需读取详情或子资源，并按实际参数复用缓存。账号连接由扩展独立管理。并发读取、关闭、注销与实例失效的行为见[运行寿命](runtime.md#calls)。

<a id="read-request"></a>

## 字段请求与对象范围

```ts
await session.read(
  {
    objects: {
      entry: { fields: ['name'] },
      parts: {
        episode: {
          fields: ['numberLabel', 'name', 'description']
        }
      }
    },
    relations: {
      workEpisodes: { fields: [] }
    }
  },
  { signal }
)
```

session.read(request, context) 返回 `Promise<MetadataReadResult<T>>`。objects.entry 选择根字段，relatedEntries 按 Entry 类型组织，parts 使用适用的 volume、chapter、episode 或 extra，tags 使用 names 和 nameKey。节点中的 fields 选择普通资料；相关 Entry 与 Part 还可以提供 refs。没有 refs 时，目标来自所请求关系的端点，或能够明确确定的 Entry 范围；依据不足应返回明确错误。空 refs 表示没有字段读取目标，但不影响另行请求的关系。

关系项出现就表示请求该集合。fields: [] 仍要求返回必要端点和维度，省略关系项才表示不读取。读取明确 Part 的字段不要求来源拥有根记录或完整清单；返回清单则必须有真实来源依据。请求不携带本地库 ID、Profile、采用策略或用户记录。

metadata 将本次取值和匹配需要的字段合并成请求，例如同时请求简介与编号，provider 对每个原始字段只返回一次。最终输出仍受选定范围和来源约束，不能因为辅助匹配而扩大写入。执行中可以复用已有 SourceEntry 的真实识别资料，无须另造一份 identification。

```ts
{
  objects: {
    entry: {
      key: 'work',
      identity: { source: 'bangumi', sourceId: 'subject/123' },
      name: '作品 A'
    },
    parts: {
      episode: [
        {
          key: 'episode-1',
          identity: { source: 'bangumi', sourceId: 'episode/789' },
          numberLabel: '1',
          name: '第一集',
          description: '本集简介'
        }
      ]
    }
  },
  relations: {
    workEpisodes: [{ work: 'work', episode: 'episode-1' }]
  }
}
```

结果只包含实际回答的 objects 和 relations，对象的普通字段直接展开。Entry 或 Part 拥有真实 identity 或明确 externalIdentities 时随对象返回，不受普通字段开关限制。Tag 只返回 key、name 及实际存在的 description、isNsfw，没有外部身份。取值选择和 processor 不能反向修改 provider 的原始值或缓存。

同一回答中的每个对象都有唯一 key，关系只能引用类型相容的节点；没有外部身份的对象也可以通过 key 连接。key 不持久化，也不跨来源或跨调用使用。被关系引用的根可以只有 key，不得为此制造身份；没有引用需要时也无须补根节点。personWorks 直接包含 work、person、role、character 及可选 note、isSpoiler，无角色时 character 为 null；volumeChapters 直接包含 volume、chapter、numberLabel，普通属性不包入 fields。

provider 返回的正文须已转换为本体支持的 Markdown。来源格式解析与具体内容采用规则由对应扩展负责，宿主按既有字段和 Markdown 合同处理返回值。

<a id="read-completeness"></a>

## 完整回答、缺席与失败

read 按会话已经确定的范围读取本次请求。Provider 完成必要分页、成员去重与端点核对后，交付普通字段和关系数组。读取范围来自接入合同，结果中的成员及实际空名单都按这份范围解释。

| 返回情况                  | 含义                                                                             |
| ------------------------- | -------------------------------------------------------------------------------- |
| 字段或集合缺席            | 本次没有回答该项                                                                 |
| 合同允许的 null、false、0 | 按字段原义采用                                                                   |
| 成功数组                  | 完整回答约定集合；[] 表示该查询范围明确为空，能否替换旧关系另按已声明 scope 判断 |
| 读取失败                  | ExecutionFailure 交付失败原因，可带已完成的独立资料                              |

对象数组提供对象字段，关系数组提供成员事实。即使只请求关系，回答仍包含必要端点和识别依据。可选属性缺席保持未回答，成员范围按会话合同完整取得。

失败集合从 partialResult 中省略，已完整取得的其他集合和字段可以保留。例如，名称成功而分集第二页失败时，partialResult 保留名称，workEpisodes 缺席。metadata 按预先确定的关系范围处理这个缺口；本地采用使用[合成规则](../domains/metadata-contracts.md#relation-scopes)。

来源内部可以复用已取得的响应，公开输出按声明、请求和资料方案组织。图片交付 ImageCandidate，附件准备与正式写入由本体负责。

<a id="participation"></a>

## 领域参与与事实事件

| 接口                              | 实际用途与采用边界                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| metadata.providers.register       | 搜索、来源内定位与资料读取；metadata 按方案匹配和组合，provider 不写资料库                    |
| metadata.fieldProcessors.register | 按资料方案加工已取得的字段值；支持必要的批量上下文，不改变身份依据、关系成员或资料库          |
| scanner.recognizers.register      | 从作品候选目录或文件取得可用识别线索；无结果返回 null，不改扫描范围、不认定本地条目或创建作品 |

原生必要约束和收尾由本体直接调用，完整业务通过公开方法执行。参与原操作的步骤等待结果采用；完成后的独立同步通过事实事件启动新操作。事件定义和发布属于领域拥有者，events 设施负责登记、分发与错误隔离。扩展通过自己的 publisher 发布本实例事件，并订阅开放的原生事实。

每次执行开始时，固定选用的实现、只读输入、执行顺序和允许返回的范围。processor 按字段配置顺序执行，recognizer 的证据分别保留后再合并。扩展 priority、加载顺序和响应顺序都不能覆盖用户选择。实现自己的 settings 属于私有状态，不接受按次 options，安装也不会自动将实现加入业务配置。

参与操作使用所属业务的等待预算与取消机制。失败按依赖范围影响字段、候选或整个操作，并保留已发生的外部副作用；应用退出按扩展实例的有界清理规则收尾。

元数据范围、本地采用及会话与任务的必要步骤仍由本体决定。扩展承担明确选中的参与能力；已选实现不可用时报告缺少依赖，不能把失败当作未命中。

<a id="processors"></a>

## 字段处理器的批量调用

```ts
const result = await processor.process(
  {
    items: [
      {
        key: 'a',
        field: { object: 'entry', entryType: 'anime', field: 'description' },
        value: 'Text A'
      },
      {
        key: 'b',
        field: { object: 'entry', entryType: 'anime', field: 'description' },
        value: 'Text B'
      }
    ]
  },
  { signal }
)

// result: { a: 'Processed A', b: 'Processed B' }
```

process(input, context) 的 items 每项包含本次唯一的 key、有限字段标识、当前值，以及必要的已有只读上下文。正常结果是普通的 key 到新值映射，必须覆盖全部输入 key。无需修改时也要明确返回原值，不能漏项后报告成功。失败的 partialResult 可以只包含成功项，不能补上原值来伪装成功。

每个字段按其 processors 顺序执行，同一步骤中兼容的项目可以批量处理。partialResult 中的成功项只表示本步骤成功，仍须完成该字段剩余的处理器链。失败项停止后续处理；候选字段的采用遵守[整条链成功规则](../domains/metadata-profiles.md#processors)，其他独立字段继续。原始匹配资料保持独立，处理结果不能改变身份依据。

处理器只返回本次获准字段的加工值，对象、关系、身份和资料写入继续由调用流程负责。翻译服务与阈值等设置属于扩展，处理器的选用与顺序属于 Profile。

<a id="recognizers"></a>

## 作品候选识别

recognize(input, context) 返回 `Promise<WorkClues | null>`，只处理本体已经划定边界的一个 Work。它没有 options，也不增加 RecognitionResult、basis、candidates 或 unrecognized 包装。

```ts
interface WorkClues {
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  externalIdentities?: readonly ExternalIdentity[]
}

interface RecognitionInput {
  entryType: WorkType
  path: string
  kind: 'directory' | 'file'
  clues: Readonly<WorkClues>
}
```

```ts
await recognizer.recognize(
  {
    entryType: 'game',
    path: 'D:/Games/Example',
    kind: 'directory',
    clues: { name: 'Example' }
  },
  { signal }
)
```

entryType 来自 ScanConfig，path 是绝对路径，kind 已由本体判断，clues 是原生提取的线索，也可以为空对象。多个被选实现分别取得相同的只读基础输入，不接收其他识别器的结果、整份扫描配置或资料方案、扫描队列及本地 Entry ID。返回值不能改变作品类型、路径或候选边界，也不能认定本地对象或创建作品。

```ts
// A name read from the candidate's metadata.
return { name: 'Example', originalName: 'Original Example' }

// A complete source identity accepted by the recognizer.
return {
  externalIdentities: [{ source: 'example', sourceId: 'work/42' }]
}

// No usable information.
return null
```

识别器返回至少一项合法的新线索，或在没有足够依据时返回 null。结果可以只有名称、原名或日期，无须先定位到唯一来源记录；身份一旦提供，就须完整且属于当前 Work。发行日期使用内容证据，文件修改时间只属于文件属性。

识别器按自己的阈值处理歧义，多个无法判断的猜测返回 null。空值、空对象或原输入的复制都不构成新线索，Part 身份也不能作为 Work 身份交付。

null 表示该识别器没有新增可用信息，其他线索继续保留。文件、索引、网络、超时和实例失败使用共同错误合同。

scanner 保留各实现的归属，核对线索能否同时成立，再进入 ingest 与 metadata 的 matching。冲突按证据处理，不以响应顺序、列表顺序或统一置信分数裁决。来源记录存在与本地内容对应是两个判断。

候选整体存在歧义或冲突时，将问题写入扫描报告并继续其他路径。人工处理使用明确输入或搜索发起新操作，不保存猜测列表、预填建议或改写旧报告。provider.resolve.candidates 和独立搜索仍各有用途，不受 recognizer 返回 null 的规则限制。
