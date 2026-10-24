# 显式值表示的声明与快照检查

本页验证[值表示](../../../design/projects/libmpv-node/values.md)相关的声明与输入快照，不包含正式 addon 或完整订阅运行。

## 来源依据

原生八种值格式、读取时检查实际 format、节点及事件内存寿命，依据固定 mpv v0.41.0 的 [client.h](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h)。本轮重新读取了节点允许格式及参数说明，继续使用[已有固定来源回执](../libmpv-value-options/source-contract.json)，没有选定新的运行依赖版本。

普通值编码、类与错误的消息克隆边界继续复用[此前实际 Node 检查](../libmpv-value-options/verification.md)。选择原生表示不改变普通 getProperty 的错误语义，也不能把绑定转换失败改写成上游 unavailable。

## 声明消费

[contract.d.ts](contract.d.ts)与 [consumer.ts](consumer.ts)检查 input／output 的适用位置及独立组合、原生输出始终按实际 format 收窄、八种节点、普通参数不被宽重载绕过、字节名称不隐含值表示选择、共享缓冲的类型边界以及转换错误读取入口。

```powershell
pnpm exec tsc --project refactor/verification/evidence/libmpv-explicit-values/tsconfig.json
```

这是 strict、exactOptionalPropertyTypes、noUncheckedIndexedAccess、noEmit 下的设计用声明。已知属性提示仅覆盖少量 getter 和 pause 写入；没有声称覆盖全部只读属性、所有命令参数或完整观察接口。静态检查也不能证明内嵌 NUL、UTF-16、int64 范围、循环数据或已分离缓冲的实际拒绝行为。

实际使用 TypeScript 6.0.3，命令以退出码 0 完成；十九项 @ts-expect-error 反例均被拒绝。原生输出按完整 MpvNode 收窄，不沿用此前比较样例中按属性名称直接收窄为固定原生格式的写法。

后续订阅设计检查补充了两个显式泛型反例，发现仅靠可选格式泛型会允许声明原生返回类型而不传入相应选项。现已改为由实际 input／output 参数约束重载；新反例及原有消费均重新通过。此修正落实既有类型合同，没有改变运行时值表示方向。

## 字节视图与错误快照

```powershell
node refactor/verification/evidence/libmpv-explicit-values/snapshot-probe.mjs
```

[snapshot-probe.mjs](snapshot-probe.mjs)使用普通 Buffer 视图和 JavaScript 私有快照样例，检查 Buffer.slice 的别名行为、复制仅包含可见字节、返回缓冲范围、输入后续修改隔离，以及多次提取副本之间的隔离。默认 inspect 和 JSON.stringify 未展开样例的私有快照。

该样例不读取或转换 C 缓冲，没有 Mpv、原生命令或真正的 MpvConversionError；它证明需要的语言级复制行为可以表达，不证明 addon 的拥有权转换和错误类实现已经成立。没有模拟命令重放或把截图像素布局当作已验证数据。

命令在 Node v24.11.1 上以退出码 0 完成，实际结果记录于 [snapshot-contract.json](snapshot-contract.json)。回执保留原生执行、原生寿命、转换错误实现、观察终止及截图／GPU 均未验证的标记。

## 尚未验证的部分

真实 addon 必须进一步证明：在事件数据失效前完成独立持有、精确处理视图边界、普通及原生输入严格校验、输出转换失败保留同一次完整结果、错误和 Mpv 的寿命解耦，以及声明与真实导出一致。

观察转换失败结束订阅的具体交付时序、全部公共调用的拒绝时序、环境退出、截图布局与六目标图形链路仍未验证。错误目录、完整命令和属性类型提示、createMpv 配置及订阅接口也还没有由本轮声明完成。
