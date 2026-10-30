# 设计与实施状态

<a id="design"></a>

## 当前交付

截至 2026-10-30，W00 的工程与测试入口交付完成。工程基线 `51a4130` 对应的[六目标 CI 与汇总门禁](https://github.com/ximu3/kisaki-dev/actions/runs/40811103983)通过，完整运行用时 18 分 39 秒；[仓库合并约束](#merge-rules)已配置，并通过真实 PR 的元信息编辑与可合并状态核对，见[门禁验证](../verification/evidence/w00/2026-10-29/ci-gate/README.md#verification)。

| 范围 | 状态 |
| --- | --- |
| 产品与技术设计 | 产品、领域、界面、工程、扩展及独立项目的正式合同已建立。 |
| W00 工程与验证入口 | 已完成；工程、资源、开发、消费者和测试入口有对应证据，六目标与严格合并门禁均已验证。 |
| W01–W13 | 未开始正式实施；八个公共包具备工程入口，33 个官方扩展具备工程身份与配置。 |
| Vantage、Kana、libmpv-node、oauth-relay | 未开始正式实现与制品交付。 |
| 正式应用与发行 | 完整产品、签署、公证、安装升级、系统支持下限及主要后端验收未完成；npm、正式下载、更新索引和生产服务未发布。 |

编码规范归属与类型感知检查已完成本机验证，包含完整 lint、54 项普通 Node 测试和仓库外包消费，验证范围见[规范与检查验证](../verification/evidence/readability-conventions/2026-10-30/README.md)。

源码概述与配置说明已按职责区分，窗口与输出寿命、lint 修复前置、错误结果和开发会话说明已完成相应修正。本机类型、lint、普通测试、五项窗口回归、四项开发流程和二十次启动检查通过；本次六目标 CI 尚待对应提交验证，见[源码与工程验证](../verification/evidence/w00/2026-10-30/source-quality/README.md)。

各阶段的实现、运行验证与发行按[验收标准](../verification/acceptance.md)分别记录。

<a id="merge-rules"></a>

## 仓库合并约束

`ximu3/kisaki-dev` 的 `main` 启用原生分支保护：必须通过 PR，分支包含最新主线，`verify / Required checks` 与 `PR title` 由 GitHub Actions 成功提供；管理员同样遵守，审批人数为 0。主线禁止强推和删除，仓库只允许 Squash，并自动删除已合并远端分支。实际配置和读回结果见[W00 收尾验证](../verification/evidence/w00/2026-10-29/closure/README.md#repository)。

## 运行记录与观察

| 分类 | 当前判断与证据 |
| --- | --- |
| CI 元信息编辑 | 已通过原生 PR 事件入口处理。运行中及通过后的标题、正文编辑保持原代码验证；无效标题、正文编辑与标题修正的独立结果均已验证，严格保护下合并状态正常，见[门禁验证](../verification/evidence/w00/2026-10-29/ci-gate/README.md#verification)。 |
| 已定位并处理 | Electron 44 的窗口可见性回调访问已销毁对象、阻塞退出，由 Electron 45 移除该回调处理；正式六目标验证通过，见[退出诊断](../verification/evidence/ci-exploration/2026-10-27/README.md)。有完整轨迹的 macOS x64 开发就绪超时属于冷构建准备耗时，准备预算已按实测配置并验证，见[冷准备核对](../verification/evidence/final-state-coherence/2026-10-28/followup.md)。 |
| 历史未归因 | 更早的 macOS x64 首次 ready 超时及两次 Apple Silicon 采样超时缺少必要诊断，保留原始结果。它们不能逐次确证为上述原因，也不能直接证明当前输入仍存在同一故障，见[启动记录](../verification/evidence/ci-design/2026-10-27/adoption/README.md)与[采样记录](../verification/evidence/workflow-review/2026-10-27/README.md)。 |
| Windows 输出占用观察 | 候选交接曾出现 EPERM，占用者尚未确定。2026-10-30 一次桌面构建失败后，带只读诊断的显式重建通过；既有受控占用验证覆盖旧输出恢复与后续构建，见[占用核对](../verification/evidence/w00/2026-10-29/closure/README.md#output)和[本次观察](../verification/evidence/w00/2026-10-30/source-quality/README.md#observations)。 |

## 后续工作包的交付范围

- 本体 Drizzle 1.x 的正式 ORM/Kit 组合、schema、codec、迁移和查询性能尚未由正式工程验证。现有查询试件与候选证据保持各自适用范围。
- 正式业务、界面、播放器、扫描与 Worker 尚未实现；播放音量与静音记忆和识别预设的单行规则由相应合同定义。表达式探针只证明其匹配边界。
- 官方扩展及三个译本尚未完成正式宿主、资源、安装和消费验证。Google OAuth 应用审核、AniList 高级评分及部分导入器的真实软件样本仍有证据缺口，见[逐项交付清单](delivery-checklist.md#extensions)与[来源证据](../verification/evidence/final-state-coherence/2026-10-28/extensions-review.md)。
- 四个独立项目须完成正式实现、目标制品和各主要后端的联合验证。libmpv 的固定源码补丁已有核对证据；正式媒体库、截图、颜色和 GPU 接入尚未完成。
- 跨文件系统移动仅在 Windows x64 取得运行证据，其他五个 CI 目标因测试根同属一个文件系统而跳过。完整平台组合、安装升级、正式签署、独立扩展额外许可及随包权利材料仍待对应交付验证。

## 仓库与发布

公开开发远端为 [ximu3/kisaki-dev](https://github.com/ximu3/kisaki-dev)，本地 origin 指向该地址，承载源码、PR、CI、候选制品与跨仓联调。正式仓库接续、npm 发行和服务部署按[仓库合同](../design/engineering/repository.md)及实际授权执行。

旧 ximu3/kisaki 的存档与同名重建尚未执行；实际仓库状态见[完成度核对](../verification/evidence/project-documentation/2026-10-28/README.md#w00)。四个独立项目的正式开发仓库与交付制品尚未登记；开发仓库及 oauth-relay 最终源码仓库采用 public 可见性。

<a id="environments"></a>

## 验证环境

| 资源 | 已确认范围 |
| --- | --- |
| 本地设备 | Windows 10 22H2 x64（build 19045）、Ryzen 9 7945HX、约 32 GB 内存；RTX 4060 Laptop GPU 8 GB 与 AMD 集成显卡。 |
| 本地执行条件 | 普通用户权限的交互桌面；测试使用独立资料与目录。 |
| 标准 CI | Windows、macOS、Linux 的 x64／arm64；各目标有原生架构构建、基础运行与候选载体验证。系统、输入、样本及未覆盖组合由对应证据记录。 |
| 反馈目标 | [4／10／25 分钟](../design/engineering/workspace.md#ci-feedback)；增量基准见[任务与反馈证据](../verification/evidence/ci-design/2026-10-27/README.md)。 |

<a id="progress"></a>

## 工作包与独立项目

| 范围 | 状态 |
| --- | --- |
| [W00：工程与测试入口](work-packages.md#w00) | 已完成，见[交付范围](#w00)、[合并约束](#merge-rules)和[门禁验证](../verification/evidence/w00/2026-10-29/ci-gate/README.md#verification)。 |
| [W01：桌面与扩展合同、视觉基础及通信内核](work-packages.md#w01) | 未开始 |
| [W02：数据库与原生操作](work-packages.md#w02) | 未开始 |
| [W03：完整业务链路](work-packages.md#w03) | 未开始 |
| [W04：资料库能力](work-packages.md#w04) | 未开始 |
| [W05：任务、后台生命周期与偏好](work-packages.md#w05) | 未开始 |
| [W06：资料获取、采用、扫描和本地文件](work-packages.md#w06) | 未开始 |
| [W07：游戏、视频、阅读与存档](work-packages.md#w07) | 未开始 |
| [W08：扩展运行机制与作者工具](work-packages.md#w08) | 未开始 |
| [W09：官方扩展](work-packages.md#w09) | 未开始 |
| [W10：主界面与应用管理界面](work-packages.md#w10) | 未开始 |
| [W11：制品与发行工程](work-packages.md#w11) | 未开始 |
| [W12：项目文档与工程一致性](work-packages.md#w12) | 未开始 |
| [W13：整体验收与交付](work-packages.md#w13) | 未开始 |
| Vantage、Kana、libmpv-node 与 oauth-relay | 未开始 |

扩展及独立项目的分项进度由[交付检查清单](delivery-checklist.md)维护。

<a id="w00"></a>

## W00 已完成范围

| 交付项 | 实现与验证 |
| --- | --- |
| 工程与程序边界 | 45 个 workspace 成员，main、preload、renderer、extension-host 与私有 Rust/Node-API 入口；类型、依赖和运行环境检查实际执行。 |
| 构建与资源（A24） | 六目标构建、固定字体与图标、SQLite/native 资源及摘要校验；每份输出由单一任务交接，准备失败保留既有结果。 |
| 开发会话 | 公共父子 IPC、隔离资料、源码与打包应用接入、输入监听、HMR、完整候选采用、失败恢复及取消收尾。 |
| Hooks（A26） | 安装、重复安装、卸载、配置冲突、部分暂存失败恢复及 worktree 行为经隔离仓库验证。 |
| 测试与制品入口（A28） | Node、真实浏览器、Electron Node ABI、四窗口、20 次启动测量和保留生产 fuses 的外部载体验证；六目标均已运行。 |
| 包消费与工程规则（A31） | 八包 tarball、声明与 CSS 的仓库外消费通过；源码边界、任务输入、资源寿命、文件说明和可读性已核对。 |
| CI | PR 按真实输入选择代码验证并独立校验标题，手动入口执行完整验证；主线沿用合并前的代码证据。入口分工及验证范围见[CI 入口记录](../verification/evidence/w00/2026-10-29/code-verification/README.md)，严格合并门禁继续生效。 |

当前源码的[审查与本机验证](../verification/evidence/project-readability/2026-10-28/README.md)、[六目标运行](https://github.com/ximu3/kisaki-dev/actions/runs/40811103983)和[合并门禁验证](../verification/evidence/w00/2026-10-29/ci-gate/README.md#verification)共同覆盖以上范围。单项验收的完整产品要求继续按所属工作包执行。

历史输入、失败、修正、原始报告与制品摘要保存在[证据索引](../verification/evidence/README.md)。本页维护当前完成度、缺项及其证据入口。
