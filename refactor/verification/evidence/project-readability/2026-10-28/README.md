# 全项目可读性与编码风格审查

基线为已合并 PR #9 的 `db217ce32007edf96069eb9e6406633bcf0e1b78`。本轮审阅代码、模块与目录组织、命名、配置、任务及文档，并将可读性和编码风格列为核心准则与交付门槛。

## 范围与结论

基线的 684 份维护输入全部覆盖；增加两份有实际调用者的验证辅助后，当前为 **686 份输入，其中 220 篇 Markdown**。逐文件处理、理由和当前摘要见 [coverage.json](coverage.json)。许可证、锁文件和二进制资源核对原生组织、命名及归属，保留原字节；3,887 份历史证据不随文字整理改写。

| 范围 | 主要结果 |
| --- | --- |
| 核心规则与交付入口 | AGENTS、CONVENTIONS、设计入口、工作包和验收突出可读性及编码风格；完整规则归工程规范，入口通过链接接续。 |
| 领域与界面 | 53 篇逐项审阅；完整操作从宽表格转为按拥有者组织的小节，长主题按用户任务分段，保留规则、API 与锚点。 |
| 扩展 | 42 篇设计、33 个工程的 198 份文件及 registry 说明逐项核对；调整 10 篇设计的导航、标题和分组，工程身份与支持范围保持。 |
| 独立项目 | 35 份设计及正式输入逐项核对；15 篇文档改善接口、生命周期、分发和接入的查找路径，JSON、补丁及公开合同保持。 |
| 公共包与工程代码 | 八包 README 明确当前公开入口；九个私有校验/连接函数改为表达动作的名称。代码、CSS、配置和测试按实际语义步骤分组。 |
| 实施与验收 | 16 篇按任务审阅，6 篇整理章节；译本重复描述按 22 组信息逐项对应，R/W/A、33 项交付及平台要求保持。 |

审查同时检查正常流程、状态变化、失败、取消和清理。空行表达输入与守卫、准备、执行、交接和收尾的转换；相关操作保持相邻。状态自增改为独立语句，三处 CLI 先命名操作结果再输出。现有内聚模块、短工具、语言习惯及具有真实差异的目录继续保留。

## 文件职责的确认

| 文件 | 职责与选择依据 |
| --- | --- |
| `tests/support/development-controller.ts` | 原 `development-session.ts`，在测试侧启动、观察并关闭子进程，对应 `startDevelopmentController`。 |
| `tests/support/development-worker.ts` | 原 `development-controller.ts`，在子进程内执行真实开发会话；与现有 `preparation-worker.ts` 的执行角色一致。进程及文件数量保持。 |
| 根 `tools/host-environment.ts` | 两个工作流的三个步骤共用 Node、系统、架构、CPU 和内存记录；按共同工程能力归根工具。 |
| 桌面 `tests/support/build-reuse.ts` | 在运行测试前记录构建，在打包后核对清单摘要、修改时间和载体引用；按桌面验证职责归测试辅助。 |

上述命名和归属经用户确认。CI 保留触发、选择、矩阵及执行顺序；实际程序使用所属 TypeScript 入口。环境工具变化请求两个调用工作流的完整验证，构建复用辅助变化请求桌面工作流的完整验证。后者由 CI 声明编排输入，`test:artifacts` 没有虚列不执行的辅助文件。

这项取舍依据现有拥有者、真实复用和阅读路径。可读性的审查维度参考 [Google 工程审查指南](https://google.github.io/eng-practices/review/reviewer/looking-for.html)；语言命名差异核对 [Rust API 命名指南](https://rust-lang.github.io/api-guidelines/naming.html)。这些资料提供审查依据，具体边界仍由本工程的调用与职责决定。

## 验证

- 全仓 `pnpm check` 通过，包含类型、lint、格式、依赖边界与 53 项常规测试。
- 73 份改动 TypeScript/TSX 文件在逐项归一化已审阅的私有命名、文件路径、诊断字段及等价语句后，语法树对照通过；两个抽取入口分别核对输出及执行。见 [code-equivalence.json](code-equivalence.json)。
- 八包 tarball、包结构与声明检查，以及仓库外严格 TypeScript、Node、普通网页和 Solid 消费通过。五份受命名改动影响的公共声明保持原字节。
- Windows x64 四项真实开发回归通过，覆盖退出拒绝、构建失败恢复、源码改名、公共包更新、HMR 和初始准备取消。
- Windows x64 有限构建、NSIS/ZIP 打包及原样 ZIP 外部启动关闭通过。打包保留测试前构建；清单摘要、修改时间和 buildId 分别改变时均被拒绝，见 [report-probes.json](report-probes.json)。
- 文档本地链接与原有显式锚点核对通过，详见 [documentation.json](documentation.json)。代码围栏变化仅涉及五个公共包新增导入示例、工程工具树和原生 build.rs 入口。
- 五份工作流通过 actionlint 1.7.12。选择与汇总逻辑沿实际工作流脚本验证，结果由 [validation.json](validation.json)登记。

运行环境、命令、报告摘要和实际覆盖见 [validation.json](validation.json)。本轮远端结果由交付 PR 的当前提交检查记录；本机结果不替代其他平台执行。正式签署、安装升级、完整产品、四个独立项目与主要运行后端的未完成项继续由[实施状态](../../../../implementation/status.md)维护。
