# 公共 UI 包

`@kisaki3/desktop-ui` 为 Solid 2 提供可独立消费的完整控件、图表、Markdown、拖拽与样式。通用控件、浮层、Toast 和虚拟几何由本包基于浏览器原生能力实现。编辑、图表和拖拽使用所属专用工具。视觉协议由 desktop-appearance 提供，业务数据与操作由宿主传入。

按任务阅读：[职责](#ownership) · [公开能力](#families) · [表单](#forms) · [浮层与焦点](#overlays) · [Toast](#toast) · [源码与入口](#organization) · [样式](#styles) · [图标](#icons) · [动效](#motion) · [交付](#delivery)。应用体验见[共同界面](components.md)，工程与制品规则见[公共包](../engineering/workspace.md#visual-packages)。

<a id="ownership"></a>

## 职责与技术基础

| 拥有者             | 负责内容                                                     |
| ------------------ | ------------------------------------------------------------ |
| 浏览器             | 语义元素、表单提交与校验、选择和编辑、顶层呈现及原生事件     |
| desktop-appearance | 视觉词表、纯值规则、默认值、基础 CSS 与 Tailwind 映射        |
| desktop-ui         | 组件 API、交互状态、组合、外观、可访问性接入及自身资源寿命   |
| 应用与扩展         | 业务数据、异步请求、草稿、验证保存、权限、资源取得与页面布局 |

组件 API、Props、交互与外观由本包完整维护。公开入口提供可直接使用的控件及必要组合部件；跨家族的共同机制保持包内实现。普通 Button、Input 可以直接使用，主题由 CSS 变量生效；Field、Dialog 等组合分别建立局部上下文。Toast 按窗口统一装配，业务通过命令式入口调用。

组件按实际交互选择语义元素。按钮、链接、文本、复选和单选保留原生行为。Select、MultiSelect 与可检索的 Combobox 共用选项集合、触发面、滚动视口与表单接入。选中与高亮按完整候选集合维护，使未挂载的选项也能定位和提交。可见列表与键盘导航由组件管理，原生表单控件承担提交和有效性。桌面窗口的普通选择与筛选接入相应公共组件。Dialog 使用原生模态与可取消关闭请求。浮层使用浏览器顶层呈现，定位按[浮层、选项与焦点](#overlays)的具体条件处理。

每个状态有明确拥有者。控件维护临时交互，调用方维护业务值与草稿；受控值和非受控默认值分别遵守其合同。标签、说明、错误、禁用与表单状态在实际组合中保持一致。

专用工具通过公开 API 接入。CodeMirror 与 markdown-it 提供 Markdown 编辑与呈现，@unovis/ts 提供图表，Pragmatic Drag and Drop 提供拖拽；本包适配承担共同外观、Solid 生命周期和自身资源责任。

desktop-ui 通过 props、事件与回调接入行为。异步选项、加载结果和业务动作由调用方提供，资料选择器、部分日期编辑器、媒体卡片、业务确认和设置页归 domain-ui 或具体扩展。

组件创建的监听、观察、计时器、编辑器、图表和 DOM 随实例更新与销毁收尾。宿主传入的资源保持原有所有权，明确转交的句柄按合同释放。主题选择、字体取得与桌面资源由宿主完成。

依据：[HTML 表单](https://html.spec.whatwg.org/multipage/forms.html)、[Dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)、[Popover](https://html.spec.whatwg.org/multipage/popover.html)、[WAI 交互模式](https://www.w3.org/WAI/ARIA/apg/patterns/)及[Solid 生命周期](https://docs.solidjs.com/concepts/effects)。固定 Electron 环境的原生能力记录见[接入依据](../../verification/evidence/native-ui/README.md)。

<a id="families"></a>

## 公开能力与组合

| 范围       | 公开职责                                                              |
| ---------- | --------------------------------------------------------------------- |
| 基础呈现   | 按钮、链接、MDI 图标、徽标、分隔、加载、进度、警示、图片与空状态      |
| 表单与控件 | Form、固定反馈、Field 与字段组、文本、搜索及快捷键输入、复选、开关、单选组、选择器、Combobox 与 Slider |
| 内容结构   | Tabs、分段选择、Toolbar、List 及重排、折叠、表格与滚动区域 |
| 浮层与反馈 | Dialog、确认对话框、Popover、下拉菜单、上下文菜单、Tooltip 与 Toast   |
| 图表       | 通用图表呈现、主题、图例、提示及实例更新与销毁                        |
| Markdown   | 源码编辑、安全呈现、工具栏、编辑命令及资源清理                        |
| 拖拽       | Solid 生命周期接入、手柄、插入指示与通用反馈                          |

组件家族围绕同一交互语义或资源寿命组织。例如 Dialog 的触发、内容、标题与关闭动作属于同一家族，Markdown 的编辑、呈现与工具栏共同提供内容能力。下拉菜单与上下文菜单归入 menu 家族，共用菜单项、子菜单和导航规则，分别实现触发方式。具体公开符号和 Props 随完整接口实现明确列出。

| 能力     | 宿主拥有的内容                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 图表     | 查询、聚合、统计口径、单位和业务动作；组件接收数据与呈现配置                                                            |
| Markdown | 正文身份、附件、资源取得、保存、并发与关闭策略；组件通过明确回调接入内容                                                |
| 拖拽     | 对象身份、移动范围、许可、选择集合、数据就绪和持久顺序，见[人工重排](virtualization.md#reorder)                         |
| 虚拟化   | 本包提供 /virtualization，视图拥有真实数量、行映射、数据读取、选择和身份锚点，见[几何边界](virtualization.md#geometry) |

所有组件家族统一使用子路径。基础控件的导入链保持轻量，编辑器与图表按完整能力独立消费，公开入口与内部文件按各自职责组织。

<a id="forms"></a>

### Form、Field 与提交

`@kisaki3/desktop-ui/form` 提供 `Form`、`FormFeedback`、`FieldIssue` 和按实例使用的 `createForm`。普通表单直接写 `<Form onSubmit={save}>`，有业务约束时传入 `validate` 与 `locate`。需由表单外的快捷键或关闭确认等待保存时，编辑器用同一组回调创建一个 `createForm` 实例，并通过 `<Form state={form}>` 接入。替换 `state` 时，原生表单、字段反馈和提交一起切换到新实例。两种入口共享一套提交实现，回调只在实例拥有者处定义一次。Form 渲染真正的 `<form>`，保留元素 ref、表单归属、submitter、Enter 与可取消的 reset。

`Form` 设置 `novalidate`，在原生 submit 中取消默认导航。提交先读取适用控件的 `validity`，按稳定字段身份与业务校验合并，按照表单阅读顺序交付问题。未挂载分组的约束由拥有完整草稿的业务校验提供。同一字段同时违反原生与业务约束时，采用业务给出的具体纠错说明，该字段只计一次。首次提交前，表单不主动显示字段校验错误。提交失败后，用户输入、宿主回写、原生约束以及表单成员或归属变化都会更新相应反馈。只有提交或用户点击定位才移动焦点。定位回调先展开所属分组，再聚焦真实控件。Field 按控件的原生表单归属关联字段错误；通过 HTML 的 `form` 属性从外部接入或更换归属时，控件与错误说明一起更新。FormFeedback 呈现整表反馈。被取消的原生 reset 保持当前状态。草稿拥有者用保存值执行放弃，用产品默认值恢复选定字段。

实例的 `submit()` 返回本次操作的 Promise。按钮、快捷键与关闭前保存进入同一个提交流程，校验未通过时返回 `false`，业务提交成功返回 `true`，业务失败按原错误拒绝。在途请求固定首次接纳的动作，重复请求等待同一结果。多动作表单通过原生 submitter 区分提交按钮，快捷键与关闭前保存使用常规保存。`busy` 表示正在提交，编辑器仍可接收新输入。FormFeedback 在 Form 内从本实例取得结果与当前字段，汇总文案和操作错误由发起者提供。独立消费反馈区时仍可显式传入 issues、activeFieldId、summary 和 onLocate。草稿、脏状态、提交快照、并发基线、资源与部分成功结果归业务拥有者。独立消费者的原生 HTML 表单也能直接使用各公共控件。

`@kisaki3/desktop-ui/field` 提供 Field、FieldGroup、FieldLegend、FieldHeader、FieldLabel、FieldAction、FieldDescription、FieldError 和 FieldContent。Field 默认纵排。`orientation="responsive"` 将左侧标题与说明、右侧 FieldContent 组成同一行，以 FieldGroup 的实际宽度作容器查询，小于 28rem 时按标题、说明、控件排成一列。FieldHeader 将标题与紧邻的具名操作排在一起。FieldContent 容纳值控件和同字段的管理动作。FieldAction 默认显示 outline 图标按钮，和所在区域的控件同高。标题旁的小动作可明确指定更小尺寸。主控件通过 `aria-labelledby` 取得名称，`aria-describedby` 关联说明和自身错误。静态标题和留白供阅读与选字，Checkbox、Radio 和 Switch 的选项文字与图形共同接受点选。FieldGroup 用 fieldset 与 legend 命名相关字段。FieldLegend 使用小号、中等字重和 `--muted-foreground`，沿用与普通内容分节一致的文字层次。

紧随字段标题或 FieldHeader 的 FieldDescription 与标题相隔 0.125rem，控件与说明按字段原有间距排列。控件保留 name、表单归属、默认值、必填、禁用、有效性与原生提交事件。form.reset 恢复默认状态并正确接续 Solid 值，取消 reset 保持现状；fieldset 禁用、失效选项和外部值更新各按实际输入状态处理。可见值、提交值与校验结果保持一致。

表单反馈区提供稳定的呈现空间、错误摘要、当前字段原因和明确的定位动作。调用方拥有校验结果、字段身份、提交与保存流程，并负责展开页签或分组后定位字段；组件通过传入的状态和回调协作。字段错误文本可以在不占布局空间的位置保持可访问关联，集中反馈不要求在字段下方插入错误段。

编辑 Dialog 在 Header 下放置一个 Form，Form 将同级 DialogBody 和 DialogFooter 排列为可收缩的纵列。Body 得到剩余空间，Footer 固定在正文外，提交按钮自然属于该表单。布局确实分离的外部按钮按 HTML 的 `form` 属性关联同一实例。Footer 左侧的 FormFeedback 保留稳定空间，右侧操作保持位置。有错误的字段获得焦点时，反馈显示该字段的纠错短句。焦点位于有效字段或没有具体错误项时，`summary(count)` 显示错误总数。点击短句定位该字段，点击汇总定位第一处错误。悬停或聚焦可读补充说明或被截断的全文，Escape 关闭。

Input 家族提供普通文本、SearchInput、数字步进、完整日期与颜色输入。SearchInput 在同一外框内放置放大镜、原生编辑区和清除按钮，清除后焦点回到输入区。NumberInput 的 positive 用于只接受正数的字段。自由小数输入仍可手填，减少一步会跨过零时停用该按钮。unit 是固定后缀，原生数值、有效性和表单编码按数字字段处理。Textarea 通过 rows 设定高度，文字在框内滚动。数字步进和日历按钮在输入框末端，颜色样本在起始端。编辑区与操作列共用外框，一条常规边线接到外框的上下内缘。数字箭头与日历图标悬停时只增强图标颜色。颜色样本直接显示当前值和透明度棋盘底，打开后在二维色域及色相、饱和度、亮度、透明度通道中编辑。字段专用文案由调用方提供。复合输入的 class 和 style 定制整框，ref、id 和编辑事件属于原生输入元素。

DateInput 使用原生日期输入分段编辑年月日，支持粘贴完整 ISO 日期。编辑片段由浏览器维护，未完成时由原生有效性阻止表单提交。日历按调用方语言呈现公历。前后月按钮使用方向箭头，年份和月份使用纯文字按钮，共用 ghost 悬停外观。选择年月只改变浏览位置，选日后写回字段、收起日历，焦点返回日期编辑器。部分日期的业务语义见[日期值](../domains/values.md#date-operations)。

ShortcutInput 在单行内以标签显示各组已绑定快捷键。标签使用与多选相同的横向视口、溢出提示和单项移除。末端的键盘按钮打开锚定浮层。浮层实时显示按键，组合键全部释放后可以确定。「重置」清除候选并回到录入区。「取消」、Escape 和外点关闭丢弃候选。确定后交付包含新增组合的列表并返回末端按钮。移除标签后聚焦相邻标签的移除动作，移除最后一项时返回末端按钮。调用方提供按键识别、平台键名和文案，绑定的采用与冲突按[快捷键合同](navigation.md#shortcuts)处理。

日历标题栏与星期行相距 0.25rem。正方形日期格共用七列，横纵间隙均为 0.125rem。今日在数字下方标记直径 0.1875rem 的圆点，圆点居中且距格底 0.375rem。选中今天时圆点使用选中前景色，键盘焦点环沿格子内缘描出。

`SelectOption<K extends string = string>`、`SelectProps<K>`、`MultiSelectProps<K>` 共用选项键类型。单选的值、默认值与变更回调使用 `K | ''`，空字符串表示无选择。多选使用有序的 `readonly K[]`，空数组表示无选择。接受 reset 时恢复声明的默认值，无默认值时恢复空选择。候选目录暂缺一个已保存的键时，保留其身份并显示不可用状态。Combobox 按选项记录类型传递值，单选空值为 `null`，多选为有序记录数组。调用者可让记录携带自己的领域引用。`options`、呈现、虚拟列表与回调沿同一类型传递，稳定键单独用于 DOM 定位与表单编码。

应用和扩展从控件子路径直接使用 Select、MultiSelect、Combobox。所属文档用自己的翻译接口向 `emptyMessage`、`invalidSelectionMessage` 等传入当前语言的文案。表单使用 Field 关联名称与错误，无可见标题的筛选器显式提供可访问名称。组件库只接收显示值与回调。

选择器接收稳定 value、标签、分组、禁用状态与呈现内容。整框触发器显示当前选择，再次点击收起列表。class 和 style 定制整框，ref、id 和触发事件属于真实按钮。字段标题通过 `aria-labelledby` 关联按钮，点击选项交付该次选择。Select 与 MultiSelect 使用向下单箭头，Combobox 的单选和多选使用上下双箭头，悬停与展开时增强图标前景色。菜单与选项共用行度量和末端标记槽。MenuItem 和子菜单触发器的 `icon` 在前导槽使用统一图标尺寸，可访问名称来自菜单文字。

Combobox 打开后保留触发按钮的焦点。方向键移动候选高亮，Enter 选择。需要搜索时点击或按 Tab 进入浮层内具名的 SearchInput，焦点描边随当前元素移动。默认按标签忽略大小写筛选，调用方可提供 filter 函数，或用 filter={false} 按 query 和 onQueryChange 提供异步候选。加载、无结果和已选值分别表达。单选值为选项记录或 null，multiple 模式使用有序的选项记录数组。字段显示、表单提交和有效性使用已选记录，候选的禁用状态决定该项当前能否选取。已选资料更名或失效时，宿主更新对应记录。输入法组合期间保留原生编辑。单选提交后收起，多选切换当前项并保留正在使用的查询。完成退场后清空本次查询，中途重开可继续输入。

长名单使用 `virtual` 挂载可见分组和选项，键盘移动会把高亮候选带入视口。自定义布局仍可使用 `renderOptions` 和 `scrollToValue`。`listRef` 指向承担双向滚动的真实 listbox。虚拟几何依赖 renderOptions 的 present，从入场保持到退场完成。open 表示当前能否操作。

多选在字段内以小号文字和弱底色的单行标签呈现已选值。快捷键沿用相同的标签尺度。每项有具名移除按钮，列表中也可逐项切换。标签溢出时可横向滚动，滚动箭头只在对应方向仍有内容时覆盖视口边缘。指针位于可编辑的溢出标签区时，滚轮动作留在字段内，到达端点即停住。标签放得下时由外层正常滚动，缩放手势按系统行为处理。打开列表、移除标签与滚动各有独立焦点目标，移除按钮悬停时只增强叉号颜色。

本体与官方 Solid 扩展按[固定反馈区规则](components.md#validation)直接组合 Form、Field 和公共控件。宿主维护自己的持久化与资源权限。Webview 的原生提交事件与导航隔离由[容器合同](../extensions/webview.md#isolation)保证。

文本编辑保留输入法组合、选择、撤销和原生事件。提交、搜索和快捷键在明确的用户动作中执行；输入法组合期间保持编辑语义。异步选项与当前选择分别表达，调用方根据真实请求管理加载和失败。

原生表单、受控更新和组合关系通过实际浏览器核对。特殊控件需要自维护交互时，公开合同明确其键盘、焦点、可访问名称与表单结果。

受控控件只在宿主采纳时显示新值。具备本地模式的控件移除受控值后恢复此前的本地值，尚无本地修改时恢复初始默认值。

ColorInput 与主题使用相同的独立 CSS 颜色语法。文字编辑保留原表达，色样绘制校验后的 CSS 值。颜色名称、函数名和十六进制中的合法转义按其实际字符检查，无效颜色没有色样。调节拾色器通道时生成 sRGB 十六进制颜色。

Toolbar 和 ToolbarRow 排列查询条件与动作，提供对齐和换行。带 `band` 的 Toolbar 在正文前固定排列范围和查询行，并绘制共用底色和单一底边。横排、竖排 TabList 共用页签组底色和选中样式，页签文字使用 `--text-xs`。横排溢出时可横向滚动，并处理能继续移动的纵向滚轮输入。竖排沿起始边排列并随内容增高，受限高度由外层滚动容器负责。键盘焦点由 Tabs 管理，滚动容器让当前项完整进入视野。强制配色下，已选页签、分段和日历日期使用配对的系统选择色。

`/list` 提供原生有序或无序 List。ListItem 统一对象图标、标题、补充内容、持续可见的附属信息与同行动作。行内动作在指针进入或键盘聚焦时显示，触屏可直接看到。ListItemAction 提供具名图标按钮与 Tooltip。ReorderableList 和 ReorderableListItem 沿用同一行结构，加入手柄、插入线、菜单与键盘操作。需要拖拽边缘滚动时，宿主通过 viewport 提供实际滚动的列表元素或外层容器；普通列表省略该参数。列表以当前稳定身份为准，受控地提交一批 ID 相对同范围目标的前后移动意图。宿主采纳后提供新的顺序，失败时在所属视图反馈。显示范围、不可用项槽位和保存时机遵循[共同重排规则](virtualization.md#reorder)。

ListItem 的标题行容纳标准 Badge。显示或撤下同一行的徽标时，标题与说明的垂直位置保持一致。窄宽下标题与徽标沿自然内容换行。

Collapsible 以原生 details 和 summary 呈现。defaultOpen 设置初始状态；传入 open 时，点击标题或用键盘激活标题会通过 onOpenChange 请求切换，宿主采纳后才改变展开状态。同名分组至多展开一项；宿主保留原值时，该组保持原来的展开项。标题内的链接和按钮保留自身操作。[HTML 折叠与分组](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element)

依据：[HTML 表单控件](https://html.spec.whatwg.org/multipage/form-elements.html)、[表单处理](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html)、[WAI 表单分组](https://www.w3.org/WAI/tutorials/forms/grouping/)与[错误反馈](https://www.w3.org/WAI/tutorials/forms/notifications/)。

<a id="table"></a>

### 表格与滚动

普通 Table 保留文档的原生表格布局，TableHeader 可随文档滚动保持粘性。有独立滚动区域的表格使用 ScrollableTable。表头和数据行共用列定义和同一个原生滚动视口，表头纵向保持粘性，两者随水平滚动对齐。视口接受 class、style 和键盘操作，调用方用 viewportRef 取得视口、用 headerRef 取得粘性表头。虚拟化时传入 stickyHeader，按与滚动偏移相同的布局像素扣除表头高度。TableSpacer 保留完整轨道高度，数据行用 createVirtualRow 定位。调用方管理区间数据和行身份。[虚拟化](virtualization.md#geometry)

<a id="overlays"></a>

### 浮层、选项与焦点

`DialogContent` 提供 `size` 和 `fill`。宽度 `sm/md/lg/xl/2xl` 分别为 24/32/42/56/72rem，默认 md。所属文档交付可用区域，主窗口采用标题栏以下的区域，其他文档采用本视图区域。四边留 1rem，宽度受剩余宽度约束，高度上限取剩余高度和 48rem 的较小值。普通 Dialog 随内容增高，`fill` 工具窗取得该高度。正文与工具带、动作带共用同一底面，标题和底部操作带采用与 Toolbar 一致的弱底色。几何约束施加在实际顶层 dialog 上。DialogBody 默认纵向滚动。固定工具栏或分栏面板自行拥有视口时，Body 只分配空间。

Dialog 接续原生 showModal、requestClose、cancel 与 close 行为，保持 open 状态、模态范围和焦点一致。用户关闭意图可以被调用方阻止，异步保存与未保存确认由[视图宿主](components.md#closing)协调。嵌套 Dialog 分别拥有内容与寿命，关闭后按实际仍有效的触发位置返回焦点。

Dialog 的内容在打开请求时挂载。内容可通过 `deferDialogUntil` 注册初始数据、图形或字体的就绪条件。每个条件以数据或可呈现的失败结束，条件全部满足后进入原生顶层。已显示的 Dialog 继续接收正常内容更新。退出期间保留最后呈现的内容及其资源，退场结束后释放。

菜单、Popover、Tooltip 和 Combobox 复用浏览器顶层接入，具体家族拥有自己的开关、选择和键盘语义。Popover 使用浏览器的锚定布局，横排与竖排共用物理首选侧和翻转行为，已打开时可以随书写方向重新布局。指针坐标、匹配触发宽度和精确可用尺寸采用 Floating UI。子菜单按实际翻转后的方向处理指针移入。触发节点替换时释放旧节点的绑定并以新节点定位，关闭时需要回焦的操作返回有效触发点。[CSS 锚定布局](https://drafts.csswg.org/css-anchor-position-1/#position-area)

菜单移动实际焦点。选择列表通过当前获得焦点的触发器或搜索框关联候选高亮。已选值、查询和当前高亮分别维护。Escape 一次关闭当前层并返回对应触发点，外点关闭尊重新点击的目标。接受关闭时结束交互，原面板保留至退场结束。退场中重开时从当前画面接续。

受控 Popover 由调用方采纳关闭请求后退出顶层，展示与触发器的展开状态读取同一份值。外点请求需要同一次指针操作的按下和释放都在触发器与面板之外。闭合由 Escape 发起时回到触发位置，由外点发起时保留新目标。面板使用原生手动顶层和平台关闭观察器，监听随本次打开结束。[顶层与原生外点关闭](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute) · [平台关闭观察器](https://html.spec.whatwg.org/multipage/interaction.html#the-closewatcher-interface)

普通提示和字段反馈详情首次悬停时默认等待 400ms，Tooltip 的 `delayMs` 可调整这段等待。键盘聚焦立即显示提示。移出触发点后，指针有 120ms 移入提示正文。连续移到其他触发点，或在自然关闭后的 300ms 内移入下一项时，立即显示新的提示。按 Escape 关闭后，指针和焦点均离开原触发点即可再次触发。

浮层与 Toast 在所属文档和实际模态范围内呈现；原生 top layer 与模态外的 inert 状态由浏览器决定，定位或层叠不能扩大交互范围。Webview 内的 Dialog 只约束自己的文档，宿主容器遵守[扩展视图合同](../extensions/webview.md#container)。

依据：[HTML 模态范围](https://html.spec.whatwg.org/multipage/interaction.html#modal-dialogs-and-inert-subtrees)、[WAI 菜单](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)、[Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)与[Tooltip](components.md#tooltip)。原生模态与提示交互见[接入验证](../../verification/evidence/desktop-ui/README.md#modal)。

<a id="toast"></a>

### Toast 实例与消息寿命

每个窗口或独立文档装配一个 Toaster，拥有统一消息队列、右下角展示区域、计时和清理。组件与 UI 函数直接调用 toast.show，消息默认独立于调用组件和 Dialog 的寿命。显示宿主结束时清理队列和所有计时器。

show 返回 update 与 dismiss 句柄；update 替换存活提示，dismiss 结束提示。用户关闭、计时结束或宿主释放后，旧句柄更新不重新创建消息。普通消息可在发起视图关闭后继续呈现；仅与临时对象有关的提示和动作，由实际操作负责人在失效时显式撤下。

原生 Dialog 打开与嵌套时，同一展示区域由库移入当前模态的可交互范围，关闭时返回仍存活的外层范围。队列、剩余展示时间与消息身份保持；调用方不为各 Dialog 安装区域，也不选择位置。视觉位置始终是所属文档视口的右下角。

消息 type 包含 loading、info、success、warning 和 error。loading 表达实际操作仍在进行，呈现忙碌标识与说明，由发起者取得结果后更新同一条消息。状态与持续方式按下表组合：

| 状态与动作 | 持续方式 |
| ---------- | -------- |
| 当前为 loading | 不启动自动关闭计时，无须额外设置 persistent |
| 从 loading 更新为普通结果 | 从转换时开始计算该结果的展示时间 |
| 创建时明确设置 persistent | 跨消息更新持续保留，包括从 loading 转为结果，直到明确关闭或展示宿主结束 |
| 用户关闭 loading 提示 | 只结束呈现，操作继续按自身合同执行；后续 update 不重新弹出 |

有合适的按钮、表单忙碌状态或任务进度时，使用所属位置提供反馈；loading Toast 用于确实需要独立等待提示的操作。结果由业务解释为成功、部分完成、失败或取消，取消后可直接 dismiss。需要取消动作时，由业务显式接入该操作；Toast 的关闭与显示宿主清理不代替业务取消。

本地消息可以提供明确的动作回调，业务拥有者绑定原操作目标并在目标失效时撤下动作。业务结果、取消和部分完成由发起者解释，再选择文案、类型与持续方式。保存成功后可关闭 Dialog 并保留成功消息；反馈责任遵守[唯一负责人规则](components.md#notifications)。

普通结果提示的展示时间包含自然退场，悬停或键盘聚焦可暂停计时并恢复完整显示。更新结果后重新计时，主动关闭立即结束动作和句柄。右下角卡片采用正文字号，状态图标对齐首行，可选动作位于正文下方，关闭按钮靠右上角。新卡从队尾接入，已有卡片按实测高度让位，关闭后平滑补位。连续追加、移除或更新时从卡片当前屏幕位置接续。长队列使用真实滚动范围，短队列留出阴影的绘制空间。显示和更新保留当前焦点，播报随消息内容变化。

SDK 的 [ui.toast](../extensions/webview.md#toast) 由宿主适配到共同呈现，传递可序列化消息和句柄操作。本地组件的动作回调留在当前文档，UI 包通过自身 API 接入，不依赖 SDK。字段纠错使用[表单反馈区](components.md#validation)。

依据：[Solid owner 与清理](https://docs.solidjs.com/reference/lifecycle/on-cleanup)、[WAI 状态提示](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)。

### 变体、内容与状态

变体表达视觉用途，尺寸决定单个动作的热区和呈现。Button 等家族的普通、危险、描边、次要、透明和文字表现，以及图标尺寸，沿既有体验核对。交互状态包含 hover、active、focus-visible、disabled 和适用的 invalid／selected／expanded。业务“加载中”或“保存失败”由调用方提供，不在控件内部推断操作结果。

内容、图标、动作名称、描述和错误由调用方传入。只有图标的控件仍须有可访问名称；Tooltip 补充用途或快捷键，不代替名称。导航使用 Link，执行操作使用 Button；视觉相同不改变语义。

浮层与反馈组件提供可组合的标题、内容及动作，交互状态与清理由组件负责。草稿关闭确认、任务通知策略和跨窗口协调属于视图或宿主；业务关闭计划和全局桌面会话由应用拥有。

### 图表

图表使用 @unovis/ts 1.7.1，以 SVG、CSS 变量和子组件组合接入共同外观。公共入口提供 XY 与单图容器、折线、面积、分组柱、堆叠柱、散点、环图、坐标轴、Tooltip 和 Crosshair。业务统计负责查询、聚合、单位、数据选择和结果解释。

容器按 Solid 子组件顺序组合图层，随配置和数据更新，移除子组件或卸载时释放相应的引擎资源。图层、坐标轴与 Crosshair 可以传入各自的 data，缺省时继承容器数据，空数组表示该部件无数据。容器的 class 和 style 应用于实际绘图区，默认相对定位并占满可用宽度。布局回调提供只读几何快照。

主题容器将 desktop-appearance 的 chart-1 至 chart-5 接到图表系列色，并映射字体、边框与阴影；系列配置选择相应颜色。系统强制配色下，坐标与文字采用系统颜色，图例色样与 SVG 数据标记保持对应。交互图例使用语义按钮，选中状态由调用方提供；提示模板的字符串作为文本显示，自定义结构可返回 HTMLElement，chartTooltipContent 生成具名数据行。显隐使用 Unovis 公开状态，Unovis 负责定位，desktop-ui 管理实例寿命。调用方同时提供名称、数据摘要或适用的文本替代。严格 CSP 的宿主在导入图表前按工具公开方式设置 nonce，由宿主统一维护策略。

配置继续消费工具的公开类型。Unovis 1.7.1 的声明路径面向 bundler；本包汇总实际使用的声明，并显式交付仍被引用的类型依赖，保持 NodeNext 的完整声明检查。实例寿命归 Solid 组合，公共类型不承诺与外部引擎实例互换。

依据：[Unovis TypeScript 接入](https://unovis.dev/docs/quick-start/)、[主题变量](https://unovis.dev/docs/guides/theming/)、[CSP](https://unovis.dev/docs/guides/csp/)及[声明依赖处理](https://tsdown.dev/options/dependencies)。

### Markdown

MarkdownEditor 使用 CodeMirror 6 编辑源码，默认在编辑区顶部显示标准格式工具栏。toolbar 接收有序的内置命令与自定义动作列表，也可以接收从标准命令生成列表的函数。commandLabel 按所选内置命令取得本地化名称，纯自定义列表使用动作自身的名称。工具栏名称默认取编辑器的 label，宿主可用 toolbarLabel 指定。宿主限制高度时，工具栏保留在顶部，正文独立滚动。空列表让源码占用整个编辑区。

默认正文直接显示 Markdown 源码。紧凑工具栏采用浅中性底，上下留白为零，相邻命令共边排列。图标共用 1rem 图框，按钮热区与常规控件等高。悬停在 100ms 内增强图标或文字前景色，键盘焦点环画在热区内缘。

自定义动作提供实例内唯一的标识、可访问名称、图标和执行回调，可根据当前编辑状态决定可用性。编辑动作随只读状态禁用，明确支持只读的查看动作仍可执行。Tab 一次进入工具栏，方向键在可用按钮间导航。按钮作用于所属编辑器的选区，格式修改与键盘编辑共用事务与撤销历史，撤销和重做分别按实际历史启用。

宿主拥有正文、受控值更新、资源选择、保存、草稿与布局。MarkdownPreview 可独立呈现正文，预览与放大编辑区域由宿主组合。呈现使用 markdown-it 15.0.3，任务列表与脚注分别使用 `@mdit/plugin-tasklist` 1.1.4 和 `@mdit/plugin-footnote` 1.1.3。

呈现支持 Markdown、表格、任务列表、脚注、自动链接、软换行及标点转换。原始 HTML 按文本显示；任务列表只读，勾选在源码中修改。任务与脚注标识按预览实例隔离，不发生跨实例标签关联。来自内容的图片源必须由宿主映射到已经取得的 URL，未解析时显示替代文本；普通链接可以交给宿主导航，页内脚注保持原生锚点。资源身份、取得、授权和撤销由宿主维护。

编辑器随组件卸载销毁，向调用方交付的实例引用同时失效。编辑事务以宿主最后采纳的文本为准，受控文本同步避开尚未完成的输入法组合；组件自建的 DOM、监听和编辑资源随自身寿命释放，宿主传入的资源不转移所有权。

依据：[CodeMirror 模块与生命周期](https://codemirror.net/docs/guide/)、[Markdown 安全策略](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)、[任务列表选项](https://mdit-plugins.github.io/tasklist.html)及[脚注](https://mdit-plugins.github.io/footnote.html)。

<a id="organization"></a>

## 源码与公开入口

公开子路径以组件家族或完整能力为单位，例如 `/button`、`/dialog`、`/markdown`、`/chart` 和 `/drag`。同一家族的组成部分从同一入口导入；样式使用 `/styles.css`。exports 明确选择可消费的构建结果。

```tsx
import { Button } from '@kisaki3/desktop-ui/button'
import { Dialog, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { MarkdownEditor, MarkdownPreview } from '@kisaki3/desktop-ui/markdown'
import '@kisaki3/desktop-ui/styles.css'
```

src/components 按组件家族或完整能力组织，家族内共同维护实现、状态、样式和专用适配。src/internal 保存跨家族实际复用且不公开的机制，内部按焦点、定位等具体职责命名。只服务一个家族的辅助随所属家族维护，共同机制不反向依赖具体成品组件。

以下结构表达职责与入口位置，文件按实际协作建立：

```text
desktop-ui/
├─ src/
│  ├─ components/
│  │  ├─ spinner/
│  │  │  ├─ index.tsx
│  │  │  └─ styles.module.css
│  │  ├─ form/
│  │  ├─ field/
│  │  ├─ dialog/
│  │  ├─ menu/
│  │  ├─ combobox/
│  │  ├─ popover/
│  │  ├─ tooltip/
│  │  ├─ toast/
│  │  │  ├─ index.ts
│  │  │  ├─ controller.ts
│  │  │  ├─ region.tsx
│  │  │  └─ styles.module.css
│  │  ├─ markdown/
│  │  ├─ chart/
│  │  └─ drag/
│  ├─ internal/
│  └─ styles.css
├─ tools/
└─ tests/
```

共享状态且经常一起阅读、修改的内容集中组织；可以独立使用、依赖或资源寿命不同的职责，在同一家族内分文件协作。Props、变体与专用辅助跟随所属实现，文件数量与层级由实际阅读和修改路径决定。

公开子路径定义消费边界，内部文件承载实现分工。正式构建入口遵守[主题目录与入口规则](../engineering/conventions.md#module-imports)，单一组件直接从实现导出，多模块家族在 index.ts 组合公开接口。构建配置与 exports 将入口映射到 /button 等子路径。components 与 internal 是源码组织目录，分类目录不增加汇总导出；包内协作直接引用实际模块。

公开 Props 表达组件自身行为及适用原生元素能力。活跃 props 按 Solid 的响应式语义读取，使用 omit 和 merge 透传属性；真实资源在明确的挂载、更新与清理边界接入。

依据：[Solid props](https://docs.solidjs.com/concepts/components/props)、[Solid 2 迁移说明](https://github.com/solidjs/solid/blob/main/documentation/solid-2.0/MIGRATION.md)与[Node 子路径](https://nodejs.org/api/packages.html#subpath-exports)。

<a id="styles"></a>

## 组件样式与宿主覆盖

desktop-appearance 拥有正式视觉变量与[根字号计算](../domains/appearance.md#scale)。按钮、按钮式链接、单行输入和选择器以 `size` 显式选择同一套外高、字号和图标尺度，默认采用 `default`。纯图标按钮的 `icon`、`icon-xs`、`icon-sm`、`icon-lg` 取得同档方形热区。输入框的 `htmlSize` 对应原生输入元素的字符宽度属性。

| size | 外高 | 字号 | 主图标 |
| --- | --- | --- | --- |
| xs | 1.25rem | `--text-xs` | 0.75rem |
| sm | 1.5rem | `--text-xs` | 0.875rem |
| default | 1.75rem | `--text-sm` | 1rem |
| lg | 2rem | `--text-base` | 1.25rem |

输入框的端部列按控件内高取宽。任务查询将搜索和两个筛选框设为 `sm`，放大镜、清除按钮和下拉箭头随之缩放。弹出的选项、查询框和日历使用自身的度量。多行文字、可换行选项与滑轨按各自内容和操作面定高。

弹窗标题、说明、提示和表格按各自的阅读用途直接选择通用字号。Tabs 和分段选择共享布局与选中样式，各自在所属部件定义文字尺度。字号和间距随 rem 缩放，细边线以 CSS 像素计。对话框头尾和带 `band` 的 Toolbar 共用当前主题派生的条带底色 `--kui-band-background`。共同度量以对象和实际属性命名，例如 `--kui-control-height` 和 `--kui-small-icon-size`。

家族自己的部件、变体、交互状态和原生伪元素随实现维护。多个家族使用的动作、输入表面、弹出面、列表行和图形槽在 internal 中维护。Field 拥有字段排布和可访问关联，Form 拥有提交交互与反馈。样式采用就近的 CSS Modules，TSX 组织结构和行为。专用图表与编辑器适配随所属家族维护。

<a id="icons"></a>

本体、公共 UI 和官方扩展的系统与功能图标统一使用 Material Design Icons（MDI）。同一操作优先沿用旧 Kisaki 的图形。静态图标从 `@mdi/js` 具名导入路径，由 `@kisaki3/desktop-ui/icon` 的 Icon 呈现。构建按实际使用裁剪图形。[固定版本](../engineering/workspace.md#solid) · [MDI 官方文档](https://pictogrammers.com/docs/library/mdi/getting-started/)

Icon 在 24 × 24 坐标中用 currentColor 填充 MDI 路径，随图标槽位缩放。单行内容居中，多行提示对齐首行。装饰图形对辅助技术隐藏，纯图标操作由控件提供可访问名称，独立传达信息的图标通过 label 提供名称。跨运行端的贡献值遵守[名称与资源合同](../extensions/webview.md#icons)。

带文案的 Checkbox、Switch 与 Radio 共用选项行。同一 `size` 的单行最小高度和字号与 Input 一致，方框、轨道和圆点随图标度量变化，图形与文字相距 0.5rem。文案换行时整行自然增高，图形对准首行。Spinner 在固定槽位内旋转 MDI 的 loading 图标，减少动效时静止。单值 Slider 从最小值到滑块中心按当前值绘制主色填充，剩余轨道使用中性色。输入、键盘步进和重置同步更新，悬停时颜色稳定。

Dialog 使用原生模态约束和透明背景层。Header 与 Footer 使用紧凑留白和分隔线，标题沿用常规控件字号，以字重表达层级。Body 独立滚动。可见弹层共用一层 1px 常规边框。默认主题的输入框、菜单、选择列表、日历、拾色器和 Tooltip 使用 4px 圆角，Dialog 与 Toast 使用 6px 圆角。各自采用所属表面与阴影。普通 Dialog 的 Header 右上角提供具名关闭按钮，带底部取消的编辑器同样提供。Alert Dialog 通过底部文字按钮交付决定，Escape 返回安全选项。标题栏关闭和 Escape 提交同一可阻止的关闭请求。Collapsible 的触发区保留可操作高度，与内容之间只留一处间距。

Tabs 与 SegmentedControl 共用紧凑分段外观和尺寸，分别保留面板导航与单值选择语义。Alert 是常驻提示，使用图标、正文与必要动作表达信息，不承担字段错误的集中反馈。Badge 沿用桌面参考的半透明色底、细边和小号标签。着色变体从主题取得语义色，文字向主题前景色调节以维持小字对比度。

EmptyState 的标题、说明和装饰图标统一使用 `--muted-foreground`。

采用 `--accent` 高亮的候选行、日期格和输入框内动作使用配对的 `--accent-foreground`。内容列表与表格的行在悬停或行内聚焦时使用从 `--muted` 派生的弱底色，保留行内文字与状态的层次。

系统强制配色覆盖全部组件家族。菜单与候选列表的当前操作项、日历、Tabs 与 SegmentedControl 的已选项使用 Highlight 和 HighlightText；选中与当前高亮各自保留对应的标记。焦点使用可见轮廓，选中项的内描焦点环与今日圆点使用选中前景色。进度条以系统颜色保留轨道、实际进度及不定进度图案，拖拽插入位置同样保持可辨。拾色器的色域与颜色样本保留所表示的原色，周围控件跟随系统配色。颜色角色与调整范围见 [CSS 系统颜色](https://www.w3.org/TR/css-color-4/#css-system-colors)和[强制配色规则](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-mode)。

UI 自有滚动区域采用共同的原生滚动条样式。选择列表的视口紧贴面板内缘，承担两个方向的滚动。选项按稳定 value 定位，首末项留白计入真实行高。调用方的虚拟布局以同一视口为原点。

Separator 的水平线与垂直线各绘制一条 1 CSS px 逻辑边框。菜单分组复用水平 Separator 并伸到两侧内缘。相邻区块由一处绘制共享边界。Dialog 与 Toast 的关闭按钮靠角放置，悬停只增强图标，键盘焦点沿热区内缘描出。独立动作使用贴边的 1 CSS px 焦点环。编辑控件通过同一条边框的颜色表达焦点。复合字段的附属动作获得键盘焦点时，在该动作上描边。

选择器箭头、日历按钮、快捷键录入按钮和数字步进器共用按单行控件内高派生的端部列。各图标按列中心对齐，步进器的两个箭头分别在半行内居中。独立编辑区与操作列之间使用通高分隔线。选择器由整框打开，多选和快捷键的标签滚动范围为端部图标留出空间。

CSS Modules 生成的局部类名属于实现细节。公共定制通过组件 Props、视觉变量、各公开部件的 class 及明确记录的状态属性接入。disabled、focus-visible 等采用原生语义；变体、尺寸和复合状态使用对应属性。表单提供校验状态。

字段以 destructive 边框表达错误。输入框与选择器聚焦时改用主题焦点色，字段说明和固定反馈区继续传达错误。日期或颜色浮层打开时整框保持焦点色，键盘焦点进入日历或色相滑杆。Checkbox 和 Switch 的错误边框独立于选中和焦点状态；填色表达选中，焦点环表达键盘位置。

共同外壳的默认几何使用低优先级选择器，控件按内容安排编辑区、端部操作列和列表宽度。组件类名与调用方 class 正常组合。普通样式遵循共同层叠顺序：

```css
@layer theme, base, components, utilities;
```

完整样式入口在各层首次出现前声明顺序。appearance 的视觉值与文档基础分别使用 theme 和 base，UI 控件规则放在 components，宿主工具类使用 utilities。普通外观可由后层规则或宿主未分层样式覆盖；不依靠类名排列顺序或普遍使用 !important 争夺优先级。类名局部化不隔离继承与全局规则，文档重置由宿主统一安排。

src/styles.css 声明层叠顺序并接入 appearance 的基础样式。构建提取各家族的 CSS Modules，合并为可独立导入的普通 CSS；依赖、产物和消费检查由[视觉交付](../engineering/workspace.md#visual-packages)定义。应用页面继续使用 Tailwind，扩展页面按自身工程选择样式工具；组件包的构建类名不进入宿主扫描范围。

依据：[CSS Modules](https://github.com/css-modules/css-modules)、[CSS 层叠顺序](https://www.w3.org/TR/css-cascade-5/#layer-order)与[Tailwind 组件层](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes)。

<a id="motion"></a>

## 桌面动效

值、焦点和命中在操作发生时更新。浮层按接管的交互范围分档，入场缓出以便尽早阅读，退场缓入以便让出下一步操作。底色、边框、阴影和内容在定位后的表面一起淡变。采用 Floating UI 的锚定浮层在翻转与约束尺寸后按设备像素对齐。关闭时保留正文、选中标记、行高亮和滚动位置，直至退场完成。

| 交互范围 | 入场 | 退场 | 使用路径 |
| --- | --- | --- | --- |
| 提示 | 60ms | 40ms | Tooltip、字段反馈详情、图表数据提示。连续阅读即时交接，图表跨数据点直接换值和定位。 |
| 普通浮层 | 80ms | 60ms | 菜单及子菜单、选择列表、日历及年月列表、拾色器和 Popover。 |
| 模态框 | 100ms | 80ms | Dialog 与确认框接管当前窗口的焦点。模态框内的普通浮层仍使用普通档。 |

普通按钮的悬停配色随指针进入或离开立即开始，完整过渡均为 100ms。工具栏、默认拖拽手柄、复合字段端部和关闭图标只过渡前景色。按下和松开、菜单与候选行高亮、日期格和表格行高亮、链接下划线即时响应。输入、页签正文、拖动、滑杆和图表十字线直接跟随操作。

焦点强调统一采用 100ms 进入、即时退出。输入和选择控件、Markdown 编辑器外框的边框过渡到强调色，退出时立即恢复当前常规或错误配色；独立焦点环淡入，失焦时立即消失。过渡只改变配色，环的宽度、偏移和控件尺寸保持稳定。减少动效或系统强制配色下，焦点强调直接呈现终态。

展开、选中和错误各有自己的状态条件。选择器把焦点移入所属弹层时，整框的展开强调继续保持，焦点环仍跟随真实键盘目标；最终配色取决于控件当前的状态。

校验结果与错误说明即时更新。没有焦点或展开强调时，错误配色的出现与清除均即时；已有错误的字段仍按上述焦点规则切换配色。

Radio 的选中外圈和固定直径内点以 100ms 一起淡变，Switch 滑块移动和折叠箭头转向同为 100ms。Toast 在 100ms 内从下方 0.375rem 移入，退场同程同长。已有卡片用 100ms 从当前位置让位或补位。图表离散数据更新默认用 140ms 插值，帮助追踪同一标记。

悬停意图、通知读时和等待循环各按自身用途计时。系统要求减少动效时直接呈现终态，加载和进度保留静态表达。微调依据实际行程、需要追踪的信息量和重复频率，用常速核对阅读与连续操作，用慢放核对中断、重开和清晰度。多个入口因同一原因需要调整时，在它们共用的实现中修改。

设计依据见 [Fluent 动效](https://fluent2.microsoft.design/motion/)与 [Carbon 动效](https://carbondesignsystem.com/elements/motion/overview/)。

<a id="delivery"></a>

## 完整交付与验证

[W05](../../implementation/work-packages.md#w05) 完成本页全部组件、交互、样式和独立消费。desktop-appearance 由 W01 完整交付；各本体能力使用这些成品装配自己的业务界面。当前实施结果见[状态页](../../implementation/status.md#progress)。

默认样式组合 desktop-appearance 的基础视觉值和组件 CSS。普通 Solid 2 项目通过公开子路径与样式入口直接消费，宿主可以覆盖视觉变量。包支持满足当前桌面 Chromium 能力基线的浏览器环境；其他浏览器与 SSR 的支持按实际证据声明。

仓库外验证使用构建后的 exports、完整声明和普通 CSS，覆盖无 Tailwind 消费与宿主工具类共同使用、主题变量和层叠覆盖。核对基础控件消费的依赖范围，以及按完整功能延迟加载编辑器和图表的行为。类型、样式、浏览器交互和实际视觉分别验收。

行为验证覆盖公开控件及其关键组合：受控和默认值、提交与重置、必填与禁用、输入法、键盘、焦点、浮层关闭、外部状态变化、异步选项及资源释放。Dialog、Combobox 与 Toast 的交互范围，以及表单反馈的稳定布局和字段关联，按[界面场景](../../verification/scenarios/ui.md#ui-package)核对。共用行为在实现它的组件或模块中验证。专用组件另测自身的风险，用例按实际行为和组件组合组织。
