# 必要性与复杂度复核

本轮依据用户提出的“不要过度防御、过度测试、过度设计”检查全项目。审查基线为 `f3f74f5880f3fd74be63f119a231e38fff4478c1`，日期为 2026-10-26。共同规则已提升到 [AGENTS](../../../../../AGENTS.md)、[CONVENTIONS](../../../../../CONVENTIONS.md)及[设计、实现与验证准则](../../../../../CONVENTIONS.md#proportionality)的前部，并由设计入口、产品原则、工作包与验收入口引用。

## 覆盖与方法

基线共 2,437 个受版本控制的文件。排除历史验证材料与两份依赖锁文件后，734 个文件纳入现行工程清单；其中有 228 个 TypeScript／TSX 文件、3 个 Rust 文件、144 篇设计文档、2 份 relay 配置 JSON、6 个实施文件和 15 篇验收文档。

| 范围 | 核对内容 |
| --- | --- |
| 当前实现、工具与测试 | 四个程序、八个公共包、三个私有工程包、根工具、原生入口，以及现有测试和辅助代码的实际责任、校验、取消、输出与资源寿命 |
| 配置与资源 | 45 个 workspace 成员、任务图、类型环境、lint、依赖边界、CI、构建与打包配置；同构的 33 项扩展配置逐组比较，资源核对声明及生成、消费流程 |
| 总览与领域 | 4 篇总览、38 篇领域文档及 7 篇资料预设，检查目标、数据归属、并发前提、准备／提交、失败与验证要求 |
| UI 与工程 | 8 篇 UI、15 篇工程文档，检查草稿、交互、隔离、开发与交付流程，以及重复检查和机械矩阵 |
| 扩展 | 12 篇共同合同、17 篇来源、13 篇导入器，检查能力范围、来源差异、认证、重复写入与接续机制 |
| 独立项目 | 30 篇文档及 relay 的 2 份 JSON，覆盖 Vantage、Kana、libmpv-node、relay 与共同边界；核对两个已采用 mpv 补丁的用途 |
| 实施与验收 | 工作包、状态、子交付与全部 15 篇验收文档，区分首次交付、日常回归、运行证据与历史探针 |

源码和测试按职责审读；设计逐篇检查目标、控制机制及验证条款，再回读相关上下文。历史探针用于确认机制来由，不重新运行整个证据目录。本轮没有重新认证全部远端 API、重做资源视觉验收或取得新平台运行证据；这些结果继续保持原记录的范围。尚未实现的已确认产品能力也不因本轮审查而被当作假想需求删除。

## 已处理的问题

| 问题 | 本轮处理 |
| --- | --- |
| 不过度设计的要求原来主要埋在局部校验规范中 | 提升为全项目优先准则，明确既有设计、代码和测试同样需要必要性依据；重要判断须查证社区与当前技术栈 |
| 33 个扩展为两个工具配置分别建立纯环境与 Node 项目 | 每项改用一个根 Node 类型配置，移除 66 份辅助配置；保留当前两个文件的检查覆盖与共同严格性 |
| 结构测试固定 workspace glob 的写法、顺序与成员数字 | 改为比较 pnpm 实际发现的成员与当前工程；继续检查身份、发布边界和源码类型覆盖 |
| 任务测试将全部 test 任务永久限定为不可缓存，并禁止私有包将来拥有任何 build | 仅检查真实现场任务的缓存约束，保留真实任务图及生成输出不进入输入的检查 |
| 窗口测试依赖对象键顺序；开发测试要求无关 PID 变化及所有旧 chunk 名消失 | 改为检查最小能力集合、恢复就绪与新代码实际采用；保留 UI HMR 和 Node 改动的真实重启断言 |
| 所有性能场景固定 20 次、每项参数机械补齐正常／边界／超限／取消 | 按测量问题与实际机制选择次数和场景；原 W00 启动比较仍保持自己的 20 次基线 |
| 每条完整流程都要求另造失败场景；Vantage 局部条款容易展开全部版本／权限组合 | 共同失败在拥有层验证，接入补自己的风险；六目标基础与不同后端保留，其他组合按实际差异选取 |
| 媒体接入凭空要求“核心复用池” | 明确为同一播放器内的核心复用，不建立额外池 |
| 文档仍有旧原生别名及工程函数归属 | 修正为实际的 #native 与私有工程包归属 |

扩展配置的拆分来自上一轮对旧编译环境的机械保留。kisx.config.ts 是 CLI 的构建输入，defineConfig 自身无 I/O 不意味着作者配置需要纯合同环境。ESLint 的 TypeScript 配置在当前工程由 Node 与 jiti 加载，且 ESLint 不负责替它执行类型检查；TypeScript 项目引用用于实际逻辑边界，并不要求每个配置文件独立成项目。此次按真实宿主合并。[ESLint 配置文档](https://eslint.org/docs/latest/use/configure/configuration-files#typescript-configuration-files)、[TypeScript 项目引用](https://www.typescriptlang.org/docs/handbook/project-references.html)

此前部分命名、配置组织和输入身份变化触发了整套本机回归，投入超过实际影响。现在明确：buildId 或摘要变化本身不构成重跑桌面、性能、打包和六目标检查的理由；旧结果可以按仍成立的实现与环境边界引用，但不能改写成新输入的实测。

## 后续需要收敛的两处

### PR 标题修改触发完整 CI

审查时的 ci.yml 把 pull_request.edited 与代码变化放在同一工作流和取消组内。只改标题或正文仍执行仓库检查；PR 的应用差异存在时还会重新选择六目标桌面任务，并可能取消同一 PR 正在运行的检查。这是实际触发配置带来的重复工作。[GitHub 事件文档](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)、[并发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

当时建议将标题检查独立为轻量工作流，代码 CI 按提交或合并基线变化执行，保留目标分支变化所需的验证，并同步维护必需检查。不能只在现有工作流中跳过 desktop：旧取消组与汇总检查可能因此取消真正的代码验证，再用一个跳过结果替代它。用户随后确认修正，已完成[工作流拆分与真实事件验证](../../ci-events/2026-10-26/README.md)；原审查结果保留为问题来源。

### 作者开发连接先比较现成消息通道

审查时的开发协议规定了命名管道／Unix socket、一次性凭据、长度帧及相应拆包测试。当时桌面工具中的 `dev/electron-process.ts` 已使用 Node 的父子 IPC 传递就绪消息；这提供了一个应先比较的简化方向。

Node 已提供消息交付、断连与进程句柄；但其保证针对 Node 子进程，不能据此直接宣称所有正式 Electron 载体都可原样替换。需要先核对 kisx 启动正式应用的真实方式及必要控制消息，再决定保留专用端点还是复用现成通道。本轮将它列为设计取舍，未认定现行方案已经有运行缺陷，也未扩充协议测试。[Node 24.11.1 IPC](https://nodejs.org/download/release/v24.11.1/docs/api/child_process.html#optionsstdio)

后续已经完成[探索](../../development-ipc/2026-10-26/README.md)与[确认后的实现替换](../../development-ipc/2026-10-26/implementation/README.md)，旧私有启动器已删除；本节保留审查当时提出该方向的依据，当前规则以[正式合同](../../../../design/engineering/protocols.md#development)为准。

## 保留机制的依据

资料库的短事务、相关字段基线和文件使用占用对应多窗口、后台采用及用户数据完整性；OAuth 的操作身份和凭据 revision 对应换账号、断开与令牌轮换；导入批次接续保护已经追加的私人内容；原生同步、帧持有与环境退出处理对应真实系统调用和资源所有权。它们各有实际约束，不按“锁”“并发”“校验”等关键词一律移除。

开发的失败构建保留与完整输出交接服务当前使用中的程序和资源。社区工具同样区分 renderer HMR 与 main／preload 重载，说明开发生命周期有真实职责；具体交接成本仍按本项目需要判断，不因社区存在较简单实现就直接套用。[electron-vite 开发重载](https://electron-vite.org/guide/hmr-and-hot-reloading)

当前较宽的桌面 buildId 继续用于输入身份，不再为本轮审查建立更细的输入分类系统。三个私有包已有实际消费者，少量构建包装也不需要再抽象成新的框架。

## 验证与社区依据

四份测试调整已完成相关类型与 lint 检查，并运行结构测试 3 项、真实四窗口 4 项、开发会话 1 项。扩展配置合并后的类型、lint、覆盖检查，以及最终文档和差异检查由 [checks.json](checks.json)记录。实际输出见[结构测试](structure.log)、[四窗口](e2e.log)与[开发会话](dev-session.log)。

本轮按实际修改选择验证，产品运行实现和公共制品合同没有变化，未重复性能采样、打包、原生矩阵或远端账号操作。未新增测试框架或用于固化本次配置形状的测试。

判断参考 Google 对复杂度与测试维护成本的[评审建议](https://google.github.io/eng-practices/review/reviewer/looking-for.html)、[YAGNI](https://martinfowler.com/bliki/Yagni.html)、Google 对[变更探测测试](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html)的讨论及 [Testing Library 的行为原则](https://testing-library.com/docs/guiding-principles/)。这些资料支持按当前需求和行为判断，不能代替本项目具体取舍的证据。
