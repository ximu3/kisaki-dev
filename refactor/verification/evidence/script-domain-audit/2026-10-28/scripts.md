# 当前脚本用途清单

基线 d949e3629ea6e72514c4fe04e4ab1370a5a88918。当前 46 份清单、164 个脚本条目，另保留三份历史清单。此清单核对职责和调用，不声称每条命令都在本轮重新执行。

## 根工程：27 项

清单：package.json。

| 脚本                     | 实际用途                                      | 调用／入口                      | 判断                               |
| ------------------------ | --------------------------------------------- | ------------------------------- | ---------------------------------- |
| desktop:dev              | 启动桌面源码开发会话                          | README、CONTRIBUTING 的手动入口 | 保留域范围                         |
| build                    | 调度实际 workspace 的 build                   | 全仓手动构建、任务图            | 保留全局名                         |
| desktop:build            | 准备依赖并构建桌面应用                        | 桌面 CI、源测试前置、手动       | 保留域范围                         |
| desktop:package          | 通过任务图准备构建再打包桌面                  | 手动完整打包入口                | 保留；与消费已有制品区分           |
| packages:pack            | 打包桌面八包并汇集收据                        | 根 test:consumers 内调用        | 补 desktop 范围                    |
| typecheck                | 聚合 workspace 和根工程类型检查               | CI、check、手动                 | 保留全局名                         |
| typecheck:root           | 检查根工具、配置和测试                        | typecheck 聚合、Turbo 根任务    | 建议 root:typecheck                |
| lint                     | 聚合项目、根 lint 和依赖边界                  | CI、check、手动                 | 保留全局名；收敛输入传播           |
| lint:root                | 检查根配置、工具和测试源码                    | lint 聚合、lint:fix             | 建议 root:lint                     |
| lint:fix                 | 显式修复根和各 workspace 的 ESLint 问题       | 手动维护入口                    | 保留；写入操作不重放检查缓存       |
| check:boundaries         | 运行依赖边界分析                              | lint 聚合、Turbo 根任务         | 用途有效；扫描范围需可扩展         |
| format:check             | 检查 Prettier 支持文件的格式                  | check、CI、手动                 | 保留                               |
| format                   | 显式写入 Prettier 格式修复                    | 手动维护入口                    | 保留                               |
| test                     | 聚合各包和根的普通测试                        | CI、check、手动                 | 保留；不表示全部宿主验收           |
| test:root                | 运行根工程的结构、边界和 hooks 测试           | test 聚合、Turbo 根任务         | 建议 root:test                     |
| test:consumers           | 准备并检查桌面八包，再运行跨包消费者          | 仓库 CI、手动                   | 补 desktop:packages 范围           |
| test:consumers:run       | 只消费已准备的八包收据与 tarball              | 完整消费者入口、Turbo 输入选择  | 补范围并表达 prepared 前置         |
| desktop:test:native      | 先构建，再以 Electron Node 模式验原生与数据库 | 手动、本机验收                  | 保留独立入口                       |
| desktop:test:browser     | 准备 UI 依赖并执行浏览器交互                  | 桌面 CI、手动                   | 保留独立入口                       |
| desktop:test:e2e         | 先构建，再运行真实桌面窗口场景                | 手动、本机验收                  | 保留独立入口                       |
| desktop:test:dev         | 准备原生与公共依赖，再测真实开发会话          | 手动、本机验收                  | 保留；前置不同于有限构建           |
| desktop:test:artifacts   | 验收已有最终桌面制品                          | 桌面 CI、手动                   | 保留；不能隐式替换待测制品         |
| desktop:test:performance | 先构建，再执行启动与退出采样                  | 手动、本机验收                  | 保留独立入口                       |
| check                    | 组合普通类型、lint、格式和测试                | 日常完整普通检查                | 保留；范围已明确                   |
| hooks:install            | 显式安装本仓库 hooks                          | 初次配置文档、手动              | 用途有效；可统一为 install:hooks   |
| hooks:uninstall          | 撤销本工具拥有的 hooks 配置                   | 手动维护、验收文档              | 用途有效；可统一为 uninstall:hooks |
| clean                    | 调度有 clean 入口的 workspace 清理其输出      | 手动维护                        | 保留；不代表清除缓存和用户资料     |

## 桌面应用：16 项

清单：clients/desktop/app/package.json。

