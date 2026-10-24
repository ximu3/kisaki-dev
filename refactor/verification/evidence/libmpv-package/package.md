# Windows 引擎候选与整包装配记录

本轮验证[引擎与整包装配方案](../../../design/projects/libmpv-node/distribution.md)中可在当前 Windows x64 环境执行的部分。所有包均为本地私有 fixture，未发布；没有创建正式 libmpv-node 项目或实现公开 Mpv 接口。

## 研究构建审计

[dependency-audit.json](dependency-audit.json)从既有 GPU addon 和带已接受补丁的 libmpv 出发，递归检查 PE 普通导入与延迟导入，记录路径、摘要、大小、组件包版本及系统接口。

| 项目                       | 结果                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| 原研究运行目录             | 230 个 DLL，384,125,222 字节                                                    |
| 媒体依赖导入链             | 115 个 DLL，包含该 libmpv                                                       |
| addon 与 Visual C++ 运行库 | 1 个 `.node`、3 个 CRT DLL；合计交付 119 个原生文件，179,377,313 字节           |
| Visual C++ 来源            | 本机 Visual Studio 的 `Microsoft.VC143.CRT` 可再分发目录；未从 System32 复制    |
| 研究构建缺项               | `HAVE_JAVASCRIPT`、`HAVE_WASAPI`、`HAVE_D3D_HWACCEL` 均为 0                     |
| 研究 FFmpeg                | 9.0.2 包；实际 avcodec／avformat／avfilter 报告 GPLv3-or-later，配置含 GPL 组件 |

这些事实解释了为什么既有图形探针可以通过，却不能直接被称为完整的正式 LGPL 播放包。静态导入链也不是全部运行资源清单：按需打开的模块、字体配置与其他数据仍需按用途核对。

## 独立 Windows 候选

[engine-input.json](engine-input.json)保存新下载的固定源码与构建输入摘要。FFmpeg 9.0.2 和 MuJS 1.3.11 来自各自官方来源；GNU Make、diffutils、NASM 与所需 Vulkan 头文件按既有 MSYS2 数据库中的精确包及摘要提取到独立目录。没有更新原研究环境中已安装的依赖。MuJS 的发行归档为 1.3.11，其头文件仍声明 `JS_VERSION_PATCH=8`；两项来源事实分开保留，没有自行改写上游版本宏。

mpv 继续使用已接受的固定提交和零分母修复。候选分别构建共享 FFmpeg、MuJS 与 libmpv；其余依赖暂沿已冻结的 MSYS2 组件，实际交付子集按导入关系提取。这个 Windows 候选不冻结正式六目标组合，也不宣称所有组件的对应源码与许可材料已完整备齐。

FFmpeg 明确关闭 GPL、nonfree、version3 及自动发现，保留通用内建能力，并显式启用所选解码、字幕、处理和网络依赖。Windows TLS 采用 Schannel。mpv 开启 JavaScript、Lua、WASAPI、D3D11／D3D11VA、图像和颜色所需组件，关闭其 GPL 代码；HTTP(S) 由 FFmpeg 的协议输入承担，未启用另一套 libcurl 输入后端。

第一次 FFmpeg 配置因缺少 Vulkan 头文件而失败，原始失败日志保存在隔离构建目录。补齐的是 libplacebo 滤镜实际需要的头文件输入，没有移除该滤镜或更改受管 D3D11 输出路线。随后链接暴露出关闭自动发现时的 iconv 探测分支没有补入外部库，最终显式添加 `--extra-libs=-liconv`；diffutils 提供配置过程的文件比较工具。没有修改 FFmpeg 媒体算法源码。

[engine-build.json](engine-build.json)记录成功构建和装配的配置、源摘要、日志摘要与 47 个媒体 DLL。[engine-audit.json](engine-audit.json)来自该候选的实际库查询及 C API 执行：

| 检查            | 结果                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| mpv Client API  | 2.6；源码提交和已采用补丁保持一致                                                                                |
| 功能开关        | JavaScript、Lua、WASAPI、D3D11、D3D11VA、libass、libplacebo、zlib、iconv、LCMS2 均启用；mpv GPL 代码关闭         |
| FFmpeg 许可报告 | avcodec、avformat、avfilter 均返回 `LGPL version 2.1 or later`                                                   |
| 实际编译目录    | 504 个可枚举解码器、468 个滤镜、32 个输入协议；包括所查 H.264／HEVC／AV1、字幕、处理与 HTTP(S) 登记项            |
| 两种脚本        | Lua 与 JavaScript 都写入各自的 `user-data` 标记，随后正常关闭核心                                                |
| 系统字体        | 自有 ASS 的单个 A 字形产生 1 幅图像、108 个非零覆盖像素；诊断输出为 `Using font provider directwrite (with GDI)` |
| 依赖与大小      | 47 个媒体 DLL，76,501,669 字节；包含 addon 与 CRT 后共 51 个原生文件，78,160,845 字节                            |

