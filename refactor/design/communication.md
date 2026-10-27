# 调用、事件与跨进程通信

所有入口使用相同的完成、失败、取消、事实通知与订阅规则。各功能定义自己的业务输入和结果；通信机制负责传递这些值，业务判断仍由对应功能完成。

<a id="clients"></a>

## 窗口客户端与传输接入

desktop-contracts 定义桌面能力的正式合同。私有 shared/window-api 从中选择原生窗口可用的方法，extension-api 则独立选择向扩展开放的能力。两者直接引用共同值，互不作为对方的中间层。

四类窗口分别使用 MainWindowApi、ReaderWindowApi、PlayerWindowApi 和 GamePanelWindowApi。API 按 library、sessions 等实际模块组织，并在运行时逐项限定开放方法。本体新增方法不会自动扩大窗口权限。窗口与实例身份由接入层绑定，不能由普通业务参数自行声明。

窗口调用依次经过业务视图、窗口客户端、preload 和主进程 IPC 适配，最终进入原生能力的完整操作。各层承担以下职责：

- 业务视图管理交互、快照、选择、草稿和反馈。
- 窗口客户端处理结果、错误、取消和监听寿命。
- preload 桥接明确开放的方法。
- 主进程接纳输入、绑定真实调用上下文，并调用对应业务。

业务视图通过所属窗口的 infrastructure/api.ts 使用能力。纯展示组件只接收数据和回调。主进程内部通过显式依赖直接调用，不绕经窗口 API。

preload 不暴露 ipcRenderer、任意 channel、SQL 或 Event 对象。订阅只交付业务数据，并返回释放句柄；窗口销毁时清理连接与订阅。扩展 Webview 通过所属扩展的私有 IPC 调用 Node 业务，不能使用原生窗口客户端。

IPC 接入层校验传输消息与真实调用归属，核对资源读取、视图和任务控制所需的上下文，并适配参数与安全错误。业务输入由所属模块的入口使用共同纯规则校验，不在 IPC 中再定义一份字段 schema；可信内部调用不逐层重复解析。对象是否存在、引用范围是否有效、如何采用资料，以及事务约束是否满足，仍由业务保证。回调、AbortSignal 和主进程对象不能作为普通 JSON 传输；接入层通过连接内的调用关联、取消消息和资源映射传递对应能力，并在结束后释放。

结构化失败必须显式经过 IPC 与 contextBridge，再由客户端恢复为可识别的错误。code、message 和 partialResult 不能依赖 Electron 保留 Error 的自定义属性。调用者直接 await 业务值或捕获业务失败，无需手工拆解传输包装。

rpc 包复用帧校验、请求回复关联、通知、取消和断连清理。具体帧、握手、版本与实例归属见[消息协议](engineering/protocols.md)。环境适配、开放范围与业务身份由各端负责。普通调用不设置统一的短超时，也不自动重试写入。断连会结束等待中的请求，但不能据此认定写入已回滚。机制测试须覆盖双向嵌套调用、取消与完成的竞态，以及断连清理；实际端点还须验证失效实例处理和资源通道释放。

