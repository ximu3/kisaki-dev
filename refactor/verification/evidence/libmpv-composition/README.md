# 字幕回归与 SDR 的固定输入

本目录保留[黑色字幕回归](../libmpv-upstream-fix/verification.md)和[SDR 宿主颜色检查](../libmpv-sdr-integration/sdr.md)实际读取的原始输入记录：

- [native-contract.json](native-contract.json)：媒体、字幕、负对照 shader 与其摘要。
- [black-contract.json](black-contract.json)：黑色与字幕回归场景、输入和观察。
- [upstream-black-guard.patch](upstream-black-guard.patch)：用于同源修复对照的补丁字节。

两项检查按原路径核对这些字节，记录不因文档整理而重写。媒体生成来源的原始收据见 [hdr-contract.json](../libmpv-tonemapping/hdr-contract.json)。当前输出合同、正式补丁与交付状态分别由[设计](../../../design/projects/libmpv-node/video.md)、[固定输入](../../../design/projects/libmpv-node/distribution.md)和[状态页](../../../implementation/status.md)维护。
