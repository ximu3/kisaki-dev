# 界面译本与类型化消息

desktop-localization 提供主应用的英语消息基准，简体中文、繁体中文和日语由三个官方语言扩展提供。i18n 管理译本和有效语言，preferences 保存用户选择。扩展自身的界面文案与资料获取语言分别由所属业务负责。

三个官方译本的具体身份、用语基准、源码与交付范围见[官方译本接入方案](../extensions/languages.md)。

<a id="ownership"></a>

## 译本归属与激活

主进程 infrastructure/i18n 管理译本登记，并向各窗口同步有效语言。app 读取已保存的选择，通过 extensions 激活所选且已启用的扩展。extensions 拥有安装与实例寿命，renderer 在界面中使用消息并建立响应式绑定。

英语随应用交付，始终可用。三个官方译本从分发仓库安装并独立更新，首次安装和选择遵循[引导流程](../domains/onboarding.md)。冷启动通过普通扩展激活流程优先满足所选译本的依赖，译本在实例激活时登记。第三方扩展也可以登记其他语言。

实例停用、卸载或失效时撤销登记，i18n 保留用户选择并回退到英语。所选译本重新登记后，i18n 自动恢复并同步现有窗口与菜单。每次只采用用户选定的那一份译本，同语言译本也各自独立。切换时保留表单状态，选择通过普通偏好操作保存。

<a id="registration"></a>

## 登记值与稳定选择

i18n.translations.register 在扩展 Node 侧接收 id、locale、name 和 messages，宿主绑定真实拥有者。id 在扩展内稳定且唯一，同一扩展可以提供同语言的多个译本。返回可释放的登记，包含只读完整 ref，并遵守普通实例失效规则。

```ts
await context.i18n.translations.register({
  id: 'simplified-chinese',
  locale: 'zh-Hans',
  name: '简体中文',
  messages,
})
```

```ts
type UiTranslationRef =
  { type: 'builtin'; id: 'en' } | { type: 'extension'; extensionId: string; id: string }
```

preferences 保存具体 UiTranslationRef。i18n 根据这份引用及当前登记计算有效语言。两个译本即使 locale 相同，切换引用也会刷新使用中的消息。

messages 是按领域嵌套的纯数据。分组使用普通对象的自有、可枚举数据属性，字符串保存 ICU 源文。每级键是非空且不含点的路径段，叶子的完整路径标识消息。源码可以分文件维护，宿主从汇总后的树派生索引。

