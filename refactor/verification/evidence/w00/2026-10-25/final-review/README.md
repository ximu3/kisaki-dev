# W00 最终审查

本次审查针对 `93a06c29beddb41b1083549c004ab830fcc29ff5` 加当前工作区的实际内容，按 [W00 工作包](../../../../../implementation/work-packages.md#w00)、工程配置、构建与资源寿命规范，以及 A24、A26、A28、A31 的适用范围核对。结论为 **需修正后复核**：确认两项工程实现缺陷，另有一项默认测试入口在本机环境中不能运行的问题。

审查没有修改产品或工具实现，也没有提交、推送、改动远端或发布。当前工程的 [418 份输入清单](inventory.json)包含 173 份 TypeScript、TSX 与 Rust 源文件；审查开始与结束的摘要一致。相同的公共包工具和 33 项扩展配置按实际内容成组核对，重点检查构建输入、输出交接、资源与进程寿命、环境隔离和失败恢复。输入版本、合同摘要、问题位置和结果汇总见[审查数据](review.json)。

## 已确认问题

### F1 · P1：公共包配置目录没有进入构建身份

[sourceIdentity](../../../../../../clients/desktop/app/tools/build/identity.ts) 在第 43–49 行只读取公共包的 src、tools 和根目录 `.ts`／`.json` 文件。辅助类型配置迁入 config/typescript 后，没有同步纳入这个输入集合。

因此，改变有效的库构建配置不会改变桌面 buildId，构建前后的输入核对也不能发现这类变化。该问题违反[配置迁移](../../../../../../CONVENTIONS.md#configuration-layout)对构建身份输入的要求；上一轮归组已验证的编译选项、公开输出与制品等效，不能替代这个检查。

隔离复现使用与当前源码逐字节相同的 identity.ts、paths.ts 和 sha256.ts，按实际目录结构建立样本。将嵌套 tsconfig.lib.json 的 target 从 ES2023 改为 ES2022，修改前后的身份相同；修改根 tsdown.config.ts 的对照操作则正常改变身份。结果见[复现数据](reproductions.json)中的 identity。应将实际公共包配置输入纳入同一身份计算，并验证有效配置变化及构建期间变化能够被识别。

### F2 · P2：进程终止后，遗留锁会阻止后续工作

[replaceOutput](../../../../../../clients/desktop/app/tools/lib/output.ts) 第 21–22 行通过创建目录取得锁，只在正常 JavaScript 收尾中删除，没有记录持有者或识别已失效的锁。公共包 build.lock 和开发会话 .session-lock 使用相同方式；清理入口又把这些目录的存在直接视为仍有工作运行。

复现让真实 replaceOutput 进入 prepare 后终止其独立子进程，再等待进程确实退出。上次完整输出仍然保留，但锁目录也保留，下一次调用立即以 EEXIST 失败，见[复现数据](reproductions.json)中的 lock。该样本仅操作审查拥有的缓存目录，没有中断实际开发会话或删除用户输出。

需要同时保证活跃写入者互斥与失效持有者的恢复，并覆盖创建中断。不能通过无条件删除所有锁解决，因为那会破坏正在进行的构建。正常编译失败的现有用例通过，不代表进程终止后的恢复已经成立。

### F3 · P2：浏览器测试的默认端口在本机不可用

当前[浏览器测试配置](../../../../../../clients/desktop/app/config/vitest/vitest.config.browser.ts) 使用 Vitest 的默认 API 端口 63315。实际执行正式 test:browser 入口时，在监听 `::1:63315` 阶段得到 EACCES，没有运行任何测试。Windows 的 IPv4、IPv6 端口保留范围都包含 63310–63409，见[IPv4 记录](port-exclusions-ipv4.txt)、[IPv6 记录](port-exclusions-ipv6.txt)和[默认运行日志](browser.log)。

使用已安装 Vitest 5.0.5 的公开 `--api.host`、`--api.port` 参数补充定位：传入端口 0 仍回到 63315 并失败；传入操作系统分配后释放的可用正整数端口 65254，原浏览器用例通过。分别见[端口 0 日志](browser-ephemeral.log)、[所选端口](browser-port.json)与[补充运行](browser-selected-port.log)。本轮没有改动系统保留范围、提升权限或关闭测试断言。

应使正式浏览器测试入口能够在实际支持环境中取得可用回环端口。这里是测试服务器配置问题，不是组件用例失败；补充运行通过不能登记为默认入口已经通过。Vitest 5 使用 test.api 与 `--api.port`，不能照搬旧版 browser.api，也不能把端口 0 当成本轮已经验证有效的方案。依据见[当前 API 文档](https://main.vitest.dev/config/api)。

## 合同覆盖与运行结果

本机环境为 Windows 10 x64、Node 24.11.1、Electron 44.5.1。实际桌面构建身份为 `867b0e9a5a0144f7262fedf0022f368615bd8a5a250216d1d7541ff2b935f6dc`；该值如实记录当前实现结果，不据此忽略 F1 的输入遗漏。

| 范围 | 本轮结果 |
| --- | --- |
| 工程边界与常规检查 | [pnpm check 通过](check.log)：类型、依赖边界、lint、格式、根工具 15 项与应用 Node 10 项 |
| 官方扩展工程身份 | [33 项](extension-inventory.json)身份唯一、格式与 private 状态正确；仍只计工程配置，不计业务实现 |
| Rust 与私有绑定 | [Rust 检查通过](native-check.log)，[实际 Electron Node 模式原生／SQLite 8 项通过](native.log) |
| Windows x64 构建 | [通过](build.log)，实际构建四类程序并装配当前资源与绑定 |
| 真实浏览器 | 默认入口未通过；指定可用端口后 1 项通过，详见 F3 |
| 原生窗口入口 | [四类窗口分别启动、调用最小桥接并关闭的 4 项通过](e2e.log) |
| 公共包与仓库外消费 | [八包制品检查、真实 Node 与浏览器消费通过](consumers.log)，[消费者 2 项通过](consumers.json) |
| 开发会话 | [通过](dev.log)，[既有完整用例](dev.json)包含配置失败与恢复、完整交接、源码更新和停止；进程终止的补充复现另按 F2 记为缺陷 |
| 启动与退出观察 | [20 次新进程测量通过](performance.log)，[样本](startup.json)中位数约 391 ms、P95 约 429 ms，已观察进程均退出 |
| 实际制品 | [Windows 打包通过](package.log)，[原样 ZIP 外部启动、关闭与正式 fuses 检查通过](artifacts.log)，[用例结果](artifacts.json) |

UI 的原生 Button、公共包的当前最小入口和扩展工程骨架属于已确认的 W00 范围。完整 Kobalte 控件体系、正式业务合同、扩展激活与 SDK 接入等继续由后续工作包交付，不作为本次要求提前实现的内容。

## 证据与后续复核

本轮 Windows 的四份制品与更新文件共 279,509,910 字节，已按实际回执核对 SHA-256 并另行留存。归档位置和逐文件摘要见 [review.json](review.json) 的 artifact 字段；普通后续构建不会覆盖这份独立归档。NSIS 与生成的程序 EXE 均经[Authenticode 核对](windows-signatures.json)为 NotSigned，符合当前 Windows 策略。NSIS 未安装或升级验收；候选为 test-only，没有进行公开发行。

两个工程缺陷可从仓库根使用下列命令重新观察。脚本每次建立新的隔离样本，输出当前代码的实际行为；已终止的样本锁只留在审查缓存中。

```sh
pnpm exec tsx refactor/verification/evidence/w00/2026-10-25/final-review/reproduce.ts
```

本次未重新运行其他五个目标。已有[六目标 CI](../../2026-10-24/ci/README.md)继续证明其固定提交 `df0d99d` 的范围，不能直接作为本次全部工作区改动已完成跨平台验证的结论。修正上述问题后，需按影响范围重新验证并更新当前工作包状态；正式签署、安装升级、完整产品及独立项目验收仍按各自工作包进行。
