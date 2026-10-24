# oauth-relay

oauth-relay 是基于 Node 与 Hono 的独立、单实例授权中转服务。它提供通用服务协议与上游适配，不拥有用户资料库或 Kisaki 业务模型。

| 主题                                                          | 内容                                            |
| ------------------------------------------------------------- | ----------------------------------------------- |
| [公共协议](protocol.md)                                       | HTTP、参数、回调、错误、短期会话与配置          |
| [配置结构与示例](protocol.md#protocol-configuration)          | JSON schema、部署字段与启动校验                 |
| [上游适配](providers.md)                                      | Bangumi、AniList、Google、响应校验及 HTTPS 传输 |
| [构建与部署](deployment.md)                                   | 产物、Compose、停止与发行验证                   |
| [Kisaki 消费](../../extensions/private-data.md#authorization) | loopback、账号核验及凭据原子采用                |

设计核对与试件见[验证记录](../../../verification/evidence/README.md#oauth-relay)。

<a id="scope"></a>

## 服务职责与执行边界

oauth-relay 在独立仓库维护 TypeScript、Node 和 Hono 工程，对外交付 HTTP 协议与服务制品。它是单实例中转服务，不依赖 Kisaki 的 desktop-contracts、扩展 SDK、账号或资料模型。应用注册、上游协议与当前授权操作各有独立含义：

| 边界             | 拥有的事实                                                           |
| ---------------- | -------------------------------------------------------------------- |
| application 配置 | 接入应用、其上游 client_id、秘密的环境引用、允许权限和客户端回调规则 |
| provider 实现    | 固定上游端点、请求编码、客户端认证方式、PKCE 能力和实际协议差异      |
| 短期授权会话     | 本次请求与回调的关联、PKCE challenge、到期和一次性交换状态           |

每个 application/provider 组合分别保存自己的上游登记与秘密，provider 按本次接入取得相应配置。application 标识静态应用接入，用户授权由来源流程处理。

服务的长期输入为部署配置与应用凭据。用户 access token、refresh token 由调用者保存，relay 仅在当次转发中使用；短期授权状态保存在当前进程内，随会话结束或进程退出释放。

<a id="source"></a>

## 源码与工程目录

    oauth-relay/
    ├── Dockerfile
    ├── .dockerignore
    ├── compose.yaml
    ├── .env.example
    ├── config.example.json
    ├── src/
    │   ├── server.ts
    │   ├── app.ts
    │   ├── config.ts
    │   ├── protocol.ts
    │   ├── authorization.ts
    │   ├── tokens.ts
    │   ├── sessions.ts
    │   ├── transport.ts
    │   ├── errors.ts
    │   ├── log.ts
    │   └── providers/
    │       ├── registry.ts
    │       ├── oauth.ts
    │       ├── bangumi.ts
    │       ├── anilist.ts
    │       └── google.ts
    ├── tools/
    ├── tests/
    │   ├── http/
    │   ├── providers/
    │   ├── consumers/
    │   └── fixtures/
    ├── docs/
    │   └── deployment.md
    └── release-notes/

| 模块          | 责任                                                           |
| ------------- | -------------------------------------------------------------- |
| server        | 启动配置检查、依赖装配、Node 监听、停止接收与进程收尾          |
| app           | Hono 路由、HTTP 输入与输出接入、请求限制及统一错误回复         |
| config        | 读取并验证应用注册、部署参数和秘密引用，生成本次启动使用的配置 |
| protocol      | 公开参数与结果的定义和编解码、协议值校验、回调规则及 PKCE 规则 |
| authorization | 创建授权请求、构造上游跳转、接纳回调并决定向客户端交付什么     |
| tokens        | 校验并领取授权码交换、刷新及已明确支持的令牌操作               |
| sessions      | 短期状态、索引、阶段转换、期限、容量及一次性交换领取           |
| providers     | 实际上游协议及小型差异适配                                     |
| transport     | 上游 HTTP 请求、超时、取消、响应大小与连接资源                 |
| errors / log  | 安全错误分类与所属边界的运行记录                               |

app 创建 Hono 应用而不监听端口，server 承担 Node 运行入口。测试可以通过真正的 HTTP 接入调用应用，也可以使用 Hono 的 Request/Response 测试入口。业务模块不接收 Hono Context，不由请求对象持有会话表或解析来源差异。

authorization、tokens 和 sessions 在同一个服务内协作，通过普通参数装配。sessions 管理会话及 code 状态，tokens 组织令牌操作，provider 按来源合同执行上游请求；会话表和客户端回调由服务本身管理。

正式实现与联合消费按[验收场景](../../../verification/scenarios/oauth-relay.md#relay)核对。
