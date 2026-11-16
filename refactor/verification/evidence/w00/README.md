# W00 工程验证

2026-11-01，在 Windows 10 22H2 x64、Node 24.11.1、pnpm 11.11.0 和 Electron 45.0.0 下验证桌面工程。交付范围与平台结果见[实施状态](../../../implementation/status.md#w00)。

## 验证对象

此次验收使用根工程、桌面工程和当时的三个私有工程包。桌面构建以 `tests/fixtures/runtime` 为输入，覆盖原生文件操作、资源准备、编译、开发协调、打包和检查。测试载体的四个窗口名称对应独立编译入口，本地消息用于测试进程控制。

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

<a id="engineering-workflows"></a>

## 工程输出与开发编排

2026-11-02，在 Vite 8.3.3 下从独立 Node 进程调用 `ec15952` 的有限编译入口。传入监听配置后，构建在写出文件前拒绝执行，进程正常退出。[该提交的编译实现](https://github.com/ximu3/kisaki-dev/blob/ec15952adb13db37b2d5ff7425ebb0c3ab3744c4/clients/desktop/app/tools/build/programs.ts)

Node 与浏览器条件导出的选择由[隔离包解析用例](../../../../clients/desktop/app/tests/tools/build/programs.test.ts)验证，各 preload 入口独立生成 CommonJS 的行为由[配置重载用例](../../../../clients/desktop/app/tests/tools/build/preload.test.ts)验证。

2026-11-12，在 Windows 10 x64、Node 24.11.1、pnpm 11.11.0、Turbo 2.11.10、Vite 8.3.3 和 Electron 45.0.0 下得到以下结果。

| 范围 | 实现与实际验证 |
| --- | --- |
| 普通输出与缓存 | 公共包、资源、原生与有限构建使用可重建目录。公共包先清理 dist，再编译或恢复缓存。A→B→A 回归最后只留下 A 的文件，构建记录确认第三次命中缓存。 |
| 依赖边界 | 各工程在自己的公共依赖构建完成后扫描所属源码，根工具、测试和配置单独检查，规则仍由同一配置提供。清空包输出后强制执行全部边界检查通过；实际任务图核对该前置关系。 |
| 开发编译 | Vite 原生监听 Node 程序模块，renderer 直接消费 workspace exports 和 HMR。准备监听只覆盖包构建、资源、原生及配置。六项真实会话回归通过，包含语法和导入改名修复、配置错误恢复、依赖与样式更新、退出取消及独立失败交付。 |
| 运行与交付身份 | 有限构建与源码会话使用独立标识，缓存键不进入运行合同。实际进程读取完成的运行目录，退出后释放；打包核对已完成清单的目标与文件摘要。中间目录备份、公共依赖副本及无人消费的中间收据已移除。 |
| 本机运行 | 原生与 SQLite 共 6 项、四类 Electron 窗口共 4 项、开发会话 6 项、Windows ZIP／NSIS 制品外部运行 1 项通过。六个公共包共 29 项仓库外消费通过，覆盖完整声明、浏览器及适用的 Electron 接入。 |

此次 `pnpm check` 覆盖类型、lint、按工程执行的依赖边界、格式和普通测试。公共包消费、原生、窗口、开发和制品验证在一次 Turbo 任务图中按顺序执行，共 39 个任务成功。开发会话的停止失败、取消与资源回收另见[关闭复核](development.md#shutdown)。

## Vite+ 迁移验收

迁移验收使用 Node 26.13.1 和 pnpm 12.18.0。三个全新检出各自冻结安装，随后分别从源码运行 `typecheck`、`lint`、`test`。另核对了 38 个直接继承预设的类型项目的有效选项和文件范围。六个公共包的实际 tarball 保留了 76 个公开子路径，导出条件顺序和目标文件与迁移前一致。[迁移验收记录](https://github.com/ximu3/kisaki-dev/blob/fb934e0d8c6077ac382702d6ca550983e9d214de/refactor/implementation/archive/engineering-modernization/workspace-config-and-tasks.md#migration-acceptance) · [六目标检查](https://github.com/ximu3/kisaki-dev/pull/39/checks)

## 依赖使用范围

2026-11-11 的工程依赖风险评估对应 W05 的锁文件、ZIP 解压入口和 lint 工具。[当时的评估](https://github.com/ximu3/kisaki-dev/blob/a9c679efe4ab3f7db064479af448c31d5eb73035/refactor/verification/evidence/w00/dependencies.md) · [对应锁文件](https://github.com/ximu3/kisaki-dev/blob/a9c679efe4ab3f7db064479af448c31d5eb73035/pnpm-lock.yaml)

2026-11-16 核对 `1073fda7` 时，Windows 制品测试使用系统 `tar.exe` 解压 ZIP。锁文件中 `@electron/asar` 引入 `glob@13.0.6` 和 `minimatch@10.2.6`，`app-builder-lib` 与 `@electron/universal` 分别使用 `minimatch@10.2.6` 和 `minimatch@9.0.9`。[制品解压入口](https://github.com/ximu3/kisaki-dev/blob/1073fda7adab99a558466ddb87f7055c3525220f/clients/desktop/app/tests/artifacts/workspace.ts) · [该次锁文件](https://github.com/ximu3/kisaki-dev/blob/1073fda7adab99a558466ddb87f7055c3525220f/pnpm-lock.yaml)

## 适用范围

各次结果以所列版本、输入和宿主为准。桌面启动观察使用包含窗口与原生模块的工程载体。正式产品、签署及安装升级的验收进度见[实施状态](../../../implementation/status.md)。
