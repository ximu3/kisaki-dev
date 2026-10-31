# @kisaki3/extension-api

本包定义扩展可调用的能力、作者类型和 SDK 握手，显式复用 desktop-contracts 中允许扩展消费的纯值。导入不建立运行连接；实际实例、权限和资源寿命由宿主接入负责。

## 公开入口

```ts
import type { ExtensionContext, WebviewContext } from '@kisaki3/extension-api'
import { parseCalendarDate } from '@kisaki3/extension-api'
```

包根提供作者合同与纯值；`/node` 提供 Node 实例合同，`/webview` 提供文档内的有限能力，`/protocol` 提供独立版本的握手消息及校验。Node 能力通过显式方法选择开放，不包含本体的安装、信任、更新管理；Webview 不获得 Node 的私有存储、凭据或任意桌面调用。

扩展作者通常通过 `@kisaki3/extension-sdk` 消费这些合同。业务合同只在拥有包定义，SDK 不复制定义。

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
