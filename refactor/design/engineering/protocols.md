# 通信帧、版本与开发握手

rpc 包、扩展接入与本地开发连接使用下述协议，分别管理消息传输和实例寿命。业务输入、完成条件、取消和安全失败沿用[通信合同](../communication.md)，业务重试由所属操作决定。

<a id="versions"></a>

## 分开判断的版本

| 版本                             | 定义与核对方式                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| rpc wireVersion                  | rpc 包拥有，值为 1；帧字段和请求关联规则变化时更新。双方只接纳自己实现的版本，不协商回退                            |
| 接入 protocolVersion             | 各端点协议拥有，首版为 1；表示该端点的握手、消息目录及资源适配。不能用 npm 包版本替代                               |
| extension API version            | extension-api 拥有的 SemVer；核对 manifest.apiVersionRange，不等于桌面版本、SDK 版本或 wireVersion                  |
| manifest／registry schemaVersion | extension-distribution 拥有的文档格式；在读取对应文档时验证，不与 RPC 帧合并                                        |
| desktop buildId                  | 同一制品主进程、preload、原生 renderer 和 extension-host 的构建标识；私有同版本端点必须一致，防止旧资源接入新主进程 |
| development protocolVersion      | desktop-contracts/development 拥有，首版为 1；父子消息及构建交接使用独立版本，不以工具 npm 版本猜兼容         |

同一个 API 范围内，SDK 可以独立发布；符合范围并且接入协议受支持才可以建立能力。未知主版本、缺少必要声明或不满足范围时，在开放调用前明确拒绝。已经安装的扩展保留包、私有数据和用户启用意愿，只停止不兼容实例的加载。新增接口不自动向已有端点开放，接入方法表继续逐项选择。

各包显式导出自己拥有的版本常量；构建不得读取另一个包的私有源码推算它。变更行为、错误分支、公开消息或值形状时，同时复核 API 兼容与对应协议版本；纯内部重排不机械提升所有版本。

<a id="frames"></a>

## rpc 的有限帧

帧中的值只允许可传递的普通 JSON 值。对象可省略可选字段，不能显式携带 undefined；数组不含空槽、undefined、函数或非有限数。Date、Map、Error、AbortSignal、回调和本地资源句柄必须由拥有者转换。大资源字节使用已有资源／媒体通道，不作为任意 RPC 对象传递。

```ts
type RpcFrame =
  | {
      type: 'hello'
      wireVersion: 1
      protocol: { id: string; version: number }
      context: JsonValue
    }
  | { type: 'accepted'; context: JsonValue }
  | { type: 'rejected'; error: { code: string; message: string } }
  | { type: 'request'; id: number; method: string; args: readonly JsonValue[] }
  | { type: 'success'; id: number; value?: JsonValue }
  | { type: 'failure'; id: number; error: JsonValue }
  | { type: 'notify'; topic: string; value: JsonValue }
  | { type: 'cancel'; id: number }
```

JsonValue 由 rpc 的纯值模块定义。error 在通用帧层是待交付的值，各端点使用自己的安全失败解析器；本体与 SDK 对外调用必须解析为 ErrorSummary／ExecutionFailure，不能把任意对象当成可展示异常。rpc 不导入 desktop-contracts，不解析 partialResult 的业务结构。

创建连接时确定发起方与接纳方。发起方先发送 hello；接纳方核对版本、协议与实际绑定上下文后，只回复一次 accepted 或 rejected。成功前不允许 request、notify 或资源登记。未知 wireVersion 可以读取最小 hello 信封后以 ProtocolMismatch 拒绝，不先解释未知版本的业务部分。建立传输后十秒内未完成握手则关闭并报告连接失败；这项上限只用于握手，不限制激活、迁移或业务执行时间。

protocol.id 区分 `kisaki.window`、`kisaki.extension-node`、`kisaki.extension-webview` 与 `kisaki.extension-host`。这些字符串与对应 protocolVersion 属于各端点合同，rpc 本身不硬编码本体名单。context 的值也由端点定义，纯机制不根据客户端自报身份授予权限。

成功后的调用规则如下：

