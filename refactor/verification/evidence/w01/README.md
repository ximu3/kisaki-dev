# W01 desktop-appearance 验证

2026-11-01，在 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、tsdown 0.23.0、Vite 8.3.3、Tailwind 4.3.3、Playwright 1.64.1 和 Chromium 156.0.8078.4 下验证正式包实现。交付及远端验收状态见[实施状态](../../../implementation/status.md#progress)。

## 交付与本机结果

| 范围         | 实际结果                                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 词表与默认值 | 45 项固定 token，完整亮暗值；颜色、阴影与文字基准对照既有默认主题，保留已确认视觉值。                                                                                                                    |
| 纯值规则     | 单值与完整分支解析；合法颜色、字体栈、文字基准和多层阴影通过。公式、上下文引用、无效类型、缺项、额外字段、非有限数和负模糊半径拒绝；失败不修改输入或补默认值。                                           |
| 样式         | 普通 CSS 独立工作，保留默认边距和原生焦点；Tailwind 与普通 CSS 的明暗、颜色、字体、圆角和尺寸一致。零圆角、150% 缩放和运行时阴影覆盖通过。                                                               |
| 声明与纯入口 | 仓库外实际 tarball 在 NodeNext、Bundler 和浏览器项目使用 TypeScript 6.0.3、skipLibCheck: false 完整检查；消费源码通过类型感知 lint。Node 与浏览器执行同一组解析断言，浏览器核对全部默认值的 CSS 合法性。 |
| 工程         | pnpm check 通过；新增依赖边界与任务选择断言随后通过针对性复核。纯视觉源码不能直接导入 Node 或应用实现，样式与消费测试变化触发对应回归，Markdown 修改不触发运行回归。                                     |
| 制品与许可   | pnpm desktop:packages:pack 的构建、publint、Are the Types Wrong 通过；pnpm desktop:test:consumers 的 3 项实际消费测试通过。MIT 许可和 CSS Tree、MDN data、source-map-js 的原文通知随包交付。             |

当前未发布版本为 0.1.0-dev.0。制品包含 tokens、values、defaults、普通样式和 Tailwind 映射，以及 README、发行说明和许可材料。打包收据及逐份 SHA-256 位于 artifacts/desktop/packages/packages.json，消费者报告及浏览器截图位于 test-results/consumers。制品没有私有工程入口、字体或图片；声明不依赖解析库的内部类型。

## 实现依据与审阅

主题保存可独立编辑的视觉值，公式和派生关系归作者代码与共同样式，正式边界见[外观合同](../../../design/domains/appearance.md#tokens)。这一边界由主题编辑、复制与统一应用的职责确定。CSS 变量具有上下文依赖和循环语义，支持它们需要单独承担相应关系模型，见 [CSS 变量规范](https://www.w3.org/TR/css-variables-1/#cycles)。

解析采用 [CSS Tree](https://github.com/csstree/csstree) 3.2.1 的词法、语法和序列化能力，另行检查已确认的字面值范围、有限数值和阴影模糊半径。包构建采用其浏览器数据入口，公开纯入口没有 Node 数据加载器；词表与默认值不加载解析代码。

默认 CSS 从同一份 TypeScript 默认值生成。Tailwind 使用 @theme inline reference 引用正式变量，避免同名字体和阴影变量的自引用；共同派生只由普通 CSS 拥有。依据为 [Tailwind 主题变量](https://tailwindcss.com/docs/theme)及锁定版本的实际语法，效果由浏览器消费验证。

Are the Types Wrong 按 ESM 模式检查 JavaScript 声明，CSS 资源由实际消费者检查，遵循上游[非 JavaScript 资源说明](https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/NoResolution.md)。没有关闭 JavaScript 入口的解析错误规则。

人工审阅覆盖词表与字段语义、正常和失败解析、默认与派生样式、公开声明和许可证，以及构建准备、采用前取消、失败保留旧输出和消费者资源释放。构建候选交接与取消复用 W00 工程函数及其测试，纯值操作本身不持有持续资源。

主题持久化、字体资源加载和正式窗口接入由所属工作包验收；本包不承担应用状态或框架生命周期。
