# 开发与验证

使用 `.node-version` 和根 `packageManager` 指定的版本。Rust 由 `clients/desktop/app/native/rust-toolchain.toml` 固定；Windows 需要 Visual Studio C++ 工具链，macOS 需要 Xcode Command Line Tools，Linux 需要对应系统构建工具。当前桌面工程使用 Electron 45.0.0，开发 Node 与 Electron 内置 Node 分开验证。

## 准备

```sh
pnpm install --frozen-lockfile
pnpm install:hooks
```

hooks 是明确安装的本地检查。安装器只管理仓库本地 `core.hooksPath` 和公共 Git 目录中的自有 Husky 文件，作用于该仓库的全部 worktree。其他显式配置会报告冲突并保持原样。`pnpm uninstall:hooks` 只撤销仍由项目持有的配置；CI 和源码压缩包跳过安装。

pre-commit 通过 lint-staged 执行 Prettier check 与 ESLint，不修复或重新暂存文件。文件清单按 4,000 字符分批，适应 Windows 命令包装器的长度限制；ESLint 沿用既有忽略范围，不将忽略提示计作源码警告。修复后自行审阅和暂存。提交消息使用 Conventional Commits，首次提交为 `chore: initial commit`；PR 标题由标题工作流检查，最终 Squash 标题在合并时确认。

