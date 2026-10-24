# @kisaki3/extension-sdk

当前通过 extension-api 集中提供作者所需的错误类型，不依赖 desktop-contracts 私有或直接入口。Node 与 Webview 运行接入尚未交付，沿 W03、W08 实现。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm pack` 生成 `out/package.tgz`；`pnpm test:consumers` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/consumers` 验证。

本包采用 MIT；正式合同与后续范围见 [工作包](../../../../refactor/implementation/work-packages.md)。
