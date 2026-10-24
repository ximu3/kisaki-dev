# 2026-10-22 存储合同与查询探针

这些是设计验证用的隔离试件，未修改应用实现或个人资料。正式状态见[设计与实施状态](../../../../implementation/status.md)。所有测试文件位于本次单独创建的 .local 子目录；恢复探针只移动自己生成的样本，不读取真实游戏存档。

## 存档恢复的实际文件实验

[恢复脚本](recovery-probe.py)使用 Windows MoveFileExW 的不覆盖语义、真实文件／目录和 SQLite 索引，在子进程中以 os._exit 强制结束，跳过正常清理。当前 Windows x64、F 卷 NTFS 上完成 **60 项场景组合，全部符合预期**；[原始结果](recovery-results.json)逐项保留输入形态、停止位置、接续动作和结果。

覆盖原目标存在或不存在、旧目标移走但阶段未更新、新内容就位但数据库未提交、数据库事务中断、完成后拒绝重放、撤回的两步中断，以及外部改写、准备材料失联、原材料失联、损坏清单和目标已存在。继续／撤回由实际内容决定，keepCurrent 保留观察到的全部材料；文件和目录目标已存在时，原生移动均未覆盖它们。

试件的索引与清单只保留判定必需字段，用于验证操作顺序和磁盘事实，**不是正式备份格式或完整恢复实现**。未覆盖归档解码、应用原生确认、工作区清理、空间不足与权限故障、Node-API 打包、其他平台／文件系统或实际掉电。正式验收仍须按[恢复边界](../../../../design/domains/backups.md#recovery-verification)接续。

## Electron 中的 SQLite 查询实验

[查询脚本](query-probe.cjs)在真实 Electron 主进程中创建隔离资料库，不打开业务窗口。使用 Electron 41.2.0、Node 24.14.0（ABI 145）、better-sqlite3 12.11.1、SQLite 3.53.2 和当前已安装的 Drizzle ORM 0.45.2。连接启用外键、WAL 与 synchronous=FULL，未通过降低持久性换取结果。

设备为 Windows x64（系统报告 10.0.19045）、AMD Ryzen 9 7945HX、32 个逻辑核心、系统报告总内存约 31.2 GiB。数据规模为 1,000、10,000、50,000 个七类条目；最大样本还有 400,000 项标签应用、114,288 项人员关系和 16,666 项人工成员。该数据只含一个由两个分支组成的动态条件与十个人工合集，不代表任意数量与复杂度的动态规则。

每个查询先用独立的内存预期核对完整 total、实际区间和定位，再预热三次、测量 31 次。firstReadMs 是重新打开连接后的首次相应查询，操作系统缓存没有清空，不能称为冷磁盘测试。测试涉及远区间、同项关系筛选、动态并集与未分类、CJK 子串、稳定定位及 JSON 部分日期排序。原型使用显式查询和有限投影，不代表全部业务 schema、复杂日期值域或完整 API 已验收。

最大样本的同次运行比较如下；候选集合在本条 SQL 内求值，没有增加持久结果缓存：

| 查询         | 逐条关联判定 P95 | 候选 ID 集合 P95 |
| ------------ | ---------------- | ---------------- |
| 动态结果区间 | 57.569 ms        | 5.479 ms         |
| 动态结果定位 | 87.835 ms        | 9.096 ms         |
| 未分类区间   | 51.184 ms        | 34.107 ms        |

JSON 部分日期区间的 P95 为 34.319 ms。交替执行优化后的查询和 35 次真实写入时，10 ms 采样分辨率下事件循环延迟 P95 为 37.388 ms、最大值为 47.383 ms。这些是当前设备和样本的观测值，尚未设定完整产品的通过阈值，也没有测量真实 UI 帧率。

[最终原始结果](query-results.json)包含各规模耗时、查询计划、活动写入数量和设备信息。[首次未加入集合查询的结果](query-before-set-query.json)保留探索过程，不能把两次运行的采样差异都归因于单个优化。上表使用最终同次运行中的两种 SQL。

同一 Electron／SQLite 连接还验证了三个事务断言：业务写入后、handled 前故障会完整回滚；业务与 handled 可以一起提交；同组后续创建失败不会留下前一条。这只验证原生事务基础，不代替正式 onboarding 接入、资源准备或提交后通知的验收。

## 版本与证据边界

系统 Node 24.11.1 使用 ABI 137，直接加载当前 Electron ABI 145 的 SQLite 模块会失败；因此查询实际运行于 Electron，而非据系统 Node 错误推断驱动不可用。[版本观察](dependency-observation.json)保留这项区分。

核对时官方最新可见 1.x 发布是 [v1.0.0-rc.5](https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-rc.5)，仍标为预发布；另有正式 [0.45.4](https://github.com/drizzle-team/drizzle-orm/releases/tag/0.45.4)。本次 npm 元数据访问多次超时，未安装或验证 1.x 候选。现有 0.45.2 下的 SQL 观测不能代替目标 1.x、Kit generate／migrate、codec 和完整迁移资源组合的验证，也没有修改方案的目标版本。

结论限于：恢复阶段必须结合实际字节判定；不覆盖移动需要真实系统语义；动态查询组织方式会显著影响主线程耗时。尚不据此冻结整库预算、所有目标平台或最终执行架构。

## 重跑方式

从仓库根运行恢复脚本，指定独立 .local 目标和结果文件：

```powershell
python -X utf8 refactor/verification/evidence/storage-contracts/2026-10-22/recovery-probe.py run .local/refactor-contracts-20261022/cases refactor/verification/evidence/storage-contracts/2026-10-22/recovery-results.json
```

查询脚本需要当前桌面依赖中的 electron.exe 和匹配的 better-sqlite3，以实际 Electron 应用方式启动 query-probe.cjs；它自行设置隔离 userData／sessionData 并在结束时退出。脚本读取安装版本并记录环境，不要求改写根依赖或重编译现有 SQLite 模块。
