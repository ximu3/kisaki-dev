# 开发与验证

使用 `.node-version` 和根 `packageManager` 指定的版本。Rust 由 `clients/desktop/app/native/rust-toolchain.toml` 固定；Windows 需要 Visual Studio C++ 工具链，macOS 需要 Xcode Command Line Tools，Linux 需要对应系统构建工具。当前桌面工程使用 Electron 44.5.1，开发 Node 与 Electron 内置 Node 分开验证。

## 准备

```sh
pnpm install --frozen-lockfile
pnpm hooks:install
```

hooks 是明确安装的本地检查。安装器只管理仓库本地 `core.hooksPath` 和公共 Git 目录中的自有 Husky 文件，作用于该仓库的全部 worktree。其他显式配置会报告冲突并保持原样。`pnpm hooks:uninstall` 只撤销仍由项目持有的配置；CI 和源码压缩包跳过安装。

pre-commit 通过 lint-staged 执行 Prettier check 与 ESLint，不修复或重新暂存文件。文件清单按 4,000 字符分批，适应 Windows 命令包装器的长度限制；ESLint 沿用既有忽略范围，不将忽略提示计作源码警告。修复后自行审阅和暂存。提交消息使用 Conventional Commits，首次提交为 `chore: initial commit`；PR 标题和主线提交由 CI 检查。

验证证据目录保留原始字节，Git 不转换其文本换行，以保持记录的文件摘要可核验。普通源码继续采用 LF。

## 资源输入

当前资源工作流从固定依赖准备字体与对应目标的 SQLite 绑定，从唯一图标源稿生成 PNG／ICO，并逐文件记录摘要。字体来源、版本与文件清单由应用 `assets/fonts/inputs.json` 和 pnpm 锁文件共同约束。

开发与构建会自动准备资源，也可单独执行：

```sh
pnpm --filter @kisaki3/desktop resources:prepare --target windows-x64
```

媒体文件信息与播放沿 libmpv-node 接入，其 FFmpeg 依赖由该包统一交付。本体没有独立 ffprobe 下载或构建步骤。

## 构建与开发

```sh
pnpm desktop:dev
pnpm desktop:build --target windows-x64
pnpm desktop:package --target windows-x64
```

开发会话先完成依赖与资源准备，再由 Vite 管理 renderer 服务和监听。窗口源码与样式使用 HMR；公共包的完整构建通过保留 `exports` 的只读快照交接，采用新快照时刷新文档。Node 程序真正受影响时，完成候选构建后再正常停止旧 Electron 并启动新实例。源码编译失败保留最后成功实例，停止会话释放服务、监听和进程。

公共依赖快照保留到会话结束，以免撤销仍被读取的代码；总量限制为 256 MiB，达到预算时停止采用新快照并报告需要重启。工具自身或锁定工具链变更后重新启动开发命令。

同一工作副本内，使用相同构建输出的独立任务顺序执行。运行检查、有限构建或打包前，停止会重建这些依赖的开发会话；清理前停止相关构建、测试和开发任务。需要并行执行独立流程时使用不同工作副本。单次任务内的依赖顺序、合法并行与缓存由 Turbo 管理。

根任务和项目脚本直接调用所属工具。自选任务可使用 `pnpm exec turbo run <task> --filter=<project>`，只读任务计划使用 `--dry=json`。构建在私有候选目录中准备完整结果，成功后替换输出；准备失败或采用前取消时保留原有结果。停止工作流等待所属命令、程序、监听和服务结束。

独立程序可通过应用任务构建，例如 `pnpm --filter @kisaki3/desktop build --program preload`。私有原生构建使用 `native:build`，生成声明变化时显式添加 `--update-declarations` 并审阅结果；`native:check` 在固定 Rust 工具链下执行格式与 Clippy 检查。

普通构建位于应用 `out/<target>`，每个开发会话使用独立的 `out/development/<target>/session-*`，安装和归档制品位于 `dist/<target>`。相关任务停止后执行 `pnpm run clean`，仅清理已声明的工程输出，保留 `.local`、下载缓存和根 `artifacts` 中留存的制品。

## 验证任务

仓库根 `tsconfig.json` 组织 `config/typescript` 中工具、配置和测试三个类型项目，由根 `typecheck` 在各 workspace 检查后执行。工具只使用 Node 环境；配置与测试按实际声明和浏览器回调需要包含 DOM 类型。根 `tsconfig.base.json` 提供共同规则，依赖检查复用其中的编译选项，并按导入方的 package.json imports 解析包内入口。根 `vitest.config.ts` 提供常规测试入口，仓库外消费者任务显式读取 `config/vitest/vitest.config.consumers.ts`。

应用的 `tsconfig.json` 是七个类型项目的共同入口，`pnpm --filter @kisaki3/desktop typecheck` 通过 `tsc -b` 检查全部环境。具体配置位于 `config/typescript`，增量信息归应用 `.cache/typescript`，不生成运行代码；需要完整重检时使用 `pnpm --filter @kisaki3/desktop typecheck --force`。

