# Kisaki 全项目工程设计与现代化重构方案

**范围已明确，实施方案待确认。** 本轮覆盖从干净检出、开发调试、构建、测试到发布和维护的整个工程。根仓、桌面应用、公共包、私有工程包和官方扩展各自的源码、配置、工具、测试与制品都在范围内。四个独立项目按各自的宿主和发布单位接续。现行命令和交付结果分别见[开发说明](development.md)与[实施状态](status.md)。

JS/TS 建议采用 Vite+ 作为工程入口、TypeScript 7.1 作为编译器。迁移分支可用精确版本 `7.1.0-beta`，主线采用首个通过验收的 7.1.x 正式版。工具选型、`tools` 的职责和 `tests` 的组织共同服务于同一目标。开发者能从一次改动找到负责的源码，运行与之相关的检查，并辨认最终交付的是哪份文件。现有工程的主要问题与取舍见[全项目审视](modernization-audit.md#engineering-review)。

## 统一范围与工具归属

根仓、桌面应用、全部公共包、私有工具及后续官方扩展共用锁文件和任务执行器。根配置拥有共同默认值，各项目维护与其宿主或产物有关的配置。独立仓库采用同样的 JS/TS 工程约定，各自锁定版本、验证和交付。现代化、简洁、清晰、干净与克制共同决定取舍。一次性重做成本不影响选型，反馈时间、运行资源、兼容责任和长期维护计入成果质量。[根协作规范](../../AGENTS.md) · [判断与取舍](../design/engineering/conventions.md#judgment)

| 职责 | 终态选择 | 迁移与退役 |
| --- | --- | --- |
| 环境、依赖、脚本 | 工程宿主建议选 Node 26 LTS 和 pnpm 12，分别验证后锁定补丁。pnpm 管 workspace、catalog、`packageManager` 和 `pnpm-lock.yaml`。公共包 Node 消费下限与 Electron 内置 Node 分别维护。开发与 CI 调用项目锁定的 `vp`。 | Vite+ 和它管理的 Vite、Vitest、Oxc 版本共同升级。按官方迁移规则处理 Vite 核心别名和需要它的 peer。普通 TS 脚本通过 `vpx` 或 Node 支持的原生入口执行，真实 Node、子进程和 Electron 模式通过后清理直接的 tsx、jiti 接入。 |
| 调度与缓存 | `vp run` / Vite Task 是唯一 JS/TS 任务执行器。包之间按清单依赖拓扑执行。耗时且可重建的纯产物才开启缓存，声明其输出与影响结果的环境。 | 移除 Turbo 包、`turbo.json`、专用 GraphQL、两处重复的选择逻辑和只验证旧图形状的用例。缓存不可用时可冷构建并交付正确结果。跨 CI 作业复用先测正确性与节省的总时间，原生缓存含目标及工具链身份。[Vite Task](https://viteplus.dev/guide/run) · [GitHub Actions 缓存支持范围](https://viteplus.dev/guide/github-actions-cache) |
| 类型、lint、格式 | 各项目用锁定的 TS 7.1 检查自己的配置和引用，根任务按工作区实际依赖调用这些类型入口。仓库根的 `tsc -b` 仅覆盖根工具、配置和测试。`vp lint --type-aware` 使用配套 Oxlint 和 tsgolint，`vp fmt` 使用 Oxfmt。 | 每份源码只做一次正式类型检查。`vp check` 若用作格式/lint 入口，关闭它的额外 type-check。迁移必要的异步、公共合同和宿主边界检查后删除 ESLint、typescript-eslint、Prettier、对应配置包和消费者内的旧 API 调用。跨模块间接依赖由一个图检查看住，简单导入限制放在 Oxlint。[统一检查](https://viteplus.dev/guide/check) · [类型感知规则](https://oxc.rs/docs/guide/usage/linter/type-aware) |
| 开发、应用与库构建 | 应用使用 Vite+ 的 Vite/Rolldown 入口与 Solid 插件，公共库使用 `vp pack`，由底层 tsdown 生成 ESM、CSS 与声明。`pnpm pack` 从完成的公共包目录生成供外部消费的 tarball。 | 迁移并清理独立 tsdown CLI、重复配置和重复清理 `dist` 的步骤。开发态在工作区通过同一公开子路径解析源码，发行消费者走构建后的 exports。保留字体、样式组装、许可、沙箱 preload 和其他确有产品语义的步骤。[Vite+ 库构建](https://viteplus.dev/guide/pack) · [官方迁移规则](https://viteplus.dev/guide/migrate-rules) |
| 测试、提交与交付 | `vp test` 运行 Vitest 用例。Playwright 保有真实浏览器、键盘与 Electron 的验证，`vp run` 调度对应入口。GitHub Actions 拥有作业与平台选择。 | 使用 `vp staged` 与可选的本地 hook 取代重复的 Husky/lint-staged 接入，覆盖部分暂存、用户已有 hook 和 worktree 后再删除旧实现。公共发布包继续检查实际 tarball 和声明解析。按发行是否消费标题决定其自动检查。[Vite+ 提交钩子](https://viteplus.dev/guide/commit-hooks) |
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

迁移时把 `tools/build/coordinator.ts` 命名为 `tools/build/assemble.ts`，它组装运行目录并写出 `build.json`。`tools/build/manifest.ts` 负责该清单及文件摘要索引，`tools/lib/targets.ts` 负责目标身份和映射，`tools/package/distribution.ts` 负责分发载体元数据。`tools/dev/generation.ts` 改为 `tools/dev/prepare-runtime.ts`，表达它在应用启动前复制编译产物和原生资源的职责。

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

## 维护与发行

开发入口应从干净检出开始可复现。锁定的工具、平台输入和生成代码都有明确拥有者，公共生成器提供更新和核对入口。本地与 CI 调用同一工作流，资源准备以完成结果交接。依赖升级和弃用按受影响的运行端与消费者验证，源码、配置、IDE 和文档一起退役旧入口。[依赖维护](../design/engineering/workspace.md#dependencies)

从已检查的提交构建候选，按发行身份留存文件、摘要、许可和必要来源。普通 PR 报告运行结果，发行候选承担安装、升级、签署与制品可取回的验证。将运行失败与上传失败分别呈现，允许从仍可取回且摘要相同的候选重试交付。正式发布按所属项目授权和版本流程执行。[发行流程](../design/engineering/releases.md#publish) · [验证材料](../design/engineering/documentation.md#evidence)

## 实施顺序

1. 从现有入口确认输入、输出、宿主、调用方与清理责任，固定代表改动、公开产物和现有通过或失败的基线。当前开发说明继续记录实际可运行的命令。
2. 建立 Vite+、TS 7.1 和测试宿主入口，用公共包的完整消费路径迁移一遍。随后迁移全部六包与私有工程能力，核对冷构建和缓存恢复，再删除等价包装和旧依赖。
3. 迁移桌面源码开发、资源、原生绑定与测试结构，重点复测失败恢复、拒绝退出、子进程清理及制品身份。CI 复用这些入口，按改动影响选择环境。从普通 PR 到发行候选分别验证时间、正确性与证据交付。
4. 随已确认的工作包接续 SDK、CLI、扩展、独立项目与运行架构。同步正式规范、入口、配置、CI、IDE 与贡献说明，登记实际外部条件和证据。每次退役一条旧路径，检查其全部调用方、样板与说明。

## 选择依据

2026-11-14 查询 npm，`typescript@latest` 为 `7.0.2`，`beta` 为 `7.1.0-beta`，`rc` 为 `7.0.1-rc`。7.1 正式版的计划日期是 11 月 24 日。7.0 已提供 Go 原生编译器，7.1 提供新的 AST 与同步、异步工具 API。选 7.1 的理由是它能承担本仓项目检查、声明生成和工具 API 的迁移，并减少先引入 7.0、随后再改工具 API 的重复工作。预览版的实测用于开发分支，正式默认版本以实际发布和验收结果为准。[npm 发布标签](https://registry.npmjs.org/-/package/typescript/dist-tags) · [7.1 Beta 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/) · [发布计划](https://github.com/microsoft/TypeScript/issues/63703)

Turbo 当前用于上游构建顺序和产物恢复的做法成立。选择 Vite+ 是因为这两项职责可归入已有 Vite、Vitest 和库构建入口。它不会自行修好 CI 分流。当前选择测试要求外观 CSS 触发原生、开发、窗口和制品检查，随后 CI 将其扩至六目标。应由一个 CI 决策入口依据改动风险选择宿主和目标，Vite Task 负责执行选中的任务与其构建依赖。[现有选择用例](../../tests/workspace/tasks.test.ts) · [现有目标分配](../../.github/workflows/verification-desktop.yml)

| 运行基线 | 对应要求 |
| --- | --- |
| 完整 CI 墙钟 17 分 17 秒，作业累计 63 分 51 秒，全仓检查作业 76 秒。较窄的合同/UI PR 为 2 分 59 秒。[完整运行](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494) · [窄改动](https://github.com/ximu3/kisaki-dev/actions/runs/43387908836) | 普通 PR 以约 3 分钟得到结果为目标。在相近 runner 和缓存条件下报告墙钟、各作业累计用时和上传字节数。 |
| Windows ARM64 上 4 项开发场景合计约 6 分钟，4 个窗口合计 5.9 秒。Intel Mac 的开发服务器曾读到重建中的残缺包。[Windows 日志](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837785) · [热更新失败](https://github.com/ximu3/kisaki-dev/actions/runs/43564036464/job/132353969000) | 日常编辑使用源码。保留真实的语法错误修复、界面热更新与可取消退出。将这些场景放在能发现对应问题的改动与平台上。 |
| 一轮完整上传约 1.75 GB。另一次桌面运行通过后因 DNS 故障上传失败。[作业日志](https://github.com/ximu3/kisaki-dev/actions/runs/43565501268/job/132358470362) | 普通 PR 提供结果和失败诊断。发行候选分别记录制品生成、实际启动、安装升级和证据交付。 |
| 完整负载中 16 个代表查询最慢 44.611 ms。同一份 5 万条目数据的本机补测中，采用中文、瑞典语、英语分别同步占用约 464、454、433 ms。再次采用相同中文为 0.002 ms。[存储测量](../verification/evidence/w06/README.md) | 数据库执行位置是本轮关联的运行架构改动。main 选择 i18n 实际生效的 locale，串行数据库执行端持有连接，完成重建后发布对应顺序。用窗口响应和查询正确性验收。 |

## 已取得的迁移证据

Windows x64 使用 Vite+ `1.6.0` 与 `typescript@7.1.0-beta`。以下为隔离试验，项目依赖清单、锁文件和 CI 仍按[当前工程](development.md)运行。

- **项目图与类型。** 在现有依赖上逐一运行仓库声明的 35 份分项 TS 配置，`tsc -p --noEmit` 全部通过。复制六个公共包的实际源码和依赖清单后，`vp run -r --dry-run --json build` 给出了预期拓扑，包括外观和分发先于合同、合同先于本地化、外观先于 UI。随后从工作区根执行 `vp run -r build`，六个包的构建任务全部成功。仓库中直接调用旧 TS 根入口 `readConfigFile` 与 `transpileModule` 的两处仍须迁移，前者的配置复述测试可随旧机制删除，后者交由正式编译入口处理。[仓库类型检查](../../tests/workspace/typecheck-coverage.test.ts) · [Electron 消费样本](../../clients/desktop/packages/desktop-ui/tests/consumers/electron.test.ts)
- **发布包与消费。** 六个公共包通过 `vp pack` 生成 73 对 JS/声明入口。试验显式指定 7.1 Beta 原生声明生成器，并为每包提供包根的声明构建配置。类型检查和声明生成各有独立结果。原有深层配置触发 TS6059，分发包的声明配置还须覆盖纯入口及 `node/signing`。完成外观和 UI 的 CSS 与许可组装后，从重新打出的六个 tarball 提取并检验公开入口。16 份实际消费者类型配置全部通过，RPC 的公开 ESM 也由 Node 实际加载。试验复用了已安装的外部依赖。UI 包需使声明直接引用的 `@types/throttle-debounce` 对消费者可解析，本次在试验清单显式列入后，浏览器与 NodeNext 两种解析均通过。既有声明中也能看到这项引用。
- **缓存与真实运行。** 重复输入命中缓存，改动输入后重新执行。输入相同且输出文件缺失时，缓存命中并恢复正确字节。A→B→A 样例末次重新执行并交付正确内容。`vp test` 对已打包 RPC 的一个行为样本通过。正式验收另需实际的 Solid 热更新、Electron 流程、并发、锁文件变更和目标环境隔离。Vite+ 官方将 GitHub Actions 间的任务缓存复用列为实验能力。[缓存输入与输出](https://viteplus.dev/guide/automatic-data-tracking) · [跨作业缓存](https://viteplus.dev/guide/github-actions-cache)
- **lint 与格式。** Oxlint 曾实际检出未等待的 Promise。本次将项目规则直接映射到 Oxlint 后，523 个维护中的 TS/TSX 文件报告 544 条诊断，其中 527 条来自仓库内的独立消费者样板。它们应在装有实际 tarball 的工程内做类型感知 lint。其余 17 条留待按具体规则核对，其中包括 Playwright 的参数约定。Oxfmt `0.78.0` 只读扫描时有 23 个已跟踪文件会变化，其中一个是 Cargo.toml。保留格式选择与生成文件忽略范围，将首次格式差异独立审阅，Rust 工具继续拥有其工程文件。
- **安装边界。** 在 pnpm `11.11.0` 中，试验按 Vite+ 同版核心别名配置 Vite。Vitest 与 mocker 的两个 Vite peer 在有限版本说明后，`pnpm peers check` 通过。冻结安装遇到 tarball 下载错误，现有 store 也不足以完整离线安装。上述构建使用已有工具和本地链接。正式分支还需全新冻结安装及平台验证。落地须采用受支持的版本组合，保留严格 peer 检查。[官方别名与 peer 规则](https://viteplus.dev/guide/migrate-rules)

## 切换与验收

- [ ] **工程职责与目录。** 按上表逐族核对根、桌面、私有工程包、公共包及作者工具的入口、配置、测试和输出所有者。用实际依赖图核对运行端、工程与测试的导入边界，从制品核对公开 exports、安装包内容和作者模板。Vite Task 是唯一 JS/TS 任务调度器，退役的工具同时清理脚本、包导出、任务配置、缓存项、类型项目、样板与文档入口。
- [ ] **测试、共享准备与隔离。** 从同一份已验证 tarball 运行各包仍承诺的独立消费者，共用准备能在成功、取消和失败时清理。快速场景和真实开发场景分别运行，至少核对一次源码恢复、应用拒绝退出、测试运行中断后的进程回收，以及开发资料未被清理。按工程基线分开记录环境准备、编译和场景自身耗时，列出消除的复制或安装次数。长期用例只保留能发现具体错误的部分。

- [ ] **建立一套可复现的版本与入口。** 根仓用 pnpm 严格安装并冻结锁文件，记录 Node、Vite+、TypeScript 和声明生成器实际版本。准备阶段以 7.1 Beta 检查差距。正式版发布后以精确 7.1.x 重跑全部项目引用、消费者类型、失败退出码及关键 lint 诊断。IDE 使用工作区编译器，必要配置跟随项目。
- [ ] **完成开发、构建和制品消费。** 按真实依赖顺序完成六包及桌面构建，实际工程统一用 `vp run`、`vp pack`、`vp test`、`vp lint` 和 `vp fmt`。能删除旧文件、恢复缓存、隔离原生目标。公共包通过严格的独立 tarball 安装、声明、CSS、许可和实际宿主消费。源码路径的 Solid 状态保留、编译失败恢复、主进程重启或拒绝退出正常。完成后从所有清单、工作流、说明和测试辅助移除废弃的直接依赖与入口。
- [ ] **完成 CI 分流和平台交付。** 文档改动只做相关文档检查。外观 CSS 做样式消费与浏览器。SQL 与迁移使用真实驱动。Windows 命令树回收使用 Windows。公共合同验证受影响的外部消费者，共用 ABI、Electron 或打包策略的变化按实际影响扩大范围。保留稳定的必需检查和可诊断的失败结果。发行候选在 Windows、macOS、Linux 的 x64、ARM64 上核对适用的安装、运行与升级。冷缓存与热缓存分别衡量实际反馈时间。
- [ ] **核对关联范围。** 完整数据上验证语言切换期间窗口可响应、同语言无重建、重开与回滚正确、列表分页和定位一致。梳理哪些包有实际外部发布承诺，涉及公共合同或独立仓库范围的调整由对应项目确认。按[全项目审视](modernization-audit.md)将 Linux 资料根分类、UI 语言匹配、凭据接入和平台基线归入相应工作包。对影响外部功能或数据目录支持的建议先确定方向，分别记录实际采纳、延期和验收证据。核对 SDK、CLI、官方扩展和四个独立项目各自的工具、样板、目标及发布责任，按已有源码、设计或真实运行结果登记阶段。

全部已确认范围实施并通过验收后，将长期规则并入[工程布局](../design/engineering/layout.md)、[工作区](../design/engineering/workspace.md)、[构建与交付](../design/engineering/build.md)、[验收标准](../verification/acceptance.md)、作者与独立项目的工程说明、实际开发命令，更新[实施状态](status.md)，再将本方案和配套审视一同移至 `refactor/implementation/archive/`，修正引用并记录归档日期。
