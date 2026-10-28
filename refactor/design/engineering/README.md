# 工程与发行

工程工作首先遵守[终态实现与整体一致性](conventions.md#final-state)，按完整职责统一组织实现、工具与验证；[可读性](conventions.md#readability-principle)约束组织、目录、命名、代码和说明，使工程可以顺着职责理解与维护；[简洁、原生与适度复杂度](conventions.md#simplicity-native)用于选择直接的机制和惯用流程。既有结构与检查入口也按同一准则审查。

| 主题         | 完整规则                                                                                |
| ------------ | --------------------------------------------------------------------------------------- |
| 源码位置     | [仓库、tools、测试、程序入口、主进程、窗口与样式](layout.md)                            |
| 工程与公共包 | [工作区、八个公共包、工具与 hooks](workspace.md)                                        |
| 数据持久性   | [SQLite、Drizzle、迁移与实际驱动](database.md)                                          |
| 容量与性能   | [代表负载、资源预算与比较方法](performance.md)                                          |
| 跨进程协议   | [有限帧、版本、实例与开发握手](protocols.md)                                            |
| 网络         | [宿主 HTTP、代理、流、Cookie 与取消](network.md)                                        |
| 私有原生能力 | [本体原生工程、Node 入口、类型、运行与交付](native.md)                                  |
| 桌面制品     | [构建、六目标、安装、便携、更新与签名](build.md)                                        |
| 独立项目消费 | [Kisaki 接入责任](integrations.md)；库和服务自身合同见[独立项目](../projects/README.md) |
| 仓库与身份   | [来源存档、仓库、npm 与部署身份](repository.md)                                         |
| 发行         | [版本、固定制品、发行说明与元数据](releases.md)                                         |
| 许可         | [代码、独立扩展、品牌和第三方材料](licensing.md)                                        |
| 实现质量     | [可读性、源码语言、命名、注释、错误与运行规范](conventions.md)                          |
| 长期文档     | [项目文档、协作入口与 skill](documentation.md)                                          |
