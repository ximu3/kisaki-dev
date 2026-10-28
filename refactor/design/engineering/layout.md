# 仓库与源码布局

本文说明代码、资源和工具放在哪里，以及同一程序内各文件的分工。进程关系、依赖与运行寿命见[运行架构](../architecture.md)；工作区配置、公开包消费与任务入口见[工作区与工具链](workspace.md)。

<a id="workspace"></a>

## 仓库与工作区

kisaki 作为产品工程的统一仓库，顶层按客户端、官网和服务端职责组织。当前实施范围仍为桌面生态；clients/web 与 site 表达后续工程归属，server 表达未来服务端的候选归属。服务端是否公开及其许可另行明确，只有源码公开范围相容时才纳入同仓。未进入当前范围的工程不预建空实现，也不因目录已列出而计入当前交付。

```text
kisaki/
├── clients/
│   ├── desktop/
│   │   ├── app/
│   │   │   ├── src/
│   │   │   │   ├── main/
│   │   │   │   ├── preload/
│   │   │   │   ├── renderer/
│   │   │   │   ├── extension-host/
│   │   │   │   └── shared/
│   │   │   ├── native/
│   │   │   ├── assets/
│   │   │   ├── packaging/
│   │   │   ├── tools/
│   │   │   ├── tests/
│   │   │   ├── release-notes/
│   │   │   ├── config/
│   │   │   │   ├── typescript/
│   │   │   │   ├── vite/
│   │   │   │   ├── vitest/
│   │   │   │   └── playwright/
│   │   │   ├── electron-builder.yml
│   │   │   ├── drizzle.config.ts
│   │   │   ├── drizzle/
│   │   │   ├── tsconfig.json
│   │   │   ├── vitest.config.ts
│   │   │   ├── playwright.config.ts
│   │   │   └── package.json
│   │   ├── packages/
│   │   │   ├── appearance/
│   │   │   ├── ui/
│   │   │   ├── rpc/
│   │   │   ├── desktop-contracts/
│   │   │   ├── extension-api/
│   │   │   ├── extension-distribution/
│   │   │   ├── extension-sdk/
│   │   │   └── extension-cli/
│   │   └── extensions/
│   │       ├── projects/
│   │       │   └── <extension>/
│   │       └── registry/
│   └── web/
├── site/
├── server/
├── packages/
│   ├── typescript-config/
│   ├── eslint-config/
│   └── tooling/
├── tools/
│   ├── release/
│   └── hooks.ts
├── tests/
├── config/
│   ├── typescript/
│   └── vitest/
├── .github/workflows/
├── .husky/
├── artifacts/                       # Ignored verified delivery outputs
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.json
├── eslint.config.*
├── .prettierrc.*
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── CONVENTIONS.md
├── ARCHITECTURE.md
├── AGENTS.md
└── refactor/                     # Design, implementation and acceptance
```

clients/desktop/app 作为名为 @kisaki3/desktop 的私有应用 workspace，使用统一 package.json 管理 main、preload、renderer、extension-host 和 shared 等程序源码。clients、desktop、packages 与 extensions 负责目录分类，registry 保存分发资料。图中的目录表达完整交付时的归属。W00 可以建立已确认的程序、workspace、打包输入和分发资料边界，并以说明标明当前状态；业务内部层次按实际协作需要展开。目录骨架不表示对应业务或分发能力已经实现。工作区成员限定为实际桌面应用、八个公开包、33 个扩展项目和三个私有工程包：

```yaml
packages:
  - packages/*
  - clients/desktop/app
  - clients/desktop/packages/*
  - clients/desktop/extensions/projects/*
```

