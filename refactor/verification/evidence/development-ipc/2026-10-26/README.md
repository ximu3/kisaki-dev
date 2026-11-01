# Node 父子 IPC 与进程退出

2026-10-26，在 Windows x64、Node 24.11.1、Electron 44.5.1 与 electron-builder 26.15.3 中，验证直接启动正式加固载体时的父子消息与退出行为。记录支持开发连接的原生传输和进程寿命；现行调用与通知由[开发控制合同](../../../../design/engineering/protocols.md#development)定义。

## 实际结果

试件主模块位于 ASAR，按本体配置生成目录制品，并从可执行文件回读 fuses。来源与输入见[source-inputs.json](source-inputs.json)，消息、运行版本、退出及制品摘要见[result.json](result.json)。

| 条件       | 实际结果                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 应用身份   | app.isPackaged 为 true，进程类型为 browser                                                                                          |
| 应用运行时 | Node 24.21.0、Electron 44.5.1、Chromium 152.0.7977.130                                                                              |
| 生产 fuses | RunAsNode、NodeOptions、NodeCliInspectArguments 和额外 file 协议权限关闭；ASAR 完整性、OnlyLoadAppFromAsar 与 CookieEncryption 开启 |
| JSON 消息  | child.send 与 process.send 保留中文、日文路径、空数组、false 和 0                                                                   |
| 退出取消   | before-quit 拒绝一次退出后，应用继续响应                                                                                            |
| 正常退出   | 父进程观察到实际 exit，退出码为 0                                                                                                   |
| 通道断开   | 应用收到 disconnect 后执行正常退出，父进程取得 exit，退出码为 0                                                                     |

制品未签名，数据位于试件自己的隔离目录。源码为[主模块](main.ts)与[运行器](run.ts)，可在仓库根通过以下命令建立新的试件：

```sh
pnpm exec tsx refactor/verification/evidence/development-ipc/2026-10-26/run.ts
```

该试件验证原生通道与进程行为。完整工程的六目标、开发会话与候选制品结果见[W00 验收](../../w00/README.md)，SDK、构建采用与作者工作流按各自工作包验收。

## exit、disconnect 与流

本机主动调用 child.disconnect 后，普通 Node 子进程和打包 Electron 均报告 disconnect 与 exit，观察期内未报告 ChildProcess.close。pipe 和 inherit 两种日志配置均观察到这一行为，见[Electron 记录](disconnect-diagnostic.json)与[Node 对照](node-disconnect-control.json)。

[Node #65646](https://github.com/nodejs/node/issues/65646)记录了相符的复现与 IPC close 计数问题。启动器据公开 exit 事件确认进程结束，分别收尾自己拥有的日志流；disconnect 表达通道结束。依据见[Node 24.11.1 子进程合同](https://nodejs.org/download/release/v24.11.1/docs/api/child_process.html)。

Node 提供消息序列化与通道交接；直接启动应用可以保留正式 fuses。相关能力见[Node IPC](https://nodejs.org/download/release/v24.11.1/docs/api/child_process.html#optionsstdio)与[Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)。AppImage 的实际策略和采用结果由[载体证据](../../appimage-policy/2026-10-26/README.md)维护。
