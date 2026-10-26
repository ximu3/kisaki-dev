# 验证证据

本目录保存现行设计所用的来源、技术比较、试件和实测结果。每份记录说明输入、版本、环境、复现方式及未覆盖范围。产品规则由[设计](../../design/README.md)定义，正式实现与验收进度见[实施状态](../../implementation/status.md)。

## 本体与公共边界

| 范围                         | 记录                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
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
| 公共值、开发帧与 Drizzle RC  | [声明和隔离运行检查](public-contracts/2026-10-22/README.md)                                            |
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
