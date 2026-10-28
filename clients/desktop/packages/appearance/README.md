# @kisaki3/appearance

当前提供 45 项视觉 token、亮暗默认值、普通 CSS 与 Tailwind 4 映射，宿主管理字体资源。完整值校验在 W01 交付。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm run pack` 生成 `out/package.tgz`；`pnpm check:package` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/desktop/consumers` 验证。

本包采用 MIT；正式合同与后续范围见 [工作包](../../../../refactor/implementation/work-packages.md)。

默认色值由 `src/defaults.ts` 维护。构建从同一份已编译导出生成 `dist/styles.css`，CSS 与 JavaScript 消费者使用一致的默认值。

## 配置文件

| 文件                                                                           | 用途                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [tsconfig.json](tsconfig.json)                                                 | 本包的类型检查入口，通过 references 组织源码和工程项目。     |
| [config/typescript/tsconfig.lib.json](config/typescript/tsconfig.lib.json)     | 检查本包源码，并为声明构建提供类型配置。                     |
| [config/typescript/tsconfig.tools.json](config/typescript/tsconfig.tools.json) | 使用 Node 类型基线检查本包构建工具与根目录 TypeScript 配置。 |
