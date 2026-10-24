# Vantage 整体接入审视的来源与边界

2026-10-19 复核，对应[整体接入与交付审视](../../../design/engineering/integrations.md)。本次核对现有设计、官方接口、固定版本源码及代表项目的实际调用位置，没有构建 Vantage addon、操作用户进程、运行原生窗口采集、安装桌面组件或请求授权。

## 引用与原生操作

[Microsoft IsWindow 文档](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-iswindow)明确说明外部窗口可能在检查后销毁，句柄也可能复用。它支持既定的逻辑引用与系统原子性区分，不支持以 IsWindow 加 PID 比较宣称跨调用原子性。

[Linux pidfd_send_signal](https://man7.org/linux/man-pages/man2/pidfd_send_signal.2.html)描述通过进程文件描述符发送信号的入口及访问限制。这不替代发现、打开和持续识别原实例的接续，也不把发送信号等同于应用协作退出。

读取 [XNU xnu-8792.81.2 的 libproc.h](https://github.com/apple-oss-distributions/xnu/blob/xnu-8792.81.2/libsyscall/wrappers/libproc/libproc.h)与[实现](https://github.com/apple-oss-distributions/xnu/blob/xnu-8792.81.2/libsyscall/wrappers/libproc/libproc.c)时，可见 proc_pidpath_audittoken 对 pid version 的比较及 proc_terminate 按 PID 调用的区别；当前主分支还出现了其他 audit-token 控制入口。不能据此把主分支新增入口当作既定最低系统上的已验证能力，普通非 AppKit 进程的控制路线仍待核实。

<a id="macos"></a>

## macOS 对象对应候选

Apple 的 [AXUIElement](https://developer.apple.com/documentation/applicationservices/axuielement)描述可访问性对象；[SCWindow](https://developer.apple.com/documentation/screencapturekit/scwindow)公开 Core Graphics 窗口编号。读取这些公开资料没有得到已经验证的完整转换路线。这是当前证据范围，不能扩大成“系统绝无其他公开路线”的结论。

通过 GitHub API 取得 Hammerspoon 本次读取的固定提交 23e387e2805a9890066366e0ac96c71b27f0cfd5，并核对：

| 文件                                                                                                                          | 实际位置与用途                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [HSuicore.h](https://github.com/Hammerspoon/hammerspoon/blob/23e387e2805a9890066366e0ac96c71b27f0cfd5/Hammerspoon/HSuicore.h) | 第 172 行以 extern 声明 _AXUIElementGetWindow。                            |
| [HSuicore.m](https://github.com/Hammerspoon/hammerspoon/blob/23e387e2805a9890066366e0ac96c71b27f0cfd5/Hammerspoon/HSuicore.m) | 第 657–660 行由 AX 对象读取窗口编号；第 893–895 行在截图路径重新取得编号。 |

这些源码是该项目采用此调用的直接证据，不是 Apple 对接口稳定性的承诺，也不证明 Vantage 的 macOS 13、两种架构、实际授权、编号竞争或 ScreenCaptureKit 交接已经通过。没有复制该项目的实现，也没有把该项目加入依赖。

候选仅用于评估 AX 对象与采集对象的桥接。窄范围桥接的维护方向已经确认，正式采用仍需完成目标系统测试；不能根据这个参考项目就放宽原实例保证、采用标题匹配或增加系统注入。

### 与系统版本下限的关系

补充读取 [AeroSpace 的项目说明](https://github.com/nikitabobko/AeroSpace#project-values)，其当前实现仍说明使用 _AXUIElementGetWindow 取得可访问性窗口的编号；兼容说明区分 macOS 13 起的运行范围与更高版本的构建环境。这支持将该映射需求与“仅为 macOS 13 保留的分支”区分，但不证明 Vantage 的目标系统已经通过。

Apple [SCScreenshotManager](https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager) 的官方 Markdown 标明从 macOS 14 提供，其按过滤器采集的入口接收 SCContentFilter 与配置。[SCWindow](https://developer.apple.com/documentation/screencapturekit/scwindow)则提供 CGWindowID。单帧采集入口的出现不等于已经提供 AXUIElement 到 SCWindow 的公开转换；本次仍未核实到可替代候选桥接的完整公开路线。

这次补充只核对接口职责与项目实际采用情况，没有在 macOS 执行任何调用，也没有采用参考项目的安装、系统配置或签名策略。

<a id="linux"></a>

## Linux 调用身份与桌面组件

| 固定来源                                                                                                                                                                          | 核对事实                                                                                                           | 对当前设计的影响                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [KWin 5.24.7 serviceutils.h](https://github.com/KDE/kwin/blob/v5.24.7/src/utils/serviceutils.h)                                                                                   | 从 /proc/PID/exe 取得调用者可执行路径，并与桌面服务 Exec 的规范路径比较，再读取 X-KDE-DBUS-Restricted-Interfaces。 | 包名与消息里的 appId 不足以代替真实宿主登记；参数、启动器和 AppImage 路径必须按最终制品核验。 |
| [KWin 5.24.7 截图 D-Bus 接口](https://github.com/KDE/kwin/blob/v5.24.7/src/effects/screenshot/screenshotdbusinterface2.cpp)                                                       | checkPermissions 从实际 D-Bus sender 查询 PID，再检查该进程获准的接口；随后才接纳窗口截图。                        | 不能以桌面组件存在或窗口枚举成功推断调用宿主可以截图。                                        |
| [GNOME Shell 42.0 introspect.js](https://github.com/GNOME/gnome-shell/blob/42.0/js/misc/introspect.js)与[util.js](https://github.com/GNOME/gnome-shell/blob/42.0/js/misc/util.js) | 内建窗口查询使用 DBusSenderChecker；它核对实际 sender 对应的允许名称，拒绝未获允许的调用。                         | 桌面内部对象可读取不等于任意外部进程获准调用；不能让自己的组件仅相信请求自报身份。            |

GNOME 的源码只说明该内建接口如何检查调用者，不是 Vantage 自有组件授权设计已经成立的证明。没有采用其中的 unsafe_mode，也没有调整任何 Shell 安全设置。KWin 源码属于明确旧版本，不能据此声称后续版本身份解析完全相同。

当前 AppImage 在目标 KWin 上的实际可执行路径、桌面服务匹配、授权和截图尚未执行。本轮只识别出必须闭合的装配问题，没有选择额外辅助进程作为正式路线。

## 本轮结果

已确认的原生单窗范围同步到设计，完整调用与公共形状保持原合同。观察中断、宿主流程和发行验证放在同一职责路径检查；发现的验收措辞须与已经规定的逻辑引用和平台并发边界一致。

本次没有改写历史探针 JSON、重跑类型检查或生成新的原生通过记录。Linux 配套交付和整体接续方向已获原则认可，具体机制仍待闭合；macOS 窄范围非公开桥接按已确认方向继续验证。Linux 访问粒度与版本登记的后续修订另见[新的来源核对](linux-integration.md)。真实 addon、桌面会话、签名宿主和六平台制品均不能由本次来源核对替代。
