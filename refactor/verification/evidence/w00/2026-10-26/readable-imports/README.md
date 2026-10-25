# 工程导入可读性验证

本轮保留现有工程结构，以三个明确的 `@repo-tools` 名称引用根共有工具源码，改善跨多层目录的导入可读性。应用的 `#native` 包内入口保持原定义。正式范围与解析规则见[模块导入规范](../../../../../design/engineering/conventions.md#module-imports)，实施进度见[状态页](../../../../../implementation/status.md#w00)。

## 实现与输入

根 tsconfig.base.json 唯一定义 `@repo-tools/cli`、`@repo-tools/output`、`@repo-tools/process`，分别指向现有普通模块。34 个工具与测试文件的 47 处导入使用这些名称，模块内部仍使用相对路径，见[变更清单](import-changes.json)。没有增加 workspace 包、依赖或构建前置；锁文件解析记录[没有新增、删除或升级包](dependencies.json)。

根、应用及八个公共包的默认 tsconfig.json 继承共同基线，仍通过原有 references 组织各环境检查。七个 Vitest 入口启用 Vite 的 `resolve.tsconfigPaths`，读取同一映射，没有复制 resolve.alias 表或安装额外解析插件。根默认配置纳入实际工具运行输入和 Turbo 共享输入，构建身份仍采用输入指纹；回归验证其变化会改变身份。

`#native` 仍只在应用 package.json 的 imports 中定义，指向原生能力的 Node 入口。包作用域由发起导入的文件决定，配置继承和命令工作目录不会把该入口赋予父级模块。根目录启动的实际构建及 Electron Node 模式原生测试均通过，没有在根 paths 中重复定义 `#native`。

工具别名只服务已约定宿主中的工程源码及其测试，不是普通 Node 或对外包的运行时入口。依赖检查按解析后的真实路径执行；新增的类型导入负例确认产品源码不能通过工程别名绕过既有边界。

## 隔离解析验证

[探针](probe.ts)在临时工作区的两个不同目录深度分别执行真实 tsx 和 TypeScript，再通过 Vitest、Playwright 与 dependency-cruiser 读取同一份路径映射。六个正向执行通过，禁止的业务源码导入被边界规则识别，见[原始结果](probe-results.json)。dependency-cruiser 的 JSON 模式返回结构化违规与建议退出码，负例依据该结果核对，不以该模式自身的进程退出码代替断言。

探针使用本机 `F:/project/kisaki` 已安装的固定依赖，临时工作区在结束后清理；复现前需创建仓库忽略的 `.cache/readable-imports` 输出目录。实际版本为 Node 24.11.1、tsx 4.23.15、TypeScript 6.0.3、Vite 8.3.3、Vitest 5.0.5 和 Playwright 1.64.1。Vite 的[原生路径映射选项](https://vite.dev/config/shared-options#resolve-tsconfigpaths)与 Playwright 的[配置路径支持](https://playwright.dev/docs/test-typescript#tsconfig-path-mapping)均由各自宿主读取；`paths` 本身[不改写 TypeScript 输出](https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths-does-not-affect-emit)。

## 本机完整回归

环境为 Windows 10 22H2 x64、普通交互桌面。应用版本为 `0.1.0-dev.0`，构建身份为 `ae1fbd5207f3ba6d75a46296d31eb007657b2a83ab1b35bcc6bb4646a73e1c1f`。实际维护输入与摘要见[输入记录](inputs.json)，运行文件与资源摘要见[构建清单](desktop-build.json)。

| 检查 | 结果 |
| --- | --- |
| 固定锁文件安装、普通检查 | 通过；47 项类型任务、lint、格式与依赖边界，根 Node 20 项、本体 Node 10 项；[安装日志](install.log)、[检查日志](check.log) |
| Rust 与完整构建 | 通过；[Rust 日志](native-check.log)、[构建日志](build.log) |
| 原生／SQLite、浏览器、四窗口 | 分别为 8、1、4 项通过；[原生日志](native.log)、[浏览器日志](browser.log)、[窗口报告](e2e.json) |
| 实际开发会话 | 配置和源码失败恢复、改名、HMR、依赖快照、正常退出，以及准备期间取消后完整重启共 2 项通过；[日志](development.log)、[报告](dev.json) |
| 八包制品消费 | publint、ATTW 和仓库外消费者 2 项通过；[日志](consumers.log)、[报告](consumers.json) |
| 启动测量 | 20 次新进程通过，P95 477.75 ms；[原始测量](startup.json)、[报告](performance.json) |
| Windows 候选 | NSIS／ZIP 生成成功，原样 ZIP 的摘要、资源、正式 fuses、外部启动及正常关闭通过；[打包日志](package.log)、[制品回执](artifact-receipt.json)、[运行报告](artifacts.json) |

八包的 27 份公开 JS、声明与样式输出[逐字节相同](public-outputs.json)，八份 tarball 的摘要也[与调整前相同](package-comparison.json)。共有工具函数、应用运行源码、包 exports 和原生入口未改动。

命令起止与退出码见[执行记录](commands.json)，汇总见[结果数据](results.json)。候选已保存于仓库忽略的 `artifacts/w00-readable-imports/ae1fbd5207f3ba6d/windows-x64`，逐文件摘要与回执一致，见[归档记录](archive.json)。Windows NSIS 为 [NotSigned](windows-signature.json)，未进行安装或升级验收。

本轮输入的其他五目标运行结果尚未取得，CI 由 PR 继续执行，不等待其完成。性能数据只覆盖热磁盘缓存、隔离 profile 下的 W00 工程外壳。历史六目标证据保留原输入范围，完整业务、正式签署／公证、系统支持下限和其他后端仍由后续工作包验收。本轮没有发布应用或公共包。
