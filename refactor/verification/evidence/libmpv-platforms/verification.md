# libmpv-node 平台与原生能力检查

对应[原生能力、平台与输出](../../../design/projects/libmpv-node/platforms.md)。平台路线、依赖归属与 SDR／HDR 渲染目标方向已经确认；来源收据保留执行时的 proposal 状态。本次核对公共 Render／Stream CB 边界、平台硬件解码接入、Electron 共享纹理、ANGLE 装配与颜色输出所需事实；没有构建或执行新的原生库。

## 来源与可复核结果

[source-probe.py](source-probe.py)读取固定 mpv v0.41.0、Electron 44.5.1、ANGLE 源码快照及官方平台规范，保存 URL、时间、SHA-256 和定位标记。ANGLE 快照只是接口研究输入，不构成发行版本选择。执行结果见 [source-contract.json](source-contract.json)。

本次 22 项来源均返回 HTTP 200，全部定位标记通过。实际头文件包含 8 个 Render API 导出函数和 1 个 Stream CB 导出函数；Linux SharedImage 的 usage 分支也已按固定源码核对。这些计数不是功能覆盖率或平台通过数量。

```sh
python refactor/verification/evidence/libmpv-platforms/source-probe.py
```

| 核对项            | 源码能够支持的结论                                                         | 不能由此推断                                                       |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Render API        | 公共入口提供 OpenGL／ES 和软件渲染；固定 GPU 接入使用 GL 渲染器            | 可以从公开 API 直接选择 gpu-next、Vulkan 或 Metal 渲染上下文       |
| 平台互操作        | 存在 ANGLE／D3D11、CGL／IOSurface、VAAPI／DRM 接入与相应导出接口           | 候选输出资源已经能在全部目标稳定生产、同步和导入                   |
| Electron 共享资源 | 导入分别复制 NT 句柄、保留 IOSurface、复制 dma-buf fd                      | 底层纹理可以在回收回调前被生产者复用                               |
| Linux 消费        | 所选源码为导入 SharedImage 声明 GL 与显示 usage，未声明相同的 WebGPU usage | 设置 supportsZeroCopyWebGpuImport 后就能保证 WebGPU 交接           |
| macOS 路线        | Apple 已弃用 OpenGL；所选 mpv 直接 GL 硬件解码仍要求 CGL                   | 可以把 ANGLE／Metal 换进去而不验证解码互操作或维护成本             |
| Windows 装配      | mpv 有固定库名的动态加载分支与链接分支，ANGLE 支持库名后缀                 | 独立发布的同名 DLL 已经消除了与宿主的加载冲突                      |
| Stream CB         | 协议登记归核心寿命，流归其 close 回调；回调重入与取消有原生约束            | 销毁客户端能注销协议，或给 C 回调换成 Promise 声明就完成 Node 桥接 |

Electron 源码中残留的 Linux “to be implemented” 注释不作为能力结论：实际转换与导入分支已经处理 planes 和 fd。反过来，存在导入分支也不代表对应驱动、格式或显示路径经过本项目验证。两项判断均按实际代码和所需链路区分。

当前工作区 package.json 与安装的 Electron 路径属于 41.2.0；规划中的消费验证基线是 44.5.1。本次未把旧环境当作新版本测试，也未借用其 ANGLE 制品来证明独立库装配。

HDR 补充核对使用固定 options.rst、vo.rst 和 GPU video.c：mpv 已有目标颜色、峰值与色调映射机制；gpu-next 的显示颜色协商与当前 Render API 的 GL 路径不同。GL 未获明确目标信息时的 BT.709／gamma 2.2 行为，不能写成 mpv 在所有输出模式下都固定使用 sRGB。此项同样属于源码核对，未执行 HDR 片源、显示器探测或颜色夹具。

独立播放器的能力比较只用于确认底层边界。库的验证对象是渲染目标、帧颜色、同步和寿命；窗口、显示目标选择与最终呈现由独立消费程序验证，不据此给库增加客户端功能或另一套 HDR 算法。

## 原型必须继续解决的事项

依赖与功能矩阵、Windows 独立 ANGLE 加载、Linux 渲染节点与 modifier 组合、真实输出同步、持帧期间关闭、初始化脚本提前加载、受管保留项、准确 SDR／HDR 颜色合同，以及自定义流的异步提供器桥接仍未完成。六目标实测和完整目录生成也未执行。

本次只核对固定源码，未执行原生解码、纹理互操作、显示或六目标构建；结构化结果中的对应运行标记均为 false。

以上标记属于本组历史源码检查。后续已有 [Stream CB 的 Node 桥接](../libmpv-node-bridge/verification.md)、[能力与设置采集](../libmpv-catalog/verification.md)以及 [Windows GPU／Electron 44.5.1 链路](../libmpv-gpu/verification.md)的独立运行证据。较新上游新增的 D3D11 直接入口也已识别，但尚未执行该后端；不改写本组固定基线来源的历史状态。
