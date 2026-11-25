# Kisaki

本文件是 Kisaki、Vantage、Kana、libmpv-node 和 oauth-relay 的共同任务入口。五个项目共用工作原则与工程规范。

## 协作与讨论

沟通默认使用简体中文。

讨论方案时，先查证关键事实，再判断提问中的假设和自己的初步看法是否成立。需要取舍时，明确说出自己的主张和理由。有分歧就坦诚说明，证据支持现状就建议保留。见[讨论与独立判断](refactor/design/engineering/conventions.md#discussion)。

## 任务入口

设计讨论、实施和审阅都从 [refactor/README.md](refactor/README.md) 开始。必须沿目录和交叉引用通读 `refactor/` 中的设计、实施和验收要求，理解各部分的依赖与约束，再核对当前工作包的职责、公开合同和交付范围。

选择实现方案时，先确定用户要完成的操作、预期结果和负责的模块，再比较符合要求的做法。查证目标版本的能力与维护状况，在代表场景中检验体验、正确性、性能和维护复杂度，据此决定复用、组合或自行实现。见[判断与取舍](refactor/design/engineering/conventions.md#judgment)。

代码、组织与说明遵守[共用工程规范](refactor/design/engineering/conventions.md)，环境准备、可运行命令和当前源码职责见[当前工程与开发](refactor/implementation/development.md)。

根工程和工作区成员的命名工程任务统一写在所属 `vite.config.ts` 的 `run.tasks` 中，用 `pnpm exec vp run <任务>` 调用。包管理器生命周期、任务调用与直接运行工具的分工见[工作区任务入口](refactor/design/engineering/workspace.md#tasks)。

## 工作原则

现代化、简洁、清晰、干净与克制是同等重要的首要原则，适用于设计、实现、审阅和交付。见[共同原则](refactor/design/engineering/conventions.md#quality)。

### 设计与变更

设计或修改一项功能前，先确认哪些模块维护数据、哪些模块定义规则。比较所有同类对象和入口，统一模型层次、命名、交互、风格和验收标准。遇到共有问题，在定义规则的模块修正，并更新所有受影响的调用方。差异须能由对象语义、资源归属或运行环境解释。具体判断与审查方法见[全局设计与一致性](refactor/design/engineering/conventions.md#global-design)。

要求或方案与设计原则冲突，或存在正确性、质量或技术问题时，按[整体判断](refactor/design/engineering/conventions.md#judgment)说明依据、影响、选项与建议，由用户决定方向。涉及模型、主要行为、公开合同、架构边界或交付范围的取舍遵守[实施讨论规则](refactor/implementation/work-packages.md#unexpected-issues)。既定合同内的修复与验证由实施者完成。

工作量、工期或返工成本不能作为降低要求、保留已知问题或不一致的理由。运行性能、资源占用和长期维护复杂度仍按成果质量评估，具体遵守[判断与取舍](refactor/design/engineering/conventions.md#judgment)。

以已确认的目标、合同和资源归属为依据制定方案，现有结构与目标冲突时重做受影响的部分。工作包可以分步实施。交付时，正式入口须支持全部约定操作，明确失败后保留的结果，并完成约定的资源清理。见[终态与整体一致](refactor/design/engineering/conventions.md#final-state)和[工作包边界](refactor/implementation/work-packages.md#boundary)。

修复问题时，先查明问题源于哪项规则、模型、流程或资源边界，再在负责的模块中修正。同一根因涉及的入口和运行端统一接入，同步调用方、文档和验证，清理临时补救与失去用途的旧路径。见[修正规范](refactor/design/engineering/conventions.md#root-cause)。

首次发行前，接口、数据格式、配置、命令和目录均可按目标重做。同步更新全部调用方，重建开发样本，删除失去用途的旧路径。各发行单位的起点及已有外部约定见[首次发行前的兼容范围](refactor/design/engineering/conventions.md#before-first-release)。

### 代码风格

代码应易读、美观。名称说明操作和结果，同类操作使用一致的词汇与参数顺序。从调用处进入实现，应能顺着主流程看清数据由谁修改、资源由谁释放。选用目标版本支持的语言和框架惯用写法，平台已有的能力能完整表达操作时直接使用。见[可读性与表达](refactor/design/engineering/conventions.md#readability)。

函数按操作步骤分段。例如，外部输入的读取和校验放在同一段，订阅事件后紧接着注册清理函数。Solid 组件把同一交互的状态和事件处理函数放在一起，JSX 按界面区域组织。见[逻辑分段](refactor/design/engineering/conventions.md#logical-sections)和[组件组织](refactor/design/engineering/conventions.md#tsx-style)。

源码不写文件或声明的说明性注释。调用约定随包或协议文档交付，具体语句旁可以用英文行注释说明影响维护的局部事实。见[注释与说明](refactor/design/engineering/conventions.md#comments)。

### 实现与测试

只有风险有明确后果，且现有类型、平台或流程尚未提供相应保证时，才保留防御分支。能从模型或流程中消除错误状态时，修正根因并清理相应的补救分支。外部输入、权限、持久化和副作用的风险由所属边界处理，内部调用直接依赖已有保证。删去重复校验和只为假想异常设置的分支。

日常改动默认不追加防御或回归用例。修复可用已有检查或一次性复现核实。只有关键行为需要持续验证、其余检查会漏掉具体错误时，才保留能检出它的最小用例。同一保证在所属层验证，接入只核对新增风险。见[边界与投入](refactor/design/engineering/conventions.md#proportionality)和[验证范围](refactor/verification/acceptance.md#verification-scope)。

### 文档与源码组织

文档、注释和界面文案用自然、直接的语言说明具体做法、条件和结果。标题写明主题或操作，省去口号、刻意的比喻和重复正文的开场句。会影响选择的差异、取舍依据和失败后果应就近说明。见[写作要求](refactor/design/engineering/documentation.md#writing)和[界面文案](refactor/design/ui/components.md#copy)。

实施和审阅时，检查代码、测试和文档是否位于对应的功能目录，文件名和目录名是否与内容相符。入口遵循语言和工具的原生规则。普通 TypeScript 多文件主题和成篇文档按主题集中，所需入口与内容放在同一目录，不以同级前缀文件模拟内部层级。收尾时核对[组织与命名](refactor/design/engineering/conventions.md#source-layout)和[导入与公开入口](refactor/design/engineering/conventions.md#module-imports)。

## 桌面 UI 设计

桌面页面、对话框和公共 UI 部件沿用旧 Kisaki 的设计。先到 `F:/project/3/kisaki` 阅读 `.agents/skills/kisaki/references/ui-system.md` 和对应部件，再在旧工程根目录运行 `pnpm dev`，用已有开发数据查看实际界面。已有界面沿用其布局、信息层次、密度和操作位置。新增界面沿用同类页面和部件的做法。系统与功能图标统一使用 Material Design Icons（MDI），同一操作优先沿用旧界面的图标。

业务行为、接口和资源归属由本仓库的现行规格定义。交付前在默认主题、100% 应用缩放下，对照新旧窗口走完对应流程，再核对最小窗口和缩放边界。[界面设计基准](refactor/design/ui/components.md#existing-ui) · [代表场景](refactor/verification/scenarios/ui.md#baseline)

## 仓库范围

本仓库维护完整产品设计和已交付工程能力。桌面、八个公共包与 33 项官方扩展的目标归属见工作包。正式项目随所属工作包建立，成篇项目文档由 [W23](refactor/implementation/work-packages.md#w23) 按对象交付；实施期间维护 AGENTS 与 refactor，接口说明和代码注释随实现维护。

[Vantage、Kana、libmpv-node 和 oauth-relay](refactor/design/projects/README.md) 在各自独立仓库实现、验证与交付，并按合同接入。Web 客户端、官网和候选服务端留待相应项目启动时建立。

## 架构与实现

main 拥有事实与操作，renderer 拥有视图，preload 只开放窗口最小能力，extension-host 是独立共享 Node 进程。shared 只保存私有跨运行端接入合同及其必要的值校验与编码。公共包使用构建后的 exports，SDK 的纯模块选择桌面公开能力，Node 与 Webview 入口实现接入，官方扩展不导入应用私有代码。

数据、错误、并发、取消与资源寿命遵循所属设计。执行与检查覆盖约定的完整范围，失败按合同交付，合法空值与错误分别表达。

## 验证与交付

交付前，按调用顺序审阅格式化后的代码。核对操作成功时返回什么，失败或取消时已保存哪些数据、由哪个模块释放资源，并确认相关规则的定义位置。

测试按[数据隔离规则](refactor/verification/acceptance.md#isolation)使用专用样本和独立的数据目录。Node、浏览器、Electron Node 模式与实际 Electron 分别运行。声明检查遵守[类型分工](refactor/design/engineering/workspace.md#declaration-checks)。普通 check 负责全仓基础检查。自动 CI 按[包及其宿主](refactor/design/engineering/workspace.md#ci-selection)运行各包的完整验证入口，单项复现按包、任务和宿主选择。

工作包界定交付范围，[实施状态](refactor/implementation/status.md)记录实际进度，在交付状态变化时更新。验证材料按[实际用途](refactor/design/engineering/documentation.md#evidence)维护。通用文档维护现行规则与必要依据，Git 与 PR 承载修改经过，见[文档归属](refactor/design/engineering/documentation.md#owners)。

本轮首次公开发行、正式仓库接续和生产服务切换由 [W25](refactor/implementation/work-packages.md#w25) 在整体验收后完成。构建、测试和打包不隐含外部发布；仓库重建、npm 发布、平台签署身份及部署按实际授权处理，超出任务范围的对外操作先讨论。未取得的六目标、签名或后端运行证据保持未完成。
