# 共用工程函数

私有工程包，通过 `/cli`、`/errors`、`/output` 与 `/process` 提供 CLI 信号与退出状态、错误传递、候选输出交接，以及命令执行和取消。完整工作流仍由根、应用或公共包的 tools 拥有；调用方显式传入取消信号并等待所属资源结束。

消费者声明 workspace devDependency，通过 exports 直接使用 TypeScript 源码，由锁定的 tsx、Vitest 或 Playwright 宿主编译，无需预构建。库源码按 Node 环境独立检查；真实文件系统与命令树测试归本包 tests，普通检查及六目标 CI 都实际执行这些测试。

`runPnpm` 与 `readPnpm` 从 `npm_execpath` 取得启动当前项目任务的 pnpm，因此调用它们的工具或测试通过 pnpm 项目脚本运行。普通命令使用 `run`，由调用方明确提供可执行文件和参数。

命令终止请求失败时立即输出诊断，继续等待实际进程及输出流关闭，再向调用方抛出错误。等待期间仍保有输出的使用权，避免上层提前清理活跃命令正在使用的文件。

该包不发布，不进入产品运行依赖、公共包声明或仓库外作者模板。

`isCancellation` 只识别指定信号的实际取消原因及 Node 的 AbortError 包装；同时发生的其他错误继续报告。`rethrowAfterCleanup` 等待失败操作所属的清理完成，再抛出原始错误；清理也失败时聚合两项错误，`errors` 按原始错误、清理错误排列。

`kisaki-package pack` 通过 pnpm 生成当前工程的 `out/package/package.tgz`，成功后才替换旧制品；`kisaki-package check` 对同一文件运行 publint 和 ATTW，读取所属工程的 ATTW 配置。Turbo 拥有 build → pack → check:package 的关系，包脚本只执行对应动作。CLI 取消不会隐藏实际清理失败。
