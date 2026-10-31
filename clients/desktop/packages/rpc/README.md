# @kisaki3/rpc

环境无关的消息式 RPC 内核。包根提供严格 JSON／有限帧校验、十秒握手、双向并发调用、按请求取消和断连清理；transport 入口定义平台接入合同。内核不读取业务身份，不自动重连或重放写入。

## 公开入口

```ts
import { RpcConnection, RpcError, parseRpcFrame } from '@kisaki3/rpc'
import type { MessageTransport } from '@kisaki3/rpc/transport'
```

创建 RpcConnection 时指定实际拥有的 transport、端点 protocol、发起／接纳角色、明确 methods 和通知表。接纳方校验已绑定上下文，发起方校验 accepted；两方均等待 ready 后调用。端点通过 serializeError／parseError 交付并恢复自己的安全业务失败与合法部分结果；默认转换只保留 RpcError 的安全 code/message，其他异常使用通用失败。

call 的 AbortSignal 在发送前已取消时阻止发送，发送后只请求远端停止，Promise 仍等待真实结果。closed 表示连接已停止交付，不能证明远端回滚；close 可重复调用，会等待本地处理器和通知收尾。传输关闭会结束等待、取消依赖连接的本地调用并释放监听。reportError 负责记录本地通知、序列化和清理失败，不应抛出。

本包纯入口不加载 Node、Electron 或 DOM 运行模块；AbortSignal 与定时器由宿主提供。实际窗口、进程和 MessagePort 的来源、权限、资源及代际由调用方接入层维护。

## 构建与验证

在本包目录运行：

| 命令                 | 结果                                                            |
| -------------------- | --------------------------------------------------------------- |
| `pnpm build`         | 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。 |
| `pnpm run pack`      | 生成 `out/package.tgz`。                                        |
| `pnpm check:package` | 使用 publint 与 Are the Types Wrong 检查已完成的 tarball。      |
| `pnpm typecheck`     | 检查本包源码及工程配置。                                        |
| `pnpm lint`          | 检查本包的工程与源码规则。                                      |

仓库根的 `tests/desktop/consumers` 使用真实 tarball 验证跨包消费。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
