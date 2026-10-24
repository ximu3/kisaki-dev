# libmpv 渲染器候选的同产物对照

范围说明：本组保留此前渲染与 HDR／线性输出研究的原始目标、源码和收据，正文按当时实验说明。现行交付已收敛为[SDR 输出与 HDR 片源到 SDR](../../../design/projects/libmpv-node/video.md#targets)；HDR 显示和亮度单位转换不再是待完成要求，历史结论不直接等同于当前 SDR 验收。

本组核对共享 gpu-next 渲染器的未合并提案，检验它是否能改善已经发现的 Alpha 问题。它是[终态输出设计](../../../design/projects/libmpv-node/distribution.md#baseline)的路线证据，不是正式依赖选择，也不修改上游仓库或发布内容。

## 来源与边界

2026-10-18 核对时，[PR #18607](https://github.com/mpv-player/mpv/pull/18607)仍处于开放且未合并状态。其头提交为 16563d120f3260cdc0beb1b07f199818fc32dd8c，提供 opengl-next 入口，并让原生 VO 与嵌入接口共享 gpu-next 的渲染器；它没有在这个提案里提供直接 D3D11 入口。[PR #16818](https://github.com/mpv-player/mpv/pull/16818)也是尚未合并的另一项提案，不能视为已发布能力。

[prepare.py](prepare.py)读取官方构建任务 38387767841 的制品元数据，校验 artifact 11826903959 公布的 SHA-256，再解压到仓库忽略缓存。实际构建使用测试合并提交 69f6399d15fa52c47b419f2a86330a9b5c13f72f；脚本核对它的父提交包含上述 PR 头。制品标为 Windows x64 LGPL，但本组没有据此完成最终许可和依赖装配验收。[binary-input.json](binary-input.json)保留精确来源、摘要、当前 PR 状态和非发行标记。

生产端复用既有 [GPU 探针](../libmpv-gpu/verification.md)的 Rust／Node-API addon，显式选择 opengl 或 opengl-next。两者使用同一份 DLL、同一 ANGLE 输入和同一设备；比较不会混入两个不同媒体构建的差异。生产 helper 新增提案入口选择，并允许 ANGLE 创建半浮点目标；常规 D3D11／ANGLE 验证已重新执行，既有 Electron 消费与颜色记录也更新为当前 addon 摘要。

## 实际执行

[probe.mjs](probe.mjs)由 [run.py](run.py)放在有限时长的独立进程中运行。参考图为已有的无损、不透明和 Alpha=128 两张代码生成 PNG。没有用户配置、用户媒体或真实声音输出。

组合为两个入口 × 五类目标 × 开关线性缩小 × 两个 Alpha 条件，共 40 组。每组都渲染 63×47 和 31×23 两种尺寸，切换原生 vo、关闭核心，再读取独立纹理。sRGB 与 Display P3 使用 BGRA8；PQ、HLG 与线性 RGB 使用 RGBA16F。五类目标均能实际产帧，旧纹理在正常关闭后仍可读取。

提案源码将透明输出描述为独立 Alpha，不能直接标记为预乘。比较据此检查同一前景颜色在改变 Alpha 后的 RGB 是否保持一致：

| opengl-next 目标 | 两种尺寸及缩放条件中的最大 RGB 偏差 |
| ---------------- | ----------------------------------- |
| sRGB             | 0 个码值                            |
| Display P3       | 0 个码值                            |
| PQ               | 0.00048828125                       |
| HLG              | 0.0009765625                        |
| 线性 RGB         | 0.0001220703125                     |

自动检查要求 8 位偏差不超过 1 个码值，半浮点偏差不超过 0.002，并检查 Alpha 和有限数值。既有 opengl 路径在同一个 DLL 中仍复现 Display P3 约 5.6 个码值、PQ 约 0.1363 的预乘关系偏差。结果保存在 [native-contract.json](native-contract.json)，连同实际设备、DLL、addon、探针与运行脚本摘要。

本组没有证明完整 Alpha 管线：样本使用均匀 Alpha，尚未覆盖透明边缘、所有重采样器、字幕、ICC 或自定义 shader。真实 HDR 片源、硬件解码、连续影音时钟、设备丢失、这项候选的 Electron 导入，以及 macOS／Linux／ARM64 也未由本组验证。

## 复现

```sh
python refactor/verification/evidence/libmpv-renderer/prepare.py
python refactor/verification/evidence/libmpv-gpu/run.py
python refactor/verification/evidence/libmpv-renderer/run.py
```

准备原有 GPU 输入后再执行；常规 Electron 和颜色探针使用原来的固定 DLL，候选对照单独使用本组 CI 产物，不替换工作区或系统媒体库。
