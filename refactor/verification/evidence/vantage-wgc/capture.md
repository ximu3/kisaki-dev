# Windows WGC 与原生颜色效果验证

本轮用于核对 Vantage 已选择的 Windows Graphics Capture 路线，以及浮点捕获到 sRGB 图像的原生转换。试件只创建并采集自己的 D3D11 四色窗口，没有枚举或采集用户窗口，没有调整显示器、HDR、权限或系统设置。

## 构建与执行

[Cargo.toml](Cargo.toml)与 [Cargo.lock](Cargo.lock)固定隔离试件的 cc 构建依赖。Rust 程序调用 [capture.cpp](capture.cpp)中的 C++/WinRT 接口，颜色转换位于 [color.cpp](color.cpp)；这是系统机制试件，正式 Vantage Rust 后端仍按这些原生接口实现。构建输出在仓库忽略的独立缓存中，没有改动应用工程、正式包或全局工具链。

[run.py](run.py)通过无控制台子进程运行试件，最多等待 25 秒。试件短暂显示自有应用窗口，使用其直接返回的 HWND 创建 capture item，排除系统光标，以 CreateFreeThreaded 帧池取得 R16G16B16A16Float 图像。显示后检查时没有成为前台窗口。随后记录的[环境信息](environment.json)为 Windows 10 19045 x64、Rust／Cargo 1.90.0；这不替代最低 19041 及另一架构的正式运行验收。

回调持有独立状态与所需 COM 资源，关闭标记阻止继续接纳图像；调用结束依次撤销帧事件、关闭 session／frame pool 并销毁自有窗口。按同帧 ContentSize 解释有效区域，经 GPU 复制、读取及 premultiplied 到 straight alpha 的转换形成独立 RGBA 字节，PNG 在这些窗口资源释放后编码。

## 观察结果

| 检查         | 实际结果                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| 指定自有窗口 | 创建 capture item、帧池和采集会话成功，取得一帧                                       |
| 有效尺寸     | 224 × 152，依据 WGC 的同帧 ContentSize；保留原生标题栏范围                            |
| 四色样点     | 红、绿、蓝、白均为预期的 RGBA 值，alpha 为 255                                        |
| 浮点到 sRGB  | Direct2D HdrToneMap 与 ColorManagement 实际执行，普通受控色块保持预期                 |
| 高亮压缩     | 自有 scRGB 2／4／8 中性像素经原生效果变为 230／244／250，保持中性、次序和不透明 alpha |
| 资源与结果   | 事件已撤销，session、frame pool 和窗口已关闭；复制后的图像仍可读取，进程正常退出      |

原始结果和二进制、源码、图像摘要见 [capture-contract.json](capture-contract.json)。[capture.png](capture.png)仅包含该自有窗口，已检查图像内容。

## 初始失败

最初的试件使用尚未呈现的工具窗口，在创建采集项时得到 E_INVALIDARG；[初始记录](initial-observation.json)保留原脚本快照摘要和失败状态。随后改为已呈现的普通应用窗口，取得有效图像。窗口类型和呈现次序同时改变，因此本轮没有单独判定哪项属性触发原失败，也不据此推断所有工具窗口都不可采集。

初始失败不是正式实现中的已修复缺陷，也没有通过桌面裁切或其他采集后端替换 WGC。

## 颜色依据与范围

[HDR tone map effect](https://learn.microsoft.com/en-us/windows/win32/direct2d/hdr-tone-map-effect)规定输入和输出最大亮度及 SDR 模式，并列出 Windows 10 1809／17763 的支持下限；[Win2D 对应接口](https://microsoft.github.io/Win2D/WinUI3/html/T_Microsoft_Graphics_Canvas_Effects_HdrToneMapEffect.htm)同样标明 17763。该效果可以纳入已确认的 Windows 10 2004 基线；枚举说明页的另一最低版本标注不用于自行提高项目下限。

本轮输入亮度来自已知夹具：正常色块按 Windows scRGB 的 80 nit 基准解释，高亮夹具的最大值为 640 nit，文件输出目标使用标准 SDR 基准。实际窗口的最大内容亮度估计、宽色域、透明边缘及完整图像回归仍由正式实现完成；[Microsoft 的固定示例](https://github.com/microsoft/Windows-universal-samples/blob/dca302ef956bb9a2653da4e3d925de4bbf4fa174/Samples/D2DAdvancedColorImages/cpp/D2DAdvancedColorImages/D2DAdvancedColorImagesRenderer.cpp)提供内容亮度估计与效果装配依据。

本轮没有打开物理 HDR 显示，没有采集真实 HDR 应用、测试混合权限、受保护窗口、最小化、持续尺寸变化、取消竞争或 Node binding。相应收据字段保持 false。这些完整运行条件不被一个成功的自有窗口试件替代；本次证据只支持选定采集、原生颜色处理和独立字节交付机制。
