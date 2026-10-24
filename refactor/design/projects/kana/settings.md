# Kana 呈现设置

本页定义内核设置、默认值、单位和合法范围；宿主偏好及配置层级由宿主自己拥有。

<a id="principles"></a>

## 呈现设置的输入模型

| 输入   | 内核负责的决定                                   |
| ------ | ------------------------------------------------ |
| flow   | 主阅读按分页推进或连续移动                       |
| pages  | 原始页面的编组、推进、起始配对、适配与画面调整   |
| text   | 可重排正文的生成阅读面、书写模式、字体及排版尺寸 |
| colors | 原书配色或明确阅读颜色，以及已解析的区域底色     |

pages 作用于具有原始页面身份的内容，包括 PDF、图片成员与固定版式出版物，即使其中有可选文字。text 作用于可重排正文；普通行内插图仍参与该正文布局。格式提供内容性质，内核不依赖宿主的漫画／小说类别或设置分组名称判断。

flow 属于同一个主阅读流程，原始页面编组与正文分页分别由其实际能力处理。一个 view 拥有者协调当前内容与混合边界，各呈现实现不持有另一套主位置、跳转历史或配置来源。实际缩放、旋转、可见面数、位置和加载状态不进入这份设置。

<a id="shape"></a>

## 纯值与运行资源

```ts
export interface ReadingSettings {
  readonly flow: 'paginated' | 'continuous'
  readonly pages: {
    readonly arrangement: 'single' | 'spread'
    readonly progression: 'document' | 'ltr' | 'rtl'
    readonly firstPage: 'single' | 'paired'
    readonly fit: 'page' | 'width' | 'height'
    readonly autoCrop: boolean
    readonly brightness: number
    readonly contrast: number
  }
  readonly text: {
    readonly pagesPerView: 1 | 2
    readonly writingMode: 'document' | 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'
    readonly font: ReadingFont
    readonly fontSize: number
    readonly lineHeight: number
    readonly paragraphSpacing: 'document' | number
    readonly alignment: 'document' | 'start' | 'justify'
    readonly padding: number
    readonly maxLineLength: number
  }
  readonly colors:
    | { readonly type: 'document'; readonly background: string }
    | {
        readonly type: 'custom'
        readonly foreground: string
        readonly background: string
      }
}
```

ReadingFont 属于 Kana，表示文档字体、系统 family 或本次提供的字体资源 id。FontResource 另外提供可读字节和字重、样式等信息。技术合同不接收主应用 FontRef、ThemeRef、附件 id、全局／作品／文件来源或自定义启用状态。

单个页面编组、正文双面分页、方向、基准字号等都是内核必须真实支持的能力。接入不能为了适配某个接口形状而丢弃一个已选择的编排值，也不通过导航时反复改设置制造缺失的能力。

### 一个流程中的独立呈现参数

pages.arrangement 决定原始页面按单页或左右对页组排列，分页与连续模式都适用。spread 不承诺一定有两张源页；作者明确页位和独立显示约束参与实际配对，空位不获得源身份。

text.pagesPerView 决定正文采用分页呈现时每次明确选择一个或两个生成阅读面，竖排也按物理左右阅读面解释。它不统计源页，不直接等同于 CSS 分栏数量。连续正文没有这种分页，仍保留该值以供切回分页时采用。

| 场景                                | 内核行为                                     |
| ----------------------------------- | -------------------------------------------- |
| 分页原始页，arrangement 为 spread   | 按源页序形成对页组，每次推进一组             |
| 连续原始页，arrangement 为 spread   | 对页组连续排列，视口可能同时看见多个组       |
| 分页正文，pagesPerView 为 2         | 正文生成两个阅读面，按阅读顺序填充           |
| 连续正文，pagesPerView 为 2         | 保持未分页正文，不生成两条并行正文流         |
| 分页混合文档，原始页 single、正文 2 | 正文双面、独立原始页单面，主阅读仍按分页推进 |

固定／重排交界结束当前配对；源顺序、源位置和正式跳转历史不因编排选择改变。

<a id="values"></a>

## 内核默认值、单位与合法范围

getDefaultSettings 返回独立的新设置值，面向直接使用 Kana 的消费者。以下默认值由 Kana 自己维护，与主应用的默认值没有导入、调用或自动同步关系。宿主使用自己的偏好时，须明确传入经过接入转换的完整设置；不能通过调用本函数来初始化或修复主应用的持久配置。

