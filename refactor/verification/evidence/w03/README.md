# W03 桌面合同与本地化验证

2026-11-04，在 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、tsdown 0.23.0、Vite 8.3.3 与 Playwright 1.64.1 下验证两个 0.1.0-dev.0 包及归回应用的既有规则。当前交付状态见[实施状态](../../../implementation/status.md#progress)。

## 交付边界与本机结果

| 范围                 | 实际验证                                                                                                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| desktop-contracts    | 31 个公共子路径交付接口、输入输出、编辑基线、事件、错误、参与与资源合同，以及对应值约束和规范编码。类型与校验按业务主题组织；图写入共用完整创建索引，来源响应与合成候选共用图一致性校验。构建声明不暴露 Valibot 内部构造类型。                                             |
| desktop-localization | 英语源文按领域维护，生成关联消息键与参数类型。登记校验与格式化使用同一基准；未知叶子保留，已知非法消息整份拒绝。空译文仍是有效值，缺词使用英语及其复数规则；译文省参后仍核对完整源调用。标签和插入文本保持字面值。                                                         |
| 应用拥有的规则       | 产品默认值、预设、名称排序、匹配与选择、扫描线索、偏好读取恢复等既有实现和测试保留在所属 main 功能。模板名称使用传入的译者，采用后的草稿名称保持独立。损坏的执行与身份定义继续暴露不可用状态，普通字段按自身规则恢复。                                                     |
| Unicode              | 应用的原始 Unicode 18 数据按字节保留并校验摘要；生成表一致，完整官方 NormalizationTest 向量通过。名称顺序覆盖兼容规范化、完整 case folding、长数字与前导零，规范身份编码继续使用独立的标量顺序。Unicode NOTICE 随应用维护。                                                |
| 值与操作语义         | 日期精度、七类条目与五类分部、查询适用性、混合投影、区间与定位、固定选择、图内身份及跨区域矛盾继续验证。历史事实、等价完成意图、真实区间统计、元数据缺席／空值、合法部分结果、备份规范编码及资源释放合同保持原有含义。                                                     |
| 运行环境与制品       | 两个包分别通过 build、pack、publint 与 ATTW 的 ESM 检查。独立 NodeNext 消费者仅使用 Node 类型，独立 Bundler 消费者仅使用浏览器类型，均开启 skipLibCheck: false，并完成类型感知 lint。Node、Chromium 主文档及独立 iframe 实际消费各包 tarball，公共依赖也来自真实 tarball。 |
| 依赖与工程入口       | 合同包不导入消息资源；本地化不导入应用、Node 或 UI 运行环境。纯单测随主题放置，消费者与样板独立维护。源码、构建排除、类型覆盖与任务输入一致；产品纯规则或 Unicode 数据变化不触发未消费它们的工程桌面载体。                                                                 |

全仓 `pnpm check` 通过类型、lint、格式、依赖边界及 148 项常规测试，其中合同包 43 项、本地化包 7 项、应用 37 项。`pnpm desktop:test:consumers` 通过四个公共包的 13 项仓库外检查；W03 两个包分别通过三项 Node／浏览器／iframe 消费检查。

两个包的制品分别位于各自的 `out/package/package.tgz`，消费者报告位于各自的 `test-results/consumers/results.json`。临时消费者、浏览器与服务在验证结束后清理；不提交重复制品或临时副本。

A03、A04、A23、A31 在 W03 的接口、值规则与纯格式化范围取得证据。实际数据库 codec 接入、语言登记与响应式状态、窗口和 SDK 接入由对应工作包验证；这些纯包与应用规则测试不替代真实存储、跨进程和界面验收。

## 远端验证

本轮改写的远端门禁由 [PR #24 检查页](https://github.com/ximu3/kisaki-dev/pull/24/checks)按实际提交记录。

[初版 W03 的 CI](https://github.com/ximu3/kisaki-dev/actions/runs/41638829659)针对 `23c372ae84b58d0bbe21dc2b3beb6a22e5d96cc1` 取得仓库检查及六目标工程验证。该结果保留初版的验证范围，不替代本轮包边界与源码组织的复核，也不代表后续业务或 SDK 接入已经完成。

## 依据与审阅

- [Valibot](https://valibot.dev/api/strictObject/) 1.5.0 实现严格对象与 exactOptional 校验；复杂公共值显式声明类型，schema 留在拥有者内部。数据库 codec 将显式消费同一值规则，不能自动从 TypeScript 接口取得运行校验。
- 固定数据来自 [Unicode 18 UCD](https://www.unicode.org/Public/18.0.0/ucd/)。应用的 inputs.json 保留来源与摘要，Unicode License V3 和原始数据一同保留。
- [FormatJS parser](https://formatjs.github.io/docs/icu-messageformat-parser/) 3.5.22 与 [intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/) 12.1.4 统一使用 ignoreTag: true。格式化快照没有全局语言状态；相同语言的不同译本不共用消息缓存，修改原始目录不会改变已创建的快照。
- 严格 JSON 使用 [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) 3.3.1，正则语法使用 [regexpp](https://github.com/eslint-community/regexpp) 4.12.2。实际消费者仍负责把用户规则执行放入可终止的有界单元。
- pnpm 11 的未公开依赖替换配置写入临时消费者的 [pnpm-workspace.yaml](https://pnpm.io/11.x/configuring)，不改写被测 tarball 或关闭声明检查。

人工复核覆盖公开导出与值约束、业务实现归属、正常／失败／取消与清理合同、单文件与多文件主题的实际组织、类型与校验的维护关系，以及测试、生成数据、许可和制品的一致性。构建、打包及测试没有触发外部发行。
