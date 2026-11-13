# 公共 UI 包

`@kisaki3/desktop-ui` 为 Solid 1.9 提供可独立消费的完整控件、图表、Markdown、拖拽与样式。通用控件、浮层和 Toast 自行实现，采用浏览器原生能力；编辑、图表、拖拽和虚拟几何使用所属专用工具。视觉协议由 desktop-appearance 提供，业务数据与操作由宿主传入。

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

组件按实际交互选择语义元素。按钮、链接、文本、复选和单选保留原生行为。Select、MultiSelect 与可检索的 Combobox 共用选项集合、触发面、滚动视口与表单接入。Dialog 使用原生模态与可取消关闭请求。Popover 承担顶层呈现，Floating UI DOM 负责锚定、翻转、尺寸约束和位置更新。

每个状态有明确拥有者。控件维护临时交互，调用方维护业务值与草稿；受控值和非受控默认值分别遵守其合同。标签、说明、错误、禁用与表单状态在实际组合中保持一致。

专用工具通过公开 API 接入。CodeMirror 与 markdown-it 提供 Markdown 编辑与呈现，Unovis 提供图表，Pragmatic Drag and Drop 与 TanStack Virtual 分别提供拖拽和虚拟几何；本包适配承担共同外观、Solid 生命周期和自身资源责任。

desktop-ui 通过 props、事件与回调接入行为。异步选项、加载结果和业务动作由调用方提供，资料选择器、部分日期编辑器、媒体卡片、业务确认和设置页归 domain-ui 或具体扩展。

组件创建的监听、观察、计时器、编辑器、图表和 DOM 随实例更新与销毁收尾。宿主传入的资源保持原有所有权，明确转交的句柄按合同释放。主题选择、字体取得与桌面资源由宿主完成。

