# NFO / ComicInfo 资料导入方案

NFO／ComicInfo 导入器读取 Kodi NFO、ComicInfo XML 及明确内嵌 XML 的归档，迁入能够准确对应的资料、本人记录与媒体位置。格式依据见[源码、schema 与合成核验](../../../verification/evidence/nfo-comicinfo-importer/source-and-fixtures.md)，支持系列与实际对象范围如下。

<a id="scope"></a>

## 职责、输入与页面

这是随文件资料的手动采用工具。新作品直接以合法文件资料形成 prepared 输入，经 ingest 新增；已有目标按明确范围补空或覆盖，联网补充另行发起。不提供 Kodi／ComicRack 全库恢复、账号、在线同步、扫描监听或网页刮削。其他软件生成的相同 XML 只在本页字段合同内读取，不据此宣称其私人字段或整库格式受支持。

| 输入               | 明确范围                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Kodi NFO           | movie、tvshow、episodedetails 三种资料根；以已发布 21.3-Omega 源码为稳定基线                                                  |
| 多集 NFO           | 支持旧版同一文件内多个 episodedetails 片段，也支持已固定官方开发格式中的每集 -SxxEyy 文件；分别核对，不假设它们属于同一代格式 |
| ComicInfo          | 1.0、2.0 稳定字段，以及固定提交的 2.1 Draft 字段；2.1 不称为稳定发布                                                          |
| 媒体中的 ComicInfo | ZIP／CBZ 根目录中的 ComicInfo.xml；唯一共同书籍目录下的同名文件也可按其明确根解析，多个候选不挑首个                           |
| 相邻媒体和图片     | 用户明确选择的持久文件或根目录，按本页配对与归属规则核验后登记／接收                                                          |

不读取 URL-only／combination scraper NFO、ASCII 说明文件、musicvideo／album／artist NFO、Kodi 数据库与 videodb.xml 全库导出、MKV 内嵌资料或任意程序私有 JSON。RAR／7z 内嵌 ComicInfo 不在本项直接取出范围；已经单独提供的 XML 可以读取，实际媒体是否可登记仍由本体文件能力决定。输入文件不受支持不影响其他独立有效输入。

一个 Webview 页面完成文件／目录范围、对应对象或父作品、文件资料采用方式、可选记录与资源、执行及结果。用户确定范围后直接按文件资料映射执行，联网补充由导入后的普通资料更新提供。

<a id="xml"></a>

## 解析与存在性

读取本次明确选择的文件和子目录范围，不从 XML 中的路径扩展为任意磁盘扫描。源文件只读，不调用 Kodi 刮削、ComicRack 插件或恢复程序，不回写 XML、重打包漫画、修改页序或删除媒体。

使用成熟 XML 解析器，遵守实际声明和 BOM，保留 Unicode 与正文段落，不以替换损坏字节凑出成功。拒绝 DTD、外部实体和可执行处理指令，不获取 xsi:schemaLocation 或外部样式表；采用固定的本地字段合同。限制输入体积、层级、节点数、属性和正文长度，归档还限制成员数、解压量和路径。错误报告保留字段与位置，不输出私密正文或完整 XML。

根名和命名空间共同识别格式，不能因为后缀是 .nfo 或 .xml 就接受。普通单根 XML 严格检查语法；旧多集格式作为明确的 episodedetails 片段序列解析，不能借此接受任意混合根、重复 XML 声明或尾随刮削 URL。

ComicInfo 没有统一的版本声明。按已固定字段表与已知类型读取，不能盲信文件自称的 schema 地址；未知扩展字段不改变已知含义。1.0 的 Manga 枚举不包含 YesAndRightToLeft，2.0 扩充了该值；2.1 Draft 新增 Translator、Tags、StoryArcNumber、GTIN，并将 CommunityRating 的 schema 小数精度从两位改为一位。公众评分不用于本体个人评分，字段版本差异仍在夹具中保留。

XSD 用于来源合同与规范夹具验证，不把 XML 子元素排列顺序当作业务身份。重复标量、互相矛盾的身份或值不按最后一个覆盖；已声明重复的标签、链接和参与行按来源集合读取。整体 XML 损坏时拒绝该文件，独立字段值无效时报告对应字段，其他所选有效资料可以继续。

