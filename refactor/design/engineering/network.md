# 宿主 HTTP 与网络设置

主进程的 infrastructure/network 使用 Electron net 和 Chromium 网络栈执行宿主请求，负责 Session、应用代理、请求归属和资源释放。扩展 Node 通过 context.network.fetch 使用该环境，扩展自身负责来源账号和响应含义。

<a id="ownership"></a>

## 执行与接入边界

network 通过公开的 net.request 实现 HTTP 能力。本体以异步接口调用，Node SDK 通过 RPC 传递请求值和正文流；extension-host 不依赖 Electron 或主进程私有实现。官方扩展使用同一入口。第三方扩展自行创建 Node 网络客户端时，由作者负责其网络设置，宿主代理不会自动覆盖这些流量。

原生认证、重定向事件和流控制集中在 network 内部。公开接口不暴露 ClientRequest 或 Session，不使用 Electron 私有 API，也不改写来源的 Cookie 或 Authorization。

跨进程传输分别处理请求体、响应元信息和正文流，并保障背压、取消、断连和扩展实例释放。各端根据合同建立标准对象，不能直接序列化 Response 或 ReadableStream。集成测试需要检查状态变化、吞吐、内存和 IPC 开销。

electron-updater 等下载组件通过 netSession 等公开入口采用应用网络设置，同时保留各自的下载、校验和安装流程。来源令牌刷新、Cookie 管理、provider 缓存、业务重试和通知由对应业务模块负责。

<a id="webview"></a>

## Webview 浏览器请求

第三方 Webview 的 fetch、XHR、WebSocket 和媒体读取由浏览器执行，按照[页面 CSP](../extensions/webview.md#csp)允许 HTTPS／WSS 数据来源。它们不经过 context.network.fetch，不取得其自定义请求头、正文流或账号接口。官方扩展的业务请求、账号与凭据继续归 Node 业务所有。

iframe 共用承载窗口的实际 Electron Session；独立 origin 隔离浏览器来源，Cookie 仓库和代理环境仍由 Session 决定。窗口拥有者将实际使用的 renderer Session 接入 network 的应用代理采用流程。宿主 HTTP 按本页的无自动 Cookie 规则运行，浏览器请求遵守标准 CORS、credentials、第三方 Cookie 与存储策略；两者分别管理账号状态。Webview 浏览器存储只用于该浏览器上下文，官方账号与凭据使用各自的正式存储入口。webSecurity 保持启用。

网络偏好变化须覆盖这些实际 Session，并通过真实 HTTP／WSS 连接验证旧连接退出、新配置采用和采用失败时拒绝继续联网。验证同时覆盖宿主 HTTP 与浏览器请求；采用失败时保持未就绪状态。用户通过外部链接打开的系统浏览器自行管理网络与账号。

<a id="options"></a>

## 请求与响应

```ts
fetch(
  url: string | URL,
  options?: NetworkFetchOptions
): Promise<NetworkResponse>

interface NetworkFetchOptions {
  method?: string
  headers?: HeadersInit
  body?: BodyInit | null
  signal?: AbortSignal
  redirect?: 'follow' | 'error'
}
```

url 接受 HTTP 或 HTTPS 地址，使用字符串或 URL 对象。默认方法为 GET，默认重定向行为为 follow；body 按显式 method 发送。调用方负责正文编码，代理由应用统一设置，选项限于上列字段。

network 不在失败或结果未知后自行重新发起请求。需要业务重试的调用方按所属操作的规则处理；HTTP 协议层的连接与接续行为沿用 Chromium 网络栈。

请求体支持常用文本、字节、表单和流，复用标准编码能力。流跨进程传输时维持背压，不先把完整正文读入内存再放进单次 IPC。

NetworkResponse 提供 url、redirected、status、statusText、ok、headers、body 和 bodyUsed，以及 text、json、arrayBuffer、bytes、blob、formData 读取方法。headers 使用标准 Headers 语义；多条 Set-Cookie 保留原始值，不合并后再猜测拆分。body 为 `ReadableStream<Uint8Array>` 或 null，ok 只根据 HTTP 状态计算。

响应正文只消费一次，接口不提供 response.clone，也不承诺返回原生 Response 实例。调用者可以复用已读出的值，或使用标准流的 tee 能力。对需要 typeof fetch 的第三方库，只在实际语义相容时适配，不承诺支持任意 Request 或 Response 消费者。

取得响应头后，fetch 返回可读取的响应资源。返回前取消使调用失败；返回后取消使尚未完成的正文读取失败，已经读出的内容保留。调用者结束读取时通过正文流的取消操作释放资源。未结束的请求和响应绑定到实际调用及所属扩展实例。

<a id="policy"></a>

## 代理采用与传输失败

代理模式为 system、direct 或 manual，默认使用 system。选择值及凭据由 [preferences](../domains/preferences.md#network) 保存，network 订阅并采用这些偏好。配置结构合法表示可以开始采用，连接和认证结果由实际请求确定。

偏好保存后，network 采用新设置并重建受影响的连接。这一步可以中断在途请求；新请求等待新配置就绪，已中断请求不自动重放。采用失败时保留用户选择并报告网络未就绪，不能偷偷沿用旧代理或改为直连。system 模式允许的直连行为按系统设置执行。

setProxy 返回不代表所有既有连接都已切换，接入必须验证实际连接行为。HTTP 错误状态仍作为正常响应交给业务处理；连接、TLS、超时等传输失败则报告网络错误。响应提供准确的最终地址，供 registry 等业务解析相对资源。

取消、断连或扩展实例退出时，network 清理仍依赖该调用的请求及未消费正文流。业务数据缓存和用户通知仍由调用方负责。

<a id="cookies-and-redirects"></a>

## Cookie、认证与重定向

宿主请求不自动读取或保存 Session Cookie。扩展明确提供来源 Cookie 和 Authorization，取得完整 Set-Cookie 后按自己的账号规则保存；需要持久化的凭据进入 secrets。Session 只承担网络技术设置和代理认证，不管理扩展来源账号。

支持的代理协议和认证方式统一定义在[网络偏好](../domains/preferences.md#network)。network 按这些固定规则校验配置，并通过公开底层接口执行。无效配置在保存前拒绝；连接或认证失败时报告实际错误，保留用户选择，不改用另一协议或直连。来源认证由扩展解释响应并执行，不与代理认证混为一套登录流程。

重定向支持 follow 和 error，默认跟随。调用方一次提交 URL 和选项，主进程通过公开原生接口同步执行重定向策略。逐跳事件仅供观察，控制决定在事件返回前完成。

携带来源凭据的业务请求使用 `redirect: 'error'`，将凭据限定于本次指定端点；公开资源读取可以跟随重定向。来源适配负责选择请求选项，network 执行该选项，不推断账号或改写凭据。

Cookie 行为、代理认证、最终 URL、多值响应头和增量上传都在 network 内通过 net.request 的公开能力实现。不得接纳相互冲突的会话选项后暗中覆盖，也不通过截取并重写 Cookie 修补行为。

在锁定的 Electron 版本中，实际验证代理和认证、重定向、流背压、取消、断连、Cookie 及最终 URL。失败不能通过切换另一套网络栈兜底。
