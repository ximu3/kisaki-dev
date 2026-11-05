# 验证证据

本目录保存现行设计与验收所用的来源、技术比较、试件和实测结果，说明结论依赖的输入与适用范围。材料按[实际用途](../../design/engineering/documentation.md#evidence)维护，产品规则由[设计](../../design/README.md)定义，正式实现与验收进度见[实施状态](../../implementation/status.md)。

## 本体与公共边界

| 范围                     | 记录                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| W00 工程与验收           | [工程载体的本机与平台验证](w00/README.md)                                                               |
| W01 视觉包               | [公开值、样式与独立消费者验证](w01/README.md)                                                           |
| W02 分发协议包           | [格式、兼容选版、签名与独立消费者验证](w02/README.md)                                                   |
| W03 桌面合同与本地化     | [接口、值约束、消息格式化与两个包的独立消费](w03/README.md)                                             |
| W04 通信机制             | [有限帧、连接寿命和两种真实通道的制品消费](w04/README.md)                                               |
| 原生 UI 能力             | [固定 Electron 环境的表单与浮层行为](native-ui/README.md)                                               |
| 构建与开发               | [Node 构建与解析](w00/build-tools.md) · [输入监听与隔离副本](w00/development.md)                        |
| 声明检查                 | [声明检查分工](w00/declaration-checks.md)                                                               |
| AppImage 启动            | [采用配置与实际进程隔离](appimage-policy/2026-10-26/README.md)                                          |
| 开发连接                 | [Node 传输与实际退出](development-ipc/2026-10-26/README.md)                                             |
| 官方来源、迁移格式与译本 | [逐项证据](extensions.md)                                                                               |
| 媒体信息                 | [读取范围与实测](media-information/2026-10-24/README.md)                                                |
| 存档格式与内容树摘要       | [ZIP 成员、清单与确定编码](contract-closure/2026-10-24/README.md)                                            |
| 存档恢复、查询与事务     | [文件中断和 Electron／SQLite 试件](storage-contracts/2026-10-22/README.md)                              |
| Drizzle RC               | [编码、迁移和隔离运行](public-contracts/2026-10-22/README.md)                                           |
| 日期、虚拟化与界面隔离   | [技术验证](technical-tradeoffs/2026-10-22/README.md)                                                    |
| 时钟、分部匹配与截图     | [规则及原生探针](contract-closure/2026-10-22/README.md)                                                 |
| 大集合与扫描报告         | [容量模型](capacity/README.md)                                                                          |
| 原生工程与平台接口       | [Node-API／工程来源](native-projects/organization-sources.md) · [平台机制](platform-closure/closure.md) |

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

浏览器范围、格式、图片排序与资源传输的原始输入可按运行记录中的 SHA-256 从[试件归档](https://github.com/ximu3/kisaki-dev/tree/66d39a78e19945bde223223769dd42741bb45cb1/refactor/verification/evidence)取得。

| 范围             | 记录                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 公共入口与包消费 | [声明消费](kana-api/public-contracts.md)、[整包接入](kana-package/assembly.md)                                                                                                                     |
| 格式与定位       | [阅读路线](kana/reading-route.md)、[源地址](kana-source/source-addresses.md)、[CFI](kana-cfi/cfi.md)、[源映射](kana-source-mapping/mapping.md)、[格式组合](kana-format-integration/integration.md) |
| XML 与编码       | [XML 入口](kana-xml-entry/entry.md)、[编码与实体](kana-xml-codecs/codecs.md)                                                                                                                       |
| KF8 与图片       | [固定 KF8](kana-kf8-fixed/fixed.md)、[图片顺序](kana-image-order/node-contract.json)                                                                                                               |
| 布局与样式       | [原生分页](kana-browser-scope/browser-scope.md)、[布局边界](kana-layout-boundaries/boundaries.md)、[样式转换](kana-style-conversion/conversion.md)                                                 |
| 原文、交互与焦点 | [原文及截图](kana-content/content-and-view.md)、[交互来源](kana-interaction/source-review.md)、[焦点](kana-focus/focus.md)                                                                         |
| 资源与浏览器     | [资源运行](kana-resource-runtime/runtime.md)、[部署接入](kana-resource-transport/transport.md)、[浏览器范围](kana-browser-scope/browser-scope.md)                                                  |

<a id="libmpv-node"></a>

## libmpv-node

| 范围                 | 记录                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 值与调用             | [值表示](libmpv-explicit-values/verification.md)、[消息传递](libmpv-value-options/verification.md)、[调用](libmpv-calls/verification.md)、[控制](libmpv-control/verification.md) |
| 订阅、事件与流       | [订阅](libmpv-subscriptions/verification.md)、[事件](libmpv-notifications/verification.md)、[流](libmpv-streams/verification.md)、[属性](libmpv-properties/verification.md)                                                   |
| 初始化与运行库       | [初始化](libmpv-initialization/verification.md)、[常驻运行库](libmpv-runtime/runtime.md)、[Node 桥接](libmpv-node-bridge/verification.md)                                                                                     |
| 输出、播放与资源寿命 | [输出合同](libmpv-video/verification.md)、[GPU](libmpv-gpu/verification.md)、[软件输出](libmpv-output/verification.md)、[播放](libmpv-playback/verification.md)、[跨进程交接](libmpv-handoff/verification.md)                 |
| SDR 颜色与截图       | [颜色对照](libmpv-sdr-integration/sdr.md)、[截图布局](libmpv-screenshot/screenshot.md)、[逐结果来源补丁](contract-closure/2026-10-22/README.md#screenshot)                                                                    |
| 黑色字幕回归         | [同源修复对照](libmpv-upstream-fix/verification.md)及[固定输入](libmpv-composition/README.md)                                                                                                                                 |
| 构建、依赖与包消费   | [候选装配](libmpv-package/package.md)、[固定平台接口](libmpv-platforms/verification.md)                                                                                                                                       |

<a id="oauth-relay"></a>

## oauth-relay

| 范围           | 记录                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| 协议与配置     | [HTTP 和配置试件](oauth-relay-protocol/protocol.md)                    |
| 上游授权绑定   | [Bangumi／AniList 实测](oauth-relay-provider/providers.md)             |
| HTTP 传输机制  | [重定向、重发、响应计限与取消](oauth-relay-integration/integration.md) |
| 构建与停止     | [Compose、镜像清单及 Node 收尾](oauth-relay-delivery/delivery.md)      |
| 协议与工程来源 | [官方接口核对](oauth-relay/organization-sources.md)                    |
