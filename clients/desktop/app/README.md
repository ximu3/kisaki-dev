# 桌面应用工程

本工程统一管理 main、preload、renderer、extension-host 和私有原生代码。当前可运行四类窗口的工程外壳，提供隔离开发、受控退出和原生资源装配；完整产品的交付情况见[实施状态](../../../refactor/implementation/status.md)。

程序由 `config/vite` 中各自的 `vite.config.*.ts` 编译。主进程在 ready 前确定路径，以 `kisaki-app://native/` 只读提供本次构建声明的窗口资源；预加载脚本是独立、完整打包的 CommonJS。主进程的启动就绪等待实际 renderer 挂载信号，HTML 加载成功本身不算界面就绪。

根 `tsconfig.json` 关联 `config/typescript` 中的七个类型项目，`typecheck` 通过 `tsc -b` 执行，增量信息保存在 `.cache/typescript`。根 `vitest.config.ts` 与 `playwright.config.ts` 分别提供常规 Node 测试和桌面端到端测试；浏览器、原生、开发链路与制品配置归 `config/vitest`，性能配置归 `config/playwright`。各入口与对应运行环境见根 [验证任务](../../../CONTRIBUTING.md#验证任务)。

常规 Node 测试包含 `tests/integration` 中不依赖 Electron ABI 的接入用例；其中的 `database` 与 `native` 套件由 `test:native` 在开发 Electron 的 Node 模式下单独执行。

开发监听与输出清理在常规 Node 套件中通过真实 Vite、Chokidar 和文件系统验证。`test:dev` 保留实际 Electron 的退出取消、编译失败与改名恢复、公共包失败与页面交接，以及首次准备取消与重试。独立场景复用隔离工作区准备，各自关闭控制器并恢复自己的输入。

应用测试脚本直接消费已准备的输入，根 `desktop:test:native`、`desktop:test:e2e` 与 `desktop:test:performance` 先完成有限应用构建；`desktop:test:dev` 提前准备原生输出，由隔离开发会话完成应用构建。CI 为选中套件共用目标构建，具体触发范围由 `turbo.json` 的任务 inputs 维护；测试、文档或开发工具变更不自动要求重新测量性能和打包。

扩展宿主由 utilityProcess 运行，保留正式关闭 RunAsNode 和调试相关 fuses 的条件。应用 package.json 的 imports 定义私有原生入口 `#native`，主进程与原生集成测试共同消费；主进程构建将其编入输出，产物不依赖源码映射。入口导入不加载二进制；装配明确选择部署路径，并核对运行构建身份和原生字节。

`tools/build`、`dev`、`resources`、`native` 和 `package` 分别拥有有限构建、开发会话、固定资源、原生编译与打包，`tools/clean.ts` 提供清理任务。类型与测试脚本直接调用所属运行器和配置，桌面任务的依赖与缓存规则归应用 `turbo.json`。跨工作流的路径、目标与字节摘要归 `tools/lib`，生产输入监听和开发 Electron 定位归 `tools/dev`；跨工程复用的候选交接、命令执行和 CLI 收尾通过 `@kisaki3/tooling/output`、`@kisaki3/tooling/process`、`@kisaki3/tooling/cli` 引用私有工程包，取消信号由调用方显式传入。开发依赖快照只收集生产 workspace 依赖。构建输入身份直接使用 Turbo 的桌面 build 任务摘要，运行文件另行记录 SHA-256；生成的运行清单与载体身份共用 `src/shared` 中的定义。任务的输入、环境和清理规则见根 [开发指南](../../../CONTRIBUTING.md)，测试归属与正式设计见 [源码布局](../../../refactor/design/engineering/layout.md)。

SQLite 13.0.3 使用包内 Node-API 预编译绑定，资源工作流只装配所选目标；测试在启动前选择 Electron Node 宿主，直接验证将要交付的同一绑定，不在共享 node_modules 内切换 ABI。

性能配置保存正式代表负载和共同预算。可执行用例测量工程外壳的 20 次新进程启动及退出，实际结果及完整产品测量范围见[实施状态](../../../refactor/implementation/status.md)。

`packaging` 是打包专用静态输入边界；执行逻辑在 `tools/package`，生成文件在 `dist`。媒体信息与播放的产品接入合同见[libmpv-node 接入](../../../refactor/design/engineering/integrations.md#media)。

## 配置文件

| 文件                                                                                             | 用途                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [tsconfig.json](tsconfig.json)                                                                   | 桌面工程的类型检查入口，组织各运行环境、工具和测试项目。     |
| [turbo.json](turbo.json)                                                                         | 桌面任务的构建依赖、验证输入、环境变量和缓存规则。           |
| [config/typescript/tsconfig.main.json](config/typescript/tsconfig.main.json)                     | 检查主进程、共享合同与私有 Node 原生入口，并完整检查其声明。 |
| [config/typescript/tsconfig.preload.json](config/typescript/tsconfig.preload.json)               | 检查隔离预加载脚本及其共享合同。                             |
| [config/typescript/tsconfig.renderer.json](config/typescript/tsconfig.renderer.json)             | 检查 Solid renderer、窗口全局声明与共享合同。                |
| [config/typescript/tsconfig.extension-host.json](config/typescript/tsconfig.extension-host.json) | 检查扩展宿主的 Node 程序和共享合同。                         |
| [config/typescript/tsconfig.shared.json](config/typescript/tsconfig.shared.json)                 | 独立检查共享纯合同与构建全局声明。                           |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json)                   | 检查桌面工程工具与 TypeScript 配置入口。                     |
| [config/typescript/tsconfig.tests.json](config/typescript/tsconfig.tests.json)                   | 检查各运行环境的测试、辅助和测试使用的窗口声明。             |
