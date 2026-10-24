# Vantage 公共 API

本页定义 Node 调用方使用的值、操作、观察与资源寿命。平台保证及限制见[后端](backends.md)，Linux 组件的部署与接入见[桌面接入](linux.md)。

<a id="surface"></a>

## 公开入口与职责

Vantage 定位为跨平台的外部程序观察与交互库，提供进程与窗口观察、控制及窗口画面采集，公开包为 @ximu3/vantage。本次由原 process-list 完整重写，范围包括公开 API、Rust 与 Node 实现、测试和全部工程设施；仓库与来源处理见[仓库规范](../../engineering/repository.md)。

进程与窗口是并列的目标对象，一个进程可以拥有多个窗口。前台是当前环境状态，图像帧是操作结果，不为它们另建目标实体。公开入口按目标对象或环境事实组织：

```ts
import { processes, windows, getForeground, observeForeground } from '@ximu3/vantage'
```

| 入口                        | 核心职责                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| processes                   | 进程查询、实例识别、生命周期观察、正常退出请求与显式强制终止     |
| windows                     | 窗口查询、所属进程、状态观察、恢复、聚焦、关闭请求与窗口单帧采集 |
| getForeground()             | 取得当前前台状态快照                                             |
| observeForeground(listener) | 交付初始前台状态及后续变化，返回可独立释放的观察订阅             |

调用方可以直接从进程、窗口或前台状态开始使用。windows.capture(windowRef) 直接接收窗口引用，进程查询与生命周期观察可在没有窗口、图形会话或采集权限时独立使用。原生后端隔离桌面依赖的加载与初始化。

