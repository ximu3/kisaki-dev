# oauth-relay 上游适配

上游的协议、参数、结果及取消按实际能力处理；服务不补造令牌、权限、账号或撤销事实。

<a id="providers"></a>

## 通用协议与来源差异

providers/oauth.ts 复用已经证明相同的 OAuth 请求编码和响应解释。各来源文件拥有固定协议事实及必要差异；registry 只登记明确支持的实现。结构化数据足以表达的差异使用有限字段，特殊行为保留小型代码，不把 JSON 配置扩展成脚本或插件系统。

provider 使用经过验证的当前应用接入参数，不自行查找其他应用秘密。授权、token、刷新及其他已支持操作的目标地址来自已登记实现，外部请求不能提供任意 token endpoint、修改上游回调或切换凭据。上游 HTTP 跳转也不能使带凭据请求被自动转投未登记目标。

| 来源    | 来源差异                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Bangumi | 固有授权／token 协议、应用秘密、短 code 窗口、刷新及实际权限处理；不能拿旧文档的 scope 说明覆盖真实范围验证             |
| AniList | 独立的授权与 token 接入；保留已经真实验证的 refresh_token grant，不因当前文档仍写无刷新能力而删除它                     |
| Google  | 保留独立服务对其他消费者的 Google 接入，使用其实际登记的 Web 接入与回调；Kisaki Google Books 的桌面直连不因此改走 relay |

Bangumi 和 AniList 的已有来源核验分别见 [Bangumi 本人操作](../../../verification/evidence/bangumi/account-operations.md)与 [AniList 实际授权结果](../../../verification/evidence/anime-platforms/live-api.md)。这些证据支持上游能力判断，未验证新 relay 的整条链路。

