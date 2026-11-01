# 工程边界

根 `packages` 中的三个私有包分别提供 TypeScript 配置、ESLint 配置和工程函数。`clients/desktop/app` 拥有桌面构建、资源、原生操作、打包和验证；根工具维护 Git hooks 与验证环境记录。workspace 只登记有实际职责和实现的项目。

## 桌面公共包

`clients/desktop/packages/desktop-appearance` 提供 45 项纯视觉 token、完整值解析、亮暗默认值、普通 CSS 和可选 Tailwind 映射。主题保存可直接编辑的视觉值，共同样式拥有派生计算。解析入口在 Node 与浏览器中使用同一实现，词表和默认值可独立消费。默认值由同一份 TypeScript 数据生成 CSS，映射只引用共同变量。字体字节、资源读取与主题持久化由实际宿主负责。

包通过构建后的子路径交付 ESM、声明与样式。根 `tools/desktop/packages` 打包当前公共项目并记录摘要，`tests/desktop/consumers` 从仓库外安装 tarball，核对类型、Node 与浏览器消费。

## 桌面工程

`tools/build` 编译调用方明确提供的程序输入，消费已准备的资源和原生输出，完成后交接整个候选。`build/identity` 读取 Turbo 的 runtime-inputs 节点摘要，并为完成的运行字节生成摘要。`tools/resources` 准备锁定字体、图标与 SQLite 绑定；`tools/native` 拥有 Rust 编译与声明核对；`tools/package` 消费同一份已验证构建，检查身份和字节后生成目标载体。

`tools/dev/session` 拥有一次开发会话的服务、监听、候选和进程寿命。调用方提供源码根目录和进程启动能力；`renderer` 管理 Vite，`inputs` 管理 Chokidar，`generation` 编译 Node 程序，`dependencies` 通过构建后的 exports 取得完整依赖快照。失败保留既有可用结果，正常退出可以取消，资源释放完成后才结束会话。

跨工作流的路径、目标、运行清单和摘要归 `tools/lib`。跨工程的候选交接、命令取消与 CLI 信号处理由 `@kisaki3/tooling` 提供。工程实现不导入测试代码。

## 原生能力

`native/src` 提供异步文件同步和不覆盖目标的文件移动，`native/node` 提供加载入口、声明和错误转换。调用方通过 `#native` 加载明确的绝对制品路径；加载失败保留原始原因。构建由固定 Rust 工具链、Cargo 锁文件和 Node-API 配置约束。

## 验证

`tests/fixtures/runtime` 仅为工程工具提供最小输入，覆盖编译入口、进程隔离和工具故障恢复；它不是产品变体。`prepare:test-runtime` 通过任务依赖复用原生与资源准备，编译一次供 Electron 与打包工具测试消费。开发测试在只包含实际依赖的隔离 workspace 中修改输入。

`tests/tools` 维护构建、打包、监听和开发会话的可观察行为；`tests/integration` 在 Electron Node 模式中验证真实原生文件操作与 SQLite，直接消费对应输出。产品端到端、最终发行及性能验收随真实产品建立，不保留空载体的性能门禁。

根测试保留 hooks 的资料保护、源码检查覆盖和重要依赖边界。配置事实由所属工具表达，不另建模拟整份工程配置的测试仓库。Turbo 根据真实依赖共享准备输出，并以源码、测试、工具链、CI 镜像和目标作为成功缓存的依据。原生绑定覆盖六目标，工程工具覆盖三个系统参考目标，公共包消费者使用 Linux x64；完整产品交付继续遵守六目标合同。

产品的完整进程职责、公共包和源码布局见[运行架构](refactor/design/architecture.md)、[源码布局](refactor/design/engineering/layout.md)和[工作包](refactor/implementation/work-packages.md)。
