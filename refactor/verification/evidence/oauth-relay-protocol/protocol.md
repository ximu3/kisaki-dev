# oauth-relay HTTP 与配置设计验证

对应 [已确认的 HTTP 与运行配置](../../../design/projects/oauth-relay/protocol.md)。本轮运行隔离的 Hono 服务、受控上游和 loopback 接收器，核对已确认模型的关键执行条件，并为参数、错误和配置细化提供证据。没有创建正式 relay 项目、读取真实凭据、发起真实来源授权、撤销令牌或修改现有部署。

## 固定输入

| 输入             | 实际版本与用途                                                    |
| ---------------- | ----------------------------------------------------------------- |
| Node             | 本机 24.11.1，执行受控 HTTP 试件                                  |
| Hono             | npm 官方发行 4.13.13                                              |
| Node adapter     | @hono/node-server 2.1.5                                           |
| JSON Schema 检查 | 既有本机 Ajv 8.20.0，使用 Draft 2020-12                           |
| 网络             | 三个仅绑定 127.0.0.1 的动态端口；试件运行时不请求真实上游         |
| 凭据与媒体       | 仅程序生成的随机 state／verifier／code 和自有虚构令牌，无用户数据 |

[prepare.py](prepare.py)从官方 registry 取得精确版本元数据，下载 tarball 并核对 SHA-512 integrity 后解包到独立缓存；未运行安装脚本、未更改工作区 manifest 或锁文件。包入口、归档和十项主要来源摘要见 [source-input.json](source-input.json)。另外两项来源及 Google 客户端固定提交见 [provider-sources.json](provider-sources.json)。生产 Node、框架与镜像组合尚未冻结。

Hono 路由通过 Node adapter 监听真实本机端口。调用方使用 HTTP 跟随明确的授权跳转，最后由 loopback 接收器收到原客户端 state 与原始上游 code；没有启动浏览器，也没有验证 TLS、CORS、反向代理或操作系统外部浏览器行为。来源阅读与这个本地实验各自提供不同范围的依据。

## 九组 HTTP 观察

| 场景                              | 实际结果                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 授权交接、错误 verifier、并发兑换 | 两段 state 不同且最终原样回到客户端；错误 verifier 不提交上游且保留会话；两个有效并发请求只有一个上游交换，返回 200／400，结束后两类索引清空 |
| 无旧会话刷新                      | refresh_token 请求成功，响应的原生扩展字段保留；未返回的新 refresh_token 保持缺失，没有复制旧值                                              |
| 拒绝、重复参数与回调匹配          | access_denied 带原 state 回到客户端；重复 client_id 和 127.1 缩写回环地址被拒绝                                                              |
| 容量与到期                        | 四份已接纳会话保持有效，新的授权通过已核对回调返回容量错误；推进注入时钟后会话全部清理                                                       |
| 上游 429                          | 保留限流分类和 Retry-After:7；已领取 code 只提交一次，后续重复兑换被拒绝                                                                     |
| 上游超时                          | 150ms 的试件期限实际中止上游 HTTP；结果归为未知，不重新开放或重放 code                                                                       |
| 客户端断开                        | 请求已经到达上游后取消客户端 fetch，取消传递至上游，授权索引最终清空                                                                         |
| 严格 PKCE 上游对照                | 另一授权的 code 尚未被 relay 接纳时，将它放入本会话；本地 verifier 合法，但受控上游拒绝不同 challenge 的 code                                |
| 未绑定上游对照                    | 相同条件下，未校验 code 与 challenge 关联的受控上游接纳请求；本地 S256 并不能阻止这一上游差异                                                |

最终共执行七次受控 token 请求，观察到两次上游 HTTP 中止；三个服务器均已关闭，没有留下监听端口。原始结果见 [protocol-contract.json](protocol-contract.json)。对照故意模拟两种上游，不能据此断言 Bangumi 或 AniList 的实际实现属于其中某一种。

会话到期使用注入时钟，没有等待十分钟；容量 4 和上游期限 150ms 是缩短实验的输入，不是生产默认值或负载结论。试件明确使用自己的 `strict`／`unbound` provider，不是三个正式 provider 的简化替代品。它没有验证完整 HTTP 错误映射、入站／出站超限、所有回调组合、正式周期清理、全局并发容量、重启、浏览器 CORS、revoke 或 token-status。

## 配置结构与关联

[配置 schema](../../../design/projects/oauth-relay/config.schema.json)和[无秘密示例](../../../design/projects/oauth-relay/config.example.json)由 [check-config.mjs](check-config.mjs)共同核对。结构采用 Ajv，URI、权限子集、重复上游登记及环境引用采用试件自己的语义检查；这不预先决定正式服务必须使用哪一个校验依赖。

示例配置通过。六组有意义的反例被拒绝：配置中填写秘密字面量、默认权限超出允许范围、公开 origin 带路径、跨应用复用同一来源 clientId、loopback 使用 localhost、秘密环境引用缺失。检查只传入程序生成的虚构环境对象，没有读取进程中的用户秘密。

结果及 schema／示例／检查程序摘要见 [configuration-contract.json](configuration-contract.json)。该检查支持已确认的配置形状，不表示正式 CLI、配置装载、镜像环境注入、Compose 或真实登记已验收。

## 来源结论与保留问题

Google 的公开发现文档列出 S256，固定版官方 Node 客户端提供 tokeninfo 的实际请求方式；Bangumi 的固定说明列出短 code 窗口、刷新与 token_status；AniList 的官方示例使用 JSON token 请求。AniList 刷新继续采用[此前真实结果](../anime-platforms/live-api.md)，本轮没有重做授权或用文档否定实际能力。

该实验结束时，Bangumi／AniList 的上游 PKCE 与授权请求绑定仍需真实核验，接收未知参数并不证明服务器会校验它。随后执行的[真实授权对照](../oauth-relay-provider/providers.md)确认了当前应用接受错误及缺失 verifier；本报告的模拟结果没有被改写成真实来源结果。relay 自身的会话检查仍不补齐上游绑定。[RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.5)

本页结果限于受控 HTTP 与配置检查；真实来源、完整客户端、容器和部署按[relay 场景](../../scenarios/oauth-relay.md)验收。

## 复核入口

```powershell
node refactor/verification/evidence/oauth-relay-protocol/probe.mjs
node refactor/verification/evidence/oauth-relay-protocol/check-config.mjs
```

这两项使用各自记录的隔离输入，不请求真实 token 端点。重新准备依赖时执行 prepare.py，生成新的缓存目录和输入收据后再运行试件；不能只替换旧记录中的包版本或摘要。
