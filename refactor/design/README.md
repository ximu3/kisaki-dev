# 设计目录

理解整体先读[产品](product.md)、[架构](architecture.md)和[通信](communication.md)，具体实现按下表进入所属主题。

所有主题共同遵守[简洁、原生与适度复杂度](engineering/conventions.md#simplicity-native)。用户操作、内部机制和工程流程都优先直接、惯用的方案；平台原生能力、控件语义与系统习惯共同参与取舍，现有设计也按同一准则复核。

| 主题     | 入口                                                            |
| -------- | --------------------------------------------------------------- |
| 领域能力 | [模型、资料库、文件、会话、记录和应用能力](domains/README.md)   |
| 界面     | [共同交互、状态、导航、浏览和本地化](ui/README.md)              |
| 扩展     | [运行合同、作者工具、官方来源及导入器](extensions/README.md)    |
| 独立项目 | [Vantage、Kana、libmpv-node、oauth-relay](projects/README.md)   |
| 工程     | [工作区、数据库、网络、构建、发行与维护](engineering/README.md) |

## 共同实施要求

实现遵守[编码与实现质量](engineering/conventions.md)、[界面文案](ui/components.md#copy)和[项目文档](engineering/documentation.md#owners)规范。

[产品判断原则](product.md#judgment)用于评价整体取舍，[不过度防御](engineering/conventions.md#validation)规定边界检查及必要恢复的判断依据，覆盖代码、交互、界面文案和使用说明。具体机制按用户目标、实际后果和总复杂性决定。

桌面本体、公共包、官方扩展和独立项目遵守同一[设计充分性要求](engineering/conventions.md#design-completion)。影响关键决定的外部事实与技术可行性按[设计验证](../verification/acceptance.md#design-validation)在定稿前核实，验证结果用于修订设计；实施工作包接手已明确且有依据的方案。

macOS／Linux 的设计遵守[平台依据规则](../verification/acceptance.md#platform-evidence)。运行验证见[目标环境安排](engineering/build.md#platform-testing)与[运行覆盖规则](../verification/acceptance.md#runtime-coverage)。
