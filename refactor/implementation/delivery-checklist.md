# 扩展与独立项目交付清单

本页记录 33 项官方扩展和四个独立项目的实现与验收、项目文档、Kisaki 消费及对外发布结果。范围与门槛由[工作包](work-packages.md)和[专项验收](../verification/coverage.md)定义，其他工作包及根工程、公共包文档的进度由[实施状态](status.md)维护。

实现与验收、项目文档分别使用未开始、进行中或已完成，文档由 [W23](work-packages.md#w23) 按对象交付。W24 核对发布前条件，W25 完成首次公开发行与生产接入。本页维护分项事实，状态页汇总工作包进度。实际验证记录版本、合同、样本、环境、命令、结果与证据位置；未实测范围注明原因与兼容依据。

<a id="extensions"></a>

## 官方扩展逐项交付

序号沿[官方目录](../design/extensions/catalog.md#catalog)，实施责任分别归 W21 的 01–30 项功能扩展和 W22 的 31–33 项官方译本，专项断言沿[逐源覆盖](../verification/coverage.md#extensions)。实现包含声明的全部能力与页面；宿主验证覆盖本体调用、适用授权、取消与生命周期；安装消费包含仓库外公共包及独立 .kisx。公开发行由 W25 记录。

| 序号 | 扩展与设计                                                                   | 实施工作包                  | 实现与验收 | 项目文档 | 公开发行 |
| ---- | ---------------------------------------------------------------------------- | --------------------------- | ---------- | -------- | -------- |
| 01   | [VNDB](../design/extensions/sources/vndb.md)                                 | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 02   | [Bangumi](../design/extensions/sources/bangumi.md)                           | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 03   | [YMGal](../design/extensions/sources/ymgal.md)                               | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 04   | [MangaDex](../design/extensions/sources/mangadex.md)                         | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 05   | [TMDB](../design/extensions/sources/tmdb.md)                                 | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 06   | [SteamGridDB](../design/extensions/sources/steamgriddb.md)                   | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 07   | [Steam](../design/extensions/sources/steam.md)                               | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 08   | [IGDB](../design/extensions/sources/igdb.md)                                 | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 09   | [MyAnimeList](../design/extensions/sources/mal.md)                           | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 10   | [AniList](../design/extensions/sources/anilist.md)                           | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 11   | [Google Books](../design/extensions/sources/googlebooks.md)                  | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 12   | [RanobeDB](../design/extensions/sources/ranobedb.md)                         | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 13   | [MangaUpdates](../design/extensions/sources/mangaupdates.md)                 | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 14   | [NDL Search](../design/extensions/sources/ndl.md)                            | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 15   | [itch.io](../design/extensions/sources/itchio.md)                            | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 16   | [Wikidata](../design/extensions/sources/wikidata.md)                         | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 17   | [Fanart.tv](../design/extensions/sources/fanart.md)                          | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 18   | [Goodreads Importer](../design/extensions/importers/goodreads.md)            | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 19   | [Vnite Importer](../design/extensions/importers/vnite.md)                    | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 20   | [Playnite Importer](../design/extensions/importers/playnite.md)              | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 21   | [PotatoVN Importer](../design/extensions/importers/potatovn.md)              | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 22   | [calibre Importer](../design/extensions/importers/calibre.md)                | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 23   | [Mihon / Tachiyomi Backup Importer](../design/extensions/importers/mihon.md) | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 24   | [NFO / ComicInfo Importer](../design/extensions/importers/nfo-comicinfo.md)  | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 25   | [LaunchBox Importer](../design/extensions/importers/launchbox.md)            | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 26   | [Koodo Reader Importer](../design/extensions/importers/koodo.md)             | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 27   | [Anx Reader Importer](../design/extensions/importers/anx.md)                 | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 28   | [KOReader Importer](../design/extensions/importers/koreader.md)              | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 29   | [Kotatsu Importer](../design/extensions/importers/kotatsu.md)                | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 30   | [YACReader Importer](../design/extensions/importers/yacreader.md)            | [W21](work-packages.md#w21) | 未开始     | 未开始   | 未执行   |
| 31   | [简体中文语言扩展](../design/extensions/languages.md#simplified)             | [W22](work-packages.md#w22) | 未开始     | 未开始   | 未执行   |
| 32   | [繁体中文语言扩展](../design/extensions/languages.md#traditional)            | [W22](work-packages.md#w22) | 未开始     | 未开始   | 未执行   |
| 33   | [日语语言扩展](../design/extensions/languages.md#japanese)                   | [W22](work-packages.md#w22) | 未开始     | 未开始   | 未执行   |

<a id="projects"></a>

## 四个独立项目

各项目在自己的公开开发仓库完成[实现与验收](work-packages.md#independent-projects)和对应项目文档，仓库接续遵守[共同规则](../design/engineering/repository.md#temporary-repositories)。当前均未开始正式实施，开发远端在建立时登记。

| 实施工作包                              | 实现与验收 | 项目文档 | Kisaki 消费验收 | 公开发行与生产部署 |
| --------------------------------------- | ---------- | -------- | --------------- | ------------------ |
| [W09 Vantage](work-packages.md#w09)     | 未开始     | 未开始   | 未开始          | 未执行             |
| [W10 Kana](work-packages.md#w10)        | 未开始     | 未开始   | 未开始          | 未执行             |
| [W11 libmpv-node](work-packages.md#w11) | 未开始     | 未开始   | 未开始          | 未执行             |
| [W12 oauth-relay](work-packages.md#w12) | 未开始     | 未开始   | 未开始          | 未执行             |

完整交付包括全部公开能力、工程、适用后端与目标制品、资源许可、独立消费和文档。联调中的候选记录真实范围，尚未满足的分项保持进行中。技术库交接固定 tarball 与平台资源，relay 交接已验证服务、协议和部署配置；记录来源提交、锁定输入、摘要和取得方式。

本体的游戏、视频、阅读与来源授权工作包验证各自业务接入，W20 核对桌面装配与消费，W24 汇总最终候选结果，W25 核验正式渠道及生产接入。项目自身的实现与制品验收归上表对应工作包。

<a id="external-inputs"></a>

## 外部交付输入

| 输入                     | 负责角色                      | 使用前核对                                                    | 当前状态                                                                                        |
| ------------------------ | ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 来源应用登记与回调       | 对应来源扩展或 relay 的维护者 | 实际 clientId、回调、权限及来源限制；秘密通过所属凭据通道提供 | 来源接入时核对                                                                                  |
| 代码签名与发行权限       | 桌面及各独立项目的发行维护者  | 账号权限、签名身份、适用目标和 CI 授权                        | 正式发行前核对                                                                                  |
| 原生媒体、字体与归档输入 | 使用这些制品的项目维护者      | 固定版本、来源、摘要、许可和持续取得方式                      | 字体与私有原生输入已固定；完整媒体输入待 W11 交付                                               |
| 系统与图形验证环境       | 对应项目维护者                | 系统、架构、权限与图形条件                                    | [本地 Windows 已记录](status.md#environments)；其余目标的实际权限、额度与桌面／图形接入尚未核实 |
| relay 部署与服务切换     | relay 部署维护者              | 主机、域名、HTTPS、配置、秘密注入和既有接入影响               | W12 核对隔离部署，W25 核对生产切换                                                              |

各项目在使用外部输入时核实其可用状态并记录依据。条件不成立时停止受影响接入或发行，其他独立工作可以继续；不自行改用其他账号、降低验证门槛或删除能力。敏感值留在既定凭据渠道。
