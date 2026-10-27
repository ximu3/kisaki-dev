# 简洁与原生的全项目复核

2026-10-26，按用户要求提高简洁与原生的重要性，并从技术能力和交互体验两方面检查当前工程与正式设计。新的共同规则见[简洁、原生与适度复杂度](../../../../design/engineering/conventions.md#simplicity-native)。原生强调顺应平台与工具的能力、语义和习惯；有真实用途的新概念与封装仍可建立。涉及取舍的方案先讨论，再修改正式规则。

## 范围与方法

| 范围 | 本轮核对 |
| --- | --- |
| 当前桌面实现 | main、preload、renderer、extension-host、私有 Rust 与 Node 入口；启动、关闭、开发 IPC、窗口与控件的实际职责 |
| 公共包与工程 | 八个公共包、三个私有工程包、根工具、构建、开发、打包、资源、缓存、依赖边界与 CI |
| 官方扩展 | 33 项实际身份逐项核对；当前五份工程文件按同构内容分组比较，确认实际只需一个 Node 配置环境 |
| 测试与样板 | 常规、消费者、浏览器、桌面、开发、制品与性能用例及其辅助；核对真实行为、运行环境和必要的隔离 |
| 正式设计 | 全部 144 篇 Markdown 和两份 relay 配置 JSON；按主题核对目标、正常流程、标准能力、定制机制及其依据 |
| 独立项目 | Vantage、Kana、libmpv-node、oauth-relay 的公共合同、平台接入、依赖与交付；未把设计材料记作正式实现 |
| 协作与验收 | 根规范、工作包、状态与场景；核对共同原则、实际阶段和仍需运行验证的范围 |

审查从当前文件清单进入各主题，源码通读主路径与相关失败、取消和释放；同构配置比较共同部分及逐项差异，设计条款回到所属上下文判断。输入清单见 [scope.json](scope.json)。历史探针只用于核对具体机制及其证据边界，没有改写旧结果，也没有重新认证全部来源字段、远端 API、第三方许可或实际产品界面。

## 已处理

| 发现 | 修正 |
| --- | --- |
| 简洁与原生主要分散在局部要求中，原生体验缺少共同准则 | 提升到 AGENTS、CONVENTIONS、产品判断、设计入口、工作包和验收；明确概念与操作负担、现成能力、平台习惯及必要适配 |
| Kana 仍将统一性置于原生机制之上 | 改为简洁与原生共同参与判断，形式统一和 API 使用比例都不能单独决定方案 |
| Kana 的统一 Tab 条款可能覆盖 Safari 的键盘偏好 | 与用户讨论后，采用“遵循平台习惯，只补必要接续”；设计与阅读验收同步，保留当前语义文档可完成的默认导航 |
| “本体原生能力”与“系统原生能力”容易混读 | 在架构中明确窗口、内容和能力归属；补齐系统菜单与应用内菜单的边界，以及语义控件、输入法和焦点规则 |
| 查询基础设施容易被读作另一套状态框架 | 明确优先组合 Solid 现有状态、异步读取和清理原语，只补实际的取消与失效重查 |
| layout 与 workspace 仍有两处要求扩展拆分 kisx／Node 类型配置的旧句子 | 清除矛盾条款，保持已经实现的单一 Node 工具环境，避免重新引入已删除的 66 份配置 |
| libmpv-node 发行文档把早期 Electron 版本写成当前工作区版本 | 改为引用当前构建基线，历史试件只证明原版本范围 |
| parse5 源位置适配的内部依赖未在正式正文充分说明 | 明确固定版本的受保护发射／插入接缝、集中维护责任和升级核对范围；未更换解析路线或扩大依赖 |
| 一份开发测试夹具未通过格式检查 | 仅按 Prettier 修正布局，保留原有消息与退出行为 |

Safari 的 Tab、Option-Tab 及用户设置关系由 [Apple 文档](https://support.apple.com/guide/safari/keyboard-shortcuts-and-gestures-cpsh003/mac)明确说明。[既有焦点试件](../../kana-focus/focus.md)只证明了所测环境中的协调机制，不能据此把平台不同的默认遍历都认作缺陷。当前选择保留内容可达性、跨页显示与焦点接续，同时尊重实际平台行为；正式 Safari 与辅助技术运行仍待所属实现完成。

parse5 的来源映射缺口和内部接缝由[既有试件](../../kana-formats/format-sources.md)及固定 [Tokenizer](https://github.com/inikulin/parse5/blob/v8.0.1/packages/parse5/lib/tokenizer/index.ts)、[Parser](https://github.com/inikulin/parse5/blob/v8.0.1/packages/parse5/lib/parser/index.ts)核对。这里保留已有方案并说明成本，没有将内部接口包装成稳定公开能力。

## 保留的机制及依据

- pnpm、Turbo、Vite、tsdown、electron-builder 和 GitHub Actions 继续拥有各自的依赖、编译、缓存和运行机制。项目工具的候选交接、资源装配与正常退出有实际职责；少量包装代码不因行数或文件数被机械删除。已验证的开发父子 IPC 与 CI 事件拆分继续保留。
- HTML 按钮与 Electron 窗口已经使用现成语义。复杂控件仍由所选成熟原语承担；文件选择、标准菜单角色、输入法、文本编辑、辅助技术与平台修饰键的要求进入正式规范。依据见 [Electron 菜单](https://www.electronjs.org/docs/latest/tutorial/application-menu)、[系统对话框](https://www.electronjs.org/docs/latest/api/dialog)与 [W3C 控件语义](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)。
- Solid 的状态、异步读取和 owner 清理复用[框架原语](https://docs.solidjs.com/reference/basic-reactivity/create-resource)，释放沿 [onCleanup](https://docs.solidjs.com/reference/lifecycle/on-cleanup)的实际寿命；不会仅因某个辅助函数能够提供统一接口，就重建这些机制。
- 文件的不覆盖移动、关键同步与备份恢复保护用户实际数据；普通 Node rename 不能替代不覆盖的系统原语。原生绑定只承担这些真实缺口，没有把“原生”改成尽量多写 Rust。
- Kana 的浏览器排版、源位置与多文档接续各有职责。[跨引擎对照](../../kana-browser-scope/browser-scope.md)和[分页比较](../../kana-pagination-review/review.md)支持当前有边界的适配，也明确保留成本与未覆盖项；它们没有证明所有替代路线不可能。原生流、PDF.js、Expat、libiconv、zip.js 等继续承担已有能力，不因统一接口重写底层实现。
- 原生库保留上游调用语义与平台差异；Vantage 的窄桥接、libmpv 的已确认补丁和平台资源持有继续按各自合同维护。迁移导入复用实际格式库，例如 Playnite 的 LiteDB 读取适配。审查没有新增系统模拟层、通用权限中心或另一套数据模型。

## 检查与限制

`pnpm check` 已通过，包含全工作区类型、lint、依赖边界、格式及常规测试。依赖检查覆盖 219 个模块、378 条依赖，未发现越界；常规测试为本体 14 项、私有工程包 4 项、根工程 19 项，共 37 项。完整输出见 [check.log](check.log)。首次执行因上述夹具格式失败，保留 [check.initial.log](check.initial.log)，修正后重新执行通过。

本轮没有修改产品运行逻辑、依赖或构建机制，没有新增测试。220 份当前文档中的 2642 项本地引用及 1550 项锚点引用核对通过；残留规则、格式与最终差异结果见 [checks.json](checks.json)。浏览器、真实桌面、制品、性能及六目标没有重跑；先前有效结果保持各自输入与范围。Kana 焦点规则是已确认的设计调整，尚未取得正式 Reader 实现或新平台交互证据。

修改留在当前工作副本，未提交、推送、合并或对外发布。后续若需改变已有技术路线、交互或维护边界，先提出具体取舍并讨论。

随后进行的[工具链专项审查](../../tooling-review/2026-10-26/README.md)发现依赖检查漏报和 Node 构建解析条件缺陷。以上记录保留当时检查的实际结果，不代表这些工具配置已经得到充分验证；未闭合项由专项记录和实施状态接续。
