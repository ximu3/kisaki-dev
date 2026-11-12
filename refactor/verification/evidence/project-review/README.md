# 项目设计与实现复核

核对截至 2026-11-12。完整项目复核以 `2d73b7a` 为基线，命名补充以 `f6173a0` 为基线。覆盖现行 309 份 refactor Markdown、AGENTS.md，以及 688 份源码、配置、工程说明与消费样本。完整阅读与逐文件审阅的范围包括桌面工程、三个私有工程包和六个已交付公共包；命名补充沿这一范围核对对象职责、公开入口、调用方和文档。

已实现部分沿公开入口、实际调用方和消费者检查正常、失败、取消及清理路径，同时核对目录、命名、逻辑分段、防御和测试的必要性。生成声明通过生成一致性及真实制品消费验证，锁文件核对依赖关系与[实际风险](../w00/dependencies.md)；历史探针按其说明、固定输入、原始收据和结论边界复核，没有逐项重跑历史实验。

## 覆盖与判断

| 范围 | 已核对内容与边界 |
| --- | --- |
| 产品、架构与通信 | Entry、Work、Part、关系及持有内容的粒度；main、renderer、preload、extension-host 和公共包的职责；完整操作、观察与一次交付 |
| 工程与交付 | 构建输入、候选采用、取消与清理、原生错误、公共 exports、声明环境、仓库外安装、CI 选择及发行身份 |
| 命名与组织 | 对外名称的对象范围、类型角色、解析与判断函数、文件目录、导出和缩写；框架上下文、工具入口及原始材料保留所属惯例 |
| 资料库 | 身份、值域、查询适用性、字段投影、图写入、并发基线、成员与排序、个人记录及历史保留 |
| 本地内容与使用 | 扫描和分部识别的边界、文件登记与用户字节、定位坐标、会话切换、待补存记录、备份与恢复的资源归属 |
| UI、外观与本地化 | 原生表单、草稿、焦点、浮层、虚拟选项、系统偏好、通知时钟、Markdown、图表、拖拽、目录快照与英语回退 |
| 扩展与官方内容 | 实例寿命、SDK 可见范围、manifest／registry、来源粒度、关系完整范围、导入、自动补齐、持续同步及凭据边界 |
| 独立项目 | Vantage、Kana、libmpv-node 和 oauth-relay 的接入合同、已保留的方案依据，以及正式实现和平台验收缺项 |
| 验收与证据 | R／W／A 对应关系、工作包状态、原始来源版本、合成样本与真实运行的区别、结论适用范围及历史复现前提 |

