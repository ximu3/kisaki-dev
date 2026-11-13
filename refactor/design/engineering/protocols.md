# 通信帧、版本与开发握手

desktop-rpc 为窗口、扩展和开发控制提供统一调用机制，各端点维护自己的协议版本、身份与资源寿命。业务输入、完成条件、取消和安全失败沿用[通信合同](../communication.md)，业务重试由所属操作决定。

<a id="versions"></a>

## 分开判断的版本

| 版本                             | 定义与核对方式                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| desktop-rpc wireVersion          | desktop-rpc 拥有，值为 1；帧字段和请求关联规则变化时更新。双方只接纳自己实现的版本，不协商回退                      |
| 接入 protocolVersion             | 各端点协议拥有，首版为 1；表示该端点的握手、消息目录及资源适配。不能用 npm 包版本替代                               |
| extension API version            | extension-sdk 纯合同拥有的 SemVer；核对 manifest.apiVersionRange，不等于桌面版本、SDK 版本或 wireVersion            |
| manifest／registry schemaVersion | extension-distribution 拥有的文档格式；在读取对应文档时验证，不与 RPC 帧合并                                        |
| desktop buildId                  | 同一制品主进程、preload、原生 renderer 和 extension-host 的构建标识；私有同版本端点必须一致，防止旧资源接入新主进程 |
| development protocolVersion      | desktop-contracts/development 拥有，首版为 1；父子消息及构建交接使用独立版本，不以工具 npm 版本猜兼容               |

有限构建的 buildId 是该次程序组的独立标识；源码开发使用会话构建标识，进程和读取目录仍分别绑定实际运行代际。缓存键与发行来源按各自工程职责记录。

同一个 API 范围内，SDK 可以独立发布；符合范围并且接入协议受支持才可以建立能力。未知主版本、缺少必要声明或不满足范围时，在开放调用前明确拒绝。已经安装的扩展保留包、私有数据和用户启用意愿，只停止不兼容实例的加载。新增接口不自动向已有端点开放，接入方法表继续逐项选择。

各包显式导出自己拥有的版本常量；构建不得读取另一个包的私有源码推算它。变更行为、错误分支、公开消息或值形状时，同时复核 API 兼容与对应协议版本；纯内部重排不机械提升所有版本。

<a id="frames"></a>

## desktop-rpc 的有限帧

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

JsonValue 由 desktop-rpc 的纯值模块定义。error 在通用帧层是待交付的值，各端点使用自己的安全失败解析器；本体与 SDK 对外调用必须解析为 ErrorSummary／ExecutionFailure，不能把任意对象当成可展示异常。desktop-rpc 不导入 desktop-contracts，不解析 partialResult 的业务结构。

创建连接时确定发起方与接纳方。发起方先发送 hello；接纳方核对版本、协议与实际绑定上下文后，只回复一次 accepted 或 rejected。成功前不允许 request、notify 或资源登记。未知 wireVersion 可以读取最小 hello 信封后以 ProtocolMismatch 拒绝，不先解释未知版本的业务部分。建立传输后十秒内未完成握手则关闭并报告连接失败；这项上限只用于握手，不限制激活、迁移或业务执行时间。

protocol.id 区分 `kisaki.window`、`kisaki.extension-node`、`kisaki.extension-webview`、`kisaki.extension-host` 与 `kisaki.development`。这些字符串与对应 protocolVersion 属于各端点合同，desktop-rpc 本身保持环境与产品无关。context 的值也由端点定义，纯机制不根据客户端自报身份授予权限。

成功后的调用规则如下：

- 请求 ID 是本连接、当前发送方向内从 1 递增的安全整数。双方可同时发送相同数字，关联表按方向分别管理；ID 不跨重连复用为业务身份，不持久保存。达到安全整数上限时先停止接纳并有序关闭，不回绕。
- request.method 只能命中此端点显式开放的表项。不存在的方法按 InvalidInput 拒绝该请求；没有权限的方法按 PermissionDenied 拒绝。参数由该方法所属纯合同解析，不能动态访问任意对象路径。
- 每个请求只交付一次 success 或 failure。success 省略 value 表示 void；`value: null` 保留真实 null。失败必须经过安全序列化，客户端恢复可识别错误后拒绝 Promise。
- notify 不产生回复，只承载已定义主题。订阅建立、释放及资源登记是有回复的明确控制调用，不能依赖无法确认的通知完成必要写入。通知处理失败由消费者拥有边界记录，不让发送方误以为它参与了原业务事务。
- cancel 只指向该方向原请求，表示请求停止；不立即伪造 Cancelled 回复。实际执行者按业务规则完成提交或收尾，再发送真实结果。请求已经完成时，迟到 cancel 无效果。观察取消仅停止观察，独立接纳的工作按自身寿命继续。
- 请求处理不得全局串行等待；双向嵌套请求和异步回调仍可推进。业务需要串行时，由其真实资源拥有者安排，不以阻塞消息泵实现。

