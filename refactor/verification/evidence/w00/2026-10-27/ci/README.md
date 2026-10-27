# 当前工程的 CI 验证

本轮经用户授权，在现有私有仓库 ximu3/kisaki-dev 与 [PR #1](https://github.com/ximu3/kisaki-dev/pull/1) 验证当前 W00 工程。Actions 已启用，默认 workflow 权限为 read；没有变更权限、付费设置、仓库可见性或发行状态。额度查询因现有 OAuth scope 不足未取得数据，不解释为无限或零用量。

## 已取得的运行

| 提交与运行 | 实际结果 |
| --- | --- |
| eba5524 · [40447156091](https://github.com/ximu3/kisaki-dev/actions/runs/40447156091) | 固定安装、缓存恢复和范围选择通过；类型阶段长时间未完成，主动取消，普通取消未及时结束后使用 force-cancel。没有六目标通过结果，不能记作源码断言失败。 |
| 61caf5b · [40448497245](https://github.com/ximu3/kisaki-dev/actions/runs/40448497245) | 仓库并发改为两路并使用流式任务日志。50 项类型及依赖任务通过，用时 6 分 58.709 秒；54 项 lint／边界及依赖任务和格式检查通过。本体 19 项常规断言通过，但 renderer fixture 的 afterAll 删除临时目录时发生 ENOTEMPTY，仓库与 Required checks 因此失败，六目标未执行。 |

第二轮的[运行元数据](40448497245/run.json)、[任务状态](40448497245/jobs.json)、[仓库日志](40448497245/repository.log)和[范围选择](40448497245/affected.json)保留原结果。原附件 12710066382 已保存到本地 artifacts/w00-ci/2026-10-27/40448497245/repository-verification.zip，SHA-256 为 3a56eaa1720bf1061b57c76c7bce4ae8353b98b7d12f15215a107692a68231d8，与 GitHub 摘要一致。连接器的临时下载地址在本机无法解析，归档改用 GitHub CLI 原始附件接口。

第一轮资源竞争是诊断假设，没有取得其进程内存或 OOM 证据。两路并发后类型检查完成，不能据此把此前取消直接归因为 skipLibCheck。其后的[声明检查分工调整](../../../declaration-checks/2026-10-27/README.md)依据独立测量与用户确认实施，Linux 临时目录清理也已作针对性修正，等待新输入的 CI 结果。

当前六目标与 GitHub 跨运行缓存恢复仍未完成。W11 的真实签名、安装与更新验收不作为本轮 W00 门槛；本轮不合并或发布。
