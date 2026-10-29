# 合并前代码与标题验证

2026-10-29，用户确认日常代码与标题验证在 PR 合并前完成，保留严格主线保护及手动完整验证。主线推送不再启动普通 CI。

## 采用方案

- `ci.yml` 接收 GitHub 默认 PR 事件和 `workflow_dispatch`：PR 按相对目标分支的全部改动选择任务，手动请求完整范围。
- `pr-title.yml` 专门检查 PR 标题，保留原有事件、准备步骤、取消组及 `PR title` 检查名称。
- `verification-repository.yml` 专门执行仓库代码检查，提交标题步骤随主线自动验证移除。
- 合并前仍要求分支包含最新 main，且 `verify / Required checks` 与 `PR title` 均通过；管理员也遵守，审批人数保持 0。
- Squash 使用已检查的 PR 标题作为默认值，最终标题由合并者确认；合并界面的手动改写仍须遵守提交规范。

合入后的标题检查只能事后报告，不能阻止提交进入主线。当前没有独立的事后审计交付，因此没有保留该步骤或多事件标题工作流。正式规则见[协作合同](../../../../../design/engineering/workspace.md#collaboration)。

## 验证范围

最终的 PR 标题工作流与任务图用例恢复为主线基线 `c6a7bc7` 的内容。保留此前[PR 元信息编辑与门禁验证](../ci-gate/README.md)的适用结果；本轮继续核对实际 PR 的必需检查，以及完整代码验证的选择与结论。

工作流语法检查通过，事件清单和文件内容对照见 [event-routing.json](event-routing.json)。正式入口不含 `push` 事件，PR 事件和手动入口各自保留规定范围。当前 PR 的运行记录由 GitHub 检查和任务附件保存，不以已取消运行作为通过证据。

## 候选试验

曾验证仅在 main push 检查最终提交标题的候选。隔离推送中的合法输入通过、非法输入按预期失败，但这一结果只证明技术路径可执行，未构成保留该功能的需求依据。工作流、日志和结果保存在[候选验证](title-check-exploration.md)中，不作为现行入口合同。

候选提交 `c45c270` 的代码运行 [40820105008](https://github.com/ximu3/kisaki-dev/actions/runs/40820105008)按用户暂停讨论的要求取消，未计为完成；同一提交上的 PR 标题检查通过。

## 缓存范围

main 不再通过每次合并的代码验证刷新 Turbo 构建缓存。[GitHub 缓存作用域](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)继续适用：PR 缓存属于各自合并引用，不能当作另一 PR 的主线缓存。未命中时按正常任务构建，主线上的显式完整验证可更新其缓存。未增加缓存迁移或预热任务。
