# 工程边界

桌面应用是 `@kisaki3/desktop`，同一 workspace 管理四类 renderer、四个 sandbox preload、主进程、一个共享 utility-process 扩展宿主和私有 Rust/Node-API 工程。当前程序只交付工程基础，完整业务能力由后续工作包建立。

`src/main/app` 选择路径并装配生命周期；`infrastructure/windows` 负责原生窗口与资源协议，`infrastructure/log.ts` 负责日志；后续 `features` 拥有产品操作和事实。主进程在 Electron ready 之前确定隔离或发行形态要求的资料位置。窗口只取得所属 preload 的最小接口，主进程核对真实 sender 与 frame。

`src/shared` 只保存私有纯合同和必要的确定性规则，包括窗口能力、进程消息、运行清单与载体身份。main 与 extension-host 不互相导入实现；renderer 不取得 Node 或 Electron。扩展宿主使用 Electron utilityProcess，以便在正式关闭 RunAsNode fuse 后仍可启动。

原生源码、声明和加载入口分别位于 `native/src`、`native/node/binding.d.ts` 与 `native/node/index.ts`。应用通过 `#native` 显式加载当前构建的绝对制品路径，不搜索其他输出、现场编译或降级为不同语义。文件移动和同步在工作线程执行，Node 边界提供稳定错误。

八个公共包通过自己的 `exports` 和构建结果消费。业务合同方向为 `extension-sdk → extension-api → desktop-contracts`；appearance、ui、rpc 和 extension-distribution 保持各自独立职责。官方扩展具有与第三方相同的边界，当前仅登记工程配置，不随应用预装。

四个窗口保留各自的 HTML、程序和样式入口，当前相同的初始视图由 `renderer/components/window-root` 共用；窗口入口注入所属能力，视图不操作传输。

构建由项目自己的工具拥有，根 Turbo 从真实 manifests 安排依赖。每个输出只有一个写入者，完整候选成功后才交接。开发会话的协调归 `dev/session`，Vite renderer 服务归 `dev/renderer`，运行时与公共包输入监听归 `dev/inputs`，应用经 `extension-cli/extension` 的公共父子 IPC 入口启动；候选和公共包快照分别归 `generation` 与 `dependencies`。消息唯一归属 `desktop-contracts/development`，源码与打包应用采用同一接入和可取消退出。公共依赖快照根据真实公开制品生成，Node 重启依据 Vite 报告的实际模块输入，而非手写依赖表。

工程工具顶层按完整任务组织，应用内部共用的路径、目标与摘要归 `tools/lib`；跨工程的输出交接、命令执行和 CLI 收尾归私有包 `@kisaki3/tooling`，共享类型与 lint 配置由另外两个私有工程包提供。开发 Electron 定位归 `tools/dev/electron-executable.ts`。`packaging` 是打包专用静态输入边界，执行逻辑在 `tools/package`，产物在 `dist`；它与官方 registry 都可以保留 W00 阶段的归属说明。

媒体信息与播放经 libmpv-node 接入，FFmpeg 是该库的运行依赖。本体没有独立 ffprobe 工具链。

测试按目的归所属项目：纯逻辑就近，工程工作流归 `tests/tools`，真实驱动归 `tests/integration`，浏览器、Electron、性能和最终制品分别配置。根测试只拥有仓库工具与跨包消费。正式程序不导入测试、fixture 或工具代码。

完整职责与后续布局以 [运行架构](refactor/design/architecture.md)、[源码布局](refactor/design/engineering/layout.md) 和 [工作包](refactor/implementation/work-packages.md) 为准。
