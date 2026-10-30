# @kisaki3/rpc

包根与 transport 入口提供环境无关的 MessageTransport 类型，定义消息发送、接收、关闭观察与资源释放的接入合同。

## 公开入口

```ts
import type { MessageTransport } from '@kisaki3/rpc/transport'
```

包根也导出同一类型。传输实现按此合同提供发送、接收、关闭观察与释放。

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
