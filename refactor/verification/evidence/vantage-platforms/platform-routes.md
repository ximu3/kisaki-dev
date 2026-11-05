# Vantage 平台接口依据

本页核对[平台路线与采集结果](../../../design/projects/vantage/backends.md)的接口依据，分别记录来源事实、方案比较与已执行的原生操作。

## 平台来源

[source-probe.py](source-probe.py) 读取二十项官方规范、文档或项目源码，记录 URL、HTTP 状态、时间、字节数和 SHA-256，见 [source-contract.json](source-contract.json)。可取得的 Apple 文档使用官方 Markdown 正文，Mutter 42.0 与 KWin 5.24.7 用明确 tag；当前分支只作比较，不代表全部目标版本。

Accessibility 提示语义另参考官方页面的索引说明；该页面提供的 Markdown 地址返回 404，没有计入上述下载回执，也不将 JavaScript 占位页当作已读取正文。

| 来源                                                                                                                                                                                                                                     | 关键事实与用途                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Windows IsWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-iswindow)                                                                                                                                      | 外部窗口可能在检查后销毁，句柄可能复用；不能据此证明跨调用的原子身份保证                       |
| [CreateForWindow](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)                                                  | 指定 HWND 创建采集对象，最低条件为 Windows 10 1903                                             |
| [CreateFreeThreaded](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.direct3d11captureframepool.createfreethreaded?view=winrt-26100)                                                                                  | Windows 10 1809／17763 起可用；帧池不依赖 DispatcherQueue，事件在内部工作线程产生              |
| [IsCursorCaptureEnabled](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.iscursorcaptureenabled?view=winrt-26100)                                                                              | Windows 10 2004／19041 起可用；可明确控制系统光标是否进入帧，构成系统支持下限的接口依据        |
| [Windows 采集与 HDR](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)                                                                                                                   | 帧池表面有借用寿命；HDR 可能需要浮点链路与额外色调映射                                         |
| [SCStream](https://developer.apple.com/documentation/screencapturekit/scstream)与[SCContentFilter](https://developer.apple.com/documentation/screencapturekit/sccontentfilter)                                                           | 流通过过滤器指定内容，可以仅捕获一个 SCWindow，并有启动与停止操作                              |
| [pixelFormat](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/pixelformat)与[colorSpaceName](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/colorspacename)           | 缓冲格式与色彩空间有独立含义；指定输出空间和默认采用显示器空间不同                             |
| [SCWindow.windowID](https://developer.apple.com/documentation/screencapturekit/scwindow/windowid)                                                                                                                                        | 采集窗口具有 Core Graphics 窗口编号，但该属性本身没有完成 Accessibility 对象映射               |
| [AppKit terminate](<https://developer.apple.com/documentation/appkit/nsrunningapplication/terminate()>)                                                                                                                                  | 正常退出请求可能在实际退出前返回，且受应用沙箱条件约束                                         |
| [Accessibility 信任检查](https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions)与[屏幕采集预检](<https://developer.apple.com/documentation/coregraphics/cgpreflightscreencaptureaccess()>) | 前者可以选择是否提示，提示异步且不改变即时返回值；两种权限入口分别存在                         |
| [XComposite 0.4](https://www.x.org/releases/current/doc/compositeproto/compositeproto.txt)                                                                                                                                               | 持有 pixmap 可以延长旧内容寿命，窗口映射／重设大小会分配新 pixmap；旧内容不能代表当前帧        |
| [EWMH 窗口属性](https://specifications.freedesktop.org/wm/latest/ar01s05.html)                                                                                                                                                           | _NET_WM_PID 与客户端机器属性配合，不能单独证明本机实例归属                                     |
| [ScreenCast portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html)                                                                                                                        | 支持用户选择与授权会话恢复，SelectSources 没有任意窗口 ID 参数；不能直接代替既有实例的指定采集 |
| [Mutter 42.0](https://github.com/GNOME/mutter/blob/42.0/data/dbus-interfaces/org.gnome.Mutter.ScreenCast.xml)与[当前协议](https://github.com/GNOME/mutter/blob/main/data/dbus-interfaces/org.gnome.Mutter.ScreenCast.xml)                | RecordWindow 通过 window-id 指定单窗口流；仍须验证实际组件、权限和 PipeWire 交付               |
| [KWin 5.24.7](https://github.com/KDE/kwin/blob/v5.24.7/src/effects/screenshot/screenshotdbusinterface2.cpp)与[当前实现](https://github.com/KDE/kwin/blob/master/src/plugins/screenshot/screenshotdbusinterface2.cpp)                     | 指定窗口和数据管道入口存在；旧版有明确调用权限检查，实际输出与授权按版本验证                   |

## Windows 采集验证

Windows 使用 WGC，最低系统为 Windows 10 2004（build 19041）。实际自有窗口采集、原生颜色处理和独立字节结果见[WGC 验证](../vantage-wgc/capture.md)。

平台接口的适用版本、资源和权限由[当前平台合同](../../../design/projects/vantage/backends.md)定义，各目标运行按[Vantage 场景](../../scenarios/vantage.md)验收。
