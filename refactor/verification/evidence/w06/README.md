# W06 存储与原生基础验证

2026-11-14，Windows x64 本机验证使用 Node 24.11.1、pnpm 11.11.0、Drizzle ORM／Kit 1.0.0-rc.5、better-sqlite3 13.0.3 和 Electron 45.0.0。实际 Electron 的 Node 为 24.22.0，SQLite 为 3.53.4。范围对应 [W06](../../../implementation/work-packages.md#w06)：正式存储、原生文件设施和查询基础；业务操作与产品窗口由后续工作包接入。

## 存储与资源

正式基线由 Drizzle Kit generate 生成，含 99 张表、152 个显式索引和实际 snapshot。七类 Entry、五类 Part、四类资料关系、组织、个人记录、持有、Note、附件引用、备份、配置、历史及扩展私有数据分别落在所属表。偏好采用固定 JSON 组和同一行上的受保护代理凭据列。

| 范围 | 实际核对 |
| --- | --- |
| 初始化与迁移 | 空库通过原生 migrate 建立完整基线；引导初始行由 SQL 写入，偏好首行在全部迁移后采用当前默认定义。前向迁移只执行一次，既有资料与用户选择保留；故障回滚后可重试，包括首个迁移失败留下空迁移记录表的情况。其他格式或已改变的迁移历史被拒绝。 |
| 约束与事务 | 七类非空资料、五类分部、四类关系及资源记录实际写入。错误类型端点、重复身份、无效评分及受引用附件删除被拒绝；事务失败恢复原值。全部表具有主键，foreign_key_check 为空，quick_check 为 ok。 |
| 编码与读取 | 日期、别名、JSON、空值、密文字节及关系查询读回符合各自含义。Entry 与 Part 共用非空白别名校验；异常别名保留合法项，异常日期读为 null。偏好中的无效身份、网络定义与普通字段分别处理，修改其他字段保留原始异常文本。 |
| 持久性 | 正常关闭重开保留资料；独立 Electron Node 进程在未提交事务中被强制终止，重开保留已提交值并回滚未提交修改。连接实际使用 WAL、FULL；macOS 连接另要求 fullfsync。 |
| 文件与路径 | 有限流准备、摘要、同步、不覆盖发布、实际设备／文件身份、链接、大小写行为、包含关系和失联路径分别验证。Windows 的两个实际文件系统验证跨卷移动拒绝，原文件保留。 |
| ZIP | yauzl 3.4.0 按需读取成员，zip.js 2.25.0 使用原生压缩流写入；按实际长度、CRC、成员身份、元数据和字节预算核对。中文、组合字符、空目录和空文件往返，错误长度、路径冲突、损坏 CRC、取消及临时资源清理通过。 |
| 名称顺序 | ICU4X 2.4.0 在驱动的 SQLite 扩展边界注册语言比较。有效软件语言改变和重开后引擎修订失配均触发索引重建。中文、瑞典语、德语、数字序及原始身份保留通过。 |

基础设施的失败结果与文件所有权在接口处说明。附件提交、正文引用提取、内容文件维护和存档恢复业务分别归 W07、W08、W13、W15；本记录不将设施验证扩张为这些业务已完成。

## 运行与制品

本机 `pnpm check`、`pnpm desktop:test:native` 与 Rust 格式／Clippy 检查通过。Electron Node 模式执行了 15 项存储和文件用例。4 个真实窗口入口、4 项隔离开发回归和 2 项 Node 取消结果检查均通过；保留生产 fuses 的最终制品可正常启动和关闭。desktop-contracts 与 desktop-localization 的实际 tarball 共通过 6 项 Node／浏览器独立消费检查。

工程载体在窗口出现前，用实际资源目录中的迁移和原生驱动完成初始化、写入、关闭及重开。main 打包驱动的 JavaScript，nativeBinding 指向外置的对应目标绑定。制品检查核对 SQL、snapshot、Unicode 许可和原生文件的完整字节集合与摘要；构建不重新生成迁移。

重构后的六目标 CI 待本 PR 实测。本机 Windows x64 的跨文件系统用例使用两个实际文件系统。SMB／NFS 实际挂载、真实掉电、平台签署与产品发行不在本次观察范围内。

## 完整负载与查询

[测量原始结果](performance.json)保存实际构建文件摘要、输入摘要、迁移摘要、驱动版本、同步设置、SQL、EXPLAIN、首次读取和全部采样。测试在真实 Electron main 中运行；设备为 AMD Ryzen 9 7945HX、约 31.2 GiB 内存、Windows 10.0.19045。连接的页缓存目标为 32 MiB。

同一数据库同时包含 5 万 Entry、20 万 Part、50 万四类资料关系、10 万文件、50 万活动和 100 个动态合集，另含标签、手动合集、评分、外部身份及完成日期。生成器对实际写入行计算摘要，并将隔离目录抽象为固定根，以保留可跨环境比较的业务输入。数据准备耗时 40.47 秒，单独记录。

每条语句先用独立夹具事实核对结果，再预热 3 次、采样 31 次。list、total、locate 使用同一谓词和排序。首次读取使用重开连接和暖操作系统缓存，不视为冷磁盘结果。50 ms 单次同步预算在测量前固定；本次全部首次读取、重复查询和短事务均满足预算。

| 查询 | 首次读取 ms | 重复采样 P95 ms | 重复采样最大 ms |
| --- | ---: | ---: | ---: |
| 混合类型与评分，远处区间 | 44.611 | 32.715 | 32.871 |
| 100 个动态合集并集，远处区间 | 30.613 | 19.751 | 20.089 |
| 同一并集定位 | 24.587 | 25.442 | 26.887 |
| 未分类区间 | 29.013 | 29.065 | 30.283 |
| 未分类 total | 24.055 | 25.458 | 26.235 |
| 同项人物关系区间 | 0.226 | 0.043 | 0.044 |
| 精确外部身份查找 | 0.139 | 0.017 | 0.017 |
| 完整日期排序区间 | 3.359 | 0.688 | 0.693 |
| 分部、文件与活动统计 | 25.227 | 14.660 | 14.674 |
| Drizzle 与 codec 投影 | 1.460 | 0.355 | 0.692 |

短事务最大 6.656 ms。采样期间事件循环延迟 P95 为 34.177 ms、最大 43.319 ms，该观察包含调度与验证成本，和单条同步语句耗时分别记录。固定工程载体的 20 次新进程启动中位数为 395.566 ms、P95 为 480.845 ms；每次观察到的进程均已退出。它包含一条持久存储样本，完整产品启动及实际输入响应由 W07、W08 和相应长流程工作包验收。

100 项标签规则先组成同一候选集合，`EXISTS` 只查每个条目已经使用的标签，并在首次命中时结束。未分类复用相同谓词取反，再排除手动合集成员。当前驱动默认会对每个条目逐一查找候选标签，因此这组查询明确使用按条目排列的覆盖索引 `entry_tags_entry`。有效排序名是采用语言 collation 的虚拟文本列，定位使用名称和 ID 的复合范围索引。活动统计先确定目标区间，再补齐该区间的分部与文件计数。

## 复现与依据

```powershell
pnpm check
pnpm desktop:test:native
pnpm desktop:test:e2e
pnpm desktop:test:dev
pnpm desktop:test:artifacts
pnpm desktop:test:performance
pnpm exec turbo run test:consumers --filter=@kisaki3/desktop-contracts --filter=@kisaki3/desktop-localization
```

运行入口与生成命令见[当前工程与开发](../../../implementation/development.md)。所有资料目录和文件均由测试独立创建，测试不读取个人资料库或存档。

技术依据采用 [Drizzle 迁移](https://orm.drizzle.team/docs/migrations)、[Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)、[SQLite 同步与缓存配置](https://www.sqlite.org/pragma.html)、[复合行值比较](https://www.sqlite.org/rowvalue.html)、[better-sqlite3 nativeBinding](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)、[Vite SSR 依赖打包](https://vite.dev/config/ssr-options.html)、[zip.js 流式写入](https://gildas-lormeau.github.io/zip.js/api/classes/ZipWriter.html)与[ICU4X 排序](https://docs.rs/icu_collator/2.4.0/icu_collator/)、[SQLite 名称索引重建](https://sqlite.org/lang_reindex.html)及 [Windows 命令归属](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)。运行能力以本记录的固定版本和实际结果为准。