查询、控制与采集统一使用库提供的实例引用。完整身份与快照语义见[引用](#references)，目标范围见[控制](#operations)，独立图像见[采集](#capture)。

读取、观察和采集不暗中恢复、聚焦或关闭目标。恢复、聚焦、正常退出请求和强制终止分别显式执行；请求已发出与目标实际退出是不同的完成事实，正常退出失败不升级为强制终止。不存在、信息未知、权限不足和当前后端不可用分别表达，能力与失败按对象及具体操作报告，不用一个全局可用标志替代实际判断。

停止观察、释放句柄或结束采集只释放库持有的资源，不结束被观察的进程或窗口。已经取得的一帧画面独立于来源窗口继续存在。Rust 负责平台实现，Node 提供主要公开入口，接口以异步为主；平台线程和资源约束由库处理，不依赖 Electron、Kisaki 或 desktop-contracts。

平台后端与所需桌面接入组件属于独立项目交付。各后端说明权限、来源选择和集成要求，必要交互由宿主明确发起；常规查询不自行弹授权窗口或安装组件。支持范围与真实桌面验证遵守[构建合同](../../engineering/build.md#platforms)，单项权限或能力缺失不能伪造成功，也不能据此删除已承诺的平台能力。

作品、会话和记录由[应用接入](../../engineering/integrations.md)拥有。应用自身 UI 窗口的创建和渲染由宿主框架承担；剪贴板、通知、自启动、协议关联、文件对话框和通用输入自动化不纳入本库的核心范围。

<a id="references"></a>

## 实例引用与快照

ProcessRef 和 WindowRef 是由库创建的不透明运行对象。调用方从查询、前台快照或观察结果取得它们，再用于后续读取、控制和采集；不能从普通对象、JSON、PID 或窗口编号自行构造。

binding 在同一 Node 环境内维护原生实例与 JavaScript 引用的对应。对持续可确认的有效实例复用引用对象，调用方可以用作 Map／Set 的键。引用及内部编号限于本次环境，其他 Worker、进程或重启后的环境分别取得自己的引用。

引用绑定原实例，PID 或窗口编号复用后，旧引用仍不指向新对象。实际控制的并发边界按[平台合同](backends.md#identity)核验，逻辑引用本身不保证跨调用原子性。

后端失联或无法继续确认实例时，只使受影响范围的引用失效。路径暂时不可读保留可确认的进程身份；窗口后端中断也保留仍可核实的进程引用。

引用本身没有退出、关闭或启动观察的副作用。内部为身份所持有的最小资源由库随引用、目标结束及 Node 环境退出清理，不要求调用方对每个查询行执行 dispose。持续观察另有明确订阅资源。快照保存对应引用和普通值，库不原地修改已交付快照；保留历史快照不代表其中字段仍然是当前状态。

<a id="fields"></a>

## 已知值与局部不可用

必然已知的身份字段直接给出。确实可能独立不可读的字段使用一个小型判别联合：

```ts
type InformationUnavailableReason =
  'permissionDenied' | 'notSupported' | 'backendUnavailable' | 'temporarilyUnavailable'

type Field<T> =
  | { readonly status: 'available'; readonly value: T }
  | { readonly status: 'unavailable'; readonly reason: InformationUnavailableReason }
```

available 表示取得了该字段的值。只有字段本身允许为空时，value 才能为 null；空标题可以是已知的空字符串。unavailable 表示这次没有取得可靠值，并给出实际原因。缺失值不与原因分别保存在两份可矛盾的对象中，也不把所有字段都包进 Field。

```ts
interface ProcessInfo {
  readonly ref: ProcessRef
  readonly pid: number
  readonly executableName: Field<string>
  readonly executablePath: Field<string>
  readonly displayName: Field<string>
}

interface WindowInfo {
  readonly ref: WindowRef
  readonly nativeId: Field<string>
  readonly process: Field<ProcessRef>
  readonly title: Field<string>
  readonly visible: Field<boolean>
  readonly minimized: Field<boolean>
}
```

executableName 是完整可执行文件名，保留扩展名和从系统取得的大小写；executablePath 是该可执行文件的完整路径。displayName 是系统提供的显示名称或进程标签，可以与文件名不同，不能拿它填补未知 executableName。路径不能读取时，仍保留已确认的进程和其他字段。

nativeId 是后端提供的可展示编号，使用字符串避免整数精度丢失，不作为跨平台句柄或可反向构造引用的编码。window.process 只在所属实例已经核实时给出 ProcessRef，不根据一个过去的 PID 查找当前同号进程后补上关系。

visible 表达窗口系统中的可见状态，不承诺未被遮挡、位于当前工作区或一定可以采集。minimized 独立表示最小化。当前合同不为了通用系统信息展示而加入 CPU、内存、任意进程参数或输入自动化字段。

<a id="foreground"></a>

## 前台进程与窗口

```ts
interface ForegroundInfo {
  readonly process: Field<ProcessRef | null>
  readonly window: Field<WindowRef | null>
}
```

两个字段通过下列相同规则完整表达前台事实：

| 结果                                     | 含义                                     |
| ---------------------------------------- | ---------------------------------------- |
| 两项均 available，且 value 都是 null     | 本次确认没有前台                         |
| 至少一项 available，且具有实际引用       | 已知相应的前台对象，其余部分按自身值解释 |
| 没有取得实际引用，且至少一项 unavailable | 仍无法确认完整前台事实，不能当作没有前台 |

已知前台进程但无法确认窗口时，保留 ProcessRef 和窗口不可用原因。已知窗口而归属未知时，保留 WindowRef。确认没有具体前台窗口时使用 available/null；因权限或后端缺失而读不到窗口时使用 unavailable。

两项来自同一次前台观测，并核对可确认的关系。系统正在切换而无法组合出可靠结果时，保留确定部分，不把分别读取到的不一致对象拼成一个完整前台状态。

getForeground 与 observeForeground 交付同一值类型。观察仍可靠连续时，局部不可用保留其真实状态，并可随后恢复；连续性丢失时，以订阅中断结束该次观察。

<a id="queries"></a>

## 查询与目标不存在

核心查询按以下形状提供，异步调用可以接收 AbortSignal：

| 方法                      | 成功结果及含义                                           |
| ------------------------- | -------------------------------------------------------- |
| processes.list            | 当前可枚举、可识别进程的 ProcessInfo 列表                |
| processes.find(pid)       | 当前该 PID 对应的 ProcessInfo；确认不存在时为 null       |
| processes.get(processRef) | 原实例的当前 ProcessInfo；确认已经结束时为 null          |
| windows.list              | 当前桌面的顶层应用窗口列表，可按已核实的 ProcessRef 筛选 |
| windows.get(windowRef)    | 原窗口的当前 WindowInfo；确认已经关闭时为 null           |
| getForeground             | 当前 ForegroundInfo                                      |

find 是通过 PID 发现当前实例，后续操作使用结果中的引用。get 使用既有引用，不因旧实例结束而寻找同号新对象。窗口列表包括适用范围内可独立呈现的对话框，不将每一个子控件变成 WindowRef；当前桌面范围及后台工作区覆盖须由平台路线明确。

null 只表示已经确认目标不存在或结束。身份失效、权限不足以判断目标状态或后端不可用不能返回 null。只缺少某个字段时，返回仍有效的快照和局部原因；整个查询无法执行时，才以公开错误拒绝。

列表记录本次枚举中逐项取得的目标，各项保留能够确认的字段。路径或标题暂时不可读时仍保留已识别目标，后端整体失败则返回错误。列表可能包含多个取得时点；确认既有实例是否结束时，使用该原实例的查询或生命周期观察。

<a id="observations"></a>

## 观察创建、交付与释放

processes.observeAll 和 windows.observeAll 交付相应枚举快照；processes.observe(ref, listener) 与 windows.observe(ref, listener) 观察指定原实例；observeForeground 观察当前环境事实。公开观察共用以下交付结构：

```ts
type ObservationEvent<T> =
  | { readonly type: 'snapshot'; readonly value: T }
  | { readonly type: 'interrupted'; readonly error: VantageError }

interface Observation {
  dispose(): Promise<void>
}
```

创建观察返回 Promise<Observation>。库先建立观察并取得初始状态，再返回订阅；初始快照和接续结果随后按序交付，监听器不在创建调用栈中同步重入。启动失败时拒绝创建，不留下需要调用方猜测是否成功的半成品订阅。监听器的同步异常属于调用方异常，不能吞掉或改写为系统权限错误；库停止并清理该订阅。

第一条正常交付始终是 snapshot。后续仍交付当前状态，消费者不需要先单独 get 再 subscribe。单实例观察使用 ProcessInfo | null 或 WindowInfo | null；确认目标结束后交付 null，并结束这项观察。observeAll 中的成员消失只表示枚举结果变化，不能代替单实例退出事实。

interrupted 表示本订阅已无法可靠继续，交付一次后结束。继续观察需要显式建立新订阅；不能让旧订阅在后台重新绑定无法证明相同的对象。单个属性暂时不可用仍是 snapshot 中的字段状态，不因此结束整个订阅。

状态交付有顺序且有界。普通中间快照可以合并为较新的状态，初始快照、确认结束和观察中断不能被静默吞掉；不承诺完整记录所有短暂系统变化。这个合同同时适用于系统通知与轮询实现，库不把后者伪装为完整事件历史。

dispose 幂等，完成后本订阅不再调用监听器，排队结果不得稍后交付。共享底层观察的其他订阅仍然有效。AbortSignal 在创建前取消则拒绝创建，创建后取消则按主动停止清理。停止观察不关闭目标窗口，也不结束进程。

<a id="operations"></a>

## 控制请求与实际状态

processes.requestExit 请求指定 ProcessRef 对应的进程通过可用的协作机制自行退出；windows.requestClose 只请求指定 WindowRef 对应的窗口关闭；processes.forceTerminate 显式请求系统强制终止指定进程。进程退出不要求调用方选择窗口。后端可以通过经过核实的关联窗口或平台应用退出协议完成请求，其目标范围与筛选规则由后端合同明确，不按标题或同名程序猜测目标，也不主动向其他进程追加退出请求。

同一次退出请求只处理本次确定的请求目标，不追着随后弹出的保存或确认窗口继续关闭，不代替用户保存或放弃内容。没有可用协作退出方式时报告明确原因，不把普通终止信号直接当作应用正常退出协议，也不因拒绝、失败或超时升级为强制终止。请求已发出与实际结束分别表达，实际进程退出通过观察确认；窗口关闭、进程退出和游戏监测集合结束是不同事实，最后一层由 Kisaki 判断。取消等待不撤回已经发出的请求。观察与采集等技术资源使用 dispose 或明确的停止操作，资源释放不改变目标程序的寿命。

processes.requestExit、processes.forceTerminate、windows.requestClose，以及窗口恢复和聚焦操作，始终针对实际引用。每次只处理明确目标。

控制方法的正常返回表示原生请求已经按该方法完成提交或处理，不额外承诺目标仍保持某种状态；已知被系统拒绝时必须返回错误。退出、关闭和前台变化通过对应查询与观察取得。特别是强制终止也不能仅凭原生调用返回，就把整个进程集合或 Kisaki 游戏会话标为结束。

同一请求不会自行重试、升级为强制终止、继续处理后来出现的确认窗口，或改用其他目标。恢复与聚焦各自显式执行，读取和采集不代为执行。来源已经结束时，控制请求报告 targetEnded；尚未确认结束而无法验证旧引用时，报告 referenceInvalidated。

取消在尚未执行时停止排队工作；原生请求已经发出后，只能取消后续等待，不能撤销系统已经接收的动作。aborted 或 timeout 不证明目标从未受到影响，也不触发自动补偿或重放。调用方按需要重新观察当前事实。

<a id="capture"></a>

## 窗口采集与独立图像

windows.capture(windowRef) 交付自有图像数据、实际像素尺寸、明确像素格式及来源 WindowRef。结果不借用随后会被采集池覆盖的内存，不要求消费方保留窗口或录屏会话；调用结束后，内部为单帧建立的流和采集资源由库收尾。图像数据本身由消费方持有，不再要求额外释放一个捕获会话。

成功表示确实取得指定窗口的有效画面，不以全黑占位、空 Buffer 或整个桌面代替。目标缩小、遮挡、最小化、受保护内容和窗口消失分别按后端实际能力处理，不能通过暗中恢复或聚焦来补偿。真正拍到的黑色内容当然可以是有效图像，不能单凭像素颜色判断失败。

公共图像采用紧密排列的 sRGB RGBA8、straight alpha 与独立 CPU 数据，完整定义见[图像结果](#image)。HDR 转换、装饰边界和缩放语义通过真实帧验证。裁剪、编码、标注与保存由调用方完成。

后端分工与 Windows 10 2004 下限见[平台路线](backends.md)。

<a id="errors"></a>

## 公开错误与字段原因

公开操作错误为 Error 对象，具有稳定的 code、对应 operation 和安全消息。VantageError 表示这份技术错误合同，不包含 Kisaki 的通知或业务状态。调用方按 code 分支，不解析 message，也不依赖原始 Win32、errno 或第三方文案。

| code                 | 含义                                 |
| -------------------- | ------------------------------------ |
| invalidArgument      | 参数或引用类型不符合公开合同         |
| referenceInvalidated | 无法继续证明引用指向原实例           |
| targetEnded          | 对实际操作目标已确认结束或关闭       |
| permissionDenied     | 当前操作缺少明确的系统权限           |
| notSupported         | 该目标或环境没有这种适用机制         |
| backendUnavailable   | 所需桌面后端或接入组件当前不可用     |
| requestRejected      | 系统或目标明确拒绝了这次请求         |
| captureUnavailable   | 当前条件下未能取得指定窗口的有效图像 |
| timeout              | 原生操作或等待超过明确的技术期限     |
| aborted              | 调用方取消了尚未完成的操作或等待     |
| backendFailure       | 其余已经分类到原生边界的执行失败     |

字段的 InformationUnavailableReason 只描述该字段本次为何不可读，不能附带完整异常链或另一份目标状态。运行错误可以保留必要的安全诊断上下文，不能记录图像、全量进程快照或不必要的用户路径。

原生错误码要结合操作及已核实状态解释。例如某个系统错误码既可能表示权限问题，也可能出现在目标已经结束之后；不能使用一张全局数字到 code 的表覆盖所有操作。notSupported 也不能成为跳过已承诺平台能力的通用返回值。

<a id="calls-surface"></a>

## 平台辅助入口与授权归属

主入口提供 processes、windows、getForeground 和 observeForeground。macOS 的两项应用授权辅助操作由专属子入口 @ximu3/vantage/macos 提供。Windows 按进程执行上下文及对象访问条件接入，Linux 按桌面后端的身份与会话授权接入，各平台操作保持自己的实际作用对象和流程。

这两项 macOS 授权属于当前消费应用的系统状态，可能同时影响窗口读取、控制、前台观察与协作退出，不归某个 WindowRef。实现继续由 Rust core 的 platform/macos 负责，binding 只转换输入输出；子入口复用同一包与 addon，不增加 npm 包、crate 或另一份权限状态。Windows 访问限制及 GNOME／KDE 组件的安装和调用授权继续按各自真实边界处理。

| 责任                                             | 拥有者                     | 明确边界                                             |
| ------------------------------------------------ | -------------------------- | ---------------------------------------------------- |
| 当前目标能否读取、观察、控制或采集               | Vantage 相应原生后端       | 每次实际操作核验；返回可靠事实、局部不可用或准确错误 |
| 某项系统授权的检查与显式请求                     | 具有相应机制的平台辅助接口 | 当前公开 macOS 两项授权；结果不代替实际操作判断      |
| 何时向用户解释、申请、进入设置或启动提升后的进程 | 消费宿主                   | 根据具体用户动作组织；不放进普通查询或后台观察       |

普通跨平台调用不要求先完成一个统一的 permissions 初始化阶段。缺少授权、桌面组件不可用、系统不支持与目标本身不可操作仍分别表达；只有真实需要系统交互时，宿主进入对应平台流程。Windows 的访问权与提权限制见[权限边界](backends.md#windows-access)；Wayland 的桌面专用接入与 portal 会话选择的区别见[Linux 路线](backends.md#linux)。

```ts
import { processes, windows, getForeground, observeForeground, VantageError } from '@ximu3/vantage'

import { queryPermission, requestPermission } from '@ximu3/vantage/macos'
```

[主入口声明](../../../verification/evidence/vantage-calls/contract.d.ts)与[macOS 子入口声明](../../../verification/evidence/vantage-calls/macos-contract.d.ts)分别列出对应方法与公共类型。它们是设计材料，正式包声明仍由真实 binding 与必要适配生成并核对，不另行维护一份与实现分离的手写生产声明。

| 入口         | 方法                                                                           | 正常结果                                      |
| ------------ | ------------------------------------------------------------------------------ | --------------------------------------------- |
| processes    | list(options?)                                                                 | readonly ProcessInfo[]                        |
| processes    | find(pid, options?)、get(ref, options?)                                        | ProcessInfo 或确认结束时的 null               |
| processes    | observeAll(listener, options?)、observe(ref, listener, options?)               | Observation                                   |
| processes    | requestExit(ref, options?)、forceTerminate(ref, options?)                      | void，表示请求按该方法提交或处理              |
| windows      | list(options?)                                                                 | readonly WindowInfo[]，可按原 ProcessRef 筛选 |
| windows      | get(ref, options?)                                                             | WindowInfo 或确认关闭时的 null                |
| windows      | observeAll(listener, options?)、observe(ref, listener, options?)               | Observation，observeAll 支持相同进程筛选      |
| windows      | restore(ref, options?)、focus(ref, options?)、requestClose(ref, options?)      | void，实际状态另由查询或观察确认              |
| windows      | capture(ref, options?)                                                         | 已确认格式的 WindowImage                      |
| 库级         | getForeground(options?)                                                        | ForegroundInfo                                |
| 库级         | observeForeground(listener, options?)                                          | Observation                                   |
| macOS 子入口 | queryPermission(permission, options?)、requestPermission(permission, options?) | PermissionStatus                              |

表中所有调用都返回 Promise。参数错误也通过拒绝 Promise 返回 VantageError，统一使用 invalidArgument；binding 或必要的轻量适配负责这一语言边界。ProcessRef、WindowRef 只作为类型导出，没有公共构造器。真实运行时仍须核验引用归属，TypeScript 品牌不能替代原生实例校验。

find 的 PID 输入为 1 至 2³²−1 的整数；它发现当前实例，不接受窗口编号。windows.list 与 windows.observeAll 的 process 只匹配已经核实归属的原实例；未能确认归属的窗口仍可在无筛选枚举中出现。确认筛选进程结束时列表为空，持续筛选观察可以交付最终空列表并收尾；空列表本身仍不能供调用方推断进程退出。

<a id="options"></a>

## 通用取消与单次完成

```ts
interface CallOptions {
  readonly signal?: AbortSignal
}

interface WindowListOptions extends CallOptions {
  readonly process?: ProcessRef
}
```

业务阶段的等待预算由调用方通过 AbortSignal 组合，不另公开 timeoutMs、deadline 或独立取消句柄。由调用方 signal 触发的取消统一报告 aborted，包括 AbortSignal.timeout 产生的取消；不会通过解析 signal.reason 的名称或文本重新猜测业务意图。timeout 保留给对应原生 API 或协议能够明确判定的超时，不把调用方的等待偏好再写成库内的第二套期限。

单帧采集不设跨平台统一的固定秒数。需要截止时间时，调用方把 AbortSignal.timeout 与操作或会话的 signal 组合后传入。没有期限且后端没有给出结果时，调用可能持续等待；库不把迟迟无帧擅自解释为目标已经结束或确定不可采集。目标关闭、可判定的采集失败和取消仍按各自事实结束本次操作。

取消被本次调用接受后，不再成功交付迟到帧；已经取得的原生资源仍由库按平台生命周期收尾。取消响应与原生资源完全释放是不同的完成事实，不承诺任意驱动都能在调用方的期限内完成清理。Kisaki 在既有采集流程中拥有整次操作的等待预算，包括显式恢复、等待可采集和取帧，不要求 Vantage 再建立一套业务阶段。

signal 在开始前已取消时，不提交控制、采集或授权动作。完成结果已经提交后，后来取消不撤销图像或动作。原生控制已经发出时，取消不能撤回系统请求。多次调用没有隐式事务、重试或固定执行顺序，恢复后采集等流程由调用方显式串联。

观察创建使用 signal 控制启动，创建成功后继续用同一个 signal 控制订阅寿命；它不为每条快照重新计算期限。主动取消不会交付 interrupted。dispose 没有 signal 参数，调用方需要等待收尾时 await dispose()；重复调用等待同一次停止过程。

<a id="delivery"></a>

## 回调交付与 Node 环境

ObservationListener 是普通通知回调，库不等待返回值或返回的 Promise。异步工作由调用方独立处理其错误；返回的 Promise 拒绝不被改写为原生后端失败。

初始正常快照在创建 Promise 完成后的后续事件循环任务中交付，避免消费者尚未取得 Observation 就收到回调。若调用方在此之前停止订阅，初始快照也可以被取消；一旦开始正常交付，第一条仍是 snapshot。启动后目标立刻结束时，按已确认顺序交付初始事实与结束事实，不因合并普通中间状态而吞掉终止结果。

同步监听器异常按已确认规则停止该订阅，并通过 Node 的未捕获异常路径传回原异常，不变成 interrupted 或 VantageError。原生 binding 可使用 Node-API 的 napi_fatal_exception 承接这一边界，不能误用会立即终止程序的 napi_fatal_error；真实 napi-rs 接入仍须验证。库不安装全局 uncaughtException 处理器。

普通实例引用不单独维持 Node 事件循环存活；活跃观察订阅维持存活，停止或自然结束后撤销相应持有。只保存 ProcessRef 或 WindowRef 不应让命令行程序无法退出，显式启动的持续观察则应当继续工作。待完成的异步调用与正在执行的必要清理持有各自所需资源，不能因没有活跃观察而提前退出。Node 环境退出时使用原生清理机制，不再依赖 JavaScript 回调收尾。某个窗口后端中断不结束仍能可靠工作的普通进程观察。

<a id="permissions"></a>

## macOS 授权

```ts
type Permission = 'accessibility' | 'screenCapture'
type PermissionStatus = 'granted' | 'notGranted'

queryPermission(permission, options?)
requestPermission(permission, options?)
```

这两种值只在 @ximu3/vantage/macos 中定义，分别对应该后端的 Accessibility 信任与屏幕采集授权。它们没有被定义为所有系统同名能力的通用开关；调用方在 macOS 接入中使用这组辅助函数，不把它当作跨平台功能就绪检查。

子入口可以被跨平台工具解析和导入，导入不启动图形环境或显示授权界面。在非 macOS 上实际调用其中的方法时，以 notSupported 拒绝，不返回假的 granted 或增加 notApplicable 状态。纯类型导入不加载原生模块。主入口与子入口在同一 Node 环境中复用同一 native binding，不能形成两份生命周期和授权缓存。

| 状态       | 明确含义                                                           |
| ---------- | ------------------------------------------------------------------ |
| granted    | 本次系统检查确认当前消费程序获得该项授权                           |
| notGranted | 本次尚未确认获得授权；不推断首次请求、用户拒绝或系统策略等更细原因 |

queryPermission 只检查，不显示提示、不打开设置、不安装组件。requestPermission 是明确的交互动作，最多提交一次对应原生请求，再返回当时可核实的状态；已获授权时直接返回 granted。只有调用方明确触发 requestPermission 才能进入这一步，普通查询、观察和采集不主动申请授权；缺失授权时按实际影响返回局部不可用或操作错误。

这项检查只描述当时的系统授权，不提供检查到操作之间的原子保证。授权可能随后撤回，具体目标也可能有其他访问限制；实际操作仍独立核验并准确失败。宿主不能把一次 granted 保存成永久可用状态，也不能以预检通过省略原生操作的错误处理。

Accessibility 的提示是异步的，requestPermission 完成后仍可能返回 notGranted；这不证明用户已经作出选择。调用方在用户返回应用或再次操作时 queryPermission，不要求库保持一个等待用户授权的常驻轮询。屏幕采集请求采用其原生请求入口，具体提示与重启条件以实际签名消费程序验证，不把命令行授权身份当作应用身份。

<a id="permission-identity"></a>

### 请求使用实际宿主身份

queryPermission 与 requestPermission 的原生调用发生在加载 Vantage addon 的宿主进程中。库没有独立的应用授权身份，npm 包名、JavaScript 模块名和某个被观察窗口不会成为这次请求的授权主体。接口不接收 appId、应用名称或目标 PID 来代替其他程序申请权限；权限类别是唯一的业务参数。

实际发起调用的进程与系统最终显示、记住的应用身份须区分。macOS 会根据适用服务的规则识别调用代码及其归属应用，应用包、稳定的代码签名与启动关系会影响结果。不能把权限当成仅绑定于当前数字 PID 的状态，也不能把所有子进程都视为自动继承父应用的全部授权。

Kisaki 的授权检查、请求及后续窗口操作统一经主进程的 Vantage 接入执行。界面经受控 IPC 表达用户动作，主进程调用 @ximu3/vantage/macos；正式签名并按正常应用方式启动的 Kisaki 应当以 Kisaki 的应用身份呈现授权。Vantage 中的原生工作线程仍属于同一进程，不创建另一项应用身份。渲染进程或扩展宿主不另行执行这条原生授权路径，系统授权也不替代扩展合同中的能力边界。

开发 Electron、终端启动的 Node、签名后的成品应用及单独辅助进程必须分别看待。命令行代码可能被系统归属到解释器或启动它的应用，不能预先保证设置页显示某个 npm 项目名称。未来若改变实际执行进程，需要重新验证系统归属与查询、请求、使用能力是否一致，不能假定在进程 A 获得授权后进程 B 自然可用。

权限验收记录实际可执行程序、签名与应用包身份、启动方式，以及系统提示和设置页中显示的对象。正式成品分别验证首次请求、已有授权、撤销、重启和更新后的行为；这些结果尚未通过当前 Windows 主机上的声明检查得到证明。

取消只能停止尚未提交的请求或后续等待，不能承诺撤回系统已经显示的授权界面。库不自动重启消费程序，也不顺带申请另一项权限。

主入口保持通用的 permissionDenied 错误分类，不增加只为这两项 macOS 授权服务的通用 permission 字段。宿主的 macOS 接入按当前操作查询相关系统授权，再决定是否呈现授权操作；已获授权仍不保证每个目标可访问。Windows 完整性限制、KWin 调用身份、桌面组件缺失与受保护画面继续由实际操作报告，不虚构可解决这些限制的统一授权弹窗。

<a id="calls-capture"></a>

## 原生单窗采集范围

windows.capture(ref, options?) 采集指定窗口的一帧。公共结果已经统一为 sRGB RGBA8、straight alpha、紧密行布局与独立数据。原生窗口的实际画面范围遵守下述边界，不从像素格式推导统一的装饰和阴影外观。

系统光标固定不加入画面；应用自己绘制的指针属于应用内容，不识别或抹除。Windows 的光标开关、macOS 的 showsCursor、Mutter 的 cursor-mode 及 KWin 选项分别在原生侧落实。图像不混入其他窗口、Kisaki 面板或独立弹窗；需要采集另一窗口时使用它自己的引用。

宽高表示实际返回的像素，不复用逻辑坐标或 CSS px，不按主显示器倍率推算其他显示器上的窗口。当前不向调用方暴露屏幕位置或一个可能错误的全局缩放系数。采集期间尺寸变化需要按同一有效帧重新确认布局，数据长度与元数据必须对应。

图像字节归调用方持有，可以修改自己的数据；库不会随后覆盖它，也不再读取它作为窗口事实。保存、裁剪与编码仍由消费方负责。内部帧有效性依据来源状态、目标对应和实际布局，不以全黑检测判定失败。

<a id="capture-boundary"></a>

### 保留原生单窗画面的边界

windows.capture 交付指定原实例的原生单窗图像：保留该后端正常取得的窗口表面，统一公开像素格式、有效尺寸与所有权。标题栏、边框、阴影和透明角属于具体原生结果的画面特征，不另设跨平台去装饰或去阴影的保证。这里的“原生”只描述来源与几何边界，不取消既有 SDR 色彩转换、行布局和 alpha 处理。

原生结果中已有的系统装饰与应用自绘内容均保留，不按标题栏高度、颜色或透明度猜测裁除；后端未提供的窗口管理器装饰或外侧阴影也不重建、拼接。系统光标仍按已确认规则排除。独立弹窗使用自己的 WindowRef，不为了组合出一个“完整应用”而收集多个窗口。

各后端交付真实取得的窗口图像：部分系统提供应用窗口表面，另一些包含系统装饰，图像边缘因此可能不同。共同合同采用原生单窗范围，调用方可以检查并裁剪已经固定的图像。

| 后端          | 边界与处理                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Windows       | 使用指定 HWND 的 WGC 帧与同帧 ContentSize 解释有效内容；不将 GetWindowRect 或 DWM 的另一次查询直接当作采集图像范围。                 |
| macOS         | 使用 desktopIndependentWindow 与有效帧的内容、比例元数据；保留原生单窗结果，不为跨版本统一去阴影而提高 macOS 13 下限或启用像素猜测。 |
| X11           | 使用已核实目标 X 窗口当前的 pixmap 与所属层级；不改取根窗口，也不为取得窗口管理器装饰自动改截另一父窗口或拼接画面。                  |
| GNOME Wayland | 使用 RecordWindow 交付的窗口流，解释实际缓冲与有效裁剪元数据；不从逻辑窗口矩形自行重画边缘。                                         |
| KDE Wayland   | 对支持的 CaptureWindow 接口显式包含装饰、排除光标并采用 native-resolution；保留该版本实际返回的单窗范围，不再追加去阴影处理。        |

原生像素之外的未初始化缓冲区和无效行填充必须排除。尺寸、有效区域、像素比例和缓冲布局须来自同一次实际采集；尺寸变化导致完整目标内容被截断时，重新取得有效帧或按事实失败，不能把裁掉内容的半张图报告为成功。合法透明区域则保留，不能因透明就被当作多余边缘裁去。

各平台的画面边界及依据见[采集边界记录](../../../verification/evidence/vantage-platforms/capture-boundaries.md)。每个支持的系统与桌面版本须用真实窗口核对边界、尺寸变化、DPI、透明内容、光标排除和来源独立性，按既定后端合同验证图像完整性与资源寿命。

<a id="image"></a>

## 图像格式与颜色

Vantage 的单帧结果用于查看、裁剪、标注和保存，在公共边界交付统一的 SDR 图像。这个选择服务于常规截图用途；它是输出范围的取舍，不能被称为所有原生图像场景的最佳格式。

平台后端在转换完成前保留真实缓冲格式、行跨度、alpha 与色彩信息，需要时使用浮点或其他高精度数据。Rust core 的窗口采集模块统一解释原生缓冲并归一化公共图像，binding 负责语言边界，消费者直接使用公共图像结果。

```ts
interface WindowImage {
  readonly window: WindowRef
  readonly width: number
  readonly height: number
  readonly pixelFormat: 'rgba8'
  readonly colorSpace: 'srgb'
  readonly alphaMode: 'straight'
  readonly data: Uint8Array
}
```

width、height 是实际图像像素尺寸，使用正安全整数。数据从左上角开始按行排列，每像素依次为 R、G、B、A 四个 8 位通道，每行紧密连续，长度严格等于 width × height × 4。原生缓冲区有行填充时，库逐行复制；预乘 alpha 按来源规则转换为 straight alpha。结果独立于原生帧池、窗口和采集会话。

选择 sRGB SDR 是输出目标，不是对所有原生源的描述。HDR 的动态范围压缩、色域与传递函数转换分别处理，不能只改标签、直接截断浮点值或把 10 位内容当作 8 位读取。[完整平台方案](backends.md#backends-windows)选定 Windows 的浮点 WGC 与 Direct2D 原生转换，macOS 请求 ScreenCaptureKit 的 sRGB SDR 输出，Linux 按原生 compositor 的格式与颜色合同解释。SDR 输出不能保留完整 HDR 动态范围。

采集目标继续是指定窗口，系统光标按[调用合同](#calls-capture)固定排除。完整窗口边界、系统装饰、阴影和圆角透明区域按[原生窗口边界](#capture-boundary)保留实际后端结果，DPI 与有效内容仍须实际核验；不能仅由像素类型推出实际画面范围。原窗口自身绘制的 UI 是其内容，Kisaki 的面板和其他窗口不加入图像。

这份结果不承担裁剪、文件编码、标注或附件采用，也不保存进程和窗口身份作为资料库主键。如果后续确有保留 HDR 原始像素的独立需求，应单独讨论明确的结果分支，不把它藏进 rgba8 的含义中。
