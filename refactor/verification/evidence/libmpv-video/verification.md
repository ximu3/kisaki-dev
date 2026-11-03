# libmpv-node 受管视频输出声明检查

本页验证[视频输出合同](../../../design/projects/libmpv-node/video.md)的类型形状。[contract.d.ts](contract.d.ts)定义 GPU 与软件配置、GPU 帧及互操作描述，受管目标为 srgb 和 display-p3 SDR，GPU 帧存储为 bgra8unorm 或 rgba8unorm。[consumer.ts](consumer.ts)通过初始化模块的 createMpv 消费这些类型，并复用 Mpv、Observer 与 Subscription。

```sh
pnpm exec tsc --project refactor/verification/evidence/libmpv-video/tsconfig.json
```

50 项类型反例覆盖尺寸与完整配置、目标颜色和八位格式、输出类型相关的参数、设备与容量的初始化边界、输出可空性、帧持有与释放，以及 reportSwap 的实际调用形状。正向消费覆盖创建、两个目标的完整更新、默认目标、帧颜色快照，以及原生选项与输出配置的组合。

显式值、订阅、通知、初始化、控制、属性、流和视频八组联合声明检查通过，共 142 项类型反例有效。视频 operation 与错误 code 使用共同错误声明。尺寸数值、设备可用性、像素含义、错误构造和传播由运行校验负责。

createMpv 的声明由[初始化模块](../libmpv-initialization/contract.d.ts)拥有，返回值根据实际 videoOutput 推导 GPU、软件或 null，动态可选输入保留可空性。已知原生选项按名称关联值，初始化日志保持独立输出选择。

[GPU 运行试件](../libmpv-gpu/verification.md)提供所列链路的运行证据。完整 VideoOutput、NativeFrame、设备枚举、帧交付及六目标验收按 W11 完成；HDR 片源到 SDR 的映射按正常播放与画质要求验证。
