# 三个官方译本：合同与代表性消息核验

对应第 31–33 项[已确认完整方案](../../../design/extensions/languages.md)。繁体中文的台湾措辞基准已由用户明确选择；三项完整方案均已确认。本目录核验语言合同和代表性消息，不是三份完整译文或已经可安装的扩展。

## 依据与实际依赖

产品依据为已确认的[本地化](../../../design/ui/localization.md)、[偏好](../../../design/domains/preferences.md)、[首次引导](../../../design/domains/onboarding.md)、[实例生命周期](../../../design/extensions/runtime.md#activation)和[独立分发](../../../design/extensions/distribution.md)。当前仓库旧目录仅作为盘点和措辞参考，不能覆盖这次重构的模型。

| 依赖或规范                                                                      | 本次核验                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/)       | 实际安装并执行 12.1.3；字符串、参数、复数、ordinal、offset、日期和 ignoreTag 普通文本行为         |
| [ICU parser](https://formatjs.github.io/docs/icu-messageformat-parser/)         | 实际执行 @formatjs/icu-messageformat-parser 3.5.21；解析 AST 用于本地生成和校验，不作为公开消息值 |
| [ICU 语法](https://formatjs.github.io/docs/core-concepts/icu-syntax/)           | 参数、分支、other、引号转义与 # 的解释                                                            |
| [Locale matcher](https://formatjs.github.io/docs/polyfills/intl-localematcher/) | 实际执行 @formatjs/intl-localematcher 0.9.0，并先按语言与文字体系筛选                             |
| [ECMA-402](https://tc39.es/ecma402/#sec-intl.locale)                            | Intl.Locale 的规范化、baseName 与 maximize；标准能力由实际 Node ICU 环境提供                      |
| TypeScript                                                                      | 使用仓库现有 6.0.3 实际编译由英语样本生成的调用合同                                               |

[dependency-probe.mjs](dependency-probe.mjs) 记录三项 npm 固定版本和五个官方文档端点，八项读取均 HTTP 200；[dependency-contract.json](dependency-contract.json) 保存时间、字节、摘要、仓库引用及 npm 完整性资料。运行包安装在临时隔离目录，没有修改主项目 package.json 或锁文件。探针进程为 Node v24.11.1、ICU 77.1，不代表 Electron 或其他操作系统已经执行。

## 代表性输入与原目录盘点

[fixtures](fixtures/projects.json) 包含三个扩展的独立包身份、译本身份、语言和六目标声明；另有 en、zh-Hans、zh-Hant、ja 四份纯 JSON 目录，每份 37 条嵌套消息。身份文件是设计样本，不是可安装 manifest。

消息覆盖七类实体、合集和喜爱、资料方案、当前状态与运行状态、记录本次完成与补录、日期未知、计数、英文序数与 offset、动态标题、普通数值、日期、失败反馈、引号转义和字面标签。简体、台湾繁体和日文分别编写，没有运行简繁转换或在线翻译。

[existing-catalog-inventory.json](existing-catalog-inventory.json) 使用 TypeScript AST 只读检查当前四份旧目录，各有 29 个领域文件、2605 个同路径叶子，其中 268 个为函数。记录包含 116 个领域文件的字节数与 SHA-256，没有执行它们的代码。相同键路径不证明旧译文已经适合新模型，也不证明全量质量通过。

现有函数消息需要按新基准转换成 ICU。旧的 Company、completed 状态等词汇还需重新核对对象和动作含义；不能只完成函数替换就宣布迁移结束。新界面的最终消息数量由实现后的完整英语基准决定，不以 2605 作为冻结清单。

## 已执行核验

[verify.mjs](verify.mjs) 通过 133 项检查，结果见 [probe-results.json](probe-results.json)。五个输入的摘要见 [fixture-manifest.json](fixture-manifest.json)。

实际 Node／依赖检查包括：

- 四语言目录完整覆盖这份 37 键样本，真实 ICU 输出 0、1、2、1234；英语 one、ordinal、offset／# 行为正确。
- 译文可改变语序和分支、使用更宽兼容类型或省略不需要的参数；新参数、收窄类型、不兼容复用和缺少 other 的已知消息被拒绝。
- 同一参数约束按交集生成，所有分支中的参数进入合同；select 仍接受其他字符串值，不推导封闭枚举。
- Date 与毫秒采用相同格式化语义，参数大括号不再次解析，ignoreTag 保持普通文本；没有将 HTML 当界面执行。
- 官方完整样本与运行时部分目录分别处理；缺键、空字符串、未知新键和已知坏消息具有不同结果。
- 数组、函数、访问器、循环和超预算输入被拒绝；访问器没有执行，类似 **proto** 的自有数据键没有污染原型。
- 语言规范化、开放的非官方 locale、选项标签拒绝、同文字体系匹配、简繁隔离、作者默认值、规范后重复标签与稳定候选顺序。
- 由真实 ICU AST 生成 [TypeScript 调用样本](generated-contract.test.ts)，有效调用编译通过，七个预期错误覆盖未知键、分组键、缺参、错误参数类型、额外参数及失去键与参数关联的两个独立联合。

登记和采用部分使用明确的内存模型，覆盖默认英语、安装不代选、明确选择、同 locale 换译本、缺词按英语语法回退、不借其他译本、失效时保留稳定选择、重新可用后恢复、旧释放句柄、失败激活不发布子集、坏消息整份拒绝及用户草稿保持。它没有实际进程、RPC、数据库、菜单、计时器或页面，不能称为宿主集成已经通过。

## 复核

```powershell
$proofDirectory = Join-Path $env:TEMP 'kisaki-language-proof-20261017'
# Install these exact packages in an isolated private Node project first.
pnpm --dir $proofDirectory add --save-exact --ignore-scripts intl-messageformat@12.1.3 @formatjs/icu-messageformat-parser@3.5.21 @formatjs/intl-localematcher@0.9.0
node refactor/verification/evidence/language-extensions/verify.mjs $proofDirectory
node refactor/verification/evidence/language-extensions/dependency-probe.mjs
```

探针另消费仓库现有 TypeScript。输入目录是本次手工制作的代表性样本，读取和格式化均不需要账户或实际书库。[汇总记录](2026-10-17-verification.json) 分别保存三项已确认状态，共享检查只计 133 项，不将同一次公共核验重复计成三份。

## 尚须正式验收

三份完整消息目录、真实英语基准的持续覆盖、逐项语义和用语审校、所有实际窗口与原生菜单、无障碍文字、浏览器／Webview、字体与换行、75%／200% 缩放、首屏等待、跨窗口状态保持、真实更新与卸载、公开 SDK／CLI 与六目标制品安装仍属于实施验收。

本次没有修改运行代码、生成正式语言扩展、全量翻译旧目录或运行 Kisaki。代表性 ICU、类型和内存模型成功不代替完整译文质量，也不把技术库已提供泛型当作主应用类型生成已经交付。
