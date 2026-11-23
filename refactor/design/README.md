# 设计目录

[产品范围](product.md)介绍主要功能和数据模型，[运行架构](architecture.md)说明各进程的职责，[调用与事件](communication.md)说明进程之间如何通信。

各主题采用相同的[质量标准](engineering/conventions.md#quality)。设计和审阅时，根据用户要完成的操作比较方案，核对各模块的实现能否满足[交付要求](engineering/conventions.md#final-state)。已有功能限制和验证要求也要检查是否必要、需要多少维护工作。

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

桌面本体、公共包、官方扩展和独立项目遵守同一[设计充分性要求](engineering/conventions.md#design-completion)。定稿前，按[设计验证](../verification/acceptance.md#design-validation)核实会影响方案的外部条件，验证关键做法是否可行。根据结果修订设计，再交给相应工作包实施。

macOS／Linux 的设计遵守[平台依据规则](../verification/acceptance.md#platform-evidence)。运行验证见[目标环境安排](engineering/build.md#platform-testing)与[运行覆盖规则](../verification/acceptance.md#runtime-coverage)。
