# libmpv-node 属性格式检查

对应[属性请求格式](../../../design/projects/libmpv-node/values.md#property-formats)与[属性观察模式](../../../design/projects/libmpv-node/notifications.md#property-modes)。这些补全按上游确定的格式边界纳入既有调用合同，没有新增播放器状态或另一种订阅生命周期。

getProperty 与带值观察区分请求格式和 JavaScript／native 表示。文字读取保持 getPropertyText，文字观察增加 observePropertyText；无值提示由 observeProperty 的 none 格式明确选择，不冒充 unavailable。

[消费样例](consumer.ts)检查显式和动态格式的结果、格式泛型必须有真实选项、无值提示的接收器、文字观察以及不支持的 OSD 观察。它引用原有声明，不重新复制一套 Mpv 接口。

```sh
pnpm exec tsc --project refactor/verification/evidence/libmpv-properties/tsconfig.json
```

本组 12 项反向类型样例全部有效；连同流提供器、控制、初始化、通知、订阅和值表示，共七组 TypeScript 检查以退出码 0 完成，92 项 @ts-expect-error 均有效。它们不执行声明中的方法，也不证明实际 addon 已导出相同接口。

[C API 探针](../libmpv-native/verification.md)真实验证了布尔、文本、整数、浮点读取和 INT64 精度，以及无值初始／后续通知、整数与文本观察、OSD 观察拒绝。源码中的 getproperty_fn 与 mpv_observe_property 在设计基线和探针构建提交间相同；这仍不等于已经运行固定基线或实现了 Node 声明。

真实 addon 尚须验证所有格式的复制、转换错误、动态选项、取消、观察合并与关闭竞争。完整名称目录及其具体结果类型也未由本次局部样例生成。
