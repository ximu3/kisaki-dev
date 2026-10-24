# W00 工程与测试入口验证

本页保留初次基线的输入与实测结果。后续已移除独立 ffprobe，并完成工程整理与跨平台修复；最新运行结果见[六目标远端验证](ci/README.md)，当前进度见[实施状态](../../../../implementation/status.md#w00)。

本记录对应 2026-10-24 的正式工程实现。范围为 W00 的构建、开发会话、运行隔离、资源装配、包消费与制品测试入口；不将这些结果计为 W01–W13 的业务或完整发行验收。

本页保留初次基线。随后按用户反馈进行的代码、注释和开发窗口修正，以及当前候选的验证结果，见[可读性复核](readability-review/README.md)。

初次基线记录时，W00 为**进行中**：Windows x64 的本机工程链路已取得结果，其余五个目标与当时的远端媒体归档尚未完成。以下结果保留该次验证的时间与范围。

## 实现与环境

- 实际 workspace：1 个桌面应用、8 个公共包、33 个官方扩展项目，共 42 个成员；扩展业务及完整公共 API 按后续工作包接续。
- 未公开版本：`0.1.0-dev.0`。最终本体构建标识为 `27d47de4ec9169295a4903b9adca5d9832745fe1d54b109a539f27e41847fa95`，完整文件摘要见 [desktop-build.json](desktop-build.json)。
- Windows 10 22H2 x64，build 19045，Ryzen 9 7945HX，32 GB 内存，普通用户交互桌面。
- Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、Electron 44.5.1、better-sqlite3 13.0.3、Rust 1.90.0；其余确切输入由 pnpm、Cargo 与资源清单锁定。
- 测试只使用生成的样本和隔离资料目录。开发 Electron、Electron Node 模式、Chromium 与加固后的安装制品分别运行。

## 实际结果

下表中的应用任务均通过 `pnpm --filter @kisaki3/desktop <任务>` 执行。先完成构建或打包，再运行只消费既有输入的测试，避免测试过程中替换它正在使用的输出。

| 验证 | 结果与证据 | 适用范围 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 通过 | 固定工作区依赖；不在共享 node_modules 中切换 SQLite ABI |
| `pnpm check` | 47 项类型任务及根 TypeScript、ESLint、159 模块／261 依赖的边界检查、格式检查通过；21 项常规测试通过，见 [check.log](check.log) | 9 项隔离 hooks 用例、2 项工程结构用例、4 项边界负例、6 项输出／媒体用例 |
| `native:check` | Rust fmt 与 Clippy `-D warnings` 通过，见 [rust-check.log](rust-check.log) | 本机目标 Rust 源码；不代替其他目标的编译与运行 |
| `pnpm test:consumers` | 八份实际 tarball 的 publint、ATTW 通过；2 项仓库外用例通过，见 [消费者报告](consumers.json)与[包输入清单](public-packages.json) | Node ESM、严格 TypeScript、普通网页、Solid 页面；浏览器验证实际 CSS、交互及无需 Tailwind 的消费。公开合同仍仅为当前已实现部分 |
| `test:native` | 8 项通过，见 [native.log](native.log) | 实际 Electron 加载将被装配的原生绑定；不覆盖移动、竞争、目录、Unicode 路径、跨卷失败、文件同步与权限失败，以及 SQLite WAL 写入、事务回滚和重开 |
| `test:browser` | 1 项通过，见 [browser.log](browser.log) | 真实 Chromium 中的键盘、按钮、错误反馈和样式 |
| `test:e2e` | 4 项通过，见 [e2e.json](e2e.json) | main、reader、player、game-panel 各自的真实窗口、最小 bridge、renderer 无 Node、隔离 profile、共享宿主与正常关闭 |
| `test:dev` | 1 项完整开发会话通过，见 [development.json](development.json) | 独立源码副本；失败保留旧实例、成功交接、改名去除旧输出、renderer HMR、公共包完整快照刷新、停止进程并保留资料 |
| `package --target windows-x64` | NSIS、ZIP、blockmap 和更新元数据生成成功，见 [artifacts.json](artifacts.json) | 生成未签名 Windows 候选；未执行安装器安装、升级或卸载 |
| `test:artifacts` | 同一份 ZIP 通过，见 [artifact-test.json](artifact-test.json) | 核对所有声明的资源摘要、构建身份、ASAR 内容及正式 fuses；用外部窗口接口观察显示和正常关闭；便携资料落到独立目录，开发 profile 覆盖无效 |
| `test:performance` | 20 次新进程通过，见 [performance.json](performance.json) | 仅 W00 工程外壳，操作系统磁盘缓存已热、隔离 profile 保留；不是冷机、完整资料库、业务性能或旧版对比 |

性能样本的中位数为 468.20 ms，P95 为 495.11 ms，最大值为 505.97 ms，标准差为 15.00 ms。观察到的进程工作集总和为 267.21–275.48 MiB；20 次退出后均确认已观察到的子进程结束。W00 外壳的 5,000 ms P95 预算在测量前确定，正式工作负载与界面／主线程预算保留在性能配置中，按后续功能接续。

Windows `Get-AuthenticodeSignature` 对 NSIS 和打包应用均返回 `NotSigned`，符合当前 Windows 未签名政策。测试没有修改开发 Electron 的 fuses，也没有为最终制品启用调试或 RunAsNode。最终制品通过的运行范围是 ZIP 主窗口启动与退出；SQLite 的实际运行证据来自相同 Electron 版本及相同绑定字节的独立 Electron Node 测试。

## 固定媒体与字体

ffprobe 使用固定 FFmpeg 9.0.2 源码、LLVM-MinGW 20261020 UCRT 与 GNU make 输入构建，归档修订为 r3。保留完整 FFmpeg 源码、LGPL 许可、编译信息以及适用的 LLVM／MinGW 通知。两个不同临时目录的完整构建得到相同归档 SHA-256：

`94612aac90b8fbe3183ba1fb37469ff14cc5511a3557378eae0bd2926ba53b7a`

二进制与成员摘要、两次构建目录及远端状态见 [media.json](media.json)。早先候选发现的时间戳及绝对源码路径差异已在配方中消除，旧修订未被覆盖或发布。维护命令为 `pnpm --filter @kisaki3/desktop media:archive --target windows-x64`；当前归档可通过 `resources:prepare --archive` 导入。

Noto Sans SC Variable 5.3.1 与 Noto Sans Mono Variable 5.3.0 的文件和许可按固定输入清单装配，最终制品测试逐文件核对摘要。这是字体资源输入与装配证据，不提前声明 W05 的字体偏好功能完成。

媒体准备用例覆盖缓存校验、损坏后重取、失败保留旧结果、未声明成员与不匹配目标拒绝。只登记已实际取得的 windows-x64 归档；其余五个目标没有虚构摘要。

## 门槛与剩余事项

| 门槛 | 本包已验证范围 | 剩余范围 |
| --- | --- | --- |
| A24 | 本机媒体与字体固定输入、目标选择、摘要校验、失败保留和可重复归档 | 其余五目标归档；自有不可变远端归档的持续取得 |
| A26 | 隔离仓库中的安装、重复安装、冲突、卸载、用户后改配置、部分暂存和 worktree 行为；普通检查入口 | 六目标 CI 的实际执行与必需检查接续 |
| A28 | Windows x64 原生／SQLite ABI、四窗口、开发会话及加固 ZIP 的启动退出入口 | 其余五目标候选及基础运行；安装、更新、macOS 签名和完整业务由后续工作包接续 |
| A31 | 实际成员、语言与类型归属、公开导入与运行环境边界、输出写入和清理用例 | 六目标上的适用运行确认；后续包和业务扩展相应断言 |

初次基线记录时，六目标 CI 与媒体工作流已配置，但尚未上传或执行；新工程尚未建立远端。后续临时私有验证库与正式仓库的接续见[远端接续记录](../../../../implementation/w00-remote-handoff.md)。

首次清理 `clients/desktop/app/out/windows-x64.staging-HEGI26.previous` 时，带 `-Force` 的命令被自动审批拒绝。随后按用户说明，核对路径和进程后使用不带 `-Force` 的递归清理成功，目录已不存在。常规输出清理实现及用例已通过。

## 已确认取舍

`unplugin-solid` 的配置声明会引入无关打包器声明及上游类型冲突。用户确认仅 UI 的 tsdown 配置采用 `skipLibCheck`；UI 源码、工具源码、纯包和仓库外消费者继续严格检查。规则已同步至[工作区的声明检查合同](../../../../design/engineering/workspace.md#declaration-checks)。

报告中的路径为当次本机运行路径；包与桌面制品的 SHA-256 是消费身份。没有创建 npm 发行、GitHub Release、公开部署或其他仓库变更。
