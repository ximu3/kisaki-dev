# 验证证据

本目录保存现行设计与验收所用的来源、技术比较、试件和实测结果，说明结论依赖的输入与适用范围。材料按[实际用途](../../design/engineering/documentation.md#evidence)维护，产品规则由[设计](../../design/README.md)定义，正式实现与验收进度见[实施状态](../../implementation/status.md)。

正式验收结果记录候选版本、宿主、入口及已验证行为。独立项目和扩展正式交付后，运行用例与可再生成输入由其维护工程保管，这里保留本体接入证据与必要链接。

研究记录用来回答选型、来源语义和故障条件。复现历史试验时，按当次记录准备版本和输入，在独立副本运行随附脚本。脚本可能向自身目录写入结果，另一次运行须注明实际环境与适用范围。

## 本体与公共边界

| 范围                     | 记录                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| W00 工程与验收           | [工程载体的本机与平台验证](w00/README.md)                                                               |
| W01 视觉包               | [公开值、样式与独立消费者验证](w01/README.md)                                                           |
| W02 分发协议包           | [格式、兼容选版、签名与独立消费者验证](w02/README.md)                                                   |
| W03 桌面合同与本地化     | [接口、消息格式化与两个包的独立消费](w03/README.md) · [宿主 HTTP 与快捷键的 Electron 对照](w03/README.md#electron-host) |
| W04 通信机制             | [有限帧、连接寿命和两种真实通道的制品消费](w04/README.md)                                               |
| W05 公共 UI | [完整组件、样式与浏览器／Electron 制品消费](w05/README.md) |
| W06 存储与原生基础 | [正式 schema、迁移、文件资源和完整负载查询](w06/README.md) |
| W07 应用运行与设置 | [窗口操作、任务、网络、资源和打包候选](w07/README.md) |
| W05 与 W07 合同核查 | [同类入口、故障分支、错误界面与制品验证](w05-w07/README.md) |
| 原生 UI 能力             | [固定 Electron 环境的表单与浮层行为](native-ui/README.md)                                               |
| UI 包接入                | [CSS Modules、表单提交与模态提示范围](desktop-ui/README.md)                                             |
| 构建与开发               | [编译、输出与开发编排](w00/README.md#engineering-workflows) · [开发会话的失败与关闭](w00/development.md#shutdown) |
| AppImage 启动            | [采用配置与实际进程隔离](appimage-policy/2026-10-26/README.md)                                          |
| 开发连接                 | [Node 传输与实际退出](development-ipc/2026-10-26/README.md)                                             |
| 官方来源、迁移格式与译本 | [逐项证据](extensions.md)                                                                               |
| 导入图片                 | [calibre 与 Playnite 的解码正负对照](importer-images/README.md)                                          |
| 媒体信息                 | [读取范围与实测](media-information/2026-10-24/README.md)                                                |
| 存档格式与内容树摘要       | [ZIP 成员、清单与确定编码](contract-closure/2026-10-24/README.md)                                            |
| 存档恢复、查询与事务     | [文件中断和 Electron／SQLite 试件](storage-contracts/2026-10-22/README.md)                              |
| Drizzle RC               | [编码、迁移和隔离运行](public-contracts/2026-10-22/README.md)                                           |
| 日期、虚拟化与界面隔离   | [技术验证](technical-tradeoffs/2026-10-22/README.md)                                                    |
| 时钟、分部匹配与截图     | [规则及原生探针](contract-closure/2026-10-22/README.md)                                                 |
| 大集合与扫描报告         | [容量模型](capacity/README.md)                                                                          |
| 原生工程与平台接口       | [Node-API／工程来源](native-projects/organization-sources.md) · [平台机制](platform-closure/closure.md) |

## 已接续的历史试件

| 历史记录 | 当前查阅与验证入口 |
| --- | --- |
| [TMDB 早期个人记录](tmdb/2026-10-16-personal-records.json) | 保留逐请求结果及旧的 `confirmedRules`；评分与待看按[后续本人核验](tmdb/account-api.md)及对应现行合同。 |
| [Mihon 初次合成检查](mihon-importer/synthetic-results.json) | 保留 97 项结果；更新的[字段投影检查](mihon-importer/projection-results.json)补上切实检出漏字段的断言。 |
| [Kana 视图读取原型](kana-content/content-and-view.md) | 保留几何、Electron 取像与布局冻结依据。[正式场景](../scenarios/reading.md#navigation)另要求验证视图冲突、取消和关闭。 |
| [Windows／NTFS 恢复探针](storage-contracts/2026-10-22/README.md) | 保留 ready 后的中断结果。准备登记到清单发布之间的中断仍待按[正式场景](../scenarios/sessions.md#recovery)验证。 |
| [媒体信息快照清单](media-information/2026-10-24/files.json) | 按[原运行](media-information/2026-10-24/README.md)的版本和摘要理解；部分输入依赖候选或独立归档。 |

<a id="test-retention-review"></a>

## 自动用例保留复核

2026-11-18 盘点当前工作区的 96 个 TypeScript 测试文件，覆盖根工程、工具包、六个公共包和桌面应用。依据[长期用例的取舍](../../design/engineering/conventions.md#test-retention)，按实际调用和宿主核对可观察行为。代理、存储、IPC 的状态和失败结果由所属层验证，独立消费保留最终声明、资源和真实宿主断言。

取消应用流程中的控件像素检查、独立样板中的纯取像用例，以及主题词表在消费样板中重复的计数。将受控选择与受控浮层的必要断言并入已有浏览器流程，动态页签与首错定位的独立模拟夹具由本次复现取证。保留原生拖动、键盘重排、拒绝提交以及隐藏项顺序的用例，分别验证实际移动与业务采用。[公共控件验证](w05/README.md#choice-and-staged-fields) · [偏好在正式窗口的复核](w07/README.md#field-presentation-and-proxy)

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

正式工程的配对制品、对应源码和各平台实测结果见 [W08 联调制品](w08/README.md#handoff)。下表记录各专题的设计依据。

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
