# 应用搜索与导航结果

应用搜索从已有资料和功能目录中查找目标，返回只读的导航结果。搜索面板只在主窗口提供。查询、打开结果和目标界面内的定位，分别由相应模块完成。

<a id="query"></a>

## 分类与检索范围

search.query({ text, category }, { offset, limit }) 每次查询一个类别，返回 { items, total }。total 表示相同查询和可见范围内的完整数量，不另加 hasMore。“全部”只是界面模式：并发读取各类别的预览，不增加一个 category，也不计算跨类别总数。

text、category、offset 和 limit 均必填。offset 为非负安全整数，limit 沿库列表合同限定为 1–200 的安全整数；超限返回 InvalidInput，不截断请求。offset 超过 total 时返回空 items 与实际 total，空 text 使用下述空查询规则。未知类别、额外参数和非法值在执行前拒绝。

| 分组 | category       | 对象范围                               |
| ---- | -------------- | -------------------------------------- |
| 资料 | catalog        | 七类 Entry、正式 Part、合集与标签      |
| 笔记 | notes          | 独立 Note                              |
| 标注 | annotations    | 四类 Work 的 Annotation                |
| 配置 | configurations | 资料方案、扫描配置与游戏启动配置       |
| 主题 | themes         | 主题目录中的内置、用户及已注册扩展主题 |
| 字体 | fonts          | 用户字体库                             |
| 扩展 | extensions     | 已安装扩展                             |
| 页面 | pages          | 可用的原生及扩展页面入口               |
| 偏好 | preferences    | 应用偏好项                             |

各类别只检索明确允许的内容：

| 分组 | 可检索内容                                                                        |
| ---- | --------------------------------------------------------------------------------- |
| 资料 | 名称、原名、别名、外部标识；七类 Entry 补充排序名和简介，分部补充编号及所属作品名 |
| 笔记 | 标题、正文、关联条目名                                                            |
| 标注 | 标题、批注、摘录、所属作品名                                                      |
| 配置 | 名称、说明；启动配置补充所属游戏名                                                |
| 主题 | 名称、来源显示名                                                                  |
| 字体 | 名称、字体家族名                                                                  |
| 扩展 | 名称、ID、简介、关键词                                                            |
| 页面 | 页面名称及导航文案                                                                |
| 偏好 | 设置名称、说明、明确的搜索关键词                                                  |

