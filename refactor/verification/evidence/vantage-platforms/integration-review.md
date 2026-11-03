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

本页核对接口职责与参考项目用法；macOS 原生运行及宿主签署身份仍需验证。

<a id="linux"></a>

## Linux 调用身份与桌面组件

| 固定来源                                                                                                                                                                          | 核对事实                                                                                                           | 对当前设计的影响                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [KWin 5.24.7 serviceutils.h](https://github.com/KDE/kwin/blob/v5.24.7/src/utils/serviceutils.h)                                                                                   | 从 /proc/PID/exe 取得调用者可执行路径，并与桌面服务 Exec 的规范路径比较，再读取 X-KDE-DBUS-Restricted-Interfaces。 | 包名与消息里的 appId 不足以代替真实宿主登记；参数、启动器和 AppImage 路径必须按最终制品核验。 |
| [KWin 5.24.7 截图 D-Bus 接口](https://github.com/KDE/kwin/blob/v5.24.7/src/effects/screenshot/screenshotdbusinterface2.cpp)                                                       | checkPermissions 从实际 D-Bus sender 查询 PID，再检查该进程获准的接口；随后才接纳窗口截图。                        | 不能以桌面组件存在或窗口枚举成功推断调用宿主可以截图。                                        |
| [GNOME Shell 42.0 introspect.js](https://github.com/GNOME/gnome-shell/blob/42.0/js/misc/introspect.js)与[util.js](https://github.com/GNOME/gnome-shell/blob/42.0/js/misc/util.js) | 内建窗口查询使用 DBusSenderChecker；它核对实际 sender 对应的允许名称，拒绝未获允许的调用。                         | 桌面内部对象可读取不等于任意外部进程获准调用；不能让自己的组件仅相信请求自报身份。            |

GNOME 内建接口按调用者身份检查访问。Vantage 自有组件按[Linux 合同](../../../design/projects/vantage/linux.md)建立会话边界；KWin 的版本差异分别核对。

当前 AppImage 在目标 KWin 上的实际可执行路径、桌面服务匹配、授权和截图尚未执行。

## 接入与验证归属

原生单窗、调用与资源寿命由[平台合同](../../../design/projects/vantage/backends.md)定义，Linux 的访问粒度与版本登记依据见[接口核对](linux-integration.md)。来源记录用于确定接口与条件；addon、实际桌面、签署宿主和目标制品由 W09 验收。