编辑边界统一到实际对象：展示柜区块、资料方案、扫描配置和资料关系的单项保存直接提交，管理列表组织已保存对象。内部条件与规则随所属对象草稿保存；批量创建和引导采用通过明确动作提交完整范围，引导的同库组同时登记采用结果。具体规则见[编辑对象与保存边界](../../../design/ui/state.md#editing-units)。

扩展专有的页面、菜单、主题与译本贡献采用明确的 Extension 名称，通用导航、领域能力与 SearchIcon 保留实际范围。Definition、Descriptor、Ref、Handle 和 Registration 按不同责任区分；普通新建资料使用 EntryCreate，资料采用与解析结果使用 IngestAddResult、IngestUpdateResult 和 MetadataResolveResult。共同依据见[命名规则](../../../design/engineering/conventions.md#naming)。

## 关键合同与实现依据

| 对象 | 核验结果及落实 |
| --- | --- |
| CI 输入与执行范围 | 单独修改开发运行所用 fixture-application 时，实际 Turbo 查询原先遗漏 test:dev。补齐直接输入，并让公共包消费命令采用已经算出的包集合；完整检查入口保留 |
| Windows 原生路径 | Node 的 isAbsolute 与 Rust 的 Path::is_absolute 对 `\drive-rooted` 判断不同，原先漏出通用 InvalidArg。路径合法性归原生边界，Node 将同步或异步参数失败转换为既定错误；依据 [NAPI 错误合同](https://napi.rs/docs/concepts/error-handling) |
| 使用时长 | 原活动输入接受 0.5 毫秒，累计读取却拒绝同一派生值。保存值已统一为非负安全整数毫秒，运行中的小数余量与统计比例分配保留各自精度，见[写入](../../../design/domains/library/write/README.md)和[会话](../../../design/domains/sessions.md) |
| 标签字段范围 | 实际请求 names 为 PC 时，原校验仍接纳 Console 的 description。现在按共同 tagNameKey 限定普通字段；必要关系端点及独立请求的完整关系保持原语义，见[来源读取](../../../design/extensions/providers.md#read-request) |
| 快捷键冲突 | 所用 Electron 将 Option／Alt、Command／Super 映射到相同修饰位，并为 `!`、Plus 等符号加入 Shift。冲突比较已跟随[原生按键映射](https://github.com/electron/electron/blob/v45.0.0/shell/common/keyboard_util.cc)及[解析器](https://github.com/electron/electron/blob/v45.0.0/shell/browser/ui/accelerator_util.cc)，保存的写法保持独立 |
| 正则边界 | [ECMAScript 规范](https://tc39.es/ecma262/multipage/text-processing.html#sec-compileassertion)与本机 Node 均确认：未启用 m 时，`$` 要求整个输入结束。纠正原说明，删除重复的整串比较与替代结束断言，保留原接受范围 |
| Markdown 选区 | 实际 CodeMirror 状态复现了选择首行及换行后，列表命令修改下一行的问题。非空选区按排他终点确定最后一行，空光标仍作用于所在行 |
| 自有发行身份 | [npm 发布实现](https://github.com/npm/cli/blob/latest/workspaces/libnpmpublish/lib/publish.js)规范化时会移除 build metadata。自有发行统一不用 `+` 后缀，桌面版本校验贯穿更新、运行信息、开发握手与引导；第三方扩展保持完整 SemVer，见[发行规则](../../../design/engineering/releases.md#release-identity) |
| Mihon 分部对应 | 固定为准确身份或种类、作品／卷范围及原始编号均明确时的唯一对应。缺少准确编号时保留独立可迁入的文件和文字并报告未对应，不从浮点章节号还原编号，见[迁入合同](../../../design/extensions/importers/mihon.md) |

设计说明也已按拥有者统一：DnD 版本引用、GameLaunchConfig 名称、Wikidata 关系备注来源、自动导入责任及五类真实 Part 的覆盖范围。导入证据中的旧 profile-first 结论与当前 prepared／initial 合同对齐；RAR 作为未采用候选标明范围，保留仍被其他探针使用的工具链输入。Anx 和 calibre 的复现说明明确在隔离副本中准备固定版本的历史依赖，原始测量与来源收据保持原样。

Steam 保留手填账号与 key 的现有只读流程：用户配置指定本人账号，接口核对目标身份与可读范围，二者不提供账号归属证明；没有新增确认框或浏览器登录。MangaUpdates 的 [OpenAPI](https://api.mangaupdates.com/openapi.yaml)将 logout 定义为移除会话令牌，因此本扩展的会话注销与共享合同中的上游授权撤销分别处理。

## 本机验证

环境为 Windows x64、Node 24.11.1、Chromium 156.0.8078.4、Electron 45.0.0（Chromium 156.0.8078.48）。

| 检查 | 实际结果 |
| --- | --- |
| pnpm check | 类型、lint、依赖边界、格式与既有普通测试通过；桌面合同为 45 个文件、64 项测试 |
| pnpm desktop:test:consumers | 六个公共包的 tarball、制品检查及仓库外消费通过，覆盖各包适用的 Node、浏览器和完整声明环境；UI 的 14 项检查包含真实 Electron 消费 |
| 命名调整的制品消费 | extension-distribution、desktop-contracts、desktop-localization 与 desktop-rpc 的独立制品消费通过，覆盖完整声明、Node、浏览器与 RPC 的实际 Electron 传输；实现、公开导出和消费样本使用同一命名 |
| pnpm desktop:test:native | Electron Node 模式下原生文件与 SQLite ABI 共 6 项通过，包括 Windows 未指定盘符的根路径错误分类 |
| CI 选择逻辑 | 实际 YAML 中的 Bash 语法通过；部分、空、完整三类输入核对实际选择和命令参数；实际 Turbo dry-run 核对部分选择只执行对应消费任务及其前置任务 |
| Markdown 边界复现 | 使用真实 CodeMirror EditorState，正向和反向行边界选择、空光标与整段选择均通过 |
| Electron 接口核验 | 独立进程和资料目录中验证网络及快捷键的下述范围，结束后释放资源 |
| 文档与交付核对 | 316 份 Markdown 的本地引用无断链；131 段 TypeScript／JavaScript 示例核对代码块与独立声明分段；最终差异无空白错误；评审页安装的 96 个包文件与 UI tarball 逐字节一致 |

命名调整对照源代码语法树核对，字段、字面量与控制流保持一致；既有测试验证原行为，公开名称由完整声明和实际制品消费验证。480 份自维护 TypeScript 文件的名称、概述和声明分段候选均已人工核对。Solid Context 遵循[官方公开用法](https://docs.solidjs.com/reference/component-apis/create-context)，派生类型与对应值可以紧邻成组，配置说明沿各自用途维护。

网络探针仅访问本机 HTTP 服务：手动 Cookie／Authorization 保留，`credentials: omit` 与 `useSessionCookies: false` 不读写 Session Cookie；两条 Set-Cookie（含 Expires 逗号）独立保留，分块上传与手动跟随重定向取得预期内容及地址。该结果支持 [Electron ClientRequest](https://www.electronjs.org/docs/latest/api/client-request) 接入假设；代理采用、Webview、WSS 和完整 SDK 传输仍由所属工作包取得运行证据。

快捷键探针在实际 Windows Electron 中确认 Option／Alt，以及 `!`／Shift+1、Plus／Shift+= 的注册身份相同；Command／Super 的比较依据所用版本共同原生解析器，不把本机注册失败当成其他平台已通过。

新增的长期验证限于一项快捷键冲突用例；CI 输入、原生错误、时长、标签范围和版本规则补入已有相应用例。Markdown 修复使用一次性复现。最终提交的跨平台执行与门禁由 [PR #34](https://github.com/ximu3/kisaki-dev/pull/34)记录。

## 保留的未完成范围

本次完成的是当前设计与已交付实现的复核。正式业务页面、W06 以后的实现、独立项目的完整后端与平台组合、系统级辅助技术、签署、公证、安装升级及公开发行，继续按[实施状态](../../../implementation/status.md)和[交付清单](../../../implementation/delivery-checklist.md)取得证据。历史格式探针和六目标工程 CI 各自保留原有范围。
