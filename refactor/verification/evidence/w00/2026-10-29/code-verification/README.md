# 合并前代码验证与主线标题检查

2026-10-29，按已确认的单主线协作方式，将日常代码验证放在严格 PR 合并门禁前，main push 仅检查最终提交标题。推送试件的实现输入为 `9b0a194eff8a4e83f515edf06e77f4a7a8305d76`。

## 入口与归属

`ci.yml` 接收默认 PR 事件与 `workflow_dispatch`。PR 比较目标分支与合并候选，手动请求完整范围，继续复用原有工程协调、任务选择和六目标验证。

`title-checks.yml` 共用 Node、pnpm、根依赖准备及 commitlint 规则，分别从 PR 事件读取标题、从 main push 的提交读取标题。工作流显示为 `Title checks`，检查项分别为 `PR title` 和 `Commit title`。必需检查仍是 `verify / Required checks` 与 `PR title`，严格同步、管理员约束和审批人数保持原配置。

仓库验证工作流移除提交标题步骤，任务图回归改用统一标题工作流的路径。main push 不调用仓库或桌面代码验证，标题工作流没有产品构建或安装脚本。

事件及步骤条件使用 [GitHub 工作流原生语法](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)。未增加事件转发、结果复用服务或另一套任务选择机制。

## 本机核对

- actionlint 1.7.12 检查全部工作流通过。
- 修改文件的 Prettier 与 ESLint 检查通过。
- `pnpm root:test tests/tools/structure/tasks.test.ts` 在最终文件名下的两项任务图回归通过，用时 17.83 秒；标题工作流改动不选择桌面验证或包消费者。

最初直接执行 `pnpm exec vitest` 时，任务图用例缺少项目脚本提供的 `npm_execpath`，由 pnpm 调用边界拒绝。随后使用上述正式项目入口通过，没有修改该边界或测试断言。

## 实际推送核对

使用隔离分支 `research/ci-title-events-2026-10-29`，唯一配置差异是把标题工作流的推送分支过滤从 main 换成测试分支。代码验证入口、标题工作流步骤、根依赖和规则与生产候选相同。

试件使用当时的文件名 `commit-titles.yml` 和工作流显示名 `Commit titles`；最终统一为 `title-checks.yml` 与 `Title checks`，并调整独立取消组的名称前缀。内容对照确认事件、权限、检查项名称、准备与校验步骤一致；最终文件名下的任务图回归同样通过。

| 输入 | 运行 | 结果 |
| --- | --- | --- |
| `ci: verify commit title event routing`，提交 `5e5c2c5b388513b0aa3744e9e322be47162fc758` | [40818957784](https://github.com/ximu3/kisaki-dev/actions/runs/40818957784) | 仅有 `Commit title`，最终提交标题检查成功，PR 标题步骤跳过。 |
| `invalid title`，提交 `94a178e62e9eb120dc8d69d6b5dcc33e8f6f26e1` | [40819112109](https://github.com/ximu3/kisaki-dev/actions/runs/40819112109) | 仅有 `Commit title`，由 `subject-empty` 与 `type-empty` 按预期失败，PR 标题步骤跳过。 |

两次推送均未启动代码 CI。验证后删除了本次建立的测试分支；正式分支保留 main 过滤条件。结果与输入摘要见 [verification.json](verification.json)，实际工作流、过滤差异、API 结果及日志见 [verification.zip](verification.zip)。

这些结果验证推送入口和最终提交标题检查，不计作桌面运行或六目标代码验收。PR 标题与代码门禁仍由正式 PR 的必需检查验证，合入主线后的源内容沿用对应 PR 的代码证据。

## 缓存范围

main 不再通过每次合并的代码验证刷新 Turbo 构建缓存。[GitHub 缓存作用域](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)继续适用：PR 缓存属于各自合并引用，不能当作另一 PR 的主线缓存。未命中时按正常任务构建，主线上的显式完整验证可更新其缓存。没有增加缓存迁移或预热任务；pnpm 的依赖缓存仍由实际安装步骤拥有。
