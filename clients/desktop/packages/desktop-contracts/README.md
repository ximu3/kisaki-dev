# @kisaki3/desktop-contracts

本包拥有桌面业务的纯值、运行校验、调用与事件合同。数据库、Electron、资源读写与业务执行由各自实现负责；导入纯入口不启动运行服务。

## 公开入口

| 导入路径                                                                          | 内容                                                                 |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `@kisaki3/desktop-contracts`                                                      | 共享错误、身份、日期类型、执行和链接合同。领域能力由下列子入口提供。 |
| `/library`、`/metadata`、`/ingest`、`/scanner`、`/sessions`                       | 资料、查询、编辑与图写入，资料获取与采用，扫描及使用会话。           |
| `/date`、`/geometry`、`/json`、`/definition`、`/paths`、`/text-rules`             | 领域值与纯解析。                                                     |
| `/appearance`、`/fonts`、`/preferences`、`/ui`、`/search`                         | 外观、偏好、界面与搜索合同。                                         |
| `/execution`、`/errors`、`/resources`、`/images`、`/network`、`/tasks`、`/events` | 执行、部分结果、资源寿命、网络与后台事件。                           |
| `/extensions`、`/updates`、`/onboarding`、`/deeplink`                             | 本体管理与入口合同。                                                 |
| `/i18n`、`/i18n/english`                                                          | 唯一英语消息源、参数类型及翻译校验。                                 |
| `/development`                                                                    | 开发启动参数、有限消息类型、协议版本及消息校验。                     |

development 入口提供父子开发消息、启动参数名、协议版本与纯校验，供应用和 extension-cli 共同消费。ready 的 apiVersion 表示实际扩展运行能力；null 表示该应用不提供扩展加载。构建采用和激活结果分别表达事实。

## 构建与验证

在本包目录运行：

| 命令                 | 结果                                                            |
| -------------------- | --------------------------------------------------------------- |
| `pnpm build`         | 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。 |
| `pnpm run pack`      | 生成 `out/package.tgz`。                                        |
| `pnpm check:package` | 使用 publint 与 Are the Types Wrong 检查已完成的 tarball。      |
| `pnpm typecheck`     | 检查本包源码及工程配置。                                        |
| `pnpm lint`          | 检查本包的工程与源码规则。                                      |

仓库根的 `tests/desktop/consumers` 使用真实 tarball 验证跨包消费。

`pnpm test` 在普通 Node 中验证纯值、结构校验与结果语义，单元测试与被测源码相邻。英语 ICU 文案改变后运行 `pnpm generate:messages` 更新消息参数声明；测试核对同步，构建只消费生成文件。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
