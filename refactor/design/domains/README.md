# 领域能力

各领域以[终态实现与整体一致性](../engineering/conventions.md#final-state)为首要准则，按事实、完整操作与资源寿命明确拥有者；共同语义在所属合同统一定义，各入口直接引用。

阅读从[条目与分部](catalog.md)、[公共值](values.md)建立模型，再按任务进入[完整操作](library-operations.md)或[查询](library-queries.md)及对应领域。名称、结构和说明共同遵守[可读性准则](../engineering/conventions.md#readability-principle)。

| 责任           | 文档                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 调用值合同     | [候选资料](metadata-contracts.md) · [原子图写入](library-graph-contracts.md) · [标注查询与写入](annotation-contracts.md)                                                                |
| 内容身份与资料 | [条目与分部](catalog.md) · [公共值](values.md) · [四类资料关系](relations.md)                                                                                                           |
| 四类作品       | [游戏](games.md) · [动画](anime.md) · [漫画](comics.md) · [小说](novels.md)                                                                                                             |
| 个人整理与内容 | [当前状态与完成记录](records.md) · [合集和标签](collections-and-tags.md) · [Note](notes.md) · [Annotation](annotations.md)                                                              |
| 资料库边界     | [完整写入与并发](library-operations.md) · [查询、筛选与定位](library-queries.md) · [查询值合同](library-query-contracts.md) · [写入基线与错误](library-write-contracts.md)              |
| 来源获取与采用 | [metadata / ingest](metadata.md) · [资料方案](metadata-profiles.md) · [28 项预设及七类完整配置](metadata-presets.md)                                                                    |
| 发现与本地内容 | [扫描](scanner.md) · [本地持有](holdings.md) · [文件识别](file-recognition.md) · [文件识别预设](file-recognition-presets.md) · [文件维护](file-maintenance.md) · [存档备份](backups.md) |
| 字节和访问     | [附件与图片](attachments.md) · [文件输入和读取资源](resources.md)                                                                                                                       |
| 使用与执行     | [作品会话](sessions.md) · [阅读定位与 Kana 接入](reader.md) · [任务与自动行为](tasks.md)                                                                                                |
| 应用配置与入口 | [偏好](preferences.md) · [主题和字体](appearance.md) · [应用搜索](search.md) · [首次与更新引导](onboarding.md) · [应用更新](updates.md)                                                 |
