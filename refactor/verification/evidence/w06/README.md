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

### 初始化、路径与暂存取消

2026-11-16，Windows x64 的 Electron 45.3.2 通过 17 项存储与原生集成用例。在隔离目录中，构建后的数据库 worker 正常初始化空库，对只有视图、含 `sqlite3_notes` 用户表、只有通用迁移记录表或设置了应用版本的外部文件均返回格式错误，前后文件字节相同。本体首个迁移失败后能用原文件重试。[迁移用例](../../../../clients/desktop/app/tests/integration/database/migrations.test.ts)

同一个缺盘符的位置分别从 C 盘和 F 盘的工作目录提交，均被拒绝。带盘符路径与 UNC 共享路径通过语法检查。向原生文件同步发出请求后取消暂存，操作等到同步结束才返回原取消原因，准备目录为空。[文件设施用例](../../../../clients/desktop/app/tests/integration/files/storage.test.ts)

Windows x64 的登记位置复验覆盖两个不同名称的硬链接、目录联接及其子文件、同一离线共享根的两种写法。在默认 NTFS 目录中，名称的大小写变体得到 same；在单独启用大小写敏感的目录中，指向同一文件的 `Book.epub` 和 `book.epub` 得到 separate。资料根卷查询对缺失文件和以普通文件作为父目录的输入均报告 pathMissing，保留 Windows 错误码 2 和 3。[原生错误用例](../../../../clients/desktop/app/tests/integration/native/files.test.ts)

## 运行与制品

本机 `pnpm check`、`pnpm desktop:test:native` 与 Rust 格式／Clippy 检查通过。Electron Node 模式执行了 15 项存储和文件用例。4 个真实窗口入口、4 项隔离开发回归和 2 项 Node 取消结果检查均通过；保留生产 fuses 的最终制品可正常启动和关闭。desktop-contracts 与 desktop-localization 的实际 tarball 共通过 6 项 Node／浏览器独立消费检查。

工程载体在窗口出现前，用实际资源目录中的迁移和原生驱动完成初始化、写入、关闭及重开。main 打包驱动的 JavaScript，nativeBinding 指向外置的对应目标绑定。制品检查核对 SQL、snapshot、Unicode 许可和原生文件的完整字节集合与摘要；构建不重新生成迁移。

2026-11-14，[六目标 CI 与必需检查](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494)在实现提交 `7aa9399` 通过。每个目标均通过 5 项工程工具用例、4 项开发场景、4 个真实窗口及最终制品的外部启动与关闭。Linux x64 另验证了 6 个公共包的 29 项独立消费用例。

