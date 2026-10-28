# 脚本命名、作用域与扩展边界审查

审查基线为 `d949e3629ea6e72514c4fe04e4ab1370a5a88918`，即 PR #5 合并后的 main。用户要求核对所有 package.json 中脚本的实际用途、命名和前缀顺序，并检查项目中同类扩展边界问题。本页记录已确认的事实和建议，尚未修改命令、正式命名规则或运行流程。

## 范围与结论

共读取 49 份跟踪中的 package.json：根工程加 45 个 workspace 成员共 46 份当前清单，包含 164 个脚本条目；另外三份为历史验证输入。当前脚本分别为根 27 项、桌面应用 16 项、八个公共包 50 项、33 个官方扩展 66 项、三个私有工程包五项。另核对消费者试件动态生成的三个脚本。

审查覆盖脚本实现与调用、五份 CI、Turbo 输入和依赖、打包／消费者、共享工程包、类型与依赖守卫、工作区登记，以及当前工程规范。没有逐个执行会改写源码、清理输出或安装 hooks 的命令，也没有把本次静态盘点当作新的完整产品验收。Web、官网和服务端尚无当前实现，其接入问题分别标记为扩展风险，不声称这些产品已经发生功能故障。

没有发现可以仅凭缺少仓库调用就删除的当前脚本：它们均对应实际工具、CI／组合入口或有文档依据的手动用途，78 个显式工具／配置文件引用均存在。但用途存在不表示命名和作用域准确。本次发现两项直接的调用／选择问题，以及若干隐藏的桌面限定和输入范围过宽问题。完整明细见[脚本清单](scripts.md)与[机器可读清单](inventory.json)。

## 已确认的问题

### 1. 消费者的选择范围与执行范围不一致

[仓库工作流](../../../../../.github/workflows/verification-repository.yml)只要看到任意工程的 test:consumers 就选择消费者验证；执行时却调用根 test:consumers，后者固定筛选 clients/desktop/packages 下的八包。[收集工具](../../../../../tools/release/package-inputs.ts)还明确要求数量为八。

以一个符合命名规则的其他域任务 `@kisaki3/web-fixture#test:consumers` 作为合成输入，实际消费者判定段输出 consumers=true，后续命令仍指向桌面八包。该探针只验证路由条件，没有建立 Web 产品或执行未来工程。原始输入、判定与执行命令见 [scope-probes.json](scope-probes.json)。

这是上一轮把选择条件泛化、却没有同步执行范围留下的遗漏。新增另一个域的同名任务后，当前组合可能验证了错误的集合，不能仅以已有桌面 CI 通过推断其他域也已得到验证。

建议先明确消费者组的拥有者，让触发条件、命令、输入收据和报告表示同一集合。若当前保持桌面八包，应明确 desktop 范围；通用包级检查则必须真正调度所有被选中的对应任务，而不是转去固定桌面命令。

### 2. 通用名称实际承载桌面八包的专用流程

以下对象共同限定在桌面生态，却没有在根入口或位置上表达该范围：

- 根 packages:pack、test:consumers、test:consumers:run。
- tools/release/package-inputs.ts 及 collectPackageInputs；筛选桌面目录、固定八包。
- tests/consumers、tests/support/consumer.ts 与其消费者配置／试件；固定八包及桌面扩展作者的 Node、Webview、Solid 路径。
- artifacts/packages/inputs.json 与 KISAKI_PACKAGE_INPUTS，容易被误读为任意域都可共用的唯一输入集合。

建议当前以桌面消费者组明确命名、目录和输出空间，例如 desktop:packages:pack、artifacts/desktop/packages。根工程可以继续拥有跨包集成工具，但其中的桌面专用部分应可辨认。通用收集机制与桌面包集合的策略也需分清，不宜直接删除八包约束、扩大输入后仍运行固定的桌面消费者。

这些问题需要一起处理；只改一个脚本键，不能解决收据覆盖、错误路由和根目录中隐藏的桌面假设。

### 3. 八包 README 的 pack 调用不准确

八份公共包 README 都写 pnpm pack 会生成 out/package.tgz，但同名内置命令优先于脚本。锁定 pnpm 11.11.0 的隔离实测得到：

| 调用          | 实际输出                          |
| ------------- | --------------------------------- |
| pnpm pack     | 当前目录的 `<name>-<version>.tgz` |
| pnpm run pack | 脚本指定的 out/package.tgz        |

记录见 [pack-command-probe.json](pack-command-probe.json)。这里应保留工具的原生命令语义，明确区分内置 pack 与包脚本；推荐修正文档为 pnpm run pack，而不是额外增加打包包装器。包脚本的构建前置仍由 Turbo 依赖或显式准备步骤承担。

### 4. 包级 test:consumers 混合了不同验证层次

八包本地的 test:consumers 实际执行 publint 与 Are the Types Wrong，检查已打包文件的结构、入口与类型解析；真正的跨包 Node／浏览器运行发生在根消费者套件。名称容易让人把这两层当成相同范围。