Node 与 TypeScript 工程共用根 pnpm workspace、pnpm-lock.yaml 和任务入口，分工见[工作区配置](workspace.md#workspace)。当前登记桌面交付成员；后续工程建立时优先加入同一工作区，其他语言继续使用自己的工具链和锁文件。

app/native 是应用内部的私有 Rust 与 Node-API 工程，不增加 pnpm workspace 成员或独立发行项。它拥有完整的 Node 消费入口，Node 源码纳入应用检查和 main 构建，Rust 构建由自身 manifest 与锁文件管理；内部布局、类型、加载和测试归属见[本体私有原生能力](native.md)。

各工程遵守[通用配置归属](conventions.md#configuration-layout)。仓库根目录保留实际默认入口，包括 tsconfig.json、eslint.config.ts、lint-staged.config.ts、commitlint.config.ts、.dependency-cruiser.json 和 vitest.config.ts。共享 TypeScript 与 ESLint 规则由 packages 中的对应私有包提供，各项目默认配置选择自身的环境与范围。依赖检查读取根 tsconfig.json 的有效编译选项，模块入口由所属包的 imports 与 exports 解析。工具、配置、测试三个类型项目归根 config/typescript；仓库外消费者测试配置归根 config/vitest，由所属命令显式指定。

应用根目录保留实际默认入口：tsconfig.json 关联 config/typescript 中的环境项目，vitest.config.ts 负责常规 Node 测试，playwright.config.ts 负责桌面端到端测试。四个程序的构建配置归 config/vite，由构建与开发工作流直接指定；其他测试配置按工具归 config/vitest 与 config/playwright。config 保存工具配置，tools 实现执行流程，tests 拥有用例与测试辅助。配置迁移同时维护相对路径、类型检查、开发监听和构建身份输入，不增加只有转发含义的根配置。

八个公共包各自在 config/typescript 保存库源码、工具及适用的构建配置类型项目，由根 tsconfig.json 组织，tsdown.config.ts 保留为实际构建入口。官方扩展当前的 kisx.config.ts 与 eslint.config.ts 共用根 tsconfig.json 的 Node 环境；实际运行源码建立后再按其宿主划分，具体见[工作区类型配置](workspace.md#workspace)。作者模板和合成消费者采用相同归属规则；消费者样板的 Node、Webview 与 Solid 各自保留默认类型入口，工程工具类型配置归其 config/typescript。

根 package.json 为私有，只声明根工具和任务；运行包直接声明实际依赖。各工程保留自己的 UI 框架、运行环境和发行节奏。分类目录、工具 fixture 和普通配置文件不自动成为工作区包，成员布局遵守 [Turborepo 目录规则](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository#declaring-directories-for-packages)。

八个公共包均位于 clients/desktop/packages，appearance、ui 和 rpc 由实际桌面与扩展需求推动演进，同时保留纯视觉、组件与环境无关机制的边界。FontRef 仍由 desktop-contracts/fonts 拥有，桌面主题与资源选择仍由 desktop-contracts/appearance 组合。Web 与官网按自身目标设计界面，不因同仓而共用桌面样式或组件。

根 packages 只承载当前真实共享的私有工程能力：typescript-config、eslint-config 与 tooling，不预设跨客户端的产品公共包。真实共同能力出现后，依据相同含义、实际消费者和维护责任判断是否提取；不为保持目录形式而重复实现已经成立的共同机制。目录位置不改变公开包独立版本、许可、exports 和仓库外消费的责任。官方扩展使用与第三方相同的产品合同，不读取应用私有实现，也不随桌面预装。

工具按实际维护范围归属工程，内部目录、命令入口和工作流分工遵守[tools 结构](#tools)。工具源码、运行源码、测试样本与构建输出分别管理。

<a id="tools"></a>

## 工具目录与工作流

tools 承载所属工程的独立维护能力，tests 拥有验证场景、断言和测试专用辅助。项目脚本、Turborepo 与 CI 负责命令入口、前置依赖、运行环境和执行阶段。工具按实际工作对象或完整工作流组织，不按测试套件或命令数量预设实现目录。工具的归属如下：

| 位置                      | 负责的工作                                                           |
| ------------------------- | -------------------------------------------------------------------- |
| 根 tools                  | 跨项目发行输入检查、版本说明与元数据，以及仓库 Git hooks。 |
| packages/tooling          | 多个工程共用的候选交接、命令执行和 CLI 收尾函数，以及这些函数自己的测试。 |
| clients/desktop/app/tools | 桌面开发会话、程序构建、资源准备、私有原生编译、打包与工程输出清理。 |
| 公共包或扩展自身的 tools  | 本工程的准备、生成与工程输入输出校验；运行代码仍在其 src。           |
| extension-cli/src         | 面向扩展作者的正式 CLI 和程序化工作流，作为产品能力交付。            |
| 独立项目自身的 tools      | 该项目已有规范确定的构建和交付流程，本体通过正式制品消费。           |

单个文件可以完整表达的小工具直接放在 tools 下。需要多个文件协作的工作流使用 `tools/<工作流名>/`，内部按实际操作拆分；目录名称说明工作对象或目的，不按调用者、平台 CI 或脚本后缀另分一套流程。根工具按已有职责组织：

```text
tools/
├── hooks.ts
└── release/
    └── package-inputs.ts
```

hooks.ts 管理本仓库 Git hooks 的安装与卸载，实际 hook 入口位于 .husky。其集成测试归根 tests/tools/hooks，使用隔离 Git 仓库验证配置冲突、重复安装、卸载和 worktree 行为。它与本体的运行事件或扩展 hook 无关。

桌面跨包制品消费归根 tests/desktop/consumers，测试任务使用已经打包的 tarball，在隔离消费者工程中核对公开入口、声明、CSS 以及 Node、框架无关 Webview 和 Solid Webview 作者路径。消费者工程的准备、安装和清理辅助归 tests/desktop/support，固定输入归 tests/desktop/fixtures；收据收集工具归 tools/desktop，输出归 artifacts/desktop/packages。包结构与类型制品检查直接复用 publint、Are the Types Wrong 等现成工具，执行关系见[测试任务](#test-tasks)。

当前 release/package-inputs.ts 汇集八个公共包已完成的 tarball，记录包身份、版本和文件摘要，供跨包消费与交付接续。版本差、依赖、说明检查和正式发行元数据生成由后续工作包沿[发行合同](releases.md)建立，按实际协作需要形成文件。工程操作自身所需的输入校验、资源摘要核对和输出完整性检查归操作实现，不能依赖运行测试才能保证。测试通过正常、失败和边界场景验证这些行为；根工具不代替各项目自己的业务测试和构建。

cli.ts 处理参数、建立运行上下文、调用工作流并呈现结果与退出状态。工作流函数通过明确的参数和返回值提供复用，拥有执行次序、外部调用、文件写入及失败后的清理。其他工具与程序化入口复用这些函数，不通过运行 CLI 后解析终端文字取得结果，也不导入 cli.ts。测试按被测边界直接调用工作流，或实际执行 CLI 核对参数、输出与退出状态。工具模块导入不执行任务，可复用实现不调用 process.exit；CLI 在清理完成后设置退出状态。

工具专用的辅助实现放在对应工作流内部；同一工程多个工具共同使用的内部支撑归该工程的 tools/lib，仅在确有共用实现时建立。lib 以具体职责命名模块，不提供命令入口，也不导入工作流或 CLI。跨工程稳定共享的函数由 packages/tooling 的正式入口提供。测试复用专用模块不改变其拥有者，目录归属遵守[通用规则](conventions.md#directory-readability)。

不同工程按公开入口协作，不借用另一项目的工具私有实现；生产运行代码不反向依赖 tools。测试可以调用被测工具的工作流或消费其产物，工程实现不导入测试用例、fixture 或 tests/support。仅供测试使用的准备与清理归测试拥有者；工具与运行代码确有共同机制时，归入能同时服务二者的正式模块，由工具消费。

packages/tooling/src 中的 output.ts 提供候选准备与成功交接，process.ts 执行命令并处理显式取消和进程收尾，cli.ts 在 CLI 调用期间安装信号处理并呈现退出状态。工具及其测试分别通过 `@kisaki3/tooling/output`、`@kisaki3/tooling/process`、`@kisaki3/tooling/cli` 引用，入口由包 exports 唯一定义。这些普通函数由实际工作流调用，不提供命令调度入口，不属于八个公共包，也不被生产运行代码消费。

候选失败、取消和文件替换的验证归 packages/tooling/tests/output.test.ts，真实命令树的取消验证归同包 tests/process.test.ts，均使用隔离目录和子进程。桌面开发会话的交接与关闭验证归本体 tests/tools/dev。

工具源码与配置遵守[源码语言](conventions.md#source-language)、[可读性](conventions.md#readability)和[注释覆盖](conventions.md#comments)。本地与 CI 通过相同项目脚本调用工程工作流、现成检查工具或测试运行器；脚本转交参数与退出状态，工程实现不另写在 YAML 或 shell 字符串中。工具测试遵守[测试结构](#tests)，不因工具是单文件或目录而改变测试的工程归属。

每项工具声明实际输入、输出、工作目录和清理范围。构建、验证和发布使用不同的明确操作，输出与缓存按工作区任务规则登记；分类目录不增加总 index.ts，工作流不为形式一致而建立空的 planner、manager 或 adapter。

<a id="desktop-tools"></a>

## 桌面应用工具

clients/desktop/app/tools 按桌面开发与交付的实际工作流组织。配置留在应用工程中，工具通过所选工具链的公开能力读取和执行，不维护第二套编译或测试框架。

```text
clients/desktop/app/tools/
├── dev/
│   ├── cli.ts
│   ├── session.ts
│   ├── inputs.ts
│   ├── renderer.ts
│   ├── electron-executable.ts
│   ├── generation.ts
│   └── dependencies.ts
├── build/
│   ├── cli.ts
│   ├── coordinator.ts
│   ├── identity.ts
│   └── programs.ts
├── resources/
│   ├── cli.ts
│   ├── prepare.ts
│   └── fonts.ts
├── native/
│   ├── cli.ts
│   ├── build.ts
│   ├── check.ts
│   └── declarations.ts
├── package/
│   ├── cli.ts
│   └── packager.ts
├── clean.ts
└── lib/
    ├── paths.ts
    ├── targets.ts
    ├── package-inputs.ts
    └── sha256.ts
```

| 位置                             | 职责与调用关系                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev/session.ts                   | 拥有完整开发会话与构建交接，通过 extension-cli/extension 启动真实应用；inputs 管理 Chokidar 输入监听，renderer 管理 Vite，generation 准备候选，dependencies 保存公共包快照。按[开发会话合同](workspace.md#tasks)处理取消退出与实际收尾。 |
| dev/electron-executable.ts       | 定位项目依赖中的开发 Electron 可执行文件，由开发流程和需要该宿主的测试复用。 |
| build/coordinator.ts             | 组织一次有限桌面构建，调用所属资源与原生准备工作，再编译应用程序并核对完整运行布局；只协调各拥有者，不另写一份资源或原生构建实现。                                                 |
| build/programs.ts                | 依据应用 config/vite 中的 vite.config.*.ts 调用 Vite 公共 API，完成 main、preload、renderer 和 extension-host 的有限构建，返回实际模块输入。开发与正式构建采用同一份程序配置。 |
| build/identity.ts                | 计算构建输入身份与完成输出的文件摘要，供有限构建、开发候选和打包共同消费。 |
| resources/prepare.ts             | 按固定输入准备图标、字体、Kana 资源、独立媒体包和数据库迁移资源，拥有对应资源目录的写入与校验；私有原生制品由 native 工作流负责。                                                    |
| native/build.ts、declarations.ts | 编译目标绑定、生成与核对声明、准备所需原生资源，具体规则见[私有原生交付](native.md#delivery)。                                                                                     |
| package/packager.ts              | 在所需构建就绪后调用 electron-builder 生成目标安装或归档文件，消费应用的 electron-builder.yml 与实际存在的打包专用输入；签名按已有环境与策略执行，不隐含公开发布。                        |
| clean.ts                         | 只清理本工程声明的构建输出，核对实际目标与目录范围；缓存清理与开发资料重置保持独立操作。                                                                                           |
| lib                             | 提供跨工作流共用的工程路径、目标解析、公共包输入与字节摘要；各工作流拥有自身操作与资源寿命。 |

桌面的 dev、build 和 package 命令分别进入对应 cli.ts，类型与测试任务直接调用所属运行器与配置；根 desktop:* 命令调度应用的相应任务。resources 与 native 的显式入口和内部调用复用同一工作流。不同目标、开发、构建与测试环境按[输出与清理规则](build.md#outputs)分离。

上述文件确定主要职责，私有辅助文件按实际协作需要拆分。共享的目标与路径解析归 lib/targets.ts 和 lib/paths.ts，不复制程序配置、项目依赖图或支持范围。工程命令与输出位置由工具解析，部署后的运行资源路径仍由 main/app/paths 负责。

<a id="tests"></a>

## 测试目录与归属

本节规定 Kisaki monorepo 中本体、公共包、官方扩展与仓库工具的测试位置。独立项目继续采用各自已经确立的测试布局；Rust 测试遵守 Cargo 的发现规则。测试运行环境、隔离与完成条件由[验收要求](../../verification/acceptance.md#environments)定义，本节确定源码、样本和辅助代码的归属。

可在普通 Node 中运行的纯逻辑单元测试贴近被测源码，使用 `*.test.ts`。需要真实 I/O、驱动、DOM、宿主或工程工作流的测试进入所属工程的 tests；代码是否写在一个文件中不改变这一判断。测试文件统一使用 `.test.ts`，需要 JSX 时使用 `.test.tsx`，由对应运行器明确选择，fixture 与辅助代码不自动作为用例收集。

| 位置                      | 验证边界与内容                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| src 或 tools 中的就近单测 | 确定性规则、解析、映射和不依赖真实环境的局部逻辑。                                                                                                                      |
| tests/integration         | 产品或库的真实技术接入，包括数据库、文件、通信和原生绑定；按实际依赖选择普通 Node 或开发 Electron 的 Node 模式。依赖 Electron app、BrowserWindow 等接口的用例进入 e2e。 |
| tests/browser             | 需要真实 DOM 的组件、响应式逻辑、焦点、样式和交互，使用规定的浏览器测试环境。                                                                                           |
| tests/e2e                 | 在真实开发应用或宿主中验证窗口、preload、进程、扩展接入和完整产品操作，桌面使用 Playwright 的 Electron 能力。                                                           |
| tests/consumers           | 从实际公开制品建立仓库外消费者，验证入口、类型、样式与运行接入。各包拥有自身合同用例，根工程只组织跨包组合。                                                            |
| tests/artifacts           | 最终打包应用的安装、启动、资源、fuses、更新和平台接入；保持正式制品原样，运行条件按实际目标记录。                                                                       |
| tests/performance         | 按[性能合同](performance.md)验证指定负载、预算和测量口径，使用被测行为所需的实际环境。                                                                                  |
| tests/tools               | 所属工程 tools 的 CLI、工作流和真实文件副作用测试，按工具名组织；不在 integration 中维护另一份相同用例。                                                                |
| tests/fixtures            | 测试拥有的固定输入、来源样本及消费者样板，按实际使用范围组织，保存来源、许可、合成范围与预期。                                                                          |
| tests/support             | 测试专用的环境准备、资料构造和清理辅助，按具体职责命名；不同运行环境的辅助代码明确分开。                                                                                |

测试按主要验证目的归档：制品消费、最终制品、性能和工程工具分别归 consumers、artifacts、performance 和 tools；其余按所需接入边界归 integration、browser 或 e2e。运行环境在配置中明确，同一场景不因符合多个分类而复制；例如浏览器性能测量归 performance，普通组件交互归 browser。

只建立工程实际需要的目录。测试目录内部按能力、场景或工具组织，少量内聚用例保持单文件，多文件协作时再形成子目录；不要求与 src 的每一级路径机械镜像。根 tests 只负责根工具与跨项目消费，不集中收纳各工程自己的业务测试。

根工程的测试结构如下。根工具的集成与 CLI 测试统一归 tests/tools，按工具名组织，不在各工具内部另建 tests。

```text
tests/
├── consumers/
│   ├── node/
│   ├── webview/
│   └── solid/
├── tools/
│   ├── hooks/
│   └── release/
├── fixtures/
└── support/
```

本体测试覆盖实际桌面环境，主要结构如下。integration/native 验证原生能力的 Node 消费合同，tools/native 验证编译与制品准备工作流，两者各自拥有用例。

```text
clients/desktop/app/tests/
├── integration/
│   ├── database/
│   ├── files/
│   └── native/
├── browser/
├── e2e/
├── artifacts/
├── performance/
├── tools/
│   ├── dev/
│   ├── build/
│   ├── resources/
│   ├── native/
│   └── package/
├── fixtures/
└── support/
```

公共包采用 tests/integration、tests/browser、tests/consumers、tests/tools、tests/fixtures 和 tests/support 中适用的部分。官方扩展的来源响应、输入格式和映射样本归自身 tests/fixtures，真实组件测试归 tests/browser；正式 .kisx 的宿主接入由本体 tests/e2e 的既有入口验证。CLI 的正式生成模板仍归其 src/templates，测试用的消费者样板与正式模板分别维护。

测试输入保持可复用，写入测试先在独立临时目录创建副本。数据库、profile、Git 仓库、构建输出、trace 和报告属于运行状态，不能写回 fixture 或使用个人资料。support 只提供测试机制，生产代码不导入它；业务断言保留在用例中，已有不变量由其拥有层验证，接入只补充自身新增的风险。

各工程的测试配置显式选择目录、globals 和运行环境，测试类型不泄漏到运行源码。运行构建与声明生成排除测试源码，样本中的项目 manifest 不登记为 workspace 成员。目录命名不代替正确的运行环境，也不改变[验证覆盖要求](../../verification/acceptance.md#runtime-coverage)。

<a id="test-tasks"></a>

### 测试任务与执行

测试命令由所属工程的 package scripts 定义，直接启动现成运行器和选定配置。普通 test 的默认范围明确记录；test:consumers、test:e2e、test:artifacts 等任务按不同输入、环境和执行阶段分别配置，具体仓库命令见[任务入口](../../verification/acceptance.md#commands)。命令可以是薄脚本，不因此新增同名工具或跨运行器的统一调度程序。

消费者测试接收已经打包的公共包，最终制品测试接收已经完成打包与适用签名的目标文件。任务系统声明相应构建依赖、制品输入、运行环境、缓存条件与 CI 门槛；测试核对本次输入的路径、版本、构建身份及适用目标，缺失或不匹配时失败，不在用例中重建或替换待验证的产品制品。消费者自身的临时工程仍可按用例需要构建。

包结构、类型制品和平台文件检查直接采用已有检查工具，其结果与实际消费、运行用例分别记录并纳入对应任务的通过条件。项目脚本与任务配置负责组合调用，不重新实现这些检查，也不为命名统一把所有检查工具包装成测试用例。普通 check 汇总类型、lint、格式和常规测试，制品及其他需要特定环境的任务按阶段显式执行。

原生业务与数据库套件在运行器启动前选定开发 Electron 的 Node 宿主及匹配 ABI；环境变量和启动参数由该任务的脚本与配置提供。测试中的环境变量配置、fixture 或 setup 不能把已经启动的普通 Node 进程变为另一 ABI。构建和原生依赖准备复用已有工程任务；应用实例、临时资料、订阅及清理由运行器 fixture 和 tests/support 管理，确需的测试专用启动辅助也归 tests/support。

根统一检查包含根工具及实际 workspace 的常规测试，各套件的执行范围与未执行部分分别报告。最终制品保留正式安全配置，通过适用的外部或现场方式验证；测试入口和用例不改变[运行覆盖与交付要求](../../verification/acceptance.md#runtime-coverage)。

<a id="program-layout"></a>

## 桥接、扩展宿主与私有合同

```text
clients/desktop/app/src/
├── main/
├── renderer/
├── preload/
│   ├── main.ts
│   ├── reader.ts
│   ├── player.ts
│   ├── game-panel.ts
│   └── bridge.ts
├── extension-host/
│   ├── entry.ts
│   ├── runtime.ts
│   ├── instance.ts
│   ├── loader.ts
│   ├── context.ts
│   └── rpc.ts
└── shared/
    ├── window-api/
    │   ├── main.ts
    │   ├── reader.ts
    │   ├── player.ts
    │   └── game-panel.ts
    └── extension-host.ts
```

preload 的四个入口分别选择所属窗口的最小能力，bridge.ts 负责共同桥接、连接和清理机制。主进程仍核对实际调用归属与开放范围。存在真实连接、转换和寿命管理时，窗口客户端放在 renderer/windows/<window>/infrastructure/api.ts；只有现成窗口能力需要接入时，由入口注入视图，不为一行别名另建客户端。业务视图不直接操作传输。入口足够小时保持单文件，真实协作逻辑增加后再按职责拆分。

| 扩展宿主文件 | 职责                                         |
| ------------ | -------------------------------------------- |
| entry.ts     | 建立宿主并接入程序退出                       |
| runtime.ts   | 管理已加载实例，协调激活、停止与宿主整体收尾 |
| instance.ts  | 管理单个扩展实例的生命周期及清理             |
| loader.ts    | 加载已经确定的扩展入口                       |
| context.ts   | 将 SDK 的上下文实现绑定到本次真实扩展实例    |
| rpc.ts       | 使用公共 rpc 内核装配宿主通信端点            |

安装、更新、兼容性、启停政策和宿主进程管理仍由 main/features/extensions 负责。宿主的 context 与 rpc 只完成实际环境的装配，不另写一套 SDK 上下文或消息内核。宿主按自身职责组织文件，不复制主进程的 app/features/infrastructure 分层。

shared/window-api 中的四个文件从 desktop-contracts 选择对应窗口合同，并维护纯静态开放清单；业务值直接引用原定义。shared/extension-host.ts 保存主进程与扩展宿主之间的私有控制协议。连接、订阅、缓存、日志与运行状态留在实际运行端；其他共享纯规则按明确含义放置，不以“被两处使用”作为进入 shared 的唯一理由。

<a id="main"></a>

## 主进程源码

app 装配并连接实际能力，features 实现产品行为，infrastructure 提供技术设施。[主进程架构](../architecture.md#main)规定依赖与调用范围；具体业务拆分由各功能文档定义。

```text
clients/desktop/app/src/main/
├── entry.ts
├── app/
│   ├── bootstrap.ts
│   ├── compose.ts
│   ├── lifecycle.ts
│   ├── bindings.ts
│   └── paths.ts
├── features/
│   ├── library/
│   │   ├── entries/
│   │   │   ├── query/
│   │   │   ├── create.ts
│   │   │   ├── update.ts
│   │   │   ├── personal.ts
│   │   │   ├── external-ids.ts
│   │   │   └── write.ts
│   │   ├── parts/
│   │   │   ├── anime/
│   │   │   ├── comic/
│   │   │   └── novel/
│   │   ├── relations/
│   │   │   ├── work-characters.ts
│   │   │   ├── person-works.ts
│   │   │   ├── organization-works.ts
│   │   │   └── work-relations.ts
│   │   ├── organizers/
│   │   │   ├── collections/
│   │   │   └── tags/
│   │   ├── records/
│   │   │   ├── completions/
│   │   │   ├── activities/
│   │   │   ├── notes/
│   │   │   └── annotations/
│   │   ├── holdings/
│   │   │   ├── game/
│   │   │   │   ├── directories.ts
│   │   │   │   ├── configuration.ts
│   │   │   │   └── backups/
│   │   │   ├── anime/
│   │   │   ├── comic/
│   │   │   └── novel/
│   │   ├── showcase/
│   │   ├── write-graph.ts
│   │   ├── merge.ts
│   │   ├── delete.ts
│   │   └── search.ts
│   ├── metadata/
│   │   ├── providers.ts
│   │   ├── field-processors.ts
│   │   ├── profiles/
│   │   ├── search.ts
│   │   └── fetch/
│   ├── ingest/
│   │   ├── add.ts
│   │   ├── update.ts
│   │   ├── matching.ts
│   │   ├── adoption.ts
│   │   └── graph.ts
│   ├── scanner/
│   │   ├── manager.ts
│   │   ├── configs.ts
│   │   ├── discovery.ts
│   │   ├── extract.ts
│   │   ├── recognizers.ts
│   │   ├── preview.ts
│   │   ├── scan.ts
│   │   ├── watch.ts
│   │   └── runs.ts
│   ├── sessions/
│   │   ├── registry.ts
│   │   ├── game/
│   │   ├── anime/
│   │   ├── comic/
│   │   └── novel/
│   ├── tasks/
│   ├── extensions/
│   │   ├── manager.ts
│   │   ├── repositories/
│   │   ├── packages/
│   │   ├── updates/
│   │   ├── runtime/
│   │   └── gateway/
│   ├── updates/
│   ├── appearance/
│   ├── fonts/
│   ├── search/
│   ├── ui/
│   ├── onboarding/
│   └── preferences/
└── infrastructure/
    ├── database/
    │   ├── schema/
    │   ├── codecs/
    │   ├── connection.ts
    │   └── initialize.ts
    ├── attachments/
    ├── files/
    ├── media/
    ├── processes/
    ├── events/
    ├── i18n/
    ├── images/
    ├── windows/
    ├── notifications/
    ├── network/
    ├── ipc/
    └── log/
```

<a id="renderer"></a>

## 窗口源码

各窗口维护自己的入口、宿主和状态，跨窗口使用的业务组件与技术机制分别放入对应共享区域。运行边界见[窗口程序](../architecture.md#renderer)。

```text
clients/desktop/app/src/renderer/
├── styles/
│   ├── base.css
│   └── tailwind.css
├── windows/
│   ├── main/
│   │   ├── index.html
│   │   ├── entry.tsx
│   │   ├── styles.css
│   │   ├── app/
│   │   │   ├── root.tsx
│   │   │   ├── routes.ts
│   │   │   └── navigation.ts
│   │   ├── features/
│   │   │   ├── library/
│   │   │   ├── metadata/
│   │   │   ├── ingest/
│   │   │   ├── scanner/
│   │   │   ├── statistics/
│   │   │   ├── tasks/
│   │   │   ├── extensions/
│   │   │   ├── appearance/
│   │   │   ├── fonts/
│   │   │   ├── preferences/
│   │   │   ├── onboarding/
│   │   │   ├── search/
│   │   │   └── updates/
│   │   ├── domain-ui/
│   │   │   ├── library/
│   │   │   │   ├── entry-summary/
│   │   │   │   ├── entry-picker/
│   │   │   │   ├── entry-fields/
│   │   │   │   ├── entry-details/
│   │   │   │   ├── entry-editor/
│   │   │   │   └── activity-summary/
│   │   │   ├── tasks/
│   │   │   └── extensions/
│   │   └── infrastructure/
│   │       └── api.ts
│   ├── reader/
│   │   ├── index.html
│   │   ├── entry.tsx
│   │   ├── styles.css
│   │   ├── app/
│   │   ├── navigation/
│   │   ├── annotations/
│   │   └── infrastructure/
│   │       └── kana/
│   ├── player/
│   │   ├── index.html
│   │   ├── entry.tsx
│   │   ├── styles.css
│   │   ├── app/
│   │   ├── playback/
│   │   ├── annotations/
│   │   └── infrastructure/
│   └── game-panel/
│       ├── index.html
│       ├── entry.tsx
│       ├── styles.css
│       ├── app/
│       ├── session/
│       ├── annotations/
│       └── infrastructure/
├── domain-ui/
│   └── annotations/
└── infrastructure/
    ├── query/
    ├── dialogs/
    ├── i18n/
    ├── appearance/
    └── log/
```

<a id="renderer-styles"></a>

## 窗口样式

renderer/styles/base.css 保存根容器、通用文字表现、窗口拖拽区域等桌面界面的共同基础规则；styles/tailwind.css 接入应用自己的 Tailwind 4 构建配置与 appearance 映射。四个窗口分别由 entry.tsx 导入自己的 styles.css，组合共同基础、UI 包的成品 CSS 和窗口专属样式。每个窗口只编译本窗口与实际使用的共享组件，不扫描公共 UI 包源码，也不通过导入主窗口 CSS 获得共同样式。公共包的依赖与交付方式见[视觉基础与桌面资源](workspace.md#visual-packages)。

常规布局和状态样式在组件中使用 Tailwind，必要的专属 CSS 就近放在所属 feature、domain-ui 或呈现模块。阅读窗口的外壳与内容容器归 reader/app；reader/infrastructure/kana 按[阅读接入](integrations.md#reading)管理 Reader、转换技术设置并接续宿主资源。正文的固定页面、重排、书内样式和源映射由 Kana 拥有，共同界面样式只作用于窗口外壳。

renderer/infrastructure/appearance 为应用界面提供实际主题变量和字体，阅读接入再将所需颜色与字体转换为 Kana 输入。窗口 CSS 使用共同变量；主题变化通过正常外观接入和 Reader 设置采用生效，不重新编译工具类。
