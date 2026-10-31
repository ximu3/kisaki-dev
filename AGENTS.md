# Kisaki

沟通默认使用简体中文。先从 [refactor/README.md](refactor/README.md) 和当前工作包读取正式合同，代码、组织、注释与审阅遵守根目录 [CONVENTIONS.md](CONVENTIONS.md)。交付状态变化时更新[实施状态](refactor/implementation/status.md)，验证材料按[实际用途](refactor/design/engineering/documentation.md#evidence)维护。

**整体判断优先于机械执行。** 遇到要求或方案的原则、正确性、质量及技术实践问题，按[整体判断](CONVENTIONS.md#judgment)重新审视相关设计，由用户决定调整方向。

终态实现、整体一致性、可读性、简洁与原生共同约束交付，完整要求由[共同原则](CONVENTIONS.md#quality)定义。编写时落实职责、分段和合同说明，收尾时沿正常、失败、取消与清理路径审阅；格式、类型和测试通过不能代替人工判断。

涉及模型、主要行为、公开合同、架构边界或交付范围的取舍，按[实施讨论规则](refactor/implementation/work-packages.md#unexpected-issues)说明依据、选项与代价，讨论确定后实施。既定合同内的问题由实施者修复与验证。重要判断查阅相关社区、维护者与成熟项目实践，并核对实际工具能力。

本仓库承载 `clients/desktop/app`、八个公共包、33 个官方扩展项目与三个私有工程包。Vantage、Kana、libmpv-node 和 oauth-relay 在各自独立仓库实现、验证与交付，并按合同接入。Web 客户端、官网和候选服务端不在当前交付范围，不预建源码。旧项目仅用于核对已确认的行为与资源保留要求，实现独立设计。

main 拥有事实与操作，renderer 拥有视图，preload 只开放窗口最小能力，extension-host 是独立共享 Node 进程。shared 只含纯合同。公共包使用构建后的 exports，SDK 通过 extension-api 消费桌面能力，官方扩展不导入应用私有代码。

数据、错误、并发、取消与资源寿命遵循所属设计。失败不通过缩减范围、返回空值或关闭检查消除。测试不用真实个人资料，Node、浏览器、Electron Node 模式与实际 Electron 分别运行。声明检查遵守[类型分工](refactor/design/engineering/workspace.md#declaration-checks)。

环境准备和任务入口见 [CONTRIBUTING.md](CONTRIBUTING.md)。普通 check 不包含真实桌面、制品和性能验收；按实际影响选择验证。通用文档维护现行规则与必要依据，完成度归状态页，Git 与 PR 承载修改经过，见[文档归属](refactor/design/engineering/documentation.md#owners)。

构建、测试和打包不隐含外部发布。GitHub 仓库重建、npm 发布、平台签署身份及部署按实际授权处理，超出任务范围的对外操作先讨论。未取得的六目标、签名或后端运行证据保持未完成。
