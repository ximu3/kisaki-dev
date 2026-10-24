# libmpv-node 受管视频输出声明检查

对应收敛后的[视频输出设计](../../../design/projects/libmpv-node/video.md)。[contract.d.ts](contract.d.ts)定义 GPU／软件配置、不透明 GPU 帧与互操作描述，当前受管目标只保留 srgb 与 display-p3 SDR，GPU 帧存储为 bgra8unorm 或 rgba8unorm。[consumer.ts](consumer.ts)从初始化模块的唯一 createMpv 消费这些类型，复用 Mpv、Observer 与 Subscription；实现及完整链路仍须验证。

```sh
pnpm exec tsc --project refactor/verification/evidence/libmpv-video/tsconfig.json
```

本组 50 项反例覆盖：创建必须明确尺寸，旧 managed 字符串不是另一种形状；PQ、三种带亮度单位的线性目标、HLG 与任意原色组合不属于当前受管输出，SDR 目标不接纳峰值或单位，GPU 帧不再承诺浮点 HDR 存储；创建与更新不接受透明模式；完整更新不改变容量、设备或渲染器；输出由 Mpv 关闭；订阅复用原通知协议；GPU 帧有显式持有，CPU 字节没有借用句柄或释放入口；软件配置不接纳 GPU 参数；输出可空性不能由泛型伪造；reportSwap 不接受伪造时间或帧号，也不等待未来呈现。

当前联合检查采用显式值表示、订阅、通知、初始化、控制、属性、流与视频八组，全部通过，合计 142 项类型反例有效。共同错误声明中的视频 operation 与错误 code 一起检查，实际错误构造与传播仍需运行验证。类型检查结果与原生运行结果分别判断。

SDR 正例覆盖创建、两个目标的完整配置更新、显式 undefined 的默认目标、帧颜色快照与八位格式，以及原生选项表示同输出配置的组合。初始化泛型也核对嵌套目标的多余字段，不能借普通对象推导或 native 选项表示放过旧 HDR 参数。尺寸、容量、设备可用性与像素含义仍属于运行校验，不能由 number 声明或编译检查代替。HDR 片源到 SDR 的映射保留为正常播放要求，取消 HDR 输出不表示取消相应解码与画质检查。

createMpv 的声明只位于[初始化模块](../libmpv-initialization/contract.d.ts)，视频模块不复制或转导出工厂。返回值根据实际 videoOutput 推导 GPU、软件或 null，动态可选输入保留可空性；已知原生选项仍按名称关联值，初始化日志保持独立的输出选择。完整命令与选项目录仍未生成，不能把本组声明当作已完成 SDK。类型样例中的 reportHostSwap 只检查形状，没有伪造实际翻页事件。

对应[实际原型](../libmpv-gpu/verification.md)提供若干运行证据，但没有实现本页的完整公开 VideoOutput、NativeFrame、设备枚举或帧邮箱。类型成立不代表这些运行行为或六个平台目标已经全部通过。

本次整体审视同时核对了库与应用的职责、运行库／实例／帧／Node 环境的寿命、输入与输出颜色的区别、截图与播放上下文，以及发行输入和原型证据的边界。HDR 显示、可变 nit 单位和对应 Vantage 扩展退出当前范围；已有 HDR 研究的原始数据和源码保持原样，仅补充范围说明。本轮更新设计及声明，没有运行新的原生媒体回归，也没有将历史实验的通过状态直接移作当前 SDR 验收。
