# 设计与实施状态

<a id="design"></a>

## 当前交付

截至 2026-11-03，工作包按真实依赖和完整责任组织。本体业务就绪后，W18 联合完成 SDK、宿主与应用搜索；30 项功能扩展先于引导，三个官方译本与引导在 W22 共同完成。W23 负责项目文档，W24 负责发布前整体验收，W25 负责本轮首次公开发行与发布核验。公共包合同采用 Solid 1.9、原生 UI、组件子路径、SDK 内部纯合同边界及统一 desktop-rpc 接入。正式范围见[工作包](work-packages.md)。

W00 工程实现与适用验收已完成并合入主线，当前职责见[工程能力](#w00)。仓库维护桌面工程工具、原生文件能力、资源、三个私有工程包，以及 desktop-appearance、extension-distribution 和 desktop-contracts，workspace 共 8 个项目（含根工程）。产品能力按下表工作包实施。

当前任务入口为 AGENTS.md，设计、规范和实施资料集中于 refactor。[当前工程与开发](development.md)维护源码职责、环境准备与可运行命令。正式项目文档待 W23 交付；接口声明、代码注释、发行说明和许可材料随所属实现与版本维护。

[当前工程验证](../verification/evidence/w00/README.md)已取得本机 Windows x64 和 CI 六目标结果，覆盖工程载体的构建、原生与 Electron 运行、开发回归、打包及制品运行。

工程维护已统一有限任务依赖、单份公共包制品检查和当前依赖副本的采用／释放。公共包消费者的用例、样板、配置、依赖和报告由所属包维护，根入口通过 Turbo 调度。各包的 Node 与浏览器消费者分别安装同一 tarball，独立管理依赖、类型环境和运行资源。当前 Windows x64 复核通过类型、lint、格式及 130 项常规测试；三个公共包的 10 项仓库外消费者检查通过。原生／SQLite、4 项 Electron 入口和制品运行已有本机及六目标 CI 结果，跨文件系统用例按实际测试根记录。消费者结果见[W01 验证](../verification/evidence/w01/README.md)、[W02 验证](../verification/evidence/w02/README.md)与[W03 验证](../verification/evidence/w03/README.md)，最新跨平台检查由对应 PR 记录。资源与原生能力的已确认范围保持不变。

错误传递维护已补齐启动与停止失败、取消期间的独立命令错误、操作与清理错误的保留，以及测试清理的结果交付。故障通过测试边界注入，完整诊断由失败钩子统一输出。本机 6 项开发回归、4 项 Electron 入口和制品运行通过；两轮 Linux arm64 重复验证共 100 次场景执行通过。原始关闭超时的根因仍待确认，范围和证据见[关闭复核](../verification/evidence/w00/development.md#shutdown)。

完整产品、签署、公证、安装升级、系统支持下限和主要后端验收仍待完成。npm、正式下载、更新索引及生产服务尚未发布。各对象按[验收标准](../verification/acceptance.md)登记自己的结果。

<a id="progress"></a>

## 工作包进度

| 工作包                                                        | 当前结果与待完成范围                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [W00 工程与测试入口](work-packages.md#w00)                    | 实现与适用验收已完成；关闭异常仍在复核，见[实际交付](#w00)与[复核证据](../verification/evidence/w00/development.md#shutdown)。                                                                                                               |
| [W01 desktop-appearance](work-packages.md#w01)                | 实现与适用验收已完成：词表、纯值解析、默认值、CSS、Tailwind 映射、声明与独立制品消费通过；[本机及 CI 证据](../verification/evidence/w01/README.md)。项目文档待 W23，尚未公开发布。                                                           |
| [W02 extension-distribution](work-packages.md#w02)            | 实现与适用验收已完成：身份、manifest、registry、本地化、兼容选版、不可变制品和独立 Node 签名入口；25 项行为测试、仓库外 Node／浏览器消费及 CI 通过，[本机及 CI 证据](../verification/evidence/w02/README.md)。项目文档待 W23，尚未公开发布。 |
| [W03 desktop-contracts](work-packages.md#w03) | 实现与本机合同验收完成：完整桌面值、查询与编辑基线、参与接口、会话与管理、深链、开发控制及消息生成；63 项行为测试与仓库外 Node／浏览器消费通过。全仓检查通过，远端 CI 正在核对，[验证范围](../verification/evidence/w03/README.md)。项目文档待 W23，尚未公开发布。 |
| [W04 desktop-rpc](work-packages.md#w04)                       | 未开始。                                                                                                                                                                                                                                     |
| [W05 desktop-ui](work-packages.md#w05)                        | 未开始。                                                                                                                                                                                                                                     |
| [W06 存储与原生基础](work-packages.md#w06)                    | 未开始。                                                                                                                                                                                                                                     |
| [W07 应用运行与设置](work-packages.md#w07)                    | 未开始。                                                                                                                                                                                                                                     |
| [W08 资料与记录](work-packages.md#w08)                        | 未开始。                                                                                                                                                                                                                                     |
| [W09 Vantage](work-packages.md#w09)                           | 未开始；分项结果见[项目交付](delivery-checklist.md#projects)。                                                                                                                                                                               |
| [W10 Kana](work-packages.md#w10)                              | 未开始；分项结果见[项目交付](delivery-checklist.md#projects)。                                                                                                                                                                               |
| [W11 libmpv-node](work-packages.md#w11)                       | 未开始；分项结果见[项目交付](delivery-checklist.md#projects)。                                                                                                                                                                               |
| [W12 oauth-relay](work-packages.md#w12)                       | 未开始；分项结果见[项目交付](delivery-checklist.md#projects)。                                                                                                                                                                               |
| [W13 本地内容与文件维护](work-packages.md#w13)                | 未开始。                                                                                                                                                                                                                                     |
| [W14 资料获取、采用与扫描](work-packages.md#w14)              | 未开始。                                                                                                                                                                                                                                     |
| [W15 共同使用会话、游戏与存档](work-packages.md#w15)          | 未开始。                                                                                                                                                                                                                                     |
| [W16 视频播放](work-packages.md#w16)                          | 未开始。                                                                                                                                                                                                                                     |
| [W17 漫画与小说阅读](work-packages.md#w17)                    | 未开始。                                                                                                                                                                                                                                     |
| [W18 extension-sdk、扩展宿主与应用搜索](work-packages.md#w18) | 未开始。                                                                                                                                                                                                                                     |
| [W19 extension-cli](work-packages.md#w19)                     | 未开始。                                                                                                                                                                                                                                     |
| [W20 桌面构建、安装与应用更新](work-packages.md#w20)          | 未开始。                                                                                                                                                                                                                                     |
| [W21 30 项官方功能扩展](work-packages.md#w21)                 | 未开始；30 项功能扩展的实现、文档与发布结果见[清单](delivery-checklist.md#extensions)。                                                                                                                                                      |
| [W22 引导、全局组合与官方译本](work-packages.md#w22)          | 未开始；引导与三个官方译本联合验收，译本的分项结果见[清单](delivery-checklist.md#extensions)。                                                                                                                                               |
| [W23 项目文档与协作入口](work-packages.md#w23)                | 未开始。Kisaki 根文档、七个公共包说明和 Issue Forms 均待完成；官方扩展与独立项目的文档结果见[交付清单](delivery-checklist.md)。                                                                                                              |
| [W24 整体验收](work-packages.md#w24)                          | 未开始；按固定候选版本核对发布前完整条件。                                                                                                                                                                                                   |
| [W25 公开发行与发布核验](work-packages.md#w25)                | 未开始；正式仓库接续、首次公开发行、正式分发与生产服务切换均待执行。                                                                                                                                                                         |

实现与适用验收、项目文档分别按所属工作包登记。W24 核对发布前条件，W25 完成实际公开发行和生产接入，整体完成度按[最终条件](../verification/acceptance.md#completion)判断。

## 待取得的运行与外部输入

- W00 首次 Linux arm64 关闭超时的具体触发原因未确认；已修复的错误传递缺陷已有对照与回归结果，两轮重复验证未复现原始超时，见[关闭复核](../verification/evidence/w00/development.md#shutdown)。
- W06 尚需在正式 schema 与制品上验证 Drizzle 1.x、Kit、codec、迁移和查询。现有查询与合同试件保留各自适用范围。
- W09–W12 尚需取得完整实现、目标制品及主要后端结果。固定 libmpv 源码补丁已有依据，正式媒体、颜色、截图和 GPU 接入待验收。
- W21 尚需真实宿主、资源、安装与来源消费。Google OAuth 应用审核、AniList 高级评分和部分导入器真实样本的缺项见[交付清单](delivery-checklist.md#extensions)与[来源证据](../verification/evidence/extensions.md)。
- 跨文件系统移动已在 Windows x64 取得运行证据；其余五个 CI 目标因测试根同属一个文件系统而跳过。完整平台组合、系统下限、签署与随包权利材料按所属交付继续验证。

<a id="merge-rules"></a>

## 仓库与合并

公开开发远端为 [ximu3/kisaki-dev](https://github.com/ximu3/kisaki-dev)，承载源码、PR、CI、候选制品与跨仓联调。main 使用分支保护、最新主线要求、`verify / Required checks` 与 `PR title` 门禁；管理员同样遵守，只允许 Squash，已合并远端分支自动删除。协作规则见[工作区合同](../design/engineering/workspace.md#collaboration)。

正式仓库接续、npm 发行和服务部署按[仓库合同](../design/engineering/repository.md)与实际授权执行。旧 ximu3/kisaki 的存档和同名重建尚未执行，四个独立项目的正式开发仓库与交付制品尚未登记；项目开发仓库及 oauth-relay 最终源码仓库采用 public 可见性。

<a id="environments"></a>

## 验证环境

| 资源         | 已确认范围                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| 本地设备     | Windows 10 22H2 x64（build 19045）、Ryzen 9 7945HX、约 32 GB 内存；RTX 4060 Laptop GPU 8 GB 与 AMD 集成显卡。 |
| 本地执行条件 | 普通用户权限的交互桌面；测试使用独立资料与目录。                                                              |
| 标准 CI      | Windows、macOS、Linux 的 x64 与 arm64；各目标配置原生构建、基础运行和载体验证，实际结果由证据记录。           |
| 反馈目标     | [4／10／25 分钟](../design/engineering/workspace.md#ci-feedback)。                                            |

<a id="w00"></a>

## W00 工程能力

| 交付项           | 当前源码职责                                                                        |
| ---------------- | ----------------------------------------------------------------------------------- |
| Workspace 与检查 | 根工程、桌面工程和三个私有工程包；实际类型项目、依赖边界、格式、hooks 与任务选择。  |
| 构建与资源       | 明确程序输入、完整候选交接、固定字体和图标、SQLite 与私有原生资源、输入和字节摘要。 |
| 开发协调         | 输入监听、Vite HMR、依赖快照、完整候选采用、失败恢复及调用方提供的进程寿命。        |
| 原生基础         | Rust／Node-API 文件同步和不覆盖移动、加载与错误合同。                               |
| 验证入口         | 普通 Node、Electron Node 模式、独立四入口载体、开发会话、制品及可选启动与内存采样。 |
| CI 与门禁        | 实际输入选择、六目标工程运行、严格合并门禁、独立 PR 标题检查。                      |

公共包及其仓库外消费、产品端点、正式窗口和宿主由各自完整工作包交付。[工程验证](../verification/evidence/w00/README.md)记录实际源码范围、本机 Windows x64 和 CI 六目标结果。正式签署和完整产品验收继续按所属工作包执行。
