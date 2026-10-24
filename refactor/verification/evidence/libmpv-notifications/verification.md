# libmpv-node 事件与日志合同的检查范围

对应已确认的[事件与日志合同](../../../design/projects/libmpv-node/notifications.md)。来源收据保留执行当时的 proposal 状态，确认设计不改写历史验证结果。本目录仅包含来源核对与 TypeScript 声明消费，没有原生 addon、替代事件分发器或模拟 mpv 队列。

## 来源核对

[source-probe.py](source-probe.py)读取 mpv v0.41.0 的固定提交，记录 HTTP 状态、时间、SHA-256 和定位行。它从真实头文件提取 C 字段与枚举值，并核对实现中的事件名称；字符串标记只定位对应实现，不证明运行时行为。

| 来源                                                                                                               | 本轮核对内容                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [Client API](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h) | start-file、end-file、client-message 和日志结构；原因码、级别码；deprecated 事件；terminal-default；弱客户端销毁约束 |
| [客户端实现](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/client.c)      | 当前事件名称表；事件选择；修改日志级别会重建缓冲；event_to_node 将文件错误码变成文字并省略数字日志级别               |
| [日志实现](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/common/msg.c)           | terminal-default 采用每模块 terminal_level；overflow 保留前缀；丢弃和计数；首个 terminal-default 缓冲可取得早期日志  |
| [初始化](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/player/main.c)            | 初始化阶段启用早期日志缓冲                                                                                           |

实际结果见 [source-contract.json](source-contract.json)。读取这些来源没有加载、构建或执行 libmpv。

## 声明消费

```sh
pnpm exec tsc --project refactor/verification/evidence/libmpv-notifications/tsconfig.json
```

[contract.d.ts](contract.d.ts)与 [consumer.ts](consumer.ts)复用已确认的接收器、订阅和表示选项。检查事件判别字段、C int 与 int64_t 的类型差异、普通／字节文本、动态输出联合、名称选择、级别与选择方式的区别、缺口以及独立通知快照。

输出方式只能由实际选项选择，接收器类型或显式泛型不能在没有选项时改变返回内容。声明没有把可选的 events 泛型当成已发生的运行时选择；本轮按完整事件联合消费。

TypeScript 声明检查以退出码 0 完成，16 项 @ts-expect-error 反例均被拒绝。使用 NodeNext、Node 类型、strict、exactOptionalPropertyTypes、noUncheckedIndexedAccess 与 noEmit；消费样例放在不执行的异步函数中。首次检查发现样例位于 CommonJS 目录却使用顶层 await，已修正样例作用域后重新通过，没有改变通知合同来消除诊断。

## 尚未验证

仍须用真实 addon 验证 C 内存复制与释放、UTF-8 转换、独立日志筛选、terminal-default 的动态模块配置、初始化日志排除、缺口合并与交付、数量／字节上限、回调竞争、关闭和弱客户端销毁。新增错误的真实导出、独立快照及无敏感内容的错误显示也未执行。接口已经确认；声明检查不代表原生行为已经实现。
