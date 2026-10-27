# CI 可靠性与反馈时间探索

基线为 PR #1 Squash 合并后的 `1efc7ad8c22824c1b5ea727ebd14bfc151eaf114`，与已通过六目标及暖缓存复验的 `18a6346` 文件树相同。用户已授权合并后开始探索；原生优先允许引入、更换工具或在收益明确时自研，不以保留当前工具为前提。六目标、20 次启动采样、正常退出与失败判定保持原要求。

本记录区分已经证实的问题、局部修正和正式实施结果。用户已确认采用独立 Chokidar 6 输入监听与 Electron 45.0.0，正式实现及六目标验证进行中。诊断分支只承载一次性实验，不能合并其替代工作流。后续成功不覆盖已保存的失败。

## 已取得的结果

| 问题                       | 实际证据                                                                                                                                   | 当前判断                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 合并后主线常规检查失败     | [40475563259](https://github.com/ximu3/kisaki-dev/actions/runs/40475563259) 的 renderer 监听回归失败，六目标尚未开始                       | 不是六目标运行成功；需要修复监听就绪问题                                     |
| Linux 漏掉公共包配置修改   | 原路径两轮各五次均失败两次；补齐试件 `src`、`tools` 后仍失败一次                                                                           | 失败时修改已经发生，但文件尚未进入监听列表；随后扫描完成，没有补发该修改事件 |
| 独立输入监听原型           | Chokidar 6 原型在 Linux 上五次原有回归全部通过，未扩大断言时间                                                                             | 支持独立监听与显式就绪方向，尚未形成正式跨平台实现结论                       |
| 隔离开发副本反复缓存失效   | 无有效 Git HEAD 时，Turbo 把生成的 `.turbo/turbo-build.log` 纳入输入；每次构建改变下一次任务 hash                                          | 不是根 CI 缓存恢复顺序问题；开发试件需要有效 Git 仓库上下文                  |
| Electron 准备依赖测试顺序  | Apple Silicon 单独运行开发场景时，复制尚不存在的 `electron/dist` 失败                                                                      | 锁定 Electron 版本在首次导入时下载二进制；试件必须显式调用公开包入口         |
| Apple Silicon 性能测试卡住 | 两个失败进程均记录 Electron 内部 `BrowserWindow.visibilityChanged` 的 `Object has been destroyed`；原生采样显示错误对话框的模态循环 | 已复现窗口销毁后内部回调异常导致退出卡住；Electron 45 移除了该回调，升级候选的单平台验证通过 |

## Linux 监听与候选方案

本机 Windows 的三次原路径定向回归均通过。Linux 的时间线记录 Vite watcher 创建、ready、adopt 返回、文件写入、实际文件事件及 `getWatched()`。失败中，公共包配置在写入时未列出，在一秒断言结束前已经被扫描并列出，但没有对应 change。运行时配置与 package.json 的修改仍正常被观察。补齐公共包试件的两个目录未消除失败，因此没有把试件补目录当作修复。

Vite 8.3.3 先创建 watcher，再异步创建环境和调用 `configureServer`。其公开 `watcher.add()` 不返回新增路径就绪的 Promise；初始 ready 不能表示之后添加路径的扫描完成。在 `configureServer` 中简单等待一次 ready 还可能错过已经发生的事件。[Vite JavaScript API](https://vite.dev/guide/api-javascript.html#vitedevserver)与实际安装源码共同用于核对这一限制，未使用私有就绪字段，也未加入固定等待或扫描轮询。

| 方案                         | 与目标的关系                                                                       | 代价与尚缺证据                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 继续复用 Vite watcher        | 依赖最少，服务重启时重新注册输入                                                   | 当前公开接口缺少追加路径就绪边界；需要证明可靠接续方式，不能把延时当就绪                               |
| 独立使用 Chokidar 6          | 一次传入全部运行时及公共包输入，等待 ready；监听寿命属于开发会话，跨 Vite 重启保留 | 增加直接开发依赖及其 readdirp 依赖；需落实异常传播、失败清理，以及实际平台的保存、删除、改名与恢复验证 |
| 独立使用 @parcel/watcher 2.6 | `subscribe()`、`unsubscribe()` 是明确的异步操作，支持批量文件变更                  | 使用原生二进制，监听入口为目录；需要核对输入选择范围和各目标实际运行，尚未做接入原型                   |
| 直接使用 Node fs.watch       | 无外部监听库                                                                       | 需要自行处理跨平台事件、文件重建与监听恢复；目前没有证明比成熟监听器更简单完整                         |

用户已确认采用独立 Chokidar 6 输入监听器：Vite 继续拥有 renderer HMR，开发会话拥有会触发运行时或公共包重建的输入监听。两者各自关闭；服务或监听准备失败时释放已建立资源。运行期间的监听错误必须交给会话失败路径，不能只记录后继续报告可用。workspace 文档已同步监听归属与就绪规则，正式实现进行中。

[可审阅原型](https://github.com/ximu3/kisaki-dev/blob/d02d415d6b27a1c7ea794a9de1bc3199d918edb5/clients/desktop/app/tools/dev/renderer.ts)只验证监听所有权与就绪，不是最终实现。它沿用现有输入清单、变更分类和 Vite 服务，不增加自定义文件事件协议。原型的五次通过不能替代完整错误路径或六目标验证。

来源：[Chokidar 6.0.0 的任务就绪实现](https://github.com/paulmillr/chokidar/blob/6.0.0/src/index.ts)、[6.0.0 变更记录](https://github.com/paulmillr/chokidar/blob/6.0.0/CHANGELOG.md)、[Parcel watcher API](https://github.com/parcel-bundler/watcher#watching)、[Node fs.watch 的平台注意事项](https://nodejs.org/docs/latest-v24.x/api/fs.html#fswatchfilename-options-listener)。2026-10-27 的 npm 元数据核对到 chokidar 6.0.0 和 @parcel/watcher 2.6.0；后者声明了六目标对应的预编译包，未据此声称运行通过。

## 开发副本与缓存

使用 Turbo 2.11.10 的 `--dry=json` 记录相同副本在连续两次构建前后的实际输入。仅 `git init` 没有解决问题；有效空提交提供 HEAD 后，四个公共包的输入与 hash 稳定，第二次全部命中缓存。空提交不纳入项目源码，隔离仓库内的文件仍按实际内容参与哈希。

| Windows x64 副本条件    | 第一次构建 | 第二次构建 | 第二次命中 |
| ----------------------- | ---------: | ---------: | ---------: |
| 原始复制目录            |   5.429 秒 |   5.135 秒 |      0 / 4 |
| 仅初始化 Git            |   5.092 秒 |   5.101 秒 |      0 / 4 |
| 初始化 Git 并建立空提交 |   5.511 秒 |   0.762 秒 |      4 / 4 |

已在 `prepareDevelopmentWorkspace` 内建立独立 Git 上下文，提交身份只传给本次命令，禁用本次提交钩子及签署，不修改用户全局设置。随后原有开发回归七项全部通过，用时 114.10 秒；本体类型、修改文件 lint 与 renderer 定向回归通过。再根据独立 Apple Silicon 运行暴露的前置条件，加入 `electronExecutable()` 调用，在复制 Electron 分发目录前通过公开包入口准备二进制；类型与 lint 通过。`40481794829` 的 Apple Silicon 和 Windows arm64 任务均确认准备前 `dist`、`path.txt` 不存在，helper 正常触发下载后七项开发回归全部通过，分别用时 70.05 秒与 238.19 秒。

此前 `18a6346` 完整 CI 的 Windows arm64 同一套回归为 641.66 秒，本轮为 238.19 秒；三个 session 场景所在文件从 502.578 秒变为 153.779 秒，取消与重试场景从 134.729 秒变为 81.873 秒。前后均保留七项断言场景和原预算，但并非同一 runner 上交替运行的统计试验，准备和缓存状态也有差异，因此只登记这两次实际结果，不把 403.47 秒差值全部认定为修正的稳定收益。

原始 Windows 阶段测量为：副本准备 15.470 秒，首次开发就绪 23.307 秒，同副本再次就绪 20.821 秒。修正后用同一阶段脚本再测，分别为 11.530、13.578、8.923 秒，两次会话均正常退出。原先四次内部 Turbo 调用全部未命中；修正后首次构建未命中，随后三次均命中四个公共包。这是两个顺序运行的单次观察，包含磁盘缓存及进程调度差异；缓存输入与命中变化可直接验证，整个阶段的差值不能全部归因于此修正，也不能与整套回归时长直接相减。现有试件修正已恢复正常缓存语义，没有引入自定义缓存或共享输出。

原始输入快照、构建耗时与判读保存在 `cache-inputs-*.json`、`development-phases-windows-x64.json` 和 [findings.json](findings.json)，原始脚本在 [probe-sources](probe-sources)。脚本使用本机路径，通过真正的 pnpm 项目任务取得进程前置条件；重现旧副本条件必须使用同目录保存的 `1efc7ad` helper，不能把已自动初始化 Git 的新 helper 当作旧基线。这些是 Windows x64 证据，不据此承诺 Windows arm64 或整套 CI 节省多少分钟。

## Apple Silicon 关闭观察

锁定 Electron 44.5.1、Playwright 1.64.1 和 Node 24.11.1。诊断先通过 Electron 公开入口准备二进制，避免将首次下载混入启动采样。

`40479317018` 的 standalone 任务前四次正常退出，第五次主进程 PID 3746 已输出应用 ready，窗口可见并成功取得进程指标。`application.close()` 发起后，Node 调试连接断开，随后没有 Host stopped 或 Shutdown complete，测试与 worker 收尾各等待 180 秒后失败。完整原始报告停在 `Sample 5: close`。同一轮 after-development 任务完成七项开发回归及二十次性能采样。

后续 `40480751602` 对比 Playwright 关闭与真实窗口按钮关闭，两组各二十次均正常退出，并留下 before-quit、窗口 close／closed、will-quit、quit 事件。因未复现卡住，没有产生 native sample，不能称为问题修复。

`40481212521` 把监听安装并入已有 process metrics evaluation，保持原关闭操作。一组二十次通过，另一组在第十一次关闭失败。该失败已记录窗口销毁、will-quit、Host stopped 和 Shutdown complete，仍没有 quit 或主进程退出。关闭十秒时的 [PID 2089 原生采样](diagnostics-40481212521/artifacts/macos-arm64-quit-1/performance/startup-measures-twenty-fr-173b5-served-child-processes-exit/sample-11-pid-2089.txt)显示 macOS 15.7.9 主线程位于 `NSAlert runModal` / `NSApplication runModalForWindow`，说明当时正在等待模态对话框。采样同时确认两个已观察子进程已退出，另两个仍可采样。没有把部分子进程退出当作整体正常退出。

此诊断提交还对 `tools/dev/renderer.ts` 做了两处排版变化，未改变调用行为，但其构建身份从 `efd2b15…` 变为 `b738e922…`，不记作完全相同源摘要。下一轮恢复该文件原始内容，并通过 Node 的 `uncaughtExceptionMonitor` 将异常原文写入独立诊断文件；不注册吞掉异常的处理器、不关闭默认错误对话框。之所以核对异常，是因为 [Electron 44.5.1 默认处理器](https://github.com/electron/electron/blob/v44.5.1/lib/browser/init.ts)会为未捕获异常显示错误对话框；仅凭原生栈尚不能确定异常内容或责任方。

`40482395686` 的两组完整退出观察均通过，未捕获异常。随后 `40482913180` 恢复原性能测试调用顺序，只保留入口的安静异常监视。三组中两组分别在第九次、第十二次关闭超时，两份异常记录完全相同：

```text
TypeError: Object has been destroyed
    at BrowserWindow.visibilityChanged (node:electron/js2c/browser_init:1:18097)
    at BrowserWindow.emit (node:events:514:28)
```

原始异常见[第九次记录](diagnostics-40482913180/artifacts/macos-arm64-quiet-1/performance/startup-measures-twenty-fr-173b5-served-child-processes-exit/uncaught-9.txt)与[第十二次记录](diagnostics-40482913180/artifacts/macos-arm64-quiet-2/performance/startup-measures-twenty-fr-173b5-served-child-processes-exit/uncaught-12.txt)。[44.5.1 对应回调](https://github.com/electron/electron/blob/v44.5.1/lib/browser/api/browser-window.ts#L66-L79)读取窗口可见性、最小化状态和 webContents，但没有在对象销毁后退出。结合异常与原生模态栈，可以确认这两次失败的直接原因：Electron 内部回调访问已销毁对象，默认错误对话框阻塞退出。此前没有异常记录的两次历史超时仍不能逐次确证为同一原因。

### Electron 候选版本

同系列最新的 44.9.3 仍保留该回调。45.0.0 已通过 [上游 #54048](https://github.com/electron/electron/pull/54048)纳入 [#53971](https://github.com/electron/electron/pull/53971)，让 Chromium 自身传播可见性，删除 BrowserWindow 的这段 JavaScript 转发。这个变更提供了避免依赖私有补丁或调整测试等待时间的候选方向。

`40484423503` 在独立 Apple Silicon runner 上分别安装固定的 44.9.3、45.0.0。两者均通过原有二十次启动／正常退出、本体类型检查、六项原生／SQLite 断言，以及四种窗口。原生测试各有一项同文件系统条件下的跨设备移动跳过，按原条件保留；并未记作七项全部执行。没有出现异常文件。44.9.3 的单次通过不足以证明竞态被修复，45 的依据还包括触发异常的回调已从源码移除。

用户已确认升级 Electron 45.0.0，正式基线文档已同步，实现与六目标验收进行中。代价包括 Chromium／Node 组合及沙箱 preload 的兼容检查、六目标构建／桌面／载体验证，以及正式版本文档同步。[45 的破坏性变更](https://releases.electronjs.org/release/v45.0.0)移除了沙箱 preload 中部分 Node 垫片；当前 preload 只使用 contextBridge、ipcRenderer 和 DOM 事件，没有使用被移除的 events、timers、url、Buffer 或 immediate。ASAR 的原始文件描述符语义与尚未接入的独立原生项目仍需按各自合同核对。单平台候选成功不代替正式六目标验收。

[Playwright 当前关闭实现](https://github.com/microsoft/playwright/blob/v1.64.1/packages/playwright-core/src/server/electron/electron.ts)调用 `app.quit()`，断开 Node 调试连接，再等待主进程实际退出。[Electron 退出事件合同](https://www.electronjs.org/docs/latest/api/app#event-before-quit)用于区分窗口尚未接受关闭、宿主停止和最终进程退出。现阶段没有依据更换测试框架、缩减采样或增加等待预算。

### 正式接入核对

正式输入监听由 `tools/dev/inputs.ts` 初始化，开发会话拥有其关闭；`renderer.ts` 保留页面服务、HMR 和公共包快照解析。原监听回归随拥有者移到 `tests/tools/inputs.test.ts`，继续使用真实 Vite 重启、嵌套公共包配置及源码新增场景，断言预算不变。Chokidar 6.0.0 增加一个 readdirp 5.1.1 依赖；锁文件中其他既有依赖版本与解析关系保持原样。

Electron 45 的 Chromium 156／Node 24.22.0 组合已核对，renderer 语法目标同步为 chrome156；工程 Node 仍由原 `.node-version` 固定。依据 [45 的完整破坏性变更](https://github.com/electron/electron/blob/v45.0.0/docs/breaking-changes.md)逐项检索现有源码：preload 没有使用被移除的垫片，当前没有屏幕捕获、Node 子框架集成、旧堆分析、同步 safeStorage 或 Storage Access API 调用；权限处理仍全部拒绝。当前原生二进制与 SQLite 资源位于 ASAR 外，未发现将包内虚拟文件描述符交给原生模块的路径。没有为这些未使用能力补入兼容代码。

[45 的平台清单](https://github.com/electron/electron/blob/v45.0.0/README.md#platform-support)保留 Windows 10、macOS 13 起的 x64／arm64，以及 Linux x64／arm64。libmpv-node 合同引用已按 [45 的共享纹理导入实现](https://github.com/electron/electron/blob/v45.0.0/shell/common/api/electron_api_shared_texture.cc)重新核对：Windows 复制 NT 句柄、macOS 保留 IOSurface、Linux 复制 plane fd 的边界保持成立，Linux SharedImage 仍未声明相同的 WebGPU usage。这里只确认上游源码合同，没有把尚未实现的媒体接入记为运行通过。

Windows x64 的正式实现已通过 pnpm check（48 项常规测试）、有限桌面构建、7 项原生测试、4 类实际窗口和 7 项开发会话回归；[本机日志与构建清单](local-verification/)保留实际结果，构建身份为 `51b0a5576a25553463ca92d77e03f29467ea7fd562e7ea46bbcada1c3efe6230`。第一次全仓检查指出新聚合异常缺少显式 cause，修正后完整检查通过；该失败日志一并保留。六目标 CI 仍待登记。一次性诊断分支已在核对末端提交后删除，所有实验输入、日志与结果均已归档。

## 远端实验索引

每个已完成实验目录保存 run／jobs／artifacts 元数据、原始 job 日志和下载后的附件；摘要与 artifact ID 在对应元数据中保留。`inputs.json` 保存该次提交修改的完整文件内容，未列出的文件沿父提交继承。

| 运行                                                                        | 诊断提交  | 目的与结果                                                                                       |
| --------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| [40478807872](https://github.com/ximu3/kisaki-dev/actions/runs/40478807872) | `e8efc53` | Linux 原路径 3 / 5；Apple standalone 20 / 20；独立开发准备暴露 Electron dist 缺失                |
| [40479317018](https://github.com/ximu3/kisaki-dev/actions/runs/40479317018) | `563b68d` | Linux 原路径 3 / 5 并记录监听时间线；Apple standalone 第五次关闭超时；after-development 全部通过 |
| [40479953067](https://github.com/ximu3/kisaki-dev/actions/runs/40479953067) | `5b50498` | 补齐试件目录后 Linux 4 / 5，未消除失败                                                           |
| [40480751602](https://github.com/ximu3/kisaki-dev/actions/runs/40480751602) | `00a8d2f` | 两条关闭路径各 20 / 20，记录完整退出事件；未复现卡住                                             |
| [40481030454](https://github.com/ximu3/kisaki-dev/actions/runs/40481030454) | `d02d415` | 独立 Chokidar 6 原型，原试件 Linux 5 / 5                                                         |
| [40481212521](https://github.com/ximu3/kisaki-dev/actions/runs/40481212521) | `8febfed` | 一组第十一次关闭失败，取得主进程及两个子进程的 native sample；另一组 20 / 20 |
| [40481794829](https://github.com/ximu3/kisaki-dev/actions/runs/40481794829) | `39f5f98` | Apple Silicon 与 Windows arm64 冷 Electron 准备及七项开发回归均通过，70.05 / 238.19 秒 |
| [40482395686](https://github.com/ximu3/kisaki-dev/actions/runs/40482395686) | `404e1c2` | 保留默认异常行为并安装异常记录，两组各 20 / 20，未捕获异常 |
| [40482913180](https://github.com/ximu3/kisaki-dev/actions/runs/40482913180) | `7f02348` | 两组在第九／十二次关闭失败，捕获相同 visibilityChanged 异常；第三组 20 / 20 |
| [40484423503](https://github.com/ximu3/kisaki-dev/actions/runs/40484423503) | `d7e3c3d` | 44.9.3 与 45.0.0 均通过 Apple Silicon 20 次采样、类型、原生及四窗口候选验证 |

## 后续判断边界

先修复已证实的就绪与试件问题，再评价剩余耗时。初始开发过程重复调用有限构建、打包入口再次构建、跨副本缓存共享都是后续候选；当前没有据局部计时改写其输入或交接合同。ZIP 与 NSIS 等载体具有不同身份，不能直接共用同一 ASAR 省略验证。日常增量 PR 的代表性耗时分布仍未测得，六目标范围及 Intel macOS 支持保持不变。
