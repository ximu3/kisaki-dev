# 当前工程的六目标 CI 与缓存恢复

[PR #1](https://github.com/ximu3/kisaki-dev/pull/1) 的提交 `711d9566da74c1e1f9d466052eb9cf826d04633d` 已通过[运行 40454692840](https://github.com/ximu3/kisaki-dev/actions/runs/40454692840)。第一次运行中，仓库检查、六个桌面目标和 Required checks 共八项成功；随后仅复跑 macOS arm64 及依赖它的汇总检查，在新 runner 上完成缓存恢复验证，两项再次成功。其余任务沿用第一次结果。

首次完整运行的[元数据](40454692840/run.json)、[任务与 runner](40454692840/jobs.json)、[核对汇总](40454692840/verification-summary.json)和[Required checks 日志](40454692840/required.log)分别保留。PR 的实际检查输入为合并引用 `6d70179a0c450cac689093485c11d5cc5f79bdf1`，对应上述 head 与原有 main 基线；没有执行合并。

## 实际覆盖

仓库检查通过 48 项常规测试、类型与依赖检查、lint 与边界检查及格式检查。八份新 tarball 通过 publint、ATTW 和两项仓库外消费者检查，公共声明消费者继续完整检查声明；独立浏览器测试一项通过。见[仓库日志](40454692840/repository.log)、[范围选择](40454692840/affected.json)、[包回执](40454692840/packages.json)、[消费者报告](40454692840/consumers.json)及[浏览器报告](40454692840/browser.json)。

六个原生 runner 各自通过五项候选交接与命令取消测试、Rust 检查、目标构建、原生／SQLite 套件、四窗口、七项开发场景、20 次启动测量和一项最终载体验证。开发测试覆盖拒绝退出、正常关闭、构建失败后的保留与恢复、公共依赖更新、renderer 更新，以及准备阶段取消和后续启动。

| 目标 | runner | 原生／SQLite | 生成的格式 | 实际启动并正常关闭的载体 | 启动 P95 |
| --- | --- | --- | --- | --- | --- |
| Windows x64 | windows-2025 | 7 项通过 | NSIS、ZIP | ZIP | 735.1 ms |
| Windows arm64 | windows-11-arm | 6 项通过，1 项跳过 | NSIS、ZIP | ZIP | 545.6 ms |
| macOS x64 | macos-15-intel | 6 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app | 1,395.4 ms |
| macOS arm64 | macos-15 | 6 项通过，1 项跳过 | DMG、ZIP | ZIP 中的 app | 318.7 ms |
| Linux x64 | ubuntu-22.04 | 6 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage | 708.1 ms |
| Linux arm64 | ubuntu-22.04-arm | 6 项通过，1 项跳过 | AppImage、DEB、RPM | AppImage | 468.8 ms |

五个跳过项均为跨文件系统移动：对应 runner 的两个测试根位于同一文件系统。该场景只在 Windows x64 的不同卷取得通过结果。Linux 桌面与载体检查使用 X11／Xvfb 和运行中的 Openbox。

六目标的候选回执和启动测量具有相同 buildId：`efd2b15e20661174942b74d44477246395f685465c680bf39da997425961fd22`。每个目标保留 20 份启动时间与工作集样本，并检查观察到的子进程退出；全部 P95 通过原有 5,000 ms 预算。测量使用新进程、热磁盘缓存和隔离 profile，只覆盖 W00 工程外壳，不用于比较各平台产品性能。

最终载体测试检查文件摘要、ASAR 布局、程序与资源、正式 fuses，以及操作系统外部观察到的窗口和正常退出。所有候选均标记为 test-only。安装包已经生成，不表示完成安装、升级、正式签署或公证验收。

## GitHub 跨运行缓存

第二次运行保持同一提交和合并引用，macOS arm64 的 runner 从 `1000001189` 换为 `1000001193`。它恢复了第一次上传的同一 Turbo 缓存键；构建和打包两个阶段分别命中 appearance、desktop-contracts、extension-cli、ui 四个公共包任务，八次命中的任务 hash 均与第一次的实际执行记录一致。

两个阶段各为 5 项成功、4 项命中；桌面 build 与 package 按配置重新执行，原生、窗口、开发、性能和最终制品检查也实际运行并通过。六个非复跑任务的开始与结束时间与第一次一致，没有重新运行仓库或其他五个目标。见[缓存核对](40454692840/cache-recovery.json)、[复跑任务](40454692840/warm-cache/jobs.json)、[原始日志](40454692840/warm-cache/macos-arm64.log)和[复跑汇总检查](40454692840/warm-cache/required.log)。

复跑恢复的主键已经存在，保存步骤记录了不能再次占用该键的提示，原缓存保留，该步骤和任务均成功。日志原样保留。这份证据证明 macOS arm64 新 runner 的 GitHub 缓存持久化和实际任务复用，不扩展为六种环境都完成了暖缓存复跑，也不作为稳定性能基准。

## 证据与归档

第一次完整矩阵的[七份附件](40454692840/artifacts.json)共 1,757,473,069 字节，保存于仓库忽略的 `F:/project/kisaki/artifacts/w00-ci/2026-10-27/40454692840/`。逐份 SHA-256 与 GitHub 摘要相符，见[归档回执](40454692840/archive-receipts.json)。同级保留解压内容；八个公共包 tarball，以及六目标共 26 个候选、blockmap 和更新元数据文件，均按所属回执逐文件核对。

各目标的 `*-tooling.json`、`*-dev.json`、`*-e2e.json`、`*-performance.json` 和 `*-artifacts.json` 保存实际报告，`*-receipt.json` 保存候选清单，`*-startup.json` 从 Playwright 原始附件解码保存。各任务原始日志、运行元数据和[文件摘要](40454692840/files.json)一并留存。第二次运行的日志与元数据单独保存在 warm-cache；候选归档采用第一次完整矩阵的实际文件。

## 诊断与修复记录

| 提交与运行 | 当次实际结果 |
| --- | --- |
| eba5524 · [40447156091](https://github.com/ximu3/kisaki-dev/actions/runs/40447156091) | 固定安装、缓存恢复和范围选择通过；类型阶段长时间未完成，主动取消，普通取消未及时结束后使用 force-cancel。没有六目标通过结果，不能记作源码断言失败。 |
| 61caf5b · [40448497245](https://github.com/ximu3/kisaki-dev/actions/runs/40448497245) | 仓库并发改为两路并使用流式日志。50 项类型及依赖任务通过，用时 6 分 58.709 秒；54 项 lint／边界及依赖任务和格式检查通过。本体 19 项断言通过，但 renderer fixture 的 afterAll 清理发生 ENOTEMPTY，仓库与 Required checks 因此失败，六目标未执行。 |
| a20c3f0 · [40452037843](https://github.com/ximu3/kisaki-dev/actions/runs/40452037843) | 新声明分工下，仓库检查、48 项常规测试、八包消费者和浏览器全部通过，类型阶段 1 分 41.211 秒；fixture 清理修正得到复验。Windows x64、macOS x64／arm64 完整任务通过；两个 Linux 目标缺少运行中的窗口管理器，Windows arm64 的原生窗口轮询使用了过短的默认超时，三个目标失败，Required checks 正确失败。 |

第二轮的[元数据](40448497245/run.json)、[任务](40448497245/jobs.json)、[仓库日志](40448497245/repository.log)和[范围选择](40448497245/affected.json)保留原结果。附件 12710066382 保存在本地同日期的 40448497245 目录，SHA-256 为 `3a56eaa1720bf1061b57c76c7bce4ae8353b98b7d12f15215a107692a68231d8`，与 GitHub 相符。第三轮的[任务](40452037843/jobs.json)、[各附件清单](40452037843/artifacts.json)、仓库和六目标日志，以及消费者、浏览器和包回执保留当次范围；其仓库、macOS arm64 与 Linux arm64 附件已下载核对，其余历史候选没有重复下载。

最终修正包括 Node 原生有限清理重试、在 Linux 的 Xvfb 会话启动 Openbox，以及将 Windows 原生窗口观察设为与制品检查一致的 30 秒预算。窗口断言和启动性能预算保留。构建身份另排除工具包生成的 test-results；既有身份回归覆盖该目录，当前六目标的源码身份一致。

第一轮资源竞争只是诊断假设，没有取得进程内存或 OOM 证据，不能把取消直接归因为 skipLibCheck。随后采用的[声明检查分工](../../../declaration-checks/2026-10-27/README.md)依据独立测量和用户确认实施。当前 50 项类型及依赖任务用时 1 分 33.914 秒；这些不同输入下的单次耗时不作为稳定性能比较。

本轮沿用现有私有仓库、Actions 权限和付费设置。额度查询因现有 OAuth scope 不足未取得数据，不解释为无限或零用量。连接器的临时下载域名在本机无法解析，原始附件归档使用 GitHub CLI 接口。

A24、A26、A28、A31 在当前 W00 工程与测试入口范围通过，当前六目标与跨运行缓存证据已补齐。W01 保持未开始；W11 的真实签署、公证、安装与更新验收，以及其余产品、系统下限和运行后端验证，按所属工作包接续。本轮没有合并、发布或部署。
