# W05 公共 UI 包验证

2026-11-11，在 Windows x64、Node 24.11.1、pnpm 11.11.0、Solid 1.9.16 和 TypeScript 6.0.3 下验证 `@kisaki3/desktop-ui@0.1.0-dev.0`。浏览器为 Playwright 1.64.1 的 Chromium 156.0.8078.4；实际 Electron 45.0.0 使用 Chromium 156.0.8078.48、Node 24.22.0。范围为 [W05](../../../implementation/work-packages.md#w05) 的公共组件、独立制品及浏览器交互。

## 交付与检查

组件从 31 个家族子路径导出。家族拥有自己的部件、Props 与交互，`src/internal` 拥有共同度量的使用、输入与动作表面、选项行、选项集合、Tooltip、模态宿主及定位。所有 CSS Modules 的实际类名引用与家族样式归属已逐项核对。

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

本次运行支持当前桌面 Chromium 能力基线。其他浏览器引擎、SSR、产品窗口与扩展 Webview 的完整业务接入分别按实际支持范围和所属工作包处理；该包尚未公开发布，成篇项目文档归 W23。
