# W00 工程与测试入口验收

本页汇总已合入主线 `58e25791a0869fa17e3418c2b03d7fa00a444f84` 的工程验收。实现来自 [PR #14](https://github.com/ximu3/kisaki-dev/pull/14)，最终提交为 `0832f76df8fa46f2a88b49a10f990f84fe14431f`，运行日期为 2026-10-30。工作包范围与当前进度见[实施状态](../../../implementation/status.md#w00)。

## 六目标运行

[最终提交的 CI](https://github.com/ximu3/kisaki-dev/actions/runs/41036094212)与[标题检查](https://github.com/ximu3/kisaki-dev/actions/runs/41036460776)均通过。CI 从创建到完成用时 21 分 12 秒，覆盖仓库检查、Windows／macOS／Linux 的 x64 与 arm64，以及 `verify / Required checks` 汇总门禁。

| 范围 | 已取得的结果 |
| --- | --- |
| 工程检查 | 类型、lint、依赖边界、格式与普通 Node 测试通过。 |
| 六个桌面目标 | 原生架构构建、Electron Node ABI、窗口、20 次启动及退出采样、开发会话和候选载体验证通过。 |
| 公共包与浏览器 | Linux x64 完成八包仓库外 tarball 消费、声明与 CSS 检查，以及真实浏览器验证。 |
| 制品交接 | 打包消费同一目标已验证的构建，核对输入身份、资源摘要及生产 fuses。 |

## 本机专项验证

Windows 10 22H2 x64，Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、Electron 45.0.0。以下为 2026-10-30 的最终结果，详细输入与原始报告可在 [PR #14 的固定提交](https://github.com/ximu3/kisaki-dev/tree/0832f76df8fa46f2a88b49a10f990f84fe14431f/refactor/verification/evidence/w00/2026-10-30/source-quality)查阅。

| 检查 | 结果 |
| --- | --- |
| 常规检查 | 50 项类型任务、54 项 lint／依赖任务、格式检查及 54 项普通 Node 测试通过。 |
| 配置与源码说明 | 118 份配置去除重复概述后，代码或解析值等价；143 份自维护源码保留文件概述。 |
| 干净副本 lint:fix | 从八包均无 dist 的状态运行，50 项任务通过，缓存命中为 0，源码没有产生修改。 |
| 实际 Electron | 四类窗口入口及双窗口寿命回归共 5 项通过；第二实例处理随启动窗口关闭撤销。 |
| 开发会话 | 退出与取消、失败重建、代际交接、公共包恢复、renderer 更新及初次准备取消共 4 项通过。 |
| 启动与退出 | 20 次采样通过；启动中位数 516.67 ms、p95 581.13 ms，观察到的进程正常退出。 |

W00 交付工程入口及其基础运行。正式业务、独立项目、签署、全部安装升级形态和跨文件系统平台组合仍由各自工作包验收；上述结果不扩大其完成范围。

## 工程依据

- [CI 范围、反馈时间与合并门禁](ci.md)
- [Node 构建与依赖解析](build-tools.md)
- [开发监听与隔离副本](development.md)
- [声明检查分工](declaration-checks.md)

材料按[当前用途](../../../design/engineering/documentation.md#evidence)维护，变更经过与旧运行记录由 Git 历史和 PR 承载。
