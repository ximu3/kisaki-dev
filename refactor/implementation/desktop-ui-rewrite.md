# 桌面 UI 的视觉基准与整体重写方案

W05 交付可独立消费的公共 UI，W07 用这些部件建立四类桌面文档的宿主和主窗口的正式管理界面。重写沿一条用户路径贯通外观、组件、业务状态、窗口和验证。公共库定义控件尺度与行为，场景拥有自己的草稿和滚动区域。W08 的业务页面接入这个框架。主窗口使用稳定的主题工作面。

查阅入口按职责排列。[UI 设计参考与职责](#implementation-owners) · [Form 与 Select](#forms) · [控件尺度](#control-scale) · [Dialog、Field 与滚动](#surface-layout) · [窗口控制](#window-controls) · [文件组织](#ownership) · [样式](#styles) · [编码风格与分段](#source-style) · [实施与验收](#delivery)

<a id="implementation-owners"></a>

## UI 设计参考与实现职责

旧项目 `F:/project/3/kisaki` 仅作 UI 设计参考，本次查阅提交 `e311fe7c`。`.agents/skills/kisaki/references/ui-system.md` 定义了工作表面的视觉语言。`apps/desktop/src/renderer/src/components/ui/` 中的 Form、Field、Button、Select、Dialog、Toolbar、Table 和 ScrollRegion 给出部件尺度与组合。`components/layout/root-layout.vue`、`features/settings/components/settings-dialog.vue` 和 `features/task-center/components/task-center-dialog.vue` 则说明这些规则在正式窗口里如何协作。旧任务中心的搜索和两个筛选器都用紧凑档，范围与查询集中在结果上方，清理和刷新固定在底部。[旧任务中心画面](../verification/evidence/w07/ui/reference-task-center.png) · [界面保留原则](../design/ui/components.md#existing-ui)

布局、桌面密度、字段排列和操作位置参考既有 UI，保存与回退行为、正式资源、接口及交付范围由当前规格确定。应用默认缩放 **100%**，先在这个比例判断视觉层次和控件比例。75% 和 200% 用于支持边界复验。操作系统显示缩放独立记录。例如旧 Form 让 Body 滚动、Footer 固定，这个布局应保留。旧 Form 监听 invalid 后发送通知。新 Form 采用现行的固定反馈区，在一次提交中汇总问题并定位首错。[偏好草稿](../design/domains/preferences.md#editor) · [表单反馈](../design/ui/components.md#validation)

**先看用户在做什么，再决定谁提供这项交互。** 公共 UI 根据需要自行实现控件，也在合适的位置直接利用浏览器行为。Select 的选择列表、键盘高亮、弹出位置与外观归 UI 库，底层 select 接入表单值和有效性。选文件时由系统提供文件对话框，字体管理器解释选中的文件、显示预览并独立保存。

| 核对范围 | 重写前的实际使用 | 整体重写的处理 |
| --- | --- | --- |
| 应用业务控件 | 17 个正式 renderer TSX 中有 4 处原生 form、17 处原生 input、3 处原生 button、1 处原生 progress。偏好、主题、字体、任务、系统集成混用公共控件和窗口自绘样式 | 需提交的编辑操作使用 Form。文字、数字、日期、颜色、布尔选择、快捷键录入、动作与进度消费适用的公共家族。字体选择理解产品资源，组合公共 Combobox |
| 应用结构与内容 | `main`、`nav`、标题、段落、列表、环境资料的 `dl`、格式化文本承担文档结构 | 直接使用对应 HTML。任务输入的展开属于应用的折叠交互，使用 Collapsible。Markdown 正文中的链接、图片标题及书籍作者的 `details` 保留文档语义 |
| 窗口与系统动作 | 文件选择、系统菜单、桌面通知和窗口控制各有平台行为。主题与字体中有 4 处浏览器 confirm，侧栏两个动作以 title 提示 | 文件选择等继续走 main 的系统接入。产品删除与放弃草稿进入所属 Dialog。固定动作使用公共 Tooltip 与独立可访问名称。退出协调器在没有可用业务表面时仍能从系统取得用户决定 |
| 公共包与独立消费者 | 53 个公共 UI 源 TSX 中的按钮、输入、原生 dialog、选择镜像和 `fieldset` 分别承担实际行为。另有 7 个测试或样板 TSX | 公共库按控件合同自主实现，保留文本选择、IME、撤销、键盘与表单语义。验证 HTML 表单、普通 CSS 与包的独立消费时保留原生对照。字体样式 link 与解析颜色的 canvas 随文档资源管理 |
| 官方扩展、第三方与独立项目 | 官方扩展和模板的产品表面共用 Solid UI，第三方拥有自己的渲染栈。Kana 的阅读正文保留作者内容与实际语义文档 | 官方表单直接消费公共部件，业务保存经私有通道。第三方按宿主合同接入。Kisaki 负责阅读窗口外壳，Kana 负责正文控件、布局与选择。各后续工作包在自己的真实入口验收 |

实测基线为 `32309210` 的 Windows x64 候选及同工作区构建的公共包。图像和几何记录来自实际运行。Linux、macOS 和后续 Webview 的运行结果按各自宿主取得。[正式窗口实测与检查范围](../verification/evidence/w07/README.md#ui-review) · [公共包实测](../verification/evidence/w05/README.md#control-scale) · [Webview 隔离](../design/extensions/webview.md#isolation) · [阅读内容交互](../design/projects/kana/interaction.md)

<a id="forms"></a>
<a id="component-library"></a>

## 公共 UI 提供 Form、Field 与选择器

### 一份编辑对象，一次提交

`@kisaki3/desktop-ui/form` 交付 Form、FormFeedback、FieldIssue 和可由编辑器持有的 `createForm`。普通表单直接写 `<Form onSubmit={save}>`。偏好、主题和字体需要由窗口快捷键与关闭确认等待同一次保存，编辑器持有表单实例，将它交给 `<Form state={form}>`。外部入口等待实例的 `submit()`。原生 `requestSubmit()` 能触发 submit 事件，本身不返回业务保存的 Promise，这是复杂编辑器持有实例的具体理由。[公共表单合同](../design/ui/package.md#forms) · [HTML 提交接口](https://html.spec.whatwg.org/multipage/forms.html#dom-form-requestsubmit)

| 拥有者 | 职责 |
| --- | --- |
| Form | 渲染语义表单，保留 Enter、submitter、表单归属和 reset。取消默认导航，通过 novalidate 接管交互提示。读取适用控件的有效性，合并按字段身份排列的业务问题，首次提交定位首错。后续修正更新反馈。重复提交共享已接纳的 Promise 和动作 |
| Field 与 FormFeedback | Field 将可见标题、可选说明和该字段自己的错误关联到真实控件。FormFeedback 在一个稳定区域显示当前错误、汇总或整次保存的错误。点击反馈调用编辑器提供的定位动作，先切换分组再聚焦 |
| 业务编辑器 | 提供完整草稿的校验、字段阅读顺序、定位和提交。提交前固定本次值、目标和并发基线，处理成功、冲突与部分成功。用户在等待期间输入的内容保留。主题预览、字体准备、密钥和附件释放均由各自拥有者处理 |
| 窗口宿主 | 路由保存快捷键与关闭意图。只有校验通过、写入完成且草稿已无后续修改，才按该次请求离开。确认框保留继续编辑、放弃和保存的真实结果 |

Form 放在编辑 Dialog 的 Header 下，包含同级的 DialogBody 和 DialogFooter。Body 滚动，Footer 中的提交按钮天然关联到表单。确有外部提交按钮时保留 HTML 的 `form` 关联。嵌套的资源管理器作为另一层 Dialog 挂载在外层表单 DOM 之外，拥有自己的实例和保存范围。系统注册立即重读、任务筛选和打开详情各执行自己的动作。[编辑对象与保存边界](../design/ui/state.md#editing-units)

公共 Form 负责在途提交合并、原生有效性与固定反馈，各编辑器提供完整草稿校验、字段定位和业务写入。`/form` 导出 FormFeedback 与 FieldIssue，`/field` 保留字段部件。包 exports、构建入口、声明、样板与正式编辑器使用同一份合同。[Form 实现](../../clients/desktop/packages/desktop-ui/src/components/form/index.ts)

以主题编辑器为例，`form` 是本编辑实例，`saveTheme` 根据提交按钮的 `name/value` 判断本次是否同时选用。普通保存是第一个提交按钮，Enter 与快捷键的默认含义一致。该结构已在 Chromium 中核对外部高度约束、单一滚动区域和实际 submitter。[表单布局试件](../verification/evidence/w05/README.md#表单与固定-footer-的结构验证)

```tsx
<Form state={form}>
  <DialogBody>{fields}</DialogBody>

  <DialogFooter>
    <FormFeedback summary={(count) => api.t('runtime.fieldErrors', { count })} />
    <Button type="button" variant="ghost" onClick={cancel}>
      {api.t('actions.cancel')}
    </Button>
    <Button type="submit" variant="outline" disabled={form.busy()}>
      {api.t('actions.save')}
    </Button>
    <Button type="submit" name="intent" value="use" disabled={form.busy()}>
      {api.t('runtime.saveUse')}
    </Button>
  </DialogFooter>
</Form>
```

### 普通选择直接使用 Select

**普通选择由场景直接导入公共 Select。** 任务筛选、偏好、主题与系统集成直接传入类型化选项、值、译文和布局。字体搜索通过公共 Combobox 保留所选资源的完整身份。[任务筛选](../../clients/desktop/app/src/renderer/windows/main/features/tasks/history-list.tsx) · [公共 Select](../../clients/desktop/packages/desktop-ui/src/components/select/control.tsx)

- 空候选、无效选择文案和选项标签在调用场景中用当前文档的 `t` 取得，直接传给相应 Props。切换译本时更新显示。
- 表单的标题、错误与描述由 Field 关联。没有可见标题的任务筛选器直接给 Select 传 `aria-label`。布局宽度由场景的 `class` 表达。
- 选项键类型归公共选择家族。`Select<K>` 从类型化选项和值传递 `K | ''`。MultiSelect 传递有序键数组。无选择、合法默认值、缺失或禁用的已存键、已取消的 reset 都保留原有语义。业务筛选中的“全部”是一个真实选项。是否将空选解释为无筛选由该查询决定。
- 字体选择理解系统族名、用户字体 ID、主题默认和文档字体，保留为 `domain-ui/fonts/selector.tsx`。它消费可检索的 Combobox，选项记录携带类型化字体引用，选中后直接交付相应记录。已存字体暂不可用时仍展示原身份。

任务状态筛选在业务工具带内即可这样写。`status` 读取本页签的筛选，`changeStatus` 同时将分页位置归零。

```tsx
<Select<TaskRunStatus | 'all'>
  size="sm"
  aria-label={api.t('runtime.filter')}
  options={statusOptions()}
  value={status()}
  defaultValue="all"
  emptyMessage={api.t('runtime.noOptions')}
  invalidSelectionMessage={api.t('runtime.unavailable')}
  onValueChange={(value) => changeStatus(value || 'all')}
/>
```

<a id="control-scale"></a>

## 控件的比例由库统一

应用默认缩放 100%。默认主题根字号为 14px，普通单行控件的外高与字号为 24.5 / 12.25 CSS px。Input、Select、Button、Checkbox 和 Switch 在独立样板中对齐。任务和偏好的横排页签使用 10.5 CSS px 的文字，页签组外高 24.5 CSS px。 [公共控件测量](../verification/evidence/w05/README.md#control-scale)

工具带负责排列与换行。任务查询行的搜索和筛选框取小号，按钮在需要不同热区时显式选择尺寸，侧栏导航保持方形热区。弹窗标题、说明、提示、表格和页签按照阅读用途选择各自的字号。对话框头尾和工具带共用主题派生的弱底色。 [控件度量与样式](../design/ui/package.md#styles)

<a id="surface-layout"></a>

## Field、滚动视口和 Dialog Footer

普通表单使用 FieldGroup 和纵排 Field。短控件与偏好行用 `Field orientation="responsive"`，以所在字段组宽度 28rem 为分界，将标题和说明与控件区并排或顺序堆叠。FieldContent 承载一个控件及同字段管理动作。漫画与小说分别具名分组，组内复用阅读字段。主题按区域色、状态色、字型、圆角与阴影编排，亮暗分支的背景与文字色成对呈现。CSS 颜色和可变 CSS 单位直接编辑。43 个扁平 token 是存储结构，界面按用户修改的对象组织。[字段用途](../design/ui/components.md#fields) · [主题词表](../design/domains/appearance.md#tokens) · [原编辑画面](../verification/evidence/w07/ui/theme-editor.png)

DialogContent 接受内容宽度 `size` 与工具窗的 `fill`。sm、md、lg、xl、2xl 依次为 24、32、42、56、72rem。四边留 1rem，宽度受所属区域限制，高度至多 48rem 且容得下当前区域。窗口将标题栏下缘投影为模态区域的顶边，独立 Webview 的区域是本视图。库将实际可用几何施加给原生顶层 dialog，并按内容高或 fill 定位。Header、Body、Footer 的共享边界分别由一个部件绘制。[Dialog 合同](../design/ui/package.md#overlays)

| 表面 | 内容与滚动 | 动作和关闭 |
| --- | --- | --- |
| 任务中心 | xl、fill。工具带使用短页签文字和独立的小号查询行。固定表头与正文滚动分工。已结束记录显示任务、耗时、状态和操作。详情纵排结果、任务信息与输入 | Header 关闭。Footer 固定清理和刷新。清理入口使用 Alert Dialog 确认永久删除全部已结束任务记录，首焦点在取消。单条已结束记录可从操作列删除，详情关闭返回同一筛选、位置与发起按钮 |
| 偏好 | xl、fill。八个横排页签在标题下的公共工具带内，溢出时支持滚轮。正文共用一个纵向视口，草稿偏离默认时在字段标题旁恢复。作品使用保留共用计时，四个入口分别打开单列子表单 | Footer 左侧保留固定反馈，右侧为保存。Header 关闭时处理未保存的更改。子表单用确定回填父草稿，用取消放弃本次编辑。关闭窗口或离开对象复用同一份草稿的决定 |
| 主题、字体 | 单列管理条目显示身份、来源及单项动作，新增与导入固定在底部。预览和编辑分别打开，Header 均有关闭按钮，目录保留滚动和焦点 | 主题编辑器从左到右依次提供幽灵「取消」、描边「保存」和主操作「保存并选用」。选用冲突时反馈已保存的主题和选用结果。字体编辑器的保存位于取消右侧 |
| 系统集成、关于、确认 | 系统集成用一组普通字段排列启动、链接和数据目录，需要系统操作时在对应项提供入口。关于按间距区分项目标识和环境信息。确认采用带分隔线的标题带和随内容收高的 sm 宽度 | 普通工具在 Header 关闭。确认的动作区提供退出本次决定的入口和明确的提交动作 |

重写前的最小窗口中，任务 Dialog 顶部越过标题栏下沿，Tabs 分到 414px 而空态仅得 84px。偏好在 200% 下，Body 和字段区同时纵向滚动。重写采用上表的区域归属，删除 `62vh`、窗口级控件重绘及穿透 Tabs 私有 DOM 的选择器。表格保留一字段一列，窄宽横滚。虚拟选择列表绑定真实选项视口；有明确页数的任务列表按区间读取。输入的短暂加载、实际空集、查询无匹配和失败分别呈现。[任务基线](../verification/evidence/w07/ui/tasks.png) · [偏好基线](../verification/evidence/w07/ui/preferences.png)

### 控件家族随场景一并接入

| 家族 | 公共规则 | 正式使用处 |
| --- | --- | --- |
| Input、Select、Combobox、复选、单选、Switch、Slider | 单行控件与字段动作按档位共用外高。固定单位、搜索图标和末端动作位于输入框内。多选和快捷键共用单行滚动标签 | 搜索、范围筛选、快捷键录入、缩放、颜色和字体选择。快捷键的候选在锚定浮层中重置、取消或确定 |
| Dialog、Menu、Popover、Tooltip、Toast | 菜单负责动作，Popover 负责锚定内容，Tooltip 提供可阅读提示，Toast 随窗口队列存活。每层 Escape 只处理当前层 | 应用菜单、字段管理入口、任务详情、确认与保存反馈。关闭 Dialog 后仍需呈现的结果由发起者交付一次 |
| Table、ScrollArea、Tabs、SegmentedControl、Collapsible | 一字段一列，显式表头，行密度和列对齐由表面决定。固定表头使用结果区的实际滚动元素。Tabs 切换面板，分段选择修改一个值 | 任务中心使用 Toolbar 排列范围与查询。任务列表直接展示状态和动作，类型在查询与详情中用可读名称表达。详情返回后保留查询、位置及仍有效的触发点 |
| Badge、Progress、Spinner、EmptyState、Alert、Link、Separator、Image | 按信息角色安排字重、图标槽、边线和反馈，不为短列表另造表面 | 任务行使用公共进度与状态，等待读取、空集、无匹配和失败各有呈现。关于与系统集成按内容组织文字、链接与动作 |
| Chart、Markdown、Drag 与虚拟几何 | 主题和工具带沿用公共词表，专用编辑、可视化、拖拽和虚拟几何由既有专用工具实现，实例随拥有者释放 | W05 验证独立消费，真实业务的统计口径、内容资源、移动范围及持久顺序随所属工作包验收 |

<a id="window-controls"></a>

## 主窗口标题栏

**Windows、Linux 主窗口采用 Window Controls Overlay。** Kisaki 绘制品牌、拖动区和应用内容，Electron 在预留区域绘制窗口按钮并处理系统命中。macOS 使用 hiddenInset 与交通灯。业务 Dialog 保留文档模态，窗口操作进入所属 BrowserWindow 的最小化、还原、关闭和退出流程。

在 Windows 10 22H2、Electron 45.3.2 下，以**应用缩放 100%、系统显示缩放 125%**对照两个相同亮色主题、相同 32 CSS px 栏高的窗口。下表的自绘列采用无框窗口并实现三个按钮。单独关闭 WCO 时，带标准框架的窗口可以使用系统整条标题栏，无框窗口则由应用提供按钮。

| 对照项 | 使用 WCO | 不用 WCO，由 Kisaki 自绘 |
| --- | --- | --- |
| 外观与缩放 | 应用提供背景与栏高，Windows 另支持图形色。图形、悬停和按钮宽度由 Electron 与平台确定，试件控制区约 138 CSS px | 应用决定图形、悬停、热区和尺寸。三个 3rem 按钮在默认主题下共 126 CSS px，随根字号一起变化 |
| 最大化与系统贴靠 | 最大化中心返回 `HTMAXBUTTON`，系统能识别窗口动作。Windows 11 悬停贴靠在相应系统实际核对 | 普通 DOM 按钮中心返回 `HTCLIENT`。点击可以调用 Electron 最大化与还原。提供相同的悬停贴靠还需 Windows 非客户区命中接入 |
| 打开设置 Dialog | 系统按钮处在页面外，`showModal()` 打开后仍返回相同的窗口命中 | 同一文档的 `showModal()` 会使自绘按钮 inert。限定业务模态区域的试件保住了按钮操作，也需要维护区域状态、可访问性与焦点返回 |
| 标题栏底边 | Header 内的边线被系统按钮区覆盖。在控制区下方的整行工作区绘线后，两端贯通 | 页面绘制整个宽度，底边可以连续经过自绘按钮下方 |

| Header 内画线的 WCO | **采用的 WCO 分隔线** | 同条件的自绘按钮 |
| --- | --- | --- |
| ![边线到系统按钮区中断](../verification/evidence/w07/ui/titlebar-wco-100.png) | ![边线完整经过系统按钮下方](../verification/evidence/w07/ui/titlebar-wco-edge-100.png) | ![三个自绘按钮及底边](../verification/evidence/w07/ui/titlebar-custom-100.png) |

**标题栏与工作区只共享一条分隔线。** 窗口外壳将 Header 和下面承载侧栏、主内容的工作区作为兄弟区域。工作区整行绘制 `border-block-start: 1px solid var(--border)`，Header 移除原来的底边。修正前，右侧裁图的末尾 171 个物理像素是标题栏底色。隔离试件默认比例下完整客户区 1201/1201 个物理像素为边线色，最大化时为 2560/2560，最大化按钮仍返回系统命中。再在正式候选窗口临时套用同一修正，连续边线从 1580/1751 变为 1751/1751 像素。RGBA 编码解决配色，工作区边界解决断线，这两项分别验收。[完整取像与缩放边界复核](../verification/evidence/w07/README.md#titlebar-comparison)

主进程从已保存的界面缩放计算标题栏尺寸，创建窗口及缩放变化时采用同一规则。文档用该尺寸安排品牌，并按平台覆盖区域的实际下沿安排工作区。主题的字号用于内容排版，标题栏颜色经现有窗口连接交付。主进程执行窗口操作和关闭保护。[主窗口标题栏合同](../design/ui/components.md#titlebar) · [Electron 45.3.2 标题栏](https://github.com/electron/electron/blob/v45.3.2/docs/tutorial/custom-title-bar.md#custom-window-controls) · [Windows 贴靠要求](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/apply-snap-layout-menu)

<a id="ownership"></a>

## 窗口与源码归属

| 所属位置 | 终态职责 |
| --- | --- |
| `desktop-appearance`、`desktop-ui` | appearance 定义可持久视觉词表与根字号。UI 按家族拥有呈现、表单、表格、选择器、弹层、反馈和专用工具接入。共同输入面、动作或选项行只在实际多个家族共享时进入包内 internal |
| `renderer/infrastructure` | 接入窗口 RPC、译本、文档外观、字体绑定、文件传输与文档清理。共享弹窗宿主处理挂载、嵌套、关闭与焦点。它消费 Form 的结果，业务含义由编辑器提供 |
| `windows/main/app` | root 装配窗口，shell 安排标题栏、侧栏、固定工具、内容出口与 Toaster。routes 与 navigation 使用已登记的稳定目标。应用菜单提供即时偏好，管理入口与原生导航和快捷键复用同一调度，打开管理 Dialog 保持底层页面挂载 |
| `windows/main/features` | tasks 拥有两类查询、详情与清理。preferences 拥有共同草稿、按任务组织的字段和快捷键录入。themes、fonts 各拥有目录与单项编辑，system、about 交付本场景。处理指向同一对象的入口都调用所属场景 |
| `domain-ui` | 仅放理解产品对象且跨场景复用的私有 UI，例如主窗口的字体选择、W08 的资料选择与编辑。确实跨窗口共用的标注界面放 `renderer/domain-ui/annotations`，采集动作与当前资源仍归各自窗口 |
| 扩展文档 | 官方扩展通过 SDK 使用获准的业务能力，通过公开 UI 子路径取得部件。独立队列、资源与焦点留在所属文档。应用与 UI 包均不向第三方暴露应用私有设施 |

下列是主窗口重写涉及的主要源码路径，多文件主题内直接导入定义。扩展、资料、阅读、播放与游戏的业务模块随原工作包交付。

```text
windows/main/
  entry.tsx
  styles.css
  app/
    root.tsx
    shell.tsx
    routes.ts
    navigation.ts
    titlebar.css
  domain-ui/
    fonts/         selector.tsx、options.ts
    themes/        selector.tsx
    navigation/    list.tsx、order.ts
  features/
    tasks/         center.tsx、query.ts、filters.tsx、history-list.tsx、rows.tsx、details.tsx 与清理
    preferences/   editor.tsx、draft.ts、usage/、shortcuts.tsx 及其他字段组
    themes/        manager.tsx、inspection.tsx、samples.tsx、editor.tsx、fields.tsx、preview.ts
    fonts/         manager.tsx、details.tsx、editor.tsx、draft.ts、read.ts、specimen.tsx
    system/        settings.tsx、section.tsx、data-location.tsx
    about.tsx
```

`entry.tsx` 只建立客户端、挂载文档根并报告就绪。已登记页面在主内容区呈现，固定工具位于其上。各层 Dialog 持有自己的查询、Form、焦点和资源。操作失败在发起位置呈现，完成反馈由发起者负责一次，独立 Toaster 随文档释放。阅读、播放器和游戏面板各自装配宿主，阅读正文与视频不受应用控件 CSS 影响。[窗口程序](../design/architecture.md#renderer) · [分层与草稿](../design/ui/state.md#layers)

<a id="styles"></a>

## 样式与部件一起维护

应用的常规布局与状态用 TSX `class` 中的 Tailwind 工具类。工具带、表单行、空态等重复界面通过真实部件复用。由运行值决定的字体、主题与虚拟行几何通过 CSS 变量或 `style` 传入。平台拖动区域、专属复杂选择器、原生伪元素与专用渲染适配就近放在其拥有者文件中。

公共组件用 CSS Modules 和 `theme, base, components, utilities` 的层顺序，构建产物是可独立导入的普通 CSS。应用的 `styles/base.css` 维护文档根与共同基础，`styles/tailwind.css` 接入映射，每类窗口在自己的样式入口声明本窗口及实际消费的共享源码。按公开部件和 class 定制。删除影响所有 button、input、h2、footer 的业务选择器。字体、表单尺寸与焦点关系在公共样板和正式窗口分别核对。[窗口样式](../design/engineering/layout.md#renderer-styles) · [Tailwind 源码检测](https://tailwindcss.com/docs/detecting-classes-in-source-files)

<a id="source-style"></a>

## 编码风格、逻辑分段与注释

**把一次交互写到可以顺着读完。** 编写时按职责成段，交付前从发起动作的部件顺读到状态更新、结果呈现和清理。公共组件与应用调用分处两个模块时，沿一次实际操作核对两侧的分段。工具、测试、配置和设计示例按相同原则组织。[全仓分段规则](../design/engineering/conventions.md#logical-sections) · [TSX 规范](../design/engineering/conventions.md#tsx-style)

| 阅读位置 | 统一写法 |
| --- | --- |
| 文件与导入 | 手写源码先给文件概述，空一行后进入导入区，导入与正文之间再空一行。同一依赖的类型和值就近声明，副作用导入保持执行顺序。TSX 写呈现，纯合同、查询与转换用 TS |
| 声明与命名 | 独立类型、函数、类、组件及职责不同的模块常量之间留一行。同一规则的短声明和重载成组。模块按产品对象或技术能力命名，普通 TS/TSX 文件使用 kebab-case，组件和类型 PascalCase，函数及变量 camelCase |
| Props、字段和局部状态 | 按身份与值、显示与可访问性、动作或资源关系分组。相关字段相邻。`const` 是默认绑定，重新赋值才用 `let`。活跃 props 在响应式范围内读取，真实初始化与提交快照在相应边界取得 |
| Solid 操作与副作用 | 状态、派生与修改它的动作按任务靠在一起。订阅、开始观察、取得资源与同一 owner 的 `onCleanup` 就近阅读。纯派生用 accessor 或 memo，effect 用于把状态交付给 DOM、窗口或其他外部资源 |
| 正常、失败与清理 | 前置判断、固定提交、等待、采用结果分别成段。一个 try/catch/finally 保持完整。在异步边界前登记需要的清理，操作失败按所属合同交付，后来的输入和已完成的独立结果保留 |
| TSX 的呈现与事件 | 逻辑与 return 之间留一行。返回的 JSX 按可见区域和组件边界组织。简单赋值与转交就近内联，跨步骤或要处理失败与焦点的动作提出具名函数。只有条件确实生成不同内容时使用 Show、For、Switch 等结构 |
| 测试与 CSS | 测试将准备、动作、断言成段，共同证明同一结果的断言相邻。CSS 按部件、变体、状态与环境条件排列。同一规则的属性相邻。人工复核用一次真实交互贯通源码与验收 |

**强制声明文档覆盖所有模块顶层具名定义。** 顶层 `const`、私有函数、工厂创建的 schema 与资源实例同样覆盖。一个解构声明共同表达一项职责时共享说明。顶层执行语句、导入和重导出按其流程或原定义阅读。公开成员、回调和工厂返回接口的非显然调用合同在定义处写一次。函数体内的普通 `const`、signal、handler、嵌套函数和临时对象按需写实现注释，仅解释名字、类型与流程没有传达的重要原因。源码注释使用简洁英文，配置说明关键取值，生成源由生成器维护，Rust `unsafe` 的安全前提照常说明。[注释覆盖](../design/engineering/conventions.md#comment-coverage) · [工程验收](../verification/scenarios/engineering.md#source-quality)

例如字体预览既有局部状态，也有真正值得说明的异步寿命。下面是一份组件文件的写法。文件说明用途，组件说明合同，内部注释紧贴那个会在行消失后才完成的操作。

```tsx
/** @fileoverview Previews a prepared user font in the importing document. */

import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { FontChoice } from '../../../../../shared/window-api'

/** Displays the selected font and releases its face on replacement or removal. */
export function FontPreview(props: { file: FontChoice; onError: (cause: unknown) => void }) {
  const [family, setFamily] = createSignal<string>()

  createEffect(() => {
    const file = props.file
    const name = 'Kisaki-preview-' + file.id
    const face = new FontFace(name, 'url(' + JSON.stringify(file.url) + ')')
    let active = true

    // A font load can finish after its preview row has been removed.
    onCleanup(() => {
      active = false
      document.fonts.delete(face)
    })

    async function loadFace() {
      const loaded = await face.load()
      if (active) {
        document.fonts.add(loaded)
        setFamily(name)
      }
    }

    setFamily(undefined)
    void loadFace().catch((cause: unknown) => {
      if (active) {
        props.onError(cause)
      }
    })
  })

  const firstFace = () => props.file.metadata.faces[0]

  return (
    <span style={{ 'font-family': family() }}>
      {firstFace().fullName ?? firstFace().family} · Aa 0123 あ 字
    </span>
  )
}
```

<a id="delivery"></a>

## 统一实施与完成条件

变更按规则的拥有者推进。每项共用规则都要迁移它的全部实际消费者，并清理被接替的实现。下列顺序是构建依赖。同一条规则以全部受影响的正式入口履行同一份合同为完成条件。

1. **W01 与 W05。** W01 维持视觉词表和根字号。W05 参考旧 UI 库的外观与组合，在当前公共包落实密度、Form、Field、类型化选择、Dialog 几何与反馈合同。同步所有家族入口、声明、普通 CSS、无 Tailwind 与 Tailwind 消费者、独立样板和相应宿主验证。图表、Markdown、拖拽和虚拟列表保留专用库与自身清理，在同一套工具带、焦点和密度下组合。
2. **W07 窗口与全部管理场景。** 一并迁移四个文档的呈现接入、主窗口框架、任务、偏好、主题、字体、系统集成及关于。删除 WindowSelect、应用内通用提交与验证辅助、EditorBody/Footer 挂载槽、浏览器业务确认和失去用途的窗口样式。同步正式入口、快捷键、原生导航、构建扫描和测试定位。
3. **W08 与后续消费。** W07 以现有业务验收共用框架，W08 以有选中条目和滚动位置的资料库、展示柜与统计页验证接续。阅读、播放、游戏、扩展 Webview 和官方译本随所属工作包验证业务差异。W23 维护实际项目说明，W24 在固定候选上复核跨功能体验。

| 正式验收路径 | 必须能观察的结果 |
| --- | --- |
| 任务中心 → 筛选 → 详情 → 返回 | 选择、筛选、列表位置和焦点保留。中断任务的详情保留上一次确认写入的结果。工具带、表头与 Footer 稳定，空、加载、失败和实际内容可辨。多行与窄表仍能读全字段，清理历史只影响确认的已结束记录 |
| 偏好 → 作品使用、主题或字体 → 返回 | 作品子表单确定后回填所属分支，取消后回到入口。切换至独立的主题和字体目录时保留偏好草稿。顶部横排页签通过左右键导航，单字段恢复后回焦。主题可以检视亮暗色样，字体样张来自实际文件 |
| 默认窗口和最小窗口 | 两种尺寸均以默认 100% 核对视觉。标题栏分隔线在按钮下方连续，系统命中与窗口操作有效，同档控件对齐，长文案与反馈可读。再用 75%、200% 复验几何与滚动，记录当时的系统显示比例 |
| 明暗、强制配色、减少动效、鼠标与键盘 | 系统与应用外观组合可读。Tab、方向键、Enter、Escape、输入法组合和辅助技术命名在正确作用域工作，错误定位先切换分组再聚焦，关闭内层只返回一层 |

`AGENTS.md` 指向 UI 设计参考、技术取舍与编码风格。工程规范定义分段和注释，UI 规范定义公共部件，视图状态与工程布局定义拥有者和目录，工作包定义交付边界，验收场景描述操作及结果。运行观察留在证据中，当前工程与状态只记录实际实现。公共 Form 与控件尺度见 [W05 复验](../verification/evidence/w05/README.md#rewrite)，主窗口场景与当前平台范围见 [Dialog 实机对照](../verification/evidence/w07/README.md#shared-dialogs)。[公共 UI 规范](../design/ui/package.md) · [W05 与 W07](work-packages.md#w05) · [界面验收](../verification/scenarios/ui.md#baseline) · [实施状态](status.md)
