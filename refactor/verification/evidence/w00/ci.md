# CI 范围、反馈与合并门禁

本页记录现行 CI 的采用依据与实际验证。任务归属、选择规则与反馈目标由[工作区合同](../../../design/engineering/workspace.md#collaboration)定义，完整工程验收见[W00](README.md)。

## 输入与执行

PR 按相对目标分支的完整改动选择任务，手动入口请求完整验证；main push 不启动普通 CI。范围选择使用 Turbo 的实际任务图，已选中的确定性构建可以复用缓存，现场运行按任务自身的环境执行。

整个 PR 的比较基线可覆盖前一提交失败或取消后仍待验证的代码。[Turbo 的 affected 规则](https://turborepo.dev/docs/crafting-your-repository/constructing-ci#using---affected-in-github-actions)与 [GitHub 最新提交检查要求](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#required-check-needs-to-succeed-against-the-latest-commit-sha)说明了该边界。PR 缓存按 [GitHub 的作用域](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)使用，未命中时正常构建。

<a id="feedback"></a>

## 反馈时间

采用按目标组织的工作流后，2026-10-28 的[完整运行](https://github.com/ximu3/kisaki-dev/actions/runs/40644428590)用时 19 分 36 秒，累计 runner 时间为 65 分 36 秒。六目标均执行开发会话、窗口、20 次启动采样及最终载体验证。整轮时间包含排队、环境准备和上传；runner 时间是任务时长之和，不等于计费分钟。

| 输入 | 实际运行 | 整轮时间 |
| --- | --- | --- |
| 仅消费者试件 | [40644662277](https://github.com/ximu3/kisaki-dev/actions/runs/40644662277)，只选择 Linux x64 八包消费 | 1 分 49 秒 |
| 仅标题工作流 | [40644668407](https://github.com/ximu3/kisaki-dev/actions/runs/40644668407)，按选择结果跳过桌面矩阵 | 54 秒 |
| PR #14 源码 | [41032668672](https://github.com/ximu3/kisaki-dev/actions/runs/41032668672)，完整六目标 | 18 分 24 秒 |
| PR #14 最终提交 | [41036094212](https://github.com/ximu3/kisaki-dev/actions/runs/41036094212)，完整六目标 | 21 分 12 秒 |

这些是对应输入的实际运行，不能概括为任意修改的稳定耗时。当前 4／10／25 分钟目标中，完整验证的预算依据按目标组织后的运行规模确定；目标与单项测试超时分别维护。

<a id="merge"></a>

## 标题与合并门禁

`ci.yml` 使用 [GitHub 默认 PR 事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)，`pr-title.yml` 独立处理标题。跳过可调用工作流不会提供其内部必需检查，依据见 [GitHub 必需检查说明](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)及[社区复现](https://github.com/orgs/community/discussions/72708)。

2026-10-29 在 PR #11、提交 `51a4130a27a1b65f96f018afda7476212fdacab6` 验证：

| 操作 | 实际结果 |
| --- | --- |
| 代码运行中编辑标题和正文 | 仅新增[标题检查](https://github.com/ximu3/kisaki-dev/actions/runs/40811161631)，原代码运行继续。 |
| 无效标题后编辑正文 | [无效标题](https://github.com/ximu3/kisaki-dev/actions/runs/40812165941)及[正文编辑](https://github.com/ximu3/kisaki-dev/actions/runs/40812274697)均按预期失败，未启动代码验证。 |
| 修正标题 | [标题检查通过](https://github.com/ximu3/kisaki-dev/actions/runs/40812368104)，原代码结果保持。 |
| 代码通过后编辑正文 | 只新增[标题检查](https://github.com/ximu3/kisaki-dev/actions/runs/40812944162)；[代码运行](https://github.com/ximu3/kisaki-dev/actions/runs/40811103983)仍为同一轮，汇总成功。 |
| 严格合并门禁 | 两项必需检查成功，API 返回 `mergeStateStatus=CLEAN`，随后 PR 已合并。 |

main 要求 PR、包含最新主线、`verify / Required checks` 与 `PR title`，管理员同样遵守，审批人数为 0；禁止强推与删除，只允许 Squash。2026-10-31 读回仓库设置，`delete_branch_on_merge=true`，合并后自动删除远端分支已启用。
