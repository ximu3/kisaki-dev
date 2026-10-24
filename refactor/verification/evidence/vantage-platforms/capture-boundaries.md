# Vantage 原生窗口画面边界依据

2026-10-19 复核，对应已确认的[原生单窗边界](../../../design/projects/vantage/api.md#capture-boundary)。本次读取官方文档、规范和固定版本源码，没有运行 Vantage addon 或任何原生窗口采集，没有改变系统权限，也没有把现有 Windows 绘制探针记为 WGC 证据。

## 已读取的事实

| 来源                                                                                                                                                                                                                 | 核实内容                                                                                                                 | 不能据此推定的结论                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| [Windows WGC 文档](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)                                                                                                 | 帧具有 ContentSize；底层表面与有效内容尺寸可能不同，较小内容外存在未定义区域，较大内容可能被帧池尺寸截断。               | 不能仅从帧池宽高判断完整窗口内容，也没有证明具体版本的标题栏、阴影与透明角结果。                         |
| [GetWindowRect](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowrect)                                                                                                                | 结果可能包含不可见的调整大小边框，并受 DPI 虚拟化影响；DWM 扩展边界具有不同坐标约定。                                    | 另一次窗口查询不自动成为同一采集帧的正确裁剪矩形。                                                       |
| [macOS 阴影开关](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/ignoreshadowssinglewindow)                                                                                         | 官方 Markdown 的 availability 标明 ignoreShadowsSingleWindow 从 macOS 14 提供。                                          | 不能作为 macOS 13 的可用入口，也不证明 13 上仅凭某个矩形就能准确去阴影。                                 |
| [contentRect](https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/contentrect) 与 [contentScale](https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/contentscale) | 官方 Markdown 标明这些帧元数据从 macOS 12.3 提供，分别描述内容矩形和内容比例。                                           | 文档没有把它们定义为应用客户区；名称与可用性不证明全部坐标换算和画面边缘已经验证。                       |
| [XComposite 0.4](https://www.x.org/releases/current/doc/compositeproto/compositeproto.txt)                                                                                                                           | 离屏存储对应指定窗口层级，包含其内容、边框与后代；映射或改尺寸会分配新 pixmap。                                          | 目标客户窗口的层级不自动包含窗口管理器在另一个父窗口绘制的装饰；旧 pixmap 仍可读不代表画面仍是当前内容。 |
| [Mutter 42.0 的窗口实现](https://github.com/GNOME/mutter/blob/42.0/src/compositor/meta-window-actor.c)与[窗口流实现](https://github.com/GNOME/mutter/blob/42.0/src/backends/meta-screen-cast-window-stream-src.c)    | 原生缓冲边界由窗口表面及 buffer scale 取得；流的 videocrop 与流范围相交，窗口内容与光标合成分别处理。                    | 不证明全部 GNOME 版本、客户端装饰、服务器装饰与缩放组合具有相同像素结果。                                |
| [KWin 5.24.7 的截图实现](https://github.com/KDE/kwin/blob/v5.24.7/src/effects/screenshot/screenshot.cpp)与[调用适配](https://github.com/KDE/kwin/blob/v5.24.7/src/effects/screenshot/screenshotdbusinterface2.cpp)   | 窗口截图从 expandedGeometry 开始；有装饰且未选择包含装饰时改用 clientGeometry；光标与 native-resolution 分别由选项控制。 | include-decoration 不是一个独立、通用的去阴影开关；不能把 5.24.7 源码当作所有 KWin 版本实测结果。        |

Apple 正文通过各页面的 .md 地址读取；网页只返回 JavaScript 占位内容时没有据此推断 API 行为。Mutter 与 KWin 使用明确版本，Windows、Apple 与 X.org 的网页是本次读取时的内容。本次新增读取没有写入或覆盖此前 source-contract.json 的历史回执。

## 对设计的影响

已确认方案保留实际原生单窗边界，并把共同保证集中在指定实例、有效完整内容、明确像素格式、自有数据和准确失败上。跨平台统一去装饰、去阴影或识别应用内容区域，需要另外成立的几何与语义合同，现有来源不能证明它们自然相同。

不提供这些外观处理选项是已确认的范围选择。它不放宽错误来源、过期帧、裁断内容、错误 DPI、未初始化字节或颜色误标的验收，也不改变已经确认的系统光标排除规则。Kisaki 仍可以在固定原图上提供已有的可选裁剪。

## 仍须实际验证

| 场景                                 | 需要记录的结果                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| 普通系统装饰、自绘标题栏、无边框窗口 | 源窗口身份、后端版本、实际图像及标题栏／边框范围；X11 客户窗口与窗口管理器框架分别辨明。   |
| 阴影、圆角和半透明内容               | 原生结果实际包含的像素与 alpha；没有按透明阈值裁去合法内容，也没有人为补画其他环境的阴影。 |
| 缩放、跨屏、调整尺寸                 | 同帧有效区域、原生比例与输出尺寸一致，图像未裁断、拉伸或包含无效填充。                     |
| 遮挡、最小化、隐藏和恢复             | 每种后端实际可取得的当前画面或准确失败，未改采桌面或另一窗口，未把旧缩略图当作当前帧。     |
| 光标、弹窗及其他窗口                 | 系统光标确实排除，应用自绘指针保留，其他独立窗口没有被另外合入结果。                       |
| 取消、目标关闭及环境退出             | 停止交付后不出现迟到成功结果，原生帧、流、管道和相关回调按所有权收尾。                     |

当前没有任何一行通过本次原生执行得到证明；这份记录提供设计依据与验证目标，不是实现通过报告。