locale 使用 Intl 支持的规范标签 baseName，不混入数字、日期或排序的扩展选项。官方标签为 en、zh-Hans、zh-Hant 和 ja。标签格式合法与实际存在译本是两件事，见 [Intl.Locale](https://tc39.es/ecma402/#sec-intl.locale)。

<a id="messages"></a>

## ICU 消息与 t 的参数

```ts
import { createTranslator } from '@kisaki3/desktop-localization'

const t = createTranslator('zh-Hans', {
  actions: { save: '保存' },
  library: {
    completion: { recorded: '已为《{name}》添加完成记录' },
    selection: '已选择 {count, number} 项',
  },
})

t('actions.save')
t('library.completion.recorded', { name: 'CLANNAD' })
t('library.selection', { count: 3 })
```

本体使用 createTranslator 为明确的语言和消息目录创建格式化快照。t(key) 或 t(key, values) 同步返回字符串。key 必须是英语基准中的叶子路径，values 的字段和类型由这条消息决定。

动态选择消息时，用有限状态映射或可确定的路径组合生成 key。候选消息的参数不同时，在相应分支内传入配套的参数。

本地化包从英语 ICU 文本提取叶子路径、参数名和格式。生成工具据此写出调用类型，普通构建核对生成结果，译本登记复用同一套参数规则。普通插值接受 string 或 number。number、plural 和 selectordinal 要求 number，date 和 time 接受 Date 或毫秒时间，select 接受 string。

desktop-contracts/i18n 定义通用目录形状、译本引用、登记与语言观察接口。desktop-localization 拥有英语源文、关联类型、译本校验和纯格式化。本体直接消费这两个包。译本作者通过 SDK 的纯作者入口取得英语基准与校验能力，在构建前静态导入自己的目录并校验。

英语源文在本地化包内按领域拆分为纯数据模块，由目录内入口静态汇总为完整消息树。同一功能的文案集中维护和审校，文件与子目录按实际职责组织。类型生成、公开作者基准与运行时英语回退使用同一汇总值，模块划分不改变消息的完整路径。

同一参数的多种用法取允许类型的交集。交集为空时，英语基准构建失败。业务值与 PartialDate 先按自身语义格式化，再传给消息。

ICU 格式化使用 [intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/)，语法与复数规则由该库处理；类型生成由本地化包维护。纯格式化接收明确的语言和消息快照，不管理全局选择或扩展登记；本体 i18n 将有效译本与响应式调用接续到该能力。公开值使用 ICU 文本，内部 AST 留在实现中。验收分别覆盖类型生成及 Node、浏览器、Webview 的真实格式化消费。

解析与格式化统一采用 ignoreTag: true。t 返回普通字符串，标签和插值文本按字面值呈现。链接或其他视觉结构由界面组件提供。

本体提供的 t 每次调用都读取当前有效译本。在 Solid 的响应式位置调用它，语言变化会更新界面。提前保存的字符串是调用时的结果。Node 使用自身环境的有效语言，普通格式化在当前进程内同步完成。

<a id="validation"></a>

## 译本校验与缺词回退

英语基准定义每条消息的 key、含义和参数。只改措辞时沿用 key，含义或调用参数不兼容时使用新 key。安装或替换译本更新消息目录，调用类型随英语基准构建。

译文可以调整复数与选择分支，也可以省略参数。它使用的每个参数都必须来自英语基准，并接受该参数的全部合法调用。调用方始终提供英语要求的参数，缺参按调用错误处理。

所选译本缺少某个键时，该条消息使用英语原文和英语复数规则。空字符串是有效译文，当前版本保留未知键，只解析已知消息。构建校验已知消息的 ICU 和参数，登记时其中任何一条无效，整份译本登记失败。

三个官方译本在构建时必须完整覆盖英语，第三方允许部分覆盖，运行合同相同。验收覆盖冷启动、失效与恢复、同语言多译本、菜单更新，以及保留草稿的语言切换。

<a id="localized-text"></a>

## 静态文案匹配

| 文字归属                          | 消息与回退                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 主应用界面                        | 按消息 key 查所选译本，缺词回退应用英语基准；不借用另一份同语言译本                                    |
| manifest、registry 和宿主贡献文案 | 沿 LocalizedText，优先精确语言标签，再在同语言及文字体系内匹配；仍未命中时使用所属文案的 defaultLocale |
| 扩展自有界面                      | 由扩展自己的消息目录和 i18n 实现处理；官方模板沿默认语言回退，宿主译本不接管该目录                     |

LocalizedText 为纯字符串时原样使用。多语对象的键与 defaultLocale 按同一规则规范化，必须包含有效默认值，规范化后重名应报错。它不进行参数插值或消息 key 解析。扩展品牌可沿用原名，应用模板通过主应用 i18n 解析文案。

匹配先规范语言标签并尝试精确命中。未命中时，使用 Intl.Locale.maximize 得到语言和文字体系，筛选候选，再通过 @formatjs/intl-localematcher 选择兼容版本。仍未命中时，使用该文案自己的 defaultLocale。候选按规范标签稳定排序，不依赖对象插入顺序。

zh-CN 与 zh-Hans 对应 Hans，zh-TW 与 zh-Hant 对应 Hant，两种文字体系不能互当相同，也不自动转换。使用作者指定的默认文案，与宣称简繁兼容不同。实现不假定存在原生 Intl.LocaleMatcher，依据 [maximize](https://tc39.es/ecma402/#sec-Intl.Locale.prototype.maximize) 和 [FormatJS matcher](https://formatjs.github.io/docs/polyfills/intl-localematcher/)完成匹配。

匹配只选择当前文案已经提供的版本，不更改用户明确选择的译本，也不借用其他译本消息。模板明确提供的初始标题等，在载入草稿时解析为普通文本；之后属于用户内容，切换语言不会改写。

<a id="runtime"></a>

## 各环境取得有效语言

Node 和 Webview 通过 i18n.locale.get()、i18n.locale.onChanged(listener) 取得实际有效 UI locale。订阅可以释放，由 SDK 在实例内维护，不经扩展私有 IPC 查询宿主。译本登记与管理只开放给 Node，宿主不提供用于扩展私有消息的全局 t。

回退到英语和译本恢复都同步实际变化，同时保留表单与业务状态。Webview 自己的消息系统根据宿主语言更新。资料语言仍由 Profile 或明确的 provider 输入决定，不随 UI 选择变化。首屏等待使用[共同启动预算](../architecture.md#startup-readiness)；资源范围、地区变体和真实跨窗口切换按[偏好](../domains/preferences.md)及验收要求处理。
