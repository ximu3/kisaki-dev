# 公共合同与 Drizzle RC 隔离验证

本记录对应 2026-10-22 的[查询值合同](../../../../design/domains/library-query-contracts.md)、[写入基线与错误](../../../../design/domains/library-write-contracts.md)和[消息协议](../../../../design/engineering/protocols.md)修订。只记录声明与隔离试件，不代表 W01、正式数据库或扩展端点已经实现。

2026-10-26 已将开发接入改为[Node 父子消息](../../../../design/engineering/protocols.md#development)。本记录的开发字节帧与声明组合保留为当时方案的历史证据，不计作新连接通过；其余查询、写入与数据库证据仍按原范围解释。

## 实际环境与结果

| 检查             | 实际输入与结果                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 文档声明组合     | TypeScript 6.0.3；从四份设计文档取得 7 个 TS 声明代码块，配以有限的拥有者类型样本；严格检查与 16 项预期编译拒绝通过              |
| 开发协议字节帧   | Node 24.11.1；8 组断言通过，覆盖全部单处分割点、逐字节拆分、多帧合包、UTF-8、长度边界、非法正文和半帧 EOF                        |
| ORM 与 Kit       | 两者固定为 1.0.0-rc.5，独立 fixture 安装；未改变本体依赖。版本属于预发布候选，不据此宣布正式采用                                 |
| 实际 SQLite 运行 | Electron 41.2.0、Node 24.14.0、ABI 145、better-sqlite3 12.11.1、SQLite 3.53.2，Windows 本机；WAL、synchronous=FULL、外键检查开启 |
| ORM 声明         | TypeScript 6.0.3；同步 select／get／run／transaction、关系查询 .sync()、自定义列推断与两个非法写入声明的拒绝通过                 |
| 迁移与值路径     | 11 组断言全部通过，详见[原始结果](drizzle/results.json)                                                                          |
| 依赖隔离         | 根 package.json、pnpm-lock.yaml、pnpm-workspace.yaml 的执行前后 SHA-256 一致；未重编本体 better-sqlite3，未改变普通应用资料      |

[汇总 JSON](verification.json)保存实际版本与结果；声明检查启用 skipLibCheck，所以没有声称逐份检查全部依赖内部的 d.ts。类型样本只覆盖代表字段的关联和代码块组合，不是完整桌面合同实现，也不能证明运行校验、权限和事务成立。

## Drizzle 验证的具体范围

同一生成迁移链先建立小型基线，再添加带缺省值的 note 列。先只执行基线并写入已有用户值，关闭重开后执行前向迁移，再重开核对不重复迁移。失败夹具在创建新表、更新已有值之后故意制造唯一键冲突，断言新表、修改和迁移历史一起回滚；再次重开保持上次正式提交。

自定义日期列验证直接查询与关系 JSON 投影的安全读回：非法 JSON 读为 null，非法正式写入抛错且保留原值，year: 0 与 null 不混淆。该夹具的 ProbeDate 只支持含年份的连续精度，用来验证 codec 通道；它不是正式 PartialDate，也没有覆盖完整年份边界、无年生日、所有七种分量组合或正式偏好迁移。

关系查询验证无关联、有关系、精确大小写身份以及空关系返回数组。SQL 的 IN 空数组得到空结果，NOT IN 空数组得到全集；这说明公开查询必须在边界拒绝空集合操作数，不能依赖 ORM 帮忙保持产品语义。另验证外键、唯一键、CHECK 与普通短事务回滚。

实际确认的接入差异：

- 当前候选通过 `drizzle({ client, relations })` 接入既有 better-sqlite3 连接。
- 普通查询的 .all()／.get()／.run() 与事务同步；关系查询以 .sync() 取得同步结果。
- 自定义列为直接驱动读回和关系 JSON 投影显式提供 fromDriver／fromJson，复用同一纯读规则；写入使用严格 toDriver。
- Kit 生成 `<时间戳>_<名称>/migration.sql` 与 snapshot.json；原生 migrate 读取这条目录链。本轮没有旧 `_journal.json` 迁移转换，正式打包必须按验证版本的真实产物布局交付。

没有执行完整正式 schema、所有 codec、发布包内迁移、掉电或空间／权限故障，也没有重测五万条查询的 RC 性能。此前的[代表 SQL 探针](../../storage-contracts/2026-10-22/README.md)仍按其原版本与样本解释，不将它改写成 RC 实测。完整版本固定与性能预算仍属于后续工作。

## 试件与复现

[contract-types.ts](contract-types.ts)保存声明组合和编译拒绝样例，[tsconfig.json](tsconfig.json)固定其检查选项。[framing-probe.cjs](framing-probe.cjs)与[结果](framing-results.json)只验证长度帧编码，不实现认证、握手状态机、双向 RPC、取消、进程管理或真实本地 socket。

[drizzle/](drizzle/)保留独立 package、锁文件、两份 schema、Kit 配置、类型样例、生成迁移和 Electron 执行脚本。schema-baseline.ts 是第一份生成输入，schema.ts 是添加 note 后的输入。迁移 SQL 和 snapshot.json 保留工具原始产物，不用手写 SQL 代替生成结果。

在仓库根检查声明；帧探针先复制到新的 `.local/public-contracts-probe` 目录再执行，以保留这里的原始结果：

```powershell
pnpm exec tsc -p refactor/verification/evidence/public-contracts/2026-10-22/tsconfig.json
node .local/public-contracts-probe/framing-probe.cjs
```

Drizzle 复现时先将 drizzle 目录复制到一个新的 `.local` 子目录，使用 `pnpm --dir <fixture> install --ignore-workspace --ignore-scripts --frozen-lockfile` 安装，再用仓库 tsc 按该 fixture 的 tsconfig 编译。不要在历史证据目录执行安装或生成。fixture 的 better-sqlite3 生命周期脚本未运行；执行脚本从当前仓库的 apps/desktop/package.json 解析已验证可用于 Electron 的驱动，不尝试在系统 Node 中加载该 ABI。

从仓库根用 Node 的 child_process.spawn／spawnSync 启动 apps/desktop 解析到的 Electron 可执行文件，以 fixture/run.cjs 为入口，设置 windowsHide: true。它不创建 BrowserWindow，为每次执行创建独立 runs 目录、数据库和 Electron profile，并写出 fixture/results.json。另一仓库布局可通过 KISAKI_PROBE_APP_PACKAGE 显式指定应用 package.json；不得指向真实个人资料。重新生成 SQL 时使用另一份干净 fixture，依次将 baseline 与最终 schema 作为 schema.ts 运行 Kit generate，比较语义而不是时间戳目录名。

正式验收仍须验证实际端点、完整字段校验、全部目标平台和包内资源。本记录的通过数量仅统计上述断言组，不将声明样例或拆包实验冒充应用功能完成。
