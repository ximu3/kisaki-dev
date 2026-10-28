# @kisaki3/extension-cli

当前 config 入口提供 ExtensionBuildConfig 与 defineConfig，供官方扩展配置使用，导入不执行 I/O。kisx 命令、模板和程序化作者工作流由 W08 交付；当前不声明尚未实现的 bin。

extension 入口现提供 launchDevelopmentApplication：直接启动显式可执行文件，通过 JSON 父子 IPC 等待就绪，传入隔离 profile，并拥有实际进程寿命。stop 可返回 cancelled；exited 只依据进程真实退出，terminate 是调用方明确要求的强制结束。signal 只取消启动，startupTimeoutMs 只限制调用方选择的启动阶段，不限制用户退出决定。config 仍按纯环境检查，extension 的进程实现按 Node 环境检查。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm run pack` 生成 `out/package.tgz`；`pnpm check:package` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/desktop/consumers` 验证。

`pnpm test` 在普通 Node 中通过隔离子进程验证开发启动器的就绪、取消退出和实际结束。根 Turbo 测试入口按依赖准备上游公共包输出；真实桌面会话与应用退出仍由应用的开发回归验证。

本包采用 MIT；正式合同与后续范围见 [工作包](../../../../refactor/implementation/work-packages.md)。

## 配置文件

| 文件                                                                           | 用途                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [tsconfig.json](tsconfig.json)                                                 | 本包的类型检查入口，通过 references 组织源码和工程项目。     |
| [config/typescript/tsconfig.lib.json](config/typescript/tsconfig.lib.json)     | 检查不执行 I/O 的扩展构建配置合同。                          |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json) | 使用 Node 类型基线检查本包构建工具与根目录 TypeScript 配置。 |
| [config/typescript/tsconfig.node.json](config/typescript/tsconfig.node.json)   | 检查开发应用启动器的 Node 源码，并作为本包构建的类型配置。   |
| [config/typescript/tsconfig.tests.json](config/typescript/tsconfig.tests.json) | 检查启动器集成测试及其子进程试件。                           |
