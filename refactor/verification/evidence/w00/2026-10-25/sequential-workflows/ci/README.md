# 顺序执行入口的六目标 CI

[PR #1](https://github.com/ximu3/kisaki-w00-ci/pull/1) 的提交 `17788f32fd84d750eed55f66a978cb1989191da5` 触发[运行 40203504015](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40203504015)。仓库检查、六个桌面目标与 Required checks 共八项全部成功，见[运行元数据](40203504015/run.json)、[任务状态](40203504015/jobs.json)和[核对汇总](40203504015/verification-summary.json)。

六目标版本均为 `0.1.0-dev.0`，构建回执与启动测量的 buildId 均为 `977178e22de00d54f98bfed3a71aa24cc1e62ceb21b4cc62b0fb641637c23813`，与本机一致。八个公共包的[输入清单](40203504015/packages.json)及[仓库外消费](40203504015/consumers.json)已核对，包输入身份为 `2b14bca6f5d1186f4cc57008c5d84c80f9456e402c3762985950c7adf2ef2756`。

## 实际覆盖

每个原生 runner 均通过 4 项候选交接与命令取消用例、Rust 检查、目标构建、原生／SQLite 套件、Chromium 1 项、四窗口 4 项、开发会话 2 项、20 次新进程测量和最终载体 1 项。开发取消用例观察真实准备进程启动后取消，验证该进程退出、会话目录清理，以及恢复正常构建命令后的完整启动。

| 目标 | runner | 原生／SQLite | 已生成的候选格式 | 实际启动并正常关闭的载体 |
| --- | --- | --- | --- | --- |
| Windows x64 | windows-2025 | 8 项通过 | NSIS、ZIP | ZIP 通过 |
| Windows arm64 | windows-11-arm | 7 项通过，1 项跳过 | NSIS、ZIP | ZIP 通过 |
| macOS x64 | macos-15-intel | 7 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app 通过 |
| macOS arm64 | macos-15 | 7 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app 通过 |
| Linux x64 | ubuntu-22.04 | 7 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage 通过 |
| Linux arm64 | ubuntu-22.04-arm | 7 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage 通过 |

五个跳过项均为跨文件系统移动：对应 runner 的两个测试根位于同一文件系统。Windows x64 在不同卷执行通过；其余五个目标仍没有该场景的运行证据。Linux 的桌面测试使用 X11／Xvfb。

最终载体检查核对摘要、ASAR 布局、程序与资源及正式 fuses，并以操作系统外部观察窗口和正常关闭，退出码为 0。所有候选均为 test-only；两个 Windows NSIS 文件经本机 Authenticode 核对为 [NotSigned](40203504015/windows-signatures.json)。正式签署、公证、安装升级、系统支持下限和其他运行后端按后续工作包验收。

各目标均保留 20 次新进程启动时间、工作集与进程退出检查，P95 均通过预先规定的 5,000 ms 预算。测量使用热磁盘缓存和隔离 profile，只覆盖 W00 工程外壳。

## 留存与结论

[七份附件](40203504015/artifacts.json)共 1,757,429,720 字节，已保存于仓库忽略的 `F:/project/kisaki/artifacts/w00-sequential/ci/40203504015/archives/`，SHA-256 与 GitHub 摘要逐份一致，见[归档回执](40203504015/archive-receipts.json)。同级保留解压内容；八份公共包 tarball 和六目标的 26 个候选、blockmap、更新元数据文件均已与所属回执逐文件核对。

| 目标 | 制品回执 | 原始日志 | 启动测量 |
| --- | --- | --- | --- |
| Windows x64 | [回执](40203504015/windows-x64-receipt.json) | [日志](40203504015/windows-x64.log) | [20 次测量](40203504015/windows-x64-startup.json) |
| Windows arm64 | [回执](40203504015/windows-arm64-receipt.json) | [日志](40203504015/windows-arm64.log) | [20 次测量](40203504015/windows-arm64-startup.json) |
| macOS x64 | [回执](40203504015/macos-x64-receipt.json) | [日志](40203504015/macos-x64.log) | [20 次测量](40203504015/macos-x64-startup.json) |
| macOS arm64 | [回执](40203504015/macos-arm64-receipt.json) | [日志](40203504015/macos-arm64.log) | [20 次测量](40203504015/macos-arm64-startup.json) |
| Linux x64 | [回执](40203504015/linux-x64-receipt.json) | [日志](40203504015/linux-x64.log) | [20 次测量](40203504015/linux-x64-startup.json) |
| Linux arm64 | [回执](40203504015/linux-arm64-receipt.json) | [日志](40203504015/linux-arm64.log) | [20 次测量](40203504015/linux-arm64-startup.json) |

各目标的 `*-dev.json`、`*-e2e.json`、`*-performance.json` 与 `*-artifacts.json` 保存完整报告，启动测量由 Playwright 报告中的原始 JSON 附件解码保存。[仓库日志](40203504015/repository.log)、[Required checks 日志](40203504015/required.log)及[文件摘要](40203504015/files.json)一并留存。上游 Actions 的运行时迁移提示沿用已有[维护记录](../../output-access/ci/README.md#上游工作流维护项)，原始日志没有屏蔽这些提示。

A24、A26、A28、A31 在当前 W00 工程与测试入口范围内通过，顺序执行入口完成本机与六目标验证。本轮没有发布应用或公共包，W01 与完整产品验收保持各自状态，见[实施状态](../../../../../../implementation/status.md#w00)。
