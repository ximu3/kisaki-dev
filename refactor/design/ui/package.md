# 公共 UI 包

`@kisaki3/desktop-ui` 为 Solid 1.9 提供可独立消费的控件、图表、Markdown、拖拽与样式。组件从实际交互需求设计，采用浏览器原生语义和成熟专用工具。视觉协议由 desktop-appearance 提供，业务数据与操作由宿主传入。工程规则见[公共包](../engineering/workspace.md#visual-packages)，应用体验见[界面原则](components.md#existing-ui)。

<a id="ownership"></a>

## 职责与技术基础

| 拥有者             | 负责内容                                                     |
| ------------------ | ------------------------------------------------------------ |
| 浏览器             | 语义元素、表单提交与校验、选择和编辑、顶层呈现及原生事件     |
| desktop-appearance | 视觉词表、纯值规则、默认值、基础 CSS 与 Tailwind 映射        |
| desktop-ui         | 组件 API、交互状态、组合、外观、可访问性接入及自身资源寿命   |
| 应用与扩展         | 业务数据、异步请求、草稿、验证保存、权限、资源取得与页面布局 |

组件直接使用合适的 HTML 元素。按钮、链接、文本、复选和单选保留原生行为；常规 Select 使用受支持的原生选择能力，Dialog 使用原生模态与关闭机制。Popover 等顶层能力承担呈现与适用的关闭行为，组件补足其实际需要的触发、定位、焦点和键盘语义。Combobox、菜单、多选及复合控件按各自状态与交互设计。

每个状态有明确拥有者。控件维护临时交互，调用方维护业务值与草稿；受控值和非受控默认值分别遵守其合同。标签、说明、错误、禁用与表单状态在实际组合中保持一致。

普通控件直接表达自身语义；需要内容协作的 Dialog、菜单等开放必要组成部分。组件 API、Props 与内部状态依据本包职责设计。专用工具提供编辑、图表、拖拽和几何能力，适配承担视觉、Solid 生命周期和资源责任。

desktop-ui 通过 props、事件与回调接入行为。异步选项、加载结果和业务动作由调用方提供，资料选择器、部分日期编辑器、媒体卡片、业务确认和设置页归 domain-ui 或具体扩展。

组件创建的监听、观察、编辑器、图表和 DOM 随实例更新与销毁收尾。宿主传入的资源保持原有所有权，明确转交的句柄按合同释放。主题选择、字体取得与桌面资源由宿主完成。

依据：[HTML 表单](https://html.spec.whatwg.org/multipage/forms.html)、[Dialog](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)、[Popover](https://html.spec.whatwg.org/multipage/popover.html)、[WAI 交互模式](https://www.w3.org/WAI/ARIA/apg/patterns/)及[Solid 生命周期](https://docs.solidjs.com/concepts/effects)。固定 Electron 环境的原生能力记录见[接入依据](../../verification/evidence/native-ui/README.md)。

<a id="families"></a>

## 公开能力与组合

| 范围       | 公开职责                                                              |
| ---------- | --------------------------------------------------------------------- |
| 基础呈现   | 按钮、链接、徽标、分隔、加载、进度、警示、图片与空状态                |
| 表单控件   | Field、单行和多行文本、复选、开关、单选组、选择器、Combobox 与 Slider |
| 内容结构   | Tabs、分段选择、折叠、表格与滚动区域                                  |
| 浮层与反馈 | Dialog、确认对话框、Popover、下拉菜单、上下文菜单、Tooltip 与 Toast   |
| 图表       | 通用图表呈现、主题、图例、提示及实例更新与销毁                        |
| Markdown   | 源码编辑、安全呈现、工具栏、编辑命令及资源清理                        |
| 拖拽       | Solid 生命周期接入、手柄、插入指示与通用反馈                          |

组件家族围绕同一交互语义或资源寿命组织。例如 Dialog 的触发、内容、标题与关闭动作属于同一家族，Markdown 的编辑、呈现与工具栏共同提供内容能力。具体公开符号和 Props 随完整接口实现明确列出。

| 能力     | 宿主拥有的内容                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 图表     | 查询、聚合、统计口径、单位和业务动作；组件接收数据与呈现配置                                                            |
| Markdown | 正文身份、附件、资源取得、保存、并发与关闭策略；组件通过明确回调接入内容                                                |
| 拖拽     | 对象身份、移动范围、许可、选择集合、数据就绪和持久顺序，见[人工重排](virtualization.md#reorder)                         |
| 虚拟化   | 视图直接使用 TanStack Virtual，拥有真实数量、行映射、数据读取、选择和身份锚点，见[几何边界](virtualization.md#geometry) |

专用工具通过公开 API 消费。所有组件家族统一使用子路径，公开入口与内部文件按各自职责组织。

### 图表

图表使用 Unovis 1.7.1 的官方 Solid 适配，以 SVG、CSS 变量和子组件组合接入共同外观。公共入口提供 XY 与单图容器、折线、面积、分组柱、堆叠柱、散点、环图、坐标轴、Tooltip 和 Crosshair。业务统计继续拥有查询、聚合、单位、数据选择和结果解释；图表及其相关实例由 Solid 适配统一创建、更新与销毁，不接收外部手工创建的引擎实例。布局回调需要的几何以只读值提供。

主题容器映射 desktop-appearance 的颜色、字体、边框与阴影。交互图例使用语义按钮，选中状态由调用方提供；提示内容提供文本 DOM 生成能力，数据不插入未经处理的 HTML。调用方同时提供名称、数据摘要或适用的文本替代。严格 CSP 的宿主在导入图表前按工具公开方式设置 nonce，由宿主统一维护策略。

配置继续消费工具的公开类型。Unovis 1.7.1 的声明路径面向 bundler；本包汇总实际使用的声明，并显式交付仍被引用的类型依赖，保持 NodeNext 的完整声明检查。实例寿命归 Solid 组合，公共类型不承诺与外部引擎实例互换。

依据：[Unovis Solid 接入](https://unovis.dev/docs/intro/)、[主题变量](https://unovis.dev/docs/guides/theming/)、[CSP](https://unovis.dev/docs/guides/csp/)及[声明依赖处理](https://tsdown.dev/options/dependencies)。

### Markdown

Markdown 采用 CodeMirror 6 源码编辑和 markdown-it 15.0.3 呈现，任务列表与脚注分别使用 `@mdit/plugin-tasklist` 1.1.4 和 `@mdit/plugin-footnote` 1.1.3。编辑器保留原生选择、撤销、输入法和扩展机制；工具栏与格式命令共用编辑器事务。宿主拥有正文、受控值更新、资源选择、保存、草稿与布局，预览和放大编辑区域通过公共组件组合。

呈现支持 Markdown、表格、任务列表、脚注、自动链接、软换行及标点转换。原始 HTML 按文本显示；任务列表只读，勾选在源码中修改。任务与脚注标识按预览实例隔离，不发生跨实例标签关联。来自内容的图片源必须由宿主映射到已经取得的 URL，未解析时显示替代文本；普通链接可以交给宿主导航，页内脚注保持原生锚点。资源身份、取得、授权和撤销由宿主维护。

编辑器随组件卸载销毁，向调用方交付的实例引用同时失效。受控文本同步避开尚未完成的输入法组合；组件自建的 DOM、监听和编辑资源随自身寿命释放，宿主传入的资源不转移所有权。

依据：[CodeMirror 模块与生命周期](https://codemirror.net/docs/guide/)、[Markdown 安全策略](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)、[任务列表选项](https://mdit-plugins.github.io/tasklist.html)及[脚注](https://mdit-plugins.github.io/footnote.html)。

### Field 与表单接入

Field 组织标签、控件、说明和错误，使可访问性关系易于正确建立；一个输入值由对应控件或调用方拥有。单行和多行文本分别使用语义输入元素，简单输入可直接使用。一组相关控件采用 fieldset 与 legend。

控件保留 name、表单归属、默认值、必填、禁用、校验与提交语义。form.reset 恢复默认状态并正确接续 Solid 值，取消 reset 保持现状；fieldset 禁用、失效选项和外部值更新各按实际输入状态处理。可见值、提交值与校验结果保持一致。

文本编辑保留输入法组合、选择、撤销和原生事件。提交、搜索和快捷键在明确的用户动作中执行；输入法组合期间保持编辑语义。异步选项与当前选择分别表达，调用方根据真实请求管理加载和失败。

原生表单、受控更新和组合关系通过实际浏览器核对。特殊控件需要自维护交互时，公开合同明确其键盘、焦点、可访问名称与表单结果。

依据：[HTML 表单控件](https://html.spec.whatwg.org/multipage/form-elements.html)、[表单处理](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html)及[WAI 表单分组](https://www.w3.org/WAI/tutorials/forms/grouping/)。

### 变体、内容与状态

变体表达视觉用途，尺寸表达密度。Button 等家族的普通、危险、描边、次要、透明和文字表现，以及图标尺寸，沿既有体验核对；交互状态包含 hover、active、focus-visible、disabled 和适用的 invalid／selected／expanded。业务“加载中”或“保存失败”由调用方提供，不在控件内部推断操作结果。

内容、图标、动作名称、描述和错误由调用方传入。只有图标的控件仍须有可访问名称；Tooltip 补充用途或快捷键，不代替名称。导航使用 Link，执行操作使用 Button；视觉相同不改变语义。

浮层与反馈组件提供可组合的标题、内容及动作，交互状态与清理由组件负责。草稿关闭确认、任务通知策略和跨窗口协调属于视图或宿主；业务关闭计划和全局桌面会话由应用拥有。

<a id="organization"></a>

## 源码与公开入口

公开子路径以组件家族或完整能力为单位，例如 `/button`、`/dialog`、`/markdown`、`/chart` 和 `/drag`。同一家族的组成部分从同一入口导入；样式使用 `/styles.css`。exports 明确选择可消费的构建结果。

```tsx
import { Button } from '@kisaki3/desktop-ui/button'
import { Dialog, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { MarkdownEditor, MarkdownPreview } from '@kisaki3/desktop-ui/markdown'
import '@kisaki3/desktop-ui/styles.css'
```

源码以组件家族或完整能力为维护单位，单文件和目录按职责与协作关系选择。共享状态且经常一起阅读、修改的内容集中组织；可以独立使用、依赖或资源寿命不同的职责，可在同一能力目录内分文件协作。所有家族遵循相同标准，文件数量与层级由实际阅读和修改路径决定。

公开子路径定义消费边界，内部文件承载实现分工。正式构建入口遵守[主题目录与入口规则](../engineering/conventions.md#module-imports)，就近选择该能力的公开接口，通过构建配置与 exports 映射到公开子路径；包内协作直接引用实际模块。

Props、状态、变体与专用辅助跟随所属实现；相同语义的真实复用再提取到最小共同范围，共用模块按具体职责命名。虚拟几何由实际使用者直接消费 TanStack Virtual，UI 组件按需要使用其公开能力。

常规样式使用 TSX 中完整、可静态识别的 Tailwind 类名，变体定义就近维护。原生伪元素、排版或主题映射需要专用 CSS 时，就近放置。调用方 class 与默认工具类通过 tailwind-merge 合并，消费者自己的样式由其工程提供。

公开 Props 表达组件自身行为及适用原生元素能力。活跃 props 按 Solid 的响应式语义读取，使用 splitProps 和 mergeProps 保持更新；真实资源在明确的挂载、更新与清理边界接入。

依据：[Solid props](https://docs.solidjs.com/concepts/components/props)、[splitProps](https://docs.solidjs.com/reference/reactive-utilities/split-props)、[Tailwind 类名检测](https://tailwindcss.com/docs/detecting-classes-in-source-files)、[类名合并](https://github.com/dcastil/tailwind-merge)及[Node 子路径](https://nodejs.org/api/packages.html#subpath-exports)。

<a id="delivery"></a>

## 完整交付与验证

[W05](../../implementation/work-packages.md#w05) 完成本页全部组件、交互、样式和独立消费。desktop-appearance 由 W01 完整交付；各本体能力使用这些成品装配自己的业务界面。当前实施结果见[状态页](../../implementation/status.md#progress)。

默认样式组合 desktop-appearance 的基础视觉值和组件 CSS。普通 Solid 1.9 项目通过公开子路径与样式入口直接消费，宿主可以覆盖视觉变量。包支持满足当前桌面 Chromium 能力基线的浏览器环境；其他浏览器与 SSR 的支持按实际证据声明。

仓库外验证使用构建后的 exports、完整声明和普通 CSS。核对基础控件消费的依赖范围，以及按完整功能延迟加载编辑器和图表的行为。类型、样式、浏览器交互和实际视觉分别验收。

行为验证覆盖公开控件及其关键组合：受控和默认值、提交与重置、必填与禁用、输入法、键盘、焦点、浮层关闭、外部状态变化、异步选项及资源释放。共同机制在拥有层验证，专用能力补充自身风险，测试结构依据行为与实际组合确定。