收到重复／倒退 request ID、未知帧类型或非法形状时以 ProtocolViolation 关闭连接。已经分配且结束的回复可以忽略；大于本端已分配 ID 的回复属于非法关联。迟到结果不能进入下一条连接，重连必须重新握手，重新建立真实订阅和资源。

传输关闭时清理待回复、监听、回调与资源映射；仍等待结果的调用以 ConnectionClosed 结束。断连不能证明远端停止、提交失败或回滚，调用方不得重放写入。接纳方按业务寿命取消依赖该连接的工作、保留独立工作；既成结果与必要资源清理由实际拥有者负责。

协议由本节的有限帧定义，内核统一负责接入、版本、严格帧校验、请求关联、按调用取消和断连清理。业务结果、身份权限、重试和宿主流程由相应拥有者处理。完整行为按下方消息边界验证。

<a id="endpoints"></a>

## 各端点的握手与身份

| 端点                | hello.context             | 接纳依据与 accepted.context                                                                                                                             |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 原生窗口            | `{ buildId, windowKind }` | 主进程已绑定的实际 webContents、preload 和窗口种类；校验 buildId 与种类后返回 `{ buildId }`。业务调用不再自报窗口 ID                                    |
| 私有 extension-host | `{ buildId, generation }` | 主进程本次实际启动的进程、专属端口及预期 generation；返回同一 `{ buildId, generation }`。generation 是运行代际，不是持久扩展身份                        |
| SDK Node 接入       | `{ apiVersionRange }`     | 宿主创建 context 时绑定的扩展实例、经过验证的 manifest 范围与此 SDK 支持范围共同成立；返回 `{ apiVersion, instanceId }`。SDK 不选择另一个扩展实例       |
| SDK Webview 接入    | `{ apiVersionRange }`     | 本次 document 的实际 MessagePort、宿主视图和所绑定 Node 实例；返回 `{ apiVersion, instanceId, viewId, documentId }`。URL 或消息中的名称不能替代端口绑定 |
| 开发控制            | `{}`                      | 实际启动的 ChildProcess 与父子 IPC；应用返回 `{ appVersion, buildId }`，就绪通知再交付实际 API 版本                                                     |

SDK 支持范围由发行时的公开协议常量声明，manifest 范围仍由应用独立验证；不能用 SDK 自报范围代替作者声明。私有端点 buildId 不符为 ProtocolMismatch，公开 API 范围不符为 ApiIncompatible，旧实例接入为 InstanceExpired，来源或开放范围不合法为 PermissionDenied。错误只包含可展示的安全原因，不回显凭据、端口对象或任意来信。

Webview 新 document 使用新 documentId 与端口。普通 HMR 没有更换 document 时可以保留该连接；文档刷新必须重新握手并释放旧请求与监听。Node 实例未变化时不重复业务 setup，宿主替换 Node 实例时旧句柄全部失效，再按[页面生命周期](../extensions/runtime.md)建立新视图。

MessagePort 的引导交接由真实浏览器适配层核对 iframe/source/origin 与一次性接入凭据。可信绑定建立后，后续帧只认该端口，hello.context 用于检查已绑定上下文的一致性。接入凭据仅供此次交接使用，禁止放入可回看的导航 URL 或日志。

