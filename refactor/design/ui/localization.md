# 界面译本与类型化消息

主应用维护完整英语消息基准，简体中文、繁体中文和日语由普通官方语言扩展在线提供。i18n 管理译本和文本解析，preferences 保存具体选择。扩展自身的界面文案与资料获取语言分别由各自业务负责。

三个官方译本的具体身份、用语基准、源码与交付范围见[官方译本接入方案](../extensions/languages.md)。

<a id="ownership"></a>

## 译本归属与激活

主进程 infrastructure/i18n 管理跨窗口登记和有效语言，renderer 负责消息使用与响应式绑定。app 传入正式选择，并安排所选、已启用扩展进行普通轻量激活。extensions 负责安装与实例，i18n 不反向调用扩展管理器。ui 负责页面交互，不能因文字显示在界面中就接管译本能力。

三个官方译本从分发仓库安装并独立更新，应用不附带译本程序或安装包。首次安装和选择遵循[引导流程](../domains/onboarding.md)。冷启动优先满足所选译本的真实依赖，不增加语言专用阶段、静态 manifest 贡献或安装时执行提取。英语始终可用，UiLocale 不限制为四个封闭取值。

实例停用、卸载或失效时撤销登记，有效语言回退到英语，但保留稳定选择。所选译本随后登记可用时，i18n 按正常的登记与选择变化重新计算有效译本并同步界面，不等待 app 发起恢复操作。存在同语言的多个译本时，由用户明确选择，不按加载顺序覆盖，也不互相补词。切换译本会更新现有实例中的界面与菜单，并保留表单状态；保存选择仍走普通偏好操作。扩展自身 UI 消息与主应用语言包不互相接管。

<a id="registration"></a>

## 登记值与稳定选择

i18n.translations.register 在扩展 Node 侧接收 id、locale、name 和 messages，宿主绑定真实拥有者。id 在扩展内稳定且唯一，同一扩展可以提供同语言的多个译本。返回可释放的登记，包含只读完整 ref，并遵守普通实例失效规则。

```ts
await context.i18n.translations.register({
  id: 'simplified-chinese',
  locale: 'zh-Hans',
  name: '简体中文',
  messages
})
```

```ts
type UiTranslationRef =
  { type: 'builtin'; id: 'en' } | { type: 'extension'; extensionId: string; id: string }
```

preferences 保存具体 UiTranslationRef，不只保存 locale，也不另存可能与选择矛盾的有效语言。内置 en 始终可用。选中的扩展引用失效时，保留选择并回退。即使两个译本的 locale 相同，切换时也必须刷新，不能因语言值未变而跳过。

messages 是按领域嵌套的纯数据，对象表示分组，字符串是 ICU 叶子。目录不接受数组、函数或解析后的 AST，单个目录键不能包含点。源码可以拆分文件，但消息身份取汇总后叶子的完整路径；移动文件而不改变路径，不改变身份。宿主可以派生索引，作者不维护第二份扁平目录。