| 目标 | Electron Node 存储与文件 | 构建格式 | 实际启动载体 |
| --- | --- | --- | --- |
| [Windows x64](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837834) | 15 项通过，含真实跨卷拒绝 | ZIP、NSIS | ZIP |
| [Windows ARM64](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837785) | 14 项通过；跨卷跳过 | ZIP、NSIS | ZIP |
| [macOS x64](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837821)／[ARM64](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837811) | 各 14 项通过；跨卷跳过 | ZIP、DMG | ZIP 中的应用 |
| [Linux x64](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837844)／[ARM64](https://github.com/ximu3/kisaki-dev/actions/runs/43562359494/job/132348837788) | 各 14 项通过；跨卷跳过 | AppImage、deb、rpm | AppImage |

跨卷检查使用两个实际文件系统；另五个目标的测试目录同卷。本机 Windows x64 也验证了跨卷拒绝后原文件保留。SMB／NFS 实际挂载、真实掉电、安装器安装、平台签署与产品发行不在本次观察范围内。

## 完整负载与查询

### 2026-11-14 主进程测量

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
| 剧集、文件与活动统计 | 25.227 | 14.660 | 14.674 |
| Drizzle 与 codec 投影 | 1.460 | 0.355 | 0.692 |

短事务最大 6.656 ms。采样期间事件循环延迟 P95 为 34.177 ms、最大 43.319 ms，该观察包含调度与验证成本，和单条同步语句耗时分别记录。固定工程载体的 20 次新进程启动中位数为 395.566 ms、P95 为 480.845 ms；每次观察到的进程均已退出。它包含一条持久存储样本，完整产品启动及实际输入响应由 W07、W08 和相应长流程工作包验收。

100 项标签规则先组成同一候选集合，`EXISTS` 只查每个条目已经使用的标签，并在首次命中时结束。未分类复用相同谓词取反，再排除手动合集成员。当前驱动默认会对每个条目逐一查找候选标签，因此这组查询明确使用按条目排列的覆盖索引 `entry_tags_entry`。有效排序名是采用语言 collation 的虚拟文本列，定位使用名称和 ID 的复合范围索引。本轮活动统计先确定目标区间，再补齐该区间的剧集与文件计数。

### 2026-11-15 数据库 worker 测量

同一台 Linux x64 runner（AMD EPYC 7763）使用 Electron 45.3.2、SQLite 3.53.4、WAL、FULL 和 32 MiB 页缓存，连续运行现行查询与慢查询对照。两轮的桌面构建、迁移和业务输入一致。对照把百标签动态并集改为先取得命中条目 ID，再按名称排序，所有查询结果都与预期一致。现行列表沿名称索引读取，对照计划使用临时 B 树排序。[Linux 同机对照](https://github.com/ximu3/kisaki-dev/actions/runs/43691494772/job/132743084412) · [两轮原始报告](https://github.com/ximu3/kisaki-dev/actions/runs/43691494772/artifacts/14151939214)

| 运行 | 百标签列表中位数 ms | 列表采样超过 100 ms | 短事务中位数 ms | 窗口 IPC P95 ms | 验收结果 |
| --- | ---: | ---: | ---: | ---: | --- |
| 现行查询 | 27.09 | 0/31 | 0.19 | 2.44 | 全部通过 |
| 慢查询对照 | 281.91 | 31/31 | 0.20 | 2.41 | 百标签列表超限 |

现行查询中，未分类位置的中位数最高，为 49.35 ms，最大值为 51.32 ms。Windows x64 本机完整负载也通过，最慢查询中位数为 33.95 ms。两种环境的输入 SHA-256 均为 `b59c621eb0a6fb508f25ad282ddc0ae244580e2933090c9bab645b4d2b04aa3d`。各项 worker 操作的中位数预算及当前命令见[开发验证入口](../../../implementation/development.md#verification)。

### 动画排行与报告交付

动画分部合计剧集和附加内容。完整负载中每部动画有 8 集、2 项附加内容和 5 个文件，期望值从夹具生成的实际记录累计。四部动画的独立样本验证了缺少活动、分部或文件时的零值、多次活动的时长之和，以及同分时的 ID 顺序。样本回滚后按原输入清单测量全部 16 条查询和短事务。

Windows x64 的真实 Electron 测量通过线程消息交付完整报告。在同一宿主另外核对了发送报告后抛错或非零退出、正常退出却缺少报告，以及测量期间关闭宿主的结果。用例只接受正常退出的完整结果，worker 抛出的错误保留名称、消息和堆栈。

<a id="six-target-workload"></a>

### 2026-11-16 六目标完整负载

候选 `58c0cfd2` 在 Windows、macOS、Linux 的 x64 和 ARM64 上运行同一工程载体和存储负载。六份报告的输入 SHA-256 均为 `b59c621eb0a6fb508f25ad282ddc0ae244580e2933090c9bab645b4d2b04aa3d`。各目标核对 16 条查询的实际结果，预热 3 次并重复采样 31 次，另测 31 次持久短事务。下表的最高中位数均来自未分类条目的定位。计时来自各自 runner，跨设备数值分别验收。[六目标运行和报告](https://github.com/ximu3/kisaki-dev/actions/runs/43808885499)

| 目标 | 样本准备 s | 最高操作中位数 ms | 窗口 IPC P95 ms |
| --- | ---: | ---: | ---: |
| Windows x64 | 22.25 | 23.12 | 2.50 |
| Windows ARM64 | 37.25 | 24.37 | 4.89 |
| macOS x64 | 34.14 | 56.29 | 11.93 |
| macOS ARM64 | 14.36 | 21.98 | 6.19 |
| Linux x64 | 16.31 | 17.99 | 2.43 |
| Linux ARM64 | 19.85 | 21.11 | 2.80 |

同一提交的完整桌面作业也在六个目标通过了这套测量。原先每 250 行提交一批时，Windows x64 仅造数就用了 394 秒。固定样本现按表提交，仍使用正式驱动、外键、WAL 和 FULL。查询、短事务与窗口响应保留各自原定的 100 ms 门槛。[完整桌面运行](https://github.com/ximu3/kisaki-dev/actions/runs/43808866913) · [Windows 造数对照](https://github.com/ximu3/kisaki-dev/actions/runs/43801290297/job/133082008379)

Intel Mac 的一次实测中，未分类定位中位数为 150.06 ms。现在计数从去重后的成员 ID 集合读取，远端分页在同一条 SQL 中取得真实总数、从较近的一端沿名称索引读取，并按名称和 ID 返回页面。定位按相同资格和严格的同名 ID 次序计数。Windows x64 的同库对照覆盖首页、中段、末页、不满一页、越界、空集及已知成员的零基位置。[原执行结果](https://github.com/ximu3/kisaki-dev/actions/runs/43804610038/job/133092498958) · [优化后的 Intel Mac 测量](https://github.com/ximu3/kisaki-dev/actions/runs/43808885499/job/133105994751)

## 复现与依据

以下命令对应 2026-11-14 的工程版本。

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
