# @kisaki3/desktop-contracts

当前包根与 errors 入口提供 ErrorSummary 和 ExecutionFailure<Result>，遵循 communication.md。完整领域值与操作由 W01 实现；数据库、Electron 与业务实现不进入本包。

development 入口提供父子开发消息、启动参数名、协议版本与纯校验，供应用和 extension-cli 共同消费。构建采用与激活的类型不表示当前 W00 已实现相应业务；现阶段应用的 ready 明确报告 apiVersion 为 null。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm run pack` 生成 `out/package.tgz`；`pnpm check:package` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/desktop/consumers` 验证。

`pnpm test` 在普通 Node 中验证本包的纯开发消息合同，单元测试与被测源码相邻。

本包采用 MIT；正式合同与后续范围见 [工作包](../../../../refactor/implementation/work-packages.md)。

## 配置文件

| 文件                                                                           | 用途                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [tsconfig.json](tsconfig.json)                                                 | 本包的类型检查入口，通过 references 组织源码和工程项目。     |
| [config/typescript/tsconfig.lib.json](config/typescript/tsconfig.lib.json)     | 检查本包源码，并为声明构建提供类型配置。                     |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json) | 使用 Node 类型基线检查本包构建工具与根目录 TypeScript 配置。 |
| [config/typescript/tsconfig.tests.json](config/typescript/tsconfig.tests.json) | 检查与纯合同源码相邻的 Node 测试。                           |
