# W03 桌面合同与本地化验证

2026-11-05，在 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、tsdown 0.23.0、Vite 8.3.3 与 Playwright 1.64.1 下验证两个 0.1.0-dev.0 公共包。工作包进度见[实施状态](../../../implementation/status.md#progress)。

## 交付与验证范围

| 对象                 | 验证内容                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| desktop-contracts    | 31 个公共子路径交付接口、输入输出、编辑基线、事件、错误、参与与资源合同，以及对应值约束和规范编码。类型与校验按业务主题组织；图写入共用完整创建索引，来源响应与合成候选共用图一致性校验。                                                                                                                    |
| desktop-localization | 领域英语生成关联消息键与参数类型。已知消息的 ICU 语法、参数或数字格式无效时整份拒绝，未知叶子保留；空译文仍是有效值，缺词使用英语及其复数规则。译文省参后仍核对完整源调用，标签和插入文本保持字面值。不同译本快照不共用消息缓存。                                                                            |
| 公开值               | 日期精度、条目与分部适用性、混合投影、区间与定位、固定选择、编辑基线、图内身份及跨区域矛盾、来源完整性、合法部分结果、资源句柄合同和备份规范编码分别核对。CFI 保留精确十进制令牌，核对 XML 允许字符与空间范围；外观值失败统一为 InvalidInput，保留底层原因。业务计算、默认配置与恢复操作留给所属本体工作包。 |
| 制品与消费           | 两个包分别构建和打包，通过 publint 与 ATTW 的 ESM 检查。NodeNext 与 Bundler 消费者分别使用 Node 和浏览器类型，从已安装合同包的 exports 导入全部 31 个子路径，均启用完整声明检查及类型感知 lint。Node 的一次编译完成声明检查与运行准备。Node、Chromium 主文档和独立 iframe 分别消费实际 tarball。             |
| 工程边界             | 合同包不读取具体消息资源；本地化不导入应用、Node 或 UI 运行环境。四个公共包的纯单测随被测主题维护，消费者与样板独立组织；源码、类型覆盖、构建排除和任务输入一致。UI 合同按视图、页面、菜单、反馈及图标组织，整体 api 与公开 index 分工明确，41 项 UI 公开导出保持一致。                                      |

## 验证入口与结果

`pnpm check` 通过类型、lint、格式、依赖边界和 139 项常规测试，其中合同包 63 项、本地化包 6 项。`pnpm desktop:test:consumers` 通过四个公共包的 13 项仓库外检查；W03 的两个包各通过三项 Node／浏览器／iframe 消费检查。

两个包的制品分别位于各自的 `out/package/package.tgz`，消费者报告位于各自的 `test-results/consumers/results.json`。临时消费者、浏览器和服务随验证结束清理，不另存源码参考副本。

A03、A04、A23、A31 的证据限于 W03 的接口、值校验、规范编码与纯格式化。数据库 codec、业务操作、语言登记、响应式状态、窗口及 SDK 接入分别随所属工作包验证。

工作包交付与新规范复核的远端结果分别见 [PR #24 检查页](https://github.com/ximu3/kisaki-dev/pull/24/checks)和 [PR #25 检查页](https://github.com/ximu3/kisaki-dev/pull/25/checks)。

## 实现依据

- [Valibot](https://valibot.dev/api/strictObject/) 1.5.0 实现严格对象与 exactOptional 校验；复杂公共值显式声明类型，schema 留在拥有者内部。数据库 codec 将显式消费所属值规则。
- [FormatJS parser](https://formatjs.github.io/docs/icu-messageformat-parser/) 3.5.22 与 [intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/) 12.1.4 统一使用 ignoreTag: true。类型生成、作者校验和英语回退使用同一源文，格式化快照不持有应用语言状态。
- [EPUB CFI 1.1](https://w3c.github.io/epub-specs/epub33/epubcfi/) 的数值与 XML 字符规则由纯语法校验落实；回归保留合法空白和补充平面文字，并拒绝禁止字符，源文档边界仍由实际阅读器解析。
- 严格 JSON 使用 [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) 3.3.1，正则语法校验使用 [regexpp](https://github.com/eslint-community/regexpp) 4.12.2。用户规则执行及其有界运行单元由实际消费者实现。
- pnpm 11 的未公开依赖替换写入临时消费者的 [pnpm-workspace.yaml](https://pnpm.io/11.x/configuring)，不改写被测 tarball 或关闭声明检查。

人工复核覆盖公开导出、值约束、正常／失败／取消与清理合同、源码与测试组织，以及声明、制品和工作包范围的一致性。W03 不建立本体业务实现，也不交付其预设、派生索引或恢复逻辑。
