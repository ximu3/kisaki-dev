# libmpv 播放切换与原生资源检查

本组为已确认的[核心复用与宿主接入](../../../design/engineering/integrations.md#integration)补充实际证据。原生播放检查使用同一个 Mpv 核心和直接 D3D11 render context；观察限于原生事件、内容切换与持有画面，不代替完整宿主呈现验收。

## 固定输入与实现范围

[run.py](run.py)校验既有 libmpv DLL 与头文件摘要，以离线 Cargo 构建 [playback.cpp](playback.cpp)。C++ 探针使用 [GPU helper](../libmpv-gpu/producer.cpp)。生成的红、蓝两段 FFV1 视频及构建产物位于仓库忽略缓存，不读取用户媒体、配置或脚本；音频输出为 null，硬件解码关闭。

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

## 复现与范围

```sh
python refactor/verification/evidence/libmpv-playback/run.py
```

测试只使用自己生成的媒体、缓存和原生构建，不读取个人资料或改变显示设置。跨进程迟到回调与资源交接见[Node／Electron 交接检查](../libmpv-handoff/verification.md)，现行颜色目标见[SDR 检查](../libmpv-sdr-integration/sdr.md)。
