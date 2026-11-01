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

简洁优先。正常 build 只构建已实现项目的默认产物；当前桌面本体尚无产品入口，不用工程载体接管默认 build。桌面构建、资源和打包函数由 tools 拥有，最小运行样本位于 tests/fixtures/runtime，仅供工具集成测试使用。

根命令通过 Turbo 准备实际依赖。原生测试只准备原生绑定和资源；Electron 与打包工具测试共用一次 prepare:test-runtime 输出。该准备任务不形成另一种产品，打包测试调用正常打包器并检查同一份输出。正式产品验收由所属工作包消费真实构建和制品。

资源工作流从锁定依赖准备字体与 SQLite 绑定，从唯一图标源稿生成 PNG／ICO，记录逐文件摘要。字体输入由 assets/fonts/inputs.json 和 pnpm 锁文件约束。buildId 读取 Turbo 的 runtime-inputs 输入节点；它只描述文件、依赖和环境，不执行构建。打包另行核对目标、完整文件集合和 SHA-256。

build:native 编译私有绑定；显式添加 --update-declarations 后审阅声明变化。prepare:resources 独立准备资源，check:native 运行固定 Rust 工具链的格式与 Clippy 检查。工程样本的 testOnly 标记只表示用途；macOS 未签名由独立的显式选项选择，不能作为签名验收证据。

同一工作副本中共享输出的写入由任务依赖串联。有限运行输出位于 out/<target>，开发会话位于 out/development/<target>/session-*，打包结果位于 dist/<target>。停止相关任务后用 pnpm run clean 清理声明输出；资料目录和缓存不在其范围内。

## 检查与运行环境

桌面公共包各自提供 build、typecheck、lint、test 与 check:package。`pnpm desktop:packages:pack` 构建、检查并打包到 `artifacts/desktop/packages`，收据保存每份 tarball 的 SHA-256；`pnpm desktop:test:consumers` 通过同一打包前置取得本次制品，再安装到仓库外临时项目，执行完整声明检查和 Chromium 样式消费。首次运行前准备 Chromium。消费者验证独立于普通 check，由桌面 CI 的 Linux x64 目标执行。

按[共同原则](CONVENTIONS.md#quality)、[可读性](CONVENTIONS.md#readability-principle)和[实际影响](refactor/verification/acceptance.md#verification-scope)选择验证。普通检查不包含需要真实 Electron、制品或特定设备的验收。

| 命令                        | 输入与运行环境                                                   |
| --------------------------- | ---------------------------------------------------------------- |
| pnpm check                  | 全仓类型、lint、格式及常规 Node 测试                             |
| pnpm desktop:test:native    | 准备绑定和资源，在 Electron Node 模式中验证实际文件操作与 SQLite |
| pnpm desktop:test:electron  | 准备最小样本，在真实 Electron 中验证编译入口与进程隔离           |
| pnpm desktop:test:dev       | 在隔离源码与资料中验证开发会话、故障恢复、HMR 和取消             |
| pnpm desktop:test:package   | 使用正常打包器处理已准备样本，验证实际包内容、fuses、启动及关闭  |
| pnpm desktop:test:consumers | 准备并消费公开包 tarball，验证声明、Node 与浏览器行为            |

参数默认传给 Turbo；运行器参数通过 -- 分隔。需要重新实测时使用 --force。普通测试不包含空载体性能采样，产品性能按真实负载与具体问题单独验证。

浏览器首次准备使用 `pnpm --filter @kisaki3/desktop exec playwright install chromium`。Linux CI 还准备浏览器系统依赖、Xvfb、窗口管理器、wmctrl 与 AppImage 的 FUSE 条件。Electron Node 模式在启动测试前选定，测试内部不修改 ABI。

打包工具用例检查本次生成的制品和收据。Windows 使用窗口句柄，macOS 使用已获准的系统辅助功能，Linux X11 使用窗口管理器观察。X11 结果不代表 Wayland 验收。

根 TypeScript 项目检查工具、配置和测试；桌面项目按 main、preload、renderer、utility process、shared、tools 和 tests 分环境检查。测试载体也遵守自己的实际运行环境。自有声明至少由一个 `skipLibCheck: false` 的实际项目完整检查，规则见[类型分工](refactor/design/engineering/workspace.md#declaration-checks)。

三个私有工程包直接通过 exports 加载，不预构建。工程函数用 `@kisaki3/tooling/cli`、`/output`、`/process`，类型与 lint 使用各自共享包。项目声明自己的依赖、配置与检查任务，类型感知 lint 沿 TypeScript Project Service 使用所属项目。`pnpm lint:fix` 完成后须审阅修改。

依赖检查核对循环、无法解析或未声明的包，以及原生运行代码、工程工具和测试之间的边界。祖先目录能解析一个包不代表导入者已经声明它。`#native` 由桌面 package.json 的 imports 定义，不复制到根 paths。

Vitest 转换缓存归各项目的 `node_modules/.vitest-cache`。TypeScript 增量信息归 `.cache/typescript`。脚本调用所属运行器；只读任务计划可用 `pnpm exec turbo run <task> --filter=<project> --dry=json` 查看。

## CI 与交付

`ci.yml` 接收 PR 与手动入口，`verification.yml` 协调仓库和桌面工作流，`pr-title.yml` 单独检查标题。任务 inputs 与真实依赖图决定验证范围；文档和单个测试变化不自动扩大到全部桌面验收。原生绑定覆盖六个系统／架构目标；工程窗口、开发会话、打包和进程工具在 Windows x64、macOS arm64、Linux x64 三个系统参考目标执行，公共包消费者只在 Linux x64 执行。正式产品的六目标交付要求保持不变。

每个目标由同一任务图共享已准备输入。可重复的工程测试与有限构建按完整输入缓存成功结果，缓存键包含 CI 系统镜像、目标和锁定工具链；文档收尾可以复用同一运行环境的结果。手动完整 CI 使用 TURBO_FORCE 重新实测，签署、部署和依赖现场状态的验收不重放缓存。

所有工程用 selected／verified 表达选择与完成；Required checks 区分有依据的未选择与应执行但未完成。基线缺失、全局工具链变化或手动完整入口执行全部适用检查；选择失败使检查失败。普通 PR 只有读取权限。

Node 由官方 setup Action 准备，pnpm 官方 Action 读取 packageManager 并管理依赖存储缓存。Turbo 缓存按工程、系统、架构和 Node 分组，fork PR 只读取缓存。反馈目标及口径见[工程工作区合同](refactor/design/engineering/workspace.md#ci-feedback)。

当前开发远端与正式接续情况见[实施状态](refactor/implementation/status.md)。仓库重建、npm、签署和部署按各自授权执行。未取得的平台、签名或后端运行结果保持未完成。
