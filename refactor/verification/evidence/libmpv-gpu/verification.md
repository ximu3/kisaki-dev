# libmpv 与 Electron 的 Windows 图形原型

本组实际编译 Rust／Node-API addon，以 C++ 实验模块分别接入 ANGLE 和上游直接 D3D11 Render API，验证原生渲染、独立帧持有、部分颜色目标与 Electron 消费。它没有建立完整的公开 VideoOutput 或 NativeFrame 实现；[终态设计](../../../design/projects/libmpv-node/video.md)仍需完成。原型覆盖范围不决定最终功能范围。

同一 helper 后续增加显式 opengl-next 选择与 ANGLE 半浮点目标，供[另一组固定产物对照](../libmpv-renderer/verification.md)使用。本页常规检查仍使用原固定 DLL、既有 opengl 和直接 D3D11 入口，并在 helper 变更后重跑；不能把候选结果归给本页原生构建。

## 固定输入与执行路线

[prepare.py](prepare.py)校验并解压官方 Electron 44.5.1 的 Windows x64 发行包，保存到忽略的 node_modules/.cache/libmpv-design 下，不安装或替换工作区 Electron。该包没有独立的 libEGL.dll／libGLESv2.dll；ANGLE 对照路线使用已有 Electron 41.2.0 的两个 DLL 缓存副本。它们仅用于原型，不是 libmpv-node 的发行依赖，独立 ANGLE 装配仍未通过。

libmpv 使用[固定的探针 DLL](../libmpv-native/binary-input.json)，对应 01e2533f3143b8940857ca419b0b367f583e05ca，并非最终发行构建。较新的上游入口在 v0.41.0 稳定基线中不存在，不能把当前通过归给旧版本。直接 D3D11 所需头文件来自同一固定提交；来源和摘要与 ANGLE 声明、运行时、样本一起保存在 [binary-input.json](binary-input.json)。[Cargo.toml](Cargo.toml)、[Cargo.lock](Cargo.lock)和 [build.rs](build.rs)记录 Rust／napi-rs 与 C++ 构建输入。

样本包括代码生成的 63×47 PPM 四象限与灰色图、带 sRGB 标记的透明度参考 PNG，以及 1.5 秒 FFV1／PCM 视频。视频由准备脚本用所记录的 ffmpeg 版本生成；执行前校验样本摘要。所有探针使用自己的样本，明确 hwdec=no、ao=null，不输出真实声音、不读取用户配置或媒体。

[producer.cpp](producer.cpp)的两条生产路径如下：

- ANGLE：建立 OpenGL ES 3 上下文，从 EGL 查询同一 D3D11 设备，再向该设备的目标纹理渲染。
- 直接 D3D11：用 DXGI 选择硬件适配器并建立自己的 D3D11 设备，经公共 Render API 提供设备与目标纹理。独立 Node 子进程在执行前后均检查没有加载 ANGLE，传入的 ANGLE 路径为空。

两条路线均通过 GPU 复制建立独立、不可再写的共享纹理，以 NT 句柄交付。实验通过读回确认复制完成；这是原型的同步验证，尚非生产同步实现或性能结论。Windows 原型选择高性能适配器，没有验证公开设备枚举、平台默认选择或跨 GPU 互操作。

## 初始化、帧持有与原生设置

[native-probe.mjs](native-probe.mjs)对两条路线各执行三种顺序，共六组：初始化后建立渲染上下文；初始化前建立；初始化前建立后由显式启动脚本加载。第三种只由脚本发出 loadfile，实际加载和产帧均完成。

每组从 63×47 改为 31×23，持有两份独立纹理；随后将原生 vo 切为 null，并查询 current-vo 确认。释放 Render API 上下文并销毁核心后，旧纹理仍可读取且内容一致。帧保留纹理、设备与必要系统库引用，不保留 libmpv 核心。顶端行方向以四象限图核对，不能照搬窗口默认 framebuffer 的翻转设置。

SDR 设置明确使用 BT.709、sRGB、treat-srgb-as-power22=no 与 target-peak=auto，参考灰色维持 128。改为 linear 后变为 55，证明原生目标设置实际影响像素。先前 100 nit 试验中的 177→112 不再作为当前 sRGB 目标结果。交付的两帧在改动前已经固定，之后用于颜色比较的临时纹理不会替换它们。

screenshot-raw 实测为 bgr0，w=63、h=47、stride=256、data 长度 12032，包含行 padding；截图与共享纹理分别持有。原型在复制前检查布局和字节范围，尚未覆盖负 stride、所有截图格式或尺寸上限。

[源码比对](source-comparison.json)保留两个提交的 12 项历史来源收据：创建与释放、screenshot-raw 与配置共同写入函数的局部文本相同，渲染函数、头文件与 GPU 接入有差异。它不是旧版整版验证；当前直接 D3D11 的依据是实际新增执行结果。

