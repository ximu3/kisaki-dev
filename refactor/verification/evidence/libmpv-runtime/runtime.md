# 常驻运行库下的多核心寿命检查

2026-10-21，对应已确认的[进程运行库与实例寿命](../../../design/projects/libmpv-node/lifecycle.md#runtime-lifetime)。本轮复用已有 C API、Node 流桥接、图形与交接证据，只增加一个当前固定构建下的常驻路径检查。

[probe.py](probe.py) 在有 30 秒总期限的自有子进程中执行，核对此前补丁版 libmpv 及全部配套运行 DLL 的摘要。源码为 01e2533f3143b8940857ca419b0b367f583e05ca 加已确认的零分母保护；Client API 为 2.6。配置和自动脚本关闭，音视频输出为 null，没有读取用户媒体、显示窗口或播放声音。

运行库只装载一次，显式卸载次数为零。一个核心保留到场景结束；另两个核心并发初始化，先关闭其中一个，另一个继续读取自己独立的 volume。保留核心的弱客户端可以更新同核心状态，销毁该客户端后核心继续有效；随后再创建并关闭两个核心，其状态与保留核心独立。

五个核心均完成关闭，进程正常退出。详细输入摘要、主机、API 版本和结果见 [runtime-contract.json](runtime-contract.json)。本次未运行 Node addon、Node Worker 退出或图形输出，也没有验证泄漏、压力和最终发行组合。

[来源衔接记录](source-review.json)另核对当前 Client API 2.6 头文件：45 个函数名与既有归属清单对应，负数错误枚举为 20 项。记录只证明名称覆盖和来源身份，不声称所有函数实现与旧基线完全等价；上游 lifetime 源码的重复装载事实也在其中固定。

这项通过支持“一个运行库、多个独立核心”的当前使用路径。旧的 Node 重复装载断言仍未归因；上游 lifetime 测试中的一次并行退出也没有因此改成已修复。读取固定源码确认该上游测试自身包含两次装载／卸载循环，所以它与普通多核心操作分别记录。原始问题仍见[构建环境记录](../libmpv-upstream-fix/verification.md)。

复现：

```powershell
python refactor/verification/evidence/libmpv-runtime/probe.py
```
