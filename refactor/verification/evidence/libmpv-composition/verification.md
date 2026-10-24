# 完整画面的单位转换与字幕对照

范围说明：本组保留此前渲染与 HDR／线性输出研究的原始目标、源码和收据，正文按当时实验说明。现行交付已收敛为[SDR 输出与 HDR 片源到 SDR](../../../design/projects/libmpv-node/video.md#targets)；HDR 显示和亮度单位转换不再是待完成要求，历史结论不直接等同于当前 SDR 验收。

本组实现 Windows D3D11 离屏 GPU 转换原型，验证视频、静态 ASS 字幕和自定义 OSD 是否采用同一亮度单位。有限输入的整帧换算通过，本组原始 DLL 中仍保留低峰值线性字幕反例。后续[同源构建对照](../libmpv-upstream-fix/verification.md)已验证其责任代码和最小修复，并已确认采用该补丁；正式制品、正常播放验收和完整颜色管线仍须完成。

## 实际路径

[run.cjs](run.cjs)复用已核对摘要的 libmpv DLL、既有原生生产 addon 与合成 PQ 输入。八种配置分别输出 63×47 和 31×23 两帧，共十六帧；各帧在播放核心关闭后仍被独立持有。输入包括中性阶梯、BT.2020 色块，以及本组生成的 ASS 半透明绿色矢量块、带黑色描边的白色文字和半透明红色 OSD。为稳定测试区域，合成素材使用明确的 4:3 显示宽高比。

字幕通过文件选项加载，OSD 使用公开 Lua overlay 入口。记录核对字幕实际选中及输出原色、曲线；blend-subtitles 保持原生 no，没有为单位转换改变字幕混合方式。生产端使用 linear、RGBA16F 与已验证的 gamut-mapping-mode=clip；旧 helper 的 scrgb 参数仅选择浮点纹理分配。

[convert.cpp](convert.cpp)在独立测试进程中复制生产者的共享 NT 句柄，在相同 adapter LUID 上打开原生纹理，运行一个完整画面的 D3D11 像素着色器：RGB 乘单位比例，Alpha 保持不变。图像仍直接来自 GPU 纹理；前后读回只用于检验。测试进程拥有自己的设备和状态，没有验证未来同设备集成时的状态恢复、资源池和再次共享交付。[共享资源接口](https://learn.microsoft.com/en-us/windows/win32/api/d3d11_1/nf-d3d11_1-id3d11device1-opensharedresource1)

除 OUTPUT hook 反例外，其余七种配置分别转换到每单位 80 和 240 nit，共二十八次 GPU 转换。源单位按本次固定渲染器的 min(peakNits, 203) 计算。所有已返回原生帧在 finally 中归还；没有打开显示窗口、切换 HDR 或使用用户媒体与配置。

## 独立像素检查

[verify.py](verify.py)核对输入、源码、二进制、共享输入与结果文件的摘要，逐分量以 float32 运算和 float16 量化独立计算预期值。153714 个有限 RGB 分量的最大差异为一个半浮点 ULP；Alpha 与原值逐位相同。负分量和大于 1 的值均保留，实际结果中存在大于 5 的分量。

通过无覆盖、仅字幕、仅 OSD、两者同时存在四组控制图确定各层确实参与绘制。两种尺寸分别有 225／69 个显著字幕变化像素和 136／44 个显著 OSD 变化像素。有限输入的完整转换覆盖每个像素，包括这些区域的抗锯齿与透明混合结果；它没有改变上游字幕绘制算法。

另以 OUTPUT hook 乘 0.5 作为明确反例：中部无覆盖的视频区域正确减半，但字幕与 OSD 并未作为同一个完整画面统一减半。两种尺寸分别检出 186／54 个字幕像素和 128／32 个 OSD 像素偏离预期。这个反例验证了整帧出口的必要性，不限制用户将 shader 用于正常的画面效果。

## 尚未解决的原生非有限像素

原生 target-peak=100 的线性结果，在进入本组转换器之前已有 NaN：63×47 中有 73 个像素、31×23 中有 26 个像素的 RGB 非有限，Alpha 仍为 1。它们来自包含黑色描边的字幕区域。整帧转换保留这些非有限输入，没有通过替换颜色来掩盖问题。[原生记录](native-contract.json)、[分析结果](analysis.json)

[diagnose.cjs](diagnose.cjs)补充二十三组原生对照，并生成独立纯黑 PQ 视频与灰色 SDR 视频。ffprobe 确认前者为 10 位、BT.2020、PQ、有限范围，带 4000 nit 的 mastering／content-light 元数据；后者为 8 位、BT.709 原色与传递标记、有限范围，不含上述 HDR 元数据。纯黑 PQ 视频在本次 418 nit 线性目标下没有复现相同问题，不能将结论扩大成所有 HDR 黑色画面都会失败。

最初的传递曲线对照保持 BT.2020 原色不变，所以下表中的 sRGB 指传递曲线，不将 BT.2020 原色加 sRGB 曲线命名为公开的 srgb 目标。后续另测 BT.709 原色、sRGB 曲线、203 nit 的 SDR 片源对照，同样未复现 NaN。

| 含黑色描边字幕的目标        | 色调映射             | 本机结果                             |
| --------------------------- | -------------------- | ------------------------------------ |
| linear，100 nit             | auto、hable          | 原生结果出现 NaN                     |
| linear，202 nit             | auto                 | 原生结果出现 NaN                     |
| linear，203／418 nit        | auto                 | 本组未出现 NaN                       |
| linear，100 nit             | clip、linear、mobius | 本组未出现 NaN，映射行为与 auto 不同 |
| PQ／sRGB，100 nit，浮点存储 | auto                 | 本组未出现 NaN                       |

这里的 tone-mapping=clip 与已用于线性原色表示的 gamut-mapping-mode=clip 是不同选项。改换色调曲线可以避开本次现象，但不等同于修复同一算法，也不能据此声称所有参数组合已经通过。[全部黑色像素对照](black-contract.json)

SDR 对照仅更换片源，保留同一 ASS、OSD 和输出配置，并记录原生 video-params 的源原色与曲线。linear／100 nit 仍得到 219／78 个非有限 RGB 分量；linear／203 nit 与 sRGB／203 nit 对照未复现。因此 HDR 片源不是必要条件。本组完全离屏，在送往实际显示器之前即可复现；没有验证或要求系统 HDR 开关处于某个状态。不能将问题扩大为所有 SDR 播放都会失败。

进一步只改变输出原色，在同一 linear、100 nit、tone-mapping=auto、黑色 ASS 描边条件下，三组原色均复现：

| 公开线性目标      | 原生 target-prim | HDR 片源 | SDR 片源 |
| ----------------- | ---------------- | -------- | -------- |
| srgb-linear       | bt.709           | 出现 NaN | 出现 NaN |
| display-p3-linear | display-p3       | 出现 NaN | 出现 NaN |
| rec2020-linear    | bt.2020          | 出现 NaN | 出现 NaN |

每组在两种尺寸下均为 219／78 个非有限 RGB 分量，原生目标原色也通过实际属性核对。这表明本次失败不限于 BT.2020 编码坐标；它发生在交付单位换算之前，不能通过只改变 nitsPerUnit 消除。结论仍限于本次固定来源与 Windows D3D11 路径。

## 上游修复候选

固定参考源码的 pass_tone_map 末尾使用原始最大颜色分量 sig_orig 作除数，没有零值保护。黑色字幕颜色进入该路径时具备触发零分母的条件；原生 OSD 色彩管理将字幕视为 sRGB，源参考峰值为 203 nit，目标低于它时会进入映射。这与 100／202 和 203／418 的对照边界一致。后续独立同源重建已确认未修改版本复现，只有该行保护的实验版本消除本组失败。[映射代码](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/gpu/video_shaders.c)、[OSD 颜色处理](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/gpu/video.c)

[候选补丁](upstream-black-guard.patch)仅在 sig_orig 为零时避免该除法，保留非零值的原运算。后续[同源修复对照](../libmpv-upstream-fix/verification.md)分别构建完整原版与补丁版，验证 49 个场景、原有有限像素和黑色／透明度判据。该修复列于[正式源码采用清单](../../../design/projects/libmpv-node/distribution.md)，本目录保存定位该问题的原始探针、补丁与结果。

本例使用一致的目标、存储格式与合法 ASS 内容，属于正常输出范围，不是脚本违反受管配置约定的场景。当前保留接口范围与原生反例，低峰值线性字幕组合仍列为未通过验收。

## 复现与范围

准备既有 GPU 探针及 HDR 映射对照的合成输入后，从仓库根执行：

```sh
cargo build --offline --locked --manifest-path refactor/verification/evidence/libmpv-composition/Cargo.toml --target-dir node_modules/.cache/libmpv-design/composition-target
node refactor/verification/evidence/libmpv-composition/run.cjs
node refactor/verification/evidence/libmpv-composition/diagnose.cjs
python refactor/verification/evidence/libmpv-composition/verify.py
```

验证脚本成功表示记录、有限值换算、各图层控制和已知反例均与判据一致；normalPlaybackValidationPassed 仍为 false。像素二进制、生成 ASS、Lua 与反例 shader 位于仓库忽略缓存，记录保存其摘要和生成文本。

本组没有验证物理显示、Electron 中这两个单位的完整呈现、动态 ASS 动画、持续帧池、硬件解码或其他平台。它不为此前失败的 Electron scRGB 80 nit 描述提供新的显示通过结论，也没有实现正式公共输出包。