建议包级入口使用 check:package 等直接表达产物检查的名称，真实消费者入口保留 test:consumers，并带上所属域／组。CSS 入口排除与 esm-only 适用范围来自实际包类型，本次没有把这些有依据的差异当作问题。

### 5. 验证与缓存输入仍存在不必要的全局传播

[真实 Git 比较、Turbo 查询与原始选择脚本](scope-probes.json)给出以下结果：

| 单文件变化                                         | 当前选择                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| pr-title.yml 的注释                                | complete=true，全部六目标及全部桌面套件                                      |
| desktop-contracts 的测试类型配置，仅增加 JSON 空白 | 六目标的窗口、开发、性能、制品检查                                           |
| desktop-contracts 的普通测试文件                   | 不选择桌面验收，但 lint 查询包含 39 个 lint 任务、八个构建前置和依赖边界检查 |

最后一行是任务选择与前置计划，不等于这些构建都实际执行；缓存仍需按对应输入判断。当前 ESLint 使用非类型检查的 recommended 配置，不能把它误认为必须读取所有上游编译声明的 lint。

相关原因包括：根 turbo.json 将所有 workflow 文件设为全局依赖；生产构建输入没有排除新加入的测试类型配置；lint 的 transit 和根任务默认输入扩大了失效范围。项目增加后，这些传播会放大，与按工程隔离工作流的目标不完全一致。

另外，桌面私有 publicPackageBuildInputs 会选择公共包所有根级 TS 文件和 config 目录，包含 Vitest 配置与测试类型配置；构建身份和开发监听据此读取这些内容，而公共包的 Turbo build 已排除部分测试配置。应核对实际输入边界，不能把测试文件已迁回所属包等同于相关测试配置也已脱离产品构建／监听。没有据此声称每次都会重启应用。

建议区分编排本身的验证、生产构建输入和测试输入。共享工具链变化仍需完整验证，域内或标题工作流变化应验证受影响流程；不能通过忽略 CI 修改或删减实际断言来节省时间。

### 6. 通用检查的发现与约束仍绑定当前桌面布局

- 根 check:boundaries 只扫描 clients、packages、tools；未来 site 或 server 不在此扫描范围。
- runtime-does-not-import-engineering 名称通用，规则目前只匹配 clients/desktop；同时把根 packages 整体视作工程实现。
- workspace.test.ts 的成员发现固定为桌面应用、桌面公共包、桌面扩展和根 packages；源码枚举也没有 site／server。
- 类型覆盖检查依赖 typecheck:root 名称及 tsc 命令文本正则；未来其他实际类型检查工具需要改这段推断。
- 发布边界测试把非桌面公共包一律视为 private／AGPL。它目前约束的是现有成员，不应被当成未确认工程的默认许可决策。

当前新增 pnpm 成员会使成员一致性检查失败，因此不是所有新项目都会悄悄漏过。问题是新增工程要同步多个隐含清单，而且部分检查自称覆盖所有源码，实际范围更窄。

建议以真实工作区成员和根工程拥有的文件确定通用扫描范围，工程特有规则留在明确作用域；保留独立的漏登记核对。不要用“从 pnpm 读出清单，再和同一清单比较”的方式把检查变成恒真，也不为尚未出现的框架建立配置注册系统。

### 7. CI 接入约定还需补齐

根 Required checks 对仓库结果与 DESKTOP_* 状态分别写了判断。当前能正确拒绝失败和错误跳过，但新增可选择的工程时还要复制相应变量与分支。建议为这类工程统一选择／完成的结果合同，根汇总使用同一判定规则；GitHub 要求显式声明调用和 needs，这个原生接入点保留。

缓存键使用 github.job 区分职责。现有 repository 与 desktop 的 ID 不同，当前隔离有效；不同工作流的 job ID 只在各自文件中唯一，未来两个工程都使用 build 或 checks 时，不能依赖它们碰巧不重名。应明确工程级缓存命名空间。这里的风险是缓存写入竞争与命中成本，不是已经发生的验证结果错误。

## 命名建议与取舍

工具没有规定业务域必须在前或在后。Turborepo 的根任务示例使用 lint:root；pnpm 支持任意脚本名，只有内置命令与生命周期规则具有工具语义。因此以下是基于本项目目标提出的一致性建议，而不是上游强制标准。

建议根定向入口先写实际范围，再写任务：`<工程／工程组>:<动作>[:限定方式]`。多个客户端和服务端共存时，应先看出命令会影响谁，尤其是打包、清理和验收入口；同类操作已有原生过滤和聚合能力，不必依赖动作前缀做批量匹配。真正聚合全部 workspace 同类任务的 build、typecheck、lint、test、check、clean 保持全局名称。工程内部已有 package.json 作为上下文，保留 build、pack、test 等本地动作名称，不重复添加 desktop 或包名。

