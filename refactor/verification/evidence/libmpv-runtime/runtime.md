# 常驻运行库下的多核心寿命检查

2026-10-21，使用固定构建验证[进程运行库与实例寿命](../../../design/projects/libmpv-node/lifecycle.md#runtime-lifetime)中的常驻运行库与独立核心。

[probe.py](probe.py) 在有 30 秒总期限的自有子进程中执行，核对补丁版 libmpv 及全部配套运行 DLL 的摘要。源码为 01e2533f3143b8940857ca419b0b367f583e05ca 加已确认的零分母保护；Client API 为 2.6。配置和自动脚本关闭，音视频输出为 null，没有读取用户媒体、显示窗口或播放声音。

运行库只装载一次，显式卸载次数为零。一个核心保留到场景结束；另两个核心并发初始化，先关闭其中一个，另一个继续读取自己独立的 volume。保留核心的弱客户端可以更新同核心状态，销毁该客户端后核心继续有效；随后再创建并关闭两个核心，其状态与保留核心独立。

五个核心均完成关闭，进程正常退出。详细输入摘要、主机、API 版本和结果见 [runtime-contract.json](runtime-contract.json)。本次未运行 Node addon、Node Worker 退出或图形输出，也没有验证泄漏、压力和最终发行组合。

[来源记录](source-review.json)核对固定 Client API 2.6 头文件中的 45 个函数与 20 项负数错误枚举，并记录上游 lifetime 测试的调用结构。本页的实际运行验证了进程持有一个运行库、各核心独立创建和关闭的使用路径。

复现：

```powershell
python refactor/verification/evidence/libmpv-runtime/probe.py
```
