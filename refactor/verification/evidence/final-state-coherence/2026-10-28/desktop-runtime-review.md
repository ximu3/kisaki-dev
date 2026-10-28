# 桌面运行与测试补充审查

覆盖 `clients/desktop/app/src`（38 项）、`native`（10 项），以及 tests 下 browser、e2e、integration、performance、artifacts、support（15 项），共 63 个当前文件，逐篇通读，生成声明和 Cargo.lock 也已核对。本轮先只读审查；之后按主代理明确授权修改 4 个文件，未扩展产品范围。

## 结果

当前运行代码表达 W00 工程外壳的实际职责：主进程固定资料路径、运行构建身份和本机原生输入；extension-host 仅执行已有 ready/stop；preload 只暴露窗口局部 close；renderer 挂载真实窗口外壳并报告就绪；shared 仅含纯合同。原生文件操作使用真正的不覆盖移动和文件同步原语，资源由异步工作拥有。没有为未实现的资料库、播放、阅读或扩展加载填入假成功。

W00 正式合同明确 ready 尚无扩展API，且完整产品按后续工作包实现。因此 `apiVersion:null`、四类窗口独立入口、简单窗口内容及W00专门性能预算属于已批准交付边界；本审查没有把它们当作应立即补齐全部业务的缺陷，也没有删减后续范围。

确认并落实两项局部问题：

1. `src/main/app/development.ts:84` 的错误“does not implement extension loading yet”把当前能力失败写成开发进度。已改为 `Extension loading is unavailable in this application`，原拒绝、退出和 apiVersion:null 不变。`window-root.tsx` 与 `.css` 的 initial 描述同步改为实际窗口外壳职责。
2. `tests/integration/database/abi.test.ts:20` 原本在 try 之前创建数据库；首次绑定加载或打开失败会绕过 finally，使第15行创建的临时目录残留。已在 try 内取得句柄，关闭后清空本次持有，最终以嵌套 finally 确保目录清理。原生/SQL失败仍失败，没有捕获后跳过测试或替换绑定。

## 检查与保留边界

- 在现有 Windows x64 构建资源上执行 `pnpm run test:native tests/integration/database/abi.test.ts`，由配置核对 Electron 45.0.0、ELECTRON_RUN_AS_NODE 和 Node-API；1 文件、1 用例通过，Vitest 5.0.5 报告 433ms。
- 本轮未重新构建应用，未运行实际窗口、制品、性能或其他平台用例。正式其他目标的证据继续由原验收安排负责；静态审阅不升级运行状态。
- 浏览器用例检查真实键盘激活与失败呈现；e2e核对隔离、最小bridge和退出；native用例针对真实文件语义及资源；artifact用例消费现有制品并核对正式fuses；performance明确只测新进程W00外壳，未冒称完整业务性能。
- 测试的pending准备进程、故障close回调与隔离工作区都是明确测试范围的替身/资源，不属于正式运行占位实现。
- `native/node/binding.d.ts` 保留生成来源；其字段/导出对应当前Rust。Cargo锁版本与manifest一致，没有将三平台原语统一为会覆盖的rename或复制删除。
- 当前每次启动只创建一个所选窗口，`window:close` handler的注册范围符合当前调用；本审查未为后续多窗口业务预造协调机制。后续实际增加并存窗口时，需由相应拥有者一并完善其调用范围。
- `tests/artifacts/desktop.test.ts` 对 package.json 的摘要例外已交主代理与 electron-builder 的实际改写核对，当前未修改，也未据此宣称制品完整性有缺陷。

## 逐文件覆盖

