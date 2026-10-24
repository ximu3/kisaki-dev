# 漫画资料预设

本页定义漫画资料的简体中文、繁体中文、英文和日文四项固定预设。语言初值见[预设目录](../metadata-presets.md#catalog)，matching 与 selection 遵守[共同取值规则](../metadata-presets.md#selection)。下列来源、字段和关系规则保持固定，不随 UI 语言或来源可用性改变。

<a id="scope"></a>

## 用途与参与来源

漫画预设优先使用 MangaUpdates 提供原作出版参与和分类资料，并补充已明确主体类别的作者档案。Bangumi 提供中文内容、卷资料及跨媒体关系；MangaDex 提供实际存在的多语言文字、封面、已明确对应的创作者档案，以及能够解释为原作范围的卷话和收录关系。AniList 补充英文角色资料及发行状态，NDL Search 只用于已确定的单册，Wikidata 补充语言和身份。

繁体、日文文字和普通主图优先使用 MangaDex。来源中的译文上传记录必须先解释其原作范围，不能直接当作原作话。

| 版本     | 参与提供者                                                     | 数量 |
| -------- | -------------------------------------------------------------- | ---- |
| 简体中文 | Bangumi、MangaUpdates、MangaDex、AniList、NDL Search、Wikidata | 6    |
| 繁体中文 | Bangumi、MangaUpdates、MangaDex、AniList、NDL Search、Wikidata | 6    |
| 英文     | Bangumi、MangaUpdates、MangaDex、AniList、NDL Search、Wikidata | 6    |
| 日文     | Bangumi、MangaUpdates、MangaDex、AniList、NDL Search、Wikidata | 6    |

AniList 按[来源范围](../../extensions/sources/anilist.md#subjects)补充作品、角色和已明确主体的档案。漫画上下文的人物工作成员与 note 使用适用的其他来源；混合 Staff 名单不用于建立人物工作，关联动画的普通单集时长也不作为整部 declaredDurationMs。

MangaUpdates 的[来源合同](../../extensions/sources/mangaupdates.md)区分混合 Author 与明确 Publisher。本作品上下文的 personWorks 使用 Bangumi，note 保持不配置；organizationWorks 采用真实原作 Publisher。已明确档案可补充原文名和条件明确的死亡日期，合编别名、当前卷数与翻译完成分别保持来源含义。

<a id="entry"></a>

## 根条目字段

下表定义 fields.entry，表格记法见[共同取值规则](../metadata-presets.md#selection)。

| 字段                 | 简体                                                    | 繁体                                                    | 英文                                                    | 日文                                                    |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| name                 | Bangumi → MangaDex → Wikidata → AniList → MangaUpdates  | MangaDex → Wikidata → Bangumi → AniList → MangaUpdates  | AniList → MangaDex → MangaUpdates → Wikidata → Bangumi  | MangaDex → Bangumi → AniList → Wikidata → MangaUpdates  |
| originalName         | Bangumi → MangaDex → AniList                            | Bangumi → MangaDex → AniList                            | Bangumi → MangaDex → AniList                            | Bangumi → MangaDex → AniList                            |
| aliases              | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata |
| description          | Bangumi → MangaDex → MangaUpdates → AniList             | MangaDex → Bangumi → MangaUpdates → AniList             | MangaUpdates → AniList → MangaDex                       | MangaDex → MangaUpdates → AniList                       |
| primaryImage         | MangaDex → Bangumi → MangaUpdates → AniList             | MangaDex → Bangumi → MangaUpdates → AniList             | MangaDex → Bangumi → MangaUpdates → AniList             | MangaDex → Bangumi → MangaUpdates → AniList             |
| externalLinks        | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata | 合并 Bangumi、MangaDex、MangaUpdates、AniList、Wikidata |
| isNsfw               | MangaDex → Bangumi → AniList                            | MangaDex → Bangumi → AniList                            | MangaDex → Bangumi → AniList                            | MangaDex → Bangumi → AniList                            |
| releaseDate          | Bangumi → AniList → MangaUpdates → MangaDex             | Bangumi → AniList → MangaUpdates → MangaDex             | Bangumi → AniList → MangaUpdates → MangaDex             | Bangumi → AniList → MangaUpdates → MangaDex             |
| originalLanguages    | MangaDex → Wikidata                                     | MangaDex → Wikidata                                     | MangaDex → Wikidata                                     | MangaDex → Wikidata                                     |
| backdropImage        | AniList                                                 | AniList                                                 | AniList                                                 | AniList                                                 |
| titleLogo            | 不配置                                                  | 不配置                                                  | 不配置                                                  | 不配置                                                  |
| releaseStatus        | Bangumi → MangaDex → MangaUpdates → AniList             | Bangumi → MangaDex → MangaUpdates → AniList             | Bangumi → MangaDex → MangaUpdates → AniList             | Bangumi → MangaDex → MangaUpdates → AniList             |
| releaseEndDate       | Bangumi → AniList                                       | Bangumi → AniList                                       | Bangumi → AniList                                       | Bangumi → AniList                                       |
| declaredPageCount    | 不配置                                                  | 不配置                                                  | 不配置                                                  | 不配置                                                  |
| declaredVolumeCount  | Bangumi → MangaUpdates → AniList                        | Bangumi → MangaUpdates → AniList                        | Bangumi → MangaUpdates → AniList                        | Bangumi → MangaUpdates → AniList                        |
| declaredChapterCount | Bangumi → AniList                                       | Bangumi → AniList                                       | Bangumi → AniList                                       | Bangumi → AniList                                       |

<a id="relations"></a>

## 关系成员与属性

关系成员及属性按[共同取值规则](../metadata-presets.md#selection)采用。

| 关系项目          | 简体                                                                  | 繁体                                                                  | 英文                                                                  | 日文                                                                  |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| workCharacters    | firstNonEmpty：Bangumi → AniList                                      | firstNonEmpty：Bangumi → AniList                                      | firstNonEmpty：Bangumi → AniList                                      | firstNonEmpty：Bangumi → AniList                                      |
| personWorks       | firstNonEmpty：Bangumi                                                | firstNonEmpty：Bangumi                                                | firstNonEmpty：Bangumi                                                | firstNonEmpty：Bangumi                                                |
| organizationWorks | firstNonEmpty：MangaUpdates → Bangumi                                 | firstNonEmpty：MangaUpdates → Bangumi                                 | firstNonEmpty：MangaUpdates → Bangumi                                 | firstNonEmpty：MangaUpdates → Bangumi                                 |
| workRelations     | firstNonEmpty：Bangumi → MangaUpdates → MangaDex → AniList → Wikidata | firstNonEmpty：Bangumi → MangaUpdates → MangaDex → AniList → Wikidata | firstNonEmpty：Bangumi → MangaUpdates → MangaDex → AniList → Wikidata | firstNonEmpty：Bangumi → MangaUpdates → MangaDex → AniList → Wikidata |
| entryTags         | firstNonEmpty：MangaUpdates → Bangumi → MangaDex → AniList            | firstNonEmpty：MangaUpdates → Bangumi → MangaDex → AniList            | firstNonEmpty：MangaUpdates → Bangumi → MangaDex → AniList            | firstNonEmpty：MangaUpdates → Bangumi → MangaDex → AniList            |
| workEpisodes      | 不配置                                                                | 不配置                                                                | 不配置                                                                | 不配置                                                                |
| workExtras        | 不配置                                                                | 不配置                                                                | 不配置                                                                | 不配置                                                                |
| workVolumes       | firstNonEmpty：Bangumi → MangaDex                                     | firstNonEmpty：Bangumi → MangaDex                                     | firstNonEmpty：Bangumi → MangaDex                                     | firstNonEmpty：Bangumi → MangaDex                                     |
| workChapters      | firstNonEmpty：MangaDex                                               | firstNonEmpty：MangaDex                                               | firstNonEmpty：MangaDex                                               | firstNonEmpty：MangaDex                                               |
| volumeChapters    | firstNonEmpty：MangaDex                                               | firstNonEmpty：MangaDex                                               | firstNonEmpty：MangaDex                                               | firstNonEmpty：MangaDex                                               |

以下规则定义关系属性的取值：

| 关系属性                           | 版本     | 固定取值          |
| ---------------------------------- | -------- | ----------------- |
| workCharacters.fields.role         | 四种版本 | Bangumi → AniList |
| workCharacters.fields.note         | 四种版本 | 不配置            |
| workCharacters.fields.isSpoiler    | 四种版本 | 不配置            |
| personWorks.fields.note            | 四种版本 | 不配置            |
| personWorks.fields.isSpoiler       | 四种版本 | 不配置            |
| organizationWorks.fields.note      | 四种版本 | MangaUpdates      |
| organizationWorks.fields.isSpoiler | 四种版本 | 不配置            |
| workRelations.fields.note          | 四种版本 | Wikidata          |
| entryTags.fields.note              | 四种版本 | 不配置            |
| entryTags.fields.isSpoiler         | 四种版本 | AniList           |
| volumeChapters.fields.numberLabel  | 四种版本 | MangaDex          |

<a id="tags"></a>

## 标签自身字段

标签自身字段遵守[共同规则](../metadata-presets.md#selection)，本表列出适用来源。

| 标签自身字段 | 版本     | 固定取值           |
| ------------ | -------- | ------------------ |
| description  | 四种版本 | MangaDex → AniList |
| isNsfw       | 四种版本 | AniList            |

<a id="related"></a>

## 关联条目字段

关联漫画的字段规则逐项采用与根漫画相同的固定值，并独立写入 fields.relatedEntries.comic。其他关联类型按以下表格读取。话的上传时间不能成为原作发表日，可读图片数不能成为原作声明页数，作品话号也不能直接复制为卷内编号。

<a id="related-game"></a>

### 关联游戏字段

下表定义 fields.relatedEntries.game 的固定规则。

| 字段              | 版本             | 固定取值           |
| ----------------- | ---------------- | ------------------ |
| name              | 简体、繁体、日文 | Bangumi → Wikidata |
| name              | 英文             | Wikidata → Bangumi |
| originalName      | 四种版本         | Bangumi            |
| aliases           | 四种版本         | 合并 Bangumi       |
| description       | 简体、繁体       | Bangumi            |
| description       | 英文、日文       | 不配置             |
| primaryImage      | 四种版本         | Bangumi            |
| externalLinks     | 四种版本         | 合并 Bangumi       |
| isNsfw            | 四种版本         | Bangumi            |
| releaseDate       | 四种版本         | Bangumi            |
| originalLanguages | 四种版本         | 不配置             |
| backdropImage     | 四种版本         | 不配置             |
| titleLogo         | 四种版本         | 不配置             |
| iconImage         | 四种版本         | 不配置             |

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

<a id="related-novel"></a>

### 关联小说字段

下表定义 fields.relatedEntries.novel 的固定规则。

| 字段                | 版本             | 固定取值                        |
| ------------------- | ---------------- | ------------------------------- |
| name                | 简体、繁体、日文 | Bangumi → Wikidata → AniList    |
| name                | 英文             | AniList → Wikidata → Bangumi    |
| originalName        | 四种版本         | Bangumi → AniList               |
| aliases             | 四种版本         | 合并 Bangumi、AniList、Wikidata |
| description         | 简体、繁体       | Bangumi                         |
| description         | 英文、日文       | AniList                         |
| primaryImage        | 四种版本         | Bangumi → AniList               |
| externalLinks       | 四种版本         | 合并 Bangumi、AniList、Wikidata |
| isNsfw              | 四种版本         | Bangumi → AniList               |
| releaseDate         | 四种版本         | Bangumi → AniList               |
| originalLanguages   | 四种版本         | Wikidata                        |
| backdropImage       | 四种版本         | AniList                         |
| titleLogo           | 四种版本         | 不配置                          |
| releaseStatus       | 四种版本         | Bangumi → AniList               |
| releaseEndDate      | 四种版本         | Bangumi → AniList               |
| declaredPageCount   | 四种版本         | 不配置                          |
| declaredVolumeCount | 四种版本         | Bangumi → AniList               |

<a id="related-character"></a>

### 关联角色字段

下表定义 fields.relatedEntries.character 的固定规则。

| 字段          | 版本       | 固定取值                        |
| ------------- | ---------- | ------------------------------- |
| name          | 简体、繁体 | Bangumi → Wikidata → AniList    |
| name          | 英文       | AniList → Wikidata → Bangumi    |
| name          | 日文       | Bangumi → AniList → Wikidata    |
| originalName  | 四种版本   | Bangumi → AniList               |
| aliases       | 四种版本   | 合并 Bangumi、AniList、Wikidata |
| description   | 简体、繁体 | Bangumi → AniList               |
| description   | 英文、日文 | AniList                         |
| primaryImage  | 四种版本   | Bangumi → AniList               |
| externalLinks | 四种版本   | 合并 Bangumi、AniList、Wikidata |
| isNsfw        | 四种版本   | 不配置                          |
| birthDate     | 四种版本   | Bangumi → AniList               |
| gender        | 四种版本   | Bangumi → AniList               |
| age           | 四种版本   | Bangumi → AniList               |
| bloodType     | 四种版本   | Bangumi → AniList               |
| height        | 四种版本   | Bangumi                         |
| weight        | 四种版本   | Bangumi                         |
| bust          | 四种版本   | Bangumi                         |
| waist         | 四种版本   | Bangumi                         |
| hips          | 四种版本   | Bangumi                         |
| cupSize       | 四种版本   | Bangumi                         |

<a id="related-person"></a>

### 关联人物字段

下表定义 fields.relatedEntries.person 的固定规则。

| 字段          | 版本       | 固定取值                                                |
| ------------- | ---------- | ------------------------------------------------------- |
| name          | 简体、繁体 | Bangumi → MangaUpdates → MangaDex → AniList → Wikidata  |
| name          | 英文       | AniList → MangaUpdates → MangaDex → Wikidata → Bangumi  |
| name          | 日文       | Bangumi → AniList → MangaUpdates → MangaDex → Wikidata  |
| originalName  | 四种版本   | Bangumi → AniList → MangaUpdates                        |
| aliases       | 四种版本   | 合并 Bangumi、MangaUpdates、AniList、Wikidata           |
| description   | 简体、繁体 | Bangumi → MangaDex → MangaUpdates → AniList             |
| description   | 英文       | AniList → MangaDex → MangaUpdates                       |
| description   | 日文       | MangaDex → AniList → MangaUpdates                       |
| primaryImage  | 四种版本   | Bangumi → MangaUpdates → MangaDex → AniList             |
| externalLinks | 四种版本   | 合并 Bangumi、MangaUpdates、MangaDex、AniList、Wikidata |
| isNsfw        | 四种版本   | 不配置                                                  |
| birthDate     | 四种版本   | Bangumi → Wikidata → AniList → MangaUpdates             |
| deathDate     | 四种版本   | Bangumi → Wikidata → AniList → MangaUpdates             |
| gender        | 四种版本   | Bangumi → AniList → MangaUpdates → Wikidata             |

<a id="related-organization"></a>

### 关联组织字段

下表定义 fields.relatedEntries.organization 的固定规则。

| 字段          | 版本             | 固定取值                                      |
| ------------- | ---------------- | --------------------------------------------- |
| name          | 简体、繁体、日文 | Bangumi → MangaUpdates → Wikidata → AniList   |
| name          | 英文             | MangaUpdates → Wikidata → AniList → Bangumi   |
| originalName  | 四种版本         | Bangumi → MangaUpdates                        |
| aliases       | 四种版本         | 合并 Bangumi、MangaUpdates、Wikidata          |
| description   | 简体、繁体       | Bangumi → MangaUpdates                        |
| description   | 英文、日文       | MangaUpdates                                  |
| primaryImage  | 四种版本         | Bangumi                                       |
| externalLinks | 四种版本         | 合并 Bangumi、MangaUpdates、AniList、Wikidata |
| isNsfw        | 四种版本         | 不配置                                        |
| foundedDate   | 四种版本         | Bangumi → Wikidata                            |
| dissolvedDate | 四种版本         | Bangumi → Wikidata                            |

<a id="parts-volume"></a>

## 卷字段

fields.parts.volume 规定漫画卷自身的字段。卷成员由 relations.workVolumes 决定，卷与话的收录关系由 relations.volumeChapters 决定，字段读取本身不扩大这两种范围。

| 字段                 | 简体                     | 繁体                     | 英文                     | 日文                     |
| -------------------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| name                 | Bangumi → NDL Search     | Bangumi → NDL Search     | Bangumi → NDL Search     | Bangumi → NDL Search     |
| originalName         | Bangumi                  | Bangumi                  | Bangumi                  | Bangumi                  |
| aliases              | 合并 Bangumi             | 合并 Bangumi             | 合并 Bangumi             | 合并 Bangumi             |
| description          | Bangumi                  | Bangumi                  | 不配置                   | 不配置                   |
| primaryImage         | MangaDex → Bangumi       | MangaDex → Bangumi       | MangaDex → Bangumi       | MangaDex → Bangumi       |
| externalLinks        | 合并 Bangumi、NDL Search | 合并 Bangumi、NDL Search | 合并 Bangumi、NDL Search | 合并 Bangumi、NDL Search |
| releaseDate          | Bangumi → NDL Search     | Bangumi → NDL Search     | Bangumi → NDL Search     | Bangumi → NDL Search     |
| numberLabel          | Bangumi → MangaDex       | Bangumi → MangaDex       | Bangumi → MangaDex       | Bangumi → MangaDex       |
| declaredPageCount    | Bangumi → NDL Search     | Bangumi → NDL Search     | Bangumi → NDL Search     | Bangumi → NDL Search     |
| declaredChapterCount | Bangumi                  | Bangumi                  | Bangumi                  | Bangumi                  |

<a id="parts-chapter"></a>

## 话字段

fields.parts.chapter 规定漫画话自身的字段。话成员及卷话收录分别使用 relations.workChapters 和 relations.volumeChapters 的规则。表中未配置的原作日期、页数和简介，不能用上传记录的其他值代替。

| 字段              | 简体          | 繁体          | 英文          | 日文          |
| ----------------- | ------------- | ------------- | ------------- | ------------- |
| name              | MangaDex      | MangaDex      | MangaDex      | MangaDex      |
| originalName      | 不配置        | 不配置        | 不配置        | 不配置        |
| aliases           | 不配置        | 不配置        | 不配置        | 不配置        |
| description       | 不配置        | 不配置        | 不配置        | 不配置        |
| primaryImage      | 不配置        | 不配置        | 不配置        | 不配置        |
| externalLinks     | 合并 MangaDex | 合并 MangaDex | 合并 MangaDex | 合并 MangaDex |
| releaseDate       | 不配置        | 不配置        | 不配置        | 不配置        |
| numberLabel       | MangaDex      | MangaDex      | MangaDex      | MangaDex      |
| declaredPageCount | 不配置        | 不配置        | 不配置        | 不配置        |

漫画卷的 NDL Search 字段沿[书目与版本规则](../../extensions/sources/ndl.md#fields)采用，优先序按本表；原作首发与实际版本页数分别保留。
