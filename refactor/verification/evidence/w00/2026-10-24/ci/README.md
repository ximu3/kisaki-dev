# W00 六目标远端验证

验证仓库为临时私有库 [ximu3/kisaki-w00-ci](https://github.com/ximu3/kisaki-w00-ci)。本记录覆盖 W00 的工程、运行和测试入口；正式签署身份、安装升级与完整产品验收仍由后续工作包交付。

## 初始运行

初始提交为 `66d39a78e19945bde223223769dd42741bb45cb1`，提交标题为 `chore: initial commit`。[工作流 40099308610](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40099308610)从固定锁文件安装，实际启动六个原生目标。仓库级普通检查与八包仓库外消费通过；六个桌面任务均在不同阶段失败，Required checks 正确报告失败。

| 目标 | 已通过 | 停止阶段 |
| --- | --- | --- |
| Windows x64／arm64 | Rust 检查、目标构建、原生／SQLite、Chromium、四窗口 | 开发会话 renderer 就绪 |
| macOS x64／arm64 | Rust 检查、目标构建、原生／SQLite、Chromium、四窗口 | 开发会话 Electron 辅助进程资源 |
| Linux x64 | Rust 检查、目标构建、原生／SQLite、Chromium、四窗口、开发会话、20 次启动测量 | DEB 元数据 |
| Linux arm64 | Rust 检查、目标构建、原生／SQLite、Chromium；四窗口中的 2 项 | 四窗口中的另外 2 项关闭确认 |

原生用例中的跨文件系统移动按实际环境记录：Windows x64 的临时目录与工程位于不同卷，完整 8 项通过；其余目标仅提供同一文件系统的两个测试根，7 项通过、跨文件系统用例明确跳过。这不等于这些目标已经取得该场景的运行证据。

首次运行发现以下问题，修复后仍须在对应平台重跑：

- Linux arm64 的关闭按钮已导致窗口退出，但 Playwright 仍等待点击后的页面确认。测试改为 `noWaitAfter: true`，继续等待 Electron 关闭事件并要求进程退出码为 0；不捕获或忽略点击错误。依据为 [Playwright 的点击等待合同](https://playwright.dev/docs/api/class-locator#locator-click)。
- macOS 两种架构的开发测试副本在启动辅助进程时找不到 ICU 资源。Electron bundle 的复制改为保留相对符号链接，避免默认复制行为将框架链接解析到原目录；使用 [Node cp 的 verbatimSymlinks 选项](https://nodejs.org/docs/latest-v24.x/api/fs.html#fspromisescpsrc-dest-options)。
- Linux x64 的构建、原生／SQLite、浏览器、四窗口、开发交接和 20 次启动测量通过，DEB 打包因缺少项目主页及维护者邮箱停止。按用户选择使用 GitHub noreply 邮箱，主页沿用正式仓库地址；构建从应用 package.json 读取同一份元数据。
- Windows 两种架构的开发测试使用 `RUNNER~1` 短路径，但 Vite 与 Node 使用了不同的目录身份。本机用独立短路径复现了 Vite 客户端脚本返回 404。测试工作区在创建后先解析真实路径，再安装依赖和启动开发会话；仅在工具启动时转换路径不足以修复此前已经记录的依赖位置。

首次运行的[元数据](40099308610/run.json)、[八个任务](40099308610/jobs.json)、[远端附件清单](40099308610/artifacts.json)、各目标日志及报告已归档。下载的原始附件与解压内容保存在仓库忽略的 `artifacts/w00-ci/40099308610/`；原始 ZIP 按 GitHub 提供的 SHA-256 核对，见[本地归档回执](40099308610/archive-receipts.json)。

本机修复检查包括[普通检查](local-check.log)、[Windows 构建](local-build.log)、[四窗口](local-e2e.json)和[开发会话](local-dev.json)。另外在同一独立 Windows [短路径环境](short-path-environment.json)中，[原实现](short-path-before.json)复现启动失败，[客户端脚本](short-path-http.json)返回 404；在创建测试工作区后立即解析真实路径，完整[开发回归通过](short-path-after.json)，耗时 71.42 秒。检查仍包含配置错误、源码编译失败与恢复、旧输出清除、HMR、公共包快照交接及保留开发资料的正常停止。

## 增量选择修复

四处修复提交为 `ff20474673cf0dc671e1094ae87a013bc55d544d`。[工作流 40100883367](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40100883367)的类型与依赖检查通过，但首次走到 CI 的增量选择分支时，将临时 affected.json 留在根目录，导致格式检查失败。桌面矩阵因此未执行；本轮没有产生验证附件，日志与状态见[本轮记录](40100883367/run.json)及[仓库日志](40100883367/repository.log)。

选择结果改写入 GitHub runner 的临时目录，原有格式规则、Turbo 依赖图选择和 Required checks 保持。六目标修复后的完整结果尚待取得，W00 保持进行中。
