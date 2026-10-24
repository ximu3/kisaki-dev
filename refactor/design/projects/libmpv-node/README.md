# libmpv-node

`@ximu3/libmpv-node` 是 libmpv 的 Node 原生绑定。它保留上游控制语义，并拥有 JavaScript／原生值转换、异步调用、可选视频输出和资源清理。

| 主题                             | 内容                                       |
| -------------------------------- | ------------------------------------------ |
| [调用 API](api.md)               | 命令、属性、错误、客户端与异步 hook        |
| [值与转换](values.md)            | 输出表示、整数、字节、属性格式与转换失败   |
| [订阅与通知](notifications.md)   | 接收器、创建与停止、事件、日志、缺口及积压 |
| [初始化与运行寿命](lifecycle.md) | 创建、配置、执行、运行库、关闭与 Node 环境 |
| [流提供器](streams.md)           | 自定义字节源、取消与重入                   |
| [视频输出](video.md)             | 配置、SDR、帧持有、时序与使用约定          |
| [平台图形](platforms.md)         | D3D11、IOSurface、dma-buf、同步及共享资源  |
| [构建与发行](distribution.md)    | 原生输入、功能、补丁、依赖、许可和平台包   |

共同工程约束见[原生库运行与交付](../native-runtime.md)，Electron 与产品会话见[Kisaki 接入](../../engineering/integrations.md#media)，设计依据见[验证记录](../../../verification/evidence/README.md#libmpv-node)。

<a id="source"></a>

## 源码与运行职责

Rust core 以同一个 Mpv 及其原生资源为中心，按 Client API 控制与视频输出组织。client.rs 和 video.rs 承载实际入口与生命周期实现，各自目录保存内部协作拆分：

    core/src/
    ├── lib.rs
    ├── runtime.rs
    ├── ffi.rs
    ├── client.rs
    ├── client/
    │   ├── requests.rs
    │   ├── events.rs
    │   └── values.rs
    ├── video.rs
    └── video/
        ├── render.rs
        ├── frames.rs
        └── platform/

| 模块            | 唯一责任                                                 |
| --------------- | -------------------------------------------------------- |
| client          | Mpv 实例、初始化与关闭，以及公开命令和属性调用的原生入口 |
| client/requests | 原生异步请求与回复关联，尚未完成请求的结束和适用取消     |
| client/events   | 原生事件读取与分发、属性和诊断观察，以及中断处理         |
| client/values   | mpv_node 等原生结果的拥有权、整数精度、字节和错误转换    |
| video/frames    | 已交付 NativeFrame 的独立持有、平台资源与释放关系        |
| ffi             | 控制与渲染共用的固定上游 C API 定义和原生接入            |
| runtime         | 进程拥有的固定运行库加载、构建身份与代码映射寿命         |
| video           | 可选 VideoOutput、图形上下文、渲染调度、尺寸与帧生产     |

Client API 本身包含命令、属性、异步请求与事件，异步回复与普通事件通过同一事件流接续。client 由此拥有完整控制机制；client.rs 保留实例和调用入口，请求关联、事件交付与转换在私有子模块中协作，不复制播放器状态机。video 通过明确的句柄和生命周期关系接入，不直接操作 client 的请求表或另开事件读取循环。属性订阅可以分别停止；命令完成、文件加载、实际定位和画面呈现继续保留各自含义，不包装成库级的作品打开或截图采用流程。

模块入口文件与同名子目录遵循 Rust 的原生模块组织。client.rs、video.rs 承担真实实现，子模块按所需可见性开放。lib.rs 显式导出需要交付给 binding 的能力，Node 公共 API 按公开合同组织。client 与 video 在同一 crate 内协作管理同一个 Mpv。

runtime 的进程寿命与 client 的实例寿命分别落实，输入接纳、事件读取、Node 交付和清理次序统一见[控制执行与运行时交接](lifecycle.md)。[平台图形](platforms.md)与[引擎装配](distribution.md)分别定义实际资源与发行责任。

ffi 与具体上游版本和构建配置共同核对，引用头文件及生成过程可复核，正常消费包不要求安装 C 头文件或现场生成绑定。原生调用、值复制与释放在 Rust 侧闭合，Node 消费者不轮询 C 事件队列或管理裸指针。

video.rs 拥有 VideoOutput 及输出生命周期，video 目录内按 render、frames 与平台图形接入拆分。每个播放核心最多一个活动 render context，由库先建立图形环境，再按上游约束调用 Render API。播放线程、渲染工作与 JavaScript 接收速度分别处理；只有已准备好的自有数据或资源描述可以跨线程交付。

video/frames 保存 GPU 画面的独立持有关系，其内容、同步和平台资源释放属于视频输出。Node 消费侧可以独立持有和释放 NativeFrame；跨生产与消费使用、比 Mpv 存活更久，都不要求帧实现位于根层。关闭 Mpv 停止新工作并按顺序释放输出和核心自身资源；已交付 GPU 帧按既定 release 合同继续存在，不通过保留整个 Mpv 延长画面寿命。池中未交付帧可以受有界策略约束，仍被消费方持有的资源不能覆盖或复用。已确认的软件输出交付独立 CPU 字节，不套用 GPU 释放协议；软件帧、截图命令结果与 GPU 帧各自保留真实合同。

Windows、macOS、Linux 的图形互操作实现分别落在 video 的平台模块。Linux 显示环境与图形能力按实际运行条件处理，不能从能够构建 .node 推断共享纹理可用。[平台画面交接](platforms.md)定义各平台路线及 GPU 资源、同步和导入条件，实施按对应场景验证。

Kisaki 的 Electron sharedTexture 接入位于本体 infrastructure/media。它将库的帧交给显示端，并在 allReferencesReleased 后解除相应持有；libmpv-node 不引用 Electron。测试用 Electron 消费程序位于 tests/consumers/electron，按公开包测试真实交接，其代码不进入原生库运行包。

正式实现与联合消费按[验收场景](../../../verification/scenarios/libmpv.md#libmpv)核对。
