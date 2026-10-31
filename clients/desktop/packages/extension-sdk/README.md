# @kisaki3/extension-sdk

本包通过 extension-api 集中提供扩展作者类型和纯值规则，包括 ExtensionContext、领域引用、资料候选、配置、错误及页面私有通信合同。业务操作沿宿主交付的上下文调用；纯入口不建立进程、连接或视图。

## 公开入口

```ts
import {
  parseCalendarDate,
  type ExtensionContext,
  type MetadataProvider,
  type WebviewContext,
} from '@kisaki3/extension-sdk'

const date = parseCalendarDate({ year: 2026, month: 10, day: 31 })
```

## 构建与验证

在本包目录运行：

| 命令                 | 结果                                                       |
| -------------------- | ---------------------------------------------------------- |
| `pnpm build`         | 在独立候选目录生成代码与声明，成功后交接完整 `dist`。      |
| `pnpm run pack`      | 生成 `out/package.tgz`。                                   |
| `pnpm check:package` | 使用 publint 与 Are the Types Wrong 检查已完成的 tarball。 |
| `pnpm typecheck`     | 检查本包源码及工程配置。                                   |
| `pnpm lint`          | 检查本包的工程与源码规则。                                 |

仓库根的 `tests/desktop/consumers` 使用真实 tarball 验证跨包消费。

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