| 文件 | 处理 | 审查结论 |
| --- | --- | --- |
| `clients/desktop/app/native/Cargo.lock` | 保留 | 完整通读生成锁，直接依赖与Cargo.toml精确版本一致；来源/校验记录保留，不手改第三方生成内容。 |
| `clients/desktop/app/native/Cargo.toml` | 保留 | 一个私有cdylib、Node-API8及平台真实文件接口，固定依赖与工具配置，无不必要独立产品crate。 |
| `clients/desktop/app/native/build.rs` | 保留 | napi-build标准symbol准备，未增加自定义下载/复制或运行时初始化。 |
| `clients/desktop/app/native/node/binding.d.ts` | 保留 | NAPI-RS生成声明对应实际Rust导出和字段注释；声明无二进制加载副作用。 |
| `clients/desktop/app/native/node/files.ts` | 保留 | Node边界验证绝对/NUL路径，稳定错误分类及系统码；无取消伪回滚、复制删除后备或消息字符串解析。 |
| `clients/desktop/app/native/node/index.ts` | 保留 | 仅列真实Node能力/错误导出，不自行加载原生模块。 |
| `clients/desktop/app/native/node/loader.ts` | 保留 | 仅加载给定绝对部署路径，检查必需导出并保留加载cause；无隐式PATH/source查找。 |
| `clients/desktop/app/native/rust-toolchain.toml` | 保留 | 固定Rust1.90工具链和formatter/clippy；编译来源与声明检查可复核。 |
| `clients/desktop/app/native/src/files.rs` | 保留 | 同文件系统不覆盖移动委托OS原语；sync拥有打开/实际句柄类型/同步/关闭；libuv异步工作，取消不伪回滚。 |
| `clients/desktop/app/native/src/lib.rs` | 保留 | 按能力导出实际files模块，不追加空壳层或业务流程。 |
| `clients/desktop/app/src/extension-host/entry.ts` | 保留 | utilityProcess 父端口只承担已实现的 ready/stop；不提供扩展加载成功或业务状态的占位结果。 |
| `clients/desktop/app/src/main/app/bootstrap.ts` | 保留 | ready前确定资料路径与单实例，固定构建/本机目标/native摘要后加载；实际renderer挂载与shared host就绪再报告ready。 |
| `clients/desktop/app/src/main/app/development.ts` | 修改 | 复用公共父子消息合同，apiVersion:null准确表达W00能力；非法/提前命令失败并退出。已将yet叙述改为当前能力不可用。 |
| `clients/desktop/app/src/main/app/extension-host.ts` | 保留 | utilityProcess拥有ready/exit/stop关系，初始化失败kill并等待，正常停止有明确期限；当前不承担扩展API。 |
| `clients/desktop/app/src/main/app/launch.ts` | 保留 | 管理开发必须有父子IPC和绝对profile；源码测试也要求隔离profile，打包普通启动不允许覆盖真实资料路径。 |
| `clients/desktop/app/src/main/app/paths.ts` | 保留 | 载体kind与平台共同决定普通/便携目录；ready前设置Electron路径；私有native显式部署路径，无运行时下载/搜索。 |
| `clients/desktop/app/src/main/app/portable.ts` | 保留 | 标记缺席选普通模式，非普通标记或缺少预备目录明确失败，不创建伪便携目录或改写用户数据。 |
| `clients/desktop/app/src/main/app/shutdown.ts` | 保留 | 按真实窗口取消决定退出；先结束host再通知开发父进程，正常退出和失败分别返回，不把通知失败挡在已接受清理之前。 |
| `clients/desktop/app/src/main/entry.ts` | 保留 | 只启动bootstrap并记录致命初始化错误；尚未具备运行资源时以非零退出，不伪装ready。 |
| `clients/desktop/app/src/main/infrastructure/log.ts` | 保留 | 稳定app/extensions领域，生命周期和安全错误消息分开；未自动展开cause、参数或数据。 |
| `clients/desktop/app/src/main/infrastructure/windows/native-window.ts` | 保留 | 当前每次启动一个所选窗口；sandbox/contextIsolation/nodeIntegration配置明确，ready/close按sender和mainFrame绑定，加载失败销毁窗口。 |
| `clients/desktop/app/src/main/infrastructure/windows/protocol.ts` | 保留 | ready前登记受控origin；只提供manifest列出的renderer文件，核对host、方法和路径边界，使用Electron原生文件读取。 |
| `clients/desktop/app/src/preload/bridge.ts` | 保留 | 只开放kind/close并传递一次挂载就绪信号；contextBridge隔离，无Node/业务API暴露。 |
| `clients/desktop/app/src/preload/game-panel.ts` | 保留 | game-panel窗口独立打包入口，复用唯一最小bridge，窗口身份固定。 |
| `clients/desktop/app/src/preload/main.ts` | 保留 | main窗口独立打包入口，复用唯一最小bridge，窗口身份固定。 |
| `clients/desktop/app/src/preload/player.ts` | 保留 | player窗口独立打包入口，复用唯一最小bridge，窗口身份固定。 |
| `clients/desktop/app/src/preload/reader.ts` | 保留 | reader窗口独立打包入口，复用唯一最小bridge，窗口身份固定。 |
| `clients/desktop/app/src/renderer/components/window-root.css` | 修改 | 窗口外壳布局与字体样式，已去initial过程称呼；未引入业务界面假实现。 |
| `clients/desktop/app/src/renderer/components/window-root.tsx` | 修改 | 实际关闭操作与局部失败反馈；按钮保留语义和原生键盘行为，已按外壳职责描述。 |
| `clients/desktop/app/src/renderer/environment.d.ts` | 保留 | Window仅关联同一最小preload合同，未复制第二份接口。 |
| `clients/desktop/app/src/renderer/styles/base.css` | 保留 | 消费appearance/ui正式样式导出及必要重置；没有运行逻辑、动态主题占位或文件读取。 |
| `clients/desktop/app/src/renderer/windows/game-panel/entry.tsx` | 保留 | game-panel窗口实际Solid挂载后通知ready，并在HMR拥有清理；属于批准的W00外壳。 |
| `clients/desktop/app/src/renderer/windows/game-panel/index.html` | 保留 | game-panel独立文档含CSP、语义语言、真实挂载点与模块入口；无远程脚本或假业务内容。 |
| `clients/desktop/app/src/renderer/windows/game-panel/styles.css` | 保留 | game-panel窗口样式入口引用共同base，职责是独立构建发现，不复制视觉状态。 |
| `clients/desktop/app/src/renderer/windows/main/entry.tsx` | 保留 | main窗口实际Solid挂载后通知ready，并在HMR拥有清理；属于批准的W00外壳。 |
| `clients/desktop/app/src/renderer/windows/main/index.html` | 保留 | main独立文档含CSP、语义语言、真实挂载点与模块入口；无远程脚本或假业务内容。 |
| `clients/desktop/app/src/renderer/windows/main/styles.css` | 保留 | main窗口样式入口引用共同base，职责是独立构建发现，不复制视觉状态。 |
| `clients/desktop/app/src/renderer/windows/player/entry.tsx` | 保留 | player窗口实际Solid挂载后通知ready，并在HMR拥有清理；属于批准的W00外壳。 |
| `clients/desktop/app/src/renderer/windows/player/index.html` | 保留 | player独立文档含CSP、语义语言、真实挂载点与模块入口；无远程脚本或假业务内容。 |
| `clients/desktop/app/src/renderer/windows/player/styles.css` | 保留 | player窗口样式入口引用共同base，职责是独立构建发现，不复制视觉状态。 |
| `clients/desktop/app/src/renderer/windows/reader/entry.tsx` | 保留 | reader窗口实际Solid挂载后通知ready，并在HMR拥有清理；属于批准的W00外壳。 |
| `clients/desktop/app/src/renderer/windows/reader/index.html` | 保留 | reader独立文档含CSP、语义语言、真实挂载点与模块入口；无远程脚本或假业务内容。 |
| `clients/desktop/app/src/renderer/windows/reader/styles.css` | 保留 | reader窗口样式入口引用共同base，职责是独立构建发现，不复制视觉状态。 |
| `clients/desktop/app/src/shared/build.d.ts` | 保留 | 纯构建全局声明，buildId来自构建拥有者，不执行运行操作。 |
| `clients/desktop/app/src/shared/distribution.ts` | 保留 | 载体标识和manifest纯合同；target/testOnly的构建/验证消费留在相应拥有者。 |
| `clients/desktop/app/src/shared/extension-host.ts` | 保留 | 仅ready/stop私有进程寿命合同，未混入未来扩展API。 |
| `clients/desktop/app/src/shared/runtime-manifest.ts` | 保留 | 六目标与运行文件摘要纯结构；构建和运行消费者共用定义。 |
| `clients/desktop/app/src/shared/window-controls.ts` | 保留 | 四窗口类型及窗口局部close合同，无业务状态或renderer Node能力。 |
| `clients/desktop/app/tests/artifacts/desktop.test.ts` | 保留 | 现有载体摘要、ASAR内容、正式fuses和外部真实窗口关闭；个人profile隔离，开发IPC也测拒绝路径。package.json摘要例外交主代理核对。 |
| `clients/desktop/app/tests/browser/window.test.tsx` | 保留 | 真实浏览器验证按钮Tab/Enter及关闭失败可见，替身仅代替传入close，Solid/DOM生命周期正常清理。 |
| `clients/desktop/app/tests/e2e/windows.test.ts` | 保留 | 逐窗口种类启动真实Electron并核对最小bridge、隔离profile和正常退出；Linux不可用metrics字段不冒充sandbox缺失。 |
| `clients/desktop/app/tests/integration/database/abi.test.ts` | 修改 | 真实交付SQLite binding在Electron Node中验证事务/回滚/重开；已将首次构造纳入目录清理边界，单项复跑通过。 |
| `clients/desktop/app/tests/integration/native/files.test.ts` | 保留 | 真实文件结果验证加载cause、不覆盖/竞争/缺失/跨卷/同步；环境只单卷时如实skip，不复制删除制造通过。 |
| `clients/desktop/app/tests/integration/portable.test.ts` | 保留 | 独立临时目录验证marker选择与失败后文件保持，不使用个人资料。 |
| `clients/desktop/app/tests/performance/budgets.ts` | 保留 | 保留正式代表负载与W00专用启动预算，明确预算不代表完整资料库性能通过。 |
| `clients/desktop/app/tests/performance/startup.test.ts` | 保留 | 20次新进程、保留隔离profile、暖OS缓存，记录构建/宿主/分布和观察到的PID退出；标题和报告限定实际测量。 |
| `clients/desktop/app/tests/support/artifact-workspace.ts` | 保留 | 自有临时目录解包/复制既有载体和便携profile，准备失败清理；实际进程退出后才由测试释放。 |
| `clients/desktop/app/tests/support/development-controller.ts` | 保留 | 测试子进程运行真实开发会话并转交状态；测试专用IPC不进入应用公开合同，失败保留并退出。 |
| `clients/desktop/app/tests/support/development-session.ts` | 保留 | 持有真实控制器、有限诊断轨迹、停止期限与退出等待；专用于测试会话拥有关系。 |
| `clients/desktop/app/tests/support/development-workspace.ts` | 保留 | 隔离复制开发输入，使用原生pnpm离线锁安装/真实git HEAD；保持Electron链接和native输出隔离，失败清理。 |
| `clients/desktop/app/tests/support/electron.ts` | 保留 | Playwright fixture先核对目标/Electron版本，启动隔离profile，子进程退出后清理资料；无真实个人数据。 |
| `clients/desktop/app/tests/support/preparation-worker.ts` | 保留 | 明确的测试依赖构建替身，用pending进程观察取消，不混入正式依赖构建。 |
| `clients/desktop/app/tests/support/window-observation.ts` | 保留 | 分别使用宿主窗口API观测/普通关闭；命令取消等流关闭；Wayland不以X11结果替代实测。 |

## 汇总闭合

主审已将新增数据库获取范围的 TypeScript 闭包收窄问题修正，并通过整仓检查。构建身份按不透明 Turbo 任务摘要处理，最终制品不再假定其为 SHA-256；所有运行文件继续按 SHA-256 校验。package.json 的旧摘要排除已移除：锁定 electron-builder 的共同转换源码和现有 Windows 制品均表明本项目生成的该文件保持原字节，最终载体回归另行登记。
