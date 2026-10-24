# oauth-relay 公共协议

本页定义服务的公开 HTTP 合同与短期会话规则。provider 的实际能力、编码与传输见[上游适配](providers.md)。

<a id="authorization"></a>

## 授权流程

保留接入前缀 /{application}/{provider} 和 GET /authorize、GET /callback、POST /token。authorization_code 与 refresh_token 仍由 grant_type 区分。client_id 使用上游实际登记值；配置匹配只说明参数符合接入登记，不能作为调用者身份认证。

authorize 首先校验 application/provider、client_id、客户端 redirect_uri、scope、state 和 S256 challenge。全部本地校验通过且有可用容量后，才创建短期会话，生成独立的上游 state，并用该接入登记的 relay HTTPS 回调构造授权地址。客户端 state 原样保留在会话中，不将其复用为上游关联值。

客户端到 relay 的 S256 校验，与 relay 到上游的 PKCE 是两段能力。前者按已经确认的服务合同执行；后者由 provider 明确声明并验证。上游支持适用的 S256 时，可以沿本次流程传递对应 challenge 和兑换 verifier；兼容方式由具体来源确定。不能把 relay 的 S256 支持宣传为所有上游都已经提供同等保护，也不能在失败后自动降级。

上游 code 与本次上游授权请求的绑定按来源分别核实。relay 校验自己的 challenge，并不能自动证明上游 code 属于该请求；现有受控对照与[真实来源核验](providers.md#upstream-binding)已经明确这一差异。[RFC 9700 的授权码注入分析](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.5)作为核对依据。若要求当前来源尚未提供的强制上游绑定，应先回到能力与支持约定的讨论，不能在实现中悄悄增加第二种授权码或宣称已有同等保护。

callback 通过内部 state 找到会话，再核对路径中的应用与来源、阶段、有效期以及上游结果。成功后把原始上游 code 关联到该会话，交付给原客户端回调，并带回原客户端 state。relay 不另发自己的 code。拒绝授权等已关联的失败也返回同一个客户端上下文；未知或失效会话没有可信回调地址，只在 relay 显示安全失败结果。

同一回调只能被接纳一次。重复、跨来源、迟到或已结束的回调不能覆盖结果或影响另一项授权。为 token 请求建立的 code 查找索引与上游 state 索引同属 sessions，指向同一会话；可以使用 code 摘要进行内存索引，但不生成对外的新凭据或持久身份。

同一接入下已经归属某个有效会话的 code 索引不能被另一回调覆盖或重新绑定。索引约束保护本服务已接纳的关联，不能代替上游对授权请求的绑定。

token 的 authorization_code 请求核对 application/provider、client_id、原客户端 redirect_uri、code、code_verifier、有效期和待交换阶段。所有校验通过后，sessions 原子领取本次交换，再向上游发出请求。领取与阶段改变必须在首次上游异步调用前完成；并发或重复请求只有一次能够向上游兑换。错误 verifier 或其他无效参数不得消费正常会话。

向上游兑换时使用该接入的应用秘密与已登记 relay 回调，不能把客户端 loopback 地址作为上游 redirect_uri。开始上游交换后，无论成功、明确失败还是结果不确定，都不自动重放这次交换，也不重新开放领取。结束后释放会话及索引；客户端没有可靠取得结果时重新授权，已有有效凭据按客户端合同保留。

<a id="sessions"></a>

## 短期状态与刷新

会话只经历等待回调、等待交换和交换中的实际阶段，完成、拒绝或到期后清理。默认授权窗口为 10 分钟；收到 code 后进一步受来源的短期交换窗口约束，不能重新获得完整的授权等待时长。本地期限只限制服务允许处理的时间，不承诺上游 code 一定仍然有效。

sessions 对会话数量、每次输入长度及整体占用设置明确上限，并拥有到期清理和索引一致性。容量不足时拒绝新的授权，不静默丢弃正在进行的有效会话。它不保存完整上游响应、用户令牌或授权历史。进程重启后未完成授权失效，不恢复旧 state 或未完成交换。

客户端主动取消属于客户端操作：停止等待、关闭 loopback 并拒绝迟到结果。既有三端点协议没有远程取消入口，因此不能声称关闭客户端窗口会立即删除 relay 的会话；服务中的短期状态按结束或到期回收。本地取消、上游用户拒绝和服务重启分别验证。

refresh_token 请求直接使用客户端交来的原始上游 refresh_token 和当前接入配置，不依赖以前的登录会话，也不要求重启后重新登录。relay 不按用户、token 或账号建立长期绑定，正常刷新也不写回服务配置。同一连接的刷新合并与新凭据原子采用由客户端拥有。

响应保留 access_token、refresh_token、token_type、expires_in、scope 及真实上游扩展字段的含义。来源未返回 refresh_token 时保留缺失状态，不由 relay 复制旧值或制造新值。未知传输结果不自动重试，429 不解释为授权失效；错误分类依靠明确类型和原因，不匹配英文错误文案。

<a id="configuration"></a>

## 配置与 HTTP 边界

config.example.json 保存无秘密的结构示例。真实配置从明确路径加载，秘密通过显式环境变量引用取得。启动时校验引用、provider、client_id、scope、回调和限制参数；缺失或不一致使启动失败。进程使用此次启动固定的配置，配置变更在重新启动后生效。

固定 HTTPS 或 custom scheme 回调按登记的完整 URI 匹配。loopback 规则明确允许的回环 IP、路径与动态端口；只放开规定的端口差异，不使用任意主机、路径前缀或字符串 contains 匹配。Kisaki 使用 loopback，独立服务的其他消费者按各自登记方式处理。实际 token 请求还必须与本次 authorize 接纳的客户端 redirect_uri 一致。

relay 的公开 HTTPS 地址与上游回调来自可信部署配置，不从用户请求的 Host 或任意转发头推导。若反向代理提供客户端地址，须明确可信代理边界后才能据此限流。浏览器消费者确需 CORS 时单独登记允许来源；回调登记和 client_id 都不能代替调用者认证。

app 和 transport 分别限制入站输入与出站响应，并使用实际可取消的上游请求和有界并发；HTTP 超时回复不能留下无限运行的后台交换。authorization_code、刷新或其他可能产生上游状态变化的请求不自动重试。错误回复保留协议分类和必要上下文，不原样回显上游 HTML、响应正文或系统错误。

授权和 token 回复禁止缓存，回调与错误页使用本地资源，避免将查询参数带往第三方。应用日志与代理访问日志仅记录应用／来源、操作阶段、结果分类及必要运行关联；code、state、verifier、token、秘密及完整含参 URL 均禁止写入日志。

<a id="http"></a>

## 公开端点与编码

业务前缀为 /{application}/{provider}，分别选择已配置的应用接入和已登记的来源实现。未知接入返回 404，用户授权由所选来源流程完成。公开服务只接受 HTTPS；HTTP loopback 仅用于客户端回调和本地受控试件。

| 端点               | 输入                                               | 成功结果                                                               |
| ------------------ | -------------------------------------------------- | ---------------------------------------------------------------------- |
| GET /authorize     | 查询参数中的授权请求                               | 302 跳转到固定上游授权端点                                             |
| GET /callback      | 上游查询参数中的 state 与 code 或 error            | 302 回到已接纳的客户端 URI，带原始 code 或安全错误，以及原客户端 state |
| POST /token        | 表单中的 authorization_code 或 refresh_token grant | 200，保留上游字段含义的 JSON 对象                                      |
| POST /revoke       | client_id、token，可选 token_type_hint             | 上游确认处理后返回 200 空响应；不保存撤销历史                          |
| POST /token-status | client_id、access_token                            | 200，上游提供的令牌信息 JSON；不另造统一 active 或 userId              |

POST 统一使用 application/x-www-form-urlencoded、UTF-8。撤销与令牌状态路径只开放 provider 有依据的实际能力；不支持时返回 unsupported_operation。客户端不向 relay 提交 client_secret，也不通过 Authorization 头选择另一套应用认证方式。

协议参数按单值解释，重复的已定义参数明确失败，不能一边采用第一个、一边向上游发送最后一个。未知参数不转发；provider 专属参数必须在其明确的输入清单中。提交上游端点、client_secret、秘密引用或上游回调覆盖值时返回 invalid_request；调用方请求头也不复制到上游。POST 不接收查询字符串里的令牌或同名参数，避免正文与 URL 竞争。

令牌与错误结果带 Cache-Control:no-store 和 Pragma:no-cache。浏览器跳转及回调另带 Referrer-Policy:no-referrer；需要停留在 relay 的错误页采用静态内容，不嵌入远端说明、查询串或外部资源。响应大小限制按解压后的实际读取字节执行，不只相信 Content-Length。

<a id="parameters"></a>

## 授权与令牌参数

| 请求                      | 必需参数                                                                                       | 可选参数与含义                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| authorize                 | response_type=code、client_id、redirect_uri、state、code_challenge、code_challenge_method=S256 | scope：空格分隔的已允许子集；省略采用 defaultScopes，明确空值不替换成默认值    |
| callback 成功             | state、非空 code                                                                               | provider 已定义的响应字段；如有发行者信息，核对实际来源，不转作客户端 state    |
| callback 失败             | state、非空 error                                                                              | 上游说明只供安全分类，不原样转交；code 与 error 同时存在则拒绝                 |
| token：authorization_code | grant_type、client_id、code、原 redirect_uri、code_verifier                                    | 无隐含授权会话选择，也不从 Cookie 寻找 code                                    |
| token：refresh_token      | grant_type、client_id、refresh_token                                                           | 不接收旧授权会话、code_verifier 或替代上游回调；不通过刷新扩大权限             |
| revoke                    | client_id、token                                                                               | token_type_hint 仅接受 access_token 或 refresh_token，按实际 provider 能力使用 |
| token-status              | client_id、access_token                                                                        | 查询该令牌在来源中的原生状态信息                                               |

client_id 始终是上游实际登记值，按当前 application/provider 核对。匹配成功只说明接入参数一致。scope 名称区分大小写，去掉重复项后按集合核对允许范围；无细分权限的来源不接受虚构的 read-only scope，空 scope 也不表示令牌只读。

verifier 遵守 RFC 7636 的 43–128 字符与 unreserved 字符规则；S256 challenge 为 SHA-256 的无填充 base64url 编码。客户端为每次授权生成独立 verifier 和高熵 state，relay 另生成自己的随机上游 state；二者各自关联原来的那一段交接。[PKCE 定义](https://www.rfc-editor.org/rfc/rfc7636.html)

application、client_id、回调和 state 尚未建立可信关联时，错误直接在 relay 返回，不跳向请求提供的地址。已核对这些字段后，权限、授权参数或容量错误可以沿该已登记回调返回 error、reason 和原 state，使客户端结束本次等待。未知、失效或重复的上游 callback 没有可用会话时，只在 relay 结束；不能补造客户端地址。

Google 适配另接受 prompt 与 nonce。prompt 接受 none、consent、select_account；none 单独使用，后两者可以按空格组合，省略则不向上游填入默认 prompt。nonce 为非空字符串，仅在请求含 openid 时传递，由调用方保留并校验返回的 ID token。其他 provider 不接纳这两个参数。access_type 与 include_granted_scopes 由接入配置明确指定，不在 relay 内推断账号用途或自动扩大所请求范围。

<a id="errors"></a>

## 错误归属与执行结果

直接 HTTP 失败使用以下结构；error 与 reason 是稳定机器字段，error_description 使用服务自己的安全英文，仅用于说明，不供程序分支。可信客户端的失败回调采用同名查询字段并带回 state。

```json
{
  "error": "invalid_grant",
  "reason": "session_unavailable",
  "error_description": "The authorization session is no longer available."
}
```

| 情形                                 | HTTP 状态 | error / reason                                                   |
| ------------------------------------ | --------- | ---------------------------------------------------------------- |
| 接入不存在                           | 404       | invalid_request / registration_not_found                         |
| 缺失、重复或格式不合法               | 400       | invalid_request / parameters                                     |
| 客户端 ID 不匹配                     | 400       | invalid_client / registration_mismatch                           |
| 回调不符合登记                       | 400       | invalid_request / redirect_uri                                   |
| 不支持的 response_type 或 grant_type | 400       | unsupported_response_type 或 unsupported_grant_type / parameters |
| 权限不符合配置                       | 400       | invalid_scope / scope                                            |
| 本次授权会话不可用                   | 400       | invalid_grant / session_unavailable                              |
| verifier 或本次兑换回调不匹配        | 400       | invalid_grant / pkce_mismatch 或 redirect_uri                    |
| 上游明确拒绝 code／refresh_token     | 400       | invalid_grant / upstream_rejected                                |
| 上游明确拒绝状态或撤销操作中的令牌   | 400       | invalid_token / upstream_rejected                                |
| provider 没有该操作                  | 400       | unsupported_operation / provider_capability                      |
| 上游限流                             | 429       | temporarily_unavailable / upstream_rate_limited                  |
| 新工作超出容量，或服务正在停止       | 503       | temporarily_unavailable / capacity 或 shutting_down              |
| 上游拒绝服务端应用凭据               | 502       | server_error / upstream_client_rejected                          |
| 上游故障或响应不符合协议             | 502       | server_error / upstream_unavailable 或 upstream_response         |
| 已发请求超时，无法确认上游结果       | 504       | server_error / upstream_result_unknown                           |
| 服务内部失败                         | 500       | server_error / internal                                          |

表中状态适用于直接 HTTP 回复；授权浏览器流程已具有可信回调时，采用上节规定的 302 错误回调。输入正文超限使用 413，URL 超限使用 414，错误 Content-Type 使用 415，error 均为 invalid_request，reason 分别为 body_too_large、url_too_large、content_type。unsupported_operation 与 reason 是本服务的协议扩展，不宣称属于 OAuth 标准枚举。[标准错误的基础含义](https://www.rfc-editor.org/rfc/rfc6749.html#section-5.2)

session_unavailable 合并已不存在、过期和已经领取的会话；它不谎称能在清理后区分每一种过去状态。无需为解释一次失败保存完成历史。错误 verifier、错误 redirect_uri 或本地接纳失败均不消耗仍有效的待交换会话。

上游错误按明确状态码、结构化 error 值和 provider 规则分类，不解析说明文字。未知结构、HTML 或不能核对的错误不能猜成授权失效。有效的 Retry-After 可以随 429 返回，但 relay 不自动重试；客户端不因此删除旧凭据。

开始上游交换后，断连、取消、超时或无法解析响应都不能证明上游没有签发令牌。该次 code 会话结束，不再开放兑换，也不维护结果领取库。刷新同样不自动重放；已有客户端凭据与是否需要再次授权，由调用方按实际结果处理。授权拒绝只结束本次操作，不撤销以前的有效连接。

<a id="state"></a>

## 会话与 HTTP 资源的执行次序

会话按等待回调、等待交换和正在交换三个阶段推进。初始记录保存 application/provider、接纳的 client_id、完整客户端回调与 state、challenge、独立上游 state 及进程内期限。收到 code 后，为同一会话建立包含接入范围的 code 摘要索引。

授权等待默认 600 秒。callback 后的本地交换窗口默认 60 秒，与原授权剩余时间取较短值；不是重置整个会话，也不是承诺上游 code 仍有效。Bangumi 文档的 60 秒来自其自身规则，起算点不能由 relay 收到 callback 的时间代替。期限使用进程内单调时钟，不依赖用户修改系统日期。

token 先完成参数、会话、verifier、回调及并发容量核对，再在同一同步临界段把会话改为正在交换；任何上游 await 都在领取之后。领取失败或已经领取时不提交第二次请求。收到有效 callback 后不再接纳同一会话的新 callback；已归属其他有效会话的 code 也不能覆盖旧索引。

会话完成、拒绝或到期时，拥有者同时删除所有索引。到期清理与请求时检查共用同一判断；进行中的 HTTP 请求由请求期限和取消负责收尾，不能让会话清理把仍在运行的工作重新变成可领取。

refresh、revoke 和 token-status 只有当次请求资源，不建立授权会话或用户记录。实例重启清空待授权状态，不影响客户端以后使用自己保存的有效 refresh_token 请求刷新。

transport 将请求断开、服务停止和上游期限接入同一次实际取消，关闭响应 reader 与连接资源。server 先停止接纳，再在关闭期限内等待已接纳请求；到期取消剩余请求，最后清理会话。只给 Promise 加超时、继续让底层 fetch 运行，不满足该合同。

<a id="protocol-configuration"></a>

## 启动配置与部署输入

配置从 RELAY_CONFIG 指定的 JSON 文件读取。部署者准备真实应用登记和运行配置，结构参照 [配置示例](config.example.json)与[结构 schema](config.schema.json)。

| 配置部分             | 形状与含义                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| publicOrigin         | 完整 HTTPS origin，不带路径、查询、用户信息或 fragment；据此生成 /{application}/{provider}/callback |
| listen               | host 与 port；默认 0.0.0.0:3000，适用于容器内部监听                                                 |
| applications         | 按应用名登记，各自拥有 redirects、corsOrigins 和 providers                                          |
| 应用 redirects       | fixed 的完整 URI，或 loopback 的明确 host 与 path；不把多个应用的规则混在全局列表                   |
| provider 登记        | clientId、clientSecretEnv、allowedScopes、defaultScopes；没有秘密字面量和自定义端点字段             |
| Google authorization | accessType=online 或 offline、includeGrantedScopes；只对 Google 接入存在                            |
| limits               | 授权／交换／上游／关闭期限，会话与上游并发数量，以及输入和上游响应字节上限                          |

fixed 回调按配置字符串完整匹配，只允许 HTTPS 或已登记的应用 custom scheme。URI 不含 fragment、用户信息，或预置的 code、state、error、error_description、reason 参数；可执行、文件和文档协议不适用。

loopback 使用字面 127.0.0.1 或 ::1、准确路径，以及 1–65535 的显式动态端口，查询与 fragment 必须为空。localhost、缩写 IP 和路径前缀匹配均不进入这一范围。URL 解析只核对结构，token 的 redirect_uri 仍须等于本次接纳的原字符串。[原生客户端回环规则](https://www.rfc-editor.org/rfc/rfc8252.html#section-7.3)

corsOrigins 默认空数组；确有浏览器消费者时登记完整 HTTPS origin，按请求 Origin 精确返回，不使用 `*`，也不启用 Cookie 凭据。CORS 不是客户端身份认证，不改变 Node 消费者的授权参数规则。公开 origin 和回调不从 Host、Forwarded 或 `X-Forwarded-*` 推导；IP 限流如由代理执行，归实际代理配置，不在服务中默认信任任意转发头。

所有配置在监听前检查：未知字段、默认权限不是允许权限子集、错误 URI、同来源 clientId 被不同应用重复登记、秘密环境引用不存在或为空，都导致启动失败。错误只指明安全字段路径或环境变量名，不打印秘密值。结构 schema 与跨字段、URL、环境引用检查共同构成启动边界；schema 校验不能单独证明所有语义。

采用以下默认值：authorizationSeconds=600、exchangeSeconds=60、upstreamTimeoutSeconds=20、shutdownSeconds=25、maxSessions=1024、maxUpstreamRequests=64、maxRequestBytes=16384、maxResponseBytes=1048576。这些运行默认值允许在启动配置调整；不是已经通过负载测量的容量承诺。新工作无法接纳时明确失败，已经接纳的授权会话不为腾位而被丢弃。

Compose 的普通插值参数只负责镜像、主机端口及配置文件路径；私有 env_file 或明确 environment 承担容器秘密注入。真实 JSON 只读挂载，环境秘密不进入 config.example.json、镜像层或镜像构建参数。Compose .env 的存在不等于环境变量已进入容器。
