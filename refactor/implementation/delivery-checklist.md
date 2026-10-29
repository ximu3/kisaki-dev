# 实施交付检查清单

本页细分工作包内可独立核对的交付。范围与门槛由[工作包](work-packages.md)和[专项验收](../verification/coverage.md)拥有；本表记录子交付状态及其证据，工作包汇总见[实施状态](status.md)。

每项结果记录实现版本、合同与验收条目、样本、环境、运行命令、结论及证据位置。结果使用未开始、进行中、通过、失败或未实测；未实测列明原因和兼容性依据。适用的功能或制品失败须解决，运行覆盖按[共同验收规则](../verification/acceptance.md#runtime-coverage)判定。历史探针仅作其记录范围内的依据。

本表拥有已经拆分的子交付状态及其证据，status 只汇总相应工作包并链接本表；未拆分的工作包由 status 记录。子项尚有必需工作或失败时，汇总不能标为完成。源码实现、候选消费、目标运行与发布分别登记，不用一个总进度覆盖其他阶段。

<a id="w07"></a>

## W07 子交付

| 标识        | 范围与接入依据                                                                         | 独立完成条件                                                                         | 当前状态 |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| W07-GAME    | [游戏会话](../design/domains/games.md)与 Vantage 候选包                                | 配置选择、实际进程／窗口观察、计时、截图、游戏面板、最终记录及引用释放               | 未开始   |
| W07-ANIME   | [视频会话](../design/domains/sessions.md#playback-setting-result)与 libmpv-node 候选包 | 文件与轨道、保存／采用结果、sRGB 与真实截图来源、纹理回收、内容切换、最终记录        | 未开始   |
| W07-READING | [阅读接入](../design/domains/reader.md)与 Kana 候选包                                  | 漫画和小说各自资料与偏好，全部支持格式、准确源定位、标注、主阅读／临时查看及关闭保存 | 未开始   |
| W07-BACKUP  | [存档备份与恢复](../design/domains/backups.md)                                         | 自动接纳、备份、正式恢复、中断与再次检查、明确保留现状、文件与索引共同收尾           | 未开始   |

阅读子交付由 Kana 验证全部支持格式及共用内核机制，漫画和小说两个应用入口各自验证资料、偏好、持久值与会话接续，并引用对应格式证据。跨会话时钟分段和共同保存规则在所属实现完整验证；各消费入口核对自己的参数、保存结果、资源与完整退出，按新增风险补充案例，不按格式和入口重复展开共同规则矩阵。

<a id="extensions"></a>

## W09 逐项扩展交付

编号沿[官方目录](../design/extensions/catalog.md#catalog)，专项断言沿[逐源覆盖](../verification/coverage.md#extensions)。实现包含声明的全部能力与页面；宿主验证覆盖本体调用、适用授权、取消与生命周期；安装消费包含仓库外公共包及独立 .kisx。发布状态单独记录。

| 标识   | 扩展与设计                                                                   | 实现   | 正式宿主验证 | 安装消费 |
| ------ | ---------------------------------------------------------------------------- | ------ | ------------ | -------- |
| W09-01 | [VNDB](../design/extensions/sources/vndb.md)                                 | 未开始 | 未开始       | 未开始   |
| W09-02 | [Bangumi](../design/extensions/sources/bangumi.md)                           | 未开始 | 未开始       | 未开始   |
| W09-03 | [YMGal](../design/extensions/sources/ymgal.md)                               | 未开始 | 未开始       | 未开始   |
| W09-04 | [MangaDex](../design/extensions/sources/mangadex.md)                         | 未开始 | 未开始       | 未开始   |
| W09-05 | [TMDB](../design/extensions/sources/tmdb.md)                                 | 未开始 | 未开始       | 未开始   |
| W09-06 | [SteamGridDB](../design/extensions/sources/steamgriddb.md)                   | 未开始 | 未开始       | 未开始   |
| W09-07 | [Steam](../design/extensions/sources/steam.md)                               | 未开始 | 未开始       | 未开始   |
| W09-08 | [IGDB](../design/extensions/sources/igdb.md)                                 | 未开始 | 未开始       | 未开始   |
| W09-09 | [MyAnimeList](../design/extensions/sources/mal.md)                           | 未开始 | 未开始       | 未开始   |
| W09-10 | [AniList](../design/extensions/sources/anilist.md)                           | 未开始 | 未开始       | 未开始   |
| W09-11 | [Google Books](../design/extensions/sources/googlebooks.md)                  | 未开始 | 未开始       | 未开始   |
| W09-12 | [RanobeDB](../design/extensions/sources/ranobedb.md)                         | 未开始 | 未开始       | 未开始   |
| W09-13 | [MangaUpdates](../design/extensions/sources/mangaupdates.md)                 | 未开始 | 未开始       | 未开始   |
| W09-14 | [NDL Search](../design/extensions/sources/ndl.md)                            | 未开始 | 未开始       | 未开始   |
| W09-15 | [itch.io](../design/extensions/sources/itchio.md)                            | 未开始 | 未开始       | 未开始   |
| W09-16 | [Wikidata](../design/extensions/sources/wikidata.md)                         | 未开始 | 未开始       | 未开始   |
| W09-17 | [Fanart.tv](../design/extensions/sources/fanart.md)                          | 未开始 | 未开始       | 未开始   |
| W09-18 | [Goodreads Importer](../design/extensions/importers/goodreads.md)            | 未开始 | 未开始       | 未开始   |
| W09-19 | [Vnite Importer](../design/extensions/importers/vnite.md)                    | 未开始 | 未开始       | 未开始   |
| W09-20 | [Playnite Importer](../design/extensions/importers/playnite.md)              | 未开始 | 未开始       | 未开始   |
| W09-21 | [PotatoVN Importer](../design/extensions/importers/potatovn.md)              | 未开始 | 未开始       | 未开始   |
| W09-22 | [calibre Importer](../design/extensions/importers/calibre.md)                | 未开始 | 未开始       | 未开始   |
| W09-23 | [Mihon / Tachiyomi Backup Importer](../design/extensions/importers/mihon.md) | 未开始 | 未开始       | 未开始   |
| W09-24 | [NFO / ComicInfo Importer](../design/extensions/importers/nfo-comicinfo.md)  | 未开始 | 未开始       | 未开始   |
| W09-25 | [LaunchBox Importer](../design/extensions/importers/launchbox.md)            | 未开始 | 未开始       | 未开始   |
| W09-26 | [Koodo Reader Importer](../design/extensions/importers/koodo.md)             | 未开始 | 未开始       | 未开始   |
| W09-27 | [Anx Reader Importer](../design/extensions/importers/anx.md)                 | 未开始 | 未开始       | 未开始   |
| W09-28 | [KOReader Importer](../design/extensions/importers/koreader.md)              | 未开始 | 未开始       | 未开始   |
| W09-29 | [Kotatsu Importer](../design/extensions/importers/kotatsu.md)                | 未开始 | 未开始       | 未开始   |
| W09-30 | [YACReader Importer](../design/extensions/importers/yacreader.md)            | 未开始 | 未开始       | 未开始   |
| W09-31 | [简体中文语言扩展](../design/extensions/languages.md#simplified)             | 未开始 | 未开始       | 未开始   |
| W09-32 | [繁体中文语言扩展](../design/extensions/languages.md#traditional)            | 未开始 | 未开始       | 未开始   |
| W09-33 | [日语语言扩展](../design/extensions/languages.md#japanese)                   | 未开始 | 未开始       | 未开始   |

<a id="projects"></a>

## 四个独立项目的交接状态

四个项目均按[临时仓库与正式接续规则](../design/engineering/repository.md#temporary-repositories)开展正式发布前的开发和验证，临时远端身份在实际建立时登记；当前尚未开始正式实施。仓库接续与下表的实现、制品和发布状态分别记录，不把一次 CI 完成当作临时阶段结束。

| 项目        | 候选制品可消费 | 完整实现 | 最终制品联合验收 | 发布／部署 |
| ----------- | -------------- | -------- | ---------------- | ---------- |
| Vantage     | 未开始         | 未开始   | 未开始           | 未执行     |
| Kana        | 未开始         | 未开始   | 未开始           | 未执行     |
| libmpv-node | 未开始         | 未开始   | 未开始           | 未执行     |
| oauth-relay | 未开始         | 未开始   | 未开始           | 未执行     |

候选制品交接记录版本、来源提交、锁定输入、哈希与消费方式；技术库提供 tarball 和所需平台资源，relay 提供可测试的协议实现与部署配置。完整交付继续覆盖各独立产品的全部公开范围。最终制品由 Kisaki 锁定后复核实际接入，发布或服务切换按已有授权另行执行。

<a id="external-inputs"></a>

## 外部交付输入

| 输入                     | 负责角色                      | 使用前核对                                                    | 当前状态                                 |
| ------------------------ | ----------------------------- | ------------------------------------------------------------- | ---------------------------------------- |
| 来源应用登记与回调       | 对应来源扩展或 relay 的维护者 | 实际 clientId、回调、权限及来源限制；秘密通过所属凭据通道提供 | 来源接入时核对                       |
| 代码签名与发行权限       | 桌面及各独立项目的发行维护者  | 账号权限、签名身份、适用目标和 CI 授权                        | 正式发行前核对                           |
| 原生媒体、字体与归档输入 | 使用这些制品的项目维护者      | 固定版本、来源、摘要、许可和持续取得方式                      | W00 已固定字体与私有原生输入；媒体依赖随 libmpv-node 的 W06／W07 候选接续，独立 ffprobe 已移除 |
| 系统与图形验证环境       | 对应项目维护者                | 系统、架构、权限与图形条件                                    | [本地 Windows 已记录](status.md#environments)；其余目标的实际权限、额度与桌面／图形接入尚未核实 |
| relay 部署与服务切换     | relay 部署维护者              | 主机、域名、HTTPS、配置、秘密注入和既有接入影响               | 部署前核对                               |

各项目在使用外部输入时核实其可用状态并记录依据。条件不成立时停止受影响接入或发行，其他独立工作可以继续；不自行改用其他账号、降低验证门槛或删除能力。敏感值留在既定凭据渠道。
