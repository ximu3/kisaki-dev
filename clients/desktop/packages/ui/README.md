# @kisaki3/ui

本包提供 Solid 1.9 的通用控件、图表、Markdown、拖拽与虚拟几何。Solid 作为 peer；业务数据、资源取得、保存和页面布局由消费者拥有。

## 公开入口

| 导入路径                 | 内容                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `@kisaki3/ui`            | 基础呈现、表单、内容结构、浮层、反馈和 TanStack Virtual 几何。      |
| `@kisaki3/ui/chart`      | Unovis Solid 图表组合、主题容器、可访问图例与文本提示内容。         |
| `@kisaki3/ui/markdown`   | CodeMirror 编辑器、工具栏、格式命令与安全 Markdown 预览。           |
| `@kisaki3/ui/drag`       | Pragmatic Drag and Drop 的 Solid 生命周期接入、手柄、插入线和播报。 |
| `@kisaki3/ui/styles.css` | 包自带的普通 CSS；不需要消费者编译 Tailwind。                       |

```tsx
import { Button } from '@kisaki3/ui'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'
```

先加载 appearance，再加载 ui 样式。宿主选择主题、文档缩放和字体资源；样式不会重置消费者的整个文档。`class` 与默认工具类通过 tailwind-merge 合并，消费者自有的 CSS 仍由消费者提供。图表、Markdown 和拖拽实现通过各自入口按需导入。

## 控件与组合

| 范围       | 家族                                                                          |
| ---------- | ----------------------------------------------------------------------------- |
| 基础呈现   | Button、Link、Badge、Separator、Spinner、Progress、Alert、Image、EmptyState。 |
| 表单       | Field、TextField、Checkbox、Switch、RadioGroup、Select、Combobox、Slider。    |
| 内容结构   | Tabs、SegmentedControl、Collapsible、Table、ScrollRegion。                    |
| 浮层与反馈 | Dialog、AlertDialog、Popover、DropdownMenu、ContextMenu、Tooltip、Toast。     |

组成部分使用家族前缀，例如 `TextFieldInput`、`TextFieldLabel` 和 `DialogContent`。Kobalte 拥有对应控件的状态、焦点、键盘与标签关系；ref、事件、受控和非受控语义沿用原语。组件内容、可访问名称、错误与动作文字由调用方提供。Spinner 默认是装饰性图形，由所在控件或状态区域说明正在进行的工作。

Button 默认 `type="button"`，提供 `primary`、`secondary`、`outline`、`input`、`ghost`、`link`、`text` 和 `destructive` 变体，以及 `xs`、`sm`、`md`、`lg` 尺寸。只有图标时传入 `iconOnly` 和可访问名称；真实导航使用 Link。

Field 只安排布局，Fieldset／FieldLegend 使用原生表单分组。文本值、`name`、必填、禁用、只读和校验状态传给 TextField Root；一个 Root 对应一个 Input 或 TextArea。

```tsx
import { TextField, TextFieldLabel, TextFieldInput, TextFieldDescription } from '@kisaki3/ui'

;<TextField name="title" defaultValue="A quiet afternoon">
  <TextFieldLabel>Title</TextFieldLabel>
  <TextFieldInput />
  <TextFieldDescription>A readable display title.</TextFieldDescription>
</TextField>
```

Checkbox、Switch、RadioGroup 和 SegmentedControl 保留各自的 Input 部件；Select、Combobox 通过 HiddenSelect 参加原生表单。SliderInput 放在对应 Thumb 内。TextArea 可使用 `autoResize`；开启 `submitOnEnter` 后，普通 Enter 请求原生表单提交，Shift+Enter 保留换行，输入法组合期间不会提交。调用方可通过 `onKeyDown` 阻止提交。

Dialog、AlertDialog、Popover、Select、Combobox、DropdownMenu、ContextMenu 和 Tooltip 的 Content 自带 Portal。Dialog 的受控模式由调用方更新 `open`；业务关闭确认、异步保存和重复提示协调归宿主。关闭动作使用可见文字或显式 `aria-label` 作为名称。TooltipTrigger 保留原生 `as` 组合，例如 `as={Button}` 或 `as={Link}`。

ToastRegion 和 ToastList 接收 `toaster` 创建的通知；调用方选择区域、显示时长和本地化文字。Table 使用原生表格语义；ScrollRegion 暴露实际滚动元素，调用方提供名称和尺寸。`createVirtualizer`、`createWindowVirtualizer` 和 `defaultRangeExtractor` 直接提供通用几何，真实行身份、数据读取、选择和滚动锚点归视图。

## 图表

图表使用 Unovis 1.7.1 的官方 Solid 适配。`Chart` 把 appearance 映射到图表主题，`VisXYContainer` 和 `VisSingleContainer` 组合对应子组件。提供折线、面积、分组柱、堆叠柱、散点、环图、坐标轴、Tooltip 和 Crosshair；配置与回调沿用上游定义，原生实例由 Solid 组合统一创建、更新与销毁。

```tsx
import { Chart, VisXYContainer, VisLine, VisAxis, CurveType } from '@kisaki3/ui/chart'

;<Chart aria-label="Counts over time">
  <VisXYContainer
    data={[
      { day: 1, count: 3 },
      { day: 2, count: 5 },
    ]}
    height={180}
  >
    <VisLine<{ day: number; count: number }>
      x={(point) => point.day}
      y={(point) => point.count}
      curveType={CurveType.Linear}
    />
    <VisAxis type="x" />
    <VisAxis type="y" />
  </VisXYContainer>
</Chart>
```

