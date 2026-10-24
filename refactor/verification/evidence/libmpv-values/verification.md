# libmpv-node 公共值表示的设计检查

记录[多方案比较中的混合表示候选](alternatives.md#options)。这里检查的是混合表示候选的声明消费和 JavaScript 自身的表示边界，没有实现两种新值类型，也没有执行 libmpv 或原生 addon。已选择显式表示方向，该混合候选仅保留作比较材料，检查通过不表示其公共合同已经确认。后续探索见[多方案比较证据](../libmpv-value-options/verification.md)。

## 上游与运行时依据

非 UTF-8 字符串、NODE_MAP 与重复键的来源复用[固定 mpv 源码记录](../libmpv-calls/verification.md)及其五项下载回执，不重新选定依赖版本。这里只提出这些事实在 Node 边界的表示选择。

另读取了 [Node v24.11.1 TextDecoder](https://nodejs.org/download/release/v24.11.1/docs/api/util.html#class-utiltextdecoder)和 [Buffer 编码说明](https://nodejs.org/download/release/v24.11.1/docs/api/buffer.html#buffers-and-character-encodings)。严格解码能识别非法 UTF-8；保留开头 BOM 需要选择正确行为，不能默认删除原生字符串中的字符。普通替换式解码不能满足无损返回合同。

## 检查入口

[contract.d.ts](contract.d.ts)是设计用声明，[consumer.ts](consumer.ts)只用于编译，不能运行。它检查普通值与包装值的类型关系、通过 instanceof 区分 map 表示、同名普通字段不会充当类型身份、只读结果和 bigint 尺寸；负例要求实际产生类型错误。这份声明不是 napi-rs 已生成的正式导出。

```powershell
pnpm exec tsc --project refactor/verification/evidence/libmpv-values/tsconfig.json
node refactor/verification/evidence/libmpv-values/runtime-probe.mjs
```

[runtime-probe.mjs](runtime-probe.mjs)只运行标准 JavaScript 能力：合法 UTF-8 的往返、非法编码拒绝、孤立代理项的替换行为、Object 与 Map 对重复键的覆盖，以及无原型对象对特殊字段名称的保留。它不模拟 libmpv 事件、命令回复或 C 内存，不实现提案中的转换器或新类。

两条命令均以退出码 0 完成。实际环境为 Node v24.11.1、TypeScript 6.0.3；声明消费含十一项必须被拒绝的反例。运行时结果记录在 [runtime-contract.json](runtime-contract.json)：六项合法文本往返和四项非法 UTF-8 拒绝通过，孤立代理项替换、重复键覆盖和无原型对象的特殊字段行为均按上述说明观测到。回执中的原生 addon、新值类型和截图／GPU 执行标记全部为 false。

## 证据边界

检查结果只能支持“这组表示有明确类型，且需要避开这些真实的语言转换行为”。原生参数转换、值类的运行时身份与字节复制、C 字符串编码、原生结果释放和声明与实际 addon 的一致性仍须实施前进一步验证。它们不能从声明或 JavaScript 样例通过推断为通过。

完整调用接口、事件中断与关闭时序、截图布局、最终 libmpv 依赖和六目标图形交接仍沿用原设计中的未完成状态。

后续读取的 [Node readdir 接口](https://nodejs.org/download/release/v24.11.1/docs/api/fs.html#fspromisesreaddirpath-options)明确按 encoding 选择文件名表示，[napi-rs 值文档](https://napi.rs/docs/concepts/values)区分普通对象与需要类身份的方法型值。它们用于比较公共接口的选择，未计入旧下载或运行回执；本轮没有实现或验证新的显式表示方案，也没有据此撤回无损、整数精度和独立持有等已确认要求。
