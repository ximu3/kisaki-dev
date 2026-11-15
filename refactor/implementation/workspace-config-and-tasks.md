# 工作区配置与任务重构

本轮以 `0c0f363` 为比较基线。根清单负责全仓操作，工作区成员拥有自己的命令和前置产物。当前可运行入口见[开发说明](development.md)，工作包进度见[实施状态](status.md)。[全项目工程现代化方案](engineering-modernization.md) · [基线 CI](https://github.com/ximu3/kisaki-dev/actions/runs/43602308370)

<a id="naming"></a>

## 配置包与 Vite 入口的名称

**`@kisaki3/config` 提供工程配置，`@kisaki3/tooling` 提供工程操作。** 两个包都按交付的职责命名。`config` 提供工程工具读取的配置，`tooling` 提供工程流程调用的函数，如进程执行、取消和测试安装。两者都是私有 workspace 包，由各自的 `exports` 列出支持的入口。[命名与限定词](../design/engineering/conventions.md#naming-scope) · [包导入规则](../design/engineering/conventions.md#module-imports)

| 候选 | 在实际使用位置如何理解 |
| --- | --- |
| `project-config` 或 `config` | `project-config` 单独出现时能提示“工程配置”。实际使用方会写 `@kisaki3/config/typescript/node.json` 或 `@kisaki3/config/vite/library`，工具与用途已经清楚。`packages/config` 也与 `packages/tooling` 一样直接表达职责。`project` 在这两处都没有进一步区分消费者。 |
| `desktop-library.ts` 或 `library.ts` | `library` 对应 Vite 的库构建术语。这里交付的是有公开入口、类型声明和仓库外消费者的 ESM 库；当前六库的位置是 `clients/desktop/packages/`。UI 的 Solid 编译与样式、RPC 和 UI 消费测试需要的 Electron 准备，由相应包在自己的 `vite.config.ts` 声明。如果共享入口本身负责选择 Electron 宿主或桌面目标，`desktop-library` 才能提示这一前提。[Vite 库模式](https://vite.dev/guide/build#library-mode) · [Vite+ pack](https://viteplus.dev/guide/pack) |
| `package.ts` 或 `library.ts` | `package` 在本仓也指桌面应用的打包操作、npm 归档和 workspace 成员。`vite/library` 能在导入处直接表明采用库的构建与验证规则。 |

配置包位于 `packages/config/`。`typescript/` 下保留 `base.json`、`node.json`、`browser.json`、`solid.json` 四个预设，`vite/` 下提供 `library.ts`。包的目录和包名对应，子路径按工具与用途组织。根 `config/typescript/` 继续放根工具、配置和测试自己的 TypeScript 项目文件。每个公共包的 `vite.config.ts` 仍是 Vite 发现的入口，按需显式导入共享模块。[Vite 配置发现](https://vite.dev/config/) · [TypeScript extends](https://www.typescriptlang.org/tsconfig/extends.html)

<a id="shared-config"></a>

## 共享配置的边界

基线有 9 个工程声明 TypeScript 配置依赖，38 份 tsconfig 直接按包名继承预设。六个库的共享构建、声明、制品检查和测试配置归 `vite/library.ts`，包自己的入口和差异归其 vite.config.ts。类型基线已是稳定的具名依赖，库配置也有明确且较窄的消费范围。[类型预设](../../packages/config/package.json) · [RPC 配置](../../clients/desktop/packages/desktop-rpc/vite.config.ts) · [UI 配置](../../clients/desktop/packages/desktop-ui/vite.config.ts)

| 组织 | 在 Kisaki 的取舍 |
| --- | --- |
| 两类配置都用仓内文件 | 根 `config/typescript/` 和桌面 `config/vite/` 可分别承载共同配置，少维护一个包。38 个具名继承位置要改用相对路径。筛选检出和缓存需包含包目录外的输入。 |
| TypeScript 成包，Vite 配置放桌面目录 | `clients/desktop/config/vite/library.ts` 清楚标出当前六个消费者的归属。移动包目录时需调整相对导入；共享模块使用的工具依赖由根工程声明。 |
| 各工具分别成包 | 两套配置可独立安装、演进和交付。如果类型预设有独立使用者，或仅使用 JSON 的工程开始承担明显的 Vite 安装成本，拆包有具体收益。当前会多维护一份清单和六库的依赖声明。 |
| 一个私有配置包，按工具导出（已选） | 沿用一个配置包，消费者用 `workspace:*` 声明开发依赖，用具名子路径选取预设。代价是两类配置共用依赖清单。缓存与 CI 范围按实际变更的子入口核对。 |

上游维护者采用了不同布局。Turborepo 示例按包名继承私有 TypeScript 配置；Vitest 自身通过相对路径继承根配置，也从仓库脚本导入构建辅助。Vite+ 支持普通模块导入，同时建议由根配置拥有全仓 lint 与格式规则。文件数量不能单独决定是否建包，实际收益来自可声明的依赖、稳定的入口或独立的交付责任。[Turborepo 示例](https://github.com/vercel/turborepo/blob/ef00d80db2f08d610582dbcd592064c2c4247d45/examples/basic/apps/web/tsconfig.json) · [Vitest 类型配置](https://github.com/vitest-dev/vitest/blob/cab34bb0ee23f00676ea895560c8b16399ce40b7/packages/vitest/tsconfig.json) · [Vitest 构建配置](https://github.com/vitest-dev/vitest/blob/cab34bb0ee23f00676ea895560c8b16399ce40b7/packages/vitest/rollup.config.js#L12) · [Vite+ monorepo 指南](https://viteplus.dev/guide/monorepo)

隔离样板使用锁定的 Node 26.13.1、pnpm 12.18.0、Vite+ 1.6.0 和 TypeScript 7.1.0-beta。相对文件和私有包子路径均通过冻结安装、`tsc --showConfig`、`tsc -p`、Vite Task 计划解析、`vp pack` 和 Node ESM 加载。共享配置包声明其直接加载的工具，各包声明在本包使用的插件与验证命令。独立仓库及仓库外的消费者按各自公开依赖运行。

### 配置默认值与覆盖

本轮按[共用配置规范](../design/engineering/conventions.md#configuration-layout)核对编译器、包管理器、构建、测试、格式与 CI 的有效选项。Vitest 5.1 的默认环境是 Node，全局测试 API 默认关闭，沿用这些行为的套件省略 `environment: 'node'` 和 `globals: false`。Vite Task 默认缓存配置文件中声明的任务。要求每次实际启动 Electron 的任务保留 `cache: false`。[Vitest 环境](https://vitest.dev/config/environment) · [Vitest 全局 API](https://vitest.dev/config/globals) · [Vite Task 缓存](https://viteplus.dev/config/run#cache)

### 按加载方式选择模块导入

Node 原生 ESM 直接执行 TypeScript 时，相对导入写实际文件名，如 `./errors.ts`、`./process/index.ts`。这条规则覆盖入口及其直接加载的源码依赖。根 CI 脚本也由 Node 直接启动，目前只导入 `node:` 模块。跨包使用清单声明的子路径，如 `@kisaki3/tooling/process`，由 `exports` 映射到实际文件。[Node TypeScript 支持](https://nodejs.org/api/typescript.html#determining-module-system) · [Node ESM 相对路径](https://nodejs.org/api/esm.html#mandatory-file-extensions) · [CI 入口](../../.github/workflows/ci.yml)

共享类型基线沿用锁定编译器的严格默认值，显式指定 ES2023 输出目标和 ESNext 模块。TypeScript 7.1 Beta 在该目标下省略 module 会使带 JSON 导入属性的桌面代码报 TS2823，指定 ESNext 后通过。Vite 项目由 ESNext 推导 Bundler 解析；Node 直接执行的工程源码设 `module: "NodeNext"`，由编译器选择匹配的解析方式。允许导入 .ts 的设置覆盖直接加载的文件及引用其源码的检查项目。[共享基线](../../packages/config/typescript/base.json) · [TypeScript 模块选项](https://www.typescriptlang.org/docs/handbook/modules/reference.html)

Vite 项目的导出条件按实际构建入口选择。即使编译产物最终运行在 Electron main，仍由 Vite 解析构建时的源码导入。同一文件也由 Node 直接加载时，采用完整相对路径。公共库的最终声明用其承诺支持的消费方式分别检查，先由 `tsc` 输出 ESM 再交给 Node 的 RPC 样板使用 `./ipc.js`。[桌面载体](../../clients/desktop/app/tests/fixtures/desktop-app/src/main/entry.ts) · [RPC 消费者](../../clients/desktop/packages/desktop-rpc/tests/consumers/fixtures/node/parent.ts)

全仓采用 `NodeNext` 的代价还涉及条件导出。在 TypeScript 7.1 Beta 的隔离样板中，依赖按 `node`、`browser` 的顺序导出两套不同声明。`NodeNext` 命中 `node`，即使追加 `browser` 条件也如此；`Bundler` 配合客户端的 `browser` 条件命中浏览器声明。给相对导入补齐后缀无法消除这项差异。[TypeScript 的条件解析](https://www.typescriptlang.org/docs/handbook/modules/reference.html#module-resolution) · [Vite 客户端默认条件](https://vite.dev/config/shared-options#resolve-conditions)

<a id="workspace-commands"></a>

## 命令、测试与制品交接

| 归属 | 设计与理由 |
| --- | --- |
| 根与成员命令 | 根清单保留 `build`、`typecheck`、`lint`、`test`、`check`、`clean`。根 `test` 运行仓库用例并汇总成员的常规 `test`。单包按 `<包名>#<任务>` 选择，六包打包用 `pnpm exec vp run --filter "./clients/desktop/packages/*" pack`。清单按生成与准备、构建与打包、检查与测试、维护排列；格式和 hooks 直接使用 Vite+ 命令。[Vite Task](https://viteplus.dev/guide/run) |
| 类型检查与 CI | 干净安装后，基线分别运行 `typecheck`、`lint`、`test` 会因上游公共导出缺失而失败，完整 `check` 的预先构建遮住了这一依赖。让实际读取者声明前置构建。同一 Linux x64 作业曾执行 5 次原生构建、5 次资源准备并生成 3 个桌面 build ID。选择器为每台 runner 提供具名任务，一次 `vp run ci:target` 执行其完整依赖图，共用前置产物与完成清单。[基线脚本](../../package.json) · [Linux x64 运行](https://github.com/ximu3/kisaki-dev/actions/runs/43602308370/job/132469559531) |
| 库构建与独立消费 | `build` 生成 ESM、声明与样式，`pack` 交付 tarball，`check:package` 用 publint 和 ATTW 检查这份归档。从各包维护的同一份入口声明生成 `kisaki-source` 与 `publishConfig.exports`；pnpm 从发布映射生成真实 tarball。固定版本、引擎和 peer 策略归 `pnpm-workspace.yaml`。消费者按 workspace 运行依赖取得实际归档，包自己维护样板和断言。[tsdown 开发导出](https://tsdown.dev/options/package-exports#development-exports) · [pnpm 发布清单](https://pnpm.io/package_json#publishconfig) · [pnpm hooks](https://pnpm.io/pnpmfile) · [pnpm 设置](https://pnpm.io/settings) |
| 测试项目与宿主 | 常规 Node、真实开发会话和制品测试由命名 Vitest 项目选择各自的用例与前置输入。原生集成在启动运行器前选定 Electron Node。main、preload、renderer 和 extension-host 的独立构建配置表达各自的加载合同。[Vitest 项目](https://vitest.dev/guide/projects) · [桌面程序构建](../../clients/desktop/app/tools/build/programs.ts) |
| 工程工具与清理 | `@kisaki3/tooling` 保留实际共用的 CLI 信号、进程树回收、错误交付和消费者安装。Tailwind 写入消费者 CSS 后由 Vite 继续构建，工具命令直接继承诊断输出。`clean` 清理项目声明的输出，额外路径在删除前报错；复用有此约束的输出模块，省去单行转发文件。Unix 直接执行的 Node `bin` 通过 shebang 选择解释器，由 `node` 或 `vpx` 加载的脚本已由命令选定解释器。[命令执行](../../packages/tooling/src/process/index.ts) · [清理边界](../../packages/tooling/src/output.ts) · [npm bin](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bin) |

Windows ZIP 制品验收直接调用系统 `tar.exe`。Git Bash 的 GNU tar 曾把盘符当作远端主机，选择 `System32` 下支持 ZIP 的 bsdtar 使两种 Windows 架构都能解包同一份制品。该依赖归制品测试。[制品工作区](../../clients/desktop/app/tests/artifacts/workspace.ts) · [Windows tar](https://learn.microsoft.com/en-us/windows/tar/)

### CI 名称与目标范围

`Select checks` 根据完整改动选择任务，`Workspace checks` 负责工作区检查，每个 `Target checks (<目标>)` 对应一个系统和架构。`Required checks` 汇总结果。范围和原因写入计划摘要，目标日志按实际包与任务标注。`window-startup` 验证四个窗口的启动，`dev-session` 验证开发会话，`fixture-artifacts` 运行工程载体制品。`tooling` 执行整个私有工具包的常规用例。现行 main 保护名切换前仍由独立作业转交同一结论。[代码验证](../../.github/workflows/ci.yml)

普通 Markdown 由仓库文档检查覆盖。`tools/check-doc-links.ts` 自身属于代码改动，进入工作区检查。两者都无需平台专项。共享运行输入匹配不到所属范围时，选择兼容检查。[选择规则](../../tools/ci/plan.ts) · [范围用例](../../tests/workspace/ci.test.ts)

### 消费者测试的准备模块

消费者用例将准备模块按[文件与目录规范](../design/engineering/conventions.md#source-layout)归到对应套件。

- desktop-appearance、desktop-contracts、desktop-localization 和 extension-distribution 使用 `installation.ts`。模块为 Node 或浏览器用例准备从实际 tarball 安装的工程，合同包还在安装目录生成公开声明的导入文件。
- desktop-ui 使用 `environment.ts`。浏览器和 Electron 用例从这里取得所需的安装目录、预览服务、页面或结果目录。
- desktop-rpc 将 `prepareConsumer` 就近放入 `transports.test.ts`。Node 和 Electron 两个用例都在这个文件内调用它，分别安装、编译并检查各自的传输样板。

<a id="tool-tests"></a>

## 开发工具测试的归属

**保留 `tests/tools/<工作流>/`，同一开发会话的两组用例都归 `tests/tools/dev/`。** 目录回答“修改哪项行为时应一起阅读这些用例”。运行命令回答“验证它需要启动什么、准备哪些输入”。例如 `tests/tools/build` 用实际 Vite 编译检查 preload 构建规则，`tests/integration/electron` 检查窗口、沙箱 preload 和 utility process 的接入，`tests/artifacts` 从交付归档观察 fuses 与外部启停。三者各有自己的验收对象。[测试布局](../design/engineering/layout.md#tests) · [preload 构建](../../clients/desktop/app/tests/tools/build/preload.test.ts) · [窗口接入](../../clients/desktop/app/tests/integration/electron/window-startup.test.ts)

`cancellation.test.ts` 直接调用 `startDevelopmentSession`，核对启动取消，以及停止期间发生的准备错误能否传给调用方。`session.test.ts` 通过控制器启动 worker，worker 调用同一函数，四个场景覆盖编译失败恢复、renderer 热更新、拒绝退出和停止失败。这些用例共同说明一次开发会话何时能采用新程序、何时能释放旧进程和目录。两个文件保留各自的设置和断言，`application.ts`、`controller.ts`、`worker.ts` 和 `workspace.ts` 继续随套件放置。输入监听用例随开发会话归入 `tests/tools/dev/inputs.test.ts`。[取消用例](../../clients/desktop/app/tests/tools/dev/cancellation.test.ts) · [真实会话用例](../../clients/desktop/app/tests/tools/dev/session.test.ts) · [worker 调用入口](../../clients/desktop/app/tests/tools/dev/worker.ts) · [输入监听用例](../../clients/desktop/app/tests/tools/dev/inputs.test.ts)

运行选择留在桌面应用自己的 `vite.config.ts`。常规 `test` 包含输入监听、取消及其他快速工具用例，`test:dev-session` 准备真实宿主并选择 `tests/tools/dev/session.test.ts`。两个命名项目复用同一份真实会话文件清单，作为开发专项的 `include` 和常规项目追加的 `exclude`，并保留 Vitest 的默认排除项。在基线文件布局上用临时项目配置和 `vp test list --filesOnly` 实测，常规项目选中 4 个文件，开发专项只选中 `session.test.ts`，与当前两个运行入口的清单一致。[Vitest 项目选择](https://vitest.dev/guide/projects) · [include](https://vitest.dev/config/include) · [exclude](https://vitest.dev/config/exclude)

<a id="electron-test-inputs"></a>

## 桌面产品入口与工程测试输入

基线的窗口、制品和性能任务启动 `tests/fixtures/desktop-app/` 构建的程序。W00 用它验证编译、进程和打包工作流。W06 用同一载体在已打包的 Electron 中加载正式数据库 worker、原生绑定和迁移。载体窗口显示测试计数器，启动采样记录这份固定负载的耗时。正式应用的启动、窗口接入和资料寿命归 W07。[当前任务输入](../../clients/desktop/app/vite.config.ts) · [W06 制品记录](../verification/evidence/w06/README.md) · [W07 交付范围](work-packages.md#w07)

`test:artifacts` 直接验证指定收据及归档，只准备开发 Electron 以核对宿主。需要从源码构建工程载体时使用 `test:fixture-artifacts`，其前置打包和其他套件共用同一份构建。基线将两种操作放在同一个任务里，重新打包会清理默认收据所在的输出目录。[任务依赖](../../clients/desktop/app/vite.config.ts) · [制品用例](../../clients/desktop/app/tests/artifacts/desktop.test.ts)

样板的存储检查观察部署后的 worker 能否打开库、返回实际的偏好记录、采用语言并关闭。翻译偏好初值的具体字段由数据库集成用例验证。这样既保留对 worker 漏回记录的检查，也使产品默认值的变化只影响负责它的用例。[样板的存储接入](../../clients/desktop/app/tests/fixtures/desktop-app/src/main/storage/index.ts) · [数据库初值用例](../../clients/desktop/app/tests/integration/database/storage.test.ts)

后续工作包按测试所要验证的对象选择程序入口。

- **桌面产品。** 正式入口归 `clients/desktop/app/src/`。窗口和产品启动性能用例运行这份源码的构建，制品用例从指定的真实应用候选启动并观察结果。制品验证保留从部署路径打开数据库、加载原生资源和执行迁移的覆盖。偏好初值归数据库集成用例，W06 查询负载与预算归存储性能套件。[构建与制品](../design/engineering/build.md#pipeline) · [数据库用例](../../clients/desktop/app/tests/integration/database/storage.test.ts) · [性能口径](../design/engineering/performance.md#measurement)
- **开发会话。** 建议由 `tests/tools/dev/fixtures/electron-app/` 拥有可编辑的小应用。计数器用来观察热更新后页面状态能否保留，故意写坏又修复模块用来观察进程交接，拒绝关闭用来观察旧进程和运行目录的寿命。这些场景持续验证开发工具，修改源码的用例各自使用副本。[开发会话用例](../../clients/desktop/app/tests/tools/dev/session.test.ts)
- **构建规则。** 包入口解析用例保留有意让 Node 与浏览器导出不同值的最小依赖，用正式程序的构建配置编译它。preload 配置重载用例自己创建和修改所需的配置与入口。两者都能直接观察目标规则，无须维护完整的窗口应用。[包入口解析](../../clients/desktop/app/tests/tools/build/programs.test.ts) · [preload 配置重载](../../clients/desktop/app/tests/tools/build/preload.test.ts)

W07 交付时，分别从隔离的源码会话和指定的打包候选核对窗口、存储与退出，再退役已由这些用例接替的工程载体入口和任务依赖。开发会话样板直接按上述职责归位。W20 使用真实发行候选验证安装与更新。工程载体的历史记录保留其原有输入和测量口径。[实施状态](status.md) · [W20 制品验收](work-packages.md#w20)

<a id="migration-acceptance"></a>

## 实施验收

三个独立新检出在 Node 26.13.1、pnpm 12.18.0 上各自冻结安装，分别从原始源码直接运行 `typecheck`、`lint` 和 `test`。38 个直接继承预设的类型项目核对了实际选项及文件范围。共享库配置单独变化时，六个库的构建都从缓存命中变为重新执行。类型感知 lint 从根配置启用，独立探针确认能检出未等待的 Promise。

六份实际 tarball 对照基线保留 76 个公开子路径，各入口的条件顺序和目标文件一致。Windows x64 的完整目标作业在同一依赖图内完成原生、窗口、开发会话、浏览器、仓库外消费、制品和性能验证。原生编译、资源准备、桌面构建各执行一次。独立制品验收使用已有 ZIP，从包内核对构建 ID 后实际启动和关闭，验收前后的收据与 ZIP 摘要一致。

当前候选的六目标运行见 [PR #39 的检查](https://github.com/ximu3/kisaki-dev/pull/39/checks)。主线切换到 7.1.x 正式版的进度见[实施状态](status.md)。桌面产品入口由[W07](work-packages.md#w07)交付。