缺席、空模板节点、Unknown 和各字段规定的 −1／0 哨兵分别解释，不统一转换为 null 或明确零。普通资料的空模板不清空本地值；覆盖只采用实际存在的有效值。Kodi 的 clear／override 等源处理指令不直接变成本体删除操作。

<a id="targets"></a>

## 对象范围、新增与文件资料采用

NFO 只处理用户本次明确选择的动画内容；movie／tvshow 根名本身不能证明它是动画。ComicInfo 主要处理漫画出版物，实际小说可由用户明确选择对应类型与父作品；工具书和非本项目范围的媒体不强行归入。

| 来源范围                         | 本体目标与边界                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 独立动画影片的 movie             | 对应 Anime，文件直接属于作品；没有真实分集时不补造第 1 集                                                                   |
| 真正对应独立作品／季的资料       | 可以为该 Anime 提供定位线索和待采用文件资料；必须有明确范围，不能只因 tvshow 目前一季就绑定为季                             |
| 跨季 tvshow                      | 仅作为来源整剧、分集与文件组织上下文，不创建整剧父层，不自动拆成若干本地季，不复制整剧简介、评分和身份到每季                |
| episodedetails                   | 已明确本地 Anime 或同次真实作品候选后，按完整身份及本体作品范围 matching 对应 Episode；母体未明时报告该分集未采用           |
| ComicInfo 独立出版作品           | 用户明确其实际是独立 Work 时，采用到 Comic／Novel，不因它是一份文件就认定独立作品                                           |
| ComicInfo 的单卷或完整漫画话     | 用户在输入范围中明确选择卷／话及已有或同次明确的父作品，采用相应 Volume／ComicChapter；不能只看 Number 或文件扩展名决定粒度 |
| 合订、拆分、版本或范围不明的书籍 | 只在准确目标与文件归属成立时采用对应内容；不凭 Series／Number 自动制造母作、卷话或收录关系                                  |

父作品选择属于本次输入，可应用于同一作品的一组卷／话。新父作品必须有用户明确提供或输入确实表达的整作名称与范围，再以 prepared 新增；仅有 Series 名称或文件夹名不足以自动判断母体。没有准确 Part 时，已有 Work 下的合法文件仍可独立登记和阅读。

创建、更新、分部与关系均使用本体完整操作。完整公开身份先查询本地对应；没有公开身份时可以使用明确本地目标，或在最低资料与粒度成立时 prepared 新增。同名不保证身份相同。分部编号在正确作品／卷范围解释，零季不自动判为 Extra，特别篇与附加内容保留实际种类。

