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

首次运行发现以下问题，已在下述完整运行中重新验证：

- Linux arm64 的关闭按钮已导致窗口退出，但 Playwright 仍等待点击后的页面确认。测试改为 `noWaitAfter: true`，继续等待 Electron 关闭事件并要求进程退出码为 0；不捕获或忽略点击错误。依据为 [Playwright 的点击等待合同](https://playwright.dev/docs/api/class-locator#locator-click)。
- macOS 两种架构的开发测试副本在启动辅助进程时找不到 ICU 资源。Electron bundle 的复制改为保留相对符号链接，避免默认复制行为将框架链接解析到原目录；使用 [Node cp 的 verbatimSymlinks 选项](https://nodejs.org/docs/latest-v24.x/api/fs.html#fspromisescpsrc-dest-options)。
- Linux x64 的构建、原生／SQLite、浏览器、四窗口、开发交接和 20 次启动测量通过，DEB 打包因缺少项目主页及维护者邮箱停止。按用户选择使用 GitHub noreply 邮箱，主页沿用正式仓库地址；构建从应用 package.json 读取同一份元数据。
- Windows 两种架构的开发测试使用 `RUNNER~1` 短路径，但 Vite 与 Node 使用了不同的目录身份。本机用独立短路径复现了 Vite 客户端脚本返回 404。测试工作区在创建后先解析真实路径，再安装依赖和启动开发会话；仅在工具启动时转换路径不足以修复此前已经记录的依赖位置。

首次运行的[元数据](40099308610/run.json)、[八个任务](40099308610/jobs.json)、[远端附件清单](40099308610/artifacts.json)、各目标日志及报告已归档。下载的原始附件与解压内容保存在仓库忽略的 `artifacts/w00-ci/40099308610/`；原始 ZIP 按 GitHub 提供的 SHA-256 核对，见[本地归档回执](40099308610/archive-receipts.json)。

本机修复检查包括[普通检查](local-check.log)、[Windows 构建](local-build.log)、[四窗口](local-e2e.json)和[开发会话](local-dev.json)。另外在同一独立 Windows [短路径环境](short-path-environment.json)中，[原实现](short-path-before.json)复现启动失败，[客户端脚本](short-path-http.json)返回 404；在创建测试工作区后立即解析真实路径，完整[开发回归通过](short-path-after.json)，耗时 71.42 秒。检查仍包含配置错误、源码编译失败与恢复、旧输出清除、HMR、公共包快照交接及保留开发资料的正常停止。

## 增量选择修复

四处修复提交为 `ff20474673cf0dc671e1094ae87a013bc55d544d`。[工作流 40100883367](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40100883367)的类型与依赖检查通过，但首次走到 CI 的增量选择分支时，将临时 affected.json 留在根目录，导致格式检查失败。桌面矩阵因此未执行；本轮没有产生验证附件，日志与状态见[本轮记录](40100883367/run.json)及[仓库日志](40100883367/repository.log)。

选择结果改写入 GitHub runner 的临时目录，原有格式规则、Turbo 依赖图选择和 Required checks 保持。修复提交为 `df0d99d3373004f50f122441a7c01460615ada67`。该提交自动触发的 [40101195338](40101195338.json) 被随后启动的完整手动运行按工作流并发规则取消，结论为 cancelled。

## 完整运行结果

[工作流 40101208659](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40101208659)以 workflow_dispatch 对修复提交执行完整六目标，仓库检查、六个桌面任务和 Required checks 共八项全部成功，见[运行元数据](40101208659/run.json)及[任务记录](40101208659/jobs.json)。手动运行没有增量基线，因此六个目标全部执行。

版本为 `0.1.0-dev.0`，六目标的源码构建标识一致，为 `5602ea20ded0aad4f13ea023e25a45217e23fed77c844b71179d547a6d0fbbde`。八包制品消费使用构建后的 exports，输入标识为 `31e5ee7cc39e03761eee8411ed8e4826652caa34c51e34e7a93db39f21d55282`，见[包清单](40101208659/packages.json)与[仓库外消费结果](40101208659/consumers.json)。

每个桌面目标均实际执行 Rust 检查、目标构建、Electron Node 模式的原生／SQLite 测试、Chromium 1 项、四窗口 4 项、开发会话 1 项、20 次新进程测量和最终载体 1 项。各架构使用对应的原生 runner；Linux 的桌面场景运行于 X11／Xvfb。

| 目标 | runner | 原生／SQLite | 已生成的候选格式 | 实际启动并正常关闭的载体 |
| --- | --- | --- | --- | --- |
| Windows x64 | windows-2025 | 8 项通过 | NSIS、ZIP | ZIP 通过 |
| Windows arm64 | windows-11-arm | 7 项通过，1 项跳过 | NSIS、ZIP | ZIP 通过 |
| macOS x64 | macos-15-intel | 7 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app 通过 |
| macOS arm64 | macos-15 | 7 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app 通过 |
| Linux x64 | ubuntu-22.04 | 7 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage 通过 |
| Linux arm64 | ubuntu-22.04-arm | 7 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage 通过 |

五个跳过项均为跨文件系统移动：对应 runner 的两个测试根位于同一文件系统，该场景仍未实测；Windows x64 的两个根位于不同卷，已执行通过。实际系统版本、CPU、运行时间和命令保留在各目标日志及 startup 报告中。

最终载体检查核对制品、程序与资源摘要，验证 ASAR 布局及正式 fuses，再从操作系统外部观察窗口并正常关闭，要求退出码为 0。全部候选均为 test-only，未取得正式签署、公证、安装升级、系统支持下限或 Linux Wayland 的验收证据。

每个目标的性能报告包含 20 次新进程、工作集和进程退出检查。测量使用已热的操作系统磁盘缓存及独立保留的 profile，仅代表 W00 工程外壳；全部通过预先规定的 5,000 ms P95 预算，不据此声明完整业务性能或跨硬件优劣。

## 证据与归档

完整结果的[核对汇总](40101208659/verification-summary.json)记录六目标构建身份、测试数量、性能样本和环境。[七份附件](40101208659/artifacts.json)共 1,757,425,238 字节，已全部下载至本地 `F:/project/kisaki/artifacts/w00-ci/40101208659/archives/`，逐份 SHA-256 与 GitHub 摘要一致，见[归档回执](40101208659/archive-receipts.json)。解压内容保留在同级对应附件目录，包含八包 tarball 以及六目标的 26 个候选、blockmap 和更新元数据文件；逐文件摘要亦已与构建回执核对。该目录由仓库忽略，不随临时目录清理。

| 目标 | 制品回执 | 原始日志 | 启动测量 |
| --- | --- | --- | --- |
| Windows x64 | [回执](40101208659/windows-x64-receipt.json) | [日志](40101208659/windows-x64.log) | [20 次测量](40101208659/windows-x64-startup.json) |
| Windows arm64 | [回执](40101208659/windows-arm64-receipt.json) | [日志](40101208659/windows-arm64.log) | [20 次测量](40101208659/windows-arm64-startup.json) |
| macOS x64 | [回执](40101208659/macos-x64-receipt.json) | [日志](40101208659/macos-x64.log) | [20 次测量](40101208659/macos-x64-startup.json) |
| macOS arm64 | [回执](40101208659/macos-arm64-receipt.json) | [日志](40101208659/macos-arm64.log) | [20 次测量](40101208659/macos-arm64-startup.json) |
| Linux x64 | [回执](40101208659/linux-x64-receipt.json) | [日志](40101208659/linux-x64.log) | [20 次测量](40101208659/linux-x64-startup.json) |
| Linux arm64 | [回执](40101208659/linux-arm64-receipt.json) | [日志](40101208659/linux-arm64.log) | [20 次测量](40101208659/linux-arm64-startup.json) |

同目录的 `<target>-artifacts.json`、`<target>-dev.json`、`<target>-e2e.json` 与 `<target>-performance.json` 保留完整运行报告；[仓库日志](40101208659/repository.log)与 [Required checks 日志](40101208659/required.log)保留汇总检查。Windows 的两个 NSIS 文件另经本机 Authenticode 核对为 [NotSigned](40101208659/windows-signatures.json)，与 test-only 候选范围一致。原始报告文件摘要见[文件清单](40101208659/files.json)。

A24、A26、A28、A31 在 W00 工程与测试入口范围内的断言已通过，W00 完成。后续工作包与完整产品验收维持各自状态，见[实施状态](../../../../../implementation/status.md#w00)。
