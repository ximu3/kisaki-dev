# Vantage Linux 桌面接入

Linux 的普通进程能力不依赖显示服务器。窗口与前台按实际 X11／Wayland 会话接入，GNOME 与 KWin 配套组件属于本项目交付。

<a id="access"></a>

## 桌面权限与授权

接入分别核对组件安装与启用、消息的真实本地连接，以及原生桌面对操作的授权。用户安装表达使用意愿，连接绑定确定消息来源，实际原生调用决定操作是否允许。组件遵守当前用户与桌面的权限边界。

| 边界     | 具体合同                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------- |
| 组件启用 | 用户明确开启本地桌面接入；导入包、查询与后台观察不自行安装或启用组件。                                |
| 本地连接 | 使用用户会话总线，核对实际 sender、连接拥有者与适用凭据；不接受请求正文自报的身份，不向网络开放服务。 |
| 原生访问 | 按当前桌面版本执行真实检查；系统拒绝、sandbox 限制、组件缺失与对象不可操作分别报告。                  |
| 资源归属 | 观察、未完成请求与窗口令牌归属于创建它们的连接和组件实例，其他连接不能接管或取消这些资源。            |

这项选择的含义必须明确：启用组件后，同一用户的会话总线中能够访问该接口的其他本地程序也可能调用这组有限能力。组件不区分同一个 Node 解释器中的不同 JavaScript 项目，也不承诺抵御能够修改同一用户配置的其他程序。需要按应用隔离的环境应使用系统实际提供的沙箱和访问控制，不能由一个自报 appId 代替。

组件只提供已经定义的窗口查询、观察、控制与采集接续，不提供任意代码求值、命令执行、通用文件读取或整屏采集入口。已有系统接口和 Vantage 自有组件的范围分别说明；不能把某个桌面内部接口原本可访问的范围冒称为 Vantage 新授予的权限。

<a id="linux-identity"></a>

## 窗口与进程归属

