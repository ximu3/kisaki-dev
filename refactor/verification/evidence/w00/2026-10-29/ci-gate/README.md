# PR 元信息编辑与合并门禁核对

2026-10-29，在 `ximu3/kisaki-dev` 的 PR #11、提交 `5a61f004e16abcd63e99c3d9f37395dccff699de` 上核对原生分支保护的实际合并结果。

## 观察结果

- [代码验证 40729400673](https://github.com/ximu3/kisaki-dev/actions/runs/40729400673)成功，实际选择为仓库检查、六目标构建与性能；`complete=false`，原生、浏览器、窗口、开发、制品、消费者和 tooling 套件未被选中。
- 随后的标题编辑产生[CI 40729511047](https://github.com/ximu3/kisaki-dev/actions/runs/40729511047)。入口 `verify` 被条件跳过，没有展开可调用工作流中的 `verify / Required checks`。
- 用户提供的合并区截图显示一个跳过的 `CI / verify`、一个成功的 `PR title`，以及仍在等待结果的必需检查 `verify / Required checks`。API 同时返回代码检查成功、分支无冲突且未落后主线，以及 `mergeStateStatus=BLOCKED`。
- 仅重跑原代码验证的汇总任务后，该任务再次成功，合并阻塞仍存在。六目标测试的既有结果被复用；这次操作没有修正事件入口。

这说明必需检查成功与分支保护配置读回，尚不足以证明元信息编辑后的合并行为成立。先前[收尾记录](../closure/README.md)中的工程与占用验证仍适用；W00 的当前完成度由[状态页](../../../../../implementation/status.md)记录。

API 核对结果及各运行的任务状态保存在 [before.json](before.json)。

## 原因与约束

`ci.yml` 同时接收代码事件和 `pull_request.edited`，再在调用 job 上区分标题、正文和目标分支变化。跳过整个可调用工作流只产生调用 job 的检查，不能提供必需的内部检查。实际合并区没有采用同一提交上较早运行的成功汇总结果。

[GitHub 的必需检查说明](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)解释了缺失检查与跳过 job 的区别；社区的[可调用工作流实测](https://github.com/orgs/community/discussions/72708)也记录了调用 job 被跳过时，内部必需检查始终等待的问题。

标题和正文编辑应保持独立，不能以空的成功或跳过结果替代失败的代码验证。更换目标分支与编辑元信息共用 `edited` 事件；调整这一处理方式须同步现行[协作规则](../../../../../design/engineering/workspace.md#collaboration)，并验证真实 PR 的检查与合并状态。

## 采用方案

用户确认保留现有严格分支保护：PR、两项必需检查、与最新 main 同步和管理员约束继续成立。`ci.yml` 使用 [GitHub 默认 PR 事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)，移除 `edited` 及调用 job 上对应的筛选条件。打开、源分支提交变化和重新打开会启动实际代码验证；标题和正文编辑只运行 `pr-title.yml`。

常规工作以 main 为目标。更换目标分支后，由重新打开 PR 或源分支的新提交发起新验证。新运行读取新的目标分支；重跑旧运行仍使用原事件的引用，不能替代这一入口。没有加入结果复用层、额外成功检查或自动合并。

本机 actionlint 1.7.12 和配置格式检查通过。实际 PR 的元信息编辑、原代码运行与最终合并状态继续分别核对，结果归本记录。
