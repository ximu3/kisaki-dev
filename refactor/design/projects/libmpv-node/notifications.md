# libmpv-node 的订阅与通知

属性、引擎事件和日志共用订阅资源合同，各自保留真实的数据、过滤和积压语义。

<a id="interface"></a>

## 通知接收形式

采用一个轻量的 MpvObserver<T>，next 与 error 必填，complete 可选：

```ts
interface MpvObserver<T> {
  readonly next: (value: T) => void
  readonly error: (error: Error) => void
  readonly complete?: () => void
}

interface MpvSubscription {
  readonly closed: boolean
  dispose(): Promise<void>
  [Symbol.asyncDispose](): Promise<void>
}
```

| 入口                                     | next 接收的内容                                  |
| ---------------------------------------- | ------------------------------------------------ |
| observeProperty(name, observer, options) | 已确认的 PropertyState，包含可用值或 unavailable |
| observeEvents(observer, options)         | [引擎事件](#events)                              |
| observeLogs(observer, options)           | [日志消息与缺口](#logs)                          |

三类创建操作均返回 Promise<MpvSubscription>。每个订阅分别停止，Mpv 仍是播放核心和整体寿命的拥有者。绑定可以共享底层监听，但每次公开交付遵守独立值的持有约定；接收方修改自己的字节不改变其他订阅的结果。

```ts
const subscription = await mpv.observeProperty('time-pos', {
  next(state) {
    if (state.status === 'available') renderPosition(state.value)
    else clearPosition()
  },
  error(error) {
    reportObservationFailure(error)
  }
})

await subscription.dispose()
```

回调协议将数据接收、失败接收与可等待的资源收尾放在同一次登记中，便于状态更新和事件等待。调用方按业务需要组织后续处理，订阅自身负责通知交付及结束。

<a id="property-modes"></a>

## 属性值、文字和无值提示

observeProperty 的带值模式采用[属性请求格式](values.md#property-formats)：缺省 node，显式 flag、int64、double 使用对应原生格式，继续交付 PropertyState。上游读取或转换失败时仍可能只给出 unavailable，不根据请求格式补造失败原因。

observePropertyText(name, observer, { output?, signal? }) 接收上游 STRING 形式的 PropertyState，缺省为字符串，native 为独立 Uint8Array。它复用订阅的创建、停止、初次交付与错误规则；原生不支持观察 OSD_STRING，因此不提供 osd 选项。严格 UTF-8 转换失败使用 MpvConversionError，operation 为 observePropertyText。

需要低层变化提示时，调用 observeProperty(name, observer, { format: 'none', signal? })，接收器为 MpvObserver<void>。这里的 next 没有值，只表示原生提示该属性可能需要重读；它不证明值实际改变、存在或可用，也不交付 unavailable。该模式不接受 output，因为没有要转换的值。

持续有效的登记仍先交付一次原生初始提示，再接收后续提示；合并、停止与创建 Promise 的时序沿用共同规则。它不同于带值模式里原生格式 NONE 表示值不可用，也不同于正常值中的 null。动态切换无值与带值协议时，先选择对应的接收器和选项；不能把无值提示强行声明为 PropertyState。

<a id="meaning"></a>

## 数据、订阅失败与正常结束

| 回调     | 含义                                     |
| -------- | ---------------------------------------- |
| next     | 收到该订阅的一项数据或约定的通知         |
| error    | 该订阅无法继续履行合同，交付一次终止错误 |
| complete | Mpv 正常结束时，该订阅完成交付并正常终止 |

complete 指订阅结束，不指媒体播放完成。到达文件末尾、加载失败或播放中止仍是引擎事件数据，不能因为 end-file 的 reason 是 error 就调用订阅的 error。Mpv 可以继续加载其他内容，事件订阅也应继续工作。

已经确认的属性值转换失败进入 error，并结束这一个订阅。unavailable 仍属于 next 中的属性状态，不增加猜测的 reason，也不触发终止。

一次活动订阅最多交付一个终止回调，error 与 complete 不会连续出现。终止错误发生时停止后续数据交付，释放尚未交付的队列，并保留错误合同要求的结果。error 不自动关闭 Mpv，也不把同一错误广播成所有订阅的失败。

<a id="creation"></a>

## 建立订阅与第一次通知

登记时捕获回调引用，之后修改原 observer 对象不更新活动订阅。调用捕获的函数时，以原 observer 对象作为 this；箭头函数仍遵守自己的词法 this。

创建成功表示相应原生登记和本地交付关系已经建立，不表示已经拿到属性初值或媒体已经可用。创建 Promise 先完成，首次用户回调安排在后续调度轮次，使直接 await 创建的调用方先取得订阅句柄。只调用 Promise.resolve 后立即回调，或在返回前排一个微任务，都不足以证明这一顺序。

创建失败只拒绝创建 Promise，不再调用尚未建立的 observer.error。创建取消时同样不交付句柄或通知；已经取得的内部资源由绑定收尾，不能因调用方停止等待而遗留原生观察。

正常持续的属性订阅先交付第一次实际观察到的状态，再交付后续变化；这不是精确对应创建函数调用时刻的快照，也不保证看见每个短暂中间值。停止、失败或 Mpv 结束可以发生在第一次数据通知之前。事件与日志不补发订阅建立前的历史。

共享底层观察时，不能用新订阅建立前的缓存冒充它的初始状态。实现必须从原生登记取得初值，或用实际验证证明共享机制提供了同样的初值与后续接续保证。

<a id="stop"></a>

## 主动停止与播放器关闭

dispose 是调用方主动停止接收：调用时立即关闭本订阅的交付入口，取消尚未开始的数据和终止回调；返回的 Promise 在本订阅拥有的清理工作完成后结束。重复调用等待同一次收尾。正在执行的同步回调可以返回，但此后不再开始新回调。

主动 dispose 不额外调用 error 或 complete。它不改变播放状态，也不结束其他订阅。closed 表示本订阅不再交付 next，不单独证明所有原生清理都已完成；需要清理完成的调用方等待 dispose。对于生产者终止，closed 在 error 或 complete 被调用前变为 true。

signal 覆盖创建及订阅的整个寿命：创建完成前取消会拒绝创建 Promise；完成后取消等同主动 dispose，不再把主动取消报告为订阅错误。调用方在 signal 取消后仍可 await dispose 确认清理完成。

Mpv 正常关闭属于生产者结束。停止接受新通知后，可以交付已经接纳的有界数据前缀，再交付 complete；调用方主动 dispose 仍可取消这些尚未开始的回调。若实际收到 shutdown 且它属于仍在接收的事件订阅，保持它在该前缀中的顺序，不为关闭操作补造引擎事件。

在 JavaScript 环境仍正常运行时，Mpv.close 完成应同时保证自身原生收尾和这些订阅的终止交付已经结束；之后不再开始回调。绑定不等待回调自己启动的异步任务。Node 环境退出时则直接按环境清理合同释放资源，不依赖已经不能执行的 JavaScript 回调。

<a id="callbacks"></a>

## 回调交付与原生执行

回调在所属 JavaScript 环境执行，调用时不持有需要原生线程等待 JavaScript 的锁。接收器可以发起新的库调用或停止订阅，原生事件读取不等待这些业务操作。

每个订阅捕获建立调用时的 Node 异步上下文，交付回调时恢复该上下文，以便 AsyncLocalStorage 等宿主机制正常关联接收工作；不把所有订阅都固定在创建 Mpv 时的上下文中。异步上下文的释放也属于订阅收尾，不能在仍使用它的同步回调中提前释放。

库按 void 接收回调结果。TypeScript 允许将 async 函数传给 void 回调，调用方因此须管理自己发起的异步任务、拒绝处理与停止条件。订阅结束后，已经启动的调用方工作继续按自身寿命收尾。

同步回调抛错时，先终止该订阅的交付并启动清理，再把原始异常交给 Node 的未捕获异常路径；不把它包装成 mpv 错误，也不再调用同一个接收器的 error 来处理其自身代码错误。error 或 complete 自身抛错同样处理。进程最终如何处理未捕获异常由宿主决定，库不安装吞掉异常的全局处理器。

Node-API 的 napi_fatal_exception 对应未捕获异常路径，和立即终止进程的 napi_fatal_error 不同。具体 napi-rs 接入和清理时序必须用真实 addon 验证，不能只从接口名称推断。

<a id="queues"></a>

## 各类通知的积压规则

| 类别             | 已确认规则                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| 已接纳的调用回复 | 不丢弃；限制接纳量和结果持有，必要时明确拒绝新调用                             |
| 属性状态         | 保留首次待交付状态；后续允许合并为最新状态，不作为变化审计日志                 |
| 引擎事件         | 按接收顺序交付；发生无法维持连续性的丢失时，以观察中断错误结束受影响的事件订阅 |
| 诊断日志         | 可以丢弃未交付记录，但必须合并交付明确的缺口通知，不能悄悄当作完整日志继续     |
| 视频帧           | 继续遵守已有的未交付帧可丢弃、已交付帧必须保留至 release 的合同                |

当前固定 mpv 实现为异步回复预留队列位置，通过独立状态生成属性变化，并从单独缓冲生成日志。绑定按各类别处理积压和缺口：普通事件溢出中断受影响的事件观察，Mpv 和其他通道继续按各自合同运行，请求回复仍完整消费，属性保留自身真实状态。

上游普通事件队列报告溢出时，无法从该通知知道具体丢了哪些普通事件，因此相关引擎事件订阅结束并报告中断。原生属性和日志是否受影响按各自机制判断，不能仅从这个事件推断它们也已丢失。

桥接层自己的事件队列如果只能把丢失定位到某些订阅，就只终止这些订阅；不能确定范围时，结束可能受影响的事件订阅。新的订阅从新的观察起点开始，不重放虚构事件，也不自动重建调用方正在等待的完整操作。

日志缺口属于诊断流允许报告的数据事实，不等同于一项库操作失败。原生日志缓冲的 overflow 标记可以用于识别缺口；无法取得丢失数量时不解析说明文字猜测。具体缺口字段和日志过滤已经在[事件与日志合同](#gaps)中确认。

队列必须同时考虑条目数量和持有字节，并为终止通知和内部收尾保留交付能力。[统一执行方案](lifecycle.md#queues)已明确接纳、结果持有、各类积压和终止的实现边界；具体容量与调度批量由真实 addon 的实施测量形成内部基准并验收，不把任意常数写成已经证明的性能结论，也不将普通调参另列为设计组。

<a id="scope"></a>

## 普通观察与其他 Client API 能力

命令回复由 Promise 关联，属性变化由 observeProperty 交付，日志有自己的入口；不再次把它们作为缺乏上下文的公共原始事件重复广播。内部请求编号继续私有。

原生 hook 收到后有继续执行的义务，不应混入可以随时停止的普通通知订阅。其异步处理器与客户端归属已经确认，集中见[控制接口](api.md#hooks)；其他 Client API 能力也在同一文档核对。

上游 mpv_event_to_node 会把部分错误码转为说明文字，不能直接拿它的输出当作完整的公开事件合同，再让调用方反向解析字符串恢复错误码。事件字段、正常结束与文件错误、日志级别及 terminal-default 的准确语义，需要从实际结构和所选上游版本逐项确认。

<a id="representation"></a>

## 原生值与通知结构

属性和命令的递归值来自 mpv_node；普通事件与日志来自 mpv_event_start_file、mpv_event_end_file、mpv_event_client_message 和 mpv_event_log_message 等 C 结构。直接映射这些结构，不先人为构造 MpvNode，再从这个中间结构推导所有字段的 JavaScript 类型。

事件使用 MpvEvent，普通日志使用 MpvLogMessage，都是只读普通记录。继续采用 output: 'javascript' | 'native'，缺省 javascript，建立订阅后固定：

| 来源                      | javascript               | native                            |
| ------------------------- | ------------------------ | --------------------------------- |
| 命令／属性中的 mpv_node   | 已确认的 MpvValue        | 已确认的 MpvNode                  |
| 普通引擎事件              | MpvEvent                 | MpvNativeEvent                    |
| 日志消息                  | MpvLogMessage            | MpvNativeLogMessage               |
| 通知中的任意 C 字符串内容 | 严格 UTF-8 解码的 string | 独立 Uint8Array，始终保留原始字节 |
| 事件中的 int64_t ID       | bigint                   | bigint                            |
| C 结构中的 int／枚举码    | number                   | number                            |

native 对这类记录保留相同字段，只让任意文本内容保持字节形式；不返回 C 指针或依赖播放器的包装对象。已知事件名、结束原因名称和级别名称是固定 ASCII 标识，不属于需要按内容解码的任意文本。

通知字段按原生源类型映射：playlistEntryId 来自 int64_t，始终为 bigint；errorCode 与 playlistInsertCount 来自 C int，始终为 number。通过 mpv_node 读取时，INT64 仍转换为 bigint，例如 playlist 属性和 screenshot-raw 结果。通知 DTO 与通用值转换分别遵守这套源类型规则。

通知直接映射原生 C 结构，保留原始字段、整数类型、end-file 数字错误码和日志数字级别。常用事件由此提供明确的类型与字段，映射只完成边界所需的值转换。

<a id="events"></a>

## 引擎事件及其字段

事件的 type 保留上游名称，字段采用 camelCase。公开以下普通通知：

| type             | 附加字段                                                                              |
| ---------------- | ------------------------------------------------------------------------------------- |
| shutdown         | 无；引擎实际开始关闭                                                                  |
| start-file       | playlistEntryId: bigint                                                               |
| end-file         | playlistEntryId、reason、reasonCode、errorCode、playlistInsertId、playlistInsertCount |
| file-loaded      | 无；文件已加载并开始解码，宿主显示由显示接入另行确认                                  |
| client-message   | args: readonly string[]；native 为 readonly Uint8Array[]                              |
| video-reconfig   | 无                                                                                    |
| audio-reconfig   | 无                                                                                    |
| seek             | 无；开始定位                                                                          |
| playback-restart | 无；发生定位等不连续变化后重新开始播放，不带某次命令的关联 ID                         |

start-file 与 end-file 的 playlistEntryId 对应上游同一播放条目。不要从之后读取的 playlist-pos 补写为该次事件的字段。client-message 保留参数顺序和空字符串，参数数目由数组长度表达。

end-file 始终保留以下字段，不根据值是否为零省略它们：

| 字段                | 含义                                                               |
| ------------------- | ------------------------------------------------------------------ |
| reason              | eof、stop、quit、error、redirect；未识别的原生码表示为 unknown     |
| reasonCode          | 原始结束原因枚举码；包括未识别的值                                 |
| errorCode           | 原始 mpv_event_end_file.error；目前在 error 原因下有意义，其余为 0 |
| playlistEntryId     | 被播放或尝试播放的原生条目 ID，bigint                              |
| playlistInsertId    | 原始第一个插入条目 ID，bigint；没有插入时保留上游值                |
| playlistInsertCount | 原始插入条目数，number；0 表示没有有效插入范围                     |

数值原因码的已知对应为 eof=0、stop=2、quit=3、error=4、redirect=5。unknown 只是对未识别原因码的标签，不覆盖原始数字。errorCode 是数据，不是 observer.error 的调用理由。EOF 也可能发生在损坏、截断、网络中断或限制播放范围的文件上，不能单凭它宣称完整正常播放了整个文件。

不为没有载荷的事件添加时间、媒体路径、播放位置或当前轨道等推断字段。发生时刻的事实和事后补读的状态必须分开。事件名已经标识已支持的事件种类，不重复添加固定 eventCode；内部 reply_userdata 仍不公开。

上游仍定义并接受 idle 与 tick，但已标记废弃。保留显式选取它们的能力，声明标记 deprecated，默认不选取，也不补造或修复其历史行为。通常观察 idle-active、playback-time 等属性。这样保留当前上游入口，而不鼓励新增依赖废弃事件的业务流程。

<a id="selection"></a>

## 按事件名称选择

```ts
const subscription = await mpv.observeEvents(
  {
    next(event) {
      if (event.type === 'end-file') {
        handleEnd(event.playlistEntryId, event.reason, event.errorCode)
      }
    },
    error: handleObservationFailure
  },
  {
    events: ['start-file', 'end-file', 'file-loaded'],
    signal
  }
)
```

events 缺省选择上表九项当前普通事件。显式数组只选择列出的名称；空数组选择零项，仍保留订阅的正常停止与终止语义。重复名称按同一选择处理，未支持的名称在创建时拒绝，不静默忽略。数组在登记前复制，后续修改调用方数组不改变选择。输出表示与选择都在本次订阅内固定，改变选择通过新建订阅表达。

声明按实际 output 选项选择 MpvEvent 或 MpvNativeEvent，动态选项保留联合。事件名称选择只控制实际交付，不引入可由显式泛型伪造的载荷收窄；接收方按 type 收窄完整事件联合。

命令和属性回复仍由 Promise 关联，属性变化由 observeProperty 交付，日志由 observeLogs 交付，hook 需要独立的继续执行合同。它们不再作为普通事件重复广播。NONE 是没有事件，队列溢出则触发已经确认的观察中断处理，不作为可以忽略后继续假定连续的普通数据。

同一事件订阅按原生读取顺序交付被选择的事件；不同订阅、属性与日志之间不承诺一个统一的回调顺序。shutdown 即使没有被某个公开订阅选中，仍必须由内部生命周期处理。client-message 的接收范围是调用 observeEvents 的公开控制客户端：Mpv 上的订阅接收其自身消息，[额外客户端](api.md#clients)中的 MpvClient 接收该客户端的消息。不合并其他公开客户端或库内部辅助客户端收到的消息。

<a id="logs"></a>

## 日志记录与级别

```ts
const logs = await mpv.observeLogs(
  {
    next(record) {
      if (record.type === 'gap') handleLogGap(record)
      else consumeDiagnostic(record.prefix, record.level, record.text)
    },
    error: handleObservationFailure
  },
  {
    level: 'warn',
    signal
  }
)
```

MpvLogMessage 包含 type: 'log-message'、prefix、level、levelCode 和 text。prefix 与 text 保留实际内容，包括行末换行、BOM 和组合形式；绑定不增加时间戳、前缀、裁剪、换行修正或控制台输出。native 选择使 prefix 和 text 始终为字节。

level 选项缺省 info，表示接收该详细程度及更严重的消息：fatal、error、warn、info、v、debug、trace。对应原生 levelCode 分别是 10、20、30、40、50、60、70。warn 接收 fatal、error、warn；trace 接收所有这些级别。它只控制该订阅，不修改 mpv 的 msg-level 或 terminal 选项。

另外保留 level: 'terminal-default'，直接采用上游按模块计算的 msg-level 选择，即使终端输出关闭也有效。不能把它硬编码成 info，也不能查询一次配置后用一个全局阈值近似。它是选择方式，不是某条日志消息的 level。关闭接收通过不订阅或 dispose 表达，no 不作为活跃订阅的消息级别。

订阅使用上述原生级别选择，业务方在自己的接收器中完成额外筛选。一般诊断内容不能用于恢复稳定错误分类；level 为 fatal 的普通日志也不自动触发 observer.error 或关闭 Mpv。

<a id="gaps"></a>

## 通知缺口

日志流为消息与缺口的联合：

```ts
type MpvLogGap = {
  readonly type: 'gap'
  readonly sources: readonly ('mpv' | 'binding')[]
  readonly droppedCount: bigint | null
}
```

sources 是非空、去重的来源集合；同时包含两者时按 mpv、binding 排序。仅绑定自身丢弃时，droppedCount 是确切的未交付消息条数；涉及上游缓冲丢失时，整体数量为 null。不能把 null 当成 0，也不能从上游说明文字解析计数。

上游用保留 prefix: 'overflow' 的日志条目报告缓冲溢出。绑定在字节层识别该标记并转换成缺口，不将这条内部缺口说明重复交付成普通诊断。这个转换同时适用于 javascript 与 native 输出；native 保留普通消息的原始文本字节，不表示跳过订阅的缺口协议。

日志积压允许丢弃未交付的普通消息，优先保留较新的诊断；已交付数据不被修改。待交付缺口采用单独的有界聚合状态，后续损失并入尚未交付的通知，不让缺口本身被普通消息挤掉。检测到损失后，在继续交付日志消息前先交付待报告缺口；正常结束前也应交付它，主动 dispose 仍可取消。

缺口说明已经检测到的连续性损失，不提供精确丢失时间或与其他订阅对齐的位置。保留的普通消息维持接收顺序。消息和缺口组合不承诺完整审计日志；缓冲的条目数与字节上限仍需真实压力验证后确定。

<a id="text-errors"></a>

## 文本转换失败

普通输出对 client-message 参数、日志 prefix 与 text 严格解码 UTF-8。某次待交付记录无法解码时，与属性观察采用同一终止原则：只结束对应订阅，通过 observer.error 交付转换错误，不改用替换字符，不自动切换为字节，也不把其他订阅关闭。需要连续接收任意原生文本时，建立订阅即选择 native。

由于此处保留的是通知结构，使用 MpvNotificationConversionError，而不扩大已确认 MpvConversionError.getNativeValue() 的返回值：

- source 为 binding，code 为 notificationConversion，reason 为 invalidUtf8。
- operation 为 observeEvents、observeLogs，或初始化日志接收中的 createMpv。
- getNativeNotification() 返回同一次记录的独立 MpvNativeEvent 或 MpvNativeLogMessage 副本，通过 type 进一步判断。

该错误同样私有持有有效快照，不访问临时 C 指针，不重读当前状态，不持有整个 Mpv。重复提取产生独立字节；错误消息和可枚举字段不自动包含诊断内容。缺口由绑定生成，不会出现文本解码失败。

这个错误与专用提取方法已经确认：共用错误来源和终止原则，同时保留 mpv_node 与 C 通知结构的区别。它不改变已经确认的值转换错误，其公共错误基类与其他错误见[控制接口与运行时](api.md#errors)。

<a id="native-plan"></a>

## 原生登记与关闭的实现约束

事件选择不能使内部回复、属性、关闭或 hook 处理停止。多个公开事件订阅可以在同一控制客户端上分发，但要分别记录自己的选择和交付边界。共享原生事件队列溢出时，结束可能受到影响的事件订阅；空选择没有普通事件可丢失，不因该溢出单独结束。

日志需要保持每个订阅的原生筛选语义和缺口归属。每个日志订阅使用自己的弱客户端，原生登记对应 level，不通过反复修改一个共享客户端的级别来实现并发订阅。上游更换日志级别会销毁并重建缓冲；独立客户端也避免把另一个订阅的级别变化造成的丢失归错对象。

辅助客户端不延长播放核心寿命；关闭必须先结束并销毁这些弱客户端，再完成主客户端的终止销毁。上游的最后一个强客户端销毁会等待弱客户端离开，不能在 JavaScript 终止回调之后才开始处理这项原生收尾。数量上限、线程调度和环境退出仍须用真实 addon 验证。

还必须处理一个真实的历史缓冲来源：上游首个 terminal-default 缓冲可能取得初始化阶段的早期日志。为满足已经确认的订阅不补发历史，要求在 createMpv 对外完成前由初始化流程接管该早期缓冲，并在没有初始化诊断接收方时释放它；可用一个内部弱客户端取得后销毁，不能让它留给第一个运行期订阅。初始化诊断的接收方式在[初始化入口](lifecycle.md#logs)中规定。运行期 observeLogs 使用新缓冲，不把初始化日志当成其登记后的记录。这项来源分析尚未替代实际无历史交付的验证。
