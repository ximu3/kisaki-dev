# Kisaki

## 工作原则

**整体判断优先于机械执行。** 要求或方案出现原则、正确性、整体质量或技术实践问题时，按[整体判断](refactor/design/engineering/conventions.md#judgment)审视相关设计，说明依据、影响、选项与建议，由用户决定方向。涉及模型、主要行为、公开合同、架构边界或交付范围的取舍遵守[实施讨论规则](refactor/implementation/work-packages.md#unexpected-issues)；既定合同内的修复与验证由实施者完成。重要判断查阅相关社区、维护者与成熟项目实践，并核对实际工具能力。

**简洁、清晰、干净与克制具有同等首要地位。** 设计、实现、审阅和交付都以这四项[共同原则](refactor/design/engineering/conventions.md#quality)为准。

**按终态设计和实现。** 从已确认的目标、合同和资源归属推导方案，现有结构与目标冲突时重做受影响的部分。工作包可以分步实施，交付时正式入口须完整履行承诺，失败与清理也有确定的结果。同类问题在共同拥有层修正，同步受影响的调用方、测试和说明，清理失去用途的旧路径。见[终态与整体一致](refactor/design/engineering/conventions.md#final-state)和[工作包边界](refactor/implementation/work-packages.md#boundary)。

**防御和测试要极度克制。** 只为终态中仍有明确后果、现有保证尚未覆盖的真实风险保留防御分支。能从模型或流程中消除错误状态时，修正根因并清理相应的补救分支。外部输入、权限、持久化和副作用的风险由所属边界处理，内部调用直接依赖已有保证。删去重复校验和只为假想异常设置的分支。

日常改动默认不追加防御或回归用例。修复可用已有检查或一次性复现核实。只有关键行为需要持续验证、其余检查会漏掉具体错误时，才保留能检出它的最小用例。同一保证在所属层验证，接入只核对新增风险。见[边界与投入](refactor/design/engineering/conventions.md#proportionality)和[验证范围](refactor/verification/acceptance.md#verification-scope)。

**用干净、直接的正向叙述。** 设计、文档、注释和界面文案围绕读者的任务展开，直接说明采用的做法和实际结果。删去上下文已说清的内容、重复强调和为假想疑问写的排除说明。影响理解、选择或操作的条件、差异和失败后果应就近交代，理解取舍所需的理由与有用的对照应保留。见[写作要求](refactor/design/engineering/documentation.md#writing)和[界面文案](refactor/design/ui/components.md#copy)。

**实施与审阅都要主动核对文件、目录与逻辑分段。** 代码、测试和文档按职责与实际阅读、修改路径组织，名称和层次直接表达边界与协作关系。入口遵循语言和工具的原生规则。普通 TypeScript 多文件主题和成篇文档按主题集中，所需入口与内容放在同一目录，不以同级前缀文件模拟内部层级。用分组和空行区分独立声明、方法职责与流程阶段，同一步骤保持紧凑。收尾时沿正常、失败、取消与清理路径人工审阅，核对[主题组织](refactor/design/engineering/conventions.md#source-layout)、[导入与公开入口](refactor/design/engineering/conventions.md#module-imports)与[逻辑分段](refactor/design/engineering/conventions.md#logical-sections)。

## 任务入口与范围

沟通默认使用简体中文。

**开展设计讨论、实施或审阅前，必须全面、深入阅读 `refactor/` 文档，理解整体设计及各部分之间的关系与约束。** 从 [refactor/README.md](refactor/README.md) 出发，沿目录与交叉引用通读设计、实施和验收要求，结合当前工作包核对职责、依赖、公开合同与交付边界；不能仅凭摘要、关键词检索或局部条文作出判断。

代码、组织与说明遵守[共用工程规范](refactor/design/engineering/conventions.md)，环境准备、可运行命令和当前源码职责见[当前工程与开发](refactor/implementation/development.md)。

本仓库维护完整产品设计和已交付工程能力。桌面、八个公共包与 33 项官方扩展的目标归属见工作包。正式项目随所属工作包建立，成篇项目文档由 [W23](refactor/implementation/work-packages.md#w23) 按对象交付；实施期间维护 AGENTS 与 refactor，接口说明和代码注释随实现维护。旧项目仅用于核对已确认的行为与资源保留要求，实现独立设计。

Vantage、Kana、libmpv-node 和 oauth-relay 在各自独立仓库实现、验证与交付，并按合同接入。Web 客户端、官网和候选服务端留待相应项目启动时建立。

## 架构与实现

main 拥有事实与操作，renderer 拥有视图，preload 只开放窗口最小能力，extension-host 是独立共享 Node 进程。shared 只保存私有跨运行端接入合同及其必要的值校验与编码。公共包使用构建后的 exports，SDK 的纯模块选择桌面公开能力，Node 与 Webview 入口实现接入，官方扩展不导入应用私有代码。

数据、错误、并发、取消与资源寿命遵循所属设计。执行与检查覆盖约定的完整范围，失败按合同交付，合法空值与错误分别表达。

## 验证与交付

测试按[数据隔离规则](refactor/verification/acceptance.md#isolation)使用专用样本和独立的数据目录。Node、浏览器、Electron Node 模式与实际 Electron 分别运行。声明检查遵守[类型分工](refactor/design/engineering/workspace.md#declaration-checks)。普通 check 不包含真实桌面、制品和性能验收；按实际影响选择验证。

工作包界定交付范围，[实施状态](refactor/implementation/status.md)记录实际进度，在交付状态变化时更新。验证材料按[实际用途](refactor/design/engineering/documentation.md#evidence)维护。通用文档维护现行规则与必要依据，Git 与 PR 承载修改经过，见[文档归属](refactor/design/engineering/documentation.md#owners)。

本轮首次公开发行、正式仓库接续和生产服务切换由 [W25](refactor/implementation/work-packages.md#w25) 在整体验收后完成。构建、测试和打包不隐含外部发布；仓库重建、npm 发布、平台签署身份及部署按实际授权处理，超出任务范围的对外操作先讨论。未取得的六目标、签名或后端运行证据保持未完成。
