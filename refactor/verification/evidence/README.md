# 验证证据

本目录保存现行设计所用的来源、技术比较、试件和实测结果。每份记录说明输入、版本、环境、复现方式及未覆盖范围。产品规则由[设计](../../design/README.md)定义，正式实现与验收进度见[实施状态](../../implementation/status.md)。

## 本体与公共边界

| 范围                         | 记录                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| 编码规范与类型感知检查 | [唯一规范归属、注释覆盖、原生类型项目、lint 构建范围及本机验证](readability-conventions/2026-10-30/README.md) |
| 代码验证与标题检查 | [PR 代码与标题验证、手动完整入口及候选试验](w00/2026-10-29/code-verification/README.md) |
| PR 元信息与合并门禁 | [原生代码触发器、独立标题检查与严格分支保护](w00/2026-10-29/ci-gate/README.md) |
| W00 收尾 | [原生合并保护、Squash 与分支清理、Windows 输出占用核对](w00/2026-10-29/closure/README.md) |
| 项目说明与 W00 完成度 | [通用说明清理、当前完成范围与合并约束缺项](project-documentation/2026-10-28/README.md) |
| 全项目可读性与编码风格 | [686 份当前输入、核心规范、组织与命名、代码分段及验证](project-readability/2026-10-28/README.md) |
| 终态实现与整体一致性 | [684 份当前输入的完整审查、四项确认取舍、合同与工程修正](final-state-coherence/2026-10-28/README.md) |
| 声明检查分工 | [skipLibCheck 的收益与边界](monorepo-review/2026-10-27/skip-lib-check.md) · [用户确认后的采用与验证](declaration-checks/2026-10-27/README.md) |
| 当前 W00 CI | [新工程提交、并发调整与实际失败记录](w00/2026-10-27/ci/README.md) |
| CI 编排与反馈时间 | [任务依赖、构建复用、范围误触发修正与完整／增量实测](ci-design/2026-10-27/README.md) · [正式采用与验证](ci-design/2026-10-27/adoption/README.md) |
| CI 工程组织与测试职责 | [PR 接续、按工程组织与目标任务](ci-architecture/2026-10-28/README.md) · [开发测试职责复核与迁移](ci-architecture/2026-10-28/development-tests.md) |
| 脚本命名与跨域边界 | [全部 package.json 用途、前缀方案、消费者路由与扩展输入审查](script-domain-audit/2026-10-28/README.md) · [确认后的实施与验证](script-domain-audit/2026-10-28/implementation/README.md) |
| Monorepo 与 CI 完成度 | [工程结构、Turbo 使用、旧 CI 的实际边界及打包输入／环境补漏](monorepo-review/2026-10-27/README.md) |
| 测试必要性收敛 | [用例分层、Turbo 任务选择、CI 与文档义务调整及本机验证](testing-cleanup/2026-10-27/README.md) |
| 新准则全项目复核 | [实现与文档覆盖、环境变量传递和消费者资源清理修正](comprehensive-review/2026-10-26/README.md) · [全面测试必要性复核](comprehensive-review/2026-10-26/testing.md) |
| 临时仓库改名 | [kisaki-w00-ci → kisaki-dev：身份、分支、PR、工作流与旧地址核对](repository/2026-10-26/rename.json) |
| 脚本、依赖与工具能力 | [审查与社区比较](tooling-review/2026-10-26/README.md) · [Vite、依赖边界、脚本与缓存的正式修正及本机回归](tooling-review/2026-10-26/implementation/README.md) |
| 简洁与原生 | [全项目准则、技术与交互复核、Kana 焦点取舍及旧条款修正](simplicity-native/2026-10-26/README.md) |
| CI 事件与检查结果 | [标题／正文编辑保留代码结果，提交与目标分支变化重新验证](ci-events/2026-10-26/README.md) |
| AppImage 条件兼容策略采用 | [本体打包配置、统一入口与真实 Linux 沙箱状态](appimage-policy/2026-10-26/adoption/README.md) |
| AppImage 启动政策比较 | [Ubuntu 24.04 x64：默认降级、精确路径准备、原位更新与移动后的真实沙箱状态](appimage-policy/2026-10-26/README.md) |
| 开发连接完整替换 | [正式加固设置下的探索](development-ipc/2026-10-26/README.md) · [正式合同、W00 实现与本机验证](development-ipc/2026-10-26/implementation/README.md) |
| 必要性与复杂度 | [2026-10-26 全项目设计、实现与测试复核，准则提升及局部简化](proportionality/2026-10-26/README.md) |
| 私有工程包与任务缓存 | [2026-10-26 共享配置、项目任务、缓存隔离与本机完整回归](w00/2026-10-26/monorepo-cache/README.md) |
| 工程导入可读性 | [2026-10-26 工程源码命名入口、包内 imports 作用域与本机回归](w00/2026-10-26/readable-imports/README.md) |
| W00 顺序执行入口 | [2026-10-25 跨命令协调清理、普通任务入口与实际回归](w00/2026-10-25/sequential-workflows/README.md) |
| W00 输出访问修正 | [2026-10-25 按项目与输出读写的系统锁、任务接入和实际回归](w00/2026-10-25/output-access/README.md) |
| W00 工程锁设计 | [2026-10-25 输出归属、缓存恢复与读取交接的审查和隔离复现](w00/2026-10-25/lock-design-review/README.md) |
| W00 终审后局部修正 | [2026-10-25 输入身份与浏览器入口的本机验证，工程锁仍待处理](w00/2026-10-25/corrections/README.md) |
| W00 最终审查 | [2026-10-25 构建身份、异常锁恢复及浏览器入口问题，待修正复核](w00/2026-10-25/final-review/README.md) |
| 通用配置归属 | [2026-10-25 辅助配置迁移、编辑器识别、制品一致性与开发交接](w00/2026-10-25/config-convention/README.md) |
| 弃用 API 与工程配置 | [2026-10-25 类型信息检查、ESLint 配置等效及工具链通知](w00/2026-10-25/deprecations/README.md) |
| 包内模块入口与配置归组 | [2026-10-25 标准 imports、依赖边界及 Windows x64 运行](w00/2026-10-25/package-imports/README.md) |
| W00 六目标远端验证 | [临时私有仓库、跨平台运行与制品](w00/2026-10-24/ci/README.md)，当前工作包状态见[实施状态](../../implementation/status.md#w00) |
| W00 初次工程基线 | [2026-10-24 初次验证](w00/2026-10-24/README.md)，保留当时输入与结果 |
| W00 全覆盖复核 | [代码、目录、资源与回归](w00/2026-10-24/full-audit/README.md)，以及[媒体信息读取实测](media-information/2026-10-24/README.md) |
| 官方来源、迁移格式与译本     | [逐项证据](extensions.md)                                                                              |
| 默认分集补充与辅助资料集 | [身份对应与上游资料核对](metadata-reachability/2026-10-24/README.md) |
| 会话结果声明与存档格式 | [类型消费与 ZIP 编码试件](contract-closure/2026-10-24/README.md) |
| 存档恢复、查询与事务         | [文件中断和 Electron／SQLite 试件](storage-contracts/2026-10-22/README.md)                             |
| 公共值、历史开发帧与 Drizzle RC | [声明和隔离运行检查](public-contracts/2026-10-22/README.md) |
| 日期、界面隔离与开发工具     | [技术对照](technical-tradeoffs/2026-10-22/README.md)                                                   |
| 时钟分段、分部匹配与截图来源 | [规则及原生探针](contract-closure/2026-10-22/README.md)                                                |
| 大集合与扫描报告复制成本     | [容量模型](capacity/README.md)                                                                         |
| 原生工程与平台接口           | [Node-API／工程来源](native-projects/organization-sources.md)、[平台机制](platform-closure/closure.md) |

<a id="vantage"></a>

## Vantage

| 范围                 | 记录                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 值、调用与资源寿命   | [公共值](vantage-api/public-contracts.md)、[完整调用](vantage-calls/verification.md)                                                                       |
| 平台身份、窗口和权限 | [平台接口](vantage-platforms/platform-routes.md)、[接入比较](vantage-platforms/integration-review.md)、[采集边界](vantage-platforms/capture-boundaries.md) |
| Windows 单窗口采集   | [WGC 试件](vantage-wgc/capture.md)                                                                                                                         |
| macOS 与 Linux 接入  | [固定接口及源码核对](platform-closure/closure.md)                                                                                                          |

<a id="kana"></a>

## Kana

| 范围             | 记录                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 公共入口与包消费 | [声明消费](kana-api/public-contracts.md)、[整包接入](kana-package/assembly.md)                                                                                                                     |
| 格式与定位       | [阅读路线](kana/reading-route.md)、[源地址](kana-source/source-addresses.md)、[CFI](kana-cfi/cfi.md)、[源映射](kana-source-mapping/mapping.md)、[格式组合](kana-format-integration/integration.md) |
| XML 与编码       | [XML 入口](kana-xml-entry/entry.md)、[编码与实体](kana-xml-codecs/codecs.md)                                                                                                                       |
| KF8 与图片       | [固定 KF8](kana-kf8-fixed/fixed.md)、[图片顺序](kana-image-order/node-contract.json)                                                                                                               |
| 布局与样式       | [分页比较](kana-pagination-review/review.md)、[断页机制](kana-breaks/breaks.md)、[布局边界](kana-layout-boundaries/boundaries.md)、[样式转换](kana-style-conversion/conversion.md)                 |
| 原文、交互与焦点 | [原文及截图](kana-content/content-and-view.md)、[交互来源](kana-interaction/source-review.md)、[焦点](kana-focus/focus.md)                                                                         |
| 资源与浏览器     | [资源运行](kana-resource-runtime/runtime.md)、[部署接入](kana-resource-transport/transport.md)、[浏览器范围](kana-browser-scope/browser-scope.md)                                                  |

<a id="libmpv-node"></a>

## libmpv-node

| 范围                 | 记录                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 值与调用             | [值表示](libmpv-values/verification.md)、[方案比较](libmpv-values/alternatives.md)、[调用](libmpv-calls/verification.md)、[控制](libmpv-control/verification.md)                                              |
| 订阅、事件与流       | [订阅](libmpv-subscriptions/verification.md)、[事件](libmpv-notifications/verification.md)、[流](libmpv-streams/verification.md)、[属性](libmpv-properties/verification.md)                                   |
| 初始化与运行库       | [初始化](libmpv-initialization/verification.md)、[常驻运行库](libmpv-runtime/runtime.md)、[Node 桥接](libmpv-node-bridge/verification.md)                                                                     |
| 输出、播放与资源寿命 | [输出合同](libmpv-video/verification.md)、[GPU](libmpv-gpu/verification.md)、[软件输出](libmpv-output/verification.md)、[播放](libmpv-playback/verification.md)、[跨进程交接](libmpv-handoff/verification.md) |
| SDR 颜色与截图       | [颜色对照](libmpv-sdr-integration/sdr.md)、[截图布局](libmpv-screenshot/screenshot.md)、[逐结果来源补丁](contract-closure/2026-10-22/README.md#screenshot)                                                    |
| 黑色字幕回归         | [同源修复对照](libmpv-upstream-fix/verification.md)及其原始夹具                                                                                                                                               |
| 构建、依赖与包消费   | [候选装配](libmpv-package/package.md)、[固定平台接口](libmpv-platforms/verification.md)                                                                                                                       |

<a id="oauth-relay"></a>

## oauth-relay

| 范围           | 记录                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| 协议与配置     | [HTTP 和配置试件](oauth-relay-protocol/protocol.md)                    |
| 上游授权绑定   | [Bangumi／AniList 实测](oauth-relay-provider/providers.md)             |
| HTTPS 传输     | [重定向、重发、响应计限与取消](oauth-relay-integration/integration.md) |
| 构建与停止     | [Compose、镜像清单及 Node 收尾](oauth-relay-delivery/delivery.md)      |
| 协议与工程来源 | [官方接口核对](oauth-relay/organization-sources.md)                    |
