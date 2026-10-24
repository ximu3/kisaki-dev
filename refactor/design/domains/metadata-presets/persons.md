# 人物资料预设

本页定义人物资料的简体中文、繁体中文、英文和日文四项固定预设。语言初值见[预设目录](../metadata-presets.md#catalog)，matching 与 selection 遵守[共同取值规则](../metadata-presets.md#selection)。下列来源、字段和关系规则保持固定，不随 UI 语言或来源可用性改变。

<a id="scope"></a>

## 用途与参与来源

人物预设覆盖声优、游戏创作者，以及漫画和轻小说作者。Bangumi、VNDB 和 AniList 提供相应档案及实际工作，YMGal 补充已知来源身份的人物字段；MangaUpdates 补充作者领域资料，RanobeDB 为已明确 Person 的 Staff 身份补充档案及其自身原作履历，Wikidata 补充名称、生平和身份。

日文版本另加入 TMDB，提供本地化介绍、适用图像及表中列明的关联动画字段。作品职责必须来自真实工作记录，不能根据职业名称、传记或所在组织推导。

YMGal 在线接口没有人物反向作品查询，因此不用于当前人物的 personWorks 或工作说明；其相关游戏、角色等普通字段仍可在已知 refs 时采用。

| 版本     | 参与提供者                                                            | 数量 |
| -------- | --------------------------------------------------------------------- | ---- |
| 简体中文 | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、Wikidata       | 7    |
| 繁体中文 | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、Wikidata       | 7    |
| 英文     | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、Wikidata       | 7    |
| 日文     | Bangumi、VNDB、AniList、YMGal、MangaUpdates、RanobeDB、TMDB、Wikidata | 8    |

AniList 只为[已明确为人物的 Staff 身份](../../extensions/sources/anilist.md#subjects)提供档案和本人的非配音制作履历；不提供人物名称搜索或自动判类，也不贡献 voiceActor 工作。下表保留这一真实上下文中的 personWorks 与 note；关联动画时长移除 AniList。

MangaUpdates 只为[已明确为人物的 Author 身份](../../extensions/sources/mangaupdates.md#subjects)读取档案与自身履历，不按名称或性别自动定类。originalName 使用原文发表用名，deathDate 仅在已故状态及日期均明确时回答；履历说明保留真实署名与职责。

<a id="entry"></a>

## 根条目字段

下表定义 fields.entry，表格记法见[共同取值规则](../metadata-presets.md#selection)。

| 字段          | 简体                                                                  | 繁体                                                                  | 英文                                                                  | 日文                                                                         |
| ------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| name          | Bangumi → YMGal → Wikidata → MangaUpdates → RanobeDB → VNDB → AniList | Bangumi → YMGal → Wikidata → MangaUpdates → RanobeDB → VNDB → AniList | AniList → MangaUpdates → RanobeDB → VNDB → Wikidata → Bangumi → YMGal | Bangumi → RanobeDB → VNDB → AniList → MangaUpdates → Wikidata → YMGal → TMDB |
| originalName  | VNDB → Bangumi → YMGal → RanobeDB → AniList → MangaUpdates            | VNDB → Bangumi → YMGal → RanobeDB → AniList → MangaUpdates            | VNDB → Bangumi → YMGal → RanobeDB → AniList → MangaUpdates            | VNDB → Bangumi → YMGal → RanobeDB → AniList → MangaUpdates                   |
| aliases       | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata         |
| description   | Bangumi → YMGal → AniList → MangaUpdates → RanobeDB → VNDB            | Bangumi → YMGal → AniList → MangaUpdates → RanobeDB → VNDB            | AniList → MangaUpdates → RanobeDB → VNDB                              | TMDB → AniList → MangaUpdates → RanobeDB → VNDB                              |
| primaryImage  | Bangumi → YMGal → MangaUpdates → AniList                              | Bangumi → YMGal → MangaUpdates → AniList                              | Bangumi → YMGal → MangaUpdates → AniList                              | Bangumi → YMGal → MangaUpdates → AniList → TMDB                              |
| externalLinks | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、Wikidata  | 合并 VNDB、Bangumi、YMGal、MangaUpdates、RanobeDB、AniList、TMDB、Wikidata   |
| isNsfw        | 不配置                                                                | 不配置                                                                | 不配置                                                                | 不配置                                                                       |
| birthDate     | Bangumi → YMGal → Wikidata → AniList → MangaUpdates                   | Bangumi → YMGal → Wikidata → AniList → MangaUpdates                   | Bangumi → YMGal → Wikidata → AniList → MangaUpdates                   | Bangumi → YMGal → Wikidata → AniList → TMDB → MangaUpdates                   |
| deathDate     | Bangumi → Wikidata → AniList → MangaUpdates                           | Bangumi → Wikidata → AniList → MangaUpdates                           | Bangumi → Wikidata → AniList → MangaUpdates                           | Bangumi → Wikidata → AniList → TMDB → MangaUpdates                           |
| gender        | VNDB → Bangumi → YMGal → AniList → MangaUpdates → Wikidata            | VNDB → Bangumi → YMGal → AniList → MangaUpdates → Wikidata            | VNDB → Bangumi → YMGal → AniList → MangaUpdates → Wikidata            | VNDB → Bangumi → YMGal → AniList → TMDB → MangaUpdates → Wikidata            |

<a id="relations"></a>

## 关系成员与属性

关系成员及属性按[共同取值规则](../metadata-presets.md#selection)采用。

| 关系项目          | 简体                                                  | 繁体                                                  | 英文                                                  | 日文                                                  |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| workCharacters    | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| personWorks       | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB | union：Bangumi、VNDB、AniList、MangaUpdates、RanobeDB |
| organizationWorks | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| workRelations     | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| entryTags         | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| workEpisodes      | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| workExtras        | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| workVolumes       | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| workChapters      | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |
| volumeChapters    | 不配置                                                | 不配置                                                | 不配置                                                | 不配置                                                |

以下规则定义关系属性的取值：

| 关系属性                     | 版本     | 固定取值                                 |
| ---------------------------- | -------- | ---------------------------------------- |
| personWorks.fields.note      | 四种版本 | VNDB → RanobeDB → AniList → MangaUpdates |
| personWorks.fields.isSpoiler | 四种版本 | 不配置                                   |

<a id="tags"></a>

## 标签自身字段

这四项预设不配置标签自身字段。标签定义与应用关系的区别见[共同规则](../metadata-presets.md#selection)。

| 标签自身字段 | 版本     | 固定取值 |
| ------------ | -------- | -------- |
| description  | 四种版本 | 不配置   |
| isNsfw       | 四种版本 | 不配置   |

<a id="related"></a>

## 关联条目字段

以下字段只用于 personWorks 中的实际作品和明确角色，不配置关联人物或组织。TMDB 只参与日文版本中明确列出的规则，其已有能力不会自动追加到其他版本。

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

| 字段                        | 版本             | 固定取值                              |
| --------------------------- | ---------------- | ------------------------------------- |
| name                        | 简体             | Bangumi → Wikidata → AniList          |
| name                        | 繁体             | Wikidata → Bangumi → AniList          |
| name                        | 英文             | AniList → Wikidata → Bangumi          |
| name                        | 日文             | Bangumi → AniList → Wikidata → TMDB   |
| originalName                | 简体、繁体、英文 | Bangumi → AniList                     |
| originalName                | 日文             | Bangumi → AniList → TMDB              |
| aliases                     | 简体、繁体、英文 | 合并 Bangumi、AniList、Wikidata       |
| aliases                     | 日文             | 合并 Bangumi、AniList、TMDB、Wikidata |
| description                 | 简体、繁体       | Bangumi → AniList                     |
| description                 | 英文             | AniList                               |
| description                 | 日文             | TMDB → AniList                        |
| primaryImage                | 简体、繁体、英文 | Bangumi → AniList                     |
| primaryImage                | 日文             | Bangumi → AniList → TMDB              |
| externalLinks               | 简体、繁体、英文 | 合并 Bangumi、AniList、Wikidata       |
| externalLinks               | 日文             | 合并 Bangumi、AniList、TMDB、Wikidata |
| isNsfw                      | 四种版本         | Bangumi → AniList                     |
| releaseDate                 | 简体、繁体、英文 | Bangumi → AniList                     |
| releaseDate                 | 日文             | Bangumi → AniList → TMDB              |
| originalLanguages           | 简体、繁体、英文 | Wikidata                              |
| originalLanguages           | 日文             | Wikidata → TMDB                       |
| backdropImage               | 简体、繁体、英文 | AniList                               |
| backdropImage               | 日文             | TMDB → AniList                        |
| titleLogo                   | 简体、繁体、英文 | 不配置                                |
| titleLogo                   | 日文             | TMDB                                  |
| releaseStatus               | 四种版本         | AniList                               |
| releaseEndDate              | 四种版本         | Bangumi → AniList                     |
| declaredDurationMs          | 简体、繁体、英文 | Bangumi                               |
| declaredDurationMs          | 日文             | Bangumi → TMDB                        |
| declaredRegularEpisodeCount | 四种版本         | Bangumi                               |
| declaredSpecialEpisodeCount | 四种版本         | 不配置                                |

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

<a id="related-character"></a>

### 关联角色字段

下表定义 fields.relatedEntries.character 的固定规则。

| 字段          | 版本       | 固定取值                                     |
| ------------- | ---------- | -------------------------------------------- |
| name          | 简体、繁体 | Bangumi → YMGal → Wikidata → VNDB → AniList  |
| name          | 英文       | AniList → VNDB → Wikidata → Bangumi → YMGal  |
| name          | 日文       | Bangumi → VNDB → AniList → Wikidata → YMGal  |
| originalName  | 四种版本   | VNDB → Bangumi → YMGal → AniList             |
| aliases       | 四种版本   | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata |
| description   | 简体、繁体 | Bangumi → YMGal → VNDB → AniList             |
| description   | 英文、日文 | AniList → VNDB                               |
| primaryImage  | 四种版本   | VNDB → Bangumi → YMGal → AniList             |
| externalLinks | 四种版本   | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata |
| isNsfw        | 四种版本   | 不配置                                       |
| birthDate     | 四种版本   | VNDB → Bangumi → YMGal → AniList             |
| gender        | 四种版本   | VNDB → Bangumi → YMGal → AniList             |
| age           | 四种版本   | VNDB → Bangumi → AniList                     |
| bloodType     | 四种版本   | VNDB → Bangumi → AniList                     |
| height        | 四种版本   | VNDB → Bangumi                               |
| weight        | 四种版本   | VNDB → Bangumi                               |
| bust          | 四种版本   | VNDB → Bangumi                               |
| waist         | 四种版本   | VNDB → Bangumi                               |
| hips          | 四种版本   | VNDB → Bangumi                               |
| cupSize       | 四种版本   | VNDB → Bangumi                               |

<a id="parts"></a>

## 分部范围

这四项预设均未配置分部字段和归属清单。相关作品即使存在分部，本次获取也不会据此递归读取。
