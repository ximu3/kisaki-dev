# 公共值与消息传递依据

本页记录[公开值合同](../../../design/projects/libmpv-node/values.md)所依据的固定源码、Node 消息序列化和 JavaScript 值消费边界。

## 来源核对

[source-probe.py](source-probe.py)读取七项来源，均返回 HTTP 200；URL、日期、摘要和定位标记保存于 [source-contract.json](source-contract.json)。mpv 仍使用 v0.41.0 的固定提交，Node 文档固定为 v24.11.1；napi-rs 页面记录实际内容摘要。标记用于定位，不代替源码语义核对。

| 来源                                                                                                                                                                 | 采用的事实与限制                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [Client API](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h)                                                   | 事件数据有明确有效期；map 只保证键值按位置对应，未提供唯一键保证                                                             |
| [节点复制](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/options/m_option.c)                                                       | dup_node 对 map 的值和键逐项复制，没有在该步骤去重                                                                           |
| [user-data 实现](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/command.c)                                                   | do_op_udata 的 GET 和 SET 使用节点复制；根不可整体覆盖，子属性可使用相应流程。它支持完整数据需求的源码论证，没有执行原生往返 |
| [命令与属性说明](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/DOCS/man/input.rst)                                                 | user-data 用于任意递归节点；subprocess 的 stdout、stderr 是 BYTE_ARRAY，不能借此虚构常见的字符串转换失败                     |
| [Node 消息克隆](https://nodejs.org/download/release/v24.11.1/docs/api/worker_threads.html#considerations-when-cloning-objects-with-prototypes-classes-and-accessors) | 普通类原型、访问器与非枚举信息不会按类身份克隆。实际 napi-rs 类仍需单独验证                                                  |
| [Node 文件系统](https://nodejs.org/download/release/v24.11.1/docs/api/fs.html#fspromisesreaddirpath-options)                                                         | 文件名表示可按 encoding 显式选择；只作为设计类比                                                                             |
| [napi-rs 值](https://napi.rs/docs/concepts/values)                                                                                                                   | 普通对象与需要身份和方法的类有不同接入形式，不能从语言映射规则直接推断公开设计最优                                           |

## 实际 Node 检查

```powershell
node refactor/verification/evidence/libmpv-value-options/runtime-probe.mjs
```

[runtime-probe.mjs](runtime-probe.mjs)使用真实 MessageChannel、receiveMessageOnPort、vm 和默认 inspect。命令在 Node v24.11.1 上以退出码 0 完成，结果保存于 [runtime-contract.json](runtime-contract.json)。没有启动独立 Worker 或 Electron 进程；检查覆盖实际消息序列化和跨 JavaScript realm 的内建类型行为，不覆盖原生实例的跨环境使用。

观察结果包括：普通 JavaScript 类失去身份、私有字节未被序列化、公开 entries 保留数据但失去类身份；纯判别数据中的重复项、字节、bigint、负零和 NaN 语义通过消息往返；无原型对象克隆后恢复普通原型但保留自有特殊字段；来自另一个 realm 的 Uint8Array 不通过本 realm 的 instanceof，而内建类型识别可以确认它。

错误样例私有持有结果，并通过原型访问器显式读取。默认 inspect 和 JSON.stringify 没有展开该结果；经消息克隆后，自定义错误字段和访问器丢失，而显式提取的数据可以再次传递。这只是实际 Node 行为，不保证任意日志框架都不会主动调用访问器，也不证明真实 addon 的错误实现已成立。

样例类用于检查消息克隆和默认诊断中的类、字节与错误行为。

## 结论边界

这些证据用于比较表示稳定性、传递和消费成本。原生非 UTF-8 与重复键往返、同一次命令结果的保留、转换失败后的订阅结束、原生数据释放及实际声明仍需进一步验证。没有把源码下载、JavaScript 样例或静态声明通过作为独立项目已经具备实施条件的证明。
