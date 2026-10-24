# libmpv-node 订阅合同的检查范围

对应已确认的[订阅接口与生命周期](../../../design/projects/libmpv-node/notifications.md)。来源收据保留当时 proposal 状态，不因设计确认改写历史验证结果。本轮完成来源核对、局部声明消费和标准 Node 调度检查，没有实现或运行原生订阅分发器。

## 固定来源

[source-probe.py](source-probe.py)读取四项来源，全部返回 HTTP 200；URL、时间、字节数、摘要和存在性标记保存在 [source-contract.json](source-contract.json)。mpv 继续使用 v0.41.0 的固定提交，Node 文档固定为 v24.11.1，没有据此重新选定正式依赖版本。

| 来源                                                                                                             | 核实的范围                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [client.h](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h) | 属性观察、停止、队列溢出、日志 overflow 标记和 hook 的继续义务                                                  |
| [client.c](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/client.c)      | reserve_reply 与 send_reply 使用预留位置；属性变化及日志分别生成；event_to_node 把部分错误转成文字              |
| [Node Events](https://nodejs.org/download/release/v24.11.1/docs/api/events.html)                                 | 监听器返回值默认被忽略；Promise 拒绝捕获是另一项显式机制，不应从 void 类型推断会等待                            |
| [Node-API](https://nodejs.org/download/release/v24.11.1/docs/api/n-api.html)                                     | 线程安全函数可非阻塞返回队列满；fatal_exception 与 fatal_error 含义不同；自定义异步上下文须正确建立、持有和释放 |

上述规则支持按通知种类处理的设计。它们没有证明所提观察接口已具备同样的实现保障，也没有给出本库合适的队列容量或调度批量。

## 声明消费

```powershell
pnpm exec tsc --project refactor/verification/evidence/libmpv-subscriptions/tsconfig.json
```

[contract.d.ts](contract.d.ts)与 [consumer.ts](consumer.ts)复用已确认的值类型，检查 next／error 的必填性、complete 可选、已知属性与原生输出的对应、回调参数不能反向改变名称或输出模式、unavailable 分支及异步清理。

TypeScript 6.0.3 在 strict、exactOptionalPropertyTypes、noUncheckedIndexedAccess 与 noEmit 下以退出码 0 完成；十项 @ts-expect-error 反例均被拒绝。另有正例明确展示：void 回调位置仍接受 async 函数，因此不能用这个类型检查宣称异步回调已经被禁止或等待。

显式泛型反例曾实际暴露一个声明漏洞：回调或调用者提供的类型参数不能代替 output 的运行时选择。当前重载要求原生输出确有相应选项，动态选项则要求接收联合值；值调用样例中的同类漏洞也已修正并复查。

声明只覆盖属性观察和共用接收器，不声明尚未完成的事件／日志字段、过滤或级别合同。Error 是接收失败的基础类型，完整库错误目录仍须继续完成。

## 实际 Node 调度检查

```powershell
node refactor/verification/evidence/libmpv-subscriptions/scheduling-probe.mjs
```

[scheduling-probe.mjs](scheduling-probe.mjs)在 Node v24.11.1 上以退出码 0 完成，结果保存于 [scheduling-contract.json](scheduling-contract.json)。实际观察到：

- resolve 后直接调用通知，以及在返回前排入微任务，通知都先于外部 await 的恢复。
- 后续 setImmediate 调度让示例中的 await 先恢复，再运行通知。
- EventEmitter 不等待监听器返回的 Promise，同步抛错保持原异常。
- 使用 AsyncResource 可以恢复建立时的 AsyncLocalStorage 上下文，并以原接收对象调用捕获的函数；之后替换对象上的函数不改变已捕获引用。

这些是标准 Node 机制的行为检查。脚本没有实现所提订阅，也没有模拟 mpv 队列或调用 napi_fatal_exception；setImmediate 示例通过不能证明真实 addon 的创建与第一次回调时序已经正确。完整实现仍须覆盖取消、原生事件提前到达、回调中停止和环境退出等竞争。

## 未完成的验证

原生登记与释放、首次通知、主动停止抑制待交付回调、Mpv 关闭前后的终止顺序、回调异常转交、独立异步上下文以及数量／字节上限均未通过本轮原生验证。Node 保持规则、日志过滤与 terminal-default、具体事件字段、hook 接入和真实队列压力也仍待完成；字段方案现已确认，见[事件与日志合同](../../../design/projects/libmpv-node/notifications.md)。

回执中的 nativeAddonExecuted、proposedSubscriptionImplementationExecuted、nativeCallbackExceptionRouteExecuted、cancellationAndCloseVerified、queueCapacityVerified 等标记均为 false，不以声明或标准运行时行为代替这些证据。