通过子组件提供坐标轴、图形和提示，不向容器或 Crosshair 转交手工创建的 Unovis 实例。自定义 bleed 回调只接收只读几何。ChartLegend 接收 `label`、`color` 与 `inactive`，提供 `onItemClick` 时使用可键盘操作的按钮；数据筛选仍由调用方完成。`createChartTooltip` 生成只含文本的 DOM，适合把数据交给 Unovis 提示回调。标题、单位、数据摘要和图表的文本替代由调用方提供。

严格 CSP 的宿主按 [Unovis 指引](https://unovis.dev/docs/guides/csp/)在导入图表模块前设置 nonce；本包不修改宿主策略。图表依赖的公共声明由制品承载，NodeNext 消费者无需关闭完整声明检查。

## Markdown

`MarkdownEditor` 拥有 CodeMirror 6 实例。定义 `value` 时，`onChange` 同步交付新源码，宿主更新 `value`；非受控编辑使用只在创建时读取的 `defaultValue`。`readOnly`、`disabled`、`placeholder`、原生 CodeMirror `extensions` 和初始 `cspNonce` 分别控制编辑状态与接入。`onView` 在创建后收到实例，在销毁前收到 `undefined`，实例不转移所有权。

```tsx
import { createSignal } from 'solid-js'
import { MarkdownEditor, MarkdownPreview, MarkdownToolbar, markdownCommands, type EditorView } from '@kisaki3/ui/markdown'

const [text, setText] = createSignal('A note')
const [view, setView] = createSignal<EditorView>()

<>
  <MarkdownToolbar
    aria-label="Formatting"
    view={view()}
    items={[{ label: 'Bold', content: <strong>B</strong>, command: markdownCommands.bold }]}
  />
  <MarkdownEditor aria-label="Note" value={text()} onChange={setText} onView={setView} />
  <MarkdownPreview value={text()} />
</>
```

工具栏使用原生 Tab 顺序，文字和图标由 `items` 提供；宿主把当前不可用状态传给 `disabled`。普通格式命令、标题、链接、图片、表格、脚注及原生 undo／redo 可共用于按钮和 CodeMirror keymap。图片与链接取得后调用 `insertMarkdownImage`／`insertMarkdownLink`；资源选择、预览布局、放大编辑区域、保存和草稿关闭使用宿主自己的状态及本包其他控件组合。

预览支持 Markdown、表格、任务列表、脚注、自动链接、软换行和标点呈现。原始 HTML 显示为文本；任务列表只读，勾选状态在源码中修改。每个预览的任务与脚注 ID 相互独立。

图片必须通过同步 `resolveImage(source)` 映射到宿主已取得的 URL；未解析的图片显示其替代文本。宿主负责资源的授权、寿命和撤销，ui 不识别附件领域身份。提供 `onLinkClick` 时由宿主接收普通链接导航，页内脚注继续使用原生锚点。未提供回调时，普通链接保留浏览器行为。编辑器和预览均不保存正文，也不把取消或资源失败视为保存成功。

## 拖拽

在 Solid owner 内调用 `createDraggable`、`createDropTarget`、`createDragMonitor`、`createDragAutoScroll` 或 `createDragWindowAutoScroll`，参数是返回上游选项或 `undefined` 的 accessor。选项变化时重新登记，owner 结束时释放登记和滚动；回调取得真实交互载荷，不另造移动数据模型。

DragHandle 作为 `dragHandle`，其必需的 `onClick` 打开键盘可用的等价移动操作。DropIndicator 接收 `attachClosestEdge`／`extractClosestEdge` 的边缘结果，所在行或卡片负责定位。`createDragAnnouncer` 在当前 owner 内取得播报函数；最后一个拥有者结束后释放共享 live region 和待播报消息。

虚拟列表的 monitor 放在稳定视图上，行组件只拥有自己的登记。真实对象、选中集合、落点是否就绪、范围与权限、取消后的状态及保存失败均由业务拥有；只有有效放下或等价键盘动作产生提交意图。不要把屏幕数组作为完整持久顺序。

## 构建与验证

在本包目录运行：

| 命令                 | 结果                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| `pnpm build`         | 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。                    |
| `pnpm run pack`      | 生成 `out/package.tgz`。                                                           |
| `pnpm check:package` | 使用 publint 与 Are the Types Wrong 检查已完成的 tarball。                         |
| `pnpm typecheck`     | 检查本包源码及工程配置。                                                           |
| `pnpm lint`          | 检查本包的工程与源码规则。                                                         |
| `pnpm test:browser`  | 在 Chromium 验证实际组合；先完成 build，根目录 `desktop:test:browser` 会安排构建。 |

仓库根的 `tests/desktop/consumers` 使用真实 tarball 验证跨包消费。

自有实现采用 MIT。制品的 `dist/THIRD_PARTY_NOTICES.txt` 按实际汇总的声明与 CSS 保留上游 LICENSE 和 NOTICE。公开职责见[公共 UI 合同](../../../../refactor/design/ui/package.md)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