依据：[HTML 表单](https://html.spec.whatwg.org/multipage/forms.html)、[Dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)、[Popover](https://html.spec.whatwg.org/multipage/popover.html)、[WAI 交互模式](https://www.w3.org/WAI/ARIA/apg/patterns/)及[Solid 生命周期](https://docs.solidjs.com/concepts/effects)。固定 Electron 环境的原生能力记录见[接入依据](../../verification/evidence/native-ui/README.md)。

<a id="families"></a>

## 公开能力与组合

| 范围       | 公开职责                                                              |
| ---------- | --------------------------------------------------------------------- |
| 基础呈现   | 按钮、链接、徽标、分隔、加载、进度、警示、图片与空状态                |
| 表单控件   | Field、字段组、表单反馈区、单行和多行文本、复选、开关、单选组、选择器、Combobox 与 Slider |
| 内容结构   | Tabs、分段选择、折叠、表格与滚动区域                                  |
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
| 虚拟化   | 视图直接使用 TanStack Virtual，拥有真实数量、行映射、数据读取、选择和身份锚点，见[几何边界](virtualization.md#geometry) |

所有组件家族统一使用子路径。基础控件的导入链保持轻量，编辑器与图表按完整能力独立消费，公开入口与内部文件按各自职责组织。

<a id="forms"></a>

### Field 与表单接入

Field 组织一个控件的静态标题、说明和错误。宿主按[字段说明](components.md#fields)先组合 FieldLabel 和可选的 FieldDescription，再放置控件。主控件通过 aria-labelledby 取得名称，通过 aria-describedby 关联说明和自身的错误。标题、说明与布局留白可供阅读和选字，开合、编辑和提交由实际控件处理。Checkbox、Radio 和 Switch 自带的选项文字与图形共同接受点选。相关控件通过 fieldset 与 legend 分组。

控件保留 name、表单归属、默认值、必填、禁用、有效性与原生提交事件。form.reset 恢复默认状态并正确接续 Solid 值，取消 reset 保持现状；fieldset 禁用、失效选项和外部值更新各按实际输入状态处理。可见值、提交值与校验结果保持一致。

表单反馈区提供稳定的呈现空间、错误摘要、当前字段原因和明确的定位动作。调用方拥有校验结果、字段身份、提交与保存流程，并负责展开页签或分组后定位字段；组件通过传入的状态和回调协作。字段错误文本可以在不占布局空间的位置保持可访问关联，集中反馈不要求在字段下方插入错误段。

常用表单位于 Dialog 中，form 放在 Body，Footer 的提交按钮通过 form 属性关联。反馈区占用 Footer 左侧的剩余宽度，操作区在右侧保持稳定。有错误的字段获得焦点时，反馈区只显示该项的纠错短句，可选的 message 提供该项的补充说明。焦点位于有效字段或没有具体错误项时，由调用方的 summary(count) 单独显示错误总数。点击短句定位该字段，点击汇总定位第一处错误。悬停或聚焦文字可阅读当前项的补充说明或被截断的提示全文，移入可继续阅读，Escape 关闭。

Input 家族分别提供普通文本、数字步进、完整日期与颜色输入。数字步进和日历按钮在输入框末端，颜色样本在起始端。编辑区与操作列共用外框，一条常规边线接到外框的上下内缘。数字箭头与日历图标悬停时只增强图标颜色。颜色样本直接显示当前值和透明度棋盘底，打开后在二维色域及色相、饱和度、亮度、透明度通道中编辑。字段专用文案由调用方提供。复合输入的 class 和 style 定制整框，ref、id 和编辑事件属于原生输入元素。

DateInput 使用原生日期输入分段编辑年月日，支持粘贴完整 ISO 日期。编辑片段由浏览器维护，未完成时由原生有效性阻止表单提交。日历按调用方语言呈现公历。前后月按钮使用方向箭头，年份和月份使用纯文字按钮，共用 ghost 悬停外观。选择年月只改变浏览位置，选日后写回字段、收起日历，焦点返回日期编辑器。部分日期的业务语义见[日期值](../domains/values.md#date-operations)。

日历标题栏与星期行相距 0.25rem。正方形日期格共用七列，横纵间隙均为 0.125rem。今日在数字下方标记直径 0.1875rem 的圆点，圆点居中且距格底 0.375rem。选中今天时圆点使用选中前景色，键盘焦点环沿格子内缘描出。

选择器接收稳定 value、标签、分组、禁用状态与呈现内容。整框触发器显示当前选择，再次点击收起列表。class 和 style 定制整框，ref、id 和触发事件属于真实按钮。Select 与 MultiSelect 使用向下单箭头，Combobox 的单选和多选使用上下双箭头，悬停与展开时增强图标前景色。菜单与选项共用紧凑行和末端标记槽，约 12px 的 Lucide Check 使用该行前景色。

Combobox 打开后聚焦浮层内具名的搜索框。默认按标签忽略大小写筛选，调用方可提供 filter 函数，或用 filter={false} 按 query 和 onQueryChange 提供异步候选。加载、无结果和已选值分别表达。单选值为选项记录或 null，multiple 模式使用有序的选项记录数组。字段显示、表单提交和有效性使用已选记录，候选的禁用状态决定该项当前能否选取。已选资料更名或失效时，宿主更新对应记录。方向键移动高亮，Enter 选择，输入法组合期间保留原生编辑。单选提交后收起，多选切换当前项并保留正在使用的查询。完成退场后清空本次查询，中途重开可继续输入。

列表的 listRef 指向承担双向滚动的真实 listbox。调用方按完整候选集合导航，可通过 TanStack Virtual 提供挂载行和按 key 滚动的能力。虚拟几何依赖 renderOptions 的 present，从入场保持到退场完成。open 表示当前能否操作。

多选在字段内以单行标签呈现已选值。每项有具名移除按钮，列表中也可逐项切换。标签溢出时可横向滚动，滚动箭头只在对应方向仍有内容时覆盖视口边缘。指针位于可编辑的溢出标签区时，滚轮动作留在字段内，到达端点即停住。标签放得下时由外层正常滚动，缩放手势按系统行为处理。打开列表、移除标签与滚动各有独立焦点目标，移除按钮悬停时只增强叉号颜色。

本体与官方扩展按[固定反馈区规则](components.md#validation)组合表单，使用 novalidate 接管交互校验提示，在 submit 中取消默认导航并执行统一校验。原生有效性可以参与校验，反馈时机由表单决定。公共控件保持这些原生能力，独立消费者按自己的流程组合；Webview 的原生提交由[容器合同](../extensions/webview.md#isolation)保证。

文本编辑保留输入法组合、选择、撤销和原生事件。提交、搜索和快捷键在明确的用户动作中执行；输入法组合期间保持编辑语义。异步选项与当前选择分别表达，调用方根据真实请求管理加载和失败。

原生表单、受控更新和组合关系通过实际浏览器核对。特殊控件需要自维护交互时，公开合同明确其键盘、焦点、可访问名称与表单结果。

依据：[HTML 表单控件](https://html.spec.whatwg.org/multipage/form-elements.html)、[表单处理](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html)、[WAI 表单分组](https://www.w3.org/WAI/tutorials/forms/grouping/)与[错误反馈](https://www.w3.org/WAI/tutorials/forms/notifications/)。

<a id="overlays"></a>

### 浮层、选项与焦点

Dialog 接续原生 showModal、requestClose、cancel 与 close 行为，保持 open 状态、模态范围和焦点一致。用户关闭意图可以被调用方阻止，异步保存与未保存确认由[视图宿主](components.md#closing)协调。嵌套 Dialog 分别拥有内容与寿命，关闭后按实际仍有效的触发位置返回焦点。

菜单、Popover、Tooltip 和 Combobox 的弹出部分按需要复用包内的原生弹出接入与定位机制，具体家族拥有自己的开关、选择和键盘语义。共同机制处理实际元素、监听、定位更新与释放，不依赖成品 Popover 的外观或内容结构。

菜单移动实际焦点，只选列表通过触发器关联高亮，可搜索列表将焦点保留在浮层的搜索框。已选值、查询和当前高亮分别维护。Escape 一次关闭当前层并返回对应触发点，外点关闭尊重新点击的目标。接受关闭时结束交互，原面板保留至退场结束。退场中重开时从当前画面接续。

Tooltip 在所属文档内接续阅读。普通提示和字段反馈详情首次悬停默认等待 400ms，Tooltip 的 delayMs 可指定首次等待。键盘聚焦立即触发。离开触发点后有 120ms 宽限移入提示正文。连续移至其他提示，或在自然关闭后的 300ms 内移入下一项时，直接交接内容。Escape 结束本次阅读，当前触发点在指针与焦点都离开后可再次唤起提示。

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

变体表达视觉用途，尺寸表达密度。Button 等家族的普通、危险、描边、次要、透明和文字表现，以及图标尺寸，沿既有体验核对；交互状态包含 hover、active、focus-visible、disabled 和适用的 invalid／selected／expanded。业务“加载中”或“保存失败”由调用方提供，不在控件内部推断操作结果。

内容、图标、动作名称、描述和错误由调用方传入。只有图标的控件仍须有可访问名称；Tooltip 补充用途或快捷键，不代替名称。导航使用 Link，执行操作使用 Button；视觉相同不改变语义。

浮层与反馈组件提供可组合的标题、内容及动作，交互状态与清理由组件负责。草稿关闭确认、任务通知策略和跨窗口协调属于视图或宿主；业务关闭计划和全局桌面会话由应用拥有。

### 图表

图表使用 Unovis 1.7.1 的官方 Solid 适配，以 SVG、CSS 变量和子组件组合接入共同外观。公共入口提供 XY 与单图容器、折线、面积、分组柱、堆叠柱、散点、环图、坐标轴、Tooltip 和 Crosshair。业务统计继续拥有查询、聚合、单位、数据选择和结果解释；图表及其相关实例由 Solid 适配统一创建、更新与销毁，不接收外部手工创建的引擎实例。布局回调需要的几何以只读值提供。

主题容器将 desktop-appearance 的 chart-1 至 chart-5 接到图表系列色，并映射字体、边框与阴影；系列配置选择相应颜色。系统强制配色下，坐标与文字采用系统颜色，图例色样与 SVG 数据标记保持对应。交互图例使用语义按钮，选中状态由调用方提供；提示模板的字符串作为文本显示，自定义结构可返回 HTMLElement，chartTooltipContent 生成具名数据行。显隐使用 Unovis 公开状态，定位与实例寿命由官方 Solid 适配维护。调用方同时提供名称、数据摘要或适用的文本替代。严格 CSP 的宿主在导入图表前按工具公开方式设置 nonce，由宿主统一维护策略。

配置继续消费工具的公开类型。Unovis 1.7.1 的声明路径面向 bundler；本包汇总实际使用的声明，并显式交付仍被引用的类型依赖，保持 NodeNext 的完整声明检查。实例寿命归 Solid 组合，公共类型不承诺与外部引擎实例互换。

依据：[Unovis Solid 接入](https://unovis.dev/docs/intro/)、[主题变量](https://unovis.dev/docs/guides/theming/)、[CSP](https://unovis.dev/docs/guides/csp/)及[声明依赖处理](https://tsdown.dev/options/dependencies)。

### Markdown

MarkdownEditor 使用 CodeMirror 6 编辑源码，默认在编辑区顶部显示标准格式工具栏。toolbar 接收有序的内置命令与自定义动作列表，也可以接收从标准命令生成列表的函数。commandLabel 按所选内置命令取得本地化名称，纯自定义列表使用动作自身的名称。工具栏名称默认取编辑器的 label，宿主可用 toolbarLabel 指定。宿主限制高度时，工具栏保留在顶部，正文独立滚动。空列表让源码占用整个编辑区。

默认正文直接显示 Markdown 源码。紧凑工具栏采用浅中性底，上下留白为零，相邻命令共边排列。图标共用 1rem 图框，按钮热区与常规控件等高。悬停在 100ms 内增强图标或文字前景色，键盘焦点环画在热区内缘。

自定义动作提供实例内唯一的标识、可访问名称、图标和执行回调，可根据当前编辑状态决定可用性。编辑动作随只读状态禁用，明确支持只读的查看动作仍可执行。Tab 一次进入工具栏，方向键在可用按钮间导航。按钮作用于所属编辑器的选区，格式修改与键盘编辑共用事务与撤销历史，撤销和重做分别按实际历史启用。

宿主拥有正文、受控值更新、资源选择、保存、草稿与布局。MarkdownPreview 可独立呈现正文，预览与放大编辑区域由宿主组合。呈现使用 markdown-it 15.0.3，任务列表与脚注分别使用 `@mdit/plugin-tasklist` 1.1.4 和 `@mdit/plugin-footnote` 1.1.3。

呈现支持 Markdown、表格、任务列表、脚注、自动链接、软换行及标点转换。原始 HTML 按文本显示；任务列表只读，勾选在源码中修改。任务与脚注标识按预览实例隔离，不发生跨实例标签关联。来自内容的图片源必须由宿主映射到已经取得的 URL，未解析时显示替代文本；普通链接可以交给宿主导航，页内脚注保持原生锚点。资源身份、取得、授权和撤销由宿主维护。

编辑器随组件卸载销毁，向调用方交付的实例引用同时失效。受控文本同步避开尚未完成的输入法组合；组件自建的 DOM、监听和编辑资源随自身寿命释放，宿主传入的资源不转移所有权。

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
│  │  ├─ button/
│  │  │  ├─ index.ts
│  │  │  ├─ control.tsx
│  │  │  └─ styles.module.css
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

公开子路径定义消费边界，内部文件承载实现分工。正式构建入口遵守[主题目录与入口规则](../engineering/conventions.md#module-imports)，由家族内的 index.ts 选择公开接口，通过构建配置与 exports 映射到 /button 等子路径。components 与 internal 是源码组织目录，分类目录不增加汇总导出；包内协作直接引用实际模块。

公开 Props 表达组件自身行为及适用原生元素能力。活跃 props 按 Solid 的响应式语义读取，使用 splitProps 和 mergeProps 保持更新；真实资源在明确的挂载、更新与清理边界接入。

依据：[Solid props](https://docs.solidjs.com/concepts/components/props)、[splitProps](https://docs.solidjs.com/reference/reactive-utilities/split-props)与[Node 子路径](https://nodejs.org/api/packages.html#subpath-exports)。

<a id="styles"></a>

## 组件样式与宿主覆盖

desktop-appearance 拥有正式视觉变量与[根字号计算](../domains/appearance.md#scale)。desktop-ui 从这些变量派生控件度量。常规控件字号为 0.875rem，最小高度为 1.75rem，图标槽为 1rem。在默认主题和 100% 界面缩放下分别为 12.25、24.5 和 14 个 CSS 像素。组件间距与控件几何随根字号缩放，细边框使用 CSS 像素，可用宽高由容器约束。

家族自己的部件、变体、交互状态和原生伪元素随实现维护。跨家族共用的动作外观、输入框、弹出表面、列表行、图标和选项行由包内 internal 目录按职责维护。Field 的字段结构和 feedback 子目录各自拥有对应样式，公开导出仍由家族入口负责。样式采用 CSS Modules，TSX 负责结构和行为。专用图表与编辑器的适配留在所属家族。

<a id="icons"></a>

系统与功能图标统一使用 Lucide，版本遵守[固定兼容基线](../engineering/workspace.md#solid)。本体、公共 UI 和官方扩展的本地界面通过 lucide-solid 具名组件导入，按实际使用裁剪。公共 UI 的内部适配统一装饰语义、槽位和描边，图形替换保持 Solid 响应性；本地内容和工具栏插槽继续采用正常组件组合。

图形使用 currentColor、圆端点与圆连接，24 单位坐标中的默认线宽为 2，随图形和界面尺寸同比缩放。图标在独立槽位内按块绘制，单行内容居中，多行提示对齐首行。只有图标的操作由控件提供可访问名称，装饰图形不重复播报。跨运行端的贡献值遵守[名称与资源合同](../extensions/webview.md#icons)。依据：[Solid 组件接入](https://lucide.dev/guide/solid/getting-started)、[描边缩放](https://lucide.dev/guide/solid/basics/stroke-width)及[可访问性](https://lucide.dev/guide/solid/advanced/accessibility)。

带文案的 Checkbox、Switch 与 Radio 共用选项行，单行最小高度与 Input 一致，图形与文字相距 0.5rem。文案换行时整行自然增高，图形对准首行。Spinner 在固定槽位内旋转 Lucide LoaderCircle，减少动效时静止。单值 Slider 从最小值到滑块中心按当前值绘制主色填充，剩余轨道使用中性色。输入、键盘步进和重置同步更新，悬停时颜色稳定。

Dialog 使用原生模态约束和透明背景层。Header 与 Footer 使用紧凑留白和分隔线，标题沿用常规控件字号，以字重表达层级。Body 独立滚动。可见弹层共用一层 1px 常规边框。默认主题的输入框、菜单、选择列表、日历、拾色器和 Tooltip 使用 4px 圆角，Dialog 与 Toast 使用 6px 圆角。各自采用所属表面与阴影。普通工具窗、详情窗在 Header 提供具名关闭按钮，已有底部取消的表单和明确选择的确认框使用底部操作。标题栏关闭和 Escape 提交同一可阻止的关闭请求。Collapsible 的触发区保留可操作高度，与内容之间只留一处间距。

Tabs 与 SegmentedControl 共用紧凑分段外观和尺寸，分别保留面板导航与单值选择语义。Alert 是常驻提示，使用图标、正文与必要动作表达信息，不承担字段错误的集中反馈。

系统强制配色覆盖全部组件家族。菜单与候选列表的当前操作项、日历、Tabs 与 SegmentedControl 的已选项使用 Highlight 和 HighlightText；选中与当前高亮各自保留对应的标记。焦点使用可见轮廓，选中项的内描焦点环与今日圆点使用选中前景色。进度条以系统颜色保留轨道、实际进度及不定进度图案，拖拽插入位置同样保持可辨。拾色器的色域与颜色样本保留所表示的原色，周围控件跟随系统配色。颜色角色与调整范围见 [CSS 系统颜色](https://www.w3.org/TR/css-color-4/#css-system-colors)和[强制配色规则](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-mode)。

UI 自有滚动区域采用共同的原生滚动条样式。选择列表的视口紧贴面板内缘，承担两个方向的滚动。选项按稳定 value 定位，首末项留白计入真实行高。调用方的虚拟布局以同一视口为原点。

Separator 的水平线与垂直线各绘制一条 1 CSS px 逻辑边框。菜单分组复用水平 Separator 并伸到两侧内缘。相邻区块由一处绘制共享边界。Dialog 与 Toast 的关闭按钮靠角放置，悬停只增强图标，键盘焦点沿热区内缘描出。独立动作采用 2px 焦点环，复合字段通过整框边线表达焦点。

选择器箭头、日历按钮和数字步进器共用按单行控件内高派生的端部列。各图标按列中心对齐，步进器的两个箭头分别在半行内居中。独立编辑区与操作列之间使用通高分隔线。选择器由整框打开，多选标签的滚动范围为端部图标留出空间。

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

值、焦点和命中在操作发生时更新。浮层按接管的交互范围分档，入场缓出以便尽早阅读，退场缓入以便让出下一步操作。底色、边框、阴影和内容在最终位置整面淡变。锚定浮层先解析翻转与尺寸，再按设备像素对齐落点。关闭时保留正文、选中标记、行高亮和滚动位置，直至退场完成。

| 交互范围 | 入场 | 退场 | 使用路径 |
| --- | --- | --- | --- |
| 提示 | 60ms | 40ms | Tooltip、字段反馈详情、图表数据提示。连续阅读即时交接，图表跨数据点直接换值和定位。 |
| 普通浮层 | 80ms | 60ms | 菜单及子菜单、选择列表、日历及年月列表、拾色器和 Popover。 |
| 模态框 | 100ms | 80ms | Dialog 与确认框接管当前窗口的焦点。模态框内的普通浮层仍使用普通档。 |

普通按钮的悬停配色随指针进入或离开立即开始，完整过渡均为 100ms。工具栏、默认拖拽手柄、复合字段端部和关闭图标只过渡前景色。按下和松开、菜单与候选行高亮、日期格和表格行高亮、链接下划线即时响应。输入、页签正文、拖动、滑杆和图表十字线直接跟随操作。

焦点强调统一采用 100ms 进入、即时退出。输入和选择控件、Markdown 编辑器外框的边框过渡到强调色，退出时立即恢复当前常规或错误配色；独立焦点环淡入，失焦时立即消失。过渡只改变配色，环的宽度、偏移和控件尺寸保持稳定。减少动效或系统强制配色下，焦点强调直接呈现终态。

展开、选中和错误各有自己的状态条件。选择器把焦点移入所属弹层时，整框的展开强调继续保持，焦点环仍跟随真实键盘目标；最终配色按当时仍成立的状态确定。

校验结果与错误说明即时更新。没有焦点或展开强调时，错误配色的出现与清除均即时；已有错误的字段仍按上述焦点规则切换配色。

Radio 的选中外圈和固定直径内点以 100ms 一起淡变，Switch 滑块移动和折叠箭头转向同为 100ms。Toast 在 100ms 内从下方 0.375rem 移入，退场同程同长。已有卡片用 100ms 从当前位置让位或补位。图表离散数据更新默认用 140ms 插值，帮助追踪同一标记。

悬停意图、通知读时和等待循环各按自身用途计时。系统要求减少动效时直接呈现终态，加载和进度保留静态表达。微调依据实际行程、需要追踪的信息量和重复频率，用常速核对阅读与连续操作，用慢放核对中断、重开和清晰度。相同原因适用的入口在共同拥有层调整。

设计依据见 [Fluent 动效](https://fluent2.microsoft.design/motion/)与 [Carbon 动效](https://carbondesignsystem.com/elements/motion/overview/)。

<a id="delivery"></a>

## 完整交付与验证

[W05](../../implementation/work-packages.md#w05) 完成本页全部组件、交互、样式和独立消费。desktop-appearance 由 W01 完整交付；各本体能力使用这些成品装配自己的业务界面。当前实施结果见[状态页](../../implementation/status.md#progress)。

默认样式组合 desktop-appearance 的基础视觉值和组件 CSS。普通 Solid 1.9 项目通过公开子路径与样式入口直接消费，宿主可以覆盖视觉变量。包支持满足当前桌面 Chromium 能力基线的浏览器环境；其他浏览器与 SSR 的支持按实际证据声明。

仓库外验证使用构建后的 exports、完整声明和普通 CSS，覆盖无 Tailwind 消费与宿主工具类共同使用、主题变量和层叠覆盖。核对基础控件消费的依赖范围，以及按完整功能延迟加载编辑器和图表的行为。类型、样式、浏览器交互和实际视觉分别验收。

行为验证覆盖公开控件及其关键组合：受控和默认值、提交与重置、必填与禁用、输入法、键盘、焦点、浮层关闭、外部状态变化、异步选项及资源释放。Dialog、Combobox 与 Toast 的交互范围，以及表单反馈的稳定布局和字段关联，按[界面场景](../../verification/scenarios/ui.md#ui-package)核对。共同机制在拥有层验证，专用能力补充自身风险，测试结构依据行为与实际组合确定。
