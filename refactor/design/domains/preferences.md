# 应用偏好与配置提交

preferences 保存用户对应用的正式选择。固定配置组、单次字段修改、编辑草稿和运行中的采用各有明确边界。原生界面与其他入口共用同一套类型、默认值、校验和并发规则。

字段与初值见[配置目录](#fields)，读取和保存见[修改单位与 API](#updates)。阅读值在[阅读配置](#reading-values)定义，作品与文件如何选取、保存和采用整套配置见[完整自定义](#overrides)；普通偏好界面的草稿由[编辑规则](#editor)管理。

<a id="storage"></a>

## 固定配置组与存储

preferences 使用固定单例行，主键与 CHECK(id = 1) 保证最多只有一行。全部数据库迁移完成后，仅在该行不存在时复用本页的默认值定义插入完整配置，已有行不重新覆盖；API 不接受设置 id。

general、appearance、navigation、library、usage、playback、shortcuts、network 和 updates 分别是非空 JSON 列，在 SQLite 中以 TEXT 保存。分组依据配置语义确定，不由页面标题生成，也不允许扩展注册新列或通过任意字符串键写入。

每列的 Drizzle customType 明确区分应用值、驱动文本及 fromDriver、toDriver。读取遵守[逐值宽容读取规则](values.md#read-write)：普通偏好保留合法字段，只对缺失或格式异常的独立字段采用既定默认值，不因同在一个 JSON 列中而重置整组。身份选择保留原引用，代理等执行配置的无效部分按自身合同处理，不影响其他配置组读取。

写入严格校验本次提交及相关约束，保存规范值并保证读回后语义等价。类型和纯规则归本体合同所有，codec 引用这些规则并保持同步纯函数，不查询数据库、读取字体、加解密或改变运行状态。TypeScript 泛型不能代替运行校验。普通查询不重复解析，原始 SQL、迁移及特殊表达式则必须自行维护相同合同。

主进程负责正式写入，SQL 约束继续保证非空、单例及引用要求。读取时采用缺省不会自动写回数据库、删除附件或恢复出厂设置。全局偏好与 library 中作品、文件的自定义配置属于不同范围。

初始化使用当时的默认值建立完整配置。已保存值不会随着新版本的默认值改变，即使某个值恰好等于默认，也仍然是正式选择。新增字段通过[本体数据库迁移](../engineering/database.md#initialization)补齐，不另建配置专用版本系统。system、document 等具有明确跟随含义的值仍动态解释，主题引用也可以跟随相应资源更新。“恢复默认”只把当前默认值放进草稿，用户保存后才正式采用。

<a id="fields"></a>

## 字段、值域与默认值

四类使用配置都位于 preferences.usage。漫画和小说的默认值分别保存在 preferences.usage.comic 与 preferences.usage.novel，共用本体自己的 ReadingPreferences 合同。阅读流、原始页面、正文排版和配色组成一份完整设置，各项参数是否适用由实际内容决定。配置不记录系统是否允许自启动、实际协议关联、扩展激活状态、任务执行状态或窗口实例。

usage 保留四类作品分支和共同的暂离宽限：

```ts
interface UsagePreferences {
  foregroundGracePeriodMs: number
  game: GamePreferences
  anime: AnimePlaybackPreferences
  comic: ReadingPreferences
  novel: ReadingPreferences
}
```

各字段的正式值和默认值如下：

| 字段                                           | 正式值与默认值                                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| general.uiTranslation                          | UiTranslationRef；初始为本体完整英语基准，系统语言只提供引导建议                                                                   |
| general.closeMainWindow                        | background / quit；默认 background                                                                                                 |
| appearance.theme / mode / interfaceScale       | 复用 AppearancePreferences：本体默认主题、system、100；缩放为 75–200 的整数百分比                                                  |
| navigation.order / visibleLimit                | 稳定的原生页面引用或 { extensionId, pageId } 的完整顺序；初始取本体导航目录顺序，visibleLimit 默认 7，非负安全整数；以后新页面追加 |
| library.showNsfw                               | boolean，默认 true；不增加全局剧透开关                                                                                             |
| library.autoRefreshHoldings                    | boolean，默认 true；不影响用户主动刷新                                                                                             |
| usage.foregroundGracePeriodMs                  | 非负有限毫秒，默认 600000；适用范围按 [有效使用](sessions.md#timing)，不增加逐 Work 覆盖                                           |
| usage.game.showPanelOnStart                    | boolean，默认 false                                                                                                                |
| usage.game.panelAlwaysOnTop                    | boolean，默认 true                                                                                                                 |
| usage.anime.audioLanguages / subtitleLanguages | 经校验、去重的有序语言标识列表，默认 []                                                                                            |
| usage.anime.subtitlesEnabled                   | boolean，默认 true                                                                                                                 |
| usage.anime.playbackSpeed                      | 0.01–100 的有限倍数，包含两端，默认 1                                                                                              |
| usage.anime.subtitleScale                      | 大于 0 且不超过 100 的有限倍数，默认 1                                                                                             |
| usage.anime.autoAdvance / autoMarkWatched      | boolean，默认分别 false / true；自动已看按本次实际覆盖 90% 标记文件直接关联的分部，不自动完成作品，也不增加可配置阈值              |
| usage.comic.flow                               | paginated / continuous，默认 paginated；主阅读的推进方式                                                                           |
| usage.comic.pages                              | 完整原始页面偏好；默认值见[阅读配置](#reading-values)                                                                              |
| usage.comic.text                               | 完整正文排版偏好；默认值见[阅读配置](#reading-values)                                                                              |
| usage.comic.colors                             | 阅读配色，默认 { type: 'theme' }                                                                                                   |
| usage.novel.flow                               | paginated / continuous，默认 paginated；作为小说全局默认独立保存                                                                   |
| usage.novel.pages                              | 同一原始页面偏好合同，作为小说全局默认独立保存                                                                                     |
| usage.novel.text                               | 同一正文排版偏好合同，作为小说全局默认独立保存                                                                                     |
| usage.novel.colors                             | 阅读配色，默认 { type: 'theme' }；作为小说全局默认独立保存                                                                         |
| playback.volumePercent                         | 0–100 的有限数，包含两端，单位为百分比，默认 100；应用记住的上次播放音量                                                          |
| playback.muted                                 | boolean，默认 false；应用记住的上次静音选择                                                                                        |
| shortcuts                                      | 按本文件固定配置键保存 { enabled, accelerators }；初值采用 [快捷键目录](../ui/navigation.md) 的平台默认，未绑定为 []               |
| network.mode                                   | system / direct / manual；默认 system                                                                                              |
| network.endpoint                               | HTTP/HTTPS/SOCKS5 的单个明确端点或 null，默认 null；不包含用户名/密码，manual 模式要求有效端点                                     |
| network.bypassRules                            | Electron 公开 bypass 语法字符串，默认空字符串；非 manual 模式保留但不采用                                                          |
| network.credentials                            | 读取投影为 null 或 { revision }；实际不存入该 JSON，修改语义见[代理凭据](#network)                                                 |
| updates.autoCheck / allowPrerelease            | boolean，默认分别 true / false；检查时机为就绪后一次及每 24 小时，不提供频率字段                                                   |

interfaceScale 接受 75–200 的整数百分比。缩放按钮每次调整 5 个百分点，直接输入则不必是五的倍数。导航初始顺序来自本体目录，以后出现的新页面追加到末尾，visibleLimit 默认为 7。

playback 保存应用级播放控制记忆，与 usage.anime 的完整播放配置分开，不进入作品或文件自定义。播放器的音量与静音控件通过 sessions 的[保存并采用操作](sessions.md#playback-setting-result)即时修改相应字段，使用 preferences.update 的逐字段保存、并发与宽容读取规则。

新文件打开时读取当时的正式值，普通同文件复用保留当前状态；一次明确调整只采用到发起操作的播放器，其他已打开实例保持自己的音量和静音。两项选择各自保存，调整音量不改变静音。playback 不另设偏好页分组或搜索字段。

设置定位使用以下有限 PreferenceKey，属于 desktop-contracts/preferences。它只标识界面字段；修改仍使用正式的嵌套配置输入，不能将该键当作 JSON 路径写入。选择引用、字体和配色定位到整个控件，快捷键定位到对应动作；搜索名称、说明和关键词由同一字段目录提供。

```ts
type PreferenceKey =
  | 'general.uiTranslation'
  | 'general.closeMainWindow'
  | 'appearance.theme'
  | 'appearance.mode'
  | 'appearance.interfaceScale'
  | 'navigation.order'
  | 'navigation.visibleLimit'
  | 'library.showNsfw'
  | 'library.autoRefreshHoldings'
  | 'usage.foregroundGracePeriodMs'
  | 'usage.game.showPanelOnStart'
  | 'usage.game.panelAlwaysOnTop'
  | `usage.anime.${
      | 'audioLanguages'
      | 'subtitleLanguages'
      | 'subtitlesEnabled'
      | 'playbackSpeed'
      | 'subtitleScale'
      | 'autoAdvance'
      | 'autoMarkWatched'}`
  | `usage.${'comic' | 'novel'}.${ReadingPreferenceKey}`
  | `shortcuts.${ShortcutKey}`
  | 'network.mode'
  | 'network.endpoint'
  | 'network.bypassRules'
  | 'network.credentials'
  | 'updates.autoCheck'
  | 'updates.allowPrerelease'

type ReadingPreferenceKey =
  | 'flow'
  | 'colors'
  | `pages.${'arrangement' | 'progression' | 'firstPage' | 'fit' | 'autoCrop' | 'brightness' | 'contrast'}`
  | `text.${
      | 'pagesPerView'
      | 'writingMode'
      | 'font'
      | 'fontSize'
      | 'lineHeight'
      | 'paragraphSpacing'
      | 'alignment'
      | 'padding'
      | 'maxLineLength'}`
```

播放倍速与字幕缩放的值域符合 [mpv 参数范围](https://mpv.io/manual/stable/)，完整配置和快捷控制使用同一校验。超出范围时拒绝本次修改，不先保存再等待引擎拒绝，也不静默钳制。字幕缩放继续要求正值，显示与隐藏由已有字幕开关表达。

应用首次以本体英语基准运行，系统语言只用于建议具体译本。语言选项显示译本自己的名称。用户明确选用译本，并完成必要安装和激活后，才保存 UiTranslationRef；失败时保留当前语言与草稿。安装扩展或系统语言变化都不会自动切换译本。已保存引用失效时，选择继续保留，显示回退为英语。

虽然 usage 存在同一列中，各作品类型的默认值仍独立修改。修改小说设置不能覆盖漫画、游戏等无关字段。漫画和小说的作品、文件自定义都保存完整 ReadingPreferences，不复制整个 usage，也不另建结构相同的类型别名。使用时先选定一套完整配置，再按实际内容采用各项设置，不对 pages、text 或 colors 分别继承。

<a id="reading-values"></a>

## 阅读配置与字体选择

ReadingPreferences 是 Kisaki 自己的产品与持久化合同，由本体维护结构、默认值、校验、资源身份和保存规则。它不导入或派生 Kana ReadingSettings，不采用内核的默认值或解析函数读取偏好。阅读接入在运行时解释已选配置并转换为所用内核的输入，具体边界见[偏好与内核设置](reader.md#settings-boundary)。

配置按阅读流、原始页面、正文排版与阅读配色组织：

```ts
interface ReadingPreferences {
  flow: 'paginated' | 'continuous'
  pages: {
    arrangement: 'single' | 'spread'
    progression: 'document' | 'ltr' | 'rtl'
    firstPage: 'single' | 'paired'
    fit: 'page' | 'width' | 'height'
    autoCrop: boolean
    brightness: number
    contrast: number
  }
  text: {
    pagesPerView: 1 | 2
    writingMode: 'document' | 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'
    font: { type: 'document' } | FontRef
    fontSize: number
    lineHeight: number
    paragraphSpacing: 'document' | number
    alignment: 'document' | 'start' | 'justify'
    padding: number
    maxLineLength: number
  }
  colors:
    | { type: 'document' }
    | { type: 'theme' }
    | { type: 'custom'; foreground: string; background: string }
}
```

flow 决定主阅读分页推进还是连续移动。pages 描述具有原始页面身份的内容，包括 PDF、图片成员和固定版式出版物；text 描述可重排正文，正文内的普通插图仍参与其排版。是否存在可选文字或图片不能代替内容性质判断。

本体默认值与字段含义如下；getDefaults、初始化及校验共用本体自己的定义：

| 字段                  | 默认值        | 含义与单位                                                                 |
| --------------------- | ------------- | -------------------------------------------------------------------------- |
| flow                  | paginated     | 主阅读的分页推进或连续移动，进入其他内容单元不自动切换                     |
| pages.arrangement     | single        | 原始页面的单页或对页编组，不表示视口内可见页总数                           |
| pages.progression     | document      | 原始页组中的推进和左右顺序；跟随文档时，缺少明确声明继续采用既定 rtl 基线  |
| pages.firstPage       | single        | 缺少明确页位时，正文路径起始原始页单独显示，或从第一张参与正常配对         |
| pages.fit             | page          | 适配整张原始页面、宽度或高度；实际倍率由当前视口计算                       |
| pages.autoCrop        | false         | 在显示时自动识别并裁去原始页的空白边缘，不改写源文件与位置                 |
| pages.brightness      | 1             | 原始页面整体画面的亮度倍率；0–2 的有限数                                   |
| pages.contrast        | 1             | 原始页面整体画面的对比度倍率；0–2 的有限数                                 |
| text.pagesPerView     | 1             | 正文分页时明确选择的生成阅读面数，仅接受 1 或 2                            |
| text.writingMode      | document      | 正文主书写模式；显式值准确区分横排、从右向左推进的竖排与从左向右推进的竖排 |
| text.font             | document 选择 | 文档字体、系统字体或字体库引用                                             |
| text.fontSize         | 20            | 正文根基准字号，CSS px，正有限数                                           |
| text.lineHeight       | 1.8           | 正文基准行高倍率，正有限数                                                 |
| text.paragraphSpacing | document      | 跟随文档或采用明确段距；数值为正文基准 em，非负有限数                      |
| text.alignment        | document      | 跟随文档、按行起点对齐或两端对齐                                           |
| text.padding          | 24            | 正文阅读区域四边的内部留白，CSS px，非负有限数；分页与连续正文都适用       |
| text.maxLineLength    | 36            | 正文区域沿行方向的长度上限，以正文基准 em 计，正有限数；不是精确字符数量   |
| colors                | theme 选择    | 原书配色、跟随本次采用的应用配色，或明确的前景与背景值                     |

document 统一表示跟随文档规则；文档未声明时，原始页推进采用 rtl，正文主书写模式采用 horizontal-tb。paragraphSpacing 的 document 不表示空值或继承上一级。autoCrop 表示启用自动裁边算法。配置合法性、资源不可用、来源层级和当前不适用分别处理。

fontSize 与 padding 使用 CSS px，lineHeight 使用倍数，paragraphSpacing 的数值与 maxLineLength 使用正文基准 em。maxLineLength 限制沿文字行方向的长度，横排对应宽度、竖排对应高度，不表示精确字符数量。所有数值均须有限；正文基准字号、行高和行长为正数，留白和明确段距为非负数，亮度及对比度为 0–2。custom 配色只接受合法颜色值，不接受任意 CSS 或 URL。

pages.firstPage 只在缺少明确页位时参与正文路径起始原始页的配对，single 表示首张独立显示，paired 表示从首张参与正常配对。跳转、重新打开和进入中途插图不会重设这项起始规则。显示裁边、亮度和对比度不改变源文件、原始坐标或系统显示器设置。

字体选择采用[FontRef](appearance.md#fonts)和阅读用途的 document 分支。fontSize 调整正文根基准，同时保留标题、小字和 ruby 的相对层次，不保证每个段落都等于该数值；强调、图片、诗歌、表格及必要空白保持自身结构。所选字体用于普通阅读文字，特殊字形及局部结构遵守[内核样式边界](../projects/kana/styles.md)；行高、段距与对齐分别作用于普通正文，不清除其他结构。正文阅读区域留白不直接作为任意源元素的 margin。正文字号独立于应用缩放。

colors 的 document 选择保留可重排正文的作者颜色与文档画布，区域外底色在本次采用时取应用主题；theme 将本次应用主题解析为明确前景与背景；custom 使用已保存的 foreground／background。后两者成对覆盖普通阅读文字与普通色块，可能统一原书仅靠颜色表达的区分；document 则可能在暗色界面中保留白底书页。编辑器分别表达“原书配色”“跟随界面”“自定义”，默认仍为 theme。

原始页面保留本色，区域底色可见于页面之外及透明区域，不统一重着色扫描图、PDF 或固定 SVG；正文插图及必要图文背景按内核规则保留整体关系。阅读外壳遵守应用外观规则，不另建阅读主题注册体系。三种颜色选择按完整配置保存和恢复；本体不保存 Kana 的运行时区域底色或由 theme 解析出的颜色快照。

fonts 负责字体库及附件引用，同一字体族可以包含多个字重。复制配置只复用引用，关闭自定义或暂时不再选用都不自动删除字体。资源暂时不可用时保留选择并说明回退；书内字体与扩展私有字体不自动进入用户字体库。资源管理见[外观与字体](appearance.md)。

<a id="conditions"></a>

## 合法性、适用条件与实际版式

配置是否合法、是否适用于当前内容，以及所需资源是否可用，需要分别判断。结构和值域始终校验，合法但暂时不适用的值继续保留；不能因为当前使用滚动模式，就允许保存非法页数。资源不可用时按所属业务决定回退或失败，不一律静默忽略。切换模式不会隐式清空其他选择，实际显示中的回退也不会反写偏好。

条件规则由所属模块的类型、校验和必要判断实现，运行状态按这些规则派生。FontRef 等具有不同身份分支的值使用判别联合。完整编辑器可以保留暂不适用的字段并禁用、说明原因；整块未启用功能按自身规则收起，快捷控制只展示当前适用项。控件判断依据正在编辑的草稿分支，当前应用采用亮色时也可以编辑暗色主题。正常的不适用状态直接在控件中表达。

漫画和小说都按实际内容采用 ReadingPreferences 中适用的设置。Work 类别、文件后缀和正在编辑的配置分组都不能代替内容解释。完整编辑器按“阅读方式、原始页面、正文排版、配色”组织，使用同一份草稿；切换分组不转换文档，也不保存当前版式。具体内核通过[阅读接入](reader.md#settings-boundary)使用这些选择，不决定主应用的偏好结构。

同一文件含有混合版式时，保持本次完整快照中的 flow，分别采用原始页面与正文的呈现参数，不重新选择配置层级，也不建立新会话。漫画与小说遵守同一规则，实际界面按当前内容展示适用控件。

可重排内容支持一次显示一面或两面的分页，以及不分页的长文滚动，不额外提供将动态分页结果连续排列的视图。原始页面支持单页或对页编组的分页与连续浏览，始终保留源页身份。pages.arrangement 与 text.pagesPerView 独立保存；连续正文保留但不采用分页面数，原始页面的编组则在两种 flow 下都适用。

原始页对页表示每组左右两个页面槽位，实际配对尊重文档明确页位和独立显示约束。连续浏览时可以同时看见多个组，arrangement 不描述可见页总数。正文 pagesPerView 为 2 时生成左右阅读面，末屏按正文顺序填充；它不表示两个源页。空位不增加源页、进度或标注身份，分页在固定／重排交界结束当前配对。正文双面、独立插图单面是合法的完整配置。明确选择的一／双面不因窗口变窄而自动切换，正文基准字号也不为容纳双面而缩小；实际无法排版时反馈失败，保存值不被改写。

长文滚动应在同一文件中自然跨章节阅读，并按源顺序衔接固定插图。内核可以分段加载，但不能要求用户逐章重新打开。字段重新适用后，仍按所属模块的时机采用，不因此统一改成全局热更新。

<a id="updates"></a>

## 修改单位、并发规则与 API

get 按读取规则返回当前选择及必要的不可用信息，保留其他可用字段，凭据只返回状态。getDefaults 返回当前完整默认值，不产生写入。schema 中声明的静态默认值与 getDefaults 引用同一份定义，SQL DEFAULT 通过迁移更新；依赖应用上下文的值按平台快捷键和初始语言建议的共同规则取得。update 接收 changes 与可选 expected，提交完成后返回保存值。onInvalidated 通知正式值变化。SDK 不另存一套默认值；首次插入与明确恢复默认共用这份默认配置。

JSON 列负责持久化存储，表单按实际修改字段提交并核对相应基线。例如，只调整导航常显数量时：

```ts
preferences.update({
  changes: {
    navigation: { visibleLimit: 5 }
  },
  expected: {
    navigation: { visibleLimit: 7 }
  }
})
```

主进程在短事务中读取当前值，检查相关基线，合成实际修改，完整校验本次提交的业务值及相关跨字段约束后写回，同时保留未涉及的原值和无关并发修改。读取采用缺省不表示用户提交了该缺省，不能借修改一个字段覆盖其他异常字段。独立字段分别修改，数组整体替换；译本、主题、字体等身份选择按完整引用替换，代理凭据按本页的完整凭据合同处理。changes 和 expected 覆盖的范围必须对应。接口不开放 JSON 路径、递归合并补丁，也不通过整组 revision 阻挡无关修改。

数组整体替换只针对本次修改的数组字段。例如保存导航排序草稿时，提交完整的 order 数组，并核对该数组的原值；visibleLimit 和其他偏好保持不变。接口不按数组下标局部修改，也不猜测追加、删除或合并的含义。

跨组修改可以一次提交，只有全部条件通过才写入。冲突或校验失败不产生部分保存，编辑草稿继续保留。expected 的具体要求遵守[并发提交](library-operations.md)；省略基线的直接操作不能被界面当作受保护的表单保存。

get 表达保存的意图，实际外观、网络连接、播放控制或快捷键注册状态由对应能力报告。update 成功只表示持久化完成，运行采用失败要独立反馈，不能伪装成保存失败。播放器的即时保存由 sessions 组合本次持久写入与当前实例采用，不通过偏好失效通知联动其他播放器。系统不为偏好增加通用执行任务。

<a id="editor"></a>

## 偏好编辑与资源管理

偏好表单分组如下：

| 分组     | 表单范围                                             |
| -------- | ---------------------------------------------------- |
| 通用     | 界面语言、关闭主窗口后的行为                         |
| 外观     | 主题、明暗模式、界面缩放                             |
| 导航     | 导航顺序、常显数量                                   |
| 资料库   | 敏感内容默认可见范围、本地内容自动刷新               |
| 使用     | 通用计时偏好，以及游戏、动画、漫画、小说的各自偏好   |
| 快捷键   | 按主窗口、阅读器、播放器与游戏面板分组的应用快捷键   |
| 网络     | 代理模式、手动代理与认证                             |
| 更新偏好 | 自动检查、接收预发布版本；更新操作由独立 Dialog 负责 |

同一个偏好编辑器共用一份草稿，切换分组不会丢失修改。保存只提交实际变更，放弃丢弃当前草稿，“恢复本组默认”也只调整该组草稿。偏好编辑没有临时预览，语言、主题选择、缩放、导航和快捷键都在保存后生效；阅读和播放默认值按各自时机采用。涉及重启、连接或注册的配置，应分别说明保存状态与实际采用状态。

preferences 负责选择资源，appearance 管理主题，fonts 管理字体，attachments 管理字节。主题和字体选择器可以提供通往相应管理界面的入口，直接复用所属模块的创建、编辑、导入和删除能力。打开管理界面时保留偏好草稿，管理操作独立保存，返回后刷新资源目录。新建或修改资源不会自动提交偏好；用户明确选用后，才按当前编辑意图更新选择草稿。不可用的选择仍如实保留。应用字体在主题编辑器中设定，阅读正文字体在阅读偏好中设定，不另加全局界面字体覆盖。

主题和字体通过各自应用入口及搜索管理，无需各占一个常驻侧栏位置。主题编辑器有独立草稿和全应用预览。“保存并选用”是 appearance 与 preferences 的明确组合操作，主题本身不保存当前是否选用。恢复或放弃偏好不会删除资源，不会撤销其他编辑器已经保存的内容，也不改变系统自启动、协议关联或便携选择。

扫描器、资料方案、启动配置、扩展私有设置、系统集成和更新操作都在各自界面管理。偏好页按当前任务提供相关入口，不承担所有模块的管理导航。更新偏好可以打开既有更新 Dialog；该 Dialog 使用正式偏好，打开或关闭都不提交偏好草稿。没有打开作品时，用户仍可编辑全局阅读和播放默认值；作品及文件自定义则在对应入口编辑，各处使用相同合同。

导航顺序和常显数量在共同草稿保存后生效；侧栏“更多”面板中的拖动则可在完成后即时提交。两处复用展示与移动逻辑，排序组件本身不负责持久化，并发冲突按实际修改单位检测。

<a id="visibility"></a>

## 敏感内容与剧透的查看范围

library.showNsfw 默认 true。全局修改会更新仍在使用默认范围的普通查看；用户已经明确选择临时范围的查看，则保留该选择直到本次查看结束。Entry、标签和合集的 is_nsfw 各自作用于自身，不向关联对象传播。数据默认标记为 FALSE，与应用默认允许显示，是两个独立事实。

涉及剧透的关联固定默认隐藏，preferences 不提供可修改的全局剧透开关，也不放置同名只读项目。用户可以在当前查看或整理过程中主动显示剧透，或恢复隐藏。这个入口始终可见，不取决于数据库中是否存在隐藏记录。临时选择不传播到其他窗口，不保存为条目偏好，也不会因作品完成状态自动解除。

同一目标内切换页签、分页、排序或刷新时，保留临时范围；新开独立查看、换目标或结束当前流程时，回到默认。范围寿命由真实导航和编辑流程决定，不能因组件重新挂载而提前清除，也不能因页面缓存而意外延续。敏感内容的临时选择使用相同边界。

浏览、关系、筛选、计数、分组、反向列表和定位共用相应可见范围，并遵守[关系维护](relations.md)与[库查询](library-queries.md)的反馈及修改规则。切换范围不修改记录标记或已保存条件。后台查重、身份核对、资料采用、合并删除和完整整理仍依据真实数据；隐藏不表示不存在，也不表示用户要求解除关联。

<a id="network"></a>

## 代理配置与受保护凭据

network.mode 支持 system、direct 和 manual，默认 system。手动模式接受一个明确的 HTTP、HTTPS 或 SOCKS5 端点、Electron bypass 规则及适用的认证，用户名和密码不能嵌入 URL。复杂 PAC 或路由交由系统模式处理，应用不另建路由编辑器。切换模式保留手动配置，但启用 manual 时必须确保配置有效。

HTTP 认证使用公开底层能力。SOCKS5 不提供 Chromium 不支持的认证输入，具体限制见[Chromium 代理文档](https://github.com/chromium/chromium/blob/main/net/docs/proxy.md)。network 只在 ClientRequest login 的代理标记、主机和端口均匹配时提供代理凭据，网站登录仍由扩展负责。

凭据不进入 network JSON，也不保存到 extension_secrets。preferences 中的 proxy_credentials_ciphertext 与 proxy_credentials_revision 必须同时有值或同时为空。保存复用[凭据保护](../extensions/private-data.md)：先准备密文，再与普通字段一起在短事务中核对并写入。codec 不执行加解密。

读取 network.credentials 只得到 null 或 { revision }，不能取得用户名、密码或密文。changes 没有 credentials 时保持原值，传 null 时删除，传完整 { username, password } 时替换，不能混合不同快照中的用户名和密码。替换或删除必须在 expected.network.credentials 中提供同次读取的原状态。只有实际修改凭据时才核对局部 revision，替换产生新标记，不增加全行版本。

原生设置使用完整读写合同，SDK 的普通偏好能力没有凭据读写入口。保存失败保留草稿，不能部分提交。保存成功后，由 network 采用配置并按需重建连接；运行采用失败要如实报告，不能暗中改为直连。系统保护不可用或密文不可读时，按凭据合同处理。

<a id="overrides"></a>

## 作品和文件的完整自定义

阅读或播放时，按文件、作品、全局的顺序选择最具体且已启用的完整配置，不逐字段继承。作品使用自己的偏好表，文件使用可空配置列。非空配置单元包含 enabled 和完整 settings；没有配置单元表示尚未建立自定义。关闭自定义会保留 settings，重新启用时恢复原配置。漫画和小说先选择完整 ReadingPreferences，再采用当前内容适用的值，pages、text 与 colors 不能分别继承不同层级。

各项自定义操作的含义如下：

| 操作           | 行为                                               |
| -------------- | -------------------------------------------------- |
| 首次启用自定义 | 从上一级当前采用的完整配置初始化草稿，然后允许修改 |
| 关闭自定义     | 采用上一级，保留自己的配置                         |
| 再次启用       | 恢复之前保存的自定义配置                           |
| 从上一级复制   | 明确替换自定义草稿的整套设置                       |

启用后，整套配置独立于上层。即使只修改一个字段，其他字段也不会继续跟随上层变化。复制时保留 document、theme 等跟随意图，不复制当前观察值、临时地址或轨道编号。自定义关闭时，界面展示当前采用来源的摘要并收起编辑区。“恢复继承”和“从上一级复制”必须分别表达，不能使用含糊的同一个动作。

开关、首次初始化、复制和字段调整都进入同一份草稿，保存时一起提交。放弃不改变正式配置或当前内容。复制后，上层再次变化也不会改动用户已经看到的草稿。已有完整配置可以只修改实际字段，以保留并发发生的无关变化；创建、复制和启用状态改变则核对各自实际影响范围。运行中的临时控制不会自动开启自定义。

播放器快捷倍速属于临时控制，只影响当前文件。下一集、切换文件或关闭后重开时，按既有层级采用目标完整配置中的 playbackSpeed，不携带上一文件的临时值。全局、作品和文件中的默认倍速仍通过对应配置编辑器明确保存；在当前播放器明确保存并采用完整配置时，按下表更新实际播放设置。

实际打开文件时，运行器先选择完整配置，再解释文档的自动选项，形成此次使用快照。切换下一文件、连播下一集、关闭后重新打开时重新采用配置。暂停后继续、聚焦、翻页、同文档章节切换和重新排版都不会重新选取。管理界面保存配置不重新配置已经打开的内容；当前运行器中的完整配置编辑器保存按以下规则处理：

| 本次操作与当前采用来源                   | 当前内容的行为                   |
| ---------------------------------------- | -------------------------------- |
| 修改的配置正被当前内容采用               | 应用保存后的完整配置             |
| 修改作品配置，但当前文件启用了自己的配置 | 保持文件配置                     |
| 启用开关改变当前采用来源                 | 应用新选中的整套配置             |
| 其他窗口正在使用相关作品或文件           | 保持自己的运行状态，下次打开采用 |

将整套配置应用到当前内容时，保留位置和使用记录，不将它视为重新打开。系统不额外保存持久会话配置，也不提供通用的“立即或下次应用”选项。数据库保存结果与实际呈现结果分别反馈。应用主题、语言和缩放仍遵守应用 UI 自身的生效合同。

播放器的快捷字幕大小使用[单项即时保存](sessions.md#subtitle-scale)：已有文件自定义正被采用时写入该文件，否则采用作品自定义时写入该作品，再否则写入全局动画默认。只保存 subtitleScale 并调整当前播放器的该值，不应用整套配置，不保存或重置临时倍速，也不自动开启自定义。来源由实际会话提供，界面明确显示“全局”“本作品”或“本文件”。这项操作不改变其他打开实例；后续打开继续按正常层级采用配置。

字幕的默认显示、语言和缩放属于完整播放配置，实际音轨与外挂字幕属于文件选择。临时显示或隐藏字幕只影响本次播放；选择字幕可以显示并记住轨道，但不会自动启用文件自定义。重新打开时，先采用完整配置中的默认显示意图，再使用文件轨道选择或语言匹配。若希望长期对某个文件关闭字幕，用户须明确保存到该文件自定义中，不另加布尔覆盖层。

<a id="game-and-shortcuts"></a>

## 游戏面板与快捷键

游戏面板默认值如下：

| 面板偏好           | 默认值       |
| ------------------ | ------------ |
| 游戏开始时显示面板 | 关闭         |
| 面板显示时置顶     | 开启，可关闭 |

游戏偏好保存面板的自动显示与置顶选择。启动与监测规则属于启动配置，暂离宽限属于 usage。会话结束时面板按固定生命周期关闭，未保存编辑沿共同关闭流程处理。位置、尺寸、折叠和关闭方式见[游戏面板](games.md#panel)。

快捷键使用以下固定配置键：

```ts
type ShortcutKey =
  | 'main.search'
  | 'main.preferences'
  | 'editor.save'
  | `reader.${
      | 'find'
      | 'left'
      | 'right'
      | 'up'
      | 'down'
      | 'previous'
      | 'next'
      | 'fullscreen'
      | 'addAnnotation'
      | 'toggleAnnotations'
      | 'toggleTiming'
      | 'viewWork'}`
  | `player.${
      | 'playPause'
      | 'seekBackward'
      | 'seekForward'
      | 'volumeUp'
      | 'volumeDown'
      | 'toggleMute'
      | 'toggleSubtitles'
      | 'fullscreen'
      | 'addAnnotation'
      | 'toggleAnnotations'
      | 'toggleTiming'
      | 'viewWork'}`
  | `game.${'addAnnotation' | 'toggleAnnotations' | 'togglePanel' | 'toggleTiming' | 'viewWork'}`
```

每个固定快捷键保存 { enabled, accelerators }：enabled 默认 true，accelerators 为经过校验和去重的 Electron Accelerator 数组，[] 表示未绑定。默认组合、系统级范围与注册寿命见[导航与快捷键](../ui/navigation.md)，getDefaults 返回同一套完整值。该目录管理本体快捷键配置，动作由原生界面和会话执行；基础输入框、菜单与 Dialog 维护自己的按键行为。

游戏面板还提供返回实际游戏、标注、作品详情、计时和置顶切换等操作；新建标注须先采集游戏图像。需要在游戏前台操作的动作支持系统绑定，先依据前台游戏或面板确定目标。前台面板直接对应自身会话；前台游戏进程被多个会话观察时，在这些会话中选择。没有前台归属但只有一个会话时使用该会话；多个会话无法明确区分时让用户选择，不能广播或任意选取。
