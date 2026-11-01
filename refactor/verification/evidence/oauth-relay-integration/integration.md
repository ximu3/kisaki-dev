# Node Fetch 传输验证

2026-10-21，在 Node 24.22.0／Undici 7.29.1 中，使用自有 HTTP loopback 服务核对 Fetch 的重定向、响应计限和 421 行为。运行版本与可执行文件摘要由[输入收据](../oauth-relay-delivery/source-input.json)固定，输入正文使用合成授权字段。

## 重定向与响应计限

[transport.mjs](transport.mjs)建立两个本地端口并执行以下观察，[结果](transport-contract.json)记录实际请求与资源收尾。

| 操作                            | 结果                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 对 307 使用默认 Fetch           | 第二个端口收到 POST，合成正文保持完整。                                                                                |
| 对同一 307 使用 redirect:manual | 调用取得 307，第二个端口新增请求为 0，响应正文已释放。                                                                 |
| 读取 gzip 响应并按解码字节计限  | 压缩正文为 339 字节，完整解码样本为 262195 字节；读取达到 32768 字节，超过试件 16384 字节阈值后取消，JSON 解析未执行。 |

响应限制依据实际读出的解码字节。这里使用缩小的试件阈值，正式配置由[传输合同](../../../design/projects/oauth-relay/protocol.md)定义。活动请求的取消与关闭见[运行寿命验证](../oauth-relay-delivery/delivery.md)。

## 421 行为

固定 Fetch 实现对符合条件的 421 响应换连接重试。合成 POST 观察到两次发送，见[运行记录](fetch-retry.json)。redirect:manual 控制重定向，421 按 HTTP 的连接重试语义处理；业务是否执行须依据上游结果判断。

依据：[Node 24.22.0 的 Fetch 实现](https://github.com/nodejs/node/blob/v24.22.0/deps/undici/src/lib/web/fetch/index.js)、[RFC 9110 的 421 定义](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.20)。

## 运行范围

试件在所列 Node 版本中执行本地 HTTP 操作并关闭两个监听。HTTPS、代理、实际 provider 与完整授权链路按[relay 场景](../../scenarios/oauth-relay.md)验证。复现 transport.mjs 时使用输入收据指定的 Node，并将结果写入隔离试件目录。
