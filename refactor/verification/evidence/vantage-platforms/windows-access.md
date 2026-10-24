# Windows 权限与监测的来源核对

本页补充[Windows 平台合同](../../../design/projects/vantage/backends.md#windows-access)，区分管理员运行、进程对象访问权、窗口完整性限制、前台范围与采集。这里记录官方接口依据与必要验证项，没有执行提权、UAC 请求或跨权限目标测试。

## 官方依据

| 来源                                                                                                                                                                                                                                           | 核实内容与结论边界                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [进程安全与访问权](https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights)                                                                                                                              | 查询、等待、终止、读内存有不同访问权；OpenProcess 根据对象 DACL 检查请求。只申请具体需要的权限，不把 PROCESS_ALL_ACCESS 作为监测前提 |
| [QueryFullProcessImageNameW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew)                                                                                                                | 完整路径需要 PROCESS_QUERY_INFORMATION 或 PROCESS_QUERY_LIMITED_INFORMATION，与 SYNCHRONIZE 分开                                     |
| [OpenProcessToken](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocesstoken)                                                                                                                | 文档明确讨论普通进程访问同账户提升进程的条件；这不等于任意目标都会授予全部查询、等待或控制权限                                       |
| [GetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow)与[GetWindowThreadProcessId](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid) | 分别取得当前前台窗口与窗口所属进程编号；这些读取不是终止或控制操作，取得编号仍须按实例合同核验归属                                   |
| [SetWinEventHook](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook)                                                                                                                                      | 事件范围受当前桌面影响；OUTOFCONTEXT 不映射回调 DLL 到目标地址空间，调用线程仍需消息循环。没有以此证明跨权限事件无缺失               |
| [PostMessageW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postmessagew)                                                                                                                                            | 消息投递受 UIPI 限制，因其阻止时返回 access denied；不能把同一结论套到全部观察与截图接口                                             |
| [UAC 工作方式](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/how-it-works)                                                                                                  | 管理员账户的普通程序仍可使用标准令牌；提升与实际进程令牌有关，默认授权界面还会切换到安全桌面                                         |
| [SetWindowDisplayAffinity](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity)                                                                                                                    | 窗口可声明捕获限制；采集结果需要独立验证，不能单凭目标是否管理员判定 WGC 成功或失败                                                  |

以上依据为本轮直接读取的官方文档补充，没有计入此前二十项采集路线下载回执。它们支持按具体访问与操作分类，不证明 Vantage 后端已经完成混合权限验证。

## 实际执行范围

已有[子进程探针](../vantage-api/public-contracts.md)仅对脚本创建的子进程，使用不同访问权验证“存活可观察而路径读取被拒绝”，并验证原句柄在退出后的行为。它没有建立普通观察者到提升目标的组合，也没有记录能证明这种组合的令牌或完整性级别。因此不能把该结果标为管理员目标监测通过。

## 待验证组合

| 消费程序 | 同账户目标 | 必须分别记录的结果                                          |
| -------- | ---------- | ----------------------------------------------------------- |
| 普通权限 | 普通权限   | 发现、实例身份、字段、存活与退出、前台、事件接续、控制、WGC |
| 普通权限 | 提升权限   | 同上，重点区分仍可观察的事实与被拒绝的控制                  |
| 提升权限 | 普通权限   | 同上，不以提升自动证明目标访问和资源清理正确                |
| 提升权限 | 提升权限   | 同上，不以权限等级相同自动证明全部能力可用                  |

还须覆盖不同账户、受限 DACL／受保护对象、UAC 安全桌面切换与返回。这些场景验证可靠事实与受限结果，不要求跨越系统访问限制。每项记录系统、架构、账户是否相同、实际进程完整性、请求的访问权与真实返回；不保存用户令牌、凭据或其他程序的完整内容。

本轮未运行上述组合，也未触发任何授权界面或建立管理员辅助进程。实际提权与受控测试环境须按后续验证工作明确安排。
