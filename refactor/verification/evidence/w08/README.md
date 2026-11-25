# libmpv-node 制品与宿主验证

<a id="handoff"></a>

## W09、W16 联调制品

开发包版本为 `0.1.0-dev.0`，使用 mpv v0.42.0、Client API 2.6 和 Node-API 8。Windows、macOS 和 glibc Linux 各有 x64、arm64 两个平台包。六个目标从同一份主包和各自的平台包安装，在普通 Node 26.13.1 和实际 Electron 45.3.2 中通过消费验证，包括 ASAR 加载和引擎清单不配时的拒绝。[六目标候选与消费记录](https://github.com/ximu3/libmpv-node-dev/actions/runs/45555313839)

这批制品绑定 PR 合并候选 `b3ede2af9bd9a182b708e315217fb4469952314d`，其 Git 树与合并后的[主线提交](https://github.com/ximu3/libmpv-node-dev/commit/4f7356957768695936612afa76f7079d93cbb377)一致。在 Kisaki 工作区的 `.local/w08/b3ede2af9bd9a182b708e315217fb4469952314d/` 下，`packages/` 保存 CI 已验证的归档，`sources/` 保存按同一提交的六份 CI 输入、固定上游源码及摘要装配的对应源码。源码包包含绑定、上游源码、三项 mpv 补丁、构建输入、第三方许可与重链接说明。[构建与重链接](https://github.com/ximu3/libmpv-node-dev/blob/4f7356957768695936612afa76f7079d93cbb377/engine/RELINK.md)

| 清单 | 归档数 | 清单文件的 SHA-256 |
| --- | ---: | --- |
| `packages/checksums.json` | 7 | `db8d799a593b7bd99606ced119ca5c2f39a9e47d359bc9ea07ac6e78255aa4c3` |
| `sources/checksums.json` | 6 | `14883ba151fabdcecb612197ec44bae44dcddec1f578f70f815bcb01e1396174` |

安装后的主包通过八组设计消费样例和普通、原生输出选项的转发检查。Windows x64 分别在空闲核心、加载视频与字幕、使用 D3D11 和 WASAPI 三个场景核对属性实际返回值与公开声明，共取得 1,618、1,676、2,482 个成功结果。普通截图交付文件名，每帧截图开关关闭时返回 null。输入预算不足在读取待复制的成员前报告，编码中取消会归还接纳额度。[公开调用约定](https://github.com/ximu3/libmpv-node-dev/blob/4f7356957768695936612afa76f7079d93cbb377/docs/control.md)

在 Windows 10 x64 的 RTX 4060 Laptop GPU 上，HEVC Main 10 报告 D3D11VA。可见的 Electron 窗口呈现了 16 个不同画面。带音频和字幕的样本完成播放、定位、切换、VO 截图和共享帧消费，关闭播放器后仍可读取此前持有的画面。对交付 DLL 的 49 组浮点回归中，5,103 个原先非有限的 RGB 分量恢复为有限值，534,975 个原先有限的分量逐位一致，交付引擎与同源补丁构建的差异为零。

从这六个归档读取了 295 个引擎文件的大小，并从原生库复核了 2,185 项动态导入，均与对应清单一致。两种 macOS 架构的 Mach-O 最高部署目标为 13.0，两个 Linux 目标的最高 glibc 符号要求为 2.35。Ubuntu 22.04 的离屏 OpenGL ES 上下文和两种宿主中的媒体消费分别验证。仍需具体设备和系统的项目见[实机验收范围](#hardware)。

## Windows x64 初始制品

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

## Windows x64 媒体运行库

干净的 Windows runner 从固定输入构建 FFmpeg、MuJS、仅启用 DirectWrite 的 libass 和带两项补丁的 libmpv，核对媒体 DLL 的导入和延迟导入，并生成许可材料与对应源码。随后从配对的 tarball 安装，在 Node 和 Electron 中执行消费用例。[构建与验收作业](https://github.com/ximu3/libmpv-node-dev/actions/runs/45379645529/job/138395141589)

自定义协议用短读向引擎提供 WAV，两个宿主均能读出媒体时长，并验证取消后才返回的流资源得到关闭。软件输出用同一幅红色样本核对五种像素格式、步幅、填充字节，以及重新配置和关闭后原帧的数据。GPU 共享图像单独验收。[流消费用例](https://github.com/ximu3/libmpv-node-dev/blob/e5fb5e9f59d394475173fffd2b3b9303b5fabbfe/tests/consumers/fixtures/streams.ts) · [软件输出用例](https://github.com/ximu3/libmpv-node-dev/blob/e32d07a87f01c8f1d115605aac1feb2d28d23428/tests/consumers/fixtures/software.ts)

## mpv v0.42.0 与 Windows 共享图像

2026-11-24 在 Windows 10 x64 上重建 mpv v0.42.0 和 libplacebo 7.387.0。引擎保留 Client API 2.6。Node 26.13.1 和 Electron 45.3.2 从配对的 tarball 加载并通过了字体、软件输出和 D3D11 持有用例。在 RTX 4060 Laptop GPU 上调整尺寸并切换至 Display P3 后，旧帧保留原尺寸和 sRGB 标签，核心关闭后仍能读取其共享句柄。Electron 渲染进程将新帧画到 sRGB Canvas，中心像素为 RGBA (255, 0, 0, 255)。关闭最后一个 VideoFrame 后，生产者收到一次 allReferencesReleased。[引擎候选](https://github.com/ximu3/libmpv-node-dev/commit/30b8dbc8de3b3ec901435b232f483d353ca0127e) · [受管输出与消费用例](https://github.com/ximu3/libmpv-node-dev/pull/11)

| Windows x64 本机构建 | SHA-256 |
| --- | --- |
| 主包 | `a21f9d6f28b871d9c7a11bbff373d12ea9a5414d26948e82038b2e370d313095` |
| 平台包 | `77f7a666ca18400ee554d56a7e5f838cbaf535f039d5548e40b96158d573ee55` |

<a id="linux-drm"></a>

## Ubuntu 22.04 的 DRM 符号

在 x64 和 arm64 上，使用较新 libdrm 头文件编译的首个候选都引用了系统没有的 drmModeCreateDumbBuffer、drmModeMapDumbBuffer 和 drmModeDestroyDumbBuffer。v0.42.0 和 11 月 23 日的上游主线仍使用这三个函数。兼容补丁在这三处直接调用相应的 DRM ioctl。首轮 arm64 消费在取得 Client API 2.6 后超时，后续[六目标消费](#handoff)已在 Ubuntu 22.04 的两种架构完成播放和像素验证。[首轮 arm64 消费日志](https://github.com/ximu3/libmpv-node-dev/actions/runs/45387160103/job/138421480287) · [上游 DRM 源码](https://github.com/mpv-player/mpv/blob/v0.42.0/video/out/vo_drm.c#L78)

## 首次六目标配对制品

同一份 0.1.0-dev.0 主包已与六个平台包分别在 Node 26.13.1 和实际 Electron 45.3.2 中安装验证。每个宿主从归档外的独立目录运行。Electron 还从 ASAR 加载主包，使用解包的平台资源，并验证配对引擎清单被改动时的失败。仓库外消费者检查安装后的声明、独立客户端、事件、日志、hook、自定义协议、字幕和五种软件帧格式。[六目标装配和最终消费](https://github.com/ximu3/libmpv-node-dev/actions/runs/45398797879)

Windows x64、arm64 的包分别含 45、44 个媒体 DLL。macOS 两种架构各含 45 个媒体库，Ubuntu 22.04 两种架构各含 56 个。Linux 包使用系统 libdrm 2.4.113。打包时同时处理私有媒体库的 ELF 名称和媒体 API 符号，进程分配器仍由宿主解析。Node 与 Electron 的运行中模块已与安装文件逐个对照，两种 Linux 架构均可解码 FFV1 并绘制字幕。三平台分别采用 DirectWrite、CoreText 和 Fontconfig。[平台清单与所有归档摘要](paired-packages.json)

该轮主包与平台包的本地留存位置为 Kisaki 工作区的 `.local/w08/d7765b5d827da62fc9400e2d0e0b1cafdc0587f2/packages/`。目录内的 `checksums.json` 与归档分别核对。源码提交和 CI 作业保存在验证清单中。

## Windows 像素与截图回归

在 Windows 10 x64 的 RTX 4060 Laptop GPU 上，Node 和 Electron 都运行了 sRGB、Display P3 和 HDR 输入的消费用例。同一组六个 sRGB 色块在 Display P3 截图中得到预期的八位编码；Electron 在 Canvas 中读回并与 VideoFrame 对照。把同一纹理故意标成 sRGB 时，负对照可区分两种标签。PQ 七档灰阶经映射后保持递增，ASS 红色覆盖区保持不透明。HEVC Main 10 样本实际报告 D3D11VA。一个可见的 Electron 窗口连续导入 16 帧，16 组采样各不相同，窗口合成读回与同帧采样相符。另用静音 WAV 经 WASAPI 以 44,100 Hz 播放至 EOF，并在 Node 和 Electron 中验证了启用证书校验的 HTTPS 媒体。[公开包消费用例](https://github.com/ximu3/libmpv-node-dev/pull/15)

针对 mpv v0.42.0 的色调映射修改，复用了[低峰值字幕诊断语料](../libmpv-upstream-fix/verification.md)和原生浮点读回探针。对同一源码和依赖构建分别保留及移除零分母保护，各运行 49 组、读回 98 帧。修复消除了 5,103 个非有限 RGB 分量，534,975 个原本有限的分量逐位一致。本次交付引擎与同源补丁构建的读回分量也逐位一致。随后从固定输入重建原生探针和两份对照引擎，TypeScript 验证入口复跑了同一组场景，结果一致。

正常 GPU 截图返回 `vo`，显式软件截图返回 `software`。仅在诊断引擎内释放 VO 已取得的图像后，原生回退仍在 `screenshot-sw=no` 下返回 `software`。无图时，正式接口返回原生命令错误。[源码、探针和对照收据](windows-regressions.json)

<a id="hardware"></a>

## 实机验收范围

| 环境 | 已取得的结果 | 待验收 |
| --- | --- | --- |
| Windows x64 | Windows 10 22H2 的 RTX 4060 Laptop GPU 已验证 D3D11VA、共享图像和 WASAPI；Windows Server 2025 x64 已验证安装包 | Windows 11 x64 客户端 |
| Windows ARM64 | Windows 11 ARM64 已验证原生媒体库和两种宿主的安装包。Microsoft Basic Render Driver 在 Node 中完成 D3D11 共享帧创建、持有、释放和 SDR 像素验证 | Windows 10 ARM64 客户端，以及实体 GPU 的 D3D11VA、Electron 纹理导入、呈现和回收 |
| macOS x64、arm64 | 两种架构的托管 runner 已验证动态库、Node、Electron 和 CoreText 字幕；CGL 枚举均返回 0 个加速渲染器 | 具备 GPU 的 Mac 上验证 VideoToolbox、IOSurface 导入、连续呈现及回收；macOS 13 实际运行另行登记 |
| Linux x64、arm64 | Ubuntu 22.04 已验证系统 libdrm、配对媒体模块、Fontconfig、软件像素、离屏 OpenGL ES 3.2 和两种宿主 | 带 DRM render node 的设备上分别验证 VAAPI、X11 和原生 Wayland 的 dma-buf 导入、呈现和回收 |

Windows 11 ARM64 的托管系统列出 Microsoft Hyper-V Video，绑定枚举到 Microsoft Basic Render Driver。请求 D3D11VA 播放 HEVC Main 10 时，mpv 实际使用软件解码。另一次单独验证中，Electron 导入 D3D11 共享纹理时报告 GPU 不可用。[解码与像素结果](https://github.com/ximu3/libmpv-node-dev/actions/runs/45430872087/job/138575630168) · [Electron 导入结果](https://github.com/ximu3/libmpv-node-dev/actions/runs/45432223649/job/138580591530)
