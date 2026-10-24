# @kisaki3/desktop-contracts

当前包根与 errors 入口提供 ErrorSummary 和 ExecutionFailure<Result>，遵循 communication.md。完整领域值与操作由 W01 实现；数据库、Electron 与业务实现不进入本包。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm pack` 生成 `out/package.tgz`；`pnpm test:consumers` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/consumers` 验证。

本包采用 MIT；正式合同与后续范围见 [工作包](../../../../refactor/implementation/work-packages.md)。
