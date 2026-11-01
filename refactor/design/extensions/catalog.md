# 官方扩展目录

官方扩展共 33 项：17 个资料与平台来源、13 个迁移导入器、3 个界面译本。下表链接每项完整设计；共同职责分别见[来源接入](sources.md)、[迁移导入](importers.md)和[译本交付](languages.md)。

<a id="catalog"></a>

## 交付清单

| 序号 | 官方扩展                                                | 主要用途                                   |
| ---- | ------------------------------------------------------- | ------------------------------------------ |
| 1    | [VNDB](sources/vndb.md)                                 | 视觉小说资料、本人清单与个人记录           |
| 2    | [Bangumi](sources/bangumi.md)                           | 四类作品、角色与制作资料，以及收藏和记录   |
| 3    | [YMGal](sources/ymgal.md)                               | 游戏、角色、人物和组织的在线资料           |
| 4    | [MangaDex](sources/mangadex.md)                         | 漫画与卷话资料、本人列表及记录             |
| 5    | [TMDB](sources/tmdb.md)                                 | 动画影片、季度与制作资料，以及影片个人记录 |
| 6    | [SteamGridDB](sources/steamgriddb.md)                   | 游戏对应与四类图片素材                     |
| 7    | [Steam](sources/steam.md)                               | 商店资料、本人拥有库、愿望单与累计时长采用 |
| 8    | [IGDB](sources/igdb.md)                                 | 游戏、角色、公司与图片资料                 |
| 9    | [MyAnimeList](sources/mal.md)                           | 官方动画、漫画与小说资料，以及本人列表     |
| 10   | [AniList](sources/anilist.md)                           | 作品与主体图谱、本人列表及喜爱             |
| 11   | [Google Books](sources/googlebooks.md)                  | 已明确书目的资料补充与个人记录             |
| 12   | [RanobeDB](sources/ranobedb.md)                         | 小说系列、单册、发行与制作资料             |
| 13   | [MangaUpdates](sources/mangaupdates.md)                 | 漫画与小说资料、本人列表和总评分           |
| 14   | [NDL Search](sources/ndl.md)                            | 已明确整作或单册的出版书目补充             |
| 15   | [itch.io](sources/itchio.md)                            | 独立游戏资料、拥有库、项目与公开合集导入   |
| 16   | [Wikidata](sources/wikidata.md)                         | 真实对象、关系与内容目录的结构化补充       |
| 17   | [Fanart.tv](sources/fanart.md)                          | 已对应作品、人物和组织的图片补充           |
| 18   | [Goodreads Importer](importers/goodreads.md)            | Goodreads 官方资料库导出                   |
| 19   | [Vnite Importer](importers/vnite.md)                    | Vnite 资料与记录迁移                       |
| 20   | [Playnite Importer](importers/playnite.md)              | Playnite 资料与记录迁移                    |
| 21   | [PotatoVN Importer](importers/potatovn.md)              | PotatoVN 资料与记录迁移                    |
| 22   | [calibre Importer](importers/calibre.md)                | calibre 书库迁移                           |
| 23   | [Mihon / Tachiyomi Backup Importer](importers/mihon.md) | 已声明版本的备份格式系列                   |
| 24   | [NFO / ComicInfo Importer](importers/nfo-comicinfo.md)  | NFO 与 ComicInfo 格式资料                  |
| 25   | [LaunchBox Importer](importers/launchbox.md)            | LaunchBox 资料与记录迁移                   |
| 26   | [Koodo Reader Importer](importers/koodo.md)             | Koodo Reader 阅读资料迁移                  |
| 27   | [Anx Reader Importer](importers/anx.md)                 | Anx Reader 阅读资料迁移                    |
| 28   | [KOReader Importer](importers/koreader.md)              | KOReader 阅读资料迁移                      |
| 29   | [Kotatsu Importer](importers/kotatsu.md)                | Kotatsu 漫画资料迁移                       |
| 30   | [YACReader Importer](importers/yacreader.md)            | YACReader 漫画资料迁移                     |
| 31   | [简体中文语言扩展](languages.md#simplified)             | 完整 zh-Hans 界面译本                      |
| 32   | [繁体中文语言扩展](languages.md#traditional)            | 完整 zh-Hant 界面译本                      |
| 33   | [日语语言扩展](languages.md#japanese)                   | 完整 ja 界面译本                           |

Mihon 与 Tachiyomi 按已核实的备份格式系列共同交付，各系列分别声明版本；NFO 按格式提供，不按生成软件重复发布。英语基准、默认主题、主题编辑、公共 UI、脚手架与解析器不计入扩展数量。

<a id="selection"></a>

## 来源选择

接入优先使用官方或公开 API。Steam Store 等来源也可以使用持续可用、适合正常客户端使用的公开接口。官方范围只纳入用户和开发者无须支付 API 费用即可持续使用的能力，试用、付费访问或研究豁免不满足这一条件。免费注册、token 或 key、合理配额和署名要求不自动排除来源。

官方接入由本页 33 项清单和各项目合同确定。普通外链与有依据的外部标识用于资料引用；官方扩展的网络读取通过其已登记的来源接口和下方资源完成。

<a id="materials"></a>

## 辅助资料

| 资源               | 采用方式                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| VNDBTranslatorLib_ | VNDB 可选中文标签、特征名称的文本参考；静态整理、核对上下文并保留 MIT 数据许可。 |

辅助资源由实际使用它的扩展维护，记录许可、版本与原始出处。在线接口及所需凭据由各来源合同定义；涉及一对多或偏移的对应关系保留具体含义。

<a id="import-and-language"></a>

## 导入器与译本

第 18–30 项按[输入与格式合同](importers.md#catalog)提供样本、版本范围、选择与执行界面、对象对应和损失报告。第 31–33 项按[语言合同](languages.md)完整覆盖英语基准，分别具有独立身份、安装包与更新；简体、繁体和日语的用词各由对应译本设计规定。

译本通过在线安装取得，已安装译本可离线使用。英语基准、主题创作与用户字体分别属于本体及其公共能力，不额外计为译本或专用扩展。

<a id="organization"></a>

## 项目文件与源码归属

官方扩展的项目包名统一使用 `@kisaki3/ext-<名称>`，名称采用稳定的小写 kebab-case，例如 @kisaki3/ext-vndb 和 @kisaki3/ext-bangumi。ext- 专用于可安装扩展项目，来源、导入器和译本遵守同一规则；SDK、CLI 等公共工具包保持各自的名称。该前缀属于官方工程命名规范，不约束第三方扩展的包名或 manifest.id。

每个项目维护自己的 package.json、kisx.config.ts、README、release-notes 和 tests/fixtures。来源响应与输入格式样本归实际扩展；读取、映射及真实运行分别验证，测试目录按[共同结构](../engineering/layout.md#tests)采用适用部分。out、dist 和 .local 按[开发制品规则](development.md#build)保存运行布局、安装包和持续开发状态。

源码按实际能力展开：[来源扩展](sources.md#organization)组织客户端、资料与适用的个人操作，[导入器](importers.md#organization)保留各自输入语义，[译本](languages.md#implementation)负责轻量登记与消息目录。三种 CLI 模板提供工程起点，具体模块由逐项设计确定；共用解析使用普通依赖，不导入其他扩展的私有源码。

每项交付包含实际入口、权限、失败和取消处理、生命周期、依赖、manifest、文档及可安装制品。没有适用能力时不添加空实现。

<a id="delivery"></a>

## 同仓源码与独立发布

官方源码位于 clients/desktop/extensions/projects/，官方仓库资料位于相邻的 clients/desktop/extensions/registry/。每个扩展有独立 ID、版本和 .kisx。应用、公共包和扩展分别发布；同一变更可以同时修改合同与消费者，但不要求所有项目同步换版。

扩展 ID 遵守[分发合同](distribution.md#package)，项目包名遵守[仓库身份](../engineering/repository.md#identity)，Git tag 和说明地址按[发行身份](../engineering/releases.md#release-identity)生成。每个发行项目在自己的 release-notes 中保存说明，分类目录不维护共同版本；第一方扩展不具有私有权限。

正式应用只加载已安装扩展，不扫描应用资源并恢复特殊副本。零扩展时仍可完成本地管理、阅读、播放并使用英语界面，其他译本和资料来源依实际安装提供。应用包不包含扩展或离线包；已安装译本可以离线使用，首次下载与安装由[引导](../domains/onboarding.md)组织。应用升级保留每个扩展的版本、启用意愿和已卸载选择。

官方项目只使用公开 API、SDK 和 CLI。即使同仓，也不能私自导入 main、数据库、host 协议或其他扩展内部。每项交付都是完整、自包含的安装包。发布前必须验证仓库外 tarball 消费、真实宿主运行和独立 .kisx 安装，不能只验证同仓最新代码能够编译。

验收覆盖零扩展启动、在线安装失败、译本选用与卸载后回到英语、独立扩展换版，以及所有 UI、登记、错误、取消和任务结果。扩展声明明确的 API 版本范围，并使用与该范围相容的模板、设置格式和接入协议。逐项验收见[覆盖表](../../verification/coverage.md)。

当前进度见[实施状态](../../implementation/status.md#design)，来源与格式核对见[验证记录](../../verification/evidence/extensions.md)。