| 脚本              | 实际用途                                     | 调用／入口                   | 判断                               |
| ----------------- | -------------------------------------------- | ---------------------------- | ---------------------------------- |
| dev               | 真实桌面开发 CLI，管理启动与退出             | 根 desktop:dev               | 保留；当前不承诺自定义 CLI 参数    |
| build             | 有限应用或单程序构建                         | 根构建、Turbo 依赖、CI       | 保留                               |
| package           | 验证并包装已准备的桌面构建                   | 根完整入口、CI 已准备流程    | 保留；package 与 npm pack 产物不同 |
| resources:prepare | 单独准备当前目标资源                         | CONTRIBUTING 手动入口        | 可统一为 prepare:resources         |
| native:build      | 准备原生绑定与匹配 ABI 输出                  | 根开发测试前置、CI、手动     | 可统一为 build:native              |
| typecheck         | 检查应用各环境、工具、配置和测试             | 根 typecheck、CI             | 保留                               |
| lint              | 检查应用 TypeScript 源码                     | 根 lint、CI、手动            | 保留；原生静态检查另有入口         |
| native:check      | 执行 Rust 格式与 Clippy 检查                 | 桌面 CI、手动                | 可统一为 check:native              |
| test              | 普通 Node 单元与较小接入测试                 | 根 test、CI                  | 保留；不误称全部为纯单元           |
| test:native       | 在匹配 Electron ABI 的 Node 模式运行原生套件 | 根入口、桌面 CI              | 保留环境边界                       |
| test:browser      | 真实 Chromium 中的窗口组件交互               | 根入口、桌面 CI              | 保留环境边界                       |
| test:e2e          | 真实 Electron 窗口、bridge 和关闭            | 根入口、桌面 CI              | 保留                               |
| test:dev          | 隔离工作区中的构建恢复、HMR 和生命周期       | 根入口、桌面 CI              | 保留；职责已另行复核               |
| test:artifacts    | 启动并验收未改写的打包载体                   | 根入口、桌面 CI              | 保留                               |
| test:performance  | 固定次数的启动和正常退出采样                 | 根入口、桌面 CI              | 保留                               |
| clean             | 清理应用 out 与 dist，保留缓存和 profile     | 根 clean、手动、已有行为测试 | 保留                               |

## 八个公共包：50 项

| 包                              | 脚本数 | 已有普通测试                           |
| ------------------------------- | ------ | -------------------------------------- |
| @kisaki3/appearance             | 6      | 当前没有业务 test 入口；不虚设成功脚本 |
| @kisaki3/desktop-contracts      | 7      | 有 test 入口                           |
| @kisaki3/extension-api          | 6      | 当前没有业务 test 入口；不虚设成功脚本 |
| @kisaki3/extension-cli          | 7      | 有 test 入口                           |
| @kisaki3/extension-distribution | 6      | 当前没有业务 test 入口；不虚设成功脚本 |
| @kisaki3/extension-sdk          | 6      | 当前没有业务 test 入口；不虚设成功脚本 |
| @kisaki3/rpc                    | 6      | 当前没有业务 test 入口；不虚设成功脚本 |
| @kisaki3/ui                     | 6      | 当前没有业务 test 入口；不虚设成功脚本 |

| 共用脚本       | 实际用途                                 | 判断                    |
| -------------- | ---------------------------------------- | ----------------------- |
| build          | 生成代码、声明及适用样式并交接 dist      | 保留                    |
| pack           | 将已准备内容打成 out/package.tgz         | 保留；README 调用需修正 |
| typecheck      | 检查所属源码、工具、配置及适用测试       | 保留                    |
| lint           | 检查所属源码                             | 保留                    |
| test           | 运行已归属本包的普通测试                 | 保留                    |
| test:consumers | 用 publint、attw 检查 tarball 与声明入口 | 建议 check:package      |
| clean          | 清除本包 dist 与 out                     | 保留                    |

appearance 和 ui 的 attw CSS 入口排除来自其真实导出类型；esm-only 对应实际 ESM 合同，不因形式统一而移除。

## 官方扩展：66 项

33 个现有工程分别提供 typecheck 和 lint，验证已有 kisx.config.ts 与工程配置。由根聚合与 CI 调度；当前没有实现的业务构建、打包和测试不预造入口。全部清单路径列在 inventory.json。

## 私有工程包：五项

| 包                         | 当前入口              | 判断                                                              |
| -------------------------- | --------------------- | ----------------------------------------------------------------- |
| @kisaki3/eslint-config     | typecheck、lint       | 有对应源码或测试，保留                                            |
| @kisaki3/tooling           | typecheck、lint、test | 有对应源码或测试，保留                                            |
| @kisaki3/typescript-config | 无脚本                | 纯 JSON 配置，通过消费者加载与根格式检查验证；不添加空 build/test |

## 动态生成的消费者清单

| 脚本      | 用途与调用                                               | 判断                                       |
| --------- | -------------------------------------------------------- | ------------------------------------------ |
| typecheck | 根消费者用例显式 run typecheck，检查四个真实作者配置。   | 保留；其版本基线与桌面作者路径应明确归属。 |
| build     | 根消费者用例显式 run build，构建 Webview 与 Solid 页面。 | 保留。                                     |
| node      | 根消费者用例显式 run node，执行 Node 消费断言。          | 当前调用正确；建议 test:node 表达用途。    |

## 历史清单

| 路径                                                                                  | 脚本         | 处理                                                     |
| ------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| refactor/verification/evidence/appimage-policy/2026-10-26/probe/package.json          | check、probe | 当时的验证输入；不参与当前 workspace，不批量改名或删除。 |
| refactor/verification/evidence/public-contracts/2026-10-22/drizzle/package.json       | 无脚本       | 当时的验证输入；不参与当前 workspace，不批量改名或删除。 |
| refactor/verification/evidence/technical-tradeoffs/2026-10-22/candidates/package.json | 无脚本       | 当时的验证输入；不参与当前 workspace，不批量改名或删除。 |
