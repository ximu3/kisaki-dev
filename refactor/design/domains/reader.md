# 阅读内核、源位置与应用接入

Kana 负责文档读取、排版、内容交互和源位置恢复。Kisaki 负责作品与文件选择、阅读界面、使用会话、偏好和正式记录。两者通过阅读接入连接，由接入核对双方的值语义、资源及生命周期。

<a id="scope"></a>

## 支持格式与职责

阅读器是独立的界面程序，只加载所需启动上下文并验证目标。漫画和小说共用同一套阅读能力，固定页面与文本重排由文档实际内容决定，不按 Work 类别限制版式，也不分别复制呈现、导航和定位实现。Work 类别负责资料组织、卷话导航和个人记录的归属。

| 呈现方式 | 必须覆盖的格式与行为                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| 固定页面 | ZIP／CBZ、图片目录、PDF、固定版式 EPUB／KF8；页序、缩放、适用的单/双页、连续滚动与阅读方向 |
| 文本重排 | 可重排 EPUB、MOBI、AZW3/AZW、FB2、TXT；目录、定位、字体、排版和重排后的进度                |
| 共同交互 | 打开与失败状态、单元导航、键盘、全屏、退出、进度、位置恢复与标记                           |

上表的能力同时适用于漫画和小说。内核根据实际文档结构确定版式，文件后缀和作品类别都不能代替内容解析。固定页面保留原有画面与空间关系，可重排内容按适用设置排版。固定页面中的可选择文字仍可检索、高亮和标注；同一文档包含两种版式时，按各部分实际结构完整呈现，不丢弃合法文字章节，也不强制转换版式。

