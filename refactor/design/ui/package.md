# 公共 UI 包

`@kisaki3/ui` 是本体与扩展共用、可独立消费的 Solid 呈现与交互基础，提供控件、图表、Markdown、拖拽和虚拟几何。公共职责由通用界面需求决定，不依赖桌面应用的实现。工程与样式交付遵守[公共包规则](../engineering/workspace.md#visual-packages)，桌面消费另按[既有体验](components.md#existing-ui)核对。

<a id="ownership"></a>

## 职责与选型

| 拥有者 | 负责内容 |
| --- | --- |
| appearance | 视觉词表、值规则、默认值、CSS 派生值及 Tailwind 映射。 |
| Kobalte | 所覆盖控件的交互、状态、表单、焦点、键盘与可访问性机制。 |
| ui | 共同外观、呈现与交互接入，以及自身创建的编辑器、图表、观察、订阅和 DOM 资源寿命。 |
| 应用与扩展 | 业务数据、资源接入、页面布局、校验保存、异步结果、草稿和权限。 |

Kobalte 已覆盖的控件统一使用其公开子路径原语，包括 Button、Link 和 TextField；选型不以“简单”或“复杂”划界。组件使用适合其职责的语义元素，保留浏览器的表单、选择、撤销和编辑行为。布局、表格、图表与其他未由 Kobalte 提供的能力依据自身职责实现；虚拟几何沿用 [TanStack Virtual](virtualization.md#geometry)，拖拽沿用[既定方案](virtualization.md#dependency)。不为统一依赖而模拟不存在的原语。

封装只承担外观、通用组合或明确的产品交互要求，保持原语的受控／非受控状态、事件顺序、ref、标签关联和生命周期。状态仍由原语或调用方中的一个拥有者维护，不再复制选中项、展开状态或焦点管理。使用 Kobalte 的公开组合能力连接触发器与内容，不嵌套按钮或自造 `asChild` 协议。

控件不获取桌面客户端、SDK、领域对象、字体文件或网络连接。异步选择器通过调用方传入的选项、加载状态和回调工作；资料选择器、部分日期编辑器、媒体卡片、业务确认及设置页归应用的 domain-ui 或具体扩展。

共同视觉值与组件样式由 appearance 和 ui 自身维护。应用通过公开入口消费并传入运行数据；旧应用只提供已确认体验的对照，不成为公共包的源码、构建输入或运行依赖。

界面实例创建的资源随实例更新与销毁收尾。调用方传入的数据和资源保持原有所有权；只有合同明确转交的句柄才由 ui 释放。宿主取得文件、图片或服务资源，ui 通过明确的值和回调使用，不自行建立桌面连接或解释领域身份。

依据：[Kobalte 组合与可访问性职责](https://kobalte.dev/docs/core/overview/introduction/)、[公开子路径与 Button](https://kobalte.dev/docs/core/components/button/)、[原语样式状态](https://kobalte.dev/docs/core/overview/styling/)和[组合方式](https://kobalte.dev/docs/core/overview/polymorphism/)。实际版本由[工程基线](../engineering/workspace.md#solid)固定，交互仍需在真实消费者中验证。

<a id="families"></a>

## 公开能力与组合

| 范围 | 公开职责 |
| --- | --- |
| 基础呈现 | Button、Link、Badge、Separator、Spinner、Progress、Alert、Image、EmptyState。 |
| 表单控件 | Field、TextField、Checkbox、Switch、RadioGroup、Select、Combobox、Slider。 |
| 内容结构 | Tabs、SegmentedControl、Collapsible、Table、ScrollRegion。 |
| 浮层与反馈 | Dialog、AlertDialog、Popover、DropdownMenu、ContextMenu、Tooltip、Toast。 |
| 图表 | 基于成熟图表工具的通用呈现、主题、图例和提示，以及实际图表实例的更新与销毁。 |
| Markdown | 通用内容编辑、安全呈现、工具栏与编辑交互，以及编辑实例和视图资源的清理。 |
| 拖拽 | 基于已选工具的 Solid 生命周期接入、手柄、插入指示和通用交互反馈。 |
| 虚拟化 | 基于 TanStack Virtual 的视口、测量、可见范围、位置和滚动能力。 |

一个家族围绕同一控件语义或共同资源寿命组织，例如 TextField 的输入、标签、描述与错误，以及 Dialog 的触发器、表面和标题。共同前缀表达归属；复合控件开放必要组成部分，由调用方组合内容，不通过大量模式开关形成万能组件。

公开能力与宿主按同一边界分工：

| 能力 | 由应用或扩展拥有的内容 |
| --- | --- |
| 图表 | 统计口径、查询、聚合、单位与业务解释，以及选择数据后的业务动作。ui 接收数据和呈现配置。 |
| Markdown | 正文所属对象、附件身份、资源取得、保存、并发与草稿关闭策略。ui 不识别 `attachment:<id>` 的领域含义，通过宿主提供的呈现与插入接入处理资源。 |
| 拖拽 | 对象身份、移动范围、权限、选择集合、数据就绪与持久顺序。ui 交付交互事实和移动意图，具体保存遵守[人工重排](virtualization.md#reorder)。 |
| 虚拟化 | 真实数量与数据读取、显示行映射、业务选择及真实身份锚点。ui 只处理[显示几何](virtualization.md#geometry)。 |

这些能力采用成熟工具的公开能力，不复制算法，也不建立覆盖所有第三方选项的平行接口。适配承担实际的视觉、组合、Solid 生命周期或资源责任。图表和 Markdown 通过独立公开入口消费，普通控件入口不加载其运行实现；具体文件仍按实际职责安排，不由入口数量决定目录层数。

### 图表

图表使用 Unovis 1.7.1 的官方 Solid 适配，以 SVG、CSS 变量和子组件组合接入共同外观。公共入口提供 XY 与单图容器、折线、面积、分组柱、堆叠柱、散点、环图、坐标轴、Tooltip 和 Crosshair。业务统计继续拥有查询、聚合、单位、数据选择和结果解释；图表及其相关实例由 Solid 适配统一创建、更新与销毁，不接收外部手工创建的引擎实例。布局回调需要的几何以只读值提供。

主题容器映射 appearance 的颜色、字体、边框与阴影。交互图例使用语义按钮，选中状态由调用方提供；提示内容提供文本 DOM 生成能力，数据不插入未经处理的 HTML。调用方同时提供名称、数据摘要或适用的文本替代。严格 CSP 的宿主在导入图表前按工具公开方式设置 nonce，不由 ui 修改宿主策略。

配置继续消费工具的公开类型。Unovis 1.7.1 的声明路径面向 bundler；本包汇总实际使用的声明，并显式交付仍被引用的类型依赖，保持 NodeNext 的完整声明检查。实例寿命归 Solid 组合，公共类型不承诺与外部引擎实例互换。

依据：[Unovis Solid 接入](https://unovis.dev/docs/intro/)、[主题变量](https://unovis.dev/docs/guides/theming/)、[CSP](https://unovis.dev/docs/guides/csp/)及[声明依赖处理](https://tsdown.dev/options/dependencies)。

### Markdown

Markdown 采用 CodeMirror 6 源码编辑和 markdown-it 15.0.3 呈现，任务列表与脚注分别使用 `@mdit/plugin-tasklist` 1.1.4 和 `@mdit/plugin-footnote` 1.1.3。编辑器保留原生选择、撤销、输入法和扩展机制；工具栏与格式命令共用编辑器事务。宿主拥有正文、受控值更新、资源选择、保存、草稿与布局，预览和放大编辑区域通过公共组件组合。

呈现支持 Markdown、表格、任务列表、脚注、自动链接、软换行及标点转换。原始 HTML 按文本显示；任务列表只读，勾选在源码中修改。任务与脚注标识按预览实例隔离，不发生跨实例标签关联。来自内容的图片源必须由宿主映射到已经取得的 URL，未解析时显示替代文本；普通链接可以交给宿主导航，页内脚注保持原生锚点。资源身份、取得、授权和撤销不进入公共 ui。

编辑器随组件卸载销毁，向调用方交付的实例引用同时失效。受控文本同步避开尚未完成的输入法组合；组件自建的 DOM、监听和编辑资源随自身寿命释放，宿主传入的资源不转移所有权。

依据：[CodeMirror 模块与生命周期](https://codemirror.net/docs/guide/)、[Markdown 安全策略](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)、[任务列表选项](https://mdit-plugins.github.io/tasklist.html)及[脚注](https://mdit-plugins.github.io/footnote.html)。

### Field 与文本输入

`Field` 是标签区域、控件区域和说明区域的通用排布，支持垂直、水平及响应式布局。它不拥有输入值、必填状态、校验结果或控件 ID，也不替后代生成第二套可访问性关系。一组相关控件使用语义 `fieldset` 与 `legend`。

`TextField` 是一个文本值的控件家族，由 Kobalte 的 Root、Input／TextArea、Label、Description 和 ErrorMessage 协作。Root 拥有值与表单状态，一个 Root 对应一个输入控件；标签、描述和错误引用这个控件。单行和多行共享文本语义，不因 DOM 元素不同建立另一套值与校验系统。

Checkbox、RadioGroup、Select 等使用各自原语的标签与描述。它们可以采用 Field 的布局，但不借用 TextField 的上下文。通用布局与具体控件的语义保持独立，名称不以 `field` 泛指所有表单逻辑。

文本编辑保留输入法组合、选择和原生事件。显示值更新与提交、搜索等业务动作分开：提交和快捷键不在组合期间触发；调用方需要规范化或延迟查询时，在对应业务边界处理，不由基础控件改写尚未完成的输入。

依据：[Kobalte TextField](https://kobalte.dev/docs/core/components/text-field/)及 [WAI 表单分组](https://www.w3.org/WAI/tutorials/forms/grouping/)。

### 变体、内容与状态

变体表达视觉用途，尺寸表达密度。Button 等家族的普通、危险、描边、次要、透明和文字表现，以及图标尺寸，沿既有体验核对；交互状态包含 hover、active、focus-visible、disabled 和适用的 invalid／selected／expanded。业务“加载中”或“保存失败”由调用方提供，不在控件内部推断操作结果。

内容、图标、动作名称、描述和错误由调用方传入。只有图标的控件仍须有可访问名称；Tooltip 补充用途或快捷键，不代替名称。导航使用 Link，执行操作使用 Button；视觉相同不改变语义。

浮层与反馈组件提供可组合的标题、内容及动作，状态与清理由原语负责。草稿关闭确认、任务通知策略和跨窗口协调属于视图或宿主；公共 UI 不保存业务关闭计划或全局桌面会话。

<a id="organization"></a>

## 源码与公开入口

组件按职责命名，默认保留一个文件，例如 `src/components/button.tsx`、`text-field.tsx` 和 `field.tsx`。同一家族的 Root、输入、标签等组成部分可以在同一文件顺读。只有实际存在独立职责、多份协作或资源寿命时才建立目录；组件家族本身不自动对应一层文件夹。

| 位置 | 责任 |
| --- | --- |
| `src/components/<name>.tsx` | 组件、Props、Tailwind 样式和本组件的变体定义。 |
| `src/virtual.ts` | 已选虚拟化库的公共几何入口。业务行、查询和选择留在视图。 |
| `src/chart.tsx`、`drag.tsx`、`markdown.tsx` | 各自独立的公开入口及实际组合、状态或资源职责；独立编辑命令放在 `markdown-commands.ts`。 |
| `src/styles.css` | Tailwind 编译入口与必要 CSS，生成包自带的普通样式。 |
| `src/index.ts` | 明确选择公开组件、Props 和几何能力。 |
| `tests/` | 本包实际需要的浏览器、集成或工具验证；跨包制品消费仍归根消费者测试。 |

不为每个子组件建立目录，也不预建 `types`、`hooks`、`utils`、`context` 或测试文件。同一文件中的 Props 与实现相邻，家族内私有调用直接导入实际文件；目录不增加只有转导出的 `index.ts`。公共入口由消费需要决定，内部目录不会自动成为包的 exports。

常规样式直接写在 TSX 的 Tailwind `class` 中，包含响应式、焦点、禁用及原语暴露的状态。变体在同一文件中用完整、可静态识别的类名组织，不动态拼接工具类片段。只在工具类不能清楚表达实际需求时编写专用 CSS，并放在实际拥有者附近；不为每个组件建立 CSS 文件，也不普遍改用自定义类和 `@apply`。

跨组件复用应有相同语义，例如 Dialog 触发器直接组合 Button。局部共用样式可以保留同文件常量，不因类名重复就建立组件工厂或全局样式层。调用方的 `class` 与默认工具类通过 tailwind-merge 合并；消费者自有类的 CSS 仍由消费者提供，本包只编译自己的源码。

公开 Props 说明本组件承诺的行为和原生元素能力。所用原语的能力直接接入，不靠无意义的改名、重复状态或宽泛断言转发。第三方声明问题应在依赖接入与公开类型边界解决，不能关闭消费者的完整声明检查。活跃 props 使用 Solid 的原生响应式读取和 `splitProps`／`mergeProps`，不能通过快照解构破坏后续更新。

依据：[Solid props](https://docs.solidjs.com/concepts/components/props)、[splitProps](https://docs.solidjs.com/reference/reactive-utilities/split-props)、[Tailwind 工具类组织](https://tailwindcss.com/docs/styling-with-utility-classes)、[静态类名检测](https://tailwindcss.com/docs/detecting-classes-in-source-files)及[类名冲突合并](https://github.com/dcastil/tailwind-merge)。

<a id="delivery"></a>

## 完整交付与验证

W01 完成 appearance 的纯视觉职责及本页全部公共 ui 能力，包含图表、Markdown、拖拽与虚拟化的独立消费。W05 接入持久外观与字体资源，W10 完成业务界面装配。后续工作包不能用来补齐已承诺的组件行为、视觉状态或样式消费。

组件范围从既定界面的真实共用需求确定。旧目录中混合的业务组件不因此成为公共 UI，Kobalte 的完整目录也不自动成为本包范围。公开组件范围的取舍按[实施讨论规则](../../implementation/work-packages.md#unexpected-issues)确认后写入所属合同；实际完成度和缺项由[实施状态](../../implementation/status.md#w01)记录，不以少数组件能渲染代表完整视觉基础已交付。

仓库外消费者使用构建后的 exports 与普通 CSS，不需要 Tailwind 编译，也不读取源码。验证聚焦本包增加的风险：外观与密度、响应式转发、组合后的语义和焦点、输入法与表单接入、浮层关闭与清理。原语已经拥有的通用算法不另写同义测试；声明、浏览器行为和实际视觉分别核对，不能彼此替代。
