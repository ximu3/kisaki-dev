# oauth-relay 来源交接与传输核对

对应[来源适配与客户端交接](../../../design/projects/oauth-relay/providers.md)。本轮复用此前固定来源和真实授权收据，补读官方协议材料，并在本机核对 HTTP 行为。最初两个 Fetch 对照之后，固定实现中的 421 重发机制使传输入口改为原生 ClientRequest，并对新入口补做相应检查。没有访问用户凭据或发起真实 provider 操作。

**适用范围：**本记录保留原始试件、观察和当时的选型结论。现行设计采用 Node Fetch；[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.20)允许收到 421 后换连接重试，发送次数本身不足以证明重复业务执行。Fetch 的响应计限与取消观察仍有参考价值，ClientRequest 对照用于理解传输行为，不作为正式传输入口的实现要求。验收见[relay 场景](../../scenarios/oauth-relay.md)。

## 来源依据

| 依据                                                                                                                                                                            | 本轮用于核对的事实                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [Bangumi 固定说明](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/docs-raw/How-to-Auth.md)                                                        | 刷新正文仍有登记回调；token_status 是 access_token 表单请求；expires 与 expires_in 含义不同               |
| [AniList 请求示例](https://github.com/AniList/docs/blob/master/docs/guide/snippets/auth/authorization-code/javascript.js)与[既有真实结果](../oauth-relay-provider/providers.md) | JSON 编码和实际可用的刷新；不以旧说明覆盖真实结果                                                         |
| [Google 固定客户端](https://github.com/googleapis/google-auth-library-nodejs/blob/6ac9ab4fd49d64d8315f16d7f2757da04fbeb579/src/auth/oauth2client.ts)                            | code／refresh 字段、client_secret_post、tokeninfo 的 POST Bearer 请求；其中的自动重试与本地字段转换不照搬 |
| [Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)                                                                                          | 表单正文撤销示例、实际错误与影响范围、增量授权及可选令牌字段                                              |
| [RFC 6749 §6](https://www.rfc-editor.org/rfc/rfc6749.html#section-6)与[RFC 7009 §2.2](https://www.rfc-editor.org/rfc/rfc7009.html#section-2.2)                                  | 刷新令牌可以替换；标准撤销语义与来源实际响应不能混为一谈                                                  |
| [Node 固定说明](https://github.com/nodejs/node/blob/v24.22.0/doc/api/globals.md#fetch)与[Fetch 规则](https://fetch.spec.whatwg.org/)                                            | Fetch 的默认重定向及内容解码；Node 的实际行为由下面的执行记录核对                                         |

此前来源的 URL、文件路径和内容摘要仍在 [HTTP 输入收据](../oauth-relay-protocol/source-input.json)与[附加来源收据](../oauth-relay-protocol/provider-sources.json)中；未更写这些历史输入。来源材料为协议依据，不证明当前三个正式适配器已经存在或全部实际操作已经通过。

## 最初的 Fetch 对照

[transport.mjs](transport.mjs)使用此前校验的 Node 24.22.0 可执行文件，运行时内置 Undici 为 7.29.1；未安装新包。它只监听两个动态 127.0.0.1 端口，所有请求值及压缩正文均由试件生成。

| 场景          | 实际结果                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 307 重定向    | 默认 Fetch 对照向第二个端口发送了一次 POST，虚构正文保持完整；manual 请求取得 307，第二个端口新增请求为 0，响应正文已释放                                |
| gzip 响应限额 | Content-Length 与压缩正文均为 339 字节；解压后总样本为 262195 字节。读取达到 32768 字节、超过试件 16384 字节阈值后取消 reader 和请求，没有执行 JSON 解析 |

原始结果见 [transport-contract.json](transport-contract.json)。两个服务器均已关闭。307 对照中的正文只含试件自己的假值，没有真实 token、code 或 client_secret；第二个端口也完全属于本试件。

压缩检查证明必须累计实际读出的解码字节；它不证明运行时内部完全没有预读，也不把缩短的 16 KiB 阈值替换为生产配置。服务端已一次发送这个很小的压缩响应，因此这里只记录 reader 与请求取消，没有声称观察到“上游生成工作被中断”。此前的[生命周期记录](../oauth-relay-delivery/delivery.md)另行覆盖实际活动请求的取消。

## 421 重发与原生请求入口

Node 24.22.0 内置的[固定 Fetch 实现](https://github.com/nodejs/node/blob/v24.22.0/deps/undici/src/lib/web/fetch/index.js)在 421、可重放正文和尚未执行这一重试的条件下，再次调用 HTTP 请求。这一行为不受 redirect:manual 关闭。对应源码及 Node HTTP／stream 说明保存于[来源收据](request-sources.json)。

[request.mjs](request.mjs)因此增加一个组合检查，仍只使用固定 Node 和两个自有 loopback 地址：

| 观察                     | 实际结果                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| POST 收到 421            | manual Fetch 发出两次请求；同一原生 request 调用只发出一次，并保留 421 状态                     |
| 原生请求收到 307         | 只发出一次请求，第二个端口请求数为 0                                                            |
| 原生响应 gzip 解码与计限 | stream.pipeline 经 createGunzip 读取；解码后超限，响应与解码流均结束，没有解析 JSON             |
| 正文阶段超时             | 上游已经交付 200 响应头，100ms 试件期限后取消；上游观察到响应未完成时连接关闭，原生请求数仍为 1 |

结果见 [request-contract.json](request-contract.json)。最初把取消错误固定断言为 ABORT_ERR，实际 IncomingMessage 先报告 ECONNRESET，因此该断言失败。随后按本次期限信号已触发、正文读取中断与上游关闭核对取消事实，不匹配错误消息。最初脚本摘要和观察见 [initial-observation.json](initial-observation.json)。重定向、421 和压缩检查没有因这一修改放宽。

最后四项观察均通过，Agent 和两个监听已关闭。这是 HTTP loopback 下对共同 ClientRequest 及流机制的验证，没有执行 TLS、实际代理或正式 HTTPS provider。当时据此选择的生产入口为 Node https.request；该选型现已由页首所述设计替代。

## 执行范围

该检查没有启动 Hono 路由、浏览器、代理或容器，也没有实现三个 provider、客户端凭据保存或系统加密。它针对真实 Node HTTP 行为，不把运行时对照当作整条授权链路已经实现。客户端采用规则本轮以已有私有存储合同和明确提交顺序衔接，正式竞争与持久验证仍在应用实现验收中执行。

使用 [Node 输入收据](../oauth-relay-delivery/source-input.json)中已校验的 node.exe 执行本目录 transport.mjs 与 request.mjs 即可复核；脚本先检查运行版本和可执行文件摘要。现有授权和回调登记没有在本轮重复操作。