| 字段                  | 库默认值                                       | 含义与单位                                                                 |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| flow                  | paginated                                      | 主阅读的分页推进或连续移动，进入其他内容单元不自动切换                     |
| pages.arrangement     | single                                         | 原始页面的单页或对页编组，不表示视口内可见页总数                           |
| pages.progression     | document                                       | 原始页组中的推进和左右顺序；跟随文档时，缺少明确声明继续采用既定 rtl 基线  |
| pages.firstPage       | single                                         | 缺少明确页位时，正文路径起始原始页单独显示，或从第一张参与正常配对         |
| pages.fit             | page                                           | 适配整张原始页面、宽度或高度；实际倍率由当前视口计算                       |
| pages.autoCrop        | false                                          | 在显示时自动识别并裁去原始页的空白边缘，不改写源文件与位置                 |
| pages.brightness      | 1                                              | 原始页面整体画面的亮度倍率；0–2 的有限数                                   |
| pages.contrast        | 1                                              | 原始页面整体画面的对比度倍率；0–2 的有限数                                 |
| text.pagesPerView     | 1                                              | 正文分页时明确选择的生成阅读面数，仅接受 1 或 2                            |
| text.writingMode      | document                                       | 正文主书写模式；显式值准确区分横排、从右向左推进的竖排与从左向右推进的竖排 |
| text.font             | document 选择                                  | 文档字体、系统字体或本次字体资源 id                                        |
| text.fontSize         | 20                                             | 正文根基准字号，CSS px，正有限数                                           |
| text.lineHeight       | 1.8                                            | 正文基准行高倍率，正有限数                                                 |
| text.paragraphSpacing | document                                       | 跟随文档或采用明确段距；数值为正文基准 em，非负有限数                      |
| text.alignment        | document                                       | 跟随文档、按行起点对齐或两端对齐                                           |
| text.padding          | 24                                             | 正文阅读区域四边的内部留白，CSS px，非负有限数；分页与连续正文都适用       |
| text.maxLineLength    | 36                                             | 正文区域沿行方向的长度上限，以正文基准 em 计，正有限数；不是精确字符数量   |
| colors                | custom；foreground #1f1f1f，background #ffffff | 原书配色与明确阅读配色的技术选择；区域底色始终已解析，不接收应用主题身份   |

数值按表中范围校验。颜色只接受合法颜色值，不接受任意 CSS 或 URL。纯解析规则归 Kana，不读取宿主配置。

document 选择采用格式与文档规则；未声明时，原始页推进采用 rtl，正文主书写模式采用 horizontal-tb。宿主的配置继承在接入前完成，document 在内核中保持上述明确含义。字体和配色通过带 type 的分支承载各自输入，普通标量直接保存其值。

pages.firstPage 的适用位置与作者页位优先序见[布局规则](layout.md#authored-layout)。autoCrop、亮度及对比度只改变显示，源字节与原始几何保持不变。

### 逻辑行方向与正文基准

horizontal-tb、vertical-rl 与 vertical-lr 按 [CSS Writing Modes](https://www.w3.org/TR/css-writing-modes-4/#propdef-writing-mode)解释行与块方向。该设置决定正文的主要书写方向，局部混排、ruby、诗歌和表格保留自身结构、布局及源对应。

maxLineLength 以正文基准 em 限定行方向的可用长度，横排对应宽度，竖排对应高度，实际可容纳的字符数由排版决定。逻辑与物理尺寸的对应见 [CSS Logical Properties](https://www.w3.org/TR/css-logical-1/#dimension-properties)。padding 设置正文阅读区域的内部留白，在分页与连续正文中都生效；源元素的 margin 按原有布局含义参与排版。

fontSize 及其他文字设置按[读者样式规则](styles.md)作用于正文和特殊结构。面数选择、作者页位与空间不足的处理见[阅读布局](layout.md#space)。

### 原书配色与已解析的阅读颜色

document 接收阅读区域外的 background，custom 接收成对的 foreground 和 background；宿主主题或自定义颜色均先解析成这些技术值。两种选择的覆盖范围、图文保护及视觉代价统一见[配色规则](styles.md#colors)。

原始页面的亮度与对比度作用于内容画面，宿主工具栏和系统显示器保持原样。宿主持有配置来源及保存时机，Kana 按本次输入呈现。

<a id="editing"></a>

## 采用设置与宿主边界

openReader 和 setSettings 接收完整设置，采用、字体资源与运行状态的处理由[设置操作合同](api.md#settings)定义。

主应用偏好的字段、层级、默认值或保存方式变化，不自动改写 Kana 接口。Kana 新增技术能力也不自动变成主应用偏好。两边只有实际接入需要使用的含义必须对齐；同义纯值可以直接转换或复用，不为制造表面差异增加无意义包装。

任一侧接口变化时，先核对字段语义与接入转换。能够保持产品含义时更新转换；能力不足时补齐内核能力，或明确讨论产品行为调整。双方合同按各自用途维护，接入负责完整落实用户选择。