纯 X11 后端使用 XRes 1.2 的 LocalClientPid 查询窗口资源所属客户端，随后核对相应本机进程实例。`_NET_WM_PID` 是客户端属性，不能单独成为 ProcessRef 归属。XRes 缺席、客户端位于不可核对的命名空间或服务器没有返回本机 PID 时，窗口仍可枚举，process 字段按实际原因不可用。[XRes 的成熟使用](https://github.com/GNOME/libwnck/blob/43.0/libwnck/xutils.c)

GNOME 的 Meta.Window.get_pid 在已核对版本通过后端取得实际客户端 PID；其中 X11 分支使用 XRes。KWin 6.8 的 X11Window 同样取得 XRes PID，KWin 5.24 的 Toplevel.pid 则仍读取窗口属性，因此旧组件须同时交付原生 XID，由 Rust 后端另作 XRes 核对。Wayland 客户端使用 compositor 持有的连接进程信息；不能把这些版本差异压成一条“pid 一定可信”的规则。[Mutter 42](https://github.com/GNOME/mutter/blob/42.0/src/x11/window-x11.c)、[KWin 5.24](https://github.com/KDE/kwin/blob/v5.24.7/src/toplevel.cpp)、[KWin 6.8](https://github.com/KDE/kwin/blob/v6.8.0/src/x11window.cpp)

Wayland 桌面中的 XWayland 窗口仍由所属 GNOME／KWin 组件统一枚举和控制。对其 XID 使用 XRes 只是核对进程关系，不将 XWayland 枚举冒充完整 Wayland 桌面。

<a id="protocol"></a>

## 组件协议与原生接入

Vantage 自己维护这份有限协议，操作与公开 Node 语义逐项对应。D-Bus 原生调用、回复与连接通知直接承载相应事实，协议独立于 Kisaki 的业务合同与 rpc。

| 协作内容       | 必须明确的语义                                                                           |
| -------------- | ---------------------------------------------------------------------------------------- |
| 建立接入       | 核对实际组件、协议版本和本次组件实例；握手成功只说明连接可用，不保证任意目标都能被操作。 |
| 窗口引用       | 内部令牌绑定原窗口对象及组件实例，重新加载组件后旧令牌失效；编号和标题不用于重新绑定。   |
| 初始与后续观察 | 创建时取得一致的初始状态并接续变化；有界交付沿用已确认规则，不伪装为完整系统历史。       |
| 单次控制       | 操作有明确目标、完成和失败；取消已发请求不撤销系统动作，也不自动重放。                   |
| 观察与采集资源 | 每项资源有独立拥有者，停止一项不影响其他调用者；连接退出时回收它持有的资源。             |
| 重启与断连     | 结束受影响观察与等待，不向新组件递交旧请求，不将失联解释为窗口关闭或进程退出。           |

GNOME 与 KWin 可以采用不同通信接入。GNOME 组件能够使用所属环境的 D-Bus 能力；KWin 脚本公开的是 callDBus 等机制，不能仅凭它能发起调用，就宣称可以像 GNOME 一样导出完整服务端。

KWin 采用脚本主动连接 Rust 侧有限端点、接收明确工作并回传原生变化的路线。端点在消费程序内，GNOME 则直接导出会话服务；两种方向、方法形状及 callDBus 的 variant 转换见[组件协议](#linux-protocol)。callDBus 的错误不进入成功回调，本地定时器、请求期限与连接代际共同结束失联等待，控制动作不重放。发现、初始快照、观察和关闭通过该协议衔接，窗口数据由协议值交付。

<a id="linux-protocol"></a>

## GNOME 服务与 KWin 宿主连接

组件协议使用 Vantage 自有的 D-Bus 命名空间和明确版本，值只表达窗口事实、有限控制、观察与采集接续。它与 Kisaki RPC、业务条目和账号无关。实际连接身份、同一用户会话范围和组件启用仍遵守[访问边界](#access)。

GNOME 组件使用总线名 dev.ximu.Vantage.Gnome1，在 /dev/ximu/Vantage/Gnome 导出同名接口；Open 创建绑定实际 sender 的会话对象。会话提供当前快照、观察、restore／focus／requestClose 和一次采集目标解析；观察对象交付初始快照后通过定向信号接续变化。Close 或 sender 断开只回收相应会话，组件停用回收全部所属资源。具体方法与 D-Bus 类型见[GNOME 协议蓝本](../../../verification/evidence/platform-closure/gnome.xml)；XML 列出接口类型，动态会话和观察分别使用创建操作返回的 object path。

KWin 脚本只使用其实际提供的 callDBus、QTimer 和窗口对象能力，不假定它能导出 GNOME 式服务端。消费程序的 Rust 后端在自己的进程内，通过 /dev/ximu/Vantage/KWinClient 导出 dev.ximu.Vantage.KWinClient1；服务名使用 dev.ximu.Vantage.KWinClient.c 加唯一连接后缀。脚本通过会话总线发现相应名称，向实际宿主建立连接；宿主核对 sender 是当前 org.kde.KWin 的拥有者，名称前缀只用于发现。

| KWin 方向       | 明确职责                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------- |
| Open            | 核对协议及组件实例，建立新的 channel；新实例使旧连接和窗口令牌失效                       |
| PublishSnapshot | 交付原生窗口与前台的当前事实，先有初始快照，再接续后续变化                               |
| TakeRequest     | 取得一个有限控制请求；队列为空时作有界等待并回复空结果，不忙循环，也不在桌面线程同步等待 |
| Complete        | 按 request id 返回处理结果，不把结果丢失后的重发当作恢复                                 |
| Close           | 结束本连接的等待和资源，其他消费者继续独立运行                                           |

方法类型见[KWin 协议蓝本](../../../verification/evidence/platform-closure/kwin.xml)。请求只含 request id、窗口令牌和既定 action，不携带脚本、命令或文件路径。snapshot 的窗口项及其可用／不可用字段对应已有 WindowInfo／ForegroundInfo；协议只额外携带本连接所需的原生对应值。内部 ID 使用字符串，避免 Qt JavaScript 对整数类型的转换影响身份。

Open 的协议值固定为字符串 "1"，不匹配则不建立连接。snapshot 包含窗口列表和同次前台事实，窗口值携带本连接 token、原生对应值、title／visible／minimized 的状态与值，以及待核对的 PID 来源；ProcessRef 不进入总线，Rust 核对后才建立公共引用。PID、原生 ID 和请求 ID 按十进制或各平台的原生字符串表示，不将不透明标识经浮点数中转。request 非空时只含 id、window、action；action 限于 restore、focus、requestClose。Complete 的结果为成功，或已有 Vantage 错误分类，不传播原生说明全文。

快照以 a{sv} 及原生 variant／列表承载，在 Rust 边界一次解析。固定 KWin 5 和 6 的 dbusToVariant 实现递归转换数组、结构与字典，支持此处有限的数据形状，见[KWin 转换实现](https://github.com/KDE/kwin/blob/v5.24.7/src/scripting/scriptingutils.cpp)。

callDBus 的错误回复不会调用成功回调，因此脚本的本地定时器与 Rust 的请求期限负责结束失联等待，不能只依赖成功回调。关闭和超时使该连接代际失效，旧回调不再采用；已交给组件的控制动作不重放。窗口原生事件可以合并为最新快照，既定观察合同不承诺完整事件历史。

GNOME 42–44 与 45 起的扩展入口按各自加载机制交付，45 的 ESM 改变落实在版本入口中；共同窗口语义与协议保持相同。KWin 5／6 也保留实际 API 名称和版本适配，发行材料明确列出相应组件与桌面范围，不靠修改版本号伪装兼容。[GNOME 45 入口变化](https://gjs.guide/extensions/upgrading/gnome-shell-45.html)

<a id="linux-capture"></a>

## 原生采集结果

GNOME 组件只解析当前窗口对应的 Mutter window-id。Rust 通过同一条 D-Bus 连接创建、配置、启动和停止 Mutter ScreenCast session，RecordWindow 总是显式带 window-id 与隐藏光标选项。不能由组件创建 session 后把控制路径交给另一 sender；Mutter 会逐次核对会话创建者。42 与 51.1 的固定源码均保留这条规则。[Mutter 42](https://github.com/GNOME/mutter/blob/42.0/src/backends/meta-screen-cast-session.c)、[Mutter 51.1](https://github.com/GNOME/mutter/blob/51.1/src/backends/meta-screen-cast-session.c)

取得 PipeWire stream 后，Rust 按实际协商的格式、stride、offset、有效 chunk 与 VideoCrop 读取一帧。Vantage 交付 CPU 图像，优先协商可读取的 MemFd／MemPtr 及原生八位 RGB 布局，不要求调用方管理 dma-buf 或录屏 session。存在 alpha 的格式按实际语义保留；BGRx 的填充字节不解释为透明度。复制后归还 buffer、停止流和 session，再交付自有图像。

KWin 由 Rust 直接向 ScreenShot2.CaptureWindow 提交组件对应的 internalId，明确包含装饰、排除光标并使用 native-resolution。Rust 创建并拥有 pipe，传递写端后关闭本地副本，同时接收元数据和有界字节流；依据返回的 format、width、height、stride 解释 QImage 数据，不能假定每版都是同一种字节排列。取消关闭本地读取并结束等待，不声称能够撤销 compositor 已提交的截图工作。

纯 X11 使用原目标当前的 XComposite pixmap。重新映射或改变尺寸后重新取得该 pixmap，按 XImage 的行跨度、byte order、visual 色彩通道与有效 alpha 解释；不改截根窗口，也不拼接父窗口补装饰。

原生八位 SDR 输出按对应 compositor 的格式和颜色约定归一；带色彩描述的输出先按描述处理。传统 X11 的无标记八位 RGB 按 sRGB 解释，这是明确的输入约定，不从中推导 HDR 或广色域信息。KWin 6.8 的单窗截图明确使用默认 sRGB 的 RenderTarget，不能将任意 framebuffer 都视为同一色彩空间。[KWin 截图路径](https://github.com/KDE/kwin/blob/v6.8.0/src/plugins/screenshot/screenshot.cpp)、[目标颜色默认值](https://github.com/KDE/kwin/blob/v6.8.0/src/core/rendertarget.h)

<a id="kwin-versions"></a>

## KWin 登记与版本

截图接口与版本依据见[来源与结论边界](../../../verification/evidence/vantage-platforms/linux-integration.md)。

| 已核对版本                    | 截图入口的实际源码规则                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| 5.24.7、5.27.12、6.6.0、6.7.0 | 仍检查调用者可执行路径对应桌面登记中的 X-KDE-DBUS-Restricted-Interfaces。 |
| 6.8.0                         | 已移除上述截图登记检查；不能继续把这个字段当作该版本的必要前置条件。      |

5.24.7 直接解释 Exec 路径，5.27.12 与 6.7.0 则先拆分命令再比较可执行文件。它们不能只因仍有同名字段就采用未经验证的同一装配方式。源码版本表也不替代发行版补丁后的真实行为：正式制品使用明确的验证组合，不仅凭一个版本字符串宣称可用。

所需登记使用该桌面的正常机制完成，不关闭系统检查。没有这项登记要求的版本不为它增加操作步骤；其他 sandbox、会话和对象限制仍然成立。

<a id="appimage"></a>

## AppImage 路径与宿主登记

AppImage 的文件路径与挂载目录是两个实际对象；它们不能互相代替调用进程的可执行文件。普通启动入口负责启动 AppImage，KWin 的旧式截图检查则可能核对挂载后真正运行的 Kisaki 文件。

采用由宿主系统集成维护限定用途桌面登记的路线，具体生命周期与首项匹配约束见[宿主登记](#registration)：

- 稳定安装路径的 DEB／RPM 使用与实际程序一致的登记，保留正常启动、文件与协议处理入口。
- 需要匹配动态挂载路径的 AppImage，在用户已经明确启用相应集成后，由宿主管理当前运行实例的 NoDisplay 条目和无空格可执行文件别名。Exec 只含别名，不带参数；正常 AppImage 启动入口独立保留。
- 别名、登记及其清理只能作用于本集成拥有的文件；多实例、更新和异常退出分别保留归属。不覆盖其他应用条目，不改动 AppImage 内容，也不把 APPIMAGE 环境变量直接当作原生调用者身份证明。
- 普通库调用只消费登记结果，不在失败后自行创建条目。便携使用遵循已有的显式系统集成选择，不把写入用户桌面目录隐藏在首次截图中。

NoDisplay 只影响展示，并不构成授权。旧 KWin 只取首个匹配项，因此宿主自己维护的其他匹配桌面条目须有一致声明，写入和移除走相应 KService 的缓存更新流程。正式平台验收核对实际登记、路径、缓存行为、多实例清理和截图。

<a id="registration"></a>

## 旧 KWin 的宿主集成

保留[已经核对的版本差异](#kwin-versions)。需要登记的 KWin 版本按实际调用进程的可执行路径检查，不认 AppImage 外层文件、包名或请求中的 appId。宿主在用户启用集成后管理自己的登记，普通查询、导入库和截图失败不创建登记。

对于 AppImage 与含空格的执行路径，宿主先取得当前进程的实际可执行路径，在自己拥有的运行目录中创建无空格的可执行文件别名；别名指向该实际文件，不指向可能被复用的 /proc/PID/exe。专用 NoDisplay 条目的 Exec 仅包含该别名，不带参数或占位符，因此可满足 KWin 5.24 的原始路径比较。正常启动入口仍保留 AppImage 启动、文件和协议处理。示意见[桌面条目蓝本](../../../verification/evidence/platform-closure/capture-entry.example.desktop)。

运行目录使用本用户的受限目录；如果常规运行目录本身含空格，宿主可创建自己拥有、权限为 0700 的无空格临时目录。条目与别名绑定当前运行实例，多实例各自持有；退出删除自己的资源，后续启动只清理已经失效的本集成残留。不能通过同号 PID 或不可信路径认领另一实例的文件。

固定旧 KWin 的实现只取第一个匹配桌面条目。因而宿主自己维护、同样能匹配该可执行文件的正常条目也必须具有一致的受限接口声明；不能只额外添加一个 NoDisplay 项，假定系统总会选中它。第三方冲突条目不由库改写，系统拒绝仍如实报告。[KWin 5.24 路径与首项选择](https://github.com/KDE/kwin/blob/v5.24.7/src/utils/serviceutils.h)

宿主集成在写入和移除后调用相应 KService 的标准缓存更新流程，并核对工作流结果；不把文件存在当作授权已生效。普通 Node 使用其实际宿主身份，库不代为登记一个被多项脚本共享的全局 node 可执行文件。KWin 6.8 已不要求这项特定登记，不为它制造额外启用步骤。

<a id="组件版本安装与发行一起验证"></a>

## 组件版本、安装与发行验证

GNOME Shell／KWin 的实际版本适配属于独立项目制品。相同公共合同不要求源码或安装包在不同桌面版本中完全相同；每份制品说明实际宿主范围、协议版本、安装位置与卸载方式。版本不匹配时明确失败，不静默覆盖另一应用使用的组件。

安装与启用属于宿主明确发起的系统集成；组件和原生库分别验证运行结果。卸载集成只移除本集成拥有的登记与组件，不修改系统的全局安全设置。库没有必要为这些发行资源再增加一个公共 Application 对象或通用权限中心。

平台验收覆盖普通 Node、实际 Kisaki、DEB／RPM、AppImage 与适用便携场景，以及 GNOME／KDE 目标版本；环境与证据要求遵守[平台验收规则](../../../verification/acceptance.md#runtime-coverage)。
