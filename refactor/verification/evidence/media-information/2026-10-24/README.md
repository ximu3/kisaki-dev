# 媒体信息读取实测

在 Windows x64 上实际加载项目固定提交 `01e2533f3143b8940857ca419b0b367f583e05ca` 的 libmpv 构建，DLL SHA-256 为 `2cbda16b6ee887c6ff0e5c2cd5205ef056086aaf264f9e278664f5b35591655e`。调用经公开 C API 完成；不是尚未交付的 libmpv-node 正式包验收。

`on_preloaded` 中读取属性，随后请求 stop 并继续 hook，再等待结束和关闭核心。六组自生成的 MP4、MKV、WebM、WAV、HEVC 10-bit MKV 和 MPEG-TS 样本取得预期的时长、轨道、编码、语言、尺寸和适用章节；未选择播放轨道，音视频输出均未建立。三个无效、截断或缺失输入按原生错误结束。

100 次独立读取的中位数为 8.01 ms，P95 为 16.72 ms，最大值为 17.80 ms；每次包含创建、读取、停止与关闭，进程句柄数保持 199。另一个播放核心的文件、轨道和暂停状态不变。阻塞在受控本地 HTTP 输入中的读取约 105 ms 完成取消，随后能继续打开有效文件。

同时保留了失败对照：禁用全部音视频轨道后直接等待 file-loaded 会以无可播放内容结束，不能作为这一读取流程。无视频输出的暂停加载可以取得解码后参数，但本次基础信息读取使用上述预加载节点。

完整样本摘要、断言、事件和测量见 [results.json](results.json)，执行日志见 [run.log](run.log)。`fixtures.py` 中的 FFmpeg 命令仅用于生成合成测试材料，没有进入本体依赖或运行流程。复现入口为 `python refactor/verification/evidence/media-information/2026-10-24/run.py`，需要记录中的已核验运行库。
