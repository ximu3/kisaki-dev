# 低峰值线性字幕的同源修复对照

完整上游源码的自建未修改版本复现了低峰值线性字幕中的 NaN；只加入既有零分母保护的自建版本通过本组修复前后对照。两版各运行 49 个场景、输出 98 帧。补丁版消除了原版的 5103 个非有限 RGB 分量，534975 个原本有限的 RGB 分量逐位不变。

这确认了本次 Windows D3D11 配置下的责任代码与最小修复效果。此后已经确认由正式构建携带这项修复，补丁及源码摘要进入[采用清单](../../../design/projects/libmpv-node/distribution.md)；本次实验不表示修复已经被上游接受，也不表示完整颜色管线或发行制品已经通过验收。当前交付已收敛为 SDR；本组原始线性／HDR 诊断仍用于说明补丁因果，不能改称当前 SDR 组合已全部通过。

## 完整构建与输入冻结

[build.py](build.py)从完整的 [mpv 固定提交](https://github.com/mpv-player/mpv/tree/01e2533f3143b8940857ca419b0b367f583e05ca)构建 libmpv DLL。baseline 工作树保持干净；patched 工作树唯一源码差异是 [video_shaders.c 第 830 行](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/gpu/video_shaders.c#L830)的条件除法，字节对照和 Git 差异均核对。该行与先前保存的[候选补丁](../libmpv-composition/upstream-black-guard.patch)一致。

工具链来自项目缓存中的独立 MSYS2 UCRT64 环境。基础归档采用官方 2026-09-27 版本，SHA-256 与发布摘要核对；安装完成后冻结软件包版本、归档哈希和运行 DLL 哈希，两版构建之间没有更新依赖。[依赖清单](dependencies.json)

| 输入              | 本次版本                                 |
| ----------------- | ---------------------------------------- |
| mpv               | 01e2533f3143b8940857ca419b0b367f583e05ca |
| GCC／Meson／Ninja | 16.2.0／1.12.1／1.13.2                   |
| FFmpeg            | 9.0.2                                    |
| libass            | 0.17.5                                   |
| libplacebo        | 7.360.1                                  |
| shaderc           | pkg-config 2026.4.1，软件包 2026.4-1     |
| LuaJIT            | 2.1.1791988261                           |

两版采用相同 release、libmpv、D3D11、shaderc、SPIRV-Cross、LuaJIT、libavdevice 和线程选项。配置头去除参数记录顺序的差别后相同，Meson 功能选项及按名称排序的依赖图完全相同。OpenGL、硬件解码和其他自动可选功能没有用于本组测试。媒体依赖使用已记录的 MSYS2 预制包，这套研究环境尚未成为正式发行依赖选择。

| 版本   | DLL SHA-256                                                      |
| ------ | ---------------------------------------------------------------- |
| 原版   | e5376465e6f5f5885ba37dd47a518b84bf44201a93bd61286a6f3ab71470c98b |
| 补丁版 | 096f5fc768ff36556563ded5a0851728971d2fca3d40a642106d12964fe11d17 |

[原版构建记录](baseline-build.json)和[补丁构建记录](patched-build.json)保存选项、源码状态、日志摘要、二进制哈希及完整测试摘要。两版最终串行运行的 41 项上游测试均通过。

## 实际绘制与独立检查

[capture.cjs](capture.cjs)继续使用原有 GPU addon，核对 addon、C++ 生产者、Rust 绑定和历史输入的摘要，没有修改原生探针。实际路径仍为 Windows x64、直接 D3D11、RGBA16F、软件解码、离屏绘制，尺寸为 63×47 和 31×23。Lua 设置并读取实际传递曲线、原色、峰值、映射曲线、字幕选中状态和 OSD 状态，blend-subtitles 保持 no，GPU shader 缓存关闭。

该版本 libplacebo 不包含探针初始 scrgb 选项所需的 API。探针使用已有 pq 参数选择同一种 RGBA16F 存储，随后由 Lua 设置并核对每个场景的实际目标；最终 linear 场景并未使用 PQ 传递曲线。

49 个场景包含原有 23 个黑色／字幕诊断、8 个完整画面组合，以及 18 个新色块对照。新增对照使用同一 SDR 灰色片源，在三组原色和 100／203／418 nit 下分别绘制视频底图与字幕色块；色块编码值为 0、1、8、255，ASS 透明度为 0、64、128、255。

| 检查                                                      | 原版                            | 补丁版   |
| --------------------------------------------------------- | ------------------------------- | -------- |
| 三组原色 × SDR／HDR，linear／100 nit／auto，黑色 ASS 描边 | 每组 219／78 个非有限 RGB 分量  | 全部有限 |
| 既有 hable／100、auto／202 及完整画面低峰值例             | 复现非有限值                    | 全部有限 |
| 三组原色，linear／100 nit 的纯黑字幕色块                  | 每组 594／216 个非有限 RGB 分量 | 全部有限 |
| 全部场景中原本有限的 534975 个 RGB 分量                   | 比较基线                        | 逐位不变 |
| 输出 Alpha                                                | 全部为 1                        | 全部为 1 |

[verify.py](verify.py)独立读取原始半浮点数据，核对构建、依赖、输入和逐场景子进程记录。它同时检查 288 个色块内部采样点：不透明黑色必须精确为零；近黑色按 sRGB 线性化与亮度单位计算；完全透明色块必须保留原底图；中间透明度按前景与背景的贡献计算。

中间透明度的判据传播半浮点输入转换和各步混合的精度区间，不假设整个混合只发生一次最终量化。本机相对理想实数混合最多相差 3 个半浮点 ULP，这种偏差也存在于未修改版的正常控制组中；两版正常像素仍逐位相同。精度区间依据 Direct3D 11 对浮点转换、融合运算和输出混合精度的约定，不用于证明某一具体驱动的内部指令顺序。[浮点与混合规范，3.1.5／3.2.2／17.5 节](https://microsoft.github.io/DirectX-Specs/d3d/archive/D3D11_3_FunctionalSpec.htm)

其中 12 个原本为 NaN 的半透明黑色内部采样点，正确结果必须含有非零背景贡献。将异常 RGB 直接替换为零会被这些判据拒绝。因此，本组验证包含颜色与透明混合的正确性，而不只是统计 NaN 数量。[完整分析](analysis.json)

## 构建环境中保留的问题

准备过程的失败没有作为通过结果丢弃：

- 原始测试入口中，12 个以 `.mkv.exe` 结尾的程序在本机提前退出。对同一个程序复制字节完全相同、名称以普通 `.exe` 结尾的副本后，实际测试通过。[test-wrapper.py](test-wrapper.py)仅完成这一测试入口处理，参数和上游源码保持原样，副本哈希写入测试日志。这个现象的系统层原因尚未查明。
- 最初未启用 libavdevice 时，编码测试不能打开 lavfi 输入。最终两版均明确启用该能力。
- 启用上述能力后，一次并行上游测试出现 libmpv-lifetime 的 `0xc0000409` 退出；单独运行及最终两版串行测试通过。并行异常尚未归因，不据此宣称并发压力与退出验收通过。初始及并行失败日志保留在构建缓存的 `tests-baseline-initial.*` 和 `tests-baseline-parallel.*`。
- 未加补丁的版本完成首个场景并释放动态库引用后，在同一 Node 进程第二次尝试装载 libmpv 时，触发 ggml 内部断言，测试进程退出。这是尚未归因的重复装载失败，尚未确定属于依赖自身、卸载顺序还是探针用法，也未证明所有相关 DLL 已经完整卸载。最终像素对照固定为每场景一个新 Node 进程，避免该路径影响颜色对照；此调整不表示装载问题已经修复。普通 loadfile 切换视频不执行这套动态库释放／再装载操作。

上述问题属于这套实验环境的适用边界，不能被本次零分母修复的通过结果覆盖。

## 复现与结论边界

准备记录所指的隔离 MSYS2 环境、完整固定源码和既有合成媒体后，从仓库根执行：

```sh
python refactor/verification/evidence/libmpv-upstream-fix/build.py baseline
node refactor/verification/evidence/libmpv-upstream-fix/capture.cjs baseline
python refactor/verification/evidence/libmpv-upstream-fix/build.py patched
node refactor/verification/evidence/libmpv-upstream-fix/capture.cjs patched
python refactor/verification/evidence/libmpv-upstream-fix/verify.py
```

构建脚本会核对依赖冻结记录，并在原版复现六个核心失败场景后才建立补丁工作树。每场景的两个返回帧均在 finally 中释放；原始像素、Lua、ASS、构建目录和运行 DLL 保存在仓库忽略缓存，记录保留摘要。

本次结果支持将低峰值线性字幕问题归到上游 pass_tone_map 的零分母路径，并证明既有候选在本机本组正常输入中有效。该补丁现已获准进入正式源码输入方案，未来选择包含等效修复的上游提交并通过回归后移除补丁。当前两种 SDR 目标的完整宿主消费、HDR 片源到 SDR、动态字幕、适用 shader 与参数组合、持续资源池、其他平台和发行依赖验收仍不由本组结果代替。物理 HDR 显示与线性单位转换已退出交付范围，原始记录中的相关状态仅保留历史含义。
