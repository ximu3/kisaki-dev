# Bangumi 与 AniList 的真实授权绑定核验

2026-10-21，在用户同意沿用既有应用并完成必要登录后，以正常、错误及缺失 verifier 的新授权分别验证两项使用 client_secret 的接入。结果一致：正常 verifier、错误 verifier、缺失 verifier 都获得令牌。当前测试接入没有执行所请求的 S256 绑定；这比“参数被接受”或“正常登录成功”提供了更明确的结论。

核验使用 AniList 的 Kisaki 应用和 Bangumi 的 kisaki-bangumi-extension 应用。没有创建新应用或修改个人收藏、评分及同步记录；只是临时调整回调并取得本轮授权。正式服务没有切换。

## 实际结果

每个来源使用三个全新的授权码，授权请求均携带 code_challenge 和 code_challenge_method=S256；每个 code 只尝试一次兑换，三组分别采用正确、不匹配和省略 verifier。正常组成功后再刷新一次。

| 来源    | 正确 verifier | 错误 verifier | 缺失 verifier | state 回传 | 刷新                    |
| ------- | ------------- | ------------- | ------------- | ---------- | ----------------------- |
| AniList | 200，签发令牌 | 200，签发令牌 | 200，签发令牌 | 三组均匹配 | 200，返回访问与刷新令牌 |
| Bangumi | 200，签发令牌 | 200，签发令牌 | 200，签发令牌 | 三组均匹配 | 200，返回访问与刷新令牌 |

共发起六次 code 兑换和两次刷新。所有成功结果都包含访问令牌、刷新令牌、token_type 和数值 expires_in。AniList 样本约为一年，Bangumi 样本为七天；调用方仍使用实际响应，不把样本期限写成固定协议。记录的是刷新令牌字段存在，没有据此声称完成了所有轮换、撤销或旧令牌失效行为验证。

单次 code 兑换从发出 token 请求到取得结果耗时 513–998ms。Bangumi 第一组的 authorizationElapsedMs 包含人在授权页等待的时间，不能拿它当作 code 的存活时长；接收器收到有效 callback 后立即兑换，未等待模型读取或手动复制 code。

程序核验了 state 的原样匹配后才接纳回调。两项原 HTTPS 回调都已恢复，并重新加载页面读取确认。Bangumi 保存前后的权限勾选及第三方标志也逐项相同。两个本机接收器均已关闭；本轮没有撤销上游已有应用授权，释放本机数据不等同于上游令牌已撤销。

## 证据与边界

[live-probe.mjs](live-probe.mjs)在受控 Node 工具运行时内创建 loopback HTTP 接收器，并直接调用固定 token 端点。该运行时的具体 Node 版本没有取得，不借用终端 Node 的版本作为替代。应用凭据从用户指定应用的可见登记字段取得，只传入核验程序内存；程序没有把 code、state、verifier、令牌或本人身份写入收据。

AniList 使用 JSON token 请求，Bangumi 使用表单请求；Bangumi 刷新同时提交本次登记的 redirect_uri。浏览器的网页确认与 token 请求分别执行，已有授权自动返回的场景也经过相同的 state 校验。用户后来明确允许代为完成剩余 Bangumi 确认，没有改变已同意的应用、权限或操作范围。

- [AniList 收据](live-contract.json)
- [Bangumi 收据](bangumi-contract.json)
- [收据和清理检查](verification.json)
- [不发起账号请求的复核程序](verification.py)

本轮只说明这两个既有应用、当前客户端认证方式及实际服务行为。没有证明平台的其他客户端类型也相同，没有核验全部错误、撤销、token-status、跨应用配置或新 relay 的真实部署。Google 的来源依据另见[协议合同](../../../design/projects/oauth-relay/providers.md#protocol-providers)。

## 对已确认设计的影响

客户端到 relay 的 S256 仍是必需合同，校验失败不得领取本次 code。relay 到这两个上游则按已验证的原生授权码、应用秘密和 state 交接，不把上游 S256 当作已经提供的保护；Google 继续按其有依据的 S256 能力处理。适配明确各来源的正常行为，不在运行失败后尝试另一种认证方式。

原来的[受控上游对照](../oauth-relay-protocol/protocol.md)已经说明，本地 verifier 校验不能独立证明上游 code 与某次授权请求的绑定。真实结果没有改变这一边界，也没有提供理由把第二种 relay 授权码、JWE 或新的持久状态写成可以自动补齐上游保护。若要求所有来源都提供强制的上游 S256 绑定，需要重新讨论来源能力和支持约定，当前设计不作这项保证。

这项原先未知的设计事实已经得到明确结果。公开 HTTP 与配置合同保持已确认状态；完整 provider 实现、错误和附加令牌操作、容器及真实部署消费继续按各自范围完成。
