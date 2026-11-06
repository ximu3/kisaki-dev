# 当前工程与开发

本篇说明当前源码职责、环境准备与可运行入口。目标布局见[仓库与源码布局](../design/engineering/layout.md)，完成度及验证结果见[实施状态](status.md)。正式项目文档由 [W23](work-packages.md#w23) 按对象形成。

按任务阅读：[源码职责](#source) · [准备与协作](#setup) · [构建与资源](#build) · [检查与运行](#verification) · [共用工程包](#shared-tooling) · [CI 与交付](#ci)。

<a id="source"></a>

## 当前源码职责

| 位置                                                     | 当前职责                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 根 `tools` 与 `tests/tools`                              | Git hooks、验证环境记录及所属工具的回归验证                                      |
| 根 `tests/workspace`                                     | 工程登记、类型检查覆盖、任务依赖与验证选择，以及跨工程导入边界                   |
| `packages/typescript-config`、`eslint-config`、`tooling` | 共用类型与 lint 配置、候选输出、命令执行、错误交付和 CLI 收尾                    |
| `clients/desktop/app/tools`                              | 桌面程序构建、资源准备、原生编译、开发会话、打包与输出清理                       |
| `clients/desktop/app/native`                             | Rust 文件同步与不覆盖移动，Node 加载、声明与错误转换                             |
| `clients/desktop/app/assets`                             | 锁定字体输入与许可、图标源稿                                                     |
| `clients/desktop/app/tests`                              | 工程用例、隔离载体，以及原生、Electron、开发、制品和性能验证                     |
| `clients/desktop/packages/desktop-appearance`            | 视觉词表、纯值解析、亮暗默认值、普通 CSS 与可选 Tailwind 映射                    |
| `clients/desktop/packages/extension-distribution`        | 身份、manifest、registry、本地化、兼容选版、不可变制品规则与 Node 签名           |
| `clients/desktop/packages/desktop-localization`          | 英语源文、关联消息类型、作者校验与纯格式化                                       |
| `clients/desktop/packages/desktop-contracts`             | 桌面接口、值约束、规范编码、查询与写入合同、参与接口、会话、管理、深链和开发控制 |
| `clients/desktop/packages/desktop-rpc`                   | 有限 JSON 帧、握手、双向调用与通知、按调用取消、安全失败和断连清理               |

桌面公共包通过构建后的公开入口交付 ESM、声明和各自资源。包内 `tests/consumers` 使用仓库外的独立工程核对同一 tarball，用例、样板、配置、依赖和报告分别由所属包维护。公开值和消费方式可从源码声明、消费者样板及 [W01](../verification/evidence/w01/README.md)、[W02](../verification/evidence/w02/README.md)、[W03](../verification/evidence/w03/README.md)、[W04](../verification/evidence/w04/README.md) 验证入口查阅。

desktop-rpc 从包根导出 `RpcConnection`、传输接口和帧合同。接入端绑定实际通道与身份，提供明确的方法表并解析业务值。等待 `ready` 后发起调用，按 `closed` 的结束原因释放所属资源。两个消费者分别通过 Node JSON IPC 和沙箱 Electron 窗口的 MessagePort 运行。Linux 执行消费者套件需要图形会话，CI 使用 Xvfb。

desktop-contracts 按业务子路径导出显式接口、值校验与规范编码。类型、校验和操作按主题就近维护，多文件公开入口位于主题目录内。纯单测随源码放置，真实消费者与其样板保留在所属包的 tests 中。本体业务实现按所属工作包建立。

desktop-localization 的英语 ICU 源文位于 src/en，按领域维护并由 index.ts 静态汇总；`pnpm --filter @kisaki3/desktop-localization run generate:messages` 更新 src/contracts.generated.ts。普通 build 校验消息声明与英语源文一致，再交接完整构建结果。`createTranslator(locale, catalog)` 创建独立格式化快照；有效语言、译本登记和响应式接入由后续本体工作包实现。生成源由生成器负责排版。

桌面 `tools/build` 接收明确的程序输入，完成整份候选后交接；`tools/resources`、`tools/native` 与 `tools/package` 分别拥有资源、原生编译和打包。跨工作流的路径、目标、运行清单和摘要归 `tools/lib`，跨工程机制归 `@kisaki3/tooling`。原生调用通过 `#native` 加载明确的绝对制品路径，失败保留原始原因。

`tests/fixtures/runtime` 验证四个 renderer/preload 入口、main、utility process、Solid 热更新及资源加载。运行必须提供测试拥有的绝对资料目录；窗口名称对应编译入口，本地消息供测试控制使用。产品窗口、公开通信和扩展宿主按所属工作包实现。

`tools/dev/session` 拥有服务、监听、候选和进程寿命，调用方提供源码根目录与启动能力。`renderer` 管理 Vite，`inputs` 管理输入监听，`generation` 编译 Node 程序，`dependencies` 准备完整依赖候选；采用新副本后刷新文档并释放旧副本。失败保留既有可用结果，正常退出可以取消，资源释放完成后结束会话。

<a id="setup"></a>

## 准备与协作

使用 `.node-version` 和根 `packageManager` 指定的 Node、pnpm。Rust 由 `clients/desktop/app/native/rust-toolchain.toml` 固定。Windows 需要 Visual Studio C++ 工具链，macOS 需要 Xcode Command Line Tools，Linux 需要对应系统构建工具。开发 Node 与 Electron 内置 Node 分开验证。

```sh
pnpm install --frozen-lockfile
pnpm install:hooks
```

hooks 显式安装。安装器管理仓库本地 `core.hooksPath` 和公共 Git 目录中的自有 Husky 文件，作用于本仓库全部 worktree。其他显式配置会报告冲突并保持原样；`pnpm uninstall:hooks` 只撤销项目仍持有的配置。CI 和源码压缩包跳过安装。

pre-commit 通过 lint-staged 执行 Prettier check 与 ESLint，不修复或重新暂存文件。文件清单按 4,000 字符分批，以适应 Windows 命令包装器；修复后自行审阅和暂存。提交消息使用 Conventional Commits，PR 描述遵守[写作规范](../design/engineering/documentation.md#pull-request-descriptions)。

合并前同步最新 main 并通过必需检查。主线保护同样约束管理员，只允许 Squash，合并后删除远端分支。完整规则见[协作合同](../design/engineering/workspace.md#collaboration)。

验证证据中的原始材料保留字节和来源；Git 不转换这些文件的换行。普通源码采用 LF。材料按[实际用途](../design/engineering/documentation.md#evidence)维护。

<a id="build"></a>

## 工程构建与资源

当前可执行入口验证桌面工程能力。程序输入位于 `clients/desktop/app/tests/fixtures/runtime`，每次运行使用测试拥有的隔离资料；完整产品合同和实施进度分别见 [refactor](../README.md) 与[状态页](status.md)。

```sh
pnpm desktop:build:fixture --target windows-x64
pnpm desktop:package:fixture --target windows-x64
```

目标必须匹配实际 runner。构建先准备资源和原生绑定，再通过 Vite 编译各程序；完整候选成功后才替换输出，失败或采用前取消保留旧结果。资源准备可独立执行 `pnpm --filter @kisaki3/desktop prepare:resources --target windows-x64`。

资源工作流从锁定依赖准备字体与 SQLite 绑定，从唯一图标源稿生成 PNG／ICO，记录最终资源摘要。`assets/fonts/inputs.json` 选择字体文件和许可，包版本与来源完整性由 pnpm 锁文件约束。

字体输入为 Fontsource 的 Noto Sans SC Variable 与 Noto Sans Mono Variable，按原始字节和名称装配，并保留 LICENSE、CSS 与 metadata。`assets/icons/source.png` 为项目作者的原创图标源稿。字体与图像的许可归属见[项目许可](../design/engineering/licensing.md#third-party)及[原创图像](../design/engineering/licensing.md#brand)。

`buildId` 来自 Turbo 的桌面 build:fixture 任务，覆盖实际输入、依赖、工具链和声明的环境变量；SHA-256 核对完成的运行字节。打包检查既有 `build.json` 的目标、输入身份、完整文件集合和摘要。根 `desktop:package:fixture` 通过 Turbo 准备资源、原生绑定和工程载体。包内脚本执行各自的叶操作；需要准备依赖时使用根入口或 Turbo。

工程载体打包固定标记 `testOnly`，构建和打包均不发布。正式签署、安装升级及发行接入由 W20 验收。

`pnpm --filter @kisaki3/desktop build:fixture --program preload` 单独验证 preload 编译。`build:native` 编译私有绑定；需要更新生成声明时显式添加 `--update-declarations` 并审阅变化。`check:native` 执行固定 Rust 工具链的格式与 Clippy 检查。

开发监听由 `tools/dev/session` 通过明确的输入和启动回调提供，真实回归在隔离 workspace 内执行。测试临时创建合成依赖，验证构建失败、完整快照交接、HMR、正常退出取消和清理；测试载体的消息不定义产品开发协议。

同一工作副本中，共享输出的构建、运行与打包顺序执行。任务内依赖和合法并行由 Turbo 管理。有限输出位于 `out/<target>`，开发会话位于 `out/development/<target>/session-*`，载体位于 `dist/<target>`。停止相关任务后用 `pnpm run clean` 清理声明输出；资料目录和下载缓存不在其范围内。

<a id="verification"></a>

## 检查与运行环境

桌面公共包各自提供 build、pack、check:package、test:consumers 及常规检查。`pnpm desktop:packages:pack` 构建并生成各包的 `out/package/package.tgz`；`pnpm desktop:packages:check` 检查这些实际 tarball。`pnpm desktop:test:consumers` 通过 Turbo 调度各包的消费者任务，自动接续构建、一次打包、制品检查和仓库外消费。用例、固定样例和报告分别归各包的 `tests/consumers`、`tests/fixtures/consumers` 和 `test-results/consumers`。该验证独立于普通 check，由桌面 CI 的 Linux x64 目标执行。

pack 的输入由已声明的 build 依赖，以及包元数据、许可和发行说明组成。公共依赖的产品变化会接续下游消费者验证；测试样板和测试配置仍只影响其所属消费者，不成为下游制品输入。

按[共同原则](../design/engineering/conventions.md#quality)、[可读性](../design/engineering/conventions.md#readability-principle)和[实际影响](../verification/acceptance.md#verification-scope)选择验证。普通检查不包含真实桌面、制品或性能采样。

| 命令                            | 输入与运行环境                                                               |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm check`                    | 全仓类型、lint、格式及常规 Node 测试                                         |
| `pnpm desktop:test:native`      | 先准备原生与资源输出，由开发 Electron 的 Node 模式执行 SQLite 与原生文件测试 |
| `pnpm desktop:test:e2e`         | 先构建，在隔离资料中验证四个 Electron 编译入口与进程隔离                     |
| `pnpm desktop:test:dev`         | 准备原生输出，在隔离源码副本中验证开发工作流与浏览器 HMR                     |
| `pnpm desktop:test:artifacts`   | 先构建并打包工程载体，保留 fuses，从外部观察启动与关闭                       |
| `pnpm desktop:test:performance` | 先构建，记录 20 次工程载体启动耗时与内存，验证进程退出                       |

浏览器首次准备由所属工程执行：开发回归使用 `pnpm --filter @kisaki3/desktop exec playwright install chromium`，公共包消费者使用 `pnpm --filter <包名> exec playwright install chromium`。四个已建立公共包使用同一锁定 Playwright 版本，可复用该版本的浏览器安装。desktop-contracts 和 desktop-localization 的独立消费者同时安装所需公共依赖的实际 tarball，由自身 Turbo 任务准备；尚未公开的依赖通过临时消费者的 pnpm-workspace.yaml 指向这些包，不使用源码别名。Linux CI 还准备浏览器系统依赖、Xvfb、窗口管理器、wmctrl 与 AppImage 的 FUSE 条件。Electron Node 模式在启动测试前选定，测试内部不修改 ABI。

制品输入用 `KISAKI_ARTIFACT_RECEIPT` 指定，默认 `dist/<target>/artifacts.json`。Windows 使用窗口句柄，macOS 使用已获准的系统辅助功能，Linux X11 使用窗口管理器观察。X11 结果不代表 Wayland 验收。

根 TypeScript 项目检查工具、配置和测试；桌面项目按 main、preload、renderer、utility process、shared、tools 和 tests 分环境检查。测试载体也遵守自己的实际运行环境。自有声明至少由一个 `skipLibCheck: false` 的实际项目完整检查，规则见[类型分工](../design/engineering/workspace.md#declaration-checks)。

三个私有工程包直接通过 exports 加载，不预构建。工程函数用 `@kisaki3/tooling/cli`、`/errors`、`/output`、`/process`，类型与 lint 使用各自共享包。项目声明自己的依赖、配置与检查任务，类型感知 lint 沿 TypeScript Project Service 使用所属项目。`pnpm lint:fix` 完成后须审阅修改。

依赖检查核对循环、无法解析或未声明的包，以及原生运行代码、工程工具和测试之间的边界。祖先目录能解析一个包不代表导入者已经声明它。`#native` 由桌面 package.json 的 imports 定义，不复制到根 paths。

Vitest 转换缓存归各项目的 `node_modules/.vitest-cache`。TypeScript 增量信息归 `.cache/typescript`。脚本调用所属运行器；只读任务计划可用 `pnpm exec turbo run <task> --filter=<project> --dry=json` 查看。

<a id="shared-tooling"></a>

## 共用工程包

`@kisaki3/typescript-config` 提供 `base.json`、`node.json`、`browser.json` 与 `solid.json`。消费者声明 workspace devDependency，由自己的 tsconfig 选择源码范围、项目引用和必要的环境差异；纯环境不引入 Node、DOM 或测试 globals。声明检查分工见[类型检查规则](../design/engineering/workspace.md#declaration-checks)。

`@kisaki3/eslint-config/base` 提供共同规则与输出忽略范围，`/node` 限定 Node 环境，`/tests` 接受 Playwright 所需的空参数对象。消费者声明 ESLint、jiti 与本包，并以 `import.meta.dirname` 绑定 `parserOptions.tsconfigRootDir`。TypeScript Project Service 沿各文件的实际项目与 references 检查；根 lint 任务先通过 Turbo 准备依赖包声明，直接调用 ESLint 使用已准备的输出。

`@kisaki3/tooling` 的 `/cli`、`/errors`、`/output` 与 `/process` 分别处理 CLI 信号与退出状态、错误交付、候选输出和命令执行。调用方传入取消信号并等待所属资源结束；终止请求失败时立即输出诊断，继续等实际进程和输出流关闭后报告错误。原始操作与清理同时失败时按此顺序保留两项错误。

`runPnpm` 与 `readPnpm` 使用 `npm_execpath` 指向的当前 pnpm，因此相关工具和测试通过 pnpm 项目脚本运行。普通外部命令由调用方明确提供可执行文件与参数。同时供导入和直接运行的工程脚本使用固定 Node 宿主的 [import.meta.main](https://nodejs.org/download/release/v24.11.1/docs/api/esm.html#importmetamain) 判断入口，经目录联接启动时同样有效。

`kisaki-package pack` 成功后替换 `out/package/package.tgz`，`check` 对同一文件执行 publint 和 ATTW。任务顺序由 Turbo 拥有。命令入口在 Git 中保留可执行位，与 [pnpm 在 POSIX 上安装 bin 的方式](https://github.com/pnpm/pnpm/blob/v11.11.0/pnpm11/bins/linker/src/index.ts#L367-L368)一致，安装依赖不会因此把工程工具标记为已修改。

<a id="ci"></a>

## CI 与交付

`ci.yml` 接收 PR 与手动入口，`verification.yml` 协调仓库和桌面工作流，`pr-title.yml` 单独检查标题。任务 inputs 与真实依赖图决定验证范围；文档和单个测试变化不自动扩大到全部桌面验收。选中的原生、桌面与工程进程检查覆盖 Windows、macOS、Linux 的 x64 和 arm64。

每个桌面目标在同一 runner 中准备环境，在一次 Turbo 调度中执行所选任务及其前置依赖；CI 串行执行这些任务，同一生产任务只运行一次。开发检查复用原生编译输出，并在隔离副本中验证。性能采样只在明确要求时运行，不进入普通 CI。

所有工程用 selected／verified 表达选择与完成；Required checks 区分有依据的未选择与应执行但未完成。基线缺失、全局工具链变化或手动完整入口执行全部适用检查；选择失败使检查失败。普通 PR 只有读取权限。

Node 由官方 setup Action 准备，pnpm 官方 Action 读取 packageManager 并管理依赖存储缓存。Turbo 缓存按工程、系统、架构和 Node 分组，fork PR 只读取缓存。反馈目标及口径见[工程工作区合同](../design/engineering/workspace.md#ci-feedback)。

当前开发远端与正式接续情况见[实施状态](status.md)。仓库重建、npm、签署和部署按各自授权执行。未取得的平台、签名或后端运行结果保持未完成。
