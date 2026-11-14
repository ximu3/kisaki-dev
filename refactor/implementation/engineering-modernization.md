# 全项目 Vite+ 与 TypeScript 7.1 重构方案

**状态　方案待确认。** 2026-11-14。建议全面采用 Vite+ 管理 Kisaki 的 JavaScript 和 TypeScript 工程，选定 TypeScript 7.1 作为项目编译器。工作区可以立即用精确版本 `7.1.0-beta` 开始迁移。主线默认采用首个通过本文验收的 7.1.x 正式版。当前工程命令与已交付状态分别见[开发说明](development.md)和[实施状态](status.md)。跨产品、平台、扩展与运行时的发现见[全项目现代化审视](modernization-audit.md)。

## 统一范围与工具归属

根仓、桌面应用、全部公共包、私有工具及后续官方扩展共用一套命令、一份工作区锁文件和一个任务执行器。每个工作区只在实际拥有构建或测试配置的项目设置相应选项。独立仓库采用同样的 JS/TS 工程约定，各自锁定版本、验证和交付。现代化、简洁、清晰、干净与克制共同决定取舍。一次性重做成本不影响选型，反馈时间、运行资源、兼容责任和长期维护计入成果质量。[根协作规范](../../AGENTS.md) · [判断与取舍](../design/engineering/conventions.md#judgment)

| 职责 | 终态选择 | 迁移与退役 |
| --- | --- | --- |
| 环境、依赖、脚本 | 工程宿主建议选 Node 26 LTS 和 pnpm 12，分别验证后锁定补丁。pnpm 管 workspace、catalog、`packageManager` 和 `pnpm-lock.yaml`。公共包 Node 消费下限与 Electron 内置 Node 分别维护。开发与 CI 调用项目锁定的 `vp`。 | Vite+ 和它管理的 Vite、Vitest、Oxc 版本共同升级。按官方迁移规则处理 Vite 核心别名和需要它的 peer。普通 TS 脚本通过 `vpx` 或 Node 支持的原生入口执行，真实 Node、子进程和 Electron 模式通过后清理直接的 tsx、jiti 接入。 |
| 调度与缓存 | `vp run` / Vite Task 是唯一 JS/TS 任务执行器。包之间按清单依赖拓扑执行。耗时且可重建的纯产物才开启缓存，声明其输出与影响结果的环境。 | 移除 Turbo 包、`turbo.json`、专用 GraphQL、两处重复的选择逻辑和只验证旧图形状的用例。缓存不可用时可冷构建并交付正确结果。跨 CI 作业复用先测正确性与节省的总时间，原生缓存含目标及工具链身份。[Vite Task](https://viteplus.dev/guide/run) · [GitHub Actions 缓存支持范围](https://viteplus.dev/guide/github-actions-cache) |
| 类型、lint、格式 | `vp exec tsc -b` 调用项目锁定的 TS 7.1，负责项目引用、类型诊断与编译器版本。`vp lint --type-aware` 使用配套 Oxlint 和 tsgolint，`vp fmt` 使用 Oxfmt。 | 每份源码只做一次正式类型检查。`vp check` 若用作格式/lint 入口，关闭它的额外 type-check。迁移必要的异步、公共合同和宿主边界检查后删除 ESLint、typescript-eslint、Prettier、对应配置包和消费者内的旧 API 调用。跨模块间接依赖由一个图检查看住，简单导入限制放在 Oxlint。[统一检查](https://viteplus.dev/guide/check) · [类型感知规则](https://oxc.rs/docs/guide/usage/linter/type-aware) |
| 开发、应用与库构建 | 应用使用 Vite+ 的 Vite/Rolldown 入口与 Solid 插件，公共库使用 `vp pack`，由底层 tsdown 生成 ESM、CSS 与声明。`pnpm pack` 从完成的公共包目录生成供外部消费的 tarball。 | 迁移并清理独立 tsdown CLI、重复配置和重复清理 `dist` 的步骤。开发态在工作区通过同一公开子路径解析源码，发行消费者走构建后的 exports。保留字体、样式组装、许可、沙箱 preload 和其他确有产品语义的步骤。[Vite+ 库构建](https://viteplus.dev/guide/pack) · [官方迁移规则](https://viteplus.dev/guide/migrate-rules) |
| 测试、提交与交付 | `vp test` 运行 Vitest 用例。Playwright 保有真实浏览器、键盘与 Electron 的验证，`vp run` 调度对应入口。GitHub Actions 拥有作业与平台选择。 | 使用 `vp staged` 与可选的本地 hook 取代重复的 Husky/lint-staged 接入，覆盖部分暂存、用户已有 hook 和 worktree 后再删除旧实现。公共发布包继续检查实际 tarball 和声明解析。按发行是否消费标题决定其自动检查。[Vite+ 提交钩子](https://viteplus.dev/guide/commit-hooks) |
| 原生与专用交付 | Rust 编译、格式和 Clippy 由 Cargo 负责，Node-API 绑定由 napi-rs 交付。Electron 的最终格式、fuses、签署、安装与升级归 electron-builder 及平台工具。SQLite、Drizzle 迁移继续使用原生驱动和正式迁移器。 | Vite+ 汇集运行命令。Vantage 与 libmpv-node 的 JS 接入采用统一约定，原生后端按实际平台验收。Kana 的阅读内核、oauth-relay 的 Node/Hono 服务分别保留浏览器与容器交付。这四个独立仓库的实际迁移由各自项目验证。[独立项目范围](../design/projects/README.md) |

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

- [ ] **建立一套可复现的版本与入口。** 根仓用 pnpm 严格安装并冻结锁文件，记录 Node、Vite+、TypeScript 和声明生成器实际版本。准备阶段以 7.1 Beta 检查差距。正式版发布后以精确 7.1.x 重跑全部项目引用、消费者类型、失败退出码及关键 lint 诊断。IDE 使用工作区编译器，必要配置跟随项目。
- [ ] **完成开发、构建和制品消费。** 按真实依赖顺序完成六包及桌面构建，实际工程统一用 `vp run`、`vp pack`、`vp test`、`vp lint` 和 `vp fmt`。能删除旧文件、恢复缓存、隔离原生目标。公共包通过严格的独立 tarball 安装、声明、CSS、许可和实际宿主消费。源码路径的 Solid 状态保留、编译失败恢复、主进程重启或拒绝退出正常。完成后从所有清单、工作流、说明和测试辅助移除废弃的直接依赖与入口。
- [ ] **完成 CI 分流和平台交付。** 文档改动只做相关文档检查。外观 CSS 做样式消费与浏览器。SQL 与迁移使用真实驱动。Windows 命令树回收使用 Windows。公共合同验证受影响的外部消费者，共用 ABI、Electron 或打包策略的变化按实际影响扩大范围。保留稳定的必需检查和可诊断的失败结果。发行候选在 Windows、macOS、Linux 的 x64、ARM64 上核对适用的安装、运行与升级。冷缓存与热缓存分别衡量实际反馈时间。
- [ ] **核对关联范围。** 完整数据上验证语言切换期间窗口可响应、同语言无重建、重开与回滚正确、列表分页和定位一致。梳理哪些包有实际外部发布承诺，涉及公共合同或独立仓库范围的调整由对应项目确认。按[全项目审视](modernization-audit.md)将 Linux 资料根分类、UI 语言匹配、凭据接入和平台基线归入相应工作包。对影响外部功能或数据目录支持的建议先确定方向，分别记录实际采纳、延期和验收证据。

全部已确认范围实施并通过验收后，将长期规则并入所属设计和开发说明，更新[实施状态](status.md)，再将本方案和配套审视一同移至 `refactor/implementation/archive/`，修正引用并记录归档日期。
