# 小说资料预设

本页定义轻小说资料的简体中文、繁体中文、英文和日文四项固定预设。语言初值见[预设目录](../metadata-presets.md#catalog)，matching 与 selection 遵守[共同取值规则](../metadata-presets.md#selection)。下列来源、字段和关系规则保持固定，不随 UI 语言或来源可用性改变。

<a id="scope"></a>

## 用途与参与来源

小说预设由 RanobeDB 提供轻小说作品、真实书目、已明确 Staff 的档案字段以及原作出版参与资料，Bangumi 提供可定类的作者／插画家关系、中文内容和跨媒体关系。NDL Search 补充已明确对应的单册书目信息，Wikidata 补充名称和身份。

英文与日文版本加入 AniList，为作品和角色提供非中文长文。日文作品简介可以合法回退到英文，卷简介可以使用 RanobeDB 的 description_ja。系列、首卷和具体卷的介绍必须保持各自范围，不能互相代用。

| 版本     | 参与提供者                                       | 数量 |
| -------- | ------------------------------------------------ | ---- |
| 简体中文 | RanobeDB、Bangumi、NDL Search、Wikidata          | 4    |
| 繁体中文 | RanobeDB、Bangumi、NDL Search、Wikidata          | 4    |
| 英文     | RanobeDB、Bangumi、NDL Search、Wikidata、AniList | 5    |
| 日文     | RanobeDB、Bangumi、NDL Search、Wikidata、AniList | 5    |

AniList 按[来源范围](../../extensions/sources/anilist.md#subjects)补充作品、角色和已明确主体的档案。小说上下文的人物工作成员与 note 使用适用的其他来源；混合 Staff 名单不用于建立人物工作，关联动画的普通单集时长不作为整部 declaredDurationMs。

RanobeDB 同样不从混合 Staff 名单发现人物工作；已明确 Person 自身的原作履历由人物预设采用。Series、Book 与 Release 的范围、代表封面及发行选择按[来源方案](../../extensions/sources/ranobedb.md)执行，卷号不从 sort_order 生成。

<a id="entry"></a>

## 根条目字段

下表定义 fields.entry，表格记法见[共同取值规则](../metadata-presets.md#selection)。

| 字段                | 简体                             | 繁体                             | 英文                                      | 日文                                      |
| ------------------- | -------------------------------- | -------------------------------- | ----------------------------------------- | ----------------------------------------- |
| name                | Bangumi → RanobeDB → Wikidata    | Bangumi → Wikidata → RanobeDB    | RanobeDB → AniList → Wikidata → Bangumi   | RanobeDB → Bangumi → Wikidata → AniList   |
| originalName        | RanobeDB → Bangumi               | RanobeDB → Bangumi               | RanobeDB → Bangumi → AniList              | RanobeDB → Bangumi → AniList              |
| aliases             | 合并 RanobeDB、Bangumi、Wikidata | 合并 RanobeDB、Bangumi、Wikidata | 合并 RanobeDB、Bangumi、AniList、Wikidata | 合并 RanobeDB、Bangumi、AniList、Wikidata |
| description         | Bangumi → RanobeDB               | Bangumi → RanobeDB               | AniList → RanobeDB                        | AniList → RanobeDB                        |
| primaryImage        | RanobeDB → Bangumi               | RanobeDB → Bangumi               | RanobeDB → Bangumi → AniList              | RanobeDB → Bangumi → AniList              |
| externalLinks       | 合并 RanobeDB、Bangumi、Wikidata | 合并 RanobeDB、Bangumi、Wikidata | 合并 RanobeDB、Bangumi、AniList、Wikidata | 合并 RanobeDB、Bangumi、AniList、Wikidata |
| isNsfw              | Bangumi                          | Bangumi                          | Bangumi → AniList                         | Bangumi → AniList                         |
| releaseDate         | RanobeDB → Bangumi               | RanobeDB → Bangumi               | RanobeDB → Bangumi → AniList              | RanobeDB → Bangumi → AniList              |
| originalLanguages   | RanobeDB → Wikidata              | RanobeDB → Wikidata              | RanobeDB → Wikidata                       | RanobeDB → Wikidata                       |
| backdropImage       | 不配置                           | 不配置                           | AniList                                   | AniList                                   |
| titleLogo           | 不配置                           | 不配置                           | 不配置                                    | 不配置                                    |
| releaseStatus       | RanobeDB → Bangumi               | RanobeDB → Bangumi               | RanobeDB → Bangumi → AniList              | RanobeDB → Bangumi → AniList              |
| releaseEndDate      | RanobeDB → Bangumi               | RanobeDB → Bangumi               | RanobeDB → Bangumi → AniList              | RanobeDB → Bangumi → AniList              |
| declaredPageCount   | 不配置                           | 不配置                           | 不配置                                    | 不配置                                    |
| declaredVolumeCount | Bangumi                          | Bangumi                          | Bangumi → AniList                         | Bangumi → AniList                         |

<a id="relations"></a>

## 关系成员与属性

关系成员及属性按[共同取值规则](../metadata-presets.md#selection)采用。

| 关系项目          | 简体                                         | 繁体                                         | 英文                                                   | 日文                                                   |
| ----------------- | -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| workCharacters    | firstNonEmpty：Bangumi                       | firstNonEmpty：Bangumi                       | firstNonEmpty：Bangumi → AniList                       | firstNonEmpty：Bangumi → AniList                       |
| personWorks       | firstNonEmpty：Bangumi                       | firstNonEmpty：Bangumi                       | firstNonEmpty：Bangumi                                 | firstNonEmpty：Bangumi                                 |
| organizationWorks | firstNonEmpty：RanobeDB → Bangumi            | firstNonEmpty：RanobeDB → Bangumi            | firstNonEmpty：RanobeDB → Bangumi                      | firstNonEmpty：RanobeDB → Bangumi                      |
| workRelations     | firstNonEmpty：Bangumi → RanobeDB → Wikidata | firstNonEmpty：Bangumi → RanobeDB → Wikidata | firstNonEmpty：Bangumi → RanobeDB → AniList → Wikidata | firstNonEmpty：Bangumi → RanobeDB → AniList → Wikidata |
| entryTags         | firstNonEmpty：RanobeDB → Bangumi            | firstNonEmpty：RanobeDB → Bangumi            | firstNonEmpty：RanobeDB → Bangumi → AniList            | firstNonEmpty：RanobeDB → Bangumi → AniList            |
| workEpisodes      | 不配置                                       | 不配置                                       | 不配置                                                 | 不配置                                                 |
| workExtras        | 不配置                                       | 不配置                                       | 不配置                                                 | 不配置                                                 |
| workVolumes       | firstNonEmpty：RanobeDB → Bangumi            | firstNonEmpty：RanobeDB → Bangumi            | firstNonEmpty：RanobeDB → Bangumi                      | firstNonEmpty：RanobeDB → Bangumi                      |
| workChapters      | 不配置                                       | 不配置                                       | 不配置                                                 | 不配置                                                 |
| volumeChapters    | 不配置                                       | 不配置                                       | 不配置                                                 | 不配置                                                 |

以下规则定义关系属性的取值：

| 关系属性                           | 版本       | 固定取值          |
| ---------------------------------- | ---------- | ----------------- |
| workCharacters.fields.role         | 简体、繁体 | Bangumi           |
| workCharacters.fields.role         | 英文、日文 | Bangumi → AniList |
| workCharacters.fields.note         | 四种版本   | 不配置            |
| workCharacters.fields.isSpoiler    | 四种版本   | 不配置            |
| personWorks.fields.note            | 四种版本   | 不配置            |
| personWorks.fields.isSpoiler       | 四种版本   | 不配置            |
| organizationWorks.fields.note      | 四种版本   | 不配置            |
| organizationWorks.fields.isSpoiler | 四种版本   | 不配置            |
| workRelations.fields.note          | 四种版本   | Wikidata          |
| entryTags.fields.note              | 四种版本   | 不配置            |
| entryTags.fields.isSpoiler         | 简体、繁体 | 不配置            |
| entryTags.fields.isSpoiler         | 英文、日文 | AniList           |

<a id="tags"></a>

## 标签自身字段

标签自身字段遵守[共同规则](../metadata-presets.md#selection)，本表列出适用来源。

| 标签自身字段 | 版本       | 固定取值           |
| ------------ | ---------- | ------------------ |
| description  | 简体、繁体 | RanobeDB           |
| description  | 英文、日文 | RanobeDB → AniList |
| isNsfw       | 简体、繁体 | 不配置             |
| isNsfw       | 英文、日文 | AniList            |

<a id="related"></a>

## 关联条目字段

关联小说的字段规则与根小说使用相同的固定值，并独立写入 fields.relatedEntries.novel。其他类型按以下表格读取。来源的书目排序和计数不用于生成卷号或声明数量。

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
| name                        | 简体       | Bangumi → Wikidata              |
| name                        | 繁体       | Wikidata → Bangumi              |
| name                        | 英文       | AniList → Wikidata → Bangumi    |
| name                        | 日文       | Bangumi → AniList → Wikidata    |
| originalName                | 简体、繁体 | Bangumi                         |
| originalName                | 英文、日文 | Bangumi → AniList               |
| aliases                     | 简体、繁体 | 合并 Bangumi、Wikidata          |
| aliases                     | 英文、日文 | 合并 Bangumi、AniList、Wikidata |
| description                 | 简体、繁体 | Bangumi                         |
| description                 | 英文、日文 | AniList                         |
| primaryImage                | 简体、繁体 | Bangumi                         |
| primaryImage                | 英文、日文 | Bangumi → AniList               |
| externalLinks               | 简体、繁体 | 合并 Bangumi、Wikidata          |
| externalLinks               | 英文、日文 | 合并 Bangumi、AniList、Wikidata |
| isNsfw                      | 简体、繁体 | Bangumi                         |
| isNsfw                      | 英文、日文 | Bangumi → AniList               |
| releaseDate                 | 简体、繁体 | Bangumi                         |
| releaseDate                 | 英文、日文 | Bangumi → AniList               |
| originalLanguages           | 四种版本   | Wikidata                        |
| backdropImage               | 简体、繁体 | 不配置                          |
| backdropImage               | 英文、日文 | AniList                         |
| titleLogo                   | 四种版本   | 不配置                          |
| releaseStatus               | 简体、繁体 | 不配置                          |
| releaseStatus               | 英文、日文 | AniList                         |
| releaseEndDate              | 简体、繁体 | Bangumi                         |
| releaseEndDate              | 英文、日文 | Bangumi → AniList               |
| declaredDurationMs          | 简体、繁体 | Bangumi                         |
| declaredDurationMs          | 英文、日文 | Bangumi                         |
| declaredRegularEpisodeCount | 四种版本   | Bangumi                         |
| declaredSpecialEpisodeCount | 四种版本   | 不配置                          |

<a id="related-comic"></a>

### 关联漫画字段

下表定义 fields.relatedEntries.comic 的固定规则。

| 字段                 | 版本       | 固定取值                        |
| -------------------- | ---------- | ------------------------------- |
| name                 | 简体       | Bangumi → Wikidata              |
| name                 | 繁体       | Wikidata → Bangumi              |
| name                 | 英文       | AniList → Wikidata → Bangumi    |
| name                 | 日文       | Bangumi → AniList → Wikidata    |
| originalName         | 简体、繁体 | Bangumi                         |
| originalName         | 英文、日文 | Bangumi → AniList               |
| aliases              | 简体、繁体 | 合并 Bangumi、Wikidata          |
| aliases              | 英文、日文 | 合并 Bangumi、AniList、Wikidata |
| description          | 简体、繁体 | Bangumi                         |
| description          | 英文、日文 | AniList                         |
| primaryImage         | 简体、繁体 | Bangumi                         |
| primaryImage         | 英文、日文 | Bangumi → AniList               |
| externalLinks        | 简体、繁体 | 合并 Bangumi、Wikidata          |
| externalLinks        | 英文、日文 | 合并 Bangumi、AniList、Wikidata |
| isNsfw               | 简体、繁体 | Bangumi                         |
| isNsfw               | 英文、日文 | Bangumi → AniList               |
| releaseDate          | 简体、繁体 | Bangumi                         |
| releaseDate          | 英文、日文 | Bangumi → AniList               |
| originalLanguages    | 四种版本   | Wikidata                        |
| backdropImage        | 简体、繁体 | 不配置                          |
| backdropImage        | 英文、日文 | AniList                         |
| titleLogo            | 四种版本   | 不配置                          |
| releaseStatus        | 简体、繁体 | Bangumi                         |
| releaseStatus        | 英文、日文 | Bangumi → AniList               |
| releaseEndDate       | 简体、繁体 | Bangumi                         |
| releaseEndDate       | 英文、日文 | Bangumi → AniList               |
| declaredPageCount    | 四种版本   | 不配置                          |
| declaredVolumeCount  | 简体、繁体 | Bangumi                         |
| declaredVolumeCount  | 英文、日文 | Bangumi → AniList               |
| declaredChapterCount | 简体、繁体 | Bangumi                         |
| declaredChapterCount | 英文、日文 | Bangumi → AniList               |

<a id="related-character"></a>

### 关联角色字段

下表定义 fields.relatedEntries.character 的固定规则。

| 字段          | 版本       | 固定取值                        |
| ------------- | ---------- | ------------------------------- |
| name          | 简体、繁体 | Bangumi → Wikidata              |
| name          | 英文       | AniList → Wikidata → Bangumi    |
| name          | 日文       | Bangumi → AniList → Wikidata    |
| originalName  | 简体、繁体 | Bangumi                         |
| originalName  | 英文、日文 | Bangumi → AniList               |
| aliases       | 简体、繁体 | 合并 Bangumi、Wikidata          |
| aliases       | 英文、日文 | 合并 Bangumi、AniList、Wikidata |
| description   | 简体、繁体 | Bangumi                         |
| description   | 英文、日文 | AniList                         |
| primaryImage  | 简体、繁体 | Bangumi                         |
| primaryImage  | 英文、日文 | Bangumi → AniList               |
| externalLinks | 简体、繁体 | 合并 Bangumi、Wikidata          |
| externalLinks | 英文、日文 | 合并 Bangumi、AniList、Wikidata |
| isNsfw        | 四种版本   | 不配置                          |
| birthDate     | 简体、繁体 | Bangumi                         |
| birthDate     | 英文、日文 | Bangumi → AniList               |
| gender        | 简体、繁体 | Bangumi                         |
| gender        | 英文、日文 | Bangumi → AniList               |
| age           | 简体、繁体 | Bangumi                         |
| age           | 英文、日文 | Bangumi → AniList               |
| bloodType     | 简体、繁体 | Bangumi                         |
| bloodType     | 英文、日文 | Bangumi → AniList               |
| height        | 四种版本   | Bangumi                         |
| weight        | 四种版本   | Bangumi                         |
| bust          | 四种版本   | Bangumi                         |
| waist         | 四种版本   | Bangumi                         |
| hips          | 四种版本   | Bangumi                         |
| cupSize       | 四种版本   | Bangumi                         |

<a id="related-person"></a>

### 关联人物字段

下表定义 fields.relatedEntries.person 的固定规则。

| 字段          | 版本       | 固定取值                                  |
| ------------- | ---------- | ----------------------------------------- |
| name          | 简体、繁体 | Bangumi → RanobeDB → Wikidata             |
| name          | 英文       | AniList → RanobeDB → Wikidata → Bangumi   |
| name          | 日文       | Bangumi → RanobeDB → AniList → Wikidata   |
| originalName  | 简体、繁体 | Bangumi → RanobeDB                        |
| originalName  | 英文、日文 | Bangumi → RanobeDB → AniList              |
| aliases       | 简体、繁体 | 合并 Bangumi、RanobeDB、Wikidata          |
| aliases       | 英文、日文 | 合并 Bangumi、RanobeDB、AniList、Wikidata |
| description   | 简体、繁体 | Bangumi → RanobeDB                        |
| description   | 英文、日文 | AniList → RanobeDB                        |
| primaryImage  | 简体、繁体 | Bangumi                                   |
| primaryImage  | 英文、日文 | Bangumi → AniList                         |
| externalLinks | 简体、繁体 | 合并 Bangumi、RanobeDB、Wikidata          |
| externalLinks | 英文、日文 | 合并 Bangumi、RanobeDB、AniList、Wikidata |
| isNsfw        | 四种版本   | 不配置                                    |
| birthDate     | 简体、繁体 | Bangumi → Wikidata                        |
| birthDate     | 英文、日文 | Bangumi → Wikidata → AniList              |
| deathDate     | 简体、繁体 | Bangumi → Wikidata                        |
| deathDate     | 英文、日文 | Bangumi → Wikidata → AniList              |
| gender        | 简体、繁体 | Bangumi → Wikidata                        |
| gender        | 英文、日文 | Bangumi → AniList → Wikidata              |

<a id="related-organization"></a>

### 关联组织字段

下表定义 fields.relatedEntries.organization 的固定规则。

| 字段          | 版本       | 固定取值                                  |
| ------------- | ---------- | ----------------------------------------- |
| name          | 简体、繁体 | Bangumi → RanobeDB → Wikidata             |
| name          | 英文       | RanobeDB → Wikidata → AniList → Bangumi   |
| name          | 日文       | Bangumi → RanobeDB → Wikidata → AniList   |
| originalName  | 四种版本   | Bangumi → RanobeDB                        |
| aliases       | 四种版本   | 合并 Bangumi、RanobeDB、Wikidata          |
| description   | 简体、繁体 | Bangumi → RanobeDB                        |
| description   | 英文、日文 | RanobeDB                                  |
| primaryImage  | 四种版本   | Bangumi                                   |
| externalLinks | 简体、繁体 | 合并 Bangumi、RanobeDB、Wikidata          |
| externalLinks | 英文、日文 | 合并 Bangumi、RanobeDB、AniList、Wikidata |
| isNsfw        | 四种版本   | 不配置                                    |
| foundedDate   | 四种版本   | Bangumi → Wikidata                        |
| dissolvedDate | 四种版本   | Bangumi → Wikidata                        |

<a id="parts-volume"></a>

## 卷字段

fields.parts.volume 为已指定的小说卷补充资料，relations.workVolumes 提供作品的卷清单。两项能力分别声明，单卷字段读取只作用于请求中的卷。

| 字段              | 简体                               | 繁体                               | 英文                               | 日文                               |
| ----------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| name              | Bangumi → RanobeDB → NDL Search    | Bangumi → RanobeDB → NDL Search    | RanobeDB → Bangumi → NDL Search    | RanobeDB → Bangumi → NDL Search    |
| originalName      | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 |
| aliases           | 合并 RanobeDB、Bangumi             | 合并 RanobeDB、Bangumi             | 合并 RanobeDB、Bangumi             | 合并 RanobeDB、Bangumi             |
| description       | Bangumi → RanobeDB                 | Bangumi → RanobeDB                 | RanobeDB                           | RanobeDB                           |
| primaryImage      | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 |
| externalLinks     | 合并 RanobeDB、Bangumi、NDL Search | 合并 RanobeDB、Bangumi、NDL Search | 合并 RanobeDB、Bangumi、NDL Search | 合并 RanobeDB、Bangumi、NDL Search |
| releaseDate       | RanobeDB → Bangumi → NDL Search    | RanobeDB → Bangumi → NDL Search    | RanobeDB → Bangumi → NDL Search    | RanobeDB → Bangumi → NDL Search    |
| numberLabel       | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 | RanobeDB → Bangumi                 |
| declaredPageCount | RanobeDB → Bangumi → NDL Search    | RanobeDB → Bangumi → NDL Search    | RanobeDB → Bangumi → NDL Search    | RanobeDB → Bangumi → NDL Search    |

小说卷的 NDL Search 字段沿[书目与版本规则](../../extensions/sources/ndl.md#fields)采用，优先序按本表；原作首发与实际版本页数分别保留。