真实来源与资源边界按[Webview 容器](../extensions/webview.md#isolation)建立。接入层从已登记协议与规范化 host 构造预期来源，再与 Chromium 的真实浏览器消息核对；Node URL 对自定义协议的 origin 结果只适用于其自身解析环境。CSP、权限或加载失败使 document 失效时，接入层释放旧连接及其可调用资源。

<a id="development"></a>

## CLI 与开发应用的控制合同

desktop-contracts/development 拥有开发方法、通知、值与协议版本，desktop-rpc 提供共同调用机制，Node 父子 IPC 提供实际传输。该端点只服务[开发工作流](../extensions/development.md#connection)。

唯一启动器通过 child_process.spawn 直接创建应用，stdio 配置一个 ipc 项并使用 JSON 序列化。源码开发运行项目 Electron 和完成的 main 入口，作者开发运行所选应用的真实可执行文件。macOS 使用 bundle 内的可执行文件，Linux 使用实际应用或 AppImage，启动器持续拥有该进程。

启动器传入 `--development` 和 `--profile=<绝对路径>`。应用在建立数据库、日志与浏览器 Session 前确定资料范围，并核对本次父子 IPC。正式包从正常入口接入并保留生产 fuses；普通启动遵守安装与便携规则。源码自动化可以单独指定隔离 profile，renderer-url 和窗口选择只用于源码运行。

Node 消息承载完整 RpcFrame，实际 ChildProcess 与 IPC 连接绑定开发身份。启动器发起 `kisaki.development` 握手，应用接纳后返回自己的 appVersion 与 buildId；开发 protocolVersion 由 development 合同独立维护。共同握手、请求关联、错误与断连规则沿用本页 RPC 合同，资源和构建字节通过目录交接。

| 接口           | 方向与形式          | 输入和完成语义                                                                                  |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| ready          | 应用 → 工具，通知   | `{ appVersion, apiVersion, buildId }`；实际初始化完成                                           |
| adoptBuilds    | 工具 → 应用，调用   | 接收完整的 `DevelopmentBuild[]`，返回本批真实采用与激活结果                                     |
| buildsReleased | 应用 → 工具，通知   | `{ builds: { extensionId, buildId }[] }`；对应构建已无读取者                                    |
| stop           | 启动器 → 应用，调用 | 请求正常退出，返回 `{ outcome: 'exiting' \| 'cancelled' \| 'failed', error? }`；failed 携带错误 |
| exiting        | 应用 → 工具，通知   | 普通界面退出已完成必要决定与收尾，即将结束进程                                                  |
| failed         | 应用 → 工具，通知   | `{ error: ErrorSummary }`；初始化或开发会话无法继续                                             |

客户端在建立连接时登记通知处理。ready 等待实际启动完成；apiVersion 表达实际扩展运行能力，尚未提供时为 null。工具在提交构建前核对能力和兼容范围，应用只接纳自己具备运行条件的构建。启动预算由具体启动环境决定，业务与用户退出选择遵守自己的等待规则。

DevelopmentBuild 为 `{ extensionId, buildId, rootPath, webviews }`。buildId 是本连接内该扩展递增的正安全整数，关联临时构建及释放；rootPath 指向已经完成且保持不变的绝对目录。应用读取并核对 manifest、入口、身份、兼容与运行条件。安装包签名与字节校验由正式安装流程拥有。

webviews 为 `{ document, url }[]`，映射仅使用本会话拥有的 loopback 开发服务器和明确文档。来源与资源范围沿[每视图开发规则](../extensions/webview.md#development)建立。

同一连接只接纳一批正在采用的构建。工具维护尚未提交的最新集合，每个扩展保留最新完整结果；当前调用结束后再提交下一批。应用执行已经固定的批次和共享宿主重建。尚未提交的候选由工具替换与清理，已提交的构建等待自己的实际结果。

```ts
type DevelopmentBuildResult =
  | { extensionId: string; buildId: number; outcome: 'adopted' }
  | { extensionId: string; buildId: number; outcome: 'notAdopted'; error: ErrorSummary }

type DevelopmentActivationResult =
  | { extensionId: string; instanceId: string; outcome: 'activated' }
  | { extensionId: string; outcome: 'failed'; error: ErrorSummary }

type DevelopmentAdoptionResult = {
  builds: readonly DevelopmentBuildResult[]
  activations: readonly DevelopmentActivationResult[]
} & ({ outcome: 'completed' } | { outcome: 'interrupted'; error: ErrorSummary })
```

adoptBuilds 返回一次实际结果。completed 按输入交付每项结果，interrupted 保留已确定的构建结果和已尝试的激活；缺项保持未知。共享宿主重建涉及的其他扩展也列出实际激活结果。采用与激活分别判断，Node send 回调只确认传输交接。

stop 的重复调用共享当前等待，取消后可以再次请求。应用先完成窗口关闭决定，再释放宿主和运行资源。退出被取消时，工具保留编译监听、服务器、进程与现用构建。启动准备取消与运行期正常停止分别处理。

目录清理依据 buildsReleased，或应用与相关读取进程已经实际结束。启动器观察 ChildProcess 的 exit，并收尾自身日志流；连接状态和退出通知分别保留其真实含义。读取者状态尚不明确时，保留目录并报告。连接丢失终止后续交接，应用请求正常退出；退出被取消时保留应用和目录，并报告会话连接已经失效。开发者明确请求的强制结束只处理本会话进程。新启动建立新连接与临时构建身份，持久 profile 继续保留。

<a id="verification"></a>

## 必须验证的消息边界

纯机制验证覆盖有限帧校验、双向相同 ID、嵌套调用、void 与 null、一次回复、取消／完成竞态、握手前调用、版本不符、迟到旧连接结果与断连释放。端点验证再覆盖真实来源、权限、API 范围、旧宿主代际、旧 Webview document 和资源寿命；类型检查不能证明这些运行边界。

开发连接验证未知版本、非法消息、就绪前操作、重复在途批次、同扩展连续构建、工具侧候选替换、真实采用与激活失败、目录释放、退出取消后继续开发，以及断连与实际退出的区别。源码与打包应用都使用真实 Electron 父子 IPC 核对；Windows、macOS 与 Linux 的实际可执行文件及 AppImage 分别记录平台证据，单平台试件不能代替其余目标。
