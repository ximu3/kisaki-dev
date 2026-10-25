# 公共包、工作区与开发工具

桌面应用、所属公共包、官方扩展和分发资料在同一仓库的 clients/desktop 下维护。仓库还按[工程分组](layout.md#workspace)区分后续 Web 客户端、官网和候选服务端；本篇的具体工具链与交付检查覆盖当前桌面范围。各项目通过声明的依赖和公开入口协作，构建顺序由实际依赖决定。公开能力需要同时通过类型检查、运行验证和仓库外制品消费验证。

<a id="solid"></a>

## Solid 与控件版本

| 能力           | 版本线                      | 固定兼容基线                                                                      |
| -------------- | --------------------------- | --------------------------------------------------------------------------------- |
| Solid          | 1.9.x                       | solid-js 1.9.16                                                                   |
| 官方路由       | 与 Solid 1.9 相容的 1.x     | @solidjs/router 1.0.0                                                             |
| 编译集成       | 支持 Solid 1 的插件 2.x     | vite-plugin-solid 2.11.14                                                         |
| 基础控件       | 与 Solid 1.9 相容的成熟版本 | @kobalte/core 0.13.14                                                             |
| 虚拟列表与网格 | TanStack Virtual 3.x        | Solid 适配 3.13.48 与 core 3.19.6，见[几何边界](../ui/virtualization.md#geometry) |
| 拖拽排序       | Pragmatic Drag and Drop     | 核心 3.1.0 与辅助包组合见 [拖拽实现](../ui/virtualization.md#dependency)          |

原生窗口、公共 UI 和官方扩展统一使用 Solid 1.9，并遵守该版本的 API 与 owner 生命周期。应用使用 Vite 8.3.3 和 vite-plugin-solid 2.11.14；公共 Solid 库使用 tsdown 0.23.0，以及 unplugin-solid 2.0.0 提供的公开 Rolldown 接入。unplugin-solid 3.x 不用于 Solid 1.9。

运行时、JSX 和编译插件必须相容，并使用同一组锁定版本。工程不混用 Solid 2 的运行时或编译入口，也不建立双主版本兼容层。路由负责导航，视图持有查询快照。公共 UI 的类型声明、CSS 和组件生命周期均由实际消费者验证。

<a id="packages"></a>

## 公共包与依赖方向

| 包                     | 责任与环境                                                                                     | 真实消费范围                                       | 许可 |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---- |
| appearance             | 纯视觉 token 词表、基础值规则、默认视觉值、CSS 与可选 Tailwind 映射                            | 桌面原生界面与各框架扩展 Webview                   | MIT  |
| ui                     | Solid 基础组件及可直接消费的样式；Solid 作为 peer                                              | 使用 Solid 的原生界面和扩展 Webview                | MIT  |
| extension-distribution | manifest、仓库索引、静态展示元数据、身份和兼容声明格式、纯校验与规范化；Node 入口实现索引签名  | 本体、合同、SDK、CLI 及处理扩展制品的消费者        | MIT  |
| desktop-contracts      | 完整桌面公共值、操作、错误与参与接口；development 入口提供作者开发控制合同                     | 本体、窗口、extension-api 及实际使用这些定义的工具 | MIT  |
| extension-api          | 完整扩展公开接口，选用桌面能力并显式提供相关类型，定义扩展上下文、激活、登记差异与公开接入消息 | 宿主、SDK、扩展作者及实际需要运行合同的工具        | MIT  |
| rpc                    | 自研、环境无关的消息式 RPC 内核，只提供通用连接与调用机制                                      | 桌面通信接入和 SDK 的实际客户端实现                | MIT  |
| extension-sdk          | 实现扩展 API，提供集中作者类型入口及 Node、框架无关 Webview 接入                               | 具体扩展；不作为应用业务总入口                     | MIT  |
| extension-cli          | kisx、程序化工作流与模板，面向源码工作区、扩展和分发仓库                                       | 外部作者与同仓官方扩展开发                         | MIT  |

八个包统一放在 clients/desktop/packages，围绕桌面与扩展的实际需求设计。appearance 提供视觉词表，ui 提供 Solid 组件，rpc 提供环境无关的通信能力。Web 与官网可自行选择界面体系；外部消费者通过各包声明的公开入口采用适用能力。

产品接口的依赖方向为 extension-sdk → extension-api → desktop-contracts。SDK 通过 extension-api 使用业务合同，不直接依赖 desktop-contracts。本体和扩展宿主按职责直接使用桌面定义或扩展接入合同。

desktop-contracts 可以引用 appearance 的视觉词表和 extension-distribution 的制品格式，不反向依赖扩展上下文。extension-distribution 不依赖应用业务或扩展 API，rpc 不依赖任何产品合同。其他依赖按下表选择：

| 消费者                 | 可依据职责消费的内容                                           | 必须保持的边界                                                                                                      |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| appearance             | 纯视觉定义与适用通用纯库                                       | 不导入桌面合同、分发业务、应用、SDK 或框架运行状态                                                                  |
| ui                     | appearance、Solid peer 及适用呈现依赖                          | 不调用业务、宿主或云服务，不把桌面域对象藏进基础组件                                                                |
| extension-distribution | 扩展制品与静态元数据规则、适用的通用格式库                     | 不依赖 desktop-contracts、extension-api、SDK、rpc、CLI 或应用；Node 签名与纯格式入口分开                            |
| desktop-contracts      | appearance 的视觉词表与 extension-distribution 的实际制品格式  | 管理接口直接引用 manifest/索引等定义；不依赖 extension-api、SDK、rpc、CLI 或程序实现                                |
| extension-api          | desktop-contracts 的明确能力，以及实际使用的分发或视觉基础定义 | 只含运行与公开接入规范；不依赖 SDK、rpc 或桌面私有程序                                                              |
| rpc                    | 标准语言能力与确有必要的通用基础依赖                           | 不依赖本体或扩展合同、SDK、UI、Electron 或任一应用，实际传输由调用方适配                                            |
| extension-sdk          | extension-api、rpc 与实际使用的分发或视觉基础                  | 业务接口仅经 extension-api 消费，不直接依赖 desktop-contracts 或私有源码；区分 Node/Webview，不要求作者管理底层连接 |
| extension-cli          | 作者工作流实际使用的分发能力、开发合同、工具与接入实现         | 模板依赖与工具自己的运行依赖分别声明，不因模板使用 UI 就作为 CLI 运行依赖                                           |
| 应用和具体扩展         | 与自身环境和职责相符的公开入口                                 | 不导入另一应用或另一扩展的私有源码；官方扩展同样遵守作者合同                                                        |

项目声明实际使用的依赖，工作区据此生成依赖图。拆包需要稳定的公共用途、独立的依赖边界和真实消费者；模块内共享的实现保留在所属项目。

各包独立管理版本。桌面合同变化可能要求扩展相关包更新，但不必然意味着公开 API 不兼容，也不要求桌面与 SDK 锁步发行。API 版本、schemaVersion 和 npm 包版本分别表达自己的含义。

Vantage、Kana、libmpv-node 和 oauth-relay 按 [独立项目规范](../projects/README.md) 通过公开发行或服务合同接入，其实现源码不进入 Kisaki monorepo。未来产品服务端同仓与这些独立项目的仓库边界分别判断。云合同由服务提供者维护，客户端不导入服务端内部实现；公开构建不能读取私有服务端源码。

跨包导入使用 workspace 依赖、exports 和构建结果。同仓消费者与仓库外消费者使用相同的公开路径，不能通过 TypeScript paths 指向另一包的 src。发布的 d.ts 不得包含私有源码路径或尚未发布的依赖。相关行为依据 [TypeScript paths](https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths) 和 [Node exports](https://nodejs.org/api/packages.html#package-entry-points) 验证。

exports 不提供安全隔离。静态检查还要覆盖相对路径、绝对路径、别名、类型导入、转导出、循环依赖和运行环境。main 与 extension-host 不互相导入私有实现，只共同使用 shared 中的私有协议和独立 rpc；连接身份、开放方法及运行资源由各自接入负责。

<a id="package-organization"></a>

## 公共包的源码组织

八个包各自在 clients/desktop/packages 下组织源码。以下位置表达主要职责，公开 exports 按消费方式明确列出，不随内部文件自动扩展。小模块保持单文件，只有实际需要多份逻辑协作时才拆成同名目录。

| 包                     | 主要源码位置与责任                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appearance             | tokens.ts 维护词表与类型，values.ts 维护纯值规则，defaults.ts 维护默认视觉值；CSS 与可选映射遵守[视觉交付边界](#visual-packages)                                 |
| ui                     | components 按实际基础组件组织，复杂组件在自己的目录内协作；样式随包交付，组件不取得桌面业务依赖                                                                  |
| extension-distribution | manifest 与 registry 分别组织声明和索引格式；metadata.ts 维护静态展示值，compatibility.ts 维护兼容规则，node/signing.ts 实现签名与验证                           |
| desktop-contracts      | library、metadata、ingest、scanner、sessions、tasks 等语义模块拥有各自的值、操作和参与合同；错误、日期、几何等基础值使用明确叶模块，development 提供工具开发接入 |
| extension-api          | node 组织 ExtensionContext、生命周期及领域能力的选用和登记差异，webview 组织视图能力与私有通信合同，protocol 组织宿主与 SDK 的公开接入消息；全部保持纯粹         |
| rpc                    | connection.ts 组织连接与关闭，frames.ts 定义和校验消息帧，requests.ts 处理请求回复及取消关联，transport.ts 定义传输适配接口；通知与断连清理由对应机制承担        |
| extension-sdk          | node 实现扩展上下文、登记、回调和实例资源映射；webview 实现实际视图连接、私有通信及宿主环境接入；根 index.ts 明确集中导出作者类型与必要纯定义                    |
| extension-cli          | cli 负责命令参数、交互和终端反馈；workspace、extension、registry 分别拥有实际工作流，config.ts 提供轻量配置声明；templates 保存正式生成模板                      |

extension-api 的公开接入消息与本体 shared/extension-host.ts 的私有进程控制协议分别维护，版本、有限帧及真实实例绑定遵守[协议合同](protocols.md)。SDK 的 Node 与 Webview 入口使用各自环境，纯入口不初始化其中任一端；同义的资源或回调适配按实际责任复用，通用通信机制直接使用 rpc。来源账号、请求策略和业务状态继续由具体扩展拥有。

CLI 的 extension 工作流按 create、dev、validate、build 和 pack 的实际责任组织；程序化入口直接复用这些工作流，不调用命令后解析终端文字。templates 分为 node、node-webview 和 node-solid，分别生成已规定的三种作者结构，并作为 CLI 的正式资源交付，不放入测试 fixture。

各包维护自己的 README、release-notes、manifest、TypeScript 与构建配置，dist 保存生成制品。纯逻辑单测贴近源码，集成、浏览器、制品消费和工具测试按[共同测试结构](layout.md#tests)归所属工程的 tests，真实样本归 tests/fixtures。跨包制品消费由根 tests/consumers 拥有，通过 test:consumers 任务使用实际 tarball 验证纯 Node、框架无关 Webview 和 Solid Webview 三种作者路径；测试专用准备与清理归 tests/support。作者按实际需要使用 SDK、appearance 和 ui，不要求安装全部八包或读取应用源码。

<a id="contracts"></a>

## 类型定义与作者入口

| 定义                                                  | 定义拥有者                                                     | 保持的含义与边界                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| EntryRef、WorkRef、PartRef、ExternalIdentity 与资料值 | desktop-contracts/library 的相应模块                           | 正式身份与来源身份分别表达；本体直接引用，SDK 经 extension-api 消费，同义定义不复制       |
| 评分、状态、完成与记录值                              | desktop-contracts/library 的记录合同                           | 值与查询、修改共同组织，内部持久实现归本体；不从 ORM 行推导公共数据                       |
| 阅读位置、文字选区与页面区域                          | desktop-contracts/library 的记录合同；共有几何由明确叶模块提供 | 定义形状、编码、合法性与 Kana 接入边界，不将解析算法移入合同                              |
| PartialDate 等实际跨合同的基础值                      | desktop-contracts 内有明确语义的日期等叶模块                   | 保持唯一类型和纯规则，不为每种小值增加 npm 包                                             |
| FontRef、字体读取与管理合同                           | desktop-contracts/fonts                                        | 表达桌面系统字体和用户字体库身份，供主题与阅读直接使用，不进入共同视觉包                  |
| Theme、AppearanceTokens、ThemeRef 与桌面外观接入      | desktop-contracts/appearance                                   | 保留双套主题、字体选择及资源合同；主进程承担持久化与解析，视觉词表来自 appearance         |
| LocalizedText 与静态文案匹配规则                      | extension-distribution/metadata                                | manifest、索引、贡献文案和发行说明直接采用同一格式；本体 i18n 接口引用它，不重新声明      |
| UiTranslationRef、消息目录与英语基准生成合同          | desktop-contracts/i18n                                         | 纯登记值、键与参数约束及作者基准；SDK 经 extension-api 提供，本体 i18n 拥有实际登记与解析 |
| ErrorSummary 等真正同义的基础结果值                   | desktop-contracts/errors 等明确语义入口                        | 不建立同形别名；每个操作仍表达自身完成、失败和取消语义                                    |

desktop-contracts 按公共能力提供 library、metadata、ingest、scanner、sessions、tasks、onboarding、search、events、images、i18n 等入口，development 入口用于工具开发会话。合同目录按这些语义组织，应用内部目录由各实现自行管理。

桌面合同覆盖完整本体能力，扩展开放范围由[扩展运行合同](../extensions/runtime.md)定义。同一职责的值、输入输出、错误、校验和资源接口可以放在同一模块，入口形式按实际能力安排。数据库连接、原生句柄、构造依赖和内部运行状态留在实现中。

完整能力接口使用 LibraryApi、MetadataApi、SessionsApi 等名称；参与接口和资源使用 MetadataProvider、MetadataReadSession 等具体名称。公共合同先定义业务语义，实现再将 ORM 数据映射到合同。相同签名直接引用；只开放部分能力时使用明确的 Pick，并与实际接入清单一致；语义有差异时定义适配。

本体登记 provider 时使用完整 ID，扩展登记使用实例内的局部 id。登记差异不改变回调和资料值的共同合同。

extension-api 只包含公开定义及必要纯规则，显式导出公开签名需要的全部类型和值。扩展上下文与激活合同由它定义，业务合同仍由 desktop-contracts 维护。SDK 从 extension-api 集中导出 ExtensionContext、EntryRef、MetadataProvider 等作者需要的类型，不要求作者逐包寻找，也不使用 export * 汇出整个仓库。

SDK 的 Node 和 Webview 运行入口分别适配对应环境，公共纯入口不能加载 Node I/O、DOM、Electron 或 Solid。各包独立演进时，仍须验证双方实际语义相容。

合同依赖只由签名所需的值决定。例如，ingest 的候选合同引用候选值，LibraryApi 由实际调用 library 的实现接入；事件目录可以引用 ScanResult，分发机制保持通用。业务输入表达目标、查询与修改，运行 context 表达取消及交互，接入建立调用身份、窗口与实例代际。

纯合同不执行 Electron、Node I/O、DOM、Solid、数据库或技术内核代码，但可以声明 Promise、回调、AbortSignal 和可释放资源。合同不必全部是 JSON；实际序列化与实例映射由接入实现。公共存储值和 codec 复用唯一的纯规则，日期、几何等基础值按自身语义设置叶模块，不为每个小值单独建立 npm 包。

<a id="visual-packages"></a>

## 视觉基础与桌面资源

appearance 维护视觉 token 词表、类型与值规则、默认值、CSS 和可选映射。它不识别 FontRef、ThemeRef、字体 ID 与路径、偏好、数据库或登记句柄。

appearance/src/styles.css 提供普通基础与派生 CSS，类型、默认值和普通 CSS 可独立消费。src/tailwind.css 提供 Tailwind 4 映射，通过 [CSS 主题变量](https://tailwindcss.com/docs/theme#referencing-other-variables)引用正式视觉变量。采用映射入口的项目自行提供 Tailwind 构建工具。

desktop-contracts/appearance 在字体槽中组合桌面字体选择，直接引用 appearance 的颜色和尺寸词表。主进程 appearance 解析资源，宿主绑定资源 URL，SDK 在扩展文档中加载资源，具体分工见 [外观规则](../domains/appearance.md)。

ui 通过 props、事件、回调和普通呈现值接入行为，不导入桌面合同、SDK、数据库或客户端查询层。应用内的 domain-ui 提供桌面业务界面。非 Solid 扩展可以只使用 appearance 和框架无关 SDK。

ui 使用 Tailwind 4 编写和构建组件的常规样式，src/styles.css 是包内编译入口，接入 Tailwind、appearance 的映射及必要 CSS，并生成组件实际使用的样式。dist/styles.css 是完整的普通 CSS，通过包的样式入口交付；消费者不需要安装 Tailwind 或重新编译 UI 样式。组件专属 CSS 与组件就近放置，只有实际出现多份共享样式时才拆分 styles 目录。

UI 成品包含组件自身必要的基础规则，不无条件注入影响整个文档的 [Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight)。文档级重置由实际宿主统一安排。应用或扩展自己的 Tailwind 构建只处理自身代码及实际共享组件，并通过 appearance 采用同一映射；桌面的具体位置遵守[窗口样式组织](layout.md#renderer-styles)。

CSS 提供明确的消费入口，并通过副作用配置确保构建保留；消费者不扫描包的 src 生成样式。Solid 作为 peer 依赖，不重复打包。字体字节和加载由宿主管理，纯视觉包不承担桌面资源职责，也不预先承诺所有 UI 框架或 SSR 模式。

关闭、通知和外观能力接入实际宿主会话，不额外建立公共业务包装或全局客户端上下文。

<a id="workspace"></a>

## 工作区与项目配置

Kisaki 中的 Node 与 TypeScript 工程采用一个根 pnpm workspace、一份 pnpm-lock.yaml，由根 Turborepo 调度实际项目。当前成员为桌面应用、八个公共包和 33 个官方扩展；clients、desktop 等分类目录不登记为包。未来对应工程实际建立后优先加入同一工作区，不提前登记空工程。成员按 manifest 中的唯一 name 识别，包作用域与发布资格遵守[项目身份](repository.md#identity)，目录分类不替代包身份。

| 位置                   | 负责内容                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| 根 package.json        | 固定包管理器版本，声明仓库维护工具和统一任务入口，不参与产品发行版本 |
| 根 pnpm-workspace.yaml | 声明实际成员，以及确有一致性要求的 catalog 版本范围                  |
| 根 pnpm-lock.yaml      | 保存工作区的依赖解析结果，供安装与依赖图核对                         |
| 根 turbo.json          | 声明任务依赖、输出和缓存规则                                         |
| 各项目 package.json    | 声明自己的版本、实际依赖、公开入口和项目脚本                         |

根目录只保留仓库级工具及根工具实际使用的依赖，应用和库的依赖由使用者声明。Electron 属于桌面应用，Solid 属于实际使用它的项目，组件库依据公开合同声明 peer。一个锁文件可以记录各项目需要的不同依赖版本；catalog 只统一需要共同兼容的范围，不迫使未来 Web 或官网采用桌面的框架。依赖归属依据 [Turborepo 依赖管理建议](https://turborepo.dev/docs/crafting-your-repository/managing-dependencies)。

根配置提供共同严格性与格式规则，各项目限定自己的 Node、DOM、Electron、Solid 和测试环境。其他语言工程保留对应工具链与锁文件，不为目录一致而改用 pnpm 管理原生依赖。出现无法在共同工具链中可靠开发与验证的真实约束时，再明确调整工作区边界。

仓库根 tsconfig.json 以空 files 和 references 组织 config/typescript 中的 tsconfig.tools.json、tsconfig.config.json 和 tsconfig.tests.json。根工具使用 Node 类型与 ES2023 库；工具配置与测试按实际声明和浏览器回调需要包含 DOM，测试样板由各自配置检查。配置类型项目覆盖根工具入口及 config 中的 TypeScript 配置。根类型任务先由 Turbo 调度各 workspace，再通过 tsc -b 检查这三个项目，增量信息归根 .cache/typescript。根 tsconfig.base.json 提供共同规则，依赖检查复用其中的编译选项，按所属 package.json 的 imports 与 exports 解析模块入口，不另维护私有别名映射。

桌面应用的 tsconfig.json 以空 files 和 references 组织 main、preload、renderer、extension-host、shared、tools 和 tests 七个环境项目。具体配置位于 config/typescript，继续独立限制类型与源码范围；typecheck 使用 tsc -b，增量信息写入应用 .cache/typescript，保持 noEmit。编辑器通过默认入口发现这些项目，结构检查沿实际执行入口和项目引用核对源码覆盖。其余构建和测试配置的归属见[应用布局](layout.md#workspace)。

八个公共包也以根 tsconfig.json 的空 files 和 references 组织类型项目，typecheck 使用 tsc -b。各包 config/typescript 中的 tsconfig.lib.json 负责库源码，tsconfig.tools.json 负责 Node 工具及适用的构建配置，UI 的 tsconfig.config.json 单独管理已确认的声明检查例外。根 tsdown.config.ts 显式读取 config/typescript/tsconfig.lib.json；增量信息写入各包 .cache/typescript。官方扩展当前的 tsconfig.json 与 kisx.config.ts 是实际默认入口，后续内部配置同样遵守[配置归属](conventions.md#configuration-layout)，不按配置数量另设例外。

共享锁文件与工具升级可能扩大验证范围。开发入口按实际目标启动，desktop:dev 只启动桌面及必要依赖；项目脚本执行具体任务，根任务统一调度。版本、发行说明与部署仍按各自发行单位管理，不因一次安装或同仓提交而合并版本。

<a id="tooling"></a>

## 工具职责与检查环境

| 拥有者                       | 唯一负责的事实或行为                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| pnpm                         | workspace 成员、各包实际依赖、统一锁文件、catalog、安装与 tarball 打包 |
| Turborepo                    | 从真实依赖形成任务顺序、受影响范围、并发与合格任务的缓存               |
| TypeScript、ESLint、Prettier | 类型与环境检查、代码规范和导入规则、统一排版                           |
| tsdown                       | 公开 TypeScript/Solid 包的代码、类型声明与声明过的样式输出             |
| Vite 与桌面 tools            | 各 Electron 程序和 renderer 的编译、开发服务器、桌面生命周期与资源装配 |
| electron-builder             | 平台安装包、签名接入与 electron-updater 所需元数据                     |
| kisx                         | 扩展项目开发与打包、 registry 资料处理、校验和签名                     |
| GitHub Actions               | 事件、runner、任务依赖、权限、制品流转和发布部署                       |
| 根 tools                     | 校验版本 PR 的发行输入，生成发布平台所需内容并执行交付步骤             |

根 packageManager 固定 pnpm 版本，开发工具使用一致的 Node 版本和锁文件；Electron 内置 Node 的版本另行记录。CI 使用 frozen-lockfile 安装，检查过程不自动升级依赖。

工程输出使用 fs-native-extensions 的系统文件锁表示实际占用。该依赖由根工程工具声明，不进入应用或公共包的运行依赖；目标平台的真实运行验证随工程入口验收。锁载体保留在根 .cache 中，文件存在不表示仍有任务运行。

各包分别声明直接运行依赖、开发依赖和 peer 依赖。catalog 只统一确实需要一致的版本范围，不把所有依赖提升到根目录。workspace 包打包后检查实际依赖版本，预发布版本使用明确范围，不能假定稳定版本范围会接纳它。

公开库默认交付 ESM、d.ts 和所需 CSS，并区分 Node、DOM、Solid 与纯定义入口。通过 publint、Are the Types Wrong 和实际 tarball 消费检查制品。sandbox preload 将非 Electron 依赖完整打包为可加载的 CommonJS；其他程序按 [Electron 加载规则](https://www.electronjs.org/docs/latest/tutorial/esm) 检查，不机械统一为 ESM。

tsdown 生成声明不能代替完整 typecheck。根 TypeScript 配置只规定共同严格性，各项目限制实际可用的 globals、模块和测试类型，手写 d.ts 也作为源码检查。ESLint 检查局部导入规则，dependency-cruiser 检查进程边界、私有依赖、循环及绕过路径。格式和 lint 共享配置只保留必要的环境差异。

自维护源码按[TypeScript 要求](conventions.md#source-language)检查，范围包含产品代码、工具、配置、测试、模板和本体私有原生入口。源码类型配置保持 allowJs: false，结构检查核对未进入 typecheck 的目录，生成产物和第三方发行内容按自己的归属检查。

项目 manifest 和版本 PR 提供版本事实，Turbo 安排依赖任务，CI 调用项目自身的构建入口。根 tools 校验发行输入、生成元数据并执行交付，不另行推导版本或依赖图。所有工具采用经过兼容验证的锁定版本，TypeScript 和声明检查使用同一编译器。

<a id="declaration-checks"></a>

## 实现与公开声明的类型检查

依赖 Kobalte 的 UI 控件实现使用 skipLibCheck: true，普通 .ts 和 .tsx 实现仍完整检查。纯合同、SDK 和仓库外公开声明消费者使用 skipLibCheck: false。

UI 的 tsdown 构建配置单独使用本包的 `config/typescript/tsconfig.config.json` 与 `skipLibCheck: true`。锁定的 unplugin-solid 2.0.0 的 Rolldown 入口通过通用 unplugin 声明引用其他打包器和 Bun；这些非消费路径的缺失或不相容声明不作为 UI 构建配置的依赖。该豁免只覆盖配置使用的声明检查；配置自身、UI 源码和构建工具源码仍检查，工具源码使用独立且不跳过声明检查的配置，公开声明继续由严格消费者验证。

skipLibCheck 跳过全部 .d.ts 的完整检查，包括自有和第三方声明；TypeScript 仍依据这些声明检查调用。这个选项不会修复错误声明，也不能证明受影响类型准确。

公共 UI 必须提供准确的组件合同，最终 d.ts 由实际消费者完整检查，必要时通过独立声明检查补足自有范围。不得用任意断言、复制第三方定义或泄漏错误声明来绕过问题。TypeScript、解析器和声明生成器保持相容，解析器支持范围检查继续生效，不使用双编译器或兼容 shim。

<a id="tasks"></a>

## 任务调度、缓存与桌面开发

各项目按需要提供 typecheck、lint、test 和 build，根 Turbo 根据实际 manifest 与锁文件中的依赖调度。依赖其他项目输出的任务明确声明上游 build，格式检查无需先构建整个仓库。八个公共包各有自己的输出，桌面各程序独立构建，不维护额外的 target JSON 或依赖邻接表，也不把全部监听绑定到单一进程。

测试任务按[输入与执行阶段](layout.md#test-tasks)声明常规、消费者、端到端和最终制品等范围，项目脚本直接启动对应运行器与配置。独立任务入口用于表达构建依赖、环境和 CI 门槛，不要求对应一个工具模块；工程能力由 tools 实现，测试场景与专用辅助由 tests 拥有。

只有结果由完整输入决定的有限任务才使用缓存。输入需要包含影响输出的共享配置、环境变量、工具、平台、架构和 ABI，恢复时只写入本任务的输出。依赖实时外部信息或输入不明的任务不使用缓存；watch、现场原生验证、下载实时校验、签名、发布和部署不能通过重放缓存代替执行。外部 PR 无权写入可信缓存，也不能取得发行凭据。

persistent 任务不能作为等待完成的依赖，with 也不是就绪屏障。调度行为遵守 [Turbo 任务规则](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)、[watch 规则](https://turborepo.dev/docs/reference/watch) 和 [缓存规则](https://turborepo.dev/docs/crafting-your-repository/caching)。

桌面工具直接使用 Vite 的公开 API，由项目开发会话拥有进程和就绪交接。[桌面工具布局](layout.md#desktop-tools)中的 dev/session.ts 负责一个完整开发会话，依次完成有限依赖构建、当前目标资源准备、服务与程序监听、首次编译和 renderer 就绪，然后启动 Electron。就绪由回调或明确信号确认，不解析日志或依靠固定延时。

项目协调器的定制范围限于 extension-host 接入、跨包就绪与受控退出；编译、模块解析、HMR、watch 和打包使用 Vite 的公开能力。方案依据见[开发工具比较](../../verification/evidence/technical-tradeoffs/2026-10-22/README.md#development)。

renderer 使用 HMR；main、preload 或 extension-host 成功重建后，由同一开发会话安排受影响的重启。依赖构建失败时保留最后成功状态，不混用不同版本的输出。

每份输出只有一个写入者，build 与 watch 不互相清理，监听过程也不先删除下游正在读取的目录。成功构建后完整交接，并处理文件删除和改名。正式构建使用干净输出，不夹带开发遗留文件。HMR 接入释放旧 Solid root、监听和 DOM。

<a id="output-access"></a>

输出访问按所属项目和具体输出目录控制。普通任务持有项目共享锁，clean 取得项目独占锁；读取输出持有共享锁，写入、替换和删除输出持有独占锁。项目及输出之间没有冲突的任务可以并行，编译顺序与任务内并行由 Turbo 的实际依赖图决定。

每个完整操作一次声明所需的访问范围，在读取或修改输出前取得占用，交接及所需的子进程结束后释放。输出身份采用所属任务声明的完整输出根，读写双方使用同一根目录，不以任意内部文件另设锁。同一操作的嵌套调用和子任务复用已经取得的访问范围，不将共享占用隐式升级为独占占用。有限任务遇到冲突时报告占用并退出；开发会话的构建阶段允许等待。等待占用和初始化均可取消；取消等待与实际任务结束分别处理。

Turbo 的缓存恢复和实际任务执行采用相同的输出占用。根入口依据 Turbo 的公开任务计划取得参与项目与缓存输出，不维护另一份依赖图；项目入口声明自身操作及实际依赖输出的访问。有限任务通过受保护的根入口调度；只读任务计划查询不需要取得输出写入占用。构建完成到复制快照、打包或验证的读取期间，相关输出保持受保护。

开发会话持有本体项目共享锁，程序代际与依赖快照由该会话独占写入和清理。共享资源准备与公共包重建只在相应阶段取得输出独占锁；现用程序与 renderer 使用已交接的完整结果。会话关闭等待编译、进程、监听和服务结束，再清理自身目录并释放占用。

锁的寿命由实际打开的系统句柄维持，工程代码等待其子进程完成并在正常退出时关闭句柄。锁载体与访问上下文不采用 PID、文件时间或目录存在性判断存活，也不作为构建缓存输入。

停止开发会话时，工具关闭 Electron、监听和服务。.local 中的隔离资料不随普通 clean 或重启删除。typecheck 和普通库 build 不下载媒体工具；桌面首次准备资源时只处理当前目标。

Turbo 只负责选择和调度任务。桌面与 kisx 通过 [公开开发接入](../extensions/development.md#connection) 协作，官方扩展不使用私有热加载路径。集成验证包括公共合同、UI 样式和 SDK 变化，故意构建失败后的恢复，多程序输出交接，停止与重启，以及真实资源使用；打开 watch 开关本身不代表开发流程可用。

<a id="dependencies"></a>

## 依赖更新与安全修复

Kisaki 和四个独立项目启用依赖图与安全告警。Dependabot 在支持的情况下创建安全修复 PR，常规升级由维护者或受托 agent 按实际需要处理，不安排固定每周升级、自动合并或自动发行。工具无法生成修复时，维护者仍需处理问题，规则见 [GitHub 安全更新](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-security-updates)。

升级应有明确目的，例如获得所需能力、解决问题或替换停止维护的依赖。manifest、catalog、锁文件和相关代码同步修改，并按影响范围执行检查。Electron、打包、更新或原生依赖即使只升级 patch 版本，也要验证实际平台行为。

依赖 PR 不替代版本 PR。CI 使用固定输入，不追随 latest；机器人变更同样需要通过安装和构建，并核对 [pnpm catalog 支持](https://github.blog/changelog/2025-02-04-dependabot-now-supports-pnpm-workspace-catalogs-ga/) 与 [适用环境](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)。

私有测试阶段继续通过 tarball 消费项目包，不为自动更新工具提前发布 npm 包或建立长期私有 registry。工具未覆盖的依赖和媒体归档由维护流程检查。安全 PR 使用普通检查权限，不接触签名或 npm 凭据；Collaborators only 设置仍允许 Dependabot，不新增机器人账号。

<a id="collaboration"></a>

## PR、提交与 CI

每项完整、可独立验证的变更从最新 main 建立短分支，并通过一个 PR 交付。必要 CI 通过后，由维护者自审、Squash 合并并删除分支。main 要求 PR 和检查通过，不要求另一人 Approve。只有本人和受邀协作者可以创建 PR；受托 agent 使用明确授权的身份。公开反馈另有入口，见 [协作身份](repository.md)。

ci.yml 覆盖 PR 和主线。CI 根据实际依赖图及 Git 基线选择变更项目和下游；共享配置、锁文件变化或影响范围无法可靠判断时扩大检查。必需的汇总检查始终执行，并确认所有应运行任务已经完成，不能用顶层 paths 条件使检查永远等待，也不能把应执行却被 skipped 的任务算作通过。

纯规则使用普通 Node 下的 Vitest，Solid 组件使用 Browser Mode，数据库使用与 Electron 匹配的原生环境，正式制品另行验证。公开包 tarball 消费和扩展真实安装各自完成，不能相互代替。

普通 PR 只有读取权限，不接触发行密钥。版本 PR 额外检查版本、依赖、所属语言要求的发行说明和交付物。过时的普通检查可以取消；发行绑定合并后的最终 SHA 并重新验证，不能以 PR 临时合并构建作为正式版本证据。

提交消息采用 Conventional Commits 1.0.0，格式为 type(scope)!: description。描述使用简短英文动词短语，正常小写，保留 API 和专名的正确拼写，末尾不加句号。type 支持 feat、fix、refactor、perf、docs、test、build、ci、style、chore 和 revert；style 仅用于排版，版本准备使用 chore(release): version packages。scope 采用稳定项目名或领域名，不强制枚举目录。

真正改变公开合同、数据或部署兼容性时使用 ! 和 BREAKING CHANGE footer，内部改名不自动构成 breaking change。提交类型不决定版本号。

PR 标题作为 Squash 标题，合并前整理最终说明，不拼接临时提交消息。commitlint 配合 conventional 规则检查 PR 标题，并在标题编辑后重新运行；主线检查最终提交消息。主线事后检查不能阻止界面中的手动改写，因此合并者仍须核对。中间迭代不逐条强制检查提交消息，也不设置 commit-msg hook。

<a id="hooks"></a>

## 本地 hooks

Husky 和 lint-staged 提供 pre-commit，只执行 Prettier check 与 ESLint，不使用 --write、--fix、git add 或 stage_fixed。修复格式后由用户自行暂存。lint-staged 负责文件列表、长参数和部分暂存内容的隐藏与恢复，必须验证失败时的恢复行为。

默认 hooks 限定为上述 pre-commit 检查，文件选择与命令参数由 lint-staged 管理。提交消息在 PR 与主线检查，版本、发行说明和 tag 由发行流程管理。

hooks 的安装入口只管理本项目的 hook 文件和仓库本地 core.hooksPath。没有显式配置时设置为本项目路径；本地已经使用本项目路径时，重复安装幂等完成。其他显式配置，包括空值或继承的设置，按冲突报告，由用户处理后重试，不保存或接管原配置。无关本地配置保持不变。

安装和卸载不得修改 --global、--system、用户 Husky 初始化文件、用户目录或 PATH。命令按仓库本地配置的实际作用范围执行；多个 worktree 共用该配置时，安装与卸载作用于整个仓库，并明确说明这一范围，不维护逐 worktree 的安装归属或引用计数。

卸载只移除仍指向本项目的本地 core.hooksPath。当前值已由用户改写时，保留新值并报告。之后只清理自身 hook 文件、脚本和依赖，不恢复第三方配置，也不删除 stash 等恢复资料。

CI、源码压缩包和未安装开发依赖的环境都要有明确、不会重复执行的行为。清理原 Lefthook 时，先识别实际 hook 和备份，只移除项目遗留内容，不强制重置全局设置。CLI 生成的 workspace 遵循相同原则，可以独立安装、提交和卸载 hooks，不引用 Kisaki 私有路径。
