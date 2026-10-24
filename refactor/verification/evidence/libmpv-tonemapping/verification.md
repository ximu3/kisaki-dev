# HDR 映射归属与线性交付对照

范围说明：本组保留此前渲染与 HDR／线性输出研究的原始目标、源码和收据，正文按当时实验说明。现行交付已收敛为[SDR 输出与 HDR 片源到 SDR](../../../design/projects/libmpv-node/video.md#targets)；HDR 显示和亮度单位转换不再是待完成要求，历史结论不直接等同于当前 SDR 验收。

本组比较 PQ、线性 HDR 及 SDR 条件下的映射和显示结果，复用[Electron 显示试件](../libmpv-display/verification.md)。输入、目标和单位是本实验的参数；其中媒体夹具也用于后续[黑色字幕回归](../libmpv-upstream-fix/verification.md)。

## 输入、路径与检查范围

[run.py](run.py)生成两段 10 位 HEVC／BT.2020 PQ 参考视频：

- 七级中性阶梯：0.1、10、100、203、400、1000、4000 nit。收据同时保存量化码值及其实际编码亮度。
- BT.2020 红、绿、蓝、黄、青、品红与白色参考，每个启用的 RGB 分量为 100 nit。

输入带 4000 nit 的 Mastering Display／Content Light 信息；ffprobe 核对阶梯的 PQ、原色与元数据。原生渲染继续使用未修改的既有 DLL 和 addon，经直接 D3D11 输出 RGBA16F；关闭硬件解码与动态峰值检测，不读取用户媒体或配置。Lua 对设置和加载调用检查返回结果。

每个模式先读取原生帧，再经 sharedTexture、MediaStreamTrackGenerator 和 video 显示。等待三次浏览器帧回调后，使用既有 [Windows 捕获 helper](../libmpv-display/capture.cpp)读取测试窗口的浮点合成结果。帧回调不被当作物理翻页回执；实际采集还要出现参考内容的数值差异。每个原生核心都已在显示前关闭，所有共享引用在销毁测试窗口前回收。

[HDR 收据](hdr-contract.json)和 [SDR 对照](sdr-contract.json)各包含十种模式。线性 HDR 对照使用每单位 240 nit，对应这次 HDR 环境的系统白电平；SDR 运行仅记录同批样本的消费行为，不表示建议在 SDR 状态使用这组 HDR 参数。G24H2 的原状态均在 finally 中恢复，两个显示器的完整查询结果保持一致。

<a id="pq"></a>

## PQ 路径的具体限制

| 原生交付           | 本机 HDR 合成中的结果                                           | 判断                                   |
| ------------------ | --------------------------------------------------------------- | -------------------------------------- |
| 4000 nit 目标的 PQ | 原生约 1001 与 4010 nit 两档，合成后得到同一高光值              | 当前消费路径丢失了这两档的区别         |
| 1000 nit 目标的 PQ | libmpv 先把 4000 nit 内容压入 1000 nit，Chromium 继续适配显示器 | 能保留两档区别，但执行了两阶段范围压缩 |
| 418 nit 目标的 PQ  | 原生峰值约 417.70 nit，合成编码约 286.04 nit                    | 已按目标映射的结果又被显示端改写       |

这些结果比单纯观察亮度比例变化更具体。范围压缩本身并非错误，但在当前接口中不能假设任意 PQ 目标都能被准确理解。该版 Chromium 对 PQ 使用 tone mapping，并在缺少内容峰值信息时采用自己的缺省值；当前 Electron 导入描述没有完整 HDR 元数据入口。[Chromium 映射入口](https://github.com/chromium/chromium/blob/152.0.7977.130/cc/paint/tone_map_util.cc)、[元数据缺省](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/gfx/hdr_metadata.cc)、[Electron 导入合同](https://github.com/electron/electron/blob/v44.5.1/docs/api/structures/shared-texture-import-texture-info.md)

表中的合成编码亮度按 Windows HDR scRGB 标尺解算，不能当作面板实测亮度。也未用它判定不同映射算法的全部视觉质量。

<a id="linear"></a>

## 保留 libmpv 映射结果的线性表示

对照采用原生 target-trc=linear，由 libmpv 完成亮度映射，再明确换算输出单位。固定来源将 HDR 线性目标按 203 nit 参考标尺归一化；目标低于该参考值时，按所选目标峰值归一化。本组依据这两个分支计算换算，覆盖 100 与 418 nit 目标，不按像素大小猜测单位，也没有把 target-trc=scrgb 的早期反例当作正确实现。[原生颜色处理](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/gpu/video_shaders.c)

以明确的每单位 240 nit 交付，并使用 Electron 的 linear-hdr 描述后，BT.709／BT.2020 中性阶梯的合成结果与原生输出相符。三个检查组均通过 2% 相对误差与小数值绝对误差下限的比对，阶梯保持递增。其中 BT.2020 的原生最高值约为 417.89 nit，合成编码约为 417.08 nit。

额外的 BT.2020 色块检查由 [verify.py](verify.py)按 D65 白点和两组标准原色独立推导线性转换矩阵，比较原生 RGB 与合成 scRGB。最大分量误差约为 0.00232 个 scRGB 单位，转换产生的负分量保持可见，没有被当作普通 sRGB 的 0–1 范围截掉。[颜色换算参考](https://www.w3.org/TR/css-color-4/#color-conversion-code)、[分析结果](analysis.json)

直接使用 scrgb-linear-80-nits 描述的对照则出现显著偏差，未被选为有效接入。linear-hdr 与该描述在 VideoFrame 的 WebCodecs 查询中都可能显示 transfer: null；这个查询没有覆盖所有内部颜色标识，不能凭 null 推断两者的内部处理相同。本组以像素比对区分实际结果。

本组说明一条可用方向：宿主提供显示条件，libmpv 执行映射，绑定交付单位明确的线性 HDR，宿主完成颜色转换与合成。它没有证明所有平台、影片、字幕与设置组合都已成立。

<a id="conversion"></a>

## 正式转换必须覆盖完整帧

本次只为隔离变量，通过公开 OUTPUT shader hook 做单位换算，未修改 libmpv 二进制。该 hook 不等同于完整帧的最终出口：默认字幕和 OSD 可以在它之后绘制。因此正式实现若采用这条方向，表示转换必须覆盖包含字幕和 OSD 的完整原生输出，不能照搬这个探针、强制改变字幕合成方式或占用用户的 shader 配置。[视频输出与后续 OSD 顺序](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/gpu/video.c)

这项转换只负责明确的数值标尺，色调映射与媒体处理仍由上游执行。整帧转换实现、字幕亮度、不同系统白电平、窗口跨屏、持续帧池回收、设备失效、硬件解码与其他平台均未完成。光学亮度和色准也没有测量；completeColorPipelineVerified 与 physicalHdrDisplayVerified 仍为 false。

当前原生 target-peak 接受 10–10000 的整数。本组将驱动报告的约 417.71 nit 明确选为 418 nit 请求；早期未检查 Lua 返回值的试验曾遗漏浮点请求失败，最终探针已使用受检调用。绑定合同应拒绝不符合原生要求的输入，不能在内部静默取整。

## 复现

```sh
python refactor/verification/evidence/libmpv-tonemapping/run.py
python refactor/verification/evidence/libmpv-tonemapping/run.py --hdr-test G24H2
python refactor/verification/evidence/libmpv-tonemapping/verify.py
```

HDR 命令仅在已授权的 G24H2 临时测试范围内运行，保存恢复状态并在 finally 中还原。普通命令用于 SDR 对照，运行前应确认系统处于 SDR。两个命令都会创建短暂可见的测试窗口，只采集该窗口的参考像素。样本、Lua、GLSL、临时用户配置和中间结果都位于仓库忽略缓存；收据保存来源、生成内容和二进制摘要。
