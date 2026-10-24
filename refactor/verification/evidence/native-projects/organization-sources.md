# 原生项目工程组织的源码依据

对应 [Vantage 与 libmpv-node 工程组织](../../../design/projects/native-runtime.md)，本轮组织方案已确认。这里记录支持职责拆分的上游事实，未构建两个独立项目，未执行操作系统后端、libmpv 渲染或 Electron GPU 交接。

## 固定来源与结论

[source-probe.py](source-probe.py) 读取十六项官方来源并记录 URL、HTTP 状态、时间、字节数与 SHA-256，均返回 HTTP 200。结果见 [organization-source-contract.json](organization-source-contract.json)。

本轮 libmpv 源码对照使用 v0.41.0，tag 对应提交 41f6a645068483470267271e1d09966ca3b9f413，Client API 版本为 2.5。该对照用于理解公开边界，不表示已经构建了对应平台制品或完成了运行依赖选择。

| 来源                                                                                                                                              | 已核实事实                                                                                    | 对组织的影响                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Node-API ABI](https://nodejs.org/docs/latest-v24.x/api/n-api.html#implications-of-abi-stability)                                                 | Node-API 的 ABI 范围不自动覆盖 V8／Node C++、libuv 或任意外部库                               | 绑定以 Node-API 为界；平台、图形库与 libmpv 依赖分别检查                                              |
| [Node 环境清理](https://nodejs.org/docs/latest-v24.x/api/n-api.html#finalization-on-the-exit-of-the-nodejs-environment)                           | 环境可能在禁止后续 JavaScript 执行的情况下退出；显式清理钩子用于安排原生资源收尾              | 环境清理属于 binding，不能由正常 UI 回调补做，也不能混成进程或播放业务完成                            |
| [napi-rs 线程安全回调](https://napi.rs/docs/concepts/threadsafe-function)与[寿命](https://napi.rs/docs/concepts/understanding-lifetime)           | JavaScript 环境值具有所属环境和寿命约束；跨线程数据需有独立拥有权，线程安全回调承担转换与交付 | Rust core 不持有短寿命 JS 值；Node binding 维护真实回调关系与清理                                     |
| [napi-rs 工程入口](https://napi.rs/docs/introduction/getting-started)与[平台包生成](https://napi.rs/docs/cli/create-npm-dirs)                     | 工具可生成原生加载器、声明与逐目标 npm 包；目标声明不等于全部目标已经构建                     | 主包与平台包分别装配，同版本配对；CLI 构建条件与 addon 运行条件分别记录                               |
| [Cargo workspace](https://doc.rust-lang.org/cargo/reference/workspaces.html)与[包布局](https://doc.rust-lang.org/cargo/guide/project-layout.html) | workspace 管理实际成员及共用锁文件；Rust 源码和集成测试由具体包拥有                           | crates 保留明确包边界，crate 测试与根级消费验证分开；规范并不要求所有 Node 原生项目固定拆成两个 crate |
| [GNOME 扩展结构](https://gjs.guide/extensions/overview/anatomy.html)                                                                              | 扩展有独立元数据、入口和安装格式，入口运行于 GNOME Shell 环境                                 | 桌面端组件单独放入 integrations/linux/gnome-shell，Rust 接入留在 crate 内                             |
| [KWin 脚本结构](https://develop.kde.org/docs/plasma/kwin/)                                                                                        | KWin 脚本有自己的元数据及 JS／QML 入口，按桌面组件安装                                        | integrations/linux/kwin 拥有该宿主包的源码与装配；这不证明 Vantage 所需全部操作可行                   |
| [Rust 模块组织](https://doc.rust-lang.org/book/ch07-05-separating-modules-into-different-files.html)                                              | 模块入口文件与同名子目录可以共同组织一个模块及其子模块                                        | client.rs、video.rs 承载真实入口，子目录保存私有协作实现，不增加转发层                                |
| [固定 client.h](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/client.h)                             | Client API 提供命令／属性、请求关联、事件读取、原生值释放和实例销毁；异步回复由同一事件流返回 | client 拥有控制机制及其请求、事件、转换拆分；video 拥有输出、渲染与独立帧持有                         |
| [固定 render.h](https://github.com/mpv-player/mpv/blob/41f6a645068483470267271e1d09966ca3b9f413/include/mpv/render.h)                             | Render API 提供 OpenGL 和软件接入；每个核心最多一个活动渲染上下文，受线程与释放顺序约束       | video 拥有图形上下文和渲染调度，平台共享资源由本库接入；普通命令回复不充当画面就绪                    |
| [Electron sharedTexture](https://www.electronjs.org/docs/latest/api/shared-texture)                                                               | 主进程导入平台共享纹理，allReferencesReleased 表示各进程中的引用全部释放                      | Electron 接入留在 Kisaki，独立库以自身 NativeFrame 持有合同配合                                       |

资料中的工具版本要求、推荐 Node 版本和支持矩阵不能直接替代本项目的运行声明；尤其不能把 CLI 能运行解释为 addon 或图形链路已经通过。napi-rs 提供生成与接入能力，也不替本项目证明观察连续性、实例身份或关闭后的帧寿命。

## 本次实际做了什么

读取固定 tag 的两个 C 头文件，核对 Client API 版本及十五项相关符号的存在；读取 Node-API、napi-rs、Electron、Cargo、Rust 模块及 GNOME／KWin 的官方接口与工程说明。源内容按文本处理，没有执行远程代码、生成正式 crate、加载 addon、采集用户窗口或修改运行项目。

```powershell
python refactor/verification/evidence/native-projects/source-probe.py
```

脚本验证来源可读取、固定 tag 对应和声明符号，不能用来验证这些 API 的真实运行行为。组织文档及本次确认状态另做本地链接与格式检查，不将其计为平台功能测试。
