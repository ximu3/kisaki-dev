# JavaScript 编码与数据表示边界

[runtime-probe.mjs](runtime-probe.mjs)使用标准 TextDecoder、TextEncoder、Object 和 Map 核对[现行值合同](../../../design/projects/libmpv-node/values.md)需要处理的语言行为，不实现值类、转换器或原生 addon。

2026-10-18，在 Node 24.11.1 中执行通过。[原始结果](runtime-contract.json)记录六项合法 UTF-8 往返、四项非法编码拒绝、孤立代理项替换、Object 与 Map 对重复键的覆盖，以及无原型对象对特殊字段的保留。文本往返保留 BOM 和组合形式。

```sh
node refactor/verification/evidence/libmpv-values/runtime-probe.mjs
```

该结果只证明实际 JavaScript 编码与容器行为。当前公开表示的声明和快照另由[显式值检查](../libmpv-explicit-values/verification.md)维护，原生转换、内存寿命与完整制品由 W11 验收。
