# 公共包类型入口复核

八个公共包保留简洁的根目录配置：`tsconfig.json` 以空 `files` 和项目引用组织库源码、工具，以及 UI 的独立构建配置环境；库源码配置改为 `tsconfig.lib.json`，tsdown 显式读取它生成代码与声明。各包通过 `tsc -b` 检查全部环境，增量信息归各自 `.cache/typescript`。官方扩展继续使用原有单一环境入口。

## 类型与公开制品

迁移前后的 17 个类型环境逐项比较源码覆盖和编译选项，除增量信息与配置文件自身位置外均相同。唯一的声明检查例外仍是 UI 的 `tsconfig.config.json`，只覆盖 `tsdown.config.ts`，详见 [typecheck-coverage.json](typecheck-coverage.json)。

调整前，appearance 与 UI 的工具源码和 tsdown 配置在语言服务中落入推断项目，见 [editor-before.json](editor-before.json)。调整后，八包当前全部 38 个源码、工具和配置文件均通过 TypeScript 6.0.3 的 `open`、`projectInfo` 与 `semanticDiagnosticsSync` 核对，使用预期的库、工具或配置项目，语义诊断为空，见 [editor-projects.json](editor-projects.json)。

八包的 27 份 JavaScript、声明和样式输出与调整前逐字节相同，见 [output-comparison.json](output-comparison.json)。各包 manifest 只有 `scripts.typecheck` 改变；版本、公开 exports、依赖及其他字段保持一致，见 [package-contracts.json](package-contracts.json)。

## 验证

本轮环境为 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、tsdown 0.23.0、Vite 8.3.3、Vitest 5.0.5、Playwright 1.64.1、Electron 44.5.1。命令从仓库根目录执行，消费者与开发测试使用独立目录。

当前有限构建身份为 `e573ba2a9155ab5a310b3c1964a9f74fac6908309a198796daedda3038326ff0`，与本轮源码输入一致，见 [identity-check.json](identity-check.json)。修改涉及的配置、manifest、开发监听和回归测试摘要见 [configuration-inputs.json](configuration-inputs.json)。

| 命令                                          | 结果与证据                                                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                                  | 全仓类型、lint、依赖边界、格式和 25 项常规测试通过。[check.log](check.log)                                                                                                                                                                       |
| `pnpm test:consumers`                         | 八包构建与 tarball、publint、既有 ESM 消费范围的 ATTW 检查，以及仓库外严格 TypeScript、Node、普通浏览器和 Solid 消费通过。[consumers.log](consumers.log)、[consumer-tests.json](consumer-tests.json)、[package-inputs.json](package-inputs.json) |
| `pnpm desktop:build --target windows-x64`     | 本体消费八包中实际依赖的公开构建入口，四个程序及资源装配通过。[desktop-build.log](desktop-build.log)、[desktop-build.json](desktop-build.json)                                                                                                   |
| `pnpm --filter @kisaki3/desktop test:browser` | 真实 Chromium 组件测试 1 项通过。[browser.log](browser.log)                                                                                                                                                                                      |
| `pnpm --filter @kisaki3/desktop test:e2e`     | 四类 Electron 窗口共 4 项通过。[e2e.json](e2e.json)                                                                                                                                                                                              |
| `pnpm --filter @kisaki3/desktop test:dev`     | 新增库配置监听场景通过：破坏 UI 的 tsconfig.lib.json 会报告构建失败并保留原进程；修复后完成新构建交接。原有配置改动、源码失败与修复、改名、HMR、公共包更新和关闭场景继续通过。[development-test.json](development-test.json)                     |

开发场景补充后，对修改的应用文件再次执行了 Prettier、ESLint 与应用类型检查，均通过。

## 桌面工具职责核对

应用 tools 根目录的七个模块保持当前设计。它们服务应用自身的工程工作流，运行源码没有反向导入这些工具。

| 文件                     | 职责与实际使用者                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `clean.ts`               | 应用 clean 任务入口；检查活动输出锁并清理声明的 out、dist。                                                      |
| `electron-executable.ts` | 读取当前安装的开发 Electron 可执行路径，供开发会话与真实 Electron 测试使用。                                     |
| `output.ts`              | 管理候选目录、单写入者锁、成功交接和失败恢复；由构建、资源、原生和打包流程复用，现有测试覆盖失败保留和并发写入。 |
| `paths.ts`               | 提供应用根、仓库根和有限构建输出位置，供工程流程与测试定位输入。                                                 |
| `process.ts`             | 执行子进程、等待退出，并通过发起当前任务的 pnpm 运行后续命令或读取有限输出。                                     |
| `sha256.ts`              | 计算字节的十六进制 SHA-256，供资源、构建身份、开发输入和制品校验复用。                                           |
| `targets.ts`             | 解析六个受支持的桌面目标、识别当前宿主并提供 Rust target 映射，供资源、原生、构建和打包使用。                    |

原生、性能及最终桌面 ZIP 的最近专项证据保留在[配置布局复核](../config-layout/README.md)，本轮不将其记为重新执行。其余五目标和远端 CI 仍待完成，W00 保持进行中；未提交、推送、发布或部署。
