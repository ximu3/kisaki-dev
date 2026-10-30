# @kisaki3/ui

本包提供 Solid 1.9 的 Button 和可直接加载的 styles.css。按钮保留原生属性与浏览器交互语义，默认 type 为 button。Solid 作为 peer；消费者加载 appearance/styles.css，无需 Tailwind 构建链。

## 公开入口

| 导入路径                 | 内容                        |
| ------------------------ | --------------------------- |
| `@kisaki3/ui`            | Button 组件与 ButtonProps。 |
| `@kisaki3/ui/styles.css` | 已编译的组件样式。          |

```tsx
import { Button } from '@kisaki3/ui'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'
```

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
