# 设计目录

理解整体先读[产品](product.md)、[架构](architecture.md)和[通信](communication.md)，具体实现按下表进入所属主题。

所有主题以[现代化、简洁、清晰、干净与克制](engineering/conventions.md#quality)为首要原则，从实际目标与完整职责形成设计，并落实[终态实现与整体一致性](engineering/conventions.md#final-state)。[可读性](engineering/conventions.md#readability-principle)、[编码风格与逻辑分段](engineering/conventions.md#logical-sections)和[原生能力](engineering/conventions.md#simplicity-native)约束表达与实现；既有设计、限制和验证要求同样接受必要性与维护成本的审查。

| 主题     | 入口                                                            |
| -------- | --------------------------------------------------------------- |
| 领域能力 | [模型、资料库、文件、会话、记录和应用能力](domains/README.md)   |
| 界面     | [共同交互、状态、导航、浏览和本地化](ui/README.md)              |
| 扩展     | [运行合同、作者工具、官方来源及导入器](extensions/README.md)    |
| 独立项目 | [Vantage、Kana、libmpv-node、oauth-relay](projects/README.md)   |
| 工程     | [工作区、数据库、网络、构建、发行与维护](engineering/README.md) |

## 共同实施要求

实现遵守[编码与实现质量](engineering/conventions.md)、[界面文案](ui/components.md#copy)和[项目文档](engineering/documentation.md#owners)规范。

[产品判断原则](product.md#judgment)用于评价整体取舍。防御分支按[边界与风险](engineering/conventions.md#proportionality)决定，长期用例按[验证价值](engineering/conventions.md#test-retention)保留。设计正文和界面文案按各自读者需要的事实、条件与结果取舍。

桌面本体、公共包、官方扩展和独立项目遵守同一[设计充分性要求](engineering/conventions.md#design-completion)。影响关键决定的外部事实与技术可行性按[设计验证](../verification/acceptance.md#design-validation)在定稿前核实，验证结果用于修订设计；实施工作包接手已明确且有依据的方案。

macOS／Linux 的设计遵守[平台依据规则](../verification/acceptance.md#platform-evidence)。运行验证见[目标环境安排](engineering/build.md#platform-testing)与[运行覆盖规则](../verification/acceptance.md#runtime-coverage)。
