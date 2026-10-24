# libmpv-node 流提供器声明检查

对应已经确认的[自定义只读流提供器](../../../design/projects/libmpv-node/streams.md)。[声明](contract.d.ts)与[消费样例](consumer.ts)检查核心登记、逐流资源、异步工作、URI 表示、失败接收以及资源关闭的形状；控制模块的统一 Mpv 声明包含这一已确认扩展。

```sh
pnpm exec tsc --project refactor/verification/evidence/libmpv-streams/tsconfig.json
```

反例覆盖客户端不能登记协议、登记不返回可释放订阅、不提供等待取消参数、URI 选择必须匹配提供器、失败接收器与源 close 必填、字节读出、bigint 位置／大小以及清理不接受取消。

本组 12 项反例均有效，七组关联声明检查均通过，共 92 项有效反例。这里验证的是已确认接口的可表达性，没有运行提供器方法或实现其资源交接。

[真实 C API 探针](../libmpv-native/verification.md)验证原生协议的寿命与取消时机，没有执行这些 JavaScript 提供器。后续[真实 Node 桥接原型](../libmpv-node-bridge/verification.md)在 Windows x64／Node 环境完成 Promise 调度、同核心重入保护、迟到打开与资源关闭、清理失败聚合、接收器异常和环境退出的十个场景。本页类型检查与该原型分别提供声明和运行证据，完整包与其他目标仍未通过。
