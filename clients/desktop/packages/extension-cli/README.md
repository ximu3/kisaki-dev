# @kisaki3/extension-cli

当前 config 入口提供 ExtensionBuildConfig 与 defineConfig，供官方扩展配置使用，导入不执行 I/O。kisx 命令、模板和程序化作者工作流由 W08 交付；当前不声明尚未实现的 bin。

extension 入口现提供 launchDevelopmentApplication：直接启动显式可执行文件，通过 JSON 父子 IPC 等待就绪，传入隔离 profile，并拥有实际进程寿命。stop 可返回 cancelled；exited 只依据进程真实退出，terminate 是调用方明确要求的强制结束。signal 只取消启动，startupTimeoutMs 只限制调用方选择的启动阶段，不限制用户退出决定。config 仍按纯环境检查，extension 的进程实现按 Node 环境检查。

`pnpm build` 在独立候选目录生成代码、声明与适用样式，成功后交接完整 `dist`。`pnpm pack` 生成 `out/package.tgz`；`pnpm test:consumers` 使用 publint 与 Are the Types Wrong 检查这份已完成的 tarball。真实跨包消费由根 `tests/consumers` 验证。

本包采用 MIT；正式合同与后续范围见 [工作包](../../../../refactor/implementation/work-packages.md)。
