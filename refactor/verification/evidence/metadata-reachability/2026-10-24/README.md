# 默认分集补充与辅助资料集核对

核对日期：2026-10-24。交叉检查动画预设、来源合同和 Anime-Lists、anime-offline-database 两项上游资料集。仅执行公开仓库、README 与 schema 的只读查询，没有调用用户账号、运行 provider 或下载完整资料集。固定提交和 Git blob 身份见[source-observations.json](source-observations.json)。

## 现行配置的确定结果

动画四份预设优先采用 Bangumi 分集成员，分集图片只使用 TMDB。共同回退为 type + numberLabel、type + originalName + releaseDate，所有键值都必须真实可比。TMDB 没有与 regular／special 同义的分类，因此没有直接分集身份或已确认等价映射时，两条回退都不能将该来源的分集与 Bangumi 成员对应。

这是现行规则的静态反例，不是正式运行失败记录。其影响限于缺少对应依据的跨来源字段补充：Bangumi 的合法成员仍可采用，TMDB 自身清单中已有明确身份的分集可以读取自己的图片；不能概括为整个动画预设不可使用。前置条件和验收分别归[动画预设](../../../../design/domains/metadata-presets/anime.md#episode-correspondence)与[预设场景](../../../scenarios/metadata.md#profiles)。

## 辅助资料集的已读事实

| 资料集 | 已核对事实 | 尚不能据此得出的结论 |
| --- | --- | --- |
| Anime-Lists | 固定 README 定义 anidbid、tmdbtv、tmdbseason、tmdboffset，以及特殊集、偏移和一对多映射；具有 TMDB 季与分集方向的映射能力 | 尚未证明 Bangumi 分集如何准确进入对应 AniDB 编号范围，也未核对实际映射覆盖与冲突。不能只凭作品级 ID 推导整条分集链已接通 |
| anime-offline-database | GitHub 元数据为 archived: true；固定 README 标示 2026 年第 27 周，数据通过 Release 提供。schema 的 Anime 包含作品级来源 URL、标题、集数等，没有逐集映射结构 | 已读来源目录没有列出 Bangumi；未检查完整数据，不能据此断言每一行均不存在该链接。也不能把作品级交叉引用或集数当作分集等价，或假定上游继续按原周期更新 |

来源：[Anime-Lists 固定 README](https://github.com/Anime-Lists/anime-lists/blob/9ed90bf804bb24d58c99ea653e095194df494b52/README.md)、[anime-offline-database 固定 README](https://github.com/manami-project/anime-offline-database/blob/96da26358c8e599a9c076818aee247c68cb69401/README.md)、[固定 schema](https://github.com/manami-project/anime-offline-database/blob/96da26358c8e599a9c076818aee247c68cb69401/schemas/anime-offline-database-minified.schema.json)、[仓库当前状态](https://github.com/manami-project/anime-offline-database)。README 标示 ODbL-1.0，具体数据采用与分发还需按实际材料核对许可。

## 适用范围

两项资料集不在当前[官方交付范围](../../../../design/extensions/catalog.md#materials)内。现行[动画预设](../../../../design/domains/metadata-presets/anime.md#episode-correspondence)要求准确的分集身份或已确认的等价映射，缺少对应时允许缺图。本页的静态反例说明这一适用条件；正式读取、图片准备与采用仍须通过对应运行验收。
