# AppImage 兼容策略与按路径准备的实测

2026-10-26，比较 electron-builder 的默认兼容策略与按应用配置系统权限。本记录保留比较阶段的真实 Linux 探针、建议与边界。随后用户确认采用上游条件兼容策略，并清除桌面入口的无条件降级参数；当前政策与实施验证见[采用记录](adoption/README.md)，下述按路径准备建议没有成为产品要求。

## 比较阶段的建议

推荐保留 Chromium 进程沙箱，在必要时为当前 AppImage 的明确运行路径配置权限。准确的操作语义是“首次在这个位置运行时准备；移动或改名后重新准备”，不承诺一次配置覆盖所有目录及所有 Linux 限制。

采用稳定、不含版本号的运行文件名。实际同路径版本替换继续匹配原策略；锁定的 electron-updater 6.8.9 也会保留不含版本号的现有文件名，无须为此重写更新器。[更新器源码](https://github.com/electron-userland/electron-builder/blob/electron-updater%406.8.9/packages/electron-updater/src/AppImageUpdater.ts#L90-L109)

选择这条路线的代价是受限设备需要取得相应系统授权。没有配置权限时不能靠该方案直接运行；系统全面禁止用户命名空间等条件，也不是一个应用 AppArmor profile 能解决的。不能把预期拒绝启动算作该环境的产品可用性通过。

## 环境与输入

使用项目现有私有 CI 的独立研究分支执行 Ubuntu 24.04 x64 作业。本机 Windows 没有可用 WSL 发行版，没有用模拟消息冒充 Linux 沙箱运行。

- [成功作业](https://github.com/ximu3/kisaki-w00-ci/actions/runs/40301130444)：提交 `49a2df7715df264fb09bc22091e847e249ade7be`，分支 `research/appimage-policy-2026-10-26`。
- Ubuntu 24.04.5 LTS，内核 `6.17.0-1022-azure`；应用以普通用户 UID 1001 运行。
- Node 24.11.1、Electron 44.5.1、electron-builder 26.15.3；依赖由 [package-lock.json](probe/package-lock.json) 固定，已与 CI 实际使用的锁文件摘要核对。
- 初始 `kernel.apparmor_restrict_unprivileged_userns=1`，`user.max_user_namespaces=31633`。只在可销毁的 CI VM 中改变条件形成对照，结束后恢复原值、移除试件 profile；清理命令全部成功。
- 三个实际 AppImage 分别使用默认启动器、严格启动器 1.0.0、严格启动器 1.0.1。主模块在 ASAR 内，沿用本体现行七项 fuse 配置，保存了文件摘要与 fuse 回读。

严格版本通过 builder 公开的 afterPack 钩子放置只定位并 exec 本体的 AppRun，通过公开 executableArgs 清除桌面入口的默认降级参数。提取最终 AppImage 后核对了其中的 AppRun 与 .desktop。

实现见 [probe/run.ts](probe/run.ts)、[主模块](probe/main.ts)、[工作流副本](probe-workflow.yml)和[输入清单](source-inputs.json)。探针工作流只在研究分支运行，没有加入当前分支的常规 CI。

## 观察方法

创建真实 BrowserWindow，启用 sandbox、contextIsolation，关闭 nodeIntegration，加载固定本地 HTML。渲染完成后通过实际父子 Node IPC 交付 PID、版本和页面结果，再读取相应 `/proc` 状态。root 仅用于配置试验条件和读取受保护的进程信息，未用于运行应用。

记录实际命令行、用户身份、AppArmor 标签、主进程及渲染进程的 user／pid／mnt／net namespace、Seccomp 与 NoNewPrivs。沙箱成功场景具有独立的渲染进程 user、pid、net namespace，Seccomp 为 2；降级场景与主进程共用这些 namespace，Seccomp 为 0。

两种情况下页面都没有 Node 全局变量，NoNewPrivs 都为 1。因此这两个值单独不足以证明 Chromium 沙箱开启。路径 profile 的 AppArmor 标签包含 unconfined，是只授予 userns 的策略形式；它不声称限制全部应用行为，Chromium 的隔离由上述进程状态核对。

## 实际结果

十项启动对照均符合预期。表中“失败”是实际观察到的启动拒绝，不表示该条件下应用可用。

| 场景 | 结果 |
| --- | --- |
| 允许用户命名空间，直接运行默认版本 | 启动成功，沙箱开启 |
| 相同允许环境，带入默认 .desktop 的 --no-sandbox 参数 | 启动成功，沙箱关闭 |
| AppArmor 限制开启，直接运行默认版本 | 上游自动降级，启动成功，沙箱关闭 |
| 限制开启，严格版本尚无应用 profile | 启动失败，未报告 renderer 就绪 |
| 为严格 AppImage 准确路径安装 profile | 启动成功，沙箱开启 |
| 在相同路径把完整 1.0.0 制品替换为完整 1.0.1 | 实际版本为 1.0.1，沙箱开启，无须重新准备 |
| 移到新目录，保留旧 profile | 启动失败 |
| 将 profile 重新登记到新路径 | 启动成功，沙箱开启 |
| 已有 profile，但 user.max_user_namespaces 设为 0 | 严格版本仍启动失败 |
| 相同零命名空间条件，运行默认版本 | 自动降级后启动成功，沙箱关闭 |

另做路径通配对照：把普通 `/usr/bin/unshare` 的副本命名为 `KisakiProbe-other.AppImage`。精确策略下该副本不能完成操作；把 attachment 扩大为试件目录内 `**/KisakiProbe*.AppImage` 后，它取得了权限。这个文件并不是 AppImage，证明路径模式不认证程序内容，不能把宽泛名称匹配描述为“只识别真正的 Kisaki”。精确路径本身也不提供内容认证；程序来源与更新信任是另一责任。

原始结果见 [result.json](ci-40301130444/results/result.json)，作业信息与日志见 [run.json](ci-40301130444/run.json)、[run.log](ci-40301130444/run.log)。构建日志、最终启动文件和逐场景日志保存在同一目录。

## 取舍

默认兼容策略确实提高受限条件下的启动可用性，不增加应用权限登记；代价是真实的 Chromium 进程隔离下降。当前默认桌面参数还可能在无需降级时关闭沙箱。若采用这条政策，必须明确接受这种运行形态，统一入口行为并修订正式承诺，不能凭 sandbox: true 宣称隔离始终存在。

按路径准备已经证明可解决本次 AppArmor 限制，正常同路径更新也能保持授权。其代价是移动后重新登记、取得适用管理权限及维护这一有限操作。建议不把它扩展成修改全局安全开关的通用修复器，也不靠宽泛路径规则承诺任意位置的一次性授权。

策略绑定原始 AppImage 文件，权限沿启动链继承。原位换版前后的临时 .mount 目录不同，但精确原路径的 profile 持续生效；不需要追踪每次生成的挂载目录。这是本次把建议明确收敛到按路径准备的重要实测依据。

## 过程与验证边界

前两次作业未进入沙箱对照：第一次 setup-node 自动寻找根工程的 pnpm 缓存入口，但独立探针没有安装 pnpm；第二次依赖脚本未执行，却指定了不存在的 Electron dist。分别通过禁用本探针不需要的自动缓存、交由 builder 正常准备固定版本 Electron 修正。保留[首次环境日志](initial-setup.log)和 [Electron 准备日志](initial-electron-preparation.log)，没有跳过沙箱断言取得通过。

同路径更新验证了两个真实版本制品替换后的运行，未执行完整 HTTP 下载、签名校验或更新界面。首配图形交互、拒绝授权、正式安装与撤销流程尚未实现。试件不包含本体数据库、Vantage、libmpv-node 或真实扩展业务。

本轮比较仅覆盖上述 Ubuntu 24.04 x64、固定版本和明确系统条件，不覆盖 Ubuntu 26.04、Debian、Fedora、ARM64 或完整 Kisaki 制品验收。研究分支运行不代表当前未提交工作副本通过了新的六目标 CI。后续的[政策采用](adoption/README.md)与 [CI 事件修正](../../ci-events/2026-10-26/README.md)分别记录，没有改写本次原始结果。
