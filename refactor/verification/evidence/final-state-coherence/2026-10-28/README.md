# 终态实现与整体一致性审查

基线为 `ad9113d0c9eb0d83ee32e876a2aa8cab35fdbffe`，审查覆盖全部 684 份当前维护输入：220 篇文档、413 份代码与配置、51 份许可、资源、锁文件及其他正式输入。逐文件归属、检查方式、结果和集成后摘要见 [coverage.json](coverage.json)。历史证据的 3,826 份文件按原有版本和范围保留，本轮不把它们计为重新执行的来源、平台或产品验收。

## 核心规范与覆盖

终态实现与整体一致性进入 AGENTS、根规范、产品与设计入口、工作包和验收门槛，唯一完整定义位于[工程准则](../../../../design/engineering/conventions.md#final-state)。五类问题按职责与行为判断；运行中的临时资源、业务阶段、真实失败、权限和来源差异仍保留其正式语义。

| 审查范围 | 覆盖与结论 |
| --- | --- |
| 领域与 UI | [53 篇文档](domain-ui-review.md)；修正资料图与写入图、首选存储、设置与菜单、主题比较单位和反馈归属。 |
| 工程与共有架构 | [12 篇工程主题及架构、通信](engineering-review.md)；修正文件会话与播放器执行者寿命、截图与显示帧资源、目录和工具拥有层。 |
| 官方扩展 | [42 篇设计及 33 项工程](extensions-review.md)；统一配置说明，修正来源合同摘要和三个语言扩展产品 ID。 |
| 独立项目 | [30 篇文档与 5 份正式输入](projects-review.md)；核对公开边界、平台与资源寿命，并修正固定源码摘要。 |
| 公共包及实际消费者 | [123 个文件](public-packages-review.md)；公开入口与依赖方向成立，说明直接表达已提供能力。 |
| 桌面运行及相关测试 | [63 个文件](desktop-runtime-review.md)；清理当前能力说明，修正数据库测试获取失败时的资源清理。 |
| 实施与专项验收 | [16 篇文档](verification-review.md)；保留完整 R／W／A 覆盖，调整两处内容归属。 |
| 主审 | 根文档、工程准则、验收主页、当前证据索引、私有工程包、本体工具与配置、根工具与测试、CI、资源与锁文件。 |

各范围有交叉引用，不以分项数量相加作为总数。普通源码与合同逐项阅读，同构扩展配置逐项核对身份和差异；锁文件、生成声明和资源通过来源、生成或实际消费检查。图标与指定旧资源字节一致，43 份许可证分别符合八包 MIT 与其余 AGPL 归属。仅供开发监听使用的公共包输入选择已归回 dev，删除失去共享用途的工具模块。

通用说明中的具体实施轮次、原型经过和后续排期已归到状态与证据。状态页改为当前结论、仍缺证据的事项与证据入口，消除不同日期的“当前待修正”“尚未推送”等历史段落对当前状态的干扰。历史记录本身没有重写。

## 用户确认的四项取舍

1. preferences.playback 保存独立的应用级音量与静音记忆，初始为 100% 和未静音，音量范围为 0–100 的有限数。保存、当前实例采用、新文件恢复与完整播放配置的边界已同步到领域、UI、工程和验收合同；正式播放器尚未实现。
2. 九项扫描预设统一拒绝 CR、LF、U+2028 和 U+2029，自定义表达式按自身含义解释。直接读取文档表达式的探针验证正常样例和四类字符的全部插入位置，见[修订前](scanner-line-separator-probe.before.json)与[修订后](scanner-line-separator-probe.json)。该结果不代替扫描、Worker 或 UI 集成验收。
3. 有限构建的输入身份由 Turbo 正式任务定义拥有，采用下面的工程方案。
4. oauth-relay 最终仓库统一公开，部署凭据仍由运行环境独立管理；本轮只更新合同，没有创建仓库或切换服务。

## 构建输入与运行字节

修订前的[隔离探针](input-identity-probe.json)确认：资源 README、私有工程 README、开发工具及打包配置会改变自有输入摘要，却不改变有限 build 任务；`.node-version` 和 `.npmrc` 改变 Turbo 任务输入，却不改变自有摘要。两份输入定义不能继续各自维护为同一个事实。

采用锁定 Turbo 2.11.10 的公开 `--dry=json` 输出，以 `@kisaki3/desktop#build.hash` 作为不透明输入身份。正式任务定义负责文件、依赖和声明的环境变量；应用继续以文件集合和逐文件 SHA-256 校验实际运行字节。查询失败如实交付，所有调用传入所属取消信号。package 任务显式传递 TSDOWN_*，保持严格环境中的构建输入；不以继承父任务环境作为假设。

开发会话仍拥有监听与完整代际交接。监听排除文档、测试、生成输出与本地状态，观察生产源码和配置的新增、修改与移除；工具自身和锁定工具链修改后按既有开发合同重新启动。有限构建、开发控制器与打包各自的职责清楚，打包配置变化不再使同一运行构建失效。

选择依据为 [Turbo 公开任务计划](https://turborepo.dev/docs/reference/run#--dry--dry-run)、[任务输入配置](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)及[全局与任务摘要的拥有关系](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/crafting-your-repository/caching.mdx)。社区对[实际 Node 运行版本与缓存身份](https://github.com/vercel/turborepo/discussions/13376)的讨论提示不能把任务摘要当作所有环境事实；本工程继续固定 Node 声明、区分目标与实际宿主并验证运行制品。与保留自有摘要相比，此方案消除重复输入遍历，但接受当前 Turbo 根依赖全局摘要的实际语义：私有工程的部分验证配置仍会影响全局摘要，局部 inputs 不能重写它。上述边界已用当前锁定版本验证，没有采用尚未启用的新配置模式。

## 其他确定修正

- 三个语言工程的 kisaki.id 改为正式合同中的 `kisaki.language.zh-hans`、`kisaki.language.zh-hant`、`kisaki.language.ja`。当前工程没有已发布制品或持久消费者需要兼容别名。
- libmpv 截图来源修改的 afterSha256 改为原始 Git blob 按 LF 精确套用后的值，准备合同明确保留原始字节。两项修改的文件摘要、前后源码与 `git apply` 均通过，见[修正前](projects-patch-integrity-before.json)与[修正后](projects-patch-integrity.json)；历史 CRLF 运行记录保留原值。两项修改都在共同拥有层解决真实计算或来源交付问题，因此继续保留。
- SQLite ABI 用例把首次打开也纳入临时目录的释放范围。初次全仓检查发现可变句柄在延后回调中无法收窄，已将事务构造留在已取得句柄的范围，复验通过。
- 最终制品按不透明 buildId 消费，并恢复对 package.json 的字节校验。锁定 electron-builder 的共同转换实现与本机实际制品表明，本工程生成的该文件保持原字节；不再为它保留无依据的摘要例外。

## 验证

本机为 Windows 10 22H2 x64，Node 24.11.1、pnpm 11.11.0、Electron 45.0.0。详细命令、范围与结果见 [validation.json](validation.json)。

| 检查 | 结果 |
| --- | --- |
| `pnpm check` | 类型、lint、格式与 52 项常规测试通过；包含真实 Turbo 输入图、全局与环境变化、监听排除及实际生产变化。 |
| `pnpm desktop:build --target windows-x64` | 有限构建通过，固定字体与资源完成实际校验；buildId 为 `72105d1104139d36`。 |
| `pnpm desktop:test:dev` | 4 项真实开发回归通过，覆盖退出取消、编译失败与恢复、公共包与页面交接、准备取消与重试。 |
| `pnpm --filter @kisaki3/desktop test:native` | 6 项通过、1 项明确跳过；本次临时根位于同一文件系统，未取得新的跨文件系统结果。 |
| 已准备构建的 Windows 打包 | ZIP、NSIS 及配套元数据生成成功，消费同一 buildId；本轮未执行 NSIS 安装。 |
| `pnpm desktop:test:artifacts` | 原样 ZIP 的完整文件摘要、安全 fuses、外部启动与正常关闭通过，包含 package.json。 |
| 文档与正式输入 | 逐文件覆盖、引用与锚点、差异、语言身份、预设表达式和固定源码校验分别登记。 |

各分审报告和对应检查文件记录分审完成时的快照；集成后的不透明身份、取消传递和最终运行结果以本页及 validation.json 为准。原始探针源码以 `.txt` 保存其执行时内容和路径，供核对方法；当前可执行回归由仓库正式 tests 拥有。

未重新执行真实来源授权或远端写入、独立技术项目、GPU 与全部图形后端、正式签署、安装更新和完整产品验收。Google OAuth 应用验证没有完成证据，Drizzle 正式组合及完整 schema、各后续工作包与发行材料继续按[当前状态](../../../../implementation/status.md)记录。本轮远端 CI 在 PR 建立后单独登记。
