# Electron PQ 显示路径核对

范围说明：本组保留此前渲染与 HDR／线性输出研究的原始目标、源码和收据，正文按当时实验说明。现行交付已收敛为[SDR 输出与 HDR 片源到 SDR](../../../design/projects/libmpv-node/video.md#targets)；HDR 显示和亮度单位转换不再是待完成要求，历史结论不直接等同于当前 SDR 验收。

本组延续[播放与 HDR 参考检查](../libmpv-playback/verification.md#hdr)，核对 Chromium 实际消费 PQ 帧的路径。使用同一已校验的 libmpv DLL、原生 addon、SDR 四色图和带亮度元数据的 1000 nit HEVC 参考视频；没有改变原生渲染器或公共声明。

## WebGPU 偏差的原因

Electron 44.5.1 对应 Chromium 152.0.7977.130。该版本的 [external_texture_helper.cc](https://github.com/chromium/chromium/blob/152.0.7977.130/third_party/blink/renderer/modules/webgpu/external_texture_helper.cc)直接取七参数形式的源传递函数，没有检查取得结果；[ColorSpace::GetTransferFunction](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/gfx/color_space.cc)对 PQ 返回 false，并留下恒等函数参数。该组合没有执行 PQ 解码。

这解释了此前 WebGPU 中两个中性白的读数：原生 PQ 值 0.580566 和 0.751953 直接经过 sRGB 编码后，接近实际读回的 0.785645 和 0.881836。修改 Canvas 的 toneMapping 不能补回输入阶段缺失的 PQ 解码。因此，当前直接 importExternalTexture 加采样的路径不能作为 PQ 显示实现；此结论限于已检查版本和调用路径。

## Canvas 与视频元素对照

[preload.cjs](preload.cjs)把同一 VideoFrame 分别交给浮点 Canvas 2D 和 MediaStreamTrackGenerator／video。视频元素接收已经由 libmpv 渲染的像素，不读取文件、不解码源视频，也不接管 libmpv 的音频或媒体控制。

Canvas 2D 接受 float16 存储，但 getContextAttributes 返回的 toneMapping 为 standard，即使请求了 extended。该版本中相关 [CanvasToneMapping 功能仍为 experimental](https://github.com/chromium/chromium/blob/152.0.7977.130/third_party/blink/renderer/platform/runtime_enabled_features.json5)。本组没有开启实验开关；读回的参考白约为 0.734375，高光约为 1，因而不把该路径当作 HDR 呈现。

video 能接收原生 RGBA16F 帧，并保留 BT.2020／PQ 描述。启动阶段持续送入同一参考帧的独立引用，等待实际 requestVideoFrameCallback；最早送入的单帧可能早于直播轨道接收端就绪。回调只证明浏览器的帧提交，不被当作物理翻页回执或 libmpv reportSwap 的依据。

<a id="compositor"></a>

## 系统合成结果中的 HDR 范围

[capture.cpp](capture.cpp)只捕获测试窗口自己的 HWND，使用 Windows Graphics Capture 的 RGBA16F 帧池读取浮点像素，避免普通八位截图截断 HDR。取样同时覆盖视频的四个色块和页面 CSS 白色；不保存桌面或其他窗口图像。[Windows HDR 捕获说明](https://learn.microsoft.com/en-us/windows/uwp/audio-video-camera/screen-capture)、[指定窗口捕获](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)

| 系统状态 | 页面白色，合成浮点值 | 203 nit 编码参考白 | 1000 nit 编码参考白 | 高光／页面白 |
| -------- | -------------------- | ------------------ | ------------------- | ------------ |
| SDR      | 约 2.00              | 约 0.994           | 约 2.00             | 约 1.00      |
| HDR      | 约 3.00              | 约 2.035           | 约 5.214            | 约 1.74      |

HDR 模式下，高光明确超过同一窗口的页面白色，红、绿、蓝参考也没有出现此前 WebGPU 中的大幅通道串色。SDR 模式的高光与页面白色相符。两组收据分别为 [sdr-contract.json](sdr-contract.json) 和 [hdr-contract.json](hdr-contract.json)。这些是系统窗口合成缓冲的证据，不是面板光学亮度、色准或全平台验收。

G24H2 的 DXGI 报告峰值约为 417.71 nit，全屏峰值约为 282.86 nit；这是驱动能力报告，不是现场测量。用户授权范围内临时开启 HDR，结束后核对两块显示器的分辨率、刷新率、颜色状态及白电平与开始前一致。[恢复记录](displays.json)

<a id="mapping"></a>

## 最终亮度映射仍需明确归属

原生两组参考白的绝对编码亮度比约为 4.94，HDR 合成结果中的比例约为 2.56，说明视频显示端进行了额外映射。Chromium 的 [Skia 视频合成路径](https://github.com/chromium/chromium/blob/152.0.7977.130/components/viz/service/display/skia_renderer.cc)会结合显示器 HDR 范围及 Windows SDR 白电平应用 tone mapping；PQ 并非自动原样直通。

当前 [Electron 纹理导入描述](https://www.electronjs.org/docs/latest/api/structures/shared-texture-import-texture-info)提供颜色空间，但没有源视频 MDCV／CLLI 等 HDR 元数据字段。源文件有完整元数据，只证明 libmpv 输入成立，并不证明它们随渲染结果进入 Chromium。Chromium 对缺失内容峰值使用[自己的缺省规则](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/gfx/hdr_metadata.cc)。本组不能据此认定不同目标峰值与不同显示器上的最终亮度均正确。

下一项设计判断是采用浏览器视频显示时如何划分最终映射：libmpv 保留解码、字幕与视频处理，宿主负责显示适配；具体 PQ 目标、浏览器元数据能力及二次压缩的影响必须一起核对。若要求宿主严格保留 libmpv 已完成的显示映射，则需要验证明确的颜色转换接入。当前没有为规避问题而伪造颜色标签、增加通用线性目标或修改已确认的公共合同。

[后续映射归属检查](../libmpv-tonemapping/verification.md)增加了 4000 nit 阶梯与 BT.2020 色块，对照不同 PQ 目标和单位明确的线性 HDR。它为由 libmpv 执行映射的候选提供了进一步证据，不将本组两白点结果单独用作最终选择依据。

## 生命周期与尚未完成的范围

原生核心在帧进入 Electron 前已经关闭；独立帧仍可被读取和显示。测试关闭写入端与视频轨道，清空 video 并等待 emptied，再关闭 VideoFrame 和导入对象。主进程等待所有 allReferencesReleased、归还原生持有后才销毁窗口，每帧最终回收一次；该回收检查独立于 emptied，后者不被当作 GPU 引用已经全部释放的证明。

探针早期直接销毁窗口的做法曾出现残留引用警告；最终改为等待实际清空与最终回收，收据明确记录 allReferencesReleasedBeforeWindowClose，且没有悬空导入引用警告。这个短测仍不能代替持续不同帧播放的有界回收证明。

仍未覆盖连续不同帧的资源压力、完整 Node 帧邮箱、快速切换与定位、音画同步、字幕亮度、显示器切换、renderer 崩溃、硬件解码及其他平台。compositedHdrHeadroomVerified 只表示本机 HDR 对照的合成范围检查通过；productionDisplayPathVerified 与 physicalHdrDisplayVerified 仍为 false。

## 复现

```sh
python refactor/verification/evidence/libmpv-display/run.py
```

普通运行不改变系统显示状态，创建短暂可见的测试窗口。脚本使用离线 Cargo 编译自身捕获 helper，所有构建产物、临时配置和普通运行收据位于仓库忽略缓存。Windows SDK 10.0.22621.0、MSVC 与既有参考样本是本机验证前提。

```sh
python refactor/verification/evidence/libmpv-display/run-displays.py --hdr-test G24H2
```

该对照命令仅用于已经授权的 G24H2 临时 HDR 测试，要求初始状态为 SDR。它保存恢复状态，在 finally 中还原，核对完整显示状态后写入两组收据及源码摘要；不更改另一显示器。收据中的所有像素数值都来自运行结果。
