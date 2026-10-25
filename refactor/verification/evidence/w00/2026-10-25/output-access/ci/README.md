# 输出访问修正的六目标 CI

## 首次运行与关闭时序

[运行 40195578411](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40195578411)验证提交 `59ab12c74d88bb34054eea419107795445078e08`。六个目标的 8 项系统锁、子进程寿命和缓存恢复用例全部通过。Windows arm64 与 Linux arm64 的四窗口用例在游戏面板的关闭按钮处失败；其余状态见运行记录。

失败发生在 `locator.click()` 的反馈返回前：页面已经关闭，点击通道随之销毁。用例尚未等待之前登记的应用 close 事件，也未执行退出码断言。两端的原始证据为 [Linux 日志](40195578411/linux-arm64.log)、[Linux 报告](40195578411/linux-arm64-e2e.json)、[Windows 日志](40195578411/windows-arm64.log)及[Windows 报告](40195578411/windows-arm64-e2e.json)。失败附件和 trace 保留在仓库忽略的 `artifacts/w00-output-access/ci/40195578411`，下载摘要与 GitHub 回执一致。

用例改为仅在页面已经关闭时接续应用关闭等待，页面仍打开时的点击错误原样抛出；应用退出码必须为 0。没有改变产品退出行为或加入重试。`noWaitAfter` 也已移除：锁定的 Playwright 1.64.1 类型与[官方说明](https://playwright.dev/docs/api/class-locator#locator-click)将其标为弃用，且该参数只控制导航等待，不能保证点击反馈先于 renderer 关闭。

本机以四类窗口各重复 5 次验证最终修改，20 项全部通过，见[日志](40195578411/local-e2e-close.log)和[报告](40195578411/local-e2e-close.json)。本体严格类型检查、该文件 ESLint 与格式检查均通过。此修改只影响测试的完成判定，应用构建身份保持 `2751247a6c187c5473fc49342642c1953483dbd772d887d0b4ade0f25a1ab2ea`。修正后的六目标结果待后续运行。

## 上游工作流维护项

当前固定的 `pnpm/action-setup` 与 `actions/upload-artifact` 在 action 元数据中声明 Node 20，runner 已以 Node 24 执行，并输出运行时迁移提示。GitHub 的[迁移公告](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)说明了这一行为。上游 action 的 `punycode`、`url.parse()` 通知同样保留在原始日志；没有关闭警告或请求使用旧运行时。它们按工作流依赖升级核对版本与缓存、附件接口兼容性，不属于本轮系统锁实现或桌面运行依赖的变更。
