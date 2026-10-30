# @kisaki3/desktop-contracts

包根与 errors 入口提供 ErrorSummary 和 ExecutionFailure<Result>，表达安全错误与已经成立的部分结果。数据库、Electron 与业务实现由各自拥有者管理。

## 公开入口

| 导入路径                                                          | 内容                                             |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `@kisaki3/desktop-contracts`、`@kisaki3/desktop-contracts/errors` | ErrorSummary 与 ExecutionFailure<Result>。       |
| `@kisaki3/desktop-contracts/development`                          | 开发启动参数、有限消息类型、协议版本及消息校验。 |

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

`pnpm test` 在普通 Node 中验证本包的纯开发消息合同，单元测试与被测源码相邻。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
