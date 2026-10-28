# @kisaki3/desktop-contracts

包根与 errors 入口提供 ErrorSummary 和 ExecutionFailure<Result>，表达安全错误与已经成立的部分结果。数据库、Electron 与业务实现由各自拥有者管理。

development 入口提供父子开发消息、启动参数名、协议版本与纯校验，供应用和 extension-cli 共同消费。ready 的 apiVersion 表示实际扩展运行能力；null 表示该应用不提供扩展加载。构建采用和激活结果分别表达事实。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm run pack` 生成 `out/package.tgz`；`pnpm check:package` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/desktop/consumers` 验证。

`pnpm test` 在普通 Node 中验证本包的纯开发消息合同，单元测试与被测源码相邻。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。

## 配置文件

| 文件                                                                           | 用途                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [tsconfig.json](tsconfig.json)                                                 | 本包的类型检查入口，通过 references 组织源码和工程项目。     |
| [config/typescript/tsconfig.lib.json](config/typescript/tsconfig.lib.json)     | 检查本包源码，并为声明构建提供类型配置。                     |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json) | 使用 Node 类型基线检查本包构建工具与根目录 TypeScript 配置。 |
| [config/typescript/tsconfig.tests.json](config/typescript/tsconfig.tests.json) | 检查与纯合同源码相邻的 Node 测试。                           |
