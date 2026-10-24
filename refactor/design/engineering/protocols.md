# 通信帧、版本与开发握手

rpc 包、扩展接入与本地开发连接使用下述协议，分别管理消息传输和实例寿命。业务输入、完成条件、取消和安全失败沿用[通信合同](../communication.md)，业务重试由所属操作决定。

<a id="versions"></a>

## 分开判断的版本

| 版本                             | 定义与核对方式                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| rpc wireVersion                  | rpc 包拥有，首版为 1；帧字段和请求关联规则变化时更新。双方只接纳自己实现的版本，当前仅有 1，不协商回退              |
| 接入 protocolVersion             | 各端点协议拥有，首版为 1；表示该端点的握手、消息目录及资源适配。不能用 npm 包版本替代                               |
| extension API version            | extension-api 拥有的 SemVer；核对 manifest.apiVersionRange，不等于桌面版本、SDK 版本或 wireVersion                  |
| manifest／registry schemaVersion | extension-distribution 拥有的文档格式；在读取对应文档时验证，不与 RPC 帧合并                                        |
| desktop buildId                  | 同一制品主进程、preload、原生 renderer 和 extension-host 的构建标识；私有同版本端点必须一致，防止旧资源接入新主进程 |
| development protocolVersion      | desktop-contracts/development 拥有，首版为 1；本地字节流消息及构建交接使用独立版本，不以工具 npm 版本猜兼容         |

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