客户端到 relay 的 S256 校验适用于所有来源；各上游的绑定能力与参数见[上游授权绑定](#upstream-binding)。

各来源的 PKCE、客户端认证方式、刷新、撤销和状态能力要逐项记录。撤销及状态接口只接入上游真实支持的能力，具体路径与错误形状见[HTTP 合同](protocol.md#http)，不能把查询账号资料包装成 relay 的统一用户状态。切换前还须核对所有真实登记的应用与来源，不能仅凭上述三个文件就宣称旧服务的消费者已完整迁移。

三个 provider 的各操作字段、原生结果、错误归属及调用方采用方式集中在[接入细化](#integration-providers)。同一来源的 SDK 请求样例只作为协议依据，不能把其默认重试、重定向、字段转换和日志行为一并带入本服务。

<a id="protocol-providers"></a>

## 三个上游的接入方式

| provider | 授权与 token                                                                                                               | 已有续期依据                                                          | 附加令牌能力与当前边界                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Bangumi  | bgm.tv/oauth/authorize；表单 POST 到 bgm.tv/oauth/access_token，应用秘密在请求正文                                         | 官方说明 refresh_token grant；刷新请求仍携带登记的 relay redirect_uri | token-status 对应表单 POST /oauth/token_status；没有已核实的可调用撤销 API                               |
| AniList  | anilist.co/api/v2/oauth/authorize；JSON POST 到 /api/v2/oauth/token，明确 Accept:application/json                          | 已有真实 code 交换及 refresh_token 成功证据，保留该能力               | 当前材料未确立独立撤销或令牌状态 API；Viewer 查询不冒充这两项能力                                        |
| Google   | accounts.google.com/o/oauth2/v2/auth；表单 POST 到 oauth2.googleapis.com/token，采用已登记 Web 客户端的 client_secret_post | 官方 offline access 与刷新协议                                        | revoke 对应 /revoke；token-status 对应 /tokeninfo 的真实令牌信息；不并入 Kisaki 的 Google Books 桌面直连 |

Bangumi 的请求与短 code 窗口见[固定认证说明](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/docs-raw/How-to-Auth.md)。scope 的实际限制仍须对应真实登记与令牌，不能从旧说明里的“尚未实现”推导任意权限保证。AniList 的 JSON 编码见[官方示例](https://github.com/AniList/docs/blob/master/docs/guide/snippets/auth/authorization-code/javascript.js)；文档对刷新能力的描述与[已有实测](../../../verification/evidence/anime-platforms/live-api.md)并列记录，不抹去后者。

Google 的[发现文档](https://accounts.google.com/.well-known/openid-configuration)声明 S256、client_secret_post 与撤销端点；同次客户端 challenge 和 verifier 可以沿该上游链路传递，不遇错改用 plain。token-status 按[固定版官方 Node 客户端](https://github.com/googleapis/google-auth-library-nodejs/blob/6ac9ab4fd49d64d8315f16d7f2757da04fbeb579/src/auth/oauth2client.ts)实际使用的 POST tokeninfo 与 Bearer 头调用，保留原始响应字段，不照抄该 SDK 将 expires_in 转成 expiry_date 的本地变换。返回的 aud、client_id 等由调用方按实际结果核对，不补造为当前接入值。

Google 撤销是明确的上游操作，可能影响该项目关联的授权范围及其他访问／刷新令牌；不能描述为仅退出一个本地连接。relay 只转交请求和实际结果，不维护自己的撤销状态。[Google 撤销说明](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke)

各操作的具体上游字段、结果校验和传输细节见[来源适配与客户端交接](#integration-providers)。该细化不改变本页的端点与字段形状；客户端凭据采用仍是独立于 relay 会话的责任。

<a id="upstream-binding"></a>

## 上游授权绑定

Bangumi 和 AniList 的当前接入使用授权码、应用秘密与 state，上游不执行所请求的 S256 绑定。[真实核验](../../../verification/evidence/oauth-relay-provider/providers.md)记录了正确、错误和缺失 verifier 的对照及刷新结果；结论限于所测接入。

两项适配继续采用已约定的原生授权码、应用秘密与 state 流程，上游授权与兑换不发送 PKCE 字段；客户端提供的 challenge 与 verifier 仍用于 relay 自身必须执行的 S256 校验。Google 按其已有依据向上游传递同次 challenge 与 verifier。来源差异在 provider 定义中明确，不设失败后换方法的自动降级，也不声称这些流程都具有端到端 S256 保护。

本地试件明确区分两类受控上游：对同一接入下尚未被 relay 接纳的另一授权 code，带本会话正确 verifier 时，严格校验上游拒绝，未绑定上游接纳。真实核验确认了当前两项接入未执行 S256，但没有将这类 code 注入攻击施加于他人或真实跨用户会话。relay 的本地校验仍不能独立补齐上游授权请求绑定。[RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.5)说明相关保护条件；若以后要求所有来源都具备强制上游 S256，需重新讨论能力与支持约定，不能靠新增第二种 relay code 宣称已经解决。

<a id="integration-providers"></a>

## 请求与结果的适配责任

providers/registry.ts 只登记实际实现及其能力。每个 provider 的定义包含固定端点、授权参数、token 请求编码、支持的操作和结果校验；application 配置提供该接入的 clientId、秘密及 relay 回调。请求构造取得已经核对的业务参数，不能从调用方的任意字段、头或 URL 复制配置。

| 操作          | Bangumi                                                                                    | AniList                                                   | Google Web 客户端                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 授权跳转      | 固定 authorize，client_id、relay redirect_uri、response_type、独立 state；scope 按实际登记 | 固定 authorize，同样关联独立 state；不增加虚构细分权限    | 固定 auth，沿配置传递 scope、access_type、include_granted_scopes；沿本次请求传递 S256、适用的 prompt／nonce |
| code 兑换     | 表单：grant_type、client_id、client_secret、code、relay redirect_uri                       | JSON：相同字段；Accept:application/json                   | 表单：相同字段，并传递本次 code_verifier                                                                    |
| refresh_token | 表单：grant_type、client_id、client_secret、refresh_token、登记的 relay redirect_uri       | JSON：grant_type、client_id、client_secret、refresh_token | 表单：grant_type、client_id、client_secret、refresh_token                                                   |
| token-status  | 表单 POST /oauth/token_status，正文 access_token                                           | 不支持；不发起上游请求                                    | POST /tokeninfo，Bearer 头携带 access_token，Content-Type 为表单                                            |
| revoke        | 不支持；不发起上游请求                                                                     | 不支持；不发起上游请求                                    | 表单 POST /revoke，正文 token；不转发 token_type_hint                                                       |

表中的相同字段指该操作的字段名称，值始终来自当前 application/provider。上游 token 请求中的 redirect_uri 是登记的 relay HTTPS 回调；客户端提交的 loopback URI 仅用于核对本次客户端交接。Bangumi／AniList 不发送上游 PKCE 字段，relay 仍执行自己的 S256 核对；这一边界见[真实来源结果](#upstream-binding)。

Bangumi 的刷新和 token_status 字段有[固定认证说明](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/docs-raw/How-to-Auth.md)作为依据；其 scope:null 不能解释为只读权限。AniList 的 JSON 请求沿[官方示例](https://github.com/AniList/docs/blob/master/docs/guide/snippets/auth/authorization-code/javascript.js)，续期字段采用[已执行的请求](../../../verification/evidence/oauth-relay-provider/live-probe.mjs)及[实际结果](../../../verification/evidence/oauth-relay-provider/providers.md)。没有能力的附加操作返回既定 unsupported_operation，不尝试猜测端点或调用 Viewer 代替。

Google 的 code、refresh 和 tokeninfo 编码可对应到[固定官方客户端源码](https://github.com/googleapis/google-auth-library-nodejs/blob/6ac9ab4fd49d64d8315f16d7f2757da04fbeb579/src/auth/oauth2client.ts)。这里采用其协议依据，不采用 SDK 的自动重试、本地 expiry_date 转换或把撤销 token 放进查询串的实现。撤销使用[官方 Node 示例](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke)支持的表单正文。

Google revoke 成功按其 200 结果返回空响应；明确的错误仍按其结构化响应分类。不能把所有 400 都改写成“已经撤销”，也不能因为 [RFC 7009](https://www.rfc-editor.org/rfc/rfc7009.html#section-2.2)规定了无效令牌的成功语义，就覆盖来源真实错误。该操作可能撤销同一项目关联的多项授权；成功也不表示所有资源服务器已经立即观察到撤销。

<a id="responses"></a>

## 成功结果与失败分类

上游成功正文先经过大小限制与 JSON 解析，再由对应操作核对结构。token 结果必须是对象，包含非空 access_token 和 token_type；出现的 refresh_token 必须是非空字符串，expires_in 必须是来源合同规定的有效数值。可选字段缺席保持缺席，null 只在该来源确实定义了此含义时成立，不能普遍当作删除客户端值的指令。未知扩展字段可以保留为受限 JSON，不转成统一账号模型。

scope、user_id、id_token 和 refresh_token_expires_in 等字段保留原有名称和含义。token-status 的 expires 与 token 的 expires_in 不是同一个时间表示，返回的 aud 或 client_id 也不补写成当前接入值。客户端需要识别账号或核对 ID token 时，仍执行来源自己的完整校验；relay 不调用本人接口补齐身份，不把可解码的 JWT 当作已验证身份。

Google 的 include_granted_scopes 可能使结果包含此前授予的范围。配置允许范围约束本次请求，不承诺上游令牌只拥有本次请求的权限；客户端只使用其业务已明确采用的能力。[Google 授权与响应说明](https://developers.google.com/identity/protocols/oauth2/web-server)

| 上游观察                                         | relay 的处理                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| token 操作明确返回 invalid_grant                 | invalid_grant / upstream_rejected；不重放，不删除客户端持久数据         |
| 明确拒绝服务端应用认证                           | server_error / upstream_client_rejected；调用者重新登录不能修复服务登记 |
| 状态或撤销操作明确返回 invalid_token             | invalid_token / upstream_rejected；只表达该操作的实际结果               |
| 429                                              | 保留限流分类及有效 Retry-After；不改成账号失效                          |
| 5xx、传输失败或停止                              | 按既定故障、取消和结果不确定合同处理；不能推定上游没有执行              |
| 未定义的 4xx、HTML、畸形成功对象或相互冲突的字段 | upstream_response；不从英文说明猜测账号失效                             |

已知状态和结构化 error 值共同决定分类，说明文字只作为不向外传播的远端输入。来源确有标准之外的错误形状时，以该来源证据定义专门分支；每个适配器的判断范围限定于已确认的来源合同。

<a id="transport"></a>

## 令牌请求的 HTTP 传输

token、refresh、revoke 和 token-status 共用 transport，通过 Node Fetch 请求 provider 定义的固定 HTTPS 端点，设置 `redirect: 'error'`。运行时负责连接、TLS 证书校验和内容解码；transport 负责本次请求的取消、期限和响应大小。[Node Fetch 接口](https://github.com/nodejs/node/blob/v24.22.0/doc/api/globals.md#fetch)

期限覆盖请求开始到正文读取结束。停止或超时触发同一 AbortSignal，中断请求及未完成的正文读取；失败分类按本次调用的停止原因判断。读取按解码后的字节累计，超限时取消正文，在限额内才解析 JSON。Content-Length 只作响应元信息，不代替实际读取计限。

应用在结果未知后不自行重新发起令牌操作；授权码的单次领取由[会话合同](protocol.md#sessions)保证。HTTP 协议处理沿用运行时，包括标准允许的 421 接续，不以底层发送次数定义业务是否重试。[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.20)、[Fetch 标准](https://fetch.spec.whatwg.org/#http-network-or-cache-fetch)

普通 Node 消费者采用相同的应用重试规则。Kisaki 到 relay 的请求使用[宿主网络](../../engineering/network.md)，服从应用代理并拒绝认证请求的重定向；浏览器授权跳转按正常授权流程执行。

解析后的 JSON 由 relay 重新形成自己的响应。上游 Content-Length、Content-Encoding、Location、Set-Cookie 及连接相关头不复制给客户端；只按公开合同生成必要响应头。有效 Retry-After 是明确保留的协议字段，不构成复制整组上游头的理由。

超时、断连、响应不可读或本地保存失败后，由调用方按实际结果决定下一步，保留仍有效的旧凭据。端点、认证方式和 PKCE 方法固定为本次来源合同，不因失败自动切换。
