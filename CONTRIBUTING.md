# 开发与验证

使用 `.node-version` 和根 `packageManager` 指定的 Node、pnpm。Rust 由 `clients/desktop/app/native/rust-toolchain.toml` 固定。Windows 需要 Visual Studio C++ 工具链，macOS 需要 Xcode Command Line Tools，Linux 需要对应系统构建工具。开发 Node 与 Electron 内置 Node 分开验证。

## 准备与协作

```sh
pnpm install --frozen-lockfile
pnpm install:hooks
```

hooks 显式安装。安装器管理仓库本地 `core.hooksPath` 和公共 Git 目录中的自有 Husky 文件，作用于本仓库全部 worktree。其他显式配置会报告冲突并保持原样；`pnpm uninstall:hooks` 只撤销项目仍持有的配置。CI 和源码压缩包跳过安装。

pre-commit 通过 lint-staged 执行 Prettier check 与 ESLint，不修复或重新暂存文件。文件清单按 4,000 字符分批，以适应 Windows 命令包装器；修复后自行审阅和暂存。提交消息使用 Conventional Commits，PR 描述遵守[写作规范](refactor/design/engineering/documentation.md#pull-request-descriptions)。

合并前同步最新 main 并通过必需检查。主线保护同样约束管理员，只允许 Squash，合并后删除远端分支。完整规则见[协作合同](refactor/design/engineering/workspace.md#collaboration)。

验证证据中的原始材料保留字节和来源；Git 不转换这些文件的换行。普通源码采用 LF。材料按[实际用途](refactor/design/engineering/documentation.md#evidence)维护。

## 工程构建

当前可执行入口验证桌面工程能力。程序输入位于 `clients/desktop/app/tests/fixtures/runtime`，每次运行使用测试拥有的隔离资料；完整产品合同和实施进度分别见 [refactor](refactor/README.md) 与[状态页](refactor/implementation/status.md)。

```sh
pnpm desktop:build:fixture --target windows-x64
pnpm desktop:package:fixture --target windows-x64
```

目标必须匹配实际 runner。构建先准备资源和原生绑定，再通过 Vite 编译各程序；完整候选成功后才替换输出，失败或采用前取消保留旧结果。资源准备可独立执行 `pnpm --filter @kisaki3/desktop prepare:resources --target windows-x64`。

资源工作流从锁定依赖准备字体与 SQLite 绑定，从唯一图标源稿生成 PNG／ICO，记录最终资源摘要。`assets/fonts/inputs.json` 选择字体文件和许可，包版本与来源完整性由 pnpm 锁文件约束。

`buildId` 来自 Turbo 的桌面 build:fixture 任务，覆盖实际输入、依赖、工具链和声明的环境变量；SHA-256 核对完成的运行字节。打包检查既有 `build.json` 的目标、输入身份、完整文件集合和摘要。根 `desktop:package:fixture` 通过 Turbo 准备资源、原生绑定和工程载体。包内脚本执行各自的叶操作；需要准备依赖时使用根入口或 Turbo。

工程载体打包固定标记 `testOnly`，构建和打包均不发布。正式签署、安装升级及发行接入由 W22 验收。

`pnpm --filter @kisaki3/desktop build:fixture --program preload` 单独验证 preload 编译。`build:native` 编译私有绑定；需要更新生成声明时显式添加 `--update-declarations` 并审阅变化。`check:native` 执行固定 Rust 工具链的格式与 Clippy 检查。

开发监听由 `tools/dev/session` 通过明确的输入和启动回调提供，真实回归在隔离 workspace 内执行。测试临时创建合成依赖，验证构建失败、完整快照交接、HMR、正常退出取消和清理；测试载体的消息不定义产品开发协议。

同一工作副本中，共享输出的构建、运行与打包顺序执行。任务内依赖和合法并行由 Turbo 管理。有限输出位于 `out/<target>`，开发会话位于 `out/development/<target>/session-*`，载体位于 `dist/<target>`。停止相关任务后用 `pnpm run clean` 清理声明输出；资料目录和下载缓存不在其范围内。

## 检查与运行环境

桌面公共包各自提供 build、pack、check:package、test:consumers 及常规检查。`pnpm desktop:packages:pack` 构建并生成各包的 `out/package/package.tgz`；`pnpm desktop:packages:check` 检查这些实际 tarball。`pnpm desktop:test:consumers` 通过 Turbo 调度各包的消费者任务，自动接续构建、一次打包、制品检查和仓库外消费。用例、固定样例和报告分别归各包的 `tests/consumers`、`tests/fixtures/consumers` 和 `test-results/consumers`。该验证独立于普通 check，由桌面 CI 的 Linux x64 目标执行。

按[共同原则](CONVENTIONS.md#quality)、[可读性](CONVENTIONS.md#readability-principle)和[实际影响](refactor/verification/acceptance.md#verification-scope)选择验证。普通检查不包含真实桌面、制品或性能采样。

| 命令                            | 输入与运行环境                                                               |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm check`                    | 全仓类型、lint、格式及常规 Node 测试                                         |
| `pnpm desktop:test:native`      | 先准备原生与资源输出，由开发 Electron 的 Node 模式执行 SQLite 与原生文件测试 |
| `pnpm desktop:test:e2e`         | 先构建，在隔离资料中验证四个 Electron 编译入口与进程隔离                     |
| `pnpm desktop:test:dev`         | 准备原生输出，在隔离源码副本中验证开发工作流与浏览器 HMR                     |
| `pnpm desktop:test:artifacts`   | 先构建并打包工程载体，保留 fuses，从外部观察启动与关闭                       |
| `pnpm desktop:test:performance` | 先构建，记录 20 次工程载体启动耗时与内存，验证进程退出                       |

浏览器首次准备由所属工程执行：开发回归使用 `pnpm --filter @kisaki3/desktop exec playwright install chromium`，视觉包消费者使用 `pnpm --filter @kisaki3/desktop-appearance exec playwright install chromium`。Linux CI 还准备浏览器系统依赖、Xvfb、窗口管理器、wmctrl 与 AppImage 的 FUSE 条件。Electron Node 模式在启动测试前选定，测试内部不修改 ABI。

制品输入用 `KISAKI_ARTIFACT_RECEIPT` 指定，默认 `dist/<target>/artifacts.json`。Windows 使用窗口句柄，macOS 使用已获准的系统辅助功能，Linux X11 使用窗口管理器观察。X11 结果不代表 Wayland 验收。

根 TypeScript 项目检查工具、配置和测试；桌面项目按 main、preload、renderer、utility process、shared、tools 和 tests 分环境检查。测试载体也遵守自己的实际运行环境。自有声明至少由一个 `skipLibCheck: false` 的实际项目完整检查，规则见[类型分工](refactor/design/engineering/workspace.md#declaration-checks)。

三个私有工程包直接通过 exports 加载，不预构建。工程函数用 `@kisaki3/tooling/cli`、`/errors`、`/output`、`/process`，类型与 lint 使用各自共享包。项目声明自己的依赖、配置与检查任务，类型感知 lint 沿 TypeScript Project Service 使用所属项目。`pnpm lint:fix` 完成后须审阅修改。

依赖检查核对循环、无法解析或未声明的包，以及原生运行代码、工程工具和测试之间的边界。祖先目录能解析一个包不代表导入者已经声明它。`#native` 由桌面 package.json 的 imports 定义，不复制到根 paths。

Vitest 转换缓存归各项目的 `node_modules/.vitest-cache`。TypeScript 增量信息归 `.cache/typescript`。脚本调用所属运行器；只读任务计划可用 `pnpm exec turbo run <task> --filter=<project> --dry=json` 查看。

## CI 与交付

`ci.yml` 接收 PR 与手动入口，`verification.yml` 协调仓库和桌面工作流，`pr-title.yml` 单独检查标题。任务 inputs 与真实依赖图决定验证范围；文档和单个测试变化不自动扩大到全部桌面验收。选中的原生、桌面与工程进程检查覆盖 Windows、macOS、Linux 的 x64 和 arm64。

每个桌面目标在同一 runner 中准备环境，在一次 Turbo 调度中执行所选任务及其前置依赖；CI 串行执行这些任务，同一生产任务只运行一次。开发检查复用原生编译输出，并在隔离副本中验证。性能采样只在明确要求时运行，不进入普通 CI。

所有工程用 selected／verified 表达选择与完成；Required checks 区分有依据的未选择与应执行但未完成。基线缺失、全局工具链变化或手动完整入口执行全部适用检查；选择失败使检查失败。普通 PR 只有读取权限。

Node 由官方 setup Action 准备，pnpm 官方 Action 读取 packageManager 并管理依赖存储缓存。Turbo 缓存按工程、系统、架构和 Node 分组，fork PR 只读取缓存。反馈目标及口径见[工程工作区合同](refactor/design/engineering/workspace.md#ci-feedback)。

当前开发远端与正式接续情况见[实施状态](refactor/implementation/status.md)。仓库重建、npm、签署和部署按各自授权执行。未取得的平台、签名或后端运行结果保持未完成。
