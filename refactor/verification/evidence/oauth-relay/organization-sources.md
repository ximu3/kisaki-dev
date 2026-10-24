# oauth-relay 工程组织的协议与框架依据

对应已确认的 [oauth-relay 工程组织](../../../design/projects/oauth-relay/README.md)。本轮读取公开规范、框架说明及上游认证文档，未创建服务仓库、运行新服务、取得或兑换用户凭据，也未检查或切换现有部署。

## 来源与组织判断

[source-probe.py](source-probe.py) 读取十二项官方来源，记录 URL、实际响应地址、HTTP 状态、时间、字节数及 SHA-256；结果见 [organization-source-contract.json](organization-source-contract.json)。文档内容指纹用于复核此次资料，不代替运行依赖、接入配置或上游能力的实际验证。

| 来源                                                                                                                         | 已核对的事实                                                                  | 对组织的影响                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Hono Node](https://hono.dev/docs/getting-started/nodejs)                                                                    | Node adapter 将应用接入 Node HTTP server，监听和服务器关闭需要由宿主处理      | app 与 server 分开，Node 生命周期有明确拥有者                                                                    |
| [Hono 测试](https://hono.dev/docs/guides/testing)                                                                            | 可以向实际应用传入 Request，并检查返回 Response，app.request 提供便捷入口     | HTTP 合同测试使用真正路由；真实端口、代理与浏览器消费另行验证                                                    |
| [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html)                                                                      | 授权请求、回调、授权码兑换及刷新具有各自参数、绑定和错误语义                  | authorization、tokens 负责流程，protocol 维护公开值与编解码                                                      |
| [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html)                                                                      | S256 绑定 challenge 与兑换 verifier；失败后不能自动降级                       | 本次会话保存 challenge，领取交换前核验；客户端到 relay 与上游能力分别解释                                        |
| [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html)                                                                      | 桌面应用可使用回环 IP 与动态端口，公开原生客户端不能被假定能够保密            | application 保存明确回调规则，Kisaki 最后一跳继续使用 loopback                                                   |
| [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html)                                                                      | 重定向匹配、授权响应关联及重放保护需要明确处理，不能只依赖端点命名            | 配置、短期状态和一次性交换各有责任，并保留整条链路的验证要求                                                     |
| [Bangumi 固定认证说明](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/docs-raw/How-to-Auth.md) | 上游授权／token 接入、应用秘密、短 code 有效期与 refresh_token 流程有来源规则 | Bangumi 适配拥有这些差异；实际权限行为以此前真实核验共同判断                                                     |
| [AniList 认证说明](https://raw.githubusercontent.com/AniList/docs/master/docs/guide/auth/index.md)                           | 当前公开说明仍称不提供刷新令牌                                                | 与[此前实际刷新成功](../anime-platforms/live-api.md)的证据并列；实现保留已经验证的能力，不把文档描述当作运行事实 |
| [Google Web OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)                                       | 接入使用登记的客户端、回调、权限及各自 token 操作要求                         | Google relay 适配与 Kisaki 的桌面直连分别核验，不因同一来源名称而混用客户端类型                                  |

部署方式明确为 Docker Compose 后，补充以下三项来源：

| 来源                                                                                                     | 已核对的事实                                                           | 对组织的影响                                                          |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Compose 应用模型](https://docs.docker.com/compose/intro/compose-application-model/)                     | compose.yaml 是推荐的默认文件名，Compose 配置服务、网络与运行输入      | 根目录保留正式 Compose 入口，与镜像构建文件分别拥有职责               |
| [容器环境变量](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) | environment 与 env_file 明确设置容器环境；Compose 插值不能代替容器注入 | .env.example 保存部署参数示例，实际秘密按既定环境引用合同从部署端注入 |
| [Docker 构建上下文](https://docs.docker.com/build/concepts/context/#dockerignore-files)                  | .dockerignore 从发送给构建器的上下文中排除匹配内容                     | 根目录维护忽略规则，真实配置和秘密不进入构建上下文                    |

上述标准提供核对依据，不等于本服务已经满足全部 OAuth 安全目标。尤其上游 PKCE、发送者约束、令牌轮换和撤销能力不能由 relay 凭空补出。Google 文档中的不同客户端认证与令牌保护方式仍须和实际登记配置对应，本轮没有据此替现有应用切换模式。

## 本次实际执行

```powershell
python refactor/verification/evidence/oauth-relay/source-probe.py
```

脚本只读取上述公开材料并检查关键名称存在，没有安装或执行远程代码，也没有访问用户授权或 token 端点。没有构建容器镜像、执行 Compose、运行新的 Hono 服务或进行模拟协议测试。此前 Bangumi、AniList 的来源核验继续引用各自独立证据，不冒充本次新 relay 的验证结果。

本次网页读取未取得现有服务首页的有效内容，不能据此判断服务可用性。真实部署的域名、代理与应用登记按[部署场景](../../scenarios/oauth-relay.md)验证。