RAR／CBR 已移出直接阅读范围，具体边界见[已确认格式范围](../projects/kana/formats.md#format-scope)。文件识别按实际容器内容；范围收缩不自动改写用户文件或正式记录。

固定页面与可重排正文由文档内容决定，分页与连续滚动决定如何组织显示。用户选择适用于当前内容的单双页、字号或缩放等设置，采用层级见[完整自定义](preferences.md#overrides)。

PDF 使用共同的分页引擎。目录和章节由内容提供，只有具有独立资料与记录价值的单元，才成为 catalog 中的 Part。

独立项目的展示名为 Kana，仓库名为 kana，npm 包为 @ximu3/kana。项目使用 TypeScript 自主实现，独立维护版本和公开文档。品牌取自《大图书馆的牧羊人》的铃木佳奈；公开接口使用 openReader、ReadingLocation 等职责名称，不统一增加品牌前缀。Kisaki 消费明确的公开发行版本，不把 Kana 放进本仓库 packages，也不依赖其私有源文件。

| 部分                 | 责任                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Kisaki 阅读器        | 应用窗口与工具栏、作品及文件选择、使用会话、个人设置接入、计时，以及位置和 Annotation 的正式保存 |
| 独立阅读内核         | 文档读取、重排与固定页面呈现、内容导航与搜索、稳定位置与文字选区，以及应用所需的内容交互接口     |
| 内核的格式与资源适配 | 图片目录、归档、TXT、EPUB 等格式，以及 PDF.js 等底层能力的接入和资源生命周期                     |

Kana 与 UI 框架无关，可以使用 PDF.js、浏览器排版和适用解压能力，并维护依赖来源。固定页面的单页、双页和连续滚动属于同一呈现职责。发行合同提供所需 PDF worker、字体和解压资源；Kisaki 负责验证实际制品及接入。应用界面遵守[共同 UI](../ui/components.md)。

<a id="work-navigation"></a>

## 作品内容列表与相邻项

漫画和小说的作品详情与阅读器都提供“资料”和“文件”两种查看方式，以当前作品为完整范围，读取同一批正式对象及其当前顺序。详情页与阅读器各自保存查看方式和筛选状态，不互相驱动。资料列表按[漫画的卷、话及收录范围](comics.md#sequence)或[小说卷](novels.md#sequence)组织；文件列表包含本作品全部阅读文件，每个文件只出现一次，按规范路径的自然数字顺序、id 排列。

资料可以按完成状态等适用条件筛选，文件可以按目录、关联情况和已保存的可用性筛选。筛选只影响显示，不产生阅读清单，也不改变相邻项的范围。例如，只显示未读的第 3、5、8 卷时，从第 3 卷执行下一卷仍指向完整顺序中的第 4 卷。文件视图的下一文件同样使用完整文件顺序，可以依次打开不同格式或版本，但不把它们记成不同分部。

主按钮、分部行、文件行和深链只确定实际打开目标，不把入口的筛选结果或选择集合交给阅读器作为固定序列。查看方式和筛选变化不立即切换内容，不修改文件首选、位置、完成状态或计时。资料、收录及文件变化后正常刷新列表，保留仍有效的查看范围；后来补入分部不会抢先切换用户正在使用的视图。

相邻项由本体按当前作品、所查看的资料范围或文件视图、可确定的当前项及完整顺序解析。界面显示动作含义和实际下一项，不能只读取已加载的局部行或跳过被筛选隐藏的目标。请求发出后固定实际目标，执行时再核对归属和关联；目标变化时明确报告，不静默换成另一项。真正切换时才按该目标的当前关联与首选选择文件。

当前文件不能唯一确定所在卷或话时，不根据点击入口、文件位置或关联顺序猜测当前分部。用户仍可明确打开其他资料项，或使用文件、目录和书签导航。多个分部指向同一合订文件且没有准确范围时，复用同一文件会话，保留位置，不归零、不伪装分部跳转，也不自动跨过这些分部。

阅读到末尾时停留，不自动打开下一文件。用户明确切换后，目标恢复自身位置；准备失败保留仍可用的原内容，实际切离后的失败如实说明阶段。会话切换、草稿归属和收尾遵守 [sessions](sessions.md#switch)。系统只持有当前视图、范围和必要查询结果，不保存固定成员副本或持久阅读队列。

<a id="content-boundary"></a>

## 文档内容与资源边界

书内 HTML、SVG 和 CSS 在隔离文档范围中呈现，不能进入应用特权上下文、取得窗口 API 或 SDK，也不能通过样式影响工具栏。Kana 负责解析、受限呈现和源映射，Kisaki 负责资源授权及外部导航。

文档脚本、事件属性和可执行动作不运行，外部网络资源不自动加载。图片、字体和样式只能从本次授权范围读取，归档成员及路径遵守[资源访问](resources.md)合同。用户明确选择一个 URL 文档，并不授权该文档引用的任意网络资源。

这些限制下，常规排版、文字选择和应用阅读交互仍须完整可用。依赖书内脚本或自动联网的互动电子书不在支持范围。内部链接由内核在文档内导航；外链必须由用户点击，再交给应用按目标和协议处理，不能触发任意命令、文件或窗口能力。PDF 可执行动作遵守同样限制。

验收夹具同时覆盖脚本、事件属性、越界路径、外部资源、链接和 CSS，以及正常排版、选区、定位和标注，不能只验证隔离而忽略阅读能力。 具体机制按[内容文档职责](../projects/kana/layout.md#documents)分工，不把某个 sandbox 参数当作独立的产品要求，也不在主应用接入中重复内核已经负责的内容检查。

<a id="engine"></a>

## 文档操作与技术句柄

内核输入是一份文档，或图片目录资源集合，不接收 Work、Part 或数据库对象。资源合同支持按需读取和字节范围读取，不能要求先把整个大型 PDF 或归档载入内存。File、Blob 和 URL 可以作为便捷适配，图片目录使用独立输入，不临时打包为 ZIP。

Kisaki 对接授权读取，格式内部解析由 Kana 完成。范围读取能力可参考 [PDF.js range transport](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)。

```ts
const reader = await openReader({
  container,
  source,
  settings,
  position,
  assetsBaseUrl,
  handleKeyDown
})
```

container 指定挂载位置，source 提供文档资源，settings 是阅读接入转换得到的 Kana 技术输入，position 是可选初始位置；assetsBaseUrl 指向已完整部署的同源发行资源，handleKeyDown 可选地接手内容尚未处理的按键。内核识别版式，并在首次呈现前采用相应输入。完整资产、会话及持久值交接见[整包接入](../engineering/integrations.md#reading)。

openReader 在内容可读且明确请求的初始定位完成后返回成功；定位须到达指定源目标，失败则按定位错误处理。返回的 reader 是本次文档的技术句柄，由产品会话持有和释放。

<a id="settings-boundary"></a>

### 偏好与内核设置分别拥有合同

Kisaki 的 ReadingPreferences 描述产品选择，归本体的持久值、默认值、校验与编辑流程所有。Kana 的 ReadingSettings 描述内核可执行的呈现输入，归独立技术包所有。两边不相互导入，不通过别名、继承、Pick／Omit 等类型变换派生另一份合同；主应用也不调用 Kana 的默认值或设置解析函数初始化、修复数据库值。

只有阅读接入同时依赖两份合同。接入先按文件、作品、全局选择一份完整偏好，再准备资源和转换设置：

| 主应用输入                       | 接入负责的工作                                               | Kana 接收的内容                            |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| 阅读流、原始页编排与正文排版选择 | 核对能力与单位，明确映射本次要采用的值；两种编排选择分别保留 | 对应的技术呈现参数                         |
| 跟随文档的选择                   | 核对两侧对文档规则及缺省的解释；不在主应用重新解析书内格式   | 内核自己定义的文档跟随输入                 |
| colors 的 document 选择          | 保留原书配色意图，在本次采用时解析应用主题的区域外底色       | document 分支及明确 background             |
| colors 的 theme 选择             | 在本次采用时解析应用主题得到颜色快照                         | custom 分支及 foreground／background 值    |
| colors 的 custom 选择            | 校验并取得明确颜色值                                         | custom 分支及 foreground／background 值    |
| 系统字体或 document 选择         | 核对可直接对应的字体语义                                     | 系统 family 或文档字体选择                 |
| 用户字体库引用                   | 通过字体管理取得字节和 face 信息，建立本次资源 id 与占用     | FontResource 和对应的 ReadingFont 资源选择 |
| 全局／作品／文件来源、自定义开关 | 在主应用完成配置选择、编辑和保存                             | 不传给内核                                 |

应用字体引用在准备阶段已不可用时，由接入保留原偏好、说明回退并提供可执行的字体选择；已经提供给内核的字体在读取或加载时失败，则按内核通知反馈。两者分别在拥有失败的层处理，不通过伪造资源或重复通知混在一起。

原书配色不取消区域外底色，也不允许暗色界面把原书未声明的黑色正文直接放到黑底。文档画布、普通文字与图文背景的实际处理归 Kana；接入不分析书内颜色或字体来猜测覆盖范围。解析后的颜色只属于本次技术输入，不回写 theme 或 document 偏好。

接入显式选择需要的值，不依靠把整个偏好强制断言为 ReadingSettings，或把内核状态直接写回偏好。结构与含义已经一致的局部纯值可以直接传递，不为解耦重复算法或刻意换名。字体等资源的持有仍覆盖实际读取寿命，Reader 收尾后由接入释放自己取得的占用。

控件与按键读取内核实际交付的 forwardDirection 和 pageSlots，分别解释当前前进方向及每组预留的阅读面数，不按作品类别或请求设置猜测。它们不进入主应用偏好，临时查看也不覆盖主阅读反馈。明确面数不随窗口宽度自动切换；空间不足的布局失败按本次动作反馈，保留可信位置和用户保存值，不自动改成另一组配置。

内容 iframe 内的快捷键需要明确交接，不能靠宿主容器的普通 keydown 自然冒泡。Kana 的[同步按键入口](../projects/kana/interaction.md#host-keyboard)在原生控件与当前内容先处理之后交给本体；本体只映射自己的动作，不读取私有 Document，也不重复接管同一输入。复制按钮仍通过 getSelection 取得完整原文，再由本体自己的剪贴板动作和通知边界处理。

两份合同可以在部分字段上相近，但不约定同步演变。主应用新增界面行为不自动增加 Kana 参数；Kana 新增技术参数也不自动成为偏好。升级时核对接入与所需能力，不自动迁移用户配置。原始页单页、正文双页等产品选择必须获得内核真实支持，不能丢弃一个值或在导航时反复覆盖设置来伪装适配。

| 能力       | 公开接口                                             |
| ---------- | ---------------------------------------------------- |
| 状态       | getState、observe                                    |
| 文档内导航 | seek、next、previous                                 |
| 跳转历史   | back、forward 及对应可用状态                         |
| 临时查看   | referenceView 状态、closeReference；复用源选择与标注 |
| 搜索       | search，支持取消和逐步交付结果                       |
| 设置       | setSettings                                          |
| 选区       | getSelection 及选区变化通知                          |
| 位置原文   | getTextContext(position)                             |
| 标记呈现   | setMarks 及标记交互通知                              |
| 释放       | close                                                |

next 和 previous 只推进当前文档。下一卷或下一话使用哪个文件，由 Kisaki 选择。目录、搜索、续读和标注跳转使用同一定位合同。重排、分页、连续滚动、文字选择和高亮几何由内核完整实现，不靠 Kisaki 的私有 DOM 补丁补齐。

Reader 提供统一选择、临时参考查看与有界跳转历史。主位置、进度与续读归属保持独立，临时内容中的文字选择可以形成真实源标注。back／forward 沿正式跳转历史往返，临时查看的开关不产生历史条目。具体状态、关闭及完成规则见[公开合同](../projects/kana/api.md#history)。

正文与独立辅助内容按文档语义确定各自阅读路径。正常翻页沿正文路径；明确进入独立内容后在其内部阅读，到边界停住，可通过返回回到之前位置。默认搜索包含两者。明确进入独立内容时正文进度为 null，临时查看继续保留主阅读进度；宿主不根据源文件中的物理先后推算辅助内容的正文百分比。完整规则见[阅读路径](../projects/kana/positions.md#order)。

getTextContext(position) 返回 `Promise<string | null>`，按本次文档的源位置取得有界的邻近原文，供点位书签辨认。该位置没有可用文字时返回 null，读取失败仍报告实际错误。它不改变阅读位置或用户选区，不合成摘要，也不使这些文字成为新的高亮范围。

Kisaki 向内核提供只读标记投影，其中包含定位、不透明 id 和必要原文，使用统一标记样式与当前选中状态。内核负责绘制，并回传交互；批注编辑、修改和删除由本体完成，内核不保存另一份 Annotation。内核的技术样式能力不要求 Kisaki 为每条标注保存颜色。

标记投影的反馈还包含本次文档中可解析标记的源内容顺序及无法恢复的标记 ID，供[当前文件标注面板](annotations.md#ordering)排列。顺序与绘制共用源解释，相同起点可以明确并列，由宿主补齐稳定顺序；不能用编码字符串排序替代。宿主只保存当前文档的轻量索引，完整批注和摘录仍按需读取，内核不查询本体资料库。

书签的可见内容画面和所选页面区域的图像由应用阅读接入取得，可以使用 Electron [capturePage](https://www.electronjs.org/docs/latest/api/web-contents#contentscapturepagerect-opts)。Kana 不因此依赖 Electron 或 PreparedImage。完整采集操作见[内容采集](sessions.md#capture)。

close 释放文档视图、任务和临时资源，Kisaki 随后收尾授权读取和会话。旧文档回调不能更新新文档。打开、取消、定位及最终状态交付遵守[执行完成合同](sessions.md#engine-completion)。

<a id="contract-ownership"></a>

## 持久模型与源语义

desktop-contracts/library 定义 ReadingPosition、ReadingTextSelection 和 ReadingPageRegion 的用途、公开形状、纯值约束及兼容责任。数据库、IPC、API、SDK 和 deeplink 共用这些合同。Kana 独立维护自己的公开技术合同，负责格式解析、源地址解释以及源内容与呈现之间的映射，不依赖 desktop-contracts。

依赖关系为 Kisaki 桌面合同 ← 阅读接入 → Kana。接入核对双方的值含义、资源和生命周期；结构与含义完全一致的值可以直接传递。文档解析及源定位算法由 Kana 实现，本体只保存自己的持久值。升级引擎时必须验证已存位置的恢复，不能因技术包版本改变而自动更换存储格式。

正式源地址使用公开规范或本合同规定的源内容规则，包括 EPUB CFI、固有页序、成员路径和明确的文本解码条件。临时 DOM、Range、资源 URL、显示章节编号及内核运行树都不能成为持久地址。每个定位分支必须能够独立、完整地解释。

TXT 解码、BOM 和换行规则，FB2 节点解释，MOBI/KF8 源内容重建，以及 PDF 页面和成员寻址的技术语义，见 [Kana 源位置合同](../projects/kana/positions.md#addresses)。Kana 必须按该合同实现源解析与恢复，本体接入保持相同语义。实现不符时在所属层修复并重新验证，不能在应用内补一套算法。输入损坏、编码未知或地址越界时，按定位失败规则保留原位置与已保存内容。

<a id="values"></a>

## 位置、文字选择与页面区域

```ts
interface NormalizedPoint {
  x: number
  y: number
}

interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

type NormalizedQuad = readonly [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint]

type ReadingAnchor =
  | { type: 'epubCfi'; value: string }
  | { type: 'textOffset'; encoding: TextEncoding; offset: number }
  | { type: 'xmlNode'; nodePath: readonly number[]; textOffset?: number }
  | { type: 'mobi'; byteOffset: number; textOffset?: number }
  | {
      type: 'kf8'
      documentIndex: number
      byteOffset: number
      textOffset?: number
    }

type ReadingPageRef =
  | { type: 'pageIndex'; index: number }
  | { type: 'memberPath'; path: string }
  | { type: 'epubSpineItem'; index: number }
  | { type: 'kf8Document'; index: number }

type ReadingPosition =
  | { type: 'anchor'; anchor: ReadingAnchor }
  | { type: 'page'; page: ReadingPageRef; point: NormalizedPoint }

type ReadingTextSelection =
  | { type: 'anchors'; start: ReadingAnchor; end: ReadingAnchor }
  | {
      type: 'pages'
      pages: readonly {
        page: ReadingPageRef
        quads: readonly NormalizedQuad[]
      }[]
    }

interface ReadingPageRegion {
  page: ReadingPageRef
  rect: NormalizedRect
}

type ReadingAnnotationLocation =
  | { type: 'position'; position: ReadingPosition }
  | { type: 'text'; selection: ReadingTextSelection }
  | { type: 'region'; region: ReadingPageRegion }
```

整数坐标必须是非负安全整数，不接受 NaN、Infinity、负值或精度溢出。文本 offset 和 textOffset 以 UTF-16 单元计数，实际边界不能切开代理对。文字锚点范围必须非空，包含起点但不包含终点。两端采用相同寻址方式，TXT 的 encoding 也须一致。跨章节或格式内容文档时保留完整端点，并要求属于同一可读路径；正文与独立注释 body 不拼成一个连续范围。

端点顺序由源内容解释确认，不能根据字节值、路径字典序或 quote.length 推导。一次 ReadingTextSelection 表示连续选择。能够可靠寻址的文本使用完整起止锚点，不因跨越显示页而拆分。只有固有页面上的文字可以稳定定位时，才使用页面四边形。固定版式也可能支持文字锚点，不能仅按版式选择分支。

PDF 文字提取项编号不作为长期身份。使用页面几何，也不额外承诺能够解析通用源文字范围。pages 与每页 quads 均非空，同一页面只出现一次，并保留实际选择的页面及片段顺序。它们不能表示任意多段拼接，也不能由几何猜测阅读顺序。

双页显示不改变原始页面身份。ReadingPageRegion 只选择一张原始页面。跳转使用选区起点或首个实际区域，不重复保存另一份锚点。

几何坐标以规范方向下完整原始页面的左上角为原点。点的 x、y 均在 0–1 之间；矩形 width、height 必须大于 0，x + width 和 y + height 不超过 1。Quad 在向下坐标系中按顺时针排列，形成非退化凸四边形。首点取 y 最小的点，并列时取 x 最小者。顶点顺序只描述形状，不表示文字起点。

明显越界值不能静默夹取。显示计算产生的误差，应由接入收敛后再交付。

<a id="stability"></a>

## 内容变化与位置兼容

定位值只描述实际文件内部的内容，fileId 由所属记录或操作输入携带。Work、Part、Session、quote 和批注分别由相应记录保存。视频位置使用文件内秒数，视频标注的点位和起止范围遵守 [PlaybackAnnotationLocation](annotations.md#video-values)。每份文件独立保存位置；文件同名、属于同一作品或同一分部，都不会自动继承其他文件的位置。

字号、窗口、分页、注入节点和按需章节加载，不得改变已保存位置的含义。固定页面使用稳定页面身份及页内位置，图片目录和归档不能只使用当前排序号。显示缩放、裁边及旋转由接入进行正反映射，不改变持久坐标。真正裁切或替换源文件，则属于内容变化。

文字高亮几何按当前排版计算。用户框选矩形与文字四边形具有不同用途，不能混用。源地址必须明确构造方法、作用域、文字边界、单位、解码和归一化；同一资源在源内容中重复出现，也必须可以区分。

各格式使用能够稳定定位其源内容的规则，EPUB 使用 [CFI](https://w3c.github.io/epub-specs/epub33/epubcfi/) 等地址。普通文件观察负责可访问性、探测、成员变化和缓存失效；保存的位置在恢复时由相应格式解释和核对，不要求额外的观察基线或内容哈希。

源文件改写后，原坐标可能仍有效，也可能失效。坐标有效不保证仍指向历史原文或画面。格式无效、成员缺失或坐标越界时，应明确失败并保留记录，不能跳到首页、近似位置或其他文件。已保存的 quote、图片和批注都是历史事实，不随文件变化重写。

已经打开的 Kana 在确认根输入变化后以 sourceChanged 结束本次实例，保留最后可信位置并完成资源收尾；接入不把自动关闭当成新位置，也不删除已有阅读记录或标注。之后明确重新打开时建立新实例。单次导航失败或单个标记无法恢复仍按自身范围处理，见[失败影响范围](../projects/kana/api.md#failures)。
用户明确重新选择或重新定位后，才通过 Annotation 完整更新采用新位置。旧摘录可以用于搜索对照，但不能自动改绑。定位值不统一追加 version: 1。只有确实发生不兼容编码演进时，才增加明确分支或版本；能够准确转换才迁移，否则保留原值并报告无法定位。技术库升级本身不改变存储格式。

EPUB、TXT、PDF、图片目录与归档、MOBI/AZW 和 FB2 都须验证续读、适用的任意文字选区、关闭后重开恢复，以及页面区域映射。目录能用不能代替完整选区可逆性的验证。

<a id="operations"></a>

## 从头打开、跳转与实际结果

```ts
type ReadingPositionInput = ReadingPosition | 'start'
type PlaybackPositionInput = number | 'start'
```

start 是本次打开指定文件时从头执行的指令，持久记录仍保存实际源位置。open 省略 position 时沿正常复用或续读规则处理，显式坐标与 start 均要求 fileId。视频位置 0 正常采用，阅读首位置由接入根据文档构造，调用方直接表达从头打开的意图。

同一文件的 start 复用当前会话，不重置时长、完成记录或暂停状态，也不重新应用整套偏好。文件可读但恢复失败时，保留记录并返回失败。界面可以让用户明确选择“从头打开”，另发 start；后台和 deeplink 不能自动降级。取得实际位置后才正常更新进度，原 Annotation 不随之修改。

标注跳转取得实际文件和起点后，复用 open 或 seek，不增加 seekRange、seekRegion。完整范围通过标记显示，长选区不要求同时全部可见。

```ts
sessions.anime.seek(sessionId, position: PlaybackPositionInput): Promise<number>
sessions.comic.seek(sessionId, position: ReadingPositionInput): Promise<ReadingPosition>
sessions.novel.seek(sessionId, position: ReadingPositionInput): Promise<ReadingPosition>
```

seek 等待实际定位完成，直接返回执行者确认的坐标，不能回显请求或包裹 SeekResult。start 只出现在输入中。实际恢复位置可能与原选区起点不同，不能用返回值反向覆盖标注。失败、取消和被后续请求替代，都按[会话完成规则](sessions.md)结束。

| 拥有者            | 校验责任                                       |
| ----------------- | ---------------------------------------------- |
| desktop-contracts | 字段形状、纯数值约束与已经定义的编码规则       |
| library           | 实际文件与作品归属、记录修改及附件关系         |
| 内容执行者        | 当前文件是否存在目标节点、页面、成员和可用偏移 |

合法取得的选区、摘录和批注，即使源文件暂时不可访问也可以保存，无须重新打开文件证明仍能定位。实际跳转时，才验证当前内容中的目标是否存在。纯格式合法不能证明文件目标存在，文件不可访问也不能证明格式损坏。

系统不持久化会随内容变化失效的 locationValid。定位失败保留位置、原文和批注。阅读器故障时释放资源，重新打开后读取正式记录，不复用失效运行对象。
