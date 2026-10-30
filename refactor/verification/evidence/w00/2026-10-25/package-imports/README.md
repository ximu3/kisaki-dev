# 包内模块入口与配置归组验证

本轮基于 `93a06c29beddb41b1083549c004ab830fcc29ff5` 的工作区变更，落实已确认的[模块导入规则](../../../../../../CONVENTIONS.md#module-imports)：跨包消费公开 exports，包内稳定入口使用所属 package.json 的 imports，模块内部使用相对导入。范围为工程入口与模块解析，不推进后续业务工作包。

## 实现与边界

应用 package.json 唯一定义 `#native`，指向 `native/node/index.ts`。主进程和原生集成测试共同消费该入口；原生模块内部继续相对导入。两份 TypeScript paths 与 Vite alias 已移除，专用的 tsconfig.boundaries.json 不再承担独立职责，依赖检查直接复用 tsconfig.base.json 的编译选项。

dependency-cruiser 保持上游原版 18.7.0，没有 pnpm 补丁或额外解析器。30 条边界规则逐项保持一致；普通 Node 在应用包内能解析 `#native`，在仓库根包中得到 `ERR_PACKAGE_IMPORT_NOT_DEFINED`。完整[依赖图](dependency-graph.json)包含 161 个模块、283 条依赖，与调整前仅差 Vite 配置已删除的 node:url 引用，见[对比](graph-comparison.json)。

原生入口的命名不授予跨进程访问权限。四项[违规导入用例](boundaries.json)继续验证进程隔离、renderer 的 Node 限制、私有原生能力的 main 限制和包私有源码边界；用例中的包内映射来自真实应用 manifest。

根工具、配置和测试三个类型项目归 config/typescript，消费者测试配置归 config/vitest；默认入口和共享基线保留在根目录。此前使用依赖补丁的中间方案已撤销，其[历史记录](../../2026-10-24/root-config-layout.json)不代表当前实现。

## 实测结果

环境为本机 Windows 10 x64、Node 24.11.1、Electron 44.5.1。构建标识为 `a448219d7697bb7dae0ebed6172746b29a1c91725a29278a10c514b7fcc05d1d`。

| 验证 | 结果与证据 |
| --- | --- |
| 全仓普通检查 | [通过](check.log)，含类型、lint、格式、根工具 15 项与应用 Node 10 项 |
| 编辑器项目归属 | [3 个入口及消费者](editor-projects.json)归属正确，语义诊断为 0 |
| 真实目标构建与打包 | [通过](package.log)，生成 Windows x64 ZIP、NSIS 及对应元数据 |
| Electron Node 模式原生／SQLite | [8 项通过](native.json)，原生用例经 `#native` 消费实际入口与绑定 |
| Electron 四窗口 | [4 项通过](e2e.json) |
| 开发会话 | [通过](dev.json)，包含 imports 映射失败时保留旧进程、恢复后重新交接，以及既有配置、源码、HMR 和清理回归 |
| 最终 ZIP 载体 | [通过](artifacts.json)，核对摘要、ASAR、正式 fuses、实际窗口和正常退出 |

主进程产物不包含 `#native`，生成的运行 package.json 不带源码 imports 映射。主进程代码与本机调整前的产物逐字节比较，仅构建标识不同；构建、资源和逐文件摘要见[构建清单](desktop-build.json)，各项核对见[汇总](summary.json)。

首次打包在完成编译后替换输出目录时返回 Windows `EPERM`，旧输出已完整回滚，未发现相关应用进程或目录权限异常。保持代码不变的下一次相同命令通过；保留[首次日志](package-first.log)，没有添加自动重试或忽略失败的逻辑。

## 制品留存与范围

四个制品及更新元数据文件共 279,510,358 字节，已复制至本地 `artifacts/w00/package-imports/a448219d7697bb7dae0ebed6172746b29a1c91725a29278a10c514b7fcc05d1d/`，逐份 SHA-256 与[构建回执](artifact-receipt.json)一致，见[归档回执](archive.json)。该目录由 Git 忽略，后续本机构建不会覆盖此归档。报告文件摘要见[清单](files.json)。

本轮取得 Windows x64 的实际运行证据；候选为 test-only，NSIS 已生成但未安装验收。没有把本轮记作六目标 CI、正式签署、公证、安装升级或其他运行后端的完成证据。此前六目标 CI 对应其记录的基线提交，当前状态见[实施状态](../../../../../implementation/status.md#w00)。
