# Vantage 公共值与调用语义的依据

对应已确认的 [Vantage 公共值与调用语义](../../../design/projects/vantage/api.md)。本轮读取十项平台说明，并对脚本自己创建的一个 Windows 子进程进行有限原生调用；没有构建或执行 Vantage 包，没有读取或控制其他用户程序，没有执行窗口操作或画面采集。

## 平台说明

[source-probe.py](source-probe.py) 记录十项公开来源的 URL、HTTP 状态、时间、字节数与 SHA-256，结果见 [source-contract.json](source-contract.json)。Apple 页面使用其官方提供的 Markdown 版本；没有将 JavaScript 占位页面当作接口正文。

| 来源                                                                                                                            | 已核对事实                                                                                     | 对公共合同的影响                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [OpenProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess)           | 按指定权限打开进程对象，句柄需要关闭                                                           | 实例引用与访问权限、资源寿命分别处理                                     |
| [QueryFullProcessImageNameW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew) | 完整可执行路径读取要求相应查询权限                                                             | 进程可被观察不表示完整路径一定可读                                       |
| [GetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow)               | 返回前台窗口，切换激活等情况下可以为 NULL                                                      | 前台快照允许真实的“没有窗口”，不能与访问失败混用                         |
| [SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)               | 前台切换有系统限制，满足列出的条件也可能被拒绝                                                 | 已知拒绝需要明确错误，调用方不能把无条件抢占前台当作合同                 |
| [TerminateProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess) | 对另一进程的终止调用是异步的，实际结束可以通过进程句柄等待；已终止对象也可能返回访问拒绝错误码 | 请求返回与实际退出分别表达，错误映射结合操作和已知实例状态               |
| [WM_CLOSE](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-close)                                                     | 应用可以先请求用户确认，再决定是否销毁窗口                                                     | 正常关闭请求不能承诺窗口已关，也不能自动处理随后出现的确认界面           |
| [Linux pidfd_open](https://man7.org/linux/man-pages/man2/pidfd_open.2.html)                                                     | pidfd 指向具体任务，可用于等待退出；返回与使用条件有独立规定                                   | 进程引用应依靠可核实实例关系，而非只有数字 PID；文档存在不等于后端已实现 |
| [Linux proc_pid_comm](https://man7.org/linux/man-pages/man5/proc_pid_comm.5.html)                                               | comm 可修改且超过长度限制会被截断                                                              | 系统显示标签不能替代完整可执行文件名                                     |
| [macOS frontmostApplication](https://developer.apple.com/documentation/appkit/nsworkspace/frontmostapplication)                 | 前台应用是独立的可选应用实例属性，支持观察                                                     | 前台进程与具体窗口分别保留已知部分                                       |
| [macOS executableURL](https://developer.apple.com/documentation/appkit/nsrunningapplication/executableurl)                      | 可执行 URL 是可选属性                                                                          | 不把路径必然可读写入跨平台公共形状                                       |

这些资料支持语义区分，不证明所有平台都能实现相同的引用、枚举、控制或采集路线。完整能力仍须在相应后端验证。

## Windows 自有子进程测试

[windows-process-probe.py](windows-process-probe.py) 使用 ctypes 调用 Windows API；结果见 [windows-process.json](windows-process.json)。测试创建一个等待标准输入的 Python 子进程，在收到输入后自行退出，退出码为 7。

| 实际检查                                              | 结果                           |
| ----------------------------------------------------- | ------------------------------ |
| 仅以 SYNCHRONIZE 权限打开子进程并判断其仍在运行       | 通过                           |
| 用同一有效观察句柄读取完整路径                        | 按预期返回 ERROR_ACCESS_DENIED |
| 增加 PROCESS_QUERY_LIMITED_INFORMATION 后读取完整路径 | 通过，记录仅保留可执行文件名   |
| 子进程自行结束后，用原观察句柄确认退出                | 通过                           |
| 用原查询句柄读取退出码                                | 通过，值为 7                   |
| 关闭本次打开的两个原生句柄                            | 通过                           |

测试说明“已知进程仍存在”和“路径不可读”可以同时成立，也说明原进程句柄的寿命与程序执行寿命有区别。它没有执行强制终止、制造 PID 复用、验证窗口身份，或证明 Vantage 的 JavaScript 引用复用与订阅实现已经存在。子进程和打开的句柄在测试结束时收尾，不保存 PID、完整路径或其他用户进程信息。

```powershell
python refactor/verification/evidence/vantage-api/source-probe.py
python refactor/verification/evidence/vantage-api/windows-process-probe.py
```

本页核对公共值的上游依据。真实实例、观察接续、权限、采集像素与制品消费按[Vantage 场景](../../scenarios/vantage.md)验收。
