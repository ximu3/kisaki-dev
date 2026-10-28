# 设计与实施状态

<a id="design"></a>

## 当前进度

截至 2026-10-28：

| 范围 | 状态 |
| --- | --- |
| 产品、领域、界面、工程及扩展设计 | 正式合同已建立；终态实现与整体一致性已列为首要准则。本轮按确认补齐播放控制记忆、预设单行范围及 oauth-relay 最终公开仓库合同。 |
| W00 工程与验证入口 | PR #1、#3、#4、#5、#6、#7、#8 已合并，当前基线为 ad9113d。工程外壳、四类窗口、公共包消费及六目标运行有对应提交的证据。 |
| 全项目终态一致性审查 | 已逐项审阅当前维护文件，修正合同冲突、语言扩展 ID、固定源码摘要、工程说明和资源清理。构建输入改由 Turbo 任务定义拥有；整仓检查、53 项常规测试、Windows 构建、4 项真实开发回归及原样 ZIP 验证通过。六项原生检查通过、一项因同文件系统跳过；首轮 CI 五目标通过，macOS x64 冷准备等待超时已据轨迹定位并调整，输入时序与新提交复验见[审查记录](../verification/evidence/final-state-coherence/2026-10-28/README.md)。 |
| 文件与模块说明 | [统一必写规范](../design/engineering/conventions.md#file-module-comments)与现有文件补齐已合并为 ad9113d；[412 份输入覆盖及验证](../verification/evidence/file-module-comments/2026-10-28/README.md)保留实际范围。 |
| W01–W13 与四个独立项目 | 未开始正式实施；33 项官方扩展只具备工程身份与配置，三个译本尚未完成正式资源交付。 |
| 正式应用与发行 | 完整产品、正式签署、安装升级、系统支持下限和主要运行后端的最终验收未完成；未执行 npm、正式下载、更新索引或生产服务发布。 |

工程完成度不等于产品完成度。已有设计探针、候选装配、公开包的工程入口与真实运行测试分别对应自己的范围，完整交付按[验收标准](../verification/acceptance.md)判断。

## 尚未完成的合同实施与证据

- preferences.playback 的应用级音量和静音记忆、四种行终止符的扫描预设边界已确认并写入合同；正式播放器、扫描、Worker 和 UI 尚未实现。九项表达式的独立探针通过只证明表达式边界。
- 本体 Drizzle 1.x 的正式 ORM/Kit 版本组合、完整 schema、codec、迁移及查询性能尚未由正式工程验证。现有 0.45.2 查询试件与 1.0.0-rc.5 候选证据保留各自范围。
- Google OAuth 应用验证未取得完成证据。既有 Desktop 授权、刷新、OpenID 身份与 Books API 成功不能替代应用审核；原事实与来源缺口见[扩展审查](../verification/evidence/final-state-coherence/2026-10-28/extensions-review.md)。AniList 高级评分、部分导入器的真实软件样本及官方扩展的正式宿主与安装消费仍按[逐项交付清单](delivery-checklist.md#extensions)核对。
- Vantage、Kana、libmpv-node 和 oauth-relay 尚未建立正式实现仓库与交付制品。六目标、主要图形与桌面后端、完整原生平台包、relay 两架构镜像和实际部署均须取得对应正式实现的证据。
- libmpv 两项固定源码修改已核对原始 Git blob、精确套用和前后摘要；本轮没有新增媒体库编译、截图、颜色或 GPU 运行结果。
- 跨文件系统移动仅在 Windows x64 取得运行证据；其他五个 CI 目标的测试根同属一个文件系统，跳过不记为通过。正式签名、公证、安装升级、独立扩展额外许可及完整随包权利材料仍待交付。
- 历史 macOS x64 首次启动偶发超时、两次 Apple Silicon 性能／收尾超时，以及本机候选目录交接的偶发 EPERM 尚未确定根因。后续通过与未复现保留为实际结果，不等同于问题已修复，详见[CI 维护](../verification/evidence/workflow-review/2026-10-27/README.md)和[工程组织验证](../verification/evidence/ci-architecture/2026-10-28/README.md)。

## 仓库与发布状态

项目级开发远端为公开的 [ximu3/kisaki-dev](https://github.com/ximu3/kisaki-dev)，本地 origin 指向该地址，承担正式接续前的持续开发、PR、CI 与候选制品。改名及公开结果见[仓库改名](../verification/evidence/repository/2026-10-26/rename.json)与[可见性核对](../verification/evidence/repository/2026-10-27/README.md)。

旧 ximu3/kisaki 在 2026-10-25 核对时仍公开且未归档，旧资料存档与同名重建未执行。四个独立项目的开发仓库尚未创建，开发可见性统一为公开；oauth-relay 最终仓库也已确认公开。实际建仓、正式接续、发布及服务切换按[仓库合同](../design/engineering/repository.md)与对应授权处理。开发仓库尚无 main 分支保护／ruleset 的配置完成记录，既有规范要求的检查名称不代表已启用保护。

<a id="environments"></a>

## 验证环境

| 资源 | 已确认范围 |
| --- | --- |
| 本地设备 | Windows 10 22H2 x64（build 19045）、Ryzen 9 7945HX、约 32 GB 内存；RTX 4060 Laptop GPU 8 GB 与 AMD 集成显卡。 |
| 本地执行条件 | 普通用户权限的交互桌面；测试使用独立资料与目录。 |
| 标准 CI | Windows、macOS、Linux 的 x64／arm64 工程基线已取得实际运行与候选制品证据；具体输入、工作流、运行和未覆盖项由对应证据保存。本轮结果单独登记。 |
| 反馈目标 | [4／10／25 分钟](../design/engineering/workspace.md#ci-feedback)。PR #6 实现提交的完整九项 CI 为 19 分 36 秒，消费者增量为 1 分 49 秒；单次样本不作为稳定提速比例。 |

<a id="progress"></a>

## 工作包与独立项目

| 范围                                                                | 状态   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [W00：建立可运行的工程与测试入口](work-packages.md#w00) | 工程基线、六目标与缓存证据已建立；当前维护验证见[本轮审查](../verification/evidence/final-state-coherence/2026-10-28/README.md)，范围内 A24、A26、A28、A31 与完整产品验收分别记录。 |
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

## W00 工程证据

W00 已建立 45 个 workspace 成员、四类程序构建与开发会话、私有 Rust／Node-API 工程、固定资源准备、类型与依赖检查，以及 Node、浏览器、Electron、真实包消费、性能和最终制品验证入口。普通 `check` 与真实宿主、性能、制品的范围分别记录。

| 范围 | 已有结果与入口 |
| --- | --- |
| 初始工程与六目标 | [2026-10-24 基线](../verification/evidence/w00/2026-10-24/README.md)及[六目标运行与归档](../verification/evidence/w00/2026-10-24/ci/README.md)；后续输入只按仍适用范围复用。 |
| 工程归属与配置 | [配置归组](../verification/evidence/w00/2026-10-25/config-convention/README.md)、[包内入口](../verification/evidence/w00/2026-10-25/package-imports/README.md)、[弃用接口核对](../verification/evidence/w00/2026-10-25/deprecations/README.md)。四项上游传递依赖的弃用通知保留为维护项。 |
| 输出与命令寿命 | [顺序执行及六目标验证](../verification/evidence/w00/2026-10-25/sequential-workflows/README.md)；同一副本内独立流程顺序执行，完整候选成功后交接。 |
| 私有工程包与缓存 | [共享工程及本机验证](../verification/evidence/w00/2026-10-26/monorepo-cache/README.md)、[六目标和跨运行缓存](../verification/evidence/w00/2026-10-27/ci/README.md)。 |
| 公共父子 IPC 与窗口关闭 | [开发连接实现](../verification/evidence/development-ipc/2026-10-26/implementation/README.md)、[Chokidar 6／Electron 45 修正](../verification/evidence/ci-exploration/2026-10-27/README.md)；PR #3、#4 及主线接续已通过相应运行。 |
| AppImage | [上游条件兼容策略](../verification/evidence/appimage-policy/2026-10-26/adoption/README.md)；Ubuntu 24.04 x64 十三项启动对照限于所述条件，不代表全部原生 Wayland 后端。 |
| CI 事件、任务与目标 | [元信息事件](../verification/evidence/ci-events/2026-10-26/README.md)、[工程工作流和目标组织](../verification/evidence/ci-architecture/2026-10-28/README.md)、[脚本与消费者范围](../verification/evidence/script-domain-audit/2026-10-28/implementation/README.md)。PR #5、#6、#7 已合并。 |
| 类型与声明检查 | [声明检查分工](../verification/evidence/declaration-checks/2026-10-27/README.md)；常规项目保留 strict，公开声明消费者及自有声明拥有层完整检查。 |
| 文件与模块概述 | [覆盖和输出核对](../verification/evidence/file-module-comments/2026-10-28/README.md)；[PR #8](https://github.com/ximu3/kisaki-dev/pull/8)已于 2026-10-28 合并为 ad9113d。 |
| 终态与整体一致性 | [本轮完整覆盖、取舍与验证](../verification/evidence/final-state-coherence/2026-10-28/README.md)。 |

早期探索、失败、修复前状态与各次运行的原始记录保留在[证据索引](../verification/evidence/README.md)，不再作为当前待办重复列出。本页维护当前结论，原始证据中的提交、环境、摘要与当时结果保持不变。
