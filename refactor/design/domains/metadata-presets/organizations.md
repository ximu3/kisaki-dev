# 组织资料预设

本页定义组织资料的简体中文、繁体中文、英文和日文四项固定预设。语言初值见[预设目录](../metadata-presets.md#catalog)，matching 与 selection 遵守[共同取值规则](../metadata-presets.md#selection)。下列来源、字段和关系规则保持固定，不随 UI 语言或来源可用性改变。

<a id="scope"></a>

## 用途与参与来源

组织预设涵盖游戏制作方、动画工作室、社团、出版社和出版品牌。Bangumi、VNDB、AniList 与 YMGal 提供相应档案，MangaUpdates 和 RanobeDB 提供出版方资料及参与记录，Wikidata 补充名称、日期和身份。

组织履历按真实职责使用 union 合成。公司、品牌和出版方不能只因名称或地址相同而合并。英文、日文长简介可能缺失，预设不会为填齐这些字段而增加通用公司来源。

RanobeDB 的 Publisher 与已经明确为组织的 Staff 团体保持不同来源身份。出版参与核对原作语言的实际发行；Staff 团体只提供其自身原作履历，不从混合 Staff 搜索自动创建组织，见[来源范围](../../extensions/sources/ranobedb.md#subjects)。

| 版本     | 参与提供者                                                      | 数量 |
| -------- | --------------------------------------------------------------- | ---- |
| 简体中文 | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、Wikidata | 7    |
| 繁体中文 | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、Wikidata | 7    |
| 英文     | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、Wikidata | 7    |
| 日文     | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、Wikidata | 7    |

AniList 提供[真实 Studio 或已定类 Staff 团体](../../extensions/sources/anilist.md#subjects)的实际能力：Studio 可以搜索、读取名称与作品参与，但没有简介、图片或生平日期；Staff 团体须已有明确类别与身份。下表组织履历保留对应上下文，关联动画的整部声明时长只采用 Bangumi。

MangaUpdates 的[来源合同](../../extensions/sources/mangaupdates.md#subjects)区分真实 Publisher 与已定类 Author 团体。前者核对各作品的原作出版参与，后者读取自身履历与原文发表用名；主体类型在读取前确定。Publisher 缺少 actualname 时，originalName 保持未回答。

<a id="entry"></a>

## 根条目字段

下表定义 fields.entry，表格记法见[共同取值规则](../metadata-presets.md#selection)。

| 字段          | 简体                                                                  | 繁体                                                                  | 英文                                                                  | 日文                                                                  |
| ------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| name          | Bangumi → YMGal → Wikidata → RanobeDB → MangaUpdates → VNDB → AniList | Bangumi → YMGal → Wikidata → RanobeDB → MangaUpdates → VNDB → AniList | Wikidata → VNDB → MangaUpdates → RanobeDB → AniList → Bangumi → YMGal | Bangumi → VNDB → RanobeDB → MangaUpdates → Wikidata → AniList → YMGal |
| originalName  | VNDB → Bangumi → YMGal → RanobeDB → MangaUpdates                      | VNDB → Bangumi → YMGal → RanobeDB → MangaUpdates                      | VNDB → Bangumi → YMGal → RanobeDB → MangaUpdates                      | VNDB → Bangumi → YMGal → RanobeDB → MangaUpdates                      |
| aliases       | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、Wikidata           | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、Wikidata           | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、Wikidata           | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、Wikidata           |
| description   | Bangumi → YMGal → MangaUpdates → RanobeDB → VNDB                      | Bangumi → YMGal → MangaUpdates → RanobeDB → VNDB                      | MangaUpdates → VNDB → RanobeDB                                        | MangaUpdates → VNDB → RanobeDB                                        |
| primaryImage  | Bangumi → YMGal                                                       | Bangumi → YMGal                                                       | Bangumi → YMGal                                                       | Bangumi → YMGal                                                       |
| externalLinks | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  |
| isNsfw        | 不配置                                                                | 不配置                                                                | 不配置                                                                | 不配置                                                                |
| foundedDate   | Bangumi → YMGal → Wikidata                                            | Bangumi → YMGal → Wikidata                                            | Bangumi → YMGal → Wikidata                                            | Bangumi → YMGal → Wikidata                                            |
| dissolvedDate | Bangumi → Wikidata                                                    | Bangumi → Wikidata                                                    | Bangumi → Wikidata                                                    | Bangumi → Wikidata                                                    |

<a id="relations"></a>

## 关系成员与属性

关系成员及属性按[共同取值规则](../metadata-presets.md#selection)采用。

| 关系项目          | 简体                                                         | 繁体                                                         | 英文                                                         | 日文                                                         |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| workCharacters    | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| personWorks       | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| organizationWorks | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB、YMGal | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB、YMGal | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB、YMGal | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB、YMGal |
| workRelations     | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| entryTags         | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| workEpisodes      | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| workExtras        | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| workVolumes       | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| workChapters      | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |
| volumeChapters    | 不配置                                                       | 不配置                                                       | 不配置                                                       | 不配置                                                       |

以下规则定义关系属性的取值：

| 关系属性                           | 版本     | 固定取值                         |
| ---------------------------------- | -------- | -------------------------------- |
| organizationWorks.fields.note      | 四种版本 | MangaUpdates → Bangumi → AniList |
| organizationWorks.fields.isSpoiler | 四种版本 | 不配置                           |

<a id="tags"></a>

## 标签自身字段

这四项预设不配置标签自身字段。标签定义与应用关系的区别见[共同规则](../metadata-presets.md#selection)。

| 标签自身字段 | 版本     | 固定取值 |
| ------------ | -------- | -------- |
| description  | 四种版本 | 不配置   |
| isNsfw       | 四种版本 | 不配置   |

<a id="related"></a>

## 关联条目字段

本预设只为 organizationWorks 中实际涉及的四类作品配置关联字段，不配置人物、角色或其他组织，也不生成组织背景关系。

<a id="related-game"></a>

### 关联游戏字段

下表定义 fields.relatedEntries.game 的固定规则。

| 字段              | 版本             | 固定取值                          |
| ----------------- | ---------------- | --------------------------------- |
| name              | 简体、繁体、日文 | VNDB → Bangumi → YMGal → Wikidata |
| name              | 英文             | VNDB → Wikidata → Bangumi → YMGal |
| originalName      | 四种版本         | VNDB → Bangumi → YMGal            |
| aliases           | 四种版本         | 合并 VNDB、Bangumi、YMGal         |
| description       | 简体、繁体       | Bangumi → YMGal → VNDB            |
| description       | 英文、日文       | VNDB                              |
| primaryImage      | 四种版本         | VNDB → Bangumi → YMGal            |
| externalLinks     | 四种版本         | 合并 VNDB、Bangumi、YMGal         |
| isNsfw            | 四种版本         | Bangumi → YMGal                   |
| releaseDate       | 四种版本         | VNDB → Bangumi → YMGal            |
| originalLanguages | 四种版本         | VNDB                              |
| backdropImage     | 四种版本         | VNDB                              |
| titleLogo         | 四种版本         | 不配置                            |
| iconImage         | 四种版本         | 不配置                            |

<a id="related-anime"></a>

### 关联动画字段

下表定义 fields.relatedEntries.anime 的固定规则。

| 字段                        | 版本       | 固定取值                        |
| --------------------------- | ---------- | ------------------------------- |
| name                        | 简体       | Bangumi → Wikidata → AniList    |
| name                        | 繁体       | Wikidata → Bangumi → AniList    |
| name                        | 英文       | AniList → Wikidata → Bangumi    |
| name                        | 日文       | Bangumi → AniList → Wikidata    |
| originalName                | 四种版本   | Bangumi → AniList               |
| aliases                     | 四种版本   | 合并 Bangumi、AniList、Wikidata |
| description                 | 简体、繁体 | Bangumi → AniList               |
| description                 | 英文、日文 | AniList                         |
| primaryImage                | 四种版本   | Bangumi → AniList               |
| externalLinks               | 四种版本   | 合并 Bangumi、AniList、Wikidata |
| isNsfw                      | 四种版本   | Bangumi → AniList               |
| releaseDate                 | 四种版本   | Bangumi → AniList               |
| originalLanguages           | 四种版本   | Wikidata                        |
| backdropImage               | 四种版本   | AniList                         |
| titleLogo                   | 四种版本   | 不配置                          |
| releaseStatus               | 四种版本   | AniList                         |
| releaseEndDate              | 四种版本   | Bangumi → AniList               |
| declaredDurationMs          | 四种版本   | Bangumi                         |
| declaredRegularEpisodeCount | 四种版本   | Bangumi                         |
| declaredSpecialEpisodeCount | 四种版本   | 不配置                          |

<a id="related-comic"></a>

### 关联漫画字段

下表定义 fields.relatedEntries.comic 的固定规则。

| 字段                 | 版本       | 固定取值                                      |
| -------------------- | ---------- | --------------------------------------------- |
| name                 | 简体       | Bangumi → Wikidata → AniList → MangaUpdates   |
| name                 | 繁体       | Wikidata → Bangumi → AniList → MangaUpdates   |
| name                 | 英文       | AniList → MangaUpdates → Wikidata → Bangumi   |
| name                 | 日文       | Bangumi → AniList → Wikidata → MangaUpdates   |
| originalName         | 四种版本   | Bangumi → AniList                             |
| aliases              | 四种版本   | 合并 Bangumi、MangaUpdates、AniList、Wikidata |
| description          | 简体、繁体 | Bangumi → MangaUpdates → AniList              |
| description          | 英文、日文 | MangaUpdates → AniList                        |
| primaryImage         | 四种版本   | Bangumi → MangaUpdates → AniList              |
| externalLinks        | 四种版本   | 合并 Bangumi、MangaUpdates、AniList、Wikidata |
| isNsfw               | 四种版本   | Bangumi → AniList                             |
| releaseDate          | 四种版本   | Bangumi → AniList → MangaUpdates              |
| originalLanguages    | 四种版本   | Wikidata                                      |
| backdropImage        | 四种版本   | AniList                                       |
| titleLogo            | 四种版本   | 不配置                                        |
| releaseStatus        | 四种版本   | Bangumi → MangaUpdates → AniList              |
| releaseEndDate       | 四种版本   | Bangumi → AniList                             |
| declaredPageCount    | 四种版本   | 不配置                                        |
| declaredVolumeCount  | 四种版本   | Bangumi → MangaUpdates → AniList              |
| declaredChapterCount | 四种版本   | Bangumi → AniList                             |

<a id="related-novel"></a>

### 关联小说字段

下表定义 fields.relatedEntries.novel 的固定规则。

| 字段                | 版本       | 固定取值                                  |
| ------------------- | ---------- | ----------------------------------------- |
| name                | 简体       | Bangumi → RanobeDB → Wikidata → AniList   |
| name                | 繁体       | Bangumi → Wikidata → RanobeDB → AniList   |
| name                | 英文       | RanobeDB → AniList → Wikidata → Bangumi   |
| name                | 日文       | RanobeDB → Bangumi → Wikidata → AniList   |
| originalName        | 四种版本   | RanobeDB → Bangumi → AniList              |
| aliases             | 四种版本   | 合并 RanobeDB、Bangumi、AniList、Wikidata |
| description         | 简体、繁体 | Bangumi → RanobeDB                        |
| description         | 英文、日文 | AniList → RanobeDB                        |
| primaryImage        | 四种版本   | RanobeDB → Bangumi → AniList              |
| externalLinks       | 四种版本   | 合并 RanobeDB、Bangumi、AniList、Wikidata |
| isNsfw              | 四种版本   | Bangumi → AniList                         |
| releaseDate         | 四种版本   | RanobeDB → Bangumi → AniList              |
| originalLanguages   | 四种版本   | RanobeDB → Wikidata                       |
| backdropImage       | 四种版本   | AniList                                   |
| titleLogo           | 四种版本   | 不配置                                    |
| releaseStatus       | 四种版本   | RanobeDB → Bangumi → AniList              |
| releaseEndDate      | 四种版本   | RanobeDB → Bangumi → AniList              |
| declaredPageCount   | 四种版本   | 不配置                                    |
| declaredVolumeCount | 四种版本   | Bangumi → AniList                         |

<a id="parts"></a>

## 分部范围

这四项预设均未配置分部字段和归属清单。相关作品即使存在分部，本次获取也不会据此递归读取。
