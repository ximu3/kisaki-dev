# Vantage 与 libmpv 平台收尾依据

2026-10-21，按[本地实机不作为 macOS／Linux 定稿前提](../../acceptance.md#platform-evidence)的规则，核对剩余原生接口、组件协议和图形资源装配。对应 [Vantage 平台机制](../../../design/projects/vantage/backends.md)与 [libmpv 平台图形](../../../design/projects/libmpv-node/platforms.md)。本目录的协议和桌面条目都是设计蓝本，没有安装或运行桌面组件。

## 固定源码给出的具体依据

[source-list.json](source-list.json)列出本次读取输入；[source-probe.py](source-probe.py)保存正文到隔离缓存，并在 [source-input.json](source-input.json)中记录 URL、状态、时间、路径及内容摘要。来源中的版本发现请求只记录当时检索结果，不能代替正式依赖锁定。初次查找中不存在的路径单独保留在 [lookup-observations.json](lookup-observations.json)，不用于设计结论。

| 范围                  | 核对事实与采用判断                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS 进程            | XNU 13 对应源码区分普通进程信息、audit-token 路径查询和 PID 终止调用。部分唯一标识结构处于 PRIVATE 条件中，因此没有借它们扩大已确认的私有 API 范围；进程信息、kqueue 与公开控制接口各自承担真实保证 |
| AppKit 状态           | NSRunningApplication 动态属性受主 run loop 更新策略影响。退出判断交给原进程观察，不能用未更新的属性反复轮询代替内核事实                                                                             |
| AX 与采集对象         | 固定 Hammerspoon 源码实际调用 _AXUIElementGetWindow；采用已确认的窄桥接，并核对原进程与当前 SCWindow，不按标题或几何猜测                                                                            |
| X11 进程归属          | libwnck 和 Mutter 的固定实现使用 XRes LocalClientPid。Mutter 42 的 X11 分支和 KWin 6.8 的 X11Window 采用该机制；KWin 5.24 的 Toplevel.pid 仍是窗口属性，因此另由 Rust 按 XID 核对                   |
| KWin 通信             | 5.24 与 6.8 的 callDBus 都异步调用原生总线，成功回复递归转换 variant／列表／字典，错误不进入成功回调。选定脚本主动连接宿主、取得有限工作并回报结果的协议，期限与断连由拥有者负责                    |
| Mutter 会话           | 42 与 51.1 的 RecordWindow 都使用明确的 uint64 window-id，并核对调用 sender 是 session 的创建者。Rust 在同一连接中创建和控制采集，组件只交付原生窗口对应                                            |
| PipeWire 与 KWin 图片 | Mutter 42 明确包含可读取的 MemFd 路径及 VideoCrop；KWin ScreenShot2 返回原生格式、尺寸、stride 与 scale，并将图像写入传入 pipe。读取者按同次元数据解释，复制后释放                                  |
| KWin 颜色             | 6.8 的单窗截图使用默认 sRGB RenderTarget，QImage 格式由返回值说明。不能从某个版本的格式枚举推导全部版本具有相同排列                                                                                 |
| 旧 KWin 登记          | 5.24 直接对 Exec 作路径比较，且只取第一个匹配 KService。专用无参数别名条目与宿主自己维护的其他匹配条目必须一致；NoDisplay 不是授权或命中顺序保证                                                    |
| macOS 共享图像        | OBS 固定实现使用 IOSurface 的 BGRA、实际尺寸、rectangle texture 和 CGLTexImageIOSurface2D。选定库自己的 IOSurface 池与 FBO 装配，核心和已交付 IOSurface 的引用分别释放                              |
| Linux 共享图像        | Mesa 22 的 GBM 接口明确 rendering／linear 用途、真实 fourcc、plane、fd、stride 和 modifier。选定线性 BGRA BO 后经 EGL dma-buf 导入与 FBO，不用另一个未核实的任意纹理导出路径                        |
| libmpv／Electron      | 固定 mpv Render API 接纳实际 GL／GLES 函数环境；Electron 在本进程保留 IOSurface、复制 dma-buf fd，并要求实际布局与颜色描述。库先完成 GPU 写入，宿主最后一个消费引用释放后才归还帧                   |

这些是来源与接口核对结果，不是 macOS／Linux 已运行的证明。组件的版本适配、调用编码和实际错误仍由正式实现及平台验收检验；本轮没有复制参考项目实现作为生产依赖。

## 可审阅的有限协议

[gnome.xml](gnome.xml)规定组件导出的 session／observation 入口，[kwin.xml](kwin.xml)规定消费进程导出、由 KWin 脚本调用的有限入口。两者复用窗口事实和原生动作语义，通信方向按桌面环境的真实能力保留差异，没有新增常驻进程或通用脚本执行端点。

[capture-entry.example.desktop](capture-entry.example.desktop)示意旧 KWin 所需的宿主专用登记，路径只是示例，没有在本机或任何 Linux 桌面写入登记。正式集成依据实际执行文件建立别名、更新系统缓存并维护自己的生命周期。

## Windows 执行证据

本轮另运行了[自有 WGC 与原生颜色效果检查](../vantage-wgc/capture.md)：普通 D3D11 应用窗口取得 224 × 152 的有效图像，R16G16B16A16Float 捕获经过 Direct2D 后形成独立 sRGB RGBA 字节。普通四色样点符合预期，已知高亮阶梯压缩后仍区分三个亮度；资源关闭后图像继续有效。

最初工具窗口的创建采集项失败保留原记录。有效图像检查没有采集用户窗口，没有更改物理 HDR、显示配置或权限，也没有验证全部窗口类型、混合权限、取消竞争或正式 Node binding。

## 完成边界

本轮完成了平台方案所需的具体接口与装配核对，供同一轮整体审阅。macOS／Linux 本地验证按明确约定省略，正式平台运行状态保持未执行；Windows 只记录上述实际场景。完整原生库、六目标制品、组件安装、签名宿主、性能及产品流程仍由正式工程交付。
