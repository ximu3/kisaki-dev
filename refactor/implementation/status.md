# 设计与实施状态

<a id="design"></a>

## 当前进度

截至 2026-10-27：

| 范围                             | 状态                                      |
| -------------------------------- | ----------------------------------------- |
| 产品、领域、界面、工程及扩展设计 | 已完成，正式规则与验收要求已确定 |
| W00 工程与验证入口 | workflow 维护后的六目标首轮已通过；Apple Silicon 启动采样在两次暖缓存复跑中超时，待定位与复验 |
| W01–W13 与四个独立项目 | 未开始正式实施 |
| 正式应用、目标制品与平台验收 | 已验证六目标 W00 工程外壳、候选启动及原生／SQLite；完整产品验收未执行 |
| 对外发行                         | 未执行                                    |

[W00](work-packages.md#w00) 的工程任务按确认的[顺序执行约束](../design/engineering/workspace.md#output-access)维护。跨命令协调层已经移除；共享 TypeScript、ESLint 配置与工程函数归入三个私有 workspace 包，项目自行拥有检查入口，CI 使用 GitHub Actions 原生缓存。源码共享入口通过 exports 供固定工程宿主加载，不增加构建前置，应用 `#native` 保留包内唯一映射。[完整本机回归](../verification/evidence/w00/2026-10-26/monorepo-cache/README.md)与 12 项隔离缓存验证通过；提交 711d956 的[六目标 CI 与跨运行缓存验证](../verification/evidence/w00/2026-10-27/ci/README.md)保持原范围。维护后的提交 0abf572 首轮六目标成功，但后续两次 Apple Silicon 启动采样超时仍待定位，见[workflow 维护记录](../verification/evidence/workflow-review/2026-10-27/README.md)。W01 尚未开始。

Kisaki 的项目级临时私有仓库为 [ximu3/kisaki-dev](https://github.com/ximu3/kisaki-dev)，本地 origin 指向该地址，用于正式接续前的持续开发、联调和 CI。2026-10-26 将原 kisaki-w00-ci 直接改名并更新描述，保持 private、未归档及 main 默认分支。仓库身份、现有分支提交、PR、工作流和所核对的 Actions 运行均保留，旧 Git 与 API 地址仍可访问，见[改名核对](../verification/evidence/repository/2026-10-26/rename.json)。历史证据保持当时的地址。

旧 [ximu3/kisaki](https://github.com/ximu3/kisaki) 在 2026-10-25 核对时为 public、未归档，默认分支为 main。旧资料存档与同名重建尚未执行，后续按[共同仓库规则](../design/engineering/repository.md#temporary-repositories)接续。

已完成[全项目必要性与复杂度复核](../verification/evidence/proportionality/2026-10-26/README.md)，覆盖现行实现、配置、测试、144 篇设计文档与实施／验收要求。避免过度防御、过度测试和过度设计已提升为共同优先准则；33 个扩展改用各自一个 Node 工具类型项目，移除 66 份辅助配置，四份现有测试改为验证实际行为。相关类型、lint、结构、四窗口与开发会话检查通过，性能与验收条款按真实影响收敛。该次复核保留的开发连接与 PR 元信息触发问题已在下述工作中闭合。审查本身没有重复打包、性能和六目标运行，也未推进后续业务或对外发行。

随后完成[开发连接探索](../verification/evidence/development-ipc/2026-10-26/README.md)，并按确认方案完成[正式合同与 W00 实现替换](../verification/evidence/development-ipc/2026-10-26/implementation/README.md)。源码与打包应用共用公共父子 IPC 启动入口，删除旧私有控制与 socket 线协议，统一显式开发模式、隔离 profile、初始化和可取消退出；应用同意关闭窗口后才释放宿主。相关静态检查、根／本体测试、五项开发回归、四窗口、真实 Windows 制品、八包仓库外消费和 20 次启动／退出验证通过。启动器观察实际 exit，正常停止不固定延时强杀，退出取消后继续开发。W00 如实报告尚无扩展 API，构建采用和激活仍由 W03／W08 交付。macOS／Linux 新 IPC 的本体运行验证仍未完成；AppImage 启动条件后续按下述确认政策处理，既有启动通过不代替其验证。该次实现未运行新的远端 CI 或对外发行。

W00 的[六目标验证记录](../verification/evidence/w00/2026-10-24/ci/README.md)、原始附件与实际制品继续按当时提交保存，不把旧记录中的仓库名称改写为后来的身份。四个独立项目采用同一临时仓库规范，其实际远端在开始实施时登记。设计、实现、运行验收、仓库接续和发布分别依据实际结果记录。

已按确认方案补充[扩展 deeplink](../design/ui/navigation.md#extension-deeplinks)：统一协议下的独立扩展地址、每实例一个 Node 处理器，以及冷启动、取消和释放规则。输入复用正式扩展 ID 校验，保留路径、有序查询项与可选 fragment；共同 URL 合同拒绝改变路径含义的点组件。宿主不增加通用入口确认，资源下载安装由扩展业务展示实际内容与影响并取得本次确认。公开 API 范围、W01／W08 交付和 A21／A23／A28 验收已同步。本轮为正式设计文档更新，处理器与系统分发尚未实现，未取得相应运行或制品验收证据。

完成 [AppImage 两条启动政策的实测比较](../verification/evidence/appimage-policy/2026-10-26/README.md)后，按用户确认[采用上游条件兼容策略](../verification/evidence/appimage-policy/2026-10-26/adoption/README.md)：允许用户命名空间时保留 Chromium 沙箱，受限时接受上游降级。本体配置清除 .desktop 的无条件 --no-sandbox，新增最终入口断言，正式发行与 Webview 规范同步说明实际隔离边界。采用配置与本体输入摘要一致，Ubuntu 24.04 x64 的十三项启动对照及路径通配检查符合预期；不计作完整本体或六目标通过。

已修正 [CI 元信息触发](../verification/evidence/ci-events/2026-10-26/README.md)：标题检查独立，代码验证由事件入口调用；标题／正文编辑不取消原代码验证、不覆盖已有失败。真实草稿 PR 验证了元信息、无效标题、标题修正、新提交与目标分支变更，最后一次汇总通过，测试 PR 已关闭未合并。原仓库与六目标任务除移出标题检查外保持一致。本体类型与修改用例 lint 通过；产品修改尚未推送，本轮未等待新的六目标运行。临时库当前没有 main 分支保护或 ruleset，正式规范已列明后续应要求的两项检查名称。

已完成[简洁与原生复核](../verification/evidence/simplicity-native/2026-10-26/README.md)，覆盖当前桌面、八个公共包、33 项扩展工程、三个私有工程包、工具与测试，以及全部 144 篇设计文档和两份配置 JSON。共同准则同时强调平台／工具能力与原生交互，有方案取舍时先讨论。修正 Kana 的旧优先级；焦点遍历经用户确认采用平台键盘习惯，只补必要接续。系统菜单、语义控件与 Solid 原语的责任已明确，扩展类型配置和 Electron 版本的旧表述已纠正，parse5 内部适配成本已标明。全工作区 `pnpm check` 与 37 项常规测试通过；本轮只调整规范并修正一份测试夹具格式，未更换运行机制、重跑六目标或发布制品。Kana 新交互规则仍待正式实现与实际平台验收。

完成[工具链专项审查](../verification/evidence/tooling-review/2026-10-26/README.md)和 [Vite 社区方案比较](../verification/evidence/tooling-review/2026-10-26/vite-options.md)后，按确认方案完成[正式修正](../verification/evidence/tooling-review/2026-10-26/implementation/README.md)。main／extension-host 采用 Vite 的 Node 构建语义，依赖快照交给当前 Vite 环境验证和解析，监听随 configureServer 重建。根级依赖检查保留目标边并检查本包声明；原生测试使用应用自己的 CLI，清单排列与 catalog 已整理。工程需要的依赖保留，仅移除已被替代的 resolve.exports；各工程使用本地 Vitest 转换缓存，避免并行清理冲突。

本轮最终 pnpm check 与 45 项常规测试、Windows 下 8 项原生测试、4 种真实窗口及 5 项开发回归通过，最终构建输出已刷新。初次缓存冲突及开发监听失败均保留记录，并完成对应修正与复验。AGENTS.md 和规范明确从功能需求查阅社区方案，不限于已选技术栈；清单判断覆盖构建、测试、类型、配置、资产与 peer 用途。没有新增六目标、制品或性能验收，也未提交、推送或发布；其余未完成的平台与交付事项继续按原范围登记。

按新准则完成[工程与文档复核](../verification/evidence/comprehensive-review/2026-10-26/README.md)，结合源码通读、主题复核和同日有效证据，检查了当前工程及 144 篇正式设计和两份配置 JSON 的适用范围。修复共用进程函数重新继承明确删除的环境变量，以及消费者测试在浏览器创建或关闭失败时遗漏预览服务清理的问题；未调整公开合同、依赖和已确认方向，RPC 保持原方案。全仓检查及 46 项常规测试、2 项仓库外消费者回归通过。首次检查出现一次 Windows 候选目录重命名 EPERM，原输出恢复、完整复跑通过，根因未确认并保留记录。本轮未重复桌面、原生、性能、制品或六目标运行，未提交、推送或发布。

2026-10-26—27 完成[全面测试必要性复核](../verification/evidence/comprehensive-review/2026-10-26/testing.md)，覆盖全部 23 份现行用例、辅助与运行配置、任务和 CI，并逐主题核对 218 份当前 Markdown 中的测试与验收义务。发现等价用例、重复调用、无关形状断言、重复宿主前置检查，以及依赖边界准备、综合开发用例和 CI 执行范围可收敛的问题；文档另有 W13 重复调用 check／test、共用规则重复验证和平台组合表述过宽。该轮只记录建议及需保留的覆盖，没有新增运行证据。

经用户确认，已完成[测试收敛实施](../verification/evidence/testing-cleanup/2026-10-27/README.md)：去除等价用例和重复断言，11 项依赖边界案例共用一次实际分析；监听与清理移至较小接入层，真实开发场景独立运行并复用工作区准备。CI 使用 Turbo 任务 inputs 分别选择消费者、浏览器、原生、窗口、开发、性能和制品，保留手动完整验收、全局／未知基线回退及六目标门槛。五组文档义务与开发入口说明同步修正。全仓检查及 48 项常规测试、最终任务选择、7 项原生／SQLite、当前 7 项开发场景、浏览器及四窗口验证通过；开发恢复的过强断言已修正并单独复验，失败记录保留。本轮没有重跑性能、打包、公共包消费或远端 CI，没有提交、推送或发布；当前六目标和缓存恢复仍待实际结果登记。

随后完成 [monorepo 与 CI 完成度核对](../verification/evidence/monorepo-review/2026-10-27/README.md)。工作区、包边界、共享工程依赖、任务图与缓存已成立，但发现任务输入收窄漏掉打包配置和根 LICENSE，以及签名身份等任务环境声明不完整；两类遗漏已修正，实际 Turbo 任务图、十二类变更选择、类型、lint 与格式检查通过。历史六目标通过仅对应原提交，旧 CI 在任务选择粒度与重复运行成本方面未充分达到现行要求。W00 当前仍需新六目标与跨运行缓存恢复的实际结果；正式签名制品、首开及更新验签由 W11 负责，不作为 W00 当前未完成的理由。

用户已确认并落实[声明检查分工](../verification/evidence/declaration-checks/2026-10-27/README.md)：常规项目默认 skipLibCheck: true，strict 保持；公共声明消费者及 main／shared／renderer 中自有声明的拥有层保持完整检查。UI 旧配置例外合并回普通工具项目，自有声明覆盖沿现有结构检查核对。全仓检查、48 项常规测试、八包 publint／ATTW 和两项实际消费者通过。[当前 CI 记录](../verification/evidence/w00/2026-10-27/ci/README.md)保留一次主动取消及一次 Linux fixture 清理失败；后者的类型、lint、格式和本体 19 项断言已通过，ENOTEMPTY 清理修正等待新输入复验，不记作六目标成功。

随后 a20c3f0 的[完整 CI](../verification/evidence/w00/2026-10-27/ci/README.md)通过仓库检查、消费者与浏览器，Linux fixture 清理修正获得实际通过结果；Windows x64 和两个 macOS 目标完成原生、四窗口、开发、20 次启动测量及最终载体验证。两个 Linux 目标因 Xvfb 内未运行窗口管理器而失败，Windows arm64 因原生窗口观察的默认短超时失败；相关环境与观察预算已修正。构建身份同时排除工具包生成的测试报告，现有回归通过。当次三个目标失败及其日志保持原记录。

当前提交 711d956 的[运行 40454692840](../verification/evidence/w00/2026-10-27/ci/README.md)已通过仓库、六目标和 Required checks 共八项任务。各目标均执行五项候选／取消、原生与 SQLite、四窗口、七项开发场景、20 次启动测量及最终载体验证；Windows x64 的跨文件系统移动通过，其余五个 runner 因测试根处于同一文件系统明确跳过。七份原始附件、八个公共包与六目标共 26 个候选相关文件已归档核对，六目标的构建身份一致。随后在新 macOS arm64 runner 复跑，构建与打包分别实际命中四个公共包任务，桌面任务与真实运行检查重新执行通过，Required checks 再次成功。W00 当前范围的 A24、A26、A28、A31 及缓存证据已补齐；没有推进 W01、正式签署、合并、发布或部署。

随后按用户确认，将 MACOSX_DEPLOYMENT_TARGET 从 desktop 任务的公共环境移到 pnpm install 之前的 macOS 条件步骤，通过 GitHub Actions 原生 GITHUB_ENV 供后续步骤继承。13.0 在工作流中仍只定义一次，Windows／Linux 任务不再设置该变量。此次仅收窄 CI 配置作用域，actionlint 1.7.12、Prettier 和差异检查通过；未提交、推送或触发新的远端 CI，既有六目标证据仍对应 711d956。

随后完成[GitHub workflow 组织与维护复核](../verification/evidence/workflow-review/2026-10-27/README.md)：三份文件的职责与事件／取消边界成立，完整 SHA、只读权限、任务选择、六目标及汇总设计保留；确认两个旧 Action 的 Node 20 迁移提示和缓存主键命中后的重复保存需要维护，job／step 显示命名与任务超时另有整理建议。三份 workflow 通过 actionlint；本次仅审查和记录，未升级依赖、调整这些设计或触发新 CI，既有六目标结果保持原范围。

用户确认后已实施[workflow 维护](../verification/evidence/workflow-review/2026-10-27/README.md)：两项旧运行时 Action 升级为 Node 24 版本并固定完整 SHA；安装按 Node → pnpm 排序，pnpm 依赖缓存由 pnpm Action 单独管理；Turbo 主键命中时跳过保存，job／step 名称按职责统一，实际 job 增加与实测规模相称的超时。首次 v6.1.0 在 Intel macOS 的 pnpm 二次自更新失败；统一改用 Node 24 的 v5.0.0 直接安装目标包后，0abf572 的首轮仓库、六目标和汇总全部通过，七份附件及实际候选均归档核对。完整等待 28 分 53 秒，扣除初始排队后实际验证 26 分 55 秒，仓库反馈 4 分 42 秒。随后两次新 Apple Silicon runner 均恢复主键并命中四个公共包构建任务，但性能用例及 worker 收尾各超时 180 秒，未到达打包与成功后的缓存保存分支。失败报告没有具体等待点，已添加 Playwright 原生采样步骤记录；本机 Windows 20 次采样与 100 个阶段记录、类型及 lint 通过，macOS 故障尚未定位。六个构建目标保持不变。

<a id="environments"></a>

## 验证环境

| 资源         | 已确认范围                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| 本地设备     | Windows 10 22H2 x64（build 19045）、Ryzen 9 7945HX、约 32 GB 内存；RTX 4060 Laptop GPU 8 GB 与 AMD 集成显卡 |
| 本地执行条件 | 普通用户权限的交互桌面                                                                                      |
| 标准 CI | 当前 `711d956` 的[仓库与六目标运行](../verification/evidence/w00/2026-10-27/ci/README.md)全部通过；同一提交在新 macOS arm64 runner 上完成缓存恢复、任务命中与完整目标复跑 |

<a id="progress"></a>

## 工作包与独立项目

| 范围                                                                | 状态   |
| ------------------------------------------------------------------- | ------ |
| [W00：建立可运行的工程与测试入口](work-packages.md#w00)             | [声明检查与本机回归](../verification/evidence/declaration-checks/2026-10-27/README.md)、六目标首轮通过；[workflow 维护中的启动采样超时](../verification/evidence/workflow-review/2026-10-27/README.md)待定位与复验 |
| [W01：实现桌面与扩展合同、视觉基础及通信内核](work-packages.md#w01) | 未开始 |
| [W02：实现新数据库与原生操作基础](work-packages.md#w02)             | 未开始 |
| [W03：贯通一个完整业务链路](work-packages.md#w03)                   | 未开始 |
| [W04：完成全部资料库能力](work-packages.md#w04)                     | 未开始 |
| [W05：完成任务、后台生命周期与偏好](work-packages.md#w05)           | 未开始 |
| [W06：完成资料获取、采用、扫描和本地文件](work-packages.md#w06)     | 未开始 |
| [W07：完成游戏、视频、阅读与存档](work-packages.md#w07)             | 未开始 |
| [W08：完成扩展运行机制与作者工具](work-packages.md#w08)             | 未开始 |
| [W09：完成全体官方扩展](work-packages.md#w09)                       | 未开始 |
| [W10：完成主界面与应用管理界面](work-packages.md#w10)               | 未开始 |
| [W11：完成制品与发行工程](work-packages.md#w11)                   | 未开始 |
| [W12：完成项目文档与工程一致性核对](work-packages.md#w12)               | 未开始 |
| [W13：整体验收与交付](work-packages.md#w13)                         | 未开始 |
| Vantage 独立项目                                                    | 未开始 |
| Kana 独立项目                                                       | 未开始 |
| libmpv-node 独立项目                                                | 未开始 |
| oauth-relay 独立项目                                                | 未开始 |

分项进度见[交付检查清单](delivery-checklist.md)，验证记录见[验证证据](../verification/evidence/README.md)。

<a id="w00"></a>

## W00 实施记录

本轮[必要性复核](../verification/evidence/proportionality/2026-10-26/README.md)修正了上一轮扩展配置的无必要拆分，并移除测试对 workspace 配置写法、无关进程变化和输出文件名的过度约束。共同严格性与实际源码覆盖保持，验证采用变更对应的检查，已完成的历史运行证据保留其原提交和范围。

此前三个私有工程包与项目检查入口已经落实，工作区共 45 个成员；工具源码通过 package exports 直接交给固定宿主处理，旧 paths 与 Vitest 解析开关已移除。该轮 74 个既有类型环境的编译语义、八包运行合同与 27 份公开输出保持一致，878 个外部依赖没有版本或解析变化。当时扩展声明配置保留纯环境，新增 ESLint 配置单独按 Node 检查；跨项目暂存文件 lint 已验证。普通检查、真实任务图、12 项隔离缓存验证和全部本机宿主／制品入口通过；桌面开发快照只含生产依赖，构建身份覆盖新工程输入。CI 已配置 GitHub 原生缓存，实际跨运行恢复及当前六目标仍待登记。候选与八包制品已归档，见[私有工程包与缓存验证](../verification/evidence/w00/2026-10-26/monorepo-cache/README.md)。

此前，工程共有源码的 47 处跨层导入使用三个明确的命名入口，唯一映射由现有运行器读取。应用 `#native`、公开包 exports、依赖和工作区成员保持原样；27 份公共输出及八份 tarball 的摘要与调整前一致。普通检查、实际开发与取消、八包消费、浏览器、原生、四窗口、20 次启动测量、Windows 打包与原样 ZIP 均在本机通过，见[工程导入验证](../verification/evidence/w00/2026-10-26/readable-imports/README.md)。该轮输入的六目标结果未登记，按用户要求未等待 CI 完成。

当前工程入口已移除根 tools/outputs 及其系统锁依赖、访问上下文、Turbo 计划包装和项目脚本接入。根任务与项目脚本直接使用所属工具；候选交接、命令执行和 CLI 收尾为显式调用的普通函数。跨命令并发保证对应的测试已随合同调整移除。本机完整回归及[六目标 CI](../verification/evidence/w00/2026-10-25/sequential-workflows/ci/README.md)均已通过，每个目标实际执行 4 项候选与命令取消用例、2 项开发用例、四窗口、20 次启动测量及最终载体启动。八包制品和六目标候选已经归档并核对摘要，A24、A26、A28、A31 在当前 W00 范围通过，见[顺序执行验证](../verification/evidence/w00/2026-10-25/sequential-workflows/README.md)。

初始工程建立了 42 个实际 workspace 成员、四类独立程序构建和开发会话、私有 Rust／Node-API 工程、固定字体与原生资源输入、隔离 hooks、类型与依赖边界，以及 Node、浏览器、Electron、仓库外 tarball 消费、性能和最终制品测试入口。版本统一为未公开基线 `0.1.0-dev.0`。公共包目前只交付工程所需的实际入口，33 个扩展只有工程身份与配置；不提前声明 W01 或 W09 完成。

Windows x64 上，普通检查、八包消费、原生／SQLite 8 项、浏览器 1 项、四窗口 4 项、开发会话 1 项、最终 ZIP 1 项和 20 次启动测量均已通过。NSIS 已生成但未安装验收。历史 ffprobe 候选已停用；本体媒体能力改由 libmpv-node 接入，原生读取路线另有实际验证。命令、输入、构建身份、资源摘要和结果见 [2026-10-24 验证记录](../verification/evidence/w00/2026-10-24/README.md)。

随后按用户反馈整理了流程分段、职责和注释，并修复开发启动隐藏窗口的问题。该轮候选及对应回归见[可读性复核](../verification/evidence/w00/2026-10-24/readability-review/README.md)，旧临时输出也已完成清理。

此前的全覆盖复核核对了源码、配置与目录，保留 W00 已确认的骨架，明确逻辑分段规则并移除独立 ffprobe。该轮构建与本机回归见[全覆盖复核](../verification/evidence/w00/2026-10-24/full-audit/README.md)；媒体信息读取已完成[Windows 原生路线实测](../verification/evidence/media-information/2026-10-24/README.md)。

应用配置已按确认方案归组：根目录保留类型项目、常规 Node 与桌面端到端测试入口，16 份配置迁入 config 下的四类工具目录。七个类型项目的检查范围与严格性保持一致，11 个代表文件的语言服务项目归属核对通过；普通检查、构建、配置修改触发开发交接、全部本机运行入口和新 ZIP 均已验证。该轮构建及对应证据见[配置布局复核](../verification/evidence/w00/2026-10-24/config-layout/README.md)。

八个公共包已统一默认类型入口，保留根目录的库源码、工具与适用的构建配置，tsdown 明确读取库源码配置。17 个环境的覆盖与严格性保持一致，全部 38 个源码、工具和配置文件的语言服务归属与诊断通过；27 份公开 JS、声明和样式输出与调整前逐字节相同。八包制品消费、桌面构建、浏览器、四窗口及库配置失败恢复的开发回归已通过，见[公共包类型入口复核](../verification/evidence/w00/2026-10-24/package-config/README.md)。该轮也核对了七个工程模块的职责与调用关系。

目录职责与所有权原则已补入通用规范，并用于整理桌面工具：五个跨流程支撑模块归 tools/lib，开发 Electron 定位归 tools/dev，完整任务保留在顶层。41 个相关文件的实现与导入目标、七个类型项目的覆盖均已核对，普通检查、Windows 构建、原生、四窗口及开发会话回归通过，见[目录规范与工具归属复核](../verification/evidence/w00/2026-10-24/tool-layout/README.md)。

仓库根类型配置已拆分为工具、配置和测试三个项目，12 个输入及其编辑器归属均已核对，Node 工具不再混入 DOM 全局。根工具文档与实际目录一致，首次提交的忽略文件处理已修正，见[根配置收尾](../verification/evidence/w00/2026-10-24/root-config/README.md)。

临时私有验证库已创建并推送新工程历史。首次 CI 发现的 Windows 短路径、macOS bundle 链接、Linux 关闭等待及打包元数据问题已修复，增量选择的临时输出也已移出仓库根目录。修复提交 `df0d99d3373004f50f122441a7c01460615ada67` 的[完整运行](../verification/evidence/w00/2026-10-24/ci/README.md#完整运行结果)中，仓库检查、六目标桌面任务和 Required checks 共八项成功。七份原始附件、八个公共包及六目标实际候选均已下载并核对摘要，归档位置与回执见[证据留存](../verification/evidence/w00/2026-10-24/ci/README.md#证据与归档)。

A24、A26、A28、A31 在 W00 工程与测试入口范围内的断言已通过，W00 完成。跨文件系统移动仅在 Windows x64 取得运行证据，其余五个目标因 runner 测试根位于同一文件系统而明确跳过；完整业务、正式签署、公证、安装升级、系统支持下限及其余运行后端按所属后续工作包接续。尚未发布或部署。

随后修正了便携目录测试的归属：真实文件系统用例移入本体 tests/integration，由普通 Node 执行；database 与 native 套件单独由开发 Electron 的 Node 模式收集。两类入口分别收集 3 份与 2 份测试，交集为 0，便携目录的 4 项用例仅调整导入路径。普通检查通过，应用常规 Node 测试 10 项与原生／SQLite 8 项通过，见[测试归属修正记录](../verification/evidence/w00/2026-10-24/test-layout.json)。本次验证覆盖测试位置与宿主选择，运行源码未变，未重跑六目标、桌面与制品任务。

根工具、配置和测试三个类型项目已归入 config/typescript，消费者测试配置归入 config/vitest，默认入口与共享基线保留在根目录。三个类型项目的 12 个输入与有效编译选项保持一致，编辑器项目归属和语义诊断通过。早期配置归组曾引入的 dependency-cruiser 补丁已撤销，依赖及锁文件恢复为上游原版输入。

随后按确认的统一导入规则，应用 package.json 唯一定义 `#native`，主进程与原生集成测试共同消费。重复的 TypeScript paths、Vite alias 和专用边界解析配置已移除，依赖检查复用共享编译选项并保持全部 30 条规则。普通检查、编辑器解析、Windows x64 构建与打包、原生／SQLite 8 项、四窗口 4 项、开发会话及最终 ZIP 启动均通过；开发回归包含入口映射失败和恢复。实际产物与输入摘要见[包内入口验证](../verification/evidence/w00/2026-10-25/package-imports/README.md)。本轮未重跑其他五个目标，不扩展基线 CI 的证据范围。

按当前锁定版本补查了弃用 API：170 个 TypeScript 文件在 64 个实际类型项目上下文中全部覆盖，含安装真实制品后的消费者样板。唯一发现的 tseslint.config 调用已按官方建议迁移到 ESLint defineConfig，复查弃用引用为 0，170 个文件的有效 lint 配置与忽略状态保持一致，普通检查及本机 Rust 检查通过。四项上游工具链传递依赖的弃用通知单独登记为维护项；规范已补充弃用提示的核对与处理要求。详见[弃用接口审查](../verification/evidence/w00/2026-10-25/deprecations/README.md)。桌面运行输入未变，本轮未重复桌面或制品验收。

配置归属已提升为本体、公共包、扩展、模板及独立项目共同采用的工程规范。八个公共包的 17 份辅助类型配置与消费者样板的 1 份配置已迁入各自 config/typescript；默认入口和共享基线保留。18 份配置的有效编译选项及 39 个输入文件保持一致，38 个公共包文件的编辑器归属与语义诊断通过。普通检查、八包构建、仓库外消费、Windows x64 桌面构建与开发配置失败恢复均通过，27 份公开输出和八份 tarball 与迁移前逐字节相同，见[配置归属验证](../verification/evidence/w00/2026-10-25/config-convention/README.md)。本轮没有推进模板或独立项目实现，也未重跑其他五个目标及最终制品验收。

最终审查确认：公共包 config/typescript 遗漏在桌面构建身份输入之外；构建进程终止后遗留锁阻止重试；浏览器测试默认端口在本机 Windows 保留范围内，入口在执行用例前失败。前两项已隔离复现，浏览器指定可用端口后的补充运行通过。普通检查、Rust、原生／SQLite、四类窗口、包消费、开发会话、20 次启动测量、Windows 打包及原样 ZIP 运行均取得本轮通过结果，但不覆盖这三项缺口，详见[终审记录](../verification/evidence/w00/2026-10-25/final-review/README.md)。本轮未修改实现，W00 当前状态为待修正复核；历史六目标证据及其适用提交保持原记录。

终审后，公共包构建输入与开发监听改为使用同一输入选择，补齐 config，并增加合法编译选项变更与输出排除的回归用例；浏览器入口配置了 Vitest 公开 API 的回环地址与可递增起始端口。普通检查、默认浏览器测试和实际开发会话均在本机通过，见[局部修正记录](../verification/evidence/w00/2026-10-25/corrections/README.md)。工程锁未改，未引入新的锁依赖；buildId 仍采用现有输入指纹，其职责与锁的必要范围继续讨论。未重跑其他五目标或最终制品验收，W00 继续待修正复核。

随后确认 buildId 保留现有机制，并单独审视工程锁。隔离探针确认 Turbo 缓存恢复会绕过包构建函数的锁，开发快照也可能在目录替换期间接受混合代际的文件；clean 的检查后删除和目标级会话锁另作静态审查。建议先减少共享中间输出，再为固定输出及读取交接确定完整占用边界，公共包的缓存接入仍须闭合具体方案。详见[锁设计审视](../verification/evidence/w00/2026-10-25/lock-design-review/README.md)。本轮只记录审查与证据，未修改实现、正式设计合同或依赖，W00 状态保持待修正复核。
