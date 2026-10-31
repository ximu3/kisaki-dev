# @kisaki3/ui

本包提供 Solid 1.9 的 Button、TextField、Dialog 和 TanStack Virtual 的通用几何入口。Solid 作为 peer；消费者加载 appearance/styles.css 与组件样式，无需 Tailwind 构建链。

## 公开入口

| 导入路径                 | 内容                                   |
| ------------------------ | -------------------------------------- |
| `@kisaki3/ui`            | 按钮、文本字段、对话框组合及虚拟几何。 |
| `@kisaki3/ui/styles.css` | 已编译的组件样式。                     |

```tsx
import { Button } from '@kisaki3/ui'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'
```

按钮默认 `type="button"`；文本字段保持标签、描述与错误的无障碍关联。Dialog 基于 Kobalte，管理焦点、关闭请求和焦点恢复；受控模式由调用方更新 `open`。虚拟视图直接使用 `createVirtualizer`，数据加载、真实行身份、选择和滚动锚点由视图拥有。

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
