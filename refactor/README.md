# Kisaki 重构设计与实现规格

本目录规定 Kisaki 的产品范围、数据模型、接口、运行行为、界面和工程交付。设计正文说明系统应如何工作，[工作包](implementation/work-packages.md)安排实施依赖，[验收标准](verification/acceptance.md)规定完成条件，[实施状态](implementation/status.md)记录实际进度与证据。

旧项目位于 `F:/project/3/kisaki`。

<a id="rewrite"></a>

按已确认目标完整重设计架构、重写代码并重建工程。新方案独立推导，不受现有实现及其目录、命名、分层、抽象和配套规范的任何影响；具体约束见[编码与实现质量](design/engineering/conventions.md#quality)。

本目录定义完整交付的产品与技术合同，能力范围由产品目的、公开职责和实际运行约束决定。各实施阶段共同完成这份合同，阶段划分、原型覆盖和验证进度只安排工作顺序。尚未解决的设计事项记录为未完成，在形成完整实施依据前继续闭合。

方案取舍遵守[产品判断原则](design/product.md#judgment)，设计是否足以实施按[设计充分性与实现自由](design/engineering/conventions.md#design-completion)核对。关键业务与公开语义在规格中确定，局部实现选择在明确约束内完成。

当前交付包括 clients/desktop 下的桌面本体、八个公共包、33 项官方扩展及四个[独立技术项目](design/projects/README.md#delivery)。[顶层分组](design/engineering/layout.md#workspace)中的 Web、官网和候选服务端不在当前桌面交付范围内。

现有界面与交互体验整体沿用，按规格作局部调整并补充新增能力；组件与内部结构按新架构独立设计，见[现有 UI 保留原则](design/ui/components.md#existing-ui)。

<a id="reading"></a>

## 按任务阅读

| 要做的事             | 阅读入口                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 理解产品与整体设计   | [产品范围](design/product.md) → [运行架构](design/architecture.md) → [调用与事件](design/communication.md)                              |
| 实现一项本体能力     | [领域规则](design/domains/README.md)、[界面与交互](design/ui/README.md)，再查对应[工作包](implementation/work-packages.md)              |
| 开发或接入扩展       | [扩展合同](design/extensions/README.md) → [33 项官方目录](design/extensions/catalog.md) → 对应来源或导入器                              |
| 实现独立技术项目     | [Vantage、Kana、libmpv-node 与 oauth-relay](design/projects/README.md)，以及[Kisaki 接入](design/engineering/integrations.md)           |
| 构建、发布或维护工程 | [工程与发行](design/engineering/README.md)                                                                                              |
| 核对要求与交付       | [R01–R32 覆盖矩阵](verification/coverage.md) → [A01–A33 验收](verification/acceptance.md) → [验证证据](verification/evidence/README.md) |
| 了解当前进度         | [实施状态](implementation/status.md)                                                                                                    |

完整主题导航见[设计目录](design/README.md)。

<a id="documents"></a>

## 文档归属

| 文档                                         | 唯一责任                                           |
| -------------------------------------------- | -------------------------------------------------- |
| `design/`                                    | 当前产品与技术规则，以及理解这些规则所需的取舍理由 |
| `implementation/work-packages.md`            | 实施依赖、交付内容与完成门槛，通过链接引用设计     |
| `implementation/status.md`                   | 当前设计、实施、验收和发布进度                     |
| `implementation/delivery-checklist.md`       | 使用链路、逐项扩展与独立项目的实施阶段状态         |
| `verification/acceptance.md` 与 `scenarios/` | 测试环境、具体场景、预期结果与证据要求             |
| `verification/coverage.md`                   | R／W／A 对应及跨领域、逐来源覆盖                   |
| `verification/evidence/`                     | 来源依据、方案比较、试件与实测结果                 |

每条规则由所属主题完整定义，其他文档链接引用。证据记录对应版本、环境与实际结果，当前设计、实现和验收进度由状态页维护。

<a id="implementation"></a>

## 实施与验收

按[工作包](implementation/work-packages.md)推进，并在[实施状态](implementation/status.md)登记实际结果。设计验证、正式实现、平台运行、制品验证和发布分别记录。

实施中需要改变模型、主要行为、公开合同、架构边界或交付范围时，遵守[实施讨论规则](implementation/work-packages.md#unexpected-issues)。现有合同内的实现问题由实施者完成修复与验证。
