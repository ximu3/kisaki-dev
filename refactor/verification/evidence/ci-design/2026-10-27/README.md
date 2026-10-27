# CI 编排与反馈时间实测

用户要求明确的 CI 设计方案，并授权由实施者完成实测。本目录记录候选方案的验证，尚不代表正式合同已经采用。基线为 PR #3 的 `ffa1c9de6887b6324348ef85e3cf2db08f6809cf`；其公开仓库完整 CI 为 [40491626331](https://github.com/ximu3/kisaki-dev/actions/runs/40491626331)。

候选方案先用一个选择任务读取现有 Turbo 输入与任务图；仓库检查、六目标运行／打包验证、六目标开发回归随后在各自 runner 并行。开发回归仍使用原有七项场景、隔离副本和正常关闭规则；独立任务只提前准备所需原生编译结果，不构建未被其消费的完整应用。Required checks 核对选择任务、仓库检查及两个目标矩阵的实际结果。

根 `desktop:package` 通过 Turbo 的本包 build 依赖完成准备。应用 package 入口读取既有 `build.json`，核对当前源码身份、目标、完整文件集合与每个文件摘要，再制作各载体；CI 已完成有限构建时直接调用该入口。缺失、过时或变化的输入失败，不自动采用旧文件。ZIP 与 NSIS 等不同载体继续分别写入各自身份。

计划实测完整范围，以及 renderer、公共 UI 包、开发工具、原生源码四类单文件修改。每次记录实际选择、源码提交、runner 的 Node／CPU／内存信息、各任务时长、原始报告与摘要。完整范围保留六目标、每目标二十次启动与正常退出，以及最终载体实际启动。诊断附件只保存报告、回执与公共包，不上传重复的大型桌面候选；这些测量不用于正式发行。

当前尚无候选运行结论。先前 private 仓库与当前 public 仓库的 Windows／Linux 标准 runner 资源不同，不将此前单次耗时直接作为同条件对照。代表性修改用行为不变的源码注释触发真实任务选择与执行，解释其范围时不声称覆盖所有业务改动。

依据：[GitHub 任务依赖](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs)、[原生 YAML anchors](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations)、[Turbo 任务查询](https://turborepo.dev/docs/reference/query)、[公共／私有 runner 规格](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)。[VS Code 的独立 flaky 检测流程](https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-smoke-flaky.yml)展示按平台构建后复用的实践；本实验不沿用其循环次数、continueOnError 或整套调度结构。