七类 Entry 的文字范围、各类普通文字的比较以及正文文本提取，复用[库查询的文字检索规则](library-queries.md#text-and-sort)。简介、笔记等正文按可读文字匹配，Markdown 标记和内部附件地址不参与检索。多个词必须全部命中同一结果，或它允许展示的直接上下文，可以分布在允许的不同字段中。关联名称不会继续递归扩展。

外部身份按完整值匹配，不使用普通文字的大小写及全半角规则。搜索命中不会建立来源绑定，也不改写原始资料。

查询不联网获取资料，不扫描磁盘，也不检索配置原始 JSON、扩展私有值、执行日志、书内全文或字幕。系统字体由字体选择器处理，远程扩展由扩展管理页面查找。独立搜索结果须有实际查找用途、稳定目标和打开入口，不为搜索建立对象父表。

空查询返回空 items 和 total 0，面板提示用户输入。查询失败应显示实际失败，不能作为空结果隐藏。隐藏内容不能影响可见摘要、排序、计数或分页。过期响应不能覆盖新查询，取消使用共同执行上下文。

<a id="results"></a>

## 结果、排序与大列表

```ts
type SearchTarget =
  | { type: 'entry'; ref: EntryRef }
  | { type: 'part'; work: WorkRef; ref: PartRef }
  | { type: 'collection'; id: string }
  | { type: 'tag'; id: string }
  | { type: 'note'; id: string }
  | { type: 'annotation'; ref: AnnotationRef }
  | { type: 'metadataProfile'; id: string }
  | { type: 'scanConfig'; id: string }
  | { type: 'launchConfig'; gameId: string; id: string }
  | { type: 'theme'; ref: ThemeRef }
  | { type: 'font'; id: string }
  | { type: 'extension'; id: string }
  | { type: 'page'; ref: PageRef }
  | { type: 'preference'; key: PreferenceKey }

type SearchCategory =
  | 'catalog'
  | 'notes'
  | 'annotations'
  | 'configurations'
  | 'themes'
  | 'fonts'
  | 'extensions'
  | 'pages'
  | 'preferences'

interface SearchTargetMap {
  catalog: Extract<SearchTarget, { type: 'entry' | 'part' | 'collection' | 'tag' }>
  notes: Extract<SearchTarget, { type: 'note' }>
  annotations: Extract<SearchTarget, { type: 'annotation' }>
  configurations: Extract<SearchTarget, { type: 'metadataProfile' | 'scanConfig' | 'launchConfig' }>
  themes: Extract<SearchTarget, { type: 'theme' }>
  fonts: Extract<SearchTarget, { type: 'font' }>
  extensions: Extract<SearchTarget, { type: 'extension' }>
  pages: Extract<SearchTarget, { type: 'page' }>
  preferences: Extract<SearchTarget, { type: 'preference' }>
}

interface SearchItem<T extends SearchCategory = SearchCategory> {
  target: SearchTargetMap[T]
  title: string
  context: string | null
  excerpt: string | null
  imageId: string | null
  icon: SearchIcon | null
}

type SearchIcon =
  { type: 'mdi'; name: string } | { type: 'extension'; extensionId: string; path: string }

interface SearchResult<T extends SearchCategory = SearchCategory> {
  items: readonly SearchItem<T>[]
  total: number
}
```

SearchTarget 属于原生导航目标合同，由 search 直接引用，导航负责真实目标与归属校验。PageRef 使用[页面引用](../ui/navigation.md#sidebar)的内置页面或 extensionId／pageId 分支，PreferenceKey 是[偏好字段目录](preferences.md#fields)中实际可导航的有限键；都不接受组件路径、任意 URL 或 JSON 路径。其他引用沿各自已有定义，Part 的 work 必须与真实归属一致。

category 与 target 分支关联：catalog 只包含 entry、part、collection、tag，configurations 只包含 metadataProfile、scanConfig、launchConfig，其余类别仅包含对应单一目标分支。正式 SearchResult 声明按输入 category 收窄，不允许调用方以显式泛型伪造另一类结果。

context 是仅用于展示的普通文字，表达所属作品、配置类别或设置路径；没有上下文时为 null，不解析它执行导航。excerpt 从本次匹配的已保存纯文本取得，最多 160 个 UTF-16 单元并收敛到完整扩展字素边界，无正文命中时为 null。

imageId 为已有正式附件 ID，icon 使用固定 MDI 名称或已安装扩展的包内资源；缺席均为 null。扩展图标保留 extensionId 以确定资源归属，path 仅为包内受控相对路径。结果自身不占用图片字节，视图按需沿已有附件或扩展资源入口取得、绑定和释放，过期引用使用共同缺图呈现；查询不返回无释放入口的 ReadResourceRef。展示资源不授予查看隐藏对象或读取任意文件的权限。

| 结果字段 | 作用                               |
| -------- | ---------------------------------- |
| target   | 已有的类型化导航目标               |
| title    | 对象名称或标题                     |
| context  | 适用的所属作品、配置类别或设置路径 |
| excerpt  | 必要的正文、批注或摘录命中片段     |

图片和图标复用实际资源值。同一对象命中多个字段时合成一项，total 也只计算一次。没有标题的内容遵守所属模块的显示规则，派生名称不写回资料。excerpt 只返回必要的纯文本片段，不返回整篇正文或 HTML。

每个类别内部按以下匹配档次从前到后排列，同一结果采用能够满足完整查询的最优档次：

| 档次 | 命中条件                                             |
| ---- | ---------------------------------------------------- |
| 1    | 名称或标题与完整查询文字相同，或外部标识完整匹配     |
| 2    | 名称或标题以完整查询文字开头                         |
| 3    | 允许检索的自身名称字段合起来包含全部检索词           |
| 4    | 需要正文、其他允许字段或直接上下文才能覆盖全部检索词 |

名称、原名、排序名和别名采用相同优先级，完整匹配及前缀匹配分别针对其中一个完整值判断。多词查询仍须全部命中；按名称命中进入前三档时，自身名称字段须覆盖全部词。某个词命中名称、其余词依靠简介、其他正文或上下文的结果归入第四档。外部标识的完整匹配独立归入第一档，并遵守前述准确比较规则。

同档按结果的显示名称或标题升序排列，复用[稳定自然数字顺序](library-queries.md#text-and-sort)，最后按完整目标身份补序，包括区分目标所需的类别及 ID。排序针对完整结果执行，各次区间读取和预览使用同一规则，不能只排列已加载项目。

“全部”模式仍按前述类别顺序分别展示各组，不计算跨类别相关度。Explorer 的搜索继续过滤当前列表，保留该列表的人工或字段排序，不采用应用搜索的匹配档次。

全部模式每组预览 3 项，只呈现有命中的组，并准确保留加载与失败状态。单类别初次读取 20 项，之后按视口有界读取，offset 与 limit 可以使用任意合法区间。3 和 20 是该搜索界面的内部默认值；Explorer 的读取预算由其自身管理。

完整 total 决定逻辑滚动范围，读取批次控制数据传输，渲染数量由实际视口决定。单类别检索使用[统一列表查询](library-queries.md)和[虚拟化](../ui/virtualization.md)。验收覆盖远处区间、快速滚动、查询切换、键盘选择、数据释放及锚点恢复，并核对全量逻辑范围。

<a id="navigation"></a>

## 打开结果与设置定位

结果直接携带类型化导航目标，交给原生导航打开，无须先生成 deeplink。Entry 打开详情，Part 定位到所属作品中的相应项目，启动配置打开编辑界面，Note 和 Annotation 打开已保存内容，偏好结果定位到字段或分组。

选择搜索结果只完成导航，不直接启动游戏、返回原文件或修改设置。这些动作由目标界面明确提供。打开搜索面板的操作只等待面板显示，不等待用户选择。类型限定选择器和多选选择器仍是独立能力。播放器、阅读器及游戏面板不绑定应用搜索快捷键，也不请求跨窗口打开搜索；它们的内容查找按各自职责处理。

设置界面通过同一份受控状态切换分组并展开必要区块。目标实际挂载后，通过元素引用滚动、聚焦并短暂高亮。定位映射到稳定字段或所属区块，不解析组件树，不模拟点击，也不依赖固定延迟。为显示条件字段而定位时，不能改变真实设置。

一次定位完成后保持当前滚动位置，再次明确请求时才重新定位。切换分组保留同一份草稿，搜索路由在接入层连接基础组件的定位能力。
