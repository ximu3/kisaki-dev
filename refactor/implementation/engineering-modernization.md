# Kisaki 全项目工程设计与现代化重构方案

**迁移分支正在实施。** 本轮覆盖从干净检出、开发调试、构建、测试到发布和维护的整个工程。根仓、桌面应用、公共包、私有工程包和官方扩展各自的源码、配置、工具、测试与制品都在范围内。四个独立项目按各自的宿主和发布单位接续。现行命令和交付结果分别见[开发说明](development.md)与[实施状态](status.md)。

JS/TS 建议采用 Vite+ 作为工程入口、TypeScript 7.1 作为编译器。迁移分支可用精确版本 `7.1.0-beta`，主线采用首个通过验收的 7.1.x 正式版。工具选型、`tools` 的职责和 `tests` 的组织共同服务于同一目标。开发者能从一次改动找到负责的源码，运行与之相关的检查，并辨认最终交付的是哪份文件。现有工程的主要问题与取舍见[全项目审视](modernization-audit.md#engineering-review)。

## 统一范围与工具归属

根仓、桌面应用、全部公共包、私有工具及后续官方扩展共用锁文件和任务执行器。根配置拥有共同默认值，各项目维护与其宿主或产物有关的配置。独立仓库采用同样的 JS/TS 工程约定，各自锁定版本、验证和交付。现代化、简洁、清晰、干净与克制共同决定取舍。一次性重做成本不影响选型，反馈时间、运行资源、兼容责任和长期维护计入成果质量。[根协作规范](../../AGENTS.md) · [判断与取舍](../design/engineering/conventions.md#judgment)

| 职责 | 终态选择 | 迁移与退役 |
| --- | --- | --- |
| 环境、依赖、脚本 | 工程宿主建议选 Node 26 LTS 和 pnpm 12，分别验证后锁定补丁。pnpm 管 workspace、catalog、`packageManager` 和 `pnpm-lock.yaml`。公共包 Node 消费下限与 Electron 内置 Node 分别维护。开发与 CI 调用项目锁定的 `vp`。 | Vite+ 和它管理的 Vite、Vitest、Oxc 版本共同升级。按官方迁移规则处理 Vite 核心别名和需要它的 peer。普通 TS 脚本通过 `vpx` 或 Node 支持的原生入口执行，真实 Node、子进程和 Electron 模式通过后清理直接的 tsx、jiti 接入。 |
| 调度与缓存 | `vp run` / Vite Task 是唯一 JS/TS 任务执行器。包之间按清单依赖拓扑执行。耗时且可重建的纯产物才开启缓存，声明其输出与影响结果的环境。 | 移除 Turbo 包、`turbo.json`、专用 GraphQL、两处重复的选择逻辑和只验证旧图形状的用例。缓存不可用时可冷构建并交付正确结果。跨 CI 作业复用先测正确性与节省的总时间，原生缓存含目标及工具链身份。[Vite Task](https://viteplus.dev/guide/run) · [GitHub Actions 缓存支持范围](https://viteplus.dev/guide/github-actions-cache) |
| 类型、lint、格式 | 各项目用锁定的 TS 7.1 检查自己的配置和引用，根任务按工作区实际依赖调用这些类型入口。仓库根的 `tsc -b` 仅覆盖根工具、配置和测试。`vp lint --type-aware` 使用配套 Oxlint 和 tsgolint，`vp fmt` 使用 Oxfmt。 | 每份源码只做一次正式类型检查。`vp check` 若用作格式/lint 入口，关闭它的额外 type-check。迁移必要的异步、公共合同和宿主边界检查后删除 ESLint、typescript-eslint、Prettier、对应配置包和消费者内的旧 API 调用。跨模块间接依赖由一个图检查看住，简单导入限制放在 Oxlint。[统一检查](https://viteplus.dev/guide/check) · [类型感知规则](https://oxc.rs/docs/guide/usage/linter/type-aware) |
| 开发、应用与库构建 | 应用使用 Vite+ 的 Vite/Rolldown 入口与 Solid 插件，公共库使用 `vp pack`，由底层 tsdown 生成 ESM、CSS 与声明。`pnpm pack` 从完成的公共包目录生成供外部消费的 tarball。 | 迁移并清理独立 tsdown CLI、重复配置和重复清理 `dist` 的步骤。开发态在工作区通过同一公开子路径解析源码，发行消费者走构建后的 exports。保留字体、样式组装、许可、沙箱 preload 和其他确有产品语义的步骤。[Vite+ 库构建](https://viteplus.dev/guide/pack) · [官方迁移规则](https://viteplus.dev/guide/migrate-rules) |
| 测试、提交与交付 | `vp test` 运行 Vitest 用例。Playwright 保有真实浏览器、键盘与 Electron 的验证，`vp run` 调度对应入口。GitHub Actions 拥有作业与平台选择。 | 使用 `vp staged` 与可选的本地 hook 取代重复的 Husky/lint-staged 接入，覆盖部分暂存、用户已有 hook 和 worktree 后再删除旧实现。公共发布包继续检查实际 tarball 和声明解析。当前 squash 合并默认采用 PR 标题，保留独立且轻量的格式检查。[Vite+ 提交钩子](https://viteplus.dev/guide/commit-hooks) |
| 原生与专用交付 | Rust 编译、格式和 Clippy 由 Cargo 负责，Node-API 绑定由 napi-rs 交付。Electron 的最终格式、fuses、签署、安装与升级归 electron-builder 及平台工具。SQLite、Drizzle 迁移继续使用原生驱动和正式迁移器。 | Vite+ 汇集运行命令。Vantage 与 libmpv-node 的 JS 接入采用统一约定，原生后端按实际平台验收。Kana 的阅读内核、oauth-relay 的 Node/Hono 服务分别保留浏览器与容器交付。这四个独立仓库的实际迁移由各自项目验证。[独立项目范围](../design/projects/README.md) |

<a id="engineering-architecture"></a>

## 工程架构与工具组织

pnpm 声明项目与依赖，`vp run` 执行工作区任务，Vite 管理编译和监听。简单命令直接写在 `package.json`，需要声明任务依赖、输入与输出时使用 Vite+ 配置。有独立维护逻辑才设 `tools/`，例如生成与校验 ICU 声明、装配平台资源或管理应用的可取消退出。按工作流命名，由最近的项目拥有。只做标准库构建的项目可以没有这个目录。Vite 自身也将需要编程的发行操作放在独立脚本中。[Vite+ 任务](https://viteplus.dev/guide/run) · [Vite 发行脚本](https://github.com/vitejs/vite/blob/main/scripts/prepare-release.ts)

| 工程位置 | 终态责任与迁移动作 |
| --- | --- |
| 根清单、配置、`tools/`、`.github/workflows/` | 根入口负责跨项目验证选择和发行协调。用一处变更判定把代表性改动映射到所需宿主，Actions 管 runner、权限、顺序与证据交付，本地调用相同的项目命令。依赖边界由一份规则维护，环境信息随真正需要复现的运行记录。待 `vp staged` 的隔离 Git 用例验证部分暂存、已有 hooks 和 worktree 后，退役旧 hook 安装器及配套测试。 |
| `packages/tooling` 与私有配置 | 保留多项目确实使用的 CLI 信号、命令树取消、独立错误交付和按所属目录清理。`pnpm pack`、publint、ATTW 直接消费同一 tarball，只有输入、清理或退出状态需要项目约束时才保留适配。跨包测试专用的安装辅助从下节的私有测试入口消费。类型基线按宿主管理，旧 ESLint 配置包和导入在最后一个调用方迁移后删除。 |
| 桌面 `tools/build`、`resources`、`native`、`package` | 分别拥有程序构建、字体/图标/迁移资源、Cargo 及 Node-API 绑定、平台打包。按目标交接外置资源、原生文件和完成清单。一个步骤写入一个输出目录，输出的拥有者待最后一个读取进程退出后清理。缓存恢复后核对完整文件集。只被单个流程使用的路径、摘要或类型归回该流程，多个流程使用的纯事实才留在 `tools/lib`。 |
| 桌面 `tools/dev` | Vite 拥有源码图、renderer HMR、程序编译结果。桌面会话拥有启动、采用完成的程序、协商重启/退出、取消和释放。移除为生成依赖 `dist` 而建立的全包监听、重新构建与刷新链。资源、原生输入仍交给各自的准备工具。退出被拒绝时当前窗口和进程继续工作，确认退出后释放它读取的运行目录。开发会话分配独占的运行和输出目录，调用者可传入预先构建的资源、原生绑定及隔离 profile。[开发会话](../../clients/desktop/app/tools/dev/session.ts) |
| 各公共包的 `tools` | 六份相同的 `clean.ts` 收敛为一次受限清理，项目声明自己的可重建输出。RPC 和分发包改为直接执行 `vp pack`，清理与构建两层包装退役后移除这两个包的 `tools/`。合同包保留 Lucide 名称生成与一致性核对，本地化包保留 ICU 消息声明生成，外观包保留视觉 token 到 CSS 的生成、Tailwind 入口和许可说明，UI 包保留组件样式和许可组装。只保留有独立读者的 CLI 或程序化入口。 |
| 官方扩展、作者 SDK/CLI 与独立项目 | SDK/CLI 的作者命令、模板和 `.kisx` 打包是交付给用户的产品，随所属包的 `src` 发布。第一方扩展的维护脚本归项目 `tools`，源码模板与测试用消费者工程分别维护。Vantage 和 libmpv-node 的 Rust 单测、集成测试遵循 Cargo 的发现规则，JS 包验证实际绑定和平台制品。Kana 拥有真实格式与浏览器布局验证，relay 拥有 HTTP、容器、配置与停止测试。独立仓库各自落地并登记可取得的运行证据。[作者工具](../design/extensions/development.md#templates) · [原生工程](../design/projects/native-runtime.md) · [Cargo 测试](https://doc.rust-lang.org/cargo/guide/tests.html) |

保留 `tools/build/coordinator.ts` 作为整次桌面构建的协调入口，负责程序编译的交接和最终完成判断。清单与文件摘要索引归 `tools/build/manifest.ts`，目标身份和映射归 `tools/lib/targets.ts`，分发载体元数据归 `tools/package/distribution.ts`。`tools/dev/generation.ts` 改为 `tools/dev/prepare-runtime.ts`，表达它在应用启动前复制编译产物和原生资源的职责。

导入方向是实施约束。用例可以调用工具、源码或已构建制品。工程工具可以依赖已声明的私有工程包和允许的纯合同。所有测试专用入口、样板和运行器只供测试侧使用。产品包的 exports、正式安装包和镜像保持独立消费所需的最小依赖。目录按实际拥有者与阅读路径建立，现行布局在迁移前供对照。[源码布局](../design/engineering/layout.md#tools) · [工具与宿主](../design/engineering/workspace.md#tooling)

<a id="test-architecture"></a>

## 测试架构与目录

执行[测试布局规范](../design/engineering/layout.md#test-placement)。迁移时按维护范围安排以下文件。Vite 也用完整的样板工程验证开发与构建行为，修改样本的场景在副本上运行。[Vite 测试实践](https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md)

| 内容 | 建议位置与实际例子 |
| --- | --- |
| 单个场景或套件的辅助 | 数据库选项和种子数据从 `tests/support/database.ts` 迁到 `tests/integration/database/`，制品解包准备归 `tests/artifacts/`，开发测试的控制器、worker 与启动器归 `tests/tools/dev/`。小型辅助可写在测试文件里。 |
| 工程级测试辅助 | 桌面的 `tests/support/electron.ts` 管理 Electron 测试宿主、应用和 profile，`window-observation.ts` 负责系统窗口观测。两者都有跨套件调用，按各自的独立职责保留。 |
| 需要按原样读取、安装或运行的输入 | 公共包从 `tests/fixtures/consumers/<宿主>/` 迁到 `tests/consumers/fixtures/<宿主>/`。共用的最小 Electron 应用从 `tests/fixtures/runtime/` 迁到 `tests/fixtures/desktop-app/`。专用的测量负载由性能入口装配，样板只保存输入。 |
| 测试运行时资源 | page、context、临时 profile、数据库连接和子进程由使用它们的 fixture 按需创建并释放。共享安装可以用套件或 worker 作用域，可写资源随实例隔离。测试报告、解包结果和临时数据库由本次运行拥有。 |

| 所验证的行为 | 位置、环境与取舍 |
| --- | --- |
| 单一模块的纯行为 | 与实现共同维护的 `src/**/*.test.ts(x)` 就近验证规范编码、错误、转换和状态。生产构建排除测试。工具自身的轻量判断可以就近验证，涉及真实 CLI、文件或进程的用例归所属工程 `tests/tools/<工作流>`。 |
| 仓库和命令的工程行为 | 根 `tests/workspace` 保留真实的跨项目禁止依赖、错误制品恢复或 CI 选错环境等仍由项目负责的风险。旧 Turbo 任务名、依赖边清单、文件后缀断言和退役 hooks 的内部行为随其拥有者删除。用“只改 CSS”和“从旧缓存恢复后是否多出文件”核对实际结果。项目输入或自有声明可能漏检时，在正式编译入口验证其覆盖。 |
| 桌面集成、启动与开发 | 数据库、归档和原生文件集成用例在运行器启动前选定与绑定匹配的 Electron Node 宿主。现有 `tests/e2e/windows.test.ts` 验证测试载体的窗口、沙箱 preload 与 utility process 接入，归 `tests/integration/electron/window-startup.test.ts` 并由 Playwright 启动真实 Electron。`tests/e2e` 用于正式用户流程。`tests/tools/dev` 区分轻量取消/失败与真实 HMR 和应用关闭。只给会改源码的用例准备独立、可写的最小工程，使用真实公共入口和必要依赖。只验证拒绝退出、保留 profile 或停止失败的场景使用已准备的只读程序与独立运行目录。正式产品入口就绪后，由产品承担业务端到端场景，工程载体只保留具有独立故障含义的编译和启动检查。 |
| 公共包与 UI | 六包共用安装机制，各包拥有消费者的 manifest、依赖集合、源样例和断言。保留 `tests/consumers` 的仓库外 tarball 验证。UI 的表单、焦点、IME、虚拟选择、Toast 等行为按交互主题归 `tests/browser`，使用与交付相同的 Solid 编译和完整样式，从源码获得快反馈。公开子路径、类型、样式级联与安装后行为在实际制品的代表用例验证。RPC 保留 Node 父子 IPC 与沙箱 Electron MessagePort 两个真实传输环境。 |
| 制品、性能与外部数据 | `tests/artifacts` 从已生成的收据定位同一份 ZIP、应用或 AppImage，用外部方式核对真实启动、退出与 fuses。`tests/performance` 独立保存数据输入、环境、原始采样与查询计划。大负载准备和测量代码归性能场景，仅由性能入口装配。来源扩展拥有匿名样本，导入器拥有已声明格式样本，宿主拥有真实安装与激活，发行验收另核对安装和升级。 |

建议复用现有私有工程包，为六个公共包提供一个仅供测试导入的 `@kisaki3/tooling/testing/consumer` 入口。调用方传入样板目录及本次所需的归档映射，拥有运行作用域和断言。共用入口只负责外部目录、安装与释放，在安装失败时回收已取得的资源。按样板实际声明的直接与传递依赖选用归档，Node 纯消费者仍独立于浏览器和 Electron。生成全量声明导入、Node 或浏览器编译、Solid 页面和 Electron IPC 留在对应包。类型感知 lint 在装有实际依赖的样板目录执行，`tsc` 以 `skipLibCheck: false` 检查最终公开声明及其依赖。

正式产品模板归产品源码，测试样板归消费套件。移动样板或辅助模块时，同步相对导入、子进程启动路径、运行器发现规则、类型项目和构建输入。只读样板、测试报告与可发布文件各有明确的输出边界。[Vitest 测试项目](https://vitest.dev/guide/projects.html) · [数据隔离](../verification/acceptance.md#isolation)

<a id="ci-design"></a>

## 持续集成与发行验收

**提议采用一个 PR 代码入口、一套 Linux x64 基础检查和按改动风险追加的环境。** 每项附加检查说明可能破坏的行为及观察它所需的环境。GitHub Actions 拥有事件、权限和 runner。Vite Task 和项目命令在选中的机器上完成构建依赖和验证。分流可先在当前工具链上实施。迁移前的真实耗时、重跑和保护配置见[CI 专项审视](modernization-audit.md#ci-review)。

### 文件、作业与入口命名

工作流按触发事件、凭据和交付责任组织。GitHub 要求工作流 YAML 直接放在 `.github/workflows/`。正式目标保留下面三个入口，发行能力到所属工作包落地时建立。[GitHub 工作流文件规则](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

| 目标文件与显示名 | 持有的工作 | 现有文件如何处理 |
| --- | --- | --- |
| `ci.yml` · CI | PR 代码验证与手动兼容检查。一次选择，执行基础和选中的测试，再给出合并结论。 | 保留 `ci.yml`，吸收 `verification-repository.yml` 和 `verification-desktop.yml` 的实际作业，退役仅负责转发与汇总的 `verification.yml`。三份旧文件在替代入口通过真实 PR 对照后删除。 |
| `pr-title.yml` · PR title | 以当前 SHA 和最新标题检查 squash 标题格式。规则放在一个受信入口，轻量运行。 | 保留现有文件与检查名，去掉整套工程安装。若合并者在界面改写标题，由合并者核对最终文字。 |
| `release.yml` · Release | 由获授权的版本触发取得候选、完成签署和验收、留存并按摘要交付。按发布单位和通道控制并发，保护凭据只进入需要的作业。 | 建立真实发行能力时提供。在普通 PR 和手动代码验证中保留只读权限。 |

`ci.yml` 的作业 ID 采用 `plan`、`check`、`test`、`gate`。在界面中，`Plan` 说明选择理由，`Checks (linux-x64)` 给出基础反馈，`Test (<场景>, <目标>)` 显示实际断言和环境，例如 `Test (native, windows-arm64)`。`Required checks` 稳定汇总必需作业。同目标且共用一次环境准备的套件合成一行，步骤写明动作，例如 `Load native binding`、`Start desktop windows` 或 `Run development recovery`。其余作业按验证场景独立，摘要列出每项结论。文件名用职责，job ID 只在文件内引用，分支保护使用 GitHub 实际发布的检查名。[GitHub 作业语法](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobs)

变更到场景与目标的选择由 `tools/ci/plan.ts` 拥有，输入是事件、基础与候选提交，输出仅包含必需作业、套件、目标和选择理由。由工作流把任务和目标映射到已声明的 runner 与本地命令。使用已固定的 Node 原生能力、Git 和受版本控制的项目清单，能在安装 workspace 之前执行。范围例子贴近所属实现，任务体继续使用各项目已有的正式命令。工作流负责检出、runner、事件和调用顺序。共享准备只有在实际重复后才提取为单一 action 或可复用工作流。`release.yml` 的作业直接用 `Build`、`Sign`、`Verify`、`Publish` 加上适用的发布单位或目标，按实际产物交接拆分。

### 事件与合并结果

- **PR 的代码树。** 打开、重新打开、推送提交或改换目标分支时，检出本次合并候选 SHA，以对应的目标分支提交为基线。一次比较覆盖整份 PR，记录两个 SHA、改动路径及选择理由。新候选取消同一 PR 的旧代码作业。单改标题或正文时保留当前代码结论。监听 `edited` 时只对改换 base 启动代码验证。纯元数据事件使用独立的取消组和结果名称，保留正在运行或已失败的代码门禁。严格保护 main，目标分支前进后核对最新合并候选。启用合并队列时，按 `merge_group` 的基线和候选 SHA 验证代码，为该组所有受保护检查提供适用结果。[GitHub PR 与合并队列事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- **PR 标题。** 当前远端仅允许 squash，默认提交标题来自 PR 标题，且 `PR title` 是必需检查。保留这个快速元数据检查，为新 SHA 建立结果，标题变化时重新验证。以只读事件数据和一份受信的标题规则检查既定格式，依赖范围限于该规则。正文编辑期间，合并者仍能看到当前标题和代码的真实结果。标题不决定包版本。[Squash 配置](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-commit-squashing-for-pull-requests)
- **主线与手动运行。** PR 已在最新合并树通过时，普通 main push 复用该代码树的结果。遇到绕过 PR、紧急修复或无法关联的树，按实际差异补验。提供手动完整验证和明确的宿主复现入口，绑定指定提交、目标与场景。发行只从受保护的实际提交和对应版本进入候选流程。
- **选择与汇总。** 一个轻量步骤在安装项目依赖前读取 Git 差异，处理增加、删除、改名两端和混合改动。基本集合只区分文档与代码，专用检查按下表取并集。用项目清单、锁文件中的依赖关系及任务实际输入处理间接影响。例外集中在一处。无法取得可信的比较基线时执行只读完整兼容检查。已知项目中的新增路径按该项目的默认集合覆盖，无法归属的运行输入按其支持范围扩大到完整兼容。选择逻辑或必需工作流自身改变时，由维护者审阅其差异并验证下表的代表改动。策略无法读取输入或执行失败时，门禁失败。受保护的代码工作流始终产生稳定检查名。计划成功、基础检查成功、每项计划的附加作业成功才允许合并。明确未选择可以跳过，应执行而跳过、取消、失败或结果缺失都不能标绿。矩阵使用计划生成的精确目标行，选中步骤的失败退出码传播到作业。汇总分别处理空矩阵和非空矩阵。以 GitHub 的作业与矩阵结果核对完成情况，矩阵中同名布尔输出无需承担逐目标证明。[必需检查与路径过滤](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpull_requestpull_request_targetpathspaths-ignore) · [作业结果](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#needs-context)

### 改动与验证环境

普通代码 PR 的基础检查在 Linux x64 进行一次冻结安装、工作区自有类型检查、lint、格式、依赖边界和快速行为用例。独立的纯检查可以并行，共用输出按依赖顺序写入。完整样本中全仓作业用时 76 秒，支持先采用这一默认值。公开产物、窗口、原生或完整开发环境按下表选择环境。文档 PR 核对受版本控制的相对链接、锚点、移动或删除后的引用，内容与交互取舍由评审负责。配置 schema、测试输入、SQL 和源补丁按其实际用途处理。

| 变化 | 需要额外证明的事实与最低环境 |
| --- | --- |
| 纯文案、Markdown 或发布说明 | 文档检查可独立结束。发布说明属于版本候选输入时检验相应包的版本和 tarball 内容。 |
| 视觉 token、CSS、Solid 组件或窗口视图 | Linux x64 真 Chromium 验证适用的焦点、IME、样式与交互。导出的 CSS、公开子路径或样式装配有变时，运行相应包的独立 tarball 消费。涉及 preload、IPC 或窗口边界时再启动真实 Electron。 |
| 纯值、公开合同、RPC 或作者 SDK | 跑拥有包的行为和受影响调用方。公开声明、exports、运行入口或依赖变化时，检查实际打出的同一 tarball，在所承诺的 Node、浏览器或 Electron 环境消费。涉及真实传输的改动使用对应端点。 |
| SQL、迁移、持久化与文件 | 使用匹配的实际 Electron Node 驱动验证读回、约束、重开和迁移。WAL、fullfsync、路径或文件系统语义出现平台差异时追加对应系统。完整负载与窗口响应在性能相关改动或候选验收时单独测量。 |
| 开发 HMR、退出与工程进程 | HMR 的代表场景在 Linux x64 运行。编译输出交接或监视器变化追加曾复现该问题的 Intel Mac。Windows Job Object 在实际 Windows 上验证。改动覆盖原生绑定或预构建文件时包含 Windows x64/ARM64。Unix 进程组选对应系统验证，macOS 特有退出分支在 Mac 验证。 |
| 共用原生 ABI、Electron 升级、Rust 平台分支 | 共用二进制接入或运行时升级在六个实际目标编译、加载、调用并退出。单系统实现只选涉及的 OS 与架构，对受影响的构建、窗口或制品补验。必需目标缺席时报告未完成。同卷用例记录跨卷条件缺失，支持范围要求的跨卷证据从具备两个实际文件系统的环境取得。 |
| 打包配置、签名、安装或更新 | PR 验证受影响的目标和载体，运行工程制品并核对 fuses、资源加载及退出。可安装格式有变化时核对相应格式。发行候选在适用目标真正安装与升级，另记 Wayland、GPU、系统下限和签署身份等需要实机的结果。 |
| 依赖、CI 自身、新增工程 | 按变更的解析依赖及实际消费者扩大验证。纯 JS 开发工具升级跑基础检查和受影响工程入口，原生依赖变动按 ABI 处理。选择策略变化验证代表性的选择结果，并实际执行受影响的 runner 接线。未知共用工具链变化触发一次完整兼容验证。 |
| 扩展与独立发布单位 | 单扩展按适用合同、构建、真实 `.kisx` 安装和宿主能力验收。Kana 的浏览器引擎、Vantage 的桌面后端、libmpv-node 的媒体与 GPU、relay 的 HTTP 与目标镜像分别由所属项目负责。私有账号和生产服务使用获授权的独立环境。 |

### 执行、证据与恢复

同一目标共用已完成的安装、必要的浏览器、原生输出及应用构建。只安装所选任务使用的系统工具和浏览器。无共享写入的工作可以并行，写同一可重建目录的步骤由同一拥有者串行。取消过时 PR 时向所属进程传播取消并等待清理。平台测试有差异化断言，允许已运行的其他目标收集独立失败。只读的公共依赖可复用，数据库、profile 与可编辑源码按场景隔离。可重现任务的缓存键覆盖锁定输入、工具、宿主及所需 ABI，冷缓存仍须得到正确结果。现场测试、签名、发布及远端写入以实际执行为准。CI 的可选缓存包括依赖 store 和纯任务输出。恢复失败退回正常安装或冷构建，保存失败单列诊断。Vite+ 的跨作业缓存属于实验能力，先实测耗时与恢复正确性。[Vite Task 缓存](https://viteplus.dev/guide/github-actions-cache)

普通 PR 用作业日志和摘要说明场景、平台、结果与耗时，失败才保存必要的短期 trace、截图或日志。诊断上传与可选缓存失败显示为基础设施问题。若产物是下游检验必需的输入，交接缺失即阻断相应检验。已失败的测试保留首次错误，只有确认的安装、网络或传输故障才重试相应步骤。原 runner 消失且候选未被持久化时，重新构建、记录新的摘要并重验。近期 Intel Mac 的上传故障展示了这一差异。[失败步骤](https://github.com/ximu3/kisaki-dev/actions/runs/43565501268/job/132358470362) · [重跑作业](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)

性能工作在受影响的交互或发行验收中显式运行。固定代表设备核对输入响应、同步工作和完整负载，保留原始采样及执行计划。托管 runner 上的单次抖动保留诊断，再在可比较条件下复核。

版本 PR 核对版本、通道、依赖、公开说明与拟交付文件。临时开发仓和手动代码检查只验证候选，正式交付遵守实际仓库身份与授权条件。发行候选记录发布单位、版本、源码提交、目标、运行时/工具链与每个交付文件的摘要。适用签名完成后验证最终字节，并保存在本次发布可取回的存储中。包、扩展、桌面安装器、更新索引与镜像各自核对真实消费路径。发布阶段使用同一份已获验收的文件，按版本与发布单位串行推进。PR 作业只读，第三方 Action 固定完整提交 SHA。外部 PR 中的脚本或产物在隔离环境运行，可信发布作业只消费由受保护提交产生并已核实的候选。外部 PR 可以读取允许共享的依赖缓存，发布所用缓存只接受可信写入，缓存和报告均排除凭据。签署身份、OIDC 发布权限及部署环境留给受保护的发行作业。已发布的一部分先核对版本与摘要，再恢复剩余交付。[发行合同](../design/engineering/releases.md#publish) · [GitHub Actions 权限与固定 Action](https://docs.github.com/en/actions/reference/security/secure-use) · [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)

### 迁移验收

先在隔离 PR 中用同一候选树对照新旧范围，核对文档、CSS、公共合同、SQL、Windows 进程、共用 ABI、CI 自改以及改名/删除。再验证基础失败、单平台失败、合法空矩阵、意外跳过、取消及上传失效时的汇总结论。使用真实 PR 核对改标题、改正文、推送、改目标及重新打开时的状态。远端目前绑定 GitHub Actions 提供的 `verify / Required checks` 和 `PR title`。更名前在同一候选并行报告新旧检查，核对实际名称、来源 App 和阻断效果后，经仓库授权切换保护配置，最后移除旧入口。

普通 PR 的基础反馈目标约 3 分钟。仅涉及快速路径时，该反馈也应给出合并结论。平台专项与发行单列时间。分别记录事件创建至基础结果、至全部必需检查，以及每次尝试的排队、准备、断言、上传和累计 runner 时间。冷、热缓存与重跑分别比较。完整兼容及发行按实际范围报告，选中任务的正确性、失败可定位性和缺失证据的处理同样属于验收。

## 维护与发行

开发入口应从干净检出开始可复现。锁定的工具、平台输入和生成代码都有明确拥有者，公共生成器提供更新和核对入口。本地与 CI 调用同一工作流，资源准备以完成结果交接。依赖升级和弃用按受影响的运行端与消费者验证，源码、配置、IDE 和文档一起退役旧入口。[依赖维护](../design/engineering/workspace.md#dependencies)

工程包从[候选与交付流程](#ci-design)取得本次已验收的文件。版本变更、说明、归属及对外动作由对应[发行单位](../design/engineering/releases.md#publish)负责。长期证据按复现和交付的实际需要保存。[验证材料](../design/engineering/documentation.md#evidence)

## 实施顺序

1. 从现有入口确认输入、输出、宿主、调用方与清理责任，固定代表改动、公开产物和现有通过或失败的基线。当前开发说明继续记录实际可运行的命令。
2. 建立 Vite+、TS 7.1 和测试宿主入口，用公共包的完整消费路径迁移一遍。随后迁移全部六包与私有工程能力，核对冷构建和缓存恢复，再删除等价包装和旧依赖。
3. 迁移桌面源码开发、资源、原生绑定与测试结构，重点复测失败恢复、拒绝退出、子进程清理及制品身份。CI 复用这些入口，按改动影响选择环境。从普通 PR 到发行候选分别验证时间、正确性与证据交付。
4. 随已确认的工作包接续 SDK、CLI、扩展、独立项目与运行架构。同步正式规范、入口、配置、CI、IDE 与贡献说明，登记实际外部条件和证据。每次退役一条旧路径，检查其全部调用方、样板与说明。

## 选择依据

2026-11-14 查询 npm，`typescript@latest` 为 `7.0.2`，`beta` 为 `7.1.0-beta`，`rc` 为 `7.0.1-rc`。7.1 正式版的计划日期是 11 月 24 日。7.0 已提供 Go 原生编译器，7.1 提供新的 AST 与同步、异步工具 API。选 7.1 的理由是它能承担本仓项目检查、声明生成和工具 API 的迁移，并减少先引入 7.0、随后再改工具 API 的重复工作。预览版的实测用于开发分支，正式默认版本以实际发布和验收结果为准。[npm 发布标签](https://registry.npmjs.org/-/package/typescript/dist-tags) · [7.1 Beta 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/) · [发布计划](https://github.com/microsoft/TypeScript/issues/63703)

Turbo 当前用于上游构建顺序和产物恢复的做法成立。选择 Vite+ 是因为这两项职责可归入已有 Vite、Vitest 和库构建入口。它不会自行修好 CI 分流。当前选择测试要求外观 CSS 触发原生、开发、窗口和制品检查，随后 CI 将其扩至六目标。应由一个 CI 决策入口依据改动风险选择宿主和目标，Vite Task 负责执行选中的任务与其构建依赖。[现有选择用例](https://github.com/ximu3/kisaki-dev/blob/fac8ff6/tests/workspace/tasks.test.ts) · [现有目标分配](https://github.com/ximu3/kisaki-dev/blob/fac8ff6/.github/workflows/verification-desktop.yml)

| 运行基线 | 对应要求 |
| --- | --- |
| 完整 CI 墙钟 17 分 17 秒，各作业累计 63 分 51 秒。选择、缓存、上传和反馈口径的对照见[CI 专项审视](modernization-audit.md#ci-review)。 | 对纯文档、普通代码和平台专项分别验证从提交到结果的耗时。 |
| Windows ARM64 上 4 项开发场景合计约 6 分钟，4 个窗口合计 5.9 秒。Intel Mac 的开发服务器曾读到重建中的残缺包。[Windows 日志](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837785) · [热更新失败](https://github.com/ximu3/kisaki-dev/actions/runs/43564036464/job/132353969000) | 日常编辑使用源码。保留真实的语法错误修复、界面热更新与可取消退出。将这些场景放在能发现对应问题的改动与平台上。 |
| 完整负载中 16 个代表查询最慢 44.611 ms。同一份 5 万条目数据的本机补测中，采用中文、瑞典语、英语分别同步占用约 464、454、433 ms。再次采用相同中文为 0.002 ms。[存储测量](../verification/evidence/w06/README.md) | 数据库执行位置是本轮关联的运行架构改动。main 选择 i18n 实际生效的 locale，串行数据库执行端持有连接，完成重建后发布对应顺序。用窗口响应和查询正确性验收。 |

## 迁移分支实测

[PR #39 的六目标 CI](https://github.com/ximu3/kisaki-dev/actions/runs/43601249062) 已验证代码提交 `43441f7` 的合并候选。Windows、macOS、Linux 的 x64 与 ARM64 均完成原生加载、窗口启动、开发恢复、工程进程和制品验证。Linux x64 另完成源码 UI、公共包独立消费及完整负载。新旧两项汇总检查在同一候选成功。PR 以 W06 分支为基线，主线切换留待 TypeScript 7.1 正式版验收。

Windows x64 使用 Node 26.13.1、pnpm 12.18.0、Vite+ 1.6.0、TypeScript 7.1.0-beta 和 Electron 45.3.2。六个公共包通过源码构建、实际 tarball 的 publint、ATTW 和独立消费。开发态与包外消费者使用相同子路径，tarball 只包含分发条件。TypeScript 6.0.3 仅为 dependency-cruiser 18 的 AST 解析依赖，工作区检查和声明构建均使用 7.1。

- 常规检查通过 9 个项目类型任务、依赖图、格式、类型感知 lint 及 141 项快速测试。UI 的 9 项源码交互在真实 Chromium 运行，覆盖土耳其语大小写、补充平面汉字、焦点、IME 与虚拟列表。独立 tarball 的 Node、浏览器、Electron 和 Tailwind 验证分别由各包拥有。
- Electron Node 的 15 项集成、4 个实际窗口、4 项开发恢复与退出用例通过。开发测试按需复制可写载体与受改动的合同包，复用已安装的依赖和准备好的原生资源，每个场景分配独立 profile。20 次启动和完整存储负载在 Windows x64 通过。制品验收从同一 ZIP 解包，核对 fuses 后从外部启动和关闭。
- 5 万条目上，混合类型评分筛选以相关 EXISTS 按条目主键读取评估记录，列表、总数和定位共享谓词。相同输入的列表首读从 49.01 ms 降至 32.02 ms。16 个查询最高 43.84 ms。数据库线程切换中文、瑞典语与英语分别用时 488、483、458 ms，再次采用英语为 0.004 ms。期间 488 次窗口至主进程 IPC 的 P95 为 1.92 ms。此前本机和托管 Linux 分别曾录得 50.38、57.63 ms 的旧查询，按同一预算保留测量差异。
- 首次发行前的全项目规则已经并入[共用工程规范](../design/engineering/conventions.md#before-first-release)。本体开发数据使用当前初始迁移，Linux 资料根只接纳可确认的本地类型。第三方导入格式、真实已发表制品、目标宿主和发行后的前向升级各自按实际合同处理。

六目标结果对应上述工程候选。正式 7.1.x 及各发行单位的发布前证据另行登记。正式签署、安装升级、平台保护切换与生产发布仍按所属工作包与授权推进。

## 迁移前隔离试验

Windows x64 使用 Vite+ `1.6.0` 与 `typescript@7.1.0-beta`。以下为正式迁移前的隔离试验。迁移分支的实际命令见[开发说明](development.md)。

- **项目图与类型。** 在现有依赖上逐一运行仓库声明的 35 份分项 TS 配置，`tsc -p --noEmit` 全部通过。复制六个公共包的实际源码和依赖清单后，`vp run -r --dry-run --json build` 给出了预期拓扑，包括外观和分发先于合同、合同先于本地化、外观先于 UI。随后从工作区根执行 `vp run -r build`，六个包的构建任务全部成功。仓库中直接调用旧 TS 根入口 `readConfigFile` 与 `transpileModule` 的两处仍须迁移，前者的配置复述测试可随旧机制删除，后者交由正式编译入口处理。[仓库类型检查](https://github.com/ximu3/kisaki-dev/blob/fac8ff6/tests/workspace/typecheck-coverage.test.ts) · [Electron 消费样本](../../clients/desktop/packages/desktop-ui/tests/consumers/electron.test.ts)
- **发布包与消费。** 六个公共包通过 `vp pack` 生成 73 对 JS/声明入口。试验显式指定 7.1 Beta 原生声明生成器，并为每包提供包根的声明构建配置。类型检查和声明生成各有独立结果。原有深层配置触发 TS6059，分发包的声明配置还须覆盖纯入口及 `node/signing`。完成外观和 UI 的 CSS 与许可组装后，从重新打出的六个 tarball 提取并检验公开入口。16 份实际消费者类型配置全部通过，RPC 的公开 ESM 也由 Node 实际加载。试验复用了已安装的外部依赖。UI 包需使声明直接引用的 `@types/throttle-debounce` 对消费者可解析，本次在试验清单显式列入后，浏览器与 NodeNext 两种解析均通过。既有声明中也能看到这项引用。
- **缓存与真实运行。** 重复输入命中缓存，改动输入后重新执行。输入相同且输出文件缺失时，缓存命中并恢复正确字节。A→B→A 样例末次重新执行并交付正确内容。`vp test` 对已打包 RPC 的一个行为样本通过。正式验收另需实际的 Solid 热更新、Electron 流程、并发、锁文件变更和目标环境隔离。Vite+ 官方将 GitHub Actions 间的任务缓存复用列为实验能力。[缓存输入与输出](https://viteplus.dev/guide/automatic-data-tracking) · [跨作业缓存](https://viteplus.dev/guide/github-actions-cache)
- **lint 与格式。** Oxlint 曾实际检出未等待的 Promise。本次将项目规则直接映射到 Oxlint 后，523 个维护中的 TS/TSX 文件报告 544 条诊断，其中 527 条来自仓库内的独立消费者样板。它们应在装有实际 tarball 的工程内做类型感知 lint。其余 17 条留待按具体规则核对，其中包括 Playwright 的参数约定。Oxfmt `0.78.0` 只读扫描时有 23 个已跟踪文件会变化，其中一个是 Cargo.toml。保留格式选择与生成文件忽略范围，将首次格式差异独立审阅，Rust 工具继续拥有其工程文件。
- **安装边界。** 在 pnpm `11.11.0` 中，试验按 Vite+ 同版核心别名配置 Vite。Vitest 与 mocker 的两个 Vite peer 在有限版本说明后，`pnpm peers check` 通过。冻结安装遇到 tarball 下载错误，现有 store 也不足以完整离线安装。上述构建使用已有工具和本地链接。正式分支还需全新冻结安装及平台验证。落地须采用受支持的版本组合，保留严格 peer 检查。[官方别名与 peer 规则](https://viteplus.dev/guide/migrate-rules)

## 切换与验收

- [ ] **工程职责与目录。** 按上表逐族核对根、桌面、私有工程包、公共包及作者工具的入口、配置、测试和输出所有者。用实际依赖图核对运行端、工程与测试的导入边界，从制品核对公开 exports、安装包内容和作者模板。Vite Task 是唯一 JS/TS 任务调度器，退役的工具同时清理脚本、包导出、任务配置、缓存项、类型项目、样板与文档入口。
- [ ] **测试、共享准备与隔离。** 从同一份已验证 tarball 运行各包仍承诺的独立消费者，共用准备能在成功、取消和失败时清理。快速场景和真实开发场景分别运行，至少核对一次源码恢复、应用拒绝退出、测试运行中断后的进程回收，以及开发资料未被清理。按工程基线分开记录环境准备、编译和场景自身耗时，列出消除的复制或安装次数。长期用例只保留能发现具体错误的部分。

- [ ] **建立一套可复现的版本与入口。** 根仓用 pnpm 严格安装并冻结锁文件，记录 Node、Vite+、TypeScript 和声明生成器实际版本。准备阶段以 7.1 Beta 检查差距。正式版发布后以精确 7.1.x 重跑全部项目引用、消费者类型、失败退出码及关键 lint 诊断。IDE 使用工作区编译器，必要配置跟随项目。
- [ ] **完成开发、构建和制品消费。** 按真实依赖顺序完成六包及桌面构建，实际工程统一用 `vp run`、`vp pack`、`vp test`、`vp lint` 和 `vp fmt`。能删除旧文件、恢复缓存、隔离原生目标。公共包通过严格的独立 tarball 安装、声明、CSS、许可和实际宿主消费。源码路径的 Solid 状态保留、编译失败恢复、主进程重启或拒绝退出正常。完成后从所有清单、工作流、说明和测试辅助移除废弃的直接依赖与入口。
- [ ] **完成 CI 分流和平台交付。** 按[CI 方案](#ci-design)核对实际工作流文件、作业与保护检查名，验证选中、空矩阵、失败、取消和上传故障。用真实 PR 测量基础反馈与全部必需检查的耗时。用固定身份的最终候选验证签署、安装、升级、可取回及按摘要发布。
- [ ] **核对关联范围。** 完整数据上验证语言切换期间窗口可响应、同语言无重建、重开与回滚正确、列表分页和定位一致。梳理哪些包有实际外部发布承诺，涉及公共合同或独立仓库范围的调整由对应项目确认。按[全项目审视](modernization-audit.md)将 Linux 资料根分类、UI 语言匹配、凭据接入和平台基线归入相应工作包。对影响外部功能或数据目录支持的建议先确定方向，分别记录实际采纳、延期和验收证据。核对 SDK、CLI、官方扩展和四个独立项目各自的工具、样板、目标及发布责任，按已有源码、设计或真实运行结果登记阶段。

全部已确认范围实施并通过验收后，将长期规则并入[工程布局](../design/engineering/layout.md)、[工作区](../design/engineering/workspace.md)、[构建与交付](../design/engineering/build.md)、[验收标准](../verification/acceptance.md)、作者与独立项目的工程说明、实际开发命令，更新[实施状态](status.md)，再将本方案和配套审视一同移至 `refactor/implementation/archive/`，修正引用并记录归档日期。
