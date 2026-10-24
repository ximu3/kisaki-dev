# 条目、分部与资料模型

七类 Entry 保存能够独立辨认和整理的对象。真实分部、资料关系、个人记录、文件和附件分别承担自己的职责。本文件定义编目身份、来源对应和正式资料字段。

<a id="references"></a>

## 本地身份与公共引用

```ts
type EntryRef<T extends EntryType = EntryType> = {
  type: T
  id: string
}

type WorkRef = EntryRef<WorkType>

type PartType = 'novelVolume' | 'comicVolume' | 'comicChapter' | 'animeEpisode' | 'animeExtra'

type PartRef<T extends PartType = PartType> = {
  type: T
  id: string
}
```

方法已经限定对象种类时，直接接收该种类的 ID；跨类型调用则使用明确的引用。EntryRef.type 指明类别，本体仍须核对真实身份与类别。WorkRef 只是四类作品的子集，不建立另一份作品身份。

PartRef 不重复携带所属作品。读取或修改所需的作品范围由请求给出，详情和删除快照则保留解释对象所需的归属。

EntryRef、WorkRef、PartRef 和 ExternalIdentity 定义在 desktop-contracts/library。事件、链接、extension-api 和 SDK 直接复用这些定义。跨作品引用使用 novelVolume、comicVolume 等完整类别；已经具备根类型上下文的 Profile 使用 volume 等单数键。本地引用、来源身份、注册能力和运行实例各有含义，不合并成通用 Reference。

<a id="identity"></a>

## 基础表、类型表与完整性

每个条目由 entries 的一行和对应具体类型表的一行共同表示。七张类型表为 games、animes、comics、novels、characters、persons 和 organizations。类型表以 entry_id 为主键并引用基础行，两行使用同一个稳定 ID。即使某类专属字段很少，也保留具体表作为确切的外键目标。不增加 Work 父表、EAV 或持久化类继承。

entries.type 只接受七个已定义类型。各类型表使用固定值的 entry_type 生成列与复合外键，保证基础行和具体类型一致。以下片段说明共同身份约束：

```sql
CREATE TABLE entries (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (
    type IN ('game', 'anime', 'comic', 'novel', 'character', 'person', 'organization')
  ),
  name TEXT NOT NULL,
  UNIQUE (id, type)
);

CREATE TABLE games (
  entry_id TEXT PRIMARY KEY NOT NULL,
  entry_type TEXT GENERATED ALWAYS AS ('game') VIRTUAL,
  FOREIGN KEY (entry_id, entry_type)
    REFERENCES entries (id, type)
    ON DELETE CASCADE
);
```

创建条目时，在同一个同步事务中写入基础行和对应类型行。删除也由完整操作统一安排。主键、外键、唯一性和 CHECK 负责数据库能够表达的不变量，受控操作则保证每条基础行恰有一条正确的类型行。

普通字段编辑不重复审计整组类型结构。初始化、重建和诊断按各自实际范围检查。读取时如果发现缺少类型行，报告结构损坏，不能临时拼出空对象。

