# 资料获取方案与规则目录

MetadataProfile 是可以命名、选择、复制和反复使用的资料获取方案。它保存首选资料语言，以及提供者、来源对应、对象字段和关系规则。本次操作的目标、请求、候选和本地采用决定，由执行流程持有，不写入方案。

<a id="storage"></a>

## 持久字段与默认方案

metadata.profiles 管理 metadata_profiles。entryType 只能是七类 Entry 之一，创建后不可修改；需要另一种类型时应新建方案。分部使用所属 Work 的方案，不设置顶层分部方案或另一层默认方案。

| 字段                | 类型与约束                                   | 用途                                  |
| ------------------- | -------------------------------------------- | ------------------------------------- |
| id                  | TEXT，主键                                   | 稳定的方案引用身份                    |
| name                | TEXT，非空且非空白                           | 显示名称，不作为引用键                |
| description         | TEXT，可空                                   | 方案用途说明                          |
| entry_type          | TEXT，非空，约束为七类 Entry                 | 适用的根条目类型                      |
| preferred_languages | TEXT，非空，合法 JSON 字符串数组，默认 []    | 本方案首选资料语言及有序回退          |
| definition          | TEXT，非空，合法 JSON 对象并通过完整语义校验 | 匹配与资料规则的整体定义              |
| is_default          | INTEGER，非空，0/1，默认 0                   | 是否为该 Entry 类型的默认资料获取方案 |
| sort_order          | INTEGER，非空、非负，默认 0                  | 同类方案显示顺序                      |
| created_at          | INTEGER，非空，毫秒时间                      | 创建时间                              |
| updated_at          | INTEGER，非空，毫秒时间                      | 最近编辑时间，不随执行更新            |

方案名称允许重复，列表索引为 entry_type/sort_order/id。definition 作为整体校验，内部规则没有独立数据库身份。复制方案会得到独立的值，不保留父方案或预设继承，也不复制默认资格。持久调用者通过真实外键引用方案。仍被扫描配置等正式记录引用的方案不能删除，须先明确更换引用或删除调用配置；删除时再次检查引用，不自动改用默认方案，也不级联删除配置或已经采用的资料。已接纳的执行继续使用固定快照。

preferredLanguages 是合法、规范化、去重且有序的开放语言标签列表。[] 表示没有语言偏好，由来源按其文档中的默认规则回答，不跟随 UI 语言或扩展设置。它是方案的基础属性，不放入 definition。

每份方案至少提供一项可请求资料能力，可以只处理图片、简介、关系或分部字段。只有 providers 和 matching 的方案不能保存。方案不存储 complete、canCreate、requiredFields 或能力镜像；一次创建是否具备必要资料，由实际输入和本体合同判断。

同一类型最多有一个 is_default = 1 的方案，由数据库唯一约束保证，也允许没有默认方案。新操作优先使用明确选择，其次使用该类型默认方案；仍未确定时，由交互选择，或报告无法直接执行。明确指定的方案失效或类型错误时应直接报错，不能退回默认方案。执行开始前固定具体方案及完整快照，之后的编辑不影响本次操作。

配置保存具体方案引用。创建配置时可以预填当前默认方案，但之后更改默认方案不会修改该引用。直接新增链接若省略 profileId，则由接收端选择默认方案。

设置默认使用 update(id, { changes: { isDefault: true } })，在同一事务中取消同类型旧默认；false 则取消当前默认资格。此操作不改变排列，也不需要独立的默认管理 API。 create 或 update 设置 isDefault 为 true 时可携带 expected.defaultProfileId，比较提交时同类型默认方案的 ID 或无默认的 null；引导表单必须提供，其他字段修改不接受这个条件。第一项、唯一项或最近选择都不会自动成为默认。符合引用约束的默认方案删除后，可以回到无默认状态。草稿、链接或新请求中明确指定的引用失效时，保留输入并报告，不依次试用其他方案。

