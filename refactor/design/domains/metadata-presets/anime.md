# 动画资料预设

本页定义动画资料的简体中文、繁体中文、英文和日文四项固定预设。语言初值见[预设目录](../metadata-presets.md#catalog)，matching 与 selection 遵守[共同取值规则](../metadata-presets.md#selection)。下列来源、字段和关系规则保持固定，不随 UI 语言或来源可用性改变。

<a id="scope"></a>

## 用途与参与来源

动画预设由 Bangumi 提供跨 ACGN 档案和制作资料，AniList 提供英文正文、角色与人物资料，并补充结构信息。分集和附加内容使用 Bangumi 的真实目录；TMDB 为已经对应的适用目标提供本地化正文、人物与分集图像。Fanart.tv 提供美术资源，Wikidata 补充语言与身份。

Fanart.tv 的根图片读取只适用于已有明确身份的动画影片；TV 与季标记仅用于手动素材浏览，不把整剧背景或标志自动当作季度资料。人物与组织图片仍按各自明确身份和实际能力读取。此范围遵守[Fanart 接入设计](../../extensions/sources/fanart.md#scope)，不改变下表的字段优先序，也不回写用户已保存的方案。

繁体和日文简介优先使用 TMDB，采用时分别核对单季与整剧、分集与 Extra 的范围。预设使用下表列出的官方来源。

TMDB 只从标准季提供真实分集清单，不提供附加内容清单，也不把来源 episode_type 映射为本体内容分类。因此本预设的 workExtras 与两类 Part.type 不选用 TMDB；已有明确身份的分集和附加内容仍可由它补充名称、简介、日期、片长和剧照。影片与标准季的普通字段能力不同，当前记录不提供的字段保持缺席，再按既有来源顺序取值。预设定义不回写用户已经保存的资料方案；失效引用沿正常校验处理。

| 版本     | 参与提供者                                  | 数量 |
| -------- | ------------------------------------------- | ---- |
| 简体中文 | Bangumi、AniList、TMDB、Fanart.tv、Wikidata | 5    |
| 繁体中文 | Bangumi、AniList、TMDB、Fanart.tv、Wikidata | 5    |
| 英文     | Bangumi、AniList、TMDB、Fanart.tv、Wikidata | 5    |
| 日文     | Bangumi、AniList、TMDB、Fanart.tv、Wikidata | 5    |

AniList 按[来源范围](../../extensions/sources/anilist.md#subjects)提供角色、Studio 及已明确主体的档案字段。下表的 personWorks 成员和 note 使用适用的其他来源，organizationWorks 仅采用实际 Studio 参与；混合 Staff 名单、原配关系和整部时长超出本作品上下文的 AniList 能力范围。

<a id="episode-correspondence"></a>

## 分集字段补充的对应条件

分集字段表中的来源顺序，只在该来源的目标已经对应时执行。TMDB 补充图片等字段有两条现行可用入口：清单成员本身来自 TMDB，或该成员已有准确的 TMDB 分集身份，包括经过确认的等价身份。对应仍须满足实际作品范围和本地归属。

Bangumi 清单中的成员只有 Bangumi 身份时，共同预设的两条分集回退都要求 type，而 TMDB 没有同义分类；因此不能仅凭根作品已经对应或分集编号相同补上 TMDB 图片。此时图片字段保持缺席，更新保留旧图片，其余已合法取得的资料按正常采用规则处理。已有明确 TMDB 分集身份时可以读取公共字段，读取不改变本地 regular／special 分类。

预设的产品范围是对已经对应的分集补充图片，允许其他分集暂时缺图。缺图不阻止合法编目或文件使用，用户仍可通过已有换图或外部身份编辑明确补充；预设说明不承诺从任意 Bangumi 分集自动得到 TMDB 图片。正常缺少对应不伪装成来源读取失败，也不为提高图片覆盖率放宽身份与作品范围。

作品级交叉引用和集数不直接构成逐集等价，来源对应依据见[核对记录](../../../verification/evidence/metadata-reachability/2026-10-24/README.md)。

<a id="entry"></a>

## 根条目字段

下表定义 fields.entry，表格记法见[共同取值规则](../metadata-presets.md#selection)。

| 字段                        | 简体                                  | 繁体                                  | 英文                                  | 日文                                  |
| --------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| name                        | Bangumi → Wikidata → AniList → TMDB   | TMDB → Wikidata → Bangumi → AniList   | AniList → TMDB → Wikidata → Bangumi   | Bangumi → AniList → Wikidata → TMDB   |
| originalName                | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              |
| aliases                     | 合并 Bangumi、AniList、TMDB、Wikidata | 合并 Bangumi、AniList、TMDB、Wikidata | 合并 Bangumi、AniList、TMDB、Wikidata | 合并 Bangumi、AniList、TMDB、Wikidata |
| description                 | Bangumi → TMDB → AniList              | TMDB → Bangumi → AniList              | AniList → TMDB                        | TMDB → AniList                        |
| primaryImage                | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              |
| externalLinks               | 合并 Bangumi、AniList、TMDB、Wikidata | 合并 Bangumi、AniList、TMDB、Wikidata | 合并 Bangumi、AniList、TMDB、Wikidata | 合并 Bangumi、AniList、TMDB、Wikidata |
| isNsfw                      | Bangumi → AniList                     | Bangumi → AniList                     | Bangumi → AniList                     | Bangumi → AniList                     |
| releaseDate                 | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              | Bangumi → AniList → TMDB              |
| originalLanguages           | Wikidata → TMDB                       | Wikidata → TMDB                       | Wikidata → TMDB                       | Wikidata → TMDB                       |
| backdropImage               | Fanart.tv → TMDB → AniList            | Fanart.tv → TMDB → AniList            | Fanart.tv → TMDB → AniList            | Fanart.tv → TMDB → AniList            |
| titleLogo                   | Fanart.tv → TMDB                      | Fanart.tv → TMDB                      | Fanart.tv → TMDB                      | Fanart.tv → TMDB                      |
| releaseStatus               | AniList                               | AniList                               | AniList                               | AniList                               |
| releaseEndDate              | Bangumi → AniList                     | Bangumi → AniList                     | Bangumi → AniList                     | Bangumi → AniList                     |
| declaredDurationMs          | Bangumi → TMDB                        | Bangumi → TMDB                        | Bangumi → TMDB                        | Bangumi → TMDB                        |
| declaredRegularEpisodeCount | Bangumi                               | Bangumi                               | Bangumi                               | Bangumi                               |
| declaredSpecialEpisodeCount | 不配置                                | 不配置                                | 不配置                                | 不配置                                |

<a id="relations"></a>

## 关系成员与属性

关系成员及属性按[共同取值规则](../metadata-presets.md#selection)采用。

| 关系项目          | 简体                                        | 繁体                                        | 英文                                        | 日文                                        |
| ----------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| workCharacters    | firstNonEmpty：Bangumi → AniList            | firstNonEmpty：Bangumi → AniList            | firstNonEmpty：Bangumi → AniList            | firstNonEmpty：Bangumi → AniList            |
| personWorks       | firstNonEmpty：Bangumi → TMDB               | firstNonEmpty：Bangumi → TMDB               | firstNonEmpty：Bangumi → TMDB               | firstNonEmpty：Bangumi → TMDB               |
| organizationWorks | firstNonEmpty：Bangumi → AniList → TMDB     | firstNonEmpty：Bangumi → AniList → TMDB     | firstNonEmpty：Bangumi → AniList → TMDB     | firstNonEmpty：Bangumi → AniList → TMDB     |
| workRelations     | firstNonEmpty：Bangumi → AniList → Wikidata | firstNonEmpty：Bangumi → AniList → Wikidata | firstNonEmpty：Bangumi → AniList → Wikidata | firstNonEmpty：Bangumi → AniList → Wikidata |
| entryTags         | firstNonEmpty：Bangumi → AniList            | firstNonEmpty：Bangumi → AniList            | firstNonEmpty：Bangumi → AniList            | firstNonEmpty：Bangumi → AniList            |
| workEpisodes      | firstNonEmpty：Bangumi → TMDB               | firstNonEmpty：Bangumi → TMDB               | firstNonEmpty：Bangumi → TMDB               | firstNonEmpty：Bangumi → TMDB               |
| workExtras        | firstNonEmpty：Bangumi                      | firstNonEmpty：Bangumi                      | firstNonEmpty：Bangumi                      | firstNonEmpty：Bangumi                      |
| workVolumes       | 不配置                                      | 不配置                                      | 不配置                                      | 不配置                                      |
| workChapters      | 不配置                                      | 不配置                                      | 不配置                                      | 不配置                                      |
| volumeChapters    | 不配置                                      | 不配置                                      | 不配置                                      | 不配置                                      |

以下规则定义关系属性的取值：

| 关系属性                           | 版本     | 固定取值          |
| ---------------------------------- | -------- | ----------------- |
| workCharacters.fields.role         | 四种版本 | Bangumi → AniList |
| workCharacters.fields.note         | 四种版本 | 不配置            |
| workCharacters.fields.isSpoiler    | 四种版本 | 不配置            |
| personWorks.fields.note            | 四种版本 | 不配置            |
| personWorks.fields.isSpoiler       | 四种版本 | 不配置            |
| organizationWorks.fields.note      | 四种版本 | Bangumi → AniList |
| organizationWorks.fields.isSpoiler | 四种版本 | 不配置            |
| workRelations.fields.note          | 四种版本 | Wikidata          |
| entryTags.fields.note              | 四种版本 | 不配置            |
| entryTags.fields.isSpoiler         | 四种版本 | AniList           |

<a id="tags"></a>

## 标签自身字段

标签自身字段遵守[共同规则](../metadata-presets.md#selection)，本表列出适用来源。

| 标签自身字段 | 版本     | 固定取值 |
| ------------ | -------- | -------- |
| description  | 四种版本 | AniList  |
| isNsfw       | 四种版本 | AniList  |

<a id="related"></a>

## 关联条目字段

关联动画使用与根动画相同的字段规则，并独立写入 fields.relatedEntries.anime。根对象再次作为端点时，仍使用 fields.entry。其他类型的关联字段由以下表格明确限定。人物和组织的字段来源只能补充已确定的对象，不能扩大制作名册。

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

| 字段          | 版本             | 固定取值                              |
| ------------- | ---------------- | ------------------------------------- |
| name          | 简体、繁体、日文 | Bangumi → AniList → Wikidata → TMDB   |
| name          | 英文             | AniList → Wikidata → Bangumi → TMDB   |
| originalName  | 四种版本         | Bangumi → AniList                     |
| aliases       | 四种版本         | 合并 Bangumi、AniList、Wikidata       |
| description   | 简体、繁体       | Bangumi → AniList → TMDB              |
| description   | 英文、日文       | AniList → TMDB                        |
| primaryImage  | 四种版本         | Bangumi → AniList → TMDB              |
| externalLinks | 四种版本         | 合并 Bangumi、AniList、Wikidata、TMDB |
| isNsfw        | 四种版本         | 不配置                                |
| birthDate     | 四种版本         | Bangumi → Wikidata → AniList → TMDB   |
| deathDate     | 四种版本         | Bangumi → Wikidata → AniList → TMDB   |
| gender        | 四种版本         | Bangumi → AniList → Wikidata → TMDB   |

<a id="related-organization"></a>

### 关联组织字段

下表定义 fields.relatedEntries.organization 的固定规则。

| 字段          | 版本             | 固定取值                              |
| ------------- | ---------------- | ------------------------------------- |
| name          | 简体、繁体、日文 | Bangumi → Wikidata → AniList → TMDB   |
| name          | 英文             | Wikidata → AniList → Bangumi → TMDB   |
| originalName  | 四种版本         | Bangumi                               |
| aliases       | 四种版本         | 合并 Bangumi、Wikidata                |
| description   | 简体、繁体       | Bangumi                               |
| description   | 英文、日文       | 不配置                                |
| primaryImage  | 四种版本         | Bangumi → TMDB                        |
| externalLinks | 四种版本         | 合并 Bangumi、AniList、Wikidata、TMDB |
| isNsfw        | 四种版本         | 不配置                                |
| foundedDate   | 四种版本         | Bangumi → Wikidata                    |
| dissolvedDate | 四种版本         | Bangumi → Wikidata                    |

<a id="parts-episode"></a>

## 分集字段

fields.parts.episode 规定分集自身的资料来源。哪些分集属于当前作品，由 relations.workEpisodes 的成员规则决定。

| 字段               | 简体               | 繁体               | 英文               | 日文               |
| ------------------ | ------------------ | ------------------ | ------------------ | ------------------ |
| name               | Bangumi → TMDB     | TMDB → Bangumi     | TMDB → Bangumi     | Bangumi → TMDB     |
| originalName       | Bangumi            | Bangumi            | Bangumi            | Bangumi            |
| aliases            | 合并 Bangumi       | 合并 Bangumi       | 合并 Bangumi       | 合并 Bangumi       |
| description        | Bangumi → TMDB     | TMDB → Bangumi     | TMDB               | TMDB               |
| primaryImage       | TMDB               | TMDB               | TMDB               | TMDB               |
| externalLinks      | 合并 Bangumi、TMDB | 合并 Bangumi、TMDB | 合并 Bangumi、TMDB | 合并 Bangumi、TMDB |
| releaseDate        | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     |
| numberLabel        | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     |
| type               | Bangumi            | Bangumi            | Bangumi            | Bangumi            |
| declaredDurationMs | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     |

<a id="parts-extra"></a>

## 附加内容字段

fields.parts.extra 规定附加内容自身的资料来源。成员范围由 relations.workExtras 决定，不能仅因某来源提供字段就把它的其他附加内容加入清单。

| 字段               | 简体               | 繁体               | 英文               | 日文               |
| ------------------ | ------------------ | ------------------ | ------------------ | ------------------ |
| name               | Bangumi → TMDB     | TMDB → Bangumi     | TMDB → Bangumi     | Bangumi → TMDB     |
| originalName       | Bangumi            | Bangumi            | Bangumi            | Bangumi            |
| aliases            | 合并 Bangumi       | 合并 Bangumi       | 合并 Bangumi       | 合并 Bangumi       |
| description        | Bangumi → TMDB     | TMDB → Bangumi     | TMDB               | TMDB               |
| primaryImage       | TMDB               | TMDB               | TMDB               | TMDB               |
| externalLinks      | 合并 Bangumi、TMDB | 合并 Bangumi、TMDB | 合并 Bangumi、TMDB | 合并 Bangumi、TMDB |
| releaseDate        | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     | Bangumi → TMDB     |
| type               | Bangumi            | Bangumi            | Bangumi            | Bangumi            |
| declaredDurationMs | 不配置             | 不配置             | 不配置             | 不配置             |
