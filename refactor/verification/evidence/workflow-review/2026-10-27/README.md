# GitHub workflow 组织与维护复核

本次先按用户要求核对三份 workflow 的职责、调用关系、事件与取消、权限、任务选择、缓存、命名及当前上游版本，再按确认结果实施维护。下述审查结论保留其原时点；维护内容和验证范围见后文。

## 组织判断

三文件划分成立，建议保留。

| 文件 | 实际职责 | 判断 |
| --- | --- | --- |
| ci.yml | 接收 PR、main push 和手动事件；决定是否调用代码验证，管理整组验证的取消 | 职责明确，名称准确 |
| verification.yml | 选择验证范围，执行仓库与六目标任务，汇总必要结果 | 是完整的多 job 验证单元，名称准确 |
| pr-title.yml | 独立检查当前 PR 标题，使用独立取消组 | 与代码验证具有不同触发与失败语义，应该独立 |

ci.yml 中的调用 job 同时承载 if 和 concurrency，使标题／正文编辑不进入代码验证取消组，也不产生新的 Required checks 结果。这一分层已有实际职责，不能只因当前仅有一个调用方就判定为多余抽象。GitHub 原生支持在可复用工作流的调用 job 上设置这两个字段，见[可复用工作流支持的字段](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#supported-keywords-for-jobs-that-call-a-reusable-workflow)。

主流程使用 Turbo 的实际任务输入与依赖图选择范围，未知基线和全局变化回退完整验证；六目标采用实际原生 runner，fail-fast: false 保留各目标结果，Required checks 区分未选择与未完成。Action 使用完整 SHA，PR 使用只读权限，checkout 不保留凭据，声明的 Turbo 保存条件不向 fork PR 开放可信缓存写入。真实桌面与制品任务不重放缓存。这些设计与现行合同及[六目标运行证据](../../w00/2026-10-27/ci/README.md)一致。

没有理由为这次整理增加新的 workflow、复合 action 或通用 CI 脚本。release.yml 等发行工程随 W11 的实际身份和交付流程建立。

## 审查时确认的维护项

1. **升级仍声明 Node 20 的 Action。** 当前 pnpm/action-setup 与 actions/upload-artifact 的固定 SHA 均声明 node20；最新 CI 已记录 runner 强制改用 Node 24 的迁移警告。上游已经提供声明 Node 24 的稳定版本，应该完成兼容核对后更新固定 SHA。这是已有运行证据支持的维护项。其余三项当前已声明 Node 24，不能仅凭版本号较旧就认定不合格。
2. **缓存主键命中后跳过重复保存。** 仓库与 desktop 的 Save Turbo task results 只检查分支来源，没有检查 restore 的 cache-hit。第二次实际运行成功恢复同一主键后又尝试保存，产生 Unable to reserve cache 提示。建议在两个保存条件中加入 cache-hit != 'true'，保留分支来源条件；restore-keys 的部分命中仍可保存新主键。依据是[实际日志](../../w00/2026-10-27/ci/40454692840/warm-cache/macos-arm64.log)及[cache/save 官方用法](https://github.com/actions/cache/blob/v6.1.0/save/README.md)。

2026-10-27 核对到的上游稳定版本如下，仅列为维护候选，尚未执行升级兼容验证；完整元数据与当前声明运行时见[上游快照](upstream.json)。

| Action | 当前配置注释 | 当前声明运行时 | 上游稳定版 |
| --- | --- | --- | --- |
| actions/checkout | v5 | Node 24 | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) |
| actions/setup-node | v5 | Node 24 | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) |
| actions/cache | v5 | Node 24 | [v6.1.0](https://github.com/actions/cache/releases/tag/v6.1.0) |
| actions/upload-artifact | v4 | Node 20 | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) |
| pnpm/action-setup | v4 | Node 20 | [v6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0) |

[GitHub 迁移公告](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)要求 Action 用户升级至支持 Node 24 的版本。Action 自身的运行时与应用固定的 Node／Electron 版本是不同的配置职责。

## 命名与运行边界建议

文件名和 workflow 的 CI、Verification、PR title 可以保留。job 显示名目前混用隐含小写 ID、自动展开的完整矩阵和显式标题；desktop 展示 target、runner、arch，其中架构信息重复。建议给 repository 和 desktop 明确显示名，例如 Repository checks、Desktop (${{ matrix.target }})，内部 job ID 沿用现有名字。

