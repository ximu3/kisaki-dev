# 设计与实施状态

<a id="design"></a>

## 实施进展

截至 2026-11-28，W00 工程基础已合入主线，W09 已在开发分支完成六目标验收。工作区含根工程、桌面应用、两个私有工程包和六个桌面公共包，共 10 个项目。目标范围及依赖见[工作包](work-packages.md)，当前源码职责、环境与命令见[当前工程与开发](development.md)。

2026-11-23 的工作树通过全仓检查、六个公共包的独立验证及 Windows x64 桌面综合验证，含隔离打包载体的启动与退出。已在简化后的存储基线验证 13 处可空引用、27 项 Electron Node 用例和完整性能负载。真实窗口用例 15 项通过，另有 3 项按宿主条件跳过。该轮在本机复验存储和窗口。W09 后续取得的六目标结果见[资料库验收](../verification/evidence/w09/README.md#six-targets)。[数据库验证](../verification/evidence/w06/README.md#ownership) · [窗口与设置](../verification/evidence/w07/README.md#window-lifetime)

W03 的作品完成合同和 W06 的存储已区分附加次数与逐次明细。首次发行基线直接包含附加次数与明细约束，只有日期或该次非空备注的经历作为明细保存。四类作品的编辑、查询与统计界面归 W09。[完成模型](../design/domains/records.md#additional-completions)

工作区采用 Vite+，主线编译器锁定为 `7.1.0-beta`。升级到 7.1.x 正式版时重跑全部项目引用，用仓库外消费者检查发布声明，同时确认检查失败会返回非零退出码、类型感知 lint 能检出未等待的 Promise。六个公共包共用 `@kisaki3/config`，CI 按[包和宿主](../design/engineering/workspace.md#ci-selection)独立运行本地任务，制品验收直接读取指定归档。[工具链迁移 PR #39](https://github.com/ximu3/kisaki-dev/pull/39)

桌面四类窗口和 desktop-ui 使用 Solid 2。公共 UI 通过 `/virtualization` 提供自研行几何，图表直接使用 `@unovis/ts`。本轮复验覆盖 Windows x64、Chromium、沙箱 Electron、开发热更新与仓外安装。[W05／W07 复验](../verification/evidence/w05-w07/README.md#solid-2)

[W00 验收](../verification/evidence/w00/README.md)已取得本机 Windows x64 和 CI 六目标结果，覆盖工程载体的构建、原生与 Electron 运行、开发回归、打包及制品运行。

各公共包从同一份已检查的 tarball 验证独立消费，根入口通过 Vite Task 调度。外观、分发、桌面合同与本地化分别见 [W01](../verification/evidence/w01/README.md)、[W02](../verification/evidence/w02/README.md) 和 [W03](../verification/evidence/w03/README.md)。[W04](../verification/evidence/w04/README.md) 另以 Node 父子进程和 Electron 窗口验证两种消息通道及其寿命。[W05](../verification/evidence/w05/README.md) 验证公共 UI 的完整组件、普通样式与浏览器／Electron 消费。

原生／SQLite、4 项 Electron 入口和制品运行已有本机及六目标 CI 结果，跨文件系统用例按实际测试根记录。最新跨平台检查由对应 PR 记录。

错误传递覆盖启动与停止失败、取消期间的独立命令错误、操作与清理错误的保留，以及测试清理的结果交付。故障通过测试边界注入，完整诊断由失败钩子统一输出。本机 6 项开发回归、4 项 Electron 入口和制品运行通过；两轮 Linux arm64 重复验证共 100 次场景执行通过。实际范围、历史观察及归因限制见[关闭验证](../verification/evidence/w00/development.md#shutdown)。

完整产品、适用签署、安装升级、系统支持下限和主要后端验收仍待完成。npm、正式下载、更新索引及生产服务尚未发布。各对象按[验收标准](../verification/acceptance.md)登记自己的结果。

<a id="progress"></a>

## 工作包进度

| 工作包                                                        | 当前结果与待完成范围                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [W00 工程与测试入口](work-packages.md#w00)                    | 实现与适用验收已完成，见[实际交付](#w00)与[关闭验证](../verification/evidence/w00/development.md#shutdown)。                                                                                                                                 |
| [W01 desktop-appearance](work-packages.md#w01)                | 实现与适用验收已完成：42 项视觉词表、纯值解析、默认值、CSS、Tailwind 映射、声明与独立制品消费通过；[验证记录](../verification/evidence/w01/README.md#current-vocabulary)。项目文档待 W23，尚未公开发布。                                                           |
| [W02 extension-distribution](work-packages.md#w02)            | 实现与适用验收已完成：身份、manifest、registry、本地化、兼容选版、不可变制品和独立 Node 签名入口；25 项行为测试、仓库外 Node／浏览器消费及 CI 通过，[本机及 CI 证据](../verification/evidence/w02/README.md)。项目文档待 W23，尚未公开发布。 |
| [W03 桌面合同与本地化](work-packages.md#w03) | 实现与适用验收已完成。恢复索引可表达准备时尚未发布清单，详情区分未发布和发布后无效。实际文件恢复由 W15 实现。[恢复设计](../design/domains/backups.md#recovery) 合同包交付接口、值约束与规范编码，展示柜采用单项保存、明确批量创建与共用引导输入；实际业务操作和界面由 W09、W22 实现。本地化包交付英语、关联类型、译本校验与格式化。两个包均通过制品和独立消费验证，见[本机及 CI 证据](../verification/evidence/w03/README.md)。项目文档待 W23，尚未公开发布。 |
| [W04 desktop-rpc](work-packages.md#w04)                       | 实现与适用验收已完成。环境无关的 RPC 包通过帧与连接机制、制品、独立声明以及 Node 父子 IPC 和 Electron 窗口的真实通道验证，见[验证记录](../verification/evidence/w04/README.md)。项目文档待 W23，尚未公开发布。                               |
| [W05 desktop-ui](work-packages.md#w05) | 34 个公共组件家族已实现，适用验收已完成。[外部字段反馈、焦点和数字步进](../verification/evidence/w05-w07/README.md#completion)已在 Chromium 复验。[表单、受控状态和原生交互](../verification/evidence/w05-w07/README.md#ui)已在 Windows x64 复验。Form 与 Field 统一提交和反馈，多选与快捷键共用滚动标签，选项行接入统一尺寸档位。[公共控件与制品验证](../verification/evidence/w05/README.md#rewrite-consumers)记录 Windows x64 与 Linux x64 的公共包验证。Windows x64 已复验[输入法组合后的连续更新](../verification/evidence/w05/README.md#composition-updates)。实际桌面消费见 W07。项目文档归 W23。 |
| [W06 存储与原生基础](work-packages.md#w06) | 实现与适用验收已完成。此前基线的存储、文件设施和随语言切换的索引已通过六目标运行与制品验收。当前外键基线的复验范围见[同作品约束](../verification/evidence/w06/README.md#ownership)。[完整存储负载](../verification/evidence/w06/README.md#six-target-workload)在六个目标通过，Linux 同机对照验证了 worker 中位数门槛能拦住持续慢查询。 |
| [W07 应用运行与设置](work-packages.md#w07)                    | 本包约定的实现与验收已完成。关闭前保存的字段定位、普通 Dialog 操作和运行文案见[当前工作树复验](../verification/evidence/w05-w07/README.md#completion)。[操作取消、退出收尾、文件准备、观察与资源寿命](../verification/evidence/w05-w07/README.md#runtime)已在 Windows x64 复验。四类窗口分别接入文档外观与通知。主窗口的任务、偏好、主题、字体与系统集成按场景加载，见[管理界面实机对照](../verification/evidence/w07/README.md#shared-dialogs)与[源码开发验证](../verification/evidence/w07/README.md#source-dev-styles)。[文档导航和管理查询](../verification/evidence/w07/README.md#document-navigation)、[目标呈现、取消与回焦](../verification/evidence/w07/README.md#navigation-handover)已在 Windows x64 复验。此前 UI 重写的[六目标结果](../verification/evidence/w07/README.md#ui-rewrite-six-targets)按所列修订保留。W09 接入业务页面，W20 另验安装身份下的登记、升级、卸载与通知冷启动。 |
| [W08 libmpv-node](work-packages.md#w08) | 进行中。mpv v0.42.0 主包、六个平台包和六份对应源码已留存，可供 W09、W16 联调。六目标已通过 Node 和实际 Electron 的独立安装、控制、流、字幕、软件输出与 ASAR 验证。Windows 10 x64 已验证 D3D11VA、共享帧、两种 SDR 目标、截图、引用回收和 WASAPI。各目标的设备与系统版本缺项见[实机验收范围](../verification/evidence/w08/README.md#hardware)。[联调制品与摘要](../verification/evidence/w08/README.md#handoff) |
| [W09 本地资料库、持有与个人记录](work-packages.md#w09) | 实现与适用验收已完成。七类条目、分部与关系、批量整理、个人记录、展示柜和本地文件维护均已接入桌面。Windows、macOS、Linux 的 x64 与 arm64 均已从候选制品启动，取得真实动画媒体信息并读回分集关联。[场景与六目标结果](../verification/evidence/w09/README.md#six-targets) · [W08 固定联调制品](../verification/evidence/w08/README.md#handoff) |
| [W10 Vantage](work-packages.md#w10)                           | 未开始；分项结果见[项目交付](delivery-checklist.md#projects)。                                                                                                                                                                               |
| [W11 Kana](work-packages.md#w11)                              | 未开始；分项结果见[项目交付](delivery-checklist.md#projects)。                                                                                                                                                                               |
| [W12 oauth-relay](work-packages.md#w12)                       | 未开始；分项结果见[项目交付](delivery-checklist.md#projects)。                                                                                                                                                                               |
| [W13 来源获取与资料采用](work-packages.md#w13)                | 未开始。                                                                                                                                                                                                                                     |
| [W14 作品发现与扫描](work-packages.md#w14)                    | 未开始。                                                                                                                                                                                                                                     |
| [W15 共同使用会话、游戏与存档](work-packages.md#w15)          | 未开始。                                                                                                                                                                                                                                     |
| [W16 视频播放](work-packages.md#w16)                          | 未开始。                                                                                                                                                                                                                                     |
| [W17 漫画与小说阅读](work-packages.md#w17)                    | 未开始。                                                                                                                                                                                                                                     |
| [W18 extension-sdk、扩展宿主与应用搜索](work-packages.md#w18) | 未开始。                                                                                                                                                                                                                                     |
| [W19 extension-cli](work-packages.md#w19)                     | 未开始。                                                                                                                                                                                                                                     |
| [W20 桌面构建、安装与应用更新](work-packages.md#w20)          | 未开始。                                                                                                                                                                                                                                     |
| [W21 30 项官方功能扩展](work-packages.md#w21)                 | 未开始；30 项功能扩展的实现、文档与发布结果见[清单](delivery-checklist.md#extensions)。                                                                                                                                                      |
| [W22 首次与更新引导、官方译本](work-packages.md#w22)          | 未开始；引导与三个官方译本联合验收，译本的分项结果见[清单](delivery-checklist.md#extensions)。                                                                                                                                               |
| [W23 项目文档与协作入口](work-packages.md#w23)                | 未开始。W23 交付根 README 及其语言版本、贡献说明、八个公共包说明和 Issue Forms；官方扩展与独立项目的文档结果见[交付清单](delivery-checklist.md)。                                                                                                              |
| [W24 整体验收](work-packages.md#w24)                          | 未开始；按固定候选版本核对发布前完整条件。                                                                                                                                                                                                   |
| [W25 公开发行与发布核验](work-packages.md#w25)                | 未开始；正式仓库接续、首次公开发行、正式分发与生产服务切换均待执行。                                                                                                                                                                         |

实现与适用验收、项目文档分别按所属工作包登记。W24 核对发布前条件，W25 完成实际公开发行和生产接入，整体完成度按[最终条件](../verification/acceptance.md#completion)判断。

## 待取得的运行与外部输入

- W08 已交接六目标配对制品及对应源码。[平台验证记录](../verification/evidence/w08/README.md#hardware)列出仍需设备的项目。W10–W12 的实现、目标制品和主要后端仍待交付。
- W21 尚需真实宿主、资源、安装与来源消费。Google OAuth 应用审核、AniList 高级评分和部分导入器真实样本的缺项见[交付清单](delivery-checklist.md#extensions)与[来源证据](../verification/evidence/extensions.md)。
- 跨文件系统移动已在 Windows x64 取得运行证据；其余五个 CI 目标因测试根同属一个文件系统而跳过。完整平台组合、系统下限、签署与随包权利材料按所属交付继续验证。

<a id="merge-rules"></a>

## 仓库与合并

公开开发远端为 [ximu3/kisaki-dev](https://github.com/ximu3/kisaki-dev)，承载源码、PR、CI、候选制品与跨仓联调。main 要求同步最新主线并通过 GitHub Actions 的 `Required checks`。分支保护同样约束管理员。仓库只允许 Squash 合并，自动删除已合并的远端分支。协作规则见[工作区合同](../design/engineering/workspace.md#collaboration)。

正式仓库接续、npm 发行和服务部署按[仓库合同](../design/engineering/repository.md)与实际授权执行。旧 ximu3/kisaki 的存档和同名重建尚未执行，libmpv-node 已建立独立开发仓库，四个项目的正式交付制品待登记；项目开发仓库及 oauth-relay 最终源码仓库采用 public 可见性。

<a id="environments"></a>

## 验证环境

| 资源         | 已确认范围                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| 本地设备     | Windows 10 22H2 x64（build 19045）、Ryzen 9 7945HX、约 32 GB 内存；RTX 4060 Laptop GPU 8 GB 与 AMD 集成显卡。 |
| 本地执行条件 | 普通用户权限的交互桌面；测试使用独立资料与目录。                                                              |
| 标准 CI      | Windows、macOS、Linux 的 x64 与 arm64；各目标配置原生构建、基础运行和载体验证，实际结果由证据记录。           |
| 反馈目标     | 普通 PR 以约 3 分钟给出基础结果，全部必需检查按改动范围核对[工程反馈预算](../design/engineering/workspace.md#ci-feedback)。 |

<a id="w00"></a>

## W00 工程能力

| 交付项           | 当前源码职责                                                                        |
| ---------------- | ----------------------------------------------------------------------------------- |
| Workspace 与检查 | 根工程、桌面工程和两个私有工程包；实际类型项目、依赖边界、格式、hooks 与任务选择。  |
| 构建与资源       | 干净的构建与缓存输出、固定字体和图标、SQLite 与私有原生资源、独立构建标识和最终字节摘要。 |
| 开发协调         | Vite 原生程序监听与 HMR、包及资源准备、实际运行目录、失败恢复及唯一进程拥有者。        |
| 原生基础         | Rust／Node-API 文件同步和不覆盖移动、加载与错误合同。                               |
| 验证入口         | 普通 Node、Electron Node 模式、独立四入口载体、开发会话、制品及可选启动与内存采样。 |
| CI 与门禁 | 全仓基础检查、按包依赖选中的公共包及六目标桌面和工具验证、独立的手动诊断，以及代码合并门禁。 |

公共包及其仓库外消费、产品端点、正式窗口和宿主由各自完整工作包交付。[工程验证](../verification/evidence/w00/README.md)记录实际源码范围、本机 Windows x64 和 CI 六目标结果。正式签署和完整产品验收继续按所属工作包执行。
