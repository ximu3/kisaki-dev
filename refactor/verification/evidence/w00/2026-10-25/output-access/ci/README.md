# 输出访问修正的六目标 CI

修正提交 `61f33a069bd49c6051458e6b2dc46e3d03a1e936` 的[完整运行](#complete-run)已通过仓库检查、六目标桌面任务及 Required checks。七份附件与实际候选已归档并核对摘要；W00 工程与测试入口范围完成。

## 首次运行与关闭时序

[运行 40195578411](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40195578411)验证提交 `59ab12c74d88bb34054eea419107795445078e08`。六个目标的 8 项系统锁、子进程寿命和缓存恢复用例全部通过。仓库检查、Windows x64、macOS 两种架构及 Linux x64 完整通过；Windows arm64 与 Linux arm64 的四窗口用例在游戏面板的关闭按钮处失败，Required checks 因此失败。完整状态见[运行元数据](40195578411/run.json)及[八个任务](40195578411/jobs.json)。

失败发生在 `locator.click()` 的反馈返回前：页面已经关闭，点击通道随之销毁。用例尚未等待之前登记的应用 close 事件，也未执行退出码断言。两端的原始证据为 [Linux 日志](40195578411/linux-arm64.log)、[Linux 报告](40195578411/linux-arm64-e2e.json)、[Windows 日志](40195578411/windows-arm64.log)及[Windows 报告](40195578411/windows-arm64-e2e.json)。本轮的仓库验证附件和两个失败目标的附件、trace 保留在仓库忽略的 `artifacts/w00-output-access/ci/40195578411`，三份下载摘要与 GitHub 回执一致，见[归档回执](40195578411/archive-receipts.json)。其余四个目标保留原始日志，未重复下载本轮成功候选。

用例改为仅在页面已经关闭时接续应用关闭等待，页面仍打开时的点击错误原样抛出；应用退出码必须为 0。没有改变产品退出行为或加入重试。`noWaitAfter` 也已移除：锁定的 Playwright 1.64.1 类型与[官方说明](https://playwright.dev/docs/api/class-locator#locator-click)将其标为弃用，且该参数只控制导航等待，不能保证点击反馈先于 renderer 关闭。

本机以四类窗口各重复 5 次验证最终修改，20 项全部通过，见[日志](40195578411/local-e2e-close.log)和[报告](40195578411/local-e2e-close.json)。本体严格类型检查、该文件 ESLint 与格式检查均通过。此修改只影响测试的完成判定，应用构建身份保持 `2751247a6c187c5473fc49342642c1953483dbd772d887d0b4ade0f25a1ab2ea`；下述六目标运行完成了远端复核。

<a id="complete-run"></a>

## 完整运行

[运行 40197393514](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40197393514)由上述修正提交的 push 触发，实际依赖图选择六个桌面目标。仓库检查、六个桌面任务与 Required checks 共八项全部成功，见[运行元数据](40197393514/run.json)、[任务状态](40197393514/jobs.json)与[核对汇总](40197393514/verification-summary.json)。

版本为 `0.1.0-dev.0`。六目标的构建回执与启动测量均使用同一构建身份 `2751247a6c187c5473fc49342642c1953483dbd772d887d0b4ade0f25a1ab2ea`，与本机一致。八包的[输入清单](40197393514/packages.json)和[仓库外消费](40197393514/consumers.json)均已核对，包输入身份为 `68e150863f5bcbef70cb30a15bc139495f6fc4eb46a8a47c7c1eecbe34e26bdf`。

每个原生 runner 均通过 8 项输出访问用例、Rust 检查、实际目标构建、原生／SQLite 套件、Chromium 1 项、四窗口 4 项、开发会话 2 项、20 次新进程测量和最终载体 1 项。输出访问用例包含系统锁、取消、父子进程寿命及真实 Turbo 缓存恢复；开发用例包含活动会话与清理互斥、无关包构建、首次准备期间取消、完整重启与原有失败恢复。

| 目标 | runner | 原生／SQLite | 已生成的候选格式 | 实际启动并正常关闭的载体 |
| --- | --- | --- | --- | --- |
| Windows x64 | windows-2025 | 8 项通过 | NSIS、ZIP | ZIP 通过 |
| Windows arm64 | windows-11-arm | 7 项通过，1 项跳过 | NSIS、ZIP | ZIP 通过 |
| macOS x64 | macos-15-intel | 7 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app 通过 |
| macOS arm64 | macos-15 | 7 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app 通过 |
| Linux x64 | ubuntu-22.04 | 7 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage 通过 |
| Linux arm64 | ubuntu-22.04-arm | 7 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage 通过 |

五个跳过项均为跨文件系统移动：对应 runner 的两个测试根位于同一文件系统。Windows x64 的测试根位于不同卷，已取得该场景的运行结果。其余目标仍不声明跨文件系统移动已经实测。

Linux 桌面场景使用 X11／Xvfb。最终载体检查核对摘要、ASAR 布局、程序与资源及正式 fuses，通过操作系统外部观察窗口并正常关闭，退出码均为 0。全部候选均为 test-only；两个 Windows NSIS 文件另经 Authenticode 核对为 [NotSigned](40197393514/windows-signatures.json)。正式签署、公证、安装升级、系统支持下限及其他运行后端按后续工作包接续。

每个目标保留 20 次启动时间、工作集和进程退出检查，P95 均通过预先规定的 5,000 ms 预算。测量使用热磁盘缓存及隔离 profile，只代表 W00 工程外壳，完整业务性能尚未验收。

## 证据与归档

[七份附件](40197393514/artifacts.json)共 1,757,433,149 字节，已下载至仓库忽略的 `F:/project/kisaki/artifacts/w00-output-access/ci/40197393514/archives/`，SHA-256 与 GitHub 摘要逐份一致，见[归档回执](40197393514/archive-receipts.json)。解压内容保留在同级对应附件目录。八份公共包 tarball 和六目标的 26 个候选、blockmap、更新元数据文件均已与所属回执逐文件核对；没有发布应用或公共包。

| 目标 | 制品回执 | 原始日志 | 启动测量 |
| --- | --- | --- | --- |
| Windows x64 | [回执](40197393514/windows-x64-receipt.json) | [日志](40197393514/windows-x64.log) | [20 次测量](40197393514/windows-x64-startup.json) |
| Windows arm64 | [回执](40197393514/windows-arm64-receipt.json) | [日志](40197393514/windows-arm64.log) | [20 次测量](40197393514/windows-arm64-startup.json) |
| macOS x64 | [回执](40197393514/macos-x64-receipt.json) | [日志](40197393514/macos-x64.log) | [20 次测量](40197393514/macos-x64-startup.json) |
| macOS arm64 | [回执](40197393514/macos-arm64-receipt.json) | [日志](40197393514/macos-arm64.log) | [20 次测量](40197393514/macos-arm64-startup.json) |
| Linux x64 | [回执](40197393514/linux-x64-receipt.json) | [日志](40197393514/linux-x64.log) | [20 次测量](40197393514/linux-x64-startup.json) |
| Linux arm64 | [回执](40197393514/linux-arm64-receipt.json) | [日志](40197393514/linux-arm64.log) | [20 次测量](40197393514/linux-arm64-startup.json) |

同目录的 `<target>-artifacts.json`、`<target>-dev.json`、`<target>-e2e.json` 和 `<target>-performance.json` 保留完整报告。启动测量由 Playwright 报告内的原始 JSON 附件解码保存。[仓库日志](40197393514/repository.log)、[Required checks 日志](40197393514/required.log)和[文件摘要](40197393514/files.json)一起留存。

A24、A26、A28、A31 在 W00 工程与测试入口范围内的断言通过，终审及输出访问审视发现的缺口完成修正复核。W01 与完整产品验收保持各自状态，见[实施状态](../../../../../../implementation/status.md#w00)。

## 上游工作流维护项

当前固定的 `pnpm/action-setup` 与 `actions/upload-artifact` 在 action 元数据中声明 Node 20，runner 已以 Node 24 执行，并输出运行时迁移提示。GitHub 的[迁移公告](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)说明了这一行为。上游 action 的 `punycode`、`url.parse()` 通知同样保留在原始日志；没有关闭警告或请求使用旧运行时。它们按工作流依赖升级核对版本与缓存、附件接口兼容性，不属于本轮系统锁实现或桌面运行依赖的变更。
