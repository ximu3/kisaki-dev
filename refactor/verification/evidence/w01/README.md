# W01 desktop-appearance 验证

2026-11-01，在 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、tsdown 0.23.0、Vite 8.3.3、Tailwind 4.3.3、Playwright 1.64.1 和 Chromium 156.0.8078.4 下验证正式包实现。交付及远端验收状态见[实施状态](../../../implementation/status.md#progress)。

<a id="current-vocabulary"></a>

## 现行词表与消费验证

2026-11-06，在本机 Windows x64 验证现行 43 项视觉词表、亮暗默认值、纯值规则、普通 CSS 与 Tailwind 映射。`pnpm check` 通过；`pnpm exec turbo run test:consumers --filter=...@kisaki3/desktop-appearance` 完成视觉包及下游桌面合同、本地化与 UI 包的构建、打包、声明检查和独立消费，四个包分别通过 4、3、3、10 项用例。

NodeNext 与 Bundler 消费者通过公开类型使用 chrome；浏览器验证 bg-chrome 与 text-chrome-foreground 随运行变量更新，既有亮暗、零圆角、缩放与资源清理检查通过。图表词表为 chart-1 至 chart-5，五项 Tailwind 工具类分别随对应主题值更新，UI 图表使用同一套系列色。消费者截图已人工核对。下方历史结果保留各自版本与运行范围。

## 交付与本机结果

| 范围         | 实际结果                                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 词表与默认值 | 45 项固定 token，完整亮暗值；颜色、阴影与文字基准对照既有默认主题，保留已确认视觉值。                                                                                                                    |
| 纯值规则     | 单值与完整分支解析；合法颜色、字体栈、文字基准和多层阴影通过。公式、上下文引用、无效类型、缺项、额外字段、非有限数和负模糊半径拒绝；失败不修改输入或补默认值。                                           |
| 样式         | 普通 CSS 独立工作，保留默认边距和原生焦点；Tailwind 与普通 CSS 的明暗、颜色、字体、圆角和尺寸一致。零圆角、150% 缩放和运行时阴影覆盖通过。                                                               |
| 声明与纯入口 | 仓库外实际 tarball 在 NodeNext、Bundler 和浏览器项目使用 TypeScript 6.0.3、skipLibCheck: false 完整检查；消费源码通过类型感知 lint。Node 与浏览器执行同一组解析断言，浏览器核对全部默认值的 CSS 合法性。 |
| 工程         | pnpm check 通过；新增依赖边界与任务选择断言随后通过针对性复核。纯视觉源码不能直接导入 Node 或应用实现，样式与消费测试变化触发对应回归，Markdown 修改不触发运行回归。                                     |
| 制品与许可   | pnpm desktop:packages:pack 的构建、publint、Are the Types Wrong 通过；pnpm desktop:test:consumers 的 3 项实际消费测试通过。MIT 许可和 CSS Tree、MDN data、source-map-js 的原文通知随包交付。             |

该次验证使用未发布版本 0.1.0-dev.0。制品包含 tokens、values、defaults、普通样式和 Tailwind 映射，以及 README、发行说明和许可材料。当时的打包收据及逐份 SHA-256 保存于 artifacts/desktop/packages/packages.json，消费者报告及浏览器截图保存于根 test-results/consumers；这些是该次验收产物的位置，现行入口与输出见[开发验证](../../../implementation/development.md#verification)。制品没有私有工程入口、字体或图片；声明不依赖解析库的内部类型。

## CI 结果

2026-11-01，[CI 运行](https://github.com/ximu3/kisaki-dev/actions/runs/41306580585)验证 [0e99deb](https://github.com/ximu3/kisaki-dev/commit/0e99deb7662f97228d32743bb5bb9cf8e7db16ba) 的 PR 合并结果。仓库检查、Windows／macOS／Linux 的 x64 与 arm64 六目标工程检查，以及 Required checks 全部通过。

Linux x64 执行公共包构建、publint、Are the Types Wrong 和 3 项仓库外消费测试，均通过。该目标的 CI 制品包含打包收据、tarball、消费者报告和截图；其他目标验证既有工程的运行、开发会话、打包与制品消费。该次结果对应上述提交，后续工程变更的验证按实际版本记录。

## 包内消费者验证

2026-11-02，在 Windows x64、Node 24.11.1 和 pnpm 11.11.0 下验证包内消费者入口。`pnpm check` 通过，共 43 项常规测试；其中 appearance 普通套件执行 4 项单元测试。任务图与影响选择测试覆盖消费者用例、Node／浏览器样板和配置变化，均能选择相应消费验证。

`pnpm desktop:test:consumers` 完成 build → pack → check:package → test:consumers，Node 的 1 项与浏览器的 3 项消费测试全部通过。两个工程在仓库外分别安装同一 tarball：Node 仅安装被测包和 TypeScript，完成 NodeNext 声明检查与纯入口执行；浏览器完成 Bundler 的无 DOM／有 DOM 声明检查、普通 CSS 与 Tailwind 映射消费。两者均使用 skipLibCheck: false 并执行类型感知 lint。

单独运行 Node 套件时，将 PLAYWRIGHT_BROWSERS_PATH 指向不存在的目录，1 项测试仍通过；浏览器套件单独运行也通过 3 项测试。安装副本、页面、浏览器与预览服务由 Vitest 的作用域 fixture 管理，普通 CSS 用例不启动 Tailwind／Vite 构建。完整与独立运行报告分别为该包 test-results/consumers 下的 results.json、node.json 和 browser.json，浏览器截图为 appearance.png。该结果为本机验证，跨平台 CI 结果按对应提交另行记录。

## 实现依据与审阅

主题保存可独立编辑的视觉值，公式和派生关系归作者代码与共同样式，正式边界见[外观合同](../../../design/domains/appearance.md#tokens)。这一边界由主题编辑、复制与统一应用的职责确定。CSS 变量具有上下文依赖和循环语义，支持它们需要单独承担相应关系模型，见 [CSS 变量规范](https://www.w3.org/TR/css-variables-1/#cycles)。

解析采用 [CSS Tree](https://github.com/csstree/csstree) 3.2.1 的词法、语法和序列化能力，另行检查已确认的字面值范围、有限数值和阴影模糊半径。包构建采用其浏览器数据入口，公开纯入口没有 Node 数据加载器；词表与默认值不加载解析代码。

默认 CSS 从同一份 TypeScript 默认值生成。Tailwind 使用 @theme inline reference 引用正式变量，避免同名字体和阴影变量的自引用；共同派生只由普通 CSS 拥有。依据为 [Tailwind 主题变量](https://tailwindcss.com/docs/theme)及锁定版本的实际语法，效果由浏览器消费验证。

Are the Types Wrong 按 ESM 模式检查 JavaScript 声明，CSS 资源由实际消费者检查，遵循上游[非 JavaScript 资源说明](https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/NoResolution.md)。没有关闭 JavaScript 入口的解析错误规则。

人工审阅覆盖词表与字段语义、正常和失败解析、默认与派生样式、公开声明和许可证，以及构建准备、采用前取消、失败保留旧输出和消费者资源释放。构建候选交接与取消复用 W00 工程函数及其测试，纯值操作本身不持有持续资源。

主题持久化、字体资源加载和正式窗口接入由所属工作包验收；本包不承担应用状态或框架生命周期。
