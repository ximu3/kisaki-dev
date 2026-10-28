# libmpv-node 视频输出

本页定义受管视频输出、帧持有、颜色与时序。平台实现见[平台图形](platforms.md)，Electron 消费与产品流程见[Kisaki 接入](../../engineering/integrations.md#media)。

<a id="responsibilities"></a>

## 受管输出职责

libmpv-node 定位为 libmpv 的 Node 接入与渲染资源管理、交付层。原生控制接口继续保持上游含义；受管帧只承诺本页定义的 SDR 表示，能够提交某个原生选项不表示库保证任意输出组合。

| 负责者               | 决定或承担的事情                                                    |
| -------------------- | ------------------------------------------------------------------- |
| libmpv               | 解码、滤镜、缩放、字幕合成、HDR 片源到 SDR 的色调与色域映射         |
| libmpv-node          | 原生调用、设备与线程、目标纹理、同步、独立帧持有及准确的 SDR 帧描述 |
| 宿主应用及显示适配层 | 选择能消费的 SDR 表示与设备，管理窗口尺寸、导入、显示和引用回收     |
| 操作系统             | 根据宿主提交的颜色信息完成最终显示器颜色管理                        |

Mpv 同时拥有控制与可选输出，GPU 与软件 Render API 各自遵守相应合同。Kisaki 负责内容选择、加载就绪、文件会话、采集位置与正式记录。

绑定将 SDR 目标映射为一致的原生设置，媒体映射和颜色计算由 mpv 完成。绑定核对实际资源与帧描述，遵守[配置使用约定](#constraints)。正常滤镜、缩放、字幕和脚本能力继续开放；已知输出冲突按原合同报告。

共用色调映射中的零分母修复按[源码与补丁清单](distribution.md)维护，SDR 构建的验证覆盖媒体、HDR 片源映射与字幕。

<a id="configuration"></a>

## 输出对象、配置与完成条件

createMpv 通过配置对象选择视频输出：

```ts
const mpv = await createMpv({
  options: [['hwdec', 'auto']],
  videoOutput: {
    width: 1280,
    height: 720,
    target: { colorSpace: 'srgb' },
    frameCapacity: 3
  }
})

const video = mpv.videoOutput
await video.configure({
  ...video.configuration,
  width: 1920,
  height: 1080
})
```

width 与 height 是调用方给出的物理像素尺寸，必须为正的有界整数。库核对原生整数范围和设备限制，不从 CSS 尺寸、屏幕缩放或媒体尺寸猜测宿主目标。target 缺省 sRGB。frameCapacity 缺省 3，最小 2，表示可交付纹理的有界容量，包括待交付与仍被持有的不同图像；clone 不增加图像份数。它不表示 libmpv 解码器、滤镜和驱动的全部内存上限，也不预分配任意巨大数量的纹理。

mpv.videoOutput 在未启用时为 null，启用时返回该 Mpv 拥有的输出。VideoOutput 是 GpuVideoOutput 与 SoftwareVideoOutput 的联合，以 renderer 收窄。[初始化工厂](lifecycle.md)统一创建核心与输出，并协调原生选项和日志。

工厂依据实际传入配置收窄返回类型：明确 GPU 得到 GpuVideoOutput，明确软件得到 SoftwareVideoOutput，省略得到 null，动态可选配置保留可空性。显式泛型不能在没有输出配置时伪造非空结果。额外 MpvClient 不另持有 VideoOutput。输出不提供独立 close 或 dispose；Mpv 负责最终关闭。

两类输出都提供 renderer、configuration 和 closed 的只读访问；GPU 输出另有 frameCapacity 与 device。configuration 是最近一次完成配置的独立快照。GPU configure 接受完整尺寸与 target，软件 configure 接受完整尺寸与 pixelFormat；容量、设备和渲染器只在创建时指定。GPU 输出固定不透明。默认值只在创建时补齐，完整更新避免含糊的局部合并。

renderer 省略表示 gpu，显式 software 使用独立的软件配置与帧合同。输入在接纳时完成校验与独立复制，随后修改调用方对象不会改写排队中的配置；快照也不暴露内部可变对象。原生 input: native 只改变 options 的值表示，不改变这些绑定配置的 JavaScript 类型。

同一输出的配置工作按接纳顺序执行。输入检查或新资源准备失败时保留旧配置；开始改写原生目标后若无法完成，结束该输出的新交付并明确报告失败，不伪装成已经回滚。更新期间仍处理原生渲染请求，但不交付由混合配置产生的帧；成功后原先尚未交付的旧配置帧被丢弃，已交付帧保持不变。configure 完成表示配置与生产条件已经就绪，不表示新画面已经显示。

configure 的 signal 沿用控制调用的取消语义：提交前取消不执行，提交后取消结束调用方等待，不撤销已经发生的设置。绑定继续完成已经开始的资源处理，不把中间结果遗留给下一次配置。

<a id="devices"></a>

## 设备选择与互操作

getVideoDevices() 独立枚举当前平台设备，返回名称及本次系统环境中的明确选择值。创建输出时重新核对设备可用性，后续运行或系统重启后的选择使用相应环境中的有效值。

| 平台    | 创建时可显式传入的 device             |
| ------- | ------------------------------------- |
| Windows | platform: win32，adapterLuid: bigint  |
| macOS   | platform: darwin，rendererId: number  |
| Linux   | platform: linux，renderNode: 绝对路径 |

省略时使用平台默认选择，实际选择由 VideoOutput.device 返回。明确选择失效或不支持时失败，不静默换到其他设备。宿主需要匹配自己的 GPU 时，通过本项能力明确选择；不同设备间的共享是否成立仍取决于实际驱动和资源描述。

宿主以消费端能够正确接收画面作为设备选择的首要条件，再考虑性能偏好。能够取得可靠设备标识时，据此匹配生产设备；名称只用于展示。库与 Electron 的默认设备分别由各自运行环境决定，宿主核对实际互操作条件。

解码、渲染和消费分别记录实际选择。调用方通过原生选项表达解码偏好，由 libmpv 执行；宿主提出生产设备，库创建和管理资源；Electron 等消费宿主使用自身图形环境。软件解码可以配合 GPU 渲染与共享，硬件解码也不自动保证整条链路没有复制；正常 GPU 复制不改变帧独立持有的合同。

Windows 的直接 D3D11 入口要求渲染纹理来自传入的同一个 ID3D11Device，直接 d3d11va 路径也使用该设备。消费方使用自己的图形设备时，还须满足资源共享与同步条件，不能把同一型号或某个设备可枚举视为已经可以导入。[原生设备约束](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/include/mpv/render_d3d11.h)

设备选择的验证覆盖公开枚举、显式选择、缺省选择和跨 GPU 互操作，已有机制依据见[GPU 验证](../../../verification/evidence/libmpv-gpu/verification.md)。

设备固定为该输出的整个寿命。窗口移动到另一显示器时，宿主更新物理尺寸并核对消费环境；Kisaki 保持 sRGB 目标，窗口移动不自动意味着迁移 GPU。独立宿主若明确需要另一种 SDR 表示，可通过 configure 更新。确实需要另一设备时，由宿主显式建立新的 Mpv 并决定媒体、位置与播放状态的接续，绑定不自动重放文件、脚本、流提供器或命令。

设备失联与普通关闭分别处理：普通关闭保留已交付帧；物理设备失效可能使其资源不可再读取，不能承诺失效设备上的像素仍可恢复。相关持有仍可安全、幂等归还。输出失败停止新交付并报告原因，宿主决定是否结束播放、重新建立或显示错误。

<a id="renderers"></a>

## GPU 与软件渲染

视频输出提供两种显式选择，对应 libmpv 的 GPU 与软件 Render API：

| 创建选择           | 配置与结果                                         | 用途与边界                                                            |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------- |
| renderer: gpu      | 尺寸、颜色目标、设备与容量；交付不透明 NativeFrame | 受管图形输出与共享资源，适合嵌入宿主显示                              |
| renderer: software | 尺寸与 pixelFormat；交付 SoftwareFrame             | 使用原生软件渲染器取得 CPU 像素，不创建 GPU 设备，不模拟 GPU 颜色能力 |

software 的 pixelFormat 使用上游明确记录的 rgb0、bgr0、0rgb、0bgr 与 rgb24，缺省 bgr0。SoftwareFrame 交付 width、height、stride、pixelFormat、data 及有依据的渲染时序。data 是调用方独立拥有的 Uint8Array；不暴露临时原生指针，库不再复用已交出的存储。每个接收者取得独立数据，不会互相修改。未使用通道与 padding 必须初始化；格式名中的 0 是未使用通道，不能当作 Alpha。

CPU 字节值不采用 GPU 持有协议：SoftwareFrame 没有 getSurface 或 release，已经交付的数据按普通 JavaScript 值寿命管理。库内渲染缓冲与待交付队列仍有界，并沿用最新帧合并；调用方主动保留的独立字节不计为仍由库持有的纹理。软件输出不接纳 GPU device、颜色 target 或 frameCapacity 来制造两种渲染器等价的表象。

软件渲染器自身没有 GPU 目标配置路径，上游也明确指出 HDR 可能需要手动通过滤镜处理。软件输出按实际后端解释，不能仅从 target-trc 推定目标颜色。软件帧不补造 sRGB／HDR 目标描述，不照抄稍后取得的源视频属性；使用原生滤镜和软件能力仍遵守其真实语义。它不是 GPU 失败后的自动替代，也不代替 screenshot-raw 的命令合同。[软件 API](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/include/mpv/render.h)、[实际验证](../../../verification/evidence/libmpv-output/verification.md#software)

<a id="targets"></a>

## SDR 输出与 HDR 片源映射

受管 GPU 帧固定不透明。Kisaki 使用 sRGB SDR；独立库同时保留 Display P3 SDR，供有明确消费依据的宿主选择。两种目标都使用 D65 白点与真实 sRGB 传递曲线，交付八位 RGBA／BGRA UNORM，实际存储格式随帧报告。

| target                 | 颜色表示                        | 交付含义                       |
| ---------------------- | ------------------------------- | ------------------------------ |
| colorSpace: srgb       | BT.709 原色与 sRGB 传递曲线     | 标准相对 SDR，Kisaki 默认使用  |
| colorSpace: display-p3 | Display P3 原色与 sRGB 传递曲线 | 宽色域相对 SDR，消费方按此解释 |

```ts
interface VideoTarget {
  readonly colorSpace: 'srgb' | 'display-p3'
}
```

目标不接纳 peakNits、nitsPerUnit、PQ 或扩展线性输出；也不对外提供 RGBA16F 受管帧合同。原生解码与内部图像处理仍可使用高位深或浮点精度，不能因最终输出为八位就提前降低解码精度。原生截图命令的高位深格式仍遵守自己的命令合同，与 NativeFrame 的存储范围不同。

HDR 片源仍是正常输入。libmpv 在原生媒体管线内完成色调和色域映射，再绘制字幕并交付 SDR 画面；不让宿主把未转换的 PQ 数据当作 sRGB，也不以拒绝 HDR 文件代替这项能力。验证覆盖高光层次、暗部、颜色、字幕和真实输入标记，不以能够解码或产帧作为画质通过。

十位 SDR 与 HDR 分别判断。绑定向 Render API 提供实际输出位深，抖动、缩放、去色带和其他画质选项沿原生默认值或调用方的明确配置执行。

<a id="color-names"></a>

### 颜色描述属于当前帧

colorSpace 表达交付像素的原色与传递方式，不是源文件的颜色标记，也不表示显示器的物理亮度。两个预定义目标的名称和含义固定，未知名称与不适用参数明确失败。

NativeFrame 保存生产时的 target、尺寸和像素格式快照；configure 不能改写旧帧描述。Display P3 并不保证当前屏幕能显示整个 P3 色域，宿主仍须正确标记交付资源并沿系统颜色管理呈现。[颜色定义参考](https://www.w3.org/TR/css-color-4/)

<a id="presentation"></a>

## 宿主 SDR 呈现

Kisaki 的 infrastructure/media 使用 sRGB 目标，将共享纹理及其真实格式、颜色描述交给 Electron。显示端只消费 libmpv 已渲染的画面；采用 video 元素承接 VideoFrame 时，也不另行打开媒体文件或接管音频、字幕、定位与播放控制。

窗口缩放、跨屏和显示端恢复核对尺寸、设备互操作与资源寿命。播放使用固定的 SDR 目标，独立于系统 HDR 状态、显示峰值与参考白亮度。

共享纹理、Canvas／video 等消费路径的验证覆盖 SDR 像素、连续播放、颜色解释与最终引用回收，结果按实际构建、平台和消费路径记录。

<a id="gamut-boundary"></a>

### 最终显示色域由宿主系统管理

媒体源到所选 SDR 目标的转换由 libmpv 完成；目标到实际显示器的适配沿用宿主系统。绑定不管理显示器 ICC，也不维护另一套最终感知色域压缩算法。输出颜色设置必须与帧标签一致，不能在引擎内先转成显示器专用空间后仍标记为 sRGB 或 Display P3。

SDR 管线沿用原生色域映射选项。系统对超出显示色域的颜色可能采用裁剪，因此颜色标签正确并不自动保证任何屏幕都能保留同样的极饱和层次。[Windows 颜色管理边界](https://learn.microsoft.com/en-us/windows/win32/wcs/advanced-color-icc-profiles)

<a id="frames"></a>

## NativeFrame 与独立持有

```ts
const subscription = await video.observeFrames({
  next(frame) {
    transferFrameToHost(frame)
  },
  error: reportOutputFailure
})
```

observeFrames 使用 MpvObserver 和 MpvSubscription。登记成功后开始交付，并请求一次当前输出重绘；背景画面也可成为有效帧，媒体就绪仍按加载合同判断。每个接收者取得自己的持有并负责 release。停止订阅释放尚未交付的持有，已交付帧继续由调用方管理。

NativeFrame 的只读信息包括：

- sequence：同一 VideoOutput 内的生产顺序，使用 bigint；不是媒体帧号，clone 保持相同值。
- width、height、visibleRect：实际像素范围；有效矩形不被当作影片内容矩形或字幕边界。
- pixelFormat、alphaMode、target：实际存储及本次输出目标的快照，不从稍后的 configuration 或源视频属性补写。
- targetTimeNs、redraw、repeat、blockVsync：有依据的生产时序与原生标志，不补造媒体 PTS、文件身份或呈现成功。
- released：本次持有是否已经归还。

clone 同步建立另一个独立持有，不复制像素；release 同步、幂等地归还本次持有，Symbol.dispose 复用它。最后一个持有归还后才允许复用底层图像。释放后仍可读取此前的元数据，但 clone 与 getSurface 报告 frameReleased。

getSurface 返回所在进程内的借用互操作描述：Windows 的 D3D11 NT 句柄与 adapter LUID，macOS 的 IOSurface 引用，Linux 的 dma-buf planes、DRM format 与 modifier。调用方只读导入，不关闭借用句柄或写入原图像；自己明确取得的复制句柄按其拥有关系释放。句柄字节或 fd 不是可通过普通结构化克隆转移的资源。描述只在相应持有有效期间使用，不替调用方延长资源寿命。

Electron 接入从本帧映射尺寸、格式和颜色，导入后通过 sendSharedTexture 转交显示端，在 allReferencesReleased 后才归还帧。回调返回、单个导入对象 release 或关闭一个 VideoFrame 都不能代替最后引用完成。调用方自己的 next 抛错也不撤回已经交付的所有权，应在自身边界正确清理。

<a id="timing"></a>

## 帧交付与播放时钟

原生线程处理更新、渲染与同步。每个订阅的待交付位置只保留最新帧；被替换的未交付持有立即归还。没有订阅或全部可交付纹理仍被持有时，继续使用 Render API 的 skip-rendering 推进原生工作，不覆盖旧帧、不无限扩张资源，也不等待 JavaScript 接收器的 Promise。

实时播放沿用 mpv 的音频同步与原生目标等待。BLOCK_FOR_TARGET_TIME 与目标时间共同约束渲染调度；满容量时继续按播放时钟处理必要工作，保留已交付纹理并跳过无法交付的画面。

公开同步的 VideoOutput.reportSwap()，直接表达上游翻页通知。它不接收任意 timestamp 或 sequence，因为上游入口也没有这些参数。只有实际负责显示节奏的一个宿主来源调用它；多个帧观察者不能分别重复通知。调用不等待下一次显示，也不释放帧。

上游在第一次报告后要求持续一致地使用该入口；停止报告不能当作切换回无反馈模式。输出还在渲染时，宿主若要结束这一反馈方式，须显式重建输出所属实例。绑定不发送伪造报告填补停顿；关闭时正常解除原生等待。原生实现的超时是最后的退路，不能作为日常调度方式。[Render API](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/include/mpv/render.h)、[翻页等待](https://github.com/mpv-player/mpv/blob/01e2533f3143b8940857ca419b0b367f583e05ca/video/out/vo_libmpv.c)

Kisaki 使用音频同步组织已选 Electron 消费链，sharedTexture 当前提供资源交接而没有逐帧实际呈现回执。生成纹理、导入、发送完成、引用回收和 requestAnimationFrame 各自只报告对应阶段。能够提供真实翻页反馈的宿主可以使用 reportSwap 及适用的原生同步选项，并验证 display-* 节奏、暂停与丢帧的实际效果。

targetTimeNs 使用所属 Mpv.getTimeNs() 的时钟；没有明确调度目标时为 null。固定构建的 Render API 头文件标注为微秒，实际源码与[时钟对照](../../../verification/evidence/libmpv-gpu/verification.md)对应纳秒。绑定据此以纳秒交付该字段，不将其解释为 time-pos；更换构建时重新核对原生单位。

<a id="errors"></a>

## 输出失败与核心寿命

输入无效、设备或目标不支持、资源创建失败和运行中渲染失败分别按既有错误体系报告。frameReleased 表示已归还的帧持有，renderFailed 表示输出运行中不能维持渲染合同；相关 operation 包括 getVideoDevices、configureVideoOutput、observeFrames、renderVideoFrame、cloneFrame、getFrameSurface 和 reportSwap。

| 发生位置                     | 对调用方和输出的含义                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| 输入校验或资源准备失败       | 当前调用失败；尚未改写原生目标时保留旧配置与交付                         |
| 原生目标更新已开始而无法完成 | 当前调用失败并结束该输出的新交付；保留实际错误，不声称回滚或自动 quit    |
| 提交后的取消                 | 结束调用方等待，内部完成已经开始的处理；不写回旧值抵消已发生的效果       |
| 单个通知接收器抛错           | 按既有订阅合同处理接收器异常；不自动释放已经转交的帧或关闭核心           |
| 设备失效或运行中渲染失败     | 停止新交付并报告；保留安全释放能力，旧像素是否仍可读取取决于设备事实     |
| 正常核心关闭                 | 收尾库内工作与未交付资源；不等待外部归还 GPU 帧，也不撤销已交付 CPU 字节 |

Mpv 的同核心流回调重入规则也覆盖 configure、reportSwap 等会进入该核心的输出操作；独立帧的元数据、复制持有与释放不借机重新访问已经关闭的核心。输出状态与 configuration 来自真实完成的工作，不建立自动重试、隐式恢复或命令重放流程。

只有某个订阅的交付机制中断时，按原订阅合同结束该订阅；输出本身无法维持资源或目标合同，则结束该输出的新交付和相关订阅。不会因此自动对核心发送 quit；实际原生引擎随后产生的轨道或播放失败仍通过原生事件表达。旧帧的持有关系和正确释放继续成立，设备失联另作为明确的平台失败处理。

输出本身失败后进入终态，closed 为 true，后续 configure、observeFrames 与 reportSwap 按 closed 拒绝；configuration 保留最后一次完成的快照，不发布中间配置。普通媒体结束、播放暂停或单个文件加载失败不据此关闭仍然有效的输出。

资源方向决定清理责任：流提供器把源交给库，所以普通关闭等待源的工作与清理；帧交给调用方后，Mpv.close 与订阅 dispose 都不等待外部归还。两者使用同一个拥有权原则。

<a id="constraints"></a>

## 消费方的资源责任

受管实例通过约定的设置保持输出像素、颜色描述和调度一致：

| 设置或能力              | 受管输出约定                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| vo 与渲染上下文         | 使用 libmpv，由所属 VideoOutput 管理上下文与目标资源                            |
| target-prim、target-trc | 由当前 SDR 目标导出，外部调用不能单独改写后继续沿用原帧描述                     |
| target-peak             | 使用原生 auto 的 SDR 目标语义，不引入显示器峰值参数                             |
| gamut-mapping-mode      | 沿用原生默认及调用方明确选择                                                   |
| sRGB 曲线               | 使用真实 sRGB 处理，treat-srgb-as-power22 保持 no                               |
| 输出 ICC 颜色管理       | 不配置覆盖目标空间的 icc-profile 或自动显示器 ICC；最终显示配置归宿主系统       |
| 背景                    | 使用 background=color 与不透明 background-color，缺省黑色；透明素材仍按上游处理 |
| 呈现同步                | 使用真实宿主能力，reportSwap 不由纹理生产、导入或引用回收冒充                   |

上述设置由创建和 configure 协调为一致目标；不另设原生选项锁。普通音量、轨道、滤镜、缩放与字幕选项不因属于图形相关设置就被一并禁止。用户 shader 遵守所选 SDR 表示，不被绑定占作额外单位转换，也不强制修改字幕混合方式。

可识别的直接冲突在绑定提交前报告 renderConflict。配置、profile、脚本及自定义 shader 的调用方遵守同一使用约定；绑定不维护原生选项锁，不宣称能在所有内部变更生效前拦截。发现冲突后停止不再可信的新交付并报告；既有帧不因这次检测被自动释放，库也不持续写回旧设置。

脚本违反约定时，检测之前可能已经交付颜色描述不再成立的画面；本库不保证在这些违规组合中零错误标记帧。该限制不撤销绑定自身的帧持有、资源回收与正常关闭责任。