开发工具使用 desktop-contracts/development 的[有限父子消息](engineering/protocols.md#development)，由唯一启动器创建并拥有应用进程；Node 提供 JSON IPC，不复用业务 RPC 管理宿主，也不开放给 SDK。构建采用与退出由本体实际拥有者执行，消息发送成功不能替代操作结果。

<a id="operations"></a>

## 完整操作与执行上下文

界面、菜单、快捷键、deeplink、SDK、扩展页面和自动行为都调用同一个业务拥有者。renderer 通过受控 IPC 接入，deeplink 由 app 解析分发，扩展通过 SDK 或绑定当前实例的私有回调调用自身业务函数，自动行为则由所属功能处理触发。业务函数可以直接复用，不需要先登记全局动作身份。

普通异步操作返回 Promise<业务结果>。Promise 完成表示该操作承诺的全部工作已经结束。例如，扫描返回 ScanResult，新增返回 AddResult，备份返回自身业务结果。open 在实际使用会话就绪后返回该 Session，不等待整个使用过程结束。打开页面只承诺页面就绪，检查更新只承诺检查结果；下载、安装和重启分别有自己的完成条件。耗时长短、缓存是否命中或后台是否已经接纳，都不能改变返回类型与完成条件。

需要任务管理的业务通过 tasks 执行，并等待真实结束后返回自身结果。只有合同明确表示“创建独立任务”的入口才返回 TaskRunRef。进度和控制通过明确的运行接口取得，调用者不必查询历史才能理解普通结果。持续使用内容的会话由 sessions 管理。

业务输入与运行上下文分开传递。普通完整操作取得只读 signal 和 allowInteraction；受托执行的任务还取得 ref、checkpoint、reportProgress 和 reportResult。宿主根据实际入口绑定扩展、视图、调用身份和交互权限，URL、业务参数和扩展声明都不能伪造这些上下文。内部 helper 只接收自己真正需要的能力。

allowInteraction 随本次执行上下文传递，表示操作能否进行合同规定的必要选择。用户明确发起且入口允许选择时为 true，后台入口为 false。游戏目标先按[会话选择规则](domains/sessions.md#open)确定，再根据交互权限决定能否继续必要的人工选择：

| 启动时的实际条件               | 允许原生交互的调用   | 后台调用                 |
| ------------------------------ | -------------------- | ------------------------ |
| 已按会话规则确定目标           | 复用或打开该目标     | 复用或打开该目标         |
| 无法确定配置，原生流程需要选择 | 选择后继续同一次启动 | 返回 interactionRequired |
| 显式条件无效或目标不可用       | 返回具体问题         | 返回具体问题             |

必填值缺失时直接返回校验失败。可以省略的配置选择由完整流程处理；用户取消必要选择时，整次操作按取消结束。允许交互并不允许忽略显式输入、猜测目标，或临时改为搜索与登录流程。普通添加无法确定匹配时返回问题结果，扫描候选的问题进入扫描报告，授权失效的同步则报告执行条件不满足。

必要选择通过原生 UI 能力或当前调用范围内的回调完成。操作拥有者决定等待预算和取消方式，等待限于当前运行。事实事件用于交付已经发生的结果，人工选择在原调用流程中处理。

完整更新必须明确目标、字段、关系和采用方式。批量调用接收实际目标集合，不能读取页面中隐含的当前选择。存档恢复无论从哪个入口发起，都须核对覆盖范围并完成原生确认。

<a id="admission"></a>

### 接纳与执行边界

收到输入与接纳工作分别表示不同事实。各完整操作按自身合同明确以下边界：

| 时点           | 含义                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| 收到触发或请求 | 收到业务事实、变化信号或明确请求，仍由业务拥有者判断是否执行                 |
| 接纳操作       | 拥有者承担本次处理，并在异步准备或资源等待开始前，将实际工作纳入自身在途管理 |
| 实际执行       | 按本次意图、已确定的输入和取消合同，完成准备、业务步骤与必要收尾             |
| 提交结果       | 有正式写入的操作按自身合同核对当前条件，提交已经成立的事实                   |

异步准备可以在接纳后继续。各操作明确目标、来源与采用选择的确定时点；确定后的输入保持本次意图，执行期间保存或选中的其他值用于后续操作。提交时重新核对真正影响本次操作的当前事实，无关字段变化不阻止执行。

尚未接纳的自动变化可以按所属业务规则合并为待核对范围；已接纳而仍在准备或等待资源的操作，已经属于实际在途工作。关闭触发开关或解除订阅只影响后续输入，不隐式取消已接纳操作。可合并的核对需求与读取失效，不改变每次已发生业务事实的边界。

这些时点描述操作的行为与完成条件，接口和文件按实际职责组织。纯读取和观察采用自身适用的阶段；是否使用 TaskRun，由[任务粒度](domains/tasks.md#boundary)决定。

<a id="failure"></a>

## 失败、部分结果与取消

正常业务分支直接返回该业务的结果。整次调用无法完成时，Promise 拒绝，并传递以下可序列化值：

```ts
interface ErrorSummary {
  code: string
  message: string
}

interface ExecutionFailure<Result> extends ErrorSummary {
  partialResult?: Result
}
```

这两个类型定义在 desktop-contracts/errors。[错误目录](domains/library-write-contracts.md#errors)固定本体 code 的含义；string 是通用传输边界，不允许各端临时创造同义错误码。ErrorSummary 用于历史、运行状态和事件。ExecutionFailure 表示一次调用的失败，也可以携带已经成立的部分结果；SDK 将其恢复为可识别的错误。程序按 code 分类，message 只提供安全说明。历史中的 result 与 error 分开保存，不在错误摘要内重复嵌套结果。

各业务自行定义 issues，并用明确字段保存上下文。例如，来源问题指明 provider，扫描问题保留路径与必要线索，备份问题说明受影响的事实；不使用全局任意 details。扫描正常完成时可以包含未识别候选，只有整体执行故障才拒绝调用。open 承诺交付已经就绪的会话，因此会话没有建立时不能返回成功。

只有已经形成合法业务结果时才提供 partialResult。其类型仍为 Result，不能使用 `Partial<Result>` 或任意半成品。取消扫描可以返回已经添加的范围；组合业务则按自身结果合同组织下层事实。通用接入完整传递这些结果，调用者不必了解内部任务身份或回查历史。

例如播放设置的[PlaybackSettingResult](domains/sessions.md#playback-setting-result)明确区分已经保存与已经采用：保存成功后运行采用失败，ExecutionFailure 携带合法的 saved 分支。单纯的 void 结果不能承载这项事实；其他组合操作同样须由自己的结果合同定义已成立部分，不借 message 或任意 details 传递程序需要的状态。

文件切换使用[FileSwitchResult](domains/sessions.md#switch)：正常返回 ready 与就绪 Session；离开旧文件后失败，ExecutionFailure 携带 previousEnded。该部分结果只确认原内容已经结束，保存、资源或新内容打开失败仍保留自己的错误分类。相同结果类型可以包含正常完成与合法部分成果，只有所属操作明确允许的分支才能正常返回。

取消信号表示请求停止。执行者停止尚未开始的工作，完成必要提交或清理后再结束 Promise，并保留已确认事实。完成与取消同时发生时，以真实执行结果为准；已经完成的启动不会因为迟到的取消而终止游戏。

取消的对象必须明确。取消观察或只用于等待既有执行的调用，只结束该次观察或等待；取消实际操作，按该操作合同停止后续工作并收尾。取消应用退出只恢复正常接纳，不重开已经结束的内容，也不撤销已提交结果。

重试由业务在自身调用内决定，只用于已经确认安全的步骤。接入层直接交付调用结果，共同错误提供失败分类；两者都不自动发起重试。

关闭观察页面、主动取消、实例失效和断连是不同情况。已经独立接纳的后台工作按自己的寿命继续；依赖交互或扩展实例的工作在依赖失效后，由拥有者如实结束，迟到结果不能再被采用。断连不表示业务已经停止或回滚。网络请求、进程等待等步骤分别定义自己的等待边界，接入层不施加统一的短执行超时。

<a id="invalidation"></a>

## 读取失效与窗口推送

library.onInvalidated 通过 areas 指明可能过时的功能读取范围：entries、parts、relations、collections、tags、notes、annotations、activities、holdings 和 showcase。通知只携带这些范围，读取者据此刷新数据。多个范围可以合并，允许为保证简单可靠而少量多读；失效粒度保持在功能范围。

失效范围同时覆盖直接和间接影响。例如，分部完成状态影响作品汇总时，同时标记 parts 和 entries。条目变化后可能进入新的筛选结果，相关读取也应刷新。entries 的失效既可以来自条目元数据变化，也可以来自影响条目投影的其他事实。

失效通知与 library.changed 来自同一次成功提交。失效通知可以合并，library.changed 则保留每次完整操作的事实边界。

窗口启动时建立一条主进程失效推送，接入完成后再挂载业务视图。客户端的 onInvalidated 登记窗口内监听者，多个视图共用通道；主进程不为这些视图保存查询或结果。关闭视图只释放该视图的监听，关闭窗口则释放整个连接与订阅。

视图先订阅，再首次读取。读取过程中如果收到相关失效，完成当前读取后仍须安排重查。公共查询辅助能力负责合并调度、忽略旧请求和清理资源；各视图独立持有本次读取的快照。刷新只更新快照，不覆盖未保存草稿。

<a id="events"></a>

## 事实事件与订阅

原生事实与扩展定义的事实统一通过 events.on 订阅，Node 扩展使用 context.events.on。同一事实不同时提供领域模块上的 subscribe 或 onX 别名。原生事件名来自封闭的本体合同，并与各自载荷类型对应；扩展事件使用正式 ref 和相应载荷合同，不以任意字符串和无约束载荷代替类型边界。

事件的含义、载荷与发布时点由所属领域定义。events 设施实现登记、订阅、快照交付、错误隔离和释放，不解释业务事实或组织业务流程。发布能力与只读订阅能力分开提供；本体拥有者只取得其负责事件的发布能力，扩展只能发布本次实例自己定义的事件。

本体模块之间、随应用运行的固定事实订阅，由 app 在[应用装配](architecture.md#app-composition)中集中建立和释放。连接代码通过参数取得 events 能力，将事实交给接收模块声明的完整处理入口；接收模块负责触发判断、工作接纳、并发、结果与失败处理。各模块按声明的能力接入，固定订阅的生命周期由装配负责。

实例范围的动态订阅由实际实例拥有，例如扩展实例自己的事实订阅、页面读取失效订阅和会话状态观察；功能内部的监听与定时资源仍归所属能力。解除订阅只停止后续通知，已接纳执行仍按自身合同结束。统一入口不改变这些寿命，也不把业务队列、取消控制和执行结果转移给 events 或应用连接代码。

事实事件、运行观察和读取失效分别服务于结果通知、状态跟踪与快照刷新。sessions.observe 等观察接口交付当前状态及后续变化，onInvalidated 提醒读取者合并刷新，events 交付已经发生的事实。

事实事件在完整业务边界之后发布。资料事务成功前不发布变化，级联 SQL 也不逐行产生事件。必须一起完成的步骤通过直接调用组织，不能依赖订阅者补齐。订阅者收到的是发布时的只读快照；单个订阅者失败不会影响其他订阅者，也不会改变已提交操作的成功结果。

事件只在运行期间通知，不提供持久消息表、逐次发生的事件 ID、跨重启重放或通用编排。事件时间使用 UTC 毫秒，数组和嵌套值也必须是发布时的快照。高频位置与进度通过观察接口提供。

<a id="event-delivery"></a>

主进程内的事实通知同步交接给本次通知对应的已登记订阅者。同步部分只完成必要的轻量判断和接纳登记，文件处理、网络请求等后续业务异步执行。接收方一旦接纳工作，须在异步准备开始前将其纳入自身运行上下文，使等待与取消覆盖准备、执行和收尾；不能等 TaskRun 建立后才承认这项工作存在，也不由 events 或 bindings 维护另一份业务执行登记。

通知交接完成只表示本进程订阅者已收到通知，不表示它们的后续业务已经完成。订阅者的同步异常与后续异步失败按各自边界隔离，不阻断其他订阅者的交接，也不改写发布方已经成立的结果。必须影响当前操作完成条件的步骤仍通过直接调用组织并等待，不能靠等待全部订阅者补齐。

跨进程订阅遵守传输与实例寿命合同，不承诺远端在发布返回前已经接纳或完成业务。消息已经发出或宿主已经处理发布请求，都不能作为远端业务完成的证据；原操作也不等待全部扩展或页面的事件处理结束。

| 事件                               | 主要参数                                                   | 发布时点                               |
| ---------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| app.ready                          | readyAt                                                    | 基础能力与轻量注册就绪，必要订阅已建立 |
| library.changed                    | 本次完整操作的变化摘要                                     | 正式资料操作提交成功后                 |
| scanner.finished                   | scanRunId、scanConfigId、status、result、error、finishedAt | 本次扫描形成终态与报告后               |
| tasks.finished                     | taskRunId、type、status、result、error、finishedAt         | 已接纳任务进入终态后                   |
| 四类 sessionStarted / sessionEnded | 会话身份、实际目标与时间；结束事件另有 reason              | 按下文四类 Work 的会话边界发布         |

app.ready 的载荷为 { readyAt }。基础能力和轻量注册就绪、必要订阅已经建立后，应用只发布一次该事件。依赖者须在初始化阶段订阅；可选能力失败单独报告。宿主重建或后来启用扩展都不会再次发布。扩展激活时自行读取并建立当前状态，不依赖补放启动事件。

scanner.finished 与 tasks.finished 在各自形成终态后发布，携带实际身份、类型、status、finishedAt、result 和必要的 error。finished 包括 completed、failed、cancelled 和 interrupted。扫描直接提供 ScanResult，任务直接提供自己的业务结果，不需要用另一份历史解释。应用启动时为旧运行补记中断，不补发事件。同一次工作产生多个事实事件，也不能因此向用户重复通知完成。

两类事件遵守[独立历史与完成边界](domains/tasks.md#history)。scanner.finished 表达扫描业务及自身报告的结果，不保证 TaskRun 已完成；tasks.finished 表达整个托管执行的结果，不反向改写已成立的扫描终态。历史保存失败由所属层报告实际失败，事件与运行观察保留已形成的合法结果，但不能据此声称这些内容已经持久化。普通 scan 调用仍等到任务托管收尾结束才交付结果。

library.changed 的载荷为 { committedAt, changes: readonly LibraryChange[] }。LibraryChange 与删除身份快照定义在 desktop-contracts/library，按业务含义表达变化，不描述逐行数据库操作。

```ts
interface EntryIdentitySnapshot {
  ref: EntryRef
  name: string
  externalIdentities: ExternalIdentity[]
}
```

| type                                                      | 必要载荷                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| entryCreated / entryUpdated                               | entry: EntryRef                                                                                                          |
| entryDeleted                                              | snapshot: EntryIdentitySnapshot                                                                                          |
| entriesMerged                                             | sources: EntryIdentitySnapshot[]、target: EntryRef                                                                       |
| evaluationChanged                                         | entry: EntryRef                                                                                                          |
| workRecordChanged                                         | work: WorkRef                                                                                                            |
| partCreated / partUpdated / partDeleted                   | part: PartRef、work: WorkRef；删除仍保留原 work                                                                          |
| partMoved                                                 | part: PartRef、fromWork: WorkRef、toWork: WorkRef                                                                        |
| partKindChanged                                           | fromPart: PartRef、toPart: PartRef、work: WorkRef；同一内容的种类更正                                                    |
| partMerged                                                | source: { ref: PartRef, name: string 或 null, externalIdentities: ExternalIdentity[] }、target: PartRef、work: WorkRef   |
| partRecordChanged                                         | part: PartRef、work: WorkRef                                                                                             |
| relationCreated / relationUpdated / relationDeleted       | 实际四类关系的判别引用、id 与相关 Entry 端点；人员工作另有实际 role 和可选 character                                     |
| collectionCreated / collectionUpdated / collectionDeleted | collectionId；删除所需的原名称快照按本体删除结果保留                                                                     |
| collectionsMerged                                         | sourceIds、targetId                                                                                                      |
| collectionMembersChanged                                  | collectionId、实际受影响的 EntryRef[]                                                                                    |
| tagCreated / tagUpdated / tagDeleted                      | tagId；删除所需的原名称快照按本体删除结果保留                                                                            |
| tagsMerged                                                | sourceIds、targetId                                                                                                      |
| entryTagsChanged                                          | entry: EntryRef、实际受影响的 tagIds                                                                                     |
| noteCreated / noteUpdated / noteDeleted                   | noteId、当次受影响的关联 EntryRef[]；不包含正文                                                                          |
| annotationCreated / annotationUpdated / annotationDeleted | annotationId、work: WorkRef、当时的可空 fileId；游戏没有 fileId                                                          |
| activityCreated / activityUpdated / activityDeleted       | activityId、work: WorkRef                                                                                                |
| holdingsChanged                                           | work: WorkRef；按实际变更附对应的目录、文件、启动配置或备份身份；文件合并另带 fileMerged 的 sourceFileId 与 targetFileId |
| showcaseChanged                                           | 实际受影响的 sectionIds；排列变化使用受影响的完整排列范围                                                                |

清空评分属于 evaluationChanged，不表示删除业务对象。删除快照只保存解释当时对象所需的身份、名称和外部身份，不包含简介、图片、私人记录或关系图。合并明确表达 sources 到 target 的归并，不能把来源作为普通删除处理。分部删除后，事件仍保留原作品归属。

一次操作可以产生多种真实变化，同一对象重复的同类变化可以合并；合并操作只附加确有独立用途的其他变化。变化摘要描述同一次完整提交，接收方按这次提交整体采用。扩展观察事件后需要写入时，发起下一次完整操作，携带实际调用来源并处理自触发循环。运行追踪信息只在相应执行寿命内使用。

领域参与接口需要等待返回并决定是否采用结果，因此与事实订阅分开。公开贡献只包括明确开放的来源、字段处理、作品识别、菜单、页面和主题等能力。完整类型与开放清单见 [提供者](extensions/providers.md)、[运行接入](extensions/runtime.md) 和 [Webview](extensions/webview.md)。文件与分部识别、游戏启动准备和资料库约束由原生功能负责，不开放分部匹配器或启动准备器注册，也不在数据库事务内等待扩展。

<a id="session-events"></a>

## 使用会话的开始与结束

| 作品类型 | 会话开始                      | 会话结束                    |
| -------- | ----------------------------- | --------------------------- |
| 游戏     | sessions.game.sessionStarted  | sessions.game.sessionEnded  |
| 动画     | sessions.anime.sessionStarted | sessions.anime.sessionEnded |
| 漫画     | sessions.comic.sessionStarted | sessions.comic.sessionEnded |
| 小说     | sessions.novel.sessionStarted | sessions.novel.sessionEnded |

实际目标已经就绪，并且应用开始负责该使用上下文后，才发布 sessionStarted。游戏需要确认并接管本次配置指定的运行对象，无需判断游戏内部内容是否加载完毕。视频和阅读则需要成功打开文件并完成初始化。点击按钮、系统接纳、准备占用、等待进程和文件加载都不算会话开始；开始也不表示已经累计有效时间。外部已经运行但未受应用管理的目标不会被接入为会话。

会话跟随实际文件或本次受管理的游戏运行。会话结束后，不再接收它的位置、计时和控制报告。同一窗口切换文件时，先结束原会话，待新目标就绪后建立新会话。同文件内定位、游戏进程集合的成员变化、聚焦、暂停计时、前后台变化和宽限到期，都不会另发开始或结束事件。尚未建立的会话通过 open 的失败或取消表达，不发布结束事件。

| 结束原因    | 含义与适用范围                                                                     |
| ----------- | ---------------------------------------------------------------------------------- |
| stopped     | 主动关闭本次播放或阅读内容，包括应用正常退出时先关闭这些内容；不适用于游戏主动脱离 |
| interrupted | 无法继续可靠维持本次使用上下文，被迫结束；不伪造已确认的游戏退出                   |
| replaced    | 视频或阅读切换实际文件，结束原文件上下文                                           |
| exited      | 已确认本次游戏监测集合结束；仅适用于游戏，不承诺正常关闭、存档成功或没有崩溃       |
| detached    | 用户在应用退出中明确停止游戏记录，应用已经保存并结束管理；不证明外部游戏退出       |

游戏使用 exited、interrupted 与 detached，其他三类使用 stopped、replaced 与 interrupted。发出终止请求后，仍须确认本次监测集合确实结束，才能报告 exited，不能由某一个成员退出代替整个集合结束。暂时观察失效按游戏合同处理；只有真正无法维持上下文时才使用 interrupted。exited 只证明本次受管理运行已经退出，不证明正常关闭、存档成功或没有崩溃。

四类会话分别使用上述 sessionStarted 与 sessionEnded 事件表达生命周期。视频到达末尾但播放器仍停留、阅读到达末页，都不会结束会话或声明已读。位置、加载、末尾和翻页通过会话观察与原生流程处理。

开始事件复用具体 Session 的固定上下文，不包含 timing、playback 或 reading。游戏载荷包括 sessionId、gameId、launchConfigId 和 startedAt；存档来源明确时，另带 GameBackupSource 的 snapshot 分支 saveSource。该值固定本次路径，不要求存档已经生成，也不重新读取后来改变的首选配置。其他三类载荷包含 sessionId、所属作品、fileId 和 startedAt。

游戏会话事件不携带启动时的自动备份开关。备份能力处理结束事实时，按[接纳时点](domains/backups.md#automatic)读取同一 launchConfigId 的当前选择；这不改变事件中已经固定的身份与来源，也不允许改用当前配置路径补造本次来源。

结束事件在同一上下文上增加 endedAt、该类型允许的 reason，以及可选的 recordingError: ErrorSummary。实际内容已经结束而最后记录保存失败时，按[关闭合同](domains/sessions.md#close)报告操作失败并结束会话，查询返回 null，结束事件保留真实原因并附带错误。明确 detached 要求记录提交成功；保存失败按[脱离合同](domains/sessions.md#detach)保留会话，不发布结束事件。recordingError 说明本次最终保存失败；实际会话已经结束，未提交值按[运行内快照](domains/sessions.md#pending-recordings)保留。重试或放弃不改写这个已发布事实，也不重发结束事件。状态、事件与操作失败使用同次收尾事实；后续备份或同步失败不计入 recordingError。

同一会话至多发布一次开始和一次结束，结束事件在收尾形成结果后发布。崩溃或强制终止可能来不及发出事件，重启后不补发。sessionId 只标识运行上下文，不建立持久会话父表。内部引擎和进程句柄不对外公开。

切换实际离开旧文件后，新内容打开失败仍保留原会话的 replaced 原因和结束事实，不改报 interrupted，也不发布没有就绪的新会话。FileSwitchResult.previousEnded 与这次结束使用相同的原 sessionId；重试保存和后来明确重新打开均不重发原结束事件。

<a id="extension-events"></a>

## 扩展事件与释放

context.events.define 为当前扩展实例创建事件，并返回带只读稳定 ref 的 publisher。publisher.emit 发布该实例拥有的事件，events.on 用于订阅。宿主绑定真实实例与代际，并在边界验证输入；原生事实由其本体拥有者发布。

事件数据使用已知业务合同，动态值保留真实类型，不需要转换为表单字段目录。资料协作使用已经定义的领域参与接口；不开放任意跨扩展私有方法，也不借助事件实现隐式 RPC。取消、实例身份和归属信息保留在执行上下文中。

释放订阅表示停止观察，释放注册表示撤销贡献，释放资源句柄表示结束当前占用。三种释放都可重复调用，已提交资料继续保留。后台执行按自己的寿命收尾；参与调用依赖的实例失效后，迟到结果必须丢弃。登记、订阅和调用上下文作为运行内资源管理。

<a id="capabilities"></a>

## 通用能力的公开边界

PreparedImage、transform 参数、图片处理顺序和采用规则由 [附件与图片](domains/attachments.md) 定义。字节读取遵守 [资源](domains/resources.md) 的范围、流、取消和释放合同，不将字节内容塞入普通 JSON。

NativeViewTarget 定义在 desktop-contracts/ui，按具体原生目标区分分支。目标包括 Entry 列表、详情与适用的本地选择，Collection、Tag、Note 的列表或 id，Annotation 的已保存内容，tasks.runId，scanner.configId 或 runId，metadataProfiles.profileId，sessions.recordings（可带 sessionId 定位未保存记录），preferences，extensions.extensionId 或 pageId，以及已有的主题、字体、系统集成、更新和引导入口。

Entry 使用 EntryIdentifier，并核对从属类型。Annotation 使用 [AnnotationRef](domains/annotations.md#api)，按身份打开已保存内容；返回原文件仍由内容界面的明确操作发起。ui.navigate(target) 等待宿主就绪并接纳导航后返回 void，不隐含保存、启动或采用操作。

desktop-contracts/deeplink 的 parse(url) 与 format(request) 是纯函数，按 view、open、add 和 extension 区分请求。字段、公开目标、编码和重复参数规则见[应用入口](ui/navigation.md)；extension 分支保留正式扩展身份、路径、有序查询项与可选 fragment，采用共同 URL 解析与校验，业务含义由目标扩展解释。extension-api 选取所需纯合同并定义 Node 的 context.deeplink.register 接入，SDK 绑定真实实例、回调与取消，完整规则见[扩展 deeplink 入口](ui/navigation.md#extension-deeplinks)。内部 NativeViewTarget 不会自动获得公开链接。格式化不查询数据库或来源，格式错误使用安全错误表达；实际接收端还须核对归属和当前事实。

notifications.show 接收 { title, body, open?: NativeViewTarget }，返回 accepted 或 unavailable；投递失败时拒绝调用。accepted 只表示操作系统已经接纳。Node SDK 使用这项能力，Webview 使用所属视图的 Toast。通知点击由 app 协调，只有已经定义的公开入口可以通过协议激活。内部目标不会因此获得应用退出后的恢复保证。接口不公开 Electron Notification、点击脚本或完整业务结果，不保存通知历史，也不在不可用时自动改投 Toast。

files 的枚举、观察、规范路径和字节读取属于主进程内部协作能力。Node 扩展在可信 Node 环境中读取自己的文件，再向本体传递 FileInput。renderer 与 Webview 使用真实选择或拖入所建立的来源，以及 view.resources.bind 限定的范围。取消原生选择返回 null；仅完成选择不会创建附件或持有。

windows、processes、database 和 attachments 各自保留内部句柄与技术职责。业务控制通过 ui、sessions 和实际业务拥有者执行。network 的公开 fetch 与私有 request 见 [网络](engineering/network.md)，代理凭据由 preferences 管理。日志用于代码边界处理，不提供业务查询 API。

<a id="directory"></a>

## 功能合同导航

输入、结果、报告和事件都由对应语义模块定义。desktop-contracts 发布完整本体合同，extension-api 明确选取开放能力，SDK 实现运行接入。数据库连接、原生窗口和引擎实例保留在本体内部。

| 能力                                 | 合同拥有者                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 资料库、完整修改与读取               | [库操作](domains/library-operations.md)、[库查询](domains/library-queries.md)                                                    |
| 资料搜索、定位、读取与合成           | [资料获取](domains/metadata.md)、[提供者](extensions/providers.md)、[资料方案](domains/metadata-profiles.md)                     |
| 资料新增与更新采用                   | [资料采用](domains/metadata.md)                                                                                                  |
| 扫描配置、预览、执行及历史           | [扫描](domains/scanner.md)                                                                                                       |
| 四类作品的打开、控制、观察和收尾     | [使用会话](domains/sessions.md)                                                                                                  |
| 任务执行、观察和控制                 | [任务](domains/tasks.md)                                                                                                         |
| 主题、字体及视图外观                 | [外观与字体](domains/appearance.md)                                                                                              |
| 应用设置与有效采用                   | [偏好](domains/preferences.md)                                                                                                   |
| 应用级查找和导航结果                 | [搜索](domains/search.md)                                                                                                        |
| 页面、菜单、Dialog、Toast 与私有 IPC | [扩展视图](extensions/webview.md)、[原生导航](ui/navigation.md)                                                                  |
| 语言登记与文案                       | [语言](ui/localization.md)                                                                                                       |
| 扩展管理、发行、应用更新与引导       | [扩展运行](extensions/runtime.md)、[分发](extensions/distribution.md)、[更新](domains/updates.md)、[引导](domains/onboarding.md) |

扩展安装、信任、重启、应用更新和引导进度修改均属于本体管理入口。SDK 只提供实际开放的能力，包括扩展自身信息和适用管理界面的导航。逐项开放范围见 [扩展运行](extensions/runtime.md)。
