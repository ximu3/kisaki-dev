# 开发 IPC 完整替换的实施与验证

2026-10-26，确认采用[完整替换方案](../proposal.md)后，同步修改正式合同与实际 W00 接入。当前规则见[父子消息合同](../../../../../design/engineering/protocols.md#development)，本文记录实际实现、输入与验证范围。

## 实际替换

源码桌面与打包应用共用 `@kisaki3/extension-cli/extension` 的 launchDevelopmentApplication，通过 Node spawn 的 JSON IPC 建立连接。纯消息、版本、参数名与校验由 `@kisaki3/desktop-contracts/development` 唯一拥有。应用只消费纯合同，工程启动器消费 CLI 的构建后 exports；锁文件只增加这三个实际 workspace 依赖关系，没有升级外部依赖。

删除 `app/src/shared/development-session.ts` 与 `app/tools/dev/electron-process.ts`，实际消费者不再使用私有 shutdown／简化 ready。正式合同移除 socket 端点、一次性 token、消息 sessionId、自定义长度帧、batch sequence、线上 superseded、stop requestId 与 manifestSha256；Node 提供传输边界，工具独自维护尚未交付的最新构建。旧隔离字节帧试件保留原记录，并明确标注已被替代。

受控开发显式传入 development 与绝对 profile，主进程在建立 Session 等资源前选择路径，并要求真实父子 IPC。打包模式从包内正常主模块进入这一接入，保留生产 fuses。源码 UI 自动化单独传入隔离 profile；Playwright 的 Electron launch 不提供 IPC 配置，因此资料选择与开发控制分别表达，不修改 Playwright、注入测试专用通道或恢复旧协议。source window 与 renderer-url 也改为显式参数。

ready 交付实际桌面 buildId 与应用版本；源码候选把 package.json.version 写入运行清单，避免误报 Electron 自身版本。W00 尚未实现扩展运行 API，明确交付 apiVersion: null，应用拒绝 buildsReady。开发构建、采用与激活的完整消息已经形成纯合同，但真实业务及完整 kisx 命令仍归 W03／W08；本轮没有空成功回复、虚构激活或预建空 CLI。

## 退出与资源寿命

共同退出流程先让窗口作出关闭决定，再在 will-quit 收回共享宿主。开发 stop 被取消时，当前进程、宿主、监听、服务器和输出保持可用；之后可以再次停止。正常停止没有自动强杀期限。启动准备使用 AbortSignal，开发 CLI 的运行期信号请求正常退出；一般有限命令的 runCli 保持原职责。连接失败会阻止后续候选交接，并保留仍在使用的资源。

父进程以 exit 观察实际进程结束。stopResult.exiting 只报告已进入退出，不替代进程事实；不依赖 Node 主动断连时可能缺失的 close。应用从界面正常退出后，源码会话完成自己的工具收尾。无法确认相关读取者结束的异常启动或异常退出会保留该会话输出并诊断；强制结束只由明确调用 terminate 或 CLI 在失败后提示的再次中断触发。

这次同时修复了原有“先关闭宿主，再让窗口取消退出”的顺序问题。依据 [Electron app 退出事件](https://www.electronjs.org/docs/latest/api/app#event-will-quit)与 [beforeunload 的拒绝语义](https://www.electronjs.org/docs/latest/api/web-contents#event-will-prevent-unload)接入；真实窗口拒绝关闭的回归检查了原 Utility 进程仍然存活，之后继续验证 HMR、源码重启和失败恢复。

## 本机验证

环境为 Windows 10 22H2 x64、Node 24.11.1、pnpm 11.11.0、Electron 44.5.1、electron-builder 26.15.3。所有资料与修改样本位于会话或测试拥有的目录，没有使用真实个人资料。

[最终源码摘要](source-inputs.json)记录本次相关修改文件、删除项与工作副本基线；制品另按下方回执标识。制品验证之后的开发工具收尾与文档修改没有触及其运行代码，未因全仓身份变化机械重打相同程序。

| 检查 | 实际结果与证据 |
| --- | --- |
| 相关包及本体静态检查 | desktop-contracts、extension-cli、desktop 的 typecheck／lint 通过；[日志](static-checks.log) |
| 依赖边界 | 219 个模块、378 条依赖无违规；[日志](boundaries.log) |
| 根工程与本体普通 Node 测试 | 分别 19 项与 14 项通过；[根工程](root-tests.log)、[本体](desktop-tests.log) |
| 开发工作流 | 最终五项通过，覆盖退出取消后继续开发、完整候选重启、失败修复、界面退出后工具自动收尾、准备取消与重试，以及明确断连后的实际 exit；[JSON](development.json)、[日志](development.log) |
| 真实原生窗口 | 四种窗口的独立 profile、最小 bridge、沙箱与正常关闭通过；[结果](windows.json)、[日志](windows.log) |
| 实际 Windows 制品 | ZIP／NSIS 候选生成成功；实际 ZIP 载体的普通便携启动、受控开发启动、独立 profile、真实退出、缺少 IPC 时提前拒绝通过；[制品回执](artifact-receipt.json)、[测试结果](artifacts.json)、[打包日志](package-windows.log) |
| 公共包消费者 | 八包真实 tarball 的 publint／ATTW 及仓库外两项集成检查通过；新增入口从已安装的包被 TypeScript 与 Node 消费；[输入](package-inputs.json)、[结果](consumers.json)、[日志](consumers.log) |
| W00 启动与退出 | 20 次全新进程，p95 409.63 ms，通过既有预算并确认观察到的全部进程结束；[样本与统计](startup.json)、[运行结果](startup-results.json) |
| 根静态与文档检查 | 根 typecheck／lint、全仓匹配文件的格式检查、33 份变更 Markdown 的本地链接与锚点检查通过；[类型](root-typecheck.log)、[lint](root-lint.log)、[格式](format.log)、[链接](links.log) |

制品的桌面 buildId 为 `957ec0f2ab1418f8862bbbd476f3af85da87a1b15fc1dd9aa402a9c5cef82f9a`。测试从回执核对原始文件摘要，再提取 ZIP 运行。生产 fuses 的四项关闭与三项开启保持原值，项目开发 Electron 的 RunAsNode 仍开启；打包没有修改开发运行时。Windows 可执行文件回读为 NotSigned，符合现行 Windows 策略，不将 builder 的 signing 日志当作取得了签名身份。

首轮开发集成测试因在模块加载阶段导入尚未构建的 CLI exports 而失败，保留[原始结果](development-initial.json)。已将公共启动器的加载放到依赖构建完成之后；修复后的隔离工作副本验证完整通过。没有通过复制现成 dist 到样本、指向跨包 src 或取消检查绕开问题。

## 仍然保留的范围

本轮实现和验证针对现有 W00 启动、控制与退出链路。扩展批次的真实采用、激活、页面重建及 buildsReleased 由 W03／W08 接续，不能把纯消息校验计作这些业务已通过。源码热重启与普通停止的测试不等于完整产品的草稿、Dialog 或关闭确认验收。

macOS、Linux、ARM64 与真实 AppImage 的新 IPC 接入尚无本轮运行证据；旧六目标结果保留其原提交与范围。AppImage 启动脚本自动附加 no-sandbox 的已知问题继续作为独立事项处理，本轮未修改该策略。PR 元信息触发完整 CI 的讨论项也未改动。没有运行新的远端 CI、发布 npm 包、上传制品或部署服务。

可复现入口是相关包 typecheck／lint、check:boundaries、test:root、desktop 的 test／test:dev／test:e2e／test:artifacts／test:performance，以及根 test:consumers。打包使用 `pnpm desktop:package --target windows-x64 --test-only`；同一工作副本按现行规则顺序执行，不在写相同输出的任务间并行。