当前评价以 entry_id 作为主键，没有独立 ID。没有评价行表示未评分、未收藏，不预先建立占位行。四类作品的当前记录分别存入 game_records、anime_records、comic_records 和 novel_records，直接引用具体作品；逐次完成事实另存于[work_completion_records](records.md#schema)。当前记录不能附着到人物或组织，也不作为其他私人数据的身份父表。

每张表都必须明确一行代表什么，以及主外键、空值、唯一性、值域和删除规则。索引服务于实际查询。公共联合类型不能代替 SQLite 外键；共享技术记录也必须引用确切目标。

<a id="external-identities"></a>

## 外部身份与绑定

ExternalIdentity 只包含 source 和字符串 sourceId。source 使用[统一的规范来源键](../extensions/providers.md#source-keys)，月幕Galgame 按约定保留 ymgal。sourceId 是来源定义的完整、规范资源标识，可以包含原生类别、父范围和局部编号。仅凭它就应足以重新读取对象，不能依赖上一次执行留下的隐藏映射。

本体将 sourceId 作为不透明字符串准确比较，由 provider 按 [来源合同](../extensions/providers.md) 解释。不能统一转小写、执行 NFKC、截断，或只比较局部数字，也不增加 JSON 身份和自定义判等回调。

正式来源绑定只适用于七类 Entry 和五类 Part。扩展 ID、会话、缓存句柄、凭据和参数不属于资料身份；更换来源实现也不能改变身份。来源的原生资源类别不必与本地类型一一对应，例如 Bangumi 的 person 范围可以对应人物或组织。来源没有真实身份时，保留资料和该次回答内的引用，不用名称、编号或数组下标制造 sourceId。

| 外部身份表                        | 直接引用目标                   |
| --------------------------------- | ------------------------------ |
| entry_external_identities         | entry_id → entries.id          |
| novel_volume_external_identities  | volume_id → novel_volumes.id   |
| comic_volume_external_identities  | volume_id → comic_volumes.id   |
| comic_chapter_external_identities | chapter_id → comic_chapters.id |
| anime_episode_external_identities | episode_id → anime_episodes.id |
| anime_extra_external_identities   | extra_id → anime_extras.id     |

每张外部身份表以 (source, source_id) 为联合主键，目标外键建立反查索引。Entry 的唯一性覆盖全部七类条目；每张 Part 身份表的唯一性限定于自身范围，允许不同表分别保存同一来源身份。

同一目标可以绑定同一 source 下的多个真实 sourceId，例如同一漫画话的多个发布记录；每个身份仍唯一指向一个目标。provider 提供明确等价关系后，沿 identity 与 externalIdentities 一并核对，采用后仍分别保存这些身份。同号、同名或曾在缓存中相邻不足以建立等价关系，绑定集合直接保存这些独立身份。

完整操作须核对作品归属和不相容类型。完整身份已经绑定其他目标时，返回调用方可以处理的冲突，不覆盖绑定、不自动合并，也不猜测对应。

完整作品的来源身份绑定 Entry；真实卷、话、集和附加内容的来源身份绑定对应 Part，并通过所属 Entry 的读取范围取得资料。不能把分部身份复制到父作品，也不能为同一个分部另建重复 Entry。来源资料或图片可以使用，并不单独证明两个对象身份等价。游戏没有 Part，多套安装属于 holdings。

文件、启动配置、安装和存档备份不使用编目来源绑定。定位或启动需要的平台标识保存在相应配置中。创建条目、导入和修改身份时，都须检查正式身份表中的冲突。

<a id="entry-fields"></a>

## 七类条目的共同资料

| 字段             | 含义                                             |
| ---------------- | ------------------------------------------------ |
| id               | 稳定的条目身份                                   |
| type             | 已确定的七类 Entry 类型                          |
| name             | 当前使用的显示名称，必填且非空                   |
| original_name    | 已知的原文名称，可空                             |
| sort_name        | 明确指定的排序名称，可空                         |
| aliases          | 别名字符串列表，默认空列表                       |
| description      | 当前简介，使用统一 Markdown 内容约定，可空       |
| primary_image_id | 当前主图，外键引用 attachments.id，可空          |
| external_links   | 相关链接列表，每项包含名称与 URL，默认空列表     |
| is_nsfw          | 本资料库是否对该条目采用敏感内容处理，默认 FALSE |
| added_date       | 用户明确记录的加入日期，可空，使用已有部分日期值 |
| created_at       | 该资料记录实际创建的系统时间                     |
| updated_at       | 该条目资料字段最近修改的系统时间                 |

name 保存当前显示名称，original_name 保存有依据的原文名称，aliases 保存艺名、别称和其他译名，sort_name 保存明确指定的人工排序名称。显示名与原文相同时可以同时存在，但缺少原文依据时不能为了填满字段而复制。改名、检索归一和界面语言切换，都不能改写其他正式名称。

没有 sort_name 时按显示名排序，派生拼音等检索键不能冒充人工填写值。新建条目必须取得非空显示名，不批量写入占位名；名称相同也不能作为身份匹配的充分依据。

primary_image_id 表示唯一的当前识别图。作品中可称为封面，人物和角色中可称为肖像，组织中可称为标志；比例与布局由用途决定。作品背景、标题标志和游戏图标有各自用途，保存在具体类型表。远端 URL、原文件路径和已经保存的附件是不同值。图片在事务外准备，完整操作负责提交引用，失败时保留原图。

description 使用统一的 Markdown 编辑、安全呈现和正文图片规则。正文与 entry_description_attachments 中的引用集合同次提交，不能由 renderer 事后补齐。私人笔记独立保存。external_links 是用于回看页面的名称与 URL 列表，不自动成为来源身份或合并依据。来源未回答某个字段时，不清空既有值。

is_nsfw 表示本资料库采用的敏感内容处理标记，false 表示尚未标记。该值由用户或明确的资料策略修改，只作用于当前对象，与法定分级分别解释；参与作品的标记不传播给人物或组织。

created_at 保存记录实际创建的时间。updated_at 只在共同资料或具体类型资料变化时更新，评分、状态、活动和位置变化不推动它，也不能用它锁定整棵资料图。added_date 是用户可编辑的加入日期，按实际已知精度保存。未填写时，界面可以显示创建日期，但不能改写技术时间，也不默认采用来源账号的收藏时间。type 不属于普通 patch 的可修改字段。

<a id="work-fields"></a>

## 作品的专属资料

四张作品类型表各自直接引用 entries，并使用以下同义字段：

| 字段               | 含义与约束                                                 |
| ------------------ | ---------------------------------------------------------- |
| release_date       | 当前作品范围的首次正式公开或发行日期，可空，使用部分日期值 |
| original_languages | 已知的作品原始语言列表，默认空列表表示尚未记录             |
| backdrop_image_id  | 作品背景图，可空外键引用 attachments.id                    |
| title_logo_id      | 作品标题标志，可空外键引用 attachments.id                  |

各类作品另有以下字段：

| 类型 | 字段                           | 含义                                                       |
| ---- | ------------------------------ | ---------------------------------------------------------- |
| 游戏 | icon_image_id                  | 用于快捷入口等用途的游戏图标，可空附件外键                 |
| 动画 | release_status                 | 当前作品的发行状态，可空                                   |
| 动画 | release_end_date               | 当前作品范围的结束发行或播出日期，可空部分日期             |
| 动画 | declared_duration_ms           | 明确属于整部当前作品的资料标示时长，可空非负整数，单位毫秒 |
| 动画 | declared_regular_episode_count | 资料明确声明的正片集数，可空非负整数                       |
| 动画 | declared_special_episode_count | 资料明确声明的特别篇集数，可空非负整数                     |
| 漫画 | release_status                 | 当前作品的发行状态，可空                                   |
| 漫画 | release_end_date               | 当前作品范围的结束发表或出版日期，可空部分日期             |
| 漫画 | declared_page_count            | 明确属于整部当前作品的资料声明页数，可空非负整数           |
| 漫画 | declared_volume_count          | 资料明确声明的卷数，可空非负整数                           |
| 漫画 | declared_chapter_count         | 资料明确声明的话数，可空非负整数                           |
| 小说 | release_status                 | 当前作品的发行状态，可空                                   |
| 小说 | release_end_date               | 当前作品范围的结束发表或出版日期，可空部分日期             |
| 小说 | declared_page_count            | 明确属于整部当前作品的资料声明页数，可空非负整数           |
| 小说 | declared_volume_count          | 资料明确声明的卷数，可空非负整数                           |

release_date 描述当前编目范围的首次正式公开或发行，允许保存已经公布的预定日期。动画季使用该季的日期范围，漫画和小说使用该作品首次发表或出版的日期。重版、译本、移植和文件生成日期不能代替原始发行事实。

original_languages 使用规范语言标识，可以记录多种语言，空列表表示尚未记录。不能根据标题文字、支持语言、字幕、音轨、译本或 UI 偏好推断作品原始语言。

动画、漫画和小说的 release_status 使用以下值：

| 值        | 含义                         |
| --------- | ---------------------------- |
| planned   | 已有尚未开始发行的计划       |
| ongoing   | 正在发行、播出或连载         |
| finished  | 当前编目作品的发行已经结束   |
| paused    | 已明确暂停，尚不能按结束处理 |
| cancelled | 已明确取消或中止             |

未知发行状态保存为 NULL。发行状态、个人当前状态和完成历史分别管理，互不修改。日期和数量不足以推断发行状态：预定日期已过、登记了十二集或长期没有更新，都不自动意味着某个状态。

release_end_date 描述整部作品结束发行的范围，不能用最新一话日期或抓取时间代替。已知预定结束日也不表示作品已经 finished。游戏的首次发售、运营、开发和补丁更新不使用这套连载状态。

人物与组织参与通过关系保存。平台、题材、视角、TV 或 OVA、同人和长条等整理描述使用普通标签；语言保持独立语义。实际页数、时长、字幕、音轨、页面提示和文件格式属于文件技术事实。

<a id="declared-values"></a>

## 资料声明与本地事实

declared_* 保存当前明确采用、并且范围相符的资料声明，不保存本地行数或文件探测缓存。NULL 表示未知，0 只表示来源明确声明为零。来源用零表示未知时，由适配器转换为空。分页长度、返回名单长度、已上传文件数和最后一个编号，都不能当作声明总量。

动画的正片数与特别篇数分别声明，附加内容另行登记。范围不明的总数不能全部写入正片数。声明十二集、本地登记八集、其中五集有文件，可以同时成立：不因此补造四集，不覆盖声明，也不从文件行数推断分集覆盖。声明数量少于登记数量时，保留两者供用户核对，不删除已有记录。

整部作品的声明时长或页数直接保存于作品，适用于独立动画电影、没有分卷的小说和完整短篇漫画等内容。只有来源明确说明是整部作品的总量时才填写，不能自行合计分部，也不能使用单集平均片长或某一册页数。声明为空或零都不影响作品直接持有文件，也不触发占位分部。

来源声明不自动成为私人进度的分母，不能据此标记前 N 个分部或自动完成。资料页数可以与文件页数不同，资料中的二十四分钟也可以与视频的二十三分五十一秒并存。播放、续播和自动观看判断使用实际文件与当前上下文。声明值不能累加成合订文件内的逐卷页码、逐集时间段或其他内容范围。

<a id="characters"></a>

## 角色资料

Character 保存具有角色身份的形象，包括人物、动物、机器人、AI 和拟人角色，不要求是人类或具备完整的人体资料。普通机体、舰船、武器、地点和虚构组织等设定对象不作为角色条目收录；也不为这些对象增加条目类型、角色子类或人格判定字段。

来源按各自已确认的类别与采用规则取得角色，不因资源路径叫 character 就全部接入，不根据简介推断对象是否具有人格。用户可以直接建立符合角色含义的条目；非人角色缺少性别、血型或身体资料不影响编目，各字段只保存明确适用的事实。

| 字段       | 含义                                                           |
| ---------- | -------------------------------------------------------------- |
| birth_date | 设定生日，使用部分日期，允许只知道月日                         |
| gender     | 当前明确采用的性别设定，使用下文的共同分类                     |
| age        | 当前采用的设定年龄；数值按年表示，也可以保存说明文字           |
| blood_type | 明确的 ABO 血型分类：a、b、ab、o                               |
| height     | 身高；数值单位为厘米，也可以保存说明文字                       |
| weight     | 体重；数值单位为千克，也可以保存说明文字                       |
| bust       | 胸围；数值单位为厘米，也可以保存说明文字                       |
| waist      | 腰围；数值单位为厘米，也可以保存说明文字                       |
| hips       | 臀围；数值单位为厘米，也可以保存说明文字                       |
| cup_size   | 资料明确给出的罩杯标记，短文本，不以现有枚举的最大字母限制输入 |

每个角色只保存当前采用的一套设定。设定年龄不随现实时间增长，也不根据生日和当前年份反推。只知道月日时就保存月日；无法可靠表达的历法或条件保留在说明中。时期、路线和形态之间的差异，通过明确采用和文字表达，不自动拆分为角色版本。

age、height、weight、bust、waist 和 hips 各保存一个受限 JSON 值。{ kind: 'number', value: number } 表示明确单值，{ kind: 'text', value: string } 表示非空的完整文字表述，SQL NULL 表示未记录。数值必须有限且非负，允许零和小数。单位由字段决定，文字则自行保留限定词和单位。不另建 number 与 text 双列、可变单位或通用属性表。

只有来源单位明确时才能准确换算。范围、约数和“随形态变化”等内容保留为文字，不能只取第一个数字、截断年龄范围，或以常见人体尺度裁掉角色设定。无法解析不等于明确空值。编辑时显式选择数值或文字，并整值替换。

数值比较只处理 number 分支，文字可以检索，两种分支都可以参与存在性判断。数值排序时，非数值项排在后面，再按稳定名称和 ID 排列。cup_size 保存实际短文本并提供常见值选择，不限制最大字母，也不从其他尺寸推算。blood_type 只使用 a、b、ab 和 o；其他设定写入说明，未知不能映射为 O。

<a id="persons-organizations"></a>

## 人物、组织与性别值

persons 保存以下专属字段：

| 字段       | 含义                             |
| ---------- | -------------------------------- |
| birth_date | 出生日期，可空部分日期           |
| death_date | 逝世日期，可空部分日期           |
| gender     | 明确的人物性别资料，可空共同分类 |

人物保存出生与死亡日期。界面按已知日期推算年龄时，说明依据和精度；缺少 death_date 仅表示死亡日期未知。艺名与笔名保存在 aliases，original_name 表示原始名称。职业、生平和背景使用简介，作品职责使用关系。名称相同只构成查找线索，合并仍须确认身份。

人物与角色的 gender 使用 male、female、nonBinary、genderless、other 或 NULL。genderless 表示明确无性别，other 表示资料已知但不属于其他分类，NULL 表示未知。只采用来源或用户明确给出的资料，不能根据名字、外观、声优、称谓或尺寸推断，也不能把信息不足强行归为 other。

organizations 保存以下专属字段：

| 字段           | 含义                                   |
| -------------- | -------------------------------------- |
| founded_date   | 当前组织的成立日期，可空部分日期       |
| dissolved_date | 当前组织的解散或结束日期，可空部分日期 |

组织包括实际独立署名的公司、工作室、社团、品牌和素材服务，也可以是非法人主体。开发、制作、出版和素材提供记录在具体作品的参与关系中。成立与解散日期描述当前主体，空值表示未知；这组存储字段只保存两项日期。同一主体更名后保留 ID 和有用别名，不同主体即使共用名称或人员，也分别保存。

修改这些资料的完整操作维护 entries.updated_at，并按实际修改字段与基线核对并发。私人评价和记录独立更新。查询与编辑验证须覆盖只有月日的生日、文字年龄、零与小数、特殊尺寸、单位换算、数值和文字筛选、未知与无性别、艺名，以及组织更名。

<a id="parts"></a>

## 真实分部的身份与资料

小说、动画和漫画都可以直接拥有文件。只有卷、话、分集或附加内容确实具有独立资料或个人记录用途时，才建立 Part。不创建“正文卷”“正文话”或占位集。五类 Part 各自建表，公共 PartRef、校验、UI 和读取投影通过具体类型组合。

| 表             | 主键 | 必填所属外键               |
| -------------- | ---- | -------------------------- |
| novel_volumes  | id   | novel_id → novels.entry_id |
| comic_volumes  | id   | comic_id → comics.entry_id |
| comic_chapters | id   | comic_id → comics.entry_id |
| anime_episodes | id   | anime_id → animes.entry_id |
| anime_extras   | id   | anime_id → animes.entry_id |

每个 Part 直接且唯一地属于对应作品，作品与分部形成一对多关系。漫画话直接属于漫画；卷对话的收录由 comic_volume_chapters 表达，不增加必填的卷父键。分部创建时明确所属作品，不提供独立跨作品改归属。作品合并统一迁移分部归属；同一作品内的重复分部可以通过[明确分部合并](library-operations.md#part-merges)整理，用户选择保留身份，其他引用共同迁移。

五张分部表各自保存以下字段：

| 字段             | 含义与约束                                        |
| ---------------- | ------------------------------------------------- |
| name             | 实际采用的显示标题，可空                          |
| original_name    | 已知原文标题，可空                                |
| aliases          | 其他标题或称呼，字符串列表，默认空列表            |
| description      | 本对象简介，统一 Markdown，可空                   |
| primary_image_id | 本对象主图，可空附件外键                          |
| external_links   | 本对象的相关页面链接，名称与 URL 列表，默认空列表 |
| release_date     | 本对象首次正式公开或发行日期，可空部分日期        |
| sort_order       | 所属作品内相应列表的排列，非负整数，默认 0        |
| created_at       | 本对象实际登记的系统时间                          |
| updated_at       | 本对象资料最近修改的系统时间                      |

各类型另有以下字段：

| 表             | 专属字段               | 含义                                                 |
| -------------- | ---------------------- | ---------------------------------------------------- |
| novel_volumes  | number_label           | 可空文本卷号                                         |
| novel_volumes  | declared_page_count    | 当前采用资料明确声明的本卷页数，可空非负整数         |
| comic_volumes  | number_label           | 可空文本卷号                                         |
| comic_volumes  | declared_page_count    | 当前采用资料明确声明的本卷页数，可空非负整数         |
| comic_volumes  | declared_chapter_count | 资料明确声明的本卷收录话数，可空非负整数             |
| comic_chapters | number_label           | 作品范围内可空文本话号                               |
| comic_chapters | declared_page_count    | 当前采用资料明确声明的本话页数，可空非负整数         |
| anime_episodes | number_label           | 可空文本集号                                         |
| anime_episodes | type                   | regular、special 或 NULL                             |
| anime_episodes | declared_duration_ms   | 资料标示的分集时长，可空非负整数，单位毫秒           |
| anime_extras   | type                   | opening、ending、promotion、interview、other 或 NULL |
| anime_extras   | declared_duration_ms   | 资料标示的附加内容时长，可空非负整数，单位毫秒       |

标题与编号分别保存。真实对象没有标题时也可以登记；界面显示的编号、类型或“未命名”提示不能写成正式名称。标题和编号都不要求唯一。列表按 sort_order、id 排列，不再复制 sort_name。附加内容保存完整名称，但没有 number_label。漫画收录关系还有自身范围的编号和顺序。Episode 与 Extra 之间的[种类更正](anime.md#kind-correction)属于现有内容编辑，保留同一对象的身份及相关资料与记录。

主图表达分部自身的资料。缺图时不能自动采用父作品封面、文件首页或视频截图。release_date 描述该分部首次公开的范围，不继承作品日期，也不被转载、译本、重版或文件日期覆盖。

分部不复制 Entry 的类型、加入日期、敏感标记和评价。修改分部资料只维护分部自己的 updated_at，视图通过明确通知刷新。

声明字段遵守 [资料声明规则](#declared-values)。例如，漫画卷的声明话数不能从当前收录数量生成。文件、编号与记录的具体行为见 [小说](novels.md)、[漫画](comics.md) 和 [动画](anime.md)。

<a id="part-lifecycle"></a>

## 分部引用、文件与修改边界

文件身份、路径、探测事实和续读位置属于实际文件。真实卷或集的身份不会因为文件失联、格式变化或重定位而消失。同一分部可以有多个文件，每份文件各有位置，不能把 EPUB 定位器套用到 PDF。解除关联、删除文件记录、删除分部和删除作品分别执行自己的完整操作与保留规则。

合订第 1–3 卷的电子书是一份读物，只有一个续读位置，通过目录和书签导航。它不建立逐卷文件范围、完整性证明或独立续读上下文，读到文件末尾也不自动完成所含各卷。逻辑完成、实际活动和文件位置分别记录。页码、目录和段落是文件内部位置，不成为 catalog 对象。标注无法准确定位时，仍保留用户文字与来源上下文。

五类分部的正文图片使用以下引用表：

| 表                                    | 拥有者外键                     |
| ------------------------------------- | ------------------------------ |
| novel_volume_description_attachments  | volume_id → novel_volumes.id   |
| comic_volume_description_attachments  | volume_id → comic_volumes.id   |
| comic_chapter_description_attachments | chapter_id → comic_chapters.id |
| anime_episode_description_attachments | episode_id → anime_episodes.id |
| anime_extra_description_attachments   | extra_id → anime_extras.id     |

每张表以拥有者 ID 与 attachment_id 为联合主键。附件端引用 attachments.id、限制附件删除，并提供反查；拥有者删除时级联解除引用。Markdown 与引用集合同次提交，准备、取消、替换和回收规则见 [附件](attachments.md)。external_links 只提供页面入口，主应用不将其解析为身份。ISBN 或合订出版物身份不能复制成每一卷的唯一键。

人员、组织、角色和配音参与统一在作品范围内管理，见[资料关系](relations.md)。分部背景可写入说明或来源链接。具体译本的日期与语言保留其版本含义，原始发行事实独立维护。

资料更新保留稳定 ID、文件关系、首选和私人记录。字段缺席不清空已有值，来源遗漏也不自动删除分部。修改说明、图片、编号或声明值不会重置位置与完成状态。删除漫画卷只解除其收录关系，不删除独立的话和文件；删除文件记录也不抹去分部资料。

验收须覆盖无标题对象、同号对象、不同主图、正文图片的取消与替换、声明数量与实际数量不同、零分集电影、无卷小说、合订文件，以及更新后私人记录的保留。

<a id="owners"></a>

## 其他持久事实的拥有者

整理关联使用真实组合键：collection_members 使用 (collection_id, entry_id)，entry_tags 使用 (entry_id, tag_id)，分别引用实际合集或标签与 entries。不重复保存 entry_type，也不增加没有用途的关系 ID。删除合集或标签只移除其关联；删除 Entry 不删除合集和标签。人工顺序放在真正需要它的成员关系中，索引覆盖双向查询。

其余表、完整操作和生命周期由以下文档定义。运行模块按实际业务职责组织，可以共同管理多张相关表。

| 事实                           | 正式定义                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 作品关系、角色、人员和组织参与 | [资料关系](relations.md)                                                                                               |
| 合集、标签与当前整理           | [个人整理](collections-and-tags.md)                                                                                    |
| 持有目录、文件、绑定和首选     | [本地持有](holdings.md) 与各媒介文档                                                                                   |
| 游戏配置、备份及记录           | [游戏](games.md)、[备份](backups.md)                                                                                   |
| 笔记、标注及正文引用           | [笔记](notes.md)、[标注](annotations.md)、[附件](attachments.md)                                                       |
| 使用记录与运行上下文           | 各媒介记录及 [会话](sessions.md)                                                                                       |
| 任务与扫描配置、历史           | [任务](tasks.md)、[扫描](scanner.md)                                                                                   |
| metadata_profiles 与资料采用   | [资料方案](metadata-profiles.md)、[资料获取](metadata.md)                                                              |
| 偏好和引导状态                 | [偏好](preferences.md)、[引导](onboarding.md)                                                                          |
| 扩展安装、仓库、私有值与凭据   | [扩展运行](../extensions/runtime.md)、[分发](../extensions/distribution.md)、[私有数据](../extensions/private-data.md) |

历史记录按需要保留发生时的上下文，并与当前归属分别命名。直接引用和值约束由数据库维护，跨对象的语义一致性由完整操作维护；每个重复保存的上下文字段都须有明确的历史用途。
