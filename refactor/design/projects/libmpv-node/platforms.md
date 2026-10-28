# libmpv-node 平台图形

本页明确平台渲染与共享资源的实际实现；公开输出值和使用约定见[视频输出](video.md)。

<a id="scope"></a>

## 原生实现职责

控制调用、客户端与 hook 见[调用 API](api.md#capabilities)，自定义只读协议见[流提供器](streams.md)。GPU 与软件 Render API 都由同一 Mpv 的可选 VideoOutput 管理；软件输出是显式选择，不作为 GPU 失败后的隐式替代。

本页只定义原生渲染、平台互操作和资源交接。完整命令、属性与选项目录由[构建目录](api.md#catalog)和最终发行输入核对，不从名称列表推断返回类型。

<a id="render-route"></a>

## Render API 与平台互操作

所选上游范围提供直接 D3D11、OpenGL／OpenGL ES 与软件 Render API。D3D11 与 OpenGL 接入仍使用既有 gpu 渲染器；原生窗口输出能够选择 gpu-next，不表示它也提供已合入的相同嵌入入口。[Render API](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/include/mpv/render.h)、[D3D11 接入实现](https://github.com/mpv-player/mpv/blob/4255130de410e0cbdab694b951085409d466b704/video/out/d3d11/libmpv_d3d11.c)

沿上游公共入口完成下列已选路线，不预设维护一个新增 Vulkan／Metal Render API 的 mpv 分支：

| 平台，两种 CPU 架构均适用 | 生产端路线                        | 交付资源                                   | 必须验证的条件                                                     |
| ------------------------- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Windows                   | 直接 D3D11 Render API             | 可导入的 D3D11 纹理与 NT 共享句柄          | 同一 D3D 设备、即时上下文与跨设备同步、不同 GPU、2004 下限及 ARM64 |
| macOS                     | CGL 的 OpenGL 接入 IOSurface 目标 | 独立持有的 IOSurface                       | FBO 与颜色格式、VideoToolbox 互操作、两个架构和系统范围            |
| Linux                     | EGL 与可导出的图像或 GBM 缓冲     | dma-buf planes、stride、offset 与 modifier | 渲染节点、驱动与格式组合、真实导入及 X11／Wayland                  |

Windows 使用明确传入的 D3D11 设备，并遵守即时上下文与解码线程约束；macOS 与 Linux 分别使用 CGL、EGL 及相应显示资源。Linux VAAPI 可以接收明确的 DRM render fd。图形环境根据实际设备和驱动建立，硬件解码能力在相应环境中核对。

颜色、共享资源字段和引用归还见[像素与颜色](#graphics-color)、[帧池与同步](#production)及下述各平台实现。实际链路按[专项场景](../../../verification/scenarios/libmpv.md)验证。

直接 D3D11 入口来自[上游提交](https://github.com/mpv-player/mpv/commit/4255130de410e0cbdab694b951085409d466b704)，固定源码与完整依赖由本项目共同构建和验证。正式验收覆盖实际 GPU、两种架构、媒体播放、宿主消费和最终回收，源码依据见[版本间比对](../../../verification/evidence/libmpv-gpu/source-comparison.json)。

macOS 是主要的长期取舍。Apple 已从 macOS 10.14 起弃用 OpenGL；当前 mpv 的直接 GL／VideoToolbox 路线仍要求 CGL。采用它能沿上游现有边界完成绑定，但需要持续验证系统兼容。改用 ANGLE／Metal 不能只替换上下文名称就保留这条直接互操作路径；采用新的渲染入口则意味着额外的上游开发与维护责任。[Apple 说明](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/OpenGL-MacProgGuide/opengl_intro/opengl_intro.html)、[mpv macOS 接入](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/video/out/hwdec/hwdec_mac_gl.c)

硬件解码、GPU 渲染和跨进程共享分别核验。共享帧不保证解码过程没有复制，也不保证所有驱动支持同一种零复制路径；正常的 GPU 复制不违反独立帧持有合同。是否启用硬件解码继续由原生选项表达，不在绑定缺省中暗改。

设备选择已确认以实际消费兼容为首要条件，再考虑性能；宿主的可靠设备标识和真实导入共同支持接入判断。名称、默认设备或枚举结果不能代替互操作验证。实际导入失败由宿主适配层结束对应显示准备并清理持有；窗口移动、显示目标变化和真正的设备失效分别按[设备与宿主合同](video.md#devices)处理，不能通过静默更换渲染器或丢失颜色信息取得成功结果。

<a id="frames"></a>

## 帧可读性与独立持有

NativeFrame 交付时，库必须已经完成必要的生产端同步，使消费方能够安全导入和读取。仅取得共享句柄或提交渲染命令不代表 GPU 已写完。原生层通过实际平台同步机制确认就绪，不能用 JavaScript 延时或偶然成立的提交顺序代替。

已交付帧保持内容不变，直到持有者 release；分辨率变化、内容替换和 Mpv 关闭都不撤销这项持有。保留画面所需的纹理、设备引用和同步资源由帧持有关系维持，不需要保留整个播放器。未交付池与在途同步均有界；所有可交付资源被持有时，不覆盖旧帧，也不让 JavaScript 消费速度成为音频时钟的等待条件。

帧保存像素尺寸、有效矩形、像素格式、颜色解释及有依据的时序。原生控制指针继续私有；平台共享资源描述是专门的互操作合同，与普通 MpvNode 数据不同。交付结构必须说明句柄所在进程和借用／持有边界，不能宣称普通结构化克隆能够转移 OS 句柄。

Electron 45.0.0 的导入分别接受 Windows NT 句柄、macOS IOSurface 和 Linux nativePixmap。Windows 导入会复制句柄，macOS 会保留引用，Linux 会复制各 plane 的 fd；这些动作不允许生产者提前覆盖底层内容。Kisaki 在 allReferencesReleased 后归还相应 NativeFrame 持有。[导入结构](https://github.com/electron/electron/blob/v45.0.0/docs/api/structures/shared-texture-handle.md)、[导入实现](https://github.com/electron/electron/blob/v45.0.0/shell/common/api/electron_api_shared_texture.cc)

Windows 的 NT 句柄不能用旧式 GetSharedHandle 返回值替代。RGB 输出所需的 keyed-mutex 条件也不能照搬解码纹理；所选 Electron 版本的 RGB 共享路径使用不同的同步约定，须与生产者一起验证。

显示侧先验证 VideoFrame 在 Canvas／WebGL 中的共同消费路径。所选 Electron 源码中，Linux 导入的 SharedImage usage 与 Windows／macOS 不同，没有声明相同的 WebGPU usage；文档中的 supportsZeroCopyWebGpuImport 字段不能单独证明 WebGPU 导入已经成立。因此不以统一 WebGPU 路线作为当前架构前提，也不借此删除 Linux 或 Wayland 支持。

<a id="color"></a>

## SDR 颜色与正常播放

libmpv 负责把源视频转换为请求的 SDR 表示，包括 HDR 片源的色调与色域映射。绑定负责准确设置目标、准备纹理并交付颜色描述，宿主系统负责最终显示器颜色管理。当前受管输出是 sRGB 与 Display P3 SDR，不提供 PQ、扩展线性 HDR、显示峰值或可变 nit 单位。

Kisaki 使用 sRGB，不根据片源或系统 HDR 开关改变输出模式。高位深解码、原生画质选项和必要的八位输出抖动仍需验证；不能把“不输出 HDR”实现成拒绝 HDR 文件或降低十位 SDR 处理精度。[完整颜色合同](video.md#targets)

独立 mpv 播放器的 gpu-next 与嵌入 Render API 保持各自边界。本库的直接 D3D11／OpenGL 接入沿 gpu 管线生成 SDR 输出，验证覆盖 SDR 表示、HDR 片源映射、字幕、时序与资源。共用色调映射的零分母修复由[源码清单](distribution.md)维护。

<a id="startup"></a>

## 输出准备与控制归属

每个核心最多一个活动 render context，必须在开始使用相应 VO 前准备好，并在核心销毁前释放。渲染线程遵守上游对 GL 当前上下文和调用顺序的要求；事件读取、渲染更新和 JavaScript 交付各自推进，避免渲染线程等待同一核心的普通控制调用。

[初始化合同](lifecycle.md#publication)规定受管输出在核心初始化前准备，显式启动脚本加载内容时使用同一输出。各后端按实际构建验证创建次序和脚本接续，相关机制依据见[GPU 验证](../../../verification/evidence/libmpv-gpu/verification.md)。

vo、窗口嵌入目标、图形上下文与受管颜色目标等涉及输出所有权的设置，按[使用约定](video.md#constraints)界定。直接可识别的冲突由绑定提前检查；配置文件、profile 和脚本由调用方遵守同一约定，库报告可检测冲突并停止不再可信的新交付，不承诺拦截全部引擎内部改写，不维护原生保护补丁。资源寿命仍由库负责，已有帧不会因此被自动释放。具体约束与失败行为见[视频输出合同](video.md#constraints)，运行行为仍须验证。

<a id="support"></a>

## 帧生成、消费与显示支持

已确认支持声明分为三个层次，不能用一个笼统的图形支持标记相互替代：

| 层次     | 核对内容                                               | 负责者         |
| -------- | ------------------------------------------------------ | -------------- |
| 原生生成 | 在当前设备上生成符合目标颜色、格式、同步和资源合同的帧 | libmpv-node    |
| 宿主消费 | 正确导入、解释、合成、呈现并归还交付帧                 | 宿主适配层     |
| 实际显示 | 当前系统、显示设备和设置能否呈现相应效果               | 宿主与操作系统 |

设备枚举、纹理创建、共享导入与实际显示分别表达事实。能够导入资源不代表颜色与播放时序已经正确；Display P3 描述也不保证显示器覆盖整个色域。宿主选择能够消费的 SDR 目标，绑定准确执行请求，不能静默替换目标或渲染器。

每次发行固定匹配的原生制品和运行依赖，版本、配置、设备、目标和失败阶段应可追溯。libmpv 或媒体依赖升级核对控制、颜色、字幕、时序和资源行为；Electron 升级核对导入、颜色解释、跨进程交接与最终回收；平台适配变化核对对应设备与共享同步。成功加载或 ABI 相容不代替这些运行证据。

已知正常输入缺陷必须进入相应支持范围的发布判断。独立复现确认责任层后，在该层修复；已经接受的黑色字幕零分母补丁按[采用清单](distribution.md)进入构建，上游包含等效修复并通过回归后移除。新增补丁按具体行为、证据与维护范围判断，影响既定合同或长期维护边界时再讨论。不能一面声明完整覆盖相应范围，一面把已经确认的缺陷留给调用方，也不通过静默换曲线、替换异常像素或缩减范围取得通过结论。

<a id="graphics-color"></a>

## 像素转换与颜色标签

两个 GPU 目标都交付不透明、八位 UNORM 存储的 RGB 画面。UNORM 描述存储，不能据此把像素解释为线性光。实际媒体转换和字幕绘制由 libmpv 完成，宿主标明结果的颜色空间，再由宿主系统处理最终显示适配。

原生 target-prim 与 target-trc 对应[输出目标](video.md#targets)，treat-srgb-as-power22 为 no，target-peak 采用 auto；原生 tone mapping、gamut mapping 及其他画质选项保留其职责。Render API 取得实际八位输出深度，最终量化之前保留解码与媒体处理需要的精度。

生产目标使用相应 RGBA／BGRA UNORM 存储，避免再通过硬件 sRGB 附件写入执行一次重复编码。GL 的内部格式、D3D 的视图格式、最终字节排列和宿主标签一起核对；modifier 或缓冲区类型不代表颜色空间。受管属性与调用方原生选项的关系继续遵守[使用约定](video.md#constraints)，不新增一套原生配置保护机制。

<a id="production"></a>

## 生产目标、共享帧池与完成同步

原生渲染目标与可交付图像池各有明确用途。渲染目标用于处理当前输出，池中每份图像取得自己的可交付持有；必要的 GPU 复制允许存在，不承诺解码到显示完全零复制。frameCapacity 继续约束可交付图像，包括尚未交付及仍被持有的不同图像；内部目标和其他原生资源另按所属预算管理。

更新尺寸或颜色时先准备本次生产条件，再按既有 configure 次序采用。已交付旧图像不改写；没有可交付空位时停止新帧交付，仍处理必要的原生更新或跳帧，不让 JavaScript 持帧成为音频时钟的等待条件。配置成功只表示生产条件就绪，不承诺消费者立即得到或显示新帧。

NativeFrame 没有要求宿主再等待的公开 fence 字段，因此发布前必须由生产者完成必要的 GPU 写入同步。Windows 用实际完成查询或适用的原生 fence；GL 路线在拥有上下文的原生执行范围提交并等待写入完成，可用同步对象或作为基线的完成等待。Flush 本身、创建共享句柄和定时等待都不能替代完成事实。GL 同步对象的含义见 [glFenceSync](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl4/glFenceSync.xml)。

发布后图像内容保持不变，直到全部库内持有归还，才可重用槽位。生产同步与消费回收是两个方向：前者允许宿主安全读取，后者允许生产者再次写入。关闭核心、改变尺寸或丢弃尚未交付帧，都不能越过已经交付的持有关系。

<a id="windows"></a>

## Windows：D3D11 目标与 NT 句柄

继续使用选定的直接 D3D11 Render API，设备与目标纹理归同一原生图形拥有者。可交付纹理保留真实 RGBA／BGRA 格式、尺寸、设备关系和 NT 共享句柄。普通 GPU 复制完成后再发布；旧式共享句柄与 NT 句柄不混用。

当前 Electron 的 RGB 共享输入没有 NV12 路线的 keyed-mutex 约定，不能照搬解码表面的同步。宿主在实际导入进程中把借用句柄字节转成对应 Buffer，Electron 复制句柄并持有导入资源；随后通过它的共享纹理传输交给 renderer。原始句柄字节不作为普通 IPC 数据直接转交另一进程。入口及进程局部性质见[固定 Electron 合同](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/docs/api/structures/shared-texture-handle.md)。

<a id="macos"></a>

## macOS：IOSurface 图像持有

选定装配使用 CGL core context 与八位 BGRA IOSurface。原生图形拥有者在自己的执行线程建立并保持 current context，创建 libmpv Render API；图像池分配 IOSurface，取得实际尺寸、格式、行距与分配范围，再用 CGLTexImageIOSurface2D 绑定 rectangle texture 并检查完整 FBO。渲染目标与池图像分别拥有，需要中间目标时执行 GPU 内复制，完成同步后才发布帧。

IOSurface 使用实际 BGRA 四字符格式，GL 访问采用与之对应的 BGRA／8_8_8_8_REV 表示，宿主按原生像素排列标记 bgra，不仅凭 GL_RGBA8 名称猜测 CPU 字节顺序。绑定方式有[固定 OBS 实现](https://github.com/obsproject/obs-studio/blob/31.0.0/libobs-opengl/gl-cocoa.m)与 Apple 的[纹理接入说明](https://developer.apple.com/documentation/professional_video_applications/fximagetile/opengltexture%28forcontext%3A%29)作为依据；库只采用这些接口事实，不复制该项目代码或引入它作为依赖。

NativeFrame 通过 IOSurface 及必要资源独立持有图像，GL 纹理和帧缓冲按自身寿命清理。CPU 锁定与 GPU 完成分别遵守各自同步条件。核心关闭时停止生产、完成已提交图形工作，并释放 render context、GL 对象及 CGL 范围；已交付图像继续保有自己的 IOSurface 引用，最终归还后回收。

Electron 接收导入进程内的 IOSurfaceRef 字节，并在入口增加引用。生产者与导入者在既定主进程接入中完成这次交接，后续跨进程传输由 Electron 管理，见[导入分支](https://github.com/electron/electron/blob/19c601167d4ae75989938416c18ed81eb21c6020/shell/common/api/electron_api_shared_texture.cc)。

颜色目标由 libmpv 按 sRGB／Display P3 SDR 合同产生，图像与宿主携带同一目标描述；IOSurface 的附件不会替代实际像素转换。VideoToolbox 的解码表面由引擎按自己的互操作取得，交付池是库拥有的最终 SDR 图像。实际 CGL、VideoToolbox、Electron 读取与持帧关闭由正式平台验收记录，运行进度见[实施状态](../../../implementation/status.md)。

<a id="linux"></a>

## Linux：缓冲与图像布局

选定链路从 DRM render node 建立 GBM device、EGL display 与离屏 OpenGL ES 3 context，再接入 libmpv 的 OpenGL Render API。固定上游按实际 GL／ES 上下文加载函数，支持这一接口族；上下文、render context 和 FBO 操作始终由同一个原生图形执行范围拥有。[上游 GL 接入](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/opengl/libmpv_gl.c)

图像采用一条明确装配顺序：GBM 分配 BGRA8 的线性单 plane BO，取得真实 fd／stride／offset／modifier，通过 EGL_LINUX_DMA_BUF_EXT 创建 EGLImage，再绑定 GL texture 与完整 FBO。需要独立渲染目标时在 GPU 内复制到这份池图像；交付的就是该 BO 的实际缓冲描述，不另走“先建任意纹理、再猜能否导出”的并行路径。

分配前核对 GBM rendering／linear 使用条件及 EGL 对相应 DRM format／modifier 的支持，分配后再次核对实际布局与 FBO。线性布局的 BGRA8 是这条受管输出的明确交付约束；格式或设备条件不具备时准确报告 GPU 输出不可用，不宣称任意 modifier 都可被消费，也不隐式切换软件输出。[固定 GBM 接口](https://gitlab.freedesktop.org/mesa/mesa/-/blob/mesa-22.0.0/src/gbm/main/gbm.h)、[EGL 导入合同](https://registry.khronos.org/EGL/extensions/EXT/EGL_EXT_image_dma_buf_import.txt)

linear 描述缓冲区内存布局。颜色独立按已选择的 sRGB 或 Display P3 SDR 目标编码。

输出资源由所选设备持有。X11、Wayland 与消费 GPU 的组合分别验证实际渲染、共享导入、显示和回收，按完整互操作链路记录结果。

当前两个 Linux 架构均采用小端表示，DRM_FORMAT_ARGB8888 对应内存中的 BGRA8，与 Electron 的 bgra 输入一致；不能按 fourcc 的字母顺序直接排列内存字节。尺寸、planes、stride、offset 和 modifier 来自实际分配，明确的 linear 分配约束与返回值共同核对；modifier 未指定本身不等于 LINEAR。支持查询返回 external-only 的组合不能直接视为可渲染 FBO。相关规则见 [EGL dma-buf modifier 扩展](https://registry.khronos.org/EGL/extensions/EXT/EGL_EXT_image_dma_buf_import_modifiers.txt)。

plane.size 表达该 plane 的实际字节范围。当前单 plane 分配用 dma-buf 的实际对象大小、offset 和 stride 核对有效行范围，不用宽高乘四代替分配大小。公共描述中的 planes 仍按真实布局交付；本方案的受管输出不包含多 plane 或其他 modifier 布局，也不能将单 plane 的计算推广为每个 plane 都填写整份 fd 大小。[内核接口](https://docs.kernel.org/driver-api/dma-buf.html)、[Chromium plane 语义](https://github.com/chromium/chromium/blob/152.0.7977.130/ui/gfx/native_pixmap_handle.h)

导出 fd 使用正确的进程资源所有权和 close-on-exec 规则；原生帧向调用方借出 fd，调用方不自行关闭它。Electron 在导入时复制 fd，图像仍须保持到其所有消费引用释放。核心关闭停止复用池图像并释放其 EGL／GL 和引擎资源；已交付的 dma-buf 继续由帧自身的 fd 引用保留，不为它维持完整 Mpv。池在运行期间也不得覆盖仍被持有的图像。

生产端先完成实际 GPU 写入，再交付 fd。CPU 映射的同步接口不替代 GPU 完成；也不因为内核有隐式同步设施就忽略本库“交付时可读”的合同。设计明确设备能力查询、导出布局、消费者与关闭后持有的关系，实际驱动组合的运行表现交由正式平台验收。
