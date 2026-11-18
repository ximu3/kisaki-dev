# W05 公共 UI 包验证

2026-11-11，在 Windows x64、Node 24.11.1、pnpm 11.11.0、Solid 1.9.16 和 TypeScript 6.0.3 下验证 `@kisaki3/desktop-ui@0.1.0-dev.0`。浏览器为 Playwright 1.64.1 的 Chromium 156.0.8078.4；实际 Electron 45.0.0 使用 Chromium 156.0.8078.48、Node 24.22.0。范围为 [W05](../../../implementation/work-packages.md#w05) 的公共组件、独立制品及浏览器交互。

## 交付与检查

组件从 32 个家族子路径导出。家族拥有自己的部件、Props 与交互，`src/internal` 拥有共同度量的使用、输入与动作表面、选项行、选项集合、Tooltip、模态宿主及定位。所有 CSS Modules 的实际类名引用与家族样式归属已逐项核对。

| 范围 | 已交付与实际验证 |
| --- | --- |
| 基础呈现 | Button、Link、Badge、Separator、Spinner、Progress、Alert、Image 和 EmptyState；原生语义、变体、焦点、禁用与默认样式。 |
| 表单 | Field、FieldGroup、FormFeedback、Input、NumberInput、DateInput、ColorInput、Textarea、Select、MultiSelect、Combobox、Checkbox、RadioGroup、Switch 和 Slider。核对静态标题与说明、表单提交、重置与取消重置、禁用、受控值和输入法组合。日期分段编辑、粘贴、年月浏览及跨月选择接续原生输入。选日后字段立即取得新值，退场仍呈现旧选中标记。另核对 alpha 编辑、跨检索选择、标签移除后的焦点与窄字段滚动。虚拟列表在末项退出时保有行和视口。 |
| 内容结构 | Tabs、SegmentedControl、Collapsible、Table 和 ScrollArea；键盘选择、真实焦点、共同分段外观、语义表格和统一原生滚动条。用强制配色与应用亮暗设置交叉核对日历、页签和分段按钮，选中底色、文字和内描焦点均取自系统选区。 |
| 浮层 | Dialog、确认框、Popover、下拉／上下文／子菜单和 Tooltip。核对三档原位淡变、逐层 Escape、可阻止的关闭、键盘与焦点归还、子菜单悬停与移入。工具间可连续阅读提示，键盘聚焦可接管正在等待的提示。Floating UI 定位遵守视口约束和实际翻转结果。 |
| 固定反馈 | 初次不标错；提交后定位，跨页签展开字段，独立错误描述，纠正时保留焦点。聚焦错误字段时只显示其短句和可选说明，聚焦有效字段时显示独立总数，点击汇总定位第一项。截断的短句可以悬停或聚焦阅读全文。四语长说明、窄窗口和 150% 缩放保持预留几何，Dialog Body 滚动时 Header 与 Footer 保持可用。 |
| Toast | 命令式 toast 与单一 Toaster；从下方入场的滚动范围、队列让位与补位、右上角关闭、loading、结果转换、persistent、自然到期与悬停暂停、旧句柄失效和显示宿主清理。发起组件与 Dialog 卸载后消息保持；同一队列在嵌套 Dialog 中移动，动作可实际点击。 |
| Markdown | CodeMirror 主题与编辑、紧凑的内置格式栏、前景色悬停、宿主按钮操作当前选区、单一 Tab 入口与方向键、空工具栏、只读往返切换与历史可用性、格式事务与撤销、受控正文更新及销毁；Markdown、表格、只读任务与脚注呈现，实例标识隔离，原始 HTML 为文本，未映射图片不请求来源 URL，普通链接可交宿主处理。 |
| 图表 | Unovis 的 XY／单图容器、折线、面积、分组柱、堆叠柱、散点、环图、轴、数据提示和 Crosshair。核对数据更新、只读布局结果、交互图例、五个系列色和卸载。提示随可见性淡变，跨数据点即时换值、定位，减少动效时直接显隐。 |
| 拖拽 | Pragmatic Drag and Drop 的生命周期接入、自动滚动、紧凑预览、手柄、命中边缘、间隙中点插入指示和反馈；实际指针放下与明确的键盘移动动作。业务身份、许可和保存由消费者维护。 |
| 样式与制品 | CSS Modules 的构建类名对应普通 CSS，样式入口包含 appearance 默认值；无 Tailwind 消费、真实 Tailwind 两种加载顺序及未分层覆盖通过。基础入口与延迟加载的完整专用能力分开。 |

Unovis 使用的声明汇总进入图表子路径，仍被引用的类型依赖在 manifest 中明确交付。仓库外消费者同时以 Bundler 和 NodeNext、`skipLibCheck: false` 检查完整声明，并运行类型感知 lint。包内 CSS 声明另有完整声明检查项目。

## 复现与材料

`pnpm check` 执行工作区类型、lint、边界、格式和常规测试。UI 的真实浏览器与 Electron 检查属于独立消费者任务，普通 check 不启动桌面。

`pnpm exec turbo run test:consumers --filter=@kisaki3/desktop-ui --filter=@kisaki3/desktop-appearance` 构建并打包真实制品，经 publint 和 ATTW 的 ESM 检查，再安装到仓库外临时工程。appearance 和 desktop-ui 分别通过 4 与 14 项消费检查。安装、服务器、页面、浏览器和 Electron profile 由测试拥有并释放。

UI 制品为包内 `out/package/package.tgz`。`test-results/consumers` 保存结果、实际环境与 tarball SHA-256，以及亮暗、窄窗口、专用能力和 Electron 截图。独立审查页核对了亮暗控件、分数像素下的通高分隔线、拾色器通道焦点、滑轨填色、长 Dialog、只读错误详情、图表实际数值与拖拽结果；其他包的报告保留在各自相同用途的输出目录。CI 按对应 PR 的实际运行登记。

默认主题的双向溢出样例在 100% 与 150% 界面缩放下，列表面板的四边内距均为 0。万项虚拟列表同时出现两条滚动条时，End 可完整显示最后一项。150px 限高的 Markdown 编辑器由正文视口承载溢出内容。

强制配色的亮、暗系统调色板分别与应用亮、暗主题交叉核对。实际画面确认菜单轮廓、当前候选、说明及选中标记可辨，行内文字底板不会盖住文字；进度条保留轨道与确定／不定状态，拖拽保留插入线。拾色器保留色域与色样，图表坐标采用系统文字色，图例色样与 SVG 系列对应。普通界面继续使用主题配色。

制品消费者在淡入中段及终态比较菜单、Dialog 和图表提示的文字几何。连续跨图表数据点时沿用同一提示。通知自然退场计入读时，主动关闭使句柄立即失效，跨模态移动保留通知身份和时钟。

构建沿 [tsdown 的 Solid 接入](https://tsdown.dev/recipes/solid-support)和 [CSS Modules 提取](https://tsdown.dev/options/css)，使用固定 tsdown／CSS 0.23.0 与适配 Solid 1.9 的 unplugin-solid 1.0.0。专用工具通过其公开入口接入，声明归集保留 Unovis 的许可材料。

## 图标目录与呈现

2026-11-12，公共 UI、扩展贡献与搜索合同统一到 Lucide 1.72.0。Solid 1.9 使用 lucide-solid；desktop-contracts 从同版 @lucide/icons 的公开目录生成名称类型与校验。图标选择和拥有边界见 [UI 图标](../../../design/ui/package.md#icons)与[贡献图标值](../../../design/extensions/webview.md#icons)。

| 范围 | 实际验证 |
| --- | --- |
| 名称与资源 | 上游 2,356 个名称及别名逐项通过值解析；未知名称、组件式拼写、旧 mdi 分支及越界包路径被拒绝。贡献包文件与搜索扩展资源分别保留原有归属。 |
| 包与裁剪 | pnpm check、desktop-contracts 和 desktop-ui 的制品消费通过，包含 Node、浏览器完整声明及真实 Electron。独立 Spinner 入口的浏览器构建仅保留 LoaderCircle 图形；名称校验入口没有图形模块、动态图库导入或 DOM 接入。 |
| 视觉与响应 | 实际制品的四种 Alert 状态在同一组件中更新图形。31 个可见图标槽位在亮暗、150% 缩放、亮暗强制颜色和 RTL 下核对；常规槽位从 14px 到 21px，选中标记和工具栏同比缩放，均使用 currentColor 与 2 单位描边。 |
| 动效与语义 | Spinner 在普通模式旋转，减少动效时静止。内部 SVG 为装饰图形，操作名称由控件提供；日历、选择器、Markdown 工具栏与拖拽手柄沿既有消费检查验证。 |

## 焦点、错误反馈与合同消费

2026-11-13，在上述 Windows x64 环境中验证当前制品。`pnpm check` 与 `pnpm desktop:test:consumers` 通过，后者执行六个公共包的 29 项消费检查，其中 UI 为 14 项，包含真实沙箱 Electron。

| 范围 | 实际验证 |
| --- | --- |
| 焦点强调 | 实际制品的 15 个焦点环目标与 7 类字段表面按 100ms 进入、即时退出。中段失焦立即移除环并恢复常规或错误边框，尺寸保持稳定。选择器展开后把焦点交给搜索框时，整框继续保持展开强调。减少动效与强制配色直接呈现终态。 |
| 错误状态 | 亮暗主题下分别核对 Switch、Checkbox 的选中与未选中状态：错误边框保留，填色继续表达选中；聚焦保留错误边框并显示独立焦点环。错误的出现与清除没有边框过渡。 |
| 紧凑操作 | Markdown 工具栏采用共同 1rem 图框；默认比例下图标为 14px，单行工具栏为 25.5px，上下留白为零。默认拖拽手柄只过渡前景色，普通提示首次悬停等待 400ms，键盘提示直接打开。 |
| 合同类型 | 构建后声明的 NodeNext 与 Bundler 消费通过。已有消费夹具核对读取与写入保持对象种类、主题来源、资源归属和请求键；动态集合与可选输入的结果项保留可能缺席的类型。 |

这些运行支持当前桌面 Chromium 能力基线。其他浏览器引擎、SSR、产品窗口与扩展 Webview 的完整业务接入分别按实际支持范围和所属工作包处理；该包尚未公开发布，成篇项目文档归 W23。

表单重置另在 Electron 45.3.2 与原生输入框同窗核对。调用 `form.reset()` 后同一轮输入新值，公共 Input 和原生字段都保持新值，公共回调按重置、后续输入的顺序交付。持续复验见[浏览器表单用例](../../../../clients/desktop/packages/desktop-ui/tests/browser/forms.test.ts)。

<a id="control-scale"></a>

## 单行控件的实际外高

2026-11-17 重写前，在 Windows x64、Chromium 156.0.8078.4、设备比例 1.25 下运行工作区公共包的独立 workshop，默认主题根字号 14px。在实际元素上读取 `getBoundingClientRect().height` 和计算字号，Select 取整框，Checkbox 与 Switch 取带文字的整行。常规 Input、Select、Button、Checkbox 和 Switch 均为 24.50px / 12.25px。

同一消费者成对渲染文字与图标 Button。xs 的实际外高为 17.75 / 17.50px，sm 为 21.25 / 21px，默认档为 24.50 / 24.50px，lg 为 30.88 / 28px。文字按钮的行高、上下 padding 和边框之和可超过 min-height。旧工程 `e311fe7c` 的 Button 使用 `h-8` 和 `size-8` 定义同档两种按钮的外高，清理宿主覆盖之外，还需在公共动作样式修正该差异。[正式窗口对照](../w07/README.md#ui-review)

### 表单与固定 Footer 的结构验证

在 Chromium 156.0.8078.4 中用原生 dialog 和表单建立独立结构试件。视口 960 × 560 CSS px，设备比例 1.25。Header 下的 form 是可收缩纵列，内部有 40 行内容的 Body 和同级 Footer。在根字号 14px 与 28px 两种情况下，只有 Body 产生纵向滚动，将其滚到末尾时 Footer 顶边均保持原位。两个提交按钮的 form 均指向当前表单。标记 novalidate 后，对空必填输入按 Enter 收到普通保存的 submitter，且输入的 validity 仍无效。填入值、点击另一提交按钮后收到对应 submitter 和有效状态。该试件验证布局与浏览器提交语义。公共 Form 的异步提交与正式接入见[重写后的验证](#rewrite)。

<a id="rewrite"></a>

## 公共 Form 与控件尺度复验

在 Windows x64 的 Chromium 中，通过构建后的 `/button` 和普通 CSS 并排渲染同档文字与图标按钮，设备像素比 1.25。下表为 `getBoundingClientRect().height` 的 CSS px 实测值，每对按钮外高相同。

| 应用缩放 | 根字号 | xs | sm | default | lg |
| --- | --- | --- | --- | --- | --- |
| 75% | 10.5 | 13.125 | 15.75 | 18.375 | 21 |
| 100% | 14 | 17.5 | 21 | 24.5 | 28 |
| 200% | 28 | 35 | 42 | 49 | 56 |

`/form` 的浏览器用例从原生按钮发起一次延迟写入，在途调用两次实例的 `submit()`。两个调用取得同一 Promise，写入只收到一次原按钮。写入拒绝时，调用方和表单反馈取得同一错误。字段定位、跨页签修正、长反馈、原生 reset 与选择器镜像由[表单与选择用例](../../../../clients/desktop/packages/desktop-ui/tests/browser)覆盖。本机公共包完整验证通过，包括 10 项浏览器用例和 5 项独立制品消费用例，覆盖 NodeNext 与 Bundler 声明、普通 CSS、Tailwind 及沙箱 Electron。正式窗口中保存期间继续输入、关闭确认和嵌套焦点返回见 [W07](../w07/README.md#rewrite)。

<a id="management-controls"></a>

## 管理界面使用的公共控件

公共入口共 33 个家族。正式任务和字体目录使用 Toolbar 与 ToolbarRow。Windows x64 上公共包完整验证通过，包含 10 项浏览器用例和 5 项独立制品消费用例。搜索框、选择器和工具栏动作采用所在区域的尺度。Chromium 用例通过实际点击核对搜索清除后的焦点，以及数字单位的可访问描述和原生提交值。日期和字体名单接入同一虚拟视口，候选选择随实际滚动和键盘高亮运作。

Windows Electron 的强制配色复验覆盖竖排、横排页签和日历选中日。应用窗口在 100% 下的任务工具栏和 200% 的页签、日期格见[实测记录](../w07/README.md#management-ui)。

<a id="shared-dialogs"></a>

## 统一对话框与管理条目

公共包共 34 个家族。新增的 ListItem 从正式子路径消费，位于独立样板和桌面管理入口中。带底色的 Toolbar、Dialog 标题栏与底部操作带共用主题色。Alert 与 Badge 采用原有公共样式。Windows x64 的公共包完整验证通过，包括浏览器 10 项和独立制品消费 5 项。正式窗口的尺寸与交互见[旧版实机对照](../w07/README.md#shared-dialogs)。

## 控件的尺寸变体

在独立 Chromium 页面中从构建产物挂载四档文字按钮、图标按钮、输入和选择器，用普通 CSS 在 75%、100%、200% 下测量。100% 时四档外高依次为 17.5、21、24.5、28 CSS px，主图标为 10.5、12.25、14、17.5 CSS px。逐档核对了搜索与清除图标、选择器箭头、日期和快捷键图标。普通输入和搜索输入的 `htmlSize={17}` 在四档都读回原生 `input.size === 17`。

Windows x64 公共包验证通过，含 12 项 Chromium 用例和 5 项独立制品消费用例。独立消费者覆盖普通 CSS、Tailwind、暗色、视口缩放及沙箱 Electron。正式任务查询和页签的尺寸见[窗口复验](../w07/README.md#single-control-scale)。

## 更换浮层的触发节点

Chromium 用例在同一个菜单实例中替换触发按钮，分别核对替换后打开和打开时替换。菜单对齐新按钮，菜单项焦点保留。向新按钮发出 Escape 后，菜单关闭，焦点回到新按钮，外层 Dialog 保持开启。

独立 Vite 热更新试件连续两次只替换按钮组件，第二次在菜单打开时更新。按钮每次右移 40 CSS px，菜单位置从 79.2 移至 119.2 和 159.2 CSS px，保留右侧底对齐。原生 `beforetoggle` 依次记录三次打开的当前按钮，菜单 DOM 保持同一个实例。最后按 Escape 回到最新按钮。修正前，同一类替换会使菜单落在左上角的 4、8 CSS px。 [浮层合同](../../../design/ui/package.md#overlays)

<a id="choice-and-staged-fields"></a>

## 选项行、表单定位与录入控件

2026-11-18 在 Windows x64 的 Chromium 样板中验证。小号复选、开关和单选的带文字选项行外高均为 21 CSS px，尺寸由公共档位控制。受控单选和分段选择拒绝修改时，可见选中值和原生 FormData 都保留调用方值。移除非受控页签的当前项时，相邻面板获得选中状态与键盘入口。带恢复动作的必填字段提交时，焦点落在真实输入框。受控 Dialog 拒绝关闭请求时仍保有模态和焦点。

受控 Popover 拒绝外点时，仍停留在顶层，触发器保持展开状态。按下在面板内、释放在面板外的指针操作保留浮层。采纳外点请求时焦点停留在新目标，采纳 Escape 时回到触发按钮。修正时的 Chromium 实测覆盖这些路径。

公共快捷键录入与多选共用单行可滚动标签。Windows 真实桌面窗口核对了录入期间的预览、重置、确认以及七组绑定的滚动和高度。公共包在本机通过 14 项 Chromium 用例和 5 项独立制品消费用例。[正式窗口验收](../w07/README.md#work-usage-and-shortcut-popovers)

随后在独立 Chromium 样板中从构建产物挂载 MultiSelect 与 ShortcutInput，比较相同文字的已选标签。默认比例下，两者的文字均为 10.5 CSS px，标签高 15.75 CSS px、外框高 24.5 CSS px，底色和 2 CSS px 圆角一致。精简后的 12 项 Chromium 用例逐文件运行通过，4 项独立制品消费用例通过。[自动用例保留复核](../README.md#test-retention-review)

调整标签高度后，从构建产物复测。默认档两种控件的标签高 17.5 CSS px，外框高 24.5 CSS px。四个尺寸档位中，标签均与外框垂直居中。

## 次要文字与高亮配色

在 Windows x64 的无头 Chromium 中挂载公共 UI 构建产物。默认明暗和自定义主题均逐项核对空状态、字段说明和占位文字的次要文字色，以及次要按钮和徽标的配套前景与底色。候选行、日期格和搜索清除按钮高亮时使用配套前景，强制配色下候选行说明跟随系统高亮文字色。

按浏览器计算的前景和叠加后的底色估算对比度。默认暗色主题下，表格悬停行的次要文字从约 4.12∶1 提升至 5.45∶1。自定义暗色主题采用亮色实底高亮时，候选行的说明从约 1.81∶1 提升至 16.37∶1。 [配色合同](../../../design/ui/package.md#styles) · [对比度计算](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
