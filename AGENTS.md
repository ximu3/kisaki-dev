# Kisaki

沟通默认使用简体中文。遵守 [CONVENTIONS.md](CONVENTIONS.md)，从 [refactor/README.md](refactor/README.md) 和当前工作包读取正式合同，完成后维护 [实施状态](refactor/implementation/status.md)。有方案取舍时先说明依据、选项与代价，和用户讨论后再定稿；超出任务范围的对外操作也须先讨论。

**终态实现与整体一致性是首要准则。** 从完整目标和全部相关场景确定方案，必要时重新考虑整体设计、架构与实现；同类问题在共同拥有层统一解决，相关代码、合同、测试和文档同步闭合。正式成果直接表达自身职责与行为，不采用临时性、过程性、要求性、反向性或补丁性的实现与叙述。具体遵守[核心准则](refactor/design/engineering/conventions.md#final-state)。

**可读性是核心设计准则与交付门槛。** 代码、模块组织、文件夹结构、命名、配置、任务和文档都应让读者容易定位职责、理解关系、追踪行为及判断修改影响。按完整阅读与维护路径审视整体，必要时调整组织；具体遵守[可读性准则](refactor/design/engineering/conventions.md#readability-principle)。

**编码风格同属核心质量要求。** 逻辑分段、间距、控制流、状态与副作用的表达，以及同类代码的一致性，都按[编码风格](refactor/design/engineering/conventions.md#coding-style)逐段审阅。格式工具负责语法排版，人工审查负责职责与语义步骤是否清楚。

通用文档只保留现行内容和必要依据；当前完成度与缺项归状态页，实施经过与逐次运行记录归验证证据，遵守[文档归属](refactor/design/engineering/documentation.md#owners)。

简洁与原生优先是全项目的重要设计准则，同时约束用户体验、实现、工具和文档。优先直接的流程、清楚的概念，以及平台、语言和工具自身提供的能力与惯例；原生优先不限定现有工具或技术栈，选型仍从目标出发。保留系统交互和浏览器控件的原有语义。避免过度防御、过度测试和过度设计，既有方案同样接受复核。具体遵守[简洁、原生与适度复杂度](refactor/design/engineering/conventions.md#simplicity-native)。

重要判断从功能与需求出发，主动参考相关社区讨论、维护者意见和成熟项目实践，比较可选方案及其取舍，再核对当前或候选工具版本的实际能力与限制。查证范围不局限于已选技术栈，不只寻找支持既有方案的依据；关键判断说明来源、适用前提和建议。

本仓库当前承载 `clients/desktop/app`、八个公共包、33 个官方扩展项目与三个私有工程包。Vantage、Kana、libmpv-node 和 oauth-relay 属于整体交付范围，在各自独立仓库完成实现、验证与交付，并按合同与 Kisaki 接入。本仓库的 Web 客户端、官网和候选服务端不在当前交付范围，不预建源码。旧项目仅按已确认的行为或资源保留要求查阅，实现独立设计。

main 拥有事实与操作；renderer 拥有视图；preload 只开放窗口最小能力；extension-host 是独立共享 Node 进程。shared 只含纯合同。公共包使用构建后的 exports；SDK 不绕过 extension-api，官方扩展不导入应用私有代码。

数据、错误、并发、取消与资源寿命遵循所属设计。失败不通过缩小范围、返回空值或关闭检查消除。测试不使用真实个人资料，Node、浏览器、Electron Node 模式和实际 Electron 分别运行。

常用入口与前置条件见 [CONTRIBUTING.md](CONTRIBUTING.md)。普通 `check` 不包含真实桌面、制品和性能验收；按改动实际执行相应任务并记录范围。常规类型项目保留 strict 并启用 skipLibCheck，公共声明消费者与自有声明拥有层保持完整声明检查，遵守[类型检查分工](refactor/design/engineering/workspace.md#declaration-checks)。

构建、测试和打包不隐含外部发布。GitHub 仓库重建、npm 发布、平台签署身份与部署按实际授权处理。未取得的六目标、签名或后端运行证据保持未完成。
