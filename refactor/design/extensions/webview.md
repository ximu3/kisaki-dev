# 扩展页面、私有通信与菜单

宿主管理视图、容器、焦点和释放，扩展负责文档内容与业务。Webview 通过绑定当前视图的私有通道调用所属扩展的 Node 业务；它直接使用的宿主能力限于界面和环境接入。

<a id="container"></a>

## 页面与对话框

独立 page 是稳定导航目标，可以反复直接打开，即使没有必填业务上下文也必须显示有效初始界面。依赖本次输入的临时交互使用 dialog，寿命限定于当前流程。扩展配置使用普通业务界面，以代码实现表单并按相同的 page 或 dialog 合同接入。

document.root 指定扩展包内资源根，entry 指定该根中的 HTML。宿主在登记或打开时校验并授权，不继承 manifest.webviewRoot，也不授予任意用户文件或 data 根访问权。共同文档描述可以通过代码复用。视图关闭会撤销消息通道、资源授权和监听，但不会自动取消已经独立接纳的后台工作。

Webview 使用隔离 iframe、受控来源、sandbox 和会话桥接，不使用 Electron webview 标签，也不向 SDK 公开容器类，见 [Electron Web Embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds)。主应用、官方扩展和模板共用 Solid 与基础 UI；第三方可以使用 Vue、React 或原生前端。SDK 和 appearance 不依赖 Solid。

官方代码表单共用字段组、说明、间距、Toast 和焦点规则，内容层次按实际业务组织。前端可以复用纯校验，Node 在保存时仍需验证。业务结果只由发起界面反馈一次，扩展不能自行推断全局任务或数据库结论。隔离、布局、键盘、浮层、外观和释放都需要在真实环境中验收。

<a id="isolation"></a>

## 来源与原生桥接隔离

