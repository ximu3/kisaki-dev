# CI 事件路由与检查结果验证

2026-10-26，落实[复杂度复核发现的 CI 重复触发问题](../../proportionality/2026-10-26/README.md)。仅编辑 PR 标题或正文不再执行完整代码验证，也不取消正在运行的代码任务；标题继续独立检查。正式规则见[PR、提交与 CI](../../../../design/engineering/workspace.md#collaboration)。

## 实现

ci.yml 仅负责事件路由。PR 打开、提交变化、重新打开、目标分支变化，以及既有主线 push、手动事件调用 verification.yml；标题或正文编辑跳过调用。代码取消组放在调用任务上，跳过调用不会进入该组，也不会生成新的代码汇总检查。

verification.yml 保留原 repository、六目标 desktop 和 Required checks。相对基线 `f3f74f5880f3fd74be63f119a231e38fff4478c1` 的 YAML 对象比较确认：仅移出 PR 标题检查，其余三个任务完全一致，包括依赖选择、缓存、真实桌面、制品与汇总逻辑，见[结构核对](structure-verification.json)。

pr-title.yml 使用独立取消组，复用根 commitlint 与 conventional 配置，以 frozen-lockfile 和 ignore-scripts 只安装根所需依赖。PR 的正文编辑也重新检查当前标题，避免一次跳过结果清除既有标题失败。标题作为环境变量传入命令，不直接拼入 shell。

设计依据为 GitHub 的 [PR 事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)、[可复用工作流调用参数](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#supported-keywords-for-jobs-that-call-a-reusable-workflow)与[任务级并发控制](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)。实际结果以下述运行记录为准。

## 真实事件验证

在现有私有验证库创建[临时草稿 PR #2](https://github.com/ximu3/kisaki-w00-ci/pull/2)，使用独立研究分支。ci.yml 与 pr-title.yml 和正式工作副本逐字节相同，见[source-inputs.json](source-inputs.json)。仅研究分支的 verification.yml 使用[有限替身](probe-verification.yml)：仓库任务等待 90 秒并按提交中的控制值返回成败，桌面任务不被选择，汇总保留相同判断。

| 操作 | 观察结果与运行 |
| --- | --- |
| 打开 PR，令代码验证故意失败 | [40311415895](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40311415895)执行仓库与汇总，最终均失败 |
| 该验证仍在运行时改为无效标题 | 原代码运行继续；[代码入口](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40311542826)跳过，[标题检查](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40311542874)失败 |
| 代码失败后只编辑正文，保持无效标题 | [代码入口](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40311904488)跳过，原代码失败保留；[标题检查](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40311904476)仍失败 |
| 将标题修正为合法 Conventional Commit | [标题检查](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40312212048)成功，原代码汇总仍失败 |
| 推送新的通过控制值 | [40312459620](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40312459620)重新执行代码验证 |
| 该运行期间改变 PR 目标分支 | 旧代码运行取消；[40312533301](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40312533301)重新执行并成功，桌面按未选择跳过 |

原始目标分支事件为 action=edited，changes.base 同时包含原 ref 与 SHA，见[event.json](retarget-event/event.json)。[event-verification.json](event-verification.json)保存检查核对结果；标题、正文、修正标题后的 checks 快照与各次完整作业信息保存在本目录。[最终检查](final-checks.json)的 `verify / Required checks` 与 `PR title` 均成功。验证 PR 已关闭且未合并，见[pull-request.json](pull-request.json)。

## 合并规则与范围

真实检查名称为 `verify / Required checks` 和 `PR title`。当前临时库 main 的 protected=false，rulesets 为空，见[仓库配置快照](repository-rules.json)；没有既有必需检查配置需要迁移，也没有在本次任务中另行开启仓库保护。正式规范已指定这两个检查名，后续启用合并规则时按实际名称配置。

事件替身只证明触发、取消与检查结果保留，不是本体或六目标验证。正式工作副本保留完整验证任务；本次没有推送或合并这些产品修改，也没有等待新的六目标运行。[本机类型、lint 与文档引用核对](local-verification.json)、工作流解析与结构核对通过；所改工作流、配置与用例通过 Prettier 检查，git diff --check 通过。AppImage 行为另见[采用验证](../../appimage-policy/2026-10-26/adoption/README.md)。
