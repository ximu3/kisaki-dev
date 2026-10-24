# 资料图写入值

library.writeGraph 提交已经确定的本地创建、修改和关系意图。本页定义请求外层、临时寻址和各区域允许的动作；字段值与比较单位沿[正式资料](catalog.md)、[关系](relations.md)、[普通写入](library-write-contracts.md)及[持有](holdings.md)合同。

<a id="shape"></a>

## 请求与结果

```ts
interface LibraryWriteGraph {
  entries?: {
    create?: readonly GraphEntryCreate[]
    update?: readonly EntryUpdate[]
  }
  parts?: {
    create?: readonly GraphPartCreate[]
    update?: readonly PartUpdate[]
  }
  tags?: {
    create?: readonly GraphTagCreate[]
    update?: readonly TagUpdate[]
  }
  relations?: GraphRelations
  localContent?: GraphLocalContent
  prepared?: readonly PreparedAttachment[]
}

interface LibraryWriteResult {
  entries: Readonly<Record<string, EntryRef>>
  parts: Readonly<Record<string, PartRef>>
  tags: Readonly<Record<string, string>>
  changed: boolean
}

type GraphEntryRef<T extends EntryType = EntryType> = EntryRef<T> | { key: string }
type GraphPartRef<T extends PartType = PartType> = PartRef<T> | { key: string }
type GraphTagRef = { id: string } | { key: string }
```

省略区域或空数组表示没有该类意图，空图是 changed: false 与三份空映射。prepared 只提供资源占用，不构成独立写入；没有最终业务引用的准备结果不被采用。三个结果映射只包含本次 create 中确实建立的 key，不包含已有引用或隐式新建对象。

所有 create key 在整份图中唯一且非空。`{ key }` 只能指向本次相应 create 节点，不能引用更新项或另一次请求。实际类型由被引用节点确定并核对槽位；TypeScript 无法仅凭字符串证明图内引用正确，运行校验仍须检查完整图。

GraphEntryCreate 复用 entries.create 的七类判别输入，只增加 key：type 与实际资料字段、evaluation 及仅 Work 适用的 record、completionRecords 关联。name 必填，其他创建字段的省略与缺省沿所属合同；id、createdAt、updatedAt 和派生值不可提交。初始标签及手动合集关联使用已有成员合同，标签可以使用本图 tag 引用，合集必须是已有真实手动合集。

GraphPartCreate 区分对象种类与动画分部的业务分类：

```ts
type GraphPartCreate = {
  [K in PartType]: {
    key: string
    type: K
    work: GraphEntryRef<PartWorkType<K>>
    data: PartCreateFields<K>
    completed?: boolean
  }
}[PartType]
```

