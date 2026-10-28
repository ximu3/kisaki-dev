# ESLint 配置

私有工程包，`/base` 提供共同规则和生成目录忽略范围，`/node` 禁止 Node 源码使用浏览器全局，`/tests` 允许 Playwright 要求的空参数对象。各项目的 eslint.config.ts 负责选择规则与本项目文件范围，不在共享配置中识别具体项目名称。

消费者直接声明 ESLint、jiti 与本包的 workspace devDependency，在自身配置中以 import.meta.dirname 绑定 parserOptions.tsconfigRootDir，支持一次检查多个项目的暂存文件。配置按 Node 环境检查；ESLint 使用锁定的 jiti 加载 TypeScript 配置，本包源码直接供工程宿主使用，无需构建。自身通过 typecheck 和 lint 检查，不进入产品运行依赖或公开声明。

## 配置文件

| 文件                           | 用途                                             |
| ------------------------------ | ------------------------------------------------ |
| [tsconfig.json](tsconfig.json) | 在 Node 环境检查共享规则源码与本包 ESLint 配置。 |