- 请求 ID 是本连接、当前发送方向内从 1 递增的安全整数。双方可同时发送相同数字，关联表按方向分别管理；ID 不跨重连复用为业务身份，不持久保存。达到安全整数上限时先停止接纳并有序关闭，不回绕。
- request.method 只能命中此端点显式开放的表项。不存在的方法按 InvalidInput 拒绝该请求；没有权限的方法按 PermissionDenied 拒绝。参数由该方法所属纯合同解析，不能动态访问任意对象路径。
- 每个请求只交付一次 success 或 failure。success 省略 value 表示 void；`value: null` 保留真实 null。失败必须经过安全序列化，客户端恢复可识别错误后拒绝 Promise。
- notify 不产生回复，只承载已定义主题。订阅建立、释放及资源登记是有回复的明确控制调用，不能依赖无法确认的通知完成必要写入。通知处理失败由消费者拥有边界记录，不让发送方误以为它参与了原业务事务。
- cancel 只指向该方向原请求，表示请求停止；不立即伪造 Cancelled 回复。实际执行者按业务规则完成提交或收尾，再发送真实结果。请求已经完成时，迟到 cancel 无效果。观察取消仅停止观察，独立接纳的工作按自身寿命继续。
- 请求处理不得全局串行等待；双向嵌套请求和异步回调仍可推进。业务需要串行时，由其真实资源拥有者安排，不以阻塞消息泵实现。

收到重复／倒退 request ID、未知帧类型或非法形状时以 ProtocolViolation 关闭连接。已经分配且结束的回复可以忽略；大于本端已分配 ID 的回复属于非法关联。迟到结果不能进入下一条连接，重连必须重新握手，重新建立真实订阅和资源。

传输关闭时清理待回复、监听、回调与资源映射；仍等待结果的调用以 ConnectionClosed 结束。断连不能证明远端停止、提交失败或回滚，调用方不得重放写入。接纳方按业务寿命取消依赖该连接的工作、保留独立工作；既成结果与必要资源清理由实际拥有者负责。

