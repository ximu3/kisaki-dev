# CI 工程边界、测试职责与验证粒度

2026-10-28。PR #3 与 PR #4 已按用户授权合并。按随后讨论的工程边界和用户确认的测试职责复核，现已落实下述工作流组织与用例归属。平台任务内部合并运行、开发和制品步骤，实际测试范围仍由输入选择；具体测试取舍及本机结果见[开发测试职责复核](development-tests.md)。该实现已通过 [PR #5](https://github.com/ximu3/kisaki-dev/pull/5) 合并为 d949e36。随后发现的命令作用域、消费者路由与扩展输入问题另见[脚本与跨域边界审查](../../script-domain-audit/2026-10-28/README.md)，本页保留本轮采用与验证的范围。

## 推荐组织

```text
.github/workflows/
├── ci.yml
├── verification.yml
├── verification-repository.yml
├── verification-desktop.yml
└── pr-title.yml

config/turbo/
└── verification.graphql

clients/desktop/app/
├── tools/
│   ├── build/
│   ├── dev/
│   └── package/
├── tests/
│   ├── browser/
│   ├── e2e/
│   ├── tools/dev/
│   ├── performance/
│   └── artifacts/
└── config/
    ├── vitest/
    └── playwright/
```

目录图列出本次有关部分。前两份 workflow 和标题检查保留既有职责，新增两份实际拥有验证流程的可调用工作流；应用工具、测试与配置继续由应用拥有。

| 文件                        | 责任                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| ci.yml                      | 接收事件，区分代码与元信息修改，控制代码运行的取消与并发，传入比较基线、目标提交和完整验证请求。 |
| verification.yml            | 调用仓库与各实际工程的验证工作流，汇总选择与执行结果，拥有唯一 Required checks。                 |
| verification-repository.yml | 工作区常规检查、边界检查和跨包制品消费者；拥有这些检查的输入判断、参考环境和报告。               |
| verification-desktop.yml    | 桌面检查选择、目标矩阵、环境准备以及各目标的完整验证流程，包含桌面浏览器交互。                   |
| pr-title.yml                | 独立检查 PR 标题，保持与代码验证分离的取消边界。                                                 |

GitHub 要求 workflow 文件直接位于 .github/workflows，不能以子目录表达工程归属。因此采用 verification-<工程>.yml 命名，由原生 workflow_call 连接。参考 [GitHub 可调用工作流](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)。

## 边界和执行关系

根协调层传递 Git 基线、目标提交与完整验证请求，不拥有 Electron 版本、桌面平台列表或具体测试类别。各验证工作流沿所属工程的真实依赖和输入决定应执行内容；当前 Node 工作区继续查询 Turbo，不建立另一份包依赖图。

仓库检查和桌面范围选择可以同时开始。桌面平台任务在自己的范围选择完成后启动；每个实际目标只有一条验证流程，内部按选中的范围执行浏览器、原生、窗口、开发、性能、打包与最终载体验证。正式应用只构建一次，打包消费已经验证的同一输出；开发测试继续使用隔离工程，并复用已经准备的原生编译输出。

桌面浏览器交互归回桌面工作流，在 Linux x64 参考目标执行一次。只有浏览器检查被选中时，只安排该参考目标；选中具有平台差异的检查时，安排既定六目标。项目内的命令与报告仍分别可用，合并平台任务不意味着每次修改都执行所有检查。

可调用工作流向根层暴露是否选择实际验证以及实际完成标记。根门禁同时要求整个工作流成功；GitHub 的工作流结果覆盖所有矩阵子任务，完成标记区分矩阵已经执行与按选择跳过。选择为 true 时必须有完成标记，选择为 false 时必须没有该标记；失败、取消和缺失选择均不转成成功。当前 actionlint 1.7.12 不识别 jobs.<id>.result 输出表达式，因此采用它与 GitHub 均支持的普通任务输出，没有关闭相应检查。已有必需检查名称 verify / Required checks 与 PR title 保持稳定。

