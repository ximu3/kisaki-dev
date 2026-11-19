# W05 与 W07 合同核查

2026-11-19 在 Windows x64 复验了两个工作包的实现。核查覆盖 34 个公共 UI 家族和 55 个窗口方法。最初的正常路径测试均通过，交叉操作仍暴露出四类问题：表单绑定到旧对象、操作在取消后进入提交、资源失效后仍被视图使用，以及最终清理失败后恢复了接纳。本页记录修正后的成功对照与实际故障结果。[W05](../../../implementation/work-packages.md#w05) · [W07](../../../implementation/work-packages.md#w07)

<a id="completion"></a>

## 当前工作树的完成判定

W05、W07 上次复核的六项缺口已修正。以下结果来自同一工作树的 Chromium 公共包消费者与独立资料目录中的 Electron 窗口。三项平台观察沿用原范围。

| 职责 | 原失败路径与本次结果 |
| --- | --- |
| W05 · 字段归属 | 把 Input、Textarea、SearchInput、NumberInput、DateInput、ColorInput、Checkbox、Switch、RadioGroup、SegmentedControl、Select、MultiSelect 和 Combobox 放在表单外，通过 HTML `form` 属性关联。空值提交后，13 种控件都取得错误标记及对应的可访问错误说明。更换表单后，旧表单撤下这些问题，新表单在提交后显示；宿主写入有效值会清除该字段错误，卸载和重挂表单也遵循实际归属。[Field 与表单](../../../design/ui/package.md#forms) |
| W05 · 反馈焦点 | 有多个错误时，从外部错误控件移入本表单反馈按钮，仍能读到原字段原因。移到独立的关闭按钮时，反馈切换为整表错误数。已验证业务校验、自定义定位及原生约束走同一表单。[固定反馈区](../../../design/ui/components.md#validation) |
| W05 · 数字边界 | 省略上限和下限，或传入空字符串、空白和非法数字文本时，增减按钮均可用。原值 5、−4 实际步进至 6、−5，包含 `step="any"`。传入数值 0 时仍按真实边界禁用对应按钮。[数字输入](../../../../clients/desktop/packages/desktop-ui/src/components/input/number/control.tsx) |
| W07 · 关闭前保存 | 偏好缩放填 201、导入字体只填名称、新主题清空名称。从未保存确认框选择保存，编辑器保留草稿，焦点依次回到缩放、添加文件和名称。另让独立 SQLite 拒绝偏好写入，确认框交付错误；回到编辑器仍是 115，恢复可写后再次保存，窗口关闭并采用 115。[关闭确认](../../../../clients/desktop/app/src/renderer/infrastructure/dialogs/closing.tsx) |
| W05／W07 · Dialog 操作 | 正式 renderer 的 13 处普通 DialogHeader 全部提供具名关闭，2 处 Alert DialogHeader 使用底部决定。字体、主题编辑器打开时聚焦名称，右上角关闭、页脚取消和 Escape 交给所属编辑器的离开流程。偏好主窗页脚保留保存，放弃更改集中在关闭确认中。采用实际关闭流程的实窗用例同时核对了保存结果与焦点返回。[Dialog 约定](../../../design/ui/components.md#layout) |
| W07 · 运行文案 | 英语与简体中文开发译本各有 378 个 runtime 消息键。逐条审阅原带句末句号的说明和反馈，按各语言实际句数处理，保留多句说明的标点和问句的问号。名称、字体文件与网络设置的简体中文实窗图已更新。[错误界面](#screenshots) |

### 覆盖与证据边界

| 范围 | 核对结果 |
| --- | --- |
| 公共 UI | 34 个家族的源码、声明、构建导出均存在。正式浏览器与独立消费者覆盖基础控件、表单与选择、弹层与通知、列表与拖动、Markdown、图表及资源寿命。此前在 Chromium 验证的受控 Dialog 原生关闭和列表移动组合见下文。视觉主题、系统强制配色及跨平台取像按原记录使用。 |
| 桌面运行 | 窗口合同、main 方法表和接纳表的 55 个方法对应。上次核查逐项验证了 21 个读取、5 个控制、13 个资源获取和 16 个写入的预取消与退出接纳。此次复跑原生宿主、开发会话、实窗、性能及归档验证。 |
| 工程组织 | 检查 desktop-ui 源码及 desktop 的 main、preload、renderer、shared，略去生成源、数据库 schema、声明文件和测试。252 个 TypeScript／TSX 文件有文件概述，720 条模块级声明语句有文档。四窗口入口、公共样式、业务 UI 和共享接入的分工沿用现行架构。 |
| 既有测试的取舍 | 受控折叠的拒绝操作移入已有的源码浏览器套件。任务历史复用一次实窗会话完成单条删除和跨筛选清理。退出的三种故障阶段与后台二次启动继续由原有用例验证。本次修正没有增加常驻测试。 |

公共包测试负责控件与浏览器的交互，实窗用例负责应用如何使用这些部件。跨表单归属、模态回焦和失败后的重试另用上表的隔离样本取证。

<a id="ui"></a>

## W05 公共 UI

| 操作 | Windows x64 复验结果 |
| --- | --- |
| 保持同一表单挂载，从记录 A 切换到 B，然后用原生按钮和快捷键提交 | 只有 B 收到写入。两个入口共享同一结果、原提交按钮和失败反馈。[表单实例](../../../../clients/desktop/packages/desktop-ui/src/components/form/control.tsx) · [浏览器用例](../../../../clients/desktop/packages/desktop-ui/tests/browser/forms.test.ts) |
| 空值提交后从宿主恢复有效值 | Input、Textarea、SearchInput、NumberInput、DateInput、ColorInput、Checkbox、Switch、RadioGroup、SegmentedControl、Select、MultiSelect 和 Combobox 共 13 种控件的原生校验均通过，表单问题数均归零。另在错误字段上依次禁用、启用、取消必填、恢复必填、移除，问题数依次为 0、1、0、1、0。独立具名 Select 能定位到可见触发器。[表单状态](../../../../clients/desktop/packages/desktop-ui/src/components/form/state.ts) |
| 宿主拒绝或改写控件请求 | 受控 Menu 外点、Dialog 子表单原生关闭被拒后面板仍打开。ColorInput 重新打开后采用宿主颜色。MarkdownEditor 接受拒绝和规范化后的内容。Chromium 输入法组合结束后采用延迟下发的文本，随后再次下发的文本也正常显示。 |
| 原生属性和资源变化 | 只读搜索、数字、日期、颜色控件的辅助动作遵循实际编辑许可。Progress 可从不确定态切换到有值再恢复。仅提供 srcset 的图片可解码，失败后只换候选也能恢复。 |
| 列表和触发器 | 普通行、可排序行都能用鼠标完整选取正文。由手柄启动拖动，行承接落点。TooltipTrigger 和 DragHandle 保持挂载时均可替换 as。拖动、键盘、菜单与焦点行为由组件及独立消费验证覆盖。[列表家族](../../../../clients/desktop/packages/desktop-ui/src/components/list/index.ts) |

其余家族通过组件样板、组合行为、含样式和声明的独立制品消费核对。Dialog 与 AlertDialogContent 共用 dialog 入口，List 与 ReorderableList 共用 list 入口。[完整家族及消费范围](../w05/README.md#rewrite-consumers)

<a id="runtime"></a>

## W07 桌面运行与设置

| 操作 | 复验结果及层次 |
| --- | --- |
| 取消、提交和文档断开 | Electron Node 模式使用实际迁移与独立 SQLite。预取消的主题创建新增零行，预取消的删除保留原行，正常创建与删除成功。原生宿主用例也验证了取消删除后字体仍可读。已接纳的写入由业务操作持有，窗口结束时等待其完成。[窗口接纳表](../../../../clients/desktop/app/src/main/app/window/admission.ts) |
| 退出接纳和确认 | 55 个窗口方法逐项声明读取、控制、获取资源或写入。退出收尾期间，新增订阅、字体与外观获取、清理任务历史返回 Busy，已有资源释放和任务取消仍可用。预取消的重启没有进入确认。挂起确认后取消，原请求直接得到 cancelled。确认连接断开时，加入者共享错误，下一次能重新退出。[生命周期用例](../../../../clients/desktop/app/src/main/app/lifecycle.test.ts) |
| 清理任务历史 | 实窗的搜索只显示 3 条已结束记录中的 1 条。取消和 Escape 均保留全部记录。注入数据库删除失败时，窗口报告错误且 3 条记录仍在。成功确认后，数据库记录数由 3 变为 0，焦点移到刷新。[清理确认实窗](ui/clear-task-history.png) · [任务历史用例](../../../../clients/desktop/app/tests/integration/electron/history.test.ts) |
| 最终释放失败 | 在隔离 Electron 实例中使 Session 连接清理失败。其余清理仍完成，运行日志写入 closed，原生弹窗只显示连接清理的实际错误，进程退出码为 1。协调器另以重启意图注入两项嵌套清理失败，一次提示按顺序逐行交付两个原因，接纳保持关闭，重启动作调用数为零。[退出合同](../../../design/ui/navigation.md#shutdown) |
| 文件输入与附件 | 实窗同时选择有效 WOFF2 和失效路径，两行分别保留预览与错误，主进程未捕获异常为零。拖入及粘贴各含有效文件和坏文件，同样逐项交付。缺失的已登记附件仍有元数据，检查为不可用，直接读取和窗口错误编码同为 FileUnavailable。文件流在输出目录就绪前报错也完成清理。[文件接入](../../../../clients/desktop/app/src/main/app/window/files.ts) |
| 观察、网络与任务结果 | 退出、网络的初次观察失败后不再收到更新。外观监听一次抛错后仍收到下一次缩放。保持真实偏好窗口打开，延迟采用网络配置时显示正在采用，放行后提示消失，注入下一次采用失败则显示网络不可用。发布者随后修改对象时，订阅者保留交付时的原生事实。任务失败可分别交付无部分结果、null、false 和空数组。 |
| 字体、预览与目录 | 实窗导入 WOFF2 并设为界面字体，缩放从 100 改为 115，原 FontFace 仍在，新增 load 为零。两个内容、三个读者共建立两个绑定，最终各释放一次。450 个候选项在首页返回前卸载，实际只请求 offset 0。预览结束先于创建回包时，开关关闭、迟到的句柄释放一次。主题与译本的同一引用改换字段顺序后仍可查到。[字体绑定](../../../../clients/desktop/app/src/main/features/appearance/document-fonts.ts) · [预览控制器](../../../../clients/desktop/app/src/renderer/windows/main/features/themes/preview.ts) |

四个窗口各有入口，文档外观与通知属于 renderer 的共用接入。主窗口共享业务控件由 domain-ui 提供，管理界面拥有自己的加载和编辑流程。字体库按单列分页浏览，主题和阅读偏好的字体选择器保留搜索。[桌面管理界面](../w07/README.md#shared-dialogs) · [导航与查询](../w07/README.md#document-navigation)

<a id="screenshots"></a>

## 错误界面

使用实际应用、简体中文开发译本、浅色主题和独立资料目录。文件错误来自失效的测试路径，网络采用和最终连接清理错误由隔离实例注入。下列图片保留界面实际交付的底层原因文案。

| 场景 | 实窗截图 |
| --- | --- |
| 新建主题的名称留空，固定反馈区随焦点显示具体纠正提示或错误数 | [字段聚焦](ui/form-validation.png) · [字段失焦](ui/form-validation-blurred.png) |
| 同一字体草稿含可用预览和失效文件，点击保存后提示移除失败项 | [字体部分导入失败](ui/font-import.png) |
| 已保存的网络选择采用失败，错误显示在代理设置下方 | [网络不可用](ui/network-error.png) |
| 应用窗口销毁后，Windows 原生弹窗报告退出失败 | [最终清理错误](ui/shutdown-error.png) |

<a id="verification"></a>

## 验证入口与制品

使用 Node 26.13.1、pnpm 12.18.0、Electron 45.3.2、浏览器测试 Chromium 156.0.8078.4。整仓 `check` 的 45 个任务通过。公共 UI 完整验证 8 个任务通过，包含 13 项浏览器和 4 项独立制品消费用例。桌面完整验证 20 个任务通过，包含 23 项原生宿主、6 项开发会话、12 项实窗、2 项性能和 1 项归档用例。3 项实窗用例按运行环境跳过。

| 本次验证对象 | 标识 |
| --- | --- |
| 公共 UI tarball 的 SHA-256 | `aaa17428a7dac9b5352d89e2ee142a69d377befdb5aed4d2dbce951884c3a67d` |
| Windows x64 测试 ZIP | 构建号 `b75e1c78-2041-42c2-b939-c7b780788d97`，SHA-256 `e8d2dcb0fb1099155839c771185436f7c1f4ef2f89900cbcc4f41b9b7c9a27d9` |
| 本次源码样本 | 基于 `89536fc7` 的本地工作树，733 个文件，SHA-256 `2fa97bf3d3d686d9ae757804789596243f92de747d743198493a6421e6e6b005` |
| PR 交付源码 | 同一范围内提交的 731 个文件，SHA-256 `00abd4ca8a6840a6fa0bb074040da76a0aa873c743aa2625c48c8326648699ad` |

源码样本包括桌面应用、desktop-ui、desktop-contracts、desktop-localization 和根 pnpm-lock.yaml。对 Git 已跟踪或未忽略且实际存在的文件按仓库相对路径排序，依次输入 UTF-8 路径、一个零字节及该文件的 SHA-256 原始字节。

交付摘要按同一顺序读取 Git 收录的文件。731 个文件逐字节匹配本地验收样本，另两份本地图标草案独立保留。

Windows 11 悬停贴靠、系统登录许可变化及实际登录后的后台自启由平台证据单列。其他目标的历史运行结果及对应修订见 [W05](../w05/README.md) 和 [W07](../w07/README.md#ui-rewrite-six-targets)。
