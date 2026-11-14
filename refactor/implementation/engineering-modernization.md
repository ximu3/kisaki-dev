# 工程现代化重构

状态　方案评审中。2026-11-14 已核对工作区、CI 和候选工具，并在 Windows x64 完成本文列出的试验。工程实现与整体验收待开展。当前开发命令见[当前工程与开发](development.md)。

## 要求与基线

按现代化、简洁、清晰、干净与克制设计长期使用的工程。优先评估能够缩短反馈、消除中间产物或减少自建机制的现代方案。重做成本不影响终态选择。运行时间、资源消耗、依赖维护和用户等待都计入选择。共同原则见[根协作规范](../../AGENTS.md)和[判断与取舍](../design/engineering/conventions.md#judgment)。

| 观察对象 | 当前证据 | 重构要解决的问题 |
| --- | --- | --- |
| PR 反馈 | 一次完整 CI 耗时 17 分 17 秒，作业累计 63 分 51 秒，其中全仓检查作业 76 秒。较窄的合同/UI PR 耗时 2 分 59 秒。[完整运行](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494) · [窄改动](https://github.com/ximu3/kisaki-dev/actions/runs/43387908836) | 普通改动目标约 3 分钟取得结论。发布前六目标覆盖按实际平台能力保留。 |
| 热更新 | Windows ARM64 上四项开发场景合计约 6 分钟，四个真实窗口合计 5.9 秒。Intel Mac 曾在公共包 `dist` 重建期间读到缺失的分块。[Windows 日志](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837785) · [热更新失败](https://github.com/ximu3/kisaki-dev/actions/runs/43564036464/job/132353969000) | 日常编辑直接消费源码。保留一次真正的编译失败、修复与界面恢复。 |
| 制品 | 完整运行上传约 1.75 GB。另一次 Intel Mac 的桌面用例和制品启动都通过，上传时 DNS 解析失败导致整个作业重跑。[上传日志](https://github.com/ximu3/kisaki-dev/actions/runs/43565501268/job/132358470362) | PR 提供可诊断的结果。发行候选留存最终制品，并分别记录生成、运行、安装与升级。 |
| 数据库 | 5 万条目的 16 个代表查询中最慢 44.611 ms。同一负载、同一驱动的本机补测中，采用中文、瑞典语、英语分别同步耗时约 464、454、433 ms，再次采用相同中文耗时 0.002 ms。[负载与环境](../verification/evidence/w06/README.md) · [索引切换实现](../../clients/desktop/app/src/main/infrastructure/database/name-order.ts) | 生效软件语言继续拥有名称顺序。整库索引重建移出主进程事件循环。 |

## 实施方案

1. **收窄日常 CI。** 普通 PR 做相关静态检查和行为验证。CSS 走样式消费与浏览器，数据库变更走实际驱动，公开合同变更走受影响消费者。窗口、进程、文件系统和原生 ABI 的差异决定需要哪些平台。共用原生绑定或交付链变化按影响扩大范围。发行候选覆盖 Windows、macOS、Linux 的 x64 与 ARM64，安装与升级读取最终交付字节。保留一个能准确说明跳过、失败和完成的必需检查。
2. **简化工作区与开发入口。** pnpm 拥有依赖关系和锁文件。开发入口按公开子路径解析源码，配套处理 Solid、CSS 和多进程入口，Vite 接管应用模块更新。公共包发行入口生成 ESM、样式和声明，外部消费使用实际 tarball。比较构建工具时一起计算需要删除或继续维护的脚本。一个输出目录只由一个构建步骤清理和生成。
3. **按发现的错误取舍测试。** 保留数据库中断回滚、文件不覆盖、节点权限、焦点和输入法、退出拒绝和热更新恢复。按实际宿主使用 Vitest、浏览器或 Electron。减少为了复述任务图、文件后缀和工具配置而构造的临时仓库。Git 钩子提供可选的本地反馈，PR 标题检查按实际发行用途决定。性能检查保留结果正确性对照、完整负载、执行计划和原始分布，在可比较环境中复核响应预算。
4. **调整运行边界。** main 采用 i18n 的实际生效语言。建议用单个串行数据库执行端持有连接，安排索引重建与相关查询，成功后才向列表发布新顺序。普通编辑和窗口消息在此期间仍可处理。独立发布的库按真实外部消费者与稳定合同确定，私有模块按维护职责组织。原生模块继续承担确有平台差异的操作。

## Turbo、TypeScript 与 VoidZero 工具链

**Turborepo。** 当前 `2.11.10` 用 `^build` 表达上游包产物，用 `outputs` 声明可恢复的文件，适用于通过已构建 exports 消费公共包的方式。现有缓存用例通过 A→B→A 构建验证了旧输出的正确恢复。[Turbo 配置](https://turborepo.dev/docs/reference/configuration) · [缓存恢复用例](../../tests/workspace/cache.test.ts)

`affectedUsingTaskInputs` 同时沿任务依赖传播变更。仓库的选择用例明确要求修改外观 CSS 时选中原生、开发、窗口和制品测试，CI 再将其中任一项扩到六目标。仓库和桌面工作流还各执行一次范围判定。建议保留一个任务图用于构建依赖和缓存，只在一个地方决定 CI 的运行环境。优先验证内置 `turbo query affected` 的输出是否足以取代自定义查询，评估 Vite Task 时使用同一组输入。若后者能用更少配置满足同样的范围、依赖和缓存要求，就让它接管相应职责。[Turbo 查询语义](https://turborepo.dev/docs/reference/query) · [仓库选择用例](../../tests/workspace/tasks.test.ts) · [目标分配](../../.github/workflows/verification-desktop.yml)

**TypeScript。** 2026-11-14 实查 npm 的 `latest` 为 `7.0.2`，`beta` 为 `7.1.0-beta`，`rc` 仍为 `7.0.1-rc`。当日 7.1 的非每日构建只查到 Beta。微软于 10 月 20 日公布 Beta，迭代计划列出的 11 月 10 日 RC、11 月 24 日正式版均为计划日期。7.0 已采用 Go 原生编译器，7.1 增加 `typescript/ast`、`typescript/sync`、`typescript/async` 等工具 API。[npm 发布标签](https://registry.npmjs.org/-/package/typescript/dist-tags) · [7.1 Beta 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/) · [迭代计划](https://github.com/microsoft/TypeScript/issues/63703)

仓库锁定 `6.0.3`。使用隔离安装的 `7.1.0-beta`，对 `desktop-contracts` 的 `tsconfig.lib.json` 和桌面 `tsconfig.main.json` 执行 `tsc -p` 均通过。根入口实测没有旧的 `readConfigFile` 和 `transpileModule`，仓库各有一处直接调用。`typescript-eslint@8.72.0` 声明支持 `<6.1.0`，锁定的 `rolldown-plugin-dts@0.28.8` 支持 `~7.0.0`，其 `0.30.2` 已声明支持 7.1 预发布范围。建议现在评估 7.1，以全仓构建、声明制品与工具兼容结果决定默认编译器；届时重新核对发布标签。[覆盖检查](../../tests/workspace/typecheck-coverage.test.ts) · [Electron 消费用例](../../clients/desktop/packages/desktop-ui/tests/consumers/electron.test.ts) · [声明插件版本信息](https://registry.npmjs.org/rolldown-plugin-dts/0.30.2)

| 候选 | 已核对的能力 | 采用条件 |
| --- | --- | --- |
| Oxlint `1.93.0` + `oxlint-tsgolint` `7.0.2007` | 在隔离 TS 工程开启 `--type-aware`，未等待的 Promise 触发 `typescript/no-floating-promises` 并以错误退出。包清单列出六目标的原生包。 | 优先试作主 lint。对项目真正需要的异步错误、类型安全、运行端导入边界与 Solid TSX 核对诊断。架构边界保留单一拥有者，再移除重复的 ESLint 规则。[类型感知检查](https://oxc.rs/docs/guide/usage/linter/type-aware) |
| Oxfmt `0.78.0` | 用当前格式选项只读检查 6 个既有文件，覆盖 TS、TSX、CSS、JSON 和 YAML。初次仅 `package.json` 的字段顺序不同，显式设 `sortPackageJson: false` 后 6 个均通过。 | 优先试作主格式工具。以现有维护范围作全仓只读检查，单独审阅希望采用的格式差异、忽略目录和生成文件，再切换提交与 CI 入口。[Prettier 迁移说明](https://oxc.rs/docs/guide/usage/formatter/migrate-from-prettier) |
| Rolldown、Vite、tsdown | 当前 Vite `8.3.3`、tsdown `0.23.0` 已共享锁定的 Rolldown `1.2.15`。应用与公开库各有产物要求。 | 延续同一底层构建器。比较 tsdown 与 `vp pack` 接入所需的配置，核对 ESM 子路径、CSS Modules、无 DOM 的声明消费、许可文件与 tarball 内容。[Vite 8](https://vite.dev/blog/announcing-vite8) · [tsdown 声明生成](https://tsdown.dev/options/dts) · [Vite+ 打包](https://viteplus.dev/guide/pack) |
| VoidZero Vite+ `1.6.0` / Vite Task | Windows x64 单任务试验中，重复输入命中缓存，修改输入后正确重建。A→B→A 样例末次重新执行，产物正确。这个结果只验证了重建路径。 | 在项目包图验证依赖顺序、跨版本产物恢复、环境与原生目标隔离、CI 分流和远端制品。与 Turbo 比较同一改动的配置和总耗时，择一调度同一组任务。[Vite Task](https://viteplus.dev/guide/run) · [缓存输入与输出](https://viteplus.dev/guide/automatic-data-tracking) |

## 验收与归档

- [ ] **CI 反馈。** 用独立的文档、外观 CSS、公开合同、数据库、Windows 进程和共用原生改动核对实际所选作业。记录从提交到结果的用时、各作业累计时间和上传字节数。文档与 CSS 的记录可直接看见哪些机器启动了。普通约 3 分钟的目标以真实 PR 复测。
- [ ] **构建与工具。** 对候选运行同一组冷构建、热缓存和变更后构建，校验被恢复的产物及失败退出码。以最终组合执行工作区 `tsc -b`、有类型信息的 lint、Solid 浏览器与 Electron 检查和公共包的独立声明消费，记录版本及仍有用的工具。每项选择留在实际拥有其配置的工程。
- [ ] **开发与产品行为。** 在源码编辑路径验证 CSS 状态保留、纯界面依赖更新、编译失败后恢复及主进程正常退出。以同一完整数据库复核语言切换时的窗口响应、分页与定位一致、事务回滚、重开和退出。
- [ ] **交付。** 代表 PR 能产生可读结果和失败诊断。实际发行候选按支持环境记录构建、安装、运行与升级结果，按平台注明证据范围。六目标最终制品可取回，上传失败能够与应用运行失败分辨。

实施者在每项完成时附上可复核的提交、运行或测量。全部已确认范围实施并通过验收后，将长期规则并入各自的设计与开发文档，更新[实施状态](status.md)，再将本文件移至 `refactor/implementation/archive/engineering-modernization.md` 并修正链接。实际归档日期与最终证据届时填写。
