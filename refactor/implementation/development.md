# 当前工程与开发

本篇说明当前源码职责、环境准备与可运行入口。目标布局见[仓库与源码布局](../design/engineering/layout.md)，完成度及验证结果见[实施状态](status.md)。正式项目文档由 [W23](work-packages.md#w23) 按对象形成。

按任务阅读：[源码职责](#source) · [准备与协作](#setup) · [构建与资源](#build) · [检查与运行](#verification) · [共用工程包](#shared-tooling) · [CI 与交付](#ci)。

<a id="source"></a>

## 当前源码职责

| 位置                                                     | 当前职责                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 根 `tools`                              | CI 选择、文档引用与依赖边界                                      |
| 根 `tests/workspace`                                     | 跨工程导入边界与代表性 CI 场景选择                   |
| `packages/config`、`packages/tooling` | TypeScript 预设与 Vite 库配置、输出清理、命令执行、错误交付和消费者安装                    |
| `clients/desktop/app/tools`                              | 桌面程序构建、资源准备、原生编译、开发会话、打包与输出清理                       |
| `clients/desktop/app/src/main/infrastructure/database`    | 正式 schema、逐值 codec、连接、同步事务、初始化与资料库语言排序          |
| `clients/desktop/app/src/main/infrastructure/files`       | 实际路径比较、本地资料根检查、有限字节准备、不覆盖发布与流式 ZIP                |
| `clients/desktop/app/src/main/features/preferences`       | 初始化与 getDefaults 共用的产品默认配置定义                                   |
| `clients/desktop/app/drizzle`                            | Drizzle Kit 生成并审阅的 SQL 迁移及 snapshot，随资源原样交付                    |
| `clients/desktop/app/native`                             | Rust 文件同步、不覆盖移动与实际文件系统识别，Node 加载、声明与错误转换          |
| `clients/desktop/app/assets`                             | 锁定字体、第三方许可与图标源稿                                    |
| `clients/desktop/app/tests`                              | 工程用例、隔离载体，以及原生、Electron、开发、制品和性能验证                     |
| `clients/desktop/packages/desktop-appearance`            | 视觉词表、纯值解析、亮暗默认值、普通 CSS 与可选 Tailwind 映射                    |
| `clients/desktop/packages/desktop-ui` | Solid 控件、原生表单与反馈、浮层、Toast、Markdown、图表、拖拽和普通 CSS |
| `clients/desktop/packages/extension-distribution`        | 身份、manifest、registry、本地化、兼容选版、不可变制品规则与 Node 签名           |
| `clients/desktop/packages/desktop-localization`          | 英语源文、关联消息类型、作者校验与纯格式化                                       |
| `clients/desktop/packages/desktop-contracts`             | 桌面接口、值约束、规范编码、查询与写入合同、参与接口、会话、管理、深链和开发控制 |
| `clients/desktop/packages/desktop-rpc`                   | 有限 JSON 帧、握手、双向调用与通知、按调用取消、安全失败和断连清理               |

桌面公共包通过构建后的公开入口交付 ESM、声明和各自资源。包内 `tests/consumers` 使用仓库外的独立工程核对同一 tarball，用例、样板、配置、依赖和报告分别由所属包维护。公开值和消费方式可从源码声明、消费者样板及 [W01](../verification/evidence/w01/README.md)、[W02](../verification/evidence/w02/README.md)、[W03](../verification/evidence/w03/README.md)、[W04](../verification/evidence/w04/README.md)、[W05](../verification/evidence/w05/README.md) 验证入口查阅。

desktop-ui 从组件家族子路径消费，样式入口为 `/styles.css`，包含 appearance 的普通样式；图表、Markdown 和拖拽按完整能力独立导入。表单的验证与保存、图表统计、正文资源及业务拖拽由宿主拥有。接口和组合示例见包内源码与仓库外消费者样板。`pnpm exec vp run @kisaki3/desktop-ui#test:consumers` 验证真实 tarball、完整声明、浏览器、Tailwind 和 Electron，报告位于包内 `test-results/consumers`。

desktop-rpc 从包根导出 `RpcConnection`、传输接口和帧合同。接入端绑定实际通道与身份，提供明确的方法表并解析业务值。等待 `ready` 后发起调用，按 `closed` 的结束原因释放所属资源。两个消费者分别通过 Node JSON IPC 和沙箱 Electron 窗口的 MessagePort 运行。Linux 执行消费者套件需要图形会话，CI 使用 Xvfb。

desktop-contracts 按业务子路径导出显式接口、值校验与规范编码。类型、校验和操作按主题就近维护，多文件公开入口位于主题目录内。纯单测随源码放置，真实消费者与其样板保留在所属包的 tests 中。本体业务实现按所属工作包建立。

Lucide 名称目录由 desktop-contracts 的 `tools/generate-icon-names.ts` 从固定依赖生成，`pnpm exec vp run @kisaki3/desktop-contracts#generate:icon-names` 更新 `src/ui/icons/names.generated.ts`。普通 build 核对生成一致性；公开纯合同只携带名称和校验，不加载图形目录。desktop-ui 以 lucide-solid 组件呈现本地图标。

desktop-localization 的英语 ICU 源文位于 src/en，按领域维护并由 index.ts 静态汇总；`pnpm exec vp run @kisaki3/desktop-localization#generate:messages` 更新 src/contracts.generated.ts。普通 build 校验消息声明与英语源文一致，再交接完整构建结果。`createTranslator(locale, catalog)` 创建独立格式化快照；有效语言、译本登记和响应式接入由后续本体工作包实现。生成源由生成器负责排版。

桌面 `tools/build` 接收明确的程序输入，在干净的所属输出目录完成编译与完整性核对；`tools/resources`、`tools/native` 与 `tools/package` 分别拥有资源、原生编译和打包。目标、路径和散列算法归 `tools/lib`，运行清单归 `tools/build/manifest.ts`，跨工程机制归 `@kisaki3/tooling`。原生调用通过 `#native` 加载明确的绝对制品路径，失败保留原始原因。

`tests/fixtures/desktop-app` 验证四个 renderer/preload 入口、main、utility process、Solid 热更新及资源加载。运行必须提供测试拥有的绝对资料目录；窗口名称对应编译入口，本地消息供测试控制使用。产品窗口、公开通信和扩展宿主按所属工作包实现。

载体通过数据库执行线程打开当前基线、读取偏好并采用窗口语言。存储性能用例通过 Playwright 在 Electron 主进程中启动独立编译的测量 worker。worker 返回完整报告并正常退出后，用例将报告保存为附件。执行失败时，原始错误传回用例。

`tools/dev/session` 拥有编译器、服务器、运行目录与进程。Vite 按公开子路径的 `kisaki-source` 条件直接编译工作区源码，renderer 使用 Solid HMR。非程序资源和原生绑定由各自的准备工具处理。程序编译成功后安排受控重启，拒绝退出时原进程及其运行目录继续使用。

`tools/dev/renderer` 在开发文档的应用入口前加载错误监听。模块入口加载失败的窗口通过 Vite 连接报告文档的源码修订号。如果源码已经变化，该窗口立即重载；否则在下次编辑时重载。正常工作的窗口继续处理常规热更新。

W07 接入正式窗口后，源码开发和指定制品分别验证窗口、存储与退出。开发会话用例保留自己可编辑的样板，已经由产品入口覆盖的工程载体随之退役。

<a id="setup"></a>

## 准备与协作

使用 `.node-version` 和根 `packageManager` 指定的 Node、pnpm。Rust 由 `clients/desktop/app/native/rust-toolchain.toml` 固定。Windows 需要 Visual Studio C++ 工具链，macOS 需要 Xcode Command Line Tools，Linux 需要对应系统构建工具。开发 Node 与 Electron 内置 Node 分开验证。

```sh
pnpm install --frozen-lockfile
pnpm exec vp hooks enable
```

`pnpm exec vp hooks enable` 调用 Vite+ 安装本仓库的 dispatcher，`pnpm exec vp hooks status` 显示生效配置。`.vite-hooks/pre-commit` 调用 `vp staged`，对暂存文件运行格式及 lint 检查。`pnpm exec vp hooks disable` 撤销。Git 配置与暂存恢复遵守[本地 hooks](../design/engineering/workspace.md#hooks)。

合并前同步最新 main 并通过必需检查。主线保护同样约束管理员，只允许 Squash，合并后删除远端分支。完整规则见[协作合同](../design/engineering/workspace.md#collaboration)。

验证证据中的原始材料保留字节和来源；Git 不转换这些文件的换行。普通源码采用 LF。材料按[实际用途](../design/engineering/documentation.md#evidence)维护。

<a id="build"></a>

## 工程构建与资源

当前可执行入口验证桌面工程能力。程序输入位于 `clients/desktop/app/tests/fixtures/desktop-app`，每次运行使用测试拥有的隔离资料；完整产品合同和实施进度分别见 [refactor](../README.md) 与[状态页](status.md)。

```sh
pnpm exec vp run @kisaki3/desktop#build:fixture --target windows-x64
pnpm exec vp run @kisaki3/desktop#package:fixture --target windows-x64
```

目标必须匹配实际 runner。构建先准备资源和原生绑定，再通过 Vite 编译各程序；全部编译与装配成功后写入完成清单；失败结果不供下游采用。资源准备可独立执行 `pnpm --filter @kisaki3/desktop prepare:resources --target windows-x64`。

资源工作流从锁定依赖准备字体与 SQLite 绑定，从唯一图标源稿生成 PNG／ICO，最终运行清单统一记录资源摘要。`assets/fonts/inputs.json` 选择字体文件和许可，包版本与来源完整性由 pnpm 锁文件约束。

字体输入为 Fontsource 的 Noto Sans SC Variable 与 Noto Sans Mono Variable，按原始字节和名称装配，并保留 LICENSE、CSS 与 metadata。`assets/icons/source.png` 为项目作者的原创图标源稿。字体与图像的许可归属见[项目许可](../design/engineering/licensing.md#third-party)及[原创图像](../design/engineering/licensing.md#brand)。

`buildId` 是同次程序构建的独立标识，源码开发使用自己的会话标识。打包从完成的 `build.json` 核对目标、完整文件集合和 SHA-256 摘要。`@kisaki3/desktop#package:fixture` 通过 Vite Task 准备并打包工程载体。

工程载体打包固定标记 `testOnly`。默认生成实际启动验证使用的 ZIP 或 AppImage；`pnpm exec vp run @kisaki3/desktop#package:fixture --installers` 生成目标平台全部格式。构建和打包均不发布。正式签署、安装升级及发行接入由 W20 验收。

`pnpm exec vp run @kisaki3/desktop#build:fixture --program preload` 单独验证 preload 编译。`build:native` 编译私有绑定；需要更新生成声明时显式添加 `--update-declarations` 并审阅变化。`check:native` 执行固定 Rust 工具链的格式与 Clippy 检查。

### 存储与生成资源

数据库固定使用 Drizzle ORM／Kit 1.0.0-rc.5、better-sqlite3 13.0.3 和 Electron 45.3.2。`database/initialize` 接收数据库、原生驱动、迁移目录的明确路径及当前完整偏好默认值；路径拥有者先以 `files.assertLocalDataDirectory` 核对实际卷或挂载。初始化完成格式与迁移链检查、原生 migrate、缺失偏好首行插入和名称索引采用后才返回连接。业务使用 Drizzle 的同步查询与事务，并在关闭前结束自己的消费者。

连接使用 WAL、FULL，以及 macOS 的 fullfsync；页缓存目标为 32 MiB。表、外键、CHECK 和索引由 schema 定义；保存的执行配置、身份与定位值通过 `StoredDefinition` 表达读取问题，普通偏好按独立字段采用默认值。读取投影不会自动写回；后续业务更新须保留未修改的原始字段。

`pnpm --filter @kisaki3/desktop generate:migrations --name <主题>` 使用正式 Drizzle Kit 入口。审阅生成的 SQL、snapshot 及必要的数据变换后提交整个迁移目录。构建按实际目录结构复制迁移，开发监听将迁移变化交给资源准备。迁移的格式识别、不可修改规则与失败处理见[数据库合同](../design/engineering/database.md)。

名称排序由同一私有绑定的 SQLite 扩展入口与 ICU4X 2.4.0 提供。数据库先按索引记录的语言重开，新库采用英语。main 读取已选译本，待 i18n 确认生效语言或回退后调用 `storage.adoptLocale`，再开放资料库查询。后续语言切换沿用同一入口。仅在生效语言或引擎修订变化时重建 `kisaki_name` 索引；比较规则见[资料库名称排序](../design/domains/library/query/README.md#name-order)。

文件设施使用原生不覆盖移动与同步屏障发布已准备字节。ZIP 读取按需访问中央目录，写入逐成员消费流；拥有者提供条目、路径元数据、展开字节与归档字节预算。取消和失败等待当前流结束并释放所属文件与临时目录。业务清单、资源引用和恢复事务由所属后续工作包接入。

开发测试仅在需要改写文件时复制载体和目标包的源码，只读依赖复用本机安装。窗口拒绝退出及停止失败的场景直接使用固定载体，按次分配 profile、编译目录及运行目录。

同一工作副本中，共享输出的构建、运行与打包顺序执行。任务内依赖和合法并行由 Vite Task 管理。有限输出位于 `out/<target>`，开发会话位于 `out/development/<target>/session-*`，载体位于 `dist/<target>`。停止相关任务后用 `pnpm run clean` 清理声明输出。各项目指定自己的输出目录，工程工具按项目边界执行清理。

<a id="verification"></a>

## 检查与运行环境

六个公共包共用 `@kisaki3/config/vite/library`。从根运行 `pnpm exec vp run --filter "./clients/desktop/packages/*" pack` 生成各包的 `out/package/package.tgz`。同一选择器配合 `check:package` 检查归档，配合 `test:consumers` 安装并运行仓库外的消费者。RPC 与 UI 的消费者还需要桌面工程的 `prepare:electron`。

用例、固定样例和报告分别归各包的 `tests/consumers`、`tests/consumers/fixtures` 和 `test-results/consumers`。该验证独立于普通 check，由桌面 CI 的 Linux x64 目标执行。普通 CI 将影响分析选中的包传给实际消费者任务；完整检查入口执行全部公共包。

每个库用自己的 `vite.config.ts` 声明公开子路径与源文件，共享配置据此选择编译入口并生成开发与发布 exports。pnpm 打包时采用 `publishConfig.exports`。运行依赖按 workspace 清单准备传递依赖的 tarball，安装使用这些归档的绝对路径。

按[共同原则](../design/engineering/conventions.md#quality)、[可读性](../design/engineering/conventions.md#readability-principle)和[实际影响](../verification/acceptance.md#verification-scope)选择验证。普通检查不包含真实桌面、制品或性能采样。

| 命令                            | 输入与运行环境                                                               |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm check`                    | 全仓类型、lint、格式及常规 Node 测试                                         |
| `pnpm exec vp run @kisaki3/desktop#test:native`      | 先准备公共依赖、原生与资源输出，由 Electron Node 模式执行 schema、codec、迁移、WAL 中断恢复、文件和归档验证 |
| `pnpm exec vp run @kisaki3/desktop-ui#test:browser` | 真实 Chromium 验证源码控件、表单、虚拟列表和浮层。 |
| `pnpm exec vp run @kisaki3/desktop#test:window-startup`         | 先构建，在隔离资料中验证四个 Electron 编译入口与进程隔离                     |
| `pnpm exec vp run @kisaki3/desktop#test:dev-session`         | 准备原生输出，在隔离源码副本中验证开发工作流与浏览器 HMR                     |
| `pnpm exec vp run @kisaki3/desktop#test:fixture-artifacts`   | 先构建并打包工程载体，保留 fuses，从外部观察启动与关闭                       |
| `pnpm exec vp run @kisaki3/desktop#test:performance` | 先构建，测量 20 次载体启动及完整存储负载，核对查询结果、worker 操作中位数与窗口 IPC P95 |

浏览器首次准备由所属工程执行：开发回归使用 `pnpm --filter @kisaki3/desktop exec playwright install chromium`，公共包消费者使用 `pnpm --filter <包名> exec playwright install chromium`。已建立的公共包使用同一锁定 Playwright 版本，可复用该版本的浏览器安装。

存储测量可单独运行 `pnpm exec vp run @kisaki3/desktop#test:performance storage.test.ts`。每条查询核对首读结果，预热 3 次后采样 31 次。短事务另采样 31 次。按操作分别计算中位数，上限为 100 ms。已知命中条目的零基位置以 `.position` 报告。动画排行按观看时长降序、同分按 ID 排列，分部数合计剧集和附加内容，缺少活动、分部或文件的动画保留零值。作业日志列出查询首读及各项中位数、P95 和最大值，`test-results/performance` 保存全部样本、输入与迁移摘要、SQLite 配置和执行计划。

同一负载期间，窗口到 main 的 IPC 往返按 P95 ≤ 100 ms 验收。主进程单次同步工作的定位要求见[性能预算](../design/engineering/performance.md#measurement)。

desktop-contracts 和 desktop-localization 的独立消费者同时安装所需公共依赖的实际 tarball，由 Vite Task 准备；尚未公开的依赖通过临时消费者的 pnpm-workspace.yaml 指向这些包，不使用源码别名。

Linux CI 还准备浏览器系统依赖、Xvfb、窗口管理器、wmctrl 与 AppImage 的 FUSE 条件。Electron Node 模式在启动测试前选定，测试内部不修改 ABI。

对已打包制品，运行 `pnpm exec vp run @kisaki3/desktop#test:artifacts`。设置 `KISAKI_ARTIFACT_RECEIPT` 指定收据，默认读取 `dist/<target>/artifacts.json`。用例核对归档摘要、包内构建身份、安全 fuses 和实际启停。Windows 使用窗口句柄，macOS 使用系统辅助功能，Linux X11 使用窗口管理器观察。

根 TypeScript 项目检查工具、配置和测试；桌面项目按 main、preload、renderer、utility process、shared、native、tools 和 tests 分环境检查。native 项目拥有 Node 绑定源码及生成声明，main 消费其实际入口。测试载体也遵守自己的实际运行环境。自有声明至少由一个 `skipLibCheck: false` 的实际项目完整检查，规则见[类型分工](../design/engineering/workspace.md#declaration-checks)。

两个私有工程包通过 exports 直接消费。`pnpm lint` 运行类型感知 Oxlint 及全仓依赖边界检查。`tools/boundaries.ts` 按真实包导出核对循环、未声明依赖、运行代码与测试归属。dependency-cruiser 18 自用的 TypeScript 6 解析依赖由 packageExtensions 限定，项目检查和公开声明统一使用锁定的 TypeScript 7.1。

`pnpm exec vp run --dry-run --json <包名>#<任务名>` 显示任务与依赖。增量类型信息归各包 `.cache/typescript`。

<a id="shared-tooling"></a>

## 共用工程包

`@kisaki3/config/typescript/` 下提供 `base.json`、`node.json`、`browser.json` 与 `solid.json`。工作区成员声明配置包依赖，各类型项目选择源码范围、公开依赖和宿主条件。Node 直接运行的工程源码采用 `NodeNext`，Vite 编译的模块按打包器规则解析。[类型检查分工](../design/engineering/workspace.md#declaration-checks)

根 vite.config.ts 维护 Oxlint 与 Oxfmt 的范围。独立样板在安装实际 tarball 后检查，公开声明由消费者按正式解析条件读取。

`@kisaki3/tooling` 的 `/cli`、`/errors`、`/output` 与 `/process` 分别处理 CLI 信号与退出状态、错误交付、所属输出清理和命令执行。调用方传入取消信号并等待所属资源结束。Windows 用 Node 启动器和 `@seydx/win-job` 持有本次命令的 Job Object，Unix 使用独立进程组。取消不吞掉独立错误。原始操作与清理同时失败时按此顺序保留两项错误。

`runPnpm` 使用 `npm_execpath` 指向的当前 pnpm，因此相关工具和测试通过 pnpm 项目脚本运行。普通外部命令由调用方明确提供可执行文件与参数。同时供导入和直接运行的工程脚本使用固定 Node 宿主的 [import.meta.main](https://nodejs.org/api/esm.html#importmetamain) 判断入口，经目录联接启动时同样有效。

库的 `build` 先校验自身生成源，再用 `vp pack` 生成 JavaScript、声明与所需样式。`pack` 调用 `pnpm pack --out out/package/package.tgz`，`check:package` 用 publint 和 ATTW 检查这份文件。`@kisaki3/tooling/testing/consumer` 在用例作用域内安装和清理独立工程。

<a id="ci"></a>

## CI 与交付

`ci.yml` 在安装依赖前用 `tools/ci/plan.ts` 比较基线和候选，选择 Linux 基础检查及所需宿主。模板、配置、SQL 和原生输入按实际使用者判断，删除和改名计入完整差异。共享 ABI 或缺少基线时覆盖六个宿主目标，手动运行可以指定目标与场景。局部复现可以执行相同的项目命令。

SQLite 名称排序的 Rust 实现、编译入口或锁定依赖变更时，六个目标验证原生接入，Linux x64 另行运行完整存储负载。

`Select checks` 读取改动并生成目标与任务。Linux x64 上的 `Workspace checks` 执行文档链接检查，代码改动还执行冻结安装和 `pnpm check`。每个 `Target checks (<目标>)` 作业将选中任务一次交给 Vite Task，按同一依赖图准备和复用程序与归档。计划摘要列出套件，日志带包名与任务名。

`Required checks` 汇总 PR、合并队列和主线的验证结果。仅编辑 PR 标题或正文时，CI 等候正在运行的验证，核对 PR 编号、源码提交、基线提交和候选文件树后沿用先前的结果。缺少匹配记录时重新验证。主线推送可复用同一候选的成功结果。手动选择场景的运行单独报告 `Requested checks`。

当前开发远端与正式接续情况见[实施状态](status.md)。仓库重建、npm、签署和部署按各自授权执行。未取得的平台、签名或后端运行结果保持未完成。