步骤名称可以按实际命令职责收敛：Build the actual target 可改为 Build desktop；两个 Observe the hardened ... candidate 步骤可统一为 Test packaged application 与 Test packaged application (X11)。complete 输入的描述宜改为全部已配置验证，避免 Run complete acceptance 被理解为已经覆盖 W11、全部系统下限和运行后端。名称整理只改善含义表达，不改任务范围。

verify / Required checks 和 PR title 是现行合并规则约定的检查名称。此次未读取或修改远端分支规则；不能因为整理显示名称而直接改动这两个对外名称。完整规则见[PR、提交与 CI](../../../../design/engineering/workspace.md#collaboration)。

目前四类实际 job 均未声明 timeout-minutes，沿用 GitHub 的[默认 360 分钟上限](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes)。本轮仓库任务约 4 分 46 秒，最长 desktop 为 Windows arm64，约 22 分 51 秒，此前还发生过需手动取消的长时间类型步骤。建议为仓库、桌面、标题及汇总 job 设置符合实际规模且留足余量的上限；具体预算在实施时确定，不扩展为每个步骤都新增超时。

## 验证与范围

三份文件同时通过 actionlint 1.7.12。核对了固定 SHA 的 action.yml、最新 release 元数据、任务调用、事件条件、已有完整运行和暖缓存日志。本次没有重跑六目标、升级 Action、改变检查名称、修改远端配置或触发新 CI。

审查结论是职责组织与主要工程机制成立，但依赖维护、缓存保存分支和显示命名仍有具体收尾；不能将六目标通过直接表述为工作流维护已经全部完成。既有 W00 运行结果保持其原提交与验证范围。

## 已确认的维护实施

保留三文件分工和 verify / Required checks、PR title 两个检查名称。repository 与 desktop 增加明确显示名，步骤按检查、测试、构建、打包、缓存和上传职责命名；complete 描述改为全部已配置检查。两个 Turbo 保存步骤只在主键未命中且来源允许时保存，前缀恢复仍可以生成新主键。

pnpm/action-setup 升级为 v5.0.0，固定提交 fc06bc1257f339d1d5d8b3a19a8cae5388b55320；upload-artifact 升级为 v7.0.2，固定提交 cf430e030ddbb5b0abf93d22962f4752f3646cd9。两者均声明 Node 24。上传保留默认 ZIP、多路径公共根、附件名及缺少文件即失败的行为，没有采用新的直接单文件上传模式。其余已使用 Node 24 的三个 Action 保留已验证输入。

安装顺序统一为 checkout → setup-node → pnpm/action-setup → frozen-lockfile 安装。固定 Node 先进入 PATH，pnpm Action 从 packageManager 取得固定版本，负责 pnpm store 缓存；setup-node 的包管理器缓存关闭，避免重复拥有同一缓存。pnpm 11 在 Intel macOS 上没有独立可执行制品，官方要求安装运行于现有 Node 的普通 pnpm 包，见[安装说明](https://github.com/pnpm/pnpm/blob/main/pnpm11/docs/installation.md)。v5.0.0 的[固定实现](https://github.com/pnpm/action-setup/blob/fc06bc1257f339d1d5d8b3a19a8cae5388b55320/src/install-pnpm/run.ts)直接安装 packageManager 指定的包，且[发行说明](https://github.com/pnpm/action-setup/releases/tag/v5.0.0)确认使用 Node 24。三个入口采用同一实现，不修改 pnpm 11.11.0、不增加平台分支或项目兼容脚本。

| 实际 job | 超时上限 | 取值依据 |
| --- | --- | --- |
| Repository checks | 20 分钟 | 完整仓库基线约 5 分钟，保留首次安装和 runner 波动余量 |
| Desktop | 60 分钟 | 已观察到的最长原生目标约 23 分钟，覆盖准备、真实桌面回归与多格式打包 |
| PR title | 10 分钟 | 根依赖安装和一次标题检查，避免异常等待沿用六小时默认值 |
| Required checks | 5 分钟 | 仅检查已有任务结果，不执行构建或安装 |

这些是 CI 作业资源寿命上限，不修改应用启动或交互性能预算，也没有给每个步骤增加独立计时机制。macOS 部署目标继续在依赖安装前的专属步骤设置。

三份 workflow 的 actionlint 1.7.12 与格式检查已通过。修正后的真实安装、六目标运行及附件上传已通过；同提交的 macOS arm64 暖缓存复验也确认，全部实际检查成功后，主键命中的保存步骤正确跳过。完整结果及历史失败见后文。

## 安装兼容的实际修正

首次采用 v6.1.0 的提交 d4329c2 在[运行 40462091602](https://github.com/ximu3/kisaki-dev/actions/runs/40462091602)通过仓库检查、48 项常规测试、八包消费者和浏览器检查，新版上传 Action 也成功生成附件，下载摘要与八个包摘要均相符。但 Intel macOS 在 Set up pnpm 失败：[原始日志](ci/40462091602/macos-x64.log)显示 Node 24.11.1 已就位，Action 将内置 pnpm 11.25.0 自更新为项目的 11.11.0 时，仍要求不存在的 @pnpm/exe.darwin-x64 身份，报 ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE。该目标没有执行依赖安装、源码检查或桌面验证，不能记作通过。

v6.1.0 的[实现](https://github.com/pnpm/action-setup/blob/ea17c68df8912ef543352723c149a84f56e3d413/src/install-pnpm/run.ts)在普通安装后仍调用 self-update；仅调整 Node 安装顺序不足以闭合这个版本组合。因此改用已支持 Node 24、直接安装目标包的 v5.0.0，统一处理全部 runner，随后复验实际 CI。保留首次失败记录，未关闭身份校验或改变项目工具链版本。

第一次仓库 job 为 8 分 49 秒，其中 Chromium 与系统依赖准备占 4 分 25 秒；日志记录系统包下载 19.7 MB 用时 3 分 57 秒、速度 83.2 kB/s。源码检查阶段为 2 分 53 秒，与旧运行的 2 分 55 秒接近。首次 pnpm 缓存创建与独立 PR 标题 job 使用同一主键，后保存者出现已占用提示；该现象与 Turbo 主键恢复后的重复保存是不同分支，原始日志保留。

修正推送后，首次运行按既有 concurrency 取消规则结束：仓库与 macOS arm64 成功，macOS x64 安装失败，另外四个目标取消，Required checks 失败。完整[运行元数据](ci/40462091602/run.json)、[任务结果](ci/40462091602/jobs.json)、原始日志与附件清单保留；该运行没有六目标通过结论。仅仓库附件下载留存，macOS arm64 和取消目标的附件保留 GitHub 元数据，没有重复归档其候选。

## 维护后的完整运行

提交 0abf572581308cb3ef1fa3a6a3d4896833ee7383 的[运行 40463344626](https://github.com/ximu3/kisaki-dev/actions/runs/40463344626)首轮通过仓库、六目标和 Required checks 共八项任务，独立 PR title 同样通过。实际检查合并引用为 a7e3a98308e192ca65f1079c9b6d15c7401149c6，未执行 PR 合并。见[首轮运行](ci/40463344626/run.json)、[任务和步骤](ci/40463344626/jobs.json)与[核对汇总](ci/40463344626/verification-summary.json)。

仓库执行 48 项常规测试、50 项类型及依赖任务、54 项 lint／边界及依赖任务与格式检查；八包通过 publint、ATTW 和两项仓库外消费者检查，独立浏览器测试一项通过。全局 workflow 变更正确选择完整范围，原始选择结果与各报告一并保存。

六个原生 runner 均完成五项候选与取消测试、Rust 检查、目标构建、原生与 SQLite、四窗口、七项开发场景、20 次启动测量，以及最终载体启动与正常退出。Windows x64 的跨文件系统移动通过，其余五个 runner 因测试根处于同一文件系统明确跳过这一项。

| 目标 | 任务耗时 | 原生／SQLite | 启动 P95 | 实际启动的载体 |
| --- | --- | --- | --- | --- |
| Windows x64 | 13 分 28 秒 | 7 项通过 | 596.1 ms | ZIP |
| Windows arm64 | 22 分 3 秒 | 6 项通过，1 项跳过 | 632.8 ms | ZIP |
| macOS x64 | 13 分 24 秒 | 6 项通过，1 项跳过 | 1,844.6 ms | ZIP 中的 app |
| macOS arm64 | 3 分 55 秒 | 6 项通过，1 项跳过 | 433.0 ms | ZIP 中的 app |
| Linux x64 | 11 分 38 秒 | 6 项通过，1 项跳过 | 715.6 ms | AppImage |
| Linux arm64 | 10 分 31 秒 | 6 项通过，1 项跳过 | 532.7 ms | AppImage |

六目标候选与启动测量的 buildId 均为 efd2b15e20661174942b74d44477246395f685465c680bf39da997425961fd22，与维护前的应用源码身份一致。全部启动采样通过原有 5,000 ms 预算，不用于比较不同 runner 的产品性能。日志同时确认 MACOSX_DEPLOYMENT_TARGET=13.0 只进入 macOS 两个目标。

首轮七份[原始附件](ci/40463344626/artifacts.json)共 1,757,479,747 字节，保存于仓库忽略的 F:/project/kisaki/artifacts/w00-ci/2026-10-27/40463344626/，逐份 SHA-256 与 GitHub 一致，见[归档回执](ci/40463344626/archive-receipts.json)。八个公共包 tarball 与六目标共 26 个候选、blockmap 和更新元数据文件均按所属清单逐文件核对。报告、候选回执、解码的启动样本和原始日志保存在本节对应目录。所有候选为 test-only；正式签署、公证、安装与更新仍由 W11 接续。

## 暖缓存复跑的启动采样超时

同一提交的第二、三次运行均只复跑 macOS arm64 及其汇总检查，其余仓库和五个目标沿用首轮时间与结果。两个新 runner 恢复相同 Turbo 主键，构建阶段均命中 appearance、desktop-contracts、extension-cli、ui 四个公共包任务；桌面构建、原生、四窗口和七项开发场景均实际执行并通过。

随后性能用例均在 180 秒测试上限失败，worker 收尾又在 180 秒上限失败。没有生成完整 startup.json，报告仅有超时消息，无法确定卡在具体哪次启动、指标读取或关闭操作。见[第二次报告](ci/40463344626/warm-cache/attempt-2/performance.json)、[第三次报告](ci/40463344626/warm-cache/attempt-3/performance.json)及各自目录的原始日志、运行元数据、前序通过报告和附件摘要。两次 Required checks 均正确失败。

这两次没有执行打包与最终载体检查。Save Turbo cache 跳过同时受到此前失败影响，不能作为主键命中后正常跳过保存的完成证据。首轮六目标成功保持原范围，后续失败也保持未解决；没有通过更换目标、缩减 20 次采样或放宽预算消除失败。

现为每次采样增加 [Playwright 原生 test.step](https://playwright.dev/docs/api/class-test#test-step) 记录，分别标明 launch、window ready、process metrics、close 和 observed processes exit。测量时钟仍位于实际启动与窗口就绪之间；运行代码、关闭方式、采样数和超时不变。本机 Windows 的实际 20 次采样通过，JSON 报告保留 100 个步骤，类型、lint、格式与目标构建通过，见[诊断改动核对](diagnostics/local-validation.json)。这只补足诊断，尚不构成 macOS 故障修复。

诊断提交 18a6346 的[运行 40469205920](https://github.com/ximu3/kisaki-dev/actions/runs/40469205920/attempts/1)首轮通过仓库、六目标和 Required checks 共八项任务，PR title 同样通过，见[核对汇总](ci/40469205920/verification-summary.json)。macOS arm64 的 20 次采样及 100 个阶段均通过，P95 为 365.8 ms，性能用例用时 8.8 秒；指标读取最长 5 ms，关闭最长 245 ms，见[阶段核对](ci/40469205920/macos-arm64-diagnostics.json)与[原始报告](ci/40469205920/macos-arm64-performance.json)。该目标从前缀恢复上一提交的缓存，构建和打包各命中四个公共包任务，随后保存本提交的新主键。

同提交的[第二次运行](https://github.com/ximu3/kisaki-dev/actions/runs/40469205920/attempts/2)仅复跑 macOS arm64 和汇总检查。新 runner 在 3 分 30 秒内完成全部检查，20 次采样用时 8.1 秒；准确恢复首轮保存的主键，构建与打包各四个公共包任务的八个 hash 与首轮相同。Save Turbo cache 在全部检查成功后正确跳过，日志没有缓存占用警告，Required checks 成功。其余六个任务的开始与结束时间与首轮相同，见[缓存复验](ci/40469205920/warm-cache/attempt-2/cache-recovery.json)、原始日志和运行元数据。缓存保存条件的正常命中分支已验证；两次历史采样超时的根因仍未确定，新增诊断步骤与后续成功不计作故障修复。

本轮保存七份远端附件的元数据，并下载、核对仓库与 macOS arm64 的首轮附件。八包摘要及应用源码 buildId 与 0abf572 首轮相同；其余五目标和暖缓存的重复候选沿用此前完整候选证据，同时保留本轮各任务原始日志与远端附件身份。没有将未下载的重复附件计作本地归档。

## Windows arm64 的 Turbo 本地定位警告

用户指出的 No locally installed turbo / Using globally installed version (2.11.10) 出现在 Windows arm64 的构建与打包步骤，其他五目标没有该警告。该 runner 的依赖安装日志已明确记录 turbo 2.11.10，与根清单和锁文件一致。

锁定版本的[官方发布脚本](https://github.com/vercel/turborepo/blob/v2.11.10/.github/workflows/turborepo-release.yml#L604-L612)将 Windows x64 程序复制为 Windows arm64 包。实际下载 @turbo/windows-arm64@2.11.10、核对 npm SHA-512 后，其 turbo.exe 的 PE Machine 为 0x8664，确认是 x64 程序，见[文件核对](turbo-windows-arm64.json)。Node 启动器按主机架构选择 arm64 包；运行中的 x64 程序再按[编译目标](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-shim/src/turbo_state.rs)查找 windows-64 本地包，于是[本地定位](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-shim/src/local_turbo_state.rs)失败。[后续分支](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-shim/src/run.rs#L387-L440)继续执行当前程序，同时将其称为 globally installed。

这是上游 Windows arm64 发行方式与自身定位逻辑不一致造成的误导性警告。当前任务仍使用仓库固定的 2.11.10，应用打包日志明确为 Electron arch=arm64。该上游告警保留记录，六目标安装方式和应用目标不变。

## CI 时长判断

[维护后分项时间](timing-after.json)对应上述首轮完整运行：事件创建到 Required checks 完成为 28 分 53 秒，其中初始排队 1 分 58 秒用于等待被取代的运行收尾；从首个 job 开始到汇总完成为 26 分 55 秒。仓库反馈为 4 分 42 秒。最长 Windows arm64 为 22 分 3 秒，其中桌面工作流 11 分 19 秒、打包 4 分 5 秒，合计约占该目标的 70%。

[维护前基线](timing-before.json)为整套 27 分 49 秒、仓库 4 分 46 秒、Windows arm64 22 分 51 秒。两轮整体仍处于相近规模，不同 runner、网络准备、缓存与排队条件不能作为受控性能比较；不能把更换 Action 或某个目标变快直接解释为稳定提速。job 时长之和另有记录，它既不是整套等待时间，也不是计费分钟。

只增加采样诊断后的[完整运行](timing-diagnostics.json)为 23 分 37 秒，初始排队 2 秒、实际执行 23 分 35 秒；仓库检查 2 分 9 秒，大量类型、lint 与包任务命中缓存。Windows arm64 仍最长，为 21 分 17 秒，其中桌面场景 11 分 17 秒、打包 3 分 52 秒，两项约占该目标的 71%。这轮验证了诊断用例与完整工作流，未改变实际桌面覆盖；其较短等待同时受到缓存、准备和 runner 差异影响。

[DORA 对持续集成的建议](https://dora.dev/capabilities/continuous-integration/)强调每次提交在几分钟内取得反馈，快速测试约十分钟为上限，并建议将更长的检查放入分阶段的交付流程。当前约两至五分钟的仓库反馈与此方向相符；包含六个原生目标、真实桌面、每目标 20 次启动和最终载体的约 24 至 27 分钟实际验证有明确成本来源，但不能称为快速的日常 PR 门禁。如果普通修改经常执行同一完整范围，反馈仍偏慢。

当前使用实际任务输入选择范围，但尚未取得一组具有代表性的增量 PR 耗时分布。也不能把单个 macOS arm64 的暖缓存复跑当成整套 CI 从 28 分钟降到几分钟：维护前提交 711d956 的[缓存复验](../../w00/2026-10-27/ci/40454692840/cache-recovery.json)中，该目标首次为 3 分 34 秒，复跑为 3 分 41 秒。缓存确实命中，真实运行与打包仍占主要时间，这两次不同 runner 的单次结果不是稳定性能比较。

本轮维护提高配置可读性与运行可靠性，不承诺明显缩短桌面回归和打包。后续若优化时长，应先针对实际耗时最大的准备、开发回归和打包步骤测量；既有用例、平台范围与启动采样预算不因追求一个更短的总时间而缩减。
