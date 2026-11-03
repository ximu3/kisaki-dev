# 扩展与独立项目交付清单

本页记录 33 项官方扩展和四个独立项目的实现与验收、项目文档、Kisaki 消费及对外发布结果。范围与门槛由[工作包](work-packages.md)和[专项验收](../verification/coverage.md)定义，其他工作包及根工程、公共包文档的进度由[实施状态](status.md)维护。

实现与验收、项目文档分别使用未开始、进行中或已完成，两项均满足条件后达到完整交付要求。文档由 [W22](work-packages.md#w22) 按对象完成，本页维护这些分项事实，状态页汇总工作包进度。实际验证记录版本、合同、样本、环境、命令、结果与证据位置；未实测范围注明原因与兼容依据。发布与部署按实际执行结果单独记录。

<a id="extensions"></a>

## W21 逐项扩展交付

编号沿[官方目录](../design/extensions/catalog.md#catalog)，专项断言沿[逐源覆盖](../verification/coverage.md#extensions)。实现包含声明的全部能力与页面；宿主验证覆盖本体调用、适用授权、取消与生命周期；安装消费包含仓库外公共包及独立 .kisx。发布状态单独记录。

| 标识   | 扩展与设计                                                                   | 实现与验收 | 项目文档 | 发布   |
| ------ | ---------------------------------------------------------------------------- | ---------- | -------- | ------ |
| W21-01 | [VNDB](../design/extensions/sources/vndb.md)                                 | 未开始     | 未开始   | 未执行 |
| W21-02 | [Bangumi](../design/extensions/sources/bangumi.md)                           | 未开始     | 未开始   | 未执行 |
| W21-03 | [YMGal](../design/extensions/sources/ymgal.md)                               | 未开始     | 未开始   | 未执行 |
| W21-04 | [MangaDex](../design/extensions/sources/mangadex.md)                         | 未开始     | 未开始   | 未执行 |
| W21-05 | [TMDB](../design/extensions/sources/tmdb.md)                                 | 未开始     | 未开始   | 未执行 |
| W21-06 | [SteamGridDB](../design/extensions/sources/steamgriddb.md)                   | 未开始     | 未开始   | 未执行 |
| W21-07 | [Steam](../design/extensions/sources/steam.md)                               | 未开始     | 未开始   | 未执行 |
| W21-08 | [IGDB](../design/extensions/sources/igdb.md)                                 | 未开始     | 未开始   | 未执行 |
| W21-09 | [MyAnimeList](../design/extensions/sources/mal.md)                           | 未开始     | 未开始   | 未执行 |
| W21-10 | [AniList](../design/extensions/sources/anilist.md)                           | 未开始     | 未开始   | 未执行 |
| W21-11 | [Google Books](../design/extensions/sources/googlebooks.md)                  | 未开始     | 未开始   | 未执行 |
| W21-12 | [RanobeDB](../design/extensions/sources/ranobedb.md)                         | 未开始     | 未开始   | 未执行 |
| W21-13 | [MangaUpdates](../design/extensions/sources/mangaupdates.md)                 | 未开始     | 未开始   | 未执行 |
| W21-14 | [NDL Search](../design/extensions/sources/ndl.md)                            | 未开始     | 未开始   | 未执行 |
| W21-15 | [itch.io](../design/extensions/sources/itchio.md)                            | 未开始     | 未开始   | 未执行 |
| W21-16 | [Wikidata](../design/extensions/sources/wikidata.md)                         | 未开始     | 未开始   | 未执行 |
| W21-17 | [Fanart.tv](../design/extensions/sources/fanart.md)                          | 未开始     | 未开始   | 未执行 |
| W21-18 | [Goodreads Importer](../design/extensions/importers/goodreads.md)            | 未开始     | 未开始   | 未执行 |
| W21-19 | [Vnite Importer](../design/extensions/importers/vnite.md)                    | 未开始     | 未开始   | 未执行 |
| W21-20 | [Playnite Importer](../design/extensions/importers/playnite.md)              | 未开始     | 未开始   | 未执行 |
| W21-21 | [PotatoVN Importer](../design/extensions/importers/potatovn.md)              | 未开始     | 未开始   | 未执行 |
| W21-22 | [calibre Importer](../design/extensions/importers/calibre.md)                | 未开始     | 未开始   | 未执行 |
| W21-23 | [Mihon / Tachiyomi Backup Importer](../design/extensions/importers/mihon.md) | 未开始     | 未开始   | 未执行 |
| W21-24 | [NFO / ComicInfo Importer](../design/extensions/importers/nfo-comicinfo.md)  | 未开始     | 未开始   | 未执行 |
| W21-25 | [LaunchBox Importer](../design/extensions/importers/launchbox.md)            | 未开始     | 未开始   | 未执行 |
| W21-26 | [Koodo Reader Importer](../design/extensions/importers/koodo.md)             | 未开始     | 未开始   | 未执行 |
| W21-27 | [Anx Reader Importer](../design/extensions/importers/anx.md)                 | 未开始     | 未开始   | 未执行 |
| W21-28 | [KOReader Importer](../design/extensions/importers/koreader.md)              | 未开始     | 未开始   | 未执行 |
| W21-29 | [Kotatsu Importer](../design/extensions/importers/kotatsu.md)                | 未开始     | 未开始   | 未执行 |
| W21-30 | [YACReader Importer](../design/extensions/importers/yacreader.md)            | 未开始     | 未开始   | 未执行 |
| W21-31 | [简体中文语言扩展](../design/extensions/languages.md#simplified)             | 未开始     | 未开始   | 未执行 |
| W21-32 | [繁体中文语言扩展](../design/extensions/languages.md#traditional)            | 未开始     | 未开始   | 未执行 |
| W21-33 | [日语语言扩展](../design/extensions/languages.md#japanese)                   | 未开始     | 未开始   | 未执行 |

<a id="projects"></a>

## 四个独立项目

各项目在自己的公开开发仓库完成[实现与验收](work-packages.md#independent-projects)和对应项目文档，仓库接续遵守[共同规则](../design/engineering/repository.md#temporary-repositories)。当前均未开始正式实施，开发远端在建立时登记。

| 实施工作包                              | 实现与验收 | 项目文档 | Kisaki 消费验收 | 发布与部署 |
| --------------------------------------- | ---------- | -------- | --------------- | ---------- |
| [W11 Vantage](work-packages.md#w11)     | 未开始     | 未开始   | 未开始          | 未执行     |
| [W12 Kana](work-packages.md#w12)        | 未开始     | 未开始   | 未开始          | 未执行     |
| [W13 libmpv-node](work-packages.md#w13) | 未开始     | 未开始   | 未开始          | 未执行     |
| [W14 oauth-relay](work-packages.md#w14) | 未开始     | 未开始   | 未开始          | 未执行     |

完整交付包括全部公开能力、工程、适用后端与目标制品、资源许可、独立消费和文档。联调中的候选记录真实范围，尚未满足的分项保持进行中。技术库交接固定 tarball 与平台资源，relay 交接已验证服务、协议和部署配置；记录来源提交、锁定输入、摘要和取得方式。

本体的游戏、视频、阅读与来源授权工作包验证各自业务接入，W23 核对桌面最终制品中的实际消费。项目自身的实现与制品验收归上表对应工作包。

<a id="external-inputs"></a>

## 外部交付输入

| 输入                     | 负责角色                      | 使用前核对                                                    | 当前状态                                                                                        |
| ------------------------ | ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 来源应用登记与回调       | 对应来源扩展或 relay 的维护者 | 实际 clientId、回调、权限及来源限制；秘密通过所属凭据通道提供 | 来源接入时核对                                                                                  |
| 代码签名与发行权限       | 桌面及各独立项目的发行维护者  | 账号权限、签名身份、适用目标和 CI 授权                        | 正式发行前核对                                                                                  |
| 原生媒体、字体与归档输入 | 使用这些制品的项目维护者      | 固定版本、来源、摘要、许可和持续取得方式                      | 字体与私有原生输入已固定；完整媒体输入待 W13 交付                                               |
| 系统与图形验证环境       | 对应项目维护者                | 系统、架构、权限与图形条件                                    | [本地 Windows 已记录](status.md#environments)；其余目标的实际权限、额度与桌面／图形接入尚未核实 |
| relay 部署与服务切换     | relay 部署维护者              | 主机、域名、HTTPS、配置、秘密注入和既有接入影响               | 部署前核对                                                                                      |

各项目在使用外部输入时核实其可用状态并记录依据。条件不成立时停止受影响接入或发行，其他独立工作可以继续；不自行改用其他账号、降低验证门槛或删除能力。敏感值留在既定凭据渠道。