locale 使用 Intl 支持的规范标签 baseName，不混入数字、日期或排序的扩展选项。官方标签为 en、zh-Hans、zh-Hant 和 ja。标签格式合法与实际存在译本是两件事，见 [Intl.Locale](https://tc39.es/ecma402/#sec-intl.locale)。

<a id="messages"></a>

## ICU 消息与 t 的参数

```ts
const messages = {
  actions: { save: '保存' },
  entry: { added: '已添加 {name}' },
  selection: { count: '已选择 {count, number} 项' }
}

t('actions.save')
t('entry.added', { name: 'CLANNAD' })
t('selection.count', { count: 3 })
```

t 同步返回字符串，只接受英语基准中的叶子 key，不接受分组路径，也不提供接受任意字符串的逃逸重载。有参数的消息必须带匹配参数，无参数消息可以直接调用。接口不提供 m 函数树、selector、默认文案重载或动态 namespace 绑定。

key 可以来自有限状态映射或可确定的路径组合，但不能任意拼接后再断言合法。多个候选 key 需要不同参数时，应在实际分支中分别调用，保持 key 与参数的关联，不能让两个宽联合各自独立判断。

构建从英语 ICU 文本解析叶子路径、参数名和格式，生成关联类型及登记校验合同。不手写平行的 key 与参数表，也不用庞大的递归 TypeScript 类型解析字符串。普通插值接受 string 或 number；number、plural 和 selectordinal 要求 number；date 和 time 接受 Date 或毫秒时间；select 接受 string，不从列出的分支推导封闭枚举。

生成合同及作者校验所需的英语源文归 desktop-contracts/i18n，经 extension-api 与 SDK 的公开作者入口提供。官方译本项目在普通构建前检查中导入自己的纯目录，对该公共基准校验；通用制品工具不通过执行 activate 发现消息，也不要求作者读取应用私有源码。

同一参数的多种用法合并格式约束，英语消息中的约束不相容时构建报错。不能根据参数名猜测它是 ID 或非负整数。业务值与 PartialDate 先按自身语义格式化。

ICU 格式化使用 [intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/)，语法与复数规则由该库处理；类型生成由本体独立实现。公开值使用 ICU 文本，内部 AST 留在实现中。验收分别覆盖类型生成及 Node、浏览器、Webview 的真实格式化消费。

解析与格式化统一采用 ignoreTag: true，t 产生普通字符串，HTML／XML 样式文本按字面值呈现，不返回组件或富文本回调。参数内容不会再次解析为 ICU；需要链接或视觉结构的界面由组件明确提供。

t 每次读取当前有效译本。在 Solid 响应式位置调用时才会随语言变化更新，提前计算成普通变量不会自动更新。Node 使用自身环境中的有效语言，纯格式化不依赖 Solid。普通调用不回调扩展函数或请求网络，切换语言也无须重建消息函数树。SDK 不因此承担第三方 UI 的通用翻译框架职责。

<a id="validation"></a>

## 译本校验与缺词回退

英语基准拥有 key、含义和参数。只修改措辞时保留 key；含义或调用参数不兼容时使用新 key，不增加 schemaVersion、消息修订表或译本迁移层。运行时增加或替换译本不重新生成调用代码，也不把全部语言编入主应用。

译文可以使用不同的复数或选择分支，也可以省略该语言不需要的参数，但不能引用基准之外的参数或收窄到合法英语调用无法满足的类型。调用方仍遵守完整英语参数合同，不因所选译文省略参数而改变调用。允许缺 key，并逐条回退英语；未知 key 不参与当前应用解析，空字符串与缺键分别处理。已知 key 的 ICU 或参数错误应在构建中检查，运行登记也必须拒绝整份无效译本，不能静默裁剪后发布。调用缺参属于程序错误，不是缺词；英语回退按英语语法和复数规则解析。

三个官方译本在构建时必须完整覆盖英语，第三方允许部分覆盖，运行合同相同。验收覆盖冷启动、失效与恢复、同语言多译本、菜单更新，以及保留草稿的语言切换。

<a id="localized-text"></a>

## 静态文案匹配

| 文字归属                          | 消息与回退                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 主应用界面                        | 按消息 key 查所选译本，缺词回退应用英语基准；不借用另一份同语言译本                                    |
| manifest、registry 和宿主贡献文案 | 沿 LocalizedText，优先精确语言标签，再在同语言及文字体系内匹配；仍未命中时使用所属文案的 defaultLocale |
| 扩展自有界面                      | 由扩展自己的消息目录和 i18n 实现处理；官方模板沿默认语言回退，宿主译本不接管该目录                     |

LocalizedText 为纯字符串时原样使用。多语对象的键与 defaultLocale 按同一规则规范化，必须包含有效默认值，规范化后重名应报错。它不进行参数插值或消息 key 解析。扩展品牌可以不翻译，应用模板使用主应用已有 i18n，不建立另一套模板翻译系统。

匹配先规范语言标签并尝试精确命中。未命中时，使用 Intl.Locale.maximize 得到语言和文字体系，筛选候选，再通过 @formatjs/intl-localematcher 选择兼容版本。仍未命中时，使用该文案自己的 defaultLocale。候选按规范标签稳定排序，不依赖对象插入顺序。

zh-CN 与 zh-Hans 对应 Hans，zh-TW 与 zh-Hant 对应 Hant，两种文字体系不能互当相同，也不自动转换。使用作者指定的默认文案，与宣称简繁兼容不同。实现不假定存在原生 Intl.LocaleMatcher，依据 [maximize](https://tc39.es/ecma402/#sec-Intl.Locale.prototype.maximize) 和 [FormatJS matcher](https://formatjs.github.io/docs/polyfills/intl-localematcher/)完成匹配。

匹配只选择当前文案已经提供的版本，不更改用户明确选择的译本，也不借用其他译本消息。模板明确提供的初始标题等，在载入草稿时解析为普通文本；之后属于用户内容，切换语言不会改写。

<a id="runtime"></a>

## 各环境取得有效语言

Node 和 Webview 通过 i18n.locale.get()、i18n.locale.onChanged(listener) 取得实际有效 UI locale。订阅可以释放，由 SDK 在实例内维护，不经扩展私有 IPC 查询宿主。译本登记与管理只开放给 Node，宿主不提供用于扩展私有消息的全局 t。

回退到英语和译本恢复都同步实际变化，同时保留表单与业务状态。Webview 自己的消息系统根据宿主语言更新。资料语言仍由 Profile 或明确的 provider 输入决定，不随 UI 选择变化。首屏等待使用[共同启动预算](../architecture.md#startup-readiness)；资源范围、地区变体和真实跨窗口切换按[偏好](../domains/preferences.md)及验收要求处理。
