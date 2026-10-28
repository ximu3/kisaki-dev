# 脚本范围与工程边界修正

本轮按用户确认采用[审查建议](../README.md)。根定向脚本先标范围，包内脚本先标动作；桌面八包的产物和真实消费者由桌面工作流的 Linux x64 参考目标拥有。

## 已实施

- 根入口改为 desktop:packages:pack、desktop:packages:test:consumers、desktop:packages:test:consumers:prepared，以及 root:typecheck／root:lint／root:test。应用使用 build:native、check:native、prepare:resources；根维护动作使用 install:hooks／uninstall:hooks。
- 包级 publint／ATTW 入口改为 check:package。八包 README 明确使用 pnpm run pack；生成消费者使用 test:node，其默认 tsconfig.json 组织四个真实声明检查环境。
- 桌面包收集归 tools/desktop，消费者、辅助和试件归 tests/desktop，收据与 tarball 归 artifacts/desktop/packages，环境变量为 KISAKI_DESKTOP_PACKAGE_INPUTS。公开 npm 包名和 exports 未改动。
- 桌面消费者选择只接受本组包的 check:package 和准确的根 prepared 任务；其变化只选择 Linux x64。仓库流程保留全仓普通检查，桌面流程组织消费者与实际桌面验收。
- 工程 workflow、共同协调器和标题 workflow 分别处理输入；移除全部 workflow 作为 Turbo 全局依赖的传播。生产构建、构建身份和监听排除测试配置与测试文件，继续发现新生产文件。非类型 lint 只补充实际共用的 ESLint 源码和清单，不再传递所有上游产品源码。
- workspace 登记来自 pnpm，并与维护树中独立发现的 package.json 比较；源码覆盖和依赖扫描不固定顶层工程目录。类型覆盖沿默认 tsconfig.json 及 references，不解析 tsc 命令文本。桌面许可约束与现有三个私有工程包分别有明确范围。
- 可调用工作流统一返回 selected／verified，根门禁逐一检查 needs 的工作流结果与标记。缓存键及恢复前缀明确包含 repository 或 desktop，不依赖跨工作流 job ID 唯一。

没有删除现有验收断言、减少六目标或启动样本，也没有预建 Web、官网或服务端。

## 本机验证

Windows x64、Node 24.11.1、pnpm 11.11.0，继续使用锁定依赖：

| 验证 | 结果 |
| --- | --- |
| pnpm check | 通过；50 个类型／构建任务、54 个 lint／构建任务；54 项普通测试 |
| pnpm desktop:packages:test:consumers | 八包 pack、publint／ATTW，以及隔离工程中的 TypeScript、Node、无框架页面和 Solid 页面通过 |
| actionlint 1.7.12 | 五份现有 workflow 通过 |
| 实际 Turbo 图回归 | 标题 workflow、包测试配置、应用测试类型配置不选择桌面验收；包测试文件仅选择所属包 lint |
| 输入与依赖回归 | 测试配置不改变构建身份、不发出包重建通知；新生产配置继续发出通知；域外源码遵守工程隔离，普通共享产品库不被误拦 |

本机完整检查和消费者日志分别见 [check.log](check.log)、[consumers.log](consumers.log)，消费者报告见 [consumer-results.json](consumer-results.json)，八包收据见 [package-inputs.json](package-inputs.json)。基于实现提交 84c6679 的实际 Bash 选择脚本与 Turbo 查询通过 15 种输入；其他域的同名包检查不选择桌面消费者；统一门禁通过 10 种成功、失败、取消、缺失和错误跳过情况。输入、工作流摘要及结果见 [workflow-probes.json](workflow-probes.json)，复现源码见 [probe-workflows.ts](probe-workflows.ts)。远端六目标结果由 [PR #6](https://github.com/ximu3/kisaki-dev/pull/6) 的检查和报告记录，本机结果不代替平台验收。

实现中的首次检查发现并修正了共享 ESLint 通配输入包含生成目录、dependency-cruiser 拒绝过于复杂的过滤表达式，以及改名后换行触发的 curly 错误。使用未提交工作区验证 Git 范围时，Turbo 同时纳入未提交的全局配置变化；该探针不用于判定单文件选择；改在已提交的干净基线上重跑后，15 组实际选择全部符合预期。

<a id="feedback-target"></a>

## 远端结果与反馈目标调整

实现提交 10c5f8f 的[完整 CI](https://github.com/ximu3/kisaki-dev/actions/runs/40644428590)九项全部通过，整轮等待 19 分 36 秒，累计 runner 时间 65 分 36 秒。六个目标均核对了四项开发场景、四窗口、20 次启动采样和一个最终载体验证，构建身份一致，打包复用已测试构建。八份原始附件及其候选文件摘要已经核对，原始 ZIP、报告和机器可读汇总保存在忽略目录 artifacts/script-domains/2026-10-28。

同一实现的[仅消费者试件变化](https://github.com/ximu3/kisaki-dev/actions/runs/40644662277)用时 1 分 49 秒，只选择 Linux x64 的八包消费，没有构建应用；[仅标题 workflow 变化](https://github.com/ximu3/kisaki-dev/actions/runs/40644668407)用时 54 秒，桌面矩阵按依据跳过。两轮汇总门禁均通过。这些是真实范围探针，不代表任意日常修改都具有同样耗时。

2026-10-28，用户确认将开发、原生及完整验证这一档的反馈目标从 15 分钟调整为 25 分钟，仓库／消费者／浏览器的 4 分钟与 renderer／公共 UI 的 10 分钟目标保留。原 15 分钟主要来自拆分并行阶段的样本；按目标组织之后，两轮完整运行分别为 17 分 24 秒和 19 分 36 秒，25 分钟为当前规模留出环境准备和 runner 波动余量。样本不足以将其视为稳定上界；历史记录保留当时目标与超标事实，现行规则由[工程工作区合同](../../../../../design/engineering/workspace.md#ci-feedback)拥有。

本次调整只修改反馈目标与说明，不改变任务选择、缓存策略、六目标范围、单项测试超时或作业中止上限。PR 当前按相对目标分支的整体变化选择任务，而非只比较最后一次提交；包含共同 CI 编排改动的 PR 补充文档后仍会请求完整验证。这一行为属于当前选择合同，不能由独立单文件探针推断为逐次提交增量。

核对了 [Turbo 的 PR affected 规则](https://turborepo.dev/docs/crafting-your-repository/constructing-ci#using---affected-in-github-actions)、[Nx 的基线说明](https://github.com/nrwl/nx-set-shas#background)和 [GitHub 对最新提交检查结果的要求](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#required-check-needs-to-succeed-against-the-latest-commit-sha)。保留目标分支基线的理由是覆盖整个待合并版本：若前一提交的原生检查失败或被取消，后一提交仅修改文档，只比较最后一提交会漏掉仍未验证成功的代码。已经成功且输入完整的确定性任务可通过缓存复用；进一步跨提交复用现场验收结果，需要单独定义成功基线、目标分支变化及结果适用条件，不由缩小 Git 比较范围隐式代替。

## 上游依据

采用原生 [pnpm run](https://pnpm.io/cli/run) 区分脚本与内置命令；Turbo 按[任务 inputs](https://turborepo.dev/docs/reference/configuration)声明实际共享输入。dependency-cruiser 的 [doNotFollow](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#donotfollow-dont-cruise-modules-any-further) 同时过滤初始扫描范围、保留被维护源码直接引用的目标边，因此从仓库根扫描仍能保留第三方和测试目标的边界检查。
