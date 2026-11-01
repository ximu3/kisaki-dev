# Linux 组件、KWin 版本与 AppImage 接入依据

2026-10-19 核对，对应已确认方向的[Linux 组件与交付](../../../design/projects/vantage/linux.md)。本次读取固定版本源码、规范和 AppImage 文档，没有安装组件、写入桌面登记、执行 Linux 桌面或采集窗口。

## KWin 检查确实存在版本差异

[来源脚本](linux-integration-source-probe.py)读取五个固定版本的截图实现及明确的移除提交，记录 HTTP 状态、摘要和标记，见[回执](linux-integration-source-contract.json)。标记断言只证明已读源码中的相应实现存在或已移除，不是运行权限或截图测试。

| 版本     | checkPermissions 与受限接口查询    |
| -------- | ---------------------------------- |
| v5.24.7  | 存在。                             |
| v5.27.12 | 存在。                             |
| v6.6.0   | 存在。                             |
| v6.7.0   | 存在。                             |
| v6.8.0   | 已移除，CaptureWindow 入口仍存在。 |

[上游提交 0ea31ae](https://github.com/KDE/kwin/commit/0ea31ae72eb052cb9c9cc508318fc3f0f329ed53)同时移除检查实现、调用点及 D-Bus 文档中的对应要求。维护者指出用户能够修改桌面文件，因此不把这个字段视为可靠的应用安全隔离。本项目采用的判断是按实际版本处理这个具体机制，不将其扩展为所有其他权限或 sandbox 限制也已消失。

## 桌面登记与宿主路径

[KWin 5.24.7](https://github.com/KDE/kwin/blob/v5.24.7/src/utils/serviceutils.h)直接比较 Exec 的规范路径；[5.27.12](https://github.com/KDE/kwin/blob/v5.27.12/src/utils/serviceutils.h)和[6.7.0](https://github.com/KDE/kwin/blob/v6.7.0/src/utils/serviceutils.h)先使用 QProcess::splitCommand，再比较第一项。这说明带参数、引号和路径的处理不能仅凭字段名称推定一致。

[KService 5.92 的应用查询](https://github.com/KDE/kservice/blob/v5.92.0/src/services/kapplicationtrader.cpp)检查当前桌面适用性；[KService 实现](https://github.com/KDE/kservice/blob/v5.92.0/src/services/kservice.cpp)分别处理 showInCurrentDesktop 与 noDisplay。[Desktop Entry 规范](https://specifications.freedesktop.org/desktop-entry-spec/latest/recognized-keys.html)说明 NoDisplay 的展示含义。它们为专用非菜单条目的候选提供依据，但没有证明缓存、多个匹配条目或真实调用已经通过。

[AppImage 文档](https://docs.appimage.org/packaging-guide/environment-variables.html)区分 APPIMAGE 文件路径与 APPDIR 挂载目录。这支持分别核验启动入口和运行程序，不能仅凭其中一个环境变量断定原生调用身份。当前没有验证动态登记或符号链接能在全部目标 KWin 版本可靠满足检查。

## 协议接入不能只凭目录推定

[D-Bus 规范](https://dbus.freedesktop.org/doc/dbus-specification.html#bus-messages-get-connection-credentials)提供实际连接凭据的查询机制；它不识别同一个 Node 进程中的不同 JavaScript 项目，也不让请求自报的 appId 成为身份凭据。

[KWin 5.24.7](https://github.com/KDE/kwin/blob/v5.24.7/src/scripting/scripting.cpp)与[6.8.0](https://github.com/KDE/kwin/blob/v6.8.0/src/scripting/scripting.cpp)均向脚本提供 QTimer 和 callDBus。调用采用异步 D-Bus 回复；错误分支不进入成功回调。由此可以评估脚本向 Rust 端点发起有限交互的路线，但没有证明发现、双向请求、超时、断连和窗口生命周期已经接通。没有采用全量窗口日志作为传输，也没有引入 C++ 桌面插件或新的常驻进程。

## 当前结论

Linux 接入分别处理原生版本限制、本地会话信任和组件启用。组件开启后，同一用户的本地客户端可访问有限接口；这一访问边界由[Linux 合同](../../../design/projects/vantage/linux.md)定义，实际接入与生命周期仍须验证。

本页证据来自固定源码和文档，原生执行字段均为 false；实际 Linux 接入须按目标版本验证。