list、get、create、update、delete 和 reorder 遵守[配置管理合同](scanner.md#configuration)，按实际字段基线保护并发编辑。执行方案不修改 updated_at。名称、说明、语言和四组规则使用同一份草稿，一起保存。

<a id="definition"></a>

## 四组规则

definition 固定由 providers、matching、fields 和 relations 四个顶层字段组成。

| 位置                  | 保存内容                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| providers             | 本方案选用的 providerId 清单，供定位补足与各资料规则共享引用                                               |
| matching              | 按 Entry 类型与根作品内 Part 种类配置来源对应回退；Part 规则也供同作品内本地唯一匹配使用，真实完整身份优先 |
| fields.entry          | 主 Entry 的字段来源、取值及可选加工规则，直接按字段名保存                                                  |
| fields.relatedEntries | 按关联 Entry 类型保存字段映射，例如 fields.relatedEntries.person.name                                      |
| fields.parts          | 按适用分部类型保存字段映射，例如 fields.parts.volume.name、fields.parts.chapter.name                       |
| fields.tags           | 标签自身的 description、isNsfw 字段规则，不包含条目标签关联属性                                            |
| relations             | 关系集合的来源、集合合成方式及同项关系的非身份属性规则                                                     |

对象规则直接映射字段名，person 或 episode 下直接列出字段。关系自身的属性放在相应关系的 fields 中。根对象再次作为关系端点时，仍使用 fields.entry；同一相关人物参与多项工作时，共用一份人物字段规则。

providers 声明去重后的参与集合，根身份由匹配规则确定，各项资料的提供者顺序与 selection 由对应规则保存。省略规则表示本方案不提供该项资料。增加参与提供者后，各字段规则保持原有配置；仅协助定位的提供者可以只参加匹配。

matching 按 Entry 类型及适用 Part 类别配置回退。主对象和同类型相关对象共用来源对应规则，完整身份始终先于回退，Part 始终限制在所属作品内。取得的候选固定本次 Part 规则为 partMatching，ingest 按[本地分部决策](metadata.md#local-parts)复用唯一匹配；这不授予七类 Entry 按名称自动复用的权限，也不使弱匹配成为长期来源身份绑定。

一个 provider 无需同时支持根定位、字段、相关对象、分部字段和分部清单。已知分部图片或人物字段的读取能力，可以直接被相应规则使用，但这不赋予 provider 枚举对象的能力。方案不另设 resolution.providers 或定位来源池。

关系规则使用 { providers, selection, fields? }：providers 与 selection 确定成员集合，fields 为这些成员配置属性来源。属性规则只处理已经选定的成员。适用字段的 processors 保存有序稳定 ID，私有参数由扩展管理。

```json
{
  "providers": ["providerA", "providerB", "providerC"],
  "matching": {
    "person": [
      {
        "fields": ["originalName"]
      }
    ]
  },
  "fields": {
    "entry": {
      "name": {
        "providers": ["providerA"],
        "selection": "firstNonEmpty"
      }
    },
    "relatedEntries": {
      "person": {
        "name": {
          "providers": ["providerB"],
          "selection": "firstNonEmpty"
        }
      }
    }
  },
  "relations": {
    "personWorks": {
      "providers": ["providerA"],
      "selection": "first",
      "fields": {
        "note": {
          "providers": ["providerB"],
          "selection": "firstNonEmpty"
        }
      }
    }
  }
}
```

此例由 A 决定工作关系集合，B 为已经对应的工作补充说明，并提供相关人物姓名。B 即使返回其他人物或工作，也不能扩大名单。C 只在其能力范围内帮助定位。若要合并 A、B 的工作集合，应明确修改该关系的 providers 和 selection。

编辑器以业务规则组织表单，按“提供者、匹配规则、对象字段、关系”四组导航。对象字段进一步按根对象、相关类型、分部和标签组织；工作说明、剧透标记、卷内编号等关系属性集中在关系区编辑。执行顺序由实际依赖决定。

跨组跳转使用同一份草稿。批量填写会生成显式规则，不产生隐含继承。只处理部分资料的方案无须填满四组。

<a id="parts-and-tags"></a>

## 分部字段、成员清单与标签

| 根 entry_type | parts 类型键    | 实际分部类型              |
| ------------- | --------------- | ------------------------- |
| novel         | volume          | NovelVolume               |
| comic         | volume、chapter | ComicVolume、ComicChapter |
| anime         | episode、extra  | AnimeEpisode、AnimeExtra  |

根条目类型已由上下文确定，因此方案和 read 都使用 volume、chapter、episode、extra 单数键。本体类型、表和引用仍区分五类具体 Part。fields.parts.episode 保存字段规则；read 的 objects.parts.episode 选择本次字段和 refs。两者用途不同，不要求逐层同形，方案也不保存运行对象。

| 关系项目       | 实际内容                                       |
| -------------- | ---------------------------------------------- |
| workVolumes    | 当前小说或漫画作品包含哪些卷                   |
| workChapters   | 当前漫画作品包含哪些话                         |
| workEpisodes   | 当前动画作品包含哪些分集                       |
| workExtras     | 当前动画作品包含哪些附加内容                   |
| volumeChapters | 漫画卷收录哪些话，以及收录范围内的 numberLabel |

仅配置分部字段也是完整合法的规则，不必同时配置成员清单，更不设置 fields.parts.*.list。refs 只限定本次读取对象，不创建归属或收录关系。

当 A 提供清单、B 提供字段时，可以在 B 的实际 Entry 范围内读取必要对应依据，按同一作品内的 matching 规则补充已选成员。B 没有所需能力时应如实报告，不能增加独立 Part resolve 或扩大成员清单来补救。

```json
{
  "providers": ["providerA", "providerB"],
  "matching": {},
  "fields": {
    "parts": {
      "volume": {
        "name": {
          "providers": ["providerB"],
          "selection": "firstNonEmpty"
        }
      },
      "chapter": {
        "name": {
          "providers": ["providerB"],
          "selection": "firstNonEmpty"
        }
      }
    }
  },
  "relations": {
    "workVolumes": {
      "providers": ["providerA"],
      "selection": "union"
    },
    "workChapters": {
      "providers": ["providerA"],
      "selection": "union"
    },
    "volumeChapters": {
      "providers": ["providerA"],
      "selection": "union",
      "fields": {
        "numberLabel": {
          "providers": ["providerA"],
          "selection": "firstNonEmpty"
        }
      }
    }
  }
}
```

Part 直接持有 Work 外键，漫画卷话收录使用关联表。分部清单用于补齐实体；volumeChapters 默认补齐，明确选择替换时只修改完整范围内的收录关系。Part、文件、笔记和历史各按自身生命周期保留。声明数量作为根字段采用，实际成员来自清单；没有适用分部的方案只展示本类型规则。

fields.tags 只处理标签自身的 description 和 isNsfw。relations.entryTags 处理标签成员及关联上的 note、isSpoiler。标签 name 按固定 nameKey 规则确定身份，不作为普通名称字段配置加工，以免静默改名。标签范围来自本次关系端点或明确 Entry 上下文，不遍历全库标签。系统不设置 Tag Profile、Tag SourceEntry 或 Tag resolve。普通同名标签应用不刷新已有标签定义。

<a id="providers"></a>

## 提供者引用与私有设置

MetadataProvider 注册在 metadata.providers。一个全局稳定 providerId 可以提供多种对象、字段、关系和图片能力，不按对象另设注册域。profile 直接引用该 ID，不建立本地别名、provider kind 包装、runtimeHandle、sessionId 或私有参数表。

Provider 应完整实现来源在本体资料范围内支持的能力，并准确声明对象、字段、关系和读取条件。每次 read 只处理请求范围。主来源、备用来源或定位用途，由 Profile 的具体规则决定。Provider 负责解释来源资料，不执行跨来源合成或本地覆盖。账号同步和收藏导入通过独立操作完成，交易和评论等数据不进入普通元数据合同。

providerId 选择实现，ExternalIdentity.source 表示身份来源，两者不可互换。一个实现可以提供多个来源的身份，多个实现也可以读取同一来源。资源类别、实例和父范围必须表达在完整 sourceId 中，不能藏入私有设置，使相同身份随配置改变含义。

账号、凭据、地址和连接设置由扩展管理，资料语言使用 preferredLanguages。从方案移除某个 provider 时，在同一草稿中处理仍引用它的规则。扩展停用、卸载或暂时不可用时保留引用，并显示名称、状态及扩展详情入口，供用户调整。provider 是否只用于定位由规则引用关系决定。

执行 context 只提供运行资源。对象、字段和 refs 等实际业务输入保留在请求中。缓存应按真实影响响应的请求及私有设置区分，宿主不复制整份私有配置，也不另建缓存命名空间协议。

<a id="fields"></a>

## 固定字段与关系目录

可请求字段由共有字段和各类型专属字段组成有限目录，跨进程使用 camelCase。值语义由[资料模型](catalog.md)和[公共值](values.md)定义。图片字段返回候选集合，正式采用后才形成附件引用。

| 对象范围         | 字段                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| 七类 Entry 共有  | name、originalName、aliases、description、primaryImage、externalLinks、isNsfw                               |
| 四类作品共有     | releaseDate、originalLanguages、backdropImage、titleLogo                                                    |
| 游戏专属         | iconImage                                                                                                   |
| 动画专属         | releaseStatus、releaseEndDate、declaredDurationMs、declaredRegularEpisodeCount、declaredSpecialEpisodeCount |
| 漫画专属         | releaseStatus、releaseEndDate、declaredPageCount、declaredVolumeCount、declaredChapterCount                 |
| 小说专属         | releaseStatus、releaseEndDate、declaredPageCount、declaredVolumeCount                                       |
| 角色专属         | birthDate、gender、age、bloodType、height、weight、bust、waist、hips、cupSize                               |
| 人物专属         | birthDate、deathDate、gender                                                                                |
| 组织专属         | foundedDate、dissolvedDate                                                                                  |
| 五类真实分部共有 | name、originalName、aliases、description、primaryImage、externalLinks、releaseDate                          |
| 小说卷专属       | numberLabel、declaredPageCount                                                                              |
| 漫画卷专属       | numberLabel、declaredPageCount、declaredChapterCount                                                        |
| 漫画话专属       | numberLabel、declaredPageCount                                                                              |
| 动画分集专属     | numberLabel、type、declaredDurationMs                                                                       |
| 动画附加内容专属 | type、declaredDurationMs                                                                                    |

普通来源字段不包含 sortName、addedDate、ID、根 type、技术时间、私人记录、文件观察值或人工排序。分集和 Extra 的 type 表示实际分类，仍可读取。组织标志使用 primaryImage，titleLogo 只适用于作品。数量、部分日期及 number/text 值继续遵守其正式类型，不改用字符串兜底。

| 关系项目键        | 必需成员依据                     | 可选属性字段          |
| ----------------- | -------------------------------- | --------------------- |
| workCharacters    | 作品、角色                       | role、note、isSpoiler |
| personWorks       | 作品、人物、职责、可选角色       | note、isSpoiler       |
| organizationWorks | 作品、组织、职责                 | note、isSpoiler       |
| workRelations     | 两部作品、从前者看后者的关系类型 | note                  |
| entryTags         | 当前条目、按固定名称键对应的标签 | note、isSpoiler       |

四类资料关系和 entryTags 构成封闭合同，能力声明、请求、回答、方案、采用和写入均使用这份目录。超出范围的关系不存入隐藏候选、unknown、通用边或 KV，也不借标签或 Part 代存。角色出场 role 可以为空，人物及组织职责必须存在。只有原本定义了 isSpoiler 的关系才开放该字段。

分部归属及漫画卷话收录使用[清单目录](#parts-and-tags)。volumeChapters 包含卷、话和收录范围内的 numberLabel。来源顺序保留在候选中，不作为覆盖本地 sortOrder 的字段。读取也不递归扩展到关联作品的分部。

集合字段各自使用明确的判重规则：别名使用名称规范，语言使用规范标识，链接比较完整 URL 且不删除查询参数，图片使用来源限定的资源身份或可靠引用，不能仅按作品 ID 判重。union 按来源顺序及首次出现顺序组织成员。重复的完整成员保留先选结果，不拼成任何来源都未原样提供的对象。

matching 回退只允许使用名称、原名、别名，以及适用的发行、结束发行、出生、逝世、成立和解散日期。人物与角色还可明确使用性别，Part 可使用 numberLabel 或 type。漫画话另可使用 volumeNumberLabel，明确取已经对应卷内的收录编号；适用性与范围见[候选匹配](metadata-contracts.md#matching)。图片、长简介、敏感标记、声明数量和人工顺序不作为自动匹配键。回退仍须满足唯一对应、复合键完整、缺失值规则及同作范围。标签始终只使用自己的 nameKey。

<a id="selection"></a>

## 字段取值、集合与顺序

标量 selection 支持 first 和 firstNonEmpty，关系及适用集合还支持 union。每条规则保存自己的来源顺序，网络完成顺序不影响结果。

| 取值方式 | 含义                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 首个回答 | 按来源顺序采用第一个有效回答，明确空回答也算回答                                 |
| 优先非空 | 按来源顺序采用第一个非空回答；没有非空回答但存在明确空回答时，保留最优先的空回答 |

| 成员范围     | 含义                                                         |
| ------------ | ------------------------------------------------------------ |
| 首选集合     | 使用最优先的有回答来源所提供的成员，空集合可成为选中结果     |
| 首选非空集合 | 使用最优先的非空回答所提供的成员；只有空回答时保留明确空集合 |
| 合并成员     | 对本次有回答的所选来源取成员并集，按各类对象的对应规则去重   |

没有来源回答时，不生成空候选，失败另行报告。合法空值按各字段定义判断，false 和 0 不算空。Provider 必须准确解释上游 null、空白和缺席的真实含义。部分日期整体取值，只有年份也是非空值，不从其他来源补接月日。

合成先对应 Entry、Part 和 Tag，再核对关系维度、成员及属性。Entry 与 Part 使用完整身份和已启用回退，Part 同时核对作品范围，Tag 使用 nameKey。作品联系按[关系方向](relations.md#maintenance)判断同一事实。

多重对应、身份冲突、缺少端点或职责分别报告；union 只合并已经成立的关系。缺失编号不作为共同键，卷话回答的临时 key 仅用于本次对象映射。

成员来源决定关系集合，属性则有独立的显式来源及 selection。界面可以批量填写，但保存后各条规则互相独立。A 决定名单、B 补充同项说明时，B 的额外成员不会加入。没有属性的集合不生成属性配置。

first 保留所选来源的顺序。union 按来源顺序扫描，成员首次出现时确定位置，之后重复出现只补充规则允许的属性，新成员按来源顺序追加。这些候选顺序不授予覆盖本地人工排序的权限。

例如，A 返回 []、B 返回成员时，first 选择 A，firstNonEmpty 和 union 可以采用 B 的成员。读取前固定各来源的会话范围；来源失败或缺席时，按[范围合成规则](metadata-contracts.md#relation-scopes)保留受影响的旧关系，已经完整取得的独立范围仍可采用。全部来源未回答时，该候选关系缺席。

<a id="processors"></a>

## 字段加工与身份

metadata.fieldProcessors 对已经获取并合成的获准字段加工，翻译是其中一种实现。profile 只保存处理器 ID 和顺序，服务、目标语言等实现设置由扩展管理。来源格式适配和本体校验属于必要职责，不能交给可能缺席的处理器。

执行先依据原始资料完成对应和选值，再依次调用 processors；后一个处理器接收前一个的结果。原始资料、匹配依据和 provider 缓存保持不变，加工名称不能改变身份。外部 ID、端点、关系成员、持有记录和标签身份名不允许普通字段加工。

加工结果须同时满足类型和字段语义：originalName 保留原始名称含义，originalLanguages 保留原作语言事实。处理器可以批量接收获准字段及必要的只读上下文，以保持术语一致；返回范围限于这些字段。每个字段按自己的处理器序列依次执行，对象、关系与写入仍由原流程负责。

只有本次实际请求并取得的字段参与加工。一个字段的整条 processors 链成功并通过字段校验后，最终值才进入候选；没有 processors 时采用按来源规则合成的合法值。某一步失败，该字段在本次候选中保持缺席，停止它的后续处理，并报告 processorFailed；来源原值和之前步骤的成功值都不作为自动回退。其他独立字段继续按自己的结果处理。

例如，来源值 X 经 A 得到 Y，B 失败时，X 和 Y 都不进入该字段的采用结果。处理器返回的值不满足字段合同，同样属于该步骤失败，由处理器边界以安全的 OperationFailed 摘要报告。更新保留原本的本地值；全部所选字段均未形成变化时，可以返回带问题的 unchanged。新根对象因此缺少必需资料时，该项新增失败；关联新对象资料不足时，按[本地采用](metadata.md#adoption)排除该对象及依赖关系，保留合法独立部分。原始 identification 仍只用于对应，不反向填充被排除的字段。

合法的 null、false、0 仍是加工成功值，按字段和采用方式解释；字段缺席不表示清空。整次操作的取消或调用归属失效沿共同合同结束，不转成普通字段问题后继续提交。需要更广泛候选整理的扩展，可以显式组合 metadata、自身处理和 ingest，并对这次完整调用负责。

<a id="languages"></a>

## 资料语言与来源优先序

preferredLanguages 表达方案希望取得的资料语言及有序回退，独立于 UiLocale 和私有连接设置，接受开放语言标签。创建和编辑方案时可见，执行开始时与 definition 一起固定。修改 UI 语言或执行中的方案，都不改变本次操作，也不自动重写库中已有文字。

同一语言偏好传入 search、resolve、openSession 和适用的图片入口，read 在会话内使用固定偏好，不增加逐字段覆盖。独立调用省略偏好时等同于 []，使用来源文档中的默认行为，不读取 UI 语言、默认 profile 或全局元数据语言开关。扩展自己的 UI 语言、网站账号偏好等独立设置仍然保留。

Provider 将偏好映射为来源支持的语言参数、多语字段和回退，直接采用已有文字。缺少译文时按未回答处理。偏好可影响资料文字和适用图片；作品身份、出版版本、配音阵容以及 originalName、originalLanguages 仍按原始事实确定。缓存键包含实际语言条件。

执行先由各 provider 按语言规则回答，再按字段来源顺序和 selection 选值，不根据返回语言对来源重新排名。例如，偏好为 zh-Hant → zh-Hans → ja → en 时，优先来源合法回退得到的非空英文，仍可能先于后续来源的繁体中文。firstNonEmpty 不能把合法回退当作缺失，union 仍按集合规则合成。此规则不要求网络请求串行。

预设应按真实能力安排来源，不能认为给 Bangumi 设置英文偏好就会得到英文简介，也不能把罗马字名称一概称为正式英文名。支持某种语言不保证每个字段都有译文，接入时须遵守来源约束，例如 [TMDB 本地化限制](https://developer.themoviedb.org/docs/languages)。固定版本、默认语言和完整规则见 [28 项预设](metadata-presets.md)。规则可以共用，不要求每种语言使用不同来源。
