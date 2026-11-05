# 公共包、工作区与开发工具

桌面应用、所属公共包、官方扩展和分发资料在同一仓库的 clients/desktop 下维护。仓库还按[工程分组](layout.md#workspace)区分后续 Web 客户端、官网和候选服务端；本篇的具体工具链与交付检查覆盖当前桌面范围。各项目通过声明的依赖和公开入口协作，构建顺序由实际依赖决定。公开能力需要同时通过类型检查、运行验证和仓库外制品消费验证。

| 阅读目的             | 入口                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 选择公共包与作者入口 | [包与依赖方向](#packages) · [源码组织](#package-organization) · [类型定义](#contracts) · [视觉交付](#visual-packages) |
| 配置工程和检查环境   | [工作区配置](#workspace) · [工具职责](#tooling) · [声明检查](#declaration-checks)                                     |
| 选择任务与 CI 范围   | [任务入口](#tasks) · [CI 编排](#ci-selection) · [缓存](#task-cache) · [反馈预算](#ci-feedback)                        |
| 运行开发会话         | [桌面开发](#desktop-development) · [输出访问与收尾](#output-access)                                                   |
| 维护依赖与协作流程   | [依赖更新](#dependencies) · [PR 与提交](#collaboration) · [本地 hooks](#hooks)                                        |

<a id="solid"></a>

## Solid 与控件版本

| 能力           | 版本线                     | 固定兼容基线                                                                      |
| -------------- | -------------------------- | --------------------------------------------------------------------------------- |
| Solid          | 1.9.x                      | solid-js 1.9.16                                                                   |
| 官方路由       | 与 Solid 1.9 相容的 1.x    | @solidjs/router 1.0.0                                                             |
| 编译集成       | 支持 Solid 1 的插件 2.x    | vite-plugin-solid 2.11.14                                                         |
| 基础控件       | Solid 1.9 与浏览器原生能力 | 按[UI 合同](../ui/package.md)实现并验证                                           |
| 虚拟列表与网格 | TanStack Virtual 3.x       | Solid 适配 3.13.48 与 core 3.19.6，见[几何边界](../ui/virtualization.md#geometry) |
| 拖拽排序       | Pragmatic Drag and Drop    | 核心 3.1.0 与辅助包组合见 [拖拽实现](../ui/virtualization.md#dependency)          |

原生窗口、公共 UI 和官方扩展统一使用 Solid 1.9，并遵守该版本的 API 与 owner 生命周期。应用使用 Vite 8.3.3 和 vite-plugin-solid 2.11.14；公共 Solid 库使用 tsdown 0.23.0，以及 unplugin-solid 2.0.0 提供的公开 Rolldown 接入。unplugin-solid 3.x 不用于 Solid 1.9。

Solid 的活跃属性、快照、派生值和副作用保持区别，不能为统一外观采用会改变其响应性的解构或封装。

运行时、JSX 和编译插件必须相容，并使用同一组锁定版本。工程不混用 Solid 2 的运行时或编译入口，也不建立双主版本兼容层。路由负责导航，视图持有查询快照。公共 UI 的类型声明、CSS 和组件生命周期均由实际消费者验证。

<a id="packages"></a>

## 公共包与依赖方向

| 包                     | 完整职责                                                  | 真实消费范围                             | 许可 |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------- | ---- |
| desktop-appearance     | 视觉词表、纯值规则、默认值、基础 CSS 与可选 Tailwind 映射 | 桌面、各框架 Webview 与独立视觉消费者    | MIT  |
| desktop-ui             | Solid 组件、通用交互与可直接消费的样式；Solid 作为 peer   | 原生界面、扩展与独立 Solid 项目          | MIT  |
| desktop-contracts      | 桌面公共接口、值约束、规范编码、错误与参与合同            | 本体、窗口、SDK 与实际使用这些定义的工具 | MIT  |
| desktop-localization   | 英语源文、消息类型生成、作者校验与纯格式化                | 本体各运行端、SDK 的纯作者入口           | MIT  |
| desktop-rpc            | 环境无关的消息式调用、通知、取消、错误和连接寿命          | 窗口、扩展与开发控制的通信接入           | MIT  |
| extension-distribution | 制品与仓库格式、静态元数据、兼容声明、纯校验与 Node 签名  | 本体、SDK、CLI 与制品工具                | MIT  |
| extension-sdk          | 扩展公开合同、作者入口、Node 与框架无关 Webview 运行接入  | 扩展作者，以及消费纯合同与协议的宿主     | MIT  |
| extension-cli          | kisx、程序化工作流、三种作者模板与分发仓库工具            | 外部作者与同仓官方扩展                   | MIT  |

八个包位于 clients/desktop/packages，目录与包的短名称一致。每个包按[所属工作包](../../implementation/work-packages.md)完成全部实现职责与消费验证，独立管理版本和构建制品；[项目文档](documentation.md#lifecycle)按对象在正式发行前完成。

产品合同的依赖方向为 extension-sdk → desktop-contracts。desktop-localization 消费合同包的通用目录与语言值，合同包不依赖具体消息资源。SDK 的纯模块选择扩展可用合同与本地化作者能力，定义上下文、激活、登记和接入协议；Node 与 Webview 实现消费这些模块。扩展作者通过 SDK 取得所需内容，无须了解内部拆包。宿主依赖 SDK 包的纯入口，导入链保持纯粹。包级安装依赖与模块运行依赖分别核对。

| 消费者                 | 可消费的内容                                                                    | 职责边界                                          |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| desktop-appearance     | 视觉定义及必要的通用纯库                                                        | 只拥有视觉值与样式协议                            |
| desktop-ui             | desktop-appearance、Solid peer 与呈现依赖                                       | 通过 props 和回调接入数据，拥有组件交互和资源寿命 |
| extension-distribution | 制品格式及必要的通用库                                                          | 纯格式与 Node 签名分别提供入口                    |
| desktop-contracts      | desktop-appearance 的词表、extension-distribution 的格式                        | 拥有公开接口、值约束及规范编码                    |
| desktop-localization   | desktop-contracts 的通用目录、语言值与错误合同                                  | 拥有消息资源、作者校验与纯格式化                  |
| desktop-rpc            | 标准语言能力及必要的通用依赖                                                    | 产品合同、实际传输和身份绑定由消费者提供          |
| extension-sdk          | desktop-contracts、desktop-localization、desktop-rpc 及实际使用的分发与视觉定义 | 纯合同、Node 和 Webview 实现按模块与入口隔离      |
| extension-cli          | 分发能力、开发合同、RPC 及工作流实际所需工具                                    | 工具运行依赖与模板生成的依赖分别声明              |
| 应用与具体扩展         | 与自身职责和环境相符的公共入口                                                  | 私有业务留在各自项目，官方扩展使用同一作者合同    |

desktop-contracts 与 extension-distribution 保持纯定义的单向关系。SDK 的公开范围由扩展合同明确选择，同义业务值直接引用 desktop-contracts。desktop-rpc 负责共同机制，接入层绑定窗口、文档、实例与方法表。

各包的 npm 版本、扩展 API 版本、接入协议版本和 schemaVersion 分别表达自身含义。兼容变更按实际公开语义判断，宿主与扩展依据声明范围协作。

Vantage、Kana、libmpv-node 和 oauth-relay 按[独立项目规范](../projects/README.md)通过正式制品或服务合同接入，各自维护实现源码与发行。应用与云服务通过公开合同协作，客户端只依赖自己可以取得的公共输入。

公共包通过 workspace 依赖、exports 和构建结果消费，同仓与仓库外使用同一公开路径。发布的声明包含可取得的类型依赖。包内源码与私有工程入口的规则见[共同规范](conventions.md#module-imports)。

按稳定职责和运行环境设计公开入口。可独立消费的能力优先使用子路径；承担单一内聚机制的包可以使用根入口。公开路径表达消费能力，源码文件与入口遵守[主题组织规则](conventions.md#source-layout)，构建映射不要求目录外存在同名源码文件。desktop-ui 按组件家族提供子路径，desktop-contracts 按领域提供入口，desktop-rpc 使用内聚根入口，SDK 根入口提供纯作者合同。

exports 定义公开入口，静态检查继续覆盖实际导入链、循环与运行环境。main 与 extension-host 共同消费纯协议和 desktop-rpc，各自拥有连接与运行资源。

<a id="package-organization"></a>

## 公共包的源码组织

| 包                     | 主要源码职责                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| desktop-appearance     | tokens、values、defaults 分别维护词表、规则与默认值；CSS 和映射按[视觉交付](#visual-packages)组织                                        |
| desktop-ui             | 组件家族与配套实现按[能力与协作关系](../ui/package.md#organization)组织；公开构建入口就近放置，共用交互按实际复用提取                    |
| desktop-contracts      | library、metadata、ingest、scanner、sessions、tasks 等模块拥有各自接口、值约束与编码；基础值使用明确叶模块，development 拥有开发控制合同 |
| desktop-localization   | 英语按领域维护，类型从同一源文生成；目录与参数校验、纯格式化按实际职责组织，运行中的译本登记和选择归本体 i18n                            |
| desktop-rpc            | connection 管理调用与连接，frames 定义有限帧，transport 定义传输接入；内部按真实状态与资源寿命组织                                       |
| extension-distribution | manifest、registry、metadata、compatibility 分别拥有格式与规则；node/signing 提供签名和验签                                              |
| extension-sdk          | contracts 组织纯作者合同，protocol 组织公开接入消息，node 与 webview 实现各自环境的调用和资源接入；根入口集中提供作者类型与必要纯值      |
| extension-cli          | cli 处理命令与反馈；workspace、extension、registry 拥有实际工作流；config 提供轻量配置声明；templates 保存正式生成模板                   |

SDK 的纯模块只依赖纯定义，运行实现依赖纯模块。根入口与 protocol 入口可供宿主独立导入；node 与 webview 分别初始化对应环境。公开接入协议与本体 shared/extension-host.ts 的私有控制合同各有版本和真实身份绑定，见[协议规则](protocols.md)。来源账号、请求策略、重试与业务状态由具体扩展拥有。

CLI 的 create、dev、validate、build、pack 等工作流同时服务命令行和程序化入口。三种模板分别生成 node、node-webview、node-solid 作者结构，作为正式工具资源交付。

各包维护自己的 README、发行说明、manifest、类型与构建配置，dist 保存生成制品。各包通过自身 test:consumers 验证 tarball，覆盖所承诺的 Node、框架无关 Webview 或 Solid 作者路径。测试准备、样本与清理保留在对应测试范围；组合验证按[共同结构](layout.md#tests)归负责组合行为的工程。作者只声明实际使用的公开包。

<a id="contracts"></a>

## 类型定义与作者入口

| 定义                                                  | 定义拥有者                                                     | 保持的含义与边界                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| EntryRef、WorkRef、PartRef、ExternalIdentity 与资料值 | desktop-contracts/library 的相应模块                           | 正式身份与来源身份分别表达；本体直接引用，SDK 的纯合同直接引用，同义定义保持唯一          |
| 评分、状态、完成与记录值                              | desktop-contracts/library 的记录合同                           | 值与查询、修改共同组织，内部持久实现归本体；不从 ORM 行推导公共数据                       |
| 阅读位置、文字选区与页面区域                          | desktop-contracts/library 的记录合同；共有几何由明确叶模块提供 | 定义形状、编码、合法性与 Kana 接入边界，不将解析算法移入合同                              |
| PartialDate 等实际跨合同的基础值                      | desktop-contracts 内有明确语义的日期等叶模块                   | 保持唯一类型和纯规则，不为每种小值增加 npm 包                                             |
| FontRef、字体读取与管理合同                           | desktop-contracts/fonts                                        | 表达桌面系统字体和用户字体库身份，供主题与阅读直接使用，不进入共同视觉包                  |
| Theme、AppearanceTokens、ThemeRef 与桌面外观接入      | desktop-contracts/appearance                                   | 保留双套主题、字体选择及资源合同；主进程承担持久化与解析，视觉词表来自 desktop-appearance |
| LocalizedText 与静态文案匹配规则                      | extension-distribution/metadata                                | manifest、索引、贡献文案和发行说明直接采用同一格式；本体 i18n 接口引用它，不重新声明      |
| UiTranslationRef、通用消息目录与译本接入              | desktop-contracts/i18n                                         | 定义目录形状、稳定引用、登记及有效语言观察；本体 i18n 实现实际登记与选择                  |
| 英语源文、消息键与参数、作者校验及纯格式化            | desktop-localization                                           | 从同一源文交付消息基准；SDK 提供统一作者入口，本体拥有当前译本与响应式接入                |
| ErrorSummary 等真正同义的基础结果值                   | desktop-contracts/errors 等明确语义入口                        | 不建立同形别名；每个操作仍表达自身完成、失败和取消语义                                    |

desktop-contracts 按公共能力提供 library、metadata、ingest、scanner、sessions、tasks、onboarding、search、events、images、i18n 等入口，development 入口用于工具开发会话。合同目录按这些语义组织，应用内部目录由各实现自行管理。

桌面合同覆盖完整本体能力，扩展开放范围由[扩展运行合同](../extensions/runtime.md)定义。同一职责的值、输入输出、错误、校验和资源接口可以放在同一模块，入口形式按实际能力安排。数据库连接、原生句柄、构造依赖和内部运行状态留在实现中。

完整能力接口使用 LibraryApi、MetadataApi、SessionsApi 等名称；参与接口和资源使用 MetadataProvider、MetadataReadSession 等具体名称。公共合同先定义业务语义，实现再将 ORM 数据映射到合同。相同签名直接引用；只开放部分能力时使用明确的 Pick，并与实际接入清单一致；语义有差异时定义适配。

公共业务类型以业务值和调用合同形成清晰、稳定的声明，运行校验按同一合同实现并通过类型与行为验证保持一致。内部简单值可以推导；复杂校验器的构造类型不作为公共业务声明的组成部分，避免把校验库的内部泛型和变更传播给消费者。

本体登记 provider 时使用完整 ID，扩展登记使用实例内的局部 id。登记差异不改变回调和资料值的共同合同。

extension-sdk 的纯合同模块定义扩展上下文、激活与公开能力选择，直接引用 desktop-contracts 中的业务合同。根入口集中提供 ExtensionContext、EntryRef、MetadataProvider 等作者类型和值；protocol 入口提供宿主接入合同。公开导出按真实作者需要选择。

SDK 的 Node 和 Webview 运行入口分别适配对应环境，公共纯入口不能加载 Node I/O、DOM、Electron 或 Solid。各包独立演进时，仍须验证双方实际语义相容。

合同依赖只由签名所需的值决定。例如，ingest 的候选合同引用候选值，LibraryApi 由实际调用 library 的实现接入；事件目录可以引用 ScanResult，分发机制保持通用。业务输入表达目标、查询与修改，执行 context 表达取消；必要的目标选择由具体操作的局部调用选项规定，接入建立调用身份、窗口与实例代际。

纯合同不执行 Electron、Node I/O、DOM、Solid、数据库或技术内核代码，但可以声明 Promise、回调、AbortSignal 和可释放资源。合同不必全部是 JSON；实际序列化与实例映射由接入实现。值校验与规范编码表达调用双方共同遵守的约束；业务计算、默认配置、预设、存储恢复与运行策略由所属实现拥有。公共存储值和 codec 复用唯一的值规则，日期、几何等基础值按自身语义设置叶模块，不为每个小值单独建立 npm 包。

<a id="visual-packages"></a>

## 视觉基础与桌面资源

desktop-appearance 维护视觉 token 词表、类型与值规则、默认值、CSS 和可选映射。它不识别 FontRef、ThemeRef、字体 ID 与路径、偏好、数据库或登记句柄。

desktop-appearance/src/styles.css 提供普通基础与派生 CSS，类型、默认值和普通 CSS 可独立消费。src/tailwind.css 提供 Tailwind 4 映射，通过 [CSS 主题变量](https://tailwindcss.com/docs/theme#referencing-other-variables)引用正式视觉变量。采用映射入口的项目自行提供 Tailwind 构建工具。

desktop-contracts/appearance 在字体槽中组合桌面字体选择，直接引用 desktop-appearance 的颜色和尺寸词表。主进程 appearance 解析资源，宿主绑定资源 URL，SDK 在扩展文档中加载资源，具体分工见 [外观规则](../domains/appearance.md)。

desktop-ui 通过 props、事件、回调和普通呈现值接入行为，不导入桌面合同、SDK、数据库或客户端查询层。应用内的 domain-ui 提供桌面业务界面。非 Solid 扩展可以使用 desktop-appearance 和框架无关 SDK。

公共组件的原生交互、状态、表单、组合、目录与公开入口由[UI 包规范](../ui/package.md)定义。desktop-appearance 维护共同默认视觉值，desktop-ui 维护组件样式；应用通过公开入口消费。视觉核对沿[既有体验](../ui/components.md#existing-ui)开展，类型、样式消费和实际呈现分别验证。

desktop-ui 使用 Tailwind 4 编写和构建组件的常规样式，TSX 中的工具类与变体组织遵守[UI 包规范](../ui/package.md#organization)。src/styles.css 是包内编译入口，接入 Tailwind、desktop-appearance 的基础样式、映射及必要 CSS，并生成组件实际使用的样式。dist/styles.css 是完整的普通 CSS，通过包的样式入口交付；消费者不需要安装 Tailwind 或重新编译 UI 样式。

UI 成品包含组件自身必要的基础规则，不无条件注入影响整个文档的 [Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight)。文档级重置由实际宿主统一安排。应用或扩展自己的 Tailwind 构建只处理自身代码及实际共享组件，并通过 desktop-appearance 采用同一映射；桌面的具体位置遵守[窗口样式组织](layout.md#renderer-styles)。

CSS 提供明确的消费入口，并通过副作用配置确保构建保留；消费者不扫描包的 src 生成样式。Solid 作为 peer 依赖，不重复打包。字体字节和加载由宿主管理，纯视觉包不承担桌面资源职责，也不预先承诺所有 UI 框架或 SSR 模式。

关闭、通知和外观能力接入实际宿主会话，不额外建立公共业务包装或全局客户端上下文。

<a id="workspace"></a>

## 工作区与项目配置

Kisaki 中的 Node 与 TypeScript 工程采用一个根 pnpm workspace、一份 pnpm-lock.yaml，由根 Turborepo 调度实际项目。完整交付布局包含桌面应用、八个公共包、33 个官方扩展和三个私有工程包，共 45 个成员工程，另有仓库根工程。实际登记随所属工作包维护，clients、desktop 等分类目录不登记为包。未来对应工程实际建立后优先加入同一工作区，不提前登记空工程。成员按 manifest 中的唯一 name 识别，包作用域与发布资格遵守[项目身份](repository.md#identity)，目录分类不替代包身份。

通用检查通过 pnpm 读取已登记成员，同时独立枚举维护目录中的 package.json 核对漏登记；workspace 只登记实际工程，证据、生成输出和测试试件按各自用途组织。源码覆盖与依赖扫描从整个维护树发现输入，不维护桌面、官网或服务端的平行目录清单。TypeScript 工程以默认 tsconfig.json 及其 references 表达 typecheck 的检查范围，结构检查不解析脚本中的编译器命令文本。桌面公共包的数量、许可和发布约束留在桌面范围，私有工程规则只指向实际工程包，不替尚未建立的产品库决定许可或私有身份。

| 位置                   | 负责内容                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| 根 package.json        | 固定包管理器版本，声明仓库维护工具和统一任务入口，不参与产品发行版本 |
| 根 pnpm-workspace.yaml | 声明实际成员，以及确有一致性要求的 catalog 版本范围                  |
| 根 pnpm-lock.yaml      | 保存工作区的依赖解析结果，供安装与依赖图核对                         |
| 根 turbo.json          | 声明任务依赖、输出和缓存规则                                         |
| 各项目 package.json    | 声明自己的版本、实际依赖、公开入口和项目脚本                         |

根目录只保留仓库级工具及根工具实际使用的依赖，应用和库的依赖由使用者声明。Electron 属于桌面应用，Solid 属于实际使用它的项目，组件库依据公开合同声明 peer。一个锁文件可以记录各项目需要的不同依赖版本；catalog 只统一需要共同兼容的范围，不迫使未来 Web 或官网采用桌面的框架。依赖归属依据 [Turborepo 依赖管理建议](https://turborepo.dev/docs/crafting-your-repository/managing-dependencies)。

工程用途包括已确认的构建与测试工具链、类型检查、配置加载、资产准备和上游 peer 约束。具备这些用途的依赖应保留，不能仅因产品源码没有直接 import、某阶段尚无对应测试用例或希望减少声明数量而删除。清理前先核对实际拥有者及使用方式。

各依赖声明块按包名排序，脚本按开发、构建与打包、验证、维护组织，同类任务相邻。工具默认入口可直接发现，需要选择其他宿主或输入范围时显式指定配置。条件 exports 的顺序具有匹配语义，不能机械排序；不为固定字段顺序增加结构快照测试。已经进入共同 catalog 的版本由消费者引用 catalog，不另写一份等价版本。

packages/typescript-config 提供共同严格性和纯环境、Node、浏览器、Solid 配置；packages/eslint-config 提供共同 lint 规则和适用的环境规则；packages/tooling 提供命令执行、候选交接、错误传递和 CLI 收尾。三者均为私有工程依赖，消费者通过 workspace devDependencies 与 exports 使用，固定工程宿主直接加载 JSON 或 TypeScript 源码，不要求预构建。公共包继续交付构建后的 exports，产品运行代码、公开声明和仓库外作者模板不引用私有工程包。格式规则由仓库根统一维护，各项目的默认配置负责本项目的范围与环境选择。

类型感知 lint 使用 TypeScript Project Service 读取实际类型项目与 references，跨项目暂存文件也按各自环境检查。lint 与 root:lint 通过 ^build 准备依赖包声明，缓存输入包含所用 TypeScript 配置和共享规则；构建前置不扩大其他运行验收范围。仓库外消费者样板在安装实际 tarball 后执行完整规则，仓库内采用语法检查。具体配置与入口见[共用工程包](../../implementation/development.md#shared-tooling)。

各项目限定自己的 Node、DOM、Electron、Solid 和测试环境。其他语言工程保留对应工具链与锁文件，不为目录一致而改用 pnpm 管理原生依赖。出现无法在共同工具链中可靠开发与验证的真实约束时，再明确调整工作区边界。

官方扩展的 kisx.config.ts 与 eslint.config.ts 由各自根 tsconfig.json 在 Node 环境共同检查。defineConfig 的实现保持纯粹，不要求消费它的构建配置另建纯环境项目。Node、Webview、共享合同与测试源码按真实运行环境划分配置，只为实际源码建立类型项目。

仓库根 tsconfig.json 以空 files 和 references 组织 config/typescript 中的 tsconfig.tools.json、tsconfig.config.json 和 tsconfig.tests.json，三者均使用 Node 类型与 ES2023 库。需要 DOM 的浏览器回调由实际拥有者的类型项目检查，消费者样板使用各自配置。配置类型项目覆盖根工具入口及 config 中的 TypeScript 配置。Turbo 调度各 workspace 与根 root:typecheck，后者通过 tsc -b 检查这三个项目，增量信息归根 .cache/typescript。共同规则继承 @kisaki3/typescript-config，依赖检查读取根 tsconfig.json 的编译选项，按所属 package.json 的 imports 与 exports 解析模块入口，不另维护私有别名映射。

桌面应用的 tsconfig.json 以空 files 和 references 组织 main、preload、renderer、extension-host、shared、tools 和 tests 七个环境项目。具体配置位于 config/typescript，继续独立限制类型与源码范围；typecheck 使用 tsc -b，增量信息写入应用 .cache/typescript，保持 noEmit。编辑器通过默认入口发现这些项目，结构检查沿实际执行入口和项目引用核对源码覆盖。其余构建和测试配置的归属见[应用布局](layout.md#workspace)。

八个公共包各自通过工程根目录的 tsconfig.json，以空 files 和 references 组织类型项目，typecheck 使用 tsc -b。各包 config/typescript 中的 tsconfig.lib.json 负责库源码，tsconfig.tools.json 负责 Node 工具及适用的构建配置；desktop-ui 的 tsdown 配置同样归 Node 工具项目。同包根目录的 tsdown.config.ts 显式读取 config/typescript/tsconfig.lib.json；增量信息写入该包 .cache/typescript。新增环境按实际源码需要建立，不提前加入运行源码；配置遵守[共同归属](conventions.md#configuration-layout)。

共享锁文件与工具升级可能扩大验证范围。开发入口按实际目标启动，desktop:dev 只启动桌面及必要依赖；项目脚本执行具体任务，根任务统一调度。版本、发行说明与部署仍按各自发行单位管理，不因一次安装或同仓提交而合并版本。

<a id="tooling"></a>

## 工具职责与检查环境

| 拥有者                       | 唯一负责的事实或行为                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| pnpm                         | workspace 成员、各包实际依赖、统一锁文件、catalog、安装与 tarball 打包             |
| Turborepo                    | 从真实依赖形成任务顺序、受影响范围、并发与合格任务的缓存                           |
| TypeScript、ESLint、Prettier | 类型与环境检查、代码规范和导入规则、统一排版                                       |
| tsdown                       | 公开 TypeScript/Solid 包的代码、类型声明与声明过的样式输出                         |
| Vite 与桌面 tools            | 各 Electron 程序和 renderer 的编译、开发服务器、桌面生命周期与资源装配             |
| electron-builder             | 平台安装包、签名接入与 electron-updater 所需元数据                                 |
| kisx                         | 扩展项目开发与打包、 registry 资料处理、校验和签名                                 |
| GitHub Actions               | 事件、runner、任务依赖、权限、制品流转和发布部署                                   |
| 根 tools 与私有工程包        | 根工具拥有 Git hooks、验证环境信息与跨项目发行；私有包提供实际共用的配置和工程函数 |

根 packageManager 固定 pnpm 版本，开发工具使用一致的 Node 版本和锁文件；Electron 内置 Node 的版本另行记录。CI 使用 frozen-lockfile 安装，检查过程不自动升级依赖。

各包分别声明直接运行依赖、开发依赖和 peer 依赖。catalog 只统一确实需要一致的版本范围，不把所有依赖提升到根目录。workspace 包打包后检查实际依赖版本，预发布版本使用明确范围，不能假定稳定版本范围会接纳它。

公开库默认交付 ESM、d.ts 和所需 CSS，并区分 Node、DOM、Solid 与纯定义入口。通过 publint、Are the Types Wrong 和实际 tarball 消费检查制品。sandbox preload 将非 Electron 依赖完整打包为可加载的 CommonJS；其他程序按 [Electron 加载规则](https://www.electronjs.org/docs/latest/tutorial/esm) 检查，不机械统一为 ESM。

tsdown 生成声明不能代替完整 typecheck。根 TypeScript 配置只规定共同严格性，各项目限制实际可用的 globals、模块和测试类型，手写 d.ts 也作为源码检查。ESLint 检查局部导入规则，dependency-cruiser 检查进程边界、私有依赖、循环及绕过路径。格式和 lint 共享配置只保留必要的环境差异。

自维护源码按[TypeScript 要求](conventions.md#source-language)检查，范围包含产品代码、工具、配置、测试、模板和本体私有原生入口。源码类型配置保持 allowJs: false，结构检查核对未进入 typecheck 的目录，生成产物和第三方发行内容按自己的归属检查。

项目 manifest 和版本 PR 提供版本事实，Turbo 安排依赖任务，CI 调用项目自身的构建入口。根 tools 校验发行输入、生成元数据并执行交付，不另行推导版本或依赖图。所有工具采用经过兼容验证的锁定版本，TypeScript 和声明检查使用同一编译器。

<a id="declaration-checks"></a>

## 实现与公开声明的类型检查

共同基线使用 strict: true 与 skipLibCheck: true。常规应用、公共包源码、工具、配置及测试完整检查自有 TypeScript 和实际调用，不让每个消费项目重复完整检查相同的依赖声明。源码严格性、声明交付责任与任务并发分别判断，采用依据及代表性测量见[必要性复核](../../verification/evidence/w00/declaration-checks.md)。

skipLibCheck 跳过全部 .d.ts 的完整检查，包括自有和第三方声明；TypeScript 仍读取声明并依据它检查调用。该选项不修复错误声明，可能掩盖声明内部冲突，不能被用来证明声明本身准确。

公共包的最终 d.ts 由实际仓库外消费者使用 skipLibCheck: false 完整检查，覆盖所属 Node、Webview 和 Solid 入口及实际解析环境。消费者使用打包后的公开入口，不指向源码，也不继承私有工程配置。声明生成成功不能代替消费验证，依赖升级中的真实不相容仍须处理。

每份自有 .d.ts 必须有至少一个实际执行、使用 skipLibCheck: false 的类型检查拥有者；普通消费方可复用这个保证。当前构建全局声明归 shared，窗口全局声明归 renderer，原生绑定声明归 main；原生声明同时核对实际 Rust 生成结果。结构检查沿真实任务入口和项目引用检查此项覆盖。新增声明随拥有者维护，不为每个调用入口重复建立声明检查项目。

UI 与其他包遵守同一分工，不另设仅为跳过依赖声明的配置项目。工具声明间接引用的其他打包器或运行时，不因此成为产品依赖。不得用任意断言、复制第三方定义或泄漏错误声明绕过问题。TypeScript、解析器和声明生成器保持相容，解析器支持范围检查继续生效，不使用双编译器或兼容 shim。

<a id="tasks"></a>

<a id="task-orchestration"></a>

## 任务调度、缓存与桌面开发

### 任务名称与项目入口

根定向脚本按范围、动作和限定方式命名，例如 desktop:packages:pack、desktop:test:native、root:typecheck。真正覆盖全仓的 build、typecheck、lint、test、check、clean 保留聚合名称。包内已有工程上下文，采用 build:native、prepare:resources、check:package 等动作在前的名称，不重复项目名前缀。根工程自身的维护动作同样使用 install:hooks 等本地名称。

包级 pack 生成一次实际 tarball，check:package 对该文件执行 publint／Are the Types Wrong；同包 test:consumers 依赖制品检查并安装同一文件，根 desktop:test:consumers 通过 Turbo 聚合调度。test:* 用于执行测试断言，工程载体的生成分别命名为 build:fixture 和 package:fixture。

使用与 pnpm 内置命令同名的脚本时明确写 pnpm run，例如 pnpm run pack 和 pnpm run clean。

各项目按需要提供 typecheck、lint、test 和 build，根 Turbo 根据实际 manifest 与锁文件中的依赖调度。根任务统一调度 workspace 和已登记的根实际任务；root:lint 只检查根工程，项目 eslint.config.ts 负责自身文件，并以 import.meta.dirname 显式绑定 parserOptions.tsconfigRootDir，使跨项目的暂存文件检查使用同一规则。根 turbo.json 定义共同任务，桌面特有任务由应用 turbo.json 继承并配置。依赖其他项目输出的任务明确声明上游 build；只读取源码的检查登记实际读取的共享输入，不制造空 build。格式检查无需先构建整个仓库。八个公共包各有自己的输出，桌面各程序独立构建，不维护额外的 target JSON 或依赖邻接表，也不把全部监听绑定到单一进程。

测试任务按[输入与执行阶段](layout.md#test-tasks)声明常规、消费者、端到端和最终制品等范围，项目脚本直接启动对应运行器与配置。独立任务入口用于表达构建依赖、环境和 CI 门槛，不要求对应一个工具模块；工程能力由 tools 实现，测试场景与专用辅助由 tests 拥有。

<a id="ci-selection"></a>

### CI 选择与验证编排

普通 CI 使用 Turbo 的任务输入与依赖图分别选择常规检查、公共包消费者、浏览器、原生、桌面窗口、开发会话和最终制品任务。当前通用 Chromium 交互在 Ubuntu x64 参考环境执行一次；具有平台差异的原生与桌面任务在六个实际目标执行。开发会话针对构建、监听与生命周期输入。首次交付、发行前及明确的完整验收仍覆盖所需目标和后端；手动 CI 入口请求完整代码与运行检查。全局工具链变化、缺失或不可解析的基线按该完整范围处理，选择工具失败则让检查失败。

性能采样独立于自动 CI，完整代码检查也不隐含启动采样。有明确性能疑问、相关实现变化或产品验收目标时，由实施者选择对应测量并显式调用；普通修改不为形成报告而采样。现有 `desktop:test:performance` 保留为测量入口，采样口径由其测试配置维护，不增加类型／运行时变更分类器。

PR 的比较范围是目标分支与当前版本之间的全部改动。affected 决定需要运行的任务，缓存决定被选中的可缓存任务是否复用既有结果。手动代码验证请求完整范围。

构建准备与回归选择分别表达。test:native 通过 Turbo 依赖 build:native 与 prepare:resources；desktop:test:e2e 和 desktop:test:performance 依赖 build:fixture；test:dev 依赖 build:native，test:artifacts 依赖 package:fixture。应用包内脚本是实际叶操作，根入口通过同一任务图完成准备。具体 inputs 由各实际任务的 turbo.json 声明，验证查询只读取 Turbo 结果，不另维护包依赖图或路径分类器。未改变但被选中任务依赖的构建，不使其他验证范围一起扩大；输入清单随运行器、配置、辅助和资源依赖同步更新。

CI 的工作流按工程职责划分，执行任务按目标环境划分，步骤表达该环境中的验证阶段。根 verification.yml 传递比较基线、目标提交和完整验证请求，调用 verification-repository.yml 与 verification-desktop.yml，并拥有最终 Required checks；工程工作流拥有自己的输入判断、工具链、环境、缓存和报告。后续工程进入实际范围时增加对应的可调用工作流与根层调用，不预建空工程，也不要求沿用桌面工具链或六目标矩阵。

每个可调用验证工作流返回 selected 与 verified：选中并完整执行返回 true／true；有依据地不选择返回 false／空。Required checks 对 needs 中的每个工程使用同一判断，工作流状态必须成功，缺失、取消、失败或错误跳过均不通过；矩阵整体状态负责覆盖全部目标。接入新工程时显式增加调用和 needs，并使用独立的工程缓存与报告命名空间，不依赖不同 workflow 的 job ID 恰好不同。

编排文件由所属工作流直接比较 Git 输入：事件入口与共同协调器变动触发全部工程，工程工作流只触发自身完整验证。标题工作流独立验证标题，不进入产品任务的全局输入。桌面与公共包的生产任务排除 Markdown、Vitest 配置、测试类型配置和测试文件；开发监听同时排除生成目录与本地状态，生产配置与新增生产文件继续触发相应构建。任务图与真实监听分别验证这些边界。

工作流通过 tools/host-environment.ts 记录运行环境。CI 选择适用任务，在一次 Turbo 调度中串行执行，资源、原生构建与工程载体由实际依赖准备。同一生产任务只运行一次；打包继续核对输入身份和实际字节，不另行记录文件修改时间证明构建复用。

桌面[构建输入身份](build.md#pipeline)直接使用 build:fixture 任务的 Turbo 摘要，包括任务依赖、全局工具链文件及声明的环境变量。根依赖的私有工程包沿 Turbo 的全局摘要语义纳入，局部任务的 inputs 排除不改写全局规则；工作流选择继续按实际 affected 结果确定。运行字节校验独立使用 SHA-256。

仓库工作流调度各 workspace 自己的常规检查与测试。桌面公共包的打包、产物检查和包内消费者由桌面工作流的 Linux x64 参考目标调度，各公共包拥有自己的 out/package/package.tgz 和 test-results/consumers，检查与消费者使用同一 tarball。公共包拥有独立可运行的构建、类型、lint 和适用测试入口；纯合同与 Node 启动器验证归其所属包，不依附桌面开发回归。共同 Node 环境可统一调度这些任务，独立的发布、权限或宿主要求出现后再建立相应工作流边界。

桌面工作流自行选择套件与目标。仅浏览器交互或桌面包消费者被选中时运行 Linux x64 参考目标；具有平台差异的检查被选中时，继续覆盖既定六目标。每个目标在同一 runner 内准备环境并执行选中的包消费者、浏览器、原生、窗口、开发与制品步骤。需要有限应用构建时只构建一次，所选运行检查与打包消费同一输出；开发回归复用其中已准备的原生编译输出，仅开发检查时单独准备原生输出。开发测试仍在隔离副本内验证真实构建与会话生命周期。打包核对既有 build.json 的目标、当前输入身份、完整文件集合和摘要，缺失、过时或改写均失败。根 desktop:package:fixture 通过同一任务图保持独立可运行；外部实际制品可以通过显式收据交给包内 test:artifacts 叶操作验证。

<a id="task-cache"></a>

### 任务缓存与依赖安装

只有结果由完整输入决定的有限任务才使用缓存，纯逻辑包的单测复用这一规则。输入需要包含影响输出的共享配置、环境变量、工具、平台、架构和 ABI，恢复时只写入本任务的输出。根工程、桌面工具和 Node 启动器等现场进程与文件系统验证继续实际执行。依赖实时外部信息或输入不明的任务不使用缓存；watch、现场原生验证、下载实时校验、签名、发布和部署不能通过重放缓存代替执行。外部 PR 无权写入可信缓存，也不能取得发行凭据。

pnpm 官方 Action 管理安装所需的 store 缓存，随后仍执行 frozen-lockfile 安装；setup-node 不重复管理同一包缓存。Turbo 保存项目任务声明的输出与成功日志，仓库内上游公共包的构建属于任务依赖，不接管包安装。缓存归档恢复、实际任务命中和现场测试执行分别记录。可选缓存恢复使用官方分片下载超时设置限制等待；失败后执行正常安装或任务，具体预算由工作流配置拥有，不改变验证断言。

CI 使用 GitHub Actions 官方 cache 恢复和保存 .turbo/cache，按工程命名空间、操作系统、架构与 Node 版本分组，提交作为保存键，只恢复同工程命名空间的旧键；具体结果仍由 Turbo 根据完整输入命中，不接入额外远端服务或凭据。仓库任务与各工程目标任务分别保存自己的缓存，避免竞争同一不可变键。fork PR 只恢复缓存，保存仅用于本仓库分支；主键已命中时不重复保存，恢复旧前缀后可以保存当前主键，GitHub 分支作用域限制仍然生效。缓存预算配置由实际调用缓存的工作流拥有，不能假定调用方顶层 env 自动传递。缓存不包含用户资料、密钥或现场运行证据。根实际使用的私有工程依赖参与 Turbo 全局哈希，因此共同工程源码变更可以使全仓任务失效；项目局部源码则按实际依赖图传播。验收分别记录冷运行、热命中、输入失效、输出恢复和真实 CI 跨运行恢复，不能以本机命中代替 CI 证据。

<a id="ci-feedback"></a>

### 工程反馈预算

标准托管 runner 上的工程反馈预算为：仓库检查及适用消费者／浏览器反馈在 4 分钟内，renderer／公共 UI 修改的全部代码门禁在 10 分钟内，开发工具、原生路径与完整验证在 25 分钟内。从 workflow 触发计至对应检查完成，包含排队、环境准备和上传；同时记录各任务实际起止与累计 runner 时间，后者不等于计费分钟。这些是工程预算，不是 P95 或服务承诺。超过目标时定位具体阶段，并按[整体判断](conventions.md#judgment)复核验证范围与机制成本；必要的验收不能因预算压力被跳过，范围调整说明依据后由用户确定。失败、未执行和超出时间目标分别记录。作业级中止上限与单项测试超时由各自配置拥有，不随反馈目标一起放宽。

<a id="desktop-development"></a>

### 桌面开发会话

persistent 任务不能作为等待完成的依赖，with 也不是就绪屏障。调度行为遵守 [Turbo 任务规则](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)、[watch 规则](https://turborepo.dev/docs/reference/watch) 和 [缓存规则](https://turborepo.dev/docs/crafting-your-repository/caching)。

桌面工具直接使用 Vite 的公开 API，由项目开发会话拥有进程和就绪交接。[桌面工具布局](layout.md#desktop-tools)中的 dev/session.ts 负责一个完整开发会话，依次完成有限依赖构建、当前目标资源准备、服务与程序监听、首次编译和 renderer 就绪，然后启动 Electron。就绪由回调或明确信号确认，不解析日志或依靠固定延时。

项目协调器的定制范围限于 extension-host 接入、跨包就绪与受控退出；编译、模块解析、renderer HMR 和打包使用 Vite 的公开能力。开发会话独立使用 Chokidar 6 监听运行时和公共包输入，一次传入完整路径并等待公开 ready 事件后再开始首次编译，监听寿命跨越 Vite 重启。初始化失败释放已建立资源；运行期间的监听错误使会话进入失败状态，停止采用新结果，由正常停止流程关闭监听、服务和进程。接口与行为依据见[开发监听验证](../../verification/evidence/w00/development.md)。

main 与 extension-host 使用 Vite 的 SSR 构建选择 Node 解析和插件语义；target 只负责生成语法，不能替代宿主配置。普通 JavaScript 依赖按制品布局打包，Electron、Node 内建模块和实际原生资源按所属部署合同处理。preload 保持沙箱可消费的独立 CommonJS 输出，renderer 使用浏览器环境，不套用完整 Node 宿主的缺省配置。

开发依赖仅保留当前完整副本和一个构建候选，内容为各包的 package.json 与 dist。准备失败保留当前副本，未采用候选由构建拥有者释放；成功采用后由 Vite 刷新页面，再释放旧副本，不继续为旧文档保存旧代模块。相同内容无需刷新，只释放重复候选。浏览器与 Node 入口由各自的实际消费者解析，不以浏览器条件预检全部导出。renderer 关闭后释放自己拥有的副本，运行时与公共包输入监听仍由开发会话拥有。

renderer 使用 HMR；main、preload 或 extension-host 成功重建后，由同一开发会话安排受影响的重启。依赖构建失败时保留最后成功状态，不混用不同版本的输出。

每份输出只有一个写入者，build 与 watch 不互相清理，监听过程也不先删除下游正在读取的目录。成功构建后完整交接，并处理文件删除和改名。正式构建使用干净输出，不夹带开发遗留文件。HMR 接入释放旧 Solid root、监听和 DOM。

<a id="output-access"></a>

### 输出访问与开发收尾

同一工作副本内，使用相同构建输出的独立任务顺序执行，不提供跨命令互斥、排队或冲突检测。运行检查、有限构建或打包前停止会重建相同依赖的开发会话；执行 clean 前停止相关任务。独立流程需要并行时使用不同工作副本，单次任务内的依赖顺序、合法并行和缓存由 Turbo 的实际依赖图决定。

根任务与项目脚本直接调用 Turbo、编译器、打包器和测试运行器。缓存恢复按任务声明的输出执行。完整流程按顺序完成准备、构建、快照或打包交接；候选在成功后替换对应输出，准备失败或采用前取消时保留原有结果。

开发会话拥有程序代际与依赖快照的写入和清理，现用程序与 renderer 使用已交接的完整结果。启动准备沿工作流传递取消信号；运行中的停止先取得本体正常退出结果。取消退出保留可用会话，确认退出后再取消编译、关闭监听和服务，并清理已无读取者的目录。不能中断的调用等待实际完成，采用结果前检查取消状态。

源码开发与作者开发共用 extension-cli/extension 的启动入口、desktop-contracts/development 的控制合同和 desktop-rpc；Node 父子 IPC 承载实际传输。源码会话选择本次 main、renderer 地址和隔离 profile，直接观察实际进程退出；不维护第二套私有控制消息。.local 中的隔离资料不随普通 clean 或重启删除。typecheck 和普通库 build 不下载媒体工具；桌面首次准备资源时只处理当前目标。

Turbo 只负责选择和调度任务。桌面与 kisx 通过 [公开开发接入](../extensions/development.md#connection) 协作，官方扩展不使用私有热加载路径。集成验证包括公共合同、UI 样式和 SDK 变化，故意构建失败后的恢复，多程序输出交接，停止与重启，以及真实资源使用；打开 watch 开关本身不代表开发流程可用。

<a id="dependencies"></a>

## 依赖更新与安全修复

Kisaki 和四个独立项目启用依赖图与安全告警。Dependabot 在支持的情况下创建安全修复 PR，常规升级由维护者或受托 agent 按实际需要处理，不安排固定每周升级、自动合并或自动发行。工具无法生成修复时，维护者仍需处理问题，规则见 [GitHub 安全更新](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates)。

升级应有明确目的，例如获得所需能力、解决问题或替换停止维护的依赖。manifest、catalog、锁文件和相关代码同步修改，并按影响范围执行检查。Electron、打包、更新或原生依赖即使只升级 patch 版本，也要验证实际平台行为。

依赖 PR 不替代版本 PR。CI 使用固定输入，不追随 latest；机器人变更同样需要通过安装和构建，并核对 [pnpm catalog 支持](https://github.blog/changelog/2025-02-04-dependabot-now-supports-pnpm-workspace-catalogs-ga/) 与 [适用环境](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)。

私有测试阶段继续通过 tarball 消费项目包，不为自动更新工具提前发布 npm 包或建立长期私有 registry。工具未覆盖的依赖和媒体归档由维护流程检查。安全 PR 使用普通检查权限，不接触签名或 npm 凭据；Collaborators only 设置仍允许 Dependabot，不新增机器人账号。

<a id="collaboration"></a>

## PR、提交与 CI

每项完整、可独立验证的变更从最新 main 建立短分支，并通过一个 PR 交付。必要 CI 通过后，由维护者自审并 Squash 合并，GitHub 自动删除已合并的远端分支。main 通过原生分支保护要求 PR、同步最新主线及必需检查通过，管理员同样遵守；审批人数为 0，不要求另一人 Approve。仓库仅启用 Squash，主线禁止强制推送与删除。只有本人和受邀协作者可以创建 PR；受托 agent 使用明确授权的身份。公开反馈另有入口，见 [协作身份](repository.md)。

ci.yml 接收 PR 和手动事件，再调用 verification.yml 协调代码验证。verification-repository.yml 与 verification-desktop.yml 分别执行仓库和桌面验证，通过 GitHub 原生 workflow_call 输入与输出连接；workflow 文件直接位于 .github/workflows，以 verification-<工程>.yml 表达归属。PR 使用 GitHub 的默认事件：打开、源分支提交变化及重新打开时执行代码验证。标题和正文编辑只触发独立的标题检查，保持代码验证的运行和结果。

日常验证在 PR 合并前完成。严格合并门禁使代码在进入主线前完成对当前合并结果的验证，合入后沿用这些证据；main push 不触发普通 CI。明确请求的完整验证由手动入口执行，正式发行按所属工作包验收。

常规 PR 合入 main。更换目标分支后，通过重新打开 PR 或更新源分支提交，按新的目标分支发起代码验证；原运行的比较基线保持其触发时的值。

实际代码验证根据依赖图及 Git 基线选择变更项目和下游；共享配置、锁文件变化或影响范围无法可靠判断时扩大检查。每次实际验证都执行汇总任务，确认所有应运行任务已经成功完成，不能把应执行却被 skipped 的任务算作通过。同一 PR 的新代码验证可以取消过时验证；标题检查使用独立取消组。

pr-title.yml 独立检查 PR 标题，与代码验证使用不同取消组。仓库合并规则应要求 `verify / Required checks` 与 `PR title` 两项；工作流拆分或任务改名时同步核对实际检查名称和仓库配置。元信息编辑不能用一次空验证替代失败的代码检查，正文修改也不能清除无效标题的失败结果。

纯规则使用普通 Node 下的 Vitest，Solid 组件使用 Browser Mode，数据库使用与 Electron 匹配的原生环境，正式制品另行验证。公开包 tarball 消费和扩展真实安装各自完成，不能相互代替。

Vitest 的转换缓存由启动测试的工程拥有，通过 fsModuleCachePath 显式指定相对项目 root 的 node_modules/.vitest-cache，避免合法并行的项目互相清理缓存。缓存只复用转换结果，不替代实际执行测试；同一工程的独立任务继续遵守输出访问约束。原生模块测试由开发 Electron 的 Node 模式执行应用自身的 Vitest CLI，不跨目录取根工程的运行器。

普通 PR 只有读取权限，不接触发行密钥。版本 PR 额外检查版本、依赖、所属语言要求的发行说明和交付物。过时的普通检查可以取消；发行绑定合并后的最终 SHA 并重新验证，不能以 PR 临时合并构建作为正式版本证据。

提交消息采用 Conventional Commits 1.0.0，格式为 type(scope)!: description。描述使用简短英文动词短语，正常小写，保留 API 和专名的正确拼写，末尾不加句号。type 支持 feat、fix、refactor、perf、docs、test、build、ci、style、chore 和 revert；style 仅用于排版，版本准备使用 chore(release): version packages。scope 采用稳定项目名或领域名，不强制枚举目录。

真正改变公开合同、数据或部署兼容性时使用 ! 和 BREAKING CHANGE footer，内部改名不自动构成 breaking change。提交类型不决定版本号。

PR 标题作为 Squash 标题，正文遵守 [PR 描述规范](documentation.md#pull-request-descriptions)。合并前整理最终说明，不拼接临时提交消息。独立标题工作流复用根 commitlint 与 conventional 配置，在 PR 打开、提交变化、重新打开及编辑时检查当前标题；只安装根检查所需依赖，不执行桌面构建或安装脚本。合并者确认最终 Squash 标题；如在合并界面改写，仍须符合上述提交规范。中间迭代不逐条强制检查提交消息，也不设置 commit-msg hook。

<a id="hooks"></a>

## 本地 hooks

Husky 和 lint-staged 提供 pre-commit，只执行 Prettier check 与 ESLint，不使用 --write、--fix、git add 或 stage_fixed。修复格式后由用户自行暂存。lint-staged 负责文件列表、长参数和部分暂存内容的隐藏与恢复，必须验证失败时的恢复行为。

默认 hooks 限定为上述 pre-commit 检查，文件选择与命令参数由 lint-staged 管理。提交规范通过 PR 标题检查与合并确认落实，版本、发行说明和 tag 由发行流程管理。

hooks 的安装入口只管理本项目的 hook 文件和仓库本地 core.hooksPath。没有显式配置时设置为本项目路径；本地已经使用本项目路径时，重复安装幂等完成。其他显式配置，包括空值或继承的设置，按冲突报告，由用户处理后重试，不保存或接管原配置。无关本地配置保持不变。

安装和卸载不得修改 --global、--system、用户 Husky 初始化文件、用户目录或 PATH。命令按仓库本地配置的实际作用范围执行；多个 worktree 共用该配置时，安装与卸载作用于整个仓库，并明确说明这一范围，不维护逐 worktree 的安装归属或引用计数。

卸载只移除仍指向本项目的本地 core.hooksPath。当前值已由用户改写时，保留新值并报告。之后只清理自身 hook 文件、脚本和依赖，不恢复第三方配置，也不删除 stash 等恢复资料。

CI、源码压缩包和未安装开发依赖的环境都要有明确、不会重复执行的行为。hook 清理只处理可确认由本项目拥有的文件，备份及其他配置按实际归属保留，不重置全局设置。CLI 生成的 workspace 遵循相同原则，可以独立安装、提交和卸载 hooks，不引用 Kisaki 私有路径。
