# libmpv 播放切换与 HDR 宿主检查

本组为已确认的[核心复用与宿主接入](../../../design/engineering/integrations.md#integration)补充实际证据。原生播放检查使用同一个 Mpv 核心和直接 D3D11 render context；显示检查分别记录原生目标像素、Electron 导入、Canvas 读回和系统显示状态，不将其中一项代替完整呈现验收。

## 固定输入与实现范围

[run.py](run.py)校验既有 libmpv DLL 与头文件摘要，以离线 Cargo 构建 [playback.cpp](playback.cpp)。C++ 探针直接复用未修改的 [GPU helper](../libmpv-gpu/producer.cpp)，因此不改变此前原型的代码或收据。生成的红、蓝两段 FFV1 视频及构建产物位于仓库忽略缓存，不读取用户媒体、配置或脚本；音频输出为 null，硬件解码关闭。

[native-contract.json](native-contract.json)保存 DLL、可执行文件、输入和源码摘要。它证明本探针的 C API／D3D11 行为，没有实现正式 Node 帧邮箱、JavaScript 回调调度或 Electron 跨文件交接。

<a id="switching"></a>

## 同一核心中的加载、定位、失败与恢复

两组运行分别让原生事件读取与渲染更新优先，以检查两种实际调度顺序。每组依次执行：

1. 打开红色视频，结合加载、播放恢复和非重绘画面确认结果。
2. 定位到 0.5 秒，等待 seek 与 playback-restart 后读取实际位置。
3. 替换为蓝色视频，核对新的原生 playlist entry 身份与像素。
4. 替换为不存在的文件，核对实际加载错误。
5. 再次打开红色视频，确认健康核心仍可继续使用。
6. 关闭核心后读取已持有的红、蓝画面，核对其内容未被替换或撤销。

两组均保持原核心与 render context，定位读数均为 0.5 秒，失败后恢复成功，持有画面在关闭后不变，进程没有加载 ANGLE。不存在文件的 loadfile 命令回复仍为成功，随后才由 end-file 的 error 原因报告失败；命令回复因而不能作为完整打开结果。

测试实际遇到了旧画面的重绘。它没有将这些重绘作为新文件就绪，颜色采样只用作验证生成样本的身份，不是拟议生产代码识别文件的方法。这里没有证明精确媒体帧 PTS、快速取消竞争、队列溢出、任意外部脚本或 Node／Electron 迟到回调均已正确处理。

<a id="hooks"></a>

## 使用原生协调点建立内容边界

探针注册 on_before_start_file 与 on_after_end_file。前者在新 start-file 前执行，允许清理尚未交接的旧渲染工作；后者位于 end-file 之后。上游说明这些 hook 还会尝试先交付之前变化的观察属性，适合作为比普通异步事件更明确的协调点。[上游 hook 合同](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/DOCS/man/input.rst)

生产接入必须同时处理控制、通知和显示资源的实际顺序。原生 hook 并不自动清空应用已经排队的任务，也不等待外部归还所有 GPU 帧。特别是，已确认的 Node 接口为每个 hook 使用独立弱客户端，不能从本组同客户端 C 事件顺序推导其他 JavaScript 属性观察回调已经完成。接入层仍须明确停止旧订阅、收尾已接纳工作并释放被替换交付；这些 Node 交付细节仍须独立运行验证。

<a id="hdr"></a>

## HDR 输入与 WebGPU 接入

[run-renderer.py](run-renderer.py)生成带 BT.2020／PQ、Mastering Display 与 Content Light 元数据的 10 位 HEVC 参考视频。其白色码值对应约 1000 nit，显示峰值元数据也为 1000 nit。另使用既有 SDR 参考图作 203 nit 白色对照。

两种输入均经 libmpv 直接 D3D11 渲染为 BT.2020 PQ／RGBA16F。原生像素按 PQ 解算分别约为 202.76 nit 和 1001.16 nit，处于规定参考误差内；这是编码值检查，不是显示器实测亮度。Electron 44.5.1／Chromium 152.0.7977.130 接收的 VideoFrame 保留 BT.2020／PQ 描述，WebGPU 能导入、渲染至 rgba16float 的 extended Canvas 并读回，最终引用回收均发生一次。

该直接绘制路径尚未通过颜色与 HDR 范围验收。SDR 和 HDR 系统状态下，203 nit 对照的 Canvas 白色读数均约为 0.7856，1000 nit 对照均约为 0.8818；仅观察到可运行和有限数值，不能宣称原始亮度关系已经正确呈现。收据明确保留 webGpuColorConversionVerified、hdrRangePreservationVerified、physicalHdrDisplayVerified 为 false。后续需要核对显示端的颜色转换与实际 HDR 范围，不能仅因 extended 配置被接纳就认定完成。

[后续显示路径核对](../libmpv-display/verification.md)已经定位本版本 WebGPU 的 PQ 解码缺口，并验证视频元素在 HDR 窗口合成中的扩展范围。该后续证据不改变本组 WebGPU 收据的失败结论，也没有将系统合成检查当作面板光学测量。

<a id="displays"></a>

## 两个显示器与临时 HDR 检查

[display-check.py](display-check.py)通过 Windows QueryDisplayConfig／DisplayConfigGetDeviceInfo 读取显示状态。当前系统为 Windows 10 19045；两个活动显示器均报告支持高级颜色，检查开始时均未启用：

| 显示器        | 当前模式             | 初始状态 |
| ------------- | -------------------- | -------- |
| G24H2（主屏） | 2560×1440，约 144 Hz | SDR      |
| TL160ADMP11-0 | 2560×1600，约 240 Hz | SDR      |

在用户明确授权临时开启并恢复后，仅对 G24H2 执行检查。Windows 报告高级颜色开启，SDR 白电平为 240 nit；测试结束后恢复原状态，并核对两个显示器的模式、颜色状态与白电平均与开始前一致。[系统状态收据](display-contract.json)

隐藏测试窗口在系统 HDR 已开启时仍曾报告 dynamic-range: high 为 false；窗口实际可见并经过渲染后，同一显示器正确报告 true，Electron 的显示颜色描述从 BT.709／sRGB 变为 P3／sRGB。故不能将隐藏窗口的一次负值当作硬件没有 HDR 能力，也不能仅凭显示颜色字符串的传递函数为 sRGB 就否定扩展动态范围。[SDR 可见窗口收据](renderer-sdr-contract.json)、[HDR 可见窗口收据](renderer-contract.json)

video-dynamic-range: high 在本次运行仍为 false；未据此推断所有原生视频呈现路径不支持 HDR。本组尚未验证另一显示器的 HDR 呈现、光学亮度／色准、连续视频同步、硬件解码及其他平台。

## 复现

普通检查不会改变系统 HDR 设置：

```sh
python refactor/verification/evidence/libmpv-playback/run.py
python refactor/verification/evidence/libmpv-playback/run-renderer.py
python refactor/verification/evidence/libmpv-playback/display-check.py
```

display-check.py 的 --hdr-test 参数会临时改变指定显示器的状态，只能在获得相应用户授权后运行。它先保存恢复信息，再进行有超时的测试，并在 finally 中恢复；恢复后核对开始前的完整查询结果。测试资源、编译产物与临时用户配置均位于忽略缓存。