每个实际视图取得独立、不可预测的运行期 host，使用 `kisaki-extension://<viewHost>/` 加载已授权 document.root 下的内容。它不与原生界面或其他视图同源，也不以稳定 extensionId 代替运行身份。同一视图的文档刷新保留来源，实际视图替换则撤销旧映射并分配新来源。URL 不承担私有通道的身份认证，接入仍核对[真实 iframe、来源与端口](../engineering/protocols.md#endpoints)。

主进程在 app ready 前登记该协议的 standard、secure、supportFetchAPI 和 corsEnabled 能力；在实际使用的 Session 上处理请求。不得开启 bypassCSP、allowServiceWorkers 或 allowExtensions。路径解析拒绝越界、编码绕过和符号链接逃出已授权根；返回准确 MIME 与 nosniff，不把用户文件、扩展私有 data 或运行期资源当作页面与可执行脚本。协议的注册和 Session 归属遵循 [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol)。

承载窗口启用 sandbox、contextIsolation 和 webSecurity，关闭 nodeIntegration、nodeIntegrationInSubFrames。AppImage 在受限系统上的实际进程隔离遵守[启动兼容政策](../engineering/build.md#appimage-compatibility)，不能仅凭窗口的 sandbox 配置宣称进程沙箱始终存在。原生 preload 只在主 frame 暴露本窗口所需的有限桥接；主进程接入仍校验实际 senderFrame，不能仅凭同一 webContents 接受子 frame。Webview 只取得自己的 SDK MessagePort，不取得 Electron、Node、原生窗口客户端或其他视图的桥接。

iframe 的 sandbox 仅包含 allow-scripts 与 allow-same-origin，不开放弹窗、下载、表单提交、顶层导航或模态权限。保留同源能力的前提是视图来源与宿主真正不同，不能用原生页面同源路径伪装隔离。iframe 不会形成独立 Electron Session；Cookie、代理及浏览器联网见[网络边界](../engineering/network.md#webview)。

<a id="csp"></a>

## 页面、脚本与数据来源

发布制品的 HTML、JavaScript、CSS 和 Worker 来自扩展包。第三方页面可以按标准浏览器规则发起 HTTPS／WSS 数据请求，展示 HTTPS 图片或媒体；远端页面、脚本、样式及 iframe 不进入视图。官方扩展的业务请求、账号与凭据仍在 Node 侧处理。允许联网不会扩大宿主 API 或资源权限。

宿主生成并通过响应头施加 CSP，扩展包不能降低它。下表中的 viewOrigin 是实际视图来源，hostOrigin 是实际原生宿主来源，resourceOrigin 是宿主为该视图分配的唯一 `kisaki-resource://<scope>`；三者均来自宿主绑定，不能由页面传入。父文档自身也限制 frame 来源，不只依赖子文档声明。

| 指令                              | 发布环境规则                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| default-src                       | 'none'                                                         |
| script-src                        | 'self'；不开放内联脚本、eval、Wasm 动态编译、data 或 blob 脚本 |
| style-src                         | 'self' 'unsafe-inline'；允许组件样式，不因此允许脚本           |
| img-src                           | 'self' data: blob: https: resourceOrigin                       |
| font-src                          | 'self' data: resourceOrigin                                    |
| media-src                         | 'self' blob: https: resourceOrigin                             |
| connect-src                       | 'self' https: wss: resourceOrigin                              |
| worker-src                        | 'self'；只加载包内独立 Worker 文件                             |
| frame-src                         | 'self'；嵌套页面仍遵守同一视图范围                             |
| object-src、base-uri、form-action | 'none'                                                         |
| frame-ancestors                   | hostOrigin 和 viewOrigin 的精确来源                            |

资源指令必须列出本视图的精确 resourceOrigin，不能放行整个 kisaki-resource 协议。所有可能作为 Worker 入口的包内脚本响应也施加同一 CSP；不能假定 Worker 自动受创建页面的全部策略约束。资源注册表检查有效绑定、实际内容和撤销状态，有真实 frame 信息的请求再核对该 frame；不能把 webRequest 或客户端提交的 Origin／Referer 当作覆盖所有上下文的唯一授权机制。对应的[资源合同](../domains/resources.md#addresses)继续负责绑定和释放。

浏览器只允许上述来源；HTTP、WS、file、data 页面及其他未列出来源均直接拒绝。包内脚本以独立文件交付，Worker 使用包内文件入口。CSP 与内容校验、业务授权、Node 扩展信任边界各自承担相应职责。

<a id="browser-actions"></a>

## 导航、外部链接与浏览器权限

宿主只允许视图在自己的授权包根中加载页面。同文档路由可以继续使用 history 或 fragment；新文档按[握手规则](../engineering/protocols.md#endpoints)更换 documentId 与端口。宿主发起的加载先验证目标；页面发起的导航与重定向通过 will-frame-navigate、will-redirect 核对实际 frame 和目标，不只监听主 frame 的 will-navigate。setWindowOpenHandler 拒绝自行创建窗口。事件范围以 [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents) 为准，不能假定所有加载都会触发同一种事件。

原生 UI、Node 与 Webview 通过 `ui.openExternal(url: string): Promise<void>` 发起明确的外部链接动作。原生拥有者验证完整 HTTP(S) URL，拒绝带用户名／密码的地址及其他 scheme，再交给系统浏览器。Node 使用 context.ui.openExternal，Webview 使用绑定当前视图的 ui.openExternal。被拒绝的导航、重定向与 window.open 保持拒绝结果，不自动外开或重试业务。

CSP 可能在导航事件前拒绝目标并使文档进入加载失败。宿主应撤销已失效 document 的通道，显示准确的视图加载问题，不能假装旧页面和草稿仍完整可用，也不能直接重放保存操作。正常宿主关闭或离开视图继续走[关闭确认](#closing)；扩展自己重载文档不等于保存。

实际 Session 同时安装 setPermissionCheckHandler 与 setPermissionRequestHandler；Webview 的浏览器权限默认拒绝，未知权限与无法绑定的来源也拒绝，不沿用 Electron 的宽松缺省。相机、麦克风、定位、通知、剪贴板读取、文件系统及设备访问等不因加载扩展页面自动获准；iframe 不额外委托这些权限。原生能力按自己的窗口规则提供，不能以共用 Session 为由一并放开。普通输入控件的用户复制、粘贴与获准读取系统剪贴板的 API 不是同一权限。两类处理器的责任见 [Electron Session](https://www.electronjs.org/docs/latest/api/session)。

<a id="development"></a>

## 开发页面的有限例外

开发视图仍使用各自的运行期来源，由宿主映射到本次开发会话实际登记的 loopback 文档与资源。DevBuild 中的 url 是受控开发来源，不直接作为 iframe 的共享来源；不会为了 HMR 把多个视图合并为一个来源。映射只在对应会话和构建有效时存在，不跟随到任意远端地址，也不暴露全部磁盘文件。

HMR 只额外允许本会话的精确 WebSocket 地址；不放行任意 localhost 端口或关闭 webSecurity。必要的开发注入脚本通过每文档随机 nonce 接入；可使用 Vite 的 [CSP nonce 支持](https://vite.dev/guide/features.html#content-security-policy-csp)，占位值必须在响应时替换，不能把固定 nonce 写入发布包。发布 CSP 不保留开发地址或脚本例外。包内 Worker 响应、资源来源与私有端口仍按上述隔离规则处理。

Worker 授权采用上述资源绑定与响应 CSP，不能仅依赖 webRequest。浏览器行为及该限制的依据见[隔离试件](../../verification/evidence/technical-tradeoffs/2026-10-22/README.md#webview)，完整接入的验收范围见[Webview 场景](../../verification/scenarios/ui.md#webview-isolation)。

<a id="open"></a>

## 视图建立与初始化

```ts
await context.ui.pages.register({
  id: 'account',
  title: 'Account',
  icon: { type: 'mdi', name: 'account-circle' },
  document: {
    root: 'ui',
    entry: 'account.html'
  },
  setup(view) {
    view.ipc.handle('getSettings', () => settings.get())
    view.ipc.handle('saveSettings', (input, context) => settings.save(input, context))
  }
})

const view = await context.ui.pages.open({ pageId: 'account' })
```

page 的 id 在扩展内稳定且唯一。title: LocalizedText 和 icon: UiIcon 必填，共同用于导航、目录和宿主标题。全部登记页面都进入完整导航，侧栏按[共同顺序和常显数量](../ui/navigation.md#sidebar)呈现。内部步骤或 tab 不应分别登记 page，本体页面也不会因此改为 Webview。

setup(view) 在每次实际新建视图时执行，可以省略，也可以返回 `Promise<void>`。它负责挂接私有方法和本视图的 Node 监听。SDK 等 setup 完成后才接入前端业务；失败时释放资源并报告失败，无须作者手工发送 ready。共享账号与后台工作不能绑定到每个页面的生命周期。

open({ pageId }, context) 使用当前扩展归属。在对应窗口已经打开同一页面时，优先聚焦并复用，不重复 setup，也不覆盖表单。其他扩展的公共页面通过导航打开，调用者不会取得其私有句柄。

```ts
const view = await context.ui.dialogs.open({
  title: 'Import entries',
  document: {
    root: 'ui',
    entry: 'import.html'
  },
  setup(view) {
    view.ipc.handle('getImportContext', () => importContext)
    view.ipc.handle('importSelected', (selection, execution) =>
      importer.importSelected(importContext, selection, execution)
    )
  }
})
```

两类 open 都在视图可交互后返回 Node 句柄，不等待全部业务数据、用户关闭或选择完成。dialog 每次独立创建，尺寸与样式使用共同 Dialog 规则。初始数据与后续业务都走私有 IPC。setup 的闭包可以绑定本次 input，不增加容器 input、initialInput 或 view.input。

保存或选择通过 invoke/handle 返回业务结果。成功后需要关闭时，前端等待操作完成，再请求 view.close。open 的结果只表示视图已打开；需要等待用户选择的完整业务，通过私有方法及释放处理管理自己的等待。容器关闭与业务取消分别由各自合同确定，已提交结果继续保留。

<a id="icons"></a>

## UI 图标值

```ts
type UiIcon = { type: 'mdi'; name: string } | { type: 'file'; path: string }
```

mdi 使用应用固定版本图标目录中的名称，file 使用所属扩展包内的 SVG、PNG 等受控资源。MDI 以 SVG 资源按需加载。宿主统一图标槽位、对齐、状态与回退，品牌图片保留自身比例和颜色。是否必须提供图标，由具体贡献合同决定。UiIcon 不接受组件或渲染函数。

运行时 UiIcon 与 manifest、registry 的品牌图标分别使用自己的资源合同。页面、菜单和导航按登记元数据呈现。

<a id="ipc"></a>

## 视图私有请求与通知

| 一侧    | 接口                               | 含义                                                                  |
| ------- | ---------------------------------- | --------------------------------------------------------------------- |
| Node    | view.ipc.handle(name, handler)     | 为本次视图接入一个私有请求方法，handler 接收业务 input 及调用 context |
| Webview | ipc.invoke(name, input?, options?) | 调用已声明方法，返回等待该方法完成的 Promise；options 仅含可选 signal |
| Node    | view.ipc.send(name, payload)       | 向这个视图发送无需应答的私有通知                                      |
| Webview | ipc.on(name, listener)             | 订阅私有通知，返回可释放的订阅                                        |
| Node    | view.onDispose(cleanup)            | 在视图释放时清理扩展为该视图建立的业务监听等资源                      |

```ts
// Node: handlers are attached to this view instance.
view.ipc.handle('getSettings', () => settings.get())
view.ipc.handle('saveSettings', (input, context) => settings.save(input, context))
view.ipc.send('accountChanged', accountSummary)

// Webview: requests await the declared method result.
const current = await ipc.invoke('getSettings')
const saved = await ipc.invoke('saveSettings', draft)
const subscription = ipc.on('accountChanged', updateAccountSummary)
```

扩展通过共享纯 TypeScript 合同声明 input、result 和通知 payload，Node 与前端直接引用这些定义。Node 业务持有实现并负责运行时校验，按需要复用已有校验规则。方法名在本视图内唯一，只在该视图所属 Node 端解析，未登记名称直接拒绝。

invoke 等待该私有方法承诺的操作完成。正常、取消、失败和 partialResult 沿用共同合同，不增加成功包装，也不默认改为后台启动。options 只接受可选 signal。SDK 为 Node 提供本次调用的 signal、关联和就绪处理，作者不管理 requestId，通信也不自动重试。

send/on 在当前视图通道内交付短期、无应答的通知。页面进入或重新打开时主动读取当前快照，后续通知可以提示刷新，其负载由业务定义。业务状态及版本、合并政策归实际业务拥有者。各页面独立监听，可以共用 Node 数据源，并在 onDispose 中释放本页订阅。

实际释放视图时，宿主撤销方法、监听和通道，取消仍依赖页面的读取或预览，并丢弃已无接收方的回复。已经保存的事实保留。独立任务和[登录操作](private-data.md)不能继承页面 signal 作为全程取消条件；页面可以显式启动、观察和取消它们。实例失效遵循[运行合同](runtime.md)。

通信只提供 invoke/handle、send/on 和 Disposable，不提供 Node 任意调用前端对象的双向 invoke、sendSync、Electron event 或全局频道，也不另设 off、removeListener。Node 业务可以薄转发本体操作，也可以组合完整业务，并供页面、菜单和后台共用。页面不能直接取得原始 storage、secret、Node 文件能力或整套领域 API。

<a id="menus"></a>

## 菜单入口与目标快照

ui.menus.add(contextKind, getItems) 只开放下列实际入口，不使用 DOM 或组件路径、when 表达式，也不要求先登记 global command。

| 上下文    | 对应需求与输入                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| extension | 所属扩展详情中的普通操作区或操作菜单，承载连接账号、导入、打开扩展自己的配置界面等操作；归属由宿主确定，没有专门的设置动作类型 |
| entry     | 条目列表、卡片及详情中的对象操作菜单，供扩展同步所选条目等；提供当次非空 EntryRef 集合，覆盖单选与多选                         |

contextKind 不带 .actions。同一 Entry 动作在卡片、表格和详情中共用一次登记。单选也使用含一项的非空 EntryRef 数组，集合可以包含不同类型。菜单打开时固定目标快照，点击后不能重读全局选择。执行主体负责验证真实目标，宿主不替扩展裁剪不适用项。Part、文件、标签和任务不会仅因有 ID 就自动获得菜单挂点。

```ts
context.ui.menus.add('entry', ({ entries }) => {
  if (entries.some((entry) => entry.type !== 'anime')) return []

  return [
    {
      type: 'action',
      label: 'Sync selected entries',
      onSelect: async (execution) => {
        const result = await syncEntries(entries, execution)
        return toToastMessage(result)
      }
    }
  ]
})
```

getItems 接收 signal，可以同步或异步读取构造菜单所需的本地信息。远端读取、写入、授权和同步由用户选中的动作执行。原生菜单独立呈现各扩展的加载、失败或不适用状态。

add 返回可释放的实例句柄。菜单项按本次菜单持有，回调关联不写入配置；只有需要持久选择的贡献才使用稳定 ID。

关闭菜单会取消尚未完成的构造，并释放未采用内容。已经选中的回调拥有独立生命周期，不随菜单关闭取消；实例失效时按真实依赖处理。onSelect 可以调用完整能力、扩展自己的函数或打开视图，不需要设置类特殊标签。后台也可以直接复用业务函数，无须绕经菜单。

<a id="menu-values"></a>

## 菜单节点与结果反馈

action、checkbox、radio 和 submenu 共用 label: LocalizedText，以及可选 icon、disabled。separator 只有 type。所有回调留在 Node。

| type      | 专属字段与回调                                       | 含义                     |
| --------- | ---------------------------------------------------- | ------------------------ |
| action    | onSelect(execution)                                  | 执行所选动作             |
| checkbox  | checked: boolean；onChange(nextChecked, execution)   | 把下一状态交给业务拥有者 |
| radio     | group: string；checked: boolean；onSelect(execution) | 选择所属组中的这一项     |
| separator | 无                                                   | 分隔内容                 |
| submenu   | items: MenuItem[]                                    | 承载子菜单               |

radio.group 只在同一贡献的同级 items 中有效，不跨子菜单或扩展。同组最多一项 checked，也可以没有选中项；再次选择已选项不触发回调。checkbox 按本次快照传入 nextChecked，由业务核对并保存。失败时不能显示成已保存新状态，下次 getItems 重新读取实际值。

getItems(menuContext, { signal }) 与叶子回调的 execution 分开。execution 包含适用的 signal 和 allowInteraction，关闭菜单不取消已经选中的操作。

叶子回调可以同步或异步返回 void，或至多一条 ToastMessage。底层业务仍返回自己的结果，UI 描述不进入领域结果或任务。

```ts
interface ToastMessage {
  type: 'info' | 'success' | 'warning' | 'error'
  title: LocalizedText
  description?: LocalizedText
}
```

提示和错误由发起窗口按业务结果显示，取消作为正常结束处理。Node 菜单回调通过所属业务返回结果，前端负责本次反馈。明确交给后台负责的操作由后台通知完成，各渠道共用同一反馈归属；原窗口失效时按既定归属结束提示。复杂进度使用已有任务或业务界面。

<a id="toast"></a>

## Webview 局部提示

ui.toast.show(message, { persistent? }) 返回可以 update(message) 和 dismiss() 的句柄。默认持续时间与应用一致，persistent 提示保留到用户关闭或 owner 结束。消息不包含业务回调、进度、任意组件或任务结果。

表单校验维持一条 persistent 提示并更新内容，字段错误状态独立保存。用户关闭提示不会清除字段错误，普通输入也不会让已经关闭的提示重新出现；后续主动提交可以再次提示。表单的短期 owner 结束时 dismiss，页面释放时清理本页全部提示。行为遵循共同 [Toast 规则](../ui/components.md#validation)，菜单返回的提示不自定义生命周期。

<a id="closing"></a>

## 关闭确认与实际释放

view.close 只发出关闭请求，view.onDispose 才表示实际释放。宿主 Dialog 的可选关闭确认是唯一行为实现。扩展 Webview 通过 view.setCloseGuard(handler) 接入本视图业务状态；handler 返回 boolean 或 `Promise<boolean>`，true 允许关闭，false 保留视图。调用 view.setCloseGuard(undefined) 清除处理者，undefined 不是回调的合法返回值。每个视图只有一个处理者，不组成处理链。

Webview 内部自行创建的 Dialog 直接使用组件属性，无须经过 SDK。ui.dialogs.open 的宿主 Dialog 是另一实例，内部草稿或组件属性不会自动保护外部容器。SDK 只连接宿主关闭回调及允许、拒绝结果，UI 包不依赖 SDK。私有业务提交仍使用 invoke/handle，关闭成功不能代替保存成功。

关闭按钮、Escape、允许的遮罩点击、导航离开、普通窗口退出和 Node close 都经过同一宿主协调。等待期间合并重复请求。拒绝或失败时保留视图并按共同规则反馈；如果关闭前需要保存，必须等保存真正完成后才允许关闭。页面卸载不能意外破坏仍然有效的窗口交互。强制销毁或实例失效时无法保证互动，扩展也不能通过私有方法绕过宿主直接销毁容器。

撤销登记后，新调用不能再选用该实现，已经接纳的调用保持原绑定。真实实例结束时清理其依赖。关闭状态和视图句柄不另建持久表。
