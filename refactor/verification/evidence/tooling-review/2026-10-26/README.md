# 脚本、依赖与工具原生能力专项审查

日期：2026-10-26。环境：Windows x64，开发 Node 24.11.1、pnpm 11.11.0、Electron 44.5.1（内置 Node 24.21.0）、Vite 8.3.3、Vitest 5.0.5、dependency-cruiser 18.7.0。

## 范围与状态

读取并比较根工程及 45 个 workspace 项目的 package.json、catalog、Turbo 任务、Vite／Vitest 配置和全部 30 条依赖边界规则，结合源码导入、脚本入口、资产输入和上游 peer 声明核对实际用途。这里的全量清单审查不表示执行了每个脚本；实际运行范围见下文。前次 pnpm check 通过的记录仍有效，但不能据此认定现有检查能够发现所有违反合同的依赖。

用户进一步明确：社区查证应从功能与需求寻找同类问题、不同方案和取舍，再核对可采用版本，而非局限于已选技术栈。此要求已同步到根 AGENTS.md、CONVENTIONS.md 和设计准则。本页保留审查时的发现与建议；后续已经确认并完成[实施与本机回归](implementation/README.md)，当前结果以实施记录为准。

## 修正前的审查发现

| 位置                                | 发现与影响                                                                                                       | 建议                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| .dependency-cruiser.json 的 exclude | /dist/、嵌套 /node_modules/ 和 .test.ts 被从图中完全移除，相关依赖边界失去检查对象。三个违规样例全部漏报。       | 用 doNotFollow 保留直接依赖边，同时停止深入第三方或构建输出；按实际目的限制起始扫描与排除范围。                      |
| main、extension-host 的 Vite 配置   | target: node24 只约束生成语法；当前库模式仍采用浏览器解析条件。真实构建条件导出夹具时，两者均选择 browser 分支。 | 使用适合 Node 宿主的构建及解析语义，另行核对外部依赖和打包布局；不能只修改 target。                                  |
| 应用 test:native 脚本               | 应用已声明 Vitest，却跨三级目录取根工程的 CLI，额外依赖仓库深度及根包安装。                                      | 直接使用应用自己的 node_modules/vitest/vitest.mjs。该入口已在 Electron Node 模式通过八项现有原生测试。               |
| 依赖声明的用途核对                  | 八个公共包暂未直接使用 Vitest，应用声明的 Tailwind 工具暂未接入；这些静态现象不足以证明没有工程用途。            | 按用户要求保留工程需要的依赖；核对构建、测试、类型、配置、资产与 peer 用途后，再判断是否确实冗余。                   |
| catalog 与排列                      | 根包把已进入 catalog 的 @types/node、tsx、typescript、vite、vitest 另外写死；脚本及依赖的排列也未保持稳定原则。  | 共同版本消费同一 catalog；依赖块按包名排序，脚本按开发、构建、验证和维护组织。不要排序具有匹配优先级的条件 exports。 |

依赖检查中的 .test.tsx? 与 .cache 正则还省略了字面点的转义，应精确表达预期文件名。现有 no-unresolved 也不等于依赖声明检查：能从祖先 node_modules 找到的包仍可能未在使用者 manifest 声明。上游提供 npm-no-pkg／npm-unknown 规则，可按本仓库实际入口启用；运行代码依赖 devDependency 的判断须保留 Electron 宿主等有理由的例外。

### 边界检查反例

使用当前规则及 pnpm 风格链接，在隔离目录分别构造：appearance 通过正式包名导入 ui 的构建入口、renderer 导入 Electron、main 导入测试文件。当前配置均返回零违规且移除了相应依赖边。只在隔离副本保留这些边后，现有 appearance-dependency-direction、renderer-cannot-load-electron-or-native 和 runtime-does-not-import-engineering 规则分别报告违规。未修改产品配置，未把反例加入正式源码。结果摘要见 [probe-results.json](probe-results.json)。

