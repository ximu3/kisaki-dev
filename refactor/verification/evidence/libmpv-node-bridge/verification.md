# libmpv-node 异步流桥接原型

本组实际编译并加载 Rust／napi-rs addon，由 libmpv 的 Stream CB 回调调用 JavaScript 提供器，验证[流提供器合同](../../../design/projects/libmpv-node/streams.md)中的取消、资源交接、清理与环境退出。原型用于判断这组合同是否可实现，未实现完整公开包。

## 输入与运行方式

- 环境：Windows 10 x64，Node 24.11.1，Rust 1.90.0 的 MSVC 目标。addon 启用 Node-API 8；运行宿主报告支持 Node-API 10。
- 直接依赖固定为 napi 3.14.2、napi-derive 3.6.12、napi-build 2.6.0、libloading 0.9.0，完整解析见 [Cargo.lock](Cargo.lock)。使用已有缓存离线构建。
- libmpv 沿用[原生探针输入](../libmpv-native/binary-input.json)，运行前核对 DLL 摘要。它是提交 01e2533f3143b8940857ca419b0b367f583e05ca、Client API 2.6 的独立探针构建，未选作正式发行依赖。
- [run.py](run.py)构建并把 addon 留在仓库忽略的 node_modules/.cache/libmpv-design 下。它以 35 秒上限运行自有 Node 子进程；测试内部另有执行期限。这些期限只用于终止失效探针，不是公开播放器超时合同。
- 媒体为代码生成的一秒静音 WAV。配置、脚本、终端、画面及声音输出关闭，不读取用户媒体。收到实际 FILE_LOADED 事件证明该流进入了 libmpv 的加载流程，不代表渲染或声卡输出通过。

从仓库根目录运行：

```sh
python refactor/verification/evidence/libmpv-node-bridge/run.py
```

## 原型承担的真实工作

[bridge.rs](bridge.rs)动态加载固定 DLL，通过真实 Stream CB 发起打开、读取、定位、查询大小与关闭。原生工作线程只等待自有回复；JavaScript 回复时复制字节到 Rust 内存，C 读取缓冲指针只存在于尚未返回的原生回调栈内。原生取消先唤醒等待，再投递 JavaScript 取消通知；迟到结果不能重新取得已经结束的 C 缓冲。

[provider.mjs](provider.mjs)接管提供器实际交付的源，恢复登记上下文，用 AsyncLocalStorage 标记参与流工作的异步调用链，并分别等待工作结束与源的单次 close。onError 的交付位于工作标记之外，保留用户抛出的原始值；接收器自身抛错进入 Node 未捕获异常路径。

环境清理使用预先创建的 Node-API async work 和显式 async cleanup hook。退出钩子关闭 JavaScript 交付、解除原生等待，并排入核心销毁；只有原生销毁完成、环境线程收到 async work 完成回调后，才移除清理钩子。未把用户 Promise 当作环境退出必须等待的对象。[Node-API 环境清理依据](https://nodejs.org/download/release/v24.11.1/docs/api/n-api.html#cleanup-on-exit-of-the-current-nodejs-environment)

这里使用 napi-rs 的线程安全回调与 sys 入口。napi 3.14.2 的 Env 清理辅助方法在传入闭包返回后移除钩子，本原型所需的延后完成由显式句柄管理；不能仅凭“异步清理”的名称就把一个未完成 Future 交给闭包后返回。[napi-rs Env 实现](https://docs.rs/crate/napi/3.14.2/source/src/env.rs)

## 实测结果

[probe.mjs](probe.mjs)、[worker.mjs](worker.mjs)完成十个场景，[runtime-contract.json](runtime-contract.json)保存当前环境、摘要与结果。

| 场景                             | 结果                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 异步加载、上下文、方法捕获与重入 | 真实文件加载完成；跨 await 保持登记上下文与 this；更换原对象方法不改变已捕获引用；同核心读取与关闭重入被拒绝，另一核心可用 |
| stop 期间读取仍未完成            | 原生 cancel 解除等待并关闭流；公开关闭继续等待迟到读取和异步清理；结果被消费，源只关闭一次                                 |
| 关闭期间打开才交付源             | 核心先销毁，公开关闭尚未完成；迟到源仍被接管并关闭一次                                                                     |
| 取消之后打开拒绝                 | 原始拒绝被消费，不误报普通取消，也没有未处理拒绝                                                                           |
| 工作失败与被动接收器             | 保持原始对象身份，onError 可以正常发起同核心 stop                                                                          |
| 无效字节与接收器抛错             | 空字节结果报告 invalidStreamResult；接收器抛出的 Symbol 经 Node 未捕获异常事件交付，没有递归报告                           |
| 多个源清理失败                   | 两个源均清理一次；两项原始 Symbol 原因进入 AggregateError，相关通知在关闭拒绝前交付                                        |
| Worker 在 open 中被终止          | 原生核心销毁完成，主环境核心仍可读取；无法继续的 JavaScript 清理未被伪装为完成                                             |
| Worker 在 read 中被终止          | 同样解除原生等待并完成销毁，主环境核心仍可用                                                                               |
| Worker 自然退出时 open 未完成    | 在移除探针计时器和消息端口引用后正常退出，原生清理完成，不依赖未兑现的 Promise                                             |

全部场景结束后，存活原生核心与待处理拒绝均为零。未捕获异常场景仅在隔离探针中临时安装接收器以核对值，正式库不因此增加全局异常拦截。

## 证明范围

本组为这套提供器资源模型在当前 Windows x64／Node 环境中的可行性提供运行证据，支持已确认的接口合同。它没有实现所有命令、属性、事件、hook、输出与公开错误结构；原型内部的命令入口、事件轮询、数字关联编号及固定协议名也不属于公开 API。

原型回调通道采用弱运行引用以验证退出，未验证完整 Mpv.ref／unref、GC 兜底或有限公开操作的运行引用合同。队列容量、压力、全部失效输入、动态协议登记、原始 URI 字节、Electron、其他平台及架构、正式构建与 GPU 链路仍需相应验证。当前结果不将独立项目整体标为已可实施，也不改写[较早 C API 探针](../libmpv-native/verification.md)自身的验证范围与标记。
