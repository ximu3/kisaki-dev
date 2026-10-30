# @kisaki3/extension-cli

config 入口提供 ExtensionBuildConfig 与 defineConfig，声明扩展构建输入，导入不执行 I/O。extension 入口提供 Node 开发应用启动与进程控制。

## 公开入口

| 导入路径                           | 内容                                                    |
| ---------------------------------- | ------------------------------------------------------- |
| `@kisaki3/extension-cli/config`    | 纯构建配置类型与 defineConfig。                         |
| `@kisaki3/extension-cli/extension` | Node 开发启动器 launchDevelopmentApplication 及其类型。 |

`launchDevelopmentApplication` 直接启动显式可执行文件，传入隔离 profile，通过 JSON 父子 IPC 等待就绪，并拥有实际进程寿命。

返回句柄的 `stop()` 请求正常退出，可以返回 `cancelled`；`exited` 只依据进程真实退出完成；`terminate()` 执行调用方明确要求的强制结束。

`signal` 只取消启动。`startupTimeoutMs` 只限制调用方选择的启动阶段，不限制用户退出决定。

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

`pnpm test` 在普通 Node 中通过隔离子进程验证开发启动器的就绪、取消退出和实际结束。根 Turbo 测试入口按依赖准备上游公共包输出；真实桌面会话与应用退出仍由应用的开发回归验证。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
