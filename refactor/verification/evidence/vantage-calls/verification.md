# Vantage 调用、授权与画面范围的设计依据

对应[调用、权限与采集边界](../../../design/projects/vantage/api.md)。公开调用、取消、回调、Node 存活、系统光标排除及原生单窗画面边界均已确认，真实平台行为仍须验证。只检查声明消费、读取官方资料与固定版本源码；没有构建 Vantage addon、请求系统授权、读取其他程序窗口或执行原生采集。

## 声明消费

[contract.d.ts](contract.d.ts) 与 [macos-contract.d.ts](macos-contract.d.ts) 分别是主入口和 macOS 子入口的设计用声明，[consumer.ts](consumer.ts) 是只编译、不运行的消费样例。[tsconfig.json](tsconfig.json) 使用 strict、exactOptionalPropertyTypes、noUncheckedIndexedAccess 与 Node 类型，不加载 DOM 类型或私有应用源码。

实际环境为 Node v24.11.1、TypeScript 6.0.3，以下检查以退出码 0 完成：

```powershell
pnpm exec tsc --project refactor/verification/evidence/vantage-calls/tsconfig.json
```

检查覆盖进程与窗口引用不能混用、普通对象和 PID 不能作为引用、快照只读、图像字节可由持有者修改、局部字段与观察事件可按判别字段收窄、取消选项和授权类别有明确类型。标有 @ts-expect-error 的反例必须确实被编译器拒绝。

这没有验证原生引用不可伪造、生成声明与真实导出一致、Promise 拒绝时序、监听器异常、事件循环持有或资源释放。当前也没有发布或执行这个声明所描述的包。

## 官方来源

[source-probe.py](source-probe.py) 实际读取十一项文档或源码，并把 URL、HTTP 状态、时间、字节数、SHA-256 与存在性标记记录在 [source-contract.json](source-contract.json)。所有回执为 HTTP 200。Apple 文档使用官方 Markdown 正文，KWin 与 Mutter 使用明确 tag；Node 文档属于 v24 系列，记录具体内容摘要，不把文档系列等同于正式包的最低运行版本。

| 来源                                                                                                                                                                                                                                                                                                            | 已核实的范围                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Node-API](https://nodejs.org/docs/latest-v24.x/api/n-api.html#napi_fatal_exception)                                                                                                                                                                                                                            | napi_fatal_exception 将原异常交给 JavaScript 未捕获异常路径，与立即终止程序的 napi_fatal_error 不同；环境有异步清理入口 |
| [AbortSignal](https://nodejs.org/docs/latest-v24.x/api/globals.html#class-abortsignal)                                                                                                                                                                                                                          | 提供取消、期限信号与信号组合；不证明原生系统动作能被撤回                                                                |
| [屏幕采集预检](<https://developer.apple.com/documentation/coregraphics/cgpreflightscreencaptureaccess()>)与[请求入口](<https://developer.apple.com/documentation/coregraphics/cgrequestscreencaptureaccess()>)                                                                                                  | 两个独立 Bool 接口存在；请求入口从 macOS 10.15 可用。页面没有提供完整授权交互状态机，实际提示、返回和消费身份仍待验证   |
| [showsCursor](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/showscursor)                                                                                                                                                                                                     | macOS 12.3 起可用，默认包含光标，需要显式设置                                                                           |
| [ignoreShadowsSingleWindow](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/ignoreshadowssinglewindow)                                                                                                                                                                         | 从 macOS 14 起提供单窗口阴影开关，不能作为 macOS 13 已有能力                                                            |
| [contentRect](https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/contentrect)、[scaleFactor](https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/scalefactor)与[status](https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/status) | 帧元数据从 macOS 12.3 可用；属性名称与存在性本身不证明去阴影范围或像素换算已经正确                                      |
| [Mutter 42.0](https://github.com/GNOME/mutter/blob/42.0/data/dbus-interfaces/org.gnome.Mutter.ScreenCast.xml)                                                                                                                                                                                                   | RecordWindow 声明单窗口及 cursor-mode，默认 hidden；这不代替真实桌面上的帧验证                                          |
| [KWin 5.24.7](https://github.com/KDE/kwin/blob/v5.24.7/src/effects/screenshot/screenshotdbusinterface2.cpp)                                                                                                                                                                                                     | CaptureWindow 先检查权限；选项转换含 include-decoration、include-cursor、native-resolution，仍须验证实际窗口和输出      |

Windows 光标接口与版本依据复用[已记录的平台来源](../vantage-platforms/platform-routes.md)。Accessibility 提示语义复用 Apple 的[官方索引正文](https://developer.apple.com/documentation/applicationservices/1459186-axisprocesstrustedwithoptions)：提示异步，不改变函数的即时布尔结果。

## 请求身份补充

Apple 的 Accessibility 接口说明与 [Electron 对应接口](https://www.electronjs.org/docs/latest/api/system-preferences#systempreferencesistrustedaccessibilityclientprompt-macos)均以当前进程是否受信任描述检查对象。Vantage 是进程内原生库，因此请求身份来自真实宿主，不来自 npm 包名称或调用参数中伪造的应用标识。

Apple DTS 对[负责应用的归属](https://developer.apple.com/forums/thread/125438)和[稳定代码签名](https://developer.apple.com/forums/thread/663889)的说明，支持将调用进程、其归属应用与授权记录分别核验。两篇说明的具体问题是文件权限，不能据此直接宣称所有 Accessibility、ScreenCaptureKit 或辅助进程组合具有相同结果。本次只采用其中关于系统归属与签名稳定性的边界说明；实际屏幕采集和辅助功能请求仍需用正式签名消费程序验证。

没有在 macOS 执行请求、检查设置页中的应用条目、改变签名或运行任何辅助程序。声明消费通过不证明开发 Electron、Node 命令行与 Kisaki 成品获得了同一授权身份。

## 结论边界

权限入口、取消、回调与等待期限由[公开调用合同](../../../design/projects/vantage/api.md)定义。本页只核对来源和声明，未执行真实模块加载、平台权限交互或采集调用。

平台归属的判断基于授权对象、流程与生命周期的差异，不将查询和申请权限概括为 macOS 独有机制。公共操作核验、平台授权辅助和宿主交互分别拥有职责。Windows 的相应依据另见[访问权与监测记录](../vantage-platforms/windows-access.md)，Linux portal 与桌面专用接入的区别沿用[平台来源](../vantage-platforms/platform-routes.md)；授权预检通过不保证后续操作成功。

macOS 13 的阴影边界、Accessibility 与采集窗口映射、各平台实际权限行为和窗口实例安全，以及六目标真实消费都没有通过验证。正式声明还必须与实际 addon 导出及 napi-rs 的回调、拒绝和清理行为相符。

## 取消、引用与采集依据

固定 [Node v24.11.1 AbortSignal 文档](https://github.com/nodejs/node/blob/v24.11.1/doc/api/globals.md#class-abortsignal)定义期限和组合信号；[Node-API 文档](https://github.com/nodejs/node/blob/v24.11.1/doc/api/n-api.md#asynchronous-thread-safe-function-calls)定义原生回调的事件循环引用、异常与环境清理。绑定负责按公开合同安排首次交付和释放，在 JavaScript 环境结束时完成原生收尾。

[Windows 采集文档](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)定义帧到达、取帧和实际内容尺寸。Vantage 的取消与资源寿命按平台接口实现，宿主拥有整次业务的等待预算。原生调用、权限与帧边界的验收见[W09](../../../implementation/work-packages.md#w09)。
