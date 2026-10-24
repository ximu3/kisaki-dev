# Entry 查询的公共值合同

本页定义 desktop-contracts/library 中 Entry 查询可以传递的输入与读取结果。字段含义、可见性和比较语义见[查询规则](library-queries.md)，数据库执行与界面列配置由各自使用者实现。

<a id="query"></a>

## 查询与调用参数

```ts
type EntryScope =
  | { type: 'library' }
  | { type: 'favorites' }
  | { type: 'unclassified' }
  | { type: 'collection'; id: string }
  | { type: 'tag'; id: string }
  | { type: 'note'; id: string }

interface EntryQuery {
  scope: EntryScope
  search: string
  rules: readonly EntryRule[]
  sort: EntrySort
}

interface EntryRule {
  enabled: boolean
  types: readonly [EntryType, ...EntryType[]]
  filter: {
    match: 'all' | 'any'
    conditions: readonly EntryCondition[]
  }
}

type EntrySort =
  | { type: 'scope' }
  | { type: 'field'; field: EntrySortField; direction: 'asc' | 'desc' }
  | {
      type: 'parts'
      scope: PartCountScope
      measure: 'registered' | 'completed' | 'withFiles' | 'accessible'
      direction: 'asc' | 'desc'
    }

type PartCountScope =
  | { partType: 'animeEpisode'; classification?: EnumTest<AnimeEpisodeType | null> }
  | { partType: 'animeExtra'; classification?: EnumTest<AnimeExtraType | null> }
  | { partType: 'comicVolume' | 'comicChapter' | 'novelVolume' }

type EntryGroupKey = { type: 'collection'; id: string } | { type: 'unclassified' }

interface EntryListOptions {
  offset: number
  limit: number
  fields?: readonly EntryProjectionField[]
  group?: EntryGroupKey
}

interface EntryLocateOptions {
  limit: number
  fields?: readonly EntryProjectionField[]
  group?: EntryGroupKey
}

interface EntryListResult {
  items: readonly EntryListItem[]
  total: number
}

interface EntryLocateResult extends EntryListResult {
  index: number
  offset: number
}
```

