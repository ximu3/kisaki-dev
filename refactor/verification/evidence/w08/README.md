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

<a id="windows-fonts"></a>

## Windows 字体与宿主设备

Windows x64 研究候选中的 Fontconfig 2.18.3 使用 ANSI 接口定位 DLL。在代码页 936 的 Node 26.13.1 和 Electron 45.3.2 中，从普通绝对路径加载时，Fontconfig 读到主配置和包含项共 25 项；从含 📚 的路径加载同一批文件，两种宿主都未读到配置。Windows 扩展长度前缀的普通目录只读到主配置和目录两项。libass 是该候选中唯一直接导入 Fontconfig 的 DLL。固定上游的 Windows 路径处理见 [Fontconfig 源码](https://gitlab.freedesktop.org/fontconfig/fontconfig/-/blob/2.18.3/src/fccfg.c)。

采用 DirectWrite 的候选从固定的 libass 0.17.5 源码构建，实际列出的提供器为 none、autodetect 和 DirectWrite。使用同一条 ASS 字幕和同一个内嵌 Ahem 字体，在含空格、中文及 📚 的仓库外目录安装开发包。Node 和 Electron 分别加载样本、定位到一秒并执行软件截图。在 160 × 96 画面中，两种宿主都得到以下结果。

| 系统字体 | 附件字体 | 亮像素数 |
| --- | --- | ---: |
| 关闭 | 关闭 | 0 |
| 自动 | 关闭 | 101 |
| 关闭 | 开启 | 1,024 |
| 自动 | 开启 | 1,024 |

启用附件的两幅像素掩码逐点相同。101 是此台 Windows 主机的系统字体测量值，消费用例检查是否实际绘制及其与 Ahem 的区别。[消费样本与断言](https://github.com/ximu3/libmpv-node-dev/blob/7d5f19d/tests/consumers/fixtures/subtitle-fonts.ts)

控制接口已接入独立客户端、属性和事件观察、初始化与运行期日志以及异步 hook。[客户端与观察](https://github.com/ximu3/libmpv-node-dev/pull/3) · [日志](https://github.com/ximu3/libmpv-node-dev/pull/4) · [hook](https://github.com/ximu3/libmpv-node-dev/pull/6)

平台枚举在本机 Windows x64 返回 4 个适配器。两台托管 macOS runner 均返回 0 个加速 CGL 渲染器，IOSurface 播放和画面交接待具备 GPU 的 Mac 实测。Linux 的 X11 与原生 Wayland 交接待具备 render node 的桌面验证。[六目标设备枚举](https://github.com/ximu3/libmpv-node-dev/actions/runs/45365878895)