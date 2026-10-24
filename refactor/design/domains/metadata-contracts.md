# 候选资料与本地对应合同

本页定义 MetadataCandidate 的完整外层结构、匹配依据和集合采用范围。字段值沿[固定资料目录](metadata-profiles.md#fields)，provider 的单来源回答沿[读取合同](../extensions/providers.md#read-request)，本地决定沿[ingest](metadata.md#adoption)。这些值属于 desktop-contracts/metadata，不包含本地写入指令。

<a id="candidate"></a>

## 候选图与对象

```ts
interface MetadataCandidate<T extends EntryType = EntryType> {
  entryType: T
  objects: {
    entry: CandidateEntry<T>
    relatedEntries?: CandidateRelatedEntries
    parts?: CandidateParts<T>
    tags?: readonly CandidateTag[]
  }
  relations?: CandidateRelations<T>
  partMatching?: PartMatchingRules<T>
}

interface CandidateEntry<T extends EntryType> {
  key: string
  identity?: ExternalIdentity
  externalIdentities?: readonly ExternalIdentity[]
  identification: IdentificationFields<T>
  fields: MetadataEntryFields<T>
}

interface CandidatePart<K extends PartType> {
  key: string
  identity?: ExternalIdentity
  externalIdentities?: readonly ExternalIdentity[]
  identification: PartIdentificationFields<K>
  fields: MetadataPartFields<K>
}

interface CandidateTag {
  key: string
  name: string
  description?: string | null
  isNsfw?: boolean
}
```

root entry 必填并且类型由 entryType 确定；relatedEntries 按七类 Entry 的单数键组织数组，节点类型与键关联。parts 在 anime 中只允许 episode、extra，在 comic 中只允许 volume、chapter，在 novel 中只允许 volume，其他 Entry 不接受 parts 或 partMatching。每个 key 在整份图中唯一且非空，关系只引用本图中类型相容的 key；本地 ID、PartRef 和 create/update 标志不进入候选。

`fields` 是从固定目录取得的可采用资料，所有字段可缺席，严格拒绝未定义或不适用的字段。普通 null、false、0 和完整空数组保持各自含义。图片字段为 ImageCandidate 数组；候选不提前创建正式附件。`identification` 只含未经过 processor 的名称、原名、别名、适用日期、性别、编号及分类；每项有值才出现，规则按所属类型限定字段。与普通字段同名不表示采用值可以反向替代识别值。

这种 fields 分组只用于合成后的 MetadataCandidate，区别于 provider 的单来源对象。MetadataReadResult 的普通字段仍直接展开；metadata 在合成时保留原始识别依据并形成本页值，不让处理器修改 identity、identification、partMatching 或关系成员。

identity 表示一个直接来源身份，externalIdentities 表示同目标的其他直接身份。来源明示等价和用户本次明确确认的等价可以进入这组身份；仅靠回退推断相同的来源身份不追加到该组。回退来源的普通字段可以正常参与合成，其未获直接确认的身份不能通过候选进入长期绑定。需要描述失败来源或被排除分支时使用调用结果中的 IngestIssue，不为每个字段增加 provenance 或状态信封。

<a id="matching"></a>

## 分部规则与编号范围

PartMatchingRules 使用 MetadataProfile.matching 的相应 Part 键与同一规则定义。每个键为有序规则数组，每条规则只有 `fields`，为非空、去重的适用匹配字段数组；数组顺序就是尝试顺序，省略键或空数组表示未启用回退。字段和值由对应 Part 类型限定，未知键在接纳前拒绝。

漫画话 identification 中的 numberLabel 只表达作品话号。匹配字段 volumeNumberLabel 专指卷内编号，从候选 volumeChapters 的 numberLabel 取得，并由已唯一对应的 volume key 限定；它不是另一份可采用的 Part 字段。没有准确对应卷，或同一候选存在多个不能唯一选择的卷内编号范围时，该规则不可用。不同卷的同号话、作品话号与卷内话号不组成一个无作用域的索引；numberLabel 不隐含回退到 volumeNumberLabel。

profile 获取将本次方案的 Part 规则复制到候选；prepared 直接提供同一规则值，不增加另一份 Profile、策略 ID 或来源专用回调。导入器需要按编号或名称复用分部时，必须在其固定映射中明确提供所用规则，不能从全局默认方案取得隐藏政策。全部本地采用按[唯一匹配决策](metadata.md#local-parts)执行。

<a id="relations"></a>

## 关系成员与读取范围

Provider 的单来源回答与 CandidateRelations 都以普通数组交付关系成员。Provider 使用本次回答的对象 key，候选使用合成后的 key；对象对应时一并转换关系端点。关系键及成员如下：

| 键                | 每项成员                                               | 适用范围                            |
| ----------------- | ------------------------------------------------------ | ----------------------------------- |
| workCharacters    | `{ work, character, role?, note?, isSpoiler? }`        | Work 与 Character，role 可空        |
| personWorks       | `{ work, person, role, character, note?, isSpoiler? }` | character 必填，无角色时为 null     |
| organizationWorks | `{ work, organization, role, note?, isSpoiler? }`      | 职责与作品类型相容                  |
| workRelations     | `{ from, to, type, note? }`                            | 两端均为 Work，方向按正式关系合同   |
| workVolumes       | `{ work, volume }`                                     | Comic／Novel 与所属卷               |
| workChapters      | `{ work, chapter }`                                    | Comic 与所属话                      |
| workEpisodes      | `{ work, episode }`                                    | Anime 与所属分集                    |
| workExtras        | `{ work, extra }`                                      | Anime 与所属附加内容                |
| volumeChapters    | `{ volume, chapter, numberLabel? }`                    | 同漫画的卷话收录，编号可明确为 null |
| entryTags         | `{ entry, tag, note?, isSpoiler? }`                    | Entry 与候选 Tag                    |

端点使用对象 key。身份维度与普通属性分别处理：personWorks.character 参与业务键，workCharacters.role 表达当前作品中的分类。可选属性缺席时保留未回答的含义，显式 null 按该属性的可空合同采用。数组保持来源合成后的顺序，已有人工排列按本地采用规则保留。

<a id="relation-scopes"></a>

### 范围的声明

范围在读取前由[能力与会话](../extensions/providers.md#capabilities)确定。成功的关系数组完整回答这份读取合同，[] 表示该范围明确为空；缺席和失败按[集合读取规则](../extensions/providers.md#read-completeness)处理。

MetadataRelationScopes 按下表关系键保存范围。它描述四类资料关系、标签及漫画卷话收录；分部所属清单的范围由根作品确定，成功读取同样要求完成该清单。

| 关系键            | 范围值                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| workCharacters    | `'all'` 或含 workTypes 的非空条件数组；Work 根已限定当前作品，Character 根可限定作品类型 |
| entryTags         | `'all'`，即根条目的标签范围                                                              |
| volumeChapters    | `'all'`，即当前漫画的卷话收录范围                                                        |
| personWorks       | `'all'` 或非空条件数组；每项可含 workTypes、roles、character                             |
| organizationWorks | `'all'` 或非空条件数组；每项可含 workTypes、roles                                        |
| workRelations     | `'all'` 或非空条件数组；每项可含 types、targetTypes                                      |

条件数组中的各项取并集，同一项内的维度取交集。workTypes、targetTypes、roles 和 types 使用相应领域枚举的非空去重数组；character 为 none 或 present，分别表示无角色和有具体角色的工作。省略维度表示该上下文中的全部合法值，每项至少提供一个维度。

范围始终受根条目约束：Work 根限定该作品，Person／Organization 根限定该主体，Character 根限定该角色。workRelations.types 从根作品的视角解释，targetTypes 限定另一端类型。校验同时采用职责、媒介和角色的相容规则；与上下文矛盾的条件属于无效声明。

例如，MAL 动画制作公司的固定范围为 `[{ roles: ['studio'] }]`。人物的制作署名与角色配音可以分成两个固定条件：制作职责使用 character:none，配音使用 character:present。具体角色由根上下文限定；范围值本身只包含上述有限词表。

来源的版本、原作语种和职责映射共同确定读取合同，声明来自这些规则。取得列表后，实际出现了哪些成员不会改变约定范围。只取得单集等局部事实时，调用方可通过 prepared 补充确定关系；完整范围的声明需要相应读取依据。

对于来源可以完整读取、但当前有限维度无法表达的覆盖范围，能力声明使用 scope:null。会话的 relationScopes 保留相应 null，表示这项读取只提供可采用事实。例如，仅能反查动画影片的公司能力无法代表该公司的全部动画参与，因此不用于移除旧关系。这是固定的能力边界，分页或网络失败仍按失败处理。MetadataFetchResult 与 prepared 的 relationScopes 只保存上表可明确表达的范围，省略键表示缺少替换依据。

### 合成与转交

metadata 先固定本次参与提供者、各会话范围和成员选择方式，再执行读取。first、firstNonEmpty 和 union 的成员选择仍按[方案规则](metadata-profiles.md#selection)处理；关系属性使用自己的字段规则。

合成后的可替换范围由两部分确定：所选成功回答覆盖的范围，以及对本次成员选择有影响的未回答范围。前者扣除后者，得到 MetadataFetchResult.relationScopes。范围使用有限枚举条件计算，保持同一根上下文。

| 成员方式      | 成功回答与未回答范围的参与方式                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| first         | 采用第一个有效回答；此前失败或缺席的来源影响其已声明范围，之后的来源不参与这次成员选择                                     |
| firstNonEmpty | 采用第一个非空回答，此前未回答的来源影响其已声明范围；若仅有空回答，采用最优先的空回答，并计入所有所选来源中仍未回答的范围 |
| union         | 合并全部有效回答；任一所选来源未回答时，扣除它对应的范围                                                                   |

有效 partialResult 中已经完整交付的集合视为成功回答。独立字段或属性失败保持成员范围原义。会话建立失败且实际范围尚未确定，或参与本次成员选择的能力声明 scope:null 时，该关系键的旧关系按整个根上下文保留。来源对象对应失败时，撤销受影响的职责、类型和角色有无组合的替换依据，保留已经成立的独立事实。

因此，完整 studio 回答与失败的 publisher 回答可以分别采用；两个覆盖 studio 的成员来源中有一个未回答时，该范围只补充或更新。范围之外的关系保持原样，来源缺席也保持缺席。

候选转为 prepared 时，data 与 relationScopes 一起交付。prepared.relationScopes 是调用方对输入完整范围的一次声明；省略或空对象表示只提供可采用事实。来源解析或加工后的候选仍须具备所声明范围的完整性。资料获取阶段的 issues 由其调用方保留并报告。

### 本地采用

用户的关系 scope 选择本次可修改范围，默认是当前目标的全部适用关系。其范围维度沿用上表；人物关系还可用 characters 选择具体 Character 引用或 null。追加、属性更新与替换都受这份用户选择约束。

替换删除同时满足用户 scope 与 relationScopes 的旧关系，保留本次采用的成员。ingest 在本地对应和资源准备后固定具体写入；对象歧义或目标变化继续按本地采用合同处理。缺少完整范围时，合法事实仍可补充，未完成的替换通过 associationSkipped / incompleteRange 报告。

分部所属清单只补齐实际成员。漫画卷话收录默认补齐，用户明确选择 replace 时可按完整范围替换关联；卷、话、文件和个人记录保持。作品目标处理该作品的所选收录，明确的卷目标只处理该卷。普通资料采用保留已有人工顺序，重新排列沿明确的排序操作执行。library 接收已经确定的图写入。

<a id="inputs"></a>

## 获取、prepared 与结果

```ts
type MetadataInput<T extends EntryType> =
  | { type: 'profile'; profileId: string; clues: IdentificationClues<T> }
  | { type: 'prepared'; data: MetadataCandidate<T>; relationScopes?: MetadataRelationScopes<T> }

type MetadataUpdateInput<T extends EntryType> =
  | { type: 'profile'; profileId: string; clues?: IdentificationClues<T> }
  | { type: 'prepared'; data: MetadataCandidate<T>; relationScopes?: MetadataRelationScopes<T> }

interface MetadataFetchResult<T extends EntryType> {
  data: MetadataCandidate<T>
  relationScopes: MetadataRelationScopes<T>
  issues: readonly IngestIssue[]
}
```

metadata.fetch 接收 entryType、profileId、clues 和可选 request，返回候选、完整关系范围及获取问题。省略 request 时读取方案配置范围，明确请求须受方案支持。成功结果具有合法根候选，本地创建所需资料由 ingest 另行核对；存在合法候选图时，失败可以携带同类型 partialResult。

ingest.add 的输入为 entryType、metadata: MetadataInput、可选 initial 与已经声明的本地内容输入。initial 复用 entries.create 的 evaluation、Work record 与 completionRecords，不进入 MetadataCandidate。

ingest.update 接收 `(target, { metadata, fields?, relations? })`，metadata 使用 MetadataUpdateInput；target 为 EntryRef 或 PartRef，Part 沿所属作品类型核对 profile 与候选上下文。更新时缺省 clues 从固定目标的正式身份与原始资料形成；显式线索只用于来源定位，不能改变本地目标。fields 与 relations 直接使用[更新合同](metadata.md#update)的所选字段、fill／overwrite 和关系范围，不增加 adoption 包装。没有实际字段或关系选择时按空操作成功，不获取资料。作品更新器先固定分部清单与已有目标，再组织这些明确调用。

这些公开值只承载同一次调用。候选、临时 key、识别依据和规则快照不持久化为正式资料，也不获得新的数据库身份。调用上下文、signal 和资源句柄继续由实际通信接入管理。
