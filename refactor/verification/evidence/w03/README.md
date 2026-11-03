# W03 desktop-contracts 验证

2026-11-03，在 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、TypeScript 6.0.3、tsdown 0.23.0、Vite 8.3.3 与 Playwright 1.64.1 下验证 0.1.0-dev.0 的纯合同、生成物、制品和独立消费。当前交付状态见[实施状态](../../../implementation/status.md#progress)。

## 合同与本机结果

| 范围 | 实际断言 |
| --- | --- |
| 值、查询与编辑 | 公历和部分日期保留真实精度；七类条目、五类分部、四类关系及适用字段闭合。未知字段、相矛盾的条件和错误编辑基线拒绝；混合查询投影不伪造不适用字段。列表、定位、分组和固定选择保留各自数量与身份语义。 |
| 身份、记录与资料图 | 请求内 key、实际端点、种类与已知归属统一核对；冲突的关系增删拒绝。历史完成补录保留逐条事实，“记录本次完成”才合并等价意图；活动统计按真实区间分配。重排保留未选槽位，移动不丢弃失效目标。 |
| 资料获取与采用 | 来源回答和合成候选分别校验；缺席、完整空值、零和 false 保持区别。方案、提供者、处理器和识别器复用有限字段目录；请求不能悄悄缩小到支持子集，关系替换范围保留未回答的旧事实。 |
| 文件、资源与备份 | 完整匹配、命名捕获、模板缺席、精确编号及扫描预设通过。资源输入保留头与重定向策略，准备句柄保持实际释放方法。几何与字体值拒绝不成立的组合；备份树编码与独立 Node SHA-256 结果一致，损坏格式与不支持版本分别分类。 |
| 会话、任务与管理 | 文件切换、播放设置和引导的合法部分结果保持完整。开始／结束事件只保留实际上下文；未保存记录、任务终态、扩展安装／采用／激活、仓库信任、应用版本选择分别表达。引导的同库原子结果与跨安装已成立成果不混淆。 |
| 调用交互选项 | 取消上下文使用 ExecutionContext；仅四类 open 与游戏 focus／captureImage 接受 interaction，缺省为 fail；深链输入不接纳该选项。选项仅决定必要选择时是否询问用户，系统授权独立处理，见[通信合同](../../../design/communication.md#operations)。本包验证类型与解析，实际目标选择、原生入口选项及授权流程由所属本体工作包验证。 |
| Unicode 与消息 | Unicode 18 NFC／NFKC 通过完整官方 NormalizationTest 向量；名称顺序覆盖兼容规范化、完整 case folding、长数字与前导零。英语 ICU 源文生成关联 key／参数类型，译文可缺词或省参，不能增加参数或收窄合法调用；标签按字面文本处理。 |
| 仓库外消费 | 三项消费者检查通过。独立 NodeNext 工程只使用 Node 类型，独立 Bundler 工程只使用浏览器类型；两者开启 skipLibCheck: false，并检查合法与非法类型组合、类型感知 lint。Node、Chromium 主文档及独立 iframe 实际消费纯规则和 ICU 格式化。 |
| 制品 | build、pack、publint 与 ATTW 的 ESM 检查通过。32 个公共子路径交付 ESM 与显式声明，附 MIT 许可、Unicode NOTICE 和英语发行说明。W01、W02 依赖使用各自真实 tarball；声明不暴露校验库内部类型，运行源码不导入 Node、Electron、Solid 或应用私有实现。 |

本包 63 项常规行为测试通过。全仓 `pnpm check` 通过类型、lint、格式、导入边界及 130 项常规测试，三个公共包的 10 项仓库外消费者检查通过。远端结果见下节；这里的 Node／浏览器和 iframe 消费验证纯合同，不代表 W07／W18 的真实窗口或扩展 Webview 接入已经完成。A03、A04、A23、A31 按 W03 的合同责任取得证据，实际存储读回、进程、资源、运行端点及安装行为继续由对应工作包验证。

制品位于 `clients/desktop/packages/desktop-contracts/out/package/package.tgz`，消费者报告位于该包 `test-results/consumers/results.json`。消费者各自安装并清理临时工程、浏览器与服务；不提交重复制品或临时副本。构建先检查生成一致性，准备失败保留既有输出。当前没有 npm 发布或实际应用发行。

## CI 结果

[PR #21 的首轮 CI](https://github.com/ximu3/kisaki-dev/actions/runs/41638829659)针对实现提交 `23c372ae84b58d0bbe21dc2b3beb6a22e5d96cc1` 完成仓库检查、Windows／macOS／Linux 的 x64 与 arm64 六目标工程验证，以及 Required checks。独立 PR title 检查同时通过。

Linux x64 的公共包消费步骤验证三个包的实际 tarball，其中 W03 的 NodeNext 声明与运行、浏览器声明及 Chromium／iframe 消费共三项检查通过。六目标结果覆盖本次选中的桌面工程构建、原生、Electron、开发与制品回归；它们不替代后续本体业务和 SDK 的实际接入验收。各次输入与最终门禁由 [PR 检查页](https://github.com/ximu3/kisaki-dev/pull/21/checks)记录。

## 实现依据与审阅

- 业务类型显式声明，解析使用 [Valibot](https://valibot.dev/api/strictObject/) 1.5.0 的严格对象与 exactOptional；合法字典键独立保留，不使用宽松对象解析删除未知输入。正常业务结果与安全失败沿各自拥有者解析。
- 固定数据来自 [Unicode 18 UCD](https://www.unicode.org/Public/18.0.0/ucd/)。包内 inputs.json 保存来源和摘要，生成表使用同一数据；原文按字节保留，Unicode License V3 随生成数据分发。
- ICU 使用 [FormatJS parser](https://formatjs.github.io/docs/icu-messageformat-parser/) 3.5.22 解析，独立消费者使用 [intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/) 12.1.4。类型生成与运行作者校验从同一英语目录取得约束，统一 ignoreTag: true。
- 严格 JSON 使用 [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) 3.3.1 的 visitor 检查重复解码键和非法数值。正则语法使用 [regexpp](https://github.com/eslint-community/regexpp) 4.12.2；用户规则的编译、匹配与展开须由实际消费者放入可终止的有界执行单元，纯函数不伪造隔离或超时。
- 公开制品依赖、包格式及安装检查沿已有工程入口。pnpm 11 的依赖替换放入临时消费者的 [pnpm-workspace.yaml](https://pnpm.io/11.x/configuring)，不会改写被测 tarball 或跳过声明检查。

人工审阅核对公开导出与内部校验边界、字段缺席与 null、真实身份与投影、原始来源与采用值、正常及部分结果、取消和释放说明，以及生成物与实际输入的一致性。执行接口在此交付值与完成合同，实际操作由所属业务模块实现；消费者没有通过占位宿主制造运行成功。
