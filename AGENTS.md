# Kisaki

## 协作与讨论

沟通默认使用简体中文。

**讨论首先要有独立见解。** 主动查证关键事实，检验提问中的假设和自己的初步看法。需要取舍时，明确说出自己的主张和理由。有分歧就坦诚说明，证据支持现状就建议保留。见[讨论与独立判断](refactor/design/engineering/conventions.md#discussion)。

## 任务入口

**先建立完整的设计理解。** 开展设计讨论、实施或审阅前，必须全面、深入阅读 `refactor/`，理解整体目标及各部分之间的关系与约束。从 [refactor/README.md](refactor/README.md) 出发，沿目录与交叉引用通读设计、实施和验收要求，结合当前工作包核对职责、依赖、公开合同与交付边界；不能仅凭摘要、关键词检索或局部条文作出判断。

**按产品目标选择实现。** 先明确使用者要完成的任务、结果由谁负责，再比较能履行完整合同的做法。查证目标版本的能力与维护状况，在代表场景中检验体验、正确性、性能和维护复杂度，据此决定复用、组合或自行实现。见[判断与取舍](refactor/design/engineering/conventions.md#judgment)。

代码、组织与说明遵守[共用工程规范](refactor/design/engineering/conventions.md)，环境准备、可运行命令和当前源码职责见[当前工程与开发](refactor/implementation/development.md)。

根工程和工作区成员的命名工程任务统一写在所属 `vite.config.ts` 的 `run.tasks` 中，用 `pnpm exec vp run <任务>` 调用。包管理器生命周期、任务调用与直接运行工具的分工见[工作区任务入口](refactor/design/engineering/workspace.md#tasks)。

## 工作原则

**从全局出发思考、讨论、设计、改动和审阅。** 从完整的使用流程找出谁维护数据、谁定义规则。比较所有同类对象和入口，让同类对象按相同层次建模，并采用一致的命名、交互、风格和验收标准。遇到共有问题，在定义规则的模块修正，并更新所有受影响的调用方。差异须能由对象语义、资源归属或运行环境解释。具体判断与审查方法见[全局设计与一致性](refactor/design/engineering/conventions.md#global-design)。

**整体判断优先于机械执行。** 要求或方案出现原则、正确性、整体质量或技术实践问题时，按[整体判断](refactor/design/engineering/conventions.md#judgment)说明依据、影响、选项与建议，由用户决定方向。涉及模型、主要行为、公开合同、架构边界或交付范围的取舍遵守[实施讨论规则](refactor/implementation/work-packages.md#unexpected-issues)。既定合同内的修复与验证由实施者完成。

**编写时就按职责分段。** 文件概述和导入区后各空一行。独立声明和职责不同的步骤用一个空行分隔，同一步骤的语句保持紧凑。Solid 组件把同一交互的状态、派生与动作放在一起，呈现部分按可见区域组织。源码、测试、工具、配置和设计示例共同遵守[逻辑分段](refactor/design/engineering/conventions.md#logical-sections)，组件另见[TSX 风格](refactor/design/engineering/conventions.md#tsx-style)。

**现代化、简洁、清晰、干净与克制具有同等首要地位。** 设计、实现、审阅和交付都以这些[共同原则](refactor/design/engineering/conventions.md#quality)为准。

**质量与终态优先于实施成本。** 设计、实现、重构、规范、文档与验证，不以工作量、实施耗时或重做成本降低已确认目标和整体质量，或保留已知问题与不一致。运行性能、资源占用和长期维护复杂度仍按成果质量评估，具体遵守[判断与取舍](refactor/design/engineering/conventions.md#judgment)。

**按终态设计和实现。** 从已确认的目标、合同和资源归属推导方案，现有结构与目标冲突时重做受影响的部分。工作包可以分步实施。交付时，正式入口须支持全部约定操作，明确失败后保留的结果，并完成约定的资源清理。见[终态与整体一致](refactor/design/engineering/conventions.md#final-state)和[工作包边界](refactor/implementation/work-packages.md#boundary)。

**进行修正时，必须从根因出发，在完整影响范围内落实通用的终态方案。** 沿实际流程找到产生问题的规则、模型、流程或资源边界，由该职责的拥有者修正。同一根因涉及的入口和运行端统一接入，同步调用方、文档和验证，清理临时补救与失去用途的旧路径。见[修正规范](refactor/design/engineering/conventions.md#root-cause)。

**首次发行前，无须向后兼容本项目的历史实现。** 接口、数据格式、配置、命令和目录均可按目标重做。同步更新全部调用方，重建开发样本，删除失去用途的旧路径。各发行单位的起点及已有外部约定见[首次发行前的兼容范围](refactor/design/engineering/conventions.md#before-first-release)。

**旧项目仅作 UI 设计参考。** 涉及桌面界面与公共 UI 库时，阅读[参考工程](refactor/README.md)的 `.agents/skills/kisaki/references/ui-system.md` 和对应部件。可在旧工程根目录运行 `pnpm dev`，直接参考实际界面。旧 Kisaki 会自动加载已有的开发数据。产品行为、接口、资源与交付要求由本仓库现行规格定义。按[界面设计](refactor/design/ui/components.md#existing-ui)在正式窗口核对[代表场景](refactor/verification/scenarios/ui.md#baseline)。

**防御和测试要极度克制。** 只为终态中仍有明确后果、现有保证尚未覆盖的真实风险保留防御分支。能从模型或流程中消除错误状态时，修正根因并清理相应的补救分支。外部输入、权限、持久化和副作用的风险由所属边界处理，内部调用直接依赖已有保证。删去重复校验和只为假想异常设置的分支。

日常改动默认不追加防御或回归用例。修复可用已有检查或一次性复现核实。只有关键行为需要持续验证、其余检查会漏掉具体错误时，才保留能检出它的最小用例。同一保证在所属层验证，接入只核对新增风险。见[边界与投入](refactor/design/engineering/conventions.md#proportionality)和[验证范围](refactor/verification/acceptance.md#verification-scope)。

**用干净、直接的正向叙述。** 设计、文档、注释和界面文案围绕读者的任务展开，直接说明采用的做法和实际结果。删去上下文已说清的内容、重复强调和为假想疑问写的排除说明。影响理解、选择或操作的条件、差异和失败后果应就近交代，理解取舍所需的理由与有用的对照应保留。见[写作要求](refactor/design/engineering/documentation.md#writing)和[界面文案](refactor/design/ui/components.md#copy)。

**注释说明职责与调用合同。** 自维护源码提供文件概述和全部模块级具名声明的文档，工厂与解构遵循同一覆盖边界。对调用者可见的合同在定义处说明。函数和组件内部按需解释非直观的约束、次序与资源寿命，配置与生成源按所属规则维护。见[注释与说明](refactor/design/engineering/conventions.md#comments)。

**实施与审阅都要主动核对文件与目录。** 代码、测试和文档按职责与实际阅读、修改路径组织，名称和层次直接表达边界与协作关系。入口遵循语言和工具的原生规则。普通 TypeScript 多文件主题和成篇文档按主题集中，所需入口与内容放在同一目录，不以同级前缀文件模拟内部层级。收尾时核对[组织与命名](refactor/design/engineering/conventions.md#source-layout)和[导入与公开入口](refactor/design/engineering/conventions.md#module-imports)。

## 仓库范围

本仓库维护完整产品设计和已交付工程能力。桌面、八个公共包与 33 项官方扩展的目标归属见工作包。正式项目随所属工作包建立，成篇项目文档由 [W23](refactor/implementation/work-packages.md#w23) 按对象交付；实施期间维护 AGENTS 与 refactor，接口说明和代码注释随实现维护。

Vantage、Kana、libmpv-node 和 oauth-relay 在各自独立仓库实现、验证与交付，并按合同接入。Web 客户端、官网和候选服务端留待相应项目启动时建立。

## 架构与实现

main 拥有事实与操作，renderer 拥有视图，preload 只开放窗口最小能力，extension-host 是独立共享 Node 进程。shared 只保存私有跨运行端接入合同及其必要的值校验与编码。公共包使用构建后的 exports，SDK 的纯模块选择桌面公开能力，Node 与 Webview 入口实现接入，官方扩展不导入应用私有代码。

数据、错误、并发、取消与资源寿命遵循所属设计。执行与检查覆盖约定的完整范围，失败按合同交付，合法空值与错误分别表达。

## 验证与交付

**交付前必须人工复核分段。** 格式化后逐文件顺读本次改动涉及的完整声明和流程，检查能否从段落看出步骤转换，以及失败、取消和清理与正常路径的关系。独立职责挤在一起或同一步骤被拆散时，修正后再交付。

测试按[数据隔离规则](refactor/verification/acceptance.md#isolation)使用专用样本和独立的数据目录。Node、浏览器、Electron Node 模式与实际 Electron 分别运行。声明检查遵守[类型分工](refactor/design/engineering/workspace.md#declaration-checks)。普通 check 负责全仓基础检查。自动 CI 按[包及其宿主](refactor/design/engineering/workspace.md#ci-selection)运行各包的完整验证入口，单项复现按包、任务和宿主选择。

工作包界定交付范围，[实施状态](refactor/implementation/status.md)记录实际进度，在交付状态变化时更新。验证材料按[实际用途](refactor/design/engineering/documentation.md#evidence)维护。通用文档维护现行规则与必要依据，Git 与 PR 承载修改经过，见[文档归属](refactor/design/engineering/documentation.md#owners)。

本轮首次公开发行、正式仓库接续和生产服务切换由 [W25](refactor/implementation/work-packages.md#w25) 在整体验收后完成。构建、测试和打包不隐含外部发布；仓库重建、npm 发布、平台签署身份及部署按实际授权处理，超出任务范围的对外操作先讨论。未取得的六目标、签名或后端运行证据保持未完成。
