# libmpv-node 控制接口验证

2026-11-24 在 Windows 10 专业版 22H2（19045）、x64 上，从[独立项目提交](https://github.com/ximu3/libmpv-node-dev/commit/55379a3548ef1fc7efa41153aec56cb36774659b)构建 addon 和 Windows 开发包。上游 mpv 固定在 `01e2533f3143b8940857ca419b0b367f583e05ca`。源码准备核对了两项补丁及其修改前后的文件摘要。引擎构建使用[Windows 候选依赖](../libmpv-package/package.md)的 FFmpeg、MuJS 和 UCRT64 前缀，重新编译了 libmpv。

| 文件 | SHA-256 |
| --- | --- |
| `ximu3-libmpv-node-0.1.0-dev.0.tgz` | `d123757659f89fb57d4b14e45c7558f1781ffe67492a7d136972245b4fa68876` |
| `ximu3-libmpv-node-win32-x64-0.1.0-dev.0.tgz` | `66cf8a65efd49da1d6f068601fddd6525cf3e4fa13a3bca4683d61b4761b5e7b` |
| `libmpv-2.dll` | `7d3df6661cfcf817a905fa23e369ce85947df619a2c512cf97f75da471b87318` |

仓库外消费者用 pnpm 12.18.0 离线安装这两个 tarball，完整检查安装后的声明并运行类型感知 lint。普通 Node 26.13.1 和 Electron 45.3.2 主进程使用独立临时目录和 System32 搜索路径，通过了[消费用例](https://github.com/ximu3/libmpv-node-dev/blob/55379a3548ef1fc7efa41153aec56cb36774659b/tests/consumers/fixtures/control.ts)。

- 两个宿主均从配对的引擎读取 Client API 2.6。顺序初始化选项失败时返回原生错误和选项下标。
- 新建的一秒 WAV 文件经实际 `loadfile` 加载后，时长为 1 秒，第一条音轨的采样率为 `8000n`。样本以空音视频输出运行。
- 结构化属性读写保留 int64、二进制字节和嵌套值。非 UTF-8 字符串的转换错误能取回同次原生结果。未知属性、主动取消及关闭后的调用分别返回对应错误。
- Worker 持有独立核心时强制终止，原宿主核心仍可继续读写。重复关闭等待完成，关闭后 `hasRef()` 为 false。

[六目标控制代码 CI](https://github.com/ximu3/libmpv-node-dev/actions/runs/45353425235)验证了 Rust/Node 绑定构建、固定源码与补丁，以及包位置缺少引擎时的错误。完整媒体依赖和播放后端须按[专项场景](../../scenarios/libmpv.md)分别取得运行结果。免费托管的两个 Linux runner 均未提供 DRM render node，X11 和原生 Wayland 的 dma-buf 消费待实机验收。[x64 作业](https://github.com/ximu3/libmpv-node-dev/actions/runs/45351073308/job/138297361031) · [arm64 作业](https://github.com/ximu3/libmpv-node-dev/actions/runs/45351073308/job/138297361267)