八个公共包同样由根 `tsconfig.json` 组织各自 `config/typescript` 中的库源码与工具项目，类型任务使用 `tsc -b`。库源码配置为 `config/typescript/tsconfig.lib.json`，根 `tsdown.config.ts` 显式读取它进行代码与声明构建；工具使用同目录的 `tsconfig.tools.json`，UI 另有独立构建配置项目。增量信息归各包 `.cache/typescript`，各环境的严格性独立保持。各类工程和样板遵守同一[配置归属规则](refactor/design/engineering/conventions.md#configuration-layout)。

常规 Node 与桌面端到端测试保留应用根目录的默认配置，其他运行方式由 `config/vitest` 和 `config/playwright` 中的配置明确指定。脚本与 CI 继续使用下列任务入口。

TypeScript 的 `@deprecated` 提示属于语言服务建议诊断，普通 `tsc` 检查通过不代表此类提示为零。API 与配置迁移还须核对相应弃用提示，处理依据见[弃用接口规则](refactor/design/engineering/conventions.md#deprecated-apis)；上游传递依赖的弃用通知与自维护代码的 API 调用分别记录。

| 命令                            | 输入与运行环境                                                       |
| ------------------------------- | -------------------------------------------------------------------- |
| `pnpm check`                    | 全仓类型、lint、格式、根工具与各项目常规 Node 测试                   |
| `pnpm test:consumers`           | 构建并打包八包，执行 publint、Are the Types Wrong 和仓库外消费者     |
| `pnpm test:consumers:run`       | 只消费已准备的 `artifacts/packages/inputs.json`，不重建产品          |
| `pnpm desktop:test:native`      | 先构建，再由开发 Electron 的 Node 模式执行实际 SQLite 与原生文件测试 |
| `pnpm desktop:test:browser`     | 真正的 Playwright Chromium 与 Vitest Browser Mode                    |
| `pnpm desktop:test:e2e`         | 完整构建、隔离 profile、真实 Electron 窗口和正常退出                 |
| `pnpm desktop:test:dev`         | 独立源码副本中的构建恢复、改名、HMR、启动取消和会话收尾              |
| `pnpm desktop:test:performance` | 20 次新进程测量、固定预算、内存和退出观察                            |
| `pnpm desktop:test:artifacts`   | 已完成打包的目标文件，保留正式 fuses，以外部方式观察启动与关闭       |

浏览器首次准备使用 `pnpm --filter @kisaki3/desktop exec playwright install chromium`。Linux CI 还需对应浏览器系统依赖、Xvfb、窗口管理器、wmctrl 和 AppImage 的 FUSE 条件。原生测试的宿主在启动 Vitest 前选择，不能在测试内部设置变量来改变 ABI。

消费者输入可用 `KISAKI_PACKAGE_INPUTS` 指定。尚未发布的作用域内依赖在核对 tarball 中的真实版本范围后，映射到同组实际 tarball；没有源码链接或长期私有 registry。JavaScript 声明由工具检查，CSS 入口由真实浏览器消费验证，ATTW 不将 CSS 当作 JavaScript 入口。

制品输入可用 `KISAKI_ARTIFACT_RECEIPT` 指定，默认读取当前目标 `dist/<target>/artifacts.json`。测试核对版本、目标、构建身份、摘要、资源和 fuses；不重新打包。Windows 使用窗口句柄，macOS 使用获准的系统辅助功能，Linux X11 使用窗口管理器；原生 Wayland 另按实际桌面操作记录，不将 X11 结果记作 Wayland 通过。

UI 的 `config/typescript/tsconfig.config.json` 仅对 tsdown 配置采用已确认的声明检查例外。UI 源码、工具源码和仓库外消费者保持独立严格检查，详见 [类型检查规则](refactor/design/engineering/workspace.md#declaration-checks)。

## CI 与交付

正式发布前，在所属项目的[临时私有仓库](refactor/design/engineering/repository.md#temporary-repositories)持续开发、审阅和验证；工作包完成不结束该仓库的用途。当前远端与正式接续状态见[实施状态](refactor/implementation/status.md)。正式身份、公开发行和服务切换按各自合同与实际授权执行。

CI 从 Turbo 的实际依赖图决定桌面矩阵是否需要执行；初次提交或无法确定基线时执行完整矩阵。`Required checks` 始终运行，并区分有依据的未选择与应执行但未完成的任务。普通 PR 只有读取权限，正式发布和签名凭据不进入这些检查。

CI 的 macOS 测试制品显式标记 `testOnly`。普通 macOS 打包要求 `KISAKI_MAC_SIGNING_IDENTITY` 指向项目签署身份；正式签名、首开、更新和所有安装形态仍按 W11 验收。Windows 保持未签名政策。构建、打包和检查均不隐含发布。

实际结果写入 [实施状态](refactor/implementation/status.md)。未取得的环境、失败或缺少输入均保留为未完成，不以脚本存在、交叉构建或历史探针代替目标运行。
