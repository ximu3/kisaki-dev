# libmpv 输出能力与终态边界检查

本组为[视频输出终态设计](../../../design/projects/libmpv-node/video.md)提供来源与原生正反例，分别检查软件渲染、线性目标表示、Alpha 与呈现反馈。它不按原型覆盖范围缩减终态功能，也没有实现完整公共输出包。

最新确认的终态以原生、稳定的不透明播放为受管输出范围，透明片源沿用上游处理，不额外修复通用透明合成算法。下述 Alpha 反例保留为原生行为记录，不再单独构成必须更换渲染器的门槛；正常字幕、缩放及 SDR／HDR 映射仍需独立验证。

## 输入与来源

继续使用[固定探针 DLL](../libmpv-native/binary-input.json)、[GPU addon](../libmpv-gpu/verification.md)和代码生成的参考图片。执行前校验 DLL、addon 和样本摘要，不读取用户配置或媒体。临时 Lua、GLSL 与来源副本均位于仓库忽略的缓存目录。

实际 DLL 报告 mpv v0.41.0-1205-g01e2533f3、libplacebo v7.376.0 (v7.360.0-171-g0df80ae-dirty) 与 FFmpeg N-127617-g94cba3150。libplacebo 的公开 0df80ae 源码作为定义参照，不能冒充带 dirty 标记制品的完全一致来源；整个探针组合仍不是最终发行依赖。

[source-probe.py](source-probe.py)记录固定 mpv／Electron 与上述 libplacebo 参照的 13 份来源摘要和 15 项文本检查，结果见 [source-contract.json](source-contract.json)。这些是来源定位，不是执行测试。新的运行行为分别由下述两个探针记录。

<a id="software"></a>

## 软件 Render API

[software-probe.py](software-probe.py)在有超时的独立 Python 子进程中经真实 C API 创建软件 Render API 上下文，调用方提供按 64 字节要求对齐的存储，载入参考图并渲染。

实际检查包括：无媒体的黑色背景；rgb0、bgr0、0bgr、0rgb、rgb24 五种文档格式；63×47 到 31×23 的尺寸变化；核心与渲染上下文关闭后，调用方持有的存储保持不变。所有原生目标调用均成功。输出记录在 [software-contract.json](software-contract.json)，只保存布局、像素样本与摘要。

从 sRGB 改写为 linear 的原生 target-trc 请求成功，但软件输出的参考像素没有变化。源码中这一路径使用软件缩放器与 OSD 绘制，没有 GPU target_trc 配置处理。上游头文件也明确记录其 HDR 局限。因此不能把它包装成与 GPU 目标等价的另一种存储方式。[软件实现](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/libmpv_sw.c)、[软件 API 说明](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/include/mpv/render.h)

本组没有实现 SoftwareFrame 的 Node 交付，也没有验证软件 HDR 滤镜、全部视频或字幕组合。原生调用方存储稳定不等于已经实现拟议的 JavaScript 独立字节合同。

<a id="color"></a>

## scRGB 与线性亮度标尺

[color-probe.mjs](color-probe.mjs)使用已有真实 addon，经直接 D3D11 路线执行 14 组参考条件；每组同时采样原尺寸与缩小后的独立纹理，所有帧均在核心已经关闭后读取，最后归还。结果见 [color-contract.json](color-contract.json)。本探针进程没有加载 ANGLE。

手册将 target-trc=scrgb 标为 gpu-next 专用；当前 Render API 仍走 gpu 渲染器。其选项被接受不能证明输出已经符合 scRGB。原型继续得到约 0.02029 的白色；加乘数 125 后接近 203／80 只能解释这个受限条件，不能作为正式算法。

另一组使用已支持的 target-trc=linear、1000 nit 目标和浮点纹理，原生白色为 1。固定来源中的 MP_REF_WHITE 为 203，libplacebo 将超过 SDR 参考亮度的目标视为 HDR；按其已知线性单位换算到每单位 80 nit 后，输出约 2.537109375，与 203／80=2.5375 相符。单位转换通过公开 OUTPUT shader hook 实现，没有修改 libmpv 二进制。

这验证了一条适用当前输入与目标的接入方向。目标峰值改变会影响原生归一化路径；必须按固定构建和目标推导换算，不能从亮度大小猜测，不可把本实验常量套用到全部目标。负通道、超白、其他峰值、HDR 源、字幕与 Electron 的这项具体颜色导入仍未执行。本组没有验证物理 HDR 显示器。

<a id="alpha"></a>

## Alpha 与颜色转换的正反例

探针比较同一参考图的 Alpha=255 与 Alpha=128，按输出编码域计算半透明像素与不透明像素乘以实际 Alpha 的偏差：

| 条件                             | 最大通道偏差    | 可得结论                                  |
| -------------------------------- | --------------- | ----------------------------------------- |
| 原生 PQ／RGBA16F                 | 约 0.13632      | 不符合所要求的编码域预乘关系              |
| 原生 Display P3／8 位            | 约 5.6 个码值   | 不能用先前单个 sRGB 样例概括所有目标      |
| SCALED 解预乘、OUTPUT 再预乘，PQ | 约 0.000225     | 简单未缩放样例的表示关系得到修正          |
| 同样两个 hook，Display P3        | 约 0.459 个码值 | 当前样例在量化误差范围内相符              |
| 两个 hook 加线性缩小，PQ         | 约 0.04337      | 仍有偏差，简单前后处理不是完整 Alpha 方案 |

源码显示原生输入会先转成预乘表示，之后继续经过缩放、颜色和输出步骤。正确处理必须共同考虑这些步骤及字幕；不能为了通过当前样例而将合法的线性缩放从终态范围删去。当前原型没有修复完整 Alpha 路径，也没有将 hook 实验选为正式实现。

<a id="presentation"></a>

## 呈现反馈

上游 mpv_render_context_report_swap 不接受时间戳或帧序号；实际实现增加翻页计数并唤醒等待。第一次使用后，调用方需要一致地继续通知。等待不到更新或翻页时的约 200 ms 超时不是正常同步方案。

Electron 的 sharedTexture 文档分别描述导入、传递、VideoFrame 时间字段与最终引用回收，没有在这条协议里提供实际逐帧翻页回执。不能把这些完成事件替换为 report_swap。拟议公开 reportSwap 只是忠实适配原生入口；真实宿主反馈下的同步效果、暂停与丢帧仍须运行验证。本组只做来源核对，没有模拟硬件呈现来宣称这条路径通过。

## 复现

```sh
python refactor/verification/evidence/libmpv-output/source-probe.py
python refactor/verification/evidence/libmpv-output/software-probe.py
node refactor/verification/evidence/libmpv-output/color-probe.mjs
```

颜色探针要求先完成已有 GPU addon 的准备与构建。软件和颜色收据保存本次源文件摘要、运行输入与结果；预期不符合的颜色关系明确记录为反例，不转换成能力不需要提供的结论。
