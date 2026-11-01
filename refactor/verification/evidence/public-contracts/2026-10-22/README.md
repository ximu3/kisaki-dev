# Drizzle 1.x RC 隔离验证

本记录保存 2026-10-22 对 Drizzle 1.0.0-rc.5、Kit、编码与迁移的隔离结果，为[正式数据库接入](../../../../design/engineering/database.md)提供候选依据。工作包 W06 在正式 schema 和制品上完成版本固定与完整验收。

## 实际环境与结果

| 检查         | 输入与结果                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| ORM 与 Kit   | 均固定为 1.0.0-rc.5，在独立 fixture 安装                                                                                      |
| SQLite 运行  | Electron 41.2.0、Node 24.14.0、ABI 145、better-sqlite3 12.11.1、SQLite 3.53.2；Windows 本机，WAL、synchronous=FULL 与外键开启 |
| ORM 声明     | TypeScript 6.0.3；同步 select、get、run、transaction、关系查询 sync、自定义列推断及两个非法写入拒绝通过                       |
| 迁移与值路径 | 11 组断言通过，详见[原始结果](drizzle/results.json)                                                                           |
| 依赖隔离     | 根 package、pnpm 锁文件与 workspace 配置的前后 SHA-256 相同，普通应用资料保持原状                                             |

## Drizzle 验证的具体范围

同一生成迁移链先建立小型基线，再添加带缺省值的 note 列。先只执行基线并写入已有用户值，关闭重开后执行前向迁移，再重开核对不重复迁移。失败夹具在创建新表、更新已有值之后故意制造唯一键冲突，断言新表、修改和迁移历史一起回滚；再次重开保持上次正式提交。

自定义日期列验证直接查询与关系 JSON 投影的安全读回：非法 JSON 读为 null，非法正式写入抛错且保留原值，year: 0 与 null 不混淆。该夹具的 ProbeDate 只支持含年份的连续精度，用来验证 codec 通道；它不是正式 PartialDate，也没有覆盖完整年份边界、无年生日、所有七种分量组合或正式偏好迁移。

关系查询验证无关联、有关系、精确大小写身份以及空关系返回数组。SQL 的 IN 空数组得到空结果，NOT IN 空数组得到全集；这说明公开查询必须在边界拒绝空集合操作数，不能依赖 ORM 帮忙保持产品语义。另验证外键、唯一键、CHECK 与普通短事务回滚。

实际确认的接入差异：

- 当前候选通过 `drizzle({ client, relations })` 接入既有 better-sqlite3 连接。
- 普通查询的 .all()／.get()／.run() 与事务同步；关系查询以 .sync() 取得同步结果。
- 自定义列为直接驱动读回和关系 JSON 投影显式提供 fromDriver／fromJson，复用同一纯读规则；写入使用严格 toDriver。
- Kit 生成 `<时间戳>_<名称>/migration.sql` 与 snapshot.json；原生 migrate 读取这条目录链。正式打包按验证版本的产物布局交付。

没有执行完整正式 schema、所有 codec、发布包内迁移、掉电或空间／权限故障，也没有重测五万条查询的 RC 性能。[代表 SQL 探针](../../storage-contracts/2026-10-22/README.md)使用该记录所列的版本与样本。完整版本固定与性能预算仍属于后续工作。

## 试件与复现

[drizzle/](drizzle/)保存独立 package、锁文件、两份 schema、Kit 配置、类型样例、生成迁移与 Electron 执行脚本。schema-baseline.ts 是首次生成输入，schema.ts 添加 note；SQL 和 snapshot.json 保留工具产物。

复现时将 drizzle 复制到新的隔离目录，使用 `pnpm --dir <fixture> install --ignore-workspace --ignore-scripts --frozen-lockfile` 安装，再用仓库 tsc 按 fixture 的配置编译。通过 KISAKI_PROBE_APP_PACKAGE 提供隔离运行依赖项目的绝对 package.json 路径，由执行脚本加载对应的 better-sqlite3，并以匹配的 Electron 启动。

从仓库根使用 child_process.spawn 或 spawnSync 启动该 Electron，以 fixture/run.cjs 为入口，设置 windowsHide: true。执行在 Node 模式中使用独立 runs、数据库和 profile，并写入 fixture/results.json。SQL 再生成使用另一份干净 fixture，依次以 baseline 和最终 schema 运行 Kit generate，比较生成语义。

原始结果保持其固定版本与环境。后续重现记录自己的输入；正式验收覆盖完整 schema、codec、端点、全部目标与包内资源。
