# Kana 原文、搜索与视图读取验证

对应已确认的[原文、搜索与视图读取合同](../../../design/projects/kana/content.md)。本轮运行浏览器和 Electron 的实际机制，未创建正式 Kana 仓库，未执行正式 Reader 或 Kisaki 采集接入。

## 运行输入

[prepare-probe.py](prepare-probe.py) 读取固定 Unicode 18.0.0 CaseFolding 数据、CSS Text／Ruby／Unicode Normalization 规范，以及 Electron 44.5.1 的 capturePage 和 NativeImage 文档。来源、响应及 SHA-256 记录于 [source-contract.json](source-contract.json)。Case Folding 采用 C、F 项，共 1,606 个映射，不采用 Turkic 专用项。

```powershell
python refactor/verification/evidence/kana-content/prepare-probe.py
python refactor/verification/evidence/kana-content/run-probe.py
python refactor/verification/evidence/kana-content/check-view-contract.py
```

[run-probe.py](run-probe.py) 复用[已有记录](../libmpv-gpu/binary-input.json)中的 Electron 44.5.1 Windows x64，分别以设备缩放 1 和 1.5 启动隐藏窗口。页面启用 sandbox 和 contextIsolation，关闭 Node 集成，没有书内 preload 桥接。短期服务器仅服务本试验自有页面、脚本和规范数据，退出时关闭；它不属于生产资源方案。

实验代码为 [content-probe.html](content-probe.html)、[content-probe.mjs](content-probe.mjs) 与 [content-electron.cjs](content-electron.cjs)。页面及 SVG 色块均为本项目自有夹具，不包含用户书籍。

## 真实画面与几何

每次运行覆盖 zoomFactor 1／1.25 和 0／90／180／270 度，页面自身再缩放 1.25，并裁去原始页面四边。目标为裁边内的一块独立红色区域，周围是其他颜色；采集前覆盖洋红选框，宿主工具条也使用洋红，便于发现控件混入。

| 检查             | 实际结果                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| 源区域投影       | 数学投影与浏览器真实目标元素的 getBoundingClientRect 一致，允许小于 0.01 CSS 像素的比较误差                      |
| 正反变换         | 最大观察误差约 0.00000184 个源单位；初次使用 1e-8 阈值失败后记录误差，采用 1e-4 的亚像素阈值                     |
| 区域截图         | 共 16 次，每次 25 个内部采样点均来自目标红色区域；检查实际 PNG／bitmap 尺寸，并核对 CSS 尺寸到实际像素的外扩边界 |
| 原始内容排除控件 | 共 2 次完整阅读视口截图，洋红像素为 0                                                                            |
| 导航接续         | 读取期间请求的下一页面暂未采用；当前画面成功取得并结束读取后才切到第二页面                                       |
| 当前可见范围     | 被显示裁边完全排除的源区域在采集前失败                                                                           |
| 宿主变化         | 读取期间调整窗口尺寸，结果因 viewChanged 被拒绝                                                                  |
| 关闭             | 当前读取未结束时 close 未完成；读取结束后结果因 closed 被拒绝，随后关闭完成                                      |

设备缩放 1.5 的试验中，NativeImage.getScaleFactors 仍返回 [1]，实际位图却已经放大。接入因此必须核对实际位图，而不能只根据这个表示标签猜测物理像素尺寸。

结果保存于 [browser-contract.json](browser-contract.json)，包括各次源／视图矩形、像素尺寸、采样值、运行时版本、失败分支及源码指纹。源中的 beginRead／finishRead 是实验控制协议，用于在 Electron 主进程实际 capturePage 时保持范围；它不是新增正式公开 API，也不是完整 readView 实现。

其中 a.svg／b.svg 是实验色块画面的身份，切换通过改变实际绘制内容完成；它们不是从真实图片目录读取的文件。此处检验视图读取与画面更新的接续，没有证明真实文件授权或源地址恢复链路。

## 文字观察和映射

| 自有源样本             | 浏览器原生选择的实际结果       | 设计影响                                         |
| ---------------------- | ------------------------------ | ------------------------------------------------ |
| 多空格、内联节点及换行 | Alpha Beta Gamma               | 普通排版空白与源字符数量可以不同                 |
| CJK 源换行             | 你好 世界                      | 不能未经实际规则核对就假定换行一定删除或一定保留 |
| ruby base 与 rt        | 漢かん字じ                     | 原生选择会混入注音，需要明确的正文／注音解释     |
| display:none 片段      | onetwo                         | 原始节点文字串不等于当前可读原文                 |
| Straße + uppercase     | STRASSE                        | 原生选择受样式转换影响，长度也可能改变           |
| pre-wrap               | 保留首尾空格、连续空格和硬换行 | 不能对全部摘录统一 trim 或压缩空白               |

搜索映射试验实际运行 NFC 和固定完整 Case Folding，覆盖 Straße／STRASSE、跨节点组合重音、emoji 的两个 UTF-16 单元、ß 展开后相同源范围去重、全角与 ASCII 不做兼容转换、重音不被移除及希腊 sigma 大小写。七例全部匹配预期源范围。

这些例子中的 node／offset 是实验源节点标识，不是新的持久定位格式；没有运行 EPUB CFI、MOBI／KF8 字节或 FB2 节点地址解析。完整 CSS 空白投影、ruby 的独立选择和搜索、候选隐藏内容判定及 wholeWord 分词矩阵仍需继续验证。

## 公开形状与限制

[view-contract.d.ts](view-contract.d.ts) 在既有声明上提出 readView 的目标与回调结果关联；[view-consumer.ts](view-consumer.ts) 验证视口、源页面区域和 CSS 矩形不会在这些用法中混淆。[check-view-contract.py](check-view-contract.py) 的结果为 [view-declaration-contract.json](view-declaration-contract.json)：正向消费通过，五项无效用法被拒绝。该检查不是正式包 exports 验证，原有双入口声明消费记录保持独立。

以上独立试件保留当时验证输入。合同确认后，ViewportRect、ViewRead 和 readView 已统一进入 [kana-api 的纯值与 Reader 声明](../kana-api/public-contracts.md)，并在同一声明 tarball 中增加视图消费样例；当前检查为两种环境、三份消费及 29 项拒绝。ReaderWithView 只存在于上述历史试件，不是第二个公开 Reader。

本轮没有证明完整字体／图片加载期间的读取稳定性、所有滚动输入和动画暂停、复杂宿主 CSS 变换、跨显示器移动、任意 PDF／EPUB／KF8 页面、像素边界最终裁切，以及 macOS／Linux。PNG 尺寸核对允许外扩取像素的舍入，不等于已经完成最终分数像素裁切。控制协议中的关闭失效也不能代替真实 IPC 取消与资源释放链路。

实际结果按这些范围使用，不把源码哈希、类型检查或颜色夹具升级成完整格式和产品验收。
