# 私有工程包、项目任务与缓存验证

本轮将已有共享配置和函数归入三个私有 workspace 包，各项目拥有实际检查入口，CI 使用 GitHub Actions 原生缓存保存 Turbo 任务结果。正式规则见[工作区配置](../../../../../design/engineering/workspace.md#workspace)与[任务和缓存](../../../../../design/engineering/workspace.md#tasks)，当前进度见[状态页](../../../../../implementation/status.md#w00)。

## 实现与边界

| 私有包 | 内容与消费方式 |
| --- | --- |
| @kisaki3/typescript-config | 共同严格性及纯环境、Node、浏览器、Solid 配置，由 TypeScript 直接读取 JSON |
| @kisaki3/eslint-config | 共同 lint 规则及 Node、测试预设，由 ESLint 与锁定的 jiti 加载 TypeScript |
| @kisaki3/tooling | CLI 收尾、候选交接、命令执行与取消，由 tsx、Vitest、Playwright 宿主编译 TypeScript |

工作区现有 45 个成员：本体、八个公共包、33 个官方扩展和三个私有工程包。消费者声明实际 workspace devDependencies 并使用 exports；三个包没有空 build 或单独监听。旧 @repo-tools paths、根 tsconfig.base.json 和七处 Vitest 路径解析开关已移除。应用 #native 继续由自身 package.json 唯一定义，公共包仍消费构建后的 exports。

根任务由 Turbo 调度各项目与根实际检查；项目 eslint.config.ts 选择自身范围，并以 import.meta.dirname 显式绑定 parserOptions.tsconfigRootDir，桌面任务配置归应用 turbo.json。跨项目批量 lint 的[回归](lint-batch-after.log)与实际[暂存文件检查](staged-check.log)通过，避免解析器在多个配置之间推断根目录的歧义。候选交接与命令取消测试归 tooling，根继续拥有结构、边界、hooks 与跨包消费者验证。依赖边界的真实解析验证覆盖工程源码的类型导入禁用及工程工具的合法导入。

桌面开发快照使用 pnpm 的生产依赖闭包，排除私有工程包。构建身份包含新的工程输入，测试确认其变化影响身份，生成目录与测试样本不影响身份。实际开发回归仍覆盖配置和源码失败恢复、HMR、依赖交接、关闭和取消后重试。

## 配置与公共制品

相对基线 b7c344692c6a50ba7dcb3dc6f87fe9487843b4b7，[74 个既有 TypeScript 检查环境的编译语义与 globals 保持一致](equivalence.json)。比较排除已移除的 paths 及内部基准路径，以及迁移后的扩展声明项目新增的增量存储选项；逐项目映射和排除字段均在记录中列出。33 个扩展的 kisx.config.ts 仍由纯环境检查，文件覆盖保持一致，新的 ESLint 配置在独立 Node 项目中检查；默认入口通过 references 组织二者。原有产品环境与 UI 声明检查例外保持原范围。

八个公共包的运行依赖、peer、exports、版本和许可保持一致，27 份 JS、声明与 CSS 输出逐字节相同。manifest 新增工程 devDependencies，因此本轮 tarball 摘要发生变化，以[当前制品输入](package-inputs.json)为准；publint、ATTW 和仓库外 Node、普通 Webview、Solid 消费均通过。[锁文件中的 878 个外部包](dependencies.json)没有增删、升级或 resolution 变化。

## 缓存实测

在当前源码的隔离副本中安装固定依赖，通过实际 Turbo 2.11.10 执行和读取任务计划。[12 项检查](cache/result.json)全部通过：

- 冷运行的八包 build 全部执行；热运行全部命中。
- 删除 UI 的 dist 后，从缓存恢复全部三份输出，逐字节一致。
- appearance 源码变化使自身及 UI 消费者的 build、typecheck、lint 失效，独立 rpc 保持命中。
- UI 的有效编译选项变化使其 build、typecheck、lint 失效，rpc build 哈希保持。
- 三个根工程依赖的源码或配置变化进入全局哈希；这符合 Turbo 对根内部依赖的实际规则，不将共享包描述成全局失效的消除手段。
- 仅修改 Prettier 配置不改变 build 哈希；生成目录、缓存和开发资料均不进入任务输入。
- TSDOWN_* 编译期环境变化进入 build 哈希。

实际执行摘要与日志分别见[冷运行](cache/cold.json)、[热运行](cache/warm.json)、[输出恢复](cache/restore.json)和[上游变化](cache/upstream-source-change.json)。根结构测试另读取真实任务图，持续检查生成输入排除、工程包无构建步骤，以及开发、测试和打包任务不重放缓存。

CI 使用 actions/cache v5 的固定提交 caa296126883cff596d87d8935842f9db880ef25，仅保存 .turbo/cache。外层缓存按操作系统、架构与 Node 版本分隔，具体任务由 Turbo 输入哈希判断命中；fork PR 只恢复，保存限本仓库来源。行为依据 [Turbo 输入与全局哈希](https://turborepo.dev/docs/reference/configuration#globaldependencies)及 [GitHub 缓存的分支作用域](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)。本机命中不代表已经取得 GitHub 跨运行恢复证据；后者尚待实际 CI 登记。

## 本机完整回归

环境为 Windows 10 22H2 x64、普通交互桌面，Node 24.11.1、pnpm 11.11.0、Turbo 2.11.10。应用版本为 0.1.0-dev.0，buildId 为 53f3b06fa5793de0a7327de7f90acf070e4a7a5dab93859af0e1a9833fd82f78。[输入摘要](inputs.json)、[运行文件清单](desktop-build.json)和[命令回执](commands.json)保留实际验证范围。

| 检查 | 结果 |
| --- | --- |
| 固定锁文件安装与普通检查 | 通过；50 项类型任务、54 项 lint／边界及依赖任务，根 Node 19 项、tooling 4 项、本体 Node 14 项；[最终检查日志](final-check.log) |
| Rust 与桌面构建 | 通过；[Rust 日志](native-check.log)、[构建日志](build.log) |
| 原生／SQLite、浏览器、四窗口 | 8、1、4 项通过；[原生日志](native.log)、[浏览器日志](browser.log)、[窗口报告](e2e.json) |
| 实际开发会话 | 2 项通过；[日志](development.log)、[报告](dev.json) |
| 八包制品消费 | publint、ATTW 与 2 项仓库外消费者通过；[日志](consumers.log)、[报告](consumers.json) |
| 启动测量 | 20 次新进程通过，P95 369.79 ms；[原始测量](startup.json)、[报告](performance.json) |
| Windows 候选 | NSIS／ZIP 生成，原样 ZIP 的摘要、资源、正式 fuses、外部启动及关闭通过；[回执](artifact-receipt.json)、[运行报告](artifacts.json) |

候选、八份 tarball 与回执已保存到仓库忽略的 artifacts/w00-monorepo-cache/53f3b06fa5793de0/windows-x64 及同级 packages，14 份归档文件的摘要均已复核，见[归档记录](archive.json)。NSIS 为 [NotSigned](windows-signature.json)，未进行安装或升级验收。

当前输入的其他五个目标及 GitHub 跨运行缓存恢复尚未取得证据；按用户要求不等待 CI 完成。本轮性能仅覆盖热磁盘缓存、隔离资料下的 W00 工程外壳。历史六目标证据保留原提交与范围，完整业务、正式签署、公证、系统支持下限和其他后端仍按后续工作包验收。没有发布应用或公共包。
