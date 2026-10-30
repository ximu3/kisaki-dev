# ESLint 配置

私有工程包，`/base` 提供共同规则和生成目录忽略范围，`/node` 禁止 Node 源码使用浏览器全局，`/tests` 允许 Playwright 要求的空参数对象。各项目的 eslint.config.ts 选择自身文件范围，共享配置不识别具体项目名称。

`/base` 使用 TypeScript Project Service 读取各源码所属的 tsconfig 及其 references，检查 Promise 使用、判别联合分支和不安全的动态值流动。控制流使用代码块，格式由 Prettier 处理。所选规则由源码配置定义，不启用全部严格或风格规则。

消费者声明 ESLint、jiti 与本包的 workspace devDependency，以 import.meta.dirname 绑定 parserOptions.tsconfigRootDir，使一次暂存文件检查采用各文件自己的类型项目。根 lint 任务通过 Turbo 准备依赖包声明；直接调用 ESLint 时使用已准备的输出，不建立 lint 专用类型项目或源码别名。

`/base` 的具名导出 syntaxOnly 沿用 typescript-eslint 的 disableTypeChecked 配置，用于尚未安装声明依赖的消费者样板。样板在仓库内接受语法检查，在仓库外安装实际 tarball 后接受同一完整基线的类型感知检查。

ESLint 使用锁定的 jiti 加载 TypeScript 配置，本包源码直接供工程宿主使用，无需构建。配置按 Node 环境检查，自身通过 typecheck 和 lint 验证，不进入产品运行依赖或公开声明。
