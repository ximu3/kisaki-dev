# 共用工程函数

私有工程包，通过 `/cli`、`/output` 与 `/process` 提供 CLI 信号与退出状态、候选输出交接，以及命令执行和取消。完整工作流仍由根、应用或公共包的 tools 拥有；调用方显式传入取消信号并等待所属资源结束。

消费者声明 workspace devDependency，通过 exports 直接使用 TypeScript 源码，由锁定的 tsx、Vitest 或 Playwright 宿主编译，无需预构建。库源码按 Node 环境独立检查；真实文件系统与命令树测试归本包 tests，普通检查及六目标 CI 都实际执行这些测试。

该包不发布，不进入产品运行依赖、公共包声明或仓库外作者模板。

## 配置文件

| 文件                                                                           | 用途                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------- |
| [tsconfig.json](tsconfig.json)                                                 | 本包的类型检查入口，组织工程函数与测试项目。 |
| [config/typescript/tsconfig.lib.json](config/typescript/tsconfig.lib.json)     | 检查直接供工程宿主加载的 Node 工具源码。     |
| [config/typescript/tsconfig.tests.json](config/typescript/tsconfig.tests.json) | 检查真实文件系统、进程测试及本包工具配置。   |
