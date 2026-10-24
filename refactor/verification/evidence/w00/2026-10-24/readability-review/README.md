# W00 可读性与注释复核

后续经确认，独立 ffprobe 路线已移除。本页保留当时输入和实测结果，当前实现以实施状态中的最新记录为准。

本轮针对连续密集的流程和泛泛的保证式注释进行整改。原有规范已经要求语义分段、明确职责和具体调用合同，问题主要在实现执行。补充的规范说明了格式工具与可读性审查各自的作用，以及限制类注释应交代的触发条件、实际结果和责任归属；注释覆盖范围沿用既有规则。

启动流程现在分别处理运行输入、共享宿主和窗口生命周期；窗口创建、挂载就绪与关闭订阅由窗口模块负责。开发会话分开了 Electron 进程管理与候选构建，资源和打包流程分开了编译器准备、归档、配置、格式生成与收据写入。其余工具和测试辅助按实际步骤分段，移除了重复内部结构校验及通用的保证式注释，多行控制流使用代码块。

同时修正了开发启动中的隐藏窗口参数。开发回归增加 Windows 窗口可见性检查，原有编译失败保留、修复交接、改名、HMR、公共包刷新和停止清理继续通过。旧 `windows-x64.staging-HEGI26.previous` 目录已经用不带 `-Force` 的命令清理，并确认不存在。

## 验证结果

本次 Windows x64 构建标识为 `0cc2ad9eef424826a7a8d028b3d46a5d63b30e74d8cd6870cbca24a7d0a28d3d`；实际源码身份与 [desktop-build.json](desktop-build.json) 一致。记录环境沿用[初次验证](../README.md#实现与环境)。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `pnpm check` | 47 项类型任务及根类型检查、边界、lint、格式、21 项常规测试通过 | [check.log](check.log) |
| 最终 lint 与格式复核 | 通过；163 模块、280 项依赖 | [lint.log](lint.log)、[format.log](format.log) |
| 八包 tarball 与仓库外消费者 | publint、ATTW 和 2 项真实消费者用例通过 | [输入](package-inputs.json)、[结果](consumer-tests.json) |
| 实际开发会话 | 通过，包括 Windows 窗口可见性 | [development-test.json](development-test.json) |
| Electron 四窗口 | 4 项通过 | [e2e.json](e2e.json) |
| Electron 原生与 SQLite | 8 项通过 | [native.log](native.log) |
| Windows 打包与 ZIP 运行 | NSIS 和 ZIP 生成；ZIP 资源、fuses、显示和正常关闭通过 | [制品清单](artifacts.json)、[运行结果](artifact-test.json) |
| 20 次新进程启动与退出 | 通过；P95 599.39 ms，中位数 500.97 ms；已观察到的子进程均退出 | [performance.json](performance.json) |
| ffprobe 配方重构后重建 | 与原 r3 归档 SHA-256 相同 | [media-build.log](media-build.log) |

ffprobe 归档摘要仍为 `94612aac90b8fbe3183ba1fb37469ff14cc5511a3557378eae0bd2926ba53b7a`。性能仍只覆盖 W00 外壳、热磁盘缓存和隔离资料目录；NSIS 尚未执行安装、更新和卸载验收。

W00 的跨平台和远端归档门槛继续保持未完成。[接续方案](../../../../../implementation/w00-remote-handoff.md)已改为可先使用临时私有仓库完成验证，旧公开仓库的存档与同名重建单独安排。当前没有创建或推送临时库。