PR 描述的内容与格式遵守[写作规范](refactor/design/engineering/documentation.md#pull-request-descriptions)。

合并前同步最新 main，并通过必需检查。主线保护同样约束管理员，不要求额外的他人审批；仓库仅允许 Squash，合并后由 GitHub 自动删除远端分支。完整规则见[协作合同](refactor/design/engineering/workspace.md#collaboration)。

验证证据目录保留原始字节，Git 不转换其文本换行，以保持记录的文件摘要可核验。普通源码继续采用 LF。

## 资源输入

当前资源工作流从固定依赖准备字体与对应目标的 SQLite 绑定，从唯一图标源稿生成 PNG／ICO，并逐文件记录摘要。字体来源、版本与文件清单由应用 `assets/fonts/inputs.json` 和 pnpm 锁文件共同约束。

开发与构建会自动准备资源，也可单独执行：

```sh
pnpm --filter @kisaki3/desktop prepare:resources --target windows-x64
```

媒体文件信息与播放沿 libmpv-node 接入，其 FFmpeg 依赖由该包统一交付。本体没有独立 ffprobe 下载或构建步骤。

## 构建与开发

根定向入口先标范围，如 `desktop:packages:pack`、`root:typecheck`；包内按动作命名，如 `build:native`、`check:package`。全仓聚合的 `build`、`check` 等保持简短名称。调用与 pnpm 内置命令同名的包脚本时使用 `pnpm run pack`，普通 `pnpm pack` 不执行自定义脚本。

```sh
pnpm desktop:dev
pnpm desktop:build --target windows-x64
pnpm desktop:package --target windows-x64
```

开发会话准备资源并启动 Vite renderer 服务，构建公共依赖并采用完整快照，再建立独立的 Chokidar 输入监听；监听就绪后开始程序编译。窗口源码与样式使用 Vite HMR；公共包的完整构建通过保留 `exports` 的只读快照交接，采用新快照时刷新文档。Node 程序真正受影响时，完成候选构建后再正常停止旧 Electron 并启动新实例。源码编译失败保留最后成功实例，停止会话释放服务、监听和进程。

公共依赖快照保留到会话结束，以免撤销仍被读取的代码；总量限制为 256 MiB，达到预算时停止采用新快照并报告需要重启。工具自身或锁定工具链变更后重新启动开发命令。

同一工作副本内，使用相同构建输出的独立任务顺序执行。运行检查、有限构建或打包前，停止会重建这些依赖的开发会话；清理前停止相关构建、测试和开发任务。需要并行执行独立流程时使用不同工作副本。单次任务内的依赖顺序、合法并行与缓存由 Turbo 管理。

根任务和项目脚本直接调用所属工具。自选任务可使用 `pnpm exec turbo run <task> --filter=<project>`，只读任务计划使用 `--dry=json`。构建在私有候选目录中准备完整结果，成功后替换输出；准备失败或采用前取消时保留原有结果。停止工作流等待所属命令、程序、监听和服务结束。

根 `desktop:test:native`、`desktop:test:e2e` 和 `desktop:test:performance` 显式先运行一次 `desktop:build`，再执行所属测试。`desktop:test:dev` 只提前准备原生编译输出，由 Turbo 准备测试所需的公共依赖；开发回归在隔离源码副本内验证真实构建、监听与生命周期。应用测试脚本消费已准备输入，直接调用时自行完成相应准备。浏览器任务通过依赖图准备公共包，制品测试消费已经打包的输入。

根 `desktop:package` 由 Turbo 的本包构建依赖完成准备，独立执行会先构建一次。已完成构建的流程使用 `pnpm --filter @kisaki3/desktop package --target <host-target>` 消费同一输出；入口核对现有 `build.json` 的目标、输入身份、完整文件集合和摘要，不在打包阶段重建。缺失、过时或被改写的构建会使任务失败，原有候选保留。

`buildId` 使用 Turbo 公开任务计划中桌面 build 的输入摘要，覆盖任务定义、依赖、全局工具链文件和声明的环境变量。构建与打包读取同一份正式输入定义，逐文件 SHA-256 则校验实际运行字节。开发监听排除文档、测试及生成输出；工具自身和锁定工具链变化仍按上述规则重新启动开发命令。

独立程序可通过应用任务构建，例如 `pnpm --filter @kisaki3/desktop build --program preload`。私有原生构建使用 `build:native`，生成声明变化时显式添加 `--update-declarations` 并审阅结果；`check:native` 在固定 Rust 工具链下执行格式与 Clippy 检查。

普通构建位于应用 `out/<target>`，每个开发会话使用独立的 `out/development/<target>/session-*`，安装和归档制品位于 `dist/<target>`。相关任务停止后执行 `pnpm run clean`，仅清理已声明的工程输出，保留 `.local`、下载缓存和根 `artifacts` 中留存的制品。

## 验证任务

先按[可读性](CONVENTIONS.md#readability-principle)核对改动的职责、命名、组织与完整阅读路径，再按[简洁、原生与适度复杂度](CONVENTIONS.md#simplicity-native)及[变更影响](refactor/verification/acceptance.md#verification-scope)选择检查。下表是可用入口，不是每次修改都要逐项执行的清单。文档、注释和等价调整优先核对自身差异；改变运行行为、构建接入或制品时，再执行相应验证。构建身份变化不自动触发全部桌面、性能、打包和六目标回归，已有证据仍适用时注明范围并复用。

仓库根 `tsconfig.json` 组织 `config/typescript` 中工具、配置和测试三个类型项目，Turbo 同时调度各 workspace 与根 `root:typecheck`。工具只使用 Node 环境；配置与测试按实际声明和浏览器回调需要包含 DOM 类型。共同规则来自 `@kisaki3/typescript-config`，依赖检查读取根默认配置，并按导入方的 package.json imports 解析包内入口。根 `vitest.config.ts` 提供常规测试入口，仓库外消费者任务显式读取 `config/vitest/vitest.config.desktop-consumers.ts`。

工具和测试引用共用函数时声明 `@kisaki3/tooling` 的 workspace devDependency，并使用其 `/cli`、`/output` 或 `/process` exports。TypeScript 与 ESLint 共享配置分别由 `@kisaki3/typescript-config`、`@kisaki3/eslint-config` 提供。三者是固定工具链内直接加载的私有工程包，不预构建，不进入产品运行依赖或仓库外作者模板。

每个 TypeScript 项目维护自己的 `eslint.config.ts` 和 lint 任务，声明 ESLint、jiti 与共享配置依赖，并以 `import.meta.dirname` 绑定 `parserOptions.tsconfigRootDir`。类型感知 lint 沿 TypeScript Project Service 使用源码实际所属的 tsconfig 和 references，跨项目的暂存文件检查也采用各自环境；官方扩展的两个配置入口共用自身 Node 类型项目。

根 `pnpm lint` 通过 Turbo 准备依赖包的构建声明，再调度项目 lint、根工程 lint 与全仓依赖检查。首次检查使用根任务；直接调用 ESLint、编辑器和 pre-commit 消费已准备的声明。仓库外消费者样板在安装 tarball 后执行完整类型感知 lint，仓库内保留语法检查。共享规则与适用边界见 [ESLint 配置](packages/eslint-config/README.md)。

根 `turbo.json` 提供共同任务，应用 `turbo.json` 声明桌面任务。CI 用 GitHub Actions 官方 cache 保存 `.turbo/cache`，按系统、架构和 Node 版本隔离；fork PR 只读取缓存。原生、桌面运行、开发会话、消费者与制品验证始终实际执行。

全仓依赖图由根 `.dependency-cruiser.json` 检查。第三方包、构建输出和测试目标保留直接依赖边，通过 `doNotFollow` 停止继续扫描；不能用全局排除让这些边消失。检查同时核对导入者自己的依赖声明，祖先目录能够解析某个包不代表该项目已经声明它。

应用的 `#native` 由应用 `package.json#imports` 唯一定义，不复制到根 paths。配置继承不改变包作用域：在根目录启动构建仍能解析应用源码的 `#native`，根工程自己的模块则不拥有该入口。具体导入范围见[模块导入规则](CONVENTIONS.md#module-imports)。

应用的 `tsconfig.json` 是七个类型项目的共同入口，`pnpm --filter @kisaki3/desktop typecheck` 通过 `tsc -b` 检查全部环境。具体配置位于 `config/typescript`，增量信息归应用 `.cache/typescript`，不生成运行代码；需要完整重检时使用 `pnpm --filter @kisaki3/desktop typecheck --force`。

八个公共包同样由根 `tsconfig.json` 组织各自 `config/typescript` 中的库源码与工具项目，类型任务使用 `tsc -b`。库源码配置为 `config/typescript/tsconfig.lib.json`，根 `tsdown.config.ts` 显式读取它进行代码与声明构建；工具及其构建配置使用同目录的 `tsconfig.tools.json`。增量信息归各包 `.cache/typescript`，各环境的严格性独立保持。各类工程和样板遵守同一[配置归属规则](CONVENTIONS.md#configuration-layout)。

常规 Node 与桌面端到端测试保留应用根目录的默认配置，其他运行方式由 `config/vitest` 和 `config/playwright` 中的配置明确指定。脚本与 CI 继续使用下列任务入口。

各工程显式设置 `fsModuleCachePath: 'node_modules/.vitest-cache'`，将 Vitest 转换缓存放在自身项目根目录下，避免工作区级默认缓存的并发清理冲突。工程依赖按构建、测试、类型、配置、资产和 peer 等实际用途保留，不仅根据产品源码的直接导入判断。

TypeScript 的 `@deprecated` 提示属于语言服务建议诊断，普通 `tsc` 检查通过不代表此类提示为零。API 与配置迁移还须核对相应弃用提示，处理依据见[弃用接口规则](CONVENTIONS.md#deprecated-apis)；上游传递依赖的弃用通知与自维护代码的 API 调用分别记录。

| 命令                                            | 输入与运行环境                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm check`                                    | 全仓类型、lint、格式、根工具与各项目常规 Node 测试                   |
| `pnpm desktop:packages:pack`                    | 构建并打包桌面八包，收集到 `artifacts/desktop/packages`              |
| `pnpm desktop:packages:test:consumers`          | 构建并打包八包，执行 publint、Are the Types Wrong 和仓库外消费者     |
| `pnpm desktop:packages:test:consumers:prepared` | 只消费已准备的 `artifacts/desktop/packages/inputs.json`，不重建产品  |
| `pnpm desktop:test:native`                      | 先构建，再由开发 Electron 的 Node 模式执行实际 SQLite 与原生文件测试 |
| `pnpm desktop:test:browser`                     | 真正的 Playwright Chromium 与 Vitest Browser Mode                    |
| `pnpm desktop:test:e2e`                         | 完整构建、隔离 profile、真实 Electron 窗口和正常退出                 |
| `pnpm desktop:test:dev`                         | 独立源码副本中的构建恢复、改名、HMR、启动取消和会话收尾              |
| `pnpm desktop:test:performance`                 | 20 次新进程测量、固定预算、内存和退出观察                            |
| `pnpm desktop:test:artifacts`                   | 已完成打包的目标文件，保留正式 fuses，以外部方式观察启动与关闭       |

浏览器首次准备使用 `pnpm --filter @kisaki3/desktop exec playwright install chromium`。Linux CI 还需对应浏览器系统依赖、Xvfb、窗口管理器、wmctrl 和 AppImage 的 FUSE 条件。原生测试的宿主在启动 Vitest 前选择，不能在测试内部设置变量来改变 ABI。

消费者输入可用 `KISAKI_DESKTOP_PACKAGE_INPUTS` 指定。尚未发布的作用域内依赖在核对 tarball 中的真实版本范围后，映射到同组实际 tarball；没有源码链接或长期私有 registry。JavaScript 声明由工具检查，CSS 入口由真实浏览器消费验证，ATTW 不将 CSS 当作 JavaScript 入口。

制品输入可用 `KISAKI_ARTIFACT_RECEIPT` 指定，默认读取当前目标 `dist/<target>/artifacts.json`。测试核对版本、目标、构建身份、摘要、资源和 fuses；不重新打包。Windows 使用窗口句柄，macOS 使用获准的系统辅助功能，Linux X11 使用窗口管理器；原生 Wayland 另按实际桌面操作记录，不将 X11 结果记作 Wayland 通过。

常规类型项目使用 `strict: true` 与 `skipLibCheck: true`，完整检查自有源码及其对依赖的调用。仓库外公共声明消费者保持 `skipLibCheck: false`；应用的 main、shared、renderer 项目分别负责原生、构建全局及窗口全局声明的完整检查。结构检查确认每份自有 `.d.ts` 至少有一个实际执行且不跳过声明的拥有者，详见[类型检查规则](refactor/design/engineering/workspace.md#declaration-checks)。

## CI 与交付

正式发布前，在所属项目的[公开开发仓库](refactor/design/engineering/repository.md#temporary-repositories)持续开发、审阅和验证；工作包完成不结束该仓库的用途。当前远端与正式接续状态见[实施状态](refactor/implementation/status.md)。正式身份、公开发行和服务切换按各自合同与实际授权执行。

普通 CI 通过 Turbo 的任务 inputs 和依赖图选择常规检查、八包消费者、浏览器、原生、四窗口、开发会话、性能与制品检查。通用浏览器交互只在 Ubuntu x64 运行；选中的原生与桌面任务覆盖六个目标。开发工具变化触发开发回归，启动、加载和资源变化触发完整 20 次性能采样；测试文件变化按所属套件选择验证。选择结果单独留存，各执行分支保存自身报告。

PR 的 affected 范围覆盖相对目标分支的全部改动。任务选择与缓存分别遵守[工程工作区合同](refactor/design/engineering/workspace.md#tasks)。

PR 打开、源分支提交变化及重新打开时运行代码 CI；标题和正文编辑由独立标题工作流处理。合入主线后沿用严格合并门禁前通过的代码验证结果。更换目标分支后的验证入口见[协作规则](refactor/design/engineering/workspace.md#collaboration)。

ci.yml 处理 PR 与手动代码验证入口，verification.yml 协调 verification-repository.yml 与 verification-desktop.yml；pr-title.yml 检查 PR 标题。仓库工作流调度各包自己的常规检查；桌面工作流拥有八包消费者、桌面范围选择与目标矩阵。每个桌面目标在同一 runner 中执行选中的运行、开发、性能和制品步骤，有限应用只构建一次，打包复用同一输出；开发检查复用已准备的原生输出，仅开发检查时才单独准备。桌面浏览器交互与八包消费者在 Linux x64 参考目标执行，仅这两类变化时只安排该目标。所有工程通过 selected／verified 输出表达选择与完成，Required checks 对每个 needs 结果使用同一判定。工程 workflow 的修改只请求自身完整验证，共同协调器修改请求全部验证，标题 workflow 不进入产品的全局输入。

CI 先准备固定的 Node，再由 pnpm 官方 Action 安装 packageManager 指定版本并管理依赖存储缓存。Turbo 缓存按工程命名空间、操作系统、架构和 Node 分组，主键已命中时跳过重复保存。macOS 部署目标在依赖安装前单独设置。反馈目标及统计口径见[工程工作区合同](refactor/design/engineering/workspace.md#ci-feedback)；作业级超时为环境准备与 runner 波动留出余量，由 workflow 配置拥有，不替代反馈目标或应用性能预算。

手动运行 CI 请求完整验收；可调用验证工作流通过 `base`、`head` 和 `complete` 接收比较基线、目标提交与完整范围请求。初次提交、缺失基线及全局工具链变化也执行完整范围；选择工具失败直接导致检查失败。首次交付和发行前的六目标与主要后端要求保持。`Required checks` 始终运行，并区分有依据的未选择与应执行但未完成的任务。普通 PR 只有读取权限，正式发布和签名凭据不进入这些检查。

CI 的 macOS 测试制品显式标记 `testOnly`。普通 macOS 打包要求 `KISAKI_MAC_SIGNING_IDENTITY` 指向项目签署身份；正式签名、首开、更新和所有安装形态仍按 W11 验收。Windows 保持未签名政策。构建、打包和检查均不隐含发布。

实际结果写入 [实施状态](refactor/implementation/status.md)。未取得的环境、失败或缺少输入均保留为未完成，不以脚本存在、交叉构建或历史探针代替目标运行。