## 容量占满时的播放推进

[pressure-probe.mjs](pressure-probe.mjs)分别使用容量 2 和 3。原生模块保留达到容量的全部帧直到播放结束，后续更新使用 MPV_RENDER_PARAM_SKIP_RENDERING，保留原生 BLOCK_FOR_TARGET_TIME 等待，不覆盖旧图像或增加可交付图像数量。两组均取得 PCM 音频流、按实际时间推进到 EOF，并在核心关闭后验证旧像素不变。

收据记录实际生产数、跳过数、位置与耗时。这验证了有界持有下的原生调度，没有实现完整 Node 最新帧邮箱、释放后的池复用或实际声卡与显示器同步。

固定构建的 render_frame_info.target_time 注释仍写微秒，实际 vo_libmpv 路径却返回纳秒。探针同时记录原始目标、mpv_get_time_ns 和 mpv_get_time_us，并断言原始目标接近纳秒时钟、乘 1000 后不接近。目标时间并非媒体 PTS 或实际呈现回执；此结论只针对所核对的固定构建，更换构建必须重验。[固定头文件](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/include/mpv/render.h)、[固定输出实现](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/vo_libmpv.c)

## 目标像素与初始画面

[format-probe.mjs](format-probe.mjs)另外执行五组直接 D3D11 检查：

| 条件                         | 实际结果与可得结论                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| scRGB、RGBA16F               | 白色约 0.02029，不符合以每单位 80 nit 解释时的 203／80；当前表示存在待解决问题，不据此排除终态能力 |
| BT.2020／PQ、RGBA16F         | 像素有限且 Alpha 为 1；参考白逆 PQ 后约 202.76 nit，与 203 nit 参考相符                            |
| 不透明参考 PNG、允许透明输出 | 建立实际颜色参考                                                                                   |
| 半透明参考 PNG、允许透明输出 | Alpha 为 128，与上组相比符合本样本的编码域预乘关系；不推断其他颜色或 HDR 组合                      |
| 尚未加载媒体                 | 两种尺寸均能渲染黑色不透明背景；有帧不代表媒体就绪                                                 |

PQ 检查覆盖目标编码，未使用实际 HDR 片源，也未验证完整色调映射。透明检查只是该 SDR 组合的局部依据，不足以确定完整 Alpha 合同，也不能作为终态只提供不透明输出的理由。初始背景不补造文件身份或播放状态。

## Electron 消费与最终引用

[electron-main.cjs](electron-main.cjs)在真实 Electron 44.5.1 主进程导入纹理，经 sharedTexture 交给隐藏窗口的沙箱 renderer；启用 contextIsolation，关闭 nodeIntegration。两条 SDR 路线各两种尺寸，加上直接 D3D11 的两种 PQ／RGBA16F 尺寸，共六次导入。生产端和消费端在这台机器上均使用 NVIDIA 设备。

[electron-preload.cjs](electron-preload.cjs)将导入结果转换为 VideoFrame 并通过 Canvas 读取。SDR 核对四象限像素；PQ 核对可消费的颜色分布、白色与不透明度，不据此宣称浏览器完成了准确的 HDR 呈现。

每次导入另建一个 VideoFrame 副本。释放主进程和 renderer 的导入对象并关闭第一个 VideoFrame 后，源帧仍未归还；最后副本关闭后，allReferencesReleased 只触发一次，随后归还源帧。全部输入在导入前已关闭 libmpv 核心。

实际 renderer 保持沙箱。VideoFrame 与 Canvas 成功不代表物理呈现时刻、WebGPU 或 HDR 显示器已验证；实验的 VideoFrame.timestamp=0 只用于样本，不当作媒体 PTS。

## 运行与范围

```sh
python refactor/verification/evidence/libmpv-gpu/prepare.py
python refactor/verification/evidence/libmpv-gpu/run.py
python refactor/verification/evidence/libmpv-gpu/run-electron.py
```

[native-contract.json](native-contract.json)记录六组基础渲染、两组容量与时钟、五组格式结果；[electron-contract.json](electron-contract.json)记录六次导入。两者保存实际 addon 与输入摘要、源文件摘要和检查时间。运行在自有、有限时长的子进程中，原生制品与缓存位于仓库忽略目录。Node 为 24.11.1，Electron 44.5.1 使用自身 Node 24.21.0，二者不是同一运行时。

本组未验证最终发行与许可装配、生产同步性能、公开配置竞争、Node 帧邮箱与池复用、实际硬件解码、HDR 片源与显示器、GPU 切换或丢失、macOS／Linux／ARM64。原型中释放后读取元数据的行为也不代表待确认的公开 NativeFrame 合同。受管配置采用已确认的[原生配置语义与使用约定](../libmpv-managed-output/design-choices.md)，本组没有原生选项保护补丁。
