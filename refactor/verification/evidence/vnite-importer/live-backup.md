# Vnite 备份与字段核验

核验日期：2026-10-17。来源基线为 Vnite v4.14.0，提交 36df84c5ded93b24fa86a269fb3f93f473316061；查询时最新正式发布仍为该版本。用户提供的数据库 ZIP 按实际结构读取，没有从文件名推定其具体应用版本。

[结构化结果](2026-10-17-verification.json)保存公开源码的地址与校验值、备份整体校验值、脱敏数量以及合成夹具结果。[完整接入方案](../../../design/extensions/importers/vnite.md)已确认：以所选资料方案完成原生新增，再采用来源用户数据和明确保留项。

## 实际输入

原备份为 112,066,773 字节。根包含 game、game-local、game-collection、config、config-local、plugin 和主题文件，符合官方[备份](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/features/database/services/backup.ts)及[压缩实现](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/utils/archiver.ts)的目录形式。

只解压前三个数据库到临时副本，以 PouchDB 9.0.0 的 LevelDB 适配器读取；配置、插件与账号数据未打开。原 ZIP 的 SHA-256 在核验前后均为 f7bb9a805880eba46825d4c0d335210c0b45752e641076e6a25cc5ebd966d453。

| 内容     | 实际结果                                                                  |
| -------- | ------------------------------------------------------------------------- |
| 游戏     | 147 条有效文档                                                            |
| 本地配置 | 147 条文档，包含 file、url、script 三种选择                               |
| 合集     | 5 个，成员均能对应备份中的游戏                                            |
| 游玩区间 | 488 段，均具有合法的历史起止时间                                          |
| 回忆     | 9 条原记录，其中 5 条有文字或对应主图，4 条为空                           |
| 图片附件 | 466 项全部读出，长度与 PouchDB MD5 摘要一致，均具有 WebP 文件头           |
| 内嵌图片 | 正文中的实际附件引用可以在备份内解析                                      |
| 修订冲突 | game 与 game-collection 各有 3 个文档带其他冲突修订，正常获胜修订均可读取 |
| 时长差异 | 4 个游戏的累计值大于区间合计，1 个小于区间合计；不能假设它们始终相等      |

这些数量用于证明输入覆盖，报告不保存游戏清单、名称、评分、私人正文、执行命令、本地媒体路径或完整数据库行。原始用户备份及其数据库不进入仓库。

## 字段含义

[游戏模型](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/types/models/game.ts)明确区分资料、个人记录、回忆、存档信息和机器本地配置。真实备份中 steamId 为十进制字符串、vndbId 保留 v 前缀、ymgalId 为十进制字符串；IGDB 对应按声明字段与合成输入核对，不声称在这份备份中发现了非空值。

[评分编辑](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/renderer/src/components/Game/Config/ManageMenu/ScoreEditorDialog.tsx)接受 0–10 分并保留一位小数，清空写 -1。零分和未评分需要分别采用。

[状态文字](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/renderer/locales/en/utils.json)分别为 Unplayed、Playing、Partially Completed、Completed、Multiple Runs、Shelved。multiple 只是状态，没有具体完成次数或完成日期。接入方案将其采用为至少一次完成，属于明确的产品映射，不表示来源提供了历史计数。

[计时写入](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/features/monitor/services/monitor.ts)已经依据暂停和短区间规则生成 timers，playTime 按毫秒增量累计。[时长编辑](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/renderer/src/components/Game/Config/ManageMenu/PlayTimeEditorDialog.tsx)明确使用区间合计加按日补录加无日期补记，dailyPlayTimes 不是可以再与总量相加的独立总数。本次真实备份没有非空按日补录，相关读取由合成夹具验证。

[回忆实现](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/features/game/services/memory.ts)保存实际日期、Markdown 文字和可选主图，[附件操作](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/core/database/layers/GameDBManager.ts)将主图、内嵌图和存档分别存入当前游戏文档的附件。图片验证覆盖字节读取、摘要、长度和文件头；完整解码及本体附件准备仍由实现验收验证。

[启动器](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/features/launcher/services/launcher.ts)的文件模式只调用系统打开路径，没有使用 fileConfig.args；命令模式在 Windows 的 cmd 中组合 command 数组。核验仅检查保存的结构，没有执行任何启动内容。

[存档归档](https://github.com/ximu3/vnite/blob/36df84c5ded93b24fa86a269fb3f93f473316061/src/main/features/game/services/save.ts)将 savePaths 的内容按 basename 放入同一 ZIP，历史记录不保存每个根的对应清单。本次用户备份没有存档附件，合成夹具仅验证它能被独立识别和读出，不声称已经实现向本体备份的转换。

## 合成夹具与技术验证

[合成记录](synthetic-records.json)和[合成备份](synthetic-backup.zip)完全由测试数据生成，不包含用户记录、图片或路径。使用与来源相同的 PouchDB 9 创建并关闭三个数据库，压缩后重新解压、打开读取，验证：

- 六种状态、-1 未评分、0 零分及小数评分原样保留。
- 精确区间、只有按日补录、无日期总量及总量小于区间的输入分别存在。
- 删除记录不出现在正常游戏列表中，缺省合集排序字段不影响成员读取。
- file、url、script 配置分别读出，命令没有执行。
- 回忆封面和内嵌附件可以按真实附件名取得原字节，存档 ZIP 可以独立识别。

[PouchDB API](https://pouchdb.com/api.html)与[适配器说明](https://pouchdb.com/adapters.html)支持本次使用的 allDocs、getAttachment 和本地 LevelDB 读取方式。采用官方正常获胜修订，与 Vnite 的读取行为一致，不把存在其他修订本身当作迁移失败。

本次已经验证输入格式、依赖可用性和关键字段语义。正式导入器、本体写入、图片解码、路径转换、交互与取消，以及其他目标平台的原生依赖装载，仍须在实现中验收。没有运行 Vnite、调用其恢复入口或写入 Kisaki 正式资料库。

临时数据库句柄已全部关闭。删除副本的操作被执行策略拦截，副本尚未清理；原始备份保持不变。