协议使用本节声明的有限帧，自研内核负责接入、版本、严格帧校验、按调用取消与断连清理。业务结果、身份权限和宿主流程由相应拥有者处理。协议不标称 JSON-RPC 2.0 兼容，也不支持 batch、通用事务、远程对象引用或自动写入重放。[候选比较](../../verification/evidence/technical-tradeoffs/2026-10-22/README.md#rpc)记录 birpc 的能力与当前选择依据；W01 验证正式内核的完整行为，候选库结果只证明其自身覆盖范围。

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

## CLI 与开发应用的字节流合同

开发协议由 desktop-contracts/development 独立拥有，仅用于[开发工作流](../extensions/development.md#connection)。它不用任意 RPC method 承载宿主管理，也不让 SDK 获得该连接。

启动器建立会话后，CLI 先监听专用本地端点，再启动开发应用。Windows 使用带随机会话标识的命名管道，并关闭 readableAll 与 writableAll；Unix socket 位于仅当前用户可访问的短路径会话目录。

启动器传入 sessionId、端点和隔离 profile 路径，通过继承环境交付至少 128 位随机的一次性 token。token 仅用于本次接入，排除在提交配置、日志和终端命令之外。握手成功后才交付构建路径并接纳管理消息。

接入凭据用于核对本次会话，不提供同用户恶意进程的隔离保证。Windows [默认管道权限](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights)与 Unix 私有目录权限分别核对；通过 Node [IPC 接口](https://github.com/nodejs/node/blob/main/doc/api/net.md)建立端点后，按实际运行版本验证权限与接入。

字节流采用四字节无符号大端长度，随后为该长度的 UTF-8 JSON 对象；长度不包含头部，必须为 1–1,048,576 字节。读取器允许头部／正文拆包与多帧合包，解码拒绝非法 UTF-8、非对象和未知键。超过上限或非法帧时关闭连接，不按长度分配无界缓冲，也不把半帧当完整消息。资源和构建内容通过明确目录交接，不嵌入字节流。

每条消息都包含 type 与 sessionId。sessionId 必须等于真实启动会话；握手完成后不再携带 token。消息集合与方向如下：

| type           | 方向            | 其余字段与含义                                                                                              |
| -------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| hello          | 应用 → CLI      | `protocolVersion: 1, token`；只发一次，尚不表示应用初始化或扩展激活完成                                     |
| accepted       | CLI → 应用      | `protocolVersion: 1`；只确认开发连接。版本、会话或凭据不符发送 rejected 后关闭                              |
| rejected       | 接纳方 → 发起方 | `error: ErrorSummary`；安全原因，不能回显 token                                                             |
| ready          | 应用 → CLI      | `appVersion, apiVersion, buildId`；本体初始化完成、可以接纳完整构建，不代表任何扩展已激活                   |
| buildsReady    | CLI → 应用      | `sequence, builds: DevBuild[]`；sequence 为从 1 递增的安全整数，builds 非空且扩展 ID 不重复                 |
| adoptionResult | 应用 → CLI      | 使用下方 DevAdoptionResult；分别报告完整处理或中途结束，以及真实采用与实际激活结果                          |
| buildsReleased | 应用 → CLI      | `builds: { extensionId, buildId }[]`；所列构建已无宿主、页面或资源读取者，可以清理其临时目录                |
| stop           | CLI → 应用      | `requestId`；请求走该实例的正常退出流程，不直接杀进程                                                       |
| stopResult     | 应用 → CLI      | `requestId, outcome: 'exiting' \| 'cancelled' \| 'failed', error?`；failed 必须有 error，其他分支不带 error |
| failed         | 应用 → CLI      | `error: ErrorSummary`；本体初始化或会话发生无法继续的故障，不冒充构建失败或全部激活失败                     |

接纳方先检查最小 hello 的版本与会话，未知版本不解释其他消息。连接后十秒内握手未完成则诊断并收尾；ready 与实际退出分别遵守启动器和应用的执行寿命，不借握手超时结束尚未完成的迁移或用户退出选择。ready 之前不能发送 buildsReady；首次完整构建仍在应用启动前全部准备好。

DevBuild 为 `{ extensionId, buildId, rootPath, manifestSha256, webviews }`。buildId 是本会话内该扩展单调递增的安全整数，不能替代扩展发布版本。rootPath 是已经写完、以后不再改写的完整构建目录绝对路径；manifestSha256 是该目录 manifest 字节的 SHA-256。webviews 为 `{ document, url }[]`，只接受本会话实际拥有的 loopback 开发服务器与明确文档映射，不从任意 URL 推导权限。没有 Webview 时数组为空。

webviews.url 指明[开发内容来源](../extensions/webview.md#development)，宿主通过每视图独立来源接入；不能直接导航到共享 loopback origin 后放弃视图隔离。开发消息不授权任意网络代理或扩大 document.root。

应用独立校验目录、manifest、扩展身份、兼容范围和文档映射，再按现有重建流程采用。协议完成、编译完成、候选被采用和 activate 成功分别报告：

```ts
type DevBuildResult =
  | { extensionId: string; buildId: number; outcome: 'adopted' }
  | { extensionId: string; buildId: number; outcome: 'superseded' }
  | { extensionId: string; buildId: number; outcome: 'notAdopted'; error: ErrorSummary }

type DevActivationResult =
  | { extensionId: string; instanceId: string; outcome: 'activated' }
  | { extensionId: string; outcome: 'failed'; error: ErrorSummary }

type DevAdoptionResult = {
  sequence: number
  builds: readonly DevBuildResult[]
  activations: readonly DevActivationResult[]
} & ({ outcome: 'completed' } | { outcome: 'interrupted'; error: ErrorSummary })
```

连接仍有效且执行者能够交付时，每个已接纳 buildsReady 只返回一次 adoptionResult。completed 表示全部项目已经处理，builds 按输入逐项给出结果，并不表示全部成功；整体流程无法继续时使用 interrupted 和安全 error，只保留已有确定结论的 builds 及实际 activations，缺项不伪造失败。进程崩溃或断连没有报告时保持结果未知，不重放旧消息。等待期间被同扩展更新构建替代的旧候选为 superseded；正在采用的一轮已经固定，后来的候选进入下一轮，不能倒退。激活结果只包含真实尝试过的实例，包含共享宿主重建时重新激活的其他扩展；不会为未尝试项伪造失败。候选已采用而激活失败时，该项仍为 adopted，错误出现在 activations。

采用结果不表示旧构建已经无读取者。只有收到 buildsReleased，或已确认开发应用与全部相关子进程真实结束，CLI 才清理对应临时目录。失去连接而无法确认实例已结束时保留目录并诊断，不猜测失效。进程退出是启动器已有进程句柄确认的事实，不能由 socket 断开或 stopResult: exiting 代替。

没有自动断线重连或消息重放。CLI／应用重新启动建立新会话，旧 sequence、buildId 和 token 均失效；持久测试资料继续保留。退出取消后保留当前进程与使用中的资源，工具显示实际结果。构建失败留在工具自己的编译流程，未完成目录不发送 buildsReady。

<a id="verification"></a>

## 必须验证的消息边界

纯机制验证覆盖有限帧校验、双向相同 ID、嵌套调用、void 与 null、一次回复、取消／完成竞态、握手前调用、版本不符、迟到旧连接结果与断连释放。端点验证再覆盖真实来源、权限、API 范围、旧宿主代际、旧 Webview document 和资源寿命；类型检查不能证明这些运行边界。

开发连接验证逐字节拆包、合包、非法 UTF-8、零长／超长帧、错误会话、错误 token、未知版本、重复 sequence、同扩展连续构建、候选替代、激活失败及退出取消。所有平台仍须使用实际命名管道或 Unix socket 及真实 Electron 核对；纯编码器样例不计作跨平台运行通过。
