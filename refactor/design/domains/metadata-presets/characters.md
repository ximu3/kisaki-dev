# 角色资料预设

本页定义角色资料的简体中文、繁体中文、英文和日文四项固定预设。语言初值见[预设目录](../metadata-presets.md#catalog)，matching 与 selection 遵守[共同取值规则](../metadata-presets.md#selection)。下列来源、字段和关系规则保持固定，不随 UI 语言或来源可用性改变。

<a id="scope"></a>

## 用途与参与来源

角色预设面向整个 ACGN 范围。Bangumi 和 AniList 提供跨作品档案，VNDB 提供适用的 Gal 参数及出场资料，YMGal 补充中文内容，Wikidata 补充真实名称和身份。

出场与人员工作按履历使用 union 合成。人员工作必须带有真实作品，不生成独立的角色与人物关系。VNDB traits 转为默认标签时，保留分组与名称共同表达的完整含义；数值或文字形式的身体属性仍写入专属字段。

YMGal 在线接口没有角色反向作品查询，因此只补充已知身份的普通字段，不参与当前角色的出场、人员工作或相应属性。

| 版本     | 参与提供者                              | 数量 |
| -------- | --------------------------------------- | ---- |
| 简体中文 | Bangumi、VNDB、AniList、YMGal、Wikidata | 5    |
| 繁体中文 | Bangumi、VNDB、AniList、YMGal、Wikidata | 5    |
| 英文     | Bangumi、VNDB、AniList、YMGal、Wikidata | 5    |
| 日文     | Bangumi、VNDB、AniList、YMGal、Wikidata | 5    |

AniList 按[来源范围](../../extensions/sources/anilist.md#relations)提供角色本身与真实登场作品；不提供原配关系，角色上下文的 personWorks 及其 note 不选用它。明确身份的人物字段仍可读取，关联动画的普通单集时长不作为整部时长。

<a id="entry"></a>

## 根条目字段

下表定义 fields.entry，表格记法见[共同取值规则](../metadata-presets.md#selection)。

| 字段          | 简体                                         | 繁体                                         | 英文                                         | 日文                                         |
| ------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- | -------------------------------------------- |
| name          | Bangumi → YMGal → Wikidata → VNDB → AniList  | Bangumi → YMGal → Wikidata → VNDB → AniList  | AniList → VNDB → Wikidata → Bangumi → YMGal  | Bangumi → VNDB → AniList → Wikidata → YMGal  |
| originalName  | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             |
| aliases       | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata |
| description   | Bangumi → YMGal → VNDB → AniList             | Bangumi → YMGal → VNDB → AniList             | AniList → VNDB                               | AniList → VNDB                               |
| primaryImage  | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             |
| externalLinks | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata |
| isNsfw        | 不配置                                       | 不配置                                       | 不配置                                       | 不配置                                       |
| birthDate     | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             |
| gender        | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             | VNDB → Bangumi → YMGal → AniList             |
| age           | VNDB → Bangumi → AniList                     | VNDB → Bangumi → AniList                     | VNDB → Bangumi → AniList                     | VNDB → Bangumi → AniList                     |
| bloodType     | VNDB → Bangumi → AniList                     | VNDB → Bangumi → AniList                     | VNDB → Bangumi → AniList                     | VNDB → Bangumi → AniList                     |
| height        | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               |
| weight        | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               |
| bust          | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               |
| waist         | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               |
| hips          | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               |
| cupSize       | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               | VNDB → Bangumi                               |

<a id="relations"></a>

## 关系成员与属性

关系成员及属性按[共同取值规则](../metadata-presets.md#selection)采用。

| 关系项目          | 简体                          | 繁体                          | 英文                          | 日文                          |
| ----------------- | ----------------------------- | ----------------------------- | ----------------------------- | ----------------------------- |
| workCharacters    | union：Bangumi、VNDB、AniList | union：Bangumi、VNDB、AniList | union：Bangumi、VNDB、AniList | union：Bangumi、VNDB、AniList |
| personWorks       | union：Bangumi、VNDB          | union：Bangumi、VNDB          | union：Bangumi、VNDB          | union：Bangumi、VNDB          |
| organizationWorks | 不配置                        | 不配置                        | 不配置                        | 不配置                        |
| workRelations     | 不配置                        | 不配置                        | 不配置                        | 不配置                        |
| entryTags         | firstNonEmpty：VNDB           | firstNonEmpty：VNDB           | firstNonEmpty：VNDB           | firstNonEmpty：VNDB           |
| workEpisodes      | 不配置                        | 不配置                        | 不配置                        | 不配置                        |
| workExtras        | 不配置                        | 不配置                        | 不配置                        | 不配置                        |
| workVolumes       | 不配置                        | 不配置                        | 不配置                        | 不配置                        |
| workChapters      | 不配置                        | 不配置                        | 不配置                        | 不配置                        |
| volumeChapters    | 不配置                        | 不配置                        | 不配置                        | 不配置                        |

以下规则定义关系属性的取值：

| 关系属性                        | 版本     | 固定取值                 |
| ------------------------------- | -------- | ------------------------ |
| workCharacters.fields.role      | 四种版本 | VNDB → Bangumi → AniList |
| workCharacters.fields.note      | 四种版本 | 不配置                   |
| workCharacters.fields.isSpoiler | 四种版本 | VNDB                     |
| personWorks.fields.note         | 四种版本 | VNDB                     |
| personWorks.fields.isSpoiler    | 四种版本 | 不配置                   |
| entryTags.fields.note           | 四种版本 | 不配置                   |
| entryTags.fields.isSpoiler      | 四种版本 | VNDB                     |

<a id="tags"></a>

## 标签自身字段

标签自身字段遵守[共同规则](../metadata-presets.md#selection)，本表列出适用来源。

| 标签自身字段 | 版本     | 固定取值 |
| ------------ | -------- | -------- |
| description  | 四种版本 | VNDB     |
| isNsfw       | 四种版本 | VNDB     |

<a id="related"></a>

## 关联条目字段

本预设只为四类作品及人物配置关联字段，不配置关联角色和组织。工作与出场关系合并时，仍须核对每项关系的完整维度；读取履历不会自动扩充本地作品库。

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

| 字段                 | 版本       | 固定取值                        |
| -------------------- | ---------- | ------------------------------- |
| name                 | 简体       | Bangumi → Wikidata → AniList    |
| name                 | 繁体       | Wikidata → Bangumi → AniList    |
| name                 | 英文       | AniList → Wikidata → Bangumi    |
| name                 | 日文       | Bangumi → AniList → Wikidata    |
| originalName         | 四种版本   | Bangumi → AniList               |
| aliases              | 四种版本   | 合并 Bangumi、AniList、Wikidata |
| description          | 简体、繁体 | Bangumi → AniList               |
| description          | 英文、日文 | AniList                         |
| primaryImage         | 四种版本   | Bangumi → AniList               |
| externalLinks        | 四种版本   | 合并 Bangumi、AniList、Wikidata |
| isNsfw               | 四种版本   | Bangumi → AniList               |
| releaseDate          | 四种版本   | Bangumi → AniList               |
| originalLanguages    | 四种版本   | Wikidata                        |
| backdropImage        | 四种版本   | AniList                         |
| titleLogo            | 四种版本   | 不配置                          |
| releaseStatus        | 四种版本   | Bangumi → AniList               |
| releaseEndDate       | 四种版本   | Bangumi → AniList               |
| declaredPageCount    | 四种版本   | 不配置                          |
| declaredVolumeCount  | 四种版本   | Bangumi → AniList               |
| declaredChapterCount | 四种版本   | Bangumi → AniList               |

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

<a id="related-person"></a>

### 关联人物字段

下表定义 fields.relatedEntries.person 的固定规则。

| 字段          | 版本       | 固定取值                                     |
| ------------- | ---------- | -------------------------------------------- |
| name          | 简体、繁体 | Bangumi → YMGal → Wikidata → VNDB → AniList  |
| name          | 英文       | AniList → VNDB → Wikidata → Bangumi → YMGal  |
| name          | 日文       | Bangumi → VNDB → AniList → Wikidata → YMGal  |
| originalName  | 四种版本   | VNDB → Bangumi → YMGal → AniList             |
| aliases       | 四种版本   | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata |
| description   | 简体、繁体 | Bangumi → YMGal → AniList → VNDB             |
| description   | 英文、日文 | AniList → VNDB                               |
| primaryImage  | 四种版本   | Bangumi → YMGal → AniList                    |
| externalLinks | 四种版本   | 合并 VNDB、Bangumi、YMGal、AniList、Wikidata |
| isNsfw        | 四种版本   | 不配置                                       |
| birthDate     | 四种版本   | Bangumi → YMGal → Wikidata → AniList         |
| deathDate     | 四种版本   | Bangumi → Wikidata → AniList                 |
| gender        | 四种版本   | VNDB → Bangumi → YMGal → AniList → Wikidata  |

<a id="parts"></a>

## 分部范围

这四项预设均未配置分部字段和归属清单。相关作品即使存在分部，本次获取也不会据此递归读取。