data 包含该类 Part 的可创建资料：共同 name、originalName、aliases、description、primaryImageId、externalLinks、releaseDate、externalIdentities，以及[专属字段](catalog.md#parts)。省略项采用所属创建缺省。动画 data.type 为 regular／special 或 Extra 分类，外层 type 则为 animeEpisode／animeExtra。顺序按 create 数组在对应作品列表内的出现顺序追加，不开放 sortOrder 或技术时间。completed 缺省 false，显式初值与 Part 同次提交，不创建作品完成历史。

GraphTagCreate 为 `{ key, name, description?, isNsfw? }`，字段与缺省沿标签合同。它明确请求创建，不因 nameKey 已存在改成复用；已有标签应在调用前对应并使用 `{ id }`。唯一性竞争返回 Conflict。

EntryUpdate、PartUpdate 与 TagUpdate 使用各自正式 ref／id、changes、expected 输入；不接收 key，不从详情类型取 Partial。PartUpdate 不修改所属作品或 PartRef.type；Episode 的 regular／special 与 Extra 分类属于可编辑资料，位于 changes.type。同一正式目标最多更新一次，重复或矛盾意图在提交前拒绝。

<a id="relations"></a>

## 关系动作

GraphRelations 只含 workCharacters、personWorks、organizationWorks、workRelations、entryTags 和 volumeChapters。Part 与 Work 的必填归属由 GraphPartCreate.work 建立；候选中的 workVolumes／workChapters／workEpisodes／workExtras 不成为另一套可写归属关系。

四类资料关系各自允许 add、update、remove 数组。add 使用下表完整端点及正式属性；update 为 `{ id, changes, expected? }`，expected.binding 按[关系基线](library-write-contracts.md#expected)核对；remove 为真实关系 ID 数组。成员增减与属性编辑分别表达，已经存在的同业务键 add 保留原有属性与排列；需要修改时显式 update。

| 区域              | add 的完整值                                           |
| ----------------- | ------------------------------------------------------ |
| workCharacters    | `{ work, character, role, note?, isSpoiler? }`         |
| personWorks       | `{ work, person, character, role, note?, isSpoiler? }` |
| organizationWorks | `{ work, organization, role, note?, isSpoiler? }`      |
| workRelations     | `{ from, to, type, note? }`                            |

Entry 端点使用对应类型的 GraphEntryRef。role、character 的可空性沿正式关系定义，必须显式给出；note、isSpoiler 省略时分别为 null、false。workRelations 使用正式关系类型，事务内统一方向并检查业务键。删除关系不删除端点。

ingest 的完整范围替换在准备时解析为明确的增、改、删集合。修改项沿各自 update.expected，只比较 binding 和本次修改字段；删除项随关系区域提供 `expected: readonly RelationSnapshot[]`，每项包含 id、完整 binding、note 及适用 isSpoiler，并且只允许引用本次 remove 中的关系。它不是图级版本或任意查询条件。提交时待删关系必须仍与原快照一致；准备期间后来增加的其他关系保留，不扩入本次删除范围。来源完整性只决定这次固定范围的删除资格，不授予删除在途新增事实的权限。

entryTags 使用 `{ entry, change, expected? }` 数组，change 复用标签侧 replace／modify，成员中的 tagId 使用 GraphTagRef。volumeChapters 使用 `{ volume, change, expected? }` 数组，成员为 `{ chapter: GraphPartRef<'comicChapter'>, numberLabel: string | null }`；replace 的数组顺序表达该卷收录顺序，expected 比较完整原成员、编号及顺序。两端必须属于同一漫画，作品话号不被改写。

同一请求不能重复业务键、同时修改和删除同一关系，或删除作品角色关联又添加依赖它的具体角色工作。不同区域共同指向同一事实时也核对矛盾，不以数组先后裁决。无实际变化的合法意图不制造事件。

<a id="holdings"></a>

## 初始登记与资源

GraphLocalContent 按 game、anime、comic、novel 四个可选键组织数组。每项包含 work: GraphEntryRef，以及适用的 directories、files 或 launchConfigs 创建输入；游戏只接受 directories 和 launchConfigs，其余三类只接受 directories 和 files。创建字段沿对应 holdings 操作，所属 Work 由本层固定，文件关联中的 PartRef 可以使用相容 GraphPartRef。

这里只接纳已经核验和准备好的新增登记，不进行扫描、识别、联网获取、启动或持续观察。目录重复、路径包含和文件登记约束沿 holdings。初始关联、首选和手动决定由输入明确，随本次图共同提交；已有登记的复用由原调用流程先确定，不在图中重新匹配。

prepared 从真实调用上下文取得，正式数据仅使用 attachmentId。只采用最终字段和 Markdown 实际引用的结果；事务失败保留调用方仍持有的草稿资源。资源方法与 AbortSignal 通过运行接入传递，不序列化为任意 JSON 函数。

<a id="commit"></a>

## 校验与提交

执行顺序为闭合输入校验、图内 key 与类型核对、资源准备与占用、当前事实复核、短同步事务及提交后交付。图内没有逐项部分成功；失败不返回伪造映射，取消不撤销已提交图，未知提交不重放。

正式公共包覆盖七类 Entry、五类 Part 和六个关系区域，复用所属字段与操作定义。其消费验收创建含人物、分部、标签及初始文件关联的图；错类端点、动画 data.type、无主 key、未知字段和不适用个人值分别检查。正式数据库验证唯一性、准备后的依据变化、固定替换范围与事务回滚，声明检查不代替这些运行约束。
