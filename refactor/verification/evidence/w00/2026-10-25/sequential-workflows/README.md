# W00 顺序执行入口验证

本记录覆盖同一工作副本内独立工程任务顺序执行的实现与验证。正式约束见[任务与输出](../../../../../design/engineering/workspace.md#output-access)，当前实施状态见[状态页](../../../../../implementation/status.md#w00)。历史输出锁记录保留原提交与原始结果。

## 实现与范围

根 `tools/outputs` 的九个文件、访问上下文、进程间锁继承、Turbo 计划解释、命令包装及 fs-native-extensions 依赖已经移除。根任务和项目脚本直接调用所属工具，33 个扩展只为包装入口使用的 tsx 开发依赖也已移除；[锁文件差异](dependencies.json)记录实际解析包变化。

根 `tools/lib` 保留三个普通模块：候选交接、显式取消的命令执行，以及 CLI 信号和退出状态处理。它们合计 243 行，含注释和空行，没有项目或输出锁、任务图解释、环境访问上下文或隐式占用。开发依赖查询归本体开发流程，继续通过 pnpm 读取真实项目关系。buildId 使用输入指纹，实际共享工具输入为 `tools/lib`。

跨命令共享读取、独占写入、清理冲突、强制终止后的锁继承和缓存恢复互斥不属于当前工程合同，相应实现、命令、边界规则及测试已撤销。一次任务内部的依赖调度和合法并行由 Turbo 负责；构建、快照、打包和验证按各自工作流顺序交接。

候选准备失败、采用前取消、成功后移除旧文件和输出路径归属仍由真实文件系统测试覆盖。命令取消使用真实父子进程，验证取消完成时两者均已退出。开发取消用例以隔离工作区内的一个受控构建命令替代原来的锁等待，观察到准备进程启动后发出取消，检查进程退出、会话目录清理和完整重启。

## 本机结果

环境为 Windows 10 22H2 x64、Node 24.11.1、Electron 44.5.1。版本为 `0.1.0-dev.0`，构建身份为 `977178e22de00d54f98bfed3a71aa24cc1e62ceb21b4cc62b0fb641637c23813`。425 份维护文件的摘要见[输入记录](inputs.json)，构建内文件与资源摘要见[构建清单](desktop-build.json)。

| 检查 | 实际结果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 通过；[日志](install.log) |
| `pnpm check` | 47 项类型任务、lint、格式、依赖边界通过；根 Node 19 项、本体 Node 9 项通过；[日志](check.log) |
| Rust 检查与 Windows x64 构建 | 通过；[Rust 日志](native-check.log)、[构建日志](build.log) |
| 原生／SQLite 与浏览器 | Electron Node 模式 8 项、Chromium 1 项通过；[原生日志](native.log)、[浏览器日志](browser.log) |
| 四类窗口 | 4 项通过；[日志](e2e.log)、[报告](e2e.json) |
| 实际开发会话 | 失败恢复、改名、HMR、公共包交接、正常关闭与启动取消后完整重试共 2 项通过；[日志](development.log)、[报告](dev.json) |
| 公共包消费 | 八包 publint、ATTW 和仓库外消费 2 项通过；[日志](consumers.log)、[报告](consumers.json)、[包输入](package-inputs.json) |
| 启动测量 | 20 次新进程通过，P95 426.06 ms；[日志](performance.log)、[原始测量](startup.json) |
| Windows 打包 | NSIS、ZIP 生成成功；[日志](package.log)、[制品回执](artifact-receipt.json) |
| 最终载体 | 原样 ZIP 的摘要、资源、正式 fuses、外部启动及正常关闭通过；[日志](artifacts.log)、[报告](artifacts.json) |

普通检查中的 4 项候选与命令取消用例属于上述根 Node 测试。首次检查发现构建身份测试夹具仍创建已删除的 `tools/outputs`，将夹具更新为实际共享输入目录后完整检查通过；构建身份的检查范围和断言保留。

命令起止与退出码见[执行记录](commands.json)，本机汇总见[结果数据](results.json)。四个实际候选、blockmap 和更新元数据文件已留存于仓库忽略的 `artifacts/w00-sequential/977178e22de00d54/windows-x64`，逐文件摘要与制品回执一致，见[归档回执](archive.json)。Windows NSIS 的 Authenticode 状态见[签名记录](windows-signature.json)，没有执行安装或升级验收。

六目标 CI 尚待本轮输入完成运行。性能数据只代表使用热磁盘缓存与隔离 profile 的 W00 工程外壳；完整产品、平台支持下限、正式签署／公证及其他后端仍按所属工作包验收。本轮没有发布应用或公共包。