上游明确区分 [exclude 与 doNotFollow](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/doc/options-reference.md#filters)，其 [recommended 配置](https://github.com/sverweij/dependency-cruiser/blob/v18.7.0/configs/recommended.cjs)保留依赖边并停止跟随。已有边界测试主要覆盖源码间导入，未覆盖上述被排除的目标，因此测试通过没有暴露这个缺口。

## 从需求比较工具与接入方式

### Electron 原生模块测试

需求是验证实际交付的 SQLite／Node-API 二进制在 Electron 的 Node 宿主内能加载和工作。ELECTRON_RUN_AS_NODE 是 [Electron 公开能力](https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node)，Vitest 的 package.json 将 vitest.mjs 声明为 bin；调用第三方发行的 .mjs 不违反自维护源码采用 TypeScript 的规则。

同类需求已有 [Vitest 社区讨论](https://github.com/vitest-dev/vitest/discussions/2142)，但旧讨论不能替代当前运行验证。本次使用应用本地入口执行两份现有测试文件，八项通过，包括 SQLite 提交／回滚／重开和原生文件操作。这里的 forks 使用独立子进程，与 [Vitest 对原生模块测试的建议](https://vitest.dev/config/pool#forks)一致。

如果目标是 Electron 主进程 API 或真实窗口，可使用专用 Electron 测试运行器，如 [electron-mocha](https://github.com/jprichardson/electron-mocha)，或真实应用自动化；Electron 本身也有 [由 Vitest 调度真实 spec 应用的方案](https://github.com/electron/electron/blob/main/docs/development/testing.md)。这些需求与单纯验证原生模块不同。本仓库已有 Playwright 真实 Electron 测试，因此保留当前分工比再引入一套 Mocha 测试栈更合适。开发宿主测试不代替正式 fuses 下的制品验收。

进一步核对宿主配置后，确认 Vitest 5.0.5 的内置配置没有 execPath 选项。environment 选择测试环境，execArgv 传递运行参数，env 提供环境变量，均不替换可执行文件；内置 forks 直接调用 child_process.fork，没有传入 execPath，因而使用启动 Vitest 的进程所用可执行文件。社区已有[完全对应的 Electron execPath 请求](https://github.com/vitest-dev/vitest/issues/9238#issuecomment-3684471729)，维护者于 2025-12-22 答复不支持，该请求以 not_planned 关闭。此结论同时由当前安装版本的公开类型和实现核对，不仅依据旧回复。

Vitest 提供[自定义 pool 扩展点](https://vitest.dev/guide/advanced/pool)，可以让普通 Node 中的 Vitest 调度 Electron worker；但官方将它标为低层、实验性 API，需要实现 worker 的启动、通信和停止。Electron 自身的[专用 pool](https://github.com/electron/electron/blob/main/spec/vitest/electron-pool.ts)用于真实 Electron 主进程测试，包含对应的进程和 IPC 生命周期。这是可行替代方案，不能表述成“只能直接运行 vitest.mjs”；对于现有 SQLite／Node-API 测试，继续由 Electron Node 模式启动 Vitest 更简单。也可通过 vitest/node 的程序化 API 编写启动器，但仅为缩短脚本文本而增加自维护入口没有明显收益。

[Vitest 的 VS Code 插件](https://github.com/vitest-dev/vscode#configuration)另有 nodeExecutable 与 nodeEnv 设置，作用于编辑器启动测试的方式，不是 vitest.config.ts 的选项，也不会改变命令行或 CI 的宿主选择。没有引入自定义 pool、修改全局 process.execPath 或更改现有配置。本次复用前述八项原生测试的有效运行证据。

建议的应用脚本：

```json
{
  "test:native": "cross-env ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run --config config/vitest/vitest.config.native.ts"
}
```

### Vite 的解析与 Node 构建

后续按功能需求补充了 [Vite 原生能力与社区方案比较](vite-options.md)：现有 SSR 构建和 Environment API 都能正确选择 Node 入口，单独设置 platform: node 仍不够。SSR 候选还通过了当前 main／extension-host 源码的内存构建。electron-vite 与支持自定义目标的 vite-plugin-electron/multi-env 均列入比较，未因旧工具印象排除候选，也未直接迁移默认启动和退出流程。

现有实现已经使用 Vite 的 build、createServer、监听、HMR 和编译输出信息；需要修正的是重复解析及宿主配置。对于公共依赖快照，现有插件可以把当前快照的实际 package.json 作为解析上下文，通过公开的 this.resolve 委托 Vite。此前在实际 renderer 配置下，三个公共依赖的九个导出与现有结果一致，浏览器／开发条件、CSS 子入口、禁止导出和快照切换均通过。社区插件也采用 [委托 Vite 解析的做法](https://github.com/aleclarson/vite-tsconfig-paths/blob/v5.1.4/src/index.ts#L177)。正式迁移还需保持完整构建后交接、失败保留旧结果和页面重载行为。

针对主进程构建，社区的 [electron-vite 实现](https://github.com/alex8088/electron-vite/blob/master/src/plugins/electron.ts)除了选择 Node 编译目标，还启用服务端构建、处理外部依赖，并设置 noExternal。它证明了应分别处理宿主语义与编译目标；其完整预设不应未经比较直接复制，也不意味着本仓库必须引入 electron-vite。Vite 的 [服务端解析条件](https://vite.dev/config/ssr-options#ssr-resolve-conditions)与客户端默认值不同。

### 依赖图检查的选型与归属

本仓库需要检查完整依赖图上的循环、跨包方向、私有入口和进程边界。dependency-cruiser 与这些需求匹配；当前缺陷出在过滤配置，而非必须换工具。[ESLint 内置导入限制](https://eslint.org/docs/latest/rules/no-restricted-imports)适合局部的导入声明限制；[eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries/blob/master/packages/website/docs/guides/monorepo-setup.md)可作为边界规则的另一种实现，但迁移同样需要解析与边界配置，不能自动消除现有漏报。当前不建议为统一工具名称而迁移或同时维护两套同义规则。

全仓图的执行入口、依赖和共同边界配置放在根工程合理。当前 .dependency-cruiser.json 是工具支持的入口形式，三十条规则不必机械拆成每包一份。若日后出现独立维护的规则集合，可用工具原生 extends 组织；拆文件本身不能修复漏失的依赖边。

### manifest 的职责与呈现

保留各项目声明实际依赖、根包拥有仓库级工具、catalog 管理共同版本的总体结构，符合 [Turborepo 的依赖归属建议](https://turborepo.dev/docs/crafting-your-repository/managing-dependencies)。公开声明引用的类型依赖、Solid peer、资源准备所用字体包和构建工具，不能因运行时代码里看不到普通 import 就删除。

用户随后明确工程需要的依赖应保留。此前仅从当前用例或直接导入缺席提出删减，依据不足；相关声明改为用途核对项，不自动清理。已确认的构建与测试工具链、配置加载和资产准备同样属于实际用途。

尤其 playwright 是 @vitest/browser-playwright 5.0.5 的必需 peer，不能仅因已有 @playwright/test 而移除。electron-builder-squirrel-windows 是当前 app-builder-lib 的非可选 peer，项目虽然不生成 Squirrel.Windows 包，删除仍需单独处理上游声明与严格安装约束。jiti／tsx 继续沿用当前已验证的加载方式；原生 TypeScript 与工具默认加载的取舍见前述讨论，不把减少依赖数量当作唯一目标。

默认配置可由工具发现的 test、test:e2e 无需重复指定文件名；不同宿主或输入范围的测试任务应继续显式指定配置。脚本名称和排列为阅读服务，不新增仅用于固定 JSON 顺序的测试或工具。排序建议尚未改写为强制合同。

## 本次实际验证与后续边界

- 全量 manifest／任务／配置及用途审查；catalog 重复锁定检查。
- 原配置与保留依赖边的隔离反例对照。
- main、extension-host 使用实际 Vite 配置的内存构建，确认错误选择浏览器入口。
- 应用本地 Vitest CLI 的 Electron Node 模式测试：两份文件、八项通过。
- 社区准则及本文的格式与差异检查。

以上为审查阶段的范围，当时尚未修改产品脚本、依赖、Vite 或 dependency-cruiser 配置。后续经确认完成的修改与运行结果见[实施记录](implementation/README.md)；原始反例保留修正前的输入与范围。