已明确作品、种类及编号含义的分部候选携带 partMatching：卷或作品话号使用 fields: ['numberLabel']，动画分集使用 fields: ['type', 'numberLabel']，明确的漫画卷内话号使用 fields: ['volumeNumberLabel']。没有适用编号的分部不启用名称回退，继续使用准确身份或本次明确目标；这不授权从季号、Series 或文件排列补造编号。对应、新增权限和歧义处理统一沿[本地分部决策](../../domains/metadata.md#local-parts)，不能通过多个弱规则任选一项。

新作品采用所选有效文件字段、真实分部与关系，并与个人 initial 同次提交。已有对象默认保留普通资料，用户可选择补空或覆盖；缺席字段和关系保持。选择普通字段不自动选择私人记录、合集、笔记、媒体或续读，本地封面沿共同图片选择规则处理。联网补充是另一次明确操作。

<a id="identity"></a>

## 正式身份、编号与对应

NFO uniqueid 必须同时解释 type、资源种类和完整范围。电影中 type=tmdb 的数字映射为 tmdb / movie/<id>；tvshow 中同名字段通常是整剧坐标，不能成为季 Work 身份。episodes 中的裸 TMDB episode ID 也不是本体所要求的完整季集坐标。

已知链接或明确来源身份遵守[共同来源合同](../providers.md#identity)。只有真实 series ID、季集编号，并且编号确属该来源标准顺序时，才形成 tv/<series>/season/<season>/episode/<episode>。本次可以明确选择已知编号体系，但不能从 S01E01 文件名推断它必然采用 TMDB 标准顺序；DVD、绝对集号、用户重编号及源显示顺序都不能混用。

已明确支持的 Bangumi、AniList 等公开资源引用沿各自合同采用。类型未知的 uniqueid、旧 id、Kodi dbid／fileid 不注册为正式身份；可准确解释的普通官网链接可以保留。default=true 只是来源的默认编号选择，不凌驾于其他身份冲突。query 必须核对所有有效身份及目标种类，不选首个掩盖矛盾。

ComicInfo Web 是空白分隔的实际 URL，编码空格不被拆开。已知官网链接才提取规范身份，未知链接保留为普通外链。GTIN 可能是 ISBN、ISSN、EAN／JAN 或其他商品编号，只有能够确认为合法 ISBN 的值才规范为本体 isbn 身份；不能把任意 13 位商品号都当 ISBN。编号对应实际出版物，单卷 ISBN 不直接绑定整部系列。

ComicInfo 的 Title 是这一本书的名称，Series 是它所属的系列，Number 是系列中的书目编号文本；可以是 1.5 或非数字标签。[Volume](https://anansi-project.github.io/docs/comicinfo/documentation#volume) 指出版批次／系列卷次，可能为 2018 这样的年份，不能作为日漫单行本卷号或发行日期。Count、AlternateCount、最大编号和文件数量不生成目录或声明已经完结；书目计数的范围与单位未明确时，也不自动成为本体作品的声明卷数／话数。

<a id="metadata"></a>

## 普通资料与来源文字

| 字段组                                                | 采用规则                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| NFO title、originaltitle、plot                        | 采用实际对象的名称、原名和简介；outline／tagline 不与 plot 拼成来源未提供的正文，sorttitle 不当别名                           |
| NFO premiered、aired、year                            | 影片／明确作品使用自身日期，分集使用 aired；只剩合法 year 时保留年份精度，不补 1 月 1 日；整剧日期不向每季／集继承            |
| NFO movie／episodedetails 的 runtime                  | 有效正分钟数可形成对应影片或分部的声明时长；tvshow 的未用字段不采用，不当精确文件时长或个人观看时长，不把各集相加成作品总时长 |
| NFO genre、tag                                        | 所选时作为普通标签；保留重复元素的实际值，不按未知源设置拆解斜杠文字                                                          |
| NFO originallanguage                                  | 已固定开发格式的明确原作语种，规范合法值；视频音轨／字幕语言不代替原作语言                                                    |
| NFO ratings／rating、votes、top250                    | 公众统计，不作为本人评分；本体没有相应字段时不塞入私人记录                                                                    |
| ComicInfo Title、Summary、Year／Month／Day、PageCount | 按真实书目／卷范围采用名称、简介、精度日期和已知页数；某版书籍数据不覆盖母作范围，页数不由最大 Image 推算                     |
| ComicInfo Genre、Tags                                 | 明确选择时采用普通标签；Tags 是固定 2.1 Draft 字段，逗号分隔按该格式解释                                                      |
| ComicInfo LanguageISO                                 | 书籍当前文本语种，可能是译版；不默认写成作品 originalLanguages                                                                |
| ComicInfo Manga、BlackAndWhite、Format、AgeRating     | 保留准确来源含义，适合普通标签的实际描述可选采用；不据此改变本体类型、原作语种、敏感标记或完整阅读配置                        |
| ComicInfo CommunityRating                             | 公众 0–5 评分，不转为本人评分，也不因为字段名有 Rating 就采用                                                                 |

分集 NFO 的 originaltitle、showtitle、genre、studio、premiered 等可能继承自整剧，不能把它们当作分集原名、分集标签或本季事实；分部没有对应字段时也不反向写到母作。来源 tvshow 的 Continuing／Ended 只有在实际范围与目标作品一致时才可作为 ongoing／finished 的普通发行状态，不能成为本人当前状态。

日期采用还须符合目标的首次公开／发行范围。译本、重印或其他版本的出版日期不代替 Work 或 Part 的首次日期，也不由文件时间补足；这类实际来源信息留在书目上下文，不因为能解析成合法日期就写入 releaseDate。

正文按实际文本或受限标记转换为本体 Markdown，保留段落与有意义空白，不执行 HTML、脚本、外部样式或资源加载。身份不足、类型未明的源作者／角色名称不自动建立图谱。

NFO actor 的 name／role 不证明是原版配音，也未提供可靠 Character 身份；ComicInfo 的 Writer、Penciller、Editor、Translator、Publisher 等明确可能是个人或组织。Characters、Teams、Locations 和 MainCharacterOrTeam 都是文字名单，不能据此创建 Character 或把虚构团队当现实组织。

用户可选择将完整署名与角色文字保存为关联目标作品的“来源署名”Note，保留原岗位、角色和版本上下文，不伪造三方配音关系。本项不从这些名单恢复人物、组织、角色和配音关系图谱；本格式没有提供的身份和原版限定不通过名字猜补。

ComicInfo Notes 常用于记录生成软件，不自动视为私人笔记；Review 也没有统一的作者身份。二者可分别选择保存为 Note，标题说明来源内容，正文不冒称本人评论。未选择时保持原样，空文字不造 Note。源文件时间不成为笔记创建时间，已有笔记不按正文或标题覆盖。

<a id="personal"></a>

## 本人评分、已看事实与最近播放

NFO userrating 才是个人评分。正常 1–10 整数乘 10；显式 0 表示未评分，缺席或空模板表示未知。有明确正整数 max 时按文件声明量尺归一到本体整数评分；非法值不裁剪，也不复刻源读取实现中的整数除法损失。Part 的 userrating 不能写到所属 Work。

当前源码把达到源“已看”条件的播放计入 playcount，并在未达到条件时也更新 lastplayed，见[播放状态保存](https://github.com/xbmc/xbmc/blob/a3a448d26b8d560a65655dab2cd122994dc4e146/xbmc/utils/SaveFileStateJob.cpp)。据此区分：

| 来源事实                              | 本体采用                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 独立动画影片 movie 的有效 playcount=N | 选中已看记录时，只在 Work 历史为空时初始化 N 条未知日期完成记录；这是源已看计数，不是所有来源软件的通用播放次数规则 |
| episodedetails 的 playcount>0／=0     | 对准确 Part 采用 true／false，已有标记默认保留，明确采用才更新；不形成分部次数或 Work 历史                          |
| tvshow 的 playcount=1                 | 当前入库分集全部已看形成的聚合标志，不作为整部作品完成                                                              |
| lastplayed                            | 最近播放日期，可能来自未完成的播放；不填写完成日期，不推算活动区间                                                  |
| runtime、resume.total、streamdetails  | 普通时长／媒体信息或源时间轴背景，不是个人累计观看时长                                                              |

新建作品的所选个人初值与完成记录通过 initial 一同提交。已有作品的评分默认保留，完成总数只初始化空历史并携带 expected.completionCount: 0；非空历史不追加 N 条，不求差额、不取最大值。计数为 0 不删除既有历史。来源没有 planned／active／onHold 事实，本项不自动设置或清除已有当前状态，也不从续播位置推断 active。

多个版本或重复文件对应同一 Work 时，兼容的同一计数只采用一次，矛盾计数报告该项未采用；不能把同一作品各版本的计数直接相加。输入没有逐次完成明细，不能给 N 条记录复制 lastplayed 或导入当天的日期。

标准 ComicInfo 没有本人已读进度、完成次数、LastPageRead 或阅读时长合同。程序私有的同名字段不在本项默认解释范围，CommunityRating、PageCount 和最后一页书签都不证明本人完成。用户选中的 Review／Notes 继续按独立文字处理。

<a id="organization"></a>

## 合集与来源整理

NFO set 的名称和 overview 可选形成手动合集，成员是实际对应的独立影片 Entry；showlink 仅靠剧名不能建立作品关系。合集没有来源内成员顺序时，按本次明确输入添加，不宣称恢复了原始手动排列。已有同名合集不自动复用或合并。

ComicInfo SeriesGroup、StoryArc、AlternateSeries 的作用范围不同。只有明确对应 Entry 的实际成员才进入本体手动合集。已确认 Series 正好是一部 Work 时，SeriesGroup 可以组织该 Work；某卷属于 StoryArc，不能由此把整个母作加入该书目阅读顺序。

StoryArcNumber 与 StoryArc 的多值按来源位置配对，数量不一致时报告该顺序未采用，不任意截断或补齐。Number／AlternateNumber／StoryArcNumber 都是原始编号标签，不能强制转换连续整数。Part 层级的阅读顺序若本体 Collection 无法表达，用户可选保存为带书目上下文的普通 Note；不创建影子合集、额外作品或永久阅读队列。

<a id="images"></a>

## 图片采用

NFO 的明确 poster、fanart、clearlogo 等分别进入本体对应图片用途；分集 thumb 只用于该分部，季图片只用于真实对应的季作品，整剧图片不默认复制到各季。banner、discart、演员图等没有本次正确目标时不挪作作品主图。preview 只用于预览，不代替所选正式原图。

本地图片可按已核实的长名称或目录约定关联，例如同名媒体的 -poster、-fanart；movie.nfo／tvshow.nfo 的目录图片也须有唯一且范围一致的目标。显式 XML 引用与相邻图片矛盾时，按用户选择的图片来源采用，不按扫描顺序覆盖。

只有用户选中的图片才准备远端字节或读取本地文件，随后通过 attachments 接收；不加载 Kodi image:// 缓存、plugin://、带播放器／插件动作的地址或隐含请求头指令。相对路径、旧根重映射、真实路径与符号链接都核对在授权根内，原始 XML 的绝对路径不授予访问权限。

ComicInfo 可从明确 FrontCover 页取得同一书籍实际封面，先完成下文页索引核对，再通过附件完整操作采用到正确对象。没有 FrontCover 时不把随便一张图片说成来源封面，用户仍可通过本体普通换图操作选择。封面失败与有效资料、笔记分别报告，不移动或改写原漫画。

<a id="files"></a>

## 媒体配对与续播

媒体登记默认关闭。用户选择后，先按实际 NFO／XML 输入的配对范围核验：同名 NFO 对应同目录同 basename 的唯一受支持视频；movie.nfo 只有在明确的独立作品目录且媒体目标唯一时采用。多个扩展名候选、版本或冲突引用不自动选择最新／最大文件。

旧多集 NFO 的多个 episodedetails 可以共同关联同一实际视频。固定新格式的 <视频 basename>-SxxEyy.nfo 通过其完整视频前缀配对，并核对 XML 的季集内容与后缀一致；不能把去掉后缀后的任意文件当作正确目标。此规则来自[官方多集说明](https://kodi.wiki/view/NFO_files/Episodes#Multi-Episode_Files)，不把开发格式声称为已经发布的 Kodi 版本。

独立 ComicInfo.xml 需要明确所描述的漫画文件或图片目录；文件所在目录里有多个漫画时不自动任选。内嵌 ComicInfo 的 CBZ 已明确属于该归档，但书目与 Work／Part 的关系仍须核对。媒体已经位于持久位置时直接登记，不把研究目录或临时解包位置作为正式持有路径。

NFO 中 file／path／filenameandpath 只在用户选用来源路径并明确根映射后参与核验，不优先于已确认的相邻配对。DVD／蓝光、ISO、stack://、多段拼接、插件流与 .strm 的虚拟时间轴不假装成一份普通本地视频；资料可以独立采用，无法对应的文件与位置报告未迁入。

resume.position 和 total 单位是秒，允许有限非负小数。先核对同一实际文件、实际时间轴与位置边界；源 total 有效时额外核对其一致性，缺席或 0 表示未知，不单独否决同一文件中合法的正位置。源与实际时长因已知容器精度产生的差异按本体媒体观察规则处理，不按比例缩放位置，不将越界值夹到末尾。缺少同一时间轴依据时不迁入位置。

源默认 position=0、total=0 表示没有可采用的续播点，不清除本地位置。有明确正 total 且位置合法时，0 可以是实际文件起点。已有位置默认保留，明确采用后才更新；多集 NFO 对同一文件给出互相矛盾的位置时报告冲突，不选最大值或复制为每集独立进度。

多集关联不产生文件内集范围。episodebookmark 是源分集定位／播放背景，不是每次观看明细，也不能改造成范围缺失的本体视频 Annotation；本项不据此建立本体未提供的分集时间轴结构。登记文件和位置均不自动播放、不改首选、不生成活动和完成事实。

<a id="pages"></a>

## ComicInfo 页面书签

Pages 中的 Image 是来源图片索引，不是 Page 元素的排列位置，也不是文件里的页码字符串。ComicRack 的[页面模型](https://github.com/maforget/ComicRackCE/blob/7fd9fd35a9cf829fffc6aa9cd0b44c7325df0cb7/ComicRack.Engine/ComicPageInfo.cs)使用零基 ImageIndex；其[归档读取](https://github.com/maforget/ComicRackCE/blob/7fd9fd35a9cf829fffc6aa9cd0b44c7325df0cb7/ComicRack.Engine/IO/Provider/Readers/Archive/ArchiveComicProvider.cs)先按实际支持的图片和来源比较规则建立索引。

开启页面书签时，本次必须明确可核验的生产者页序合同。已核验的 ComicRack 系列按实际图片成员、完整路径和对应的自然比较规则恢复索引，再把 Image 转成具体 memberPath。其比较含区域性文字排序；非 ASCII 涉及的源区域性比较无法重建、排序并列或生产者规则不同且无法确定唯一顺序时，不能套本机默认排序猜位置。XML 本身不能证明任意生成软件采用相同页序。

非空 Bookmark 文字且实际成员能够准确定位时，创建对应文件的点位 Annotation，位置为该页面起点，保留书签标题。原 XML 可以重排 Page 元素，映射仍使用 Image；不按列表下标错绑。重复或越界 Image、重名归档成员、无法证明的页序分别报告。

无法定位时，已选且有意义的书签文字可作为 Note 保留书目上下文；没有实际文字的空标签不创建假笔记。没有同义坐标时，不把 Image 当作 PDF 固有页码、EPUB spine 或 CFI。页面书签不构成续读位置或完成记录。

Type=Deleted、DoublePage、Rotation、Manga 阅读方向、ImageSize／尺寸及 Key 不成为本体文件删除、重排、完整阅读配置或稳定定位身份。Key 在格式说明中没有可靠通用语义，不拿它猜文件名。源删除页标记不删除文件或图片；明确 FrontCover 的封面采用仍使用实际索引和字节。

<a id="execution"></a>

## 默认值、执行与结果

默认选中文件中可准确映射的普通字段，新对象直接采用；已有对象默认保留，补空或覆盖另选。需要另行对应的图片、个人评分、已看记录、标签合集、署名／Notes／Review／阅读顺序文字、文件、续播与页面书签分别选择，默认关闭。只在实际需要时显示根映射、父作品、粒度或页序配置。

列表中的文件、格式、标题、范围、父作品和结果分别占列。开始后固定输入，先核对格式、身份、归属与同目标冲突，再通过 prepared／initial 新增或复用已有作品，按明确范围更新文件资料，并提交适用分部、个人记录、图片、文件、Note／Annotation 与合集。不要求先手动建库再重复导入。

每个本体完整操作分别提交，不承诺整批文件或一条来源资料的所有后续步骤共同原子完成。取消停止后续工作，已完成部分保留，关闭页面不取消后台任务。缺媒体不阻止独立资料采用，图片或书签失败不把已有资料称为全部失败。

结果记录实际完成与未迁入原因。新建与继续批次沿[共同规则](../importers.md#repeat)处理，同批次保留源对象与步骤结果，不重复已完成的 Note／Annotation；未知提交先核对。另建批次可以明确追加，完成总数仍不能追加到非空历史。

<a id="implementation"></a>

## 源码职责与验收

    src/
    ├── node/
    │   ├── entry.ts
    │   ├── input/
    │   │   ├── xml.ts
    │   │   ├── nfo.ts
    │   │   ├── comicinfo.ts
    │   │   ├── archives.ts
    │   │   └── validation.ts
    │   ├── mapping/
    │   │   ├── identity.ts
    │   │   ├── metadata.ts
    │   │   ├── parts.ts
    │   │   ├── records.ts
    │   │   ├── organization.ts
    │   │   ├── notes.ts
    │   │   ├── files.ts
    │   │   └── positions.ts
    │   ├── import.ts
    │   └── ipc.ts
    ├── webview/
    │   ├── entry.tsx
    │   ├── page.tsx
    │   ├── selection/selection.tsx
    │   ├── results/results.tsx
    │   └── styles.css
    └── shared/
        ├── contracts.ts
        └── validation.ts

input 只解释已声明格式、包装和读取边界；NFO 与 ComicInfo 分开维护字段合同。mapping 负责本次范围、身份、字段及位置语义，不新增通用文件导入框架。import 使用公开完整操作，IPC 只转发，Webview 不自行解析媒体或写正式数据。

正式验收覆盖真实导出与不同生产者、声明编码和大型文件、完整 XML／归档预算、命名空间和字段存在性、整剧／季／作品／卷话范围、离线 prepared／initial 新增、原批次继续与已有资料采用、全部图片约定、完整来源比较器及文化排序、持久路径与符号链接、实际播放器／Kana 跳转、异常恢复、已有值保护、空历史数量基线、取消、独立扩展制品及六个桌面目标。
