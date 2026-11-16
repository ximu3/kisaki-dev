# 开发会话的失败与关闭

<a id="shutdown"></a>

## 停止失败与取消

2026-11-02，在 Windows x64、Node 24.11.1、Electron 45.0.0 和 Vitest 5.0.5 下复核开发工作进程的失败路径。应用停止失败时，测试拥有者收到错误并负责终止进程。工作进程在启动就绪前退出时，就绪等待随之失败。

在 `f17bce8` 上，应用的 `stop()` 报错后，工作进程仍等待 `closed`，回归用例在等待退出时失败。在 `5d518b3` 上，取消期间的独立命令错误使进程以 0 退出，用例预期为 1。修复后两个场景均通过，本机类型、lint、格式和六项开发回归也通过。操作与清理同时失败时的交付规则见[共用工程函数](../../../implementation/development.md#shared-tooling)。

## Linux ARM64 重复验证

首次运行已完成启动准备取消与重试，随后在等待关闭时达到 240 秒用例超时。日志缺少停止失败时的诊断，首次超时的具体原因仍未确定。[首次运行](https://github.com/ximu3/kisaki-dev/actions/runs/41406851531/job/125150900039)

| 复核输入 | 重复范围 | 结果 |
| --- | --- | --- |
| `5d518b3` | 5 个完整开发场景，各运行 10 次 | [50 次通过](https://github.com/ximu3/kisaki-dev/actions/runs/41411975644) |
| `13b6189` | 准备取消、并发命令失败及完整重试的 2 个场景，各运行 25 次 | [50 次通过](https://github.com/ximu3/kisaki-dev/actions/runs/41415094837) |

## macOS 退出与进程回收

2026-11-03，macOS x64 的载体在就绪后约 1.48 秒记录取消结果，超过了测试的一秒轮询预算。清理复用了尚未完成的停止请求，随后强制终止工作进程并留下会话目录。修复后的用例给取消结果 15 秒观察时间，等待在途请求结束，再完成正常关闭并核对退出码。[运行记录](https://github.com/ximu3/kisaki-dev/actions/runs/41573308593/job/125711459529)

当次 macOS 运行还记录了取消命令期间的 `kill EPERM`。Darwin 在进程组只剩僵尸进程时也可能返回该错误。共用运行器在 SIGTERM 后遇到 EPERM 时核对进程表，组内仍有可运行成员就保留原始错误。[XNU 进程组信号实现](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_sig.c)

2026-11-16，macOS ARM64 的配置修复用例在约 6.7 秒时记录到 `stopped` 和应用正常退出，测试工作进程随后仍需强制终止。日志未定位使进程存活的资源。同一提交的定点复验、完整作业复跑和本机 Windows x64 重复用例均正常收尾。[首次失败](https://github.com/ximu3/kisaki-dev/actions/runs/43808866913/job/133105940131) · [定点复验](https://github.com/ximu3/kisaki-dev/actions/runs/43809489522/job/133108324111) · [完整复跑](https://github.com/ximu3/kisaki-dev/actions/runs/43808866913/job/133110136603)
