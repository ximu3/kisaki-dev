# IGDB

本目录维护官方 IGDB 扩展的工程配置，项目包名为 `@kisaki3/ext-igdb`。目标能力与映射见[接入设计](../../../../../refactor/design/extensions/sources/igdb.md)，实现与制品状态见[逐项交付表](../../../../../refactor/implementation/delivery-checklist.md#extensions)。

| 文件                                 | 用途                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| [package.json](package.json)         | 项目元信息、工作区依赖，以及 `typecheck`、`lint` 入口。 |
| [kisx.config.ts](kisx.config.ts)     | 声明扩展构建输入。                                      |
| [tsconfig.json](tsconfig.json)       | 使用 Node 类型基线检查本项目的工程配置。                |
| [eslint.config.ts](eslint.config.ts) | 使用公共工程规则检查本项目。                            |

环境准备与检查方式见[协作指南](../../../../../CONTRIBUTING.md)。
