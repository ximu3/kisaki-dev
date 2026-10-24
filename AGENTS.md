# Kisaki

沟通默认使用简体中文。遵守 [CONVENTIONS.md](CONVENTIONS.md)，从 [refactor/README.md](refactor/README.md) 和当前工作包读取正式合同，完成后维护 [实施状态](refactor/implementation/status.md)。重要方向与超出任务范围的对外操作先讨论。

当前只交付桌面生态：`clients/desktop/app`、八个公共包与 33 个官方扩展项目。Web、官网、候选服务端及四个独立项目的源码不在本次桌面工程中预建。旧项目仅按已确认的行为或资源保留要求查阅，实现独立设计。

main 拥有事实与操作；renderer 拥有视图；preload 只开放窗口最小能力；extension-host 是独立共享 Node 进程。shared 只含纯合同。公共包使用构建后的 exports；SDK 不绕过 extension-api，官方扩展不导入应用私有代码。

数据、错误、并发、取消与资源寿命遵循所属设计。失败不通过缩小范围、返回空值或关闭检查消除。测试不使用真实个人资料，Node、浏览器、Electron Node 模式和实际 Electron 分别运行。

常用入口与前置条件见 [CONTRIBUTING.md](CONTRIBUTING.md)。普通 `check` 不包含真实桌面、制品和性能验收；按改动实际执行相应任务并记录范围。UI 的声明检查例外限于已确认的配置，不扩大到工具源码、纯包或消费者。

构建、测试和打包不隐含外部发布。GitHub 仓库重建、npm 发布、平台签署身份与部署按实际授权处理。未取得的六目标、签名或后端运行证据保持未完成。
