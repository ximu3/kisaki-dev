# Kisaki

## 工作原则

**整体判断优先于机械执行。** 要求或方案出现原则、正确性、整体质量或技术实践问题时，按[整体判断](refactor/design/engineering/conventions.md#judgment)审视相关设计，说明依据、影响、选项与建议，由用户决定方向。涉及模型、主要行为、公开合同、架构边界或交付范围的取舍遵守[实施讨论规则](refactor/implementation/work-packages.md#unexpected-issues)；既定合同内的修复与验证由实施者完成。重要判断查阅相关社区、维护者与成熟项目实践，并核对实际工具能力。

**简洁、清晰、干净与克制具有同等首要地位。** 它们覆盖设计文档、代码、测试、防御、限制和工程流程；完整要求由[共同原则](refactor/design/engineering/conventions.md#quality)定义。

**文件、目录组织与逻辑分段都是可读性和可维护性要求，实施与审阅时都须主动核对。** 代码、测试和文档按职责与实际阅读、修改路径组织，名称与层次直接表达边界和协作关系；拆分与合并遵守[组织规则](refactor/design/engineering/conventions.md#source-layout)。TypeScript 多文件主题与自身入口集中在同一目录。独立声明、方法职责与流程阶段保留清楚的分组和空行，同一步骤内保持紧凑，具体遵守[逻辑分段](refactor/design/engineering/conventions.md#logical-sections)。收尾时沿正常、失败、取消与清理路径审阅，同时核对文件归属、目录层次与分段是否表达实际逻辑；格式、类型和测试通过不能代替人工判断。

## 任务入口与范围

沟通默认使用简体中文。

**开展设计讨论、实施或审阅前，必须全面、深入阅读 `refactor/` 文档，理解整体设计及各部分之间的关系与约束。** 从 [refactor/README.md](refactor/README.md) 出发，沿目录与交叉引用通读设计、实施和验收要求，结合当前工作包核对职责、依赖、公开合同与交付边界；不能仅凭摘要、关键词检索或局部条文作出判断。

代码、组织与说明遵守[共用工程规范](refactor/design/engineering/conventions.md)，环境准备、可运行命令和当前源码职责见[当前工程与开发](refactor/implementation/development.md)。

本仓库维护完整产品设计和已交付工程能力。桌面、八个公共包与 33 项官方扩展的目标归属见工作包。正式项目随所属工作包建立，成篇项目文档由 [W23](refactor/implementation/work-packages.md#w23) 按对象交付；实施期间维护 AGENTS 与 refactor，接口说明和代码注释随实现维护。旧项目仅用于核对已确认的行为与资源保留要求，实现独立设计。

Vantage、Kana、libmpv-node 和 oauth-relay 在各自独立仓库实现、验证与交付，并按合同接入。Web 客户端、官网和候选服务端不在当前交付范围，不预建源码。

## 架构与实现

main 拥有事实与操作，renderer 拥有视图，preload 只开放窗口最小能力，extension-host 是独立共享 Node 进程。shared 只保存私有跨运行端接入合同及其必要的值校验与编码。公共包使用构建后的 exports，SDK 的纯模块选择桌面公开能力，Node 与 Webview 入口实现接入，官方扩展不导入应用私有代码。

数据、错误、并发、取消与资源寿命遵循所属设计。失败不通过缩减范围、返回空值或关闭检查消除。

## 验证与交付

测试按[数据隔离规则](refactor/verification/acceptance.md#isolation)使用专用样本和独立的数据目录。Node、浏览器、Electron Node 模式与实际 Electron 分别运行。声明检查遵守[类型分工](refactor/design/engineering/workspace.md#declaration-checks)。普通 check 不包含真实桌面、制品和性能验收；按实际影响选择验证。

交付状态变化时更新[实施状态](refactor/implementation/status.md)，验证材料按[实际用途](refactor/design/engineering/documentation.md#evidence)维护。通用文档维护现行规则与必要依据，Git 与 PR 承载修改经过，见[文档归属](refactor/design/engineering/documentation.md#owners)。

本轮首次公开发行、正式仓库接续和生产服务切换由 [W25](refactor/implementation/work-packages.md#w25) 在整体验收后完成。构建、测试和打包不隐含外部发布；仓库重建、npm 发布、平台签署身份及部署按实际授权处理，超出任务范围的对外操作先讨论。未取得的六目标、签名或后端运行证据保持未完成。
