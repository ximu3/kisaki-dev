# W00 工程验证

本页保留所列版本的实测结果。现行工程测试已收紧为必要的工具回归，命令、运行范围和缓存规则以 [CONTRIBUTING](../../../../CONTRIBUTING.md) 为准；以下空载体采样只描述原输入，不作为产品性能或当前门禁。

2026-11-01，在 Windows 10 22H2 x64、Node 24.11.1、pnpm 11.11.0 和 Electron 45.0.0 下验证桌面工程。交付范围与平台结果见[实施状态](../../../implementation/status.md#w00)。

## 验证对象

Workspace 登记根工程、桌面工程和三个私有工程包。桌面构建显式消费 tests/fixtures/runtime，覆盖原生文件操作、资源准备、编译、开发协调、打包和检查。测试载体的四个窗口名称对应独立编译入口，本地消息用于测试进程控制。

## 本机结果

| 检查                           | 实际结果                                                                    |
| ------------------------------ | --------------------------------------------------------------------------- |
| pnpm install --frozen-lockfile | 5 个 workspace 项目，锁文件消费成功。                                       |
| pnpm check                     | 4 项类型任务、5 项 lint／依赖任务、格式及 37 项普通 Node 测试通过。         |
| Electron Node 模式             | SQLite 与原生文件操作共 7 项通过。                                          |
| 实际 Electron                  | 四个编译入口、sandbox preload、隔离与 utility process 共 4 项通过。         |
| 开发会话                       | 退出取消、编译失败与改名恢复、依赖失败恢复与 HMR、启动准备取消共 4 项通过。 |
| 工程载体打包                   | Windows x64 ZIP 与 NSIS 生成，打包复用同一构建。                            |
| 制品外部运行                   | 版本与资源摘要、正式 fuses、隔离资料、系统窗口启动与正常关闭通过。          |
| 启动观察                       | 20 个新进程完成工程载体启动、内存读取和退出观察。                           |

制品身份与摘要见[运行收据](windows-x64-artifacts.json)，buildId 为 `40539253b5de4298`，testOnly 为 true。测试用例、配置和资源输入随工程源码维护。

## CI 六目标结果

2026-11-01，[CI 运行](https://github.com/ximu3/kisaki-dev/actions/runs/41298720482)验证 [d6a9962](https://github.com/ximu3/kisaki-dev/commit/d6a9962bfd5271397a2ae94e941ca40a6ebd332d) 对应的 PR 合并结果。仓库检查、六个桌面目标和 Required checks 全部通过。

| 目标          | Runner           | 工程载体制品       | 结果 |
| ------------- | ---------------- | ------------------ | ---- |
| Windows x64   | windows-2025     | ZIP、NSIS          | 通过 |
| Windows arm64 | windows-11-arm   | ZIP、NSIS          | 通过 |
| macOS x64     | macos-15-intel   | ZIP、DMG           | 通过 |
| macOS arm64   | macos-15         | ZIP、DMG           | 通过 |
| Linux x64     | ubuntu-22.04     | AppImage、DEB、RPM | 通过 |
| Linux arm64   | ubuntu-22.04-arm | AppImage、DEB、RPM | 通过 |

各目标均通过 5 项共享工具测试、原生源码检查、载体构建、4 项实际 Electron 检查、4 项开发回归、打包、同一构建复用核对和制品外部运行。SQLite 与原生文件检查在 Windows x64 上为 7 项通过；其余目标为 6 项通过、1 项跨文件系统移动用例因临时目录位于同一文件系统而跳过。Linux 的制品运行在 X11 环境完成。

对应日志、环境记录、制品清单与运行结果由上述 CI 保存。工程载体使用隔离资料，制品标记 testOnly。

## 依据与适用范围

- [编译与包解析](build-tools.md)
- [开发监听与隔离副本](development.md)
- [类型与声明检查](declaration-checks.md)

本页结果适用于所列本机和 CI 工程载体。产品业务、公共包消费、正式宿主、签署和安装升级由[工作包](../../../implementation/work-packages.md)及[状态页](../../../implementation/status.md)分别登记。启动观察的负载包括窗口与原生模块。

## 现行验证收敛

2026-11-01，按简洁优先调整工程验证：保留数据保护、公开合同、原生接入、工具故障恢复和真实制品消费；删除模拟任务配置的仓库、空载体性能套件和仅用于观测重建次数的支撑代码。工程小程序只归工具测试，默认 build 不再指向它。程序准备、原生输出和公开包打包由同一 Turbo 任务图交付，消费者入口可以独立取得当前制品。

本机 pnpm check、7 项 Electron Node 原生／数据库检查、4 项开发会话回归、4 项 Electron 入口检查、打包工具用例及 3 项公开包消费者均通过。一次 Electron 解压目录重命名遇到 Windows EPERM，针对性重跑通过；未增加重试机制或放宽断言。同输入的 8 项桌面任务随后全部缓存命中，Turbo 报告 137ms，没有重新启动桌面测试。

CI 原生绑定保留六目标，工程窗口、进程、开发与打包采用三个系统参考目标，公共包消费采用 Linux x64。成功缓存包含源码、测试、工具链、CI 镜像与目标；手动完整入口强制执行。新的远端结果由本次 PR 核对，已有运行结果不改写成新版本实测。
