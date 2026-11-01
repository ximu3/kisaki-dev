# 工程边界

根 `packages` 中的三个私有包分别提供 TypeScript 配置、ESLint 配置和工程函数。`clients/desktop/app` 拥有桌面构建、资源、原生操作、打包和验证；根工具维护 Git hooks 与验证环境记录。workspace 只登记有实际职责和实现的项目。

## 桌面工程

`tools/build` 编译调用方明确提供的程序输入，组织资源和原生输出，完成后交接整个候选。`build/identity` 读取 Turbo 任务的输入身份，并为完成的运行字节生成摘要。`tools/resources` 准备锁定字体、图标与 SQLite 绑定；`tools/native` 拥有 Rust 编译与声明核对；`tools/package` 消费同一份已验证构建，检查身份和字节后生成目标载体。

`tools/dev/session` 拥有一次开发会话的服务、监听、候选和进程寿命。调用方提供源码根目录和进程启动能力；`renderer` 管理 Vite，`inputs` 管理 Chokidar，`generation` 编译 Node 程序，`dependencies` 通过构建后的 exports 取得完整依赖快照。失败保留既有可用结果，正常退出可以取消，资源释放完成后才结束会话。

跨工作流的路径、目标、运行清单和摘要归 `tools/lib`。跨工程的候选交接、命令取消与 CLI 信号处理由 `@kisaki3/tooling` 提供。工程实现不导入测试代码。

## 原生能力

`native/src` 提供异步文件同步和不覆盖目标的文件移动，`native/node` 提供加载入口、声明和错误转换。调用方通过 `#native` 加载明确的绝对制品路径；加载失败保留原始原因。构建由固定 Rust 工具链、Cargo 锁文件和 Node-API 配置约束。

## 验证

`tests/fixtures/runtime` 是工程测试输入，覆盖四个 renderer/preload 构建入口、主进程和 utility process。它要求显式隔离资料目录，只提供测试所需的身份、计数器和进程控制。窗口名称对应编译入口；产品窗口、公开通信和扩展宿主分别由所属工作包实现。

`tests/tools` 检查构建、依赖、监听与会话，`tests/integration` 验证原生与 SQLite，`tests/e2e` 运行真实 Electron，`tests/artifacts` 保留制品 fuses 并从外部观察运行。性能采样使用同一载体，结果只反映工程启动负载。

根测试验证 hooks、workspace、类型覆盖、依赖边界和任务选择。CI 根据真实任务输入选择验证，桌面与原生检查覆盖六个目标；各次实际结果由[状态页](refactor/implementation/status.md)记录。

产品的完整进程职责、公共包和源码布局见[运行架构](refactor/design/architecture.md)、[源码布局](refactor/design/engineering/layout.md)和[工作包](refactor/implementation/work-packages.md)。
