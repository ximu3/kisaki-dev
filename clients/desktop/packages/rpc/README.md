# @kisaki3/rpc

包根与 transport 入口提供环境无关的 MessageTransport 类型，定义消息发送、接收、关闭观察与资源释放的接入合同。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm run pack` 生成 `out/package.tgz`；`pnpm check:package` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/desktop/consumers` 验证。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。

## 配置文件

| 文件                                                                           | 用途                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [tsconfig.json](tsconfig.json)                                                 | 本包的类型检查入口，通过 references 组织源码和工程项目。     |
| [config/typescript/tsconfig.lib.json](config/typescript/tsconfig.lib.json)     | 检查本包源码，并为声明构建提供类型配置。                     |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json) | 使用 Node 类型基线检查本包构建工具与根目录 TypeScript 配置。 |