各验证工作流拥有实际安装和任务缓存配置。调用方顶层 env 不会自动传入被调用工作流，已有两分钟可选缓存等待预算必须在实际消费缓存的工作流中保留，见 [环境变量边界](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#limitations-of-reusable-workflows)。

未来 Web、官网或服务端进入实际交付范围时，增加相应 verification-web.yml、verification-site.yml 或 verification-server.yml，并在根协调层明确接入。新增工程自行选择工具链、验证环境和制品流程；当前不创建这些空文件，也不让后续工程继承桌面的六目标和 Electron 准备流程。产品源码、tools、tests 和 config 继续按[工程归属](../../../../design/engineering/layout.md#workspace)放置。

## 方案比较

| 方案                                                   | 收益                                                                                 | 代价                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 仅合并 Development，保留一个完整 verification.yml      | 改动最少，重复环境准备减少。                                                         | 根文件继续拥有桌面选择、平台与运行细节，后续工程容易继续堆入同一文件。                         |
| 按工程拆分工作流，工程内按目标组织完整任务             | 根协调、工程环境与项目命令的责任分开；新工程有明确接入位置；当前六目标复用本机输出。 | 增加两份工作流及少量原生输入／输出连接，必须验证选择、跳过、取消与汇总的连接。                 |
| 按 Build、Runtime、Development、Artifacts 分拆所有任务 | 各阶段独立反馈，构建后可安排多个消费者。                                             | 同一构建需要跨任务传输，增加环境准备与交接；只把 Artifacts 接在整个 Runtime 后面没有并行收益。 |

推荐第二种。文件按维护工程划分，实际执行任务按目标环境划分，步骤表达该环境内的验证阶段。现有实例提供参考而不构成统一模板：[GitHub Desktop](https://github.com/desktop/desktop/blob/development/.github/workflows/ci.yml)在平台任务中组合构建、部分测试和打包；[VS Code](https://github.com/microsoft/vscode/blob/main/build/azure-pipelines/product-sanity-tests.yml)另有消费已发布构建的验收工作流。跨任务文件传递可用 GitHub 原生 artifact，但需要保留可执行文件属性，见[官方说明](https://github.com/actions/upload-artifact#permission-loss)。

## 耗时依据

以下为同一文件树的两次完整 CI，均使用独立托管 runner。数值来自实际步骤起止时间，不用单轮结果推算稳定比例。

| 项目                         | [合并前 40540675151](https://github.com/ximu3/kisaki-dev/actions/runs/40540675151) | [接续后 40619620294](https://github.com/ximu3/kisaki-dev/actions/runs/40619620294) |
| ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Windows ARM64 正式应用构建   | 1 分 13 秒                                                                         | 1 分 7 秒                                                                          |
| Windows ARM64 打包           | 2 分 40 秒                                                                         | 2 分 55 秒                                                                         |
| Windows ARM64 开发回归       | 7 分 37 秒                                                                         | 7 分 20 秒                                                                         |
| 仓库 Chromium 与系统依赖安装 | 7 分 30 秒                                                                         | 24 秒                                                                              |
| 整轮等待                     | 12 分 35 秒                                                                        | 12 分 43 秒                                                                        |
| 累计 runner 时间             | 87 分 35 秒                                                                        | 78 分 5 秒                                                                         |

开发回归包含隔离工程准备、首次构建、源码修改后的重建、构建失败恢复和进程交接，因此部分构建成本计在测试步骤中。首列 Windows ARM64 的构建失败恢复与重命名交接场景约 129 秒，取消初次依赖准备后重试约 107 秒，公共包恢复与 renderer 更新约 96 秒；其余合同检查只有毫秒级耗时。

仓库浏览器准备在第二轮明显缩短，整轮仍由 Windows 开发任务完成时间决定。整轮时长应沿实际依赖与并行关系判断，累计 runner 时间另行记录。按目标合并开发流程后，需要重新测量完整与典型增量运行；已有 4／10／15 分钟工程目标与实际未达值分别报告，不用删减断言或采样满足数字。

## 合并与当前状态

- PR #3 已 Squash 合并为 ba809a014593cce4d5d7674f58e557ceebec40f3。
- PR #4 接到新 main 后的 4313819b096482a3a60d66613edd5921afe423d1 与原 c5ee0b6 的完整 Git 文件树一致；十五项代码检查和标题检查通过，再 Squash 合并为 b015c095ed837497551d25fa3afd6e0f4e2e4ecb。
- 接续运行的六目标测试数量、同一构建复用与十四份附件已核对；原始报告保存在忽略目录 artifacts/ci-unification/2026-10-28/rebase/ci-40619620294。
- 原 Intel Mac 偶发首次启动超时仍未确定原因。上述通过结果不代表已经修复；既有[诊断记录](../../ci-design/2026-10-27/adoption/README.md)继续保留。
- 正式 workflow 已按五文件组织落实，本机核对覆盖工程选择、仅包测试、仅浏览器、仅开发、完整请求、未选中跳过和失败／取消汇总；当前提交的六目标实际运行结果由 PR 检查记录，不能由静态核对代替。
