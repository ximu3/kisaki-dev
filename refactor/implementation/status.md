# 设计与实施状态

<a id="design"></a>

## 当前交付

截至 2026-10-28，开发基线为 `cafcfce`。[PR #10](https://github.com/ximu3/kisaki-dev/pull/10) 已合并，其对应输入的[六目标 CI 与汇总门禁](https://github.com/ximu3/kisaki-dev/actions/runs/40707331506)通过，完整运行用时 20 分 15 秒。

| 范围 | 状态 |
| --- | --- |
| 产品与技术设计 | 产品、领域、界面、工程、扩展及独立项目的正式合同已建立。 |
| W00 工程与验证入口 | 主要实现和六目标工程验证完成；[仓库合并约束](#w00-pending)尚未落实，整包待收尾。运行记录按下方分类维护。 |
| W01–W13 | 未开始正式实施；八个公共包具备工程入口，33 个官方扩展具备工程身份与配置。 |
| Vantage、Kana、libmpv-node、oauth-relay | 未开始正式实现与制品交付。 |
| 正式应用与发行 | 完整产品、签署、公证、安装升级、系统支持下限及主要后端验收未完成；npm、正式下载、更新索引和生产服务未发布。 |

各阶段的实现、运行验证与发行按[验收标准](../verification/acceptance.md)分别记录。

<a id="w00-pending"></a>

## W00 待闭合事项

`ximu3/kisaki-dev` 的 `main` 未受保护，ruleset 列表为空。现行[协作规范](../design/engineering/workspace.md#collaboration)要求合并必须通过 `verify / Required checks` 和 `PR title`，仓库配置尚未落实。实际读取结果见[完成度核对](../verification/evidence/project-documentation/2026-10-28/README.md#w00)。

## 运行记录与观察

| 分类 | 当前判断与证据 |
| --- | --- |
| 已定位并处理 | Electron 44 的窗口可见性回调访问已销毁对象、阻塞退出，由 Electron 45 移除该回调处理；正式六目标验证通过，见[退出诊断](../verification/evidence/ci-exploration/2026-10-27/README.md)。有完整轨迹的 macOS x64 开发就绪超时属于冷构建准备耗时，准备预算已按实测配置并验证，见[冷准备核对](../verification/evidence/final-state-coherence/2026-10-28/followup.md)。 |
| 历史未归因 | 更早的 macOS x64 首次 ready 超时及两次 Apple Silicon 采样超时缺少必要诊断，保留原始结果。它们不能逐次确证为上述原因，也不能直接证明当前输入仍存在同一故障，见[启动记录](../verification/evidence/ci-design/2026-10-27/adoption/README.md)与[采样记录](../verification/evidence/workflow-review/2026-10-27/README.md)。 |
| 待查占用 | Windows 候选输出目录交接曾返回 EPERM，旧输出已恢复，占用者未确定。需要区分内部未释放句柄与外部占用，再判断是否修改资源收尾；原始记录见[输出交接](../verification/evidence/ci-architecture/2026-10-28/development-tests.md)。 |

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
| 反馈目标 | [4／10／25 分钟](../design/engineering/workspace.md#ci-feedback)；最新完整 CI 为 20 分 15 秒，增量基准见[任务与反馈证据](../verification/evidence/ci-design/2026-10-27/README.md)。 |

<a id="progress"></a>

## 工作包与独立项目

| 范围 | 状态 |
| --- | --- |
| [W00：工程与测试入口](work-packages.md#w00) | 待收尾，见[未闭合事项](#w00-pending)和[已完成范围](#w00)。 |
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
| CI | 按真实输入选择任务和目标，仓库与桌面工作流各自执行，独立标题检查及汇总门禁通过。 |

当前源码的[审查与本机验证](../verification/evidence/project-readability/2026-10-28/README.md)和[六目标运行](https://github.com/ximu3/kisaki-dev/actions/runs/40707331506)共同覆盖以上范围。单项验收的完整产品要求继续按所属工作包执行。

历史输入、失败、修正、原始报告与制品摘要保存在[证据索引](../verification/evidence/README.md)。本页维护当前完成度、缺项及其证据入口。
