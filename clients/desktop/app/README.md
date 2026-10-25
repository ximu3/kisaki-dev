# 桌面应用工程

本工程统一管理 main、preload、renderer、extension-host 和私有原生代码。当前可运行四类窗口的工程外壳，提供隔离开发、受控退出和原生资源装配；资料库与完整产品界面按 W01–W10 实现。

程序由 `config/vite` 中各自的 `vite.config.*.ts` 编译。主进程在 ready 前确定路径，以 `kisaki-app://native/` 只读提供本次构建声明的窗口资源；预加载脚本是独立、完整打包的 CommonJS。主进程的启动就绪等待实际 renderer 挂载信号，HTML 加载成功本身不算界面就绪。

根 `tsconfig.json` 关联 `config/typescript` 中的七个类型项目，`typecheck` 通过 `tsc -b` 执行，增量信息保存在 `.cache/typescript`。根 `vitest.config.ts` 与 `playwright.config.ts` 分别提供常规 Node 测试和桌面端到端测试；浏览器、原生、开发链路与制品配置归 `config/vitest`，性能配置归 `config/playwright`。各入口与对应运行环境见根 [验证任务](../../../CONTRIBUTING.md#验证任务)。

常规 Node 测试包含 `tests/integration` 中不依赖 Electron ABI 的接入用例；其中的 `database` 与 `native` 套件由 `test:native` 在开发 Electron 的 Node 模式下单独执行。

扩展宿主由 utilityProcess 运行，保留正式关闭 RunAsNode 和调试相关 fuses 的条件。应用 package.json 的 imports 定义私有原生入口 `#native`，主进程与原生集成测试共同消费；主进程构建将其编入输出，产物不依赖源码映射。入口导入不加载二进制；装配明确选择部署路径，并核对运行构建身份和原生字节。

`tools/build`、`dev`、`resources`、`native` 和 `package` 分别拥有有限构建、开发会话、固定资源、原生编译与打包，`tools/clean.ts` 提供清理任务。类型与测试脚本直接调用所属运行器和配置。跨工作流的路径、目标、公共包输入与摘要归 `tools/lib`，开发 Electron 定位归 `tools/dev`；跨工程复用的候选交接、命令执行和 CLI 收尾通过 `@repo-tools/output`、`@repo-tools/process`、`@repo-tools/cli` 引用根共用源码，取消信号由调用方显式传入。生成的运行清单与载体身份共用 `src/shared` 中的定义。任务的输入、环境和清理规则见根 [开发指南](../../../CONTRIBUTING.md)，测试归属与正式设计见 [源码布局](../../../refactor/design/engineering/layout.md)。

SQLite 13.0.3 使用包内 Node-API 预编译绑定，资源工作流只装配所选目标；测试在启动前选择 Electron Node 宿主，直接验证将要交付的同一绑定，不在共享 node_modules 内切换 ABI。

性能配置保存了正式代表负载和共同预算。当前运行测量只覆盖 W00 工程外壳的 20 次新进程启动及退出；完整资料、媒体、后台操作与旧版比较由对应工作包接续。

`packaging` 保存打包专用静态输入的工程归属，当前只有说明；执行逻辑在 `tools/package`，生成文件在 `dist`。媒体信息与播放经 libmpv-node 接入，本体不再准备独立 ffprobe。
