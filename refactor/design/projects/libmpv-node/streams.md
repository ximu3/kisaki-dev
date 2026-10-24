# libmpv-node 流提供器

流提供器注册、实际字节源、取消与重入遵守本页合同。

<a id="registration"></a>

## 协议登记与流资源

提供 mpv.registerProtocol(name, provider, { output? })，返回 Promise<void>。它只属于拥有核心的 Mpv，不放在 MpvClient 上。登记成功后才加载对应 URI；已有初始化配置或脚本不会因之后的登记而自动重放。

```ts
await mpv.registerProtocol('app-media', {
  open({ uri, signal }) {
    return openByteSource(uri, signal)
  },
  onError(failure) {
    reportStreamFailure(failure.operation, failure.reason)
  }
})

await mpv.command(['loadfile', 'app-media://example'])
```

协议登记持续到核心销毁，由所属 Mpv 统一释放。登记调用等待确定的原生结果；名称使用既定的字符串或独立字节形式，同名协议按上游规则拒绝。该入口不提供单独注销。

output 只决定提供器收到的 URI 表示：缺省 javascript 为严格 UTF-8 字符串，native 为独立 Uint8Array。它不改变协议名字或读取结果的含义。URI 保留上游实际内容，不通过 URL 对象重新编码、归一化或解释为文件路径。

registerProtocol 成功建立登记后，每次打开分别创建包含 uri 和 signal 的 request。同一 URI 可以形成多个独立请求，各自管理打开及取消；原生句柄与编号由绑定内部持有。登记失败时拒绝 registerProtocol，提供器尚未开始执行。

<a id="source"></a>

## 字节源与读取

open(request) 可以同步返回或异步交付 MpvStreamSource。它包含以下工作方法：

| 方法               | 成功结果           | 含义                                              |
| ------------------ | ------------------ | ------------------------------------------------- |
| read(maxBytes)     | Uint8Array 或 null | 返回至多指定数量的非空字节；null 表示当前位置 EOF |
| seek(offset)，可选 | void               | 精确移动到指定的绝对字节位置，offset 为 bigint    |
| getSize()，可选    | bigint 或 null     | 返回已知总字节数，null 表示未知                   |
| close()            | void               | 归还该源拥有的资源                                |

所有方法均可返回相应结果的 PromiseLike。没有 seek 表示不支持定位；没有 getSize 表示大小未知。位置与大小检查非负有符号 64 位范围，字节请求数量是受绑定容量限制的安全 number。读取支持短读；暂时没有数据时等待实际工作，不用空数组或 null 表示“稍后再来”。EOF 不等于流已关闭，之后仍可能收到读取或定位。

字节输入遵守已经确认的 ArrayBuffer／Uint8Array 规则。库在交接时形成自己的有效副本，不将 C 读取缓冲暴露给 JavaScript，也不让迟到结果写入已被原生释放的地址。提供器交付的源应当有效；open 失败时，由提供器清理它尚未交付的资源。

同一源的 read、seek、getSize 串行执行；不同流可以并发。正常结束或取消后，库发起且只发起一次 close。它是资源清理工作，会等待其完成；不把它当作忽略返回值的结束通知。提供器与源的方法引用在交接时捕获，以原对象作为 this；回调恢复登记时的 Node 异步上下文。

<a id="cancellation"></a>

## 取消的实际边界

request.signal 用于本次打开及后续活动工作。原生 cancel 回调或核心关闭请求会触发适用的取消；提供器将它传给自己执行的 I/O，并及时结束相应工作。正常 EOF 与正常 close 本身不伪装成取消，清理方法不接受撤销清理的 signal。

必须保留一个真实的上游限制：Stream CB 的 cancel 回调在 open 返回、初始定位检查完成后才登记。单纯发送 stop 或替换文件，不能保证在仍阻塞的 open 内立即收到该取消。提供器应尽快交付源，将可延迟的读取工作放到 read；必要的打开期限由提供器自己的 I/O 策略决定，库不宣称存在上游没有提供的打开中止接口。

Mpv.close 可以通过库自己的登记表取消尚在打开中的提供器，并解除内部 C 等待。公开关闭还要等已接纳的打开工作结束，关闭迟到交付的源，并等待已接管源的工作与 close 收尾。关闭完成后不再调用这些提供器方法或失败接收器。

取消先结束工作时，消费其迟到结果与拒绝，不再将普通取消交给 onError；迟到交付的源仍要关闭。close 本身的清理失败继续报告，因为取消不能把失败的资源收尾改写为成功。

这项等待与 hook 的停止不同：hook 处理器没有向库交付外部字节源的资源所有权，流提供器则明确交付了需要关闭的资源。提供器不响应取消或不完成清理时，公开关闭可能继续等待；库不能同时保证任意用户代码立即终止和外部资源已经全部释放。Node 环境强制退出仍按原生清理合同解除 C 等待，不承诺执行已经无法运行的 JavaScript 清理逻辑。

<a id="reentry"></a>

## 播放核心的重入边界

open、read、seek、getSize 和 close 的工作调用链不能调用所属核心的原生控制、登记或关闭入口；换一个 MpvClient 仍然是同一核心。库在提交前报告 reentrantStreamCall，不等待原生死锁。不同核心不受这项限制；读取已交付快照也不等于调用原生核心。

执行上下文标记随处理器的异步调用链传递，不以一个进程全局标志阻止其他业务代码正常控制播放器。普通事件接收器及下述 onError 属于通知，按各自合同处理，不为了提供器的限制改变全部回调规则。真实 Node 桥接仍须验证异步上下文、重入与关闭竞争。

<a id="errors"></a>

## 流失败与协议登记

提供器必须给出 onError(failure)。failure 保存 operation、原始 reason 和适用的 request；operation 是 open、read、seek、getSize 或 close。URI 在调用提供器前即无法转换时，open 失败的 request 为 null，转换错误通过显式原生快照保留原 URI 字节。

onError 是逐项工作失败的通知，返回值不被等待；它不表示协议被注销，也不同于 Observer.error 的订阅终止。提供器自己抛出的任意拒绝值保持原样，库自己的校验、转换或桥接失败采用已有错误体系。接收器自身抛错仍沿 Node 未捕获异常路径，不递归调用它处理自己的失败。

失败映射为原生回调允许的错误结果，之后由 mpv 决定是否重试、继续读取或关闭流。库不自动 quit、删除协议或把一次 size 失败当作整个播放核心失败。缺少可选方法、未知大小与 EOF 是正常结果，不进入 onError；需要在源内部恢复的 I/O 失败由提供器自己处理。

创建请求的文本转换失败沿用 MpvConversionError，operation 为 openStream，保留那次 URI 的原生 string 节点。源返回不合法对象、字节或大小时，使用 binding 来源的 invalidStreamResult，不将它描述为尚未提交的调用参数错误。此类回调中的库错误以原生已进入该次回调为 submitted=true；主动控制调用的提交规则保持不变。失败通知是调用方显式接收的数据，库不自动记录 URI、内容或 reason。

核心关闭期间遇到提供器清理失败时，仍继续其他资源收尾；相关 onError 先完成交付，Mpv.close 再以 AggregateError 报告本次收尾中的失败，原因保持原样。它不追溯此前已经报告的普通读取失败，也不自动再次调用同一源的 close。