EntryType、EntryRef、PartRef、AnimeEpisodeType、AnimeExtraType 和日期值直接使用各自拥有者的类型，不在查询模块复制。favorites 是已收藏范围，unclassified 使用[未分类规则](collections-and-tags.md#rule-references)，note 只表示与该 Note 显式关联的 Entry。scope 不接受类型数组、SQL、任意关系路径或可见性覆盖值。

list(query, options) 返回 EntryListResult；locate(query, target, options) 的 target 为 EntryRef，返回 EntryLocateResult 或 null。offset 是非负安全整数，limit 是 1–200 的安全整数，均必填；超限返回 InvalidInput，不截断成另一个请求。offset 大于 total 时返回空 items 和实际 total。total、index 和 offset 均为非负安全整数。

locate 的区间起点为 `max(0, min(index - floor(limit / 2), total - limit))`，因此目标尽量位于中间，靠近末端时填满剩余区间。index、offset、items 和 total 属于同一次短只读事务。group 存在时，所有位置和数量均相对于该组与原 query 的交集；不能用一个组的下标读取另一个组。

get(ref) 返回 EntryDetails 或 null；findByExternalIdentity(identity) 返回 EntryRef 或 null。两者遵守普通可见范围，不通过特殊结果泄露隐藏目标。身份查找精确比较 source 与完整 sourceId。新增、绑定和合并的内部完整身份核对不能以这项可见读取的 null 推断身份尚未占用。

所有结构严格解析：未知字段、未知操作、非法数值和不适用字段均拒绝。规则的结构和字段适用性也检查禁用组；引用的当前存在性只检查本次实际执行的范围和启用条件。禁用组可以保留已失效的引用，重新启用时正常报错。规则组不嵌套，types 非空且去重；空 rules 或全部禁用正常返回空结果，不能回退全库。字段排序按全部启用组的类型核对；没有启用类型时仍校验字段名与形状。

<a id="saved-references"></a>

## 保存查询的引用名称

执行条件携带准确身份。动态合集、展示柜等保存查询的拥有者另存 `referenceLabels: { target, name }[]`，供显示最近一次明确保存时的有界名称快照。target 为 EntryRef 或 `{ type: 'tag' | 'collection' | 'note', id }`，各拥有者接受其查询实际引用的种类。执行时只传 EntryQuery，筛选、排序及授权均以其中的真实身份为依据。

动态合集的 dynamicRules 具体为 `{ search, rules, sort, referenceLabels }`：search 与 rules 复用本页类型，sort 只接受显式字段／分部数量排序，不接受 scope。在全库求值时构造 `scope: { type: 'library' }`，不把 referenceLabels 作为未知参数传给查询。引用名称只为保留输入与展示失效条件，不能反查身份或创建条目。

保存时为实际引用核对名称快照；当前不可见的目标保留已有快照，不查询或回显隐藏的新名称。目标合并时重定向并去重 target，目标删除后保留原身份与快照，禁用组可以继续等待修正。普通读取可展示可见目标的当前名称，但不因此写回保存定义。正式参考名称不由客户端随意覆盖，表单提交自己的草稿名称只作为未采用输入，保存结果返回实际保留的快照。

<a id="conditions"></a>

## 条件值与字段适用性

以下语法中的字段族是闭合集合。实现将字段与操作数组合为判别联合；不采用 `{ field: string, op: string, value: unknown }` 作为公共条件。字段目录只承担纯值与适用性，不同时持有 SQL、组件或持久化策略。

```ts
type Bounds<T> = { min: T; max?: T } | { min?: T; max: T }
type Presence = { op: 'present' } | { op: 'absent' }
type NumberTest = { op: 'range'; bounds: Bounds<number> }
type SetTest<T> =
  { op: 'any' | 'all' | 'none'; values: readonly [T, ...T[]] } | { op: 'empty' | 'notEmpty' }
type EnumTest<T> = { op: 'in' | 'notIn'; values: readonly [T, ...T[]] }
type TextTest = { op: 'equals' | 'contains'; value: string }
```

数值范围、日期范围、集合补集和未知值遵守[统一运算](library-queries.md#operators)。选择数组按准确值去重；重复值不改变含义，空选择非法。TextTest 的 value 经检索空白处理后必须非空。普通检索的大小写与全半角规则同样用于 contains；cupSize 的 equals 保留原文精确比较，不能把不同标准的标记合并。`present/absent` 判断是否填写，不能用于替代数值 0 或布尔 false。

| 字段族             | 字段标识                                                               | 类型范围         | 条件形状                                                                                                |
| ------------------ | ---------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| 布尔               | favorite、isNsfw、hasNotes、hasPrimaryImage                            | 七类             | `{ field, op: 'is', value: boolean }`                                                                   |
| 资料是否填写       | originalName、sortName、description、aliases、externalLinks、addedDate | 七类             | `{ field, ...Presence }`；数组以是否为空判断                                                            |
| 评价数值           | rating                                                                 | 七类             | NumberTest 或 Presence，值域沿用评价合同                                                                |
| 普通集合           | tags、manualCollections                                                | 七类             | SetTest<string>，值为真实标签或手动合集 ID                                                              |
| 来源集合           | sources                                                                | 七类             | SetTest<string>，值为已保存的来源标识，不要求 provider 在线                                             |
| 当前状态           | status                                                                 | 四类作品         | EnumTest<'planned' \| 'active' \| 'onHold' \| null>                                                     |
| 原始语言           | originalLanguages                                                      | 四类作品         | SetTest<LanguageTag>，值使用语言合同的规范标识                                                          |
| 图片是否采用       | hasBackdrop、hasTitleLogo                                              | 四类作品         | 布尔条件                                                                                                |
| 游戏图标           | hasIcon                                                                | 游戏             | 布尔条件                                                                                                |
| 发行状态           | releaseStatus                                                          | 动画、漫画、小说 | EnumTest<'planned' \| 'ongoing' \| 'finished' \| 'paused' \| 'cancelled' \| null>                       |
| 非空数值           | additionalDurationMs、totalDurationMs、completionCount                 | 四类作品         | NumberTest；毫秒或次数，缺记录按各自正式缺省值解释                                                      |
| 声明时长           | declaredDurationMs                                                     | 动画             | NumberTest 或 Presence，非负安全整数毫秒                                                                |
| 声明正片／特别篇数 | declaredRegularEpisodeCount、declaredSpecialEpisodeCount               | 动画             | NumberTest 或 Presence，非负安全整数                                                                    |
| 声明页／卷数       | declaredPageCount、declaredVolumeCount                                 | 漫画、小说       | NumberTest 或 Presence，非负安全整数                                                                    |
| 声明话数           | declaredChapterCount                                                   | 漫画             | NumberTest 或 Presence，非负安全整数                                                                    |
| 性别               | gender                                                                 | 角色、人物       | EnumTest<Gender \| null>，Gender 使用[正式五值](catalog.md#persons-organizations)                       |
| 血型               | bloodType                                                              | 角色             | EnumTest<'a' \| 'b' \| 'ab' \| 'o' \| null>                                                             |
| 设定数值／文字     | age、height、weight、bust、waist、hips                                 | 角色             | NumberTest、Presence、TextTest 或 `{ op: 'kind', value: 'number' \| 'text' }`；文字条件只匹配 text 分支 |
| 罩杯标记           | cupSize                                                                | 角色             | TextTest 或 Presence                                                                                    |
| 文件数             | registeredFileCount、accessibleFileCount、uncheckedFileCount           | 动画、漫画、小说 | NumberTest，使用已保存观察，不遍历磁盘                                                                  |

Gender 只包含五个非空分类；联合中的 null 表达未知，不是一个字符串枚举值。

分部数量另用 `{ field: 'parts', scope: PartCountScope, measure, ...NumberTest }`。partType 与所属 Work 类型必须相符，动画可用 classification 按[分集／附加分类](anime.md#classification)限定真实子集，省略则包含全部分类与未知项；四个 measure 与排序中的含义相同。registered 是真实行数，completed 是当前标记数，withFiles 是有关联的去重分部数，accessible 是至少一项关联文件最近确认为可访问的分部数。游戏没有该条件。uncheckedFileCount 只计尚未检查的文件，不能与不可访问混为一类。

日期字段的条件形状为以下有限联合；每项都带所属 field：

| 操作                               | 输入                                                            | 适用范围                                                                 |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| absoluteRange                      | `bounds: Bounds<YearDate>`                                      | 含年份的日历事实；YearDate 只接受 year、year+month、完整日期三种连续精度 |
| monthDayRange                      | `from: MonthDate, to: MonthDate`                                | 角色生日和人物出生日期；MonthDate 为 month 或 month+day，允许跨年        |
| componentRange                     | `component: 'year' \| 'month' \| 'day', bounds: Bounds<number>` | 日历事实；分量必须已知才比较，值域使用所属日期分量                       |
| componentPresent / componentAbsent | `component: 'year' \| 'month' \| 'day'`                         | 日历事实的明确分量                                                       |
| present / absent                   | 无操作数                                                        | 可空日历事实和可空时间点                                                 |
| calendarRange                      | `bounds: Bounds<YearDate>`                                      | 时间点；按当前显示时区展开日界，并限制在实际可表达的时间点范围           |
| instantRange                       | `from?: number, to?: number`，至少一端，from < to               | 时间点；UTC 毫秒，使用 [from, to)                                        |

日历事实字段：effectiveAddedDate（七类，整体 addedDate 为空才回退创建日）、releaseDate（四类作品）、releaseEndDate（动画／漫画／小说）、birthDate（角色／人物）、deathDate（人物）、foundedDate／dissolvedDate（组织）、firstCompletedDate／lastCompletedDate（四类作品）。effectiveAddedDate 不接受整体 absent；手填存在性使用 addedDate 条件。时间点字段为 createdAt、updatedAt（七类）和 lastActiveAt（四类作品，可空）。查询上下文从真实窗口或调用环境取得显示时区，不在每个条件里夹带时区。

完成事实条件使用 `{ field: 'completions', match: 'exists' | 'notExists', where }`。where 只允许 `completedDate?: DateTest` 和 `note?: TextTest | Presence`；DateTest 采用上述 absoluteRange、component 操作及 Presence。where 为空表示是否有记录；where 内已提供的条件全部由同一条完成记录满足。未知日期用 absent 查询，统计次数使用 completionCount。这里没有任意子查询或新的规则组层级。

<a id="relations"></a>

## 关系条件的闭合分支

每项关系条件形如 `{ field, targets: SetTest<TargetRef>, where?: Qualifier }`。先按 where 与当前可见性选出同项事实，再投影目标集合执行 targets；where 各项取交集，某项内的选择取并集。不存在的真实目标为 InvalidReference，合法但隐藏的目标仍按普通可见集合计算。

| field                | 被查询的 Entry | TargetRef                | where 允许的项                                                        |
| -------------------- | -------------- | ------------------------ | --------------------------------------------------------------------- |
| workCharacters       | 四类作品       | Character 的 EntryRef    | characterRoles、note                                                  |
| workPersons          | 四类作品       | Person 的 EntryRef       | personRoles、character、characterRoles、note                          |
| workCharacterPersons | 四类作品       | Person 的 EntryRef       | personRoles、character、characterRoles、note；只取有角色的工作        |
| workOrganizations    | 四类作品       | Organization 的 EntryRef | organizationRoles、note                                               |
| relatedWorks         | 四类作品       | WorkRef                  | workTypes、relationTypes、note；关系方向从当前作品解释                |
| characterWorks       | 角色           | WorkRef                  | workTypes、characterRoles、note                                       |
| characterPersons     | 角色           | Person 的 EntryRef       | works、workTypes、personRoles、note                                   |
| personWorks          | 人物           | WorkRef                  | workTypes、personRoles、character、characterRoles、note               |
| personCharacters     | 人物           | Character 的 EntryRef    | works、workTypes、personRoles、characterRoles、note；只取有角色的工作 |
| organizationWorks    | 组织           | WorkRef                  | workTypes、organizationRoles、note                                    |

workTypes 是非空 WorkType 数组；works 是非空 WorkRef 数组。各 roles 与 relationTypes 为[关系合同](relations.md)相应闭合枚举的非空数组；characterRoles 可以包含 null，表示已有角色关联但未分级。note 为 TextTest 或 Presence。character 为 `{ type: 'none' }`、`{ type: 'any' }` 或 `{ type: 'oneOf', refs: 非空 Character 引用数组 }`，any 表示有角色；只取有角色的分支不接受 none。指定 characterRoles 时也要求同一作品角色关联存在，不能把无角色工作当作未分级角色。参数之间矛盾属于 InvalidInput。

在不同 field 中复用 where 的成员，不表示可以把任何成员放进任何分支；表中未列出的键均拒绝。完整目标身份与角色、职责、作品的同项约束仍由所属字段检查。

<a id="projection"></a>

## 排序字段与列表投影

EntrySortField 的完整集合如下；类型范围与相同条件字段一致：

- name、originalName、effectiveSortName、rating、effectiveAddedDate、createdAt、updatedAt。
- releaseDate、releaseEndDate、additionalDurationMs、totalDurationMs、lastActiveAt、completionCount、firstCompletedDate、lastCompletedDate。
- declaredDurationMs、declaredRegularEpisodeCount、declaredSpecialEpisodeCount、declaredPageCount、declaredVolumeCount、declaredChapterCount。
- birthDate、birthMonthDay、deathDate、foundedDate、dissolvedDate、age、height、weight、bust、waist、hips。
- registeredFileCount、accessibleFileCount、uncheckedFileCount。

birthMonthDay 对角色和人物使用忽略年份的生日顺序，其余日期排序使用年代顺序。effectiveSortName 使用实际 sortName 或 name。空值、number/text、自然数字名称与 ID 补序按[排序规则](library-queries.md#text-and-sort)执行。查询中不会出现字段名任意字符串、别名首项排序或布尔／枚举内部编码排序。

EntryListItem 是按 type 区分的七分支联合，每项固定含 id、type、name。fields 省略或为空时只返回这三个字段。其他可请求字段如下；非存储摘要的类型与缺省值由相应正式合同定义：

| 可请求字段                                                                            | 返回值与范围                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| originalName、sortName                                                                | 七类的 string \| null                                                                                                                                                      |
| primaryImageId                                                                        | 七类的附件 ID \| null；资源读取仍使用资源合同                                                                                                                              |
| isNsfw、favorite、rating                                                              | 七类的 boolean、boolean、number \| null                                                                                                                                    |
| addedDate、effectiveAddedDate、createdAt、updatedAt                                   | 七类；原始日历值、有效日历值及两个 UTC 毫秒时间点                                                                                                                          |
| releaseDate、originalLanguages、status、additionalDurationMs                          | 四类作品；原始语言数组，当前状态及绝对附加毫秒值                                                                                                                           |
| releaseStatus、releaseEndDate                                                         | 动画、漫画、小说                                                                                                                                                           |
| declaredDurationMs、declaredRegularEpisodeCount、declaredSpecialEpisodeCount          | 动画，可空数值                                                                                                                                                             |
| declaredPageCount、declaredVolumeCount、declaredChapterCount                          | 按声明资料适用类型，可空数值                                                                                                                                               |
| birthDate、gender                                                                     | 角色、人物                                                                                                                                                                 |
| deathDate                                                                             | 人物                                                                                                                                                                       |
| bloodType、age、height、weight、bust、waist、hips、cupSize                            | 角色；身体资料保留 number/text 值，不降为普通 number                                                                                                                       |
| foundedDate、dissolvedDate                                                            | 组织                                                                                                                                                                       |
| totalDurationMs、lastActiveAt、completionCount、firstCompletedDate、lastCompletedDate | 四类作品的只读摘要                                                                                                                                                         |
| registeredFileCount、accessibleFileCount、uncheckedFileCount                          | 动画、漫画、小说的只读数量                                                                                                                                                 |
| partCounts                                                                            | 动画／漫画／小说；按其实际 Part 种类返回固定键，每项含 registered、completed、withFiles、accessible 四个计数；动画两项另含 byType，各正式分类及 unknown 键分别返回四个计数 |

partCounts 的 unknown 仅为 SQL NULL 分类的读取分组键，不写回 Part.type，也不把未知分集归为正片；总计独立按全部实际分部计算。

此表就是 EntryProjectionField 的完整集合。fields 不返回简介正文、全量关系、历史、文件或任意嵌套展开；它们使用独立读取。没有 requestedFields、query 或运行实例混入每一行。

混合类型查询可以请求专属列。适用分支返回该值或正式 null／空集合／0；不适用分支不带该属性，未请求的字段同样不返回。调用者结合本次 fields 与行 type 判断两者；不把人物的 status 伪造为 null。若还有启用类型，所请求字段至少要适用于其中一种类型，否则 InvalidInput。静态类型按 Entry 类型维持字段关联，不使用 `Record<string, unknown>` 吞掉差异。

<a id="groups"></a>

## 分组、定位与固定选择

groups(query, { type: 'collections' }) 返回 `{ total, groups }`。total 始终为 query 本身的去重 Entry 数，不能从各组数量相加取得。groups 列出当前可见合集，按合集自身保存顺序及 ID 排列，最后为 unclassified；空的真实组也返回 count: 0，是否折叠或不显示空组由视图决定。

```ts
type EntryGroupResult =
  | { key: EntryGroupKey; status: 'ready'; count: number }
  | { key: EntryGroupKey; status: 'failed'; error: ErrorSummary }

type EntrySelection =
  | { type: 'all' }
  | { type: 'range'; anchor: EntryRef; focus: EntryRef }
  | {
      type: 'groupRange'
      anchor: { group: EntryGroupKey; ref: EntryRef }
      focus: { group: EntryGroupKey; ref: EntryRef }
      expandedGroups: readonly EntryGroupKey[]
    }
```

分组 key 不承载隐藏名称，名称等普通合集资料按合集读取合同取得。某动态合集的成员谓词失效只使该组 failed；依赖它判断的未分类组同样 failed，不能伪造零成员。仅保存排序失效时，成员与 count 仍可确定，组保持 ready；按该失效顺序读取时报错，调用方可明确改用合法字段排序。query 自身依赖失效范围时整次调用失败，不能把它降为某一组错误。读取 failed 组的区间或位置仍报告真实错误。保存定义的成员谓词与排序分别验证；只有已能独立确定的成员范围，才可以在不使用失效排序的读取中继续采用。

list／locate 的 group 只可使用上述真实 key，按该组范围再与原 query 相交。scope 排序在组内采用该组的手动成员顺序、动态保存排序或未分类默认顺序；显式字段排序继续采用 query 的字段顺序。省略 group 则使用原 scope 的顺序。折叠状态不进入 list／locate，界面先展开再定位。

selectRefs(query, selection) 返回 `readonly EntryRef[]`，一次只读事务内固定引用集合。all 返回 query 全集，忽略折叠且不重复分组实例；普通 range 按 query 的顺序取两个端点之间的闭区间。groupRange 按 groups 的真实顺序串联 expandedGroups 的成员，端点为明确显示实例；expandedGroups 是去重集合，传入数组的顺序不重排视图。两个端点均须属于所声明的展开组。端点方向反转仍选择同一闭区间。

range 的端点当前不在结果中时返回 SelectionChanged，不猜最近行。groupRange 中组失效、端点消失或跨越无法读取的组，也返回 SelectionChanged；明确无效的参数仍为 InvalidInput。最后按 Entry 身份去重，按首次遇到的顺序返回。all 与普通 range 不依赖分组计算，不因无关动态组损坏而失败。

固定选择没有 200 项上限，该上限只作用于列表区间。selectRefs 只传身份，不传全部详情；大量选择的内存、传输与取消成本属于正式性能验收，不能悄悄只取前 N 项。主进程不保存选择会话，也不返回可以在以后重新扩大查询的令牌。

<a id="errors"></a>

## 查询失败与验证

| code               | 明确含义                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| InvalidInput       | 形状、字段、类型适用性、数值或操作数非法                               |
| InvalidReference   | 实际执行的固定入口或条件中的真实引用已失效／种类不符；隐藏本身不是失效 |
| InvalidQuery       | 保存的动态定义无法作为合法查询执行；不恢复默认规则                     |
| SelectionChanged   | 选区的稳定端点或必要组上下文已经失效                                   |
| DataIntegrityError | 读取发现必要类型行或正式引用结构损坏，不能降为空值                     |
| ReadFailed         | 已接纳的读取因存储等故障失败；保留安全说明，不暴露底层异常文本         |

取消、权限与断连沿用[共同失败目录](library-write-contracts.md#errors)。未知操作或无效字段不得通过静默忽略变成更宽查询。普通 get、locate 和身份查找未匹配使用 null，合法列表无匹配使用 items: [] 与 total: 0。

正式类型与运行校验需验证：每种字段族的合法输入、类型不相容、空操作数、非法日期、未知键、混合投影及未请求属性；list／locate／groups／selectRefs 使用同一数据与可见性；分组重复、反向范围、端点变化和失效动态组不得改变固定选择规则。独立类型夹具只证明声明关系，不能代替真实 SQLite 与跨进程验收。
