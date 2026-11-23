# 标注的查询与写入值

本页定义标注查询、摘要和写入目标的公共形状。[标注](README.md)拥有字段与用户行为，[阅读值](../reader.md#values)和视频定位拥有内容坐标；这里直接引用其类型。

<a id="query"></a>

## 查询、摘要与定位投影

```ts
type AnnotationScope =
  | { type: 'library' }
  | { type: 'work'; work: WorkRef }
  | {
      type: 'file'
      work: EntryRef<'anime' | 'comic' | 'novel'>
      fileId: string
    }

interface AnnotationQuery {
  scope: AnnotationScope
  search: string
  workTypes?: readonly WorkType[]
  refs?: readonly AnnotationRef[]
}

type AnnotationPositionHint =
  | { type: 'video'; startSeconds: number; endSeconds: number | null }
  | { type: 'page'; page: ReadingPageRef }

interface AnnotationSummary {
  ref: AnnotationRef
  work: WorkRef
  fileId: string | null
  title: string | null
  quoteExcerpt: string | null
  contentExcerpt: string | null
  imageId: string | null
  locationKind: 'image' | 'position' | 'range' | 'text' | 'region'
  positionHint: AnnotationPositionHint | null
  createdAt: number
  updatedAt: number
}
```

`list` 使用共用的 `ListOptions`，返回 `ListResult<AnnotationSummary>`。`scope`、`search` 和读取区间必填。省略 `workTypes` 时查四类作品，省略 `refs` 时不限制身份。两者显式为空数组时都返回空结果。数组内的身份须合法且唯一，各条件与 `scope`、普通可见范围相交。文件须属于所给作品。`search` 为空时不加文字条件，非空时查询标题、批注及摘录文字。

offset 是非负安全整数，limit 是 1–200 的安全整数。越界参数返回 InvalidInput；offset 超过 total 时返回空 items 和真实 total。结果按 createdAt 降序，再按 workType、id 升序；这里的 workType 顺序固定为 game、anime、comic、novel。所有筛选、数量和区间来自同次只读快照。

摘要片段来自已保存的纯文本，每段最多 160 个 UTF-16 单元，截断时保留完整的扩展字素簇。没有文字时返回 null。`title` 保留正式标题。位置提示只提供可直接从保存值取得的时间或原始页身份，无法直接解释的文字锚点返回 null。game 使用 image，其余位置按各自的 `locationKind` 解释。`imageId` 是否必填由对应类型规定。

get(ref) 根据 AnnotationRef 的 workType 返回对应的 `Annotation<T>` 或 null。完整 Annotation 使用 workType 判别：游戏包含 gameId 与 imageId；动画包含 animeId、可空 fileId、PlaybackAnnotationLocation 与可空 imageId；漫画／小说包含各自作品 ID、可空 fileId、ReadingAnnotationLocation、可空 quote 和 imageId。四类均包含 id、title、content、createdAt、updatedAt；不存在的类型字段不交付。

```ts
type AnnotationLocationItem<
  T extends 'anime' | 'comic' | 'novel' = 'anime' | 'comic' | 'novel',
> = {
  [K in T]: {
    ref: AnnotationRef<K>
    location: K extends 'anime' ? PlaybackAnnotationLocation : ReadingAnnotationLocation
    createdAt: number
  }
}[T]

interface AnnotationLocationResult<
  T extends 'anime' | 'comic' | 'novel' = 'anime' | 'comic' | 'novel',
> {
  items: readonly AnnotationLocationItem<T>[]
  total: number
}
```

`listLocations({ work, fileId }, options)` 只用于动画、漫画和小说的准确文件范围，区间规则与 list 相同，按 createdAt、id 升序交付定位投影，不带正文、摘录和图片。主进程使用真实文件归属限定 Work。当前文件面板取得完整定位集合后，由实际执行者形成内容顺序；需要显示哪段摘要时，通过 list 的 refs 查询，再按已经形成的索引呈现。未完成定位索引不冒称完整内容顺序；数据失效时重新接续读取并重建索引，关闭文件后释放。该投影不建立另一份持久标注数据。

<a id="write"></a>

## 创建与完整目标更新

```ts
type AnnotationCreate = {
  title?: string | null
  content?: string
  prepared?: readonly PreparedAttachment[]
} & (
  | { workType: 'game'; gameId: string; target: { imageId: string } }
  | {
      workType: 'anime'
      animeId: string
      target: {
        fileId: string
        location: PlaybackAnnotationLocation
        imageId: string | null
      }
    }
  | {
      workType: 'comic'
      comicId: string
      target: {
        fileId: string
        location: ReadingAnnotationLocation
        quote: string | null
        imageId: string | null
      }
    }
  | {
      workType: 'novel'
      novelId: string
      target: {
        fileId: string
        location: ReadingAnnotationLocation
        quote: string | null
        imageId: string | null
      }
    }
)
```

create(input) 返回 annotationId。标题省略为 null，content 省略为空字符串；target 中的正式成员均显式给出。prepared 是本次可采用的准备句柄集合，主进程核对真实归属与占用，跨进程由资源接入转换；它不是任意可伪造的附件声明。只采用实际字段和正文引用的准备结果，既有附件可以直接复用 ID。

update(ref, { changes, expected?, prepared? }) 按 ref.workType 选择目标类型。changes 只允许 title、content 与完整 target；expected 只允许所修改普通字段的原值，以及修改 target 时的完整原目标。game target 为 imageId，其他类型与创建目标同形，但已有文件被删除后的原目标允许 fileId 为 null。明确修改不得把有效 fileId 清成 null；已脱离文件的标注可以保留 null 修改其他目标值，重新关联时必须提供相容的新文件及完整内容目标。

完整 target 作为一个保存与比较单位，不接受任意子路径 patch。重新选择文字范围时提交对应新 quote，重新定位原内容时明确保留原 quote；同文件视频范围或图片更新按既定规则保留其他值。library 校验纯值、归属、附件及基线，不重新打开媒体验证历史内容。仅修改标题或批注不需要读取目标文件，也不需要把 target 放入 changes。

delete 接收一个 AnnotationRef 或非空去重引用数组；同一次短批量全部成功或全部失败，不接受 expected。update 与 delete 成功返回 void，完整原子失败不带部分标注结果。

<a id="validation"></a>

## 校核边界

正式声明使用按 workType 关联的联合类型，拒绝游戏位置、非阅读 quote、类型不符的文件与坐标；数值、几何和真实引用继续由所属纯校验及提交边界检查。声明消费覆盖正常创建、脱离文件的读取、标题独立更新、非法类型组合、重复身份和区间边界；正式数据库与 UI 行为沿[标注验收](../../../verification/scenarios/library.md#annotations)执行。
