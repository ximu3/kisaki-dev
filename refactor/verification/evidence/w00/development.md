# 开发监听与隔离副本

工程使用 Vite 8.3.3、Chokidar 6.0.0 和 Turbo 2.11.10。开发会话合同见[工作区](../../../design/engineering/workspace.md#desktop-development)，运行结果见[工程验证](README.md)。

## 监听与就绪

Vite 管理 renderer HMR，Chokidar 管理完整运行时和依赖输入。会话一次登记输入并等待 ready，再开始首次编译；监听的寿命覆盖 Vite 服务重启。初始化失败释放已建立资源，运行错误交给会话处理。

[输入监听用例](../../../../clients/desktop/app/tests/tools/inputs.test.ts)在真实 Vite 重启后修改源码、配置和依赖输入，验证变更仍被观察，并核对文档、测试与生成文件的排除范围。[Vite 服务器 API](https://vite.dev/guide/api-javascript.html#vitedevserver)和 [Chokidar 6 源码](https://github.com/paulmillr/chokidar/blob/6.0.0/src/index.ts)提供对应接口依据。

## 隔离副本

开发回归在独立 workspace 中安装固定依赖并建立有效 Git HEAD，使 Turbo 按源码和配置形成稳定输入身份。安装优先复用已准备的包存储，由 pnpm 补齐合成依赖解析所需的元数据。副本拥有自己的源码、合成依赖、资料目录及构建输出，测试结束后统一释放。

[开发回归](../../../../clients/desktop/app/tests/tools/dev/session.test.ts)在同一个隔离副本中覆盖正常退出取消、编译失败后的可用实例、源码改名恢复、依赖恢复和 HMR，以及启动准备取消后的进程关闭与完整重试。每项用例拥有自己的进程并恢复修改的输入。Electron 分发文件通过已安装包的公开入口取得，复制时保留平台链接结构。

关闭取消由载体启动参数选择，停止失败通过已有 launch 回调返回的应用边界注入；命令取消错误通过隔离副本的包 exports 选择专用测试入口。源码、配置与依赖输入的修改用于验证重建、恢复和 HMR 行为。命令错误回归核对失败结果及资源释放，完整重试由普通取消场景覆盖。

<a id="shutdown"></a>

## 错误交付与关闭复核

2026-11-02，在 Node 24.11.1、Electron 45.0.0 和 Vitest 5.0.5 下复核开发工作进程的失败路径。应用停止失败会立即报告，并进入测试拥有者的终止清理；启动就绪等待在工作进程提前退出时拒绝。取消只识别其实际原因，同时发生的命令或清理错误继续向调用方交付。

本机对照中，`f17bce8` 的工作进程在应用 stop 拒绝后仍等待 closed，新增回归在退出等待处失败；`5d518b3` 的会话把取消期间的独立命令错误当作成功退出，新增回归得到退出码 0 而非 1。对应修复后的两个场景均通过。操作失败与清理失败的组合由[共用工程函数](../../../implementation/development.md#shared-tooling)保留，测试生命周期由各框架承担。

| Linux arm64 复核 | 对应输入 | 实际结果 |
| --- | --- | --- |
| [完整开发场景重复](https://github.com/ximu3/kisaki-dev/actions/runs/41411975644) | `5d518b3`；5 个场景各运行 10 次 | 50 次场景执行通过。 |
| [准备取消、并发命令失败及完整重试](https://github.com/ximu3/kisaki-dev/actions/runs/41415094837) | `13b6189`；2 个场景各运行 25 次 | 50 次场景执行通过。 |

原始 [Linux arm64 运行](https://github.com/ximu3/kisaki-dev/actions/runs/41406851531/job/125150900039)已完成准备取消和重试启动，随后在等待关闭时触发 240 秒用例超时。原记录没有关闭阶段及停止失败的及时诊断，不能据此确认具体触发原因，也不能证明它与上述已修复缺陷同源。两轮复核未再次触发该超时；其根因仍列为待确认。

工作进程的完整有界诊断由测试失败钩子在清理后输出一次，观察记录保存在测试制品中。异常消息说明阶段和退出状态，断言读取捕获的输出。`NODE_DEBUG=kisaki:*` 可显示开发会话、应用及 utility process 的关闭阶段；Node 的进程 exit 与输出流 close 分别记录，依据 [child process 生命周期](https://nodejs.org/api/child_process.html#event-close)。两轮临时重复运行使用 [Vitest repeats](https://vitest.dev/api/test#repeats)，正常与清理失败分别保留，依据 [onTestFinished](https://vitest.dev/api/hooks.html#ontestfinished)。
