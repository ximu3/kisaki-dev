# 关键合同与截图来源探针

2026-10-22 验证了时钟分段、无身份分部匹配、局部类型及截图来源补丁。以下分别记录纯规则模型、声明消费和 Windows 原生实验的实际范围。

<a id="screenshot"></a>

## 截图来源补丁与原生证据

补丁仅修改 mpv 的 player/screenshot.c。实际取图时记录是否走软件分支，随 screenshot-raw 原生 map 返回 source: vo / software；原有取图、回退、颜色和布局计算保持上游语义。vo 本身不是色彩证明，Kisaki 还须核对已经固定的受管 GPU、sRGB 输出与同次内容上下文。

| 固定项                       | 值                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| 上游提交                     | 01e2533f3143b8940857ca419b0b367f583e05ca                                                              |
| 补丁                         | [screenshot-source.patch](../../../../implementation/patches/libmpv/screenshot-source.patch)          |
| 补丁 SHA-256                 | a71f6fed21e0a5754f76cf5c0df9e34126488e0330332fc5259ffeb79d316f57                                      |
| 正常源码 SHA-256             | 6d5bbe353c97f114c6eee305495e676b83c330cd6a1b44f464018b541ded8ccf                                      |
| 正常 Windows x64 DLL SHA-256 | 2cbda16b6ee887c6ff0e5c2cd5205ef056086aaf264f9e278664f5b35591655e                                      |
| 构建与完整输入               | [构建收据](screenshot-build.json)，复用已固定的[依赖实验组合](../../libmpv-package/engine-build.json) |
| 运行原始结果                 | [五场景收据](screenshot-results.json)                                                                 |

在原固定依赖缓存上克隆上游源码，按清单顺序应用黑色字幕保护与本次补丁，Meson 完整构建通过。原生观察探针直接读取该次 map 的 source，借探针的字符串字段交付观察值；这项测试适配不是正式 libmpv-node API。

| 场景                 | screenshot-sw | 实际 source | 观察结果                                      |
| -------------------- | ------------- | ----------- | --------------------------------------------- |
| sRGB 原色            | false         | vo          | 与 GPU 样本、独立 sRGB 参考相符               |
| Display P3 原色      | false         | vo          | 与 GPU 样本、独立 P3 转换参考相符             |
| HDR → sRGB           | false         | vo          | 与已配置 SDR GPU 输出样本相符                 |
| HDR 主动软件截图     | true          | software    | 返回源侧软件结果，不满足本体 SDR 接纳条件     |
| HDR 强制 VO 无图回退 | false         | software    | 与主动软件结果相符，和 SDR GPU 结果有明显差异 |

像素比较允许 2 个整数通道值的误差；回退与 SDR 对照的最大通道差异超过 20。独立数据在核心关闭及帧释放后仍有效。原生五场景与 20 项模型／像素断言通过。

强制回退试件只在私有测试源码中释放 VO 已返回的图像，再让原有回退分支继续执行。它证明“选项为 false 但仍回退”时来源标记准确；没有制造物理设备故障，也没有执行正式 Kisaki 拒绝逻辑。宿主接纳只由纯规则模型核对。注入后的 DLL 单独保存，正常 DLL 保持不变；测试源码恢复为正常补丁版。发行补丁不包含故障注入。

本轮未新验收无图整体失败、负 stride、持续采集、macOS／Linux 或完整正式绑定。它们继续属于[libmpv 场景](../../../scenarios/libmpv.md)及[本体采集](../../../../design/engineering/integrations.md#screenshot)，不由这五项结果代替。

<a id="types-models"></a>

## 声明与规则检查

[check_types.py](check_types.py)从现行文档提取 14 个代码块，组合必要的拥有者值，生成[声明样例](contracts.ts)及[编译配置](tsconfig.json)。正常的保存结果、标注、分部、搜索和导航输入通过；17 项预期类型拒绝成立，见[检查结果](type-results.json)。数值范围、真实文件归属和全部公开包仍不在这项编译检查内。

[verify_models.py](verify_models.py)核对正常、回拨、前跳及容差边界的区间，分部唯一／歧义／不足与新增资格，以及原生像素和截图接纳条件；结果为[20 项通过](model-results.json)。模型用来检验规则自洽，不代表数据库、会话或宿主实现已经通过。

<a id="reproduction"></a>

## 复现

从仓库根目录运行。只重算声明和规则时，使用已记录的原生像素收据；输出默认写入 node_modules/.cache/libmpv-design/contract-closure-replay/receipts，不改写本目录历史结果：

```powershell
python -B -X utf8 refactor/verification/evidence/contract-closure/2026-10-22/check_types.py
python -B -X utf8 refactor/verification/evidence/contract-closure/2026-10-22/verify_models.py
```

原生复现需要 Windows x64、可用的 D3D11 图形环境、MSVC／Rust／Node，以及既有[引擎输入](../../libmpv-package/engine-input.json)和[截图输入](../../libmpv-screenshot/source-input.json)引用的固定源码、工具链、依赖、媒体、Lua 和探针缓存。这不是从干净机器联网安装依赖的发行构建脚本；缓存缺席时先按原证据恢复输入并核对哈希，不更换为当前最新版。

为完整原生重跑选一个新工作目录，然后依序执行：

```powershell
$env:KISAKI_CLOSURE_WORK = Join-Path (Get-Location) 'node_modules/.cache/libmpv-design/contract-closure-native-replay'
python -B -X utf8 refactor/verification/evidence/contract-closure/2026-10-22/build_screenshot_probe.py
python -B -X utf8 refactor/verification/evidence/contract-closure/2026-10-22/run_screenshot_probe.py
python -B -X utf8 refactor/verification/evidence/contract-closure/2026-10-22/run_screenshot_fallback.py
python -B -X utf8 refactor/verification/evidence/contract-closure/2026-10-22/verify_models.py
```

[probe_paths.py](probe_paths.py)支持 KISAKI_REFACTOR_ROOT、KISAKI_CLOSURE_WORK 和 KISAKI_CLOSURE_OUT。构建拒绝覆盖已有源码目录。回退脚本在 finally 中恢复私有源码和正常输入，注入构建仅放入 fallback-runtime；build 目录的最后一次编译产物仍可能是故障版，只使用正常 runtime 的 DLL 作为正常探针输入。脚本归档时补充了路径参数及失败恢复，原生结果对应上面记录的实际构建。
