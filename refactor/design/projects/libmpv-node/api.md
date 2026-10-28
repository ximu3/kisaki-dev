# libmpv-node 调用 API

本页定义调用、错误与控制客户端的公开合同。初始化与清理见[运行寿命](lifecycle.md)，通知单独见[订阅与通知](notifications.md)。

| 阅读目的 | 入口 |
| --- | --- |
| 调用命令与属性 | [操作分类](#libmpv-model) · [结构化调用](#commands) · [属性读取与观察](#properties) |
| 判断失败与取消结果 | [错误类型](#errors) · [取消、关闭与迟到结果](#control-cancellation) |
| 使用独立控制通道或参与执行 | [额外客户端](#clients) · [异步 hook](#hooks) |
| 核对完整能力与类型来源 | [Client API 入口](#capabilities) · [制品目录与语义声明](#catalog) |

<a id="model"></a>

## 绑定模型与调用入口

libmpv-node 定位为 libmpv 的 Node 原生绑定，保留上游的能力与语义，完整承担 JavaScript 与原生运行时之间的适配。命令、属性、事件与错误依据 [libmpv Client API](https://github.com/mpv-player/mpv/blob/master/include/mpv/client.h)，公开模型以同一个 Mpv 实例为中心：

| 入口                | 合同                                                         |
| ------------------- | ------------------------------------------------------------ |
| createMpv(options)  | 配置并初始化实例，成功表示实例可用，不表示媒体已经加载       |
| mpv.command         | 执行结构化 mpv 命令，返回对应命令回复及适用结果              |
| mpv.getProperty     | 读取 mpv 属性，按实际类型交付当前值                          |
| mpv.setProperty     | 写入 mpv 属性，报告这次写入的实际执行结果                    |
| mpv.observeProperty | 观察属性事实，交付可用值或明确的不可用状态，并可独立停止观察 |
| 事件与日志订阅      | 交付引擎实际事件和诊断信息，订阅可以独立释放                 |
| mpv.close()         | 结束实例并完成自身工作和资源清理                             |

初始化选项、运行期属性和绑定层渲染配置分别表达。已知命令与属性提供对应的类型提示，结构化通用入口支持其余 mpv 能力；便捷方法在保持上游含义的前提下简化调用。播放状态来自实际引擎事实。

库负责参数与原生值转换、异步请求与结果关联、原生错误分类、事件接续、线程和资源管理。命令不要求调用方拼接字符串并自行转义；原生结果交付为可安全独立持有的值，字节数据寿命与整数精度明确。属性不可用不能伪装为 false、0 或空字符串。阻塞工作、跨线程回调和 Node 环境退出清理由绑定处理，未完成请求必须正确结束，不向 JavaScript 暴露需要自行管理的 C 指针或原生事件轮询。

command 完成遵守对应 mpv 命令的含义，不自动表示文件、定位或画面已经就绪。loadfile、seek 和 screenshot-raw 分别通过命令入口使用；截图结果保留上游的尺寸、格式、stride 与数据含义，绑定保证结果内存寿命，不追加媒体文件归属或位置采集流程。截图基础合同见 [screenshot-raw](https://mpv.io/manual/stable/#screenshot-raw)。

本项目固定构建为 screenshot-raw 增加 source: vo | software，表示该次图像来自实际视频输出还是软件取图。它是[随构建交付的扩展字段](distribution.md#screenshot-source)，不是上游原版保证。普通与 native 值输出都保留该字段，已知命令声明同时纳入；source 不替代颜色描述或文件身份，独立消费者仍按自己的采集条件决定是否采用。

所有入口共享同一份实例寿命和调用关联。状态来自引擎实际反馈，命令与 mpv 脚本产生的变化都进入同一份事实观察。绑定识别实际内容、输出和关闭变化，并完成自己的资源收尾。命令或脚本引发的关闭也进入该流程，不能为了维持自建状态而忽略实际退出。受管渲染需要保留的选项与限制明确列出；可识别的直接冲突按[受管使用约定](video.md#constraints)在提交前失败，应用偏好不成为绑定层禁用上游能力的理由。

库不提供承载作品流程的高层 open、seek 或 captureImage。[Kisaki 接入](../../engineering/integrations.md#media)拥有内容就绪、操作排序、文件核对和产品会话。

<a id="libmpv-model"></a>

## 操作、通知与参与执行

公开模型区分一次操作、持续通知和参与执行；各自的完成含义决定接口形式：

| 职责     | 接口                                                           | 完成含义                                     |
| -------- | -------------------------------------------------------------- | -------------------------------------------- |
| 一次操作 | command、getProperty、setProperty 等返回 Promise               | 这次原生调用及约定的结果交付完成             |
| 持续通知 | observeProperty、observeEvents、observeLogs 使用 Observer.next | 接收一项事实；回调返回值不控制播放或后续交付 |
| 参与执行 | addHook 使用 HookHandler.run，允许返回 Promise                 | 正常完成后继续原生 hook；停止时由库解除等待  |

通知采用[订阅合同](notifications.md#callbacks)，hook 采用[异步处理器合同](#hooks)。两者的 error 与 complete 都是整个登记的终止通知，只有 run 的返回值参与任务完成。处理器拒绝是库接纳的工作结果，接收器自身抛错则是通知代码失败；因此异常归属不同。名称和类型直接表达这个差异，不把返回值是否被等待藏在相同的 next 签名下。

[Node EventEmitter](https://nodejs.org/download/release/v24.11.1/docs/api/events.html#events)忽略监听器的返回值，[Web Streams 的底层写入处理](https://nodejs.org/download/release/v24.11.1/docs/api/webstreams.html#new-writablestreamunderlyingsink-strategy)则用 Promise 表达工作的完成。[mpv hook](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h)本身要求参与执行与继续。这些依据支持按职责选择回调协议；本库的 Observer 和 HookHandler 是自己的轻量协议，不声称它们是 Node 规定的唯一接口。

共同规则集中在实际相同的边界：登记成功后才开始运行期交付；主动停止阻止新的回调；终止最多交付一次；dispose 等待拥有的资源清理；异步上下文随登记捕获。MpvSubscription 表达登记寿命，可以同时用于通知与 hook，不因此把两类回调混为一种任务。HookHandler 的关闭与取消必须解除原生等待，并消费迟到的处理结果，不能等待不响应取消的用户 Promise 才开始收尾。

[流提供器](streams.md)也参与执行，同时交付实际字节源的资源所有权。其普通 close 因而等待已接纳工作和源清理，取消可以先解除 C 等待。协议归核心寿命，不复用可注销订阅的形状；逐项 onError 也不表示整个协议登记终止。

AbortSignal 统一表达取消，作用范围由入口的工作单位确定。createMpv 和 createClient 的 signal 管理创建，成功后资源由返回对象拥有；observe 与 addHook 的 signal 管理整个登记；hook context.signal 管理单次活动执行。取消不代表撤销已发生的原生效果，close 与 dispose 的资源清理不接受取消。

资源与数据继续分开：Mpv 统一拥有核心与输出；额外客户端拥有独立控制通道；普通值、通知与截图是独立数据；NativeFrame 拥有本次帧持有权。close、dispose 和 release 分别表达结束核心、撤销登记或通道、归还帧持有。标准 asyncDispose 复用已有清理，不增加第二条路径。

整体保留 mpv 的命令、属性、值格式和执行事实，用 Promise、AbortSignal、Error、bigint 与 Uint8Array 表达 Node 边界。受管渲染、队列和原生清理由库承担；Kisaki 的内容选择、就绪判断和会话记录继续由应用承担。当前模型没有要求再引入统一事件总线、全局表示开关或另一层播放器对象。完整能力目录见[运行时目录](#catalog)，受管使用约定见[视频输出](video.md#constraints)。

<a id="commands"></a>

## 结构化调用与类型提示

保留同一个 command 入口，支持上游已有的位置参数和命名参数形式：

```ts
await mpv.command(['loadfile', path, 'replace'])
await mpv.command(['seek', 42.5, 'absolute'])

const position = await mpv.getProperty('time-pos')
await mpv.setProperty('pause', true)
```

命名参数采用 mpv 的 name、参数名称及适用的 _flags，每个具体命令是否支持命名参数遵守上游合同。示例展示调用形式，内容加载或定位等待仍由消费方按实际完成条件处理。

已知命令、属性及其参数和值由选定的上游版本提供对应声明，同时保留未知名称的结构化通用调用。已知名称不能通过一个宽泛重载绕过参数检查；泛型也不能让调用者无依据地宣称结果是任意 T。通用调用返回可判别的公共值，已知返回类型须有真实原生格式及运行时检查支持。

command 的 Promise 在对应命令回复到达后结束。getProperty 和 setProperty 分别以自己的读取或写入回复结束。初始化成功、命令成功、file-loaded、playback-restart 和新画面到达分别表达，不互相替代。

调用沿用上游的并发语义；有先后依赖时，调用方显式 await 前一个结果再提交后一个。内容加载、替换、定位和当前文件核对等完整操作，由 Kisaki 的 infrastructure/media 组织。

<a id="properties"></a>

## 读取与观察的失败

getProperty 在成功时返回实际值，在失败时保留上游错误码。属性不存在、当前不可用、类型不合适及一般读取失败，不合并成 null，也不返回 0、false 或空字符串。

observeProperty 的一次值通知采用可用与不可用两种明确状态：

```ts
type PropertyState<T> =
  { readonly status: 'available'; readonly value: T } | { readonly status: 'unavailable' }
```

此处的 unavailable 表示这次通知没有可用值。此分支不附带 reason：上游观察事件没有提供具体原因码，绑定不虚构属性不存在、未加载媒体或读取错误中的某一个原因，也不固定填入 unknown。补做 getProperty 是另一次读取，不能用来可靠归因原通知。订阅建立失败、绑定转换失败或事件流中断分别报告，不压入 unavailable。普通值中的 null 仍可以出现在 available 分支，不能与外层状态合并。

订阅交付初始状态及后续变化，并可独立停止；创建和停止的回调时序遵守[订阅合同](notifications.md)。属性通知允许按上游语义合并变化，不承诺交付每一个中间值。需要确认某次命令完成的调用方使用命令回复和相关引擎事件，不把属性观察当作完整操作日志。

<a id="cancellation"></a>

## 取消与执行结果

异步命令和属性操作接受 AbortSignal，不额外提供与 signal 重复的 timeout 参数，也不统一设置一个播放器调用期限。调用者可以按自己的操作组合期限信号。

取消在提交前发生时，不执行该次原生操作。提交后发生时，取消结束调用方的等待；适用命令同时请求 mpv 尽力中止。属性读写没有相同的原生中止接口，已经发生的写入不会因此撤销。错误应能区分尚未提交与可能已经执行，不以 Promise 已拒绝证明原生动作未生效。

绑定继续消费已提交请求的迟到回复，结束原生关联和资源持有，不把回复交给另一项请求。取消请求与正常回复的竞争只能结束同一个 Promise 一次。并发请求和等待交付均须有界，具体容量与压力下的规则在真实 addon 设计验证中确定，不能靠丢弃回复释放容量。

<a id="errors-events"></a>

## 原生错误、绑定错误与事件

公开错误保留两个来源：mpv 返回的错误携带原始数值码与可识别名称；参数不合法、对象已经关闭、取消或无法转换原生值等绑定失败采用自己的类别，不伪造 mpv 错误码。调用方按结构化字段判断，不解析 message。错误消息使用库自己的安全英文表述，命令参数、完整媒体地址和原始诊断不自动拼入错误消息。

事件与日志分别订阅。引擎事件保留其原生名称和适用字段，start-file、end-file 中的原生 playlist entry ID 仍是 bigint；绑定的请求编号只用于内部关联。日志由明确订阅取得，不默认写控制台；其内容是原始诊断，不能代替稳定错误分类，也不能由 Kisaki 未经处理直接展示或长期记录。

底层事件读取持续处理原生消息，请求回复、可合并的属性状态、诊断日志及画面分别使用适合其语义的有界交付方式。事件丢失按[订阅合同](notifications.md)报告连续性中断，只结束受影响订阅，实例可以继续使用；重读属性只能恢复相应当前值，不能恢复丢失的 start-file、end-file 或命令完成事实。事件与日志字段遵守同一合同，实际容量由 addon 实施测量。

<a id="errors"></a>

## Error 与结构化原因

库自身可分类的预期失败均为 Error 实例，并继承公共 MpvError。普通通知回调自身抛出的异常继续遵守原样转交的合同；hook 处理器的工作结果与聚合失败遵守下述独立合同，不重新归类为原生错误；虚拟机内存耗尽或环境已经销毁时，不承诺还能构造和交付特定错误类。

| 类型                           | 来源与主要字段                                                                |
| ------------------------------ | ----------------------------------------------------------------------------- |
| MpvNativeError                 | source: mpv，code: 原始负数，nativeName: 对应 C 枚举名称或 null               |
| MpvBindingError                | source: binding，code: 库拥有的错误分类                                       |
| MpvAbortError                  | binding 来源，name: AbortError，code: ABORT_ERR，cause 保留 signal.reason     |
| MpvObservationError            | binding 来源，code: observationInterrupted，reason 区分原生与桥接交付队列溢出 |
| MpvConversionError             | 已确认的 valueConversion、三个 reason 与 getNativeValue()                     |
| MpvNotificationConversionError | 已确认的 notificationConversion、invalidUtf8 与 getNativeNotification()       |

原生错误的 nativeName 使用 MPV_ERROR_PROPERTY_UNAVAILABLE 等实际枚举名称，保留未知负数而将名称置为 null。非负返回码按上游合同视为成功；不把正数当错误，也不根据 mpv_error_string 的英文说明推断分类。当前负数目录由固定 client.h 提取，共 20 项，见[检查结果](../../../verification/evidence/libmpv-control/source-contract.json)。

所有库错误保留 operation 与 submitted。submitted=false 表示这次请求尚未交付对应的原生执行入口；true 表示已经跨过该边界，可能产生效果。它不证明命令成功、没有部分效果或媒体已就绪。创建操作以开始原生实例创建为边界，其他调用以进入相应原生调用或登记为边界；内部参数复制不算提交。

调用方可以用具体错误类收窄专用字段，用 source／code 判断稳定类别。message 是库自己的安全英文说明，不能作为分支条件。name 保留 JavaScript 错误类用途，原生枚举名称另放 nativeName，避免覆盖 Error.name。

绑定错误分类如下；不为未知原因伪造原生码：

| code                                    | 含义                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| invalidArgument                         | 输入不符合公开合同，尚未提交                                                 |
| closed                                  | 实例或所属客户端已进入关闭，或未完成调用因关闭而结束；submitted 区分其位置   |
| resourceLimit                           | 绑定的请求、结果或资源持有达到明确上限；不等同于原生 EVENT_QUEUE_FULL        |
| unsupportedFormat                       | 不能安全解释实际原生格式；不读取未知 C union，也不伪造可提取快照             |
| libraryLoadFailed                       | 固定平台原生制品无法加载                                                     |
| incompatibleLibrary                     | 实际库与要求的 ABI／制品合同不相容                                           |
| resourceCreationFailed                  | 原生资源入口未返回有效资源且没有提供 mpv 错误码，例如空句柄                  |
| unsupportedCapability                   | 请求的绑定能力未在当前目标提供；实际 mpv 返回不支持时仍用 MpvNativeError     |
| renderConflict                          | 可识别的请求或已检测到的设置违反受管使用约定；不表示所有原生写入均被提前阻止 |
| internalFailure                         | 绑定自身无法维持合同的内部失败；不用于吞掉用户回调异常                       |
| reentrantStreamCall                     | 自定义流工作重入同一核心，在原生提交前拒绝                                   |
| invalidStreamResult                     | 自定义流提供器返回不符合合同的源、字节或大小                                 |
| frameReleased                           | 已归还的帧持有不能 clone 或取得借用描述                                      |
| renderFailed                            | 受管输出运行中无法完成渲染或维持资源合同                                     |
| ABORT_ERR                               | 标准主动取消                                                                 |
| observationInterrupted                  | 订阅连续性已经丢失                                                           |
| valueConversion／notificationConversion | 已确认的两种保留原始结果的转换失败                                           |

frameReleased、renderFailed 与相关视频 operation 依照[输出与帧寿命合同](video.md#errors)纳入同一错误体系。renderConflict 的保证范围遵守[受管使用约定](video.md#constraints)；配置或脚本遵守同一约定，不意味着绑定拥有覆盖引擎内部写入的前置拦截器。

创建中的错误还携带 creation。它是按 stage 判别的记录：input、library、core、initializationLogs、initialize、video、publish，或者 options 加零基 optionIndex。非创建操作不携带该记录；初始化日志转换失败使用 initializationLogs 阶段。阶段描述失败所处的责任位置，终止确定后不被后续清理阶段覆盖。创建 Promise 的错误和初始化日志 observer.error 仍是两个不同结果。

cause 遵守普通 Error 的原因链，取消时保留调用方提供的 reason，库不自动记录或转发它。值与通知的原始内容继续只通过已确认的显式提取方法取得。Kisaki 接入只映射安全分类和消息，不把整个 Error 或 cause 当作 IPC 载荷。

mpv 调用失败、文件播放失败、日志严重级别和订阅失效继续分别处理。end-file.errorCode、fatal 日志或属性 unavailable 不自动变成 Promise 拒绝或 observer.error。

<a id="control-cancellation"></a>

## 取消、关闭与迟到结果

取消使用 MpvAbortError 的 AbortError／ABORT_ERR 形式，不直接以任意 signal.reason 作为顶层拒绝值，因而仍能提供 operation、submitted 和创建阶段。reason 作为 cause 保留原身份。

输入错误、预先取消、关闭状态和容量不足在原生提交前结束；提交门槛由所属执行者与取消状态一起裁决。提交后的取消只结束等待，并在上游支持时请求尽力中止。不能把 AbortError 或 closed 当作“未执行”的证明，也不自动重试可能已经执行的命令或配置文件。

同一公开操作只完成一次，后续仍消费原生回复并释放关联，不转交给另一项请求。原生先完成且公开结果已交付时，之后到达的取消不改写结果；取消先结束等待时，不再交付迟到结果或转换错误。

创建 Mpv 或客户端失败时，先完成未交付资源的清理再拒绝。普通已提交操作仍按已有合同结束等待并继续内部收尾。活动订阅的主动取消等同 dispose，不额外调用 error 或 complete；关闭、继续 hook 和资源释放本身不接受撤销清理的 signal。

<a id="capabilities"></a>

## Client API 按能力接入

继续使用 command、getProperty、setProperty 和三类订阅。重复的 C 字符串／节点／同步／异步入口由绑定的值表示和调度统一，不要求用户选择 C 内存管理或自行运行事件轮询。

其他 Client API 能力使用以下入口：

| 入口                           | 行为                                                                     |
| ------------------------------ | ------------------------------------------------------------------------ |
| getClientApiVersion()          | 异步取得实际加载库的 Client API major／minor；不创建播放核心或图形上下文 |
| clientId／clientName           | 控制句柄实际 ID 与名称的只读快照；ID 使用 bigint，关闭后已有快照仍可读   |
| getTimeNs()                    | 同步读取 mpv 单调时钟，返回 bigint 纳秒；不是播放位置或墙上时间          |
| getPropertyText(name, options) | 读取上游的 plain 或 osd 文字格式；默认 plain，不产生 OSD 显示副作用      |
| loadConfigFile(path, options)  | 在原生执行者上调用配置文件加载；要求绝对路径，支持 signal                |

getPropertyText 继续使用独立 output：javascript 返回严格 UTF-8 字符串，native 返回独立 Uint8Array。普通文本转换失败沿用 MpvConversionError，operation 为 getPropertyText，getNativeValue() 返回保存同一次文本字节的 string 节点。实现使用保留返回码的 mpv_get_property 及 STRING／OSD_STRING 格式，不直接用只能返回空指针的便利函数丢掉失败分类。它与按原生结构读取值的 getProperty 分开，避免将上游文字格式当作普通 JavaScript String(value)。

loadConfigFile 保留上游的部分应用语义：即使最终报错，某些设置也可能已经生效；上游忽略的配置项错误也不保证使整个调用失败。日志通过实际日志订阅取得，绑定不解析诊断正文恢复错误。此入口和所有其他客户端调用同样受核心拥有的受管渲染约束；配置、profile、脚本与保留选项的实际约束方案仍须随图形路线验证，不能先声称任意组合都已安全支持。

删除属性使用结构化 del 命令，命令标志通过上游结构化调用表达；微秒值可从纳秒值换算。mpv_free、节点释放、reply_userdata、wakeup 回调、事件轮询和异步请求等待由绑定管理，对外提供对应的值与资源合同。

属性读取、文字观察与无值提示遵守[属性请求格式](values.md#property-formats)，Stream CB 的公开提供器见[流提供器合同](streams.md)，Render API 见[平台图形](platforms.md)。函数归属和目录生成的依据分别见[覆盖清单](../../../verification/evidence/libmpv-control/client-api-coverage.json)与[目录采集](../../../verification/evidence/libmpv-catalog/verification.md)；实现和验证进度由[实施状态](../../../implementation/status.md)记录。

<a id="clients"></a>

## 额外客户端的归属

提供 mpv.createClient({ name?, signal? })，返回 MpvClient。它有与 Mpv 相同的命令、属性、文本、时钟、订阅和 hook 控制能力，以及自己的实际 clientId／clientName。原生可以调整请求的名称，返回快照以实际名称为准。clientId 的身份范围是所属播放核心，不能用它跨不同 Mpv 实例建立全局身份。

每次 createMpv 都创建独立的播放核心；只有从同一个 Mpv 创建的额外客户端共享该核心，不使用库级全局播放器单例。MpvClient 表达控制通道，独立播放、预览或后台处理需要另建 Mpv，不能靠增加客户端隔离媒体、位置或播放状态。

Mpv 拥有播放核心、受管输出及整体收尾。MpvClient 共享该核心的媒体、选项和命令效果，只持有自己的控制通道、订阅与 hook；dispose 释放这些资源。

MpvClient 没有独立播放器、VideoOutput 或 close 方法，但仍可执行上游 quit。quit 使所属核心进入与 mpv.close 相同的收尾，不影响其他 Mpv 或宿主进程。命令回复继续表示命令完成，等待资源清理时调用 mpv.close；控制通道的接口形状不构成命令权限隔离。

公开客户端由内部弱句柄实现，并持有所属 Mpv 的存活引用。调用方仍持有活动客户端时，核心拥有者不会仅因 JavaScript 对象不可达而被提前回收；显式 mpv.close 则始终关闭全部所属客户端，不等待调用方分别 dispose。底层强／弱句柄选择保持私有，避免公开两套互相竞争的核心关闭权。

客户端自己 dispose 时，立即抑制其尚未开始的数据与终止回调，未完成调用以 closed 结束；已经执行的命令效果不撤销。由整个 Mpv 正常关闭引发的订阅结束，则按已有生产者结束合同处理，仍可被调用方主动 dispose 取消剩余交付。

每个客户端拥有独立的原生事件队列和定向 client-message 接收身份，各队列的中断分别处理。创建客户端后，调用方先 await 所需订阅建立，再要求其他方发送需要可靠接续的消息。

应用自己的流程拥有者协调同一核心的加载、定位等操作。独立通道按各自合同接纳和完成调用；相互冲突的控制意图由应用安排。

Mpv 与客户端在所属 Node 环境中作为活动资源使用，跨进程调用由应用 IPC 接入。额外客户端提供原生定向消息身份和独立上下文；普通业务组件可以直接在已有实例上各自订阅。

<a id="hooks"></a>

## 异步 hook 与原生接续

使用 addHook(name, handler, { priority?, signal? })，返回 MpvSubscription。handler 是 MpvHookHandler，包含 run(context)、必填的 error(reason) 和可选 complete()。run 可以同步完成，也可以返回 PromiseLike<void>；绑定等待它完成，随后自动执行原生继续。创建成功先交付登记句柄，首次 run 安排在后续调度轮次；创建失败只拒绝 Promise，不调用尚未建立的接收器。priority 缺省 0，名称与优先级继续遵守上游语义。

返回句柄管理整个 hook 登记，context 管理其中一次执行。句柄的 closed 表示不再开始新的 run，不单独证明原生收尾或已经运行的用户任务全部完成；等待库拥有的清理仍使用 dispose。整体接口关系见[工作职责](#libmpv-model)。

```ts
const hook = await mpv.addHook('on_load', {
  async run({ signal }) {
    await prepareFile(signal)
  },
  error: reportHookFailure
})
```

这里区分两种真实职责：Observer 接收已经发生的通知，不决定引擎何时继续；HookHandler 参与一个执行过程，其完成就是继续的条件。共用停止、错误接收和资源清理原则。登记时捕获函数引用，以原 handler 作为 this，并恢复登记调用时的 Node 异步上下文；后续改写对象上的函数不改变已登记处理器。

Node 接口以回调返回的 Promise 表达本次 hook 工作的完成，binding 在对应时点调用上游 mpv_hook_continue，公共接口只使用这一种完成机制。上游 Lua 封装同样默认在回调返回后继续，其 defer／cont 组合说明了上游允许延迟完成的机制。

run 返回的同步结果或 Promise 结算决定本次执行完成。它自行启动但没有返回或等待的工作不属于这个边界；返回永不结算的 Promise 仍会让该 hook 等待。调用方可组合自己的取消或期限，库不增加任意的默认超时。

### 失败与主动停止

正常成功后，绑定将该次原生 hook 继续一次。run 同步抛错或返回拒绝时，先停止该登记的新执行，取消并释放它的活动执行，再通过 handler.error 交付一次终止失败；该登记随后不再处理新的 hook。可恢复的单次业务失败应在 run 内处理并正常完成，避免把它声明成整个登记的未处理失败。

handler.error 的参数为 unknown：处理器自己的拒绝值保持原样，不伪装成 mpv 错误；原生登记、继续或交付失败仍使用已定义的库错误。同一次处理和清理都失败时，用标准 AggregateError 保留原因。complete 只表示整个登记正常结束，不随每次 run 完成而调用。error 与 complete 是不等待返回值的通知回调，它们自身抛错继续按原异常转交 Node，不再次递归调用 error。

处理器失败不隐含 stop 或 quit，也不撤销已经执行的命令。需要阻止某次加载的业务逻辑，应在处理器内明确执行相应操作；绑定只承担原生 hook 的释放和登记收尾。

主动 dispose 或订阅 signal 取消时，立即阻止尚未开始的 run、error 和 complete，取消所有活动 context.signal，并释放原生等待。dispose 等待库拥有的资源清理，不等待调用方的 Promise。已运行处理器的迟到履行或拒绝都被消费，不再交付回调，也不再次继续原生 hook。

Mpv 正常关闭时也先取消并释放活动执行，再按生产者结束规则结束登记；不因一个处理器没有响应 signal 而永久等待。正常完成的执行不会被标记为取消，其 context 也不继续承担未纳入返回 Promise 的异步子任务寿命。

### 原生交接与拥有关系

每次通知拥有独立的内部执行标记。原生 hook ID 可以被后续执行复用，不能让旧 Promise 的结算继续下一次执行；成功、失败、主动停止、关闭和重入竞争均由同一个终止判定保证最多一次原生继续。原生 ID 和继续动作都不公开。

等待处理器是播放器 hook 协议的一部分；事件泵不能同步等待 JavaScript，其他原生回复与通知仍须正常处理。等待 handler Promise 本身不增加独立的 Node 运行引用，沿用所属 Mpv 的 ref 策略；处理器自己发起的 I/O 和公开库调用各按已有规则持有引用。

每个登记使用独立内部弱客户端，以便撤销该登记。正常停止先继续已经取得的执行，再销毁客户端。上游提醒销毁仍在处理 hook 的客户端可能影响执行顺序，不能以客户端销毁代替正常继续；停止与重入的竞争仍须实测。native 或交付队列丢失 hook 通知时，释放该客户端并以 observationInterrupted 结束登记，避免留下无人负责的等待。

当前六个已知 hook 是 on_load、on_load_fail、on_preloaded、on_unload、on_before_start_file、on_after_end_file；未知名称按上游接受，但不保证触发。hook 不保证其他 JavaScript 属性接收器已经完成回调；需要本次状态时应执行实际读取。

<a id="catalog"></a>

## 制品能力目录与语义声明

固定源码 01e2533f3143b8940857ca419b0b367f583e05ca 的 Client API 为 2.6，头文件包含 45 个函数和 20 项负数错误枚举。函数职责按[覆盖清单](../../../verification/evidence/libmpv-control/client-api-coverage.json)归属。

命令、选项和属性的目录由实际发行构建生成，和源码、功能配置、声明一起交付。原生目录提供名字集合与部分参数信息，属性返回结构和其他类型语义由受版本控制的语义定义补充。

生成器组合实际目录与受版本控制的语义定义：参数的可省略与默认值、特殊 Choice／Flags 形式、结构化结果和动态属性路径各自明确。保留已知名称的准确类型与未知名称的通用入口；未知入口不能成为绕过已知错误参数的重载。类型、实际导出与配套二进制从同一发行验证，不维护彼此无关的三份公共合同。

完整目录生成、运行转换和正式 addon 消费由实施交付，关键接口的行为仍沿已确认的值、调用、事件及初始化合同执行。升级原生来源时重新核对目录及语义差异，不因 ABI 可加载就推定所有旧调用含义未变。