协议使用本节声明的有限帧，自研内核负责接入、版本、严格帧校验、按调用取消与断连清理。业务结果、身份权限和宿主流程由相应拥有者处理。协议不标称 JSON-RPC 2.0 兼容，也不支持 batch、通用事务、远程对象引用或自动写入重放。选型依据见[候选比较](../../verification/evidence/technical-tradeoffs/2026-10-22/README.md#rpc)；正式内核的完整行为按下方消息边界验证，候选库证据限于其自身覆盖范围。

<a id="endpoints"></a>

## 各端点的握手与身份

| 端点                | hello.context             | 接纳依据与 accepted.context                                                                                                                             |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 原生窗口            | `{ buildId, windowKind }` | 主进程已绑定的实际 webContents、preload 和窗口种类；校验 buildId 与种类后返回 `{ buildId }`。业务调用不再自报窗口 ID                                    |
| 私有 extension-host | `{ buildId, generation }` | 主进程本次实际启动的进程、专属端口及预期 generation；返回同一 `{ buildId, generation }`。generation 是运行代际，不是持久扩展身份                        |
| SDK Node 接入       | `{ apiVersionRange }`     | 宿主创建 context 时绑定的扩展实例、经过验证的 manifest 范围与此 SDK 支持范围共同成立；返回 `{ apiVersion, instanceId }`。SDK 不选择另一个扩展实例       |
| SDK Webview 接入    | `{ apiVersionRange }`     | 本次 document 的实际 MessagePort、宿主视图和所绑定 Node 实例；返回 `{ apiVersion, instanceId, viewId, documentId }`。URL 或消息中的名称不能替代端口绑定 |

SDK 支持范围由发行时的公开协议常量声明，manifest 范围仍由应用独立验证；不能用 SDK 自报范围代替作者声明。私有端点 buildId 不符为 ProtocolMismatch，公开 API 范围不符为 ApiIncompatible，旧实例接入为 InstanceExpired，来源或开放范围不合法为 PermissionDenied。错误只包含可展示的安全原因，不回显凭据、端口对象或任意来信。

Webview 新 document 使用新 documentId 与端口。普通 HMR 没有更换 document 时可以保留该连接；文档刷新必须重新握手并释放旧请求与监听。Node 实例未变化时不重复业务 setup，宿主替换 Node 实例时旧句柄全部失效，再按[页面生命周期](../extensions/runtime.md)建立新视图。

MessagePort 的引导交接由真实浏览器适配层核对 iframe/source/origin 与一次性接入凭据。可信绑定建立后，后续帧只认该端口，hello.context 用于检查已绑定上下文的一致性。接入凭据仅供此次交接使用，禁止放入可回看的导航 URL 或日志。

真实来源与资源边界按[Webview 容器](../extensions/webview.md#isolation)建立。接入层从已登记协议与规范化 host 构造预期来源，再与 Chromium 的真实浏览器消息核对；Node URL 对自定义协议的 origin 结果只适用于其自身解析环境。CSP、权限或加载失败使 document 失效时，接入层释放旧连接及其可调用资源。

<a id="development"></a>

## CLI 与开发应用的父子消息合同

开发协议由 desktop-contracts/development 独立拥有，仅用于[开发工作流](../extensions/development.md#connection)。唯一启动器通过 Node child_process.spawn 直接创建应用，stdio 配置一个 ipc 项并使用 JSON 序列化。源码桌面开发与作者开发使用同一接入；前者运行项目 Electron 与完成的 main 入口，后者运行所选应用的真实可执行文件。macOS 定位 bundle 内的可执行文件，Linux 直接启动所选应用或 AppImage，不经系统打开命令另起无法拥有的实例。

启动器传入 `--development` 和 `--profile=<绝对路径>`。应用在数据库、日志与浏览器 Session 建立前选定资料，并要求本次父子 IPC 已存在。正式包也从正常包内主模块接入，保留现行 fuses。源码自动化可单独传入 profile 使用隔离资料；没有 development 参数就不建立开发控制连接。打包应用的资料覆盖仅在受控开发模式开放，普通启动仍遵守安装与便携规则。renderer-url 与窗口选择只适用于源码运行，不能据此改写正式应用的界面入口。

消息关联到实际子进程对象及其 IPC 连接。Node 负责消息序列化与消息边界；本项目校验有限消息的类型、字段和当前操作条件，不维护字节帧、命名管道或 socket 端点、连接凭据和消息内会话身份。只支持启动自己拥有的应用，不提供附加到任意进程、任意方法调用、自动重连或旧消息重放。资源和构建内容通过目录交接，不嵌入消息。

| type           | 方向            | 其余字段与含义 |
| -------------- | --------------- | -------------- |
| initialize     | 启动器 → 应用   | `protocolVersion: 1`；建立父子连接后发送一次，应用先核对版本 |
| ready          | 应用 → 启动器   | `protocolVersion: 1, appVersion, apiVersion, buildId`；本体完成初始化，版本与构建身份来自实际运行输入，不代表扩展已激活 |
| buildsReady    | 工具 → 应用     | `builds: DevelopmentBuild[]`；已经完成且不会继续改写的非空批次，扩展 ID 不重复 |
| adoptionResult | 应用 → 工具     | 使用下方 DevelopmentAdoptionResult，报告本批构建的实际采用与激活结果 |
| buildsReleased | 应用 → 工具     | `builds: { extensionId, buildId }[]`；所列构建已无宿主、页面或资源读取者，可以清理其临时目录 |
| stop           | 启动器 → 应用   | 无其他字段；请求该实例的正常退出流程 |
| stopResult     | 应用 → 启动器   | `outcome: 'exiting' \| 'cancelled' \| 'failed', error?`；只有 failed 带 error。普通界面退出也在正常收尾后报告 exiting |
| failed         | 应用 → 启动器   | `error: ErrorSummary`；本体启动或连接已无法继续，不冒充编译失败或全部激活失败 |

initialize 只接受一次，未知版本不继续解释后续操作。应用在连接建立后十秒内未收到初始化时报告失败并收尾。ready 等待真实启动完成；启动器可为具体启动环境设置启动预算，不能拿它限制迁移或用户退出选择。apiVersion 表达本体实际提供的扩展运行 API；没有该能力时为 null，且不能接纳 buildsReady。作者工具在交付构建前核对实际能力及兼容范围，不能把公共包版本冒充运行能力。

DevelopmentBuild 为 `{ extensionId, buildId, rootPath, webviews }`。buildId 是本连接内该扩展递增的正安全整数，只关联临时构建及其释放，不替代发布版本。rootPath 是已完成且不再改写的完整构建绝对路径。应用正常读取并校验实际 manifest、入口、身份、兼容和运行条件；正式安装包的签名与字节校验仍归安装流程。

webviews 为 `{ document, url }[]`，没有 Webview 时数组为空。映射只使用本会话拥有的 loopback 开发服务器和明确文档，并遵守[每视图开发内容来源](../extensions/webview.md#development)。不能把共享 loopback origin 当作页面隔离，也不能由消息开放任意网络代理或扩大 document.root。

同一连接最多有一批构建正在采用。工具拥有尚未交付的最新集合，每个扩展只留最新完整结果；当前批次结束后才发送下一批。应用只执行固定的当前批次及共享宿主重建，不再维护第二份跨消息候选队列。尚未交付的旧候选由工具自己替换和清理，不在线上报告替代结果；已交付的候选等待自己的实际结果。

```ts
type DevelopmentBuildResult =
  | { extensionId: string; buildId: number; outcome: 'adopted' }
  | { extensionId: string; buildId: number; outcome: 'notAdopted'; error: ErrorSummary }

type DevelopmentActivationResult =
  | { extensionId: string; instanceId: string; outcome: 'activated' }
  | { extensionId: string; outcome: 'failed'; error: ErrorSummary }

type DevelopmentAdoptionResult = {
  type: 'adoptionResult'
  builds: readonly DevelopmentBuildResult[]
  activations: readonly DevelopmentActivationResult[]
} & ({ outcome: 'completed' } | { outcome: 'interrupted'; error: ErrorSummary })
```

连接有效且执行者能够交付时，每个接纳的 buildsReady 只返回一次 adoptionResult。completed 按输入逐项交付结果，不表示全部成功；interrupted 保留已确定的构建结果及实际尝试过的激活，缺项保持未知。共享宿主重建时重新激活的其他扩展也如实列出。已采用而激活失败的构建仍为 adopted，失败属于 activations。Node send 回调只确认传输结果，不能代替这些事实。

stop 至多有一个在途请求，重复调用共享这次等待；取消后可再次明确请求。应用完成窗口关闭决定后才释放宿主等资源。退出取消保留正在使用的输出、编译监听与服务器，开发会话继续可用；不能先永久取消工具，再留下仍在运行的应用。启动准备的 AbortSignal 与运行期正常停止分别处理，不给一般有限命令增加可撤回取消。

采用结果不代表旧构建已经无读取者。只有 buildsReleased，或已经确认应用与相关读取进程真实结束，才可以清理对应目录。启动器观察 ChildProcess 的 exit，并分别关闭自己取得的日志流；disconnect、stopResult.exiting 和超时不能代替退出。异常结束且读取者状态不明时保留目录并报告。连接丢失终止后续交接，应用请求正常退出；若退出被取消，应用和目录仍保留，连接已失效的事实不能改写成开发正常运行。强制结束必须由开发者明确请求，只作用于本会话拥有的进程。新启动创建新连接和临时构建身份，持久 profile 继续保留。

<a id="verification"></a>

## 必须验证的消息边界

纯机制验证覆盖有限帧校验、双向相同 ID、嵌套调用、void 与 null、一次回复、取消／完成竞态、握手前调用、版本不符、迟到旧连接结果与断连释放。端点验证再覆盖真实来源、权限、API 范围、旧宿主代际、旧 Webview document 和资源寿命；类型检查不能证明这些运行边界。

开发连接验证未知版本、非法消息、就绪前操作、重复在途批次、同扩展连续构建、工具侧候选替换、真实采用与激活失败、目录释放、退出取消后继续开发，以及断连与实际退出的区别。源码与打包应用都使用真实 Electron 父子 IPC 核对；Windows、macOS 与 Linux 的实际可执行文件及 AppImage 分别记录平台证据，单平台试件不能代替其余目标。
