# 仓库与源码布局

本文定义完整交付时的代码、资源和工具归属，以及同一程序内各文件的分工。目录随所属工作包建立；当前源码职责见[当前工程与开发](../../implementation/development.md#source)，完成度见[实施状态](../../implementation/status.md)。进程关系、依赖与运行寿命见[运行架构](../architecture.md)；工作区配置、公开包消费与任务入口见[工作区与工具链](workspace.md)。

<a id="workspace"></a>

## 仓库与工作区

kisaki 作为产品工程的统一仓库，顶层按客户端、官网和服务端职责组织。本轮交付范围限于桌面生态。clients/web 与 site 表达后续工程归属，server 表达未来服务端的候选归属。服务端是否公开及其许可另行明确，只有源码公开范围相容时才纳入同仓。后续工程在相应项目启动时建立。

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
│   │   │   ├── desktop-appearance/
│   │   │   ├── desktop-ui/
│   │   │   ├── desktop-rpc/
│   │   │   ├── desktop-contracts/
│   │   │   ├── desktop-localization/
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
│   ├── boundaries.ts
│   ├── host-environment.ts
│   └── hooks.ts
├── tests/
├── config/
│   └── typescript/
├── .github/workflows/
├── .husky/
├── artifacts/                       # Ignored verified delivery outputs
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.json
├── eslint.config.ts
├── .prettierrc.json
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── CONVENTIONS.md
├── ARCHITECTURE.md
├── AGENTS.md
└── refactor/                     # Design, implementation and acceptance
```

clients/desktop/app 作为名为 @kisaki3/desktop 的私有应用 workspace，使用统一 package.json 管理 main、preload、renderer、extension-host 和 shared 等程序源码。clients、desktop、packages 与 extensions 负责目录分类，registry 保存分发资料。图中的目录表达完整交付的归属，业务内部层次按实际协作需要展开；实施与能力状态由[状态页](../../implementation/status.md)记录。完整交付的工作区由桌面应用、八个公开包、33 个扩展项目和三个私有工程包组成，成员模式如下。对应模式和 manifest 随所属对象的完整实现建立：

```yaml
packages:
  - packages/*
  - clients/desktop/app
  - clients/desktop/packages/*
  - clients/desktop/extensions/projects/*
```

Node 与 TypeScript 工程共用根 pnpm workspace、pnpm-lock.yaml 和任务入口，分工见[工作区配置](workspace.md#workspace)。工作区只登记有实际实现的工程，未实施的能力由设计与工作包记录；其他语言继续使用自己的工具链和锁文件。工程测试载体归 tests/fixtures，构建工作流接收明确的输入，不把载体作为产品入口。

app/native 是应用内部的私有 Rust 与 Node-API 工程，不增加 pnpm workspace 成员或独立发行项。它拥有完整的 Node 消费入口，Node 源码纳入应用检查和 main 构建，Rust 构建由自身 manifest 与锁文件管理；内部布局、类型、加载和测试归属见[本体私有原生能力](native.md)。

各工程遵守[通用配置归属](conventions.md#configuration-layout)。仓库根目录保留实际默认入口，包括 tsconfig.json、eslint.config.ts、lint-staged.config.ts、commitlint.config.ts、.dependency-cruiser.json 和 vitest.config.ts。共享 TypeScript 与 ESLint 规则由 packages 中的对应私有包提供，各项目默认配置选择自身的环境与范围。

依赖检查读取根 tsconfig.json 的有效编译选项，模块入口由所属包的 imports 与 exports 解析。根工具、配置、测试的三个类型项目归根 config/typescript；消费者等测试变体配置归实际执行它的工程，由所属命令显式指定。

应用根目录保留实际默认入口：tsconfig.json 关联 config/typescript 中的环境项目，vitest.config.ts 负责常规 Node 测试，playwright.config.ts 选择需要真实 Electron 的窗口集成和端到端测试。四个程序的构建配置归 config/vite，由构建与开发工作流直接指定；其他测试配置按工具归 config/vitest 与 config/playwright。config 保存工具配置，tools 实现执行流程，tests 拥有用例与测试辅助。配置迁移同时维护相对路径、类型检查、开发监听和构建身份输入，不增加只有转发含义的根配置。

八个公共包各自在 config/typescript 保存库源码、工具及适用的构建配置类型项目，由各包根目录的 tsconfig.json 组织；同包 tsdown.config.ts 保留为实际构建入口。官方扩展的 kisx.config.ts 与 eslint.config.ts 使用扩展工程自身 tsconfig.json 的 Node 环境，运行源码按实际宿主划分，具体见[工作区类型配置](workspace.md#workspace)。作者模板和合成消费者采用相同归属规则；消费者样板的 Node、Webview 与 Solid 各自保留默认类型入口，工程工具类型配置归其 config/typescript。

根 package.json 为私有，只声明根工具和任务；运行包直接声明实际依赖。各工程保留自己的 UI 框架、运行环境和发行节奏。分类目录、工具 fixture 和普通配置文件不自动成为工作区包，成员布局遵守 [Turborepo 目录规则](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository#declaring-directories-for-packages)。

八个公共包均位于 clients/desktop/packages，desktop-appearance、desktop-ui 和 desktop-rpc 由实际桌面与扩展需求推动演进，同时保留纯视觉、组件与环境无关机制的边界。FontRef 仍由 desktop-contracts/fonts 拥有，桌面主题与资源选择仍由 desktop-contracts/appearance 组合。Web 与官网按自身目标设计界面，不因同仓而共用桌面样式或组件。

根 packages 只承载当前真实共享的私有工程能力：typescript-config、eslint-config 与 tooling，不预设跨客户端的产品公共包。真实共同能力出现后，依据相同含义、实际消费者和维护责任判断是否提取；不为保持目录形式而重复实现已经成立的共同机制。目录位置不改变公开包独立版本、许可、exports 和仓库外消费的责任。官方扩展使用与第三方相同的产品合同，不读取应用私有实现，也不随桌面预装。

工具按实际维护范围归属工程，内部目录、命令入口和工作流分工遵守[tools 结构](#tools)。工具源码、运行源码、测试样本与构建输出分别管理。

<a id="tools"></a>

## 工具目录与工作流

工程能力归维护它的项目。标准命令写在 `package.json`，任务顺序、输入输出和缓存交给任务配置。有需要编程维护的工作流才建立 `tools/`，例如消息生成、组装桌面资源或协调应用退出。面向用户或扩展作者交付的命令归对应产品的 `src/`。CI 调用项目入口，负责运行环境和交付。[Vite+ 任务](https://viteplus.dev/guide/run)

| 位置                      | 负责的工作                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| 根 tools                  | release 管理跨项目发行与元数据，hooks.ts 管理仓库 Git hooks，boundaries.ts 执行各工程范围的共同依赖规则，host-environment.ts 输出验证环境信息。 |
| packages/tooling          | 多个工程共用的所属输出清理、命令执行和 CLI 收尾函数，以及这些函数自己的测试。                           |
| clients/desktop/app/tools | 桌面开发会话、程序构建、资源准备、私有原生编译、打包与工程输出清理。                                |
| 公共包或扩展自身的 tools  | 本工程的准备、生成与工程输入输出校验；运行代码仍在其 src。                                          |
| extension-cli/src         | 面向扩展作者的正式 CLI 和程序化工作流，作为产品能力交付。                                           |
| 独立项目自身的 tools      | 该项目已有规范确定的构建和交付流程，本体通过正式制品消费。                                          |

单个文件可以完整表达的小工具直接放在 tools 下。需要多个文件协作的工作流使用 `tools/<工作流名>/`，内部按实际操作拆分；目录名称说明工作对象或目的，不按调用者、平台 CI 或脚本后缀另分一套流程。根工具按完整职责组织，文件随实际工作流建立：

```text
tools/
├── hooks.ts
├── boundaries.ts
├── host-environment.ts
└── release/
```

hooks.ts 管理本仓库 Git hooks 的安装与卸载，实际 hook 入口位于 .husky。其集成测试归根 tests/tools/hooks，使用隔离 Git 仓库验证配置冲突、重复安装、卸载和 worktree 行为。它与本体的运行事件或扩展 hook 无关。

host-environment.ts 输出验证进程的 Node 版本、系统、架构、CPU 与内存事实。仓库和桌面工作流调用同一入口，将结果保存到各自验证报告；输出字段由该文件统一维护。

各公共包通过自身 tests/consumers 验证公开制品，在仓库外的隔离工程中核对所属入口的声明、样式与 Node、Webview 或 Solid 消费。消费者样板以 `tests/consumers/fixtures/<宿主>/` 为固定位置。该包拥有消费合同、样板及断言，安装与清理采用共同的测试机制。各公共包的 tarball 输出归自身 out/package，公共打包与检查机制由私有 tooling 命令提供。包结构与类型制品检查直接复用 publint、Are the Types Wrong 等现成工具，执行关系见[测试任务](#test-tasks)。

公共包通过自己的 pack 任务交付 tarball，跨包消费者依赖实际使用的包任务，不维护另一份包收据清单。跨项目版本差、依赖、说明检查和正式发行元数据生成属于 release，遵守[发行合同](releases.md)，文件按实际协作需要组织。工程操作自身所需的输入校验、资源摘要核对和输出完整性检查归操作实现，不能依赖运行测试才能保证。测试通过正常、失败和边界场景验证这些行为；根工具不代替各项目自己的业务测试和构建。

cli.ts 处理参数、建立运行上下文、调用工作流并呈现结果与退出状态。工作流函数通过明确的参数和返回值提供复用，拥有执行次序、外部调用、文件写入及失败后的清理。其他工具与程序化入口复用这些函数，不通过运行 CLI 后解析终端文字取得结果，也不导入 cli.ts。测试按被测边界直接调用工作流，或实际执行 CLI 核对参数、输出与退出状态。工具模块导入不执行任务，可复用实现不调用 process.exit；CLI 在清理完成后设置退出状态。

工具模块随它描述的工作流维护。例如，构建清单归构建流程，打包和制品验证可直接消费这一清单。路径、目标和摘要等确实贯穿多个工程流程、在本项目内又没有单一流程拥有的能力，可放入 `tools/lib/`，并按具体用途命名。跨工程稳定共享的机制通过私有工程包的正式入口消费。[组织与命名](conventions.md#source-layout)

不同工程按公开入口协作，不借用另一项目的工具私有实现；生产运行代码不反向依赖 tools。测试可以调用被测工具的工作流或消费其产物，工程实现不导入测试用例、fixture 或 tests/support。仅供测试使用的准备与清理归测试拥有者；工具与运行代码确有共同机制时，归入能同时服务二者的正式模块，由工具消费。

packages/tooling/src 中的 output.ts 按项目归属清理可重建输出，process/ 执行命令并处理显式取消和进程收尾，cli.ts 在 CLI 调用期间安装信号处理并呈现退出状态。工具及其测试分别通过 `@kisaki3/tooling/output`、`@kisaki3/tooling/process`、`@kisaki3/tooling/cli` 引用，入口由包 exports 唯一定义。这些普通函数由实际工作流调用，不提供命令调度入口，不属于八个公共包，也不被生产运行代码消费。

输出范围与清理的验证归 packages/tooling/tests/output.test.ts，真实命令树的取消验证归同包 tests/process.test.ts，均使用隔离目录和子进程。桌面开发会话的交接与关闭验证归本体 tests/tools/dev。

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
│   ├── prepare-runtime.ts
│   └── dependencies.ts
├── build/
│   ├── cli.ts
│   ├── coordinator.ts
│   ├── manifest.ts
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
│   ├── distribution.ts
│   └── packager.ts
├── clean.ts
└── lib/
    ├── paths.ts
    ├── targets.ts
    └── sha256.ts
```

| 位置                             | 职责与调用关系                                                                                                                                                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev/session.ts | 拥有开发会话、准备工作和应用进程。程序编译与 renderer 使用 Vite 的公开能力，`prepare-runtime.ts` 为本次启动准备可独立读取的程序与资源。按[开发会话合同](workspace.md#desktop-development)处理取消退出与收尾。 |
| dev/electron-executable.ts       | 定位项目依赖中的开发 Electron 可执行文件，由开发流程和需要该宿主的测试复用。                                                                                                                                                                                                 |
| build/coordinator.ts | `buildDesktop` 负责一次完整桌面构建。它接入已准备的资源与原生绑定，给各程序传入同一个构建 ID，等待全部编译结束并汇总失败。编译成功且必需文件齐全时写出 `build.json`。 |
| build/manifest.ts | 定义 `build.json`，清点运行目录中的文件与摘要。构建方写出清单，打包方与测试按同一份清单核对输入。 |
| build/programs.ts                | 依据调用方指定源码根下 config/vite 中的 vite.config.*.ts 调用 Vite 公共 API，完成 main、preload、renderer 和 extension-host 的有限构建，返回实际模块输入。开发与正式构建采用同一份程序配置。                                                                                 |
| resources/prepare.ts             | 按固定输入准备图标、字体、Kana 资源、独立媒体包和数据库迁移资源，拥有对应资源目录的写入与校验；私有原生制品由 native 工作流负责。                                                                                                                                            |
| native/build.ts、declarations.ts | 编译目标绑定、生成与核对声明、准备所需原生资源，具体规则见[私有原生交付](native.md#delivery)。                                                                                                                                                                               |
| package/packager.ts              | 在所需构建就绪后调用 electron-builder 生成目标安装或归档文件，消费应用的 electron-builder.yml 与实际存在的打包专用输入；签名按已有环境与策略执行，不隐含公开发布。                                                                                                           |
| clean.ts                         | 只清理本工程声明的构建输出，核对实际目标与目录范围；缓存清理与开发资料重置保持独立操作。                                                                                                                                                                                     |
| lib | 提供跨工作流的工程路径、目标解析和 SHA-256 计算。 |

桌面的开发接入、build:fixture 和 package:fixture 分别由所属工作流执行，类型与测试任务直接调用所属运行器与配置；根 desktop:* 命令调度应用的相应任务。resources 与 native 的显式入口和内部调用复用同一工作流。不同目标、开发、构建与测试环境按[输出与清理规则](build.md#outputs)分离。

`DesktopTarget`、目标解析与 Rust triple 映射共同归 `lib/targets.ts`。构建清单归 `build/manifest.ts`，安装载体的分发元数据归 `package/distribution.ts`。部署后的运行资源路径由 main/app/paths 负责。

<a id="tests"></a>

## 测试目录与归属

本节规定 Kisaki monorepo 中本体、公共包、官方扩展与仓库工具的测试位置。独立项目继续采用各自已经确立的测试布局；Rust 测试遵守 Cargo 的发现规则。测试运行环境、隔离与完成条件由[验收要求](../../verification/acceptance.md#environments)定义，本节确定源码、样本和辅助代码的归属。

确定性模块的单元测试贴近源码，命名为 `*.test.ts` 或 `*.test.tsx`。涉及真实 I/O、宿主或工程工作流的用例进入所属工程的 `tests/`。按要验证的行为与独立交付的对象选择套件，运行器配置指定真正需要的环境。仅测试辅助与样板的文件使用普通文件名。

<a id="test-placement"></a>

### 辅助代码、样本与运行时资源

**默认就近，放在能够完整负责其行为和资源寿命的最小范围。** 一个用例的简短输入或辅助直接写在用例里。同一套件的准备、断言辅助或子进程入口随该套件放置，文件名说明操作或对象。同一套件可以包含多个文件，例如建库、迁移和崩溃恢复仍归同一数据库套件。

工程统一管理的测试宿主、资源准备或观测代码归 `tests/support/`，文件按具体职责命名。独立的项目级资源寿命足以确定归属，例如 Electron 的启动、profile 隔离与清理，即使当前只有一个套件接入也成立。只随某个场景变化的辅助继续放在该套件旁。

`fixtures/` 保存需按原样读取、安装或启动的固定输入，包括独立清单、源码和配置。单套件样本放 `tests/<套件>/fixtures/<样本>/`，跨套件的共同样本放 `tests/fixtures/<样本>/`。固定样本目录统一用复数 `fixtures/`，子目录说明实际对象，例如 `desktop-app/`。写入操作使用独立副本。Vitest 或 Playwright 的运行时 fixture 则是提供和释放资源的代码，定义在所属测试、套件模块或工程级 `support/`，由运行器按作用域管理。[Vitest 测试上下文](https://vitest.dev/guide/test-context) · [Playwright fixtures](https://playwright.dev/docs/test-fixtures)

### 用例归属

| 位置 | 验证边界与内容 |
| --- | --- |
| `src` 或 `tools` 中的就近单测 | 验证确定性的规则、解析、映射或状态变化。 |
| `tests/integration` | 验证真实组件的接入合同，例如数据库与原生驱动、窗口与沙箱 preload。运行器选择所需的 Node 或 Electron 宿主。 |
| `tests/browser` | 验证真实 DOM 中的组件行为、样式、焦点、表单和输入。 |
| `tests/e2e` | 从真实应用或宿主入口执行完整用户操作，观察最终可见或持久结果。 |
| `tests/consumers` | 从实际发布包在仓库外安装依赖，验证公开入口、声明、样式和所承诺的宿主。 |
| `tests/artifacts` | 验证最终桌面制品的生成结果、运行、资源、fuses，以及适用的安装与升级。 |
| `tests/performance` | 按[性能合同](performance.md)测量指定负载、响应时间和资源占用。 |
| `tests/tools` | 验证本工程维护工具的 CLI、工作流和真实副作用。 |
| 根 `tests/workspace` | 验证仓库负责的工作区约束，例如依赖边界和验证范围。 |

用例按主要验证目的归档。公开包消费、最终制品、性能、工程工具和仓库共同约束分别由 `consumers`、`artifacts`、`performance`、`tools` 和根 `workspace` 套件负责。其余场景按被测行为归 `integration`、`browser` 或 `e2e`。宿主和运行器在配置中声明，一项保证由所属套件验证。

只建立工程实际需要的目录。测试目录内部按能力、场景或工具组织，少量内聚用例保持单文件，多文件协作时再形成子目录；不要求与 src 的每一级路径机械镜像。组合验证归负责组合行为的工程：组件样式归 UI 包，作者生成与打包流程归 CLI，应用操作归本体。使用多个包本身不改变测试归属。根 tests 负责根工具和仓库共同约束。

根 `tests/tools` 验证仓库工具的 CLI 与文件副作用，`tests/workspace` 验证仓库共同约束。工作区成员或维护文件的读取只服务于这组检查时，辅助代码随 `tests/workspace/` 维护。下列目录按实际用例建立。

```text
tests/
├── tools/
│   ├── hooks/
│   └── release/
└── workspace/
```

本体测试按需要的环境与结果组织。`tests/integration/native` 验证绑定的 Node 消费合同，`tests/integration/electron` 验证真实窗口与进程边界，`tests/tools/native` 验证编译及制品准备。以下展示适用的测试位置。

```text
clients/desktop/app/tests/
├── integration/
│   ├── database/
│   ├── electron/
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

公共包按合同使用 `tests/integration`、`tests/browser`、`tests/consumers` 或 `tests/tools`。官方扩展将来源响应与格式样本放在验证它们的套件中，真实组件行为归 `tests/browser`。正式 `.kisx` 的完整安装和用户操作由宿主端到端用例验证。CLI 交付给作者的模板归 `src/templates`。

测试输入保持可复用，写入测试先在独立临时目录创建副本。数据库、profile、Git 仓库、构建输出、trace 和报告属于运行状态，不能写回 fixture 或使用个人资料。support 只提供测试机制，生产代码不导入它；业务断言保留在用例中，已有不变量由其拥有层验证，接入只补充自身新增的风险。

一个消费者样板工程表达一种实际承诺的宿主或依赖条件，如 Node、浏览器或 Solid。每个样板在 `tests/consumers/fixtures/<宿主>/` 保存独立的 `package.json`、类型配置和源码，同一工程可以服务多个用例。运行时临时安装、启动和清理由对应测试作用域管理。

各工程的测试配置显式选择目录、globals 和运行环境，测试类型不泄漏到运行源码。运行构建与声明生成排除测试源码，样本中的项目 manifest 不登记为 workspace 成员。目录命名不代替正确的运行环境，也不改变[验证覆盖要求](../../verification/acceptance.md#runtime-coverage)。

<a id="test-tasks"></a>

### 测试任务与执行

测试命令由所属工程的 package scripts 定义，直接启动现成运行器和选定配置。普通 test 的默认范围明确记录；test:consumers、test:e2e、test:artifacts 等任务按不同输入、环境和执行阶段分别配置，具体仓库命令见[任务入口](../../verification/acceptance.md#commands)。命令可以是薄脚本，不因此新增同名工具或跨运行器的统一调度程序。

消费者测试接收已经打包的公共包，最终制品测试接收已经完成打包与适用签名的目标文件。任务系统声明相应构建依赖、制品输入、运行环境、缓存条件与 CI 门槛；测试核对本次输入的路径、版本、构建身份及适用目标，缺失或不匹配时失败，不在用例中重建或替换待验证的产品制品。消费者自身的临时工程仍可按用例需要构建。

包结构、类型制品和平台文件检查直接采用已有检查工具，其结果与实际消费、运行用例分别记录并纳入对应任务的通过条件。项目脚本与任务配置负责组合调用，不重新实现这些检查，也不为命名统一把所有检查工具包装成测试用例。普通 check 汇总类型、lint、格式和常规测试，制品及其他需要特定环境的任务按阶段显式执行。

原生业务与数据库套件在运行器启动前选定开发 Electron 的 Node 宿主及匹配 ABI；环境变量和启动参数由该任务的脚本与配置提供。测试中的环境变量配置、fixture 或 setup 不能把已经启动的普通 Node 进程变为另一 ABI。构建和原生依赖准备复用已有工程任务；应用实例、临时资料和订阅的创建与释放由运行器 fixture 管理，测试启动模块按[就近归属规则](#test-placement)放置。

桌面开发测试的控制器与子进程入口同属 `tests/tools/dev/`，分别负责观测与运行被测会话。多个套件使用的 Electron 测试宿主可以位于 `tests/support/`。工程构建和打包交付实际制品，测试核对本次输入的身份与运行结果。

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
| rpc.ts       | 使用 desktop-rpc 装配宿主通信端点            |

安装、更新、兼容性、启停政策和宿主进程管理仍由 main/features/extensions 负责。宿主的 context 与 rpc 只完成实际环境的装配，不另写一套 SDK 上下文或消息内核。宿主按自身职责组织文件，不复制主进程的 app/features/infrastructure 分层。

shared/window-api 中的四个文件从 desktop-contracts 选择对应窗口合同，并维护纯静态开放清单；业务值直接引用原定义。shared/extension-host.ts 保存主进程与扩展宿主之间的私有控制协议。必要的协议值校验与编码随对应合同维护；业务计算、产品资源及连接、订阅、缓存、日志与运行状态归各自实际拥有者。

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

renderer/styles/base.css 保存根容器、通用文字表现、窗口拖拽区域等桌面界面的共同基础规则；styles/tailwind.css 接入应用自己的 Tailwind 4 构建配置与 desktop-appearance 映射。四个窗口分别由 entry.tsx 导入自己的 styles.css，组合共同基础、UI 包的成品 CSS 和窗口专属样式。每个窗口只编译本窗口与实际使用的共享组件，不扫描公共 UI 包源码，也不通过导入主窗口 CSS 获得共同样式。公共包的依赖与交付方式见[视觉基础与桌面资源](workspace.md#visual-packages)。

应用页面与业务组件的常规布局和状态样式使用 Tailwind，必要的专属 CSS 就近放在所属 feature、domain-ui 或呈现模块；公共 UI 包内部采用 [CSS Modules](../ui/package.md#styles)。阅读窗口的外壳与内容容器归 reader/app；reader/infrastructure/kana 按[阅读接入](integrations.md#reading)管理 Reader、转换技术设置并接续宿主资源。正文的固定页面、重排、书内样式和源映射由 Kana 拥有，共同界面样式只作用于窗口外壳。

renderer/infrastructure/appearance 为应用界面提供实际主题变量和字体，阅读接入再将所需颜色与字体转换为 Kana 输入。窗口 CSS 使用共同变量；主题变化通过正常外观接入和 Reader 设置采用生效，不重新编译工具类。
