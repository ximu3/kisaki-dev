# 桌面应用配置布局复核

按已确认的方案，应用根目录保留类型项目、常规 Node 测试和桌面端到端测试入口；16 份具体配置迁入 `config/typescript`、`config/vite`、`config/vitest` 和 `config/playwright`。打包配置仍由根 `electron-builder.yml` 提供，执行流程与测试辅助分别归 `tools` 和 `tests`。

## 配置与检查边界

`tsconfig.json` 通过空 `files` 和七个项目引用组织检查，`typecheck` 使用 `tsc -b`。各环境继续继承共同严格规则并保持 `noEmit`；增量信息写入应用 `.cache/typescript`。迁移前后的输入文件、类型环境、严格性和原生入口别名逐项核对相同，详见 [typecheck-coverage.json](typecheck-coverage.json)。

本机 TypeScript 6.0.3 语言服务通过 `open`、`projectInfo` 和 `semanticDiagnosticsSync` 核对 11 个代表文件。main、preload、renderer、extension-host、shared、tools、tests，以及迁入的三类工具配置和贴近源码的测试均归入预期项目，语义诊断为空，见 [editor-projects.json](editor-projects.json)。

构建与开发直接指定 `config/vite` 中的配置；程序配置导入、开发监听和构建身份的输入范围同步调整。Playwright 的测试、结果目录和 JSON 报告路径均按新配置位置重算，实际结果仍位于应用 `test-results`。根源码覆盖检查沿执行入口和项目引用遍历，不以移动目录缩小检查范围。

## 本机验证

环境为 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、Vite 8.3.3、Vitest 5.0.5、Playwright 1.64.1、Electron 44.5.1。复现命令从仓库根目录执行；运行测试消费已完成的本机构建，各测试使用独立资料或源码副本。

本轮构建身份为 `24e6a2632e7dba25272d7917fcfe0ea22ff29f758151576cf50cc9c19a56f92d`，源码、有限构建、性能样本和最终制品一致，见 [identity-check.json](identity-check.json)。配置与相关工具、测试的输入摘要见 [configuration-inputs.json](configuration-inputs.json)，实际运行文件与制品摘要见 [desktop-build.json](desktop-build.json) 和 [artifacts.json](artifacts.json)。

| 命令或检查                                                     | 结果与证据                                                                                                                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter @kisaki3/desktop exec tsc -b --force --verbose` | 七个环境完整检查通过。[typecheck.log](typecheck.log)                                                                                                                                 |
| `pnpm check`                                                   | 47 项类型任务与根类型检查、lint、161 模块／284 依赖边界、格式、25 项常规测试通过。[check.log](check.log)                                                                             |
| `pnpm desktop:build --target windows-x64`                      | 四个程序、原生与资源装配通过。[build.log](build.log)                                                                                                                                 |
| `pnpm --filter @kisaki3/desktop test:native`                   | 实际 Electron Node 宿主下原生／SQLite 8 项通过。[native.log](native.log)                                                                                                             |
| `pnpm --filter @kisaki3/desktop test:browser`                  | 真实 Chromium 组件测试 1 项通过。[browser.log](browser.log)                                                                                                                          |
| `pnpm --filter @kisaki3/desktop test:e2e`                      | 四类实际 Electron 窗口共 4 项通过。[e2e.json](e2e.json)                                                                                                                              |
| `pnpm --filter @kisaki3/desktop test:dev`                      | 在独立副本中修改迁移后的 Vite 配置，新 PID 与新产物中的配置结果均得到验证；构建失败保留、修复、改名、HMR、公共包更新和正常关闭仍通过。[development-test.json](development-test.json) |
| `pnpm --filter @kisaki3/desktop test:performance`              | 20 次新进程启动和退出通过；JSON 报告与附件仍写入原输出目录。[performance-test.json](performance-test.json)、[performance.json](performance.json)                                     |
| `pnpm desktop:package --target windows-x64`                    | 当前构建的 ZIP 与 NSIS 已生成。[package.log](package.log)                                                                                                                            |
| `pnpm --filter @kisaki3/desktop test:artifacts`                | 当前 ZIP 的资源与构建身份、7 项正式 fuses、外部窗口观察、便携资料和正常退出通过。[artifact-test.json](artifact-test.json)                                                            |

20 次启动的中位数为 526.22 ms，P95 为 585.56 ms，最大值为 767.85 ms，按固定的 P95 ≤ 5,000 ms 预算通过。测量范围为 W00 外壳、热磁盘缓存与隔离资料。

公共包、公开 exports 与消费者配置未改动，其制品消费证据沿用[全覆盖复核](../full-audit/README.md)。NSIS 的安装、更新和卸载未在本轮验收；其余五目标和远端 CI 仍待完成，W00 保持进行中。本轮未提交、推送、发布或部署。
