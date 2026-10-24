# Vantage 平台路线与窗口绘制探针

对应已确认方向的[平台路线与采集结果](../../../design/projects/vantage/backends.md)。这里区分来源事实、候选设计与实际执行，不把接口存在或一次原生成功返回当作窗口采集已经通过。

## 平台来源

[source-probe.py](source-probe.py) 读取二十项官方规范、文档或项目源码，记录 URL、HTTP 状态、时间、字节数和 SHA-256，见 [source-contract.json](source-contract.json)。可取得的 Apple 文档使用官方 Markdown 正文，Mutter 42.0 与 KWin 5.24.7 用明确 tag；当前分支只作比较，不代表全部目标版本。

Accessibility 提示语义另参考官方页面的索引说明；该页面提供的 Markdown 地址返回 404，没有计入上述下载回执，也不将 JavaScript 占位页当作已读取正文。

| 来源                                                                                                                                                                                                                                     | 关键事实与用途                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Windows IsWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-iswindow)                                                                                                                                      | 外部窗口可能在检查后销毁，句柄可能复用；不能据此证明跨调用的原子身份保证                       |
| [CreateForWindow](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)                                                  | 指定 HWND 创建采集对象，最低条件为 Windows 10 1903                                             |
| [CreateFreeThreaded](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.direct3d11captureframepool.createfreethreaded?view=winrt-26100)                                                                                  | Windows 10 1809／17763 起可用；帧池不依赖 DispatcherQueue，事件在内部工作线程产生              |
| [IsCursorCaptureEnabled](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.iscursorcaptureenabled?view=winrt-26100)                                                                              | Windows 10 2004／19041 起可用；可明确控制系统光标是否进入帧，构成本轮下限建议的接口依据        |
| [Windows 采集与 HDR](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)                                                                                                                   | 帧池表面有借用寿命；HDR 可能需要浮点链路与额外色调映射                                         |
| [PrintWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-printwindow)                                                                                                                                        | 同步阻塞、目标绘制和输出 DC 有明确约束，不能把工作线程等同于可取消                             |
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

本轮另外查看了 Apple XNU 当前及历史 libproc 源码。不同源码版本的符号不能直接替代 macOS 13 运行条件，因此没有将新出现或未核实的接口写成已选定后端，也未把私有接口作为已获确认的依赖。

Windows 10 2004（19041）下限与单一 WGC 后端已获确认。下列较早绘制机制的探针保留为历史调查证据，不作为正式架构或必须补齐的旧版本采集路径；PrintWindow 文档仍保留在来源回执中以解释已有实验。

<a id="windows-probe"></a>

## Windows 自有窗口探针

[windows-window-probe.py](windows-window-probe.py) 只创建不显示的自有窗口和受控子进程，不枚举、采集或控制用户其他窗口。结果见 [windows-window.json](windows-window.json)。夹具窗口具有一个可以绘制红、绿、蓝、白区域的 WM_PRINT 处理函数，但窗口没有显示或正常呈现过。

| 实际步骤                                       | 观察结果                                                              | 能说明什么                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 对该隐藏窗口调用 PrintWindow                   | 原生返回 true；未观察到夹具 WM_PRINT 回调，样点为黑色，未取得夹具图像 | 该场景没有验证出可用画面；不能据此否定普通可见窗口，也不能把此结果作为采集通过 |
| 从另一进程直接发送 WM_PRINT 并传入其 DIB 的 DC | 目标收到消息，但接收缓冲仍是初始化样点，未取得夹具图像                | 这次跨进程实验没有形成 PrintWindow 的等价替代，不作为正式实现路线              |
| 让自有目标在 WM_PRINT 回调中故意停止继续处理   | 发送方超过 500 ms 观察窗口；随后结束自有测试进程完成收尾              | 证明了此消息调用的阻塞行为；不冒充 PrintWindow 阻塞已经实测                    |

前两项是记录下来的未通过结果，探针成功结束不表示像素验证通过。JSON 明确保存 matchesFixture: false；没有把黑色检测或图像哈希当作真实窗口内容通用判定算法。普通黑色内容仍可能是有效图像。

测试进程和正常路径的 DC／位图均在结束时清理，故意阻塞路径只终止本脚本创建的进程。没有展示窗口或写出用户画面，没有执行 WGC、GPU 绘制、HDR、句柄复用或 Vantage API。本轮结果不证明辅助进程已经成为必要或充分的正式架构。

```powershell
python refactor/verification/evidence/vantage-platforms/source-probe.py
python refactor/verification/evidence/vantage-platforms/windows-window-probe.py
```

## 尚未完成

本试件未验证 Windows 下限、macOS 窗口映射、GNOME／KDE 接入、系统授权和完整图像转换。结构化结果只描述本次实验；各平台实际运行按[Vantage 场景](../../scenarios/vantage.md)验收。
