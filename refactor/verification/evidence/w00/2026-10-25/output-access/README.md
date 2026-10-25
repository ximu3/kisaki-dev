# W00 输出访问修正与验证

本记录接续[终审 F2](../final-review/README.md)与[工程锁审视](../lock-design-review/README.md)。实现采用已确认的按项目、按输出读写方案：普通操作持有项目共享锁，清理持有项目独占锁；同一固定输出允许共享读取，写入与读取互斥。没有使用工作区整体串行入口。

本机 Windows x64 的实现检查、实际开发、包消费、原生、桌面、性能与 ZIP 验证全部通过。六目标执行与完整结论见[CI 验证](ci/README.md)，工作包状态见[实施状态](../../../../../implementation/status.md#w00)。构建身份沿用输入指纹机制，[F1 与 F3 的修正](../corrections/README.md)纳入本轮回归。

## 实现范围

根 `tools/outputs` 统一拥有系统锁、访问上下文、子进程收尾和完整候选替换，使用固定的开发依赖 fs-native-extensions 1.5.2。各工程只消费其公开入口；生产程序不依赖它。工具源码纳入严格类型检查，根工程与八个公共包的身份、公开 exports 和发行范围保持各自边界。

- 根 Turbo 入口先读取公开任务计划，再取得参与项目及可缓存输出的占用，覆盖缓存恢复和实际执行。任务依赖仍由 pnpm 与 Turbo 提供。
- 八包构建、打包、类型及制品消费，本体构建、资源、原生、打包与运行测试，分别声明所用输出。构建完成后的复制、校验和消费在占用内结束。
- `clean` 在项目独占范围内删除声明的输出。活动开发会话持有本体项目共享锁，独占自己的 session 目录；关闭编译、子进程、监听和服务后清理目录并释放占用。
- 有限任务遇到冲突时退出；开发重建可以取消等待。CLI 在初始化前安装取消处理，子进程完成以实际 `close` 为准。
- 永久锁载体的存在不代表活动占用。系统句柄决定锁寿命，访问元数据须通过活动句柄校验；没有 PID、目录时间或超时过期判定。子进程通过 Node 的文件描述符传递承接占用，正常关闭等待所属命令结束。

正式规则见[输出访问](../../../../../design/engineering/workspace.md#output-access)、[工具归属](../../../../../design/engineering/layout.md#tools)与根[开发指南](../../../../../../CONTRIBUTING.md)。自定义有限 Turbo 任务使用 `pnpm outputs:turbo`；清理脚本使用 `pnpm run clean`，避免调用 pnpm 的同名内置命令。

## 本机结果

环境为 Windows 10 22H2 x64、Node 24.11.1、Electron 44.5.1、普通交互桌面。当前构建身份为 `2751247a6c187c5473fc49342642c1953483dbd772d887d0b4ade0f25a1ab2ea`。输入清单包含 421 份工程文件，见[输入摘要](inputs.json)；构建内文件与资源摘要见[构建清单](desktop-build.json)。

| 命令 | 结果与证据 |
| --- | --- |
| `pnpm check` | 类型、lint、格式与依赖边界通过，根 24 项、本体 Node 12 项通过；[日志](check.log) |
| `pnpm --filter @kisaki3/desktop native:check` | 固定 Rust 工具链格式与 Clippy 通过；[日志](native-check.log) |
| `pnpm desktop:test:dev` | 2 项实际开发会话通过；[日志](development-final.log)、[报告](dev.json) |
| `pnpm desktop:test:browser` | 默认入口 Chromium 1 项通过；[日志](browser.log) |
| `pnpm desktop:test:native` | Electron Node 模式的 SQLite 与原生 8 项通过；[日志](native.log) |
| `pnpm desktop:test:e2e` | 四类真实窗口 4 项通过；[日志](e2e.log)、[报告](e2e.json) |
| `pnpm test:consumers` | 八包 publint、ATTW 和仓库外消费者 2 项通过；[日志](consumers.log)、[报告](consumers.json)、[包输入](package-inputs.json) |
| `pnpm desktop:test:performance` | 20 次新进程通过，P95 418.26 ms；[日志](performance.log)、[原始测量](startup.json) |
| `pnpm desktop:package --target windows-x64` | NSIS 与 ZIP 生成成功；[日志](package.log)、[制品回执](artifact-receipt.json) |
| `pnpm desktop:test:artifacts` | 原样 ZIP 的摘要、资源、正式 fuses、外部启动及正常关闭通过；[日志](artifacts.log)、[报告](artifacts.json) |

根测试中的输出访问用例共 8 项，使用真实 Node 子进程和隔离目录：共享读取排除写入与清理、独立输出可以并行、取消不保留部分占用、子任务复用、持有者终止后重试、命令树取消、父进程终止后的子进程占用，以及实际 Turbo 缓存恢复。缓存用例先确认 HIT，读者活动时恢复被拒绝，释放后恢复的声明字节与原构建相同。

开发回归同时验证活动会话阻止清理、无关 RPC 构建可以完成、关闭后清理成功且资料标记保留；原有配置与源码失败恢复、imports、改名、HMR 和公共包交接均通过。取消用例在首次依赖取得前停止，确认没有发布 ready、session 目录已清理、项目清理可进入，随后完整重启成功。初次回归曾因测试调用了 pnpm 内置 `clean` 而失败，改为显式 `run clean` 后完整回归通过，没有放宽清理断言。

命令起止与退出码见[执行记录](commands.json)，汇总见[结果数据](results.json)。候选文件已经复制到仓库忽略的 `artifacts/w00-output-access/2751247a6c187c54/windows-x64`，逐份摘要与回执一致，见[留存记录](archive.json)。

## 覆盖边界

六目标 CI 的每个原生 runner 配置了同一组输出访问用例，并执行所属平台的构建、开发与制品任务；配置本身不登记为运行通过。历史六目标记录仍对应其原提交。

本机 NSIS 未执行安装或升级验收。性能数据仅代表 W00 工程外壳，使用热磁盘缓存与隔离 profile。完整业务、平台支持下限、macOS 正式签署／公证及其余后端验证按后续工作包完成。本轮没有发布应用或公共包，也没有改动正式仓库身份。
