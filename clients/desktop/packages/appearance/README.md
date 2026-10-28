# @kisaki3/appearance

本包提供 45 项视觉 token、亮暗默认值、普通 CSS 与 Tailwind 4 映射。宿主管理字体资源；视觉词表、默认值与样式使用同一份定义。

## 公开入口

| 导入路径                           | 内容                                |
| ---------------------------------- | ----------------------------------- |
| `@kisaki3/appearance`              | 视觉 token 词表、类型及亮暗默认值。 |
| `@kisaki3/appearance/tokens`       | token 词表和类型。                  |
| `@kisaki3/appearance/styles.css`   | 可直接加载的默认样式。              |
| `@kisaki3/appearance/tailwind.css` | 供 Tailwind 4 构建使用的可选映射。  |

默认色值由 `src/defaults.ts` 维护。构建从同一份已编译导出生成 `dist/styles.css`，CSS 与 JavaScript 消费者使用一致的默认值。

根元素的 `data-color-scheme="dark"` 选用暗色默认值；未设置时使用亮色默认值。

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

## 配置文件

| 文件                                                                           | 用途                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [tsconfig.json](tsconfig.json)                                                 | 本包的类型检查入口，通过 references 组织源码和工程项目。     |
| [config/typescript/tsconfig.lib.json](config/typescript/tsconfig.lib.json)     | 检查本包源码，并为声明构建提供类型配置。                     |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json) | 使用 Node 类型基线检查本包构建工具与根目录 TypeScript 配置。 |

本包采用 MIT。包职责与公开边界见[公共包合同](../../../../refactor/design/engineering/workspace.md#contracts)，实现与交付状态见[实施状态](../../../../refactor/implementation/status.md)。