| 当前名称                               | 建议                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------- |
| packages:pack                          | desktop:packages:pack                                                       |
| 根 test:consumers                      | desktop:packages:test:consumers                                             |
| 根 test:consumers:run                  | 明确为只消费已准备输入的阶段，例如 desktop:packages:test:consumers:prepared |
| typecheck:root / lint:root / test:root | root:typecheck / root:lint / root:test                                      |
| 包级 test:consumers                    | check:package                                                               |
| 应用 native:build / native:check       | 若统一工程内动作在前，使用 build:native / check:native                      |
| 应用 resources:prepare                 | 同一约定下使用 prepare:resources                                            |
| hooks:install / hooks:uninstall        | 同一约定下使用 install:hooks / uninstall:hooks                              |
| 生成消费者中的 node                    | test:node 更能表达用途；现有显式 run 调用本身正确                           |

内部 prepared 入口是否继续作为脚本，取决于它承担的任务输入登记与独立调试用途；不为减少一个名字而添加新的 workspace 或通用调度器。根只提供常用的域／组流程，其余定向调用可以使用 pnpm／Turbo 原生过滤，不为每个包复制一批根别名。

相反的“动作在前、范围在后”也可行，便于按动作阅读。这里推荐范围在前，是因为根已有 desktop:* 且还要容纳其他工程；本地任务保持工具惯例，全仓聚合入口已有 build／test 等名称，通常无需再靠命名前缀批量执行同类任务。

需要同步修改的是真实调用、Turbo 根任务注册、查询、CI、工具、测试、文档与输出路径。历史证据保留当时名称。公开 npm 包名与 exports 是另一层合同，不因源码位于 desktop 下就机械改名。

## 可以保留的设计

- 全仓聚合命令按实际 workspace 和任务图调度，当前只有桌面产品不使这些命令变成桌面专用入口。
- pnpm-workspace.yaml 只登记真实工程；未来工程加入时登记是正常接入，不需要预建空源码和脚本。
- 私有 TypeScript 配置包是 JSON 入口，没有空 build／test；33 个扩展当前只为已有配置提供 typecheck／lint，没有伪装业务构建。
- lint:fix、format、clean 和 hooks 是明确的手动操作；没有 CI 调用不等于无用途。写入修复没有通过普通 Turbo lint 的缓存重放。
- 根桌面源测试入口准备必要构建，制品测试消费已有制品；后者不应为了表面统一而重新打包待验证文件。
- desktop:dev 的 CLI 当前没有自定义参数，不能仅凭末尾没有 -- 就认定参数转发错误。
- Node、浏览器、Electron Node 模式与实际 Electron 的测试边界有真实依据；测试命名和命令层次不能抹平这些差异。
- 共享工程函数接受项目路径、命令和取消等参数，没有把桌面常量塞入通用执行／输出机制；环境配置由消费者选择，未来框架不必继承 Solid。

## 建议实施顺序

1. 先确认根作用域和本地动作的命名约定，明确桌面消费者组及其执行归属。
2. 一起修复命令、选择条件、工具／试件／输出命名空间，以及 pack 文档调用。
3. 收敛测试配置、workflow 与 lint 的输入传播，验证实际选择，而不是只核对字符串。
4. 整理工程发现、边界规则与 CI 结果／缓存接入约定，保持工具原生能力和明确的新增工程流程。

桌面消费者可以继续在共同参考环境执行，但必须明确其作用域；也可以归入桌面工作流的 Linux 参考任务，与浏览器检查共用现有目标。推荐后者：根仓库工作流保留各项目通用的类型、lint 和普通测试，桌面八包的产物／组合消费者验收由桌面交付域拥有，可复用已有参考任务，不必每包增加一份 workflow。仅消费者变化时不应因此启动六目标应用验收。前者改动较小；该取舍会影响 CI 的职责和选择逻辑，应在修订正式合同前讨论确定。

本轮只提交审查记录与状态更新，没有改动运行脚本、任务规则、CI 或公共接口，也未触发新的远端 CI。执行了两个最小打包命令、四组本地真实 Git／Turbo 范围比较和一个合成跨域消费者判定；没有重跑完整桌面验收。

## 来源

- [pnpm run](https://pnpm.io/cli/run)：脚本名、内置命令优先级和参数转交；页面已含较新版本内容，本轮以本地锁定 11.11.0 的实测核对涉及的行为。
- [pnpm pack](https://pnpm.io/cli/pack)：原生 tarball 输出与 out 选项。
- [Turborepo 根任务与依赖配置](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)：任务、根任务和输入传播的工具语义。
- [pnpm 自身脚本](https://github.com/pnpm/pnpm/blob/main/package.json)与 [Vite monorepo 脚本](https://github.com/vitejs/vite/blob/main/package.json)：命名实践存在不同取舍，不作为唯一规范照搬。