字体检查清除了该子进程的 FONTCONFIG_FILE／FONTCONFIG_PATH，未附带字体或开发机字体配置；它直接验证 libass 的系统提供器，不是 mpv 完整字幕场景。脚本检查第一次把节点属性的原生字符串形式当作未加引号的文本，最终按其 JSON 字符串形式核对；引擎和脚本无需改动。上表目录描述编译登记，不等于每个格式、设备或协议都已播放验证。

该候选导入链没有 ggml／whisper。此结果只表明本组合没有带入这些依赖，不将原研究构建的重复卸载／装载失败归因为它们，也不把旧异常标记为已修复。

## 包与消费场景

fixture 分为主包和 Windows 平台包，使用精确版本依赖，包元数据均为 private。`UNLICENSED` 表示 fixture 没有对外授权，不改写其中第三方组件的实际许可。平台包包含匹配原生文件、摘要清单和自有 PPM 样本；不伪装成完整 Mpv SDK，也不包含生产安装脚本。

[run.py](run.py)通过 pnpm pack 生成 tarball，再在独立、含空格的消费目录离线安装。消费工程用本地 override 将精确的平台依赖指向刚生成的 tarball，不访问注册表，也不通过源码 link 替代制品。最终使用上述 51 文件候选，结果保存在 [package-contract.json](package-contract.json)。

| 消费项       | 结果                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| 主包／平台包 | 版本 `0.0.0-probe.2`；tarball 分别为 1,237 与 33,225,689 字节              |
| 普通 Node    | 24.11.1，Windows x64，通过                                                 |
| Electron     | 44.5.1，内嵌 Node 24.21.0，Windows x64，通过                               |
| 实际原生模块 | 两个宿主均观察到全部 51 个模块，实际文件身份与安装后平台包相符             |
| 图像与收尾   | 两个宿主各产生并读取 2 幅 D3D11 图像，核心关闭后图像仍有效，帧全部显式释放 |

子进程只保留 Windows System32 的 PATH，使用空工作目录，移除 NODE_PATH／NODE_OPTIONS。按安装后字节再次核对清单，并在运行期间采集模块位置。观察器最初受较长 pnpm 路径的诊断报告截断影响，随后缩短试验目录；扩展 Windows 路径采用实际文件身份比较。修正观察方式后再执行最终候选，完整记录全部模块位置。

图像探针保持原有代码，读取 63×47 与 31×23 的自有色块图，在核心结束后确认图像仍可读取，再显式释放。每个宿主使用单独子进程，只调用一次该探针；它不实现正式的进程常驻运行库模型，也不把旧卸载／重装异常标为已修复。

## 尚未覆盖

本轮没有运行 macOS、Linux、Windows ARM64 或 Windows 10 2004 下限，没有创建可见窗口或修改系统设置。清理 PATH 的本机消费不等于干净机器验证。

编译目录、功能查询、脚本执行、一次系统字体渲染和简单图像消费，不能代替网络证书验证、真实音频输出、硬件解码、完整字幕与字体发现、HDR 片源及全部媒体行为。动态模块、非代码数据、签名、安装后的 asar 位置、异版本同名依赖与完整许可材料继续按设计执行。

该实验覆盖候选依赖装配和双宿主 tarball 消费。六平台正式制品、完整媒体与平台图形按[libmpv 验收](../../scenarios/libmpv.md)核对。

正式 addon、完整公共 API、六平台发行支持及最终产品接入尚未开始。其他平台当前缺少执行环境的限制按既有记录保留。

## 来源

- [已采用 mpv 源码与修复](../../../design/projects/libmpv-node/distribution.md)，以及固定提交的 [Meson 配置](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/meson.options)与 [Copyright](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/Copyright)。
- [FFmpeg 9.0.2 源码配置](https://github.com/FFmpeg/FFmpeg/blob/n9.0.2/configure)及[许可说明](https://ffmpeg.org/legal.html)。
- [MuJS 官方源码发行](https://mujs.com/downloads/)。
- [libass 0.17.5 字体提供器选择](https://github.com/libass/libass/blob/0.17.5/libass/ass_fontselect.c)。
- [Windows DLL 搜索规则](https://learn.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-search-order)与 [Microsoft C++ 部署](https://learn.microsoft.com/en-us/cpp/windows/deployment-in-visual-cpp?view=msvc-170)。
