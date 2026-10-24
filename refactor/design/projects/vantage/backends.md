# Vantage 平台后端

各后端实现同一公共语义，并明确系统能力、身份核验、实际操作及单窗采集的保证。Linux 桌面组件及协议单独见[Linux 接入](linux.md)。

<a id="platforms"></a>

## 支持范围与后端分工

Windows x64 与 arm64 的最低版本统一为 Windows 10 2004（build 19041），使用一条 Windows Graphics Capture 路线承担指定窗口采集，[系统基线](../../engineering/build.md#platforms)与此一致。macOS 13、glibc Linux 的既定发行版、X11 与 Wayland 桌面范围继续保留。各目标的 CPU 架构、系统版本、桌面版本与权限组合分别验收，当前 Windows 主机的探针不能代替六目标验证。

| 环境          | 进程及窗口控制方向                                               | 指定窗口采集方向                                           | 当前需要证明的重点                                                    |
| ------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Windows       | 进程对象句柄；顶层窗口枚举、WinEvent 与明确的窗口操作            | Windows Graphics Capture：指定窗口、独立线程帧池和短期会话 | 既定下限与两种架构的实际采集、取消、颜色转换；窗口实例校验的并发边界  |
| macOS         | 进程信息与生命周期观察；AppKit 应用退出及 Accessibility 窗口操作 | ScreenCaptureKit 的指定窗口过滤和短期 SCStream             | Accessibility 窗口与采集窗口的准确对应、权限、macOS 13 兼容及实例安全 |
| Linux X11     | 独立进程后端；窗口管理协议、生命周期通知与归属核验               | XComposite 对应窗口的 pixmap，再复制为自有图像             | 映射／缩放／重设大小、当前 pixmap、窗口管理器差异及可靠归属           |
| GNOME Wayland | GNOME Shell 组件持有和操作实际窗口对象                           | Mutter ScreenCast 的 RecordWindow，再读取 PipeWire 帧      | 窗口 ID 对应、组件版本、权限、流关闭与帧格式                          |
| KDE Wayland   | KWin 组件维护实际窗口对象及其标识                                | ScreenShot2 的指定窗口入口和数据管道                       | KWin 版本、调用授权、UUID 对应、像素格式与管道收尾                    |

Linux 进程查询和生命周期观察独立于 X11、Wayland、桌面组件和图形初始化。桌面组件仍归 Vantage 的 integrations/linux/gnome-shell 与 integrations/linux/kwin；它们只提供明确的查询、观察和控制协议，不开放任意脚本求值入口。组件缺失或失联按已确认错误合同报告，普通查询不安装组件或弹出授权界面。

统一的是对象含义、调用语义、图像结果、资源所有权与失败边界。平台内部遵循各自正式接口和线程规则；稳定的 Win32、AppKit 或 X11 接口不会仅因年代较早而被替换。GNOME／KDE 的宿主组件属于桌面专用接入，不能将它们写成通用 Wayland 标准能力。原生来源有依据与实际实现成熟分别判断。

<a id="identity"></a>

## 引用保证与平台并发边界

库的引用保证是：保存实际实例的对应关系，持续核对其有效性，绝不把已经确认失效的旧引用重新绑定到同号新对象。路径、标题、显示名称或单个数字都不构成这种对应关系。

Windows 进程句柄、Linux pidfd 等机制能够引用具体进程对象。窗口编号则不能直接获得相同保证。Windows 明确说明外部窗口可以在 IsWindow 检查后销毁，HWND 也可能被复用。因此不能将 IsWindow、PID 和 HWND 的一次比较包装成“原子地确认并操作同一窗口”。

窗口后端需要结合实际窗口对象、创建／销毁观察和所属连接的寿命管理引用；观察断裂时使相关引用失效。平台仅提供分开的校验与操作时，仍存在系统并发边界，不能靠增加一层 JavaScript 引用宣称已经消除。采集对象建立、控制请求和返回结果分别需要验证目标对应，不能把采集成功后的检查当作所有控制请求都可撤回的保证。

公共合同明确区分上述逻辑引用保证与平台可提供的原子性。这个说明不授权按旧 PID 或窗口编号重查另一个对象，也不取消操作前的实例核对。需要更强原生保证的地方继续列为后端可行性问题，不能自行用不可靠定位补齐。

<a id="backends-identity"></a>

## 实例、原生动作与观察结果

ProcessRef／WindowRef 继续表示库持有并核对的原实例。后端串行维护同一原生来源的身份、失效和事件接续，先建立观察条件，再形成初始快照；不能先交付快照、随后才开始接收期间可能丢失的关闭事件。

| 后端             | 选定机制与真实保证                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Windows 进程     | 以必要权限持有原进程句柄；读取与等待不要求终止权限。控制使用同一原实例的相应句柄，句柄关闭不结束进程       |
| Linux 进程       | pidfd 拥有原实例的观察和信号目标，发现／打开前后的进程事实共同核对；proc 路径与名称读取不覆盖 pidfd 的身份 |
| macOS 进程       | 进程信息中的创建时间与 kqueue 的原进程观察接续，路径按实际 libproc 结果读取；不使用截断名称冒充完整文件名  |
| Win32／X11 窗口  | 原生编号、创建／销毁事件与所属连接共同维护有效引用；观察断裂使引用失效，不能凭编号重新附着                 |
| macOS 窗口       | 持有 AXUIElement，并保持所属原进程和窗口生命周期；CGWindowID 仅用于一次原生对应                            |
| GNOME／KWin 窗口 | 组件持有 Meta.Window／KWin Window 对象，内部窗口令牌属于该组件实例及连接；对象销毁或组件重建使旧令牌失效   |

macOS 使用 kqueue 与进程信息判断退出，不把 NSRunningApplication 的动态属性当作即时生命周期事实。Apple 说明这些属性受主 run loop 更新策略影响；普通 Node 宿主尤其不能靠反复读取 isTerminated 证明新事实。[NSRunningApplication](https://developer.apple.com/documentation/appkit/nsrunningapplication)

进程信息使用目标 SDK 已提供的 libproc／sysctl 表面，不另声明 PRIVATE 条件下的唯一标识结构或新增进程控制符号。源码可读取与系统对接口的维护承诺分别看待，不能把发现一个新符号当作既定最低系统已经支持它。

进程协作退出只使用真正的协作入口：macOS 对适用应用调用 NSRunningApplication.terminate，Windows／Linux 按已核实的关联窗口发送正常关闭请求。没有适用机制就报告不支持；不把 SIGTERM 重新命名为应用协作退出。强制终止另行使用 Windows 进程句柄、Linux pidfd 信号或 macOS 明确的 SIGKILL。

macOS 的普通 PID 信号操作在提交前核对原进程身份与观察状态，并保留平台本身分开检查、发出信号的并发边界；没有把它声明为 Windows 进程句柄式的原子操作，也不为此增加另一套非公开进程控制。已经确认失效的引用始终拒绝操作。这与既定[逻辑引用及原子性](#identity)合同一致。

控制成功只表示该方法的请求已经提交或处理。窗口是否恢复／聚焦、应用是否退出仍由查询或观察确认；取消等待不撤回已经提交的原生动作。

<a id="windows"></a>

## Windows：系统下限与采集后端

进程采用实际进程对象、必要的最小访问权限和独立生命周期观察。完整路径读取失败保留已经确认的进程事实；正常退出、强制终止与实际结束继续分开。窗口正常关闭使用适用的协作请求，进程正常退出只处理本次核实的关联目标，不追着随后出现的保存确认窗口继续关闭。

下限由实际所需接口决定：

| 接口                                                                                                                                                                                    | 用途                                                 | 官方最低版本                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| [CreateFreeThreaded](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.direct3d11captureframepool.createfreethreaded?view=winrt-26100)                                 | 帧池无需 DispatcherQueue，帧事件在其内部工作线程产生 | Windows 10 1809，build 17763 |
| [CreateForWindow](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow) | 从明确的 HWND 创建指定窗口采集对象                   | Windows 10 1903，build 18362 |
| [IsCursorCaptureEnabled](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.iscursorcaptureenabled?view=winrt-26100)                             | 明确控制是否包含系统光标                             | Windows 10 2004，build 19041 |

Windows 最低版本为 2004，22H2 可作为常规验证环境。正式制品仍须验证最低版本；其他依赖若需要更高版本，应以具体接口或运行证据提出调整，构建 runner 的版本只描述构建环境。

由 Rust 后端创建采集对象、D3D11 帧池与短期会话，在取得有效帧后完成必要转换和自有内存复制，再释放本次资源。帧池事件不直接接触 JavaScript 对象；Node binding 只接收已明确拥有的结果和完成状态。CreateFreeThreaded 消除的是采集帧池对 DispatcherQueue 的依赖，不能据此推断 WinEvent 等其他窗口机制不需要自己的消息处理。

尺寸变化按实际帧信息处理，不能用旧缓冲区尺寸解释新帧，也不能在帧归还池后继续引用原表面。目标关闭、超时、取消、图形设备变化与 Node 环境退出必须完成回调隔离、会话停止和资源释放验证；更换为 WGC 不自动证明这些条件已经满足。

在明确的系统下限内，库使用同一 WGC 路线完成采集。旧接口的行为与实验范围见[调查记录](../../../verification/evidence/vantage-platforms/platform-routes.md#windows-probe)，正式采集架构按本节的现代接口组织。

WGC 仍须验证 GPU 内容、最小化与隐藏状态、受保护内容、有效帧、权限及资源收尾。系统版本达标不等于每个窗口都可采集；失败沿既定合同报告，不切换为桌面裁切或其他未声明的后端。

<a id="windows-access"></a>

### Windows 权限按观察与操作分别判断

Windows 的管理员账户、进程是否实际提升、对象访问控制与窗口完整性限制分别判断。不能仅根据目标以管理员权限运行，就认定进程不可见、已经退出或必须让整个消费程序提升权限。[权限依据与待验证组合](../../../verification/evidence/vantage-platforms/windows-access.md)记录各项机制及目前的证据范围。

进程基本信息与路径读取使用相应最小查询权限，等待原进程结束使用 SYNCHRONIZE；身份观察不以取得 PROCESS_TERMINATE、内存读取或 PROCESS_ALL_ACCESS 为前提。某项访问被拒绝时，保留其他已经可靠取得的事实，不因合并申请多余权限而丢掉本可完成的监测。

前台窗口与所属 PID 的读取、窗口事件观察、窗口控制及 WGC 采集分别核验。WINEVENT_OUTOFCONTEXT 不注入目标进程，但接口存在不能证明跨完整性级别的事件接续已经通过。较低完整性进程向较高完整性窗口发送控制消息可能被 UIPI 拒绝；实际控制失败不能反推窗口读取或采集也不可用。

Kisaki 的处理继续遵守既定监测规则：进程存活可靠而前台未知时，只暂停前台计时；必要存活事实未知时暂停相应累计，不当作空进程集合或真实退出。关闭、聚焦或采集失败不结束仍可靠的监测，不自动触发退出备份。UAC 切换安全桌面时单独验证观察范围，不能用普通桌面的旧前台值继续累计前台时间。

验证至少包括同一账户的普通消费进程／普通目标、普通消费进程／提升目标、提升消费进程／普通目标、两者均提升；另验证不同账户、受保护或受限对象、UAC 安全桌面造成的限制与恢复。记录实际令牌／完整性和请求访问权，不能仅记录账号是否属于管理员组，也不能用同权限测试推断混合权限行为。x64 与 arm64 的平台验收均须覆盖适用组合。

原生库不因一次权限失败自动重启宿主、请求 UAC 提升或引入管理员辅助进程。若产品需要显式提供提权后的控制，应另行确定宿主启动与交付边界；它不属于 macOS 的授权检查／请求接口，也不能借此取消普通权限下的监测要求。

<a id="backends-windows"></a>

## Windows：采集与颜色转换

后端使用 CreateForWindow、CreateFreeThreaded 和短期 GraphicsCaptureSession，排除光标，以浮点表面保留捕获精度。取得有效帧后按同帧 ContentSize 处理尺寸，以 Direct2D 的原生 HDR tone map／color management 完成 SDR 归一，再复制紧密行布局并转换为 straight alpha。借用的原生帧在释放前完成读取，输出字节独立持有。

Windows scRGB 的原生亮度基准只用于解释输入及设置原生效果参数。输出是标准 sRGB SDR 文件图像；不把当前显示器峰值作为保存文件的目标，也不新增公开亮度旋钮。内容最大亮度优先采用可靠元数据，否则沿 Microsoft 示例从该帧内容估计；不使用一份固定值冒充全部窗口的内容亮度。[原生效果](https://learn.microsoft.com/en-us/windows/win32/direct2d/hdr-tone-map-effect)、[固定内容分析示例](https://github.com/microsoft/Windows-universal-samples/blob/dca302ef956bb9a2653da4e3d925de4bbf4fa174/Samples/D2DAdvancedColorImages/cpp/D2DAdvancedColorImages/D2DAdvancedColorImagesRenderer.cpp)

<a id="macos"></a>

## macOS：应用、可访问性与采集对象

普通进程能力使用不依赖图形界面的原生进程信息与生命周期机制；应用的正常退出采用适用的 AppKit 协作入口。AppKit 的退出方法可能先返回、随后才实际退出，不能以返回布尔值代替生命周期观察。非 AppKit 进程的控制和实例保证需要独立核验，不能只因存在一个按 PID 接收参数的系统调用就宣称已经满足引用合同。

窗口状态与控制通过 Accessibility 接入，采集通过 ScreenCaptureKit 接入。SCContentFilter 的 desktopIndependentWindow 限定一个 SCWindow，其 windowID 是 Core Graphics 窗口编号。两套对象通过下节的[窗口映射桥接](#backends-macos)建立原生对应，按实际系统版本验证身份与有效性；标题、位置和同进程关系只作为辅助核对信息。

macOS 13 基线采用 SCStream 取得单帧，不把较新系统才有的便捷截图接口作为唯一入口。流由库建立、接收、停止并释放，消费者取得的是独立 CPU 图像。采集缓冲区的像素格式、行跨度、内容区域和色彩信息先在原生侧解释，再按公共结果转换。

Accessibility 信任与屏幕采集许可分别检查。普通读取使用不发起交互的检查；只有宿主明确发起授权操作，才调用具有提示作用的接口。AXIsProcessTrustedWithOptions 的提示是异步的，弹出提示不等于许可已经获得。权限还需在实际签名的消费程序中验证，命令行程序的结果不能替代 Kisaki 的授权身份。

<a id="backends-macos"></a>

## macOS：窗口映射桥接

窗口查询和控制沿 Accessibility，指定采集沿 ScreenCaptureKit。`_AXUIElementGetWindow` 作为已确认的窄范围桥接，由原 AXUIElement 取得 CGWindowID，再从当前 SCShareableContent 找到对应 SCWindow。匹配同时核对原进程关系和有效性，不按标题、矩形或列表位置猜测。

这个符号在 macOS 后端集中解析和调用，签名按固定参考实现核对；不可取得或调用失败时报告相应能力不可用。它不成为公开 TypeScript 值，也不扩展为系统注入或私有窗口管理框架。[Hammerspoon 固定声明与调用](https://github.com/Hammerspoon/hammerspoon/blob/23e387e2805a9890066366e0ac96c71b27f0cfd5/Hammerspoon/HSuicore.h)

前台窗口使用 AX 系统对象与所属应用对象的实际焦点关系。读取不到窗口时保留可核实的进程部分，权限不足准确报告；不以最高层窗口或最近标题代替焦点。AXObserver 的 run loop source 由原生后端拥有，调用和事件在所属执行范围收尾；AppKit 操作遵循自身线程规则。

macOS 13 起统一用短期 SCStream 获取单帧。配置指定窗口、排除光标并请求 sRGB SDR；从有效帧状态、内容矩形和比例元数据解释像素，复制后停止流并释放本次资源。系统提供的装饰、阴影与合法透明区域按既定原生单窗合同保留，较新截图便利 API 不另成一条并行实现路线。

Accessibility 与屏幕录制许可继续由宿主明确请求，普通查询不弹提示。授权检查不代替某个对象实际可操作的判断，应用正常退出也不代替进程已经结束的观察。

<a id="linux"></a>

## Linux：进程、X11 与 Wayland 后端

进程后端使用 pidfd 等适用机制跟踪原实例，路径与名称按明确的 proc 语义读取，不能用会截断的 comm 代替完整文件名。普通终止信号不被当作应用协作退出；图形应用的正常退出通过已核实窗口及桌面支持的关闭协议请求，无适用机制时如实报告。

X11 路线以窗口管理协议和实际 X 连接为依据。_NET_WM_PID 是客户端提供的属性，并可能关联另一台机器，不能单凭它创建本机 ProcessRef 归属。实际本机连接与实例的对应需要进一步核实；不可核实时保留 WindowRef 和局部不可用状态。

XComposite 的 NameWindowPixmap 可以持有窗口的离屏内容，但窗口重新映射或调整大小会获得新的 pixmap。采集当前画面必须重新核对来源和缓冲区，不能把旧 pixmap 留存的历史图像当作恢复后的当前帧。窗口未映射或不具备所需合成条件时，不切换为桌面裁切；窗口管理器装饰和像素布局需要单独验证。

GNOME 组件维护 Meta.Window 与本连接中引用的对应，Rust 侧通过明确协议取得目标标识。Mutter 的 RecordWindow 接收窗口 ID 并建立单窗口流，随后从 PipeWire 取得帧。已核对的 42.0 与当前分支均有该协议入口，各目标版本的组件、身份和权限仍须分别验证。组件加载格式与宿主版本适配仍由该组件的构建和测试负责。

KDE 组件维护 KWin 的实际窗口标识，采集使用 ScreenShot2 的 CaptureWindow。5.24.7 源码明确执行调用权限检查，并通过管道交付包含尺寸、格式和 stride 的图像信息。后续版本的检查已有变化，[版本核对](linux.md#kwin-versions)记录 6.8.0 已移除该项登记检查。正式接入必须按实际版本核对访问与输出，不能照搬某一份源码或把安装脚本视为获得权限。

两种 Wayland 组件失联时结束受影响观察，使旧连接的窗口对应失效。重新连接后显式建立新观察，不通过标题寻找“看起来相同”的窗口。普通进程观察可以继续，前台、窗口控制或采集的失败不能自动结束仍可可靠观察的进程。

通用的 [ScreenCast portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.ScreenCast.html) 适合由用户授权并选择共享来源的流程；它支持恢复此前授权会话，因此并非每次都必须重新选择。但其 SelectSources 参数没有接收既有 WindowRef 或任意桌面窗口标识的入口，不能直接承担这里已确定目标实例的采集合同。GNOME／KDE 专用接入是为现有窗口操作需求作出的边界选择，须明确支持的宿主版本、权限和安装条件，不能将内部 D-Bus 接口的存在视为长期跨桌面兼容承诺。
