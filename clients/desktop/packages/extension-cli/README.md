# @kisaki3/extension-cli

当前 config 入口提供 ExtensionBuildConfig 与 defineConfig，供官方扩展配置使用，导入不执行 I/O。kisx 命令、模板和程序化作者工作流由 W08 交付；当前不声明尚未实现的 bin。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm pack` 生成 `out/package.tgz`；`pnpm test:consumers` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/consumers` 验证。

本包采用 MIT；正式合同与后续范围见 [工作包](../../../../refactor/implementation/work-packages.md)。
