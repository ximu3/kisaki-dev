# 游戏资料预设

本页定义游戏资料的简体中文、繁体中文、英文和日文四项固定预设。语言初值见[预设目录](../metadata-presets.md#catalog)，matching 与 selection 遵守[共同取值规则](../metadata-presets.md#selection)。下列来源、字段和关系规则保持固定，不随 UI 语言或来源可用性改变。

<a id="scope"></a>

## 用途与参与来源

游戏预设主要服务日 Gal。VNDB 提供原文名称、首发资料、角色及制作档案；Steam 提供已对应目标的本地化商店正文。Bangumi 补充中文资料和跨媒体关系，YMGal 补充 Gal 档案，SteamGridDB 提供美术资源，Wikidata 补充明确身份和名称标签。

Steam 的名称、简介与外链使用[结构化商店读取](../../extensions/sources/steam.md)，真实语言回退仍按共同规则处理；商店地区不改变本预设的资料语言。本预设不将 Steam 用于原名、原作语言或资料关系，也不选用 IGDB。字段按下列优先序采用，用户保存的方案不自动改写。

简体与繁体版本使用六个来源，英文与日文版本另加入 AniList，以补充关联条目的非中文档案。简体游戏简介优先使用 Bangumi，繁体简介优先使用 Steam，VNDB 在这两条简介规则中均排第四。英文和日文版本的关联档案正文允许按语言规则回退到英文。

| 版本     | 参与提供者                                                  | 数量 |
| -------- | ----------------------------------------------------------- | ---- |
| 简体中文 | VNDB、Bangumi、Steam、YMGal、SteamGridDB、Wikidata          | 6    |
| 繁体中文 | VNDB、Bangumi、Steam、YMGal、SteamGridDB、Wikidata          | 6    |
| 英文     | VNDB、Bangumi、Steam、YMGal、SteamGridDB、Wikidata、AniList | 7    |
| 日文     | VNDB、Bangumi、Steam、YMGal、SteamGridDB、Wikidata、AniList | 7    |

<a id="entry"></a>

## 根条目字段

下表定义 fields.entry，表格记法见[共同取值规则](../metadata-presets.md#selection)。

| 字段              | 简体                                 | 繁体                                 | 英文                                      | 日文                                      |
| ----------------- | ------------------------------------ | ------------------------------------ | ----------------------------------------- | ----------------------------------------- |
| name              | VNDB → Bangumi → Steam → YMGal       | VNDB → Steam → Bangumi → YMGal       | VNDB → Steam → Wikidata → Bangumi → YMGal | VNDB → Steam → Bangumi → YMGal → Wikidata |
| originalName      | VNDB → Bangumi → YMGal               | VNDB → Bangumi → YMGal               | VNDB → Bangumi → YMGal                    | VNDB → Bangumi → YMGal                    |
| aliases           | 合并 VNDB、Bangumi、YMGal            | 合并 VNDB、Bangumi、YMGal            | 合并 VNDB、Bangumi、YMGal                 | 合并 VNDB、Bangumi、YMGal                 |
| description       | Bangumi → Steam → YMGal → VNDB       | Steam → Bangumi → YMGal → VNDB       | VNDB → Steam                              | Steam → VNDB                              |
| primaryImage      | VNDB → Bangumi → YMGal → SteamGridDB | VNDB → Bangumi → YMGal → SteamGridDB | VNDB → Bangumi → YMGal → SteamGridDB      | VNDB → Bangumi → YMGal → SteamGridDB      |
| externalLinks     | 合并 VNDB、Bangumi、Steam、YMGal     | 合并 Steam、VNDB、Bangumi、YMGal     | 合并 Steam、VNDB、Bangumi、YMGal          | 合并 VNDB、Bangumi、Steam、YMGal          |
| isNsfw            | Bangumi → YMGal                      | Bangumi → YMGal                      | Bangumi → YMGal                           | Bangumi → YMGal                           |
| releaseDate       | VNDB → Bangumi → YMGal               | VNDB → Bangumi → YMGal               | VNDB → Bangumi → YMGal                    | VNDB → Bangumi → YMGal                    |
| originalLanguages | VNDB                                 | VNDB                                 | VNDB                                      | VNDB                                      |
| backdropImage     | SteamGridDB → VNDB                   | SteamGridDB → VNDB                   | SteamGridDB → VNDB                        | SteamGridDB → VNDB                        |
| titleLogo         | SteamGridDB                          | SteamGridDB                          | SteamGridDB                               | SteamGridDB                               |
| iconImage         | SteamGridDB                          | SteamGridDB                          | SteamGridDB                               | SteamGridDB                               |

<a id="relations"></a>

## 关系成员与属性

关系成员及属性按[共同取值规则](../metadata-presets.md#selection)采用。

| 关系项目          | 简体                                     | 繁体                                     | 英文                                     | 日文                                     |
| ----------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| workCharacters    | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    |
| personWorks       | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    |
| organizationWorks | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    | firstNonEmpty：VNDB → Bangumi → YMGal    |
| workRelations     | firstNonEmpty：Bangumi → VNDB → Wikidata | firstNonEmpty：Bangumi → VNDB → Wikidata | firstNonEmpty：Bangumi → VNDB → Wikidata | firstNonEmpty：Bangumi → VNDB → Wikidata |
| entryTags         | firstNonEmpty：VNDB → Bangumi            | firstNonEmpty：VNDB → Bangumi            | firstNonEmpty：VNDB → Bangumi            | firstNonEmpty：VNDB → Bangumi            |
| workEpisodes      | 不配置                                   | 不配置                                   | 不配置                                   | 不配置                                   |
| workExtras        | 不配置                                   | 不配置                                   | 不配置                                   | 不配置                                   |
| workVolumes       | 不配置                                   | 不配置                                   | 不配置                                   | 不配置                                   |
| workChapters      | 不配置                                   | 不配置                                   | 不配置                                   | 不配置                                   |
| volumeChapters    | 不配置                                   | 不配置                                   | 不配置                                   | 不配置                                   |

以下规则定义关系属性的取值：

| 关系属性                           | 版本     | 固定取值               |
| ---------------------------------- | -------- | ---------------------- |
| workCharacters.fields.role         | 四种版本 | VNDB → Bangumi → YMGal |
| workCharacters.fields.note         | 四种版本 | 不配置                 |
| workCharacters.fields.isSpoiler    | 四种版本 | VNDB                   |
| personWorks.fields.note            | 四种版本 | VNDB → YMGal           |
| personWorks.fields.isSpoiler       | 四种版本 | 不配置                 |
| organizationWorks.fields.note      | 四种版本 | 不配置                 |
| organizationWorks.fields.isSpoiler | 四种版本 | 不配置                 |
| workRelations.fields.note          | 四种版本 | Wikidata               |
| entryTags.fields.note              | 四种版本 | 不配置                 |
| entryTags.fields.isSpoiler         | 四种版本 | VNDB                   |

<a id="tags"></a>

## 标签自身字段

标签自身字段遵守[共同规则](../metadata-presets.md#selection)，本表列出适用来源。

| 标签自身字段 | 版本     | 固定取值 |
| ------------ | -------- | -------- |
| description  | 四种版本 | VNDB     |
| isNsfw       | 四种版本 | VNDB     |

<a id="related"></a>

## 关联条目字段

关联游戏的每项字段规则与根游戏对应规则相同，但须作为独立配置写入 fields.relatedEntries.game，不在运行时继承。根游戏再次出现在关系端点中时，仍使用 fields.entry。其余六类关联条目按各自表格读取。这些规则只决定候选资料，不自动创建关联作品。

<a id="related-anime"></a>

### 关联动画字段

下表定义 fields.relatedEntries.anime 的固定规则。

| 字段                        | 版本       | 固定取值                     |
| --------------------------- | ---------- | ---------------------------- |
| name                        | 简体、繁体 | Bangumi → Wikidata           |
| name                        | 英文       | AniList → Wikidata → Bangumi |
| name                        | 日文       | Bangumi → AniList → Wikidata |
| originalName                | 简体、繁体 | Bangumi                      |
| originalName                | 英文、日文 | Bangumi → AniList            |
| aliases                     | 简体、繁体 | 合并 Bangumi、Wikidata       |
| aliases                     | 英文       | 合并 AniList、Bangumi        |
| aliases                     | 日文       | 合并 Bangumi、AniList        |
| description                 | 简体、繁体 | Bangumi                      |
| description                 | 英文、日文 | AniList                      |
| primaryImage                | 简体、繁体 | Bangumi                      |
| primaryImage                | 英文、日文 | Bangumi → AniList            |
| externalLinks               | 简体、繁体 | 合并 Bangumi                 |
| externalLinks               | 英文       | 合并 AniList、Bangumi        |
| externalLinks               | 日文       | 合并 Bangumi、AniList        |
| isNsfw                      | 简体、繁体 | Bangumi                      |
| isNsfw                      | 英文、日文 | Bangumi → AniList            |
| releaseDate                 | 简体、繁体 | Bangumi                      |
| releaseDate                 | 英文、日文 | Bangumi → AniList            |
| originalLanguages           | 四种版本   | Wikidata                     |
| backdropImage               | 简体、繁体 | 不配置                       |
| backdropImage               | 英文、日文 | AniList                      |
| titleLogo                   | 四种版本   | 不配置                       |
| releaseStatus               | 简体、繁体 | 不配置                       |
| releaseStatus               | 英文、日文 | AniList                      |
| releaseEndDate              | 简体、繁体 | Bangumi                      |
| releaseEndDate              | 英文、日文 | Bangumi → AniList            |
| declaredDurationMs          | 四种版本   | Bangumi                      |
| declaredRegularEpisodeCount | 四种版本   | Bangumi                      |
| declaredSpecialEpisodeCount | 四种版本   | 不配置                       |

<a id="related-comic"></a>

### 关联漫画字段

下表定义 fields.relatedEntries.comic 的固定规则。

| 字段                 | 版本       | 固定取值                     |
| -------------------- | ---------- | ---------------------------- |
| name                 | 简体、繁体 | Bangumi → Wikidata           |
| name                 | 英文       | AniList → Wikidata → Bangumi |
| name                 | 日文       | Bangumi → AniList → Wikidata |
| originalName         | 简体、繁体 | Bangumi                      |
| originalName         | 英文、日文 | Bangumi → AniList            |
| aliases              | 简体、繁体 | 合并 Bangumi、Wikidata       |
| aliases              | 英文       | 合并 AniList、Bangumi        |
| aliases              | 日文       | 合并 Bangumi、AniList        |
| description          | 简体、繁体 | Bangumi                      |
| description          | 英文、日文 | AniList                      |
| primaryImage         | 简体、繁体 | Bangumi                      |
| primaryImage         | 英文、日文 | Bangumi → AniList            |
| externalLinks        | 简体、繁体 | 合并 Bangumi                 |
| externalLinks        | 英文       | 合并 AniList、Bangumi        |
| externalLinks        | 日文       | 合并 Bangumi、AniList        |
| isNsfw               | 简体、繁体 | Bangumi                      |
| isNsfw               | 英文、日文 | Bangumi → AniList            |
| releaseDate          | 简体、繁体 | Bangumi                      |
| releaseDate          | 英文、日文 | Bangumi → AniList            |
| originalLanguages    | 四种版本   | Wikidata                     |
| backdropImage        | 简体、繁体 | 不配置                       |
| backdropImage        | 英文、日文 | AniList                      |
| titleLogo            | 四种版本   | 不配置                       |
| releaseStatus        | 简体、繁体 | Bangumi                      |
| releaseStatus        | 英文、日文 | Bangumi → AniList            |
| releaseEndDate       | 简体、繁体 | Bangumi                      |
| releaseEndDate       | 英文、日文 | Bangumi → AniList            |
| declaredPageCount    | 四种版本   | 不配置                       |
| declaredVolumeCount  | 简体、繁体 | Bangumi                      |
| declaredVolumeCount  | 英文、日文 | Bangumi → AniList            |
| declaredChapterCount | 简体、繁体 | Bangumi                      |
| declaredChapterCount | 英文、日文 | Bangumi → AniList            |

<a id="related-novel"></a>

### 关联小说字段

下表定义 fields.relatedEntries.novel 的固定规则。

| 字段                | 版本       | 固定取值                     |
| ------------------- | ---------- | ---------------------------- |
| name                | 简体、繁体 | Bangumi → Wikidata           |
| name                | 英文       | AniList → Wikidata → Bangumi |
| name                | 日文       | Bangumi → AniList → Wikidata |
| originalName        | 简体、繁体 | Bangumi                      |
| originalName        | 英文、日文 | Bangumi → AniList            |
| aliases             | 简体、繁体 | 合并 Bangumi、Wikidata       |
| aliases             | 英文       | 合并 AniList、Bangumi        |
| aliases             | 日文       | 合并 Bangumi、AniList        |
| description         | 简体、繁体 | Bangumi                      |
| description         | 英文、日文 | AniList                      |
| primaryImage        | 简体、繁体 | Bangumi                      |
| primaryImage        | 英文、日文 | Bangumi → AniList            |
| externalLinks       | 简体、繁体 | 合并 Bangumi                 |
| externalLinks       | 英文       | 合并 AniList、Bangumi        |
| externalLinks       | 日文       | 合并 Bangumi、AniList        |
| isNsfw              | 简体、繁体 | Bangumi                      |
| isNsfw              | 英文、日文 | Bangumi → AniList            |
| releaseDate         | 简体、繁体 | Bangumi                      |
| releaseDate         | 英文、日文 | Bangumi → AniList            |
| originalLanguages   | 四种版本   | Wikidata                     |
| backdropImage       | 简体、繁体 | 不配置                       |
| backdropImage       | 英文、日文 | AniList                      |
| titleLogo           | 四种版本   | 不配置                       |
| releaseStatus       | 简体、繁体 | Bangumi                      |
| releaseStatus       | 英文、日文 | Bangumi → AniList            |
| releaseEndDate      | 简体、繁体 | Bangumi                      |
| releaseEndDate      | 英文、日文 | Bangumi → AniList            |
| declaredPageCount   | 四种版本   | 不配置                       |
| declaredVolumeCount | 简体、繁体 | Bangumi                      |
| declaredVolumeCount | 英文、日文 | Bangumi → AniList            |

<a id="related-character"></a>

### 关联角色字段

下表定义 fields.relatedEntries.character 的固定规则。

| 字段          | 版本       | 固定取值                                    |
| ------------- | ---------- | ------------------------------------------- |
| name          | 简体、繁体 | Bangumi → YMGal → VNDB                      |
| name          | 英文       | VNDB → AniList → Wikidata → Bangumi → YMGal |
| name          | 日文       | VNDB → Bangumi → AniList → Wikidata → YMGal |
| originalName  | 简体、繁体 | VNDB → Bangumi → YMGal                      |
| originalName  | 英文、日文 | VNDB → Bangumi → YMGal → AniList            |
| aliases       | 简体、繁体 | 合并 VNDB、Bangumi、YMGal                   |
| aliases       | 英文、日文 | 合并 VNDB、Bangumi、YMGal、AniList          |
| description   | 简体、繁体 | YMGal → Bangumi → VNDB                      |
| description   | 英文、日文 | VNDB → AniList                              |
| primaryImage  | 简体、繁体 | VNDB → Bangumi → YMGal                      |
| primaryImage  | 英文、日文 | VNDB → Bangumi → YMGal → AniList            |
| externalLinks | 简体、繁体 | 合并 VNDB、Bangumi、YMGal                   |
| externalLinks | 英文、日文 | 合并 VNDB、AniList、Bangumi、YMGal          |
| isNsfw        | 四种版本   | 不配置                                      |
| birthDate     | 简体、繁体 | VNDB → Bangumi → YMGal                      |
| birthDate     | 英文、日文 | VNDB → Bangumi → YMGal → AniList            |
| gender        | 简体、繁体 | VNDB → Bangumi → YMGal                      |
| gender        | 英文、日文 | VNDB → Bangumi → YMGal → AniList            |
| age           | 简体、繁体 | VNDB → Bangumi                              |
| age           | 英文、日文 | VNDB → Bangumi → AniList                    |
| bloodType     | 简体、繁体 | VNDB → Bangumi                              |
| bloodType     | 英文、日文 | VNDB → Bangumi → AniList                    |
| height        | 四种版本   | VNDB → Bangumi                              |
| weight        | 四种版本   | VNDB → Bangumi                              |
| bust          | 四种版本   | VNDB → Bangumi                              |
| waist         | 四种版本   | VNDB → Bangumi                              |
| hips          | 四种版本   | VNDB → Bangumi                              |
| cupSize       | 四种版本   | VNDB → Bangumi                              |

<a id="related-person"></a>

### 关联人物字段

下表定义 fields.relatedEntries.person 的固定规则。

| 字段          | 版本       | 固定取值                                    |
| ------------- | ---------- | ------------------------------------------- |
| name          | 简体、繁体 | Bangumi → YMGal → VNDB → Wikidata           |
| name          | 英文       | VNDB → AniList → Wikidata → Bangumi → YMGal |
| name          | 日文       | VNDB → Bangumi → AniList → Wikidata → YMGal |
| originalName  | 简体、繁体 | VNDB → Bangumi → YMGal                      |
| originalName  | 英文、日文 | VNDB → Bangumi → YMGal → AniList            |
| aliases       | 简体、繁体 | 合并 VNDB、Bangumi、YMGal                   |
| aliases       | 英文、日文 | 合并 VNDB、Bangumi、YMGal、AniList          |
| description   | 简体、繁体 | YMGal → Bangumi → VNDB                      |
| description   | 英文、日文 | VNDB → AniList                              |
| primaryImage  | 简体、繁体 | Bangumi → YMGal                             |
| primaryImage  | 英文、日文 | Bangumi → YMGal → AniList                   |
| externalLinks | 简体、繁体 | 合并 VNDB、Bangumi、YMGal                   |
| externalLinks | 英文、日文 | 合并 VNDB、AniList、Bangumi、YMGal          |
| isNsfw        | 四种版本   | 不配置                                      |
| birthDate     | 简体、繁体 | Bangumi → YMGal                             |
| birthDate     | 英文、日文 | Bangumi → YMGal → AniList                   |
| deathDate     | 简体、繁体 | Bangumi                                     |
| deathDate     | 英文、日文 | Bangumi → AniList                           |
| gender        | 简体、繁体 | VNDB → Bangumi → YMGal                      |
| gender        | 英文、日文 | VNDB → Bangumi → YMGal → AniList            |

<a id="related-organization"></a>

### 关联组织字段

下表定义 fields.relatedEntries.organization 的固定规则。

| 字段          | 版本       | 固定取值                                    |
| ------------- | ---------- | ------------------------------------------- |
| name          | 简体、繁体 | Bangumi → YMGal → VNDB → Wikidata           |
| name          | 英文       | VNDB → Wikidata → AniList → Bangumi → YMGal |
| name          | 日文       | VNDB → Bangumi → Wikidata → AniList → YMGal |
| originalName  | 四种版本   | VNDB → Bangumi → YMGal                      |
| aliases       | 四种版本   | 合并 VNDB、Bangumi、YMGal                   |
| description   | 简体、繁体 | YMGal → Bangumi → VNDB                      |
| description   | 英文、日文 | VNDB                                        |
| primaryImage  | 四种版本   | Bangumi → YMGal                             |
| externalLinks | 简体、繁体 | 合并 VNDB、Bangumi、YMGal                   |
| externalLinks | 英文、日文 | 合并 VNDB、AniList、Bangumi、YMGal          |
| isNsfw        | 四种版本   | 不配置                                      |
| foundedDate   | 四种版本   | Bangumi → YMGal                             |
| dissolvedDate | 四种版本   | Bangumi                                     |

<a id="parts"></a>

## 分部范围

这四项预设均未配置分部字段和归属清单。相关作品即使存在分部，本次获取也不会据此递归读取。
