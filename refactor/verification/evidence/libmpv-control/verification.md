# libmpv-node 控制接口检查

对应已确认的[控制接口与运行时](../../../design/projects/libmpv-node/api.md)。额外客户端对象、等待处理器完成后自动继续的 hook，以及整体接口模型均已确认。来源收据与覆盖清单保留检查时的 proposal 分类，不因设计确认改写历史执行结果；真实 addon 与完整原生能力仍未验证。

统一声明现已补入[属性格式](../libmpv-properties/verification.md)，并包含已经确认的[流提供器扩展](../libmpv-streams/verification.md)。有限的真实 C 调用证据单独见[原生探针](../libmpv-native/verification.md)，不改写本页历史来源与标准 Node 探针的证明范围。

## 整体模型复核

[整体接口](../../../design/projects/libmpv-node/api.md#libmpv-model)按一次操作、持续通知和参与执行核对完成语义，同时检查创建、取消、错误归属、核心与客户端、独立数据及帧资源的关系。通知的 next 与 hook 的 run 分别表达接收事实与完成工作；共同登记寿命仍由 MpvSubscription 承担，没有增加新的公共基类或第二种 hook 完成方式。

复核参照 [Node EventEmitter](https://nodejs.org/download/release/v24.11.1/docs/api/events.html#events)的监听器返回值规则与 [Web Streams](https://nodejs.org/download/release/v24.11.1/docs/api/webstreams.html#new-writablestreamunderlyingsink-strategy)的异步工作完成形式，并结合下表固定 mpv hook 合同。这是接口职责的设计依据，不证明本库采用了这些运行时对象或已经实现回调时序。

文档对齐了两处范围：client-message 属于调用 observeEvents 的公开控制客户端；hook 登记的 closed 阻止新的 run，dispose 才是库拥有资源的清理边界。订阅示例补全已经规定的 asyncDispose。此次只修改设计说明与一条声明注释，没有改变类型签名或执行原生测试；下述既有检查结果的证明范围保持不变。

## 来源与覆盖

[source-probe.py](source-probe.py)读取固定 mpv v0.41.0 与 Node 24.11.1 来源，记录 HTTP 状态、检查时间、SHA-256 和定位标记。它从真实 client.h 提取全部导出函数和错误枚举，要求覆盖表没有缺项或重复归属，并从手册提取已知 hook 名称。

| 来源                                                                                                                                                                                                                                     | 核对内容                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [client.h](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h)                                                                                                                         | 全部 Client API 函数、错误码、客户端、配置文件、时钟、hook 顺序和撤销约束                 |
| [client.c](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/client.c)                                                                                                                              | 客户端、配置文件与属性文本读取的实际入口                                                  |
| [command.c](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/command.c)                                                                                                                            | hook 登记、排序、继续，以及客户端消失或消息发送失败后的移除                               |
| [输入手册](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/DOCS/man/input.rst)                                                                                                                           | 六类 hook、属性通知协调及其具体含义                                                       |
| [Lua hook 封装](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/DOCS/man/lua.rst)                                                                                                                        | 默认在回调返回后继续，仅显式 defer 后才要求手动 cont；说明 C 协议义务不必直接成为公共接口 |
| [Stream CB](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/stream_cb.h)、[Render API](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/render.h) | client.h 以外仍需设计验证的原生能力边界                                                   |
| [Node Errors](https://nodejs.org/download/release/v24.11.1/docs/api/errors.html)、[Timers](https://nodejs.org/download/release/v24.11.1/docs/api/timers.html)                                                                            | ABORT_ERR、原因链与 ref／unref                                                            |
| [Node-API](https://nodejs.org/download/release/v24.11.1/docs/api/n-api.html)                                                                                                                                                             | 异步环境清理及线程安全函数的保持／取消保持                                                |

实际结果见 [source-contract.json](source-contract.json)，全部函数的责任映射见 [client-api-coverage.json](client-api-coverage.json)。这份覆盖只核对函数职责，明确保留尚未完成的参数模式和其他头文件边界；不能据此宣称完整 libmpv 功能已经交付。

## 声明与标准运行时检查

```sh
pnpm exec tsc --project refactor/verification/evidence/libmpv-control/tsconfig.json
node refactor/verification/evidence/libmpv-control/node-probe.mjs
```

[声明](contract.d.ts)、[错误声明](errors.d.ts)和[消费样例](consumer.ts)复用已有值、订阅与通知合同。检查核心与客户端拥有关系、文本表示、异步 hook 处理器与普通 Observer 的区别、共同错误字段、创建阶段，以及 await using 的类型关系。原有两个转换错误声明复用公共错误基类；初始化声明复用统一 Mpv 类型，不再另写一个同名局部接口。

[node-probe.mjs](node-probe.mjs)只运行标准 Node 定时器取消、独立子进程中的 ref／unref，以及 JavaScript 异步释放语法。结果写入 [node-contract.json](node-contract.json)。这些不是 Mpv 错误实例、原生线程安全函数或 addon 环境退出的测试。

TypeScript 6.0.3 的五组关联声明消费均以退出码 0 完成：控制 13、初始化 10、通知 16、订阅 10、值表示 19 项反例，共 68 项 @ts-expect-error 均有效。标准 Node 探针也已通过：两项 AbortError 检查保留 ABORT_ERR 与 cause 身份，带／不带运行引用的定时器子进程按预期结束，await using 等待异步释放完成。公共基类、创建返回类型和释放符号变更已包含在这些关联检查中。源码清单核对了 45 个 client.h 函数、20 个负数错误码和 6 个已知 hook；10 份来源收据均为 HTTP 200。

## 未完成的原生证据

仍须检查真实 Error 原型和原因链、原生错误码传递、提交与取消竞争、客户端定向消息、跨客户端队列隔离、hook 重入和旧处理器 Promise 的迟到结算、已取得 hook 先继续再销毁、丢失 hook 后的释放、初始化取消、环境退出、以及全部队列和持有容量。

上游明确提醒销毁正在处理 hook 的客户端可能影响执行顺序，因此不能用客户端移除路径代替正常 continue。当前排序实现使用整数减法；极端 priority 的实际行为也应进入固定依赖验证，不能只凭 TypeScript number 声明断言完整边界。自动继续、处理器拒绝、注销后的迟到拒绝和关闭释放都还没有真实 addon 证据；源码中的 Lua 默认行为也不证明 Node 绑定已经正确实现。客户端／hook 的选定接口仍需这些证据支持。
