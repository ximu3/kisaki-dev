# 开发连接的父子 IPC 探索

2026-10-26，根据“探索第二项，替换设计应当彻底”的要求，核对现行开发合同、W00 启动器、正式打包设置与相关上游行为。结论是：**建议将作者开发与源码桌面开发统一为 Node 父子进程 IPC，使用 JSON 消息，整体移除专用 socket 与自定义字节帧。** 完整替换草案见[方案](proposal.md)，本轮没有改写正式协议或生产实现。

## 实际验证

本次探索之后，方案已获确认并完成[W00 接入替换及实施验证](implementation/README.md)。以下仍记录独立试件的原始范围，不将其改写为正式业务已完成。

使用本地锁定的 Electron 44.5.1、electron-builder 26.15.3，生成独立 Windows x64 目录制品。主模块位于 ASAR；试件读取本体 electron-builder.yml 的实际 fuse 配置，并从完成的可执行文件回读验证。ASAR 仅含主模块与 package.json，见[输入摘要](source-inputs.json)。

| 条件 | 实际结果 |
| --- | --- |
| 正式打包状态 | app.isPackaged 为 true，进程类型为 browser |
| 运行时 | 父进程 Node 24.11.1；应用内 Node 24.21.0、Electron 44.5.1、Chromium 152.0.7977.130 |
| 加固设置 | RunAsNode、NodeOptions、NodeCliInspectArguments、额外 file 协议权限关闭；ASAR 完整性、OnlyLoadAppFromAsar、CookieEncryption 开启 |
| 消息往返 | 通过 child.send／process.send 交换普通 JSON，中文、日文路径、空数组、false 与 0 保留 |
| 退出被取消 | 真实 before-quit 回调拒绝一次退出后，应用继续响应后续消息 |
| 正常退出 | 应用回复正在退出，随后父进程取得真实 exit，退出码为 0 |
| 通道断开 | 应用收到 disconnect，执行本次试件的正常退出，父进程取得 exit，退出码为 0 |

两条流程的原始消息、运行时、退出结果及可执行文件／ASAR 摘要保存在 [result.json](result.json)。Windows 制品未签名，与本项目现行 Windows 策略一致；未安装程序，资料仅写入试件自己的隔离目录。试件验证通信和生命周期，不代表完整 kisx、扩展采用、HMR 或产品退出界面已经实现。

源代码为 [main.ts](main.ts) 与 [run.ts](run.ts)，构建和运行使用公开 CLI／API。试件中的 echo 与编号只用于对应实验输入，不是新正式协议。复现命令：

```sh
pnpm exec tsx refactor/verification/evidence/development-ipc/2026-10-26/run.ts
```

也可以将本次结果中的 work 路径作为最后一个参数，复用已经完成的试件；运行器会核对 ASAR 中的主模块与当前试件源码相符。当前字节保存在仓库 .cache/development-ipc 下，不是产品发行物。

## 退出事实与 Node 已知问题

本机主动调用 child.disconnect 后，普通 Node 子进程与打包 Electron 均报告 disconnect 和 exit，但观察期限内没有 ChildProcess 的 close。stdout／stderr 使用 pipe 或 inherit 时都可复现，见[Electron 记录](disconnect-diagnostic.json)与[普通 Node 对照](node-disconnect-control.json)。

这与 [Node #65646](https://github.com/nodejs/node/issues/65646)的公开复现和源码归因一致：显式断开路径没有完成 IPC 对 close 的计数。它不能被解释为应用仍在运行，也不需要本项目补丁修改 Node 私有状态。

启动器以公开的 exit 事件确认自己启动的进程已经结束；若另外取得日志管道，则分别等待或释放自己拥有的流。disconnect 仍只说明通信已断开。新设计按这些实际事实管理收尾，不用固定延时、PID 轮询或虚构 close 事件恢复状态。[Node 24.11.1 子进程合同](https://nodejs.org/download/release/v24.11.1/docs/api/child_process.html)

最初试件在 ESM 顶层等待 app.whenReady，阻塞了模块求值结束，未进入就绪；[初次记录](initial-probe-result.json)与[启动诊断](startup-diagnostic.json)保留这一试件错误。修正为模块求值结束后接续 ready，与本体现有 entry.ts 的启动方式一致。后续等待 close 又暴露上述 Node 问题。最终两条流程按实际 exit 验证通过，这些前期结果不作为父子 IPC 不可用的证据。[Electron ESM 说明](https://www.electronjs.org/docs/latest/tutorial/esm#you-must-use-await-generously-before-the-apps-ready-event)

## 启动路线与尚未取得的运行证据

| 平台／载体 | 方案与依据 | 本轮证据 |
| --- | --- | --- |
| Windows 安装或 ZIP 内的 exe | 直接 spawn 本体可执行文件，保留父子 IPC；不使用 Electron RunAsNode 模式 | 独立打包试件已运行；完整 Kisaki 作者入口尚未实现 |
| macOS .app | 读取 bundle 的主可执行文件，直接启动该文件；保持原包与签名 | 现行制品测试已采用直接启动路线；本轮未取得 macOS IPC 实测 |
| Linux DEB／RPM | 直接启动实际应用可执行文件 | 本轮未取得 Linux IPC 实测 |
| Linux AppImage | 启动实际 AppImage，保留运行时及 AppRun 的正常执行链 | 锁定 builder 的 AppRun 使用 exec 转入本体；原始 AppImage 的描述符继承与退出仍须实际核对 |

现行 builder 默认采用 appimage-12.0.1 工具集，其生成器与选择规则的摘要保存在 [source-inputs.json](source-inputs.json)。源码依据为 [26.15.3 AppRun 生成器](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/app-builder-lib/src/targets/appimage/appImageUtil.ts)与[工具集选择](https://github.com/electron-userland/electron-builder/blob/electron-builder%4026.15.3/packages/app-builder-lib/src/toolsets/linux.ts)。源码里的 exec 支持这条候选路线，但不代替对应制品运行。

Node 的标准 IPC 自动建立和交付消息通道，选择 JSON 可避免为这些普通业务值引入 V8 高级序列化依赖。Electron 的 RunAsNode fuse 控制 ELECTRON_RUN_AS_NODE 与其 fork 用法，本次直接启动应用无需打开它；实际 fuse 回读与运行结果已确认这一点。[Node IPC](https://nodejs.org/download/release/v24.11.1/docs/api/child_process.html#optionsstdio)、[Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)

### 同时发现的 AppImage 问题

锁定的 AppRun 生成器在 unshare 检查失败时自动附加 --no-sandbox，与[本体构建合同](../../../../design/engineering/build.md#updates-and-portability)不符。当前应用配置没有替换这一生成行为。本轮确认的是源码中实际存在的分支，没有在 Linux 上运行或证明它已在既有 CI 中触发。

这项既有载体问题需要单独修正；父子 IPC 验证不能以放宽沙箱为前提，也不能用 Windows 的通过结果将它略去。它不构成保留第二套 socket 通道的理由。

## 替换范围

作者 socket 方案目前只存在于正式设计和历史探针，extension-cli 与 desktop-contracts 的现行源码尚未实现该协议。可以直接替换未发布合同，不建设双协议、自动回退或旧客户端兼容层。

该方案同时覆盖 ready／shutdown 通道、开发能力接入、资料目录与可取消停止。具体拥有者、消息和验证边界见[方案依据](proposal.md)，采用结果见[实现验证](implementation/README.md)。
